import { afterEach, expect, test, vi } from 'vitest'
import type { ReactElement, ReactNode } from 'react'
import { createSessionDialogs } from './session-dialog'

const renderer = vi.hoisted(() => ({ roots: [] as Array<{ tree?: ReactNode; render: ReturnType<typeof vi.fn>; unmount: ReturnType<typeof vi.fn> }> }))
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({ Modal: 'sdk-modal', Input: 'sdk-input', Button: 'sdk-button' }))
vi.mock('react-dom/client', () => ({ createRoot: vi.fn(() => {
  const root = { tree: undefined as ReactNode, render: vi.fn(), unmount: vi.fn() }
  root.render.mockImplementation((tree: ReactNode) => { root.tree = tree })
  renderer.roots.push(root)
  return root
}) }))

class ElementFixture {
  children: ElementFixture[] = []
  parent?: ElementFixture
  dataset: Record<string, string> = {}
  isConnected = true
  value = ''
  focus = vi.fn()
  select = vi.fn()
  appendChild(child: ElementFixture) { this.children.push(child); child.parent = this; return child }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.isConnected = false }
}
type Props = Record<string, unknown> & { children?: ReactNode; onSubmit?: (event: { preventDefault(): void }) => void; onClose?: () => void; onClick?: () => void; ref?: (input: HTMLInputElement | null) => void }
function fixture() {
  const body = new ElementFixture()
  const previousFocus = new ElementFixture()
  const doc = { body, activeElement: previousFocus, defaultView: { HTMLElement: ElementFixture }, createElement: () => new ElementFixture() }
  previousFocus.focus.mockImplementation(() => { doc.activeElement = previousFocus })
  const dialogs = createSessionDialogs(doc as unknown as Document)
  const options = { title: 'Rename session', initialValue: 'Old title', cancelLabel: 'Cancel', saveLabel: 'Save' }
  const root = () => renderer.roots.at(-1)!
  function find(type: string): ReactElement<Props>[] {
    const walk = (node: ReactNode): ReactElement<Props>[] => {
      if (Array.isArray(node)) return node.flatMap(walk)
      if (!node || typeof node !== 'object' || !('props' in node)) return []
      const element = node as ReactElement<Props>
      return [...(element.type === type ? [element] : []), ...walk(element.props.children), ...walk(element.props.footer as ReactNode)]
    }
    return walk(root().tree)
  }
  const input = new ElementFixture()
  const mountInput = () => { input.value = options.initialValue; (find('sdk-input')[0] as (ReactElement<Props> & { ref?: Props['ref'] }) | undefined)?.ref?.(input as unknown as HTMLInputElement) }
  const submit = () => find('form')[0]!.props.onSubmit!({ preventDefault: vi.fn() })
  const close = () => find('sdk-modal')[0]!.props.onClose!()
  return { doc, body, previousFocus, dialogs, options, root, find, input, mountInput, submit, close }
}
const flush = async () => { await Promise.resolve(); await Promise.resolve() }
afterEach(() => { renderer.roots.length = 0; vi.clearAllMocks() })

test('uses official chrome, accessible input without a duplicate label, and primary save', async () => {
  const f = fixture()
  f.dialogs.open({ ...f.options, submit: vi.fn() })
  expect(f.find('sdk-modal')[0]!.props).toMatchObject({ open: true, title: f.options.title, closeLabel: 'Cancel' })
  expect(f.find('sdk-input')[0]!.props).toMatchObject({ defaultValue: 'Old title', 'aria-label': f.options.title, 'data-modal-autofocus': true })
  expect(f.find('label')).toHaveLength(0)
  expect(f.find('sdk-button').map(button => button.props.variant)).toEqual(['ghost', 'primary'])
  expect(f.find('sdk-button')[1]!.props.form).toBe(f.find('form')[0]!.props.id)
  f.mountInput()
  expect(f.input.select).toHaveBeenCalledOnce()
  f.dialogs.dispose()
  await flush()
})

test('cancel and SDK Escape/backdrop close abort and defer safe unmount, restoring focus', async () => {
  for (const cancelButton of [false, true]) {
    const f = fixture()
    const rename = vi.fn()
    f.dialogs.open({ ...f.options, submit: rename })
    f.doc.activeElement = f.input
    if (cancelButton) f.find('sdk-button')[0]!.props.onClick!()
    else f.close()
    f.close()
    expect(f.root().unmount).not.toHaveBeenCalled()
    await flush()
    expect(rename).not.toHaveBeenCalled()
    expect(f.root().unmount).toHaveBeenCalledOnce()
    expect(f.body.children).toHaveLength(0)
    expect(f.previousFocus.focus).toHaveBeenCalledOnce()
  }
})

test('blank titles never submit; immediate guard trims and prevents duplicates or replacement', async () => {
  const f = fixture()
  let resolve!: () => void
  const rename = vi.fn<(value: string, signal: AbortSignal) => Promise<void>>(() => new Promise(done => { resolve = done }))
  f.dialogs.open({ ...f.options, submit: rename })
  f.mountInput()
  f.input.value = '   '
  f.submit()
  expect(rename).not.toHaveBeenCalled()
  f.input.value = ' New title '
  f.submit(); f.submit()
  f.dialogs.open({ ...f.options, submit: vi.fn() })
  expect(renderer.roots).toHaveLength(1)
  expect(rename).toHaveBeenCalledTimes(1)
  expect(rename.mock.calls[0]![0]).toBe('New title')
  expect(f.find('sdk-input')[0]!.props.disabled).toBe(true)
  expect(f.find('sdk-button')[1]!.props.disabled).toBe(true)
  expect(f.find('form')[0]!.props['aria-busy']).toBe(true)
  resolve()
  await flush()
  expect(f.body.children).toHaveLength(0)
})

test('failure is an inline alert; retry restores enabled controls and input focus', async () => {
  const f = fixture()
  const rename = vi.fn().mockRejectedValueOnce(new Error('Remote rename refused')).mockResolvedValueOnce(undefined)
  f.dialogs.open({ ...f.options, submit: rename })
  f.mountInput(); f.submit()
  await flush()
  expect(f.find('p')[0]!.props).toMatchObject({ role: 'alert', children: 'Remote rename refused' })
  expect(f.find('sdk-input')[0]!.props.disabled).toBe(false)
  expect(f.find('sdk-input')[0]!.props['aria-describedby']).toBe(f.find('p')[0]!.props.id)
  ;(f.find('sdk-input')[0] as ReactElement<Props> & { ref: NonNullable<Props['ref']> }).ref(f.input as unknown as HTMLInputElement)
  expect(f.input.focus).toHaveBeenCalledOnce()
  expect(f.input.select).toHaveBeenCalledOnce()
  f.submit()
  await flush()
  expect(rename).toHaveBeenCalledTimes(2)
  expect(f.body.children).toHaveLength(0)
})

test('dispose/cancel abort pending callbacks; late success and failure cannot affect a newer root', async () => {
  for (const rejects of [false, true]) {
    const f = fixture()
    let settle!: () => void
    let signal!: AbortSignal
    f.dialogs.open({ ...f.options, submit: (_value, nextSignal) => {
      signal = nextSignal
      return new Promise<void>((resolve, reject) => { settle = () => rejects ? reject(new Error('Late failure')) : resolve() })
    } })
    f.mountInput(); f.submit(); f.close()
    expect(signal.aborted).toBe(true)
    await flush()
    f.dialogs.open({ ...f.options, submit: vi.fn() })
    const nextRoot = f.root()
    settle()
    await flush()
    expect(nextRoot.unmount).not.toHaveBeenCalled()
    expect(nextRoot.render).toHaveBeenCalledOnce()
    f.dialogs.dispose()
    await flush()
    f.dialogs.open({ ...f.options, submit: vi.fn() })
    expect(f.body.children).toHaveLength(0)
  }
})

test('confirmation has no input, autofocuses cancel, and submits empty value explicitly', async () => {
  const f = fixture()
  const confirm = vi.fn().mockResolvedValue(undefined)
  f.dialogs.open({ title: 'Archive', message: 'Session is running', cancelLabel: 'Cancel', saveLabel: 'Archive', submit: confirm })
  expect(f.find('sdk-input')).toHaveLength(0)
  expect(f.find('p')[0]!.props.children).toBe('Session is running')
  expect(f.find('sdk-button')[0]!.props['data-modal-autofocus']).toBe(true)
  expect(confirm).not.toHaveBeenCalled()
  f.submit()
  expect(confirm.mock.calls[0]![0]).toBe('')
  await flush()
  expect(f.body.children).toHaveLength(0)
})

test('disposal aborts an in-flight save immediately and suppresses late errors', async () => {
  const f = fixture()
  let signal!: AbortSignal
  let reject!: (cause: Error) => void
  f.dialogs.open({ ...f.options, submit: (_value, nextSignal) => {
    signal = nextSignal
    return new Promise<void>((_resolve, fail) => { reject = fail })
  } })
  f.mountInput(); f.submit()
  const root = f.root()
  f.dialogs.dispose()
  expect(signal.aborted).toBe(true)
  expect(root.unmount).not.toHaveBeenCalled()
  reject(new Error('Late failure'))
  await flush()
  expect(root.render).toHaveBeenCalledTimes(2)
  expect(root.unmount).toHaveBeenCalledOnce()
  f.dialogs.open({ ...f.options, submit: vi.fn() })
  expect(f.body.children).toHaveLength(0)
})

test('synchronous submit errors and empty error messages still allow retry', async () => {
  const f = fixture()
  const submit = vi.fn().mockImplementationOnce(() => { throw new Error('') }).mockResolvedValueOnce(undefined)
  f.dialogs.open({ ...f.options, submit })
  f.mountInput(); f.submit()
  expect(f.find('p')[0]!.props).toMatchObject({ role: 'alert', children: '' })
  expect(f.find('sdk-button')[1]!.props.disabled).toBe(false)
  f.submit()
  await flush()
  expect(f.body.children).toHaveLength(0)
})

test('official Modal return focus does not receive a duplicate fallback focus', async () => {
  const f = fixture()
  f.dialogs.open({ ...f.options, submit: vi.fn() })
  f.doc.activeElement = f.input
  f.root().unmount.mockImplementation(() => { f.previousFocus.focus() })
  f.close()
  await flush()
  expect(f.previousFocus.focus).toHaveBeenCalledOnce()
})

test('reopening is blocked until deferred cleanup finishes and retained callbacks cannot submit', async () => {
  const f = fixture()
  const save = vi.fn().mockResolvedValue(undefined)
  f.dialogs.open({ ...f.options, submit: save })
  const retainedSubmit = f.find('form')[0]!.props.onSubmit!
  f.close()
  f.dialogs.open({ ...f.options, submit: save })
  retainedSubmit({ preventDefault: vi.fn() })
  expect(renderer.roots).toHaveLength(1)
  expect(save).not.toHaveBeenCalled()
  await flush()
  f.dialogs.open({ ...f.options, submit: save })
  expect(renderer.roots).toHaveLength(2)
  f.dialogs.dispose()
  await flush()
})

test('disconnected focus does not throw during cleanup', async () => {
  const f = fixture()
  f.previousFocus.isConnected = false
  f.dialogs.open({ ...f.options, submit: vi.fn() })
  f.dialogs.dispose()
  await flush()
  expect(f.previousFocus.focus).not.toHaveBeenCalled()
  expect(f.body.children).toHaveLength(0)
})

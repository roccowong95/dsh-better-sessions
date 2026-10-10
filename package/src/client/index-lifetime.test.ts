import { afterEach, expect, test, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { BrowserInjected } from './components/Browser'
import { apply } from './index'

// Keep this test on the real apply callbacks without loading the renderer or stores.
vi.mock('./components/Browser', () => ({ Browser: {} }))
vi.mock('./stores', () => ({ createGroupsStore: () => ({}) }))
vi.mock('./session-dialog', () => ({ createSessionDialogs: () => ({ dispose: vi.fn() }) }))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (cause: unknown) => void
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

class ElementFixture {
  children: ElementFixture[] = []
  parent?: ElementFixture
  style = { cssText: '', marginInlineStart: '' }
  textContent = ''
  type = ''
  setAttribute() {}
  addEventListener() {}
  append(...children: ElementFixture[]) { children.forEach(child => this.appendChild(child)) }
  appendChild(child: ElementFixture) { this.children.push(child); child.parent = this; return child }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this) }
}

function fixture() {
  const body = new ElementFixture()
  const head = new ElementFixture()
  vi.stubGlobal('document', { body, head, createElement: () => new ElementFixture() })
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const cleanups: (() => void)[] = []
  let injected!: BrowserInjected
  const pending = deferred<string>()
  const sessionIds = ['parent', 'next']
  const uiWorkspace = {
    pinSession: vi.fn(() => pending.promise),
    unpinSession: vi.fn(() => pending.promise),
    archiveSession: vi.fn(() => pending.promise),
    unarchiveSession: vi.fn(() => pending.promise),
    forkSession: vi.fn(() => pending.promise),
    pickDirectory: vi.fn(() => pending.promise),
  }
  const workspaces = {
    list: { getSnapshot: vi.fn(() => ({ items: [{ workspaceId: 'workspace', sessionIds }] })) },
    insertSessionBefore: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue(undefined),
  }
  const ctx = {
    effect: (effect: () => () => void) => { cleanups.push(effect()) },
    locale: { register: () => () => {}, bind: () => (key: string) => key },
    slots: {
      inject: (_name: string, register: () => void) => register(),
      register: (options: { inject: () => BrowserInjected }) => { injected = options.inject() },
    },
    sessions: { list: { getSnapshot: () => ({ ids: [], byId: {} }) } },
    uiWorkspace,
    workspaces,
  }
  apply(ctx as unknown as Context)
  const unload = () => { cleanups.slice().reverse().forEach(cleanup => cleanup()) }
  const settle = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() }
  return { body, head, warn, pending, injected, unload, settle, uiWorkspace, workspaces, sessionIds }
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

const parent = 'parent' as SessionId

test.each(['pin', 'unpin', 'archive', 'unarchive', 'fork', 'createProject'] as const)(
  '%s rejection after unload does not append an orphan error notice', async operation => {
    const f = fixture()
    if (operation === 'createProject') f.injected.createProject()
    else f.injected[operation](parent)
    f.unload()
    f.pending.reject(new Error('late failure'))
    await f.settle()
    expect(f.body.children).toHaveLength(0)
    expect(f.head.children).toHaveLength(0)
    expect(f.warn).not.toHaveBeenCalled()
  },
)

test('live errors show a notice, and unload removes the existing notice', async () => {
  const f = fixture()
  f.injected.pin(parent)
  f.pending.reject(new Error('live failure'))
  await f.settle()
  expect(f.body.children).toHaveLength(1)
  expect(f.warn).toHaveBeenCalledOnce()
  f.unload()
  expect(f.body.children).toHaveLength(0)
})

test.each([false, true])('fork continuation respects unloaded=%s without undoing the Host fork', async unloaded => {
  const f = fixture()
  f.injected.fork(parent)
  if (unloaded) f.unload()
  // The Host completed the fork; only plugin-owned repositioning is suppressible.
  f.sessionIds.unshift('child')
  f.pending.resolve('child')
  await f.settle()
  expect(f.uiWorkspace.forkSession).toHaveBeenCalledOnce()
  expect(f.sessionIds).toContain('child')
  if (unloaded) {
    expect(f.workspaces.list.getSnapshot).not.toHaveBeenCalled()
    expect(f.workspaces.insertSessionBefore).not.toHaveBeenCalled()
  } else {
    expect(f.workspaces.insertSessionBefore).toHaveBeenCalledWith('workspace', 'child', 'next')
  }
})

test.each([false, true])('picker continuation respects unloaded=%s before project creation', async unloaded => {
  const f = fixture()
  f.injected.createProject()
  if (unloaded) f.unload()
  f.pending.resolve('/chosen/project')
  await f.settle()
  expect(f.uiWorkspace.pickDirectory).toHaveBeenCalledOnce()
  if (unloaded) expect(f.workspaces.create).not.toHaveBeenCalled()
  else expect(f.workspaces.create).toHaveBeenCalledWith({ path: '/chosen/project' })
})

test.each(['createProject', 'fork'] as const)(
  '%s follow-on Host work already in flight can settle after unload without a notice', async operation => {
    for (const fails of [false, true]) {
      const f = fixture()
      const followOn = deferred<void>()
      const hostWork = operation === 'fork' ? f.workspaces.insertSessionBefore : f.workspaces.create
      hostWork.mockReturnValue(followOn.promise)
      if (operation === 'fork') f.injected.fork(parent)
      else f.injected.createProject()
      f.pending.resolve(operation === 'fork' ? 'child' : '/chosen/project')
      await f.settle()
      expect(hostWork).toHaveBeenCalledOnce()
      f.unload()
      if (fails) followOn.reject(new Error('late follow-on failure'))
      else followOn.resolve(undefined)
      await f.settle()
      expect(hostWork).toHaveBeenCalledOnce()
      expect(f.body.children).toHaveLength(0)
      expect(f.warn).not.toHaveBeenCalled()
    }
  },
)

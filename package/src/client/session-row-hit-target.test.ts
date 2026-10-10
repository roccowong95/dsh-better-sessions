import { beforeEach, expect, test, vi } from 'vitest'
import type { ReactElement } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { SessionRow, type SessionRowProps } from './components/SessionRow'

vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useState: () => [true, vi.fn()],
  useRef: () => ({ current: null }),
  useEffect: vi.fn(),
}))

interface ElementProps { children?: unknown; [key: string]: unknown }
function elements(node: unknown): ReactElement<ElementProps>[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!node || typeof node !== 'object' || !('props' in node)) return []
  const element = node as ReactElement<ElementProps>
  return [element, ...elements(element.props.children)]
}

const id = 'hit-target' as SessionId
const onOpen = vi.fn()
const action = vi.fn()
function row(archived = false, blank = false) {
  return SessionRow({
    id, summary: { id, title: 'Long title', displayTitle: 'Long title', blank, running: true, updatedAt: 0, retainedBy: {} },
    current: id, pinned: new Set([id]), archived: new Set(archived ? [id] : []),
    onOpen, groups: [{ id: 'group', title: 'Group', color: 'var(--dsw-alias-brand-primary)', createdAt: 0 }], groupId: 'group',
    ordering: { canMoveUp: true, canMoveDown: true, moveUp: action, moveDown: action },
    actions: { rename: action, fork: action, archive: action, unarchive: action, pin: action, unpin: action, moveTo: action },
    t: ((key: string) => key) as SessionRowProps['t'],
  })
}
beforeEach(() => { onOpen.mockClear(); action.mockClear() })

test('native full-row button owns indicators and title, not the sibling menu', () => {
  const tree = row()
  const all = elements(tree)
  const open = all.find((e) => e.props.className === 'dbs-open')!
  const menu = all.find((e) => e.props.className === 'dbs-menu-wrap')!
  expect(tree.type).toBe('div')
  expect(all[0]!.props.onClick).toBeUndefined()
  expect(open.type).toBe('button') // Native Enter/Space activation, no custom key interception.
  expect(open.props.type).toBe('button')
  expect(open.props.onKeyDown).toBeUndefined()
  expect(elements(open).map((e) => e.props.className)).toEqual(expect.arrayContaining(['dbs-dot', 'dbs-pin', 'dbs-open-label']))
  expect(elements(open).includes(menu)).toBe(false)
  expect(elements(open).filter((e) => e.type === 'button')).toHaveLength(1)
  ;(open.props.onClick as () => void)()
  expect(onOpen).toHaveBeenCalledExactlyOnceWith(id)
})

test.each([false, true])('all sibling menu actions remain isolated (archived=%s)', (archived) => {
  const all = elements(row(archived))
  const trigger = all.find((e) => e.props.className === 'dbs-menu-btn')!
  const stopPropagation = vi.fn()
  ;(trigger.props.onClick as (event: unknown) => void)({ stopPropagation })
  expect(stopPropagation).toHaveBeenCalledOnce()
  for (const item of all.filter((e) => e.props.role === 'menuitem')) {
    ;(item.props.onClick as () => void)()
  }
  expect(action).toHaveBeenCalled()
  expect(onOpen).not.toHaveBeenCalled()
})

test('archived full-row target announces unavailable and never opens', () => {
  const open = elements(row(true)).find((e) => e.props.className === 'dbs-open')!
  expect(open.props['aria-disabled']).toBe(true)
  ;(open.props.onClick as () => void)()
  expect(onOpen).not.toHaveBeenCalled()
})

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({ relativeTime: () => ({ unit: 'now', n: 0 }) }))


test.each([false, true])('quick actions never open row and toggle projected state (archived=%s)', (archived) => {
  const quick = elements(row(archived)).filter((e) => e.props.className === 'dbs-row-action')
  expect(quick.map((e) => e.props['aria-label'])).toEqual([archived ? 'menu.unarchive' : 'menu.archive', 'menu.unpin'])
  const stopPropagation = vi.fn()
  for (const button of quick) (button.props.onClick as (event: unknown) => void)({ stopPropagation })
  expect(stopPropagation).toHaveBeenCalledTimes(2)
  expect(action).toHaveBeenCalledTimes(archived ? 1 : 2)
  expect(onOpen).not.toHaveBeenCalled()
})

test('blank row guards quick and menu pin/archive callbacks, not only disabled styling', () => {
  const buttons = elements(row(false, true)).filter((e) => e.props.className === 'dbs-row-action'
    || (e.props.role === 'menuitem' && Array.isArray(e.props.children)
      && e.props.children.some((child) => child === 'menu.archive' || child === 'menu.unpin')))
  expect(buttons).toHaveLength(4)
  for (const button of buttons) {
    expect(button.props.disabled).toBe(true)
    ;(button.props.onClick as (event: unknown) => void)({ stopPropagation: vi.fn() })
  }
  expect(action).not.toHaveBeenCalled()
  expect(onOpen).not.toHaveBeenCalled()
})

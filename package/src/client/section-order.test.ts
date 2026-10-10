import { beforeEach, expect, test, vi } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ReactElement } from 'react'
import { moveSectionOrder, sectionMoveTarget, sectionOrdering } from './section-order'

const hooks = vi.hoisted(() => ({ states: [] as unknown[], index: 0 }))
vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useState: (initial: unknown) => {
    const index = hooks.index++
    const fallback = typeof initial === 'function' ? initial() : initial
    return [index < hooks.states.length ? hooks.states[index] : fallback, vi.fn()]
  },
  useMemo: (compute: () => unknown) => compute(),
  useEffect: vi.fn(),
  useRef: () => ({ current: null }),
}))
vi.mock('@deepseek-ai/dsh-client-store', () => ({ defineStore: vi.fn() }))
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({ Modal: 'sdk-modal', Input: 'sdk-input', Button: 'sdk-button', relativeTime: () => ({ unit: 'now', n: 0 }) }))
import { Browser, type BrowserInjected, type BrowserProps } from './components/Browser'
import { SessionRow, type SessionRowProps } from './components/SessionRow'
import { en, zh } from './locales'

const sid = (id: string) => id as SessionId
const ids = (...values: string[]) => values.map(sid)
const full = Object.freeze(ids('a', 'hidden-archive', 'pin1', 'missing', 'b', 'pin2', 'c'))
const movable = new Set(ids('a', 'pin1', 'b', 'pin2', 'c'))
const pinned = new Set(ids('pin1', 'pin2'))

beforeEach(() => { hooks.index = 0; hooks.states = [] })

test('move swaps eligible full-order slots without losing hidden IDs or changing pinned slots', () => {
  expect(moveSectionOrder(full, movable, pinned, sid('b'), -1))
    .toEqual(ids('b', 'hidden-archive', 'pin1', 'missing', 'a', 'pin2', 'c'))
  expect(moveSectionOrder(full, movable, pinned, sid('a'), 1))
    .toEqual(ids('b', 'hidden-archive', 'pin1', 'missing', 'a', 'pin2', 'c'))
  expect(full).toEqual(ids('a', 'hidden-archive', 'pin1', 'missing', 'b', 'pin2', 'c'))
  expect([...movable]).toEqual(ids('a', 'pin1', 'b', 'pin2', 'c'))
  expect([...pinned]).toEqual(ids('pin1', 'pin2'))
})

test('pinned peers move only within their partition, keeping ordinary and hidden slots fixed', () => {
  expect(moveSectionOrder(full, movable, pinned, sid('pin2'), -1))
    .toEqual(ids('a', 'hidden-archive', 'pin2', 'missing', 'b', 'pin1', 'c'))
  expect(sectionMoveTarget(full, movable, pinned, sid('pin1'), -1)).toBeUndefined()
  expect(sectionMoveTarget(full, movable, pinned, sid('pin2'), 1)).toBeUndefined()
})

test('boundaries, hidden IDs, missing IDs and empty inputs are immutable no-ops', () => {
  for (const [id, direction] of [['a', -1], ['c', 1], ['missing', -1], ['absent', 1]] as const) {
    const next = moveSectionOrder(full, movable, pinned, sid(id), direction)
    expect(next).toEqual(full)
    expect(next).not.toBe(full)
  }
  expect(moveSectionOrder([], movable, pinned, sid('a'), -1)).toEqual([])
})

test('ordering context guards disabled search and boundary callbacks, commits full payload otherwise', () => {
  const commit = vi.fn()
  const disabled = sectionOrdering(full, movable, pinned, sid('b'), true, commit)
  expect(disabled.canMoveUp).toBe(false)
  expect(disabled.canMoveDown).toBe(false)
  disabled.moveUp(); disabled.moveDown()
  const first = sectionOrdering(full, movable, pinned, sid('a'), false, commit)
  expect(first.canMoveUp).toBe(false)
  expect(first.canMoveDown).toBe(true)
  first.moveUp()
  expect(commit).not.toHaveBeenCalled()
  first.moveDown()
  expect(commit).toHaveBeenCalledExactlyOnceWith(ids('b', 'hidden-archive', 'pin1', 'missing', 'a', 'pin2', 'c'))
})

interface ElementProps { children?: unknown; [key: string]: unknown }
function elements(node: unknown): ReactElement<ElementProps>[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!node || typeof node !== 'object' || !('props' in node)) return []
  const element = node as ReactElement<ElementProps>
  return [element, ...elements(element.props.children)]
}

function browserRows(tab: string, query = '') {
  hooks.states = [tab, false, query, false, new Set()]
  const byId = Object.fromEntries(full.filter((id) => id !== sid('missing')).map((id) => [id, {
    id, title: id, displayTitle: id, blank: false, running: false, updatedAt: 0,
  }]))
  const list = { ids: full, byId }
  const workspace = { items: [{ workspaceId: 'project', title: 'Project', path: '/project', sessionIds: full }],
    pinnedSessionIds: [...pinned], archivedSessionIds: ids('hidden-archive') }
  const state = { groups: [], membership: {}, orderByGroup: { '': full }, collapsed: {} }
  const setSectionOrder = vi.fn()
  const props = {
    wide: true, t: (key: string) => key, services: '',
    useSessions: (select: (value: typeof list) => unknown) => select(list),
    useWorkspaces: (select: (value: typeof workspace) => unknown) => select(workspace),
    useStore: (select: (value: typeof state) => unknown) => select(state),
    actions: { setSectionOrder },
  } as unknown as BrowserInjected & BrowserProps
  const rows = elements(Browser(props)).filter((element) => element.type === SessionRow)
    .map((element) => element.props as unknown as SessionRowProps)
  return { rows, setSectionOrder }
}

test('Browser supplies group-only context and persists complete ungrouped section order', () => {
  const { rows, setSectionOrder } = browserRows('groups')
  rows.find((row) => row.id === sid('b'))!.ordering!.moveUp()
  expect(setSectionOrder).toHaveBeenCalledExactlyOnceWith('', ids('b', 'hidden-archive', 'pin1', 'missing', 'a', 'pin2', 'c'))
  hooks.index = 0
  expect(browserRows('projects').rows.every((row) => row.ordering === undefined)).toBe(true)
  hooks.index = 0
  expect(browserRows('flat').rows.every((row) => row.ordering === undefined)).toBe(true)
})

test('Browser search keeps ordering context disabled and callbacks cannot write filtered IDs', () => {
  const { rows, setSectionOrder } = browserRows('groups', 'b')
  expect(rows).toHaveLength(1)
  expect(rows[0]!.ordering!.canMoveUp).toBe(false)
  expect(rows[0]!.ordering!.canMoveDown).toBe(false)
  rows[0]!.ordering!.moveUp(); rows[0]!.ordering!.moveDown()
  expect(setSectionOrder).not.toHaveBeenCalled()
})

test('menu controls are localized accessible disabled buttons and absent without context', () => {
  const { rows } = browserRows('groups')
  const first = rows.find((row) => row.id === sid('a'))!
  const renderMenu = (ordering: SessionRowProps['ordering']) => {
    hooks.index = 0; hooks.states = [true]
    return elements(SessionRow({ ...first, ordering, t: ((key: keyof typeof en) => en[key]) as SessionRowProps['t'] }))
      .filter((element) => element.type === 'button' && element.props.role === 'menuitem')
  }
  const buttons = renderMenu(first.ordering)
  const up = buttons.find((button) => button.props.children === 'Move up')!
  const down = buttons.find((button) => button.props.children === 'Move down')!
  expect(up.props.disabled).toBe(true)
  expect(up.props['aria-disabled']).toBe(true)
  expect(down.props.disabled).toBe(false)
  expect(renderMenu(undefined).some((button) => button.props.children === 'Move up' || button.props.children === 'Move down')).toBe(false)
  expect(zh['menu.moveUp']).toBe('上移')
  expect(zh['menu.moveDown']).toBe('下移')
})

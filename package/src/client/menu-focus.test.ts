import { beforeEach, expect, test, vi } from 'vitest'
import type { ReactElement } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { SessionRow, type SessionRowProps } from './components/SessionRow'
import { GroupHeader } from './components/GroupHeader'

const hooks = vi.hoisted(() => ({
  wrapper: null as HTMLDivElement | null,
  setMenuOpen: vi.fn(),
}))
vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useState: () => [true, hooks.setMenuOpen],
  useRef: () => ({ current: hooks.wrapper }),
  useEffect: vi.fn(),
}))

interface ElementProps { children?: unknown; [key: string]: unknown }
function elements(node: unknown): ReactElement<ElementProps>[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!node || typeof node !== 'object' || !('props' in node)) return []
  const element = node as ReactElement<ElementProps>
  return [element, ...elements(element.props.children)]
}

const id = 'focus-session' as SessionId
const groupId = 'focus-group'
const title = 'Focus regression'
const noop = () => {}
const t = ((key: string) => key) as SessionRowProps['t']

function renderRow(callback: (...args: unknown[]) => void, action: 'rename' | 'archive') {
  return SessionRow({
    id,
    summary: { id, title, displayTitle: title, blank: false, running: false, updatedAt: 0, retainedBy: {} },
    current: undefined,
    pinned: new Set(), archived: new Set(),
    onOpen: noop, groups: null, groupId: undefined, t,
    actions: {
      rename: noop, archive: noop, fork: noop, unarchive: noop,
      pin: noop, unpin: noop, moveTo: noop, [action]: callback,
    },
  })
}

function renderGroup(callback: (...args: unknown[]) => void, action: 'rename' | 'dissolve') {
  return GroupHeader({
    section: { key: groupId, ids: [id], group: { id: groupId, title, color: 'var(--dsw-alias-brand-primary)', createdAt: 0 } },
    count: 1, collapsed: false, foldable: true, containsCurrent: false,
    onToggle: noop, onColorGroup: noop,
    onRenameGroup: action === 'rename' ? callback : noop,
    onDissolveGroup: action === 'dissolve' ? callback : noop,
    t,
  })
}

const actions = [
  { name: 'SessionRow rename', label: 'menu.rename', render: (callback: (...args: unknown[]) => void) => renderRow(callback, 'rename'), args: [id, title] },
  { name: 'SessionRow archive', label: 'menu.archive', render: (callback: (...args: unknown[]) => void) => renderRow(callback, 'archive'), args: [id] },
  { name: 'GroupHeader rename', label: 'group.rename', render: (callback: (...args: unknown[]) => void) => renderGroup(callback, 'rename'), args: [groupId] },
  { name: 'GroupHeader dissolve', label: 'group.dissolve', render: (callback: (...args: unknown[]) => void) => renderGroup(callback, 'dissolve'), args: [groupId] },
]

beforeEach(() => {
  hooks.wrapper = null
  hooks.setMenuOpen.mockReset()
})

for (const action of actions) {
  test.each(['present', 'missing wrapper', 'missing trigger'] as const)(`${action.name}: %s focuses stable trigger before closing and invoking dialog callback`, (target) => {
    const events: string[] = []
    const focus = vi.fn(() => { events.push('focus') })
    const querySelector = vi.fn(() => target === 'present' ? { focus } : null)
    if (target !== 'missing wrapper') {
      hooks.wrapper = { querySelector } as unknown as HTMLDivElement
    }
    hooks.setMenuOpen.mockImplementation((open: boolean) => {
      expect(open).toBe(false)
      events.push('close')
      // Closing removes the menu, but must not be needed to locate the trigger.
      hooks.wrapper = null
    })
    const callback = vi.fn(() => { events.push('dialog') })
    const tree = elements(action.render(callback))
    const trigger = tree.find((element) => element.props.className === 'dbs-menu-btn')!
    const menu = tree.find((element) => element.props.role === 'menu')!
    expect(trigger.type).toBe('button')
    expect(elements(menu).includes(trigger)).toBe(false)
    const item = tree.find((element) => element.props.role === 'menuitem'
      && elements(element).length > 0
      && (Array.isArray(element.props.children) ? element.props.children : [element.props.children]).includes(action.label))!
    expect(item).toBeDefined()

    expect(() => (item.props.onClick as () => void)()).not.toThrow()

    expect(events).toEqual(target === 'present' ? ['focus', 'close', 'dialog'] : ['close', 'dialog'])
    expect(hooks.setMenuOpen).toHaveBeenCalledExactlyOnceWith(false)
    expect(callback).toHaveBeenCalledExactlyOnceWith(...action.args)
    if (target === 'missing wrapper') expect(querySelector).not.toHaveBeenCalled()
    else expect(querySelector).toHaveBeenCalledExactlyOnceWith('.dbs-menu-btn')
    expect(focus).toHaveBeenCalledTimes(target === 'present' ? 1 : 0)
  })
}

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({ relativeTime: () => ({ unit: 'now', n: 0 }) }))

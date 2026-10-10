import { expect, test, vi } from 'vitest'
vi.mock('@deepseek-ai/dsh-client-store', () => ({ defineStore: (spec: unknown) => spec }))
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({ Modal: 'sdk-modal', Input: 'sdk-input', Button: 'sdk-button', relativeTime: () => ({ unit: 'now', n: 0 }) }))
import { createGroupsStore, type GroupsState, type GroupsActions, GROUP_COLORS } from './stores'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { moveDestinationOrder } from './components/Browser'
import { reconcileManualOrder, visibleOrder, type SessionMap } from './order'
const spec = createGroupsStore() as unknown as { init(): GroupsState; actions: GroupsActions }
const state = (): GroupsState => structuredClone(spec.init())
const sid = 'test-session' as SessionId

test('stale group destinations leave membership and positions unchanged', () => {
  const draft = state()
  spec.actions.moveSessionTo(draft, sid, null, [])
  const before = structuredClone(draft)
  spec.actions.moveSessionTo(draft, sid, 'deleted-group', [sid])
  expect(draft).toEqual(before)
})
test('saved section order deduplicates while preserving first positions', () => {
  const draft = state()
  const other = 'other' as SessionId
  spec.actions.setSectionOrder(draft, '', [sid, other, sid])
  expect(draft.orderByGroup['']).toEqual([sid, other])
})

test('store initialization gives each instance independent mutable state', () => {
  const first = spec.init()
  const second = spec.init()
  spec.actions.createGroup(first)
  expect(second.groups).toEqual([])
  expect(first.membership).not.toBe(second.membership)
})

test('dissolve removes group metadata but never a session', () => {
  const draft = state()
  spec.actions.createGroup(draft)
  const group = draft.groups[0]!
  spec.actions.moveSessionTo(draft, sid, group.id, [])
  spec.actions.toggleCollapsed(draft, group.id)
  spec.actions.dissolveGroup(draft, group.id)
  expect(draft.groups).toEqual([])
  expect(draft.membership[sid]).toBeUndefined()
  expect(draft.orderByGroup[group.id]).toBeUndefined()
  expect(draft.collapsed[group.id]).toBeUndefined()
})
test('moving between groups removes stale positions', () => {
  const draft = state()
  spec.actions.createGroup(draft)
  spec.actions.createGroup(draft)
  const [first, second] = draft.groups
  spec.actions.moveSessionTo(draft, sid, first!.id, [])
  spec.actions.moveSessionTo(draft, sid, second!.id, [])
  expect(draft.orderByGroup[first!.id]).toEqual([])
  expect(draft.orderByGroup[second!.id]).toEqual([sid])
  expect(draft.membership[sid]).toBe(second!.id)
  spec.actions.moveSessionTo(draft, sid, null, [])
  expect(draft.membership[sid]).toBeUndefined()
  expect(draft.orderByGroup['']).toEqual([sid])
})
const a = 'a' as SessionId
const b = 'b' as SessionId
const hidden = 'hidden' as SessionId
const missing = 'missing' as SessionId
const unsavedMissing = 'unsaved-missing' as SessionId
const summaries: SessionMap = {
  [sid]: { id: sid, updatedAt: 100, blank: false },
  [a]: { id: a, updatedAt: 10, blank: false },
  [b]: { id: b, updatedAt: 20, blank: false },
  [hidden]: { id: hidden, updatedAt: 30, blank: false },
}
const moveFixture = () => {
  const draft = state()
  spec.actions.createGroup(draft)
  spec.actions.createGroup(draft)
  const source = draft.groups[0]!.id
  const destination = draft.groups[1]!.id
  draft.membership[sid] = source
  draft.membership[a] = destination
  draft.membership[b] = destination
  draft.orderByGroup[source] = [sid]
  return { draft, source, destination }
}
const moveWithBrowserOrder = (draft: GroupsState, destination: string | null, ids: readonly SessionId[], archived: readonly SessionId[] = []) => {
  const order = moveDestinationOrder(draft, ids, destination, summaries, { archivedSessionIds: archived })
  spec.actions.moveSessionTo(draft, sid, destination, order)
  return order
}

test('move appends after reconciled destination with no saved order', () => {
  const { draft, source, destination } = moveFixture()
  expect(moveWithBrowserOrder(draft, destination, [sid, a, b])).toEqual([b, a])
  expect(draft.orderByGroup[destination]).toEqual([b, a, sid])
  expect(draft.orderByGroup[source]).toEqual([])
  // Newer moved summary must not jump ahead on the next reconciliation.
  expect(reconcileManualOrder([sid, a, b], draft.orderByGroup[destination], summaries)).toEqual([b, a, sid])
})

test('move appends after saved and unsaved members of a partial destination order', () => {
  const { draft, destination } = moveFixture()
  draft.orderByGroup[destination] = [a]
  moveWithBrowserOrder(draft, destination, [sid, a, b])
  expect(draft.orderByGroup[destination]).toEqual([a, b, sid])
})

test('move to ungrouped appends after its complete reconciled order', () => {
  const { draft } = moveFixture()
  delete draft.membership[a]
  delete draft.membership[b]
  draft.orderByGroup[''] = [a]
  moveWithBrowserOrder(draft, null, [sid, a, b])
  expect(draft.membership[sid]).toBeUndefined()
  expect(draft.orderByGroup['']).toEqual([a, b, sid])
})

test('same group selection is a complete no-op even with partial saved order', () => {
  const { draft, source } = moveFixture()
  draft.membership[a] = source
  draft.orderByGroup[source] = [sid]
  const before = structuredClone(draft)
  moveWithBrowserOrder(draft, source, [sid, a, b])
  expect(draft).toEqual(before)
})

test('same ungrouped selection is a complete no-op', () => {
  const draft = state()
  draft.orderByGroup[''] = [sid, a]
  const before = structuredClone(draft)
  moveWithBrowserOrder(draft, null, [sid, a, b])
  expect(draft).toEqual(before)
})

test('stale destination after menu order preparation leaves all state unchanged', () => {
  const { draft, destination } = moveFixture()
  const order = moveDestinationOrder(draft, [sid, a, b], destination, summaries, {})
  spec.actions.dissolveGroup(draft, destination)
  const before = structuredClone(draft)
  spec.actions.moveSessionTo(draft, sid, destination, order)
  expect(draft).toEqual(before)
})

test('move preserves archived and missing-summary destination IDs before the moved row', () => {
  const { draft, destination } = moveFixture()
  for (const id of [hidden, missing, unsavedMissing]) draft.membership[id] = destination
  draft.orderByGroup[destination] = [a, hidden, missing]
  const ids = [sid, a, b, hidden, missing, unsavedMissing]
  const order = moveWithBrowserOrder(draft, destination, ids, [hidden])
  expect(order).toEqual([a, hidden, missing, b, unsavedMissing])
  expect(draft.orderByGroup[destination]).toEqual([...order, sid])
  expect(visibleOrder(draft.orderByGroup[destination]!, summaries, undefined, [], [hidden])).toEqual([a, b, sid])
  const arrived = { ...summaries, [missing]: { id: missing, updatedAt: 200, blank: false },
    [unsavedMissing]: { id: unsavedMissing, updatedAt: 300, blank: false } }
  expect(reconcileManualOrder(ids, draft.orderByGroup[destination], arrived)).toEqual([...order, sid])
})

test('move deduplicates destination IDs and rejects members of another section', () => {
  const { draft, destination } = moveFixture()
  spec.actions.moveSessionTo(draft, sid, destination, [a, sid, a, missing, b])
  expect(draft.orderByGroup[destination]).toEqual([a, b, sid])
})

test('color cycles safely through the semantic palette', () => {
  const draft = state()
  spec.actions.createGroup(draft)
  const group = draft.groups[0]!
  const initial = group.color
  for (let i = 0; i < GROUP_COLORS.length; i++) spec.actions.cycleGroupColor(draft, group.id)
  expect(group.color).toBe(initial)
})

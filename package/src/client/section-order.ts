import type { SessionId } from '@deepseek-ai/dsh-session/types'

export interface SectionOrdering {
  readonly canMoveUp: boolean
  readonly canMoveDown: boolean
  readonly moveUp: () => void
  readonly moveDown: () => void
}

type Direction = -1 | 1

/** Only visible peers in the same pin partition are movable; all other slots stay fixed. */
export function sectionMoveTarget(
  fullOrder: readonly SessionId[], movableIds: ReadonlySet<SessionId>,
  pinned: ReadonlySet<SessionId>, id: SessionId, direction: Direction,
): SessionId | undefined {
  const from = fullOrder.indexOf(id)
  if (from < 0 || !movableIds.has(id)) return undefined
  for (let index = from + direction; index >= 0 && index < fullOrder.length; index += direction) {
    const peer = fullOrder[index]!
    if (movableIds.has(peer) && pinned.has(peer) === pinned.has(id)) return peer
  }
  return undefined
}

/** Swap eligible slots in the FULL reconciled order, never a filtered persistence payload. */
export function moveSectionOrder(
  fullOrder: readonly SessionId[], movableIds: ReadonlySet<SessionId>,
  pinned: ReadonlySet<SessionId>, id: SessionId, direction: Direction,
): SessionId[] {
  const next = [...fullOrder]
  const target = sectionMoveTarget(fullOrder, movableIds, pinned, id, direction)
  if (target === undefined) return next
  const from = fullOrder.indexOf(id)
  const to = fullOrder.indexOf(target)
  next[from] = target
  next[to] = id
  return next
}

/** Both the menu state and callback guard respect search and boundary restrictions. */
export function sectionOrdering(
  fullOrder: readonly SessionId[], movableIds: ReadonlySet<SessionId>,
  pinned: ReadonlySet<SessionId>, id: SessionId, disabled: boolean,
  commit: (order: readonly SessionId[]) => void,
): SectionOrdering {
  const canMoveUp = !disabled && sectionMoveTarget(fullOrder, movableIds, pinned, id, -1) !== undefined
  const canMoveDown = !disabled && sectionMoveTarget(fullOrder, movableIds, pinned, id, 1) !== undefined
  return {
    canMoveUp, canMoveDown,
    moveUp: () => { if (canMoveUp) commit(moveSectionOrder(fullOrder, movableIds, pinned, id, -1)) },
    moveDown: () => { if (canMoveDown) commit(moveSectionOrder(fullOrder, movableIds, pinned, id, 1)) },
  }
}

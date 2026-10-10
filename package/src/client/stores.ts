/**
 * 分组数据 store。
 *
 * 数据模型（见 REQUIREMENTS.md §4）：
 *   groups         自定义组，**数组序即顶层序**
 *   membership     sessionId → groupId，**单归属**，主键就是 sessionId
 *   orderByGroup   组内手动序，key 为 groupId；`''` 是未分组段
 *   collapsed      段折叠偏好
 *
 * 阶段 2 的持久化目标是宿主 settings（loopback 下落 `~/.dsh/settings.yaml`），
 * 非 loopback 降级为 localStorage。当前先用框架 `defineStore` 的 persist
 * （localStorage）把链路跑通，settings 绑定作为后续一步。
 */

import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-store'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** 分组可复用的 7 个语义色令牌（无专用分组色令牌，见 REQUIREMENTS.md §13.2）。 */
export const GROUP_COLORS = [
  'var(--dsw-alias-brand-primary)',
  'var(--dsw-alias-state-success-primary)',
  'var(--dsw-alias-state-warn-primary)',
  'var(--dsw-alias-state-error-primary)',
  'var(--dsw-alias-state-idle-primary)',
  'var(--dsw-alias-label-secondary)',
  'var(--dsw-alias-border-l2)',
] as const

export type GroupColor = (typeof GROUP_COLORS)[number]

export interface SessionGroup {
  id: string
  /** null 表示还没被用户命名，渲染层回落 `group.defaultName`。 */
  title: string | null
  color: GroupColor
  createdAt: number
}

export interface GroupsState {
  groups: SessionGroup[]
  /** 单归属：一个 sessionId 最多一个 groupId。 */
  membership: Record<SessionId, string>
  /** 组内手动序；`''` 是未分组段。 */
  orderByGroup: Record<string, SessionId[]>
  /** 段折叠偏好（纯视图状态）。 */
  collapsed: Record<string, boolean>
}

/** 取色板里第一个未被占用的颜色；全占用则按组数轮转。 */
export function nextColor(groups: readonly SessionGroup[]): GroupColor {
  const used = new Set(groups.map((g) => g.color))
  return GROUP_COLORS.find((c) => !used.has(c)) ?? GROUP_COLORS[groups.length % GROUP_COLORS.length]!
}

export type GroupsActions = {
  createGroup: (draft: GroupsState) => void
  renameGroup: (draft: GroupsState, id: string, title: string) => void
  cycleGroupColor: (draft: GroupsState, id: string) => void
  dissolveGroup: (draft: GroupsState, id: string) => void
  /** groupId 为 null 表示移出到未分组；destinationOrder 是过滤可见行之前的完整目标段序。 */
  moveSessionTo: (draft: GroupsState, sessionId: SessionId, groupId: string | null, destinationOrder: readonly SessionId[]) => void
  setSectionOrder: (draft: GroupsState, key: string, ids: readonly SessionId[]) => void
  toggleCollapsed: (draft: GroupsState, key: string) => void
}

export function createGroupsStore() {
  return defineStore<GroupsState, GroupsActions>({
    persist: 'dsh-better-sessions:groups',
    init: () => ({ groups: [], membership: {}, orderByGroup: {}, collapsed: {} }),
    actions: {
      createGroup(draft) {
        const id = `g_${crypto.randomUUID()}`
        draft.groups.push({
          id,
          title: null,
          color: nextColor(draft.groups),
          createdAt: Date.now(),
        })
      },
      renameGroup(draft, id, title) {
        const g = draft.groups.find((x) => x.id === id)
        if (g) g.title = title
      },
      cycleGroupColor(draft, id) {
        const g = draft.groups.find((x) => x.id === id)
        if (!g) return
        g.color = GROUP_COLORS[(GROUP_COLORS.indexOf(g.color) + 1) % GROUP_COLORS.length]!
      },
      dissolveGroup(draft, id) {
        draft.groups = draft.groups.filter((g) => g.id !== id)
        for (const [sid, gid] of Object.entries(draft.membership)) {
          if (gid === id) delete draft.membership[sid as SessionId]
        }
        for (const key of Object.keys(draft.orderByGroup)) {
          if (key === id) delete draft.orderByGroup[key]
        }
        for (const key of Object.keys(draft.collapsed)) {
          if (key === id) delete draft.collapsed[key]
        }
      },
      moveSessionTo(draft, sessionId, groupId, destinationOrder) {
        // Ignore stale menu destinations rather than creating orphan membership.
        if (groupId !== null && !draft.groups.some((group) => group.id === groupId)) return
        // Selecting the current section is not a reorder (including ungrouped).
        if ((liveGroupId(draft, sessionId) ?? null) === groupId) return
        if (groupId === null) delete draft.membership[sessionId]
        else draft.membership[sessionId] = groupId
        // Remove old positions, then append after all reconciled destination members,
        // not just its saved subset. Hidden members keep their underlying positions.
        for (const key of Object.keys(draft.orderByGroup)) {
          draft.orderByGroup[key] = (draft.orderByGroup[key] ?? []).filter((x) => x !== sessionId)
        }
        const key = groupId === null ? '' : groupId
        draft.orderByGroup[key] = [...new Set(destinationOrder.filter((id) =>
          id !== sessionId && (liveGroupId(draft, id) ?? '') === key)), sessionId]
      },
      setSectionOrder(draft, key, ids) {
        draft.orderByGroup[key] = [...new Set(ids)]
      },
      toggleCollapsed(draft, key) {
        draft.collapsed[key] = !draft.collapsed[key]
      },
    },
  })
}

export type GroupsStoreHandle = EngineStoreHandle<GroupsState, GroupsActions>

/** membership 里的孤儿组 id（组已不存在）一律忽略。 */
export function liveGroupId(gs: GroupsState, sessionId: SessionId): string | undefined {
  const gid = gs.membership[sessionId]
  if (!gid) return undefined
  return gs.groups.some((g) => g.id === gid) ? gid : undefined
}

export interface GroupSection {
  key: string
  group: SessionGroup | null
  ids: readonly SessionId[]
}

/** 派生「分组」Tab 的各段：自定义组按 groups 数组序 + 末尾固定未分组段。 */
export function groupSections(gs: GroupsState, ids: readonly SessionId[]): GroupSection[] {
  const members = new Map<string, SessionId[]>()
  for (const id of ids) {
    const gid = liveGroupId(gs, id)
    if (!gid) continue
    const bucket = members.get(gid)
    if (bucket) bucket.push(id)
    else members.set(gid, [id])
  }
  const sections: GroupSection[] = gs.groups.map((g) => ({
    key: g.id,
    group: g,
    ids: members.get(g.id) ?? [],
  }))
  sections.push({
    key: '',
    group: null,
    ids: ids.filter((id) => !liveGroupId(gs, id)),
  })
  return sections
}

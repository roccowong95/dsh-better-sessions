/**
 * 影子占用者本体：`sidebar.workspaces` 的整体替换。
 *
 * 已验证的机制（见 REQUIREMENTS.md §11.1）：
 *   ① priority: -1 影子注册能整块替换原生 WorkspaceBrowser
 *   ② useSessions / useWorkspaces / ctx.uiWorkspace 可达
 *   ③ owner props { wide, expandSidebar } 到达
 *   ④ ctx.locale.register + t 可用
 *   ⑤ 影子占用者无法 renderSlot shipped 子 slot（renderer L331 + ui-slots L191）
 *   ⑥ ctx.uiWorkspace 的 pin/unpin/archive/unarchive 全生效
 */

import { createElement as h, useMemo, useState } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type {
  SessionListState,
} from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { ComposedProps, InjectFace, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { Icons } from '../icons'
import {
  mainSessionId,
  reconcileManualOrder,
  visibleOrder,
} from '../order'
import { groupSections, liveGroupId, type GroupsStoreHandle } from '../stores'
import { GroupHeader } from './GroupHeader'
import { SessionRow, type SessionRowActions } from './SessionRow'

export type TabKey = 'projects' | 'groups' | 'flat'

export interface BrowserInjected {
  readonly services: string
  readonly open: (id: SessionId) => void
  readonly fork: (id: SessionId) => void
  readonly rename: (id: SessionId, title: string) => void
  readonly archive: (id: SessionId) => void
  readonly unarchive: (id: SessionId) => void
  readonly pin: (id: SessionId) => void
  readonly unpin: (id: SessionId) => void
  readonly createProject: () => void
}

/**
 * 组件 props = 框架的五个 share 组合，不自己重述。
 * 本条目不声明 children，所以 `S = never`。
 */
export type BrowserProps = ComposedProps<
  'sidebar.workspaces',
  string,
  never,
  GroupsStoreHandle,
  BrowserInjected,
  never,
  'better-sessions'
>

const TABS: readonly (readonly [TabKey, string])[] = [
  ['projects', 'tab.projects'],
  ['groups', 'tab.groups'],
  ['flat', 'tab.flat'],
]

export function Browser(props: BrowserInjected & BrowserProps) {
  const {
    wide, t, useSessions, useWorkspaces, useStore, actions,
    open, fork, rename, archive, unarchive, pin, unpin, createProject, services,
  } = props

  const [tab, setTab] = useState<TabKey>('projects')
  const [showArchived, setShowArchived] = useState(false)
  const [diagOpen, setDiagOpen] = useState(false)
  /** 项目 Tab 的段折叠是纯视图偏好，放本地 state，不混进分组 store。 */
  const [projectFolded, setProjectFolded] = useState<ReadonlySet<string>>(() => new Set())

  const list = useSessions((state) => state)
  const workspaces = useWorkspaces((state) => state.items)
  const gs = useStore((state) => state)

  const byId = list.byId
  /** 0.1.7 起 SessionListState 没有 `current`；当前会话 = retainedBy.mainView > 0 的那个。 */
  const current = useMemo(() => mainSessionId(list), [list])
  const pinned = useMemo(() => new Set<SessionId>(), [])
  const archived = useMemo(() => new Set<SessionId>(), [])
  const filter = showArchived ? 'show' : 'default'

  const acts: SessionRowActions = { rename, fork, archive, unarchive, pin, unpin, moveTo: actions.moveSessionTo }

  const rows = (ids: readonly SessionId[], keyPrefix: string, withMove: boolean) =>
    visibleOrder(ids, byId, current, pinned, archived, filter).flatMap((id) => {
      const summary = byId[id]
      if (!summary) return []
      return [h(SessionRow, {
        key: `${keyPrefix}:${id}`,
        id,
        summary,
        current,
        pinned,
        archived,
        onOpen: open,
        actions: acts,
        groups: withMove ? gs.groups : null,
        groupId: liveGroupId(gs, id),
        t,
      })]
    })

  /* ── 项目 Tab：按 workspace 派生 + 未分组桶 ─────────────────────── */
  const projectSections = () => {
    const owned = new Set<SessionId>()
    const sections = workspaces.map((w) => {
      w.sessionIds.forEach((id) => owned.add(id))
      return { key: String(w.workspaceId), ids: w.sessionIds as readonly SessionId[] }
    })
    const loose = list.ids.filter((id) => !owned.has(id))
    if (loose.length) sections.push({ key: '', ids: loose })
    return sections
  }

  const toggleProjectFold = (key: string) =>
    setProjectFolded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  /* ── 渲染 ───────────────────────────────────────────────────────── */
  const body =
    tab === 'projects'
      ? projectSections().map((sec) => {
          const folded = projectFolded.has(sec.key)
          const ordered = reconcileManualOrder(sec.ids, undefined, byId, {
            pinnedSessionIds: [...pinned],
            archivedSessionIds: [...archived],
          })
          return h('div', { key: sec.key || '__u', className: 'dbs-group' },
            h(GroupHeader, {
              section: { key: sec.key, group: null, ids: sec.ids },
              count: visibleOrder(ordered, byId, current, pinned, archived, filter).length,
              collapsed: folded,
              foldable: true,
              onToggle: () => toggleProjectFold(sec.key),
              containsCurrent: current !== undefined && sec.ids.includes(current),
              onRenameGroup: () => {},
              onColorGroup: () => {},
              onDissolveGroup: () => {},
              t,
            }),
            folded ? null : rows(ordered, `p${sec.key}`, false),
          )
        })
      : tab === 'groups'
        ? groupSections(gs, list.ids).map((sec) => {
            const collapsed = !!gs.collapsed[sec.key]
            const ordered = reconcileManualOrder(sec.ids, gs.orderByGroup[sec.key], byId, {
              pinnedSessionIds: [...pinned],
              archivedSessionIds: [...archived],
            })
            return h('div', { key: sec.key || '__u', className: 'dbs-group' },
              h(GroupHeader, {
                section: sec,
                count: visibleOrder(ordered, byId, current, pinned, archived, filter).length,
                collapsed,
                foldable: true,
                onToggle: () => actions.toggleCollapsed(sec.key),
                containsCurrent: current !== undefined && ordered.includes(current),
                onRenameGroup: (id) => {
                  const g = gs.groups.find((x) => x.id === id)
                  const next = window.prompt(t('prompt.renameGroup'), g?.title ?? t('group.defaultName'))
                  if (next != null && next.trim()) actions.renameGroup(id, next.trim())
                },
                onColorGroup: actions.cycleGroupColor,
                onDissolveGroup: (id) => {
                  const g = gs.groups.find((x) => x.id === id)
                  const name = g?.title ?? t('group.defaultName')
                  if (window.confirm(t('group.dissolveConfirm').replace('{name}', name))) {
                    actions.dissolveGroup(id)
                  }
                },
                t,
              }),
              collapsed ? null : rows(ordered, `g${sec.key}`, true),
            )
          })
        : h('div', { className: 'dbs-group' }, rows(list.ids, 'flat', true))

  const diag = [
    `wide = ${JSON.stringify(wide)}`,
    `sessions.ids = ${list.ids.length} / byId = ${Object.keys(byId).length}`,
    `workspaces = ${workspaces.length}`,
    `pinned = ${pinned.size}, archived = ${archived.size} (filter=${filter})`,
    `groups = ${gs.groups.length} / membership = ${Object.keys(gs.membership).length}`,
    `services = ${services}`,
  ].join('\n')

  return h('div', { className: 'dbs-root' },
    h('div', { className: 'dbs-tabs', role: 'tablist' },
      TABS.map(([k, labelKey]) =>
        h('button', {
          key: k,
          type: 'button',
          role: 'tab',
          className: 'dbs-tab',
          'aria-selected': String(tab === k),
          onClick: () => setTab(k),
        }, t(labelKey as 'tab.projects')),
      ),
      h('div', { className: 'dbs-tabSpacer' }),
      /* 新建分组 / 新建项目：同一个右对齐槽，按 Tab 上下文切换 */
      tab === 'groups'
        ? h('button', {
            type: 'button', className: 'dbs-iconBtn',
            title: t('group.new'), 'aria-label': t('group.new'),
            onClick: () => actions.createGroup(),
          }, Icons.plus(15))
        : tab === 'projects' && wide
          ? h('button', {
              type: 'button', className: 'dbs-iconBtn',
              title: t('action.newProject'), 'aria-label': t('action.newProject'),
              onClick: createProject,
            }, Icons.plus(15))
          : null,
      h('button', {
        type: 'button', className: 'dbs-iconBtn',
        title: showArchived ? t('arch.hide') : t('arch.label'),
        'aria-label': showArchived ? t('arch.hide') : t('arch.label'),
        'aria-pressed': String(showArchived),
        onClick: () => setShowArchived((v) => !v),
      }, showArchived ? Icons.unarchive(15) : Icons.archive(15)),
    ),
    h('div', { className: 'dbs-body' }, body),
    h('button', {
      type: 'button', className: `${'dbs-iconBtn'} ${'dbs-fab'}`,
      title: t('diag.title'), 'aria-label': t('diag.title'),
      'aria-pressed': String(diagOpen),
      onClick: () => setDiagOpen((v) => !v),
    }, Icons.gear(15)),
    diagOpen ? h('div', { className: 'dbs-diag' }, diag) : null,
  )
}

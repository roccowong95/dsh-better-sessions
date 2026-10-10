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

import { createElement as h, useEffect, useMemo, useRef, useState } from 'react'
import { createSessionDialogs } from '../session-dialog'
import { filterSessionTitles } from '../search'
import { sectionOrdering, type SectionOrdering } from '../section-order'
import { browserStorage, readBrowserTab, saveBrowserTab } from '../view-preferences'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ComposedProps } from '@deepseek-ai/dsh-client-ui-slots'
import { Icons } from '../icons'
import {
  mainSessionId,
  orderByRecency,
  reconcileManualOrder,
  visibleOrder,
  type SessionMap,
  type RowStateLike,
} from '../order'
import { groupSections, liveGroupId, type GroupsState, type GroupsStoreHandle } from '../stores'
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

/** Full destination order, before archive/search/blank visibility projection. */
export function moveDestinationOrder(
  gs: GroupsState, ids: readonly SessionId[], groupId: string | null,
  byId: SessionMap, rowState: RowStateLike,
): SessionId[] {
  const section = groupSections(gs, ids).find((sec) => sec.key === (groupId ?? ''))
  if (!section) return []
  const ordered = reconcileManualOrder(section.ids, gs.orderByGroup[section.key], byId, rowState)
  // Reconciliation temporarily omits unsaved members without summaries. Keep them
  // in the persisted move order too, so summary arrival cannot put them after the move.
  return [...new Set([...ordered, ...section.ids])]
}

export function Browser(props: BrowserInjected & BrowserProps) {
  const {
    wide, expandSidebar, t, useSessions, useWorkspaces, useStore, actions,
    open, fork, rename, archive, unarchive, pin, unpin, createProject, services,
  } = props

  const dialogs = useRef<ReturnType<typeof createSessionDialogs> | null>(null)
  useEffect(() => {
    const handle = createSessionDialogs()
    dialogs.current = handle
    return () => { handle.dispose(); dialogs.current = null }
  }, [])

  const [tab, setTab] = useState<TabKey>(() => readBrowserTab(browserStorage()))
  useEffect(() => { saveBrowserTab(browserStorage(), tab) }, [tab])
  const [showArchived, setShowArchived] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searching = searchQuery.trim().length > 0
  const [diagOpen, setDiagOpen] = useState(false)
  /** 项目 Tab 的段折叠是纯视图偏好，放本地 state，不混进分组 store。 */
  const [projectFolded, setProjectFolded] = useState<ReadonlySet<string>>(() => new Set())

  const list = useSessions((state) => state)
  const workspaceState = useWorkspaces((state) => state)
  const workspaces = workspaceState.items
  const gs = useStore((state) => state)

  const byId = list.byId
  /** 0.1.7 起 SessionListState 没有 `current`；当前会话 = retainedBy.mainView > 0 的那个。 */
  const current = useMemo(() => mainSessionId(list), [list])
  // Pin/archive membership is registry-global WorkspaceSnapshot state, not SessionSummary.
  const pinned = useMemo(() => new Set(workspaceState.pinnedSessionIds), [workspaceState.pinnedSessionIds])
  const archived = useMemo(() => new Set(workspaceState.archivedSessionIds), [workspaceState.archivedSessionIds])
  const filter = showArchived ? 'show' : 'default'

  const acts: SessionRowActions = {
    rename, fork, archive, unarchive, pin, unpin,
    moveTo: (id, groupId) => actions.moveSessionTo(id, groupId,
      moveDestinationOrder(gs, list.ids, groupId, byId, {
        pinnedSessionIds: workspaceState.pinnedSessionIds,
        archivedSessionIds: workspaceState.archivedSessionIds,
      })),
  }

  // Search follows ordering and archive/blank visibility so manual positions survive.
  const visibleIds = (ids: readonly SessionId[]) => filterSessionTitles(
    visibleOrder(ids, byId, current, pinned, archived, filter), byId, searchQuery,
  )
  let resultCount = 0
  const rows = (
    ids: readonly SessionId[], keyPrefix: string, withMove: boolean,
    orderingFor?: (id: SessionId) => SectionOrdering,
  ) =>
    ids.flatMap((id) => {
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
        ordering: orderingFor?.(id),
        t,
      })]
    })

  /* ── 项目 Tab：按 workspace 派生 + 未分组桶 ─────────────────────── */
  const projectSections = () => {
    const owned = new Set<SessionId>()
    const sections = workspaces.map((w) => {
      w.sessionIds.forEach((id) => owned.add(id))
      const basename = w.path.split(/[\\/]/).filter(Boolean).pop() || w.path
      return { key: String(w.workspaceId), label: w.title.trim() || basename, ids: w.sessionIds as readonly SessionId[] }
    })
    const loose = list.ids.filter((id) => !owned.has(id))
    if (loose.length) sections.push({ key: '', label: t('group.ungrouped'), ids: loose })
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
          const folded = !searching && projectFolded.has(sec.key)
          const ordered = reconcileManualOrder(sec.ids, sec.key ? sec.ids : undefined, byId, {
            pinnedSessionIds: [...pinned],
            archivedSessionIds: [...archived],
          })
          const matched = visibleIds(ordered)
          resultCount += matched.length
          if (searching && !matched.length) return null
          return h('div', { key: sec.key || '__u', className: 'dbs-group' },
            h(GroupHeader, {
              section: { key: sec.key, group: null, ids: sec.ids },
              label: sec.label,
              count: matched.length,
              collapsed: folded,
              foldable: !searching,
              onToggle: () => toggleProjectFold(sec.key),
              containsCurrent: current !== undefined && sec.ids.includes(current),
              onRenameGroup: () => {},
              onColorGroup: () => {},
              onDissolveGroup: () => {},
              t,
            }),
            folded ? null : rows(matched, `p${sec.key}`, false),
          )
        })
      : tab === 'groups'
        ? groupSections(gs, list.ids).map((sec) => {
            const collapsed = !searching && !!gs.collapsed[sec.key]
            const ordered = reconcileManualOrder(sec.ids, gs.orderByGroup[sec.key], byId, {
              pinnedSessionIds: [...pinned],
              archivedSessionIds: [...archived],
            })
            // Derive eligible slots before search; hidden rows and the forced-first
            // provisional current blank keep their underlying manual positions.
            const movableIds = new Set(visibleOrder(ordered, byId, current, pinned, archived, filter)
              .filter((id) => !(id === current && byId[id]?.blank)))
            const orderingFor = (id: SessionId) => sectionOrdering(
              ordered, movableIds, pinned, id, searching,
              (next) => actions.setSectionOrder(sec.key, next),
            )
            const matched = visibleIds(ordered)
            resultCount += matched.length
            if (searching && !matched.length) return null
            return h('div', { key: sec.key || '__u', className: 'dbs-group' },
              h(GroupHeader, {
                section: sec,
                count: matched.length,
                collapsed,
                foldable: !searching,
                onToggle: () => actions.toggleCollapsed(sec.key),
                containsCurrent: current !== undefined && ordered.includes(current),
                onRenameGroup: (id) => {
                  const g = gs.groups.find((x) => x.id === id)
                  dialogs.current?.open({
                    title: t('prompt.renameGroup'), initialValue: g?.title ?? t('group.defaultName'),
                    cancelLabel: t('action.cancel'), saveLabel: t('action.save'),
                    submit: async (value) => { actions.renameGroup(id, value) },
                  })
                },
                onColorGroup: actions.cycleGroupColor,
                onDissolveGroup: (id) => {
                  const g = gs.groups.find((x) => x.id === id)
                  const name = g?.title ?? t('group.defaultName')
                  dialogs.current?.open({
                    title: t('group.dissolve'), message: t('group.dissolveConfirm').replace('{name}', name),
                    cancelLabel: t('action.cancel'), saveLabel: t('group.dissolve'),
                    submit: async () => { actions.dissolveGroup(id) },
                  })
                },
                t,
              }),
              collapsed ? null : rows(matched, `g${sec.key}`, true, orderingFor),
            )
          })
        : (() => {
            const matched = visibleIds(orderByRecency(list.ids, byId))
            resultCount = matched.length
            return h('div', { className: 'dbs-group' }, rows(matched, 'flat', true))
          })()

  const diag = [
    `wide = ${JSON.stringify(wide)}`,
    `sessions.ids = ${list.ids.length} / byId = ${Object.keys(byId).length}`,
    `workspaces = ${workspaces.length}`,
    `pinned = ${pinned.size}, archived = ${archived.size} (filter=${filter})`,
    `groups = ${gs.groups.length} / membership = ${Object.keys(gs.membership).length}`,
    `services = ${services}`,
  ].join('\n')

  if (!wide) return h('div', { className: 'dbs-root' },
    h('button', {
      type: 'button', className: 'dbs-iconBtn',
      'aria-label': t('tab.projects'), title: t('tab.projects'),
      onClick: expandSidebar,
    }, Icons.foldRight(16)),
  )

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
    h('div', { className: 'dbs-search', role: 'search', 'aria-label': t('search.label') },
      h('input', {
        type: 'search', className: 'dbs-search-input', value: searchQuery,
        'aria-label': t('search.label'), placeholder: t('search.placeholder'),
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(event.currentTarget.value),
        onKeyDownCapture: (event: React.KeyboardEvent<HTMLInputElement>) => {
          if (event.key !== 'Escape') return
          event.preventDefault()
          event.stopPropagation()
          setSearchQuery('')
        },
      }),
      searchQuery ? h('button', {
        type: 'button', className: 'dbs-iconBtn',
        title: t('search.clear'), 'aria-label': t('search.clear'),
        onClick: () => setSearchQuery(''),
      }, '×') : null,
    ),
    h('div', { className: 'dbs-body' },
      searching && resultCount === 0
        ? h('div', { className: 'dbs-empty', role: 'status' }, t('search.noResults'))
        : body,
    ),
    h('button', {
      type: 'button', className: `${'dbs-iconBtn'} ${'dbs-fab'}`,
      title: t('diag.title'), 'aria-label': t('diag.title'),
      'aria-pressed': String(diagOpen),
      onClick: () => setDiagOpen((v) => !v),
    }, Icons.gear(15)),
    diagOpen ? h('div', { className: 'dbs-diag' }, diag) : null,
  )
}

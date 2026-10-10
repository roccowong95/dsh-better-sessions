/** 一行会话。行操作默认隐藏，hover/focus 才浮现；`···` 是 26×26 矩形热区。 */

import { createElement as h, useEffect, useRef, useState } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { Icons } from '../icons'
import type { SessionGroup } from '../stores'
import type { SectionOrdering } from '../section-order'
import { sessionTimeLabel, SESSION_TIME_REFRESH_MS } from '../session-time'

export interface SessionRowActions {
  readonly rename: (id: SessionId, title: string) => void
  readonly fork: (id: SessionId) => void
  readonly archive: (id: SessionId) => void
  readonly unarchive: (id: SessionId) => void
  readonly pin: (id: SessionId) => void
  readonly unpin: (id: SessionId) => void
  readonly moveTo: (id: SessionId, groupId: string | null) => void
}

export interface SessionRowProps {
  readonly id: SessionId
  readonly summary: SessionSummary
  readonly current: SessionId | undefined
  readonly pinned: ReadonlySet<SessionId>
  readonly archived: ReadonlySet<SessionId>
  readonly onOpen: (id: SessionId) => void
  readonly actions: SessionRowActions
  /** 非空时才渲染「移动到分组」区。 */
  readonly groups: readonly SessionGroup[] | null
  readonly groupId: string | undefined
  /** Supplied only by Groups sections; project and flat views cannot reorder. */
  readonly ordering?: SectionOrdering | undefined
  readonly t: TranslateNS<'better-sessions'>
}

export function SessionRow(props: SessionRowProps) {
  const {
    id, summary, current, pinned, archived,
    onOpen, actions, groups, groupId, ordering, t,
  } = props
  const [menuOpen, setMenuOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    if (summary.blank) return
    const refresh = () => setNow(Date.now())
    const timer = window.setInterval(refresh, SESSION_TIME_REFRESH_MS)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [summary.blank])

  useEffect(() => {
    if (!menuOpen) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDoc, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [menuOpen])

  const isPinned = pinned.has(id)
  const isArchived = archived.has(id)
  const canToggleArchive = !summary.blank
  const canTogglePin = !summary.blank && !isArchived
  const toggleArchive = () => {
    if (!canToggleArchive) return
    wrapRef.current?.querySelector<HTMLButtonElement>('.dbs-menu-btn')?.focus()
    setMenuOpen(false)
    if (isArchived) actions.unarchive(id)
    else actions.archive(id)
  }
  const togglePin = () => {
    if (!canTogglePin) return
    setMenuOpen(false)
    if (isPinned) actions.unpin(id)
    else actions.pin(id)
  }
  /* 0.1.7 的 SessionSummary 已无 `completed` 字段，只保留 running 指示 */
  const dotKind: 'running' | null = summary.running ? 'running' : null

  return h('div', {
    className: 'dbs-row',
    'data-current': String(id === current),
    'data-archived': String(isArchived),
    'data-menu-open': String(menuOpen),
  },
    // The native button covers the row, while the menu remains a sibling above it.
    // Padding and status indicators therefore open the session without bubbling actions.
    h('button', {
      type: 'button',
      className: 'dbs-open',
      title: summary.displayTitle,
      'aria-disabled': isArchived,
      onClick: () => { if (!isArchived) onOpen(id) },
    },
      dotKind ? h('span', { className: 'dbs-dot', 'data-kind': dotKind }) : null,
      isPinned ? h('span', { className: 'dbs-pin', title: t('row.pinned') }, Icons.pin(12)) : null,
      h('span', { className: 'dbs-open-label' }, label(summary, t)),
      !summary.blank ? h('span', { className: 'dbs-row-time' }, sessionTimeLabel(summary.updatedAt, now, t)) : null,
    ),

    h('div', { className: 'dbs-row-actions' },
    h('div', { className: 'dbs-menu-wrap', ref: wrapRef },
      h('button', {
        type: 'button',
        className: 'dbs-menu-btn',
        'aria-label': t('menu.more'),
        'aria-expanded': String(menuOpen),
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation()
          setMenuOpen((v) => !v)
        },
      }, Icons.more(16)),

      menuOpen
        ? h('div', { className: 'dbs-menu', role: 'menu' },
            h('button', {
              type: 'button', role: 'menuitem', className: 'dbs-menu-item',
              onClick: () => { wrapRef.current?.querySelector<HTMLButtonElement>('.dbs-menu-btn')?.focus(); setMenuOpen(false); actions.rename(id, summary.displayTitle) },
            }, Icons.edit(14), t('menu.rename')),
            h('button', {
              type: 'button', role: 'menuitem', className: 'dbs-menu-item',
              disabled: summary.blank,
              onClick: () => { if (!summary.blank) { setMenuOpen(false); actions.fork(id) } },
            }, Icons.branch(14), t('menu.fork')),
            isArchived
              ? h('button', {
                  type: 'button', role: 'menuitem', className: 'dbs-menu-item',
                  disabled: !canToggleArchive, onClick: toggleArchive,
                }, Icons.unarchive(14), t('menu.unarchive'))
              : h('button', {
                  type: 'button', role: 'menuitem', className: 'dbs-menu-item',
                  disabled: !canToggleArchive, onClick: toggleArchive,
                }, Icons.archive(14), t('menu.archive')),
            isPinned
              ? h('button', {
                  type: 'button', role: 'menuitem', className: 'dbs-menu-item',
                  disabled: !canTogglePin, onClick: togglePin,
                }, Icons.unpin(14), t('menu.unpin'))
              : h('button', {
                  type: 'button', role: 'menuitem', className: 'dbs-menu-item',
                  disabled: !canTogglePin, onClick: togglePin,
                }, Icons.pin(14), t('menu.pin')),

            ordering ? [
              h('div', { key: 'order-sep', className: 'dbs-menu-sep' }),
              h('button', {
                key: 'up', type: 'button', role: 'menuitem', className: 'dbs-menu-item',
                disabled: !ordering.canMoveUp, 'aria-disabled': !ordering.canMoveUp,
                onClick: () => { if (ordering.canMoveUp) { setMenuOpen(false); ordering.moveUp() } },
              }, t('menu.moveUp')),
              h('button', {
                key: 'down', type: 'button', role: 'menuitem', className: 'dbs-menu-item',
                disabled: !ordering.canMoveDown, 'aria-disabled': !ordering.canMoveDown,
                onClick: () => { if (ordering.canMoveDown) { setMenuOpen(false); ordering.moveDown() } },
              }, t('menu.moveDown')),
            ] : null,
            groups
              ? [
                  h('div', { key: 'sep', className: 'dbs-menu-sep' }),
                  h('div', { key: 'label', className: 'dbs-menu-label' }, t('move.toGroup')),
                  ...groups.map((g) => h('button', {
                    key: g.id,
                    type: 'button', role: 'menuitem', className: 'dbs-menu-item',
                    onClick: () => { setMenuOpen(false); actions.moveTo(id, g.id) },
                  }, h('span', { className: 'dbs-swatch', style: { background: g.color } }), g.title ?? t('group.defaultName'))),
                  groupId
                    ? h('button', {
                        key: '__out', type: 'button', role: 'menuitem', className: 'dbs-menu-item',
                        onClick: () => { setMenuOpen(false); actions.moveTo(id, null) },
                      }, t('move.out'))
                    : null,
                ]
              : null,
          )
        : null),
      h('button', {
        type: 'button', className: 'dbs-row-action',
        title: t(isArchived ? 'menu.unarchive' : 'menu.archive'),
        'aria-label': t(isArchived ? 'menu.unarchive' : 'menu.archive'),
        disabled: !canToggleArchive,
        onClick: (e: React.MouseEvent) => { e.stopPropagation(); toggleArchive() },
      }, isArchived ? Icons.unarchive(16) : Icons.archive(16)),
      h('button', {
        type: 'button', className: 'dbs-row-action',
        title: t(isPinned ? 'menu.unpin' : 'menu.pin'),
        'aria-label': t(isPinned ? 'menu.unpin' : 'menu.pin'),
        'aria-pressed': isPinned, disabled: !canTogglePin,
        onClick: (e: React.MouseEvent) => { e.stopPropagation(); togglePin() },
      }, isPinned ? Icons.unpin(16) : Icons.pin(16)),
    ),
  )
}

/* ── 内部小工具 ───────────────────────────────────────────────────── */

/** An explicit durable title takes precedence even before the first message. */
export function label(summary: SessionSummary, t: TranslateNS<'better-sessions'>): string {
  return summary.blank && !summary.title?.trim() ? t('row.newSession') : summary.displayTitle
}

/** 一行会话。行操作默认隐藏，hover/focus 才浮现；`···` 是 26×26 矩形热区。 */

import { createElement as h, useEffect, useRef, useState } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { Icons } from '../icons'
import type { SessionGroup } from '../stores'

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
  readonly t: TranslateNS<'better-sessions'>
}

export function SessionRow(props: SessionRowProps) {
  const {
    id, summary, current, pinned, archived,
    onOpen, actions, groups, groupId, t,
  } = props
  const [menuOpen, setMenuOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

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
  /* 0.1.7 的 SessionSummary 已无 `completed` 字段，只保留 running 指示 */
  const dotKind: 'running' | null = summary.running ? 'running' : null

  return h('div', {
    className: 'dbs-row',
    'data-current': String(id === current),
    'data-archived': String(isArchived),
  },
    dotKind ? h('span', { className: 'dbs-dot', 'data-kind': dotKind }) : null,
    isPinned ? h('span', { className: 'dbs-pin', title: t('row.pinned') }, Icons.pin(12)) : null,
    h('button', {
      type: 'button',
      className: 'dbs-open',
      title: summary.displayTitle,
      onClick: () => { if (!isArchived) onOpen(id) },
    }, label(summary, t)),

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
              onClick: () => { setMenuOpen(false); actions.rename(id, summary.displayTitle) },
            }, Icons.edit(14), t('menu.rename')),
            h('button', {
              type: 'button', role: 'menuitem', className: 'dbs-menu-item',
              onClick: () => { setMenuOpen(false); actions.fork(id) },
            }, Icons.branch(14), t('menu.fork')),
            isArchived
              ? h('button', {
                  type: 'button', role: 'menuitem', className: 'dbs-menu-item',
                  onClick: () => { setMenuOpen(false); actions.unarchive(id) },
                }, Icons.unarchive(14), t('menu.unarchive'))
              : h('button', {
                  type: 'button', role: 'menuitem', className: 'dbs-menu-item',
                  onClick: () => { setMenuOpen(false); actions.archive(id) },
                }, Icons.archive(14), t('menu.archive')),
            isPinned
              ? h('button', {
                  type: 'button', role: 'menuitem', className: 'dbs-menu-item',
                  onClick: () => { setMenuOpen(false); actions.unpin(id) },
                }, Icons.unpin(14), t('menu.unpin'))
              : h('button', {
                  type: 'button', role: 'menuitem', className: 'dbs-menu-item',
                  onClick: () => { setMenuOpen(false); actions.pin(id) },
                }, Icons.pin(14), t('menu.pin')),

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
  )
}

/* ── 内部小工具 ───────────────────────────────────────────────────── */

/** blank 行显示本地化「新会话」，否则显示 displayTitle（对齐原生行为）。 */
function label(summary: SessionSummary, t: TranslateNS<'better-sessions'>): string {
  return summary.blank ? t('row.newSession') : summary.displayTitle
}

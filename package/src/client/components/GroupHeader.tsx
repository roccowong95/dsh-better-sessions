/** 分组段头：折叠箭头 + 色块 + 标题 + 计数合成一个大连通区，菜单独立在右。 */

import { createElement as h, useEffect, useRef, useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { Icons } from '../icons'
import type { GroupSection } from '../stores'

export interface GroupHeaderProps {
  readonly section: GroupSection
  /** 覆盖标题（项目 Tab 用 workspace 名）；缺省从 group / 未分组推导。 */
  readonly label?: string
  readonly count: number
  readonly collapsed: boolean
  readonly foldable: boolean
  readonly onToggle: () => void
  /** 含当前会话的段头用 business 色（对齐原生 folderActive）。 */
  readonly containsCurrent: boolean
  readonly onRenameGroup: (id: string) => void
  readonly onColorGroup: (id: string) => void
  readonly onDissolveGroup: (id: string) => void
  readonly t: TranslateNS<'better-sessions'>
}

export function GroupHeader(props: GroupHeaderProps) {
  const {
    section, label, count, collapsed, foldable, onToggle,
    containsCurrent, onRenameGroup, onColorGroup, onDissolveGroup, t,
  } = props
  const group = section.group
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

  const title = label ?? (group ? group.title ?? t('group.defaultName') : t('group.ungrouped'))

  return h('div', { className: 'dbs-head', 'data-contains-current': String(containsCurrent) },
    h('button', {
      type: 'button',
      className: 'dbs-head-toggle',
      'aria-expanded': String(!collapsed),
      title: collapsed ? t('action.expand') : t('action.collapse'),
      onClick: foldable ? onToggle : undefined,
      style: foldable ? undefined : { cursor: 'default' },
    },
      h('span', { className: 'dbs-fold' }, collapsed ? Icons.foldRight(12) : Icons.foldDown(12)),
      group ? h('span', { className: 'dbs-swatch', style: { background: group.color } }) : null,
      h('span', { className: 'dbs-head-label' }, title),
      h('span', { className: 'dbs-head-count' }, '\u00b7 ', count)),

    group
      ? h('div', { className: 'dbs-menu-wrap', ref: wrapRef },
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
                  onClick: () => { wrapRef.current?.querySelector<HTMLButtonElement>('.dbs-menu-btn')?.focus(); setMenuOpen(false); onRenameGroup(group.id) },
                }, Icons.edit(14), t('group.rename')),
                h('button', {
                  type: 'button', role: 'menuitem', className: 'dbs-menu-item',
                  onClick: () => { setMenuOpen(false); onColorGroup(group.id) },
                }, Icons.unpin(14), t('group.color')),
                h('div', { className: 'dbs-menu-sep' }),
                h('button', {
                  type: 'button', role: 'menuitem', className: 'dbs-menu-item',
                  onClick: () => { wrapRef.current?.querySelector<HTMLButtonElement>('.dbs-menu-btn')?.focus(); setMenuOpen(false); onDissolveGroup(group.id) },
                }, Icons.archive(14), t('group.dissolve')),
              )
            : null)
      : null,
  )
}

/**
 * 图标：优先用 `ui-primitives` 官方图标（`color rides currentColor`），
 * 取不到时退回一个文本字符——绝不因为图标缺失而白屏。
 *
 * `ui-primitives` 是 AGENTS.md 点名允许的"窄静态属主"，共享控件只能来自它。
 */

import { createElement as h } from 'react'
import * as Prim from '@deepseek-ai/dsh-client-ui-primitives'

type Glyph = (size: number) => React.ReactNode

/** 渲染一个官方图标；模块表里取不到就退回文本字符。 */
function ico(name: string, size: number, fallback: string): React.ReactNode {
  const C = (Prim as unknown as Record<string, unknown>)[name]
  if (typeof C === 'function') return h(C as React.ComponentType<{ size?: number }>, { size })
  return h('span', { 'aria-hidden': true }, fallback)
}

export const Icons: Record<
  'foldDown' | 'foldRight' | 'more' | 'plus' | 'archive' | 'unarchive' | 'pin' | 'unpin' | 'gear' | 'edit' | 'branch',
  Glyph
> = {
  foldDown: (s) => ico('IconChevronDownOutlineMedium', s, '\u25be'),
  foldRight: (s) => ico('IconChevronRightOutlineMedium', s, '\u25b8'),
  more: (s) => ico('IconEllipsisOutlineMedium', s, '\u00b7\u00b7\u00b7'),
  plus: (s) => ico('IconPlusOutlineMedium', s, '+'),
  archive: (s) => ico('IconArchiveOutlineMedium', s, '\u2338'),
  unarchive: (s) => ico('IconUnarchiveOutlineMedium', s, '\u2339'),
  pin: (s) => ico('IconPinFillMedium', s, '\u25a0'),
  unpin: (s) => ico('IconPinOutlineMedium', s, '\u25a1'),
  gear: (s) => ico('IconSettingsOutlineMedium', s, '\u2699'),
  edit: (s) => ico('IconEditOutlineMedium', s, '\u270e'),
  branch: (s) => ico('IconBranchOutlineMedium', s, '\u2442'),
}

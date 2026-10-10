/** Lightweight decorative SVGs: no dependency on optional primitive icon exports. */
import { createElement as h } from 'react'

type Glyph = (size: number) => React.ReactNode

/** Buttons provide accessible labels; their icons inherit the surrounding theme color. */
function ico(size: number, ...paths: readonly string[]): React.ReactNode {
  return h('svg', {
    xmlns: 'http://www.w3.org/2000/svg',
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    focusable: false,
  }, paths.map((d, key) => h('path', { key, d })))
}

export const Icons: Record<
  'foldDown' | 'foldRight' | 'more' | 'plus' | 'archive' | 'unarchive' | 'pin' | 'unpin' | 'gear' | 'edit' | 'branch',
  Glyph
> = {
  foldDown: (s) => ico(s, 'm6 9 6 6 6-6'),
  foldRight: (s) => ico(s, 'm9 6 6 6-6 6'),
  more: (s) => ico(s, 'M5 12h.01M12 12h.01M19 12h.01'),
  plus: (s) => ico(s, 'M12 5v14M5 12h14'),
  archive: (s) => ico(s, 'M4 4h16v4H4zM5 8v12h14V8', 'M9 12h6'),
  unarchive: (s) => ico(s, 'M4 4h16v4H4zM5 8v12h14V8', 'M12 17v-6m-3 3 3-3 3 3'),
  pin: (s) => ico(s, 'M9 3h6l-1 6 4 4v2H6v-2l4-4z', 'M12 15v6'),
  unpin: (s) => ico(s, 'M9 3h6l-1 6 4 4v2H6v-2l4-4z', 'M12 15v6M3 3l18 18'),
  gear: (s) => ico(s,
    'm10 3-.5 3-2 .9L5 6l-2 3 2.5 1.8v2.4L3 15l2 3 2.5-.9 2 .9.5 3h4l.5-3 2-.9 2.5.9 2-3-2.5-1.8v-2.4L21 9l-2-3-2.5.9-2-.9L14 3z',
    'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0'),
  edit: (s) => ico(s, 'm15 4 5 5M4 20l1-6L16 3l5 5L10 19z'),
  branch: (s) => ico(s,
    'M6 7v10M6 12h6a6 6 0 0 0 6-6',
    'M8 5a2 2 0 1 1-4 0 2 2 0 0 1 4 0M8 19a2 2 0 1 1-4 0 2 2 0 0 1 4 0M20 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0'),
}

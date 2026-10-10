import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

const css = readFileSync(new URL('../css/browser.css', import.meta.url), 'utf8')
function rule(selector: string): string {
  const start = css.indexOf(`\n${selector} {`)
  expect(start, selector).toBeGreaterThanOrEqual(0)
  return css.slice(start, css.indexOf('}', start) + 1)
}

test('sidebar inherits host background and uses only semantic theme variables', () => {
  expect(rule('.dbs-root')).toContain('background: transparent;')
  expect([...css.matchAll(/var\((--[^),]+)/g)].map((m) => m[1]).every((token) => token?.startsWith('--dsw-'))).toBe(true)
})

test('highlight geometry fits narrow container with equal outer gutters, no menu clipping', () => {
  const row = rule('.dbs-row')
  expect(row).toContain('box-sizing: border-box;')
  expect(row).toContain('width: 100%;')
  expect(row).toContain('min-width: 0;')
  expect(row).toContain('padding: 0;')
  expect(row).toContain('border-radius: 8px;')
  const body = rule('.dbs-body')
  expect(body).toContain('padding: 4px 4px 34px;')
  expect(body).toContain('scrollbar-gutter: stable both-edges;')
  expect(body).toContain('overflow-y: auto;')
  expect(body).toContain('overflow-x: auto;')
  expect(css).not.toMatch(/overflow-x:\s*(?:hidden|clip)/)
  expect(rule('.dbs-row-actions')).toContain('right: 8px;')
  expect(rule('.dbs-row-actions')).toContain('pointer-events: none;')
  expect(rule('.dbs-row-actions .dbs-menu')).toContain('pointer-events: auto;')
  expect(rule('.dbs-row-action')).toContain('width: 26px;')
  expect(rule('.dbs-row[data-current="true"]')).not.toContain('box-shadow:')
  expect(rule('.dbs-row[data-current="true"]')).not.toMatch(/(?:padding|margin|width):/)
  expect(rule('.dbs-row:hover')).not.toMatch(/(?:padding|margin|width):/)
})

test('open hit target fills row height and title shrinks independently from sibling menu', () => {
  const open = rule('.dbs-open')
  expect(open).toContain('width: 100%;')
  expect(open).toContain('height: 100%;')
  expect(open).toContain('padding: 0 8px;')
  expect(open).toContain('box-sizing: border-box;')
  const title = rule('.dbs-open-label')
  expect(title).toContain('min-width: 0;')
  expect(title).toContain('text-overflow: ellipsis;')
  expect(rule('.dbs-open:focus-visible')).toContain('outline: 2px solid var(--dsw-alias-brand-primary);')
})

test('pointer leave cannot latch actions through mouse focus or an opacity transition', () => {
  expect(rule('.dbs-row-actions')).toContain('opacity: 0;')
  expect(rule('.dbs-row-actions .dbs-row-action')).toContain('pointer-events: none;')
  expect(rule('.dbs-row[data-menu-open="true"] .dbs-row-actions')).toContain('opacity: 1;')
  expect(css).toContain('.dbs-row:has(:focus-visible) .dbs-row-actions,')
  expect(rule('.dbs-row[data-menu-open="true"] .dbs-row-time')).toContain('display: none;')
  expect(rule('.dbs-row[data-menu-open="true"] .dbs-open')).toContain('padding-right: 94px;')
  expect(css).not.toContain('.dbs-row:focus-within')
  expect(css).not.toContain('transition: opacity')
  expect(css).not.toContain('.dbs-dialog')
})

test('native sidebar resize handle gains centered hit area only in the plugin frame', () => {
  const selector = 'div:has(> [data-side="sidebar"]):has(.dbs-root) > [data-side="sidebar"]'
  const handle = rule(selector)
  expect(handle).toContain('width: 12px;')
  expect(handle).toContain('margin-left: -6px;')
  expect(handle).toContain('-webkit-app-region: no-drag;')
  expect(handle).toContain('cursor: col-resize;')
  expect(rule(`${selector}::after`)).toContain('pointer-events: none;')
  expect(rule(`${selector}:active::after`)).toContain('var(--dsw-alias-brand-primary)')
})

test('custom clear control is not duplicated by native search cancellation', () => {
  expect(rule('.dbs-search-input::-webkit-search-cancel-button')).toContain('-webkit-appearance: none;')
  expect(rule('.dbs-search-input::-webkit-search-cancel-button')).toContain('display: none;')
})

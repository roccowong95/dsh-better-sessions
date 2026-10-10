import { createRequire } from 'node:module'
import { createElement } from 'react'
import { describe, expect, test, vi } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { filterSessionTitles } from './search'
import { reconcileManualOrder, visibleOrder } from './order'
import { Browser, type BrowserInjected, type BrowserProps } from './components/Browser'
import { en, zh } from './locales'

const view = vi.hoisted(() => ({ tab: 'projects', query: '' }))
vi.mock('@deepseek-ai/dsh-client-store', () => ({ defineStore: vi.fn() }))
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({ Modal: 'sdk-modal', Input: 'sdk-input', Button: 'sdk-button', relativeTime: () => ({ unit: 'now', n: 0 }) }))
vi.mock('./view-preferences', () => ({
  browserStorage: () => undefined,
  readBrowserTab: () => view.tab,
  saveBrowserTab: vi.fn(),
}))
vi.mock('react', async (original) => {
  const react = await original<typeof import('react')>()
  return { ...react, useState: (initial: unknown) => {
    if (initial === 'projects') return [view.tab, vi.fn()]
    if (initial === '') return [view.query, vi.fn()]
    return react.useState(initial)
  } }
})
const { renderToStaticMarkup } = createRequire(import.meta.url)('react-dom/server') as {
  renderToStaticMarkup: (element: ReturnType<typeof createElement>) => string
}
const sid = (id: string) => id as SessionId
const ids = ['old', 'hidden', 'new'].map(sid)
const byId = {
  [sid('old')]: { id: sid('old'), title: 'Alpha explicit', displayTitle: 'Older row', updatedAt: 1, blank: false, running: false },
  [sid('hidden')]: { id: sid('hidden'), displayTitle: 'Hidden row', updatedAt: 5, blank: false, running: false },
  [sid('new')]: { id: sid('new'), displayTitle: 'ALPHA recent', updatedAt: 10, blank: false, running: false },
}

test('title search matches either explicit or display title, trims and ignores case', () => {
  expect(filterSessionTitles(ids, byId, '  aLpHa  ')).toEqual([sid('old'), sid('new')])
  expect(filterSessionTitles(ids, byId, 'older')).toEqual([sid('old')])
  expect(filterSessionTitles(ids, byId, '   ')).toEqual(ids)
  expect(filterSessionTitles([sid('missing')], byId, 'alpha')).toEqual([])
  expect(filterSessionTitles(ids, byId, 'unmatched')).toEqual([])
})

test('search preserves reconciled manual visibility order and does not mutate source data', () => {
  const saved = [sid('old'), sid('hidden'), sid('new')]
  const before = JSON.stringify({ ids, byId, saved })
  const ordered = reconcileManualOrder(ids, saved, byId)
  const visible = visibleOrder(ordered, byId, undefined, [], [sid('hidden')])
  expect(filterSessionTitles(visible, byId, 'alpha')).toEqual([sid('old'), sid('new')])
  expect(filterSessionTitles(visible, byId, '')).toEqual(visible)
  expect(JSON.stringify({ ids, byId, saved })).toBe(before)
})

function render(wide = true, archived: SessionId[] = []) {
  const list = { ids, byId }
  const workspace = { items: [{ workspaceId: 'project', title: 'Project', path: '/project', sessionIds: ids }], pinnedSessionIds: [], archivedSessionIds: archived }
  const groups = { groups: [{ id: 'group', title: 'Group', color: 0 }], membership: Object.fromEntries(ids.map((id) => [id, 'group'])), orderByGroup: { group: ids }, collapsed: { group: true } }
  const props = {
    wide, t: (key: keyof typeof en) => en[key],
    useSessions: (selector: (state: typeof list) => unknown) => selector(list),
    useWorkspaces: (selector: (state: typeof workspace) => unknown) => selector(workspace),
    useStore: (selector: (state: typeof groups) => unknown) => selector(groups),
    actions: {}, services: 'test',
  } as unknown as BrowserInjected & BrowserProps
  return renderToStaticMarkup(createElement(Browser, props))
}

describe.each(['projects', 'groups', 'flat'])('Browser search in %s tab', (tab) => {
  test('filters rows, updates counts and reveals collapsed matches without changing order', () => {
    view.tab = tab; view.query = ' alpha '
    const html = render()
    expect(html).toContain('aria-label="Search session titles"')
    expect(html).toContain('type="search"')
    expect(html).toContain('Older row')
    expect(html).toContain('ALPHA recent')
    expect(html).not.toContain('Hidden row')
    if (tab !== 'flat') {
      expect(html).toContain('class="dbs-head-count">· 2')
      expect(html.indexOf('title="Older row"')).toBeLessThan(html.indexOf('title="ALPHA recent"'))
    } else {
      expect(html.indexOf('title="ALPHA recent"')).toBeLessThan(html.indexOf('title="Older row"'))
    }
  })
  test('localized accessible empty state respects archive visibility', () => {
    view.tab = tab; view.query = 'hidden'
    const html = render(true, [sid('hidden')])
    expect(html).toContain('role="status">No matching sessions')
    expect(html).not.toContain('class="dbs-head"')
  })
})

test('compact mode does not show search or empty label', () => {
  view.query = 'unmatched'
  const html = render(false)
  expect(html).not.toContain('dbs-search')
  expect(html).not.toContain('No matching sessions')
  expect(html).toContain('aria-label="Projects"')
})

test('both locales supply search label, placeholder and empty state', () => {
  for (const locale of [en, zh]) {
    expect(locale['search.label']).toBeTruthy()
    expect(locale['search.placeholder']).toBeTruthy()
    expect(locale['search.noResults']).toBeTruthy()
  }
})

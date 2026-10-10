import { expect, test, vi } from 'vitest'
import type { SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { createElement } from 'react'
import { createRequire } from 'node:module'
const { renderToStaticMarkup } = createRequire(import.meta.url)('react-dom/server') as {
  renderToStaticMarkup: (element: ReturnType<typeof createElement>) => string
}
import { label, SessionRow, type SessionRowActions } from './components/SessionRow'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

const t = (() => 'New Session') as TranslateNS<'better-sessions'>
const summary = (fields: Partial<SessionSummary>) => ({ ...fields }) as SessionSummary

test('blank unnamed session uses localized fallback', () => {
  expect(label(summary({ blank: true, displayTitle: 'playground' }), t)).toBe('New Session')
})
test('blank explicitly renamed session keeps its durable title', () => {
  expect(label(summary({ blank: true, title: 'Regression', displayTitle: 'Regression' }), t)).toBe('Regression')
})
test('nonblank session uses projected display title', () => {
  expect(label(summary({ blank: false, displayTitle: 'Conversation' }), t)).toBe('Conversation')
})

test('archived open button exposes unavailable action to assistive technology', () => {
  const id = 'regression-row' as SessionId
  const noop = () => {}
  const actions: SessionRowActions = { rename: noop, fork: noop, archive: noop, unarchive: noop, pin: noop, unpin: noop, moveTo: noop }
  const render = (archived: boolean) => renderToStaticMarkup(createElement(SessionRow, {
    id, summary: summary({ blank: false, displayTitle: 'Regression' }), current: undefined,
    pinned: new Set<SessionId>(), archived: new Set<SessionId>(archived ? [id] : []),
    onOpen: noop, actions, groups: null, groupId: undefined, t,
  }))
  expect(render(true)).toContain('aria-disabled="true"')
  expect(render(false)).toContain('aria-disabled="false"')
})

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({ relativeTime: () => ({ unit: 'now', n: 0 }) }))

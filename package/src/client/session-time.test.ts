import { expect, test, vi } from 'vitest'
import type { RelativeTime } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { sessionTimeLabel, SESSION_TIME_REFRESH_MS } from './session-time'
import { en, zh } from './locales'

const bucket = vi.hoisted(() => vi.fn<(at: number, now: number) => RelativeTime>())
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({ relativeTime: bucket }))

for (const [name, dictionary] of [['en', en], ['zh', zh]] as const) {
  test.each(['now', 'minutes', 'hours', 'days', 'months', 'years'] as const)(`${name} localizes official %s bucket`, (unit) => {
    bucket.mockReturnValue({ unit, n: unit === 'now' ? 0 : 5 })
    const t = ((key: keyof typeof en, vars?: { n: number }) => dictionary[key].replace('{n}', String(vars?.n))) as TranslateNS<'better-sessions'>
    expect(sessionTimeLabel(123, 456, t)).toBe(dictionary[`time.${unit}`].replace('{n}', '5'))
    expect(bucket).toHaveBeenLastCalledWith(123, 456)
  })
}
test('relative labels refresh on a bounded half-minute cadence', () => {
  expect(SESSION_TIME_REFRESH_MS).toBe(30_000)
})

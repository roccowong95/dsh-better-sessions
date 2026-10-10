import { relativeTime } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'

/** Match the official sidebar buckets; words follow the app locale, not the browser. */
export function sessionTimeLabel(updatedAt: number, now: number, t: TranslateNS<'better-sessions'>): string {
  const { unit, n } = relativeTime(updatedAt, now)
  return unit === 'now' ? t('time.now') : t(`time.${unit}`, { n })
}

export const SESSION_TIME_REFRESH_MS = 30_000

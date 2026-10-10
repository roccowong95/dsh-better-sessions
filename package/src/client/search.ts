import type { SessionId } from '@deepseek-ai/dsh-session/types'

export interface SearchableSummary {
  readonly title?: string
  readonly displayTitle?: string
}

/** A visibility projection only: never sorts or updates the source session order. */
export function filterSessionTitles(
  ids: readonly SessionId[],
  byId: Readonly<Record<SessionId, SearchableSummary>>,
  query: string,
): SessionId[] {
  const needle = query.trim().toLowerCase()
  return ids.filter((id) => {
    const summary = byId[id]
    if (!summary) return false
    return !needle || [summary.title, summary.displayTitle].some(
      (title) => title?.toLowerCase().includes(needle),
    )
  })
}

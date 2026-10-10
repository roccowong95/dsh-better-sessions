import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** Read the current order at completion, excluding a child already inserted by the runtime. */
export function nextAfterParent(ids: readonly SessionId[], parent: SessionId, child: SessionId): SessionId | undefined {
  const siblings = ids.filter((id) => id !== child)
  const index = siblings.indexOf(parent)
  return index < 0 ? undefined : siblings[index + 1]
}

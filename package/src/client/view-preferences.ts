export type SessionBrowserTab = 'projects' | 'groups' | 'flat'
export const TAB_STORAGE_KEY = 'dsh-better-sessions:tab'

export function readBrowserTab(storage: Pick<Storage, 'getItem'> | undefined): SessionBrowserTab {
  try {
    const value = storage?.getItem(TAB_STORAGE_KEY)
    return value === 'groups' || value === 'flat' ? value : 'projects'
  } catch {
    return 'projects'
  }
}

export function saveBrowserTab(storage: Pick<Storage, 'setItem'> | undefined, tab: SessionBrowserTab): void {
  try { storage?.setItem(TAB_STORAGE_KEY, tab) } catch { /* Restricted storage must not break navigation. */ }
}

export function browserStorage(): Storage | undefined {
  try { return typeof window === 'undefined' ? undefined : window.localStorage } catch { return undefined }
}

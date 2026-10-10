import { expect, test, vi } from 'vitest'
import { readBrowserTab, saveBrowserTab, TAB_STORAGE_KEY } from './view-preferences'

test('restores only supported tabs and defaults invalid or missing state', () => {
  for (const tab of ['projects', 'groups', 'flat'] as const) {
    expect(readBrowserTab({ getItem: () => tab })).toBe(tab)
  }
  for (const value of [null, '', 'unknown', '{bad}']) {
    expect(readBrowserTab({ getItem: () => value })).toBe('projects')
  }
  expect(readBrowserTab(undefined)).toBe('projects')
})
test('writes view preference without touching session data', () => {
  const setItem = vi.fn()
  saveBrowserTab({ setItem }, 'flat')
  expect(setItem).toHaveBeenCalledExactlyOnceWith(TAB_STORAGE_KEY, 'flat')
})
test('restricted storage cannot prevent rendering or navigation', () => {
  expect(readBrowserTab({ getItem: () => { throw new Error('denied') } })).toBe('projects')
  expect(() => saveBrowserTab({ setItem: () => { throw new Error('quota') } }, 'groups')).not.toThrow()
  expect(() => saveBrowserTab(undefined, 'groups')).not.toThrow()
})

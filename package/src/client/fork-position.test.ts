import { expect, test } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { nextAfterParent } from './fork-position'
const id = (value: string) => value as SessionId
const ids = (...values: string[]) => values.map(id)

test('ignores runtime child at head and finds next sibling', () => {
  expect(nextAfterParent(ids('child', 'before', 'parent', 'after'), id('parent'), id('child'))).toBe('after')
})
test('ignores child already adjacent to parent', () => {
  expect(nextAfterParent(ids('parent', 'child', 'after'), id('parent'), id('child'))).toBe('after')
})
test('parent at end appends child', () => {
  expect(nextAfterParent(ids('child', 'before', 'parent'), id('parent'), id('child'))).toBeUndefined()
})
test('reads latest reordered sibling rather than a captured position', () => {
  expect(nextAfterParent(ids('child', 'parent', 'new-next', 'old-next'), id('parent'), id('child'))).toBe('new-next')
})

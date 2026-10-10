import { describe, expect, it } from 'vitest'
import { en, zh } from './locales'

describe('product locale contract', () => {
  it('provides the same nonempty keys in both languages', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
    for (const key of Object.keys(zh) as (keyof typeof zh)[]) {
      expect(zh[key].trim()).not.toBe('')
      expect(en[key].trim()).not.toBe('')
    }
  })

  it('keeps interpolation placeholders consistent', () => {
    for (const key of Object.keys(zh) as (keyof typeof zh)[]) {
      const placeholders = (text: string) => [...text.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]).sort()
      expect(placeholders(en[key])).toEqual(placeholders(zh[key]))
    }
  })

  it('localizes group dialog and ordering controls', () => {
    expect(zh['action.cancel']).toBe('取消')
    expect(zh['action.save']).toBe('保存')
    expect(zh['menu.moveUp']).toBe('上移')
    expect(zh['menu.moveDown']).toBe('下移')
    expect(en['action.cancel']).toBe('Cancel')
    expect(en['action.save']).toBe('Save')
    expect(zh['arch.runningConfirm']).toContain('停止')
    expect(en['arch.runningConfirm']).toContain('Stop')
  })
})

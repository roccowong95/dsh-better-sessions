import { test, expect } from 'vitest'
import { createElement, isValidElement } from 'react'
import { createRequire } from 'node:module'
import { Icons } from './icons'

const { renderToStaticMarkup } = createRequire(import.meta.url)('react-dom/server') as {
  renderToStaticMarkup: (element: ReturnType<typeof createElement>) => string
}

for (const [name, glyph] of Object.entries(Icons)) {
  test(`${name} renders a self-contained decorative SVG`, () => {
    const element = glyph(16)
    expect(isValidElement(element)).toBe(true)
    if (!isValidElement(element)) throw new Error('Expected SVG element')
    const markup = renderToStaticMarkup(createElement('span', null, element))
    expect(markup).toContain('<svg')
    expect(markup).toContain('width="16"')
    expect(markup).toContain('height="16"')
    expect(markup).toContain('viewBox="0 0 24 24"')
    expect(markup).toContain('stroke="currentColor"')
    expect(markup).toContain('aria-hidden="true"')
    expect(markup).toContain('<path')
    expect(markup).not.toContain('<use')
    expect(markup).not.toContain('<image')
  })
}

import { expect, test } from 'vitest'
import { replaceCssText } from '../../scripts/css-text.mjs'

const cases = [
  ['single quotes', ".dbs::before { content: 'single quotes'; }"],
  ['double quotes', '.dbs::before { content: "double quotes"; }'],
  ['backslashes', String.raw`.dbs::before { content: "C:\\styles\\browser\a"; }`],
  ['newlines', '.dbs {\n  color: red;\r\n}\n'],
  ['replacement metacharacters', '.dbs::before { content: "$& $$ $` $\' $1"; }'],
  ['quoted placeholder inside CSS', `.dbs::before { content: '__DBS_CSS_TEXT__'; }\n.dbs::after { content: "__DBS_CSS_TEXT__"; }`],
]
cases.push(['combined CSS', cases.map(([, css]) => css).join('\n')])

for (const quote of ["'", '"']) {
  for (const [name, css] of cases) {
    test(`${quote}-quoted placeholder preserves ${name} when evaluated`, () => {
      const code = `const css = ${quote}__DBS_CSS_TEXT__${quote}; return css;`
      const generated = replaceCssText(code, css)
      expect(generated).toBe(`const css = ${JSON.stringify(css)}; return css;`)
      expect(new Function(generated)()).toBe(css)
    })
  }
}

test('replaces every occurrence of both quote styles in one pass', () => {
  const css = cases.at(-1)[1]
  const code = `return ['__DBS_CSS_TEXT__', "__DBS_CSS_TEXT__", '__DBS_CSS_TEXT__'];`
  expect(new Function(replaceCssText(code, css))()).toEqual([css, css, css])
})

test('leaves unquoted placeholders and unrelated strings unchanged', () => {
  const code = `const __DBS_CSS_TEXT__ = 1; return '__DBS_CSS_TEXT__suffix';`
  expect(replaceCssText(code, 'unused CSS')).toBe(code)
})

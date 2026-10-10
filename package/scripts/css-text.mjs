/** Replace complete quoted placeholders with a JavaScript CSS string literal. */
export function replaceCssText(code, css) {
  const literal = JSON.stringify(css)
  // A callback keeps CSS replacement metacharacters literal; one pass avoids
  // replacing placeholder text that happens to occur inside the injected CSS.
  return code.replace(/(['"])__DBS_CSS_TEXT__\1/g, () => literal)
}

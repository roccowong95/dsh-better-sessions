/**
 * 用 rolldown 的 JS API 直接打浏览器半 bundle。
 *
 * 不走 tsdown 的配置文件：本机 Node 版本下 tsdown 的配置加载器有已知 bug
 * （连它自己的产物都解析不了）。rolldown 是 tsdown 的底层引擎，API 直接可用。
 */
import { rolldown } from 'rolldown'
import { readFileSync } from 'node:fs'
import { replaceCssText } from './css-text.mjs'

/** baseline 隐式外部依赖：由宿主模块表运行期提供，不能打进 bundle。 */
const BASELINE = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-renderer',
  '@deepseek-ai/dsh-client-ui-sidebar',
  '@deepseek-ai/dsh-client-ui-session',
  '@deepseek-ai/dsh-client-ui-workspace',
  '@deepseek-ai/dsh-client-locale',
  '@deepseek-ai/dsh-api-session-controller',
  '@deepseek-ai/dsh-api-workspace-controller',
  '@deepseek-ai/dsh-session',
  '@deepseek-ai/dsh-workspace',
]

/** 把 `__DBS_CSS_TEXT__` 占位符替换成 CSS 文本的字符串字面量。 */
function injectCssText() {
  const css = readFileSync('src/css/browser.css', 'utf8')
  return {
    name: 'dsh-inject-css-text',
    transform: {
      filter: /\.(ts|tsx|mts|js|mjs)$/,
      handler(code) {
        if (!code.includes('__DBS_CSS_TEXT__')) return null
        return { code: replaceCssText(code, css), map: null }
      },
    },
  }
}

const bundle = await rolldown({
  input: ['src/client/index.ts'],
  platform: 'browser',
  external: BASELINE,
  // CSS 不走打包器：构建期读文件，用 transform 把占位符替换成字符串字面量。
  // 组件里类名是字面量（'dbs-xxx'），单一事实源就是 src/css/browser.css。
  plugins: [injectCssText()],
  onLog(level, log) {
    if (level === 'warn' || level === 'error') console.error(`[${level}]`, log.message)
  },
})

await bundle.write({
  dir: '.work',
  format: 'cjs',
  entryFileNames: 'client.cjs',
  // 不产出 sourcemap / css 文件：CSS 已由插件变成 JS 模块
  sourcemap: false,
})

await bundle.close()
console.log('[bundle] .work/client.cjs written')

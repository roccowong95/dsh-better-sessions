import { cssModulesInline } from './scripts/css-modules-inline.mjs'

/**
 * 浏览器半 bundle。
 *
 * `external` 是 baseline 隐式外部依赖（React / Cordis / client-store /
 * ui-primitives / ui-slots 等）——由宿主模块表在运行期提供，不能打进 bundle。
 * 显式列出来，越界 import 会在打包期暴露。
 */
const BASELINE = [
  'react',
  'react/jsx-runtime',
  'react-dom',
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

export default {
  entry: ['src/client/index.ts'],
  outDir: '.work',
  clean: false,
  format: ['cjs'],
  target: 'chrome120',
  platform: 'browser',
  external: BASELINE,
  // 只产 JS；CSS 由 cssModulesInline 变成 JS 模块，不单独出文件
  css: false,
  plugins: [cssModulesInline()],
  outputOptions: {
    entryFileNames: 'client.cjs',
  },
  dts: false,
  sourcemap: false,
  logLevel: 'warn',
}

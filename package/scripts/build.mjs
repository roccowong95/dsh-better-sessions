/**
 * 构建脚本。
 *
 * 产物契约（对齐原生 `dsh-better-sidebar` 的 lib/）：
 *   lib/index.js   host 半，ESM，只导出 apply（+ Config）
 *   lib/client.js  浏览器半，`window.__ModuleLoader__.load({id, factory})` 包裹的 CJS bundle
 *   lib/types/  （全部 .d.ts）
 *
 * 为什么需要 wrap：宿主只服务 `/plugins/??<id>/client.js,...&rev=` 这个 combo，
 * 它期望的文件内容就是 loader 调用。tsdown/rolldown 产出的是普通 CJS bundle，
 * 所以这里包一层。原生由仓库内的 `clientBundle()` 做，那个 helper 不随 npm 包发布。
 */

import { execSync } from 'node:child_process'
import { rmSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const PACKAGE_NAME = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).name
const WORK = join(root, '.work')

const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' })

rmSync(join(root, 'lib'), { recursive: true, force: true })
rmSync(WORK, { recursive: true, force: true })
mkdirSync(WORK, { recursive: true })

/* 1. client bundle：CJS + 模块表外部依赖 */
run('node scripts/bundle-client.mjs')

const bundled = readFileSync(join(WORK, 'client.cjs'), 'utf8')

/* 2. 包成 loader 格式（逐字对齐原生产物） */
const wrapped = [
  'window.__ModuleLoader__.load({',
  `\tid: ${JSON.stringify(PACKAGE_NAME)},`,
  '\tfactory: (require) => {',
  '\t\tvar module = { exports: {} };',
  '\t\tvar exports = module.exports;',
  bundled.split('\n').map((l) => (l ? `\t\t${l}` : '')).join('\n'),
  '\t\treturn module.exports;',
  '\t}',
  '});',
  '',
].join('\n')

mkdirSync(join(root, 'lib'), { recursive: true })
writeFileSync(join(root, 'lib', 'client.js'), wrapped)

/* 3. host 半（ESM JS）+ 类型（.d.ts）：分两次 tsc */
run('npx tsc -p tsconfig.host.json')
run('npx tsc -p tsconfig.build.json')

/* 4. 自检：产物必须真的导出 apply/inject */
const check = readFileSync(join(root, 'lib', 'client.js'), 'utf8')
for (const needle of ['window.__ModuleLoader__.load(', `id: "${PACKAGE_NAME}"`, 'return module.exports']) {
  if (!check.includes(needle)) throw new Error(`产物缺少 ${needle}`)
}
if (!existsSync(join(root, 'lib', 'index.js'))) throw new Error('缺少 lib/index.js')

console.log(`[build] 完成：lib/client.js ${wrapped.split('\n').length} 行`)

/**
 * Client 半入口。
 *
 * 只导出 cordis 加载所需（`apply` / `inject`）+ 类型 + store 工厂，
 * 这是 `/client` 出口的导出纪律。
 */

import type { Context } from '@deepseek-ai/cordis'
/* 下面两个 import 只为把 `declare module '@deepseek-ai/cordis' { interface Context }`
 * 的增强带进本程序（ctx.locale / ctx.uiWorkspace 的来源）。 */
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-api-workspace-controller/client'
import { createGroupsStore } from './stores'
import { NS, zh as zhDict, en as enDict } from './locales'
import { Browser, type BrowserInjected } from './components/Browser'

export { createGroupsStore } from './stores'
export type { GroupsState, SessionGroup, GroupColor } from './stores'

/** 供 `<style data-plugin-css>` 用的包名（HMR 按稳定 tag id 先删后注）。 */
const PACKAGE_NAME = '@local/dsh-better-sessions'

/** 构建期由 `define` 注入的 CSS 文本（见 scripts/bundle-client.mjs）。 */
const CSS_TEXT = '__DBS_CSS_TEXT__'

/** Required services（cordis fiber inject）。 */
export const inject = ['slots', 'sessions', 'workspaces', 'locale', 'uiWorkspace']

export function apply(ctx: Context): void {
  const groupsStore = createGroupsStore()

  /* ① i18n 字典 */
  ctx.effect(() => ctx.locale.register(NS, {
    zh: zhDict,
    en: enDict,
  }), 'better-sessions: dictionaries')

  /* ② 样式：物化时建 <style data-plugin>，随 effect 卸载移除 */
  ctx.effect(() => {
    const el = document.createElement('style')
    el.setAttribute('data-plugin', PACKAGE_NAME)
    el.setAttribute('data-plugin-css', `${PACKAGE_NAME}/browser.module.css`)
    el.textContent = CSS_TEXT
    document.head.appendChild(el)
    return () => { el.remove() }
  }, 'better-sessions: styles')

  /* ③ inject 工厂：只返普通数据 + 回调，响应式事实走框架 hook */
  const injected = (): BrowserInjected => ({
    services: [
      `uiWorkspace=${typeof ctx.uiWorkspace}`,
      `pickDirectory=${typeof ctx.uiWorkspace?.pickDirectory}`,
      `sessions=${typeof ctx.sessions}`,
      `workspaces=${typeof ctx.workspaces}`,
    ].join(' '),
    open: (id) => ctx.uiWorkspace.openSession(id),
    fork: (id) => { void ctx.uiWorkspace.forkSession(id).catch(failed('fork')) },
    rename: (id, title) => {
      const next = window.prompt(zhDict['prompt.renameSession'], title)
      if (next == null) return
      const b = ctx.sessions.binding(id)
      if (b) void b.session.rename(next).catch(failed('rename'))
    },
    archive: (id) => { void ctx.uiWorkspace.archiveSession(id).catch(failed('archive')) },
    unarchive: (id) => { void ctx.uiWorkspace.unarchiveSession(id).catch(failed('unarchive')) },
    pin: (id) => { void ctx.uiWorkspace.pinSession(id).catch(failed('pin')) },
    unpin: (id) => { void ctx.uiWorkspace.unpinSession(id).catch(failed('unpin')) },
    createProject: () => {
      void (async () => {
        const path = await ctx.uiWorkspace.pickDirectory()
        if (!path) return
        // IWorkspaces.create 直接返回 WorkspaceView，失败走 reject
        await ctx.workspaces.create({ path })
      })().catch(failed('createProject'))
    },
  })

  /* ④ 影子替换：负 priority 低于 shipped 的 0，stable 胜出 */
  ctx.slots.inject('sidebar.workspaces', () => ctx.slots.register({
    name: 'sidebar.workspaces',
    priority: -1,
    store: groupsStore,
    inject: injected,
    locale: NS,
  }, Browser))
}

/* ── 内部工具 ─────────────────────────────────────────────────────── */

function failed(op: string) {
  return (e: unknown) => console.warn(`[better-sessions] ${op} failed`, e)
}

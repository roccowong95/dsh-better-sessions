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
import { createSessionDialogs } from './session-dialog'
import { nextAfterParent } from './fork-position'

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

  const dialogs = createSessionDialogs()
  ctx.effect(() => () => dialogs.dispose(), 'better-sessions: session dialogs')
  const t = ctx.locale.bind(NS)
  const common = ctx.locale.bind('common')
  let disposed = false
  let notice: HTMLElement | undefined
  ctx.effect(() => () => {
    disposed = true
    notice?.remove()
    notice = undefined
  }, 'better-sessions: error notice')
  const failed = (op: string) => (cause: unknown) => {
    if (disposed) return
    console.warn(`[better-sessions] ${op} failed`, cause)
    notice?.remove()
    const element = document.createElement('div')
    element.setAttribute('role', 'alert')
    element.style.cssText = 'position:fixed;bottom:24px;left:24px;z-index:10000;max-width:min(32rem,85vw);padding:12px;border-radius:8px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1)'
    const message = document.createElement('span')
    message.textContent = `${op}: ${cause instanceof Error ? cause.message : String(cause)}`
    const dismiss = document.createElement('button')
    dismiss.type = 'button'
    dismiss.textContent = common('close')
    dismiss.style.marginInlineStart = '12px'
    dismiss.addEventListener('click', () => { element.remove(); if (notice === element) notice = undefined })
    element.append(message, dismiss)
    document.body.appendChild(element)
    notice = element
  }

  /* ③ inject 工厂：只返普通数据 + 回调，响应式事实走框架 hook */
  const injected = (): BrowserInjected => ({
    services: [
      `uiWorkspace=${typeof ctx.uiWorkspace}`,
      `pickDirectory=${typeof ctx.uiWorkspace?.pickDirectory}`,
      `sessions=${typeof ctx.sessions}`,
      `workspaces=${typeof ctx.workspaces}`,
    ].join(' '),
    open: (id) => ctx.uiWorkspace.openSession(id),
    fork: (id) => {
      void (async () => {
        const child = await ctx.uiWorkspace.forkSession(id)
        if (disposed) return
        const workspace = ctx.workspaces.list.getSnapshot().items.find((item) => item.sessionIds.includes(id))
        if (workspace) {
          const next = nextAfterParent(workspace.sessionIds, id, child)
          await ctx.workspaces.insertSessionBefore(workspace.workspaceId, child, next)
        }
      })().catch(failed('fork'))
    },
    rename: (id, title) => {
      dialogs.open({
        title: t('prompt.renameSession'),
        initialValue: title,
        cancelLabel: common('cancel'),
        saveLabel: common('save'),
        submit: (next, signal) => ctx.sessions.using(id, { source: 'workspaceOperation', signal }, async (reference) => {
          await reference.ready
          if (signal.aborted) return
          const result = await reference.binding.session.rename(next)
          if (!result.ok) throw new Error(result.error.message)
        }),
      })
    },
    archive: (id) => {
      const list = ctx.sessions.list.getSnapshot()
      // Only catalog members have authoritative Host running state.
      if (list.ids.includes(id) && list.byId[id]?.running) {
        dialogs.open({
          title: t('menu.archive'),
          message: t('arch.runningConfirm'),
          cancelLabel: common('cancel'),
          saveLabel: t('menu.archive'),
          submit: async (_value, signal) => {
            if (!signal.aborted) await ctx.uiWorkspace.archiveSession(id, { stopActivity: true })
          },
        })
        return
      }
      void ctx.uiWorkspace.archiveSession(id).catch(failed('archive'))
    },
    unarchive: (id) => { void ctx.uiWorkspace.unarchiveSession(id).catch(failed('unarchive')) },
    pin: (id) => { void ctx.uiWorkspace.pinSession(id).catch(failed('pin')) },
    unpin: (id) => { void ctx.uiWorkspace.unpinSession(id).catch(failed('unpin')) },
    createProject: () => {
      void (async () => {
        const path = await ctx.uiWorkspace.pickDirectory()
        if (disposed || !path) return
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

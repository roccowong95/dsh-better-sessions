/**
 * dsh-better-sessions — 阶段 1→2 原型（在 web profile 中持续演进）
 *
 * 已验证的机制（见 REQUIREMENTS.md §11.1）：
 *   ① priority: -1 影子注册 sidebar.workspaces 整块替换原生 browser ✅
 *   ② useSessions / useWorkspaces / ctx.uiWorkspace 可达 ✅
 *   ③ owner props { wide, expandSidebar } 到达 ✅
 *   ④ ctx.locale.register + t 可用 ✅
 *   ⑤ 影子占用者无法 renderSlot shipped 子 slot（renderer L331 + ui-slots L191）✅
 *   ⑥ ctx.uiWorkspace 的 pin/unpin/archive/unarchive 全生效 ✅
 *
 * 已知原型期妥协（阶段 2 修）：
 *   - 单文件 client 半：require 是模块表 require，不能拆多文件互相 import
 *   - 色板只有 7 个语义令牌可复用（无专用分组色令牌）
 *   - 共享图标未用 ui-primitives：折叠用内联 SVG chevron，行菜单仍是 ··· 文本
 *   - localStorage 持久化（阶段 2 换 defineStore + settings scope）
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-better-sessions',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useRef } = React;

    const NS = 'better-sessions';
    const TAB_KEY = 'dsh-better-sessions:tab';
    const GROUPS_KEY = 'dsh-better-sessions:groups';
    const UNGROUPED_KEY = '';

    const zh = {
      'tab.projects': '项目',
      'tab.groups': '分组',
      'tab.flat': '平铺',
      'group.ungrouped': '未分组',
      'group.new': '新建分组',
      'group.rename': '重命名分组',
      'group.color': '换个颜色',
      'group.dissolve': '解散分组',
      'group.dissolveConfirm': '解散「{name}」？其中的会话会回到「未分组」。',
      'group.defaultName': '新分组',
      'action.newProject': '新建项目',
      'move.toGroup': '移动到分组',
      'move.out': '移出分组',
      'menu.rename': '重命名',
      'menu.fork': 'Fork',
      'menu.archive': '归档',
      'menu.unarchive': '取消归档',
      'menu.pin': '置顶',
      'menu.unpin': '取消置顶',
      'menu.more': '更多操作',
      'row.newSession': '新会话',
      'diag.title': '诊断信息',
      'arch.label': '显示已归档会话',
      'arch.hide': '隐藏已归档会话',
    };
    const en = {
      'tab.projects': 'Projects',
      'tab.groups': 'Groups',
      'tab.flat': 'Flat',
      'group.ungrouped': 'Ungrouped',
      'group.new': 'New group',
      'group.rename': 'Rename group',
      'group.color': 'Next color',
      'group.dissolve': 'Dissolve group',
      'group.dissolveConfirm': 'Dissolve “{name}”? Its sessions return to “Ungrouped”.',
      'group.defaultName': 'New group',
      'action.newProject': 'New project',
      'move.toGroup': 'Move to group',
      'move.out': 'Remove from group',
      'menu.rename': 'Rename',
      'menu.fork': 'Fork',
      'menu.archive': 'Archive',
      'menu.unarchive': 'Unarchive',
      'menu.pin': 'Pin',
      'menu.unpin': 'Unpin',
      'menu.more': 'More actions',
      'row.newSession': 'New Session',
      'diag.title': 'Diagnostics',
      'arch.label': 'Show archived sessions',
      'arch.hide': 'Hide archived sessions',
    };

    /* ── 样式：只用 --dsw-* 语义令牌（阴影用 border 令牌做 ring，不写字面色） ─ */
    const CSS = `
.dbs-root{position:relative;display:flex;flex-direction:column;height:100%;min-height:0;
  background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:13px}
/* Tab 行：左侧三个 Tab，右侧两个图标操作（同一行，省一行高度） */
.dbs-tabs{display:flex;align-items:center;gap:2px;padding:6px 6px 0;
  border-bottom:1px solid var(--dsw-alias-border-l1)}
.dbs-tab{appearance:none;border:0;background:transparent;cursor:pointer;font-size:14px;
  font-weight:500;color:var(--dsw-alias-label-secondary);padding:6px 10px;border-radius:6px 6px 0 0}
.dbs-tab:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dbs-tab[aria-selected="true"]{color:var(--dsw-alias-label-primary);font-weight:600;
  background:var(--dsw-alias-bg-layer-1);box-shadow:inset 0 -2px 0 var(--dsw-alias-brand-primary)}
.dbs-tab-spacer{flex:1;min-width:0}
/* 图标按钮：统一热区 + hover ring，供 Tab 行与浮动按钮复用 */
.dbs-icon-btn{appearance:none;border:0;background:transparent;cursor:pointer;display:flex;
  align-items:center;justify-content:center;width:26px;height:26px;border-radius:6px;
  color:var(--dsw-alias-label-secondary);flex:none;padding:0}
.dbs-icon-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dbs-icon-btn:active{background:var(--dsw-alias-interactive-bg-active)}
.dbs-icon-btn[aria-pressed="true"]{color:var(--dsw-alias-brand-primary)}
.dbs-body{flex:1;min-height:0;overflow:auto;padding:4px 4px 34px;scrollbar-gutter:stable}
.dbs-group{margin:2px 0 8px}
/* 段头：13px/500，与 session 同号但更重 + 大写，不再比 session 小 */
.dbs-head{display:flex;align-items:center;gap:4px;padding:2px 4px 4px;
  border-bottom:1px solid var(--dsw-alias-border-l1)}
.dbs-head-toggle{appearance:none;border:0;background:transparent;cursor:pointer;display:flex;
  align-items:center;gap:6px;flex:1;min-width:0;padding:3px 4px;border-radius:5px;
  font:inherit;color:inherit;text-align:left}
.dbs-head-toggle:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dbs-head-label{font-size:13px;font-weight:500;text-transform:uppercase;letter-spacing:.03em;
  color:var(--dsw-alias-label-secondary);min-width:0;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap}
.dbs-head[data-contains-current="true"] .dbs-head-label{color:var(--dsw-alias-state-business-primary)}
.dbs-head-count{flex:none;font-size:12px;color:var(--dsw-alias-label-secondary);opacity:.8}
.dbs-fold{appearance:none;border:0;background:transparent;cursor:pointer;color:inherit;
  padding:2px;margin:-2px;line-height:0;flex:none;border-radius:4px;display:flex;
  align-items:center;justify-content:center}
.dbs-swatch{width:10px;height:10px;border-radius:3px;flex:none}
.dbs-row{display:flex;align-items:center;gap:4px;width:100%;text-align:left;font-size:13px;
  appearance:none;border:0;background:transparent;cursor:pointer;padding:0 4px 0 8px;
  height:32px;border-radius:8px;color:var(--dsw-alias-label-primary)}
/* hover / 当前 / 按下 三级，全部走官方 interactive 令牌（浅深两色都有色差） */
.dbs-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dbs-row:active{background:var(--dsw-alias-interactive-bg-active)}
.dbs-row[data-current="true"]{background:var(--dsw-alias-interactive-bg-hover-solid);
  box-shadow:inset 2px 0 0 var(--dsw-alias-brand-primary)}
.dbs-row[data-current="true"]:hover{background:var(--dsw-alias-interactive-bg-hover-accent)}
/* 归档行走 caption 色（对齐原生），不再用 opacity+删除线 */
.dbs-row[data-archived="true"] .dbs-title{color:var(--dsw-alias-label-caption)}
.dbs-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dbs-open{appearance:none;border:0;background:transparent;cursor:pointer;color:inherit;font:inherit;
  text-align:left;padding:2px 0;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap;border-radius:4px}
.dbs-open:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.dbs-dot{width:6px;height:6px;border-radius:50%;flex:none}
.dbs-dot[data-kind="running"]{background:var(--dsw-alias-state-warn-primary)}
.dbs-dot[data-kind="done"]{background:var(--dsw-alias-state-success-primary)}
.dbs-pin{display:flex;align-items:center;flex:none;color:var(--dsw-alias-brand-primary)}
.dbs-menu-wrap{position:relative;flex:none;display:flex;align-items:center}
/* 汉堡按钮：26x26 矩形热区，hover 才浮现并给 ring */
.dbs-menu-btn{appearance:none;border:0;background:transparent;cursor:pointer;display:flex;
  align-items:center;justify-content:center;width:26px;height:26px;border-radius:6px;
  color:var(--dsw-alias-label-secondary);padding:0;flex:none;
  opacity:0;transition:opacity .12s ease}
.dbs-row:hover .dbs-menu-btn,.dbs-row:focus-within .dbs-menu-btn,
.dbs-menu-btn:focus-visible,.dbs-menu-btn[aria-expanded="true"]{opacity:1}
.dbs-row:hover .dbs-menu-btn{background:transparent}
.dbs-menu-btn:hover{background:var(--dsw-alias-interactive-bg-hover);
  color:var(--dsw-alias-label-primary)}
.dbs-head .dbs-menu-btn{opacity:1}
.dbs-menu{position:absolute;right:0;top:26px;z-index:20;min-width:168px;padding:4px;
  display:flex;flex-direction:column;gap:1px;border-radius:8px;
  background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);
  box-shadow:0 8px 24px rgba(0,0,0,.18)}
.dbs-menu-item{appearance:none;border:0;background:transparent;cursor:pointer;text-align:left;
  font-size:13px;color:var(--dsw-alias-label-primary);padding:6px 8px;border-radius:5px;
  display:flex;align-items:center;gap:8px}
.dbs-menu-item:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dbs-menu-item svg{flex:none;opacity:.8}
.dbs-menu-sep{height:1px;margin:3px 2px;background:var(--dsw-alias-border-l1)}
.dbs-menu-label{font-size:10px;letter-spacing:.04em;text-transform:uppercase;
  color:var(--dsw-alias-label-secondary);padding:4px 8px 2px}
.dbs-empty{padding:16px 10px;color:var(--dsw-alias-label-secondary);font-size:13px}
.dbs-diag{margin:8px 8px 0;padding:6px 8px;border:1px dashed var(--dsw-alias-border-l2);
  border-radius:6px;font-size:11px;line-height:1.6;white-space:pre-wrap;
  color:var(--dsw-alias-label-secondary)}
/* 诊断：整个区域右下角浮动小按钮，不占布局 */
.dbs-fab{position:absolute;right:8px;bottom:8px;z-index:15;width:30px;height:30px;
  border-radius:8px;background:var(--dsw-alias-bg-overlay);
  border:1px solid var(--dsw-alias-border-l1)}
.dbs-fab:hover{border-color:var(--dsw-alias-border-l2)}
.dbs-fab[aria-pressed="true"]{color:var(--dsw-alias-brand-primary)}
`;

    /* ── 图标：优先 ui-primitives 官方图标（color rides currentColor） ──── */
    const Prim = (() => {
      try { return require('@deepseek-ai/dsh-client-ui-primitives'); }
      catch (e) { console.warn('[better-sessions] ui-primitives 不可用，退回文本字符', e); return null; }
    })();
    /** 渲染一个官方图标；取不到时退回一个文本字符，绝不白屏。 */
    function Ico(name, size, fallback) {
      const C = Prim && Prim[name];
      if (typeof C === 'function') return h(C, { size });
      return fallback == null ? null : h('span', { 'aria-hidden': true }, fallback);
    }
    const I = {
      foldDown: (s) => Ico('IconChevronDownOutlineMedium', s, '\u25be'),
      foldRight: (s) => Ico('IconChevronRightOutlineMedium', s, '\u25b8'),
      more: (s) => Ico('IconEllipsisOutlineMedium', s, '\u00b7\u00b7\u00b7'),
      plus: (s) => Ico('IconPlusOutlineMedium', s, '+'),
      archive: (s) => Ico('IconArchiveOutlineMedium', s, '\u2338'),
      unarchive: (s) => Ico('IconUnarchiveOutlineMedium', s, '\u2339'),
      pin: (s) => Ico('IconPinFillMedium', s, '\u25a0'),
      unpin: (s) => Ico('IconPinOutlineMedium', s, '\u25a1'),
      gear: (s) => Ico('IconSettingsOutlineMedium', s, '\u2699'),
      edit: (s) => Ico('IconEditOutlineMedium', s, '\u270e'),
      branch: (s) => Ico('IconBranchOutlineMedium', s, '\u2442'),
    };

    /* ── 原型期极简持久化 ───────────────────────────────────────────── */
    function readTab() {
      try { return localStorage.getItem(TAB_KEY) || 'projects'; } catch { return 'projects'; }
    }
    function writeTab(v) { try { localStorage.setItem(TAB_KEY, v); } catch { /* ignore */ } }

    function basename(p) {
      if (!p) return '';
      const parts = String(p).split(/[\\/]/).filter(Boolean);
      return parts.length ? parts[parts.length - 1] : String(p);
    }

    /* @@ORDER-BEGIN@@ */
/**
 * 侧边栏「自定义分组」的排序纯函数。
 *
 * 设计前提（见 REQUIREMENTS.md §5.1）：我们跟随 DSH 原生的选择——手动序在内存里
 * **始终维护有序数组**，持久化时整份提交（`Record<string, string[]>`）。
 * 因此本模块没有任何 sort_order 算术、没有步长、没有 MIN-STEP。
 *
 * 语义规格来自 DSH 原生 `dsh-client-ui-workspace/lib/types/client/tree.d.ts`
 * 的 JSDoc（运行时不可 import，JSDoc 即权威规格），加上我们自己的排序规则。
 *
 * 本文件是**纯函数**：不读全局状态、不抛异常、不修改入参、不 import 任何东西。
 */

/**
 * @typedef {string} SessionId
 *
 * @typedef {Object} SessionSummary
 * @property {string} id
 * @property {string} displayTitle
 * @property {boolean} running
 * @property {boolean} blank
 * @property {boolean} [completed]
 * @property {number} updatedAt
 * @property {string} [cwd]
 * @property {string} [parentId]   指向来源会话（fork source）
 *
 * @typedef {Record<SessionId, SessionSummary>} SessionMap
 *
 * @typedef {Object} RowStateLike
 * @property {readonly string[]} [pinnedSessionIds]
 * @property {readonly string[]} [archivedSessionIds]
 */

/** 把 "Set 或数组或 undefined" 归一化成 Set。 */
function toSet(value) {
  if (value instanceof Set) return new Set(value)
  if (Array.isArray(value)) return new Set(value)
  return new Set()
}

/** 取 updatedAt，缺失/非有限值按 0 处理，保证比较永不 NaN。 */
function recencyOf(summary) {
  const t = summary && summary.updatedAt
  return typeof t === 'number' && Number.isFinite(t) ? t : 0
}

/**
 * 纯 recency 比较器：`updatedAt` 降序（新→旧）。不做任何兜底。
 *
 * @param {SessionMap} byId
 * @param {SessionId} a
 * @param {SessionId} b
 * @returns {number}
 */
function compareRecency(byId, a, b) {
  return recencyOf(byId[b]) - recencyOf(byId[a])
}

/** Session id 字典序兜底，保证排序结果是全序（与输入顺序无关）。 */
function compareId(a, b) {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

/**
 * recency 优先、id 字典序兜底的组合比较器。
 * 用于没有其他显式排序标准的场景（`orderByRecency` / `visibleOrder`）。
 *
 * @param {SessionMap} byId
 * @param {SessionId} a
 * @param {SessionId} b
 * @returns {number}
 */
function compareRecencyThenId(byId, a, b) {
  const byRecency = compareRecency(byId, a, b)
  if (byRecency !== 0) return byRecency
  return compareId(a, b)
}

/**
 * 把 `movedId` 移到 `beforeId` 之前。
 *
 * 语义：
 * - `beforeId` 为 `undefined` / `null` → 移到**末尾**。
 * - `movedId` 不在 `ids` 中 → 原样返回副本（不抛错）。
 * - `beforeId` 不在 `ids` 中 → 移到**末尾**。
 * - `beforeId === movedId`：先移除再定位，移除后 `beforeId` 自然「不存在」，
 *   落入上一条 → 移到末尾。（规格含糊处，选择理由见 order.test.js 同名用例。）
 *
 * @param {readonly string[]} ids
 * @param {string} movedId
 * @param {string | undefined | null} [beforeId]
 * @returns {string[]} 新数组；入参永不被修改。
 */
function moveBefore(ids, movedId, beforeId) {
  const next = Array.isArray(ids) ? ids.slice() : []
  const from = next.indexOf(movedId)
  if (from === -1) return next

  next.splice(from, 1)

  if (beforeId === undefined || beforeId === null) {
    next.push(movedId)
    return next
  }

  const to = next.indexOf(beforeId)
  if (to === -1) {
    // beforeId 不存在（含 beforeId === movedId 的情形）→ 末尾
    next.push(movedId)
    return next
  }

  next.splice(to, 0, movedId)
  return next
}

/**
 * 按更新时间倒序投影（对齐原生 `orderByRecency`）。
 *
 * - 新→旧：`updatedAt` 降序。
 * - `updatedAt` 相等时以 Session id 字典序作**确定性 tie-break**。
 * - **没有 summary 的成员（`byId[id]` 为 undefined）暂时省略**，等它的 summary 到达。
 *
 * @param {readonly SessionId[]} ids
 * @param {SessionMap} byId
 * @returns {SessionId[]} 新数组。
 */
function orderByRecency(ids, byId) {
  const map = byId || {}
  const source = Array.isArray(ids) ? ids : []
  /** @type {SessionId[]} */
  const out = []
  for (const id of source) {
    if (!map[id]) continue // 无 summary → 暂时省略
    out.push(id)
  }
  out.sort((a, b) => compareRecencyThenId(map, a, b))
  return out
}

/** `id` 的 fork 来源是否在 `inOrder` 集合里。 */
function forkSourceInOrder(byId, id, inOrder) {
  const parent = byId[id] && byId[id].parentId
  return !!(parent && inOrder.has(parent))
}

/**
 * 「缺失成员」的排序比较器，对应原生 JSDoc 的
 * "missing members ordered by pin, fork source, recency, and archive status"：
 *
 *   1. pin（`pinnedSessionIds`）优先；
 *   2. fork 来源是否已在序里；
 *   3. recency（`updatedAt` 降序）；
 *   4. 归档状态（未归档优先）；
 *   5. id 字典序兜底（保证确定性）。
 *
 * @param {SessionMap} byId
 * @param {Set<SessionId>} pinned
 * @param {Set<SessionId>} archived
 * @param {Set<SessionId>} inOrder
 * @param {SessionId} a
 * @param {SessionId} b
 * @returns {number}
 */
function compareMissingMembers(byId, pinned, archived, inOrder, a, b) {
  const pa = pinned.has(a) ? 0 : 1
  const pb = pinned.has(b) ? 0 : 1
  if (pa !== pb) return pa - pb

  const fa = forkSourceInOrder(byId, a, inOrder) ? 0 : 1
  const fb = forkSourceInOrder(byId, b, inOrder) ? 0 : 1
  if (fa !== fb) return fa - fb

  const byRecency = compareRecency(byId, a, b)
  if (byRecency !== 0) return byRecency

  const aa = archived.has(a) ? 1 : 0
  const ab = archived.has(b) ? 1 : 0
  if (aa !== ab) return aa - ab

  return compareId(a, b)
}

/**
 * 把手动保存的序 reconcile 到当前成员集合（对齐原生 `reconcileManualOrder`）。
 *
 * 原生 JSDoc 原文：
 *   "New ordinary forks precede their sources without changing saved entries'
 *    relative order."
 *   "@returns saved relative positions plus missing members ordered by pin, fork
 *    source, recency, and archive status."
 *
 * 两句不矛盾。每个成员只有三种命运：
 *
 *   **(a) 已在 `savedOrder` 里** → 留在原位，彼此相对顺序不变。
 *       `savedOrder` 里已不存在的 id 被丢弃。此类**不要求有 summary**
 *       （`savedOrder` 是本地持久化的事实源，summary 迟到不该把条目挤出去）。
 *
 *   **(b) 新 fork**（`summary.parentId` 指向某会话）→ **立即插到其来源之前**，
 *       插在序列**内部**，不是追加到末尾。这正是 "precede their sources"：
 *       fork 出的子会话紧贴在父会话上方，看得见血缘。插入不改变已存条目的相对顺序，
 *       因为 fork 是新成员、不是已存条目。
 *
 *   **(c) 其余缺失成员**（没有 `parentId`，或来源最终不在序列里）→ 追加在末尾，
 *       按 `compareMissingMembers` 的优先级排。没有 summary 的成员**暂不出现**。
 *
 * 边界行为（规格未明说，此处选定，理由见 order.test.js 同名用例）：
 * - **「来源在不在序列里」可预先判定**：所有「已在 savedOrder 里」或「有 summary」的成员
 *   最终都会落位（分别走 (a)(b)(c)），所以先建 `inOrder` 集合即可判定，不必等序列建完，
 *   也就没有循环依赖。
 * - **来源本身也是新成员**：先把 (c) 按优先级排好追加，再让 (b) 插到来源前面——此时来源已落位。
 * - **多个新 fork 同一来源**：块内按 recency 降序，最旧的那个最贴来源，与全模块「新→旧」一致。
 * - **链式 fork（A→B→C 全是新的）**：按依赖拓扑逐个插入，结果确定（C 贴 B、B 贴 A）。
 * - **parentId 成环**（真实数据不会，脏数据可能）：环上成员退化成 (c) 追加到末尾，不抛错、不死循环。
 * - **pinned 的 fork 仍按 (b) 处理**，pin 不抢插位。
 *
 * `rowState` 可选，缺省视为 `{ pinnedSessionIds: [], archivedSessionIds: [] }`。
 *
 * @param {readonly SessionId[]} memberIds 当前成员集合
 * @param {readonly SessionId[] | undefined | null} savedOrder 手动保存的序
 * @param {SessionMap} byId
 * @param {RowStateLike} [rowState]
 * @returns {SessionId[]} 新数组。
 */
function reconcileManualOrder(memberIds, savedOrder, byId, rowState) {
  const map = byId || {}
  const members = Array.isArray(memberIds) ? memberIds : []
  const saved = Array.isArray(savedOrder) ? savedOrder : []
  const pinned = toSet(rowState && rowState.pinnedSessionIds)
  const archived = toSet(rowState && rowState.archivedSessionIds)

  const memberSet = new Set(members)

  // ---- (a) 已保存条目：相对位置不变，丢弃已不存在的 id ----
  /** @type {SessionId[]} */
  const base = []
  /** @type {Set<SessionId>} */
  const savedPlaced = new Set()
  for (const id of saved) {
    if (!memberSet.has(id)) continue // 已被删除 / 不再属于本组
    if (savedPlaced.has(id)) continue // savedOrder 自身去重
    savedPlaced.add(id)
    base.push(id)
  }

  // ---- 哪些成员最终会出现在序列里 ----
  // (a) 留原位；(b) 插到来源前；(c) 追加到尾，三者都会落位。
  // 所以「来源在不在序列里」= 「来源是成员 ∧ (在 savedOrder 里 ∨ 有 summary)」。
  /** @type {Set<SessionId>} */
  const inOrder = new Set(base)
  for (const id of members) {
    if (map[id]) inOrder.add(id)
  }

  // ---- 新成员分成 (b) fork 与 (c) plain ----
  /** @type {Map<SessionId, SessionId>} fork 成员 → 其来源 */
  const forkSource = new Map()
  /** @type {SessionId[]} */
  const plain = []
  for (const id of members) {
    if (savedPlaced.has(id)) continue // 已是 (a)
    if (!map[id]) continue // 无 summary → 暂不出现
    const parent = map[id].parentId
    if (parent && inOrder.has(parent)) {
      forkSource.set(id, parent)
    } else {
      plain.push(id)
    }
  }

  // ---- 环检测：parentId 成环时退化成 (c) ----
  /** @type {Set<SessionId>} */
  const demoted = new Set()
  /** @type {Map<SessionId, 'visiting' | 'done'>} */
  const visitState = new Map()
  const resolvable = (id) => {
    const st = visitState.get(id)
    if (st === 'done') return !demoted.has(id)
    if (st === 'visiting') return false // 撞到环
    visitState.set(id, 'visiting')
    let ok = true
    const src = forkSource.get(id)
    if (src !== undefined && forkSource.has(src)) ok = resolvable(src)
    visitState.set(id, 'done')
    if (!ok) demoted.add(id)
    return ok
  }
  for (const id of forkSource.keys()) resolvable(id)

  // ---- (c) 追加在末尾，按优先级排 ----
  /** @type {SessionId[]} */
  const tail = plain.slice()
  for (const id of forkSource.keys()) {
    if (demoted.has(id)) tail.push(id)
  }
  tail.sort((a, b) => compareMissingMembers(map, pinned, archived, inOrder, a, b))

  const seq = base.concat(tail)

  // ---- (b) 新 fork：插到其来源之前 ----
  // Kahn 式：只有「来源已落位」的 fork 可放置；候选之间按缺失成员比较器取最优，
  // 于是同来源的多个 fork 块内是 recency 降序（最旧的那个最贴来源）。
  /** @type {Set<SessionId>} */
  const pending = new Set()
  for (const id of forkSource.keys()) {
    if (!demoted.has(id)) pending.add(id)
  }
  while (pending.size > 0) {
    /** @type {SessionId | null} */
    let picked = null
    for (const id of pending) {
      if (seq.indexOf(forkSource.get(id)) === -1) continue // 来源还没落位
      if (picked === null || compareMissingMembers(map, pinned, archived, inOrder, id, picked) < 0) {
        picked = id
      }
    }
    if (picked === null) break // 理论上不会发生（环已提前剔除）；防御性退出
    seq.splice(seq.indexOf(forkSource.get(picked)), 0, picked)
    pending.delete(picked)
  }
  // 兜底：万一仍有剩余（仅防御），按同一比较器追加，保证确定且不丢成员
  if (pending.size > 0) {
    const leftover = Array.from(pending)
    leftover.sort((a, b) => compareMissingMembers(map, pinned, archived, inOrder, a, b))
    for (const id of leftover) seq.push(id)
  }

  return seq
}

/**
 * 把选中的 provisional New Session 置顶（对齐原生 `pinCurrentBlank`）。
 *
 * 原生 JSDoc：
 *   "Keep the selected provisional New Session ahead of either base order."
 *   "@param order - recency or reconciled manual order."
 *   "@param currentBlank - selected blank Session in this account, when present."
 *   "@returns a copy with the selected blank first and no duplicate slot."
 *
 * - `currentBlank` 为 `undefined` / `null` → 原样返回副本。
 * - **不占重复位**：原位置的那个副本被删掉，前面只留一份；即使入参里已重复出现也归一成一份。
 * - `currentBlank` **不在 `order` 里** → 原样返回副本，不做插入。
 *   理由：本函数只被赋予「重排」职责，且拿不到 `byId`、无法校验该 id 是否可渲染；
 *   擅自注入一个调用方没放进去的 id 会造出一行没有 summary 的行。是否让选中的 blank
 *   进序，由 `visibleOrder`（它已经用 `current` 放行选中的 blank）决定。
 *
 * @param {readonly SessionId[]} order
 * @param {SessionId | undefined | null} currentBlank
 * @returns {string[]} 新数组；入参永不被修改。
 */
function pinCurrentBlank(order, currentBlank) {
  const next = Array.isArray(order) ? order.slice() : []
  if (currentBlank === undefined || currentBlank === null) return next
  if (next.indexOf(currentBlank) === -1) return next

  const deduped = next.filter((id) => id !== currentBlank)
  deduped.unshift(currentBlank)
  return deduped
}

/**
 * 派生某个分组 / 账户的**最终可见行序**（渲染前最后一道）。
 *
 * 规则**按此顺序**应用：
 * 1. 丢弃没有 summary 的 id；
 * 2. 丢弃 blank 会话，**除非它就是 `current`**（"only the selected blank Session
 *    remains visible"）；
 * 3. 归档过滤（`filter` 三态）：
 *    - `'default'`：丢弃 `archived` 里的（默认隐藏归档）；
 *    - `'show'`：全部保留（归档行不参与特殊搬移，只按下面的通用排序落位、置灰）；
 *    - `'only'`：只保留 `archived` 里的；
 * 4. 排序：**pinned 领先**，其余按 `updatedAt` 降序，相等用 id 字典序兜底。
 *
 * `pinned` / `archived` 接受 `Set<SessionId>` 或数组（内部用 `new Set(x)` 归一化）。
 * `current` 是 `SessionId | undefined`。
 *
 * @param {readonly SessionId[]} ids
 * @param {SessionMap} byId
 * @param {SessionId | undefined} current
 * @param {Set<SessionId> | readonly SessionId[]} [pinned]
 * @param {Set<SessionId> | readonly SessionId[]} [archived]
 * @param {'default' | 'show' | 'only'} [filter]
 * @returns {SessionId[]} 新数组。
 */
function visibleOrder(ids, byId, current, pinned, archived, filter) {
  const map = byId || {}
  const pinnedSet = toSet(pinned)
  const archivedSet = toSet(archived)
  const mode = filter === 'show' || filter === 'only' ? filter : 'default'
  const source = Array.isArray(ids) ? ids : []

  const kept = source.filter((id) => {
    const summary = map[id]
    if (!summary) return false // 1) 无 summary
    if (summary.blank && id !== current) return false // 2) 只有选中的 blank 可见

    const isArchived = archivedSet.has(id)
    if (mode === 'default' && isArchived) return false // 3a) 默认隐藏归档
    if (mode === 'only' && !isArchived) return false // 3c) 只看归档
    return true // 3b) 'show' 全部保留
  })

  kept.sort((a, b) => {
    const pa = pinnedSet.has(a) ? 0 : 1
    const pb = pinnedSet.has(b) ? 0 : 1
    if (pa !== pb) return pa - pb
    return compareRecencyThenId(map, a, b)
  })

  return kept
}
/* @@ORDER-END@@ */

    /* ── 色板：只有 7 个语义令牌可复用（无专用分组色令牌） ─────────── */
    const COLORS = [
      'var(--dsw-alias-brand-primary)',
      'var(--dsw-alias-state-success-primary)',
      'var(--dsw-alias-state-warn-primary)',
      'var(--dsw-alias-state-error-primary)',
      'var(--dsw-alias-state-idle-primary)',
      'var(--dsw-alias-label-secondary)',
      'var(--dsw-alias-border-l2)',
    ];
    function nextColor(groups) {
      const used = new Set(groups.map(g => g.color));
      const free = COLORS.find(c => !used.has(c));
      return free || COLORS[groups.length % COLORS.length];
    }

    /* ── GroupsState：模块级单例 + 订阅（原型期；阶段 2 换 defineStore） ─ */
    const EMPTY_GROUPS = { groups: [], membership: {}, orderByGroup: {}, collapsed: {} };
    function loadGroups() {
      try {
        const raw = localStorage.getItem(GROUPS_KEY);
        if (!raw) return { ...EMPTY_GROUPS };
        const v = JSON.parse(raw);
        return {
          groups: Array.isArray(v.groups) ? v.groups.filter(g => g && typeof g.id === 'string') : [],
          membership: v.membership && typeof v.membership === 'object' ? v.membership : {},
          orderByGroup: v.orderByGroup && typeof v.orderByGroup === 'object' ? v.orderByGroup : {},
          collapsed: v.collapsed && typeof v.collapsed === 'object' ? v.collapsed : {},
        };
      } catch { return { ...EMPTY_GROUPS }; }
    }
    let groupsState = loadGroups();
    const groupListeners = new Set();
    function commitGroups(next) {
      groupsState = next;
      try { localStorage.setItem(GROUPS_KEY, JSON.stringify(groupsState)); } catch { /* ignore */ }
      groupListeners.forEach(fn => fn(groupsState));
    }
    function updateGroups(fn) { commitGroups(fn(groupsState)); }
    function useGroups() {
      const [v, setV] = useState(groupsState);
      useEffect(() => {
        groupListeners.add(setV);
        setV(groupsState);
        return () => { groupListeners.delete(setV); };
      }, []);
      return v;
    }

    /** membership 里的孤儿组 id（组已不存在）一律忽略。 */
    function liveGroupId(gs, sessionId) {
      const gid = gs.membership[sessionId];
      if (!gid) return undefined;
      return gs.groups.some(g => g.id === gid) ? gid : undefined;
    }

    function createGroup() {
      const id = 'g_' + Math.random().toString(36).slice(2, 10);
      updateGroups(s => ({
        ...s,
        groups: [...s.groups, { id, title: null, color: nextColor(s.groups), createdAt: Date.now() }],
      }));
      return id;
    }
    function renameGroup(id, title) {
      updateGroups(s => ({ ...s, groups: s.groups.map(g => (g.id === id ? { ...g, title } : g)) }));
    }
    function cycleGroupColor(id) {
      updateGroups(s => ({
        ...s,
        groups: s.groups.map(g => (g.id === id
          ? { ...g, color: COLORS[(COLORS.indexOf(g.color) + 1) % COLORS.length] }
          : g)),
      }));
    }
    function dissolveGroup(id) {
      updateGroups(s => {
        const membership = {};
        for (const [sid, gid] of Object.entries(s.membership)) if (gid !== id) membership[sid] = gid;
        const orderByGroup = {};
        for (const [k, arr] of Object.entries(s.orderByGroup)) if (k !== id) orderByGroup[k] = arr;
        const collapsed = {};
        for (const [k, val] of Object.entries(s.collapsed)) if (k !== id) collapsed[k] = val;
        return { ...s, groups: s.groups.filter(g => g.id !== id), membership, orderByGroup, collapsed };
      });
    }
    /** groupId 为 null/undefined 表示移出到未分组。 */
    function moveSessionTo(sessionId, groupId) {
      updateGroups(s => {
        const membership = { ...s.membership };
        if (groupId == null) delete membership[sessionId];
        else membership[sessionId] = groupId;
        const orderByGroup = {};
        for (const [k, arr] of Object.entries(s.orderByGroup)) orderByGroup[k] = arr.filter(x => x !== sessionId);
        const key = groupId == null ? UNGROUPED_KEY : groupId;
        orderByGroup[key] = [...(orderByGroup[key] || []), sessionId];
        return { ...s, membership, orderByGroup };
      });
    }
    function setSectionOrder(key, ids) {
      updateGroups(s => ({ ...s, orderByGroup: { ...s.orderByGroup, [key]: ids } }));
    }
    function toggleCollapsed(key) {
      updateGroups(s => ({ ...s, collapsed: { ...s.collapsed, [key]: !s.collapsed[key] } }));
    }

    /** 派生「分组」Tab 的各段：自定义组按 groups 数组序 + 末尾固定未分组段。 */
    function groupSections(gs, ids) {
      const members = new Map();
      for (const id of ids) {
        const gid = liveGroupId(gs, id);
        if (!gid) continue;
        if (!members.has(gid)) members.set(gid, []);
        members.get(gid).push(id);
      }
      const sections = gs.groups.map(g => ({ key: g.id, group: g, ids: members.get(g.id) || [] }));
      const ungrouped = ids.filter(id => !liveGroupId(gs, id));
      sections.push({ key: UNGROUPED_KEY, group: null, ids: ungrouped });
      return sections;
    }

    /** 段内序：委托给经过单测的纯函数（fork 插到来源之前，见 lib/order.js）。 */
    function sectionOrder(savedIds, memberIds, byId, pinned, archived) {
      return reconcileManualOrder(memberIds, savedIds, byId, {
        pinnedSessionIds: Array.from(pinned),
        archivedSessionIds: Array.from(archived),
      });
    }

    /* ── 分组段头 ───────────────────────────────────────────────────── */
    function GroupHeader(props) {
      const { section, label, count, collapsed, foldable, onToggle, actions, t, containsCurrent } = props;
      const [menuOpen, setMenuOpen] = useState(false);
      const wrapRef = useRef(null);
      const group = section.group;
      const title = label != null ? label : (group ? (group.title || t('group.defaultName')) : t('group.ungrouped'));

      useEffect(() => {
        if (!menuOpen) return;
        const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setMenuOpen(false); };
        const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
        document.addEventListener('mousedown', onDoc, true);
        document.addEventListener('keydown', onKey, true);
        return () => {
          document.removeEventListener('mousedown', onDoc, true);
          document.removeEventListener('keydown', onKey, true);
        };
      }, [menuOpen]);

      return h('div', { className: 'dbs-head', 'data-contains-current': String(!!containsCurrent) },
        /* 折叠箭头 + 色块 + 标题 + 计数 合成一个大连通区：点哪儿都能折叠 */
        h('button', {
          type: 'button', className: 'dbs-head-toggle',
          'aria-expanded': String(!collapsed),
          title: collapsed ? 'expand' : 'collapse',
          onClick: foldable ? onToggle : undefined,
          style: foldable ? undefined : { cursor: 'default' },
        },
          h('span', { className: 'dbs-fold' }, collapsed ? I.foldRight(12) : I.foldDown(12)),
          group ? h('span', { className: 'dbs-swatch', style: { background: group.color } }) : null,
          h('span', { className: 'dbs-head-label' }, title),
          h('span', { className: 'dbs-head-count' }, '· ', count)),
        group ? h('div', { className: 'dbs-menu-wrap', ref: wrapRef },
          h('button', {
            type: 'button', className: 'dbs-menu-btn', 'aria-label': t('menu.more'),
            'aria-expanded': String(menuOpen),
            onClick: (e) => { e.stopPropagation(); setMenuOpen(v => !v); },
          }, I.more(16)),
          menuOpen ? h('div', { className: 'dbs-menu', role: 'menu' },
            h('button', { type: 'button', role: 'menuitem', className: 'dbs-menu-item', onClick: () => { setMenuOpen(false); actions.renameGroup(group.id); } }, I.edit(14), t('group.rename')),
            h('button', { type: 'button', role: 'menuitem', className: 'dbs-menu-item', onClick: () => { setMenuOpen(false); actions.colorGroup(group.id); } }, I.unpin(14), t('group.color')),
            h('div', { className: 'dbs-menu-sep' }),
            h('button', { type: 'button', role: 'menuitem', className: 'dbs-menu-item', onClick: () => { setMenuOpen(false); actions.dissolveGroup(group.id); } }, I.archive(14), t('group.dissolve')),
          ) : null,
        ) : null,
      );
    }

    /* ── 一行会话 ───────────────────────────────────────────────────── */
    function SessionRow(props) {
      const { id, summary, current, pinned, archived, onOpen, actions, t, groups, groupId } = props;
      const [menuOpen, setMenuOpen] = useState(false);
      const wrapRef = useRef(null);

      useEffect(() => {
        if (!menuOpen) return;
        const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setMenuOpen(false); };
        const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
        document.addEventListener('mousedown', onDoc, true);
        document.addEventListener('keydown', onKey, true);
        return () => {
          document.removeEventListener('mousedown', onDoc, true);
          document.removeEventListener('keydown', onKey, true);
        };
      }, [menuOpen]);

      const isPinned = pinned.has(id);
      const isArchived = archived.has(id);
      const dotKind = summary.running ? 'running' : (summary.completed ? 'done' : null);
      const showMove = Array.isArray(groups);

      return h('div', {
        className: 'dbs-row', 'data-current': String(id === current), 'data-archived': String(isArchived),
      },
        dotKind ? h('span', { className: 'dbs-dot', 'data-kind': dotKind }) : null,
        isPinned ? h('span', { className: 'dbs-pin', title: 'pinned' }, I.pin(12)) : null,
        h('button', {
          type: 'button', className: 'dbs-open', title: summary.displayTitle,
          onClick: () => { if (!isArchived) onOpen(id); },
        }, summary.blank ? t('row.newSession') : summary.displayTitle),
        h('div', { className: 'dbs-menu-wrap', ref: wrapRef },
          h('button', {
            type: 'button', className: 'dbs-menu-btn', 'aria-label': t('menu.more'),
            onClick: (e) => { e.stopPropagation(); setMenuOpen(v => !v); },
          }, I.more(16)),
          menuOpen ? h('div', { className: 'dbs-menu', role: 'menu' },
            h('button', { type: 'button', role: 'menuitem', className: 'dbs-menu-item', onClick: () => { setMenuOpen(false); actions.rename(id, summary.displayTitle); } }, I.edit(14), t('menu.rename')),
            h('button', { type: 'button', role: 'menuitem', className: 'dbs-menu-item', onClick: () => { setMenuOpen(false); actions.fork(id); } }, I.branch(14), t('menu.fork')),
            isArchived
              ? h('button', { type: 'button', role: 'menuitem', className: 'dbs-menu-item', onClick: () => { setMenuOpen(false); actions.unarchive(id); } }, I.unarchive(14), t('menu.unarchive'))
              : h('button', { type: 'button', role: 'menuitem', className: 'dbs-menu-item', onClick: () => { setMenuOpen(false); actions.archive(id); } }, I.archive(14), t('menu.archive')),
            isPinned
              ? h('button', { type: 'button', role: 'menuitem', className: 'dbs-menu-item', onClick: () => { setMenuOpen(false); actions.unpin(id); } }, I.unpin(14), t('menu.unpin'))
              : h('button', { type: 'button', role: 'menuitem', className: 'dbs-menu-item', onClick: () => { setMenuOpen(false); actions.pin(id); } }, I.pin(14), t('menu.pin')),
            showMove ? [
              h('div', { key: 'sep', className: 'dbs-menu-sep' }),
              h('div', { key: 'label', className: 'dbs-menu-label' }, t('move.toGroup')),
              ...groups.map(g => h('button', {
                key: g.id, type: 'button', role: 'menuitem', className: 'dbs-menu-item',
                onClick: () => { setMenuOpen(false); actions.moveTo(id, g.id); },
              }, h('span', { className: 'dbs-swatch', style: { background: g.color } }), g.title || t('group.defaultName'))),
              groupId ? h('button', {
                key: '__out', type: 'button', role: 'menuitem', className: 'dbs-menu-item',
                onClick: () => { setMenuOpen(false); actions.moveTo(id, null); },
              }, t('move.out')) : null,
            ] : null,
          ) : null,
        ),
      );
    }

    /** 当前在主视图展示的会话 id（对齐原生 `mainSessionId`）。 */
    function mainSessionId(list) {
      const rows = (list && list.byId) || {};
      for (const id in rows) {
        const kept = rows[id] && rows[id].retainedBy;
        if (kept && (kept.mainView || 0) > 0) return id;
      }
      return undefined;
    }

    /* ── 影子占用者本体 ─────────────────────────────────────────────── */
    function Browser(props) {
      const {
        wide, expandSidebar, t,
        useSessions, useWorkspaces,
        open, fork, rename, archive, unarchive, pin, unpin, createProject, services,
      } = props;

      const [tab, setTab] = useState(readTab);
      /* UI 只暴露二态：显示/不显示已归档。原生 archivedFilter 有 'only'，我们用不到 */
      const [showArchived, setShowArchived] = useState(false);
      const filter = showArchived ? 'show' : 'default';
      const [diagOpen, setDiagOpen] = useState(false);   // 诊断面板默认隐藏
      /* 项目 Tab 的段折叠是纯视图偏好，放本地 state，不混进 groups store */
      const [projectFolded, setProjectFolded] = useState(() => new Set());
      const list = useSessions((state) => state);
      const workspaces = useWorkspaces((state) => state.items);
      const archivedIds = useWorkspaces((state) => state.archivedSessionIds);
      const pinnedIds = useWorkspaces((state) => state.pinnedSessionIds);
      const gs = useGroups();

      const byId = list.byId;
      /* 0.1.7 起 SessionListState 不再有 `current` 字段（那是 0.1.5 的旧形状）。
         当前展示的会话 = byId 里 retainedBy.mainView > 0 的那个，对齐原生 mainSessionId()。 */
      const current = mainSessionId(list);
      const pinned = new Set(pinnedIds || []);
      const archived = new Set(archivedIds || []);
      const acts = {
        rename, fork, archive, unarchive, pin, unpin,
        moveTo: moveSessionTo,
        renameGroup: (id) => {
          const g = gs.groups.find(x => x.id === id);
          const next = window.prompt(t('group.rename'), (g && g.title) || t('group.defaultName'));
          if (next != null && next.trim()) renameGroup(id, next.trim());
        },
        colorGroup: cycleGroupColor,
        dissolveGroup: (id) => {
          const g = gs.groups.find(x => x.id === id);
          const name = (g && g.title) || t('group.defaultName');
          if (window.confirm(t('group.dissolveConfirm').replace('{name}', name))) dissolveGroup(id);
        },
      };

      const rows = (ids, key, showMove) => visibleOrder(ids, byId, current, pinned, archived, filter)
        .map(id => h(SessionRow, {
          key: key + ':' + id, id, summary: byId[id], current, pinned, archived, onOpen: open,
          actions: acts, t, groups: showMove ? gs.groups : null, groupId: liveGroupId(gs, id),
        }));

      const toggleProjectFold = (key) => setProjectFolded((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
      });

      const projectSections = () => {
        const owned = new Set();
        const sections = (workspaces || []).map((w) => {
          (w.sessionIds || []).forEach(id => owned.add(id));
          return { key: w.workspaceId, group: null, label: w.title || basename(w.path), ids: w.sessionIds || [] };
        });
        const loose = list.ids.filter(id => !owned.has(id));
        if (loose.length) sections.push({ key: UNGROUPED_KEY, group: null, label: t('group.ungrouped'), ids: loose });
        return sections;
      };

      const customSections = () => groupSections(gs, list.ids);

      const body = tab === 'projects'
        ? projectSections().map(sec => h('div', { key: sec.key || '__u', className: 'dbs-group' },
            h(GroupHeader, {
              section: { key: sec.key, group: null },
              label: sec.label,
              count: visibleOrder(sec.ids, byId, current, pinned, archived, filter).length,
              collapsed: projectFolded.has(sec.key), foldable: true,
              onToggle: () => toggleProjectFold(sec.key), actions: acts, t,
              containsCurrent: current !== undefined && (sec.ids || []).indexOf(current) !== -1,
            }),
            projectFolded.has(sec.key) ? null : rows(sec.ids, 'p' + sec.key, false)))
        : tab === 'groups'
          ? customSections().map(sec => {
                const collapsed = !!gs.collapsed[sec.key];
                const ordered = sectionOrder(gs.orderByGroup[sec.key], sec.ids, byId, pinned, archived);
            return h('div', { key: sec.key || '__u', className: 'dbs-group' },
              h(GroupHeader, {
                section: sec,
                count: visibleOrder(ordered, byId, current, pinned, archived, filter).length,
                collapsed, foldable: true, onToggle: () => toggleCollapsed(sec.key), actions: acts, t,
                containsCurrent: current !== undefined && (ordered || []).indexOf(current) !== -1,
              }),
              collapsed ? null : rows(ordered, 'g' + sec.key, true));
          })
          : h('div', { className: 'dbs-group' }, rows(list.ids, 'flat', true));

      const diag = [
        'wide = ' + JSON.stringify(wide) + '   expandSidebar = ' + typeof expandSidebar,
        'sessions.ids = ' + list.ids.length + ' / byId = ' + Object.keys(byId).length,
        'workspaces = ' + ((workspaces || []).length),
        'pinned = ' + pinned.size + ', archived = ' + archived.size + ' (filter=' + filter + ', showArchived=' + showArchived + ')',
        'groups = ' + gs.groups.length + ' / membership = ' + Object.keys(gs.membership).length,
        'services = ' + (services || ''),
      ].join('\n');

      return h('div', { className: 'dbs-root' },
        h('style', null, CSS),
        h('div', { className: 'dbs-tabs', role: 'tablist' },
          [['projects', t('tab.projects')], ['groups', t('tab.groups')], ['flat', t('tab.flat')]].map(([k, label]) =>
            h('button', {
              key: k, type: 'button', role: 'tab', className: 'dbs-tab',
              'aria-selected': String(tab === k), onClick: () => setTab(k),
            }, label)),
          h('div', { className: 'dbs-tab-spacer' }),
          /* 新建分组 / 新建项目：同一个右对齐槽，按 Tab 上下文切换 */
          tab === 'groups'
            ? h('button', {
                type: 'button', className: 'dbs-icon-btn', title: t('group.new'),
                'aria-label': t('group.new'), onClick: () => { createGroup(); },
              }, I.plus(15))
            : tab === 'projects' && wide
              ? h('button', {
                  type: 'button', className: 'dbs-icon-btn', title: t('action.newProject'),
                  'aria-label': t('action.newProject'), onClick: createProject,
                }, I.plus(15))
              : null,
          h('button', {
            type: 'button', className: 'dbs-icon-btn',
            title: showArchived ? t('arch.hide') : t('arch.label'),
            'aria-label': showArchived ? t('arch.hide') : t('arch.label'),
            'aria-pressed': String(showArchived),
            onClick: () => setShowArchived(v => !v),
          }, showArchived ? I.unarchive(15) : I.archive(15))),
        h('div', { className: 'dbs-body' }, body),
        /* 诊断：区域右下角浮动小按钮，不占布局、不带文字 */
        h('button', {
          type: 'button', className: 'dbs-icon-btn dbs-fab',
          title: t('diag.title'), 'aria-label': t('diag.title'),
          'aria-pressed': String(diagOpen),
          onClick: () => setDiagOpen(v => !v),
        }, I.gear(15)),
        diagOpen ? h('div', { className: 'dbs-diag' }, diag) : null,
      );
    }

    return {
      inject: ['slots', 'sessions', 'workspaces', 'locale', 'uiWorkspace'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'better-sessions: dictionaries');

        const injected = () => ({
          services: [
            'uiWorkspace=' + typeof ctx.uiWorkspace,
            'pickDirectory=' + typeof (ctx.uiWorkspace && ctx.uiWorkspace.pickDirectory),
            'sessions=' + typeof ctx.sessions,
            'workspaces=' + typeof ctx.workspaces,
          ].join(' '),
          open: (id) => ctx.uiWorkspace.openSession(id),
          fork: (id) => { void ctx.uiWorkspace.forkSession(id).catch((e) => console.warn('[better-sessions] fork', e)); },
          rename: (id, title) => {
            const next = window.prompt('重命名', title);
            if (next == null) return;
            const b = ctx.sessions.binding(id);
            if (b) void b.session.rename(next).catch((e) => console.warn('[better-sessions] rename', e));
          },
          archive: (id) => { void ctx.uiWorkspace.archiveSession(id).catch((e) => console.warn('[better-sessions] archive', e)); },
          unarchive: (id) => { void ctx.uiWorkspace.unarchiveSession(id).catch((e) => console.warn('[better-sessions] unarchive', e)); },
          pin: (id) => { void ctx.uiWorkspace.pinSession(id).catch((e) => console.warn('[better-sessions] pin', e)); },
          unpin: (id) => { void ctx.uiWorkspace.unpinSession(id).catch((e) => console.warn('[better-sessions] unpin', e)); },
          createProject: () => {
            void (async () => {
              const path = await ctx.uiWorkspace.pickDirectory();
              if (!path) return;
              const r = await ctx.workspaces.create({ path });
              if (!r.ok) console.warn('[better-sessions] createWorkspace failed', r.error);
            })().catch((e) => console.warn('[better-sessions] createProject threw', e));
          },
        });

        ctx.slots.inject('sidebar.workspaces', () => ctx.slots.register({
          name: 'sidebar.workspaces',
          priority: -1,
          inject: injected,
          locale: NS,
        }, Browser));

        console.info('[better-sessions] 原型已注册：sidebar.workspaces @ priority -1');
      },
    };
  },
});

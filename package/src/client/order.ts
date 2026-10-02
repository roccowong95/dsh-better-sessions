/**
 * 侧边栏「自定义分组」的排序纯函数。
 *
 * 设计前提（见 REQUIREMENTS.md §5.1）：跟随 DSH 原生的选择——手动序在内存里
 * **始终维护有序数组**，持久化时整份提交（`Record<string, string[]>`）。
 * 因此本模块没有任何 sort_order 算术、没有步长、没有 MIN-STEP。
 *
 * 语义规格来自 DSH 原生 `dsh-client-ui-workspace` 的 `tree.d.ts` JSDoc
 * （运行时不可 import，JSDoc 即权威规格），加上我们自己的排序规则。
 *
 * 纯函数：不读全局、不抛异常、不修改入参、不 import 任何东西。
 * 由 `order.test.ts` 覆盖（与 prototype/lib/order.test.js 同一批用例）。
 *
 * 注意：本文件的函数体由 `scripts/port-order.mjs` 从已验证的 JS 原样搬入，
 * 签名类型单独维护——改逻辑请改 JS 后重新生成，或两边同步改并跑测试。
 */

import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** 排序只需要 SessionSummary 的这几个字段。 */
export interface OrderableSummary {
  readonly id: SessionId
  readonly updatedAt: number
  readonly blank: boolean
  readonly parentId?: SessionId
}

export type SessionMap = Readonly<Record<SessionId, OrderableSummary>>

/** registry-global 行状态，排序只用这两个集合。 */
export interface RowStateLike {
  readonly pinnedSessionIds?: readonly SessionId[]
  readonly archivedSessionIds?: readonly SessionId[]
}

export type ArchivedFilter = 'default' | 'show' | 'only'

/** mainSessionId 只需要 byId 与 retainedBy。 */
export interface RetainedSummary {
  readonly id: SessionId
  readonly retainedBy?: Readonly<Partial<Record<string, number>>>
}

export type RetainedMap = Readonly<Record<SessionId, RetainedSummary>>



/** 把 "Set 或数组或 undefined" 归一化成 Set。 */

/** 把 "Set 或数组或 undefined" 归一化成 Set。 */
function toSet(value: ReadonlySet<SessionId> | readonly SessionId[] | undefined) {
  if (value instanceof Set) return new Set(value)
  if (Array.isArray(value)) return new Set(value)
  return new Set()
}

/** 取 updatedAt，缺失/非有限值按 0 处理，保证比较永不 NaN。 */

/** 取 updatedAt，缺失/非有限值按 0 处理，保证比较永不 NaN。 */
function recencyOf(summary: OrderableSummary | undefined) {
  const t = summary && summary.updatedAt
  return typeof t === 'number' && Number.isFinite(t) ? t : 0
}

/**
 * 纯 recency 比较器：`updatedAt` 降序（新→旧）。不做任何兜底。
 *
 * @param byId
 * @param a
 * @param b
 * @returns
 */

/**
 * 纯 recency 比较器：`updatedAt` 降序（新→旧）。不做任何兜底。
 *
 * @param byId
 * @param a
 * @param b
 * @returns
 */
function compareRecency(byId: SessionMap, a: SessionId, b: SessionId) {
  return recencyOf(byId[b]) - recencyOf(byId[a])
}

/** Session id 字典序兜底，保证排序结果是全序（与输入顺序无关）。 */

/** Session id 字典序兜底，保证排序结果是全序（与输入顺序无关）。 */
function compareId(a: SessionId, b: SessionId) {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

/**
 * recency 优先、id 字典序兜底的组合比较器。
 * 用于没有其他显式排序标准的场景（`orderByRecency` / `visibleOrder`）。
 *
 * @param byId
 * @param a
 * @param b
 * @returns
 */

/**
 * recency 优先、id 字典序兜底的组合比较器。
 * 用于没有其他显式排序标准的场景（`orderByRecency` / `visibleOrder`）。
 *
 * @param byId
 * @param a
 * @param b
 * @returns
 */
function compareRecencyThenId(byId: SessionMap, a: SessionId, b: SessionId) {
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
 * @param ids
 * @param movedId
 * @param [beforeId]
 * @returns 新数组；入参永不被修改。
 */

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
 * @param ids
 * @param movedId
 * @param [beforeId]
 * @returns 新数组；入参永不被修改。
 */
function moveBefore(ids: readonly SessionId[], movedId: SessionId, beforeId?: SessionId | null) {
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
 * @param ids
 * @param byId
 * @returns 新数组。
 */

/**
 * 按更新时间倒序投影（对齐原生 `orderByRecency`）。
 *
 * - 新→旧：`updatedAt` 降序。
 * - `updatedAt` 相等时以 Session id 字典序作**确定性 tie-break**。
 * - **没有 summary 的成员（`byId[id]` 为 undefined）暂时省略**，等它的 summary 到达。
 *
 * @param ids
 * @param byId
 * @returns 新数组。
 */
function orderByRecency(ids: readonly SessionId[], byId: SessionMap) {
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

/** `id` 的 fork 来源是否在 `inOrder` 集合里。 */
function forkSourceInOrder(byId: SessionMap, id: SessionId, inOrder: ReadonlySet<SessionId>) {
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
 * @param byId
 * @param pinned
 * @param archived
 * @param inOrder
 * @param a
 * @param b
 * @returns
 */

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
 * @param byId
 * @param pinned
 * @param archived
 * @param inOrder
 * @param a
 * @param b
 * @returns
 */
function compareMissingMembers(byId: SessionMap, pinned: ReadonlySet<SessionId>, archived: ReadonlySet<SessionId>, inOrder: ReadonlySet<SessionId>, a: SessionId, b: SessionId) {
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
 * @param memberIds 当前成员集合
 * @param savedOrder 手动保存的序
 * @param byId
 * @param [rowState]
 * @returns 新数组。
 */

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
 * @param memberIds 当前成员集合
 * @param savedOrder 手动保存的序
 * @param byId
 * @param [rowState]
 * @returns 新数组。
 */
function reconcileManualOrder(memberIds: readonly SessionId[], savedOrder: readonly SessionId[] | undefined | null, byId: SessionMap, rowState?: RowStateLike) {
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
  const resolvable = (id: SessionId): boolean => {
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
  const pending = new Set<SessionId>()
  for (const id of forkSource.keys()) {
    if (!demoted.has(id)) pending.add(id)
  }
  while (pending.size > 0) {
    /** @type {SessionId | null} */
    let picked = null
    for (const id of pending) {
      if (seq.indexOf(forkSource.get(id) as SessionId) === -1) continue // 来源还没落位
      if (picked === null || compareMissingMembers(map, pinned, archived, inOrder, id, picked as SessionId) < 0) {
        picked = id
      }
    }
    if (picked === null) break // 理论上不会发生（环已提前剔除）；防御性退出
    seq.splice(seq.indexOf(forkSource.get(picked) as SessionId), 0, picked)
    pending.delete(picked)
  }
  // 兜底：万一仍有剩余（仅防御），按同一比较器追加，保证确定且不丢成员
  if (pending.size > 0) {
    const leftover = Array.from(pending)
    leftover.sort((a, b) => compareMissingMembers(map, pinned, archived, inOrder, a as SessionId, b as SessionId))
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
 * @param order
 * @param currentBlank
 * @returns 新数组；入参永不被修改。
 */

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
 * @param order
 * @param currentBlank
 * @returns 新数组；入参永不被修改。
 */
function pinCurrentBlank(order: readonly SessionId[], currentBlank?: SessionId | null) {
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
 * @param ids
 * @param byId
 * @param current
 * @param [pinned]
 * @param [archived]
 * @param [filter]
 * @returns 新数组。
 */

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
 * @param ids
 * @param byId
 * @param current
 * @param [pinned]
 * @param [archived]
 * @param [filter]
 * @returns 新数组。
 */
function visibleOrder(ids: readonly SessionId[], byId: SessionMap, current: SessionId | undefined, pinned: ReadonlySet<SessionId> | readonly SessionId[] | undefined, archived: ReadonlySet<SessionId> | readonly SessionId[] | undefined, filter?: ArchivedFilter) {
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
/**
 * 当前在主视图展示的会话 id（对齐原生 `mainSessionId`）。
 *
 * 0.1.7 起 `SessionListState` 不再有 `current` 字段（那是 0.1.5 的旧形状），
 * 当前会话改由 `retainedBy.mainView > 0` 表达。
 */
function mainSessionId(list: { readonly byId: RetainedMap }): SessionId | undefined {
  const rows = (list && list.byId) || {}
  for (const id of Object.keys(rows) as SessionId[]) {
    const kept = rows[id] && rows[id].retainedBy
    if (kept && (kept.mainView || 0) > 0) return id
  }
  return undefined
}

export {
  mainSessionId,
  toSet,
  recencyOf,
  compareRecency,
  compareId,
  compareRecencyThenId,
  moveBefore,
  orderByRecency,
  forkSourceInOrder,
  compareMissingMembers,
  reconcileManualOrder,
  pinCurrentBlank,
  visibleOrder,
}

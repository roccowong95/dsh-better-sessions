/**
 * `lib/order.js` 的单测。
 *
 * 覆盖的用例全部从 DSH 原生 `tree.d.ts` 的 JSDoc 语义 + 我们自己的排序规则推导出来，
 * 重点是边界：空输入、缺 summary、已删除 id、三态归档过滤、Set/数组归一化。
 *
 * 运行：`npm test`（vitest）
 */

import { test } from 'vitest'
import assert from 'node:assert/strict'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import {
  moveBefore,
  orderByRecency,
  reconcileManualOrder,
  pinCurrentBlank,
  visibleOrder,
} from './order'

/** SessionId 是 branded 类型；测试里用字面量，统一走这个收敛。 */
const sid = (id: string): SessionId => id as SessionId

/* 测试专用签名放宽：纯逻辑只把 id 当不透明串，这里统一放宽成 string，
 * 免得 191 处 `as`。生产代码仍是 branded SessionId。 */
type ByIdLike = Record<string, unknown>
const mb = moveBefore as unknown as (ids: string[] | undefined, moved: string | undefined, before?: string | null | undefined) => string[]
const obr = orderByRecency as unknown as (ids: string[], byId: ByIdLike) => string[]
const rmo = reconcileManualOrder as unknown as (
  ids: string[], saved: readonly string[] | undefined | null, byId: ByIdLike,
  row?: { pinnedSessionIds?: readonly string[] | undefined; archivedSessionIds?: readonly string[] | undefined } | undefined,
) => string[]
const pcb = pinCurrentBlank as unknown as (order: string[] | undefined, blank?: string | null | undefined) => string[]
const vo = visibleOrder as unknown as (
  ids: string[], byId: ByIdLike, current?: string | undefined,
  pinned?: ReadonlySet<string> | readonly string[] | undefined,
  archived?: ReadonlySet<string> | readonly string[] | undefined,
  filter?: string | undefined,
) => string[]

/** 把若干 summary 收成 byId 映射（测试里 key 就是普通字符串）。 */
function byIdOf(...summaries: ReturnType<typeof s>[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const summary of summaries) out[summary.id as string] = summary
  return out
}

/** 造一个够排序用的 summary。 */
function s(id: string, extra: Record<string, unknown> = {}) {
  return {
    id: sid(id),
    displayTitle: id,
    running: false,
    blank: false,
    updatedAt: 0,
    ...extra,
  }
}


/* ------------------------------------------------------------------ *
 * moveBefore
 * ------------------------------------------------------------------ */

test('moveBefore: 正常移动到某元素之前', () => {
  assert.deepStrictEqual(mb(['a', 'b', 'c'], 'c', 'a'), ['c', 'a', 'b'])
  assert.deepStrictEqual(mb(['a', 'b', 'c', 'd'], 'd', 'b'), ['a', 'd', 'b', 'c'])
})

test('moveBefore: beforeId 为 undefined / null → 移到末尾', () => {
  assert.deepStrictEqual(mb(['a', 'b', 'c'], 'a', undefined), ['b', 'c', 'a'])
  assert.deepStrictEqual(mb(['a', 'b', 'c'], 'a', null), ['b', 'c', 'a'])
  // 已经是末尾时仍是原序
  assert.deepStrictEqual(mb(['a', 'b', 'c'], 'c', undefined), ['a', 'b', 'c'])
})

test('moveBefore: beforeId 不存在于 ids → 移到末尾', () => {
  assert.deepStrictEqual(mb(['a', 'b', 'c'], 'a', 'ghost'), ['b', 'c', 'a'])
})

test('moveBefore: movedId 不存在 → 原序副本', () => {
  const input = ['a', 'b', 'c']
  const out = mb(input, 'ghost', 'a')
  assert.deepStrictEqual(out, ['a', 'b', 'c'])
  // 必须是副本，不是同一个引用
  assert.notStrictEqual(out, input)
})

test('moveBefore: beforeId === movedId → 移到末尾（规格含糊处的取舍）', () => {
  // 规格在「要求」里明确写了：beforeId 不存在于 ids 中「或就是 movedId 自己」→ 移到末尾。
  // 实现是「先移除、再定位」，移除后 beforeId 自然不存在，于是落到同一条规则。
  // 选「移末尾」而非「原序不动」的理由：
  //   1) 它是「要求」清单里的明文规则，自洽且只有一种解释；
  //   2) 它从最朴素的实现里自然导出，不需要为 beforeId === movedId 加特例分支；
  //   3) 对调用方无实际损失——UI 上把自己拖到自己身上是极少见且可恢复的操作。
  assert.deepStrictEqual(mb(['a', 'b', 'c'], 'b', 'b'), ['a', 'c', 'b'])

  // 与之互补的「移动到自身之后」（REQUIREMENTS.md §5.2 表里的用例）：原序不变。
  assert.deepStrictEqual(mb(['a', 'b', 'c'], 'b', 'c'), ['a', 'b', 'c'])
})

test('moveBefore: 空数组 / 单元素数组不抛错', () => {
  assert.deepStrictEqual(mb([], 'a', 'b'), [])
  assert.deepStrictEqual(mb([], undefined, undefined), [])
  assert.deepStrictEqual(mb([], undefined, 'a'), [])
  assert.deepStrictEqual(mb(['a'], 'a', undefined), ['a'])
  assert.deepStrictEqual(mb(['a'], 'a', 'a'), ['a'])
  assert.deepStrictEqual(mb(['a'], 'ghost', 'a'), ['a'])
  // 非数组入参也要能活
  assert.deepStrictEqual(mb(undefined, 'a', 'b'), [])
})

test('moveBefore: 不修改入参', () => {
  const input = ['a', 'b', 'c', 'd']
  const snapshot = input.slice()
  mb(input, 'd', 'b')
  mb(input, 'a', undefined)
  mb(input, 'ghost', 'b')
  mb(input, 'b', 'b')
  assert.deepStrictEqual(input, snapshot)
})

/* ------------------------------------------------------------------ *
 * orderByRecency
 * ------------------------------------------------------------------ */

test('orderByRecency: 基本倒序（新→旧）', () => {
  const byId = byIdOf(s('a', { updatedAt: 1 }), s('b', { updatedAt: 3 }), s('c', { updatedAt: 2 }))
  assert.deepStrictEqual(obr(['a', 'b', 'c'], byId), ['b', 'c', 'a'])
  // 输入顺序不影响结果
  assert.deepStrictEqual(obr(['c', 'a', 'b'], byId), ['b', 'c', 'a'])
})

test('orderByRecency: updatedAt 相等时按 id 字典序确定排序', () => {
  const byId = byIdOf(s('x', { updatedAt: 5 }), s('a', { updatedAt: 5 }), s('m', { updatedAt: 5 }))
  assert.deepStrictEqual(obr(['x', 'a', 'm'], byId), ['a', 'm', 'x'])
  // 打乱输入顺序，结果必须完全一致（确定性）
  assert.deepStrictEqual(obr(['m', 'x', 'a'], byId), ['a', 'm', 'x'])
})

test('orderByRecency: 缺 summary 的成员被省略', () => {
  const byId = byIdOf(s('a', { updatedAt: 1 }), s('c', { updatedAt: 3 }))
  assert.deepStrictEqual(obr(['a', 'b', 'c'], byId), ['c', 'a'])
  // 全部缺 summary → 空
  assert.deepStrictEqual(obr(['b', 'z'], byId), [])
  // 空输入
  assert.deepStrictEqual(obr([], byId), [])
})

test('orderByRecency: 不修改入参', () => {
  const input = ['a', 'b', 'c']
  const byId = byIdOf(s('a', { updatedAt: 1 }), s('b', { updatedAt: 3 }), s('c', { updatedAt: 2 }))
  obr(input, byId)
  assert.deepStrictEqual(input, ['a', 'b', 'c'])
})

/* ------------------------------------------------------------------ *
 * reconcileManualOrder
 * ------------------------------------------------------------------ */

test('reconcileManualOrder: savedOrder 为 undefined → 全部成员按 pin + recency 排', () => {
  const byId = byIdOf(s('a', { updatedAt: 1 }), s('b', { updatedAt: 5 }), s('c', { updatedAt: 3 }))
  assert.deepStrictEqual(rmo(['a', 'b', 'c'], undefined, byId), ['b', 'c', 'a'])

  // pinned 领先
  const rowState = { pinnedSessionIds: ['c'], archivedSessionIds: [] }
  assert.deepStrictEqual(rmo(['a', 'b', 'c'], undefined, byId, rowState), ['c', 'b', 'a'])
})

test('reconcileManualOrder: savedOrder 为 null / 空数组时同上', () => {
  const byId = byIdOf(s('a', { updatedAt: 1 }), s('b', { updatedAt: 5 }))
  assert.deepStrictEqual(rmo(['a', 'b'], null, byId), ['b', 'a'])
  assert.deepStrictEqual(rmo(['a', 'b'], [], byId), ['b', 'a'])
  // rowState 整个缺省也不能抛错
  assert.deepStrictEqual(rmo(['a', 'b'], [], byId, undefined), ['b', 'a'])
})

test('reconcileManualOrder: savedOrder 含已删除 id → 丢弃，其余相对位置不变', () => {
  const byId = byIdOf(s('a', { updatedAt: 1 }), s('b', { updatedAt: 2 }), s('c', { updatedAt: 3 }))
  // 'ghost' 已不在 memberIds 里 → 丢掉；'a' 虽然最旧仍排在 'c' 前面（保存序优先于 recency）
  assert.deepStrictEqual(rmo(['a', 'c'], ['a', 'ghost', 'c'], byId), ['a', 'c'])
  // savedOrder 自身有重复 id 时也只出现一次
  assert.deepStrictEqual(rmo(['a', 'c'], ['a', 'a', 'c'], byId), ['a', 'c'])
})

test('reconcileManualOrder: 新成员追加在末尾之后，pinned 的新成员排在其他新成员之前', () => {
  const byId = byIdOf(
    s('a', { updatedAt: 10 }),
    s('b', { updatedAt: 9 }),
    s('n1', { updatedAt: 100 }), // 最新，但仍是新成员 → 只能追加
    s('n2', { updatedAt: 50 })
  )
  assert.deepStrictEqual(rmo(['a', 'b', 'n1', 'n2'], ['b', 'a'], byId), ['b', 'a', 'n1', 'n2'])

  // pinned 的新成员领先新成员段
  const rowState = { pinnedSessionIds: ['n2'], archivedSessionIds: [] }
  assert.deepStrictEqual(rmo(['a', 'b', 'n1', 'n2'], ['b', 'a'], byId, rowState), [
    'b',
    'a',
    'n2',
    'n1',
  ])
})

test('reconcileManualOrder: 新 fork 立即插到其来源之前（不是追加到末尾）', () => {
  const byId = byIdOf(
    s('p', { updatedAt: 10 }), // 已保存
    s('x', { updatedAt: 9 }), // 已保存
    s('c', { updatedAt: 1, parentId: 'p' }) // 新 fork of p，而且最旧
  )
  // recency 本该把 c 扔到最后，但 "New ordinary forks precede their sources" → 紧贴 p 上方
  assert.deepStrictEqual(rmo(['p', 'x', 'c'], ['p', 'x'], byId), ['c', 'p', 'x'])
})

test('reconcileManualOrder: 插 fork 不改变已存条目的相对顺序', () => {
  const byId = byIdOf(
    s('a', { updatedAt: 10 }),
    s('b', { updatedAt: 9 }),
    s('c', { updatedAt: 8 }),
    s('d', { updatedAt: 7 }),
    s('nb', { updatedAt: 1, parentId: 'b' }),
    s('nd', { updatedAt: 2, parentId: 'd' })
  )
  // a,b,c,d 彼此相对序不变；nb 贴 b 上方，nd 贴 d 上方
  assert.deepStrictEqual(
    rmo(['a', 'b', 'c', 'd', 'nb', 'nd'], ['a', 'b', 'c', 'd'], byId),
    ['a', 'nb', 'b', 'c', 'nd', 'd']
  )
})

test('reconcileManualOrder: fork 的来源本身也是新成员时，来源先追加、fork 再贴上去', () => {
  const byId = byIdOf(
    s('x', { updatedAt: 10 }), // 已保存
    s('parent', { updatedAt: 5 }), // 新成员、无 parentId → (c) 追加到尾
    s('child', { updatedAt: 1, parentId: 'parent' }) // 新 fork → (b)
  )
  // parent 落在末尾；child 插到 parent 前面 → 两者紧贴
  assert.deepStrictEqual(rmo(['x', 'parent', 'child'], ['x'], byId), [
    'x',
    'child',
    'parent',
  ])
})

test('reconcileManualOrder: 多个新 fork 同一来源，块内按 recency 降序（最旧的最贴来源）', () => {
  const byId = byIdOf(
    s('p', { updatedAt: 10 }),
    s('c1', { updatedAt: 5, parentId: 'p' }),
    s('c2', { updatedAt: 8, parentId: 'p' })
  )
  // c2 比 c1 新 → c2 在上；c1（较旧）紧贴 p
  assert.deepStrictEqual(rmo(['p', 'c1', 'c2'], ['p'], byId), ['c2', 'c1', 'p'])
  // 打乱 memberIds 顺序，结果必须一致
  assert.deepStrictEqual(rmo(['c2', 'p', 'c1'], ['p'], byId), ['c2', 'c1', 'p'])
})

test('reconcileManualOrder: 链式 fork（A→B→C 全是新的）结果确定', () => {
  const byId = byIdOf(
    s('x', { updatedAt: 100 }), // 已保存
    s('a', { updatedAt: 30 }), // 新、无 parentId
    s('b', { updatedAt: 20, parentId: 'a' }),
    s('cc', { updatedAt: 10, parentId: 'b' })
  )
  // a 追加在尾；b 贴 a 上方；cc 贴 b 上方 → 最上游的子会话在最上面
  assert.deepStrictEqual(rmo(['x', 'a', 'b', 'cc'], ['x'], byId), ['x', 'cc', 'b', 'a'])
  // 打乱 memberIds 顺序，结果必须一致（拓扑插入保证确定）
  assert.deepStrictEqual(rmo(['cc', 'b', 'a', 'x'], ['x'], byId), ['x', 'cc', 'b', 'a'])
})

test('reconcileManualOrder: 来源不在最终序列里的 fork 退化成 (c)，追加到末尾', () => {
  // 来源 'deleted' 已不是成员 → 不在序列里，'orphan' 退化成 (c)
  const byId = byIdOf(
    s('x', { updatedAt: 10 }),
    s('orphan', { updatedAt: 1, parentId: 'deleted' }),
    s('plain', { updatedAt: 2 }) // 无 parentId，同样 (c)，且更新更近
  )
  assert.deepStrictEqual(rmo(['x', 'orphan', 'plain'], ['x'], byId), [
    'x',
    'plain',
    'orphan',
  ])

  // 来源是成员但还没有 summary → 也不在序列里，同样退化
  const byId2 = byIdOf(s('x', { updatedAt: 10 }), s('c', { updatedAt: 1, parentId: 'ghost' }))
  assert.deepStrictEqual(rmo(['x', 'ghost', 'c'], ['x'], byId2), ['x', 'c'])
})

test('reconcileManualOrder: 来源是已保存但缺 summary 的条目时，fork 仍插到它前面', () => {
  // 'p' 在 savedOrder 里但没有 summary —— (a) 类不要求有 summary，所以它仍在序列里
  const byId = byIdOf(s('c', { updatedAt: 1, parentId: 'p' }))
  assert.deepStrictEqual(rmo(['p', 'c'], ['p'], byId), ['c', 'p'])
})

test('reconcileManualOrder: pinned 的新 fork 仍按 (b) 插到来源前面，pin 不抢插位', () => {
  const byId = byIdOf(
    s('p', { updatedAt: 10 }),
    s('c', { updatedAt: 1, parentId: 'p' })
  )
  const rowState = { pinnedSessionIds: ['c'], archivedSessionIds: [] }
  // pin 只在 (c) 尾部排序里起作用；fork 的归属由「来源在不在序列里」单独决定
  assert.deepStrictEqual(rmo(['p', 'c'], ['p'], byId, rowState), ['c', 'p'])
})

test('reconcileManualOrder: parentId 成环时不死循环、不抛错，环上成员退化成 (c)', () => {
  const byId = byIdOf(
    s('x', { updatedAt: 10 }),
    s('a', { updatedAt: 5, parentId: 'b' }),
    s('b', { updatedAt: 4, parentId: 'a' })
  )
  assert.deepStrictEqual(rmo(['x', 'a', 'b'], ['x'], byId), ['x', 'a', 'b'])

  // 自环
  const byId2 = byIdOf(s('x', { updatedAt: 10 }), s('self', { updatedAt: 5, parentId: 'self' }))
  assert.deepStrictEqual(rmo(['x', 'self'], ['x'], byId2), ['x', 'self'])
})

test('reconcileManualOrder: 同等条件下未归档的排在归档的之前', () => {
  const byId = byIdOf(s('live', { updatedAt: 5 }), s('dead', { updatedAt: 5 }))
  const rowState = { pinnedSessionIds: [], archivedSessionIds: ['dead'] }
  // updatedAt 相同、都未 pin、都无 fork 来源 → 由归档状态决定
  assert.deepStrictEqual(rmo(['live', 'dead'], undefined, byId, rowState), ['live', 'dead'])

  // 归档状态是**最后**一道：归档项更新得更近时 recency 仍然赢
  const byId2 = byIdOf(s('live', { updatedAt: 1 }), s('dead', { updatedAt: 9 }))
  assert.deepStrictEqual(rmo(['live', 'dead'], undefined, byId2, rowState), ['dead', 'live'])
})

test('reconcileManualOrder: 没有 summary 的新成员暂不出现；补上 summary 后再 reconcile 应出现', () => {
  const before = byIdOf(s('a', { updatedAt: 1 }))
  assert.deepStrictEqual(rmo(['a', 'ghost'], ['a'], before), ['a'])

  const after = byIdOf(s('a', { updatedAt: 1 }), s('ghost', { updatedAt: 2 }))
  assert.deepStrictEqual(rmo(['a', 'ghost'], ['a'], after), ['a', 'ghost'])
})

test('reconcileManualOrder: 已保存条目即使缺 summary 也保留（保存序是本地事实源）', () => {
  // 与上一条对照：缺 summary 只影响「新成员」，不影响已在 savedOrder 里的条目。
  // 否则 summary 迟到一下就会把条目挤出数组，写回时造成顺序抖动。
  const byId = byIdOf(s('b', { updatedAt: 2 }))
  assert.deepStrictEqual(rmo(['a', 'b'], ['a', 'b'], byId), ['a', 'b'])
})

test('reconcileManualOrder: 不修改入参', () => {
  const memberIds = ['a', 'b', 'n1']
  const savedOrder = ['b', 'a']
  const byId = byIdOf(s('a', { updatedAt: 1 }), s('b', { updatedAt: 2 }), s('n1', { updatedAt: 3 }))
  const memberSnapshot = memberIds.slice()
  const savedSnapshot = savedOrder.slice()
  rmo(memberIds, savedOrder, byId, { pinnedSessionIds: ['n1'], archivedSessionIds: [] })
  assert.deepStrictEqual(memberIds, memberSnapshot)
  assert.deepStrictEqual(savedOrder, savedSnapshot)
})

/* ------------------------------------------------------------------ *
 * visibleOrder
 * ------------------------------------------------------------------ */

test('visibleOrder: pinned 领先其段', () => {
  const byId = byIdOf(s('a', { updatedAt: 1 }), s('b', { updatedAt: 2 }), s('p', { updatedAt: 0 }))
  // 'p' 最旧，但 pinned → 排最前
  assert.deepStrictEqual(vo(['a', 'b', 'p'], byId, undefined, ['p'], []), ['p', 'b', 'a'])
  // 多个 pinned 内部仍按 recency
  const byId2 = byIdOf(
    s('a', { updatedAt: 1 }),
    s('p1', { updatedAt: 4 }),
    s('p2', { updatedAt: 7 })
  )
  assert.deepStrictEqual(vo(['a', 'p1', 'p2'], byId2, undefined, ['p1', 'p2'], []), ['p2', 'p1', 'a'])
})

test('visibleOrder: blank 会话只有 current 那个可见', () => {
  const byId = byIdOf(
    s('a', { updatedAt: 3 }),
    s('blank1', { updatedAt: 9, blank: true }),
    s('blank2', { updatedAt: 8, blank: true })
  )
  assert.deepStrictEqual(vo(['a', 'blank1', 'blank2'], byId, 'blank1', [], []), ['blank1', 'a'])
  // 没有选中任何 blank → 全部 blank 消失
  assert.deepStrictEqual(vo(['a', 'blank1', 'blank2'], byId, undefined, [], []), ['a'])
  // current 指向一个非 blank 会话 → blank 照样全灭
  assert.deepStrictEqual(vo(['a', 'blank1'], byId, 'a', [], []), ['a'])
})

test("visibleOrder: filter='default' 丢弃归档、'show' 保留、'only' 只留归档", () => {
  const byId = byIdOf(s('live', { updatedAt: 5 }), s('arch', { updatedAt: 9 }))
  const ids = ['live', 'arch']
  const archived = ['arch']

  assert.deepStrictEqual(vo(ids, byId, undefined, [], archived, 'default'), ['live'])
  assert.deepStrictEqual(vo(ids, byId, undefined, [], archived, 'show'), ['arch', 'live'])
  assert.deepStrictEqual(vo(ids, byId, undefined, [], archived, 'only'), ['arch'])

  // 未传 filter → 按 'default'
  assert.deepStrictEqual(vo(ids, byId, undefined, [], archived), ['live'])

  // 'show' 下归档行不享受特殊搬移：按通用 recency 落位（arch 更新更近所以在前面）
  const byId2 = byIdOf(s('live', { updatedAt: 9 }), s('arch', { updatedAt: 5 }))
  assert.deepStrictEqual(vo(['live', 'arch'], byId2, undefined, [], archived, 'show'), ['live', 'arch'])
})

test('visibleOrder: pinned / archived 传数组或 Set 都能工作（归一化）', () => {
  const byId = byIdOf(s('a', { updatedAt: 1 }), s('b', { updatedAt: 2 }), s('p', { updatedAt: 0 }))

  const withArrays = vo(['a', 'b', 'p'], byId, undefined, ['p'], ['a'])
  const withSets = vo(['a', 'b', 'p'], byId, undefined, new Set(['p']), new Set(['a']))
  assert.deepStrictEqual(withArrays, withSets)
  assert.deepStrictEqual(withSets, ['p', 'b'])

  // 完全不传也不能抛错
  assert.deepStrictEqual(vo(['a', 'b'], byId, undefined), ['b', 'a'])
})

test('visibleOrder: 丢弃没有 summary 的 id', () => {
  const byId = byIdOf(s('a', { updatedAt: 1 }))
  assert.deepStrictEqual(vo(['a', 'ghost'], byId, undefined, [], []), ['a'])
  assert.deepStrictEqual(vo(['ghost'], byId, undefined, [], []), [])
})

test('visibleOrder: 不修改入参', () => {
  const ids = ['a', 'b', 'p']
  const byId = byIdOf(s('a', { updatedAt: 1 }), s('b', { updatedAt: 2 }), s('p', { updatedAt: 0 }))
  vo(ids, byId, undefined, ['p'], [])
  assert.deepStrictEqual(ids, ['a', 'b', 'p'])
})

/* ------------------------------------------------------------------ *
 * pinCurrentBlank
 * ------------------------------------------------------------------ */

test('pinCurrentBlank: 基本置顶', () => {
  assert.deepStrictEqual(pcb(['a', 'b', 'c'], 'c'), ['c', 'a', 'b'])
  assert.deepStrictEqual(pcb(['a', 'b', 'c'], 'a'), ['a', 'b', 'c'])
  assert.deepStrictEqual(pcb(['x', 'blank', 'y'], 'blank'), ['blank', 'x', 'y'])
})

test('pinCurrentBlank: 不占重复位（原位置那个删掉）', () => {
  // 'c' 从下标 2 挪到最前，且只出现一份
  const out = pcb(['a', 'b', 'c'], 'c')
  assert.deepStrictEqual(out, ['c', 'a', 'b'])
  assert.strictEqual(out.filter((id) => id === 'c').length, 1)

  // 已经在最前 → 原序，不重复
  assert.deepStrictEqual(pcb(['c', 'a', 'b'], 'c'), ['c', 'a', 'b'])

  // 入参里万一已重复出现，也归一成一份
  assert.deepStrictEqual(pcb(['a', 'c', 'b', 'c'], 'c'), ['c', 'a', 'b'])
})

test('pinCurrentBlank: currentBlank 为 undefined / null → 原序副本', () => {
  const input = ['a', 'b', 'c']
  const out = pcb(input, undefined)
  assert.deepStrictEqual(out, ['a', 'b', 'c'])
  // 是副本，不是同一个引用
  assert.notStrictEqual(out, input)

  assert.deepStrictEqual(pcb(['a', 'b'], null), ['a', 'b'])
})

test('pinCurrentBlank: currentBlank 不在 order 里 → 不动原序', () => {
  // 理由：本函数只负责「重排」，拿不到 byId、无法校验该 id 是否可渲染；
  // 擅自注入调用方没放进去的 id 会造出一行没有 summary 的行。
  // 选中的 blank 该不该进序，由 visibleOrder（已用 current 放行）决定。
  assert.deepStrictEqual(pcb(['a', 'b'], 'zzz'), ['a', 'b'])
  assert.deepStrictEqual(pcb([], 'zzz'), [])
})

test('pinCurrentBlank: 空数组 / 非数组入参不抛错', () => {
  assert.deepStrictEqual(pcb([], 'a'), [])
  assert.deepStrictEqual(pcb([], undefined), [])
  assert.deepStrictEqual(pcb(undefined, 'a'), [])
  assert.deepStrictEqual(pcb(undefined, undefined), [])
})

test('pinCurrentBlank: 不修改入参', () => {
  const order = ['a', 'b', 'c']
  const snapshot = order.slice()
  pcb(order, 'c')
  pcb(order, 'zzz')
  assert.deepStrictEqual(order, snapshot)
})

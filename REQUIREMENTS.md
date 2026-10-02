# dsh-better-sessions 需求文档

> DSH Web GUI 左侧边栏「Session 自定义分组」插件
> 版本：v1（需求冻结稿）｜状态：待原型验证后进入阶段 2
> 上游依据：`@deepseek-ai/dsh@0.1.7-rc.1`（本机已安装并在 3080 运行）

---

## 0. 这份文档怎么读

- 第 1–2 节是**结论**，写完码不会再变。
- 第 3 节是**已核实的契约事实**，所有设计从这里推导，不允许拍脑袋。
- 第 4–11 节是**要写的东西**，含数据模型、派生规则、组件划分。
- 第 12–13 节是**没定的事**，其中 §13.1 是原型的唯一任务清单。

标 ✅ 的是已从 0.1.7-rc.1 安装产物或实时 slot 树核实；标 ❓ 的是待原型验证的假设。

---

## 1. 目标与非目标

### 1.1 一句话

在 DSH Web GUI 左侧边栏实现 ZCode 风格的 Session 自定义分组：**保留现有按 Workspace（项目）分组的结构，同时支持用户自定义分组**，以「项目 | 我的分组 | 平铺」三个 Tab 呈现。

### 1.2 目标

1. 「我的分组」Tab：用户可建/改名/改色/解散分组，把会话移入移出，组内可手动排序。
2. 「项目」Tab：复刻原生按 Workspace 分组的行为，含工作区的新建/重命名/删除对话框与改归属。
3. 「平铺」Tab：全部会话的单一列表，支持手动/按更新时间两种排序。
4. 分组数据可跨浏览器、可备份。
5. 不破坏原生行操作（pin / rename / fork / archive）与目录选择流。

### 1.3 非目标（MVP 明确不做）

| 不做 | 原因 |
|---|---|
| 会话内容搜索 | 原生 `ctx.sessions.search` 搜的是消息内容，MVP 只做标题过滤 |
| FLIP 动画 / 虚拟滚动 | 会话量 < 100，收益不抵成本 |
| IME 特例 / 菜单焦点竞争 | 原生事件 + 简单菜单可绕开 |
| subagent 层级树 | 原生 0.1.7 的 `workspace-tree` 模式才有的结构，Tab 结构已分流 |
| 分组嵌套 | 平铺一层，与 ZCode 一致 |
| 跨设备实时同步 | 宿主 settings 已覆盖单用户多浏览器场景 |
| cron/闲时系统分组、workspace scopes、分组草稿提升 | ZCode 有但场景不同 |

---

## 2. 已定决策

### 2.1 结构性决策（不再讨论）

| 决策点 | 结论 | 理由 |
|---|---|---|
| 实现形态 | **三 Tabs 影子替换**：整个 `sidebar.workspaces` cell 换成自己的 | DSH 无「视图模式」插槽，`groupBy` 是 WorkspaceBrowser 私有 store，插件扩不进去；要结构性展示只有整块替换 |
| 不做混排单视图 | 自定义组与项目段同级混排（ZCode grouped 本质） | 排序语义复杂、心智负担大；ZCode 最终也用 Tabs 分离 |
| 不装 `dsh-session-manager` | 用户明确拒绝 | 那是管理工具（删除/归档/收藏/标签），场景不同 |
| 分两阶段 | 阶段 1 动态插件原型 → 阶段 2 正式 npm 包 | 原型秒级迭代验证链路；1500 行 UI 必须 TSX + 类型 |
| 正式阶段开发位置 | 独立 dev profile，不动日常 web profile | 半成品替换侧栏会影响 daily driver；回滚 = 删 patch 行 |

### 2.2 本轮新增决策（2026-09-24 需求评审）

| 决策点 | 结论 |
|---|---|
| 归属语义 | **单归属**（membership 主键 = sessionId）+ **可跨 workspace**（自定义组是独立于「项目」的第二套维度） |
| 未分组会话 | 「我的分组」Tab 底部**固定一个「未分组」段**；「移出分组」= 回到该段 |
| 持久化 | **宿主 settings**（`~/.dsh/settings.yaml`）为主 + **localStorage 降级** |
| 项目 Tab 能力 | **重做原生那套**：workspace 段 + 新建/重命名/删除对话框 + 改归属 |
| 放进分组的交互 | MVP 用**右键菜单「移动到分组…」**；拖拽（组内排序 + 跨组 + 拖到顶层）放二期 |
| 改会话所属项目 | MVP 用**右键菜单「移动到项目…」**（与「移动到分组…」并列，一处交互管两种归属）；拖拽二期 |

### 2.3 我自行决定、可被否决的次要决策

- 默认 Tab = 「项目」，并记住上次选择的 Tab。
- 搜索框：MVP 做**客户端标题过滤**（`SessionSummary.displayTitle` 子串匹配，约 20 行），不做 host 内容搜索。
- 折叠状态：持久化（跟分组数据一起存）。
- 色板：**固定 7 色**（抄 ZCode），不做任意取色。
- 归档会话：`archivedFilter` 三态照抄原生（`default` / `show` / `only`），一个「显示已归档」开关循环切换。
- 56px rail 折叠态：走 owner props `{ wide, expandSidebar }`。
- 空态：无分组时「我的分组」显示引导文案 + 「新建分组」按钮；无会话时显示空态文案。

---

## 3. 契约事实（0.1.7-rc.1 已核实）

### 3.1 版本与运行状态 ✅

- 3080 正在跑的服务用的是 **0.1.7-rc.1**（npx 缓存 `c8633a242642d858`），401 是 `dsh web` 要求带 token 的 URL，服务正常。
- 实时 slot 树已核实：`sidebar.workspaces`(single) 的子 slot 为 `session.menu.item`(list) / `session.row.action`(list) / `directoryFlow`(single)，`replaceRisk: shadows-shipped-ui`。
- web profile bundles：`dsh-base` / `dsh-web-app` / `dshmarket` / `dsh-better-sidebar` / `skill-explorer` / `dsh-context`。
- **无 priority 竞争** ✅：`dsh-better-sidebar@0.19.1` 只注入 `conversation.chat.turnTail` / `conversation.session.header.utilities` / `settings.section` / `sidebar.right.pane.tab(.title)`，完全不碰 `sidebar.workspaces`。

### 3.2 我们要注册的 slot ✅

```
sidebar.workspaces            single, scope: root, replaceRisk: shadows-shipped-ui
  owner props: { wide: boolean, expandSidebar: ... }
  渲染权（若 ❓1 成立）：
    sidebar.workspaces.session.menu.item   list   owner { sessionId, displayTitle }
    sidebar.workspaces.session.row.action  list   owner { sessionId, displayTitle }
    sidebar.workspaces.directoryFlow       single owner { open, busy, onPicked, onCancel, onError }
```

shadow 规则：同 cell 多 entry 按 **priority 升序、最低者渲染**，默认 0，同优先级二次注册抛错。**动态插件（`cordis_define`）由运行时就近分配负 priority，自动胜出**；静态插件必须显式负 priority。

### 3.3 数据源 ✅

`useSessions` → `SessionListState`：
```ts
{ ids: SessionId[], byId: Record<SessionId, SessionSummary>, current, phase, jobsBySession, ... }
```
`SessionSummary`：`{ id, title?, displayTitle, cwd?, parentId?, origin?: 'subagent', running, blank, updatedAt, retainedBy }`
——**无 group/tag 字段**，分组只能由插件自建。

`useWorkspaces` → `WorkspaceSnapshot`：
```ts
{ items: readonly WorkspaceView[], archivedSessionIds, pinnedSessionIds, state, phase, error }
```
`WorkspaceView`：`{ workspaceId, path, title, sessionIds: readonly SessionId[], createdAt, updatedAt }`

### 3.4 Host 动作（0.1.7 已核实）

| 能力 | 入口 |
|---|---|
| 打开会话 | **`ctx.uiWorkspace.openSession(id)`** |
| 新建会话 | `ctx.uiWorkspace.startSession(workspaceId?)` / `ctx.sessions.create({...})` |
| Fork | **`ctx.uiWorkspace.forkSession(id)`**（自带 inherited-title 递增） |
| 搜索 | `ctx.sessions.search(query, signal)` → `{ items, hasMore }`，`searchResultLimit = 20` |
| 重命名 | `ctx.sessions.binding(id).session.rename(title)` |
| 新建/改名/删除 workspace | `ctx.workspaces.create({path})` / `rename(id, title)` / `delete(id)` |
| workspace 排序 | `ctx.workspaces.insertBefore(id, beforeId?)` |
| 会话归属 workspace | `ctx.workspaces.insertSessionBefore(workspaceId, sessionId, beforeSessionId?)` |
| 归档 / 取消归档 | **`ctx.uiWorkspace.archiveSession(id)` / `unarchiveSession(id)`** |
| 置顶 / 取消置顶 | **`ctx.uiWorkspace.pinSession(id)` / `unpinSession(id)`** |
| **目录选择器** | **`ctx.uiWorkspace.pickDirectory(): Promise<string \| null>`** |

> ⚠️ **`ctx.sessions.open` 在 0.1.7 里不存在**（原型实测 `TypeError: ctx.sessions.open is not a function`）。0.1.7 的 `ISessions` 只有 `list / retain / using / retainInfo / create / subagentAddress / refreshProjections / refresh / search / fork / scope / scopeOf / sessionOf / binding / searchResultLimit`。交接文档里 `ctx.sessions.open(id)` 的写法来自 0.1.5 报告，已作废。
>
> 原生自己也不是直接调服务：`UiWorkspaceService.openSession()` → `sessions.retain(target, {source:"mainView"})` + 私有 `selection.set(...)` + `ctx.layout.selectPanel(null)`。**插件应直接注入 `uiWorkspace` 服务**，不要复刻这条链路。

### 3.5 `ctx.uiWorkspace` —— 侧边栏会话动作的唯一正门（原型期发现）

服务键 `uiWorkspace`（`super(ctx, "uiWorkspace")`），并通过 `declare module '@deepseek-ai/cordis' { interface Context { uiWorkspace: UiWorkspace } }` 正式并入 Cordis Context。接口见 `dsh-client-ui-workspace/lib/types/client/navigation.d.ts`：

```ts
openSession(target: SessionTarget): void
openWorkspace(workspaceId, beforeOpen?): Promise<void>
forkSession(sessionId): Promise<void>
connectWorkspace(workspaceId): Promise<SessionId>
startSession(workspaceId?): void
archiveSession(sessionId, options?: { stopActivity?: boolean }): Promise<void>
unarchiveSession(sessionId): Promise<void>
pinSession(sessionId): Promise<void>
unpinSession(sessionId): Promise<void>
pickDirectory(): Promise<string | null>      // Host 原生目录选择器
listDirectory(path?, signal?): Promise<DirectoryListing>
createDirectory(path, name): Promise<string>
```

**这是本方案最重要的一处发现**：

1. **行操作不必自己拼 host 调用。** `archiveSession` 自带「停止并归档」确认与 notice；`pinSession` 自带「pin 成功后领先其 accounts' saved orders」；`forkSession` 自带标题递增。这些正是交接文档 §4.5 列为"影子替换损失"的部分——现在大部分由这个服务承担。
2. **❓2 直接解决。** 「新建项目」= `await pickDirectory()` + `workspaces.create({ path })`，**不需要**复用 `sidebar.workspaces.directoryFlow` hole，也不需要自写目录浏览对话框。
3. 附带 `listDirectory` / `createDirectory`，将来若要自绘目录浏览也有官方途径。

### 3.6 原生的纯派生函数（复刻的规格来源）✅

`dsh-client-ui-workspace/lib/types/client/tree.d.ts` 导出了这些**运行时不可 import**（feature 包禁跨包 import 值），但 JSDoc 就是权威规格：

| 原生函数 | 语义（照抄） |
|---|---|
| `owningGroupKey(workspaces, sessionId)` | 返回 owning Workspace id，或 `UNGROUPED_KEY = ""` |
| `workspaceLabel(cwd)` | 目录显示名 = path 的 basename（两种分隔符都认）；无 basename 返回原始 cwd；未分组桶返回空标记 |
| `orderByRecency(sessionIds, summaries)` | 新→旧，**以 Session id 作确定性 tie-break**；无 summary 的成员暂时省略 |
| `reconcileManualOrder(memberIds, savedOrder, summaries, rowState)` | 保存的相对位置不变；**新的普通 fork 排在其来源之前**；缺失成员按 pin → fork 来源 → recency → 归档状态补序 |
| `pinCurrentBlank(order, currentBlank)` | 选中的 blank 会话置顶且不占重复位 |
| `SessionRowState` | `{ pinnedSessionIds, archivedSessionIds, archivedFilter }`，registry-global |
| `ArchivedFilter` | `'default' | 'show' | 'only'` |

原生 `SessionNode` 的字段语义（我们的行节点照此对齐）：
- `pinned`：在 registry-global pin 集，**领先其所在段，且只能在 pinned 行之间重排**
- `archived`：在 registry-global 归档集，**保留原位、显示为灰、不可打开**
- `blank`：临时空白会话，渲染层替换为本地化「新会话」标题；**只有选中的那个 blank 可见**
- `completed`：跑完后未被选中也未被打开（绿色完成提示点）
- `pendingInteraction`：`'approval' | 'plan-review' | 'question'`（MVP 可选）
- `hasActiveSchedule`：当前列表投影含活跃 Schedule 记录（MVP 可选）

### 3.7 框架纪律（写代码前必守）

- 组件永不见 `ctx`；数据只经五个 share（`PropsRuntime` / `PropsRenderSlots` / `PropsRenderFactories` / `PropsStore` / `InjectFace`）+ `PropsLocale`。
- inject 工厂只返普通数据 + 回调；响应式事实放 `hooks` 隔舱。
- 样式限 CSS Modules + clsx + `--dsw-*` token；共享控件只来自 `ui-primitives`。
- `/client` 入口只导出 `apply` / `inject`（+ `Config`）+ 类型 + store 工厂。
- **不得运行时 import / re-export 其他 feature 包的值**；共享声明用 `import type`。
- i18n 强制：`ctx.locale.register(NS, { zh, en })` + `declare module LocaleNamespaceMap`。
- `dsh.client.ui-workspace` 的 `./client` 入口**只公开** slot 契约类型（`SessionRowOwnerProps` / `DirectoryFlowOwnerProps` / `MenuOpenState` / `UseMenuOpenState` / `WorkspaceBrowserProps` 等），`tree.d.ts` 的派生类型**未公开** → 我们必须自建类型 + 自建函数。

---

## 4. 数据模型

### 4.1 类型

```ts
type GroupColor = 'red' | 'orange' | 'amber' | 'green' | 'blue' | 'violet' | 'neutral'

interface SessionGroup {
  id: string            // crypto.randomUUID()
  title: string
  color: GroupColor
  createdAt: number
}

interface GroupsState {
  groups: SessionGroup[]                          // 数组序 = 顶层序
  membership: Record<SessionId, string>           // 单归属；主键就是 sessionId
  orderByGroup: Record<string, SessionId[]>       // 组内手动序（含 '' = 未分组段）
  collapsed: Record<string, boolean>              // 段折叠偏好（组 id / 'ungrouped'）
}
```

### 4.2 关键不变量

1. **单归属**：一个 sessionId 在 `membership` 中最多一个值。
2. **membership 是唯一事实源**：组内序 `orderByGroup[gid]` 可能含残留 id（会话被删/归档），读取时按 `membership` 过滤，不写回。
3. **孤儿清理**：`groups` 里被解散的组，其 `membership` 条目必须删除（成员回未分组）；`orderByGroup[gid]` 一并删除。
4. **数组即顺序**：不用 sort_order 分数。理由见 §5.1。
5. **跨 workspace 合法**：`membership` 不引用 workspaceId，组内可混排不同项目的会话。

### 4.3 与业务数据的关系

客户端 join，不复制业务数据：

```
项目 Tab:   workspaces[].sessionIds  ──┐
                                     ├─► SessionListState.byId ──► 行节点
我的分组:   membership + orderByGroup ─┘
```

---

## 5. 排序与收敛

### 5.1 为什么用数组不用分数（对 ZCode 的刻意偏离）

ZCode 用「顶层 `sort_order` + 组内 `sort_order` + 步长 1000 + MIN-STEP 插顶」，因为它把每行写进数据库、想避免重写兄弟行。**我们是「改内存 view → 整份提交」模型**（宿主 settings 整值替换），分数只是存储表示，没有任何收益，却引入一整类边界 bug（步长耗尽、MIN-STEP 重基、并发提交分数冲突）。

原生 0.1.7 自己就是这么做的 ✅：`sessionOrderByAccount: Record<string, string[]>`——**手动序存的是数组，不是分数**。跟随原生。

→ **MVP 无排序算术，无 MIN-STEP，排序纯函数的单测目标从「分数运算」改为「收敛规则」。**

### 5.2 排序纯函数（要写单测）

```ts
// 把 movedId 移到 beforeId 之前；beforeId 为空 → 末尾；找不到 → 原样返回
moveBefore(ids: readonly string[], movedId: string, beforeId?: string | null): string[]

// 按 recency 投影（对齐原生 orderByRecency：新→旧，id 作 tie-break）
orderByRecency(ids: readonly SessionId[], byId: SessionListState['byId']): SessionId[]

// 收敛：保存序 + 现存成员 + 行状态（对齐原生 reconcileManualOrder）
reconcileManualOrder(
  memberIds: readonly SessionId[],
  savedOrder: readonly string[] | undefined,
  byId: SessionListState['byId'],
  rowState?: Pick<SessionRowState, 'pinnedSessionIds' | 'archivedSessionIds'>,
): SessionId[]

// 派生某个 account（组 / 未分组 / 平铺）的可见行序
visibleOrder(...): SessionId[]
```

**必须覆盖的单测用例**（ZCode 该功能零单测是教训）：

| 用例 | 期望 |
|---|---|
| 空 savedOrder | 全部成员按 recency 补序 |
| savedOrder 含已删除 id | 残留被丢弃，不动其余相对位置 |
| 新成员（无 summary） | 暂不出现，等 summary 到达 |
| fork 出的新会话 | 排在其来源之前，且不改变已存条目相对序 |
| pinned 行 | 领先所在段；`moveBefore` 只允许在 pinned 行之间移动 |
| archived 行 | 保留原位；`archivedFilter='default'` 时不可见 |
| 选中的 blank 会话 | 置顶且不占重复位 |
| `moveBefore` 目标不存在 | 原样返回（不抛错） |
| 移动到自身之后 | 原序不变 |

### 5.3 提交模型

所有交互归结为「改内存 view → 整份提交」：

```
用户在 UI 上移动/改色/解散
  → 本地 store 立即更新（乐观）
  → 一次 settings 写入整值 GroupsState
  → 失败回滚到上一份快照（每层有明确收敛条件）
```

---

## 6. 三个 Tab 的规格

### 6.1 Tab 壳

- 三个按钮：`项目` / `我的分组` / `平铺`，`role="tab"`，键盘左右方向键可切换。
- 选中态用 `--dsw-*` token，不用字色。
- 当前 Tab 持久化；默认「项目」。

### 6.2 「项目」Tab

**结构**：workspace 段头（标题 = `workspaceLabel(path)` 或 workspace.title）+ 会话行；不属于任何 workspace 的会话进「未分组」桶（`UNGROUPED_KEY = ""`，置末）。

**段头内容**：折叠箭头、标题、会话计数、hover 操作（重命名 / 删除 / 在此新建会话）。

**对话框**（MVP 就要，见决策 2.2）：
- 新建项目 → 触发目录选择流（见 §7.3），成功走 `createWorkspace({ path })`
- 重命名项目 → `rename(workspaceId, title)`
- 删除项目 → `delete(workspaceId)`，二次确认（只删注册，目录与会话日志保留）
- 移动到项目 → 右键菜单，`insertSessionBefore(workspaceId, sessionId, beforeSessionId?)`

**派生**：段序 = `WorkspaceSnapshot.items` 的 host 序（可 `insertBefore` 调整，MVP 不支持拖拽故不做 UI）；段内序 = `reconcileManualOrder(view.sessionIds, undefined, byId, rowState)`——原生不为 workspace 存 browser-local 序，直接用 host 的 `sessionIds` 序 + recency 收敛。

### 6.3 「我的分组」Tab

**结构**：自定义组段（按 `groups` 数组序）+ 末尾固定「未分组」段。

**组段头**：色条、标题、计数、折叠箭头、hover 操作（改名 / 改色 / 解散）。

**组操作**：
- 新建分组：段列表末尾追加，`color` 从色板顺序取下一个未用色
- 重命名：段头原地编辑（Enter 提交 / Esc 取消）
- 改色：色板 7 选 1
- 解散：二次确认 → 删除组 + 其 membership 条目（成员回未分组）+ `orderByGroup[gid]`
- 移动到分组：右键菜单，单选目标组；「移出分组」= 从 membership 删除

**派生**：
```
membership 反分组 → { gid: SessionId[] }
每组可见序 = visibleOrder(orderByGroup[gid], 该组成员, byId, rowState)
未分组段成员 = 全部会话 − membership 的键
```

### 6.4 「平铺」Tab

- 全部会话单列表，忽略分组与 workspace。
- `orderBy`：`manual`（用 `orderByGroup['__flat__']` 收敛）/ `updated`（recency）。
- 与「我的分组」共享同一个行组件与右键菜单。

### 6.5 搜索（MVP 轻量版）

- Tab 壳下一个搜索框，客户端过滤 `displayTitle` 子串（大小写不敏感）。
- 命中时三个 Tab 各自在自己的分组结构内过滤（不是跳转到搜索结果列表）。
- 不做 host 内容搜索（非目标）。

---

## 7. 行与行操作

### 7.1 行组件

每个会话行渲染：置顶图标（pinned）、标题（blank → 本地化「新会话」）、running 点、completed 绿点、归档置灰、hover 时行尾按钮条 + 「...」菜单触发。

### 7.2 行操作 —— 必须自己实现（❓1 已否决复用路线）

**曾经的可能**：shipped 的 pin / rename / fork / archive 都是 `sidebar.workspaces.session.menu.item` 的普通条目（order 100/200/300/400），archive + pin 也是 `sidebar.workspaces.session.row.action` 的条目（order 100/200）。若能 `renderSlot` 这两个 list，它们就连带重命名对话框、停止归档确认、行 toast 一起白送。

**源码级结论：此路不通。** 两道机制夹死：

| 机制 | 位置 | 效果 |
|---|---|---|
| 渲染权按 entry 自己的 `children` 授权 | `dsh-client-ui-renderer/lib/client.js` L331–332：`const declared = entry.children?.[key]; if (declared === void 0) throw new SlotOwnershipError(...)` | 影子占用者渲染子 slot 的前提是**自己声明过**它 |
| 子 slot 声明排他 | `dsh-client-ui-slots/lib/index.js` L191–194：`if (childRec?.spec) throw new Error('slot "..." is already declared (by ...)')` | 我们不能声明 shipped 已声明过的子 slot |

→ **影子替换 `sidebar.workspaces` 后，shipped 行操作与目录选择流全部不可达，必须自己实现。** 这与交接文档最初的判断一致。

### 7.2.1 因此 MVP 的行操作范围（走 `ctx.uiWorkspace`，见 §3.5）

| 操作 | 入口 | 备注 |
|---|---|---|
| 打开会话 | `ctx.uiWorkspace.openSession(id)` | 行点击 |
| 重命名 | `ctx.sessions.binding(id).session.rename(title)` | 自绘输入框或 `prompt` |
| Fork | `ctx.uiWorkspace.forkSession(id)` | 自带标题递增 |
| 归档 / 取消归档 | `ctx.uiWorkspace.archiveSession(id)` / `unarchiveSession(id)` | 自带停止归档确认与 notice；**必须自己按 `archivedFilter` 过滤**，否则按钮点了没效果 |
| 置顶 / 取消置顶 | `ctx.uiWorkspace.pinSession(id)` / `unpinSession(id)` | 自带「pin 后领先其 saved orders」；host-backed，**不需要自己存** |
| 移动到分组 / 移动到项目 | 自有菜单项 | §7.3 |

**原型已实测通过**（2026-09-24，经 browser-skill 借用用户 3080 页面）：pin / unpin / archive / unarchive 全部生效，host 快照经 `useWorkspaces` 回到组件（`pinned 1→2→1`、`archived 4→5→4`），pinned 行确实领先其段，`archivedFilter` 三态切换正常。

成本估算：约 150–200 行（含归档三态、pinned 领先、菜单开关与焦点）。

### 7.2.2 连带损失

`shell.overlay` 上的 shipped 对话框条目（重命名 / 停止归档确认 / 行 toast）**条目本身活着**（它们不是 browser 的子 slot），但驱动它们的 `requestSessionRename` 等回调在 shipped 行条目的 inject face 里，我们拿不到 → 实际不可用，需自绘。

### 7.3 我们自己的条目

- `移动到分组…`（仅「我的分组」/「平铺」Tab 显示）
- `移动到项目…`（三个 Tab 都显示）
- id 用包名命名空间，order 取 500+，避开 shipped 的 100–400
- 动作执行后用注入的 `useMenuOpenState` 关菜单

---

## 8. 持久化

### 8.1 主路径：宿主 settings

- 客户端 `ctx.settingsScope.bind(spec)` → `SettingsScope<T>`（`getSnapshot/set/unset/mutate`），写走 `ctx.remote.settings.mutate`。
- `persistence = ctx.remote.$host.isLoopback ? "host" : "memory"` ✅ → 本机 127.0.0.1 用 loopback，落 `~/.dsh/settings.yaml`。
- 收益：可备份、可跨浏览器、契合「整份提交」模型。

### 8.2 降级路径：localStorage

- 非 loopback（远程浏览器远控桌面）时宿主面降级为 memory，不保证持久 → 同时写一份 localStorage。
- 原型阶段（动态插件 import 不到 `defineStore`）**只用手写 localStorage**；阶段 2 再上 settings。

### 8.3 冲突与回滚

- settings 写入走 revision；冲突时以本地为准重试一次，再失败则保留本地并提示。
- 乐观更新失败 → 回滚到上一份 `GroupsState` 快照。

---

## 9. 派生规则汇总（复刻原生语义）

| 规则 | 语义 |
|---|---|
| 未分组桶 | 不属于任何 workspace 的会话，置「项目」Tab 末位 |
| pinned 领先 | pinned 行领先其所在段；只能在 pinned 行之间重排 |
| archived 保留 | 归档行保留原位、置灰、不可打开；`archivedFilter` 三态控制可见性 |
| blank 会话 | 只有选中的 blank 可见，且置顶 |
| fork 新会话 | 排在其来源之前 |
| recency | 新→旧，Session id 作确定性 tie-break |
| 无 summary | 暂时不显示该行 |
| 自定义组 | 独立于 workspace；组内可混排不同项目的会话 |

---

## 10. 模块划分

阶段 2 包结构（范本 `dsh-better-sidebar`：双半 + `dsh.bundle.patch` + `dsh plugin --profile <dev> add`）：

```
src/
  index.ts                  host 半，空 apply
  client/
    index.ts                apply：注册 store / 影子注册 sidebar.workspaces / 注册自有行条目
    stores.ts               createGroupsStore()（defineStore + persist）
    order.ts                排序纯函数（§5.2，含单测）
    derive.ts               项目分组派生 / 自定义分组派生 / 未分组桶 / 归档过滤
    components/
      Browser.tsx           Tab 壳 + 三个 Tab 分发
      SessionRow.tsx        行（renderSlot 两个 list + 自有条目）
      ProjectsTab.tsx       workspace 段 + 未分组桶
      GroupsTab.tsx         自定义组 + 未分组段
      FlatTab.tsx           平铺
      GroupHeader.tsx       组段头（色/改名/改色/解散）
      WorkspaceDialogs.tsx 新建/重命名/删除项目（含 directoryFlow）
      SessionMenu.tsx       右键菜单（移动到分组 / 移动到项目）
  locales.ts                zh / en
```

---

## 10.5 标准化改造完成（2026-09-29）

从「能装能跑的手写原型」改造成「符合发布规范的 npm 包」。产物在 `package/`，已装进 web profile 并浏览器实测通过。

### 与交接文档/原型的差异

| 规范项 | 原型 | 现在 |
|---|---|---|
| TypeScript | 无 | 全部 TS/TSX，`tsc --noEmit` **0 错误**（开 `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`） |
| 类型产物 | 无 | `lib/types/**/*.d.ts`（9 个文件） |
| 构建 | 手写 loader 格式 + `build.js` 文本注入 | `scripts/bundle-client.mjs`（rolldown）+ `scripts/build.mjs` 包装成 loader 格式 |
| 产物格式 | 近似 | **逐字对齐原生**：`window.__ModuleLoader__.load({id, factory})` + `var module={exports:{}}` + `exports.apply/inject` + `return module.exports` |
| 布局 | 源码在包根 | `src/` → `lib/`，`exports` 指向 `./lib/*` |
| `files` | 无 | 精确声明，`npm pack --dry-run` = **16 个文件 / 25.2 kB**，不含 src/node_modules/测试 |
| store | 手写 localStorage + 模块单例 + 手动订阅 | 框架 `defineStore({init, persist, actions})`（immer draft mutators） |
| i18n | 内联 zh/en 对象 | `locales.ts` + `declare module LocaleNamespaceMap` 合并，`t` 的 key 域收窄到字典；`en` 用 `Record<keyof typeof zh, string>` 强制中英 key 对齐 |
| CSS | 内联字符串 | `src/css/browser.css` 独立文件，构建期注入，运行期建 `<style data-plugin>` 标签（HMR 可按稳定 tag id 清理） |
| 测试 | 40 个 `node:test`，不在包内 | 同 40 个用例迁到 **vitest**，`npm test` 可跑 |
| README / LICENSE / icon.svg / `./src/*` 导出 | 全无 | 全有 |

### 踩过的坑（都是"把单一信息源当完整事实"）

1. **npm 装错版本**：`@deepseek-ai/*` 未指定版本时装到 `0.0.1-rc.1`/`0.1.2-alpha.2`。必须 `--save-exact` 钉到运行时的 `0.1.7-rc.1`，否则类型全是旧的。
2. **`Theme.listTokens` 不是全集**：漏了整套 `interactive-*`。选令牌要去原生编译 CSS 里捞。
3. **devDep 要装全，否则类型缺失**：`ctx.slots` 来自 `dsh-client-ui-renderer`、`ctx.uiWorkspace` 来自 `dsh-client-ui-workspace`、`useSessions` 来自 `dsh-client-ui-session` 的 `GlobalStandardProps` 合并、`sidebar.workspaces` 这个 SlotMap key 来自 `dsh-client-ui-sidebar`——这四个包少装任何一个，对应类型直接消失。
4. **`ActionsDecl<T>` 不接 interface**：interface 没有隐式索引签名，`type` 别名才有。
5. **store 状态不能 `readonly`**：`defineStore` 的 actions 是 `(draft: T, ...)`，`readonly` 会让 immer 的 `Draft<T>` 赋值失败。
6. **`LocaleNamespaceMap[N]` 要的是 key 联合，不是字典类型**（原生 `WorkspaceKey = keyof typeof zh`）。写成字典类型会让 key 域退化成 `string`。
7. **tsdown 的 `.ts` 配置在本机 Node 上加载不了**（已知 bug，连它自己的产物都解析不了）。绕过：直接用 rolldown 的 JS API。
8. **rolldown 没有 `define`**（那是 tsdown 层实现的）——用 transform 插件做占位符替换。
9. **rolldown 的 transform 插件不能整模块替换 CSS**：会破坏 runtime module 的 helper 符号。改用「构建期读 CSS 文件 + define 注入 + 字面类名」。
10. **`declare module '*.module.css'` 的文件不能有 import/export**：那会让它变成模块，通配声明退化成对既有模块的增强。

### 已知遗留

`window.prompt/confirm` 未换自绘对话框；诊断面板仍可切出；色板仍是 7 个语义令牌；未用 CSS Modules（类名靠 `dbs-` 前缀隔离）；拖拽排序未实现；持久化仍是 `defineStore` 的 localStorage（宿主 settings 接入是下一步）。

## 11. 阶段划分与验收

### 11.1 阶段 1：原型（已完成验证）

**形态**：`plugin_manager install_bundle` 装进 **web profile**（用户 2026-09-24 同意；动态插件路线在 0.1.7-rc.1 不存在）。产物在 `prototype/`，以 `link:` 形式挂进 profile。

**验证结果（2026-09-24，全部通过）**：

| # | 验证项 | 结果 |
|---|---|---|
| 1 | `priority: -1` 影子注册能否整块替换原生 browser | ✅ 原生整段消失，换成三个 Tab + 7 个 workspace 段 + 未分组桶 |
| 2 | `useSessions` / `useWorkspaces` 可达 | ✅ 实测 `sessions.ids = 76 / byId = 76`、`workspaces = 7` |
| 3 | owner props `{ wide, expandSidebar }` 到达 | ✅ `wide = true`；`expandSidebar` 是 `() => void`（契约 `SidebarSectionOwnerProps`） |
| 4 | `ctx.locale.register` + `t` | ✅ Tab 名中文渲染 |
| 5 | 子 slot 渲染权 | ✅ 运行时确认 **`props.renderSlot` 不存在**（未声明 children → 无渲染权），与源码结论一致 |
| 6 | `ctx.uiWorkspace` 行动作 | ✅ pin/unpin/archive/unarchive 全部生效，快照回传，pinned 领先其段，`archivedFilter` 三态正常 |
| 7 | Tab 切换 + localStorage 持久化 | ✅ 项目/平铺切换正常 |
| 8 | 「新建项目」入口 | ✅ 按钮已渲染；`pickDirectory` 已就位（`services = ... pickDirectory=function`） |

### 11.1.1 「我的分组」Tab 验证（2026-09-24 第二轮）

| 验证项 | 结果 |
|---|---|
| `+ 新建分组` 按钮 | ✅ |
| 段头：色块 + 折叠箭头 + 标题 + 计数 + `···` 菜单 | ✅ |
| 固定「未分组」段（无 swatch / 无菜单 / 不可解散） | ✅ |
| 「移动到分组…」（含色块 + 组名列表） | ✅ 组 1→2，未分组 76→75 |
| 「移出分组」（仅已归属某组时出现） | ✅ 组 2→1，未分组 75→76 |
| 折叠 / 展开 | ✅ `▾↔▸`，收起时段头与计数保留 |
| **localStorage 持久化（跨整页重载）** | ✅ 重载后 `groups = 1 / membership = 1`，组与成员复原 |
| 排序纯函数接入 | ✅ `build.js` 把 `lib/order.js` 注入 `client.js`，40 个单测覆盖的代码即线上代码 |

**接入方式**：`build.js` 读 `lib/order.js`，剥掉 `'use strict'` 与 `module.exports`，注入 `client.js` 的 `@@ORDER-BEGIN/END@@` 标记区。原因是 client 半的 `require` 只认模块表 id（包名），读不到相对路径——手写原型没法拆多文件互相 import，这个脚本就是 tsdown 打包步骤的最小替代品。**改了 `lib/order.js` 必须跑 `node build.js`。**

### 11.1.2 QOL 样式修正（2026-09-24 第三轮）

之前是"能看但难用"，有几处是功能性错误而非"未美化"：

| 问题 | 修正 |
|---|---|
| 诊断面板常驻侧边栏底部（调试脚手架混进产品 UI） | 默认隐藏，工具行里一个 `diagnostics ▼/▲` 开关切出 |
| `归档: default` / `新建项目` 用 `.dbs-tab` 样式，读起来像第 4、5 个 Tab | 移出 Tab 栏到独立 `.dbs-toolbar`，改用 11px 次级按钮样式 |
| 86 行每行都挂 `···`，全是视觉噪声 | 默认 `opacity:0`，`.dbs-row:hover / :focus-within / :focus-visible / [aria-expanded]` 才显示；段头菜单仍常驻（段少，不吵） |
| 段头 11px 灰字无层次 | 加 `text-transform:uppercase` + 底部分隔线 |
| 当前会话只有背景色 | 加 `box-shadow: inset 2px 0 0 var(--dsw-alias-brand-primary)` 左侧指示条 |
| 无滚动条预留（原生有） | `.dbs-body { scrollbar-gutter: stable }` |
| 行距 5px 偏挤 | 调 6px；折叠箭头给固定 10px 宽度防抖动 |

已验证：hover 出行操作、diagnostics 开关、当前行指示条均生效。

### 11.1.3 字体层级 / 折叠 / 指示器 / 按钮位置（2026-09-24 第四轮）

用户提出四点，全部落实并浏览器实测：

| 要求 | 修正 |
|---|---|
| Tab 字体要比 session 大 | 建立字号层级：**Tab 14px/500（选中 600）> session 行 13px > 段头 11px**。原来两者都是 13px，顶层导航没有权重 |
| 需要支持折叠/展开 | 项目 Tab 原先 `foldable: false`（箭头是装饰）。改为真折叠：段折叠偏好放**组件本地 state**（`projectFolded` Set），不混进 groups store——那是自定义分组的数据，workspace 折叠是纯视图偏好 |
| folder indicator 太小看不清 | 文本 `▾/▸` 在 9px 下糊掉 → 换成**内联 SVG chevron**（10px、1.4px 描边、圆角线帽），命中区从 10px 放大到 16px 并加 hover 底色；分组色块 8px→10px、圆角 2px→3px |
| 新建项目和新建分组位置要差不多 | 原先「新建项目」在工具行、「新建分组」在 groups body 顶部，两个位置。统一为**工具行同一个左首位槽**，按 Tab 上下文切换显示，都加 `+ ` 前缀。body 里那个位置不一致的按钮删除 |

**设计原则确认**：字号层级 = 14 / 13 / 11 三档；操作按钮一律走工具行，不混进 Tab 栏也不散落进 body；段折叠是视图偏好，按 Tab 分开存。

### 11.1.4 官方图标 + 交互热区 + 布局压缩（2026-09-24 第五轮）

**关键发现：`ui-primitives` 可以从浏览器模块表 require 到**（268 个导出）。之前一直用文本字符 `▸/▾/···` 是因为没试过——这是本轮的转折点。从此图标全部用官方组件，`color rides currentColor`、`size` prop 控尺寸。

| 要求 | 修正 |
|---|---|
| Tab 字体要比 session 大 | 14px/500（选中 600）vs session 13px vs 段头 11px。**段头也从 11px 提到 13px/500**——用户指出 folder 比 session 小且细，不合理 |
| folder title 也要能点着折叠 | 折叠箭头 + 色块 + 标题 + 计数合成**单个 `.dbs-head-toggle` button**，整条都是热区；段头菜单独立在右 |
| 汉堡按钮太靠右 + 要矩形热区 | 按钮 26×26、`border-radius:6px`；行 hover 时给淡底（热区可发现），按钮自身 hover 给 `outline:1px border-l2` 明确框；行右 padding 8px→4px |
| pin 用黑色方块 → 图钉 | `IconPinFillMedium`（置顶中）+ `IconPinOutlineMedium`（菜单里），`title="pinned"` |
| 组件缺 hover indicator | 统一 `.dbs-icon-btn`：26×26、hover 底色 + `box-shadow:inset 0 0 0 1px border-l2` ring、active 加深。**ring 用 border 令牌而非 drop-shadow**——AGENTS.md 禁字面颜色，没有阴影令牌可用 |
| 新建/归档/diag 单独一行不喜欢 | **整行撤销**。新建与归档改成两个图标按钮，右对齐进 Tab 行；二者占同一个右对齐槽按 Tab 上下文切换（语义对等，位置必须一致） |
| 归档三态 → 二态 | UI 只暴露 `showArchived` 布尔（图标随之翻转 archive↔unarchive），原生 `archivedFilter` 的 `'only'` 不暴露——用不到。**label 描述将要做的动作**，随状态翻转（显示↔隐藏） |
| diag 按钮铺张 | 改成区域**右下角浮动小按钮**（`position:absolute; right/bottom:8px`，30×30，齿轮图标），不占布局、不带文字。`.dbs-root` 相应加 `position:relative`，`.dbs-body` 底部留 34px 防遮挡 |

**踩坑**：一次性替换 Browser 尾部时把函数的收尾 `}` 吞了，`node --check` 报 "Unexpected token ','"。教训——大段替换后用括号深度自检（`净括号深度: 0`）再收工。

**浏览器实测通过**：官方图标全部渲染（图钉/加号/归档/齿轮/省略号/chevron）、Tab 行右侧图标按钮、整条段头点击折叠（`DSH-BETTER-SESSIONS · 9` 收起 9 行）、诊断 FAB 存在于右下角（`@e154 "诊断信息"`）。

**未实测**（浏览器 input 连续超时，按技能纪律停止重试）：归档开关翻转、汉堡 hover ring 的视觉效果。两项逻辑/CSS 已代码核对无误；ring 从 `inset box-shadow` 改成了 `outline` 以求更明确。

### 11.1.5 当前会话高亮失效 + hover 令牌选错（2026-09-24 第六轮）

用户反馈两点：list item 没有 hover indication、当前选中的对话 item 没有 highlight。**两条都是真 bug，不是"不够明显"。**

**Bug 1：`list.current` 在 0.1.7 里不存在。**
调研报告里 `SessionListState { ids, byId, current, ... }` 是 **0.1.5 的旧形状**。0.1.7 实际是：
```ts
interface SessionListState { ids; byId; phase; projectionsBySession }
```
没有 `current`。所以我 `data-current` 永远是 `"false"`——当前会话从来没高亮过。
正解（对齐原生 `mainSessionId()`）：**当前会话 = `byId` 里 `retainedBy.mainView > 0` 的那个**。
```ts
readonly retainedBy: Readonly<Partial<Record<SessionReferenceSource, number>>>
```
顺带这条也修好了 blank 会话过滤（原来 `current === undefined` 会把所有 blank 都滤掉）。

**Bug 2：hover 令牌在浅色主题下是空操作。**
我之前用 `--dsw-alias-bg-layer-1` 做 hover 背景。查主题实际值发现：
```
浅色：bg-base = bg-layer-1 = bg-layer-2 = bg-layer-3 = neutral-bluish-00 (#fff)   ← 全是同一个值
深色：bg-base = bluish-950, layer-1 = bluish-875                                  ← 有差别
```
所以浅色下 hover 背景等于没画，深色才生效。**`Theme.listTokens` 只返回 14 个令牌，漏了整套 `interactive-*`**，这是我没找对令牌的原因。

从原生 `ui-workspace` 的编译 CSS 里挖到正解——原生自己用的就是：
```
--dsw-alias-interactive-bg-hover        浅色 #2631480f / 深色 #ffffff14
--dsw-alias-interactive-bg-hover-solid  浅色 bluish-75 / 深色 bluish-800
--dsw-alias-interactive-bg-active       浅色 #2631481a / 深色 #ffffff24
--dsw-alias-interactive-bg-hover-accent 浅色 #26314824 / 深色 #ffffff3d
```
原生口径：`.sessionRow:hover, .sessionRow.selected { background: interactive-bg-hover }`（选中和 hover 同色）。我做得比原生更分明以满足"当前项要高亮"：

| 状态 | 背景 | 左侧条 |
|---|---|---|
| 静止 | transparent | 无 |
| hover | `interactive-bg-hover` | 无 |
| 按下 | `interactive-bg-active` | 无 |
| **当前会话** | `interactive-bg-hover-solid` | 2px `brand-primary` |
| 当前 + hover | `interactive-bg-hover-accent` | 2px `brand-primary` |

同步对齐原生的还有：行高 32px、圆角 8px、归档行走 `--dsw-alias-label-caption` 色（不再用 opacity+删除线）、含当前会话的段头用 `--dsw-alias-state-business-primary`（原生 `folderActive` 语义，新加 `data-contains-current`）。

**方法论教训（重要）**：`Theme.listTokens` 返回的 14 个令牌**不是全集**。选令牌前应该去原生包里有 `--dsw` 用法的编译 CSS 里捞，而不是只信 inspect 的列表。这次两个 bug 的根因一个是"信封旧字段"、一个是"信令牌不全",都属于同一类错误:**把单一信息源当成了完整事实**。

**遗留**：`ctx.sessions.open` 的 TypeError 已修；项目 Tab 的折叠未实现（`foldable: false`）；色板仍是 7 个语义令牌（见 §13.2）；`ui-primitives` 的共享图标未用（现用 `▸/▾/···` 文本字符）。

**发现并已修的问题**：`ctx.sessions.open` 在 0.1.7 不存在 → 改用 `ctx.uiWorkspace.openSession`（见 §3.4 警示）。

**开发循环**：改 `prototype/client.js` → 宿主经 symlink 感知 → 客户端 HMR 热更新，**无需重载页面**。（注意：**绝不要 reload 这个标签页**——DSH 的鉴权 token 在 URL 里，`replaceState` 清掉后重载即 401，页面变空。改动靠 HMR，不靠重载。）

**未验证**：`plugin_manager set_plugin enabled:false` 后原生恢复（未执行，避免再次扰动）；live slot 占用者详情（`Slots.listSubTree` 的 `root` 入参在本 harness 传不进去，两种类型都报 `"input" must be an object`）。

### 11.2 阶段 2：正式 npm 包

1. 搭包骨架（双半 + `cordis.patch.yml` + tsdown `clientBundle`）
2. **建独立 dev profile**（`dsh --profile dshdev --from-default-profile web`），`dsh plugin --profile dshdev add <pkg>`，**绝不直接装日常 profile**
3. store 落地（`GroupsState` + 排序纯函数含单测）
4. 「我的分组」Tab（§6.3）
5. 「项目」Tab（§6.2）
6. 「平铺」Tab（§6.4）
7. 右键菜单（§7.3）+ 搜索（§6.5）
8. i18n + 打包 + dev profile 验证 + 用户验收后再进日常 profile
9. 拖拽（二期）

---

## 12. 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| ❓1 子 slot 渲染权不成立 | **已证实不成立**（源码 + 运行时双重确认，见 §7.2）→ 行操作自己实现（+150–200 行） | 已按 `ctx.uiWorkspace` 实现并实测通过 |
| ❓2 directoryFlow 从影子组件渲染不出来 | **已证实不成立**（同一道授权机制），但**已被 §3.5 的 `pickDirectory()` 取代**，无需自写目录浏览 | 原型「新建项目」按钮已接 `pickDirectory()` |
| 上游 ui-workspace 行为漂移 | 影子替换后我们不复刻的行为持续流失 | 派生规则按 §9 对齐原生 JSDoc；版本升级时复核 `tree.d.ts` |
| 宿主 settings 非 loopback 降级 | 远程使用时分组不持久 | localStorage 双写（§8.2） |
| profile 第三方插件升级后占用 `sidebar.workspaces` | shadow 优先级冲突 | 当前已核实无竞争；升级后重新 inspect |
| 动态插件纯 JS 无类型 | 原型代码不可长期维护 | 原型只验链路，阶段 2 全部 TSX 重写 |

---

## 13. 未决问题

### 13.1 原型必须回答的（全部已回答）

1. ~~**❓1 子 slot 渲染权**~~ → **否**（源码 + 运行时双重确认）。`renderer/client.js` L331 只认 `entry.children`，`ui-slots/index.js` L191 禁止重复声明。原型诊断面板实测显示 `props.renderSlot 不存在（未声明 children → 无渲染权）`。行操作按 §7.2.1 走 `ctx.uiWorkspace`。
2. ~~**❓2 directoryFlow 复用**~~ → **否**（同一道授权机制），但**已被 §3.5 的 `ctx.uiWorkspace.pickDirectory()` 取代**，无需自写目录浏览对话框。
3. **❓3 原生恢复**：未执行。动态插件的 `cordis_stop` 在 0.1.7-rc.1 已无 Agent 工具（见 §14），对应手段是 `plugin_manager set_plugin enabled:false`。留到阶段 2 换 profile 时一并验。
4. ~~**❓4 owner props 到达方式**~~ → **两者都到达**：`wide = true`（boolean），`expandSidebar` 是 `() => void`（契约 `SidebarSectionOwnerProps`，见 ui-sidebar slots.d.ts L112–117）。56px rail 下的表现未测（需 `browser_assist` 缩窗）。
5. ~~**❓5 locale / store 可用性**~~ → **locale 可用**（`ctx.locale.register` + `t`，Tab 名中文渲染）；localStorage 手写方案可用（Tab 选择跨热更新保留）。
6. ~~**priority 语义**~~ → **静态 bundle 显式 `priority: -1` 稳定胜出**（shipped 为默认 0，single slot 最低者渲染）。

### 13.2 需求层未定（不阻塞阶段 2）

- `pendingInteraction` / `hasActiveSchedule` / `runningSubagentCount` 三个装饰信号 MVP 要不要做。
- 「平铺」Tab 是否需要独立的 `archivedFilter`（还是三个 Tab 共享一个）。
- 分组数据要不要提供导出/导入 JSON（宿主 settings 已可备份，可能不需要）。
- 色板 7 色的具体色值（要对齐 `--dsw-*` 语义令牌，不写字面色）。

---

## 14. 附：与交接文档的差异

| 交接文档说 | 本文档修正 |
|---|---|
| 需手动升级到 0.1.7-rc.1 | 已升级且在跑（✅ 核实） |
| pin 是 WorkspaceBrowser 私有 store 概念，要自己存 | 0.1.7 里 pin 是 **host-backed**（`pinSession`/快照 `pinnedSessionIds`） |
| shipped 行操作随 browser 入口卸载而消失，必须重实现 | **确认必须重实现**：`renderer/client.js` L331 的 `entry.children` 授权 + `ui-slots/index.js` L191 的声明排他，两道夹死（见 §7.2） |
| 行操作要自己拼 host 调用（`ctx.sessions.open` / `workspaces.archiveSession` …） | **不必**：`ctx.uiWorkspace` 服务（§3.5）把 open/fork/archive/pin 连同停止归档确认、notice、pin 后置顶一次做掉；`pickDirectory()` 还顺带解决了目录选择器 |
| 排序用「步长 1000 + MIN-STEP 插顶」 | 改用**数组存序**（原生 0.1.7 自己就是 `Record<string, string[]>`），消除排序算术 |
| 项目 Tab 约 150 行（只读派生） | 按决策改为重做原生那套，约 400 行 |
| 原型用动态插件（`cordis_define`/`cordis_run`/`cordis_stop`） | **该路线在 0.1.7-rc.1 不存在**：Agent 侧无任何工具创建动态定义（`dsh-cordis-host-runner` README："no model tool creates dynamic definitions"；`dsh-client-ui-cordis` 自标 "Historical"）。原型改为 `plugin_manager install_bundle` 装进 web profile，且**改源码经 HMR 热更新，绝不重载页面** |
| （交接文档未提及） | `ctx.sessions.open` 在 0.1.7 已移除，0.1.5 报告里的这个签名作废 |

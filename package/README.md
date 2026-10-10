# dsh-better-sessions

DSH Web GUI 左侧边栏的 **Session 自定义分组** 插件。

在保留原生「按 Workspace（项目）分组」结构的同时，支持用户自定义分组，以三个 Tab 呈现：

| Tab | 内容 |
|---|---|
| **项目** | 按 Workspace 派生的段 + 「未分组」桶，显示工作区名称并支持新建；保留已有项目会话序列 |
| **分组** | 用户自定义分组：建组、改名、7 色、折叠、移动到分组、移出分组；末尾固定「未分组」段 |
| **平铺** | 全部会话的单一列表 |

## 实现形态

**三 Tabs 影子替换**：整个 `sidebar.workspaces` cell 换成自己的组件。

DSH 没有「视图模式」插槽，`groupBy` 是 WorkspaceBrowser 的私有 store，插件扩不进去；要结构性展示只有整块替换。注册时用 `priority: -1`（低于 shipped 的 0），single slot 最低者渲染。

## 关键设计

**行操作遵循运行时服务合同。** 打开、分叉、归档与置顶使用 `ctx.uiWorkspace`；插件自行提供运行中归档确认和错误提示。重命名通过 `ctx.sessions.using` 保留并等待会话就绪，再检查服务返回结果；分叉后使用工作区插入接口维持父子相邻。开发 API 已对齐 `0.2.0-rc.2`。

**当前会话的判定。** 0.1.7 起 `SessionListState` 不再有 `current` 字段（0.1.5 的旧形状），当前会话 = `byId` 里 `retainedBy.mainView > 0` 的那个。

**手动序存数组，不存分数。** 跟随原生 `sessionOrderByAccount: Record<string, string[]>` 的选择：内存里始终维护有序数组，持久化时整份提交。因此没有 sort_order 算术、没有步长、没有 MIN-STEP——消除了一整类边界 bug。

**核心逻辑有回归测试。** 状态过滤、稳定顺序、分叉插入、标题显示、搜索、视图偏好、对话框与 SVG 图标均有测试；以测试命令实际报告的数量为准。

**图标使用内联 SVG**，继承 `currentColor`，不再猜测运行时未导出的图标组件名。

## 构建

```sh
pnpm install --frozen-lockfile
pnpm run build      # → lib/index.js + lib/client.js + lib/types/**
pnpm run test       # 回归测试
pnpm run typecheck  # tsc --noEmit
```

`lib/client.js` 是 `window.__ModuleLoader__.load({id, factory})` 包裹的 CJS bundle——宿主只服务 `/plugins/??<id>/client.js` 这个 combo，它期望的就是这个格式。原生由 DSH 仓库内的 `clientBundle()` 生成，那个 helper 不随 npm 包发布，所以 `scripts/bundle-client.mjs` 用 rolldown 复刻了它。

CSS 不走打包器：`scripts/bundle-client.mjs` 构建期读 `src/css/browser.css`，用 transform 把 `__DBS_CSS_TEXT__` 占位符替换成字符串字面量，运行期由 `apply` 建一个 `<style data-plugin="...">` 标签（HMR 按这个稳定 tag id 先删后注）。类名是字面量 `dbs-*`，单一事实源就是那个 CSS 文件。

## 安装

```sh
dsh plugin --profile <profile> add <package>
```

## 已知限制

- **对话框**：重命名、解散分组、运行中归档已使用可观察的 DOM 对话框；Desktop 专项验证仍需单独执行。
- **项目管理**：目前只有新建项目入口；项目重命名、删除、会话改归属和项目内新建入口未补齐，不宣称完整替代原生项目管理。
- **诊断面板**：默认隐藏，Tab 栏右侧齿轮按钮切出。含 `wide` / `expandSidebar` / 会话与分组计数 / 服务可达性，开发期有用，正式发布可移除。
- **色板**：只有 7 个语义令牌可复用（无专用分组色令牌），后两个近灰。
- **CSS Modules**：未使用（见上「构建」），类名靠 `dbs-` 前缀命名空间隔离。
- **拖拽排序**：未实现；分组已有序列保持稳定，分组行菜单提供上移/下移（搜索时禁用，不能跨越置顶分区；单元测试及 Web 上移/刷新持久化专项已通过）。项目与平铺不提供手动排序入口。
- **搜索与视图偏好**：支持标题搜索，过滤不重排；选中的 Tab 保存在浏览器本地。
- **持久化**：当前是 `defineStore` 的 `persist`（localStorage）。计划中的宿主 settings（loopback 下落 `~/.dsh/settings.yaml`，可跨浏览器/可备份）尚未接入。

## 开发说明

排序逻辑以 `src/client/order.ts` 及其回归测试为当前实现来源；历史原型不属于运行时构建输入。修改后运行类型检查、测试与构建；浏览器验收证据及尚未覆盖项见仓库根目录的 `WEB-ACCEPTANCE.md`。

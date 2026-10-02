# dsh-better-sessions

DSH Web GUI 左侧边栏的 **Session 自定义分组** 插件。

在保留原生「按 Workspace（项目）分组」结构的同时，支持用户自定义分组，以三个 Tab 呈现：

| Tab | 内容 |
|---|---|
| **项目** | 按 Workspace 派生的段 + 「未分组」桶，含工作区的新建/重命名/删除与改归属 |
| **分组** | 用户自定义分组：建组、改名、7 色、折叠、移动到分组、移出分组；末尾固定「未分组」段 |
| **平铺** | 全部会话的单一列表 |

## 实现形态

**三 Tabs 影子替换**：整个 `sidebar.workspaces` cell 换成自己的组件。

DSH 没有「视图模式」插槽，`groupBy` 是 WorkspaceBrowser 的私有 store，插件扩不进去；要结构性展示只有整块替换。注册时用 `priority: -1`（低于 shipped 的 0），single slot 最低者渲染。

## 关键设计

**行操作不自己拼 host 调用。** `ctx.uiWorkspace` 服务（`openSession` / `forkSession` / `archiveSession` / `pinSession` / `pickDirectory` …）把停止归档确认、notice、pin 后置顶一次做掉。这些正是影子替换后看似「损失」的部分。

**当前会话的判定。** 0.1.7 起 `SessionListState` 不再有 `current` 字段（0.1.5 的旧形状），当前会话 = `byId` 里 `retainedBy.mainView > 0` 的那个。

**手动序存数组，不存分数。** 跟随原生 `sessionOrderByAccount: Record<string, string[]>` 的选择：内存里始终维护有序数组，持久化时整份提交。因此没有 sort_order 算术、没有步长、没有 MIN-STEP——消除了一整类边界 bug。

**排序纯函数有单测。** `src/client/order.ts` 的 5 个纯函数由 `npm test` 的 40 个用例覆盖，语义规格对齐原生 `tree.d.ts` 的 JSDoc（运行时不可 import，JSDoc 即权威规格）。ZCode 的同类功能零单测，这是要避开的教训。

**图标用 `ui-primitives` 官方组件**，`color rides currentColor`；取不到时退回文本字符，绝不白屏。

## 构建

```sh
npm install
npm run build      # → lib/index.js + lib/client.js + lib/types/**
npm test           # 40 个排序纯函数单测
npm run typecheck  # tsc --noEmit
```

`lib/client.js` 是 `window.__ModuleLoader__.load({id, factory})` 包裹的 CJS bundle——宿主只服务 `/plugins/??<id>/client.js` 这个 combo，它期望的就是这个格式。原生由 DSH 仓库内的 `clientBundle()` 生成，那个 helper 不随 npm 包发布，所以 `scripts/bundle-client.mjs` 用 rolldown 复刻了它。

CSS 不走打包器：`scripts/bundle-client.mjs` 构建期读 `src/css/browser.css`，用 transform 把 `__DBS_CSS_TEXT__` 占位符替换成字符串字面量，运行期由 `apply` 建一个 `<style data-plugin="...">` 标签（HMR 按这个稳定 tag id 先删后注）。类名是字面量 `dbs-*`，单一事实源就是那个 CSS 文件。

## 安装

```sh
dsh plugin --profile <profile> add <package>
```

## 已知限制

- **`window.prompt` / `window.confirm`**：重命名和解散分组仍用原生对话框，未换自绘组件。
- **诊断面板**：默认隐藏，Tab 栏右侧齿轮按钮切出。含 `wide` / `expandSidebar` / 会话与分组计数 / 服务可达性，开发期有用，正式发布可移除。
- **色板**：只有 7 个语义令牌可复用（无专用分组色令牌），后两个近灰。
- **CSS Modules**：未使用（见上「构建」），类名靠 `dbs-` 前缀命名空间隔离。
- **拖拽排序**：未实现。MVP 用右键菜单「移动到分组」+ 段内 recency。
- **持久化**：当前是 `defineStore` 的 `persist`（localStorage）。计划中的宿主 settings（loopback 下落 `~/.dsh/settings.yaml`，可跨浏览器/可备份）尚未接入。

## 开发说明

改 `lib/order.js` 的逻辑时，注意 `src/client/order.ts` 的函数体是从已验证的 JS 原样搬来的（见 `REQUIREMENTS.md` §11.1.5），两边要同步改并跑测试。

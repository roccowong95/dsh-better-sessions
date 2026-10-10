# Better Sessions Web 验收记录

更新：2026-10-09。状态：自动化检查通过，真实浏览器已完成部分回归；未覆盖项仍待验收。

## 2026-10-10：官方弹窗与会话行改造

- 按官方 `origin === 'subagent'` 排除子代理，普通 `parentId` 分叉保留；共享过滤覆盖全部视图和归档模式。真实 Groups 列表未分组计数从184降至128，子代理标题不再出现。
- 官方 `Modal/Input/Button` 已复用；分组重命名弹窗只含一个可见标题，输入框无重复可见标签；保存按钮实际HTML为官方 primary class，取消正常。`react-dom/client` 显式external，避免打入私有React适配器。
- 官方 relativeTime 及本地化短标签显示更新时间，hover时切换为菜单/归档/置顶。稳定构建后，PLAYGROUND「解析goal作用及循环影响」真实hover→打开菜单后行尾时间消失；关闭菜单及移出后恢复17小时。
- PLAYGROUND快捷置顶按钮：置顶→取消置顶状态实际转换，再点击恢复原未置顶。未归档已有原始会话，未发送模型消息。
- observe树可能保留CSS隐藏按钮，不能仅凭树中出现按钮断言它们仍视觉可见；移出隐藏由CSS状态及时间恢复支持，不使用过往不可靠截图作证明。
- 181项测试、类型检查、构建通过。真实归档快捷按钮沿用已有安全归档操作，本轮未实际归档原会话；官方焦点/按钮外观的最终审美由用户确认。
- 浏览器窗口全部关闭；测试Web服务保留。Desktop配置未改。

## 隔离环境

- 使用用户指定的 `/usr/local/bin/dsh`，运行时版本 `0.2.0-rc.2`。
- Profile：`better-sessions-test`。
- Web 地址：`http://127.0.0.1:19401/`。需使用服务器启动时提供的带 token 地址登录；本文不保存 token。
- 插件：`@local/dsh-better-sessions`，链接本仓库 `package`。
- 浏览器插件：`@wxg-prc-cpg/browser-skill-dsh-plugin@0.3.2`。
- 没有替换日常 Desktop profile 中的插件。

## 已验证

- `pnpm run typecheck`：通过。
- `pnpm run test`：截至第二十八轮 100/100 通过（状态、顺序、图标、对话框、搜索、视图偏好与语言合同）；后文每轮记录保留当时测试总数。
- `pnpm run build`：通过。
- `git diff --check`：通过。
- 测试 profile 插件列表确认两个插件已安装。
- Web 服务无凭据请求返回 HTTP 401，说明端口响应且要求认证；这不是页面渲染通过的证据。

## 浏览器验收清单（截至第二十八轮，逐项证据见后文）

必须在有 browser skill 工具的测试 profile 会话中执行。仅使用 skill 注入的浏览器工具；先观察再操作，保留截图或观察结果，结束时停止浏览器 session。仅创建和修改测试数据，不操作日常会话。

| 项目 | 操作 | 预期 | 状态 |
| --- | --- | --- | --- |
| 图标与布局 | 打开侧栏，切换项目/分组/平铺，展开更多菜单 | SVG 可见、按钮不重叠 | 深色截图及 SVG HTML 已验证；菜单操作通过 |
| 主题与窄侧栏 | 使用正常界面控制切换主题、折叠侧栏 | 图标继承颜色，文字/选中态可辨识 | 窄侧栏通过；深色通过；浅色截图与 DOM 不一致待确认 |
| 置顶 | 置顶再取消置顶测试会话 | 列表响应，其他行相对顺序保持 | PLAYGROUND 菜单置顶/取消置顶通过，稳定分区单元测试通过 |
| 归档 | 归档测试会话，显示归档，再取消归档 | 默认隐藏，取消归档立即重现 | 通过（第六轮；运行中停止分支仅合同核查） |
| 重命名 | 对未打开的测试会话重命名 | 新标题出现；取消或空白输入不修改 | 通过：持久化标题、空白输入不保存、焦点定位后 Escape 取消 |
| 项目名称 | 展示既有工作区标题与目录回退 | 显示工作区标题，空标题回退目录名 | 组件回归通过；现有项目标签实际展示通过；创建/改名未测（PLAYGROUND 写范围限制） |
| 顺序与分叉 | 检查项目/分组已有顺序，分叉测试会话 | 手动相对顺序不被过滤重排；平铺按时间 | 项目分叉及重加载位置通过；纯排序回归通过 |
| 空白当前会话 | 创建并选择空白测试会话 | 当前空白行在前，无重复 | PLAYGROUND 当前 New Session 位于首行，排序回归通过 |
| 数据恢复 | 修改测试分组后刷新 | 分组状态恢复 | 通过（成员/折叠/颜色；第二十五轮手动排序重开保持及解散清理） |
| 搜索 | 标题查询及清除 | 过滤稳定、可清空 | 查询/清除按钮通过；Escape 浏览器效果仍未证实 |
| 分组手动排序 | 同分区上移及刷新 | 顺序持久化、搜索禁用 | 第二十四/二十五轮通过，临时组已清理 |
| 中文 | 切换语言、打开分组对话框 | 文案与按钮完整本地化 | 第二十七轮通过，语言已恢复 English |
| 错误检查 | 检查页面错误与浏览器控制台 | 无插件初始化失败或操作异常 | 第十三轮无插件错误；早期空白 fork 错误已加禁用防守 |

## 实际浏览器回归记录

后续会话已具备 `browser_*` 工具，使用 browser skill 操作 Web 页面。用户授权仅在 PLAYGROUND 工作区内进行写操作；未发送消息触发模型。

- 置顶及取消置顶：已在 PLAYGROUND 测试，菜单状态随操作切换。
- 归档：对 PLAYGROUND 中的空白测试会话执行归档，默认列表数量从 26 降至 25，测试行消失。
- 显示归档：切换后按钮变为 Hide archived sessions，PLAYGROUND 数量变为 34（包含原有归档）。恢复隐藏归档后数量回到 25。
- 视图切换：成功切换到 Groups，可见 UNGROUPED 列表与置顶状态；成功切换到 Flat，显示平铺会话与置顶标记，随后恢复 Projects。
- 最终自动化检查：类型检查通过、56/56 测试通过、构建通过。

上述只证明已观察到的路径。取消归档、重命名对话框、分叉、分组 CRUD/刷新恢复、平铺和主题/窄侧栏仍未完成实际浏览器验收；不将单元测试替代这些验收。归档的空白测试会话保留为测试痕迹，未删除已有会话。

## 本轮补充（持续验收）

- 在 Groups 新建测试分组成功，出现 NEW GROUP · 0。
- 将 PLAYGROUND 中当前空白 New Session 通过 Move to group 菜单移动到该测试分组，操作已提交；刷新后的持久化尚未验证。
- 点击 Rename 使用现有原生 prompt 后没有得到可操作的 DOM 输入框，不能据此判断重命名成功。正在改为可访问的页面内对话框，以补齐取消、空白输入、保存及错误路径验收。
- 刷新后官方 API-key onboarding 遮罩反复出现，Configure later 点击未得到稳定消失的观察证据。未填写凭据，未绕过遮罩；本轮关闭浏览器 session 后继续独立代码修复。

## 对话框修复后的补充证据

- 新增页面内 rename/confirmation 对话框，带标签、取消/保存、空白输入保护及 inline alert；运行中归档加入确认。
- 类型检查、构建通过；测试增至 62/62（新增 6 项对话框生命周期/保存/取消/错误回归）。
- 新浏览器窗口点击 Configure later 后成功进入页面。Groups 可见 NEW GROUP · 1，证明测试分组与成员在刷新/重开后恢复。
- 测试分组改名 DBS PLAYGROUND REGRESSION，填充 DOM 输入并 Enter 后列表标题立即更新。
- 同组 PLAYGROUND 空白会话改名 DBS regression temporary，填充 DOM 输入并 Enter 后页面标题更新为 DBS regression temporary — DeepSeek Harness。但侧栏仍显示 New Session，需继续排查空白会话标题投影/展示一致性，不能宣称此路径完全通过。
- 测试分组与测试会话暂保留，未删除。后续需恢复标题/分组或清理专用测试痕迹。

## 空白草稿回归修复

- 根因：SessionRow 无条件把 blank 会话渲染为 New Session，忽略持久化 title。现调整为只有无显式 title 的 blank 使用该占位标题。
- 实际重开浏览器后，Groups 列表与页面标题同时显示 DBS regression temporary，标题一致性修复已验证。
- 空白输入保存后取消，标题仍为 DBS regression temporary；未覆盖原题目。
- 对该测试草稿归档后，测试分组计数从 1 降到 0。
- 新发现：visibleOrder 原规则隐藏所有非当前 blank，导致归档草稿即使显示归档也不可达。现允许命名草稿及“显示归档”模式下的归档草稿出现，保持其他空白草稿隐藏；新增回归测试。
- 最终测试 66/66 通过，类型检查/构建通过、git diff --check 通过。新归档草稿可达性修复仍待浏览器验证与取消归档；测试草稿当前处于归档状态，分组保留。

## 第六轮实际回归

- 显示归档后测试分组数量 0→1，DBS regression temporary 可见，归档草稿可达性修复已验证。
- 对该草稿点击 Unarchive，然后隐藏归档，分组仍为 1 且标题可见；取消归档通过。测试草稿现为未归档状态。
- 点击 Fork 得到明确运行时限制：`session/fork-unavailable: session has no completed turn to fork from`；没有创建分叉。插件之前仅写控制台警告，现对 blank 会话禁用 Fork 并在回调中防守。该新禁用状态尚待浏览器验证；成功分叉需改用 PLAYGROUND 内已有完成回合的会话，不能发送模型消息来制造测试前置条件。
- 修改后类型检查、66/66 测试、构建、diff 检查全部通过。
- 刷新后官方 API-key onboarding 遮挡页面，Configure later 连续两次未消失，故停止此轮页面操作；未提供密钥或改动认证设置。此问题不据此归因于插件。

## 第七轮实际回归

- 新浏览器窗口可关闭 onboarding，继续测试；刷新时仍偶发无法关闭。
- 空白草稿 Fork 的实际 HTML 包含 `disabled=""`，且使用 currentColor SVG，禁用状态已验证。
- 在 PLAYGROUND 的“排查 SSH 密码登录失败”上点击 Fork，成功创建“排查 SSH 密码登录失败 (1)”，PLAYGROUND 数量 27→28。未发送任何模型消息，也未修改父会话内容；新增分叉保留待后续归档清理。
- 发现新分叉被运行时放在项目头部而非父会话之后；已在 fork 完成后读取当前 workspace membership 并调用 insertSessionBefore，把 child 写入父会话之后（排除 child 后取父会话下一项，父会话末尾则追加）。这项持久化位置修复尚待刷新后实际浏览器验证。
- 修改后类型检查、66/66 测试、构建通过。首次类型检查捕获错误 `Property 'getSnapshot' does not exist on type 'IWorkspaces'`，已按实际合同改为 `ctx.workspaces.list.getSnapshot()`，未绕过类型检查。

## 第八轮实际回归

- 修复后再次从 PLAYGROUND 原父会话“排查 SSH 密码登录失败”创建分叉，数量 28→29。观察顺序明确为：父会话 → 新建同名 (1) 子会话 → “比较两种模式的上下文变化”，不再把新 child 放到项目头部；位置修复通过即时浏览器验证，仍待刷新持久化验证。
- 两个本轮/上轮测试分叉均已通过 Archive 归档清理，未删除会话，未归档原父会话。测试草稿 DBS regression temporary 仍未归档。
- 测试分组 Next color 后折叠，重新打开浏览器，Groups 下测试分组仍为 1、aria-expanded=false，swatch 为 var(--dsw-alias-state-success-primary)，分组成员/折叠/颜色存储恢复有实际证据。随后展开恢复。
- 折叠侧栏时顶部变为 Open sidebar，但完整插件会话列表仍存在；已用 Open sidebar 恢复。这暴露 rail 适配仍有缺口，不宣称窄侧栏通过。

- 已补 rail 模式：wide=false 时不渲染完整 tabs/body，而显示 compact 展开按钮，使用 owner 的 expandSidebar 能力；类型检查、66/66 测试、构建与 diff 检查通过。此新 rail 行为仍待浏览器验收。

## 第九轮实际回归

- compact 侧栏通过：折叠后只显示 Projects 展开按钮，无项目/分组/平铺 tabs 或完整会话列表；点击插件 Projects 按钮后恢复完整侧栏，确认使用 expandSidebar 能力。
- 测试分组重命名为 DBS PLAYGROUND REGRESSION VERIFIED 后，标题即时更新、成员数量保持 1。
- 通过确认弹窗 Dissolve group 解散该测试分组，分组标题消失，UNGROUPED 数量 166→167，成员未被删除。测试分组清理完成；测试草稿仍保留在 PLAYGROUND 未归档。
- 页面上的确认/重命名 dialog 可操作，但浏览器 accessibility 快照将它作为页面末尾而不是独立 modal 层，需要继续审视焦点/可访问性。

## 第十轮主题核查

- 通过官方 Settings 将 Appearance 从 System 切换 Dark，实际截图侧栏文字、置顶/归档/新增 SVG、tab 选中态在深色背景可辨识。
- 切换 Light 后设置按钮 aria-pressed=true，但 screenshot 工具返回与 Dark 完全相同的 SHA256 `3e18ee63171719487b1e06c9246a46088842f766f3d5c26ec029e8de3a51702f`；不能据此证明浅色视觉通过（可能截图缓存或渲染问题，尚未归因）。已恢复原 System，不留下主题设置变化。
- 对话框此前使用未证实的 --text-primary/--bg-primary/--border token，现改用与插件 CSS 一致的 --dsw-alias-label-primary/--dsw-alias-bg-base/--dsw-alias-border-l1，输入边框同样对齐。
- 类型检查、66/66 测试、构建、diff 检查通过；对话框与浅色视觉还需继续浏览器确认。

## 第十一轮测试补强

- 在较小浏览器窗口再次测试 Light，截图出现已关闭的 onboarding，而 observe 显示正常插件列表，证明截图与实时 DOM 结果不一致。浅色视觉证据不可靠，不将缓存截图作为通过证据；已恢复 System。
- 将分叉位置计算抽成 nextAfterParent，并新增 4 项回归：runtime child 在头部、已相邻 child、父会话末尾、完成时最新兄弟顺序。读取当前 membership 后再计算，不沿用创建前旧位置。
- 最终类型检查通过、70/70 测试通过、构建及 diff 检查通过。

## 第十二轮归档与持久化核查

- 重开浏览器后显示归档，观察到原父会话“排查 SSH 密码登录失败” → 已归档的新 (1) child → “比较两种模式的上下文变化”。分叉位置在重新加载后仍保存，持久化排序验证通过；旧未修复的测试 child 仍在头部，两者均归档。
- 静态复核发现正在运行会话的确认只重新调用 archiveSession(id)，Host 仍会拒绝，确认没有实际效果。现文案明确“停止运行并归档”，仅确认 submit 路径传 `{ stopActivity: true }`；普通归档不传该选项。不启动模型运行来验证破坏性停止路径。
- 类型检查、70/70 测试、构建与 diff 检查通过。测试草稿仍未归档；未改动日常运行会话。

## 第十三轮键盘与错误核查

- 未打开的测试草稿通过行菜单打开 Rename session，再把焦点定位到原生 dialog 后按 Escape，弹窗关闭，未保存标题修改。未定位焦点时第一次 Escape 不关闭，不将其视为通过证据。
- 此轮控制台仅 chrome-extension://invalid 资源失败和官方 onboarding password/form 提示，没有 better-sessions 操作异常或初始化错误。
- 更新顶部清单归档、窄侧栏、分叉持久化与数据恢复状态，避免旧“待验收”误导；浅色主题仍不宣称通过。

## 第十四轮分组数据安全回归

- 新增分组 store 回归，覆盖解散元数据清理、跨组移动清除旧位置、移出到未分组、语义色完整轮转。
- 修复 init 返回共享 EMPTY 对象的问题：每次初始化均创建独立 groups/membership/orderByGroup/collapsed，新增实例隔离测试，避免多个 store 实例共享可变初始数据。
- 类型检查、74/74 测试、构建与 diff 检查通过。此轮未改动任何实际会话数据。

## 第十五轮测试数据清理

- 将唯一命名测试草稿 DBS regression temporary 归档，PLAYGROUND 默认数量 27→26，测试行消失。测试分组此前已解散、两个分叉已归档；原有用户会话均未删除，测试归档仍可恢复。
- 更新清单图标、重命名、项目标签、空白当前会话和错误检查的实际状态；创建/改名项目不扩展 PLAYGROUND 会话写授权，保留为未测。
- 完成核心路径并不代表 REQUIREMENTS 全功能完成：项目 CRUD/会话跨项目移动、可操作手动排序、搜索、宿主 settings 分组同步仍是功能缺口；本轮不会将其伪报为通过。

## 第十六轮并发数据防守

- createGroup 使用 crypto.randomUUID，避免短随机字符串碰撞导致分组身份混淆。
- moveSessionTo 在目标组已消失时不修改 membership 或已有位置，避免菜单打开后分组删除造成孤儿归属。
- setSectionOrder 对 ID 去重并保持首次位置，避免保存重复行；新增相应两项回归。
- 当前类型检查通过、76/76 测试通过、构建与 diff 检查通过；标题搜索由独立子代理实现中，本轮不重复编辑其组件/i18n/CSS 范围。

## 第十七轮错误反馈补齐

- pin/unpin/archive/unarchive/fork/createProject 失败不再仅 console.warn：增加可关闭的 role=alert 页面提示，显示操作及错误文本，使用 textContent 避免 HTML 注入，后续错误替换上一条，插件卸载移除。
- 对话框内 rename/确认错误仍使用原有内联 alert，不重复提示。
- 类型检查、76/76 测试和构建通过；diff 检查最初发现 EOF 空行，已修正且重跑通过。新增错误提示仍待实际浏览器故障路径验收。

## 第十八轮搜索初测

- 浏览器已看到带无障碍名称 Search session titles 的 searchbox；输入已归档测试草稿标题，默认隐藏归档时显示 No matching sessions，符合过滤语义。
- 子代理构建/HMR期间切换归档出现视图状态重置与 stale ref，未据此判断实现失败；已停止浏览器窗口，待最终稳定构建后验收全三视图与大小写/空格查询。
- 搜索实现仅做可见序列投影，不写 Host 会话数据或排序，读取显式 title/displayTitle。

## 稳定构建搜索浏览器验收

- 浏览器 hnjr：显示归档后，查询 ` dbs REGRESSION temporary ` 成功匹配 PLAYGROUND 的 `DBS regression temporary`；大小写/首尾空格归一化实际通过。
- 保留同一查询切换 Projects → Groups → Flat，三视图均只显示该测试会话；项目及分组计数均为 1，查询未丢失。
- 清空输入后恢复完整列表；随后关闭显示归档并恢复 Projects，结束并停止浏览器会话。未进行会话写操作或模型调用。
- 工具 press Escape 未观察到查询清空；不能宣称该键盘路径验收通过，已用 fill 空字符串完成清理。源码包含 Escape handler，但浏览器工具路径尚待复核。
- 稳定构建验证由实现子代理报告：typecheck/build/diff 检查通过，86/86 测试通过。

## 第十九轮搜索清理路径

- 稳定构建中再次点击聚焦搜索输入后发送 Escape，查询仍保留；改为 capture phase 并阻止默认行为/冒泡后工具路径依然无效。因此不将 Escape 标为通过，不推断一定是插件或工具故障。
- 增加中英文本地化 Clear search 按钮，实际浏览器点击后 searchbox 变为空、无结果提示消失、完整项目列表恢复。为输入与清空按钮补 flex 单行布局。
- 类型检查、86/86 测试、构建、diff 检查通过（随后仅补 CSS 单行布局）。本轮没有写入任何 Host 会话或触发模型，浏览器 cekk 已停止。

## 第二十轮归档操作无障碍与清空布局

- 已归档行原有打开行为被禁止但未向辅助技术暴露该状态；为打开按钮增加 aria-disabled，同时保留行操作菜单的取消归档入口。
- 新增 SSR 回归，分别断言归档/未归档按钮 aria-disabled=true/false。初次类型检查发现 react-dom/server 缺少声明，改用仓库现有 icons.test.ts 的 typed createRequire SSR 约定，不引入新依赖。
- 类型检查、87/87 测试、构建和 diff 检查通过。
- 实际浏览器 lmyl 对 PLAYGROUND 归档测试草稿 scoped HTML 确認 aria-disabled="true"。清空按钮在 flex 布局中位于输入右侧（点击 x=259,y=223），点击后查询清空，列表恢复。随后隐藏归档并停止浏览器。无 Host 会话写操作或模型调用。

## 第二十一轮视图偏好恢复

- 补齐原审查发现的 Tab 不持久化：仅保存 Projects/Groups/Flat 到当前浏览器 origin 的 localStorage，不保存搜索或触及 Host 数据。
- 对无效值、缺失存储、隐私/配额异常默认 Projects 或忽略写入，避免导航崩溃；新增 3 项测试。
- 搜索 SSR 测试原先 mock useState 的字面值 projects，lazy initializer 后失效导致 flat 排序断言失败；显式 mock preference reader 后恢复对三视图的正确覆盖，不修改排序逻辑。
- 类型检查、90/90 测试、构建和 diff 检查通过。真实浏览器 ieke：选择 Groups 后刷新，出现 New group + UNGROUPED，证明偏好恢复；最后切回 Projects 并停止窗口。无会话写操作或模型调用。

## 第二十二轮手动排序补齐启动

- 针对审查中的「只能保存序列、没有可操作排序入口」缺口，委派实现 Groups 行菜单 Move up/down。必须操作完整底层段序列，保留隐藏归档/置顶边界；搜索时禁用，项目与平铺顺序不变。实现尚在进行，未宣称测试或验收通过。
- 修正顶部验收摘要的旧测试数与置顶状态，保留历史逐轮证据。
- 查询当前 Client settings 服务未得到可用合同：Service.listService 超时并报告 no catalogued Service named "settings"；不猜测 Host settings 写接口，不直接编辑日常 settings 文件。

## 第二十三轮文档合同校准

- 更新 package/README.md：移除「完整项目管理」「服务自动处理停止确认」「官方组件图标」「原生 prompt/confirm」「40 测试」等已与实现不符的说法。
- 文档明确目前项目管理仍只有新建入口，Host settings 跨浏览器持久化及拖拽仍未实现；采用 pnpm lockfile 构建说明。
- `git diff --check` 通过；分组行排序子任务仍在运行，没有重复实现或宣称其通过。

## 第二十三轮补充：分组排序实现验证

- Groups（含未分组）菜单已加入本地化上移/下移，禁用状态同时在 DOM 与回调校验；Projects/Flat 不提供该操作。
- 调整完整段序列中的同置顶分区可移动项，保留隐藏归档、缺失摘要及当前临时空白行位置；搜索中不能写入排序。
- 类型检查、97/97 测试、构建、`git diff --check` 全部通过。新增 7 项纯函数/组件回归；构建输出 1535 行。
- 浏览器专项排序操作及刷新恢复尚待验收，不能据自动化检查宣称已通过。

## 第二十四轮实际分组排序回归

- 浏览器 session heze 打开测试 Web，Groups 搜索 PLAYGROUND 的「解析goal作用及循环影响」。菜单 Move up 的实际 HTML 为 disabled="" aria-disabled="true"，确认搜索禁用。
- 新建本地测试分组 NEW GROUP，仅将两个原本未分组的 PLAYGROUND 会话「解析goal作用及循环影响」「排查团队代理与侧栏任务图」移入。初始顺序为前者、后者。
- 对后者菜单执行 Move up，观察 NEW GROUP ·2 的顺序变为「排查团队代理与侧栏任务图」「解析goal作用及循环影响」，实际排序通过；未触发模型或修改其他项目会话。
- 刷新后 API-key onboarding 重现；两次 Configure later 后观察仍为模态，依照 browser skill 不重复未知效果，关闭浏览器。刷新持久化验证及解散测试组恢复成员仍待完成。
- 当前留下一个 NEW GROUP 本地测试组和上述两项成员；没有归档/改名/删除这两项已有会话。下一轮优先验证持久化并解散该测试组。

## 第二十五轮：排序持久化和测试数据恢复

- 新 browser session hfsw 成功跳过 API-key 引导。页面恢复 Groups，并显示 NEW GROUP ·2，顺序仍为「排查团队代理与侧栏任务图」「解析goal作用及循环影响」：证明上一轮上移在页面刷新及新窗口后保持。
- 通过分组菜单 Dissolve group 及 DOM 确认提交解散该临时组。观察 NEW GROUP 消失，UNGROUPED 数量 166→168；搜索「解析goal」确认原会话返回 UNGROUPED。没有删除/改名/归档这两项已有会话。
- 清除搜索并恢复 Projects，关闭 hfsw。该轮临时分组与成员变更已清理；实际排序及刷新恢复专项通过。

## 第二十六轮：产品字符串本地化收尾

- 分组重命名/解散确认的 Cancel/Save 以及段头 expand/collapse 改为 typed locale 字典，不再在中文界面混用英文按钮。
- 运行中归档确认文案从手动语言判断迁入同一字典，中文和英文合同一致。
- 类型检查、97/97 测试、构建、`git diff --check` 通过；构建 1545 行。未写入任何会话数据。中文浏览器语言切换专项仍待验证。

## 第二十七轮：中文浏览器专项

- 浏览器 kiim 通过 Settings 正常 Language 控件 English→中文。观察项目/分组/平铺、搜索标题、更多操作、置顶等均切换中文。
- 建空本地测试组；菜单显示重命名分组/换个颜色/解散分组。重命名 DOM 对话框观察到「重命名分组」「取消」「保存」，验证上一轮硬编码修复已加载；取消后未修改标题。
- 解散空测试组，确认未分组仍为168且临时组消失。设置语言恢复 English 并观察确认，恢复 Projects，关闭 kiim。未发送模型消息/修改任何已有会话内容。
- 中文界面专项通过；运行中归档确认仅字典及合同验证，未启动模型专门制造运行状态。

## 第二十八轮：语言合同回归与终审

- 新增 locales.test.ts 三项回归，验证中英文字典同键非空、插值占位符一致，以及中文对话框/排序/停止归档文案。
- 类型检查、100/100 测试、构建、`git diff --check` 通过。
- 已委派只读终审，检查状态/排序/对话框生命周期/错误路径，区分尚未承诺完成的功能限制与真实缺陷；终审结果待返回，尚不宣称整体完成。

## 第二十九轮：终审发现待修复顺序缺陷

- 终审指出 moveSessionTo 仅追加已保存目标序列：目标有实际成员但没有完整 saved order 时，写入 [moved] 将新成员排到既有未保存成员之前，与“追加目标末尾”意图不符；同组重复移动亦会重排。
- 当前未修复，下一轮需要把完整目标派生顺序传入动作并增加无已存顺序/部分顺序/同组 no-op 回归，不能据既有97/100测试宣称无缺陷。
- 更新顶部清单覆盖最近分组排序、中文和搜索证据；git diff --check 通过。只读终审仍继续检查其他路径。

## 第三十轮：移动目标序列修复已委派

- scoped 子任务开始修复 moveSessionTo 的完整目标序列与同组 no-op，要求保留隐藏成员并覆盖未分组/部分保存序列；尚在执行，未宣称通过。
- `npm pack --dry-run --cache .work/npm-cache` 通过，现有构建包包含 client/host 输出与声明（21 文件，31.6 kB tarball / 109.6 kB 解包）。此证据不替代待修复代码的最终构建。

## 第三十轮补充：终审生命周期和焦点修复

- 终审另发现异步失败在卸载后可能重新创建孤立 notice；已委派仅 index/生命周期 helper 的 scoped 修复，与移动排序子任务并行。
- 菜单重命名及确认操作现先聚焦持久的更多操作按钮，再关闭菜单并打开 dialog；避免捕获随后被 React 移除的 menuitem。涉及 SessionRow 与 GroupHeader，不修改会话数据。验证待两项并行子任务完成后统一运行。
- 仍保留浅色截图证据不可靠和 Desktop 未专项验收的限制，不将非插件故障当作已经修复。

## 第三十一轮：终审修复合入与证据边界

- 移动序列修复已完成：Browser 提供过滤前完整目标序列，包含隐藏归档及无 summary 成员；动作严格同组 no-op、拒绝过期目标、去重并追加。新增8项回归（stores 共14项）。
- 生命周期修复已完成：卸载先设置 disposed，再清理通知；迟到错误不创建 UI，fork/picker await 后停止后续插件操作，不撤销已开始的 Host 操作。新增13项 actual apply mocked 测试。
- 两子任务各自报告121项全套测试与类型检查通过；captain 集成检查遭第三个并行焦点测试尚未完成的 TypeScript fixture 错误，已反馈，不能把尚未完成的最终检查当作通过。
- README 更正已完成的排序浏览器证据和历史原型构建说明。下一轮需收齐焦点子任务、统一构建/测试，再进行移动路径最小浏览器回归。

## 第三十一轮最终集成检查

- 焦点子任务完成12项 hook-mocked 回归，覆盖行重命名/归档、组重命名/解散，以及 trigger/wrapper 缺失路径，验证 focus → close → callback 顺序。
- captain 统一执行 `pnpm run typecheck && pnpm run test && pnpm run build && git diff --check`，全部通过；12测试文件/133项测试，构建1564行 client bundle。
- 先前并行测试 fixture 类型错误已修正。仍需要对最新移动路径做真实浏览器复验；不将mock测试替代浅色主题或 Desktop 专项。

## 当前限制

初始会话缺少 browser 工具的问题已解除。回归仍需要继续完成上表未覆盖路径；上表原始待验收状态仅由本节所列证据部分覆盖。

Desktop 原生目录选择器、对话框、重启恢复属于后续专项验收，本记录没有证明其通过。

# 侧栏六项体验修复与验收

用户反馈：2026-10-09。目标：修复并实际验收，保护 Desktop 与会话数据；写入仅限授权 PLAYGROUND。

## 六项清单

| 问题 | 根因/调查 | 状态 |
|---|---|---|
| 侧栏拖拽宽度 | exact 0.2.0-rc.2 AppFrame 已有 [data-side="sidebar"] 原生手柄，默认280、264–420px，whole grid 更新；无公共width setter | 将增强原生手柄可发现性；真实拖拽未验收 |
| item 顶底 10% 点击无效 | row 容器与内部 open 按钮热区不同，需菜单隔离及完整行点击 | 修复中，浏览器尚未复现 |
| explorer 底色突兀 | dbs-root 明确设置 bg-base，不继承侧栏底色 | 截图复现，修复中 |
| 底部横向滚动条 | 检查 row width100% + padding 的盒模型与 flex min-width | 修复中 |
| hover/current 对称与截断 | 用户澄清是高亮圆角矩形右侧被裁切，不是文字截断；左右均保留外侧间距和完整圆角，hover更多按钮在同一高亮矩形内；窄宽也必须成立 | 修复中 |
| 两个 clear cross | search input 原生取消按钮 + 插件自定义取消按钮 | 实际截图复现，修复中 |

## 首轮实际观察

- 使用原独立验收 Web 服务 http://127.0.0.1:19401/，browser session xhbw，已关闭。
- 输入 regression 后截图清晰显示输入框内原生叉与框外插件叉同时存在；explorer 背景为不同于周围侧栏的深色矩形。
- 当前页面所有项目计数为0，尚无可点击会话行，因此未宣称边缘点击已复现；需要检查实际目录加载状态后继续。
- 未发送模型消息，未修改任何会话，不改 Desktop 配置。

## 宿主宽度与当前复现限制

- 只读检查 exact installed dsh-client-ui-layout/lib/client.js：原生 handle pointer capture + rAF + pointerup flush，whole sidebar grid 更新。保留宿主机制，不用私有 panels.actions 或独立 explorer 宽度。
- browser tuns 实际 hover [data-side="sidebar"] 成功，位置 x280/y601，证明手柄存在但不证明拖拽成功。工具无拖拽/pointer down-move-up API，不能伪造拖拽通过。
- 原生不支持键盘宽度和宽度持久化；收起重开恢复280，viewport<1024 auto-collapse，均为宿主当前行为。
- 诊断显示 sessions.ids=0/byId=2、workspaces=9、pinned=5/archived=21。尚未查明当前 catalog 未加载原因，行点击测试暂不能执行。无模型消息/会话写入。

## 第二轮修复与检查

- CSS/SessionRow 修复已完成，增加9项热区/布局回归；统一类型检查和142项测试通过。
- 构建首次发现旧 CSS 注入器只转义双引号，却插入单引号 JS 字符串，新增选择器的单引号触发 PARSE_ERROR。现替换完整字符串字面量为 JSON.stringify(css)，构建及 git diff --check 通过。
- native resize 热区扩大为居中12px并增加hover/active语义色细线，保留宿主指针处理器与真实whole-grid宽度更新。
- browser nziz 输入regression后 observe/HTML确认真实值和唯一自定义“清空搜索”按钮；截图却显示English/空输入而实际observe为中文/非空，截图与DOM再度不一致，因此不把该截图作为双叉消失或行高亮视觉验收证据。
- 当前会话列表仍空；nziz已关闭。下一步排查会话目录加载，复验行点击及实际视觉；拖拽需要真实人手操作或受支持drag工具，不能伪造通过。

## 第三轮：验收环境与构建回归

- browser hqqx 通过正常界面选择 playground，列表仍为0，未发送消息；未反复启动/删除测试会话绕过目录异常。已委派只读调查 Session list 契约/加载路径。
- CSS 注入完整字面量修复另委派专项回归，覆盖引号、换行、反斜杠和 replacement-string 元字符，避免主题选择器再次导致构建失败。
- hqqx已关闭；原native拖拽仍需要真实用户gesture，当前尚无实际拖拽证据。后续若目录环境无法恢复，会明确说明不能完成边缘点击/高亮实际验收，而不把代码检查当成完成。

## 第四轮：原生拖拽人手协助状态

- browser fnmd 的原生 [data-side="sidebar"] 目标匹配成功。发起真实鼠标协助拖拽，帮助请求返回 timed_out，没有获得用户操作或宽度变化证据；未重复请求，也未伪造pointer事件绕过工具限制。
- fnmd已关闭。真实拖拽仍待用户手动确认；行列表为空的只读调查继续。

## 构建专项最终结果

- CSS 注入使用单次正则匹配完整引号 placeholder + replacement callback，JSON.stringify 保留原文，不解释 $&/$$/$`/$'，也不会再次替换CSS自身包含的placeholder。
- 新增16项构建转义回归。captain统一类型检查、158/158测试、构建及git diff --check全部通过。子任务无依赖/运行时/会话数据修改。

## 第五轮：目录恢复与实际点击

- 仅重启自己管理的独立验收 Web job：bash-333停止，新bash-491监听原19401；没有改运行时安装/配置或会话数据，不动Desktop。启动登录token不记入本文。
- browser isra 恢复真实目录，PLAYGROUND25。折叠无关项目仅改变当前视图；点击PLAYGROUND「解析goal作用及循环影响」成功，RootWebArea标题随之切换，未发送消息/改会话内容。
- hover该行后截图仍显示旧空目录，和当前observe/操作结果矛盾；因此只记录普通中心点击通过，不把截图当hover/边缘百分比点击或高亮视觉通过。
- isra已关闭。新验收服务继续运行，下一轮可用恢复的真实行进行边界/菜单验证；拖拽尚待用户gesture确认。

## 第六轮：菜单隔离实际回归及截图限制

- browser zszj 搜索「解析goal」，真实DOM为PLAYGROUND1；更多按钮可打开菜单，RootWebArea维持同一会话，未意外触发行切换。未执行重命名/归档等写操作。
- cropped screenshot @e13（真实按钮是会话行）却返回PLAYGROUND段头图，证实连ref裁剪截图也与当前DOM不对应。因此不能用截图坐标点击行顶部/底部，避免误操作。
- zszj已关闭。六项代码与158项测试已完成，普通点击/菜单隔离已实际通过；剩余是精确边缘坐标点击、highlight四圆角/横条/单叉视觉与原生真实拖拽，工具现有能力不能可靠证明。需要用户直接观察最新测试页反馈，或恢复可靠截图/drag能力，不能无限重复无效截图。

## 执行安排

- scoped 子任务处理 CSS/SessionRow 和测试：点击热区、透明背景、横向溢出、高亮、单一清除按钮。
- 独立只读子任务核查侧栏 resize 接口/宿主布局。
- 子任务完成后统一构建并逐项浏览器验收；未复现和工具限制明确记录，不以测试替代浏览器结论。

/**
 * i18n 字典与命名空间声明合并。
 *
 * 纪律：所有产品可见字符串必须走 typed locale 字典，经 `t` 座位到达，
 * 不允许组件里出现裸中文字面量（`window.prompt` 的原生对话框除外，
 * 阶段 2 会换成自绘对话框后一并收干净）。
 */

export const NS = 'better-sessions'

export const zh = {
  'tab.projects': '项目',
  'tab.groups': '分组',
  'tab.flat': '平铺',

  'search.label': '搜索会话标题',
  'search.clear': '清空搜索',
  'search.placeholder': '搜索会话标题…',
  'search.noResults': '没有匹配的会话',

  'group.ungrouped': '未分组',
  'group.new': '新建分组',
  'group.rename': '重命名分组',
  'group.color': '换个颜色',
  'group.dissolve': '解散分组',
  'group.dissolveConfirm': '解散「{name}」？其中的会话会回到「未分组」。',
  'group.defaultName': '新分组',

  'action.newProject': '新建项目',
  'action.cancel': '取消',
  'action.save': '保存',
  'action.expand': '展开',
  'action.collapse': '折叠',
  'arch.runningConfirm': '此会话正在运行。停止运行并归档吗？',

  'move.toGroup': '移动到分组',
  'move.out': '移出分组',

  'menu.moveUp': '上移',
  'menu.moveDown': '下移',
  'menu.rename': '重命名',
  'menu.fork': 'Fork',
  'menu.archive': '归档',
  'menu.unarchive': '取消归档',
  'menu.pin': '置顶',
  'menu.unpin': '取消置顶',
  'menu.more': '更多操作',
  'menu.dissolveGroup': '解散分组',

  'row.newSession': '新会话',
  'row.pinned': '已置顶',

  'time.now': '刚刚',
  'time.minutes': '{n}分钟',
  'time.hours': '{n}小时',
  'time.days': '{n}天',
  'time.months': '{n}个月',
  'time.years': '{n}年',

  'arch.label': '显示已归档会话',
  'arch.hide': '隐藏已归档会话',

  'diag.title': '诊断信息',
  'prompt.renameSession': '重命名会话',
  'prompt.renameGroup': '重命名分组',
} as const

export type BetterSessionsLocale = typeof zh
/** i18n key 联合——`LocaleNamespaceMap` 要的是这个，不是字典类型。 */
export type BetterSessionsKey = keyof typeof zh

/** 命名空间合并：让 `t` 的 key 域收窄到本字典。 */
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'better-sessions': BetterSessionsKey
  }
}

export const en: Record<keyof typeof zh, string> = {
  'tab.projects': 'Projects',
  'tab.groups': 'Groups',
  'tab.flat': 'Flat',

  'search.label': 'Search session titles',
  'search.clear': 'Clear search',
  'search.placeholder': 'Search session titles…',
  'search.noResults': 'No matching sessions',

  'group.ungrouped': 'Ungrouped',
  'group.new': 'New group',
  'group.rename': 'Rename group',
  'group.color': 'Next color',
  'group.dissolve': 'Dissolve group',
  'group.dissolveConfirm': 'Dissolve “{name}”? Its sessions return to “Ungrouped”.',
  'group.defaultName': 'New group',

  'action.newProject': 'New project',
  'action.cancel': 'Cancel',
  'action.save': 'Save',
  'action.expand': 'Expand',
  'action.collapse': 'Collapse',
  'arch.runningConfirm': 'This session is running. Stop its activity and archive it?',

  'move.toGroup': 'Move to group',
  'move.out': 'Remove from group',

  'menu.moveUp': 'Move up',
  'menu.moveDown': 'Move down',
  'menu.rename': 'Rename',
  'menu.fork': 'Fork',
  'menu.archive': 'Archive',
  'menu.unarchive': 'Unarchive',
  'menu.pin': 'Pin',
  'menu.unpin': 'Unpin',
  'menu.more': 'More actions',
  'menu.dissolveGroup': 'Dissolve group',

  'row.newSession': 'New Session',
  'row.pinned': 'Pinned',

  'time.now': 'now',
  'time.minutes': '{n}min',
  'time.hours': '{n}h',
  'time.days': '{n}d',
  'time.months': '{n}mo',
  'time.years': '{n}y',

  'arch.label': 'Show archived sessions',
  'arch.hide': 'Hide archived sessions',

  'diag.title': 'Diagnostics',
  'prompt.renameSession': 'Rename session',
  'prompt.renameGroup': 'Rename group',
}

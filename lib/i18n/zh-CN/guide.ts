/**
 * lib/i18n/zh-CN/guide.ts · 引导「以前在 Kommo → 现在在这里」(SDD-0589)。
 *
 * 是否在 zh-CN 显示引导仍待 Sam 决定(9.1 的问题 S-3)。键必须在两种语言中
 * 都存在,所以这里提供译文;如果决定隐藏,只需在引擎中关闭该语言。
 */

import type { GuideDict } from "../es-VE/guide";

export const guide: GuideDict = {
  // ── 引擎控件 ──
  "guide.chrome.toggle": "引导",
  "guide.chrome.toggle_on_aria": "显示本页面的引导",
  "guide.chrome.toggle_off_aria": "隐藏引导",
  "guide.chrome.welcome.title": "以前在 Kommo 做的事,现在这样做",
  "guide.chrome.welcome.body":
    "我们用几个步骤展示每项任务。你可以随时关闭,并通过「引导」按钮重新打开。",
  "guide.chrome.next": "下一步",
  "guide.chrome.prev": "上一步",
  "guide.chrome.close": "关闭",
  "guide.chrome.step_of": "第 {n} 步,共 {total} 步",
  "guide.chrome.label_before": "以前在 Kommo",
  "guide.chrome.label_now": "现在在这里",
  "guide.chrome.dont_show": "不再显示",
  "guide.chrome.resume": "从上次的位置继续",
  "guide.chrome.restart": "从头查看引导",
  "guide.chrome.missing_target": "这部分已经换了位置。请继续下一步。",
  "guide.chrome.done": "完成",
  "guide.chrome.close_aria": "关闭引导",
  "guide.chrome.card_aria": "页面引导",
  "guide.chrome.announce": "引导,第 {n} 步,共 {total} 步:{title}",
  "guide.chrome.closed": "引导已关闭",

  // ── 演示路线 · 仪表盘 ──
  "guide.dashboard.welcome.title": "你在 Studio 的首页",
  "guide.dashboard.welcome.what":
    "这是登录后的第一个页面:问候、日期和你正在操作的公司。",
  "guide.dashboard.welcome.now": "从这里通过左侧菜单进入各个模块。",
  "guide.dashboard.kpis.title": "今天的数字",
  "guide.dashboard.kpis.what":
    "每张卡片汇总一项运营指标。你只能看到你的角色可以查看的指标。",
  "guide.dashboard.kpis.now": "进入时先查看。如果某项指标还没有数据,会显示一条横线。",
  "guide.dashboard.configure.title": "选择要看的内容",
  "guide.dashboard.configure.what": "由你决定显示哪些指标和面板,以及它们的顺序。",
  "guide.dashboard.configure.now":
    "点击「Configurar」按钮,打开你想看的内容并排序。设置会自动保存。",
  "guide.dashboard.panels.title": "你的面板",
  "guide.dashboard.panels.what": "数字下方是你启用的面板,例如最近动态。",
  "guide.dashboard.panels.now":
    "从各个面板进入对应记录。如果一个都没有,请在「Configurar」中启用。",
};

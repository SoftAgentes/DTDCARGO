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

  // ── 各页面路线(9.5),临时译文(S-3 仍待决定)──
  // 收件箱
  "guide.inbox.reply.title": "回复一条 WhatsApp",
  "guide.inbox.reply.what": "WhatsApp、Instagram、Messenger 和邮件都汇集在这里。打开对话,在下方回复。",
  "guide.inbox.reply.before": "以前你在 Kommo 里打开线索的聊天并在那里回复。",
  "guide.inbox.reply.now": "进入 Bandeja,选择对话,在下方输入并点击发送。客户会在原来的号码收到。",
  "guide.inbox.email.title": "回复一封邮件",
  "guide.inbox.email.what": "公司的邮件会作为一条对话进来,保留邮件往来和附件。",
  "guide.inbox.email.before": "以前邮件不经过 Kommo:在 Hostinger 的邮箱里单独回复。",
  "guide.inbox.email.now": "按「邮件」筛选或打开对话。你的回复从公司地址发出,并留在同一封邮件往来中。",
  "guide.inbox.search.title": "查找联系人并查看历史",
  "guide.inbox.search.what": "可以按姓名、电话或邮件查找。能看到他所有的对话,包括 Kommo 里的。",
  "guide.inbox.search.before": "以前你在 Kommo 里查找联系人,再打开他的线索查看聊天。",
  "guide.inbox.search.now": "在搜索框中输入并打开联系人。你在 Kommo 里的对话在「Archivo Kommo」收件箱中,带有日期和作者。",
  "guide.inbox.assign.title": "分配一条对话",
  "guide.inbox.assign.what": "每条对话都有一位负责人。这样就不会有两个人回复同一件事。",
  "guide.inbox.assign.before": "在 Kommo 中,负责人是线索的「负责用户」。",
  "guide.inbox.assign.now": "在对话中点击「分配」并选择人员。也可以分配给你自己。",
  "guide.inbox.templates.title": "发送一个模板",
  "guide.inbox.templates.what": "如果客户超过 24 小时没有发消息,WhatsApp 只允许发送已批准的模板。",
  "guide.inbox.templates.before": "以前模板在 Kommo 的「自动化 → 模板」中。",
  "guide.inbox.templates.now": "在聊天中打开「模板」,选择一个并填写所需内容。文字与 Kommo 中的相同。",
  "guide.inbox.note.title": "留下一条备注",
  "guide.inbox.note.what": "私密备注只给团队看。客户看不到。",
  "guide.inbox.note.before": "以前你在 Kommo 的线索里写备注。",
  "guide.inbox.note.now": "从「回复」切换到「私密备注」,输入并保存。它会留在对话中,并标记为内部。",
  "guide.dtdcard.panel.title": "什么是 DTD 档案",
  "guide.dtdcard.panel.what": "在聊天旁边就能看到这位客户在 DTD 的信息:资料、货运和报价。",
  "guide.dtdcard.panel.before": "以前要查看货运,你得离开 Kommo,去 Studio 里查找。",
  "guide.dtdcard.panel.now": "打开对话右侧的「Ficha DTD」标签页。不用离开聊天。",

  // 销售漏斗
  "guide.pipeline.board.title": "看板",
  "guide.pipeline.board.what": "每张卡片是一条线索。每一列是销售的一个阶段。",
  "guide.pipeline.board.before": "以前是 Kommo 里的「Ventas DTD」漏斗。",
  "guide.pipeline.board.now": "从 Studio 菜单进入漏斗。阶段是 DTD 的,线索已经从 Kommo 导入。",
  "guide.pipeline.move.title": "移动线索的阶段",
  "guide.pipeline.move.what": "销售推进时,线索进入下一个阶段。",
  "guide.pipeline.move.before": "以前你在 Kommo 里把卡片拖到另一列,或在 Studio 的 CRM 中更改阶段。",
  "guide.pipeline.move.now": "拖动卡片,或在线索档案中更改阶段。有些阶段会自动变化,例如出报价时。",
  "guide.pipeline.tasks.title": "任务",
  "guide.pipeline.tasks.what": "任务提醒你对一条线索要做什么、什么时候做。",
  "guide.pipeline.tasks.before": "以前任务在线索里。「Ping 23 h」机器人会在聊天快要关闭时创建一个。",
  "guide.pipeline.tasks.now": "在线索档案中创建任务。Studio 会提醒你未处理的线索和快超过 24 小时的聊天。",
  "guide.pipeline.incoming.title": "新线索",
  "guide.pipeline.incoming.what": "新线索会自动从聊天和网站进来,并带有来源渠道。",
  "guide.pipeline.incoming.before": "以前它们进入 Kommo 的「Leads entrantes」。",
  "guide.pipeline.incoming.now": "它们出现在第一列。打开、回复,在推进时移动它们。",

  // 客户档案
  "guide.dtdcard.client_tab.title": "客户档案中的对话",
  "guide.dtdcard.client_tab.what": "在 Studio 的客户档案中,可以看到他的对话以及有几条未读。",
  "guide.dtdcard.client_tab.before": "以前在 Studio 中,CRM 显示的是 Kommo 看板的副本。",
  "guide.dtdcard.client_tab.now": "打开「客户」,进入客户,查看「对话」卡片。点一下就能进入聊天。",

  // 更新(仅管理员)
  "guide.updates.version.title": "你使用的版本",
  "guide.updates.version.what": "这里显示 DTD 使用的聊天版本,以及是否有新版本。",
  "guide.updates.version.now": "查看当前版本和新版本。不会自动安装任何东西。",
  "guide.updates.analyze.title": "用 AI 分析",
  "guide.updates.analyze.what": "AI 会阅读新版本的变更,并告诉你哪些地方涉及 DTD。",
  "guide.updates.analyze.now": "点击「Analizar con IA」。分析只提供信息,不做决定,也不安装。",
  "guide.updates.request.title": "申请更新",
  "guide.updates.request.what": "如果你想要新版本,在这里申请,会安排备份和测试。",
  "guide.updates.request.now": "点击「Pedir actualización」。更新在约定的时间窗口进行,之前备份,之后测试。",
};

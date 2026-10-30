/**
 * lib/i18n/zh-CN/bandeja.ts · Studio 内的 Chatwoot 收件箱翻译（SDD-0585）。
 */

import type { BandejaDict } from "../es-VE/bandeja";

export const bandeja: BandejaDict = {
  // ── 页面 ─────────────────────────────────────────────────
  "bandeja.page.eyebrow": "销售 · 收件箱",
  "bandeja.page.title": "收件箱",
  "bandeja.frame.title": "消息收件箱",

  // ── 状态 ─────────────────────────────────────────────────
  "bandeja.state.loading": "正在打开收件箱…",
  "bandeja.state.unconfigured.title": "收件箱尚未连接",
  "bandeja.state.unconfigured.body": "与消息服务器的连接尚未配置，请联系管理员。",
  "bandeja.state.unlinked.title": "你的用户还没有收件箱坐席",
  "bandeja.state.unlinked.body": "需要管理员把你的用户与坐席绑定，你才能在这里接待客户。",
  "bandeja.state.error.title": "无法打开收件箱",
  "bandeja.state.error.body": "请重试。如果仍然失败，请在新标签页中打开。",
  "bandeja.action.retry": "重试",
  "bandeja.action.relogin": "重新登录",
  "bandeja.action.open_tab": "在新标签页中打开",

  // ── 绑定（仅管理员）──────────────────────────────────────
  "bandeja.links.title": "已绑定的坐席",
  "bandeja.links.help": "把每个 Studio 用户与其收件箱坐席绑定。坐席的邮箱必须与用户一致。",
  "bandeja.links.empty": "还没有绑定的用户。",
  "bandeja.links.user": "Studio 用户",
  "bandeja.links.user_placeholder": "选择用户",
  "bandeja.links.agent_id": "收件箱坐席 ID",
  "bandeja.links.submit": "绑定",
  "bandeja.links.submitting": "正在绑定…",
  "bandeja.links.unlink": "解除绑定",
  "bandeja.links.unlinking": "正在解除…",
  "bandeja.links.created": "用户已绑定",
  "bandeja.links.deleted": "绑定已删除",
  "bandeja.links.unlink_confirm_title": "解除该用户的绑定？",
  "bandeja.links.unlink_confirm_body": "{nombre} 在重新绑定之前将无法从 Studio 打开收件箱。",
  "bandeja.links.cancel": "取消",

  // ── 客户档案卡片（2.3）────────────────────────────────────
  "bandeja.card.title": "收件箱中的会话",
  "bandeja.card.empty": "该客户没有关联的会话。",
  "bandeja.card.conversation": "会话 #{n}",
  "bandeja.card.unread": "{n} 条未读",
  "bandeja.card.last_activity": "最近活动：{fecha}",
  "bandeja.card.open": "打开",
  "bandeja.status.open": "进行中",
  "bandeja.status.pending": "待处理",
  "bandeja.status.snoozed": "已暂停",
  "bandeja.status.resolved": "已解决",

  // ── 已放弃的事件（2.3，v3；仅管理员）────────────────────────
  "bandeja.discarded.title": "未能处理的事件",
  "bandeja.discarded.help": "Studio 已重试 5 次仍未成功。请在收件箱中查看这些会话：可能缺少提醒。",
  "bandeja.discarded.message": "新消息 · 会话 #{n} · 尝试 {intentos} 次",
  "bandeja.discarded.status": "状态变更 · 会话 #{n} · 尝试 {intentos} 次",

  // ── 操作错误 ─────────────────────────────────────────────
  "bandeja.error.denied": "你没有执行此操作的权限。",
  "bandeja.error.invalid": "请检查用户和坐席 ID。",
  "bandeja.error.not_member": "该用户不属于你的公司。",
  "bandeja.error.agent_not_found": "在收件箱中找不到该坐席。",
  "bandeja.error.agent_other_account": "该坐席不属于公司的账户。",
  "bandeja.error.email_mismatch": "坐席邮箱与用户邮箱不一致。",
  "bandeja.error.duplicate": "该用户或坐席已被绑定。",
  "bandeja.error.unconfigured": "收件箱尚未连接。",
  "bandeja.error.unlinked": "你的用户没有绑定坐席。",
  "bandeja.error.service": "消息服务器没有响应，请重试。",
};

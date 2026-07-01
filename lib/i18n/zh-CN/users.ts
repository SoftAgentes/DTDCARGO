/**
 * lib/i18n/zh-CN/users.ts · 用户与角色模块翻译。
 */

import type { UsersDict } from "../es-VE/users";

export const users: UsersDict = {
  // ── 抽屉 header ──────────────────────────────────────────
  "users.invite.title": "邀请用户",
  "users.invite.subtitle": "我们将生成一个 7 天后过期的邀请链接",
  "users.invite.submit_idle": "生成链接",
  "users.invite.submit_loading": "生成中…",

  // ── 办公室选择 ───────────────────────────────────────────
  "users.office.label": "办公室",
  "users.office.aria": "受邀者的办公室",
  "users.office.hint":
    "决定 Studio 的语言、日期格式和默认货币。受邀者接受邀请后即可看到。",

  // ── 字段 ─────────────────────────────────────────────────
  "users.field.first_name": "名字",
  "users.field.first_name_ph": "María",
  "users.field.last_name": "姓氏",
  "users.field.last_name_ph": "Pérez",
  "users.field.email": "邮箱",
  "users.field.email_ph": "maria@dtdcargo.com",
  "users.field.role": "角色",
  "users.field.team": "团队",

  // ── 角色 ─────────────────────────────────────────────────
  "users.role.admin": "管理员",
  "users.role.commercial": "商务",
  "users.role.operations": "运营",
  "users.role.accounting": "财务",
  "users.role.warehouse": "仓管员",
  "users.role.support": "客服",
  "users.role.marketing": "市场营销",

  // ── 团队 ─────────────────────────────────────────────────
  "users.team.direccion": "管理层",
  "users.team.ventas": "销售",
  "users.team.op_cn": "中国运营",
  "users.team.op_ve": "委内运营",
  "users.team.finanzas": "财务",
  "users.team.cx": "客户体验",

  // ── 范围 / 仓库 ──────────────────────────────────────────
  "users.scope.assigned_label": "分配的仓库",
  "users.scope.explainer": "该用户只能查看所选仓库的收货和货运。",
  "users.scope.explainer_bold": "无法切换仓库或查看其他仓库。",
  "users.scope.cn_group": "🇨🇳 中国仓库",
  "users.scope.ve_group": "🇻🇪 委内瑞拉仓库",
  "users.scope.permission_label": "仓库内权限",
  "users.scope.badge_empty": "未定义",
  "users.scope.badge_count": "{count} 个仓库",
  "users.scope.badge_count_plural": "{count} 个仓库",

  // ── 权限选项 ─────────────────────────────────────────────
  "users.permission.read": "只读",
  "users.permission.read_desc": "查看收货 · 不可编辑",
  "users.permission.write": "读写",
  "users.permission.write_desc": "创建和编辑该仓库的收货",

  // ── 2FA ──────────────────────────────────────────────────
  "users.twofa.label": "首次登录时建议启用 2FA",
  "users.twofa.optional": "（可选）",
  "users.twofa.desc":
    "用户会看到启用 2FA 的提示，但可以跳过。测试期间从不强制配置 2FA。",

  // ── 摘要卡 ───────────────────────────────────────────────
  "users.summary.heading": "该用户将可以：",
  "users.summary.office": "办公室：",
  "users.summary.role": "角色：",
  "users.summary.team": "团队：",
  "users.summary.see_only": "仅查看：",
  "users.summary.perm_write": "读写",
  "users.summary.perm_read": "只读",
  "users.summary.missing_warehouse": "⚠ 还需至少分配一个仓库",
  "users.summary.global_access": "✓ 全局访问 · 不限制仓库",
  "users.summary.twofa_suggested": "✓ 将建议其启用 2FA（可选）",

  // ── 免责声明 ─────────────────────────────────────────────
  "users.disclaimer":
    "V1 仅保存邮箱 + 角色 + 办公室。姓名、团队、范围、权限和 2FA 仅存于 UI，直到 schema 的 B 阶段。用户接受邀请时将填写姓名。",

  // ── 成功视图 ─────────────────────────────────────────────
  "users.success.title": "邀请已创建",
  "users.success.body":
    "复制链接并通过 WhatsApp、邮件或任意方式发送给受邀者。7 天后过期。（Resend 就绪后系统将自动发送。）",
  "users.success.link_label": "邀请链接",
  "users.success.copy": "复制",
  "users.success.copied": "✓ 已复制",
  "users.success.copy_error": "错误",
  "users.success.close": "关闭",
};

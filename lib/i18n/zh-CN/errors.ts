/**
 * lib/i18n/zh-CN/errors.ts · 服务器错误消息（中文）。
 */

import type { ErrorsDict } from "../es-VE/errors";

export const errors: ErrorsDict = {
  // ── 全局 ─────────────────────────────────────────────────
  "error.auth_required": "请先登录。",
  "error.tenant_unresolved": "无法解析租户。",
  "error.permission_denied": "您没有执行此操作的权限。",
  "error.invalid_input": "输入数据无效。",
  "error.field_errors_present": "存在错误字段。请检查后重试。",
  "error.not_found": "未找到记录。",
  "error.internal_error": "发生错误。请重试。",

  // ── 中国仓库 ─────────────────────────────────────────────
  "error.cn_code_generation_failed": "无法生成收货单号。",
  "error.cn_create_failed": "无法登记收货。",
  "error.cn_receipt_not_found": "未找到收货记录。",
  "error.cn_invalid_payment_status": "付款状态无效。",
  "error.cn_destination_required": "拼柜必须选择目的地城市。",
  "error.cn_bulk_max_exceeded": "每次批量操作最多 100 条收货。",
  "error.cn_delete_reason_short": "请填写至少 4 个字符的原因。",
  "error.cn_delete_reason_long": "原因不能超过 1000 个字符。",
  "error.cn_delete_blocked": "未删除任何收货：所选中有 {count} 条无法删除。",
  "error.cn_delete_not_found": "未删除任何收货：部分收货已不存在或已被删除。请刷新列表。",
  "error.cn_delete_failed": "删除失败。未删除任何收货，请重试。",
  "error.cn_delete_unconfirmed": "无法确认删除结果。请刷新列表查看当前状态。",

  // ── 用户 ─────────────────────────────────────────────────
  "error.user_email_invalid": "邮箱无效。",
  "error.user_role_invalid": "角色无效。",
  "error.user_signin_required": "需要登录才能邀请用户。",
  "error.user_already_admin": "该用户已是租户管理员。",
  "error.user_no_other_admins": "您不能取消自己的管理员角色：您是租户唯一的管理员。",

  // ── 错误报告 ─────────────────────────────────────────────
  "error.bug_create_failed": "无法创建报告。请重试。",
  "error.bug_invalid_input": "报告字段缺失或值无效。",
};

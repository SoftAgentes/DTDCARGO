/**
 * lib/i18n/zh-CN/expenses.ts · 费用模块翻译（SDD-0039）。
 */

import type { ExpensesDict } from "../es-VE/expenses";

export const expenses: ExpensesDict = {
  // ── 页面 ─────────────────────────────────────────────────
  "expenses.page.eyebrow": "财务 · 费用",
  "expenses.page.title": "费用",
  "expenses.page.subtitle": "按集装箱及运营开支记账。CNY/USD 双币种。",
  "expenses.new_btn": "+ 新建费用",
  "expenses.export_btn": "导出本月",
  "expenses.exporting": "导出中…",

  // ── 标签页 ───────────────────────────────────────────────
  "expenses.tab.shipment": "按集装箱",
  "expenses.tab.external": "运营开支",

  // ── KPIs ─────────────────────────────────────────────────
  "expenses.kpi.month_total_usd": "本月合计 (USD)",
  "expenses.kpi.month_total_sub": "已折算为美元",
  "expenses.kpi.shipment_total": "按集装箱",
  "expenses.kpi.external_total": "运营开支",
  "expenses.kpi.count": "已录入费用",
  "expenses.kpi.pending_alerts": "等待录入费用的集装箱",

  // ── 筛选 / 表格 ──────────────────────────────────────────
  "expenses.filter.search_label": "搜索",
  "expenses.filter.search_ph": "编号、备注、供应商…",
  "expenses.filter.month_label": "月份",
  "expenses.table.col_code": "编号",
  "expenses.table.col_date": "日期",
  "expenses.table.col_shipment": "集装箱",
  "expenses.table.col_category": "类别",
  "expenses.table.col_note": "明细",
  "expenses.table.col_amount": "金额",
  "expenses.table.col_amount_usd": "USD",
  "expenses.table.col_method": "方式",
  "expenses.table.col_receipt": "凭证",
  "expenses.table.col_actions": "操作",
  "expenses.table.no_receipt": "—",
  "expenses.table.view_receipt": "查看凭证",

  // ── 空状态 ───────────────────────────────────────────────
  "expenses.empty.shipment_title": "暂无集装箱费用",
  "expenses.empty.shipment_desc":
    "集装箱拼柜后，在此录入其费用（运输、海关等）。",
  "expenses.empty.external_title": "暂无运营开支",
  "expenses.empty.external_desc":
    "中国办公室的租金、水电、工资等开支记在此处。",
  "expenses.empty.filtered": "没有符合筛选条件的费用。",

  // ── 抽屉 · 步骤 1 类型 ───────────────────────────────────
  "expenses.drawer.title": "新建费用",
  "expenses.drawer.edit_title": "编辑费用",
  "expenses.drawer.step1_legend": "这是哪种费用？",
  "expenses.scope.shipment": "集装箱费用",
  "expenses.scope.shipment_desc": "归属于某次货运：本地运输、海关等。",
  "expenses.scope.external": "运营开支",
  "expenses.scope.external_desc": "办公室/仓库开支：租金、水电、工资。",

  // ── 抽屉 · 字段 ──────────────────────────────────────────
  "expenses.field.shipment": "集装箱（货运）",
  "expenses.field.shipment_ph": "选择集装箱…",
  "expenses.field.category": "类别",
  "expenses.field.amount": "金额",
  "expenses.field.currency": "货币",
  "expenses.field.method": "付款方式",
  "expenses.field.note": "明细 / 描述",
  "expenses.field.note_ph": "例：义乌 → 港口 本地运费",
  "expenses.field.location": "地点（可选）",
  "expenses.field.location_ph": "例：义乌，中国",
  "expenses.field.occurred_at": "费用日期",
  "expenses.field.receipt": "附上凭证 / 照片",
  "expenses.field.receipt_hint": "运输发票、仓库收据照片等。",
  "expenses.field.receipt_secure": "受保护的凭证",
  "expenses.field.receipt_secure_hint": "保存费用后重新打开，即可使用断点续传。",
  "expenses.attachment.limits": "JPG、PNG 或 WebP 最大 8 MB；PDF 最大 25 MB。网络中断后，本地副本会保留以便重试。",
  "expenses.attachment.status.queued": "等待中",
  "expenses.attachment.status.uploading": "上传中",
  "expenses.attachment.status.uploading_progress": "上传中 {progress}%",
  "expenses.attachment.status.finalizing": "验证中",
  "expenses.attachment.status.completed": "已保存",
  "expenses.attachment.status.failed": "需要重试",
  "expenses.attachment.retry": "重试",
  "expenses.attachment.close": "关闭",
  "expenses.field.billable": "可向客户收取",

  // ── fx CNY/USD ───────────────────────────────────────────
  "expenses.fx.label": "汇率（{pair}）",
  "expenses.fx.prefill_recent": "上次使用于 {date}。仍然有效吗？",
  "expenses.fx.prefill_old": "汇率较旧，保存前请核对。",
  "expenses.fx.no_history": "请在 xe.com 等查询。",
  "expenses.fx.preview": "= {usd}",
  "expenses.fx.sanity_warning":
    "汇率超出历史范围（{min}–{max}）。是否正确？",

  // ── 抽屉 · 提交 ──────────────────────────────────────────
  "expenses.drawer.submit": "保存费用",
  "expenses.drawer.saving": "保存中…",
  "expenses.drawer.saved": "费用已保存",

  // ── 行操作 ───────────────────────────────────────────────
  "expenses.row.edit": "编辑",
  "expenses.row.delete": "删除",
  "expenses.row.delete_confirm": "删除此费用？",
  "expenses.row.deleted": "费用 {code} 已删除",

  // ── 提示 ─────────────────────────────────────────────────
  "expenses.toast.created": "费用 {code} 已保存",
  "expenses.toast.updated": "费用 {code} 已更新",

  // ── 整合提醒 (B.8) ───────────────────────────────────────
  "expenses.alert.banner_title_one": "1 个集装箱待录入费用",
  "expenses.alert.banner_title_many": "{count} 个集装箱待录入费用",
  "expenses.alert.banner_sub": "已整合但尚未录入费用。请录入费用，完成后标记。",
  "expenses.alert.load_btn": "录入费用",
  "expenses.alert.close_btn": "标记为已录入",
  "expenses.alert.closing": "关闭中…",
  "expenses.alert.closed_toast": "集装箱 {code} 已标记为已录入",
  "expenses.alert.chip": "待录入费用",
  "expenses.alert.no_destination": "无目的地",

  // ── 类别 · 差旅（集装箱） ────────────────────────────────
  "expenses.category.taxi": "出租车 / 接送",
  "expenses.category.comida": "餐饮",
  "expenses.category.hotel": "酒店",
  "expenses.category.vuelo": "机票",
  "expenses.category.peaje": "过路费",
  "expenses.category.combustible": "燃油",
  "expenses.category.aduana": "海关",
  "expenses.category.cliente": "拜访客户",
  "expenses.category.otro": "其他",
  // ── 类别 · 运营（external） ──────────────────────────────
  "expenses.category.op_rent": "仓库租金",
  "expenses.category.op_utilities": "水电网费",
  "expenses.category.op_salaries": "本地工资",
  "expenses.category.op_supplies": "耗材 / 包装",
  "expenses.category.op_equipment": "设备",
  "expenses.category.op_local_transport": "本地运输",
  "expenses.category.op_customs_local": "中国本地海关",

  // ── 付款方式 ─────────────────────────────────────────────
  "expenses.method.cash": "现金",
  "expenses.method.card": "刷卡",
  "expenses.method.transfer": "转账",
  "expenses.method.usdt": "USDT",
};

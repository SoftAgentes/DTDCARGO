/**
 * lib/i18n/zh-CN/warehouse.ts · 中国仓库模块翻译。
 *
 * 由 mandarín simplificado nativo speaker debe revisar antes de prod.
 */

import type { WarehouseDict } from "../es-VE/warehouse";

export const warehouse: WarehouseDict = {
  // ── 页面 header ──────────────────────────────────────────
  "warehouse_cn.page.eyebrow": "运营 · 仓库",
  "warehouse_cn.page.title_prefix": "中国仓库",
  "warehouse_cn.page.description_template":
    "在 {hubs} 仓库接收货物。装柜前的拼柜操作。",
  "warehouse_cn.page.hubs_label": "义乌 · 广州 · 深圳 · 上海",

  // ── Header actions ───────────────────────────────────────
  "warehouse_cn.header.new_receipt": "+ 新建收货",
  "warehouse_cn.header.lang_toggle_aria": "显示语言",
  "warehouse_cn.header.lang_original": "原始",
  "warehouse_cn.header.lang_cn": "中文",
  "warehouse_cn.header.lang_es": "西班牙语",

  // ── KPIs ─────────────────────────────────────────────────
  "warehouse_cn.kpi.receipts_this_month": "本月收货",
  "warehouse_cn.kpi.receipts_this_month_sub": "本月 1 日起登记的箱数",
  "warehouse_cn.kpi.pending_consolidation": "待拼柜",
  "warehouse_cn.kpi.pending_consolidation_sub_some": "等待集装箱",
  "warehouse_cn.kpi.pending_consolidation_sub_none": "无待处理",
  "warehouse_cn.kpi.cbm_in_warehouse": "仓库 CBM",
  "warehouse_cn.kpi.cbm_in_warehouse_sub": "待处理体积合计 (m³)",
  "warehouse_cn.kpi.incidents": "异常事件",
  "warehouse_cn.kpi.incidents_sub_some": "需要处理",
  "warehouse_cn.kpi.incidents_sub_none": "无活跃异常",

  // ── 筛选 / Toolbar ───────────────────────────────────────
  "warehouse_cn.filter.search_label": "搜索",
  "warehouse_cn.filter.search_placeholder":
    "单号、客户、MARKBOX、供应商…",
  "warehouse_cn.filter.hub_label": "仓库",
  "warehouse_cn.filter.hub_all": "所有仓库",
  "warehouse_cn.filter.status_label": "状态",
  "warehouse_cn.filter.status_all": "所有状态",
  "warehouse_cn.filter.show_names": "显示姓名",
  "warehouse_cn.filter.hide_names": "隐藏姓名",
  "warehouse_cn.filter.clear": "清除",

  // ── 状态标签 ─────────────────────────────────────────────
  "warehouse_cn.status.pending_consolidation": "待拼柜",
  "warehouse_cn.status.consolidated": "已拼柜",
  "warehouse_cn.status.incident": "异常",

  // ── 付款状态 ─────────────────────────────────────────────
  "warehouse_cn.payment.paid": "已付款",
  "warehouse_cn.payment.partial": "部分付款",
  "warehouse_cn.payment.pending": "待付款",

  // ── 表格 · 列 ────────────────────────────────────────────
  "warehouse_cn.table.col_receipt": "收货单号",
  "warehouse_cn.table.col_client": "客户",
  "warehouse_cn.table.col_supplier": "中国供应商",
  "warehouse_cn.table.col_hub": "仓库",
  "warehouse_cn.table.col_boxes": "箱数",
  "warehouse_cn.table.col_cbm": "CBM",
  "warehouse_cn.table.col_weight": "重量",
  "warehouse_cn.table.col_products": "商品",
  "warehouse_cn.table.col_status": "状态",
  "warehouse_cn.table.col_actions": "操作",
  "warehouse_cn.table.more_items": "+{count} 项",
  "warehouse_cn.table.orphan": "无主货",

  // ── 空状态 ───────────────────────────────────────────────
  "warehouse_cn.empty.title": "暂无收货记录",
  "warehouse_cn.empty.description":
    "货物到达中国仓库时，请使用「+ 新建收货」进行登记。",
  "warehouse_cn.empty.filtered_title": "没有匹配的收货记录",
  "warehouse_cn.empty.filtered_description":
    "请调整筛选条件或清除搜索以查看全部记录。",

  // ── 行操作菜单 ───────────────────────────────────────────
  "warehouse_cn.row.action_change_status": "修改状态",
  "warehouse_cn.row.action_change_payment": "修改付款",
  "warehouse_cn.row.action_consolidate": "拼柜 · 目的地",
  "warehouse_cn.row.action_view": "查看详情",
  "warehouse_cn.row.action_edit": "编辑",
  "warehouse_cn.row.action_delete": "删除",
  "warehouse_cn.row.destination_required": "拼柜必须选择目的地城市。",
  "warehouse_cn.row.destination_choose": "选择城市",
  "warehouse_cn.row.consolidating": "正在拼柜…",
  "warehouse_cn.row.empty_catalog": "租户目录为空 — 请先添加城市。",
  "warehouse_cn.row.aria_actions": "收货操作",
  "warehouse_cn.row.back": "← 返回",
  "warehouse_cn.row.destination_city_label": "目的地城市",
  "warehouse_cn.row.destination_choose_option": "— 选择城市 —",
  "warehouse_cn.row.city_placeholder": "例如：巴伦西亚",
  "warehouse_cn.row.consolidate_submit": "拼柜",
  "warehouse_cn.row.empty_catalog_hint":
    "租户目录为空。请在 /studio/admin/rutas 城市标签页中添加，以便从列表中选择。",

  // ── 批量操作 ─────────────────────────────────────────────
  "warehouse_cn.bulk.selected_count": "已选择 {count} 项",
  "warehouse_cn.bulk.selected_count_singular": "已选择 {count} 项",
  "warehouse_cn.bulk.aria_region": "批量操作 · 已选择 {count} 项",
  "warehouse_cn.bulk.clear_selection": "清除选择",
  "warehouse_cn.bulk.change_status": "修改状态",
  "warehouse_cn.bulk.change_payment": "修改付款",
  "warehouse_cn.bulk.processing": "处理中…",
  "warehouse_cn.bulk.max_exceeded": "每次批量操作最多 100 条收货。",
  "warehouse_cn.bulk.pay_paid": "标记为已付款",
  "warehouse_cn.bulk.pay_partial": "标记为部分付款",
  "warehouse_cn.bulk.pay_pending": "标记为待付款",
  "warehouse_cn.bulk.status_pending": "恢复为待处理",
  "warehouse_cn.bulk.status_incident": "标记为异常",
  "warehouse_cn.bulk.cancel_btn": "取消",
  "warehouse_cn.bulk.confirm_question": "对 {count} 条收货应用 {action}？",
  "warehouse_cn.bulk.confirm_yes": "是，应用",
  "warehouse_cn.bulk.applying": "应用中…",
  "warehouse_cn.bulk.confirm_no": "否",
  "warehouse_cn.bulk.feedback_ok": "已更新 {count} 条。",
  "warehouse_cn.bulk.feedback_error_generic": "错误",

  // ── 新建收货 Drawer ──────────────────────────────────────
  "warehouse_cn.drawer.title": "新建收货",
  "warehouse_cn.drawer.subtitle": "登记到达中国仓库的货物。单号自动分配。",
  "warehouse_cn.drawer.submit_close": "登记并关闭",
  "warehouse_cn.drawer.submit_open": "登记并打开收货详情",
  "warehouse_cn.drawer.submit_next": "登记并继续下一件",
  "warehouse_cn.drawer.submitting": "登记中…",
  "warehouse_cn.drawer.success_close": "已登记收货",
  "warehouse_cn.drawer.success_open": "正在打开收货",
  "warehouse_cn.drawer.success_next": "可以继续下一件",
  "warehouse_cn.drawer.submit_close_desc":
    "登记收货并返回列表，新记录将高亮显示。",
  "warehouse_cn.drawer.submit_open_desc":
    "登记并打开收货详情用于打印或核对。",
  "warehouse_cn.drawer.submit_next_desc":
    "登记收货、清空字段（保留仓库），并保持抽屉打开以登记下一件。",
  "warehouse_cn.drawer.item_label": "第 {index} 项",
  "warehouse_cn.drawer.item_remove_aria": "删除第 {index} 项",
  "warehouse_cn.drawer.item_desc_label": "商品描述",
  "warehouse_cn.drawer.item_desc_placeholder": "USB-C 充电器 · Cargadores",
  "warehouse_cn.drawer.item_hs_label": "HS 编码",
  "warehouse_cn.drawer.item_qty_label": "数量",
  "warehouse_cn.drawer.item_val_label": "单价 USD",
  "warehouse_cn.drawer.section_warehouse": "仓库",
  "warehouse_cn.drawer.section_client": "客户",
  "warehouse_cn.drawer.section_supplier": "谁送来的？",
  "warehouse_cn.drawer.section_items": "箱内物品",
  "warehouse_cn.drawer.section_totals": "合计",
  "warehouse_cn.drawer.section_notes": "内部备注",
  "warehouse_cn.drawer.section_status": "货物状态",
  "warehouse_cn.drawer.warehouse_placeholder": "选择接收货物的仓库…",
  "warehouse_cn.drawer.client_placeholder": "选择客户…",
  "warehouse_cn.drawer.client_label": "客户 · MARKBOX",
  "warehouse_cn.drawer.orphan_toggle_on": "标记为无主货（无 MARKBOX）",
  "warehouse_cn.drawer.orphan_toggle_off": "返回已知客户",
  "warehouse_cn.drawer.supplier_placeholder": "供应商名称或谁送来的…",
  "warehouse_cn.drawer.orphan_label": "无主货（无客户）",
  "warehouse_cn.drawer.orphan_marks": "标记 / 识别码",
  "warehouse_cn.drawer.orphan_brought_by": "谁送来的？",
  "warehouse_cn.drawer.orphan_suspected": "疑似客户（可选）",
  "warehouse_cn.drawer.boxes_label": "箱数",
  "warehouse_cn.drawer.cbm_label": "CBM (m³)",
  "warehouse_cn.drawer.weight_label": "重量 (kg)",
  "warehouse_cn.drawer.items_add": "添加物品",
  "warehouse_cn.drawer.items_multi_hs": "支持多 HS",
  "warehouse_cn.drawer.notes_placeholder": "内部备注（可选）",
  "warehouse_cn.drawer.supplier_label_bi": "供应商（中文或西班牙语）",
  "warehouse_cn.drawer.supplier_translate": "翻译 中文 → 西班牙语 / 西班牙语 → 中文",
  "warehouse_cn.drawer.supplier_paste_translation": "粘贴翻译…",
  "warehouse_cn.supplier.placeholder": "供应商名称 · 中文或西班牙语",
  "warehouse_cn.supplier.translate_btn": "翻译 {direction}",
  "warehouse_cn.supplier.translate_title": "加载翻译 {direction}",
  "warehouse_cn.supplier.translation_label": "翻译 {direction}",
  "warehouse_cn.supplier.translation_label_optional": "翻译（可选）",
  "warehouse_cn.supplier.remove_translation": "移除翻译",
  "warehouse_cn.supplier.paste_placeholder": "粘贴 {lang} 翻译…",
  "warehouse_cn.supplier.translation_note":
    "V1：请手动粘贴翻译（来自 WeChat、阿里巴巴或您的联系人）。AI 自动翻译将在后续 SDD 中实现。",
  "warehouse_cn.supplier.bilingual_hint":
    "您可以用中文或西班牙语输入 · 可加载另一种语言的翻译。",
  "warehouse_cn.supplier.lang_es": "西班牙语",
  "warehouse_cn.supplier.lang_cn": "中文",

  // ── 抽屉 · 无主货部分 ─────────────────────────────────────
  "warehouse_cn.drawer.orphan_toggle": "无 MARKBOX 码？· 标记为无主货",
  "warehouse_cn.drawer.orphan_badge": "无主货箱",
  "warehouse_cn.drawer.orphan_code_note": "· 将分配",
  "warehouse_cn.drawer.orphan_disable": "取消",
  "warehouse_cn.drawer.orphan_marks_label": "可见标记 / 识别信息",
  "warehouse_cn.drawer.orphan_marks_placeholder":
    "例如：ACINDAR-VLN-04 · ⌂ 红色 · 中文标签",
  "warehouse_cn.drawer.orphan_marks_hint":
    "任何可见的文字、颜色、符号或标记。便于客户后续认领。",
  "warehouse_cn.drawer.orphan_brought_label": "谁送来的？",
  "warehouse_cn.drawer.orphan_brought_placeholder": "司机 / 运输员",
  "warehouse_cn.drawer.orphan_suspected_label": "可能的客户（猜测）",
  "warehouse_cn.drawer.orphan_suspected_placeholder": "如果有头绪…",

  // ── 抽屉 · 物品 / 合计 / 备注 ────────────────────────────
  "warehouse_cn.drawer.items_title": "箱内物品",
  "warehouse_cn.drawer.items_hint": "支持多 HS · 物品数量 1 到 {max}。",
  "warehouse_cn.drawer.items_add_btn": "添加物品",
  "warehouse_cn.drawer.totals_title": "箱合计",
  "warehouse_cn.drawer.boxes_field_label": "箱数",
  "warehouse_cn.drawer.boxes_unit": "箱",
  "warehouse_cn.drawer.cbm_field_label": "CBM",
  "warehouse_cn.drawer.weight_field_label": "重量",
  "warehouse_cn.drawer.received_label": "收货日期",
  "warehouse_cn.drawer.notes_label": "内部备注",
  "warehouse_cn.drawer.notes_placeholder_long":
    "货物状态、备注、可见损伤…",

  // ── 服务器错误 ───────────────────────────────────────────
  "warehouse_cn.error.tenant_unresolved": "无法解析租户。",
  "warehouse_cn.error.code_generation": "无法生成单号。",
  "warehouse_cn.error.required_fields": "存在必填字段未填写。",
  "warehouse_cn.error.create_failed": "无法登记收货。",
  "warehouse_cn.error.not_found": "未找到收货记录。",
  "warehouse_cn.error.invalid_payment": "付款状态无效。",
};

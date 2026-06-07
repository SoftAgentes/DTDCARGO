/**
 * lib/i18n/zh-CN/chrome.ts · 中文（简体） traducción del chrome común.
 *
 * IMPORTANTE: estas traducciones DEBEN ser revisadas por un nativo de
 * mandarín antes de prod. Las que escribí son razonables para Yiwu/
 * Cantón/Shenzhen/Shanghai pero un nativo puede ajustar tono y
 * convenciones (especialmente labels uppercase en ES → no existen en CN).
 *
 * Las keys deben coincidir 1:1 con `lib/i18n/es-VE/chrome.ts`. Si
 * agregás una key acá sin estar en ES, TypeScript se quejará al usarse.
 */

import type { ChromeDict } from "../es-VE/chrome";

export const chrome: ChromeDict = {
  // ── Acciones genéricas ───────────────────────────────────
  "chrome.action.cancel": "取消",
  "chrome.action.close": "关闭",
  "chrome.action.save": "保存",
  "chrome.action.create": "创建",
  "chrome.action.edit": "编辑",
  "chrome.action.delete": "删除",
  "chrome.action.confirm": "确认",
  "chrome.action.back": "返回",
  "chrome.action.next": "下一步",
  "chrome.action.processing": "处理中…",
  "chrome.action.saving": "保存中…",
  "chrome.action.saved": "已保存",
  "chrome.action.loading": "加载中…",
  "chrome.action.search": "搜索",
  "chrome.action.filter": "筛选",
  "chrome.action.clear": "清除",
  "chrome.action.export": "导出",
  "chrome.action.import": "导入",
  "chrome.action.upload": "上传",
  "chrome.action.download": "下载",
  "chrome.action.retry": "重试",

  // ── Drawer estándar ──────────────────────────────────────
  "chrome.drawer.cancel": "取消",
  "chrome.drawer.close": "关闭",
  "chrome.drawer.aria_close": "关闭面板",
  "chrome.drawer.submitting": "创建中…",

  // ── Estados de form ──────────────────────────────────────
  "chrome.form.required": "此字段为必填项。",
  "chrome.form.invalid": "无效值。",
  "chrome.form.too_long": "文本过长。",
  "chrome.form.errors_present": "存在错误字段。",

  // ── Sidebar · grupos ─────────────────────────────────────
  "chrome.sidebar.group.operation": "运营",
  "chrome.sidebar.group.commercial": "商务",
  "chrome.sidebar.group.finance": "财务",
  "chrome.sidebar.group.marketing": "营销",
  "chrome.sidebar.group.system": "系统",
  "chrome.sidebar.collapse": "收起侧边栏",
  "chrome.sidebar.expand": "展开侧边栏",

  // ── Sidebar · items ──────────────────────────────────────
  // 运营 (OPERACIÓN)
  "chrome.sidebar.dashboard": "仪表盘",
  "chrome.sidebar.shipments": "货运",
  "chrome.sidebar.tracking": "追踪",
  "chrome.sidebar.calendar": "日历",
  "chrome.sidebar.warehouse_cn": "中国仓库",
  "chrome.sidebar.qr_queue": "二维码队列",
  "chrome.sidebar.labels_cn": "中国标签",
  "chrome.sidebar.warehouse_ve": "委内瑞拉仓库",
  "chrome.sidebar.customs_seniat": "海关 SENIAT",
  "chrome.sidebar.tms": "TMS · 运输",
  "chrome.sidebar.dispatch": "派送",
  "chrome.sidebar.dispatch_rules": "派送规则",
  "chrome.sidebar.dispatch_dashboard": "派送仪表盘",
  "chrome.sidebar.routes_cities": "路线与城市",
  "chrome.sidebar.consolidation": "拼柜",
  // 商务 (COMERCIAL)
  "chrome.sidebar.quotes": "估价",
  "chrome.sidebar.clients": "客户",
  "chrome.sidebar.leads": "CRM · 潜在客户",
  "chrome.sidebar.suppliers_cn": "中国供应商",
  "chrome.sidebar.rates": "费率",
  // 财务 (FINANZAS)
  "chrome.sidebar.invoices": "开票",
  "chrome.sidebar.documents": "文档",
  "chrome.sidebar.reports": "报表",
  "chrome.sidebar.costing": "成本与利润",
  "chrome.sidebar.expenses": "费用",
  // 营销 (MARKETING)
  "chrome.sidebar.noticias_web": "网站新闻",
  // 系统 (SISTEMA)
  "chrome.sidebar.mailing": "邮件",
  "chrome.sidebar.seo_generator": "SEO 生成器",
  "chrome.sidebar.no_olvidar": "勿忘",
  "chrome.sidebar.users": "用户",
  "chrome.sidebar.operarios_pwa": "操作员 PWA",
  "chrome.sidebar.bugs": "问题追踪",
  "chrome.sidebar.my_reports": "我的报告",
  "chrome.sidebar.administration": "管理",
  // Footer
  "chrome.sidebar.collapse_short": "收起",
  // Fallback module labels
  "chrome.module.settings": "设置",
  "chrome.module.studio": "DTD Studio",
  "chrome.module.general": "通用",

  // ── Topbar ───────────────────────────────────────────────
  "chrome.topbar.module": "模块",
  "chrome.topbar.search_placeholder": "搜索货运、客户、MARKBOX…",
  "chrome.topbar.search_aria": "在 Studio 中搜索（快捷键 {key}+K）",
  "chrome.topbar.theme_toggle": "切换主题",
  "chrome.topbar.theme_to_light": "切换到浅色模式",
  "chrome.topbar.theme_to_dark": "切换到深色模式",
  "chrome.topbar.notifications": "通知",
  "chrome.topbar.user_menu": "用户菜单",
  "chrome.topbar.menu_profile": "我的资料",
  "chrome.topbar.menu_password": "修改密码",
  "chrome.topbar.menu_shortcuts": "键盘快捷键",
  "chrome.topbar.menu_preferences": "偏好设置",
  "chrome.topbar.menu_logout": "退出登录",
  "chrome.topbar.logging_out": "正在退出…",
  "chrome.topbar.search_modal_placeholder": "全局搜索（即将推出）",
  "chrome.topbar.search_modal_title": "全局搜索将在 Sprint 6.4 中推出。",
  "chrome.topbar.search_modal_hint":
    "在此之前，请使用侧边栏查找货运、客户、MARKBOX 等。",

  // ── Toasts genéricos ─────────────────────────────────────
  "chrome.toast.success": "完成",
  "chrome.toast.error": "出现错误",
  "chrome.toast.dismiss": "关闭",
  "chrome.toast.region_aria": "Studio 通知",
  "chrome.toast.dismiss_aria": "关闭通知",

  // ── Badges de status comunes ─────────────────────────────
  "chrome.badge.pending": "待处理",
  "chrome.badge.active": "活跃",
  "chrome.badge.inactive": "未激活",
  "chrome.badge.archived": "已归档",

  // ── Empty states ─────────────────────────────────────────
  "chrome.empty.no_results": "无结果",
  "chrome.empty.no_results_hint": "请调整筛选条件或添加新记录。",
};

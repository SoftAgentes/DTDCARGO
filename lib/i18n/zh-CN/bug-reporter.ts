/**
 * lib/i18n/zh-CN/bug-reporter.ts · 错误报告器 翻译。
 *
 * 中国团队成员可以用中文报告问题，并附带可选的西班牙语翻译，
 * 以便 VE 团队更快处理。
 */

import type { BugReporterDict } from "../es-VE/bug-reporter";

export const bugReporter: BugReporterDict = {
  // ── FAB ──────────────────────────────────────────────────
  "bug.fab.aria": "报告问题",
  "bug.fab.title": "报告问题 · 拖动以移动",
  "bug.fab.toggled_on": "报告按钮已开启 · 按 Alt+B 隐藏",
  "bug.fab.toggled_off": "报告按钮已隐藏",
  "bug.fab.corner_label_top_left": "左上",
  "bug.fab.corner_label_top_right": "右上",
  "bug.fab.corner_label_bottom_left": "左下",
  "bug.fab.corner_label_bottom_right": "右下",
  "bug.fab.corner_menu_heading": "将按钮移至",
  "bug.fab.corner_menu_aria": "将问题按钮移至其他角落",
  "bug.fab.corner_menu_tip": "提示：拖动按钮即可移动。",
  "bug.fab.corner_menu_close": "关闭",
  "bug.fab.drag_target_here": "这里",

  // ── 模态框 · header ──────────────────────────────────────
  "bug.modal.title": "报告问题",
  "bug.modal.subtitle":
    "您当前在 {module}。我们会自动附上 URL 和技术环境信息。",
  "bug.modal.close_aria": "关闭",

  // ── 模态框 · 成功视图 ────────────────────────────────────
  "bug.modal.success_new": "报告已收到",
  "bug.modal.success_duplicated": "已被报告过",
  "bug.modal.success_new_desc": "您的问题编号是 {folio}。有进展我们会通知您。",
  "bug.modal.success_duplicated_desc":
    "已计入问题 {folio} 的计数。感谢您的反馈。",

  // ── 模态框 · 表单 ────────────────────────────────────────
  "bug.modal.category_legend": "报告类型",
  "bug.modal.category_aria": "类别",
  "bug.modal.severity_legend": "严重程度",
  "bug.modal.severity_aria": "严重程度",
  "bug.modal.title_label": "标题",
  "bug.modal.title_placeholder": "问题简短摘要",
  "bug.modal.description_label": "描述",
  "bug.modal.description_placeholder":
    "您当时在做什么、发生了什么、您期望发生什么。",
  "bug.modal.translation_label": "西班牙语翻译（可选）",
  "bug.modal.translation_placeholder":
    "如果您用中文撰写，可在此处翻译标题和描述，以便 VE 团队更快处理。",
  "bug.modal.attached_label_module": "模块：",
  "bug.modal.attached_label_url": "URL：",
  "bug.modal.attached_label_build": "构建：",

  // ── 模态框 · 底部 ────────────────────────────────────────
  "bug.modal.cancel": "取消",
  "bug.modal.submit_idle": "提交报告",
  "bug.modal.submit_loading": "提交中…",

  // ── 类别 ─────────────────────────────────────────────────
  "bug.category.error": "错误",
  "bug.category.improve": "改进",
  "bug.category.suggest": "建议",
  "bug.category.question": "问题",

  // ── 严重程度 ─────────────────────────────────────────────
  "bug.severity.baja": "低",
  "bug.severity.media": "中",
  "bug.severity.alta": "高",
  "bug.severity.critica": "严重",
};

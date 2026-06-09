/**
 * lib/i18n/zh-CN/pwa-operario.ts · 操作员 PWA 翻译。
 *
 * Las keys `pwa.receipt.*` preservan las traducciones que ya estaban en
 * uso en el wizard NuevaRecepcionClient (campo) — no se reescribieron.
 */

import type { PwaOperarioDict } from "../es-VE/pwa-operario";

export const pwaOperario: PwaOperarioDict = {
  // ── 登录 ──────────────────────────────────────────────────
  "pwa.login.title": "义乌仓库",
  "pwa.login.subtitle": "操作员 · DTD Cargo",
  "pwa.login.pin_prompt": "请输入 4 位 PIN 密码",
  "pwa.login.verifying": "验证中…",
  "pwa.login.backspace_aria": "删除上一位",
  "pwa.login.lang_es": "西班牙语",
  "pwa.login.lang_cn": "中文",
  "pwa.login.error_invalid_pin": "PIN 无效 — 必须是 4 位数字。",
  "pwa.login.error_wrong_pin": "PIN 错误或操作员未激活。",

  // ── 首页 ──────────────────────────────────────────────────
  "pwa.home.greeting": "你好，{name}",
  "pwa.home.warehouse_label": "您的仓库",
  "pwa.home.shift_today": "今日班次",
  "pwa.home.action_new_receipt": "新建收货",
  "pwa.home.action_pending_list": "待处理",
  "pwa.home.action_logout": "退出登录",
  "pwa.home.lang_switcher_aria": "切换语言",

  // ── 向导 · 导航 ──────────────────────────────────────────
  "pwa.receipt.nav_back": "上一步",
  "pwa.receipt.saving": "保存中…",
  "pwa.receipt.next_arrow": "下一步 →",

  // ── 向导 · 步骤 1 拍照 ───────────────────────────────────
  "pwa.receipt.step1_title": "1/4 · 拍照",
  "pwa.receipt.step1_subtitle": "至少拍3张照片",
  "pwa.receipt.photos_enough": "照片足够 · 可以继续",
  "pwa.receipt.take_photo": "拍照",
  "pwa.receipt.photo_n": "照片 {n}",
  "pwa.receipt.remove_photo": "删除照片",
  "pwa.receipt.photos_missing": "还需{n}张照片 · 至少3张",
  "pwa.receipt.photo_hint":
    "拍摄: 1) 正面带标签 · 2) 供应商标签 · 3) 内容 · 4) 损坏(如有)",

  // ── 向导 · 步骤 2 识别 ───────────────────────────────────
  "pwa.receipt.step2_title": "2/4 · 识别",
  "pwa.receipt.step2_subtitle": "这箱子是谁的?",
  "pwa.receipt.visible_marks": "箱子上可见标记",
  "pwa.receipt.marks_ph": "例: ACINDAR-VLN-04 · 中文标签",
  "pwa.receipt.brought_by": "谁送的?",
  "pwa.receipt.brought_by_ph": "司机或快递",
  "pwa.receipt.search_client": "查找客户 · 唛头 (Shipping Mark)",
  "pwa.receipt.no_matches": "无匹配",
  "pwa.receipt.orphan_toggle": "无编码 · 孤箱",

  // ── 向导 · 步骤 3 数据 ───────────────────────────────────
  "pwa.receipt.step3_title": "3/4 · 数据",
  "pwa.receipt.step3_subtitle": "尺寸和供应商",
  "pwa.receipt.supplier": "中国供应商",
  "pwa.receipt.supplier_ph": "供应商名称",
  "pwa.receipt.boxes": "箱数",
  "pwa.receipt.total_weight": "总重量",
  "pwa.receipt.hs_code": "HS编码 (可选)",
  "pwa.receipt.dest_city": "委内瑞拉目的地 (可选)",
  "pwa.receipt.choose": "— 选择 —",
  "pwa.receipt.city_ph": "如: 巴伦西亚",
  "pwa.receipt.cities_loaded": "{n} 个城市来自租户目录",
  "pwa.receipt.cities_empty": "目录为空 · 自由输入或请管理员添加",

  // ── 向导 · 步骤 4 确认 ───────────────────────────────────
  "pwa.receipt.step4_title": "4/4 · 确认",
  "pwa.receipt.step4_subtitle": "检查并保存",
  "pwa.receipt.summary": "总结",
  "pwa.receipt.photos_label": "照片",
  "pwa.receipt.client": "客户",
  "pwa.receipt.orphan_summary": "孤箱 · {marks}",
  "pwa.receipt.supplier_label": "供应商",
  "pwa.receipt.boxes_short": "箱",
  "pwa.receipt.weight_label": "重量",
  "pwa.receipt.report_incident": "报告箱子问题",
  "pwa.receipt.incident_desc": "问题描述",
  "pwa.receipt.incident_ph": "例: 箱子上角损坏",
  "pwa.receipt.submit_register": "保存收货",

  // ── 向导 · 上传 + 成功 ───────────────────────────────────
  "pwa.receipt.uploading_photos": "正在上传照片…",
  "pwa.receipt.dont_close": "请勿关闭应用",
  "pwa.receipt.saved_toast": "收货 {code} 已保存",
  "pwa.receipt.saved_with_errors": "收货 {code} 已保存 — {n} 张照片失败",
  "pwa.receipt.saved_title": "收货已保存",
  "pwa.receipt.appears_in_studio": "几秒钟后将出现在Studio面板中",
  "pwa.receipt.photos_uploaded": "✓ 已上传 {n} 张照片",
  "pwa.receipt.photos_progress": "{up}/{total} 照片 · {err} 失败",
  "pwa.receipt.new_another": "+ 新建收货",
  "pwa.receipt.back_home": "返回主页",
  "pwa.receipt.back_generic": "返回",
};

/**
 * lib/i18n/zh-CN/pwa-operario.ts · 操作员 PWA 翻译。
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

  // ── 新建收货 (向导 header) ───────────────────────────────
  "pwa.receipt.title": "新建收货",
  "pwa.receipt.step_label": "步骤 {current} / {total}",
  "pwa.receipt.continue": "继续",
  "pwa.receipt.back": "返回",
  "pwa.receipt.cancel": "取消",
  "pwa.receipt.cancel_confirm": "取消录入？已填写的数据将丢失。",
  "pwa.receipt.success": "收货已登记",
  "pwa.receipt.start_another": "登记另一件",
  "pwa.receipt.go_home": "返回首页",
};

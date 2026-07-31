/**
 * Render de la firma de email a HTML real (tablas + estilos inline + hex de
 * marca). Función pura, sin `window` ni React — reusable desde la vista Firmas
 * (preview en vivo) y desde Compose cuando adjunte la firma al final del body.
 *
 * ⚠️ Excepción de marca (Norte): acá SÍ se hardcodean hex de marca
 * (`#7F0F1A` wine, `#0F1E3D` ink, etc.) porque los clientes de correo NO leen
 * CSS custom properties (`var(--*)`) — necesitan valores literales. Es la única
 * superficie del Studio donde esto está permitido.
 *
 * Mapeo de los nombres bonitos del Norte al enum `mail_signature_layout`:
 *   clásico  → corporate
 *   compacto → inline
 *   vertical → card
 *   mínimo   → minimal
 *   foto     → image_only
 */

import type { MailSignatureLang, MailSignatureLayout } from "./mail-types";
import {
  EMAIL_FONT_STACK,
  emailTypographyForSignature,
} from "./mail/email-typography";

export interface SignatureRenderData {
  layout: MailSignatureLayout;
  full_name: string;
  role_label?: string | null;
  email?: string | null;
  phone?: string | null;
  photo_url?: string | null;
  company_name?: string | null;
  lang?: MailSignatureLang;
}

// ── Hex de marca (literal a propósito, ver header) ───────────
const WINE = "#7F0F1A";
const WINE_SOFT = "#C2747F";
const INK = "#0F1E3D";
const MUTE = "#6B6B6B";
const RULE = "#E8E6E2";

const FONT_SANS = EMAIL_FONT_STACK.brand;
const FONT_DISPLAY = EMAIL_FONT_STACK.brandDisplay;
const FONT_MONO = EMAIL_FONT_STACK.data;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function initialsFrom(name: string): string {
  const parsed = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return parsed || "DC";
}

const isUrl = (v: string): boolean => /^https?:\/\//i.test(v.trim());

/**
 * Devuelve el HTML de la firma para el layout dado. Los valores vacíos se
 * omiten (no renderiza líneas en blanco). Escapa el texto del usuario.
 */
export function renderSignatureHtml(sig: SignatureRenderData): string {
  const typography = emailTypographyForSignature(sig.lang ?? "es");
  const bodyFont = typography.bodyFont;
  const nameFont = typography.formalChinese ? bodyFont : FONT_DISPLAY;
  const rootLang = `lang="${typography.htmlLang}"`;
  const name = escapeHtml(sig.full_name || "");
  const role = sig.role_label ? escapeHtml(sig.role_label) : "";
  const email = sig.email ? escapeHtml(sig.email) : "";
  const phone = sig.phone ? escapeHtml(sig.phone) : "";
  const rawPhoto = sig.photo_url?.trim() || "";

  const nameHtml = name
    ? `<div style="font:${typography.formalChinese ? "700" : "900"} 16px/1.1 ${nameFont};color:${INK};letter-spacing:-0.01em;">${name}</div>`
    : "";
  const roleHtml = role
    ? `<div style="font:500 12px/1.4 ${bodyFont};color:${MUTE};margin-top:3px;">${role}</div>`
    : "";
  const emailHtml = email
    ? `<a href="mailto:${email}" style="color:${MUTE};text-decoration:none;">${email}</a>`
    : "";
  const phoneHtml = phone
    ? `<span style="font-family:${FONT_MONO};font-weight:600;color:${MUTE};">${phone}</span>`
    : "";
  const brandHtml = `<div style="margin-top:8px;font:700 10.5px/1 ${FONT_SANS};color:${WINE};letter-spacing:0.16em;">DTDCARGO.COM</div>`;

  // ── corporate (clásico): barra lateral + datos completos ────
  if (sig.layout === "corporate") {
    const contact = [emailHtml, phoneHtml].filter(Boolean).join("<br/>");
    return (
      `<table ${rootLang} cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tbody><tr>` +
      `<td style="border-left:3px solid ${WINE};padding-left:14px;font:500 13px/1.5 ${bodyFont};color:${INK};">` +
      nameHtml +
      roleHtml +
      (contact
          ? `<div style="margin-top:8px;font:500 11.5px/1.5 ${bodyFont};color:${MUTE};">${contact}</div>`
        : "") +
      brandHtml +
      `</td></tr></tbody></table>`
    );
  }

  // ── inline (compacto): todo en línea ────────────────────────
  if (sig.layout === "inline") {
    const line1 = [
      name ? `<b style="color:${INK};">${name}</b>` : "",
      role ? `<span style="color:${MUTE};">${role}</span>` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    const line2 = [
      emailHtml,
      phoneHtml,
      `<b style="color:${WINE};letter-spacing:0.1em;">DTDCARGO.COM</b>`,
    ]
      .filter(Boolean)
      .join(" · ");
    return (
      `<div ${rootLang} style="font:500 12.5px/1.5 ${bodyFont};color:${INK};">` +
      (line1 ? `<div>${line1}</div>` : "") +
      `<div style="margin-top:4px;color:${MUTE};font-size:11.5px;">${line2}</div>` +
      `</div>`
    );
  }

  // ── card (vertical): tarjeta con borde ──────────────────────
  if (sig.layout === "card") {
    return (
      `<div ${rootLang} style="display:inline-block;padding:14px 18px;border:1.5px solid ${INK};border-radius:4px;font-family:${bodyFont};color:${INK};text-align:left;">` +
      (name
        ? `<div style="font:${typography.formalChinese ? "700" : "900"} 14px/1 ${nameFont};letter-spacing:-0.01em;">${name}</div>`
        : "") +
      roleHtml +
      `<div style="height:1px;background:${RULE};margin:10px 0;"></div>` +
      (email
        ? `<div style="font:500 11px/1.5 ${bodyFont};color:${MUTE};">${emailHtml}</div>`
        : "") +
      (phone
        ? `<div style="font:600 11px/1.5 ${FONT_MONO};color:${MUTE};">${phoneHtml}</div>`
        : "") +
      brandHtml +
      `</div>`
    );
  }

  // ── minimal (mínimo): nombre + email ────────────────────────
  if (sig.layout === "minimal") {
    return (
      `<div ${rootLang} style="font:500 13px/1.5 ${bodyFont};color:${INK};">` +
      (name
        ? `<div style="font:800 14px/1.2 ${bodyFont};color:${INK};letter-spacing:-0.01em;">${name}</div>`
        : "") +
      (email
        ? `<div style="margin-top:4px;color:${MUTE};font-size:12px;">${emailHtml}</div>`
        : "") +
      `</div>`
    );
  }

  // ── image_only (foto): avatar + datos ───────────────────────
  if (sig.layout === "image_only") {
    const avatar =
      rawPhoto && isUrl(rawPhoto)
        ? `<img src="${escapeHtml(rawPhoto)}" width="52" height="52" alt="${name}" style="width:52px;height:52px;border-radius:50%;display:block;object-fit:cover;" />`
        : `<div style="width:52px;height:52px;border-radius:50%;background:${WINE_SOFT};color:#ffffff;text-align:center;line-height:52px;font:900 18px/52px ${FONT_DISPLAY};letter-spacing:-0.02em;">${
            rawPhoto && rawPhoto.length <= 3
              ? escapeHtml(rawPhoto.toUpperCase())
              : initialsFrom(sig.full_name || "")
          }</div>`;
    const contact = [emailHtml, phoneHtml].filter(Boolean).join(" · ");
    return (
      `<table ${rootLang} cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tbody><tr>` +
      `<td style="padding-right:14px;vertical-align:top;">${avatar}</td>` +
      `<td style="border-left:3px solid ${WINE};padding-left:14px;font:500 13px/1.5 ${bodyFont};color:${INK};">` +
      nameHtml +
      roleHtml +
      (contact
          ? `<div style="margin-top:8px;font:500 11.5px/1.5 ${bodyFont};color:${MUTE};">${contact}</div>`
        : "") +
      brandHtml +
      `</td></tr></tbody></table>`
    );
  }

  return "";
}

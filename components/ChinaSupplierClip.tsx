"use client";

import { useState } from "react";
import { CONTACT, FONT_MONO } from "@/lib/design-tokens";
import { FlagCN } from "@/components/Icon";

/**
 * China Supplier Clip — texto pre-formateado para que el cliente lo copie y
 * pegue en WeChat al hablar con su proveedor chino. Origen: brand book
 * § Registro de cliente · Shipping Mark.
 *
 * Incluye:
 * - Dirección de bodega en caracteres chinos (义乌)
 * - Contacto de coordinación de DTD en China (吴小姐 + WeChat DTDLogistic)
 * - Horario de recepción
 * - Código Shipping Mark del cliente (formato DTD-XXXX)
 *
 * El proveedor chino lee este texto en WeChat y sabe exactamente dónde entregar
 * la carga y cómo marcarla con el código que identifica al cliente.
 *
 * Prop `markbox` (SDD-0096): si viene (ej. en el cierre del registro, donde el
 * código YA existe), se precarga y se ocultan el input + el footer de "solicitar
 * por WhatsApp". Sin prop (uso en /contacto) → comportamiento original: input
 * manual + footer. Retrocompatible.
 */
export function ChinaSupplierClip({ markbox }: { markbox?: string } = {}) {
  const fixed = typeof markbox === "string" && markbox.trim() !== "";
  const [typed, setTyped] = useState("");
  const [copied, setCopied] = useState(false);

  const placeholder = "DTD-XXXX";
  const codeForClip = fixed
    ? markbox!.trim().toUpperCase()
    : typed.trim() || placeholder;

  const cn = CONTACT.cn;
  const clipText = `仓库地址：${cn.addressCjk}
联系人：${cn.supplierContactCjk}（${cn.supplierContactEs}）：${cn.phoneCjk}
微信（WeChat）：${cn.wechatId}
收货时间：${cn.hoursCjk}
客户编码（请写在每个箱子上）：${codeForClip}`;

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(clipText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // navegadores muy viejos sin clipboard API — fallback silencioso
    }
  }

  return (
    <div
      className="card-shadow-dark rounded-[18px] p-7 lg:p-8 flex flex-col gap-5"
      style={{
        // Card navy en AMBOS temas: en el portal oscuro `bg-ink`/`text-white` se
        // volteaban (cream sobre cream) → washed-out. Los tokens --hero-* son navy
        // en claro y oscuro (mismo patrón que la card "TU CÓDIGO" del perfil);
        // fuera del portal (público /contacto) el fallback --color-ink ya es navy.
        background:
          "linear-gradient(135deg, var(--hero-from, var(--color-ink)) 0%, var(--hero-to, var(--color-ink)) 100%)",
        color: "var(--hero-ink, #fff)",
      }}
    >
      <div>
        <div className="eyebrow" style={{ color: "var(--hero-mute, rgba(255,255,255,0.55))" }}>
          <FlagCN size={16} /> Para tu proveedor en China
        </div>
        <h3
          className="mt-3 text-[22px] leading-[1.15] tracking-[-0.01em]"
          style={{ fontFamily: "var(--font-archivo-black)" }}
        >
          Texto listo para WeChat
        </h3>
        <p
          className="mt-2 text-[13.5px] leading-[1.5] max-w-[42ch]"
          style={{ color: "var(--hero-soft, rgba(255,255,255,0.68))" }}
        >
          Tu proveedor en China lee esto y entiende dónde entregar la carga y
          cómo marcarla con tu código Shipping Mark.
        </p>
      </div>

      {!fixed && (
        <div className="flex flex-col gap-2">
          <label
            htmlFor="markbox-input"
            className="text-[11px] tracking-[0.12em] uppercase text-white/55"
          >
            Tu código Shipping Mark (opcional)
          </label>
          <input
            id="markbox-input"
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value.toUpperCase())}
            placeholder={placeholder}
            maxLength={50}
            className="h-11 px-3.5 rounded-[8px] bg-white/10 border border-white/15 outline-none text-[14px] font-semibold tracking-[0.04em] text-white placeholder:text-white/30 focus:border-wine-soft"
            style={{ fontFamily: FONT_MONO }}
            aria-label="Código Shipping Mark del cliente"
          />
        </div>
      )}

      <pre
        className="m-0 p-4 rounded-[8px] text-[12.5px] leading-[1.6] whitespace-pre-wrap break-words"
        style={{
          fontFamily: 'var(--font-noto-sc), "Noto Sans SC", sans-serif',
          background: "rgba(0,0,0,0.26)",
          border: "1px solid rgba(255,255,255,0.12)",
          color: "var(--hero-ink, #fff)",
        }}
        aria-label="Texto en chino listo para copiar"
      >
        {clipText}
      </pre>

      <button
        type="button"
        onClick={copyToClipboard}
        className="btn btn-primary w-full"
        aria-live="polite"
      >
        {copied ? "✓ Copiado al portapapeles" : "Copiar texto para WeChat"}
      </button>

      {!fixed && (
        <p className="text-[12px] text-white/45 leading-[1.5]">
          ¿No tienes Shipping Mark todavía?{" "}
          <a
            href={`https://wa.me/${CONTACT.ve.whatsappRaw}?text=${encodeURIComponent(
              "Hola DTD Cargo, quiero registrarme y obtener mi código Shipping Mark.",
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold underline underline-offset-2 hover:text-white"
            style={{ color: "var(--color-wine-soft)" }}
          >
            Solicítalo por WhatsApp →
          </a>
        </p>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { CONTACT, FONT_MONO } from "@/lib/design-tokens";

/**
 * Guía Alibaba — la dirección canónica de la bodega de Yiwu, campo por campo,
 * con botón "copiar" por cada valor (el chino se pega TAL CUAL, sin traducir).
 *
 * Fuente única de la dirección: CONTACT.cn en lib/design-tokens.ts (F2 —
 * dirección única de bodega). El cliente escribe su Shipping Mark y el campo
 * Destinatario se arma solo; sin Shipping Mark la caja llega a la bodega pero
 * no se puede identificar de quién es — por eso el botón de Destinatario NO
 * copia el placeholder DTD-XXXX: enfoca el input y pide el mark real.
 */

type GuideField = {
  id: string;
  /** Nombre del campo en el formulario chino de Alibaba (Noto Sans SC + lang). */
  labelCjk?: string;
  label: string;
  value: string;
  hint?: string;
  /** El VALOR es texto chino → fuente Noto Sans SC + lang="zh-Hans". */
  cjk?: boolean;
};

const NOTO_SC = 'var(--font-noto-sc), "Noto Sans SC", sans-serif';

export function AlibabaAddressGuide() {
  const [mark, setMark] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const hasMark = mark.trim().length > 0;
  const markOrPlaceholder = mark.trim().toUpperCase() || "DTD-XXXX";

  const fields: GuideField[] = [
    {
      id: "pais",
      labelCjk: "国家/地区",
      label: "País / región",
      value: "China",
    },
    {
      id: "destinatario",
      labelCjk: "收货人",
      label: "Destinatario",
      value: `DTD Cargo - ${markOrPlaceholder}`,
      hint: "Tu Shipping Mark va al final — sin él no podemos saber que la caja es tuya.",
    },
    {
      id: "telefono",
      labelCjk: "电话",
      label: "Teléfono (+86)",
      value: CONTACT.cn.phoneCjk,
    },
    {
      id: "direccion",
      labelCjk: "地址",
      label: "Dirección",
      value: CONTACT.cn.addressCjk,
      hint: "Pégala en chino tal cual, sin traducir — es para el transporte dentro de China.",
      cjk: true,
    },
    {
      id: "provincia",
      labelCjk: "省",
      label: "Provincia",
      value: CONTACT.cn.provinceCjk,
      hint: "Zhejiang",
      cjk: true,
    },
    {
      id: "ciudad",
      labelCjk: "市",
      label: "Ciudad",
      value: CONTACT.cn.cityCjk,
      hint: `Yiwu — en el selector aparece bajo ${CONTACT.cn.cityParentCjk} (Jinhua)`,
      cjk: true,
    },
    {
      id: "postal",
      labelCjk: "邮编",
      label: "Código postal",
      value: CONTACT.cn.postalCode,
    },
    {
      id: "contacto",
      labelCjk: "仓库联系人",
      label: "Contacto de bodega",
      value: CONTACT.cn.contactPersonCjk,
      hint: CONTACT.cn.contactPersonPinyin,
      cjk: true,
    },
    {
      id: "email",
      label: "Email",
      value: CONTACT.cn.email,
    },
  ];

  async function copyField(id: string, value: string) {
    // Copiar "DTD Cargo - DTD-XXXX" literal en Alibaba = caja sin identificar
    // en Yiwu (el fallo exacto que esta guía existe para prevenir).
    if (id === "destinatario" && !hasMark) {
      document.getElementById("guide-shipping-mark")?.focus();
      setCopiedField("destinatario-missing");
      setTimeout(
        () => setCopiedField((c) => (c === "destinatario-missing" ? null : c)),
        2000,
      );
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(id);
      // Functional update: copiar otro campo antes de los 2s no corta su feedback.
      setTimeout(() => setCopiedField((c) => (c === id ? null : c)), 2000);
    } catch {
      // navegadores muy viejos sin clipboard API — fallback silencioso
    }
  }

  return (
    <div className="card-shadow-static rounded-[18px] border border-grey-200 bg-white overflow-hidden">
      {/* Input del Shipping Mark — arma el campo Destinatario en vivo */}
      <div
        className="p-5 lg:p-6 border-b border-grey-200"
        style={{ background: "var(--color-paper)" }}
      >
        <label
          htmlFor="guide-shipping-mark"
          className="block text-[11px] tracking-[0.12em] uppercase font-semibold text-grey-700"
        >
          Tu Shipping Mark (opcional)
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <input
            id="guide-shipping-mark"
            type="text"
            value={mark}
            onChange={(e) => setMark(e.target.value.toUpperCase())}
            placeholder="DTD-XXXX"
            maxLength={50}
            className="h-11 w-[180px] px-3.5 rounded-[8px] bg-white border border-grey-200 outline-none text-[14px] font-semibold tracking-[0.04em] text-ink placeholder:text-grey-700/55 focus:border-wine focus-visible:ring-2 focus-visible:ring-wine-soft"
            style={{ fontFamily: FONT_MONO }}
            aria-label="Tu código Shipping Mark"
          />
          <p className="text-[12.5px] leading-[1.5] text-grey-700 max-w-[40ch]">
            Escríbelo y el campo Destinatario se arma solo.{" "}
            <a
              href="/registro"
              className="font-semibold underline underline-offset-2"
              style={{ color: "var(--color-wine)" }}
            >
              ¿No tienes uno? Regístrate →
            </a>
          </p>
        </div>
      </div>

      {/* Campos del formulario de Alibaba, con copiar por campo */}
      <ul className="m-0 p-0 list-none">
        {fields.map((f) => {
          const missingMark =
            f.id === "destinatario" && copiedField === "destinatario-missing";
          return (
            <li
              key={f.id}
              className="flex items-center justify-between gap-4 px-5 lg:px-6 py-3.5 border-b border-grey-200 last:border-b-0"
            >
              <div className="min-w-0">
                <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-grey-700/80">
                  {f.labelCjk ? (
                    <>
                      <span lang="zh-Hans" style={{ fontFamily: NOTO_SC }}>
                        {f.labelCjk}
                      </span>
                      {" · "}
                    </>
                  ) : null}
                  {f.label}
                </div>
                <div
                  className="mt-0.5 text-[15px] font-semibold text-ink break-words"
                  lang={f.cjk ? "zh-Hans" : undefined}
                  style={{ fontFamily: f.cjk ? NOTO_SC : FONT_MONO }}
                >
                  {f.value}
                </div>
                {f.hint ? (
                  <div className="mt-0.5 text-[12px] leading-[1.45] text-grey-700">
                    {f.hint}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => copyField(f.id, f.value)}
                aria-live="polite"
                aria-label={
                  missingMark
                    ? "Escribe tu Shipping Mark primero"
                    : copiedField === f.id
                      ? `${f.label}: copiado`
                      : `Copiar ${f.label}`
                }
                className="flex-shrink-0 h-10 min-w-[96px] px-3.5 rounded-[8px] border border-grey-200 bg-white text-[12.5px] font-bold text-ink hover:border-wine hover:text-wine transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine-soft"
              >
                {missingMark
                  ? "Falta tu mark ↑"
                  : copiedField === f.id
                    ? "✓ Copiado"
                    : "Copiar"}
              </button>
            </li>
          );
        })}
      </ul>

      {/* La distinción clave: formulario vs rótulo físico */}
      <div
        className="px-5 lg:px-6 py-4"
        style={{
          background: "var(--color-paper)",
          borderTop: "3px solid var(--color-wine)",
        }}
      >
        <p className="m-0 text-[13px] leading-[1.55] text-grey-700">
          <strong className="text-ink">Importante:</strong> en el formulario de
          Alibaba el destinatario lleva «DTD Cargo + tu Shipping Mark», pero en
          el <strong className="text-ink">rótulo físico de la caja</strong> va
          SOLO tu Shipping Mark — sin tu nombre, dirección ni teléfono personal
          (los datos personales en la caja causan confusión o decomiso).
        </p>
      </div>
    </div>
  );
}

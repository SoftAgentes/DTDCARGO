"use client";

import { useState } from "react";
import { CONTACT } from "@/lib/design-tokens";

/**
 * Guía Alibaba — la dirección canónica de la bodega de Yiwu, campo por campo,
 * con botón "copiar" por cada valor (el chino se pega TAL CUAL, sin traducir).
 *
 * Fuente única de la dirección: CONTACT.cn en lib/design-tokens.ts (F2 —
 * dirección única de bodega). El cliente escribe su Shipping Mark y el campo
 * Destinatario se arma solo; sin Shipping Mark la caja llega a la bodega pero
 * no se puede identificar de quién es.
 */

type GuideField = {
  id: string;
  label: string;
  value: string;
  hint?: string;
  cjk?: boolean;
};

export function AlibabaAddressGuide() {
  const [mark, setMark] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const markOrPlaceholder = mark.trim().toUpperCase() || "DTD-XXXX";

  const fields: GuideField[] = [
    {
      id: "destinatario",
      label: "收货人 · Destinatario",
      value: `DTD Cargo - ${markOrPlaceholder}`,
      hint: "Tu Shipping Mark va al final — sin él no podemos saber que la caja es tuya.",
    },
    {
      id: "telefono",
      label: "电话 · Teléfono (+86)",
      value: CONTACT.cn.phoneCjk,
    },
    {
      id: "direccion",
      label: "地址 · Dirección",
      value: CONTACT.cn.addressCjk,
      hint: "Pégala en chino tal cual, sin traducir — es para el transporte dentro de China.",
      cjk: true,
    },
    {
      id: "provincia",
      label: "省 · Provincia",
      value: CONTACT.cn.provinceCjk,
      hint: "Zhejiang",
      cjk: true,
    },
    {
      id: "ciudad",
      label: "市 · Ciudad",
      value: CONTACT.cn.cityCjk,
      hint: `Yiwu — en el selector aparece bajo ${CONTACT.cn.cityParentCjk} (Jinhua)`,
      cjk: true,
    },
    {
      id: "postal",
      label: "邮编 · Código postal",
      value: CONTACT.cn.postalCode,
    },
    {
      id: "contacto",
      label: "仓库联系人 · Contacto de bodega",
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
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(id);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // navegadores muy viejos sin clipboard API — fallback silencioso
    }
  }

  return (
    <div className="card-shadow rounded-[18px] border border-grey-200 bg-white overflow-hidden">
      {/* Input del Shipping Mark — arma el campo Destinatario en vivo */}
      <div className="p-5 lg:p-6 border-b border-grey-200" style={{ background: "var(--color-paper)" }}>
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
            className="h-11 w-[180px] px-3.5 rounded-[8px] bg-white border border-grey-200 outline-none text-[14px] font-semibold tracking-[0.04em] text-ink placeholder:text-grey-700/40 focus:border-wine focus-visible:ring-2 focus-visible:ring-wine-soft"
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
            }}
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
        {fields.map((f) => (
          <li
            key={f.id}
            className="flex items-center justify-between gap-4 px-5 lg:px-6 py-3.5 border-b border-grey-200 last:border-b-0"
          >
            <div className="min-w-0">
              <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-grey-700/80">
                {f.label}
              </div>
              <div
                className="mt-0.5 text-[15px] font-semibold text-ink break-words"
                style={
                  f.cjk
                    ? { fontFamily: 'var(--font-noto-sc), "Noto Sans SC", sans-serif' }
                    : {
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
                      }
                }
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
              className="flex-shrink-0 h-9 px-3.5 rounded-[8px] border border-grey-200 bg-white text-[12.5px] font-bold text-ink hover:border-wine hover:text-wine transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine-soft"
            >
              {copiedField === f.id ? "✓ Copiado" : "Copiar"}
            </button>
          </li>
        ))}
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

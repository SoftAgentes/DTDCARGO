"use client";

import { useState } from "react";
import { CONTACT, FONT_MONO } from "@/lib/design-tokens";

/**
 * Guía "Datos para web de compra" — la dirección canónica de la bodega de Yiwu
 * para pegar en Alibaba / 1688 / Taobao.
 *
 * Estructura en DOS pasos (SDD-0264), no en una lista de campos sueltos. El
 * formulario de Alibaba trae un "Rellenar automáticamente la dirección" que de
 * una sola pegada llena los ocho campos — ése es el camino rápido, y es lo que
 * el cliente quiere. Pero hay dos trampas MEDIDAS contra el formulario real
 * (logistics.alibaba.com/luyou/shipto · 2026-08-14):
 *
 *   1. El rellenado BORRA el Shipping Mark del nombre. Pegando
 *      "林冠 DTD-1014, …" el campo "Nombre y apellido" queda en "林冠" pelado,
 *      sin avisar. La caja llegaría a Yiwu sin poder identificarse. Por eso el
 *      paso 2 existe y no es opcional.
 *   2. El nombre debe llevar chino ("Debe estar en chino" es el error literal
 *      del formulario ante "DTD-Canopy"). 林冠 + el mark sí lo acepta el
 *      servidor: probado guardando la dirección.
 *
 * Fuente única de los datos: CONTACT.cn en lib/design-tokens.ts.
 */

type GuideField = {
  id: string;
  labelCjk?: string;
  label: string;
  value: string;
  hint?: string;
  cjk?: boolean;
};

const NOTO_SC = 'var(--font-noto-sc), "Noto Sans SC", sans-serif';
// Tinte wine derivado del token. `--color-white`, NO `#ffffff` literal: en el
// tema oscuro del portal ese token vale navy, y con el blanco fijo el bloque
// quedaba como un parche claro sobre la tarjeta oscura.
const MARK_BG = "color-mix(in srgb, var(--color-wine) 8%, var(--color-white))";

/**
 * @param markbox Shipping Mark ya conocido (portal autenticado): precarga el
 *   valor y oculta el input + la nota de "¿no tienes uno?". Sin la prop
 *   (páginas públicas) mantiene el comportamiento original: input manual.
 *   Mismo patrón que `ChinaSupplierClip`.
 */
export function AlibabaAddressGuide({ markbox }: { markbox?: string } = {}) {
  const fixed = typeof markbox === "string" && markbox.trim() !== "";
  const [mark, setMark] = useState(fixed ? markbox.trim().toUpperCase() : "");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const hasMark = mark.trim().length > 0;
  const markOrPlaceholder = mark.trim().toUpperCase() || "DTD-XXXX";
  const destinatario = `${CONTACT.cn.contactPersonCjk} ${markOrPlaceholder}`;

  const fields: GuideField[] = [
    { id: "pais", labelCjk: "国家/地区", label: "País / región", value: "China" },
    {
      id: "destinatario",
      labelCjk: "收货人",
      label: "Nombre y apellido (destinatario)",
      value: destinatario,
      hint: "Alibaba exige chino en este campo. 林冠 es el encargado de la bodega; tu Shipping Mark va detrás.",
      cjk: true,
    },
    { id: "telefono", labelCjk: "电话", label: "Teléfono (+86)", value: CONTACT.cn.phoneCjk },
    {
      id: "direccion",
      labelCjk: "地址",
      label: "Dirección o apartado postal",
      value: CONTACT.cn.addressLine1Cjk,
      hint: "En chino tal cual, sin traducir — es para el transporte dentro de China.",
      cjk: true,
    },
    {
      id: "direccion2",
      labelCjk: "详细地址",
      label: "Apartamento, suite, unidad, edificio, piso",
      value: CONTACT.cn.addressLine2Cjk,
      hint: "Dice «opcional», pero es el número de nuestro puesto. Ponlo.",
      cjk: true,
    },
    {
      id: "provincia",
      labelCjk: "省",
      label: "Estado / provincia",
      value: CONTACT.cn.provinceCjk,
      hint: "Zhejiang",
      cjk: true,
    },
    {
      id: "ciudad",
      labelCjk: "市",
      label: "Ciudad",
      value: CONTACT.cn.cityCjk,
      hint: "Jinhua. Aquí NO busques Yiwu: no aparece, porque Yiwu va en el Distrito.",
      cjk: true,
    },
    {
      id: "distrito",
      labelCjk: "区/县",
      label: "Distrito",
      value: CONTACT.cn.districtCjk,
      hint: "Yiwu — aquí sí. Es obligatorio, aunque muchas guías ni lo mencionan.",
      cjk: true,
    },
    { id: "postal", labelCjk: "邮编", label: "Código postal", value: CONTACT.cn.postalCode },
    { id: "email", label: "Email", value: CONTACT.cn.email },
  ];

  function flashCopied(id: string) {
    setCopiedField(id);
    setTimeout(() => setCopiedField((c) => (c === id ? null : c)), 2000);
  }

  function requireMark(flag: string) {
    document.getElementById("guide-shipping-mark")?.focus();
    setCopiedField(flag);
    setTimeout(() => setCopiedField((c) => (c === flag ? null : c)), 2000);
  }

  async function copyText(id: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      flashCopied(id);
    } catch {
      /* navegadores sin clipboard API — fallback silencioso */
    }
  }

  async function copyValue(id: string, value: string) {
    // Copiar "林冠 DTD-XXXX" literal = caja sin identificar en Yiwu.
    if ((id === "destinatario" || id === "mark") && !hasMark) {
      requireMark(id === "mark" ? "mark-missing" : "destinatario-missing");
      return;
    }
    await copyText(id, value);
  }

  async function copyAll() {
    if (!hasMark) {
      requireMark("all-missing");
      return;
    }
    const text = fields.map((f) => `${f.label}: ${f.value}`).join("\n");
    await copyText("all", text);
  }

  return (
    <div className="w-full max-w-[600px] card-shadow-static rounded-[18px] border border-grey-200 bg-white p-5 lg:p-6">
      <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-wine-text">
        Datos para web de compra
      </span>
      <p className="mt-2 text-[13.5px] leading-[1.55] text-grey-700">
        Para <strong className="text-ink">Alibaba, 1688, Taobao</strong> u otras
        webs que piden dirección de envío. Todo llega a nuestra bodega en China
        con tu Shipping Mark.
      </p>

      {/* Bloque del Shipping Mark (input público) — arma el Destinatario en vivo */}
      <div
        className="mt-4 rounded-[12px] border border-grey-200 p-3.5"
        style={{ background: MARK_BG }}
      >
        <label
          htmlFor="guide-shipping-mark"
          className="block text-[10px] font-bold uppercase tracking-[0.12em] text-grey-700"
        >
          Tu Shipping Mark · 唛头
          {fixed ? null : (
            <span style={{ color: "var(--color-wine-text)" }}> · obligatorio</span>
          )}
        </label>
        <div className="mt-1.5 flex items-center gap-2.5">
          {fixed ? (
            // En el portal el código ya se conoce: mostrarlo, no pedirlo.
            <code
              className="min-w-0 flex-1 text-[24px] font-extrabold tracking-[0.02em] text-wine-text"
              style={{ fontFamily: FONT_MONO }}
            >
              {mark}
            </code>
          ) : (
            <input
              id="guide-shipping-mark"
              type="text"
              value={mark}
              onChange={(e) => setMark(e.target.value.toUpperCase())}
              placeholder="DTD-XXXX"
              maxLength={50}
              aria-label="Tu código Shipping Mark"
              className="min-w-0 flex-1 bg-transparent text-[24px] font-extrabold tracking-[0.02em] text-wine outline-none placeholder:text-wine/35"
              style={{ fontFamily: FONT_MONO }}
            />
          )}
          <button
            type="button"
            onClick={() => copyValue("mark", markOrPlaceholder)}
            aria-label={hasMark ? "Copiar tu Shipping Mark" : "Escribe tu Shipping Mark primero"}
            className="flex-shrink-0 h-9 w-9 grid place-items-center rounded-[8px] border border-grey-200 bg-white text-grey-700 hover:border-wine hover:text-wine transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine-soft"
          >
            {copiedField === "mark" ? <CheckMini /> : <CopyMini />}
          </button>
        </div>
      </div>
      <p className="mt-2 text-[12px] leading-[1.5] text-grey-700">
        {fixed ? (
          "Este código va en el campo Nombre y apellido. Sin él, la caja llega a la bodega pero no sabemos de quién es."
        ) : (
          <>
            Escríbelo y los dos pasos de abajo se arman solos. Este dato lo
            obtienes dentro de tu registro de clientes.{" "}
            <a
              href="/registro"
              className="font-semibold underline underline-offset-2"
              style={{ color: "var(--color-wine-text)" }}
            >
              ¿No tienes uno? Regístrate →
            </a>
          </>
        )}
      </p>

      {/* ── Paso 1: el rellenado automático de Alibaba ─────────────────── */}
      <div className="mt-5 rounded-[12px] border border-grey-200 p-3.5">
        <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-wine-text">
          Paso 1 · La dirección, de una sola pegada
        </span>
        <p className="mt-1.5 text-[12.5px] leading-[1.5] text-grey-700">
          En Alibaba, abre{" "}
          <strong className="text-ink">
            «Rellenar automáticamente la dirección»
          </strong>{" "}
          (está plegado detrás de «Ver más»), pega esto y dale a «Rellenar
          formulario». Se llenan provincia, ciudad, distrito, código postal y las
          dos líneas de dirección de un golpe.
        </p>
        <div
          className="mt-2.5 rounded-[10px] px-3 py-2.5 text-[13px] leading-[1.5] text-ink break-words"
          lang="zh-Hans"
          style={{ background: "var(--color-paper)", fontFamily: NOTO_SC }}
        >
          {CONTACT.cn.addressAutofillCjk}
        </div>
        <button
          type="button"
          onClick={() => copyText("autofill", CONTACT.cn.addressAutofillCjk)}
          className="mt-2.5 inline-flex w-full items-center justify-center gap-2 h-11 px-4 rounded-[10px] text-[13.5px] font-bold transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine-soft"
          // `--color-on-accent`, NO `text-white`: en el tema oscuro del portal
          // `--color-white` vale navy, así que `text-white` sobre relleno wine
          // se vuelve navy-sobre-wine (ilegible). Este token no voltea.
          style={{
            background: "var(--color-wine)",
            color: "var(--color-on-accent)",
          }}
        >
          {copiedField === "autofill" ? (
            <>
              <CheckMini /> Copiado
            </>
          ) : (
            <>
              <CopyMini /> Copiar la dirección
            </>
          )}
        </button>
      </div>

      {/* ── Paso 2: el destinatario, que el automático borra ───────────── */}
      <div
        className="mt-3 rounded-[12px] p-3.5"
        style={{
          background: "var(--color-paper)",
          borderLeft: "3px solid var(--color-wine)",
        }}
      >
        <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-wine-text">
          Paso 2 · El destinatario, a mano
        </span>
        <p className="mt-1.5 text-[12.5px] leading-[1.5] text-grey-700">
          <strong className="text-ink">
            El rellenado automático borra tu Shipping Mark del nombre.
          </strong>{" "}
          Vuelve al campo «Nombre y apellido» y escribe esto — Alibaba exige que
          lleve chino, y así lo acepta:
        </p>
        <div className="mt-2.5 flex items-center gap-2.5">
          <div
            className="min-w-0 flex-1 rounded-[10px] border border-grey-200 bg-white px-3 py-2.5 text-[15px] font-semibold text-ink break-words"
            lang="zh-Hans"
            style={{ fontFamily: NOTO_SC }}
          >
            {destinatario}
          </div>
          <button
            type="button"
            onClick={() => copyValue("destinatario", destinatario)}
            aria-label={
              hasMark
                ? "Copiar el destinatario"
                : "Escribe tu Shipping Mark primero"
            }
            className="flex-shrink-0 h-10 w-10 grid place-items-center rounded-[8px] border border-grey-200 bg-white text-grey-700 hover:border-wine hover:text-wine transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine-soft"
          >
            {copiedField === "destinatario-missing" ? (
              <span className="text-[15px] leading-none text-wine">↑</span>
            ) : copiedField === "destinatario" ? (
              <CheckMini />
            ) : (
              <CopyMini />
            )}
          </button>
        </div>
      </div>

      {/* Acciones: Desplegar + Copiar todo */}
      <div className="mt-4 flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="inline-flex items-center gap-1.5 h-11 px-4 rounded-[10px] border border-grey-200 bg-white text-[13.5px] font-bold text-ink hover:border-wine hover:text-wine transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine-soft"
        >
          {expanded ? "Ocultar campos" : "Ver campo por campo"}
          <Chevron open={expanded} />
        </button>
        <button
          type="button"
          onClick={copyAll}
          className="inline-flex flex-1 min-w-[160px] items-center justify-center gap-2 h-11 px-4 rounded-[10px] border border-grey-200 bg-white text-[13.5px] font-bold text-ink hover:border-wine hover:text-wine transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine-soft"
        >
          {copiedField === "all" ? (
            <>
              <CheckMini /> Copiado
            </>
          ) : copiedField === "all-missing" ? (
            "Escribe tu Shipping Mark ↑"
          ) : (
            <>
              <CopyMini /> Copiar todo
            </>
          )}
        </button>
      </div>

      {/* Detalle campo por campo (oculto por defecto) */}
      {expanded && (
        <ul className="mt-4 m-0 p-0 list-none rounded-[12px] border border-grey-200 overflow-hidden">
          {fields.map((f, i) => {
            const missingMark =
              f.id === "destinatario" && copiedField === "destinatario-missing";
            return (
              <li
                key={f.id}
                className={`flex items-center justify-between gap-3 px-3.5 py-2.5 ${
                  i > 0 ? "border-t border-grey-200" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="text-[10px] tracking-[0.08em] uppercase font-semibold text-grey-700/80">
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
                    className="mt-0.5 text-[14px] font-semibold text-ink break-words"
                    lang={f.cjk ? "zh-Hans" : undefined}
                    style={{ fontFamily: f.cjk ? NOTO_SC : FONT_MONO }}
                  >
                    {f.value}
                  </div>
                  {f.hint ? (
                    <div className="mt-0.5 text-[11.5px] leading-[1.4] text-grey-700">
                      {f.hint}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => copyValue(f.id, f.value)}
                  aria-label={
                    missingMark
                      ? "Escribe tu Shipping Mark primero"
                      : copiedField === f.id
                        ? `${f.label}: copiado`
                        : `Copiar ${f.label}`
                  }
                  className="flex-shrink-0 h-8 w-8 grid place-items-center rounded-[8px] border border-grey-200 bg-white text-grey-700 hover:border-wine hover:text-wine transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine-soft"
                >
                  {missingMark ? (
                    <span className="text-[15px] leading-none text-wine">↑</span>
                  ) : copiedField === f.id ? (
                    <CheckMini />
                  ) : (
                    <CopyMini />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* La distinción clave: formulario vs rótulo físico */}
      <p
        className="mt-4 rounded-[10px] px-3.5 py-3 text-[12.5px] leading-[1.5] text-grey-700"
        style={{ background: "var(--color-paper)", borderLeft: "3px solid var(--color-wine)" }}
      >
        <strong className="text-ink">Importante:</strong> en el formulario el
        nombre lleva «林冠 + tu Shipping Mark», pero en el{" "}
        <strong className="text-ink">rótulo físico de la caja</strong> va SOLO tu
        Shipping Mark — sin tu nombre, dirección ni teléfono personal (los datos
        personales en la caja causan confusión o decomiso).
      </p>
    </div>
  );
}

function CopyMini() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

function CheckMini() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s" }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

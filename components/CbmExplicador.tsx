"use client";

import { useState } from "react";
import {
  cbmFromDimensions,
  parseDecimalInput,
  sanitizeDecimalText,
} from "@/lib/calculadora";
import { FONT_MONO } from "@/lib/design-tokens";

/**
 * CbmExplicador — widget de la FAQ "¿Qué es el CBM?" (`ancla: "cbm"`).
 *
 * Explica el CBM y lo deja calcular con las medidas del visitante en las tres
 * unidades que llegan de verdad: centímetros (ficha del proveedor chino),
 * metros y pulgadas (proveedor que factura para Estados Unidos).
 *
 * **El cálculo NO vive acá.** Todo termina en `cbmFromDimensions()` de
 * `lib/calculadora.ts`, que es la misma función que usa el panel "CBM por
 * medidas" de `<CalculadoraForm>`. Acá solo se convierte la unidad a
 * centímetros antes de llamarla — así la FAQ y la calculadora no pueden dar
 * números distintos para la misma caja (incluido el redondeo hacia arriba a 3
 * decimales que aplica `roundCBM`).
 *
 * Vive dentro del acordeón de /faq (fondo blanco). Solo clases del sistema y
 * tokens `var(--*)`.
 */

type Unidad = "cm" | "m" | "in";

/** Cuánto mide 1 unidad en centímetros — el puente hacia `cbmFromDimensions`. */
const A_CM: Record<Unidad, number> = { cm: 1, m: 100, in: 2.54 };

const UNIDADES: { id: Unidad; label: string }[] = [
  { id: "cm", label: "cm" },
  { id: "m", label: "m" },
  { id: "in", label: "pulgadas" },
];

/** Medidas de ejemplo por unidad — la misma caja expresada de tres formas. */
const EJEMPLO: Record<Unidad, { largo: string; ancho: string; alto: string }> = {
  cm: { largo: "60", ancho: "40", alto: "50" },
  m: { largo: "0,6", ancho: "0,4", alto: "0,5" },
  in: { largo: "24", ancho: "16", alto: "20" },
};

/** 1 m³ en pies cúbicos — para el importador que trabaja en medidas gringas. */
const FT3_POR_CBM = 35.3147;

/**
 * Formato venezolano (punto de miles, coma decimal) hecho a mano en vez de
 * `Intl`: es determinista entre server y cliente, así que no hay riesgo de
 * desajuste de hidratación ni dependencia del ICU del runtime.
 */
function fmt(n: number, max = 3): string {
  let s = n.toFixed(max);
  if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  const [entero, decimal] = s.split(".");
  const miles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decimal ? `${miles},${decimal}` : miles;
}

/**
 * Lee un campo de medida. El separador decimal da igual —"0,6" y "0.6" son el
 * mismo número— porque el visitante puede venir escribiendo en español o en
 * inglés. Eso lo resuelve `parseDecimalInput` de `lib/calculadora.ts`, el mismo
 * parser que usan los campos de la calculadora: no se reimplementa acá.
 */
function medida(valor: string): number {
  const n = parseDecimalInput(valor);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function CbmExplicador() {
  const [unidad, setUnidad] = useState<Unidad>("cm");
  const [largo, setLargo] = useState(EJEMPLO.cm.largo);
  const [ancho, setAncho] = useState(EJEMPLO.cm.ancho);
  const [alto, setAlto] = useState(EJEMPLO.cm.alto);
  const [bultos, setBultos] = useState("1");

  function cambiarUnidad(u: Unidad) {
    setUnidad(u);
    setLargo(EJEMPLO[u].largo);
    setAncho(EJEMPLO[u].ancho);
    setAlto(EJEMPLO[u].alto);
  }

  const factor = A_CM[unidad];
  const cajas = Math.max(1, Math.floor(medida(bultos)) || 1);

  // Todo pasa por la función de la calculadora: una sola fuente del número.
  const altoCm = medida(alto) * factor;
  const anchoCm = medida(ancho) * factor;
  const largoCm = medida(largo) * factor;
  const cbmPorBulto = cbmFromDimensions(altoCm, anchoCm, largoCm, 1);
  const cbmTotal = cbmFromDimensions(altoCm, anchoCm, largoCm, cajas);

  return (
    <div className="-mt-1 flex flex-col gap-5 pb-5">
      <p className="text-[14.5px] leading-[1.65] text-grey-700">
        <strong className="text-ink">CBM</strong> quiere decir{" "}
        <em>cubic meter</em>: metro cúbico. Es el espacio que ocupa tu mercancía
        dentro del contenedor, y es la unidad con la que se cobra el consolidado
        marítimo. No pagas por lo que pesa tu carga, sino por el espacio que
        ocupa.
      </p>

      {/* ── Diagrama: plano técnico del bulto ──────────────────────────── */}
      <figure className="m-0 rounded-[12px] border border-grey-200 bg-paper p-2">
        <svg
          viewBox="0 0 460 300"
          className="block h-auto w-full [&_.cara]:stroke-[var(--color-ink)] [&_.cota]:stroke-[var(--color-wine)] [&_.cota-txt]:fill-[var(--color-wine)] [&_.punta]:fill-[var(--color-wine)]"
          role="img"
          aria-label="Diagrama de una caja con sus tres medidas: largo en la base, ancho en profundidad y alto en la arista vertical."
        >
          <defs>
            <marker
              id="cbm-punta"
              viewBox="0 0 10 10"
              refX="5"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path className="punta" d="M 0 1 L 10 5 L 0 9 z" />
            </marker>
          </defs>

          {/* Caras: superior, lateral y frontal */}
          <path
            className="cara"
            d="M 70 128 L 140 74 L 340 74 L 270 128 Z"
            fill="var(--color-wine)"
            fillOpacity="0.10"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            className="cara"
            d="M 270 128 L 340 74 L 340 194 L 270 248 Z"
            fill="var(--color-wine)"
            fillOpacity="0.18"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            className="cara"
            d="M 70 128 L 270 128 L 270 248 L 70 248 Z"
            fill="var(--color-white)"
            fillOpacity="0.6"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />

          {/* Cinta de embalaje */}
          <path
            className="cara"
            d="M 170 128 L 170 248 M 240 74 L 170 128"
            fill="none"
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.35"
          />

          {/* Cota ALTO */}
          <path
            className="cota"
            d="M 52 128 L 52 248"
            fill="none"
            strokeWidth="1.4"
            markerStart="url(#cbm-punta)"
            markerEnd="url(#cbm-punta)"
          />
          <path
            className="cota"
            d="M 64 128 L 46 128 M 64 248 L 46 248"
            fill="none"
            strokeWidth="1"
            opacity="0.65"
          />
          <text
            className="cota-txt"
            x="44"
            y="193"
            textAnchor="end"
            style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 700 }}
          >
            Alto
          </text>

          {/* Cota LARGO */}
          <path
            className="cota"
            d="M 70 268 L 270 268"
            fill="none"
            strokeWidth="1.4"
            markerStart="url(#cbm-punta)"
            markerEnd="url(#cbm-punta)"
          />
          <path
            className="cota"
            d="M 70 256 L 70 274 M 270 256 L 270 274"
            fill="none"
            strokeWidth="1"
            opacity="0.65"
          />
          <text
            className="cota-txt"
            x="170"
            y="288"
            textAnchor="middle"
            style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 700 }}
          >
            Largo
          </text>

          {/* Cota ANCHO (profundidad) */}
          <path
            className="cota"
            d="M 284 258 L 354 204"
            fill="none"
            strokeWidth="1.4"
            markerStart="url(#cbm-punta)"
            markerEnd="url(#cbm-punta)"
          />
          <path
            className="cota"
            d="M 272 250 L 290 264 M 342 196 L 360 210"
            fill="none"
            strokeWidth="1"
            opacity="0.65"
          />
          <text
            className="cota-txt"
            x="372"
            y="240"
            textAnchor="start"
            style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 700 }}
          >
            Ancho
          </text>
        </svg>
        <figcaption className="mt-1 flex justify-between gap-3 border-t border-grey-200 px-2 py-1.5 text-[10.5px] uppercase tracking-[0.06em] text-grey-500">
          <span>Medida exterior del bulto</span>
          <span>Incluye el embalaje</span>
        </figcaption>
      </figure>

      {/* ── La fórmula ─────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-2 rounded-[12px] border border-grey-300 bg-paper px-4 py-5">
        <p
          className="m-0 text-center text-[clamp(15px,3.6vw,20px)] font-bold leading-[1.5] text-ink"
          style={{ fontFamily: FONT_MONO }}
        >
          <span className="text-wine-text">Largo</span> ×{" "}
          <span className="text-wine-text">Ancho</span> ×{" "}
          <span className="text-wine-text">Alto</span> = CBM
        </p>
        <p className="m-0 text-center text-[12.5px] text-grey-500">
          Las tres medidas en <strong className="text-grey-700">metros</strong>.
          Si las tienes en centímetros o pulgadas, conviértelas primero.
        </p>
      </div>

      <p className="text-[14.5px] leading-[1.65] text-grey-700">
        Mide siempre <strong className="text-ink">por fuera de la caja</strong>,
        con el embalaje puesto: el contenedor no sabe qué hay adentro, solo ve el
        bulto. Y si algo sobresale, mide hasta el punto más ancho.
      </p>

      {/* ── Las tres unidades ──────────────────────────────────────────── */}
      <div className="grid gap-2.5 sm:grid-cols-3">
        {[
          {
            t: "Si mides en centímetros",
            f: "(L × A × H) ÷ 1.000.000",
            d: "Lo más común: la ficha del proveedor chino casi siempre viene en cm.",
          },
          {
            t: "Si mides en metros",
            f: "L × A × H",
            d: "Directo, sin convertir. El resultado ya es tu CBM.",
          },
          {
            t: "Si mides en pulgadas",
            f: "(L × A × H) ÷ 61.023,7",
            d: "Si te lo dan en pies cúbicos (ft³), divide entre 35,3147 para pasarlo a CBM.",
          },
        ].map((u) => (
          <div
            key={u.t}
            className="flex flex-col gap-1.5 rounded-[10px] border border-grey-200 bg-paper p-3.5"
            style={{ borderLeft: "3px solid var(--color-wine)" }}
          >
            <span className="text-[13.5px] font-bold text-ink">{u.t}</span>
            <span
              className="text-[12.5px] font-bold tabular-nums text-wine-text"
              style={{ fontFamily: FONT_MONO }}
            >
              {u.f}
            </span>
            <span className="text-[12.5px] leading-[1.5] text-grey-500">
              {u.d}
            </span>
          </div>
        ))}
      </div>

      {/* ── Calculadora ────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-[12px] border border-grey-300 bg-paper">
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-grey-200 px-4 py-3">
          <span className="text-[13.5px] font-bold text-ink">
            Calcúlalo con tus medidas
          </span>
          <div
            className="inline-flex overflow-hidden rounded-[6px] border border-grey-300"
            role="group"
            aria-label="Unidad de medida"
          >
            {UNIDADES.map((u) => {
              const activa = unidad === u.id;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => cambiarUnidad(u.id)}
                  aria-pressed={activa}
                  className="border-r border-grey-300 px-3 py-1.5 text-[11.5px] font-bold last:border-r-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine-soft"
                  style={{
                    fontFamily: FONT_MONO,
                    background: activa
                      ? "var(--color-wine)"
                      : "var(--color-white)",
                    color: activa
                      ? "var(--color-on-accent)"
                      : "var(--color-grey-500)",
                  }}
                >
                  {u.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-4">
          {[
            { id: "cbm-largo", label: "Largo", v: largo, set: setLargo },
            { id: "cbm-ancho", label: "Ancho", v: ancho, set: setAncho },
            { id: "cbm-alto", label: "Alto", v: alto, set: setAlto },
            { id: "cbm-bultos", label: "Bultos iguales", v: bultos, set: setBultos },
          ].map((c) => (
            <div key={c.id} className="flex flex-col gap-1.5">
              <label
                htmlFor={c.id}
                className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-grey-500"
                style={{ fontFamily: FONT_MONO }}
              >
                {c.label}
              </label>
              <input
                id={c.id}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={c.v}
                // Mismo saneado que los campos de la calculadora: deja dígitos
                // y UN separador (coma o punto, el que el visitante escriba),
                // sin borrárselo a mitad de tipeo.
                onChange={(e) => c.set(sanitizeDecimalText(e.target.value))}
                className="w-full rounded-[8px] border border-grey-300 bg-white px-3 py-2 text-[15px] font-medium tabular-nums text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine-soft"
                style={{ fontFamily: FONT_MONO }}
              />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-t border-grey-200 bg-white px-4 py-3.5">
          <div>
            <span
              className="block text-[10.5px] font-bold uppercase tracking-[0.08em] text-grey-500"
              style={{ fontFamily: FONT_MONO }}
            >
              Volumen total
            </span>
            <span className="text-[clamp(24px,6vw,32px)] font-extrabold leading-none tabular-nums text-wine-text">
              {fmt(cbmTotal)}
              <span
                className="ml-1 text-[14px] font-bold text-grey-500"
                style={{ fontFamily: FONT_MONO }}
              >
                CBM
              </span>
            </span>
          </div>
          <div
            className="text-right text-[12px] tabular-nums text-grey-500"
            style={{ fontFamily: FONT_MONO }}
          >
            = {fmt(cbmTotal * FT3_POR_CBM, 2)} ft³
            {cajas > 1 && (
              <>
                <br />
                {fmt(cbmPorBulto)} CBM por bulto
              </>
            )}
          </div>
        </div>
      </div>

      <p className="text-[13.5px] leading-[1.6] text-grey-700">
        En DTD Cargo el consolidado se cobra{" "}
        <strong className="text-ink">por CBM y por destino</strong> dentro de
        Venezuela. Con tu volumen ya puedes sacar el estimado en la{" "}
        <a
          href="/tarifas"
          className="font-semibold text-wine-text underline decoration-1 underline-offset-4"
        >
          calculadora
        </a>{" "}
        o pedirle la cotización exacta a un asesor.
      </p>
    </div>
  );
}

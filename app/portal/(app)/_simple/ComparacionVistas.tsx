"use client";

import {
  COMPARACION,
  COMPARACION_DATOS,
  COMPARACION_INTRO,
  COMPARACION_LEMAS,
  COMPARACION_TITULO,
} from "@/lib/portal/simple/contenido/comparacion";
import { Dialogo } from "./Dialogo";

/**
 * SDD-0654 fase 2 · «Comparar»: Vista simple o Vista Pro (§6.1, AC-16).
 *
 * En pantalla ancha es una tabla de dos columnas; en teléfono cada fila se apila
 * (aspecto, luego simple y luego Pro) y nada se desplaza de lado.
 */
export function ComparacionVistas({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  return (
    <Dialogo abierto={abierto} titulo={COMPARACION_TITULO} onCerrar={onCerrar} ancho="lg">
      <p className="text-[15px] leading-[1.55] text-grey-700">{COMPARACION_INTRO}</p>
      <dl className="mt-4 grid gap-3">
        <div className="hidden sm:grid sm:grid-cols-[150px_1fr_1fr] sm:gap-4 text-[13px] font-bold text-grey-700">
          <span aria-hidden="true" />
          <span>
            Vista simple · <span className="font-semibold">{COMPARACION_LEMAS.simple}</span>
          </span>
          <span>
            Vista Pro · <span className="font-semibold">{COMPARACION_LEMAS.pro}</span>
          </span>
        </div>
        {COMPARACION.map((fila) => (
          <div
            key={fila.aspecto}
            className="grid gap-1.5 rounded-[12px] border border-grey-200 p-3 sm:grid-cols-[150px_1fr_1fr] sm:gap-4"
          >
            <dt className="text-[14px] font-extrabold">{fila.aspecto}</dt>
            <dd className="text-[15px] leading-[1.5]">
              <span className="font-bold sm:hidden">Vista simple: </span>
              {fila.simple}
            </dd>
            <dd className="text-[15px] leading-[1.5]">
              <span className="font-bold sm:hidden">Vista Pro: </span>
              {fila.pro}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-[15px] font-semibold">{COMPARACION_DATOS}</p>
    </Dialogo>
  );
}

"use client";

/**
 * SDD-0566 · Los campos para pedir una excepción al cierre: el aviso, la
 * superclave (solo en modo «superclave») y el motivo. Los usan el cajón del
 * asiento, dentro de su formulario, y el diálogo de las acciones del diario.
 *
 * La superclave es un campo de contraseña sin autocompletar y la controla
 * quien lo usa, para vaciarlo después de cada intento: nunca vuelve del
 * servidor ni se guarda en el estado de la página.
 */

import { useId } from "react";
import {
  excepcionPosible,
  pideSuperclave,
  textoAvisoCierre,
  type AvisoCierre,
} from "@/lib/studio/accounting/cierre-excepciones";

export function CamposExcepcionCierre({
  aviso,
  superclave,
  onSuperclave,
  motivo,
  onMotivo,
  disabled = false,
  nombres,
  conMotivo = true,
  primerCampoRef,
}: {
  aviso: AvisoCierre;
  superclave: string;
  onSuperclave: (v: string) => void;
  motivo: string;
  onMotivo: (v: string) => void;
  disabled?: boolean;
  /** Para un formulario: los `name` de los campos que viajan con él. */
  nombres?: { superclave: string; motivo: string };
  /** Anular ya pide el motivo en su propio campo. */
  conMotivo?: boolean;
  /** Recibe el primer campo que hay que llenar, para dejarle el foco al abrir. */
  primerCampoRef?: React.MutableRefObject<HTMLElement | null>;
}) {
  const id = useId();
  const avisoId = `${id}-aviso`;
  const posible = excepcionPosible(aviso);

  return (
    <div
      role="group"
      aria-labelledby={avisoId}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--s-3)",
        padding: "var(--s-3)",
        background: "var(--warning-bg)",
        border: "1px solid var(--warning)",
        borderRadius: "var(--r-sm)",
      }}
    >
      <p id={avisoId} style={{ margin: 0, font: "600 12.5px/1.45 var(--f-sans)", color: "var(--ink)" }}>
        {textoAvisoCierre(aviso)}
      </p>
      {posible && pideSuperclave(aviso) && (
        <label htmlFor={`${id}-superclave`} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span className="studio-label">Superclave del cierre</span>
          <input
            id={`${id}-superclave`}
            ref={(el) => {
              if (primerCampoRef) primerCampoRef.current = el;
            }}
            name={nombres?.superclave}
            type="password"
            autoComplete="off"
            spellCheck={false}
            className="studio-input"
            value={superclave}
            onChange={(e) => onSuperclave(e.target.value)}
            disabled={disabled}
            required
          />
        </label>
      )}
      {posible && conMotivo && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label htmlFor={`${id}-motivo`} className="studio-label">
            Motivo del cambio
          </label>
          <textarea
            id={`${id}-motivo`}
            ref={(el) => {
              if (primerCampoRef && !pideSuperclave(aviso)) primerCampoRef.current = el;
            }}
            name={nombres?.motivo}
            className="studio-input"
            rows={2}
            maxLength={1000}
            value={motivo}
            onChange={(e) => onMotivo(e.target.value)}
            disabled={disabled}
            required
            aria-describedby={`${id}-motivo-ayuda`}
            style={{ resize: "vertical", minHeight: 52 }}
          />
          <span id={`${id}-motivo-ayuda`} style={{ font: "500 11px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}>
            Queda en el reporte «Excepciones al cierre», con tu usuario y la hora.
          </span>
        </div>
      )}
    </div>
  );
}

/** ¿Están los datos para pedir la excepción? (el servidor vuelve a validar). */
export function excepcionCompleta(aviso: AvisoCierre, superclave: string, motivo: string): boolean {
  if (!excepcionPosible(aviso)) return false;
  if (motivo.trim().length < 4) return false;
  return !pideSuperclave(aviso) || superclave.length > 0;
}

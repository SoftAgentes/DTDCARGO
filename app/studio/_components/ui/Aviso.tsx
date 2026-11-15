/**
 * Aviso · franja única de avisos del Studio (SDD-0628, tramo 4a de SDD-0603).
 *
 * BD-037: lo que avisa es una franja plana con icono, sin contorno ni sombra.
 * BRAND §Estados: texto siempre en tinta neutra; el tono lo dan el icono y el
 * fondo suave. Todo el color vive en `studio.css` (`.studio-aviso*`): aquí no
 * hay estilo en línea.
 *
 * Semántica: `error` (o `urgente`) es `role="alert"`; el resto, `role="status"`
 * (A11Y-01 §5: el anuncio menos intrusivo que comunique el cambio).
 *
 * Uso:
 *   <Aviso tono="atencion" titulo="Falta el peso">Cotiza con un asesor.</Aviso>
 *   <Aviso tono="error" accion={{ etiqueta: "Reintentar", onClick: retry }}>No se pudo guardar.</Aviso>
 *
 * Foco (enmienda de SDD-0603, menores del Studio): `tabIndex` y `ref` dejan que
 * el formulario le lleve el foco al error bloqueante (ERR-01). El aviso no lo
 * toma solo, y ninguna de las dos props cambia su aspecto ni su `role`.
 */

import type { ReactNode, Ref } from "react";
import { StatusIcon } from "@/components/StatusIcon";

export type AvisoTono = "info" | "atencion" | "exito" | "error";

export interface AvisoAccion {
  /** Verbo visible del botón («Reintentar», «Ver detalle»). */
  etiqueta: string;
  onClick: () => void;
  disabled?: boolean;
}

export interface AvisoProps {
  /** Tono semántico. Por defecto `info`. */
  tono?: AvisoTono;
  /** Título opcional, en negrita, antes del mensaje. */
  titulo?: ReactNode;
  /** Mensaje: qué ocurrió y qué puede hacer la persona (ERR-01). */
  children: ReactNode;
  /** Acción opcional. Usa el botón secundario existente (`.studio-btn-ghost`). */
  accion?: AvisoAccion;
  /** Fuerza `role="alert"` en un tono que no es error (atención que bloquea). */
  urgente?: boolean;
  /** Padding y fuente reducidos, para drawers y menús densos. */
  compacto?: boolean;
  /**
   * Para recibir el foco por programa. Usa `-1`: se puede enfocar y queda fuera
   * del orden de Tab. `useDialogA11y` busca `[role="alert"][tabindex="-1"]`.
   */
  tabIndex?: number;
  /** Referencia a la franja, para enfocarla desde el formulario que la muestra. */
  ref?: Ref<HTMLDivElement>;
  id?: string;
  className?: string;
}

const ICONO: Record<AvisoTono, "info" | "warning" | "success" | "danger"> = {
  info: "info",
  atencion: "warning",
  exito: "success",
  error: "danger",
};

/** `role` según el tono: solo el error o lo urgente interrumpen al lector. */
export function rolDeAviso(tono: AvisoTono, urgente = false): "alert" | "status" {
  return tono === "error" || urgente ? "alert" : "status";
}

export function Aviso({
  tono = "info",
  titulo,
  children,
  accion,
  urgente = false,
  compacto = false,
  tabIndex,
  ref,
  id,
  className,
}: AvisoProps) {
  const clases = ["studio-aviso", compacto ? "studio-aviso-compacto" : null, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={ref}
      id={id}
      role={rolDeAviso(tono, urgente)}
      tabIndex={tabIndex}
      data-tono={tono}
      className={clases}
    >
      <StatusIcon tone={ICONO[tono]} size={compacto ? 14 : 16} />
      <div className="studio-aviso-cuerpo">
        {titulo ? <strong className="studio-aviso-titulo">{titulo}</strong> : null}
        <div className="studio-aviso-mensaje">{children}</div>
      </div>
      {accion ? (
        <button
          type="button"
          className="studio-btn studio-btn-ghost studio-btn-sm studio-aviso-accion"
          onClick={accion.onClick}
          disabled={accion.disabled}
        >
          {accion.etiqueta}
        </button>
      ) : null}
    </div>
  );
}

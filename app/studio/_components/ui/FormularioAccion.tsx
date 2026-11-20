"use client";

/**
 * <FormularioAccion> y <BotonEnvio> · formularios con server action que muestran que están trabajando (SDD-0678).
 *
 * `ActionButton` cubre el botón suelto con `onClick`; esto cubre el `<form action={…}>` de las páginas de servidor,
 * donde el botón es `type="submit"` y el resultado llega por `redirect` (aviso `?r=` arriba de la página).
 *
 * Lo que resuelve (medido el 2026-11-18 en la revisión de la oficina, desde el móvil):
 *   1. Mientras la acción corre, TODO el formulario queda deshabilitado (`<fieldset disabled>`): no se puede tocar
 *      otra vez el botón ni cambiar la opción marcada a mitad de la acción.
 *   2. El botón que se tocó dice «Guardando…» con spinner (`aria-busy`); los demás del mismo formulario quedan
 *      deshabilitados con su texto. El ancho no cambia entre los dos estados (BTN-01 §5).
 *   3. Un segundo envío antes de que React pinte el estado pendiente se descarta en `onSubmit` (candado en ref).
 *
 * Los valores viajan bien: el `FormData` se arma en el evento `submit`, antes de que el fieldset se deshabilite.
 *
 * Uso:
 *   <FormularioAccion action={registrarCierreAction}>
 *     …campos…
 *     <BotonEnvio>Registrar el cierre</BotonEnvio>
 *   </FormularioAccion>
 */

import { useEffect, useRef, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { EtiquetaEstable } from "./EtiquetaEstable";

type Accion = (formData: FormData) => void | Promise<void>;

export interface FormularioAccionProps {
  action: Accion;
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  "aria-label"?: string;
}

export function FormularioAccion({ action, children, style, className, "aria-label": ariaLabel }: FormularioAccionProps) {
  // Candado del doble envío: se cierra en el primer `submit` y se abre cuando la acción termina (bien o mal).
  const enviando = useRef(false);
  const alEnviar = (e: FormEvent<HTMLFormElement>) => {
    if (enviando.current) {
      e.preventDefault();
      return;
    }
    enviando.current = true;
  };
  return (
    <form action={action} onSubmit={alEnviar} style={style} className={className} aria-label={ariaLabel}>
      <Bloqueo alTerminar={() => (enviando.current = false)}>{children}</Bloqueo>
    </form>
  );
}

/** Hijo del `<form>`: `useFormStatus` solo lee el formulario que lo contiene. */
function Bloqueo({ children, alTerminar }: { children: ReactNode; alTerminar: () => void }) {
  const { pending } = useFormStatus();
  const estuvo = useRef(false);
  useEffect(() => {
    if (pending) estuvo.current = true;
    else if (estuvo.current) {
      estuvo.current = false;
      alTerminar();
    }
  }, [pending, alTerminar]);
  return (
    <fieldset disabled={pending} aria-busy={pending} data-pendiente={pending ? "si" : undefined} style={FIELDSET}>
      {children}
    </fieldset>
  );
}

const FIELDSET: CSSProperties = { border: 0, padding: 0, margin: 0, minWidth: 0 };

export interface BotonEnvioProps {
  children: ReactNode;
  /** Texto mientras corre. Por defecto «Guardando…». */
  textoPendiente?: string;
  /** Para varios botones en un formulario (p. ej. `veredicto=aprobado|rechazado`). */
  name?: string;
  value?: string;
  /** Clases del Studio (`studio-btn-primary`, `studio-btn-sm`…). `studio-btn` va siempre. */
  className?: string;
  disabled?: boolean;
}

export function BotonEnvio({ children, textoPendiente = "Guardando…", name, value, className, disabled = false }: BotonEnvioProps) {
  const { pending, data } = useFormStatus();
  // Con varios botones, solo el que se tocó dice «Guardando…»: el submitter viaja en el FormData.
  const esEste = pending && (name === undefined || data?.get(name) === value);
  const clases = ["studio-btn", className].filter(Boolean).join(" ");
  return (
    <button
      type="submit"
      name={name}
      value={value}
      className={clases}
      disabled={disabled || pending}
      aria-busy={esEste}
      style={{ minWidth: "max-content" }}
    >
      {/* BTN-01 §5 «Loading … conserva ancho»: ver `EtiquetaEstable`. */}
      <EtiquetaEstable enCurso={esEste} reposo={children} textoEnCurso={textoPendiente} />
    </button>
  );
}

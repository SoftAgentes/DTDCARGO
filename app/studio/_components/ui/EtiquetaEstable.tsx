/**
 * <EtiquetaEstable> · el contenido de un botón que trabaja sin cambiar de ancho (SDD-0678, BTN-01 §5).
 *
 * BTN-01 §5, Loading: «bloquea repetición, conserva ancho, muestra verbo en progreso y `aria-busy`». El ancho se
 * conserva poniendo las dos etiquetas (reposo y en curso, con su spinner) en la MISMA celda de una rejilla: la que no
 * se ve queda con `visibility: hidden` y sigue reservando su espacio. El botón mide siempre lo que la más ancha, en
 * reposo y mientras corre. Sin medir en JS (SSR y jsdom no tienen layout).
 *
 * Lo usan `BotonEnvio` (formularios con server action) y `DrawerFooter` (el submit de los drawers). `aria-busy`,
 * `disabled` y el candado los pone el botón que lo contiene.
 */
import type { CSSProperties, ReactNode } from "react";

export function EtiquetaEstable({
  enCurso,
  reposo,
  textoEnCurso,
}: {
  /** true mientras la acción corre. */
  enCurso: boolean;
  /** Lo que dice el botón en reposo. */
  reposo: ReactNode;
  /** El verbo en progreso («Guardando…», «Creando…»). */
  textoEnCurso: ReactNode;
}) {
  return (
    <span style={REJILLA} data-ancho-reservado="">
      <span style={celda(!enCurso)} aria-hidden={enCurso || undefined} data-etiqueta="reposo">
        {reposo}
      </span>
      <span style={celda(enCurso)} aria-hidden={enCurso ? undefined : true} data-etiqueta="pendiente">
        <span className={enCurso ? "studio-spin" : undefined} style={ICONO} aria-hidden="true">
          <Spinner />
        </span>
        {textoEnCurso}
      </span>
    </span>
  );
}

const ICONO: CSSProperties = { display: "inline-flex", width: 14, height: 14, flexShrink: 0 };
const REJILLA: CSSProperties = { display: "inline-grid", justifyItems: "center", alignItems: "center" };
const celda = (visible: boolean): CSSProperties => ({
  gridArea: "1 / 1",
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--s-2)",
  visibility: visible ? "visible" : "hidden",
});

export function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true">
      <path d="M20 11.5A8 8 0 1 1 12 4" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  );
}

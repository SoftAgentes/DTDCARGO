"use client";

/**
 * GuiaBoton · botón «Guía» de Studio (SDD-0589, paso 9.3).
 *
 * Abre la guía de la pantalla actual, o la cierra si está abierta. Con la guía a
 * medias, el motor sigue donde quedó; terminada o nunca vista, empieza por el primer
 * paso. En una pantalla sin recorrido no se muestra.
 *
 * Todavía NO está montado. El lugar propuesto es la barra superior (S-7, pendiente
 * de Sam), y `StudioTopbar.tsx` lo tocan ramas del rediseño (SDD-0603): montarlo es
 * una línea, `<GuiaBoton />`, cuando esa adopción lo permita.
 *
 * Es un botón de alternar: el nombre accesible no cambia («Guía») y el estado va en
 * `aria-pressed`. El `title` dice qué hace el próximo clic.
 */

import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n";
import { CLAVE_NOMBRE_BOTON } from "@/lib/studio/guia/preferencias";
import { RECORRIDOS, rutaCoincide } from "@/lib/studio/guia/recorridos";
import type { GuiaRecorrido } from "@/lib/studio/guia/tipos";
import { cerrarGuia, iniciarGuia, useGuiaAbierta } from "./GuiaMotor";

export function GuiaBoton({ catalogo = RECORRIDOS }: { catalogo?: readonly GuiaRecorrido[] } = {}) {
  const t = useT();
  const pathname = usePathname() ?? "";
  const abierta = useGuiaAbierta();
  const recorrido = catalogo.find((r) => rutaCoincide(r, pathname));
  if (!recorrido) return null;

  return (
    <button
      type="button"
      className="studio-btn studio-btn-ghost studio-btn-sm"
      aria-pressed={abierta}
      title={t(abierta ? "guide.chrome.toggle_off_aria" : "guide.chrome.toggle_on_aria")}
      onClick={() => (abierta ? cerrarGuia() : iniciarGuia(recorrido.id, { origen: "boton" }))}
    >
      {t(CLAVE_NOMBRE_BOTON)}
    </button>
  );
}

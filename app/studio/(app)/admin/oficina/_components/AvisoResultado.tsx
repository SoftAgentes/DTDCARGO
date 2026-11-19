"use client";

/**
 * El resultado de la última revisión o cierre (SDD-0678). Antes era un párrafo arriba de la página: en el móvil,
 * después de tocar «Registrar el cierre» al final de la lista, no se veía. Ahora:
 *   - dice QUÉ se guardó («Cierre de la conversación 27 registrado: Cumple»), para comprobarlo de un vistazo;
 *   - al montarse se desplaza hasta él y toma el foco (también en el móvil); `key` cambia en cada envío, así que se
 *     repite aunque el código sea el mismo;
 *   - error = `role="alert"`, lo demás `role="status"` (lo pone `<Aviso>`).
 */
import { useEffect, useRef } from "react";

import { Aviso, type AvisoTono } from "@/app/studio/_components/ui/Aviso";

export function AvisoResultado({ tono, children }: { tono: AvisoTono; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const quieto = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView?.({ block: "center", behavior: quieto ? "auto" : "smooth" });
    el.focus({ preventScroll: true });
  }, []);
  return (
    <div style={{ marginBottom: 16, scrollMarginTop: 80 }}>
      <Aviso tono={tono} tabIndex={-1} ref={ref}>
        {children}
      </Aviso>
    </div>
  );
}

/** Tono del aviso según el código de la acción: `ok_*` es éxito; `ok_rechazado` también (se guardó). */
export function tonoDelResultado(codigo: string): AvisoTono {
  return codigo.startsWith("ok_") ? "exito" : "error";
}

/** Lo que se guardó en un cierre, dicho con las palabras de los botones. */
export function detalleDelCierre(conversacion: string | null, cumple: string | null): string | null {
  if (!conversacion || (cumple !== "si" && cumple !== "no")) return null;
  return `Cierre de la conversación ${conversacion} registrado: ${cumple === "si" ? "Cumple" : "Falló"}.`;
}

/**
 * SDD-0678 · helpers puros del aviso de resultado de la oficina. Sin "use client": los importa `page.tsx` (servidor);
 * un valor importado de un módulo de cliente cruzaría la frontera RSC (`scripts/check-rsc-boundary.mjs`).
 */
import type { AvisoTono } from "@/app/studio/_components/ui/Aviso";

/** Tono del aviso según el código de la acción: `ok_*` es éxito; `ok_rechazado` también (se guardó). */
export function tonoDelResultado(codigo: string): AvisoTono {
  return codigo.startsWith("ok_") ? "exito" : "error";
}

/** Lo que se guardó en un cierre, dicho con las palabras de los botones. */
export function detalleDelCierre(conversacion: string | null, cumple: string | null): string | null {
  if (!conversacion || (cumple !== "si" && cumple !== "no")) return null;
  return `Cierre de la conversación ${conversacion} registrado: ${cumple === "si" ? "Cumple" : "Falló"}.`;
}

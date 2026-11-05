/**
 * lib/studio/guia/recorridos.ts · Catálogo de recorridos (SDD-0589).
 *
 * 9.2 trae solo el de demostración, sobre el Dashboard. Los recorridos del
 * guion 9.1 (Bandeja, Embudo, Ficha DTD, IA, Usuarios, Actualizaciones) los
 * agrega 9.5 cuando esas pantallas estén integradas y tengan sus anclas.
 */

import type { GuiaRecorrido } from "./tipos";

export const RECORRIDO_DASHBOARD: GuiaRecorrido = {
  id: "dashboard",
  ruta: "/studio/dashboard",
  pasos: [
    { id: "D1", ancla: "dashboard.bienvenida", clave: "guide.dashboard.welcome" },
    { id: "D2", ancla: "dashboard.kpis", clave: "guide.dashboard.kpis" },
    { id: "D3", ancla: "dashboard.configurar", clave: "guide.dashboard.configure" },
    { id: "D4", ancla: "dashboard.paneles", clave: "guide.dashboard.panels" },
  ],
};

export const RECORRIDOS: readonly GuiaRecorrido[] = [RECORRIDO_DASHBOARD];

export function buscarRecorrido(
  id: string | null | undefined,
  catalogo: readonly GuiaRecorrido[] = RECORRIDOS,
): GuiaRecorrido | null {
  if (!id) return null;
  return catalogo.find((r) => r.id === id) ?? null;
}

/** La ruta actual es la del recorrido o una subruta suya. */
export function rutaCoincide(recorrido: GuiaRecorrido, pathname: string): boolean {
  return pathname === recorrido.ruta || pathname.startsWith(`${recorrido.ruta}/`);
}

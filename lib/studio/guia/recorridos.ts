/**
 * lib/studio/guia/recorridos.ts · Catálogo de recorridos (SDD-0589).
 *
 * 9.2 trajo el de demostración, sobre el Dashboard. 9.5 agrega los del guion de
 * 9.1 que tienen pantalla en `main`. Un recorrido es una pantalla: las tarjetas
 * del guion se reparten según dónde existe su ancla. Las que no tienen pantalla
 * (IA, Usuarios, parte de la Ficha DTD) quedan pendientes en la spec.
 *
 * Los recorridos de 9.5 no arrancan solos (`arranqueAutomatico: false`, D11): se
 * abren con `?guia=<id>` hasta la prueba de 9.6 y el OK de Sam.
 */

import type { StudioUserRole } from "@/lib/studio/user-types";
import { ROLES_ASIGNAR } from "./preferencias";
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

/** Marco de la Bandeja: respaldo de las anclas que viven dentro de Chatwoot (9.4). */
export const ANCLA_MARCO_BANDEJA = "bandeja.marco";

/**
 * Bandeja (guion: recorrido 1 y F1). Todas las anclas están dentro del panel de
 * Chatwoot: las resuelve el puente de 9.4 con `chatwoot-selectores.json` y, si no
 * aparecen, la tarjeta va al marco.
 */
export const RECORRIDO_BANDEJA: GuiaRecorrido = {
  id: "bandeja",
  ruta: "/studio/bandeja",
  arranqueAutomatico: false,
  pasos: [
    { id: "B1", ancla: "bandeja.composer", clave: "guide.inbox.reply", respaldo: ANCLA_MARCO_BANDEJA },
    { id: "B2", ancla: "bandeja.filtro-canal", clave: "guide.inbox.email", respaldo: ANCLA_MARCO_BANDEJA },
    { id: "B3", ancla: "bandeja.buscar", clave: "guide.inbox.search", respaldo: ANCLA_MARCO_BANDEJA },
    {
      id: "B4",
      ancla: "bandeja.asignar",
      clave: "guide.inbox.assign",
      respaldo: ANCLA_MARCO_BANDEJA,
      roles: ROLES_ASIGNAR,
    },
    { id: "B5", ancla: "bandeja.plantillas", clave: "guide.inbox.templates", respaldo: ANCLA_MARCO_BANDEJA },
    { id: "B6", ancla: "bandeja.nota-privada", clave: "guide.inbox.note", respaldo: ANCLA_MARCO_BANDEJA },
    { id: "F1", ancla: "ficha.panel", clave: "guide.dtdcard.panel", respaldo: ANCLA_MARCO_BANDEJA },
  ],
};

/** Embudo (guion: recorrido 2), en CRM › Embudos. La RLS de la 0506 solo deja pasar a admin y commercial. */
export const RECORRIDO_EMBUDO: GuiaRecorrido = {
  id: "embudo",
  ruta: "/studio/crm",
  roles: ["admin", "commercial"],
  arranqueAutomatico: false,
  pasos: [
    { id: "E1", ancla: "embudo.tablero", clave: "guide.pipeline.board" },
    { id: "E2", ancla: "embudo.tarjeta", clave: "guide.pipeline.move" },
    { id: "E3", ancla: "embudo.tareas", clave: "guide.pipeline.tasks" },
    { id: "E4", ancla: "embudo.columna-entrada", clave: "guide.pipeline.incoming" },
  ],
};

/** Ficha del cliente (guion: F3), la tarjeta de conversaciones de la Bandeja. */
export const RECORRIDO_CLIENTE: GuiaRecorrido = {
  id: "cliente",
  ruta: "/studio/clientes",
  arranqueAutomatico: false,
  pasos: [{ id: "F3", ancla: "cliente.conversaciones", clave: "guide.dtdcard.client_tab" }],
};

/** Actualizaciones (guion: recorrido 6), solo admin. A2 y A3 aparecen con una versión nueva. */
export const RECORRIDO_ACTUALIZACIONES: GuiaRecorrido = {
  id: "actualizaciones",
  ruta: "/studio/admin/actualizaciones",
  roles: ["admin"],
  arranqueAutomatico: false,
  pasos: [
    { id: "A1", ancla: "actualizaciones.version", clave: "guide.updates.version" },
    { id: "A2", ancla: "actualizaciones.analizar", clave: "guide.updates.analyze" },
    { id: "A3", ancla: "actualizaciones.pedir", clave: "guide.updates.request" },
  ],
};

export const RECORRIDOS: readonly GuiaRecorrido[] = [
  RECORRIDO_DASHBOARD,
  RECORRIDO_BANDEJA,
  RECORRIDO_EMBUDO,
  RECORRIDO_CLIENTE,
  RECORRIDO_ACTUALIZACIONES,
];

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

/**
 * Catálogo que ve un rol (9.5, D12): quita los recorridos y los pasos con `roles`
 * que no lo incluyen, y los recorridos que se quedan sin pasos. Sin rol, solo lo
 * que no pide ninguno. Es cosmético: el gate de cada pantalla sigue mandando.
 */
export function recorridosParaRol(
  catalogo: readonly GuiaRecorrido[],
  rol: StudioUserRole | null,
): GuiaRecorrido[] {
  const ve = (roles: readonly StudioUserRole[] | undefined) =>
    roles === undefined || (rol !== null && roles.includes(rol));
  const salida: GuiaRecorrido[] = [];
  for (const recorrido of catalogo) {
    if (!ve(recorrido.roles)) continue;
    const pasos = recorrido.pasos.filter((p) => ve(p.roles));
    if (pasos.length === 0) continue;
    salida.push(pasos.length === recorrido.pasos.length ? recorrido : { ...recorrido, pasos });
  }
  return salida;
}

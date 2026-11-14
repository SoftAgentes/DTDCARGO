/**
 * Tablero del CRM propio: los dos embudos (SDD-0587 · paso 6.3).
 *
 * **Puro y server-safe**: lo usan la página (server), la vista (client) y las
 * pruebas. Las lecturas viven en `crm-tablero-queries.ts`.
 *
 * ── En qué tablero aparece una tarjeta ──────────────────────────────────────
 * No se guarda (§4.1 del contrato): sale del segmento calculado en el momento
 * por `crm_segmento_tarjetas` (0506). Cliente → Clientes; lead registrado o
 * lead nuevo → Leads. Por eso el paso de un embudo a otro es automático y no
 * necesita marca ni cron: cambia el segmento y la tarjeta cambia de tablero en
 * el próximo render.
 *
 * ── «De dónde vino» ─────────────────────────────────────────────────────────
 * La tarjeta guarda las dos etapas. La del otro tablero es su historia y se
 * muestra como origen. El caso que pide más cuidado es el cliente que vuelve a
 * lead (§4.5): tiene que aparecer en «Registrado / recontacto», no en su etapa
 * vieja de Leads. Como el cambio de tablero no se guarda, la vuelta se infiere:
 * si la tarjeta tuvo movimientos en Clientes DESPUÉS de su último movimiento en
 * Leads, viene de Clientes y se ubica en recontacto. En cuanto alguien la mueve
 * a mano en Leads, su `etapa_leads_at` pasa a ser lo más nuevo y manda la etapa
 * guardada: gana el manual posterior (§5.3).
 *
 * Límite conocido (I): una tarjeta que fue cliente sin moverse nunca en Clientes
 * (entró a «Activo» por defecto y no tiene historial allí) no deja rastro, así
 * que vuelve a Leads en su etapa guardada. Registrar el cambio de tablero al
 * detectarlo es de 6.6, que es el paso de los movimientos automáticos.
 */

export type CrmTablero = "leads" | "clientes";
export type CrmSegmento = "cliente" | "lead_registrado" | "lead_nuevo";

export const CRM_TABLEROS: ReadonlyArray<{ key: CrmTablero; label: string }> = [
  { key: "leads", label: "Leads" },
  { key: "clientes", label: "Clientes" },
];

/**
 * Roles que usan el CRM propio POR ROL (default de `kommo` en rbac.ts + admin).
 * Desde la SDD-0622 (migr 0539) la RLS ya no compara el rol: decide con
 * `user_has_module('kommo')`, que suma desvíos por rol y accesos adicionales.
 * Este predicado queda para listar asesores por rol.
 */
export const CRM_ROLES = ["admin", "commercial"] as const;

/** Etapa a la que vuelve un cliente que deja de serlo (§4.5). */
export const ETAPA_VUELTA_A_LEAD = "registrado_recontacto";

/** Tope de tarjetas que trae el tablero. */
export const CRM_TABLERO_CAP = 2000;

/** Tarjetas pintadas por columna; el resto se cuenta («+N más»). */
export const CRM_TARJETAS_POR_COLUMNA = 60;

/** Desde cuántos días sin moverse la antigüedad se pinta en dorado (atención). */
export const CRM_DIAS_ATENCION = 30;

export function esTablero(v: unknown): v is CrmTablero {
  return v === "leads" || v === "clientes";
}

export function resolverTablero(raw: string | null | undefined): CrmTablero {
  return esTablero(raw) ? raw : "leads";
}

export function esSegmento(v: unknown): v is CrmSegmento {
  return v === "cliente" || v === "lead_registrado" || v === "lead_nuevo";
}

/** ¿El ROL solo usa el CRM? (sin extras de la persona; ver `canAccessModule`). */
export function rolUsaCrm(role: string | null | undefined): boolean {
  return (CRM_ROLES as readonly string[]).includes(role ?? "");
}

export function tableroDeSegmento(segmento: CrmSegmento): CrmTablero {
  return segmento === "cliente" ? "clientes" : "leads";
}

export const SEGMENTO_LABEL: Record<CrmSegmento, string> = {
  cliente: "Cliente",
  lead_registrado: "Registrado",
  lead_nuevo: "Lead nuevo",
};

export const FUENTE_LABEL: Record<string, string> = {
  whatsapp_leads: "WhatsApp (número de leads)",
  whatsapp_clientes: "WhatsApp (número de clientes)",
  instagram: "Instagram",
  messenger: "Messenger",
  correo: "Correo",
  web_registro: "Registro en la web",
  portal: "Portal",
  cotizador: "Cotizador",
  kommo: "CRM anterior",
  manual: "Creada en Studio",
};

export interface CrmEtapa {
  tablero: CrmTablero;
  clave: string;
  nombre: string;
  orden: number;
  terminal: boolean;
  sistema: boolean;
  activa: boolean;
}

/** Lo que el tablero necesita de `crm_tarjetas` (sin teléfono: no se pinta). */
export interface CrmTarjetaFila {
  id: string;
  client_id: string | null;
  nombre_visible: string | null;
  etapa_leads: string;
  etapa_leads_at: string;
  etapa_clientes: string;
  etapa_clientes_at: string;
  asesor_id: string | null;
  fuente: string;
  ultima_actividad_at: string;
}

export interface CrmOrigen {
  tablero: CrmTablero;
  etapa: string;
  /** true = un cliente que volvió a lead (§4.5). */
  vuelta: boolean;
}

export interface CrmUbicacion {
  tablero: CrmTablero;
  etapa: string;
  /** Desde cuándo está en esa etapa (ISO). */
  desde: string;
  origen: CrmOrigen | null;
}

/** Rastro de la tarjeta en cada tablero, sacado de `crm_historial_etapas`. */
export interface CrmRastro {
  /** Último movimiento registrado en Clientes (ISO) o null. */
  clientesAt: string | null;
  /** ¿Tuvo algún movimiento en Leads? */
  enLeads: boolean;
}

const ms = (iso: string | null | undefined): number => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : -Infinity;
};

/**
 * Dónde se pinta una tarjeta y de dónde vino. Pura: el segmento y el rastro los
 * resuelve quien llama.
 */
export function ubicarTarjeta(
  t: CrmTarjetaFila,
  segmento: CrmSegmento,
  rastro: CrmRastro,
): CrmUbicacion {
  const tablero = tableroDeSegmento(segmento);

  if (tablero === "clientes") {
    // Viene de Leads si alguna vez se movió ahí; una tarjeta que nació cliente
    // (por ejemplo, migrada) tiene «Nuevo» por defecto y no vino de ningún lado.
    const vinoDeLeads = rastro.enLeads || t.etapa_leads !== "nuevo";
    return {
      tablero,
      etapa: t.etapa_clientes,
      desde: t.etapa_clientes_at,
      origen: vinoDeLeads ? { tablero: "leads", etapa: t.etapa_leads, vuelta: false } : null,
    };
  }

  if (rastro.clientesAt == null) {
    return { tablero, etapa: t.etapa_leads, desde: t.etapa_leads_at, origen: null };
  }

  const origen: CrmOrigen = { tablero: "clientes", etapa: t.etapa_clientes, vuelta: true };
  // Lo último que le pasó fue en Clientes: vuelve a Leads por recontacto.
  if (ms(rastro.clientesAt) > ms(t.etapa_leads_at)) {
    return { tablero, etapa: ETAPA_VUELTA_A_LEAD, desde: rastro.clientesAt, origen };
  }
  // Ya la movieron a mano en Leads después: manda su etapa guardada.
  return { tablero, etapa: t.etapa_leads, desde: t.etapa_leads_at, origen };
}

/** Días enteros desde `iso` hasta `ahoraMs`; null si la fecha no sirve. */
export function diasDesde(iso: string | null | undefined, ahoraMs: number): number | null {
  const t = ms(iso);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((ahoraMs - t) / 86_400_000));
}

/** Tarjeta lista para pintar (viaja al cliente: solo lo que se muestra). */
export interface CrmTarjetaTablero {
  id: string;
  nombre: string | null;
  shippingMark: string | null;
  segmento: CrmSegmento;
  tablero: CrmTablero;
  etapa: string;
  origen: CrmOrigen | null;
  diasEnEtapa: number | null;
  asesorNombre: string | null;
  tareasAbiertas: number;
  tareasVencidas: number;
}

export interface CrmColumna {
  etapa: CrmEtapa;
  tarjetas: CrmTarjetaTablero[];
}

/**
 * Columnas de un tablero, en el orden del admin. Una etapa propia apagada se
 * muestra solo si todavía tiene tarjetas: esconderla las haría desaparecer.
 * Una tarjeta cuya etapa no está en la lista (no debería pasar: la FK lo
 * impide) cae en la primera columna en vez de perderse.
 */
export function armarColumnas(
  etapas: readonly CrmEtapa[],
  tarjetas: readonly CrmTarjetaTablero[],
  tablero: CrmTablero,
): CrmColumna[] {
  const propias = [...etapas]
    .filter((e) => e.tablero === tablero)
    .sort((a, b) => a.orden - b.orden || a.clave.localeCompare(b.clave));
  const porEtapa = new Map<string, CrmTarjetaTablero[]>();
  for (const e of propias) porEtapa.set(e.clave, []);

  const primera = propias.find((e) => e.activa)?.clave ?? propias[0]?.clave;
  for (const t of tarjetas) {
    if (t.tablero !== tablero) continue;
    const destino = porEtapa.has(t.etapa) ? t.etapa : primera;
    if (destino == null) continue;
    porEtapa.get(destino)!.push(t);
  }

  return propias
    .filter((e) => e.activa || (porEtapa.get(e.clave)?.length ?? 0) > 0)
    .map((e) => ({ etapa: e, tarjetas: porEtapa.get(e.clave) ?? [] }));
}

/** Destinos válidos para mover una tarjeta dentro de su tablero. */
export function destinosDe(
  etapas: readonly CrmEtapa[],
  tablero: CrmTablero,
  etapaActual: string,
): CrmEtapa[] {
  return etapas
    .filter((e) => e.tablero === tablero && e.activa && e.clave !== etapaActual)
    .sort((a, b) => a.orden - b.orden);
}

/** Nombre de una etapa por su clave, o la clave si ya no existe. */
export function nombreEtapa(
  etapas: readonly CrmEtapa[],
  tablero: CrmTablero,
  clave: string,
): string {
  return etapas.find((e) => e.tablero === tablero && e.clave === clave)?.nombre ?? clave;
}

/** Filtro por nombre o Shipping Mark, sin distinguir mayúsculas ni tildes. */
export function coincideBusqueda(t: CrmTarjetaTablero, q: string): boolean {
  const norm = (s: string) =>
    s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
  const needle = norm(q);
  if (!needle) return true;
  return [t.nombre, t.shippingMark].some((v) => v != null && norm(v).includes(needle));
}

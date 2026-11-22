/**
 * SDD-0645 · D1 de Sam (2026-11-16): el cambio de cliente de un embarque queda
 * visible en su detalle, con fecha, quién, anterior → nuevo y el motivo.
 *
 * Sale del evento `shipment_client_reassigned` que escribe la migr 0551. La
 * bitácora no la lee `authenticated` (0270), así que se lee con el cliente de
 * servicio, ACOTADO: el llamador ya leyó el embarque por RLS, y acá el filtro es
 * fijo (tenant de la sesión, `entity_type`, id del embarque y `event_type`),
 * con columnas fijas y un tope. Si algo falla, no hay historial y el detalle
 * sigue.
 */

export const EVENTO_CAMBIO_DE_CLIENTE = "shipment_client_reassigned";
export const TOPE_HISTORIAL = 20;
const COLUMNAS = "occurred_at, actor_id, reason, before_data, after_data";

export type CambioDeCliente = {
  fecha: string;
  actorId: string | null;
  anterior: string | null;
  nuevo: string;
  motivo: string | null;
};

type Fila = {
  occurred_at?: unknown;
  actor_id?: unknown;
  reason?: unknown;
  before_data?: unknown;
  after_data?: unknown;
};

function marca(data: unknown): string | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const v = (data as Record<string, unknown>).client_markbox;
  return typeof v === "string" && v.trim() ? v : null;
}

/** Filas de la bitácora → cambios, del más reciente al más viejo. Descarta lo que no tiene forma. */
export function parseCambiosDeCliente(filas: unknown): CambioDeCliente[] {
  if (!Array.isArray(filas)) return [];
  const out: CambioDeCliente[] = [];
  for (const f of filas as Fila[]) {
    const nuevo = marca(f?.after_data);
    const fecha = typeof f?.occurred_at === "string" ? f.occurred_at : null;
    if (!nuevo || !fecha || Number.isNaN(new Date(fecha).getTime())) continue;
    out.push({
      fecha,
      actorId: typeof f.actor_id === "string" ? f.actor_id : null,
      anterior: marca(f.before_data),
      nuevo,
      motivo: typeof f.reason === "string" && f.reason.trim() ? f.reason : null,
    });
  }
  return out.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
}

/** Lo mínimo que se usa del cliente de servicio de `@/lib/db/admin`. */
type Lector = { from: (tabla: string) => unknown };

type Consulta = {
  eq: (c: string, v: string) => Consulta;
  order: (c: string, o: { ascending: boolean }) => Consulta;
  limit: (n: number) => PromiseLike<{ data: unknown; error: unknown }>;
};

export async function listarCambiosDeCliente(
  /** Fábrica del cliente de servicio: si no se puede crear (sin variables), no hay historial. */
  crearLector: () => Lector,
  tenantId: string,
  shipmentId: string,
): Promise<CambioDeCliente[]> {
  if (!tenantId || !shipmentId) return [];
  try {
    const q = (crearLector().from("entity_audit_log") as { select: (cols: string) => Consulta }).select(COLUMNAS);
    const { data, error } = await q
      .eq("tenant_id", tenantId)
      .eq("entity_type", "shipment")
      .eq("entity_id", shipmentId)
      .eq("event_type", EVENTO_CAMBIO_DE_CLIENTE)
      .order("occurred_at", { ascending: false })
      .limit(TOPE_HISTORIAL);
    if (error) return [];
    return parseCambiosDeCliente(data);
  } catch {
    return [];
  }
}

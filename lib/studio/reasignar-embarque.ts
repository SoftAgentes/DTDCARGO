/**
 * SDD-0645 · Pasar un embarque a otro cliente: lo que devuelve la RPC de la
 * migr 0551 y cómo se dice en pantalla.
 *
 * Puro (sin I/O): lo usan la server action, el modal y sus pruebas.
 */

export type ReasignarOutcome = "preview" | "blocked" | "reassigned";

/** Tabla → filas que se mueven (las llaves que escribe la RPC). */
export type ReasignarMovidos = Partial<Record<
  | "shipments"
  | "warehouse_receipts_cn"
  | "warehouse_boxes"
  | "invoices"
  | "consolidation_items"
  | "shipment_documents"
  | "client_notification_schedule",
  number
>>;

export type ReasignarBloqueo =
  | "factura_emitida"
  | "factura_varios_embarques"
  | "reclamo"
  | "prealerta"
  | "orden_despacho";

export type ReasignarResultado = {
  outcome: ReasignarOutcome;
  shipmentCode: string;
  oldMarkbox: string | null;
  newMarkbox: string;
  blockers: Partial<Record<ReasignarBloqueo, number>>;
  moved: ReasignarMovidos;
};

const OUTCOMES: readonly ReasignarOutcome[] = ["preview", "blocked", "reassigned"];

function conteos(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n) && n >= 0) out[k] = n;
  }
  return out;
}

/** jsonb de la RPC → resultado tipado; `null` si no tiene la forma esperada. */
export function parseReasignarResultado(raw: unknown): ReasignarResultado | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (!OUTCOMES.includes(r.outcome as ReasignarOutcome)) return null;
  if (typeof r.new_markbox !== "string" || typeof r.shipment_code !== "string") return null;
  return {
    outcome: r.outcome as ReasignarOutcome,
    shipmentCode: r.shipment_code,
    oldMarkbox: typeof r.old_markbox === "string" ? r.old_markbox : null,
    newMarkbox: r.new_markbox,
    blockers: conteos(r.blockers) as ReasignarResultado["blockers"],
    moved: conteos(r.moved) as ReasignarMovidos,
  };
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Por qué no se puede, en texto llano y con la salida. */
export function textoBloqueo(tipo: ReasignarBloqueo, n: number): string {
  switch (tipo) {
    case "factura_emitida":
      return `Tiene ${plural(n, "factura emitida", "facturas emitidas")} a nombre del cliente actual. Anúlala primero.`;
    case "factura_varios_embarques":
      return `Su factura en borrador también cobra otros embarques. Sepárala primero.`;
    case "reclamo":
      return `Tiene ${plural(n, "reclamo abierto", "reclamos abiertos")} del cliente actual.`;
    case "prealerta":
      return `Viene de ${plural(n, "una prealerta", "prealertas")} del cliente actual.`;
    case "orden_despacho":
      return `Está en ${plural(n, "una orden de despacho", "órdenes de despacho")} sin cancelar.`;
  }
}

export function textosBloqueos(blockers: ReasignarResultado["blockers"]): string[] {
  return (Object.entries(blockers) as [ReasignarBloqueo, number][])
    .filter(([, n]) => n > 0)
    .map(([tipo, n]) => textoBloqueo(tipo, n));
}

/** Lo que se mueve además del embarque, en el orden en que lo piensa la oficina. */
export function textosMovidos(moved: ReasignarMovidos): string[] {
  const out: string[] = [];
  const n = (k: keyof ReasignarMovidos) => moved[k] ?? 0;
  if (n("warehouse_receipts_cn") > 0) {
    const cajas = n("warehouse_boxes") > 0 ? ` (${plural(n("warehouse_boxes"), "caja", "cajas")})` : "";
    out.push(`${plural(n("warehouse_receipts_cn"), "recepción", "recepciones")} del Almacén CN${cajas}`);
  }
  if (n("invoices") > 0) out.push(plural(n("invoices"), "factura en borrador", "facturas en borrador"));
  if (n("consolidation_items") > 0) {
    out.push(plural(n("consolidation_items"), "línea de consolidación", "líneas de consolidación"));
  }
  if (n("shipment_documents") > 0) out.push(plural(n("shipment_documents"), "documento del Portal", "documentos del Portal"));
  if (n("client_notification_schedule") > 0) {
    out.push(plural(n("client_notification_schedule"), "aviso pendiente", "avisos pendientes"));
  }
  return out;
}

/** La RPC todavía no existe en esta base (PostgREST o Postgres). */
export function faltaLaFuncion(error: { code?: string | null } | null | undefined): boolean {
  return error?.code === "PGRST202" || error?.code === "42883";
}

/** Error de la RPC → texto llano. Nunca el mensaje crudo de la base. */
export function mensajeErrorReasignar(error: { code?: string | null; message?: string | null }): string {
  const msg = error.message ?? "";
  if (faltaLaFuncion(error)) return "Esta acción todavía no está disponible.";
  if (error.code === "42501") return "No tienes permiso para pasar embarques a otro cliente.";
  if (error.code === "P0002") {
    return msg.includes("cliente")
      ? "No encontramos ese cliente. Búscalo de nuevo."
      : "No encontramos este embarque. Recarga la página.";
  }
  if (error.code === "22023") {
    if (msg.includes("reason")) return "Indica un motivo de 4 a 1000 caracteres.";
    if (msg.includes("fusionada")) return "Esa ficha fue fusionada con otra. Elige la que quedó.";
    if (msg.includes("Shipping Mark")) return "Ese cliente no tiene Shipping Mark: el Portal no se lo mostraría.";
    if (msg.includes("ya es de ese cliente")) return "El embarque ya es de ese cliente.";
  }
  if (error.code === "40001") return "Algo cambió mientras tanto. Recarga y vuelve a intentarlo.";
  return "No pudimos pasar el embarque. Intenta de nuevo.";
}

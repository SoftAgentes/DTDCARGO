// SDD-0256 · Fases 4 y 5 — TODO lo decidible del drenaje de la outbox, puro.
//
// Por qué existe este archivo: `kommo-writeback/index.ts` es `Deno.serve` + HTTP,
// y el gate no lo ejecuta (`supabase/functions` está fuera del typecheck y Vitest
// no puede levantar una edge function). Cada decisión que estaba embebida ahí
// —a qué endpoint va, con qué método, si se manda o se saltea, cuántas veces se
// reintenta— era invisible para la verificación. Acá abajo son funciones puras
// que un test puede romper a propósito.
//
// TS puro: sin globals de Deno, sin dependencias. Mismo criterio que
// `_shared/kommo-outbound.ts` y `_shared/kommo-mapping.ts`.

/** La fila de la outbox, en la forma mínima que el drenaje necesita decidir. */
export interface OutboxRow {
  id: string;
  /** null cuando la op apunta a un contacto (SDD-0244 · migr 0344). */
  kommo_lead_id: number | null;
  kommo_contact_id: number | null;
  op: string;
  payload: Record<string, unknown>;
  /** Snapshot del `updated_at` del lead al encolar (columna de la 0136). */
  kommo_updated_at_at_enqueue?: string | null;
}

// ── B1 · a dónde va cada op, y con QUÉ MÉTODO ───────────────────────────────
//
// Hasta la Fase 5 el método era `"PATCH"` literal en el drenaje y `resolveTarget`
// sólo decidía la ruta. Una op POST encolada salía como PATCH: 405, o peor,
// Kommo interpretaba el cuerpo de la nota como un patch del lead.
//
// El método se DERIVA de la op, no se guarda en una columna. Una columna
// `http_method` permitiría encolar el par incoherente `(add_note, PATCH)` y no
// habría nada que lo impidiera; derivándolo, ese estado no se puede representar.

export type HttpMethod = "POST" | "PATCH";

export interface KommoRequest {
  path: string;
  method: HttpMethod;
  /**
   * Kommo v4 espera un ARRAY en los endpoints de creación (`/notes`, `/tasks`)
   * y un OBJETO en los PATCH de entidad. El payload se encola siempre como
   * objeto —así la fusión jsonb de la 0364/0366 puede razonar sobre él— y se
   * envuelve acá, en el borde.
   */
  envolverEnArray: boolean;
}

export type ResolucionRequest = KommoRequest | { skip: string };

export function resolveRequest(row: OutboxRow): ResolucionRequest {
  if (row.op === "patch_contact") {
    if (row.kommo_contact_id == null) return { skip: "patch_contact sin kommo_contact_id" };
    return {
      path: `/api/v4/contacts/${row.kommo_contact_id}`,
      method: "PATCH",
      envolverEnArray: false,
    };
  }

  // Todo lo demás cuelga de un lead. Sin id no se manda nada: `/api/v4/leads/null`
  // Kommo lo interpretaría como otra cosa.
  if (row.kommo_lead_id == null) return { skip: `${row.op} sin kommo_lead_id` };

  if (row.op === "add_note") {
    return {
      path: `/api/v4/leads/${row.kommo_lead_id}/notes`,
      method: "POST",
      envolverEnArray: true,
    };
  }

  if (row.op === "add_task") {
    // La tarea NO cuelga de la ruta del lead: se crea en la colección global y
    // el vínculo viaja en el cuerpo (`entity_id` + `entity_type`).
    return { path: `/api/v4/tasks`, method: "POST", envolverEnArray: true };
  }

  return {
    path: `/api/v4/leads/${row.kommo_lead_id}`,
    method: "PATCH",
    envolverEnArray: false,
  };
}

// ── B3 · qué se puede reintentar ────────────────────────────────────────────
//
// La lista es de lo que SÍ se reintenta, no de lo que no. Falla cerrado a
// propósito: una op nueva que nadie agregue acá se marca `error` y la mira una
// persona, en vez de duplicarse en silencio por un default permisivo. Es el
// mismo criterio que ya aplica `reap_kommo_writeback_stale` (migración 0365).

export const OPS_REINTENTABLES = [
  "patch_price",
  "patch_stage",
  "patch_lead",
  "patch_contact",
  "patch_owner",
  "patch_tags",
] as const;

/**
 * ¿Repetir esta op es inocuo? PATCH sí: escribe el mismo valor dos veces. POST
 * no: crea una nota más, una tarea más. Un POST se intenta UNA vez.
 */
export function esOpReintentable(op: string): boolean {
  return (OPS_REINTENTABLES as readonly string[]).includes(op);
}

// ── A1 · el chequeo optimista ───────────────────────────────────────────────
//
// `kommo_updated_at_at_enqueue` existe desde la 0136 y hasta hoy se guardaba
// sin que nadie la leyera. Con la edición confirmada desde los dos lados (ERP y
// Kommo), esa columna sin leer es un pisón silencioso: el asesor mueve el lead
// en Kommo mientras la orden viaja desde el ERP, el ERP la pisa, y la fila sale
// `sent` — sin error y sin rastro.
//
// ⚠️ El falso positivo que obliga al `eco`. El snapshot se toma del ESPEJO al
// encolar, y el espejo se actualiza por webhook. Cuando el ERP escribe un lead,
// Kommo le sube el `updated_at`; si el asesor hace dos cosas seguidas sobre el
// mismo lead (mover de etapa y después etiquetar) y el webhook de la primera
// todavía no volvió, la segunda vería un `updated_at` más nuevo que su snapshot
// y se saltearía **por un cambio que causamos nosotros**. Por eso el drenaje
// registra el `updated_at` que Kommo devuelve tras cada escritura propia (el
// "eco") y acá se lo descuenta.
//
// El eco NO es el espejo: escribir `kommo_leads` desde el ERP viola el guardrail
// 0107. Es una bitácora aparte de lo que el propio write-back dejó.

export interface EntradaChequeoOptimista {
  op: string;
  /** El snapshot guardado al encolar (ISO-8601), o null si no se pudo tomar. */
  enqueuedAt: string | null | undefined;
  /** `updated_at` que Kommo devuelve HOY para ese lead (epoch en segundos). */
  liveUpdatedAt: number | null | undefined;
  /** `updated_at` que dejó nuestra última escritura sobre ese lead (epoch s). */
  echoUpdatedAt: number | null | undefined;
}

export type VeredictoOptimista =
  | { pisar: true }
  | { pisar: false; motivo: string };

/** Segundos de gracia. Kommo redondea a segundos y los relojes no son el mismo. */
const TOLERANCIA_S = 1;

/**
 * ¿Se manda la orden, o se saltea porque el lead cambió en Kommo?
 *
 * Fail-open a propósito en todo lo que no se puede afirmar: sin snapshot, sin
 * lectura viva o con fechas ilegibles, se MANDA. El chequeo existe para evitar
 * pisar trabajo ajeno; negar por falta de datos convertiría cada hipo de red en
 * un verbo que no hace nada, que es peor que el problema que resuelve.
 */
export function evaluarChequeoOptimista(
  e: EntradaChequeoOptimista,
): VeredictoOptimista {
  // Un POST no pisa nada: agrega una nota, agrega una tarea. Chequearlo sólo
  // haría perder notas legítimas.
  if (!esOpReintentable(e.op)) return { pisar: true };
  // El contacto no tiene snapshot de lead con qué comparar.
  if (e.op === "patch_contact") return { pisar: true };

  const snapshot = parseIsoASegundos(e.enqueuedAt);
  if (snapshot == null) return { pisar: true }; // nada con qué comparar

  const vivo = normalizarEpoch(e.liveUpdatedAt);
  if (vivo == null) return { pisar: true }; // no se pudo leer el lead vivo

  if (vivo <= snapshot + TOLERANCIA_S) return { pisar: true }; // nada cambió

  // Cambió — pero, ¿lo cambiamos nosotros?
  const eco = normalizarEpoch(e.echoUpdatedAt);
  if (eco != null && Math.abs(vivo - eco) <= TOLERANCIA_S) return { pisar: true };

  return {
    pisar: false,
    motivo: `el lead cambió en el CRM después de encolarse (${isoDeEpoch(vivo)} > ${isoDeEpoch(snapshot)}); no se pisó`,
  };
}

/** ISO-8601 → epoch en segundos. `null` si no es una fecha legible. */
export function parseIsoASegundos(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 1000);
}

/** Gemelo de `epochToIso`: epoch en segundos → ISO-8601. */
export function isoDeEpoch(epochS: number): string {
  return new Date(epochS * 1000).toISOString();
}

function normalizarEpoch(v: number | null | undefined): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

// ⚠️ Los payloads de nota y tarea NO viven acá a propósito. Se arman donde se
// ENCOLAN —`lib/studio/kommo-writeback.ts`, del lado del ERP— y esta función
// sólo los transporta. Tenerlos en los dos lados sería dos definiciones de la
// misma forma de Kommo, y la que no se usa driftea sin que nada lo note.

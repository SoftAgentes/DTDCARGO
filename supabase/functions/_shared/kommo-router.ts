// SDD-0244 · resolvedor del enrutado "cliente que vuelve" — NÚCLEO PURO.
//
// Cuando Kommo crea un trato (`leads[add]`), el ERP decide si quien escribe ya
// es cliente. Si lo es, el trato se manda a la etapa **Recontacto** con su
// Shipping Mark estampado, en vez de verse igual que un desconocido.
//
// Este archivo es TS puro (sin globals de Deno, sin deps): lo importan la Edge
// Function `kommo-webhook` y Vitest. Las queries viven en el index de la función.
//
// ⚠️ Duplica a propósito la normalización de teléfono de
// `lib/studio/estimado-linking.ts`: el bundle de la edge function no puede
// importar desde `lib/`. El test `kommo-router.test.ts` afirma que ambas
// implementaciones coinciden, para que no driftee en silencio.

/** Sub-forma de un contacto de Kommo que el resolvedor necesita. */
export interface RouterContactLike {
  id: number;
  custom_fields_values?: unknown[] | null;
}

/** Fila de `clients` que el resolvedor necesita. */
export interface RouterClientRow {
  id: string;
  markbox: string | null;
  kommo_contact_id: number | null;
  phone: string | null;
}

export type RouteDecision =
  | { kind: "desconocido"; reason: "sin-contacto" | "sin-match" | "ambiguo" }
  | {
      kind: "cliente";
      client: RouterClientRow;
      matchedBy: "contact_id" | "phone";
      /** true → hay que guardar kommo_contact_id en ese cliente (auto-sanado). */
      needsHeal: boolean;
    };

/** Solo los dígitos de un teléfono. Gemelo de `normalizePhone`. */
export function phoneDigits(raw: unknown): string {
  if (raw == null) return "";
  return String(raw).replace(/\D+/g, "");
}

/**
 * Clave de cruce = los ÚLTIMOS 10 dígitos (número nacional venezolano), que es
 * lo que hace equivalentes a "+58 412-1668021", "0412-1668021" y "4121668021".
 * `null` si hay menos de 10 dígitos: un número incompleto NO se cruza — preferimos
 * no enrutar antes que estampar el Shipping Mark de otra persona.
 *
 * Misma expresión que el índice `clients_phone_last10_idx` (migración 0342).
 */
export function phoneKey(raw: unknown): string | null {
  const d = phoneDigits(raw);
  return d.length >= 10 ? d.slice(-10) : null;
}

/** Claves de teléfono de un contacto de Kommo (custom field `PHONE`). */
export function contactPhoneKeys(contact: RouterContactLike | null | undefined): string[] {
  const out = new Set<string>();
  const fields = (contact?.custom_fields_values ?? []) as unknown[];
  for (const raw of fields) {
    if (!raw || typeof raw !== "object") continue;
    const f = raw as { field_code?: unknown; values?: unknown };
    if (String(f.field_code ?? "").toUpperCase() !== "PHONE") continue;
    for (const v of (Array.isArray(f.values) ? f.values : []) as unknown[]) {
      const val = (v && typeof v === "object" ? (v as { value?: unknown }).value : v) ?? null;
      const k = phoneKey(val);
      if (k) out.add(k);
    }
  }
  return [...out];
}

/**
 * Decide si el trato entrante es de un cliente conocido. PURO.
 *
 * Orden: (1) vínculo directo por `kommo_contact_id`; (2) cruce por teléfono, que
 * además auto-sana el vínculo. Sin match → desconocido y no se toca nada.
 *
 * ⚠️ El cruce por teléfono exige **un único** candidato. Dos clientes con el
 * mismo teléfono es dato sucio, no un match: estampar el Shipping Mark del que
 * no es sería peor que no enrutar. Por eso `ambiguo` es un desconocido.
 */
export function decideRoute(
  contactId: number | null | undefined,
  contactPhones: string[],
  byContactId: RouterClientRow | null | undefined,
  clientsWithPhone: readonly RouterClientRow[],
): RouteDecision {
  const cid = Number(contactId);
  if (!Number.isFinite(cid) || cid <= 0) {
    return { kind: "desconocido", reason: "sin-contacto" };
  }
  if (byContactId) {
    return { kind: "cliente", client: byContactId, matchedBy: "contact_id", needsHeal: false };
  }
  if (contactPhones.length === 0) return { kind: "desconocido", reason: "sin-match" };

  const wanted = new Set(contactPhones);
  const hits: RouterClientRow[] = [];
  for (const c of clientsWithPhone) {
    const k = phoneKey(c.phone);
    if (k && wanted.has(k)) hits.push(c);
  }
  if (hits.length === 1) {
    return { kind: "cliente", client: hits[0], matchedBy: "phone", needsHeal: true };
  }
  return { kind: "desconocido", reason: hits.length > 1 ? "ambiguo" : "sin-match" };
}

// ── Payloads de la outbox ────────────────────────────────────────

/** PATCH de etapa: Kommo exige status_id + pipeline_id. Gemelo de `buildStagePatchPayload`. */
export function buildStagePayload(target: { pipeline_id: number; status_id: number }): {
  status_id: number;
  pipeline_id: number;
} {
  return {
    status_id: Math.trunc(Number(target.status_id)),
    pipeline_id: Math.trunc(Number(target.pipeline_id)),
  };
}

/** PATCH del Shipping Mark en un custom field del lead. Gemelo de `buildMarkboxPatchPayload`. */
export function buildMarkboxPayload(
  fieldId: number,
  markbox: string,
): { custom_fields_values: { field_id: number; values: { value: string }[] }[] } {
  return {
    custom_fields_values: [
      { field_id: Math.trunc(Number(fieldId)), values: [{ value: String(markbox) }] },
    ],
  };
}

/**
 * Lee el destino `recontacto` del `stage_map` crudo de la conexión. Sin la clave
 * (o con ids inválidos) devuelve `null` → **el enrutador queda inerte**, igual que
 * `patch_stage` hoy. Es el interruptor: sin mapa configurado no se encola nada.
 */
export function readRecontactoTarget(
  rawStageMap: unknown,
): { pipeline_id: number; status_id: number } | null {
  if (!rawStageMap || typeof rawStageMap !== "object") return null;
  const v = (rawStageMap as Record<string, unknown>)["recontacto"];
  if (!v || typeof v !== "object") return null;
  const rec = v as Record<string, unknown>;
  const pid = Math.trunc(Number(rec.pipeline_id));
  const sid = Math.trunc(Number(rec.status_id));
  if (!Number.isFinite(pid) || pid <= 0 || !Number.isFinite(sid) || sid <= 0) return null;
  return { pipeline_id: pid, status_id: sid };
}

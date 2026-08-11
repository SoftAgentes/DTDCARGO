// SDD-0043 Alcance B · mapeo Kommo → fila espejo, single source of truth.
//
// Estas funciones son la MISMA forma de fila que el sync read-only hacía inline
// en `supabase/functions/kommo-sync/sync.ts`. Ahora viven acá (TS puro, sin
// globals de Deno ni deps) para que:
//   1. la Edge Function de webhooks (kommo-webhook) las importe vía `../_shared/kommo-mapping.ts`,
//   2. el sync read-only (kommo-sync) las importe igual (un solo mapeo, comportamiento idéntico),
//   3. Vitest las testee dentro de `node scripts/verify.mjs`.
//
// Timestamps de Kommo = epoch en SEGUNDOS. epochToIso convierte a ISO-8601 (o null).

/** Sub-forma de un lead de Kommo que el mapeo necesita (compatible con KommoLead de kommo-sync/types.ts). */
export interface KommoLeadLike {
  id: number;
  name?: string;
  price?: number | null;
  responsible_user_id?: number;
  status_id?: number;
  pipeline_id?: number;
  created_at?: number;
  updated_at?: number;
  closed_at?: number | null;
  custom_fields_values?: unknown[] | null;
}

/** Sub-forma de un contacto de Kommo que el mapeo necesita (compatible con KommoContact). */
export interface KommoContactLike {
  id: number;
  name?: string;
  responsible_user_id?: number;
  created_at?: number;
  updated_at?: number;
  custom_fields_values?: unknown[] | null;
}

/** epoch (segundos) → ISO-8601, o null si falsy. */
export function epochToIso(s?: number | null): string | null {
  return s ? new Date(s * 1000).toISOString() : null;
}

/** Fila para `kommo_leads` (PK tenant_id,id). Idéntica a la del sync read-only. */
export function mapLeadRow(l: KommoLeadLike, tenantId: string): Record<string, unknown> {
  return {
    tenant_id: tenantId,
    id: l.id,
    name: l.name ?? null,
    status_id: l.status_id ?? null,
    pipeline_id: l.pipeline_id ?? null,
    price: l.price ?? null,
    responsible_user_id: l.responsible_user_id ?? null,
    kommo_created_at: epochToIso(l.created_at),
    kommo_updated_at: epochToIso(l.updated_at),
    closed_at: epochToIso(l.closed_at),
    custom_fields: l.custom_fields_values ?? [],
  };
}

/**
 * Email + teléfono de un contacto de Kommo: el PRIMER field con ese `field_code`
 * y valor no vacío. Forma real (verificada en prod):
 * `[{ field_code, values: [{ value }] }]`.
 *
 * Gemelo EXACTO de `parseContactFields` (lib/studio/kommo-convert.ts), que vive
 * del lado de Next. Existen los dos porque las Edge Functions no importan de
 * `lib/`; un test afirma que coinciden, igual que se hizo con
 * `phoneKey`/`normalizePhone`. PURA.
 */
export function parseContactFieldsShared(customFields: unknown): {
  email: string | null;
  phone: string | null;
} {
  let email: string | null = null;
  let phone: string | null = null;
  if (Array.isArray(customFields)) {
    for (const f of customFields) {
      if (!f || typeof f !== "object") continue;
      const code = String((f as { field_code?: unknown }).field_code ?? "").toUpperCase();
      const values = (f as { values?: unknown }).values;
      const raw = Array.isArray(values)
        ? (values[0] as { value?: unknown })?.value
        : null;
      if (raw == null || raw === "") continue;
      if (code === "EMAIL" && !email) email = String(raw);
      else if (code === "PHONE" && !phone) phone = String(raw);
    }
  }
  return { email, phone };
}

/**
 * Fila para `kommo_contacts` (PK tenant_id,id). Idéntica a la del sync read-only.
 *
 * Desde la migración 0363 desnormaliza `email` y `phone` fuera del jsonb: sin eso
 * no hay nada indexable y buscar por teléfono obliga a escanear. `phone_last10`
 * NO se escribe acá — es una columna GENERADA, así que no puede driftear.
 */
export function mapContactRow(
  c: KommoContactLike,
  tenantId: string,
): Record<string, unknown> {
  const { email, phone } = parseContactFieldsShared(c.custom_fields_values);
  return {
    tenant_id: tenantId,
    id: c.id,
    name: c.name ?? null,
    responsible_user_id: c.responsible_user_id ?? null,
    kommo_created_at: epochToIso(c.created_at),
    kommo_updated_at: epochToIso(c.updated_at),
    custom_fields: c.custom_fields_values ?? [],
    email,
    phone,
  };
}

/** Un vínculo lead↔contacto tal como lo embebe `?with=contacts`. */
export interface EmbeddedContactLike {
  id: number;
  is_main?: boolean;
}

/**
 * Los vínculos de un lead, listos para `kommo_replace_lead_contacts`.
 * Devuelve `[]` si el lead vino sin `_embedded.contacts` — que es distinto de
 * "el lead no tiene contactos": si el fetch no pidió `with=contacts`, el campo
 * no viene y NO hay que borrar los vínculos existentes. Esa distinción la
 * resuelve el llamador, que sabe si pidió el embed. PURA.
 */
export function mapLeadContactLinks(lead: {
  _embedded?: { contacts?: EmbeddedContactLike[] | null } | null;
}): { id: number; is_main: boolean }[] {
  const raw = lead?._embedded?.contacts;
  if (!Array.isArray(raw)) return [];
  const out: { id: number; is_main: boolean }[] = [];
  const seen = new Set<number>();
  for (const c of raw) {
    const id = Number((c as { id?: unknown })?.id);
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, is_main: Boolean((c as { is_main?: unknown })?.is_main) });
  }
  return out;
}

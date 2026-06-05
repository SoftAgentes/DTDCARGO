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

/** Fila para `kommo_contacts` (PK tenant_id,id). Idéntica a la del sync read-only. */
export function mapContactRow(
  c: KommoContactLike,
  tenantId: string,
): Record<string, unknown> {
  return {
    tenant_id: tenantId,
    id: c.id,
    name: c.name ?? null,
    responsible_user_id: c.responsible_user_id ?? null,
    kommo_created_at: epochToIso(c.created_at),
    kommo_updated_at: epochToIso(c.updated_at),
    custom_fields: c.custom_fields_values ?? [],
  };
}

// SDD-0043 · tipos HAL de Kommo v4 (los que consume kommo-sync) + filas espejo.
// Fuente de API: modelado desde Kommo v4 (KOMMO_API_REFERENCE.md pendiente en el repo).
// Timestamps de Kommo = epoch en SEGUNDOS (number).

export interface HalList<T> {
  _page?: number;
  _links?: unknown;
  _embedded?: Record<string, T[]>;
}

export interface KommoCustomFieldValue {
  field_id: number;
  field_name?: string;
  field_code?: string | null;
  field_type?: string;
  values: Array<{
    value: string | number | boolean | null;
    enum_id?: number;
    enum_code?: string;
  }>;
}

export interface KommoLead {
  id: number;
  name?: string;
  price?: number | null;
  responsible_user_id?: number;
  status_id?: number;
  pipeline_id?: number;
  created_at?: number;
  updated_at?: number;
  closed_at?: number | null;
  custom_fields_values?: KommoCustomFieldValue[] | null;
}

export interface KommoContact {
  id: number;
  name?: string;
  responsible_user_id?: number;
  created_at?: number;
  updated_at?: number;
  custom_fields_values?: KommoCustomFieldValue[] | null;
}

export interface KommoStatus {
  id: number;
  name?: string;
  sort?: number;
  pipeline_id?: number;
  color?: string;
  type?: number;
}

export interface KommoPipeline {
  id: number;
  name?: string;
  sort?: number;
  is_main?: boolean;
  _embedded?: { statuses?: KommoStatus[] };
}

export interface KommoCustomField {
  id: number;
  name?: string;
  type?: string;
  code?: string | null;
  enums?: Array<{ id: number; value: string; sort?: number }> | null;
}

/**
 * SDD-0245 — entrada de la bandeja (`/api/v4/leads/unsorted`). NO es un lead:
 * mientras viva acá, su `lead_id` **no existe** en `/api/v4/leads` ni en el
 * espejo `kommo_leads`. Desaparece cuando alguien la acepta o la rechaza.
 */
export interface KommoUnsorted {
  uid: string;
  category?: string | null;
  source_name?: string | null;
  pipeline_id?: number | null;
  created_at?: number | null; // epoch segundos, como el resto de la API v4
  _embedded?: {
    leads?: { id: number }[];
    contacts?: { id: number }[];
  } | null;
}

export interface KommoUser {
  id: number;
  name?: string;
  email?: string;
}

export interface KommoConnection {
  id: string;
  tenant_id: string;
  subdomain: string;
  domain: string;
  status: string;
}

export interface EntityResult {
  entity: string;
  status: "ok" | "error";
  fetched?: number;
  upserted?: number;
  error?: string;
}

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

/**
 * SDD-0288 — tarea de Kommo (`/api/v4/tasks`). Es el objeto que enciende el
 * rojo de la tarjeta cuando vence: el espejo de este tipo es lo que le permite
 * al ERP saber que un cliente escribió y nadie le contestó.
 *
 * Es el MISMO objeto que el ERP crea en el camino de ida (`buildTaskPayload` en
 * `lib/studio/kommo-writeback.ts`), leído. Si esta forma y aquélla divergen, una
 * de las dos está mal.
 *
 * ⚠️ `complete_till` es epoch en SEGUNDOS, como todo el resto de la API v4.
 */
export interface KommoTask {
  id: number;
  entity_id?: number | null;
  entity_type?: string | null;
  responsible_user_id?: number | null;
  text?: string | null;
  task_type_id?: number | null;
  complete_till?: number | null;
  is_completed?: boolean | null;
  created_at?: number | null;
  updated_at?: number | null;
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

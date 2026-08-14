/**
 * SDD-0256 · Fase 5 (B4) — el estado comercial del cliente, escrito en el
 * CONTACTO de Kommo para que el agente de IA deje de contestar a ciegas.
 *
 * El agente de IA de Kommo lee campos del contacto. Hoy no tiene forma de saber
 * si quien escribe debe plata o tiene un contenedor navegando, así que responde
 * igual en los dos casos. Estos dos campos son lo mínimo para que escale a un
 * humano cuando corresponde.
 *
 * ── Sí/no, sin montos (decisión del founder, 2026-08-14) ────────────────────
 * "Tiene saldo pendiente: Sí/No" y "Carga en tránsito: Sí/No". Nada de cifras:
 * del otro lado hay un agente automático, y un monto exacto es plata hablando
 * sola frente a algo que puede repetirlo fuera de contexto. El sí/no alcanza
 * para lo único que se le pide.
 *
 * ── Nace inerte ─────────────────────────────────────────────────────────────
 * Sin `contact_saldo_field_id` / `contact_transito_field_id` configurados no
 * encola nada (patrón de `markbox_field_id`), y aunque se configuren el gate de
 * escritura de la 0136 sigue mandando.
 *
 * ⚠️ COBERTURA REAL, medida el 2026-08-14 contra producción: de 447 clientes
 * vivos, **32** tienen `kommo_contact_id`. De esos 32, **cero** tienen hoy saldo
 * pendiente o carga en tránsito — los 2 clientes con saldo y los 6 con carga del
 * ERP no están vinculados a ningún contacto de Kommo. O sea: este job hoy no le
 * escribiría nada a nadie. No es un defecto del job; es que el vínculo
 * cliente↔contacto casi no existe. Ese es el cuello, y está antes que esto.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueKommoContactOp } from "./kommo-writeback";

/** Estados de embarque que NO cuentan como carga en tránsito. */
export const ESTADOS_NO_TRANSITO: readonly string[] = [
  "draft", // todavía no salió del ERP
  "delivered", // llegó
  "cancelled", // no va a llegar
] as const;

export type EstadoComercial = {
  tieneSaldo: boolean;
  tieneTransito: boolean;
};

export type FacturaLite = {
  client_markbox: string | null;
  status: string | null;
  total_amount: number | string | null;
  paid_amount: number | string | null;
};

export type EmbarqueLite = {
  client_markbox: string | null;
  status: string | null;
};

/**
 * Estado comercial por markbox. PURA.
 *
 * `saldo` = suma de (total − pagado) de las facturas vivas. Se excluyen
 * `anulada` (no se cobra) y `borrador` (todavía no es una deuda: decirle a un
 * cliente que debe algo que nadie le facturó es peor que no decirle nada).
 *
 * El redondeo a centavos evita que un residuo de coma flotante —0.0000001 tras
 * sumar y restar decimales— encienda "tiene saldo" en una factura pagada al
 * centavo.
 */
export function computeEstadoComercial(
  facturas: FacturaLite[],
  embarques: EmbarqueLite[],
): Record<string, EstadoComercial> {
  const out: Record<string, EstadoComercial> = {};
  const saldoPorMarkbox = new Map<string, number>();

  for (const f of facturas) {
    const mb = (f.client_markbox ?? "").trim();
    if (!mb) continue;
    const st = String(f.status ?? "");
    if (st === "anulada" || st === "borrador") continue;
    const balance = (Number(f.total_amount) || 0) - (Number(f.paid_amount) || 0);
    saldoPorMarkbox.set(mb, (saldoPorMarkbox.get(mb) ?? 0) + balance);
  }

  for (const [mb, total] of saldoPorMarkbox) {
    (out[mb] ??= { tieneSaldo: false, tieneTransito: false }).tieneSaldo =
      Math.round(total * 100) > 0;
  }

  for (const e of embarques) {
    const mb = (e.client_markbox ?? "").trim();
    if (!mb) continue;
    if (ESTADOS_NO_TRANSITO.includes(String(e.status ?? ""))) continue;
    (out[mb] ??= { tieneSaldo: false, tieneTransito: false }).tieneTransito = true;
  }

  return out;
}

/** Cómo se escribe un booleano en un campo de texto de Kommo. */
export const SI = "Sí";
export const NO = "No";

/**
 * `custom_fields_values` del PATCH al contacto. PURA.
 *
 * Sólo incluye los campos CONFIGURADOS: si el founder eligió el de saldo pero
 * no el de tránsito, viaja uno solo. `null` si no hay ninguno — así el caller no
 * encola un PATCH vacío, que Kommo aceptaría y contaría como una escritura sin
 * efecto (y subiría el `updated_at` del contacto por nada).
 */
export function buildContactStatusPayload(
  fields: { saldoFieldId: number | null; transitoFieldId: number | null },
  estado: EstadoComercial,
): { custom_fields_values: { field_id: number; values: { value: string }[] }[] } | null {
  const cfv: { field_id: number; values: { value: string }[] }[] = [];

  const saldoId = normalizarId(fields.saldoFieldId);
  if (saldoId != null) {
    cfv.push({ field_id: saldoId, values: [{ value: estado.tieneSaldo ? SI : NO }] });
  }

  const transitoId = normalizarId(fields.transitoFieldId);
  if (transitoId != null) {
    cfv.push({ field_id: transitoId, values: [{ value: estado.tieneTransito ? SI : NO }] });
  }

  return cfv.length > 0 ? { custom_fields_values: cfv } : null;
}

function normalizarId(v: number | null | undefined): number | null {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ── El job ──────────────────────────────────────────────────────────────────

export type SyncContactStatusResult = {
  /** Motivo por el que no hizo nada, si no hizo nada. */
  inerte?: string;
  /** Clientes vinculados a un contacto de Kommo. */
  vinculados: number;
  /** Órdenes encoladas (una por contacto). */
  encoladas: number;
  /** Cuántos de los vinculados tienen algo que reportar. */
  conSaldo: number;
  conTransito: number;
  /** true si alguna lectura chocó con el tope y el cálculo es parcial. */
  truncado: boolean;
};

/** Tope por lectura. Si se alcanza, el resultado lo dice en vez de mentir. */
const PAGINA = 1000;

/**
 * Calcula el estado comercial de cada cliente vinculado a un contacto de Kommo
 * y encola un `patch_contact` por cada uno.
 *
 * Encola SIEMPRE, también cuando el estado es "No/No": el valor del campo es
 * que esté escrito y sea confiable. Un campo vacío el agente no lo puede
 * distinguir de "todavía no lo calculamos", y ahí vuelve a contestar a ciegas.
 * La fusión de la 0364 hace que dos corridas seguidas no dejen dos filas.
 */
export async function syncKommoContactStatus(
  admin: SupabaseClient,
  tenantId: string,
): Promise<SyncContactStatusResult> {
  const vacio: SyncContactStatusResult = {
    vinculados: 0,
    encoladas: 0,
    conSaldo: 0,
    conTransito: 0,
    truncado: false,
  };

  // 1) ¿Están configurados los campos? Sin eso, inerte.
  const { data: conn } = await admin
    .from("kommo_connections")
    .select("contact_saldo_field_id, contact_transito_field_id")
    .eq("tenant_id", tenantId)
    .maybeSingle<{
      contact_saldo_field_id: number | null;
      contact_transito_field_id: number | null;
    }>();

  const saldoFieldId = conn?.contact_saldo_field_id ?? null;
  const transitoFieldId = conn?.contact_transito_field_id ?? null;
  if (saldoFieldId == null && transitoFieldId == null) {
    return {
      ...vacio,
      inerte:
        "Sin campos de contacto configurados (Studio › CRM › Dirección). El job no encola nada.",
    };
  }

  // 2) Clientes vinculados a un contacto de Kommo.
  const { data: clientes, error: errClientes } = await admin
    .from("clients")
    .select("markbox, kommo_contact_id")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .not("kommo_contact_id", "is", null)
    .limit(PAGINA);
  if (errClientes) return { ...vacio, inerte: `clients: ${errClientes.message}` };

  const filas = (clientes as { markbox: string | null; kommo_contact_id: number }[] | null) ?? [];
  if (filas.length === 0) {
    return { ...vacio, inerte: "Ningún cliente tiene contacto de Kommo vinculado." };
  }

  // 3) Facturas y embarques de esos clientes. Se piden por markbox para no
  //    barrer el ERP entero: con 32 vinculados esto es una lista corta.
  const markboxes = [...new Set(filas.map((c) => (c.markbox ?? "").trim()).filter(Boolean))];

  const [{ data: facturas }, { data: embarques }] = await Promise.all([
    admin
      .from("invoices")
      .select("client_markbox, status, total_amount, paid_amount")
      .eq("tenant_id", tenantId)
      .in("client_markbox", markboxes)
      .limit(PAGINA),
    admin
      .from("shipments")
      .select("client_markbox, status")
      .eq("tenant_id", tenantId)
      .in("client_markbox", markboxes)
      .limit(PAGINA),
  ]);

  const facturasArr = (facturas as FacturaLite[] | null) ?? [];
  const embarquesArr = (embarques as EmbarqueLite[] | null) ?? [];

  // Si una lectura llegó justo al tope, el estado que se calcula es PARCIAL y
  // podría decir "no debe nada" sobre datos truncados. Se dice, no se disimula.
  const truncado = facturasArr.length >= PAGINA || embarquesArr.length >= PAGINA;

  const estados = computeEstadoComercial(facturasArr, embarquesArr);

  // 4) Encolar.
  let encoladas = 0;
  let conSaldo = 0;
  let conTransito = 0;

  for (const c of filas) {
    const mb = (c.markbox ?? "").trim();
    const estado = estados[mb] ?? { tieneSaldo: false, tieneTransito: false };
    if (estado.tieneSaldo) conSaldo++;
    if (estado.tieneTransito) conTransito++;

    const payload = buildContactStatusPayload({ saldoFieldId, transitoFieldId }, estado);
    if (!payload) continue;

    const id = await enqueueKommoContactOp(admin, tenantId, {
      contactId: c.kommo_contact_id,
      payload,
    });
    if (id) encoladas++;
  }

  return { vinculados: filas.length, encoladas, conSaldo, conTransito, truncado };
}

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
 *
 * ── El saldo sale de la base (SDD-0558) ─────────────────────────────────────
 * «Tiene saldo pendiente» ya no se calcula acá: lo da `listClientOutstanding`,
 * la definición única del saldo por cliente (migración 0492). Cambia en tres
 * cosas respecto del cálculo viejo, que sumaba Σ(total − pagado) por markbox:
 *  - cada factura se recorta a 0, así que un sobrepago ya no compensa la deuda
 *    de OTRA factura del mismo cliente;
 *  - cuentan también las facturas de sus códigos retirados y de sus fichas
 *    fusionadas, y la carga en tránsito de esos códigos;
 *  - las monedas no se mezclan: «Sí» si ALGUNA tiene algo abierto.
 * Borrador, anulada y eliminada siguen sin ser deuda: esa regla vive en la 0492
 * y su contrato la prueba. Si la lectura falla, el job queda inerte y NO
 * escribe «No»: un «No» con el saldo sin calcular sería un dato falso para el
 * agente.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueKommoContactOp } from "./kommo-writeback";
import { tieneSaldoAbierto, type ClientOutstandingRow } from "./client-account";
import { listClientOutstanding } from "./client-queries";
import { INACTIVE_STATUSES } from "./shipment-queries";

export type EstadoComercial = {
  tieneSaldo: boolean;
  tieneTransito: boolean;
};

export type EmbarqueLite = {
  client_markbox: string | null;
  status: string | null;
};

/** Código normalizado como lo compara la 0492: `upper(btrim())`. */
function clave(markbox: string | null | undefined): string {
  return (markbox ?? "").trim().toUpperCase();
}

/**
 * Estado comercial por CLIENTE (id). PURA.
 *
 * `tieneSaldo` = alguna moneda del cliente con algo abierto, según las filas de
 * la 0492 (`tieneSaldoAbierto`). `tieneTransito` = algún embarque vivo bajo
 * CUALQUIERA de sus códigos (los de `markboxes`: vigente, historial y fichas
 * fusionadas) que no esté entregado, cancelado ni en borrador
 * (`INACTIVE_STATUSES`, la misma lista del tracking operativo).
 */
export function computeEstadoComercial(
  saldos: readonly ClientOutstandingRow[],
  embarques: readonly EmbarqueLite[],
): Record<string, EstadoComercial> {
  const out: Record<string, EstadoComercial> = {};
  const filasPorCliente = new Map<string, ClientOutstandingRow[]>();
  const clientePorCodigo = new Map<string, string>();

  for (const r of saldos) {
    const filas = filasPorCliente.get(r.client_id) ?? [];
    filas.push(r);
    filasPorCliente.set(r.client_id, filas);
    for (const mb of r.markboxes) {
      const k = clave(mb);
      if (k && !clientePorCodigo.has(k)) clientePorCodigo.set(k, r.client_id);
    }
  }

  for (const [clientId, filas] of filasPorCliente) {
    out[clientId] = { tieneSaldo: tieneSaldoAbierto(filas), tieneTransito: false };
  }

  for (const e of embarques) {
    const clientId = clientePorCodigo.get(clave(e.client_markbox));
    if (!clientId) continue;
    if (INACTIVE_STATUSES.includes(String(e.status ?? ""))) continue;
    out[clientId].tieneTransito = true;
  }

  return out;
}

/** La única RPC que escribe: el encolado del PATCH al contacto. */
const RPC_DE_ENCOLADO = "enqueue_kommo_contact_writeback";

/**
 * Cliente admin que lee igual pero cuya RPC de ENCOLADO no hace nada — para
 * `?dry=1` del cron. Antes neutralizaba TODA llamada `.rpc()` (suponía que la
 * única era el encolado); con el saldo leído por RPC, dry=1 habría respondido
 * «sin saldo» para todos. Es un proxy sobre el admin real, no un stub: el dry
 * mide la base, no un doble.
 */
export function soloLecturaKommo<T extends SupabaseClient>(admin: T): T {
  return new Proxy(admin, {
    get(target, prop, receiver) {
      if (prop === "rpc") {
        return (fn: string, ...args: unknown[]) =>
          fn === RPC_DE_ENCOLADO
            ? Promise.resolve({ data: null, error: null })
            : (target.rpc as (...a: unknown[]) => unknown).call(target, fn, ...args);
      }
      return Reflect.get(target, prop, receiver);
    },
  });
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
    .select("id, markbox, kommo_contact_id")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .not("kommo_contact_id", "is", null)
    .limit(PAGINA);
  if (errClientes) return { ...vacio, inerte: `clients: ${errClientes.message}` };

  const filas =
    (clientes as { id: string; markbox: string | null; kommo_contact_id: number }[] | null) ?? [];
  if (filas.length === 0) {
    return { ...vacio, inerte: "Ningún cliente tiene contacto de Kommo vinculado." };
  }

  // 3) El saldo de esos clientes, de la definición única (SDD-0558). Si falla,
  //    el job queda inerte y no encola nada: nunca escribe un «No» sin saber.
  let saldos: ClientOutstandingRow[];
  try {
    saldos = await listClientOutstanding(admin, filas.map((c) => c.id));
  } catch (e) {
    return {
      ...vacio,
      vinculados: filas.length,
      inerte: e instanceof Error ? e.message : "saldo: no se pudo leer",
    };
  }

  // 4) Embarques de TODOS sus códigos (vigente, historial y fichas
  //    fusionadas). Se piden por código para no barrer el ERP entero: con 32
  //    vinculados esto es una lista corta. SDD-0511 · solo VIVOS: un embarque
  //    eliminado no es carga en tránsito. Cliente admin: la RLS no filtra.
  const markboxes = [
    ...new Set(
      [...saldos.flatMap((r) => r.markboxes), ...filas.map((c) => c.markbox ?? "")]
        .map((m) => m.trim())
        .filter(Boolean),
    ),
  ];

  const { data: embarques } = await admin
    .from("shipments")
    .select("client_markbox, status")
    .eq("tenant_id", tenantId)
    .in("client_markbox", markboxes)
    .is("deleted_at", null)
    .limit(PAGINA);

  const embarquesArr = (embarques as EmbarqueLite[] | null) ?? [];

  // Si la lectura llegó justo al tope, el estado que se calcula es PARCIAL y
  // podría decir "no tiene carga" sobre datos truncados. Se dice, no se
  // disimula. El saldo no se trunca: va en lotes de 200 clientes.
  const truncado = embarquesArr.length >= PAGINA;

  const estados = computeEstadoComercial(saldos, embarquesArr);

  // 5) Encolar.
  let encoladas = 0;
  let conSaldo = 0;
  let conTransito = 0;

  for (const c of filas) {
    const estado = estados[c.id] ?? { tieneSaldo: false, tieneTransito: false };
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

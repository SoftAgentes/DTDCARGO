/**
 * Acciones de la tarifa congelada por recepción (SDD-0571, migración 0496).
 *
 * - loadRateDrawerAction: lo que muestra el cajón de la tarifa (la viva, el
 *   historial, la propuesta automática con su vista previa y los estimados
 *   aceptados del cliente).
 * - previewRateAction: lo que congelaría una fuente, sin escribir.
 * - freezeRateAction: congela (o reemplaza, con motivo) la tarifa de una recepción.
 * - freezePendingRatesAction: congela en lote las recepciones sin tarifa, solo
 *   con la propuesta automática.
 *
 * La base decide los números y los permisos (`congelar_tarifa_recepcion`); estas
 * acciones eligen la fuente y traducen sus errores. Solo se muestran los errores
 * propios de la RPC (`hint = 'dtd-tarifa'`, ERR-01).
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { getStudioAccess, moduleEditDenial, moduleViewDenial } from "@/lib/studio/rbac-guard";
import type { I18nKey } from "@/lib/i18n";
import type { ShipmentService } from "@/lib/studio/shipment-types";
import { isShipmentService } from "@/lib/studio/shipment-types";
import {
  MAX_LOTE_TARIFAS,
  SERVICIO_POR_DEFECTO,
  freezeRpcArgs,
  isMissingRateSchema,
  normalizeSnapshot,
  rateErrorKey,
  validateFreezeInput,
  type FreezeFieldErrors,
  type FreezeInput,
  type RateSnapshot,
} from "@/lib/studio/rate-snapshots/types";
import { listRateHistory } from "@/lib/studio/rate-snapshots/queries";
import {
  listAcceptedQuotesForMarkbox,
  proponerTarifa,
  type PropuestaTarifa,
  type RecepcionParaTarifa,
} from "@/lib/studio/rate-snapshots/propuesta";

type ErrorResult = { ok: false; errorKey?: I18nKey; error?: string; fieldErrors?: FreezeFieldErrors };

const RPC = "congelar_tarifa_recepcion";

function errorDeRpc(error: { code?: string; message?: string; hint?: string | null }): ErrorResult {
  if (isMissingRateSchema(error)) return { ok: false, errorKey: "warehouse_cn.rate.unavailable" };
  const key = rateErrorKey(error);
  return { ok: false, errorKey: key ?? "warehouse_cn.rate.err.generic" };
}

async function leerRecepcion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  receiptId: string,
): Promise<(RecepcionParaTarifa & { id: string; receipt_code: string }) | null> {
  const { data, error } = await supabase
    .from("warehouse_receipts_cn")
    .select("id, receipt_code, client_markbox, destination_city, sales_order_id, total_cbm, is_orphan")
    .eq("id", receiptId)
    .is("deleted_at", null)
    .maybeSingle<RecepcionParaTarifa & { id: string; receipt_code: string }>();
  if (error) throw error;
  return data ?? null;
}

/** La fuente que la propuesta automática le pasa a la RPC. */
function entradaDePropuesta(receiptId: string, propuesta: PropuestaTarifa): FreezeInput | null {
  if (propuesta.kind === "ninguna") return null;
  return {
    receiptId,
    source: propuesta.kind === "estimado" ? "estimado" : "tarifario",
    rateId: propuesta.kind === "tarifario" ? propuesta.rateId : null,
    quoteId: propuesta.kind === "estimado" ? propuesta.quoteId : null,
    perCbm: null,
    minCharge: null,
    service: propuesta.service,
    includedKgPerCbm: 500,
    reason: null,
  };
}

async function llamarRpc(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: FreezeInput,
  dryRun: boolean,
): Promise<{ ok: true; snapshot: RateSnapshot } | ErrorResult> {
  const { data, error } = await supabase.rpc(RPC, freezeRpcArgs(input, dryRun));
  if (error) return errorDeRpc(error);
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
  if (!row) return { ok: false, errorKey: "warehouse_cn.rate.err.generic" };
  return { ok: true, snapshot: normalizeSnapshot(row) };
}

export type RateDrawerData = {
  ok: true;
  receiptCode: string;
  currentCbm: number | null;
  live: RateSnapshot | null;
  history: RateSnapshot[];
  propuesta: PropuestaTarifa;
  /** La vista previa de la propuesta: lo que congelaría hoy. */
  preview: RateSnapshot | null;
  previewErrorKey: I18nKey | null;
  acceptedQuotes: { id: string; quote_code: string; rate_per_cbm: number; service: ShipmentService }[];
  /** admin o accounting: a mano, Excel, 1.000 kg/m³ y reemplazo. */
  canElevate: boolean;
  /** Puede congelar una pendiente desde estimado o tarifario. */
  canFreeze: boolean;
};

export async function loadRateDrawerAction(
  receiptId: string,
  serviceRaw: string = SERVICIO_POR_DEFECTO,
): Promise<RateDrawerData | ErrorResult> {
  const supabase = await createClient();
  const denial = await moduleViewDenial(supabase, "cn");
  if (denial) return { ok: false, error: denial };
  const service: ShipmentService = isShipmentService(serviceRaw) ? serviceRaw : SERVICIO_POR_DEFECTO;

  const receipt = await leerRecepcion(supabase, receiptId);
  if (!receipt) return { ok: false, errorKey: "warehouse_cn.rate.err.receipt_not_found" };

  const history = await listRateHistory(supabase, receiptId);
  if (history === null) return { ok: false, errorKey: "warehouse_cn.rate.unavailable" };
  const live = history.find((s) => s.superseded_at == null) ?? null;

  const propuesta = await proponerTarifa(supabase, receipt, service);
  let preview: RateSnapshot | null = null;
  let previewErrorKey: I18nKey | null = null;
  const entrada = entradaDePropuesta(receiptId, propuesta);
  if (entrada) {
    const r = await llamarRpc(supabase, entrada, true);
    if (r.ok) preview = r.snapshot;
    else previewErrorKey = r.errorKey ?? "warehouse_cn.rate.err.generic";
  }

  const acceptedQuotes = receipt.client_markbox
    ? await listAcceptedQuotesForMarkbox(supabase, receipt.client_markbox)
    : [];
  const { role } = await getStudioAccess(supabase);
  const editDenied = await moduleEditDenial(supabase, "cn");
  return {
    ok: true,
    receiptCode: receipt.receipt_code,
    currentCbm: receipt.total_cbm == null ? null : Number(receipt.total_cbm),
    live,
    history,
    propuesta,
    preview,
    previewErrorKey,
    acceptedQuotes,
    canElevate: role === "admin" || role === "accounting",
    canFreeze: !editDenied && (role === "admin" || role === "operations" || role === "warehouse" || role === "accounting"),
  };
}

export async function previewRateAction(
  raw: Record<string, unknown>,
): Promise<{ ok: true; snapshot: RateSnapshot } | ErrorResult> {
  const supabase = await createClient();
  const denial = await moduleViewDenial(supabase, "cn");
  if (denial) return { ok: false, error: denial };
  // La vista previa no exige motivo: la base tampoco lo pide sin escribir.
  const { input, fieldErrors } = validateFreezeInput(raw, { requireReason: false });
  if (!input) return { ok: false, fieldErrors };
  return llamarRpc(supabase, input, true);
}

export async function freezeRateAction(
  raw: Record<string, unknown>,
): Promise<{ ok: true; snapshot: RateSnapshot } | ErrorResult> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "cn");
  if (denial) return { ok: false, error: denial };
  const { input, fieldErrors } = validateFreezeInput(raw);
  if (!input) return { ok: false, fieldErrors };
  const result = await llamarRpc(supabase, input, false);
  if (result.ok) revalidatePath("/studio/cn");
  return result;
}

export type FreezePendingResult =
  | {
      ok: true;
      frozen: number;
      alreadyFrozen: number;
      skipped: { code: string; reasonKey: I18nKey }[];
    }
  | ErrorResult;

const MOTIVO_KEYS: Record<Exclude<PropuestaTarifa, { kind: "estimado" | "tarifario" }>["motivo"], I18nKey> = {
  sin_cliente: "warehouse_cn.rate.none.sin_cliente",
  sin_destino: "warehouse_cn.rate.none.sin_destino",
  sin_tarifa: "warehouse_cn.rate.none.sin_tarifa",
  sin_cbm: "warehouse_cn.rate.none.sin_cbm",
};

/**
 * Congela las recepciones elegidas que no tienen tarifa, con la propuesta
 * automática y 500 kg/m³. Las que ya tienen no se tocan (reemplazar exige
 * motivo, uno por uno); las que no tienen propuesta se nombran con su motivo.
 */
export async function freezePendingRatesAction(
  receiptIds: string[],
  serviceRaw: string = SERVICIO_POR_DEFECTO,
): Promise<FreezePendingResult> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "cn");
  if (denial) return { ok: false, error: denial };
  const ids = Array.from(new Set(receiptIds.filter((id) => typeof id === "string" && id.length > 0)));
  if (ids.length === 0) return { ok: false, errorKey: "warehouse_cn.rate.err.receipt_invalid" };
  if (ids.length > MAX_LOTE_TARIFAS) return { ok: false, errorKey: "warehouse_cn.rate.err.too_many" };
  const service: ShipmentService = isShipmentService(serviceRaw) ? serviceRaw : SERVICIO_POR_DEFECTO;

  const { data: vivas, error: eVivas } = await supabase
    .from("shipment_rate_snapshots")
    .select("receipt_id")
    .in("receipt_id", ids)
    .is("superseded_at", null);
  if (eVivas) return errorDeRpc(eVivas);
  const conTarifa = new Set(((vivas ?? []) as { receipt_id: string }[]).map((v) => v.receipt_id));

  let frozen = 0;
  const skipped: { code: string; reasonKey: I18nKey }[] = [];
  for (const id of ids) {
    if (conTarifa.has(id)) continue;
    const receipt = await leerRecepcion(supabase, id);
    if (!receipt) {
      skipped.push({ code: id, reasonKey: "warehouse_cn.rate.err.receipt_not_found" });
      continue;
    }
    const propuesta = await proponerTarifa(supabase, receipt, service);
    if (propuesta.kind === "ninguna") {
      skipped.push({ code: receipt.receipt_code, reasonKey: MOTIVO_KEYS[propuesta.motivo] });
      continue;
    }
    const entrada = entradaDePropuesta(id, propuesta);
    const r = entrada ? await llamarRpc(supabase, entrada, false) : null;
    if (r?.ok) {
      frozen += 1;
    } else {
      skipped.push({ code: receipt.receipt_code, reasonKey: r?.errorKey ?? "warehouse_cn.rate.err.generic" });
      // Sin permiso o sin la 0496, las demás van a fallar igual.
      if (r?.errorKey === "warehouse_cn.rate.err.forbidden" || r?.errorKey === "warehouse_cn.rate.unavailable") {
        return { ok: false, errorKey: r.errorKey };
      }
    }
  }
  if (frozen > 0) revalidatePath("/studio/cn");
  return { ok: true, frozen, alreadyFrozen: conTarifa.size, skipped };
}

/**
 * Server actions del módulo Naviera & Consolidación (SDD-0047, Slice B).
 *
 * Patrón del Studio: "use server" + parsing/validación manual con los
 * `validate*Input()` de lib/studio/naviera/types (NO Zod) + resolución de
 * tenant desde user_tenants (RLS) + revalidatePath.
 *
 * Acciones:
 *  - createSailing / updateSailing          → alta/edición manual de itinerario.
 *  - createBooking / updateBooking          → reserva de espacio (BKG-YYYY-NNNN)
 *                                             + captura manual de bl_number.
 *  - createConsolidation                    → nuevo contenedor (DTD-CONSOL-NNNN).
 *  - assignLooseCargo / removeConsolidationItem → mover carga suelta a/desde un
 *                                             contenedor (guard de capacidad
 *                                             ADVISORY · §4.4, no bloquea).
 *  - changeSailingStatus / changeBookingStatus / changeConsolidationStatus
 *  - linkConsolidation                      → atar contenedor a booking/sailing.
 *
 * El guard de capacidad vive en `evaluateCapacity` (puro, testeable) y se reusa
 * en assignLooseCargo para devolver el aviso (warning) sin impedir la asignación.
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import {
  scheduleConsolidationEvent,
  scheduleSailingEvent,
} from "@/lib/studio/notifications/schedule-fanout";
import { getContainerTracking } from "@/lib/studio/naviera-tracking/tracking-api";
import {
  trackingQuotaConfig,
  trackingQuotaDecision,
  trackingPeriod,
} from "@/lib/studio/naviera-tracking/tracking-quota";
import { getTrackingUsage } from "@/lib/studio/naviera-tracking/snapshot-queries";
import {
  evaluateCapacity,
  normalizeContainerNo,
  validateBookingInput,
  validateConsolidationInput,
  validateConsolidationItemInput,
  validateSailingInput,
  type BookingInput,
  type BookingStatus,
  type ConsolidationInput,
  type ConsolidationItemInput,
  type ContainerStatus,
  type SailingInput,
  type SailingStatus,
  type StatItem,
} from "@/lib/studio/naviera/types";

type Result = { ok?: boolean; error?: string };

const VALID_SAILING_STATUS = new Set<string>([
  "abierto",
  "cutoff",
  "zarpado",
  "transito",
  "arribado",
]);
const VALID_BOOKING_STATUS = new Set<string>([
  "abierto",
  "solicitado",
  "confirmado",
  "cerrado",
  "zarpado",
  "transito",
]);
const VALID_CONTAINER_STATUS = new Set<string>([
  "consolidando",
  "cerrado",
  "zarpado",
  "arribado",
]);

/** Resuelve el tenant del usuario logueado (RLS). null si no se puede. */
async function resolveTenant(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  return link?.tenant_id ?? null;
}

function revalidate(): void {
  revalidatePath("/studio/naviera");
  revalidatePath("/studio/dashboard");
}

// ── Itinerarios (sailings) ─────────────────────────────────────

export async function createSailing(
  raw: Partial<SailingInput>,
): Promise<{ ok?: boolean; error?: string; sailingId?: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "naviera");
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateSailingInput(raw);
  if (fieldErrors) {
    return { error: Object.values(fieldErrors)[0] ?? "Datos del itinerario inválidos." };
  }
  const tenantId = await resolveTenant(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  const { data: inserted, error } = await supabase
    .from("sailings")
    .insert({
      tenant_id: tenantId,
      carrier_id: input!.carrierId,
      vessel: input!.vessel,
      voyage: input!.voyage,
      pol: input!.pol,
      pod: input!.pod,
      etd: input!.etd,
      eta: input!.eta,
      cutoff: input!.cutoff,
      transit_days: input!.transitDays,
      status: input!.status,
      space: input!.space,
      notes: input!.notes,
    })
    .select("id")
    .single();
  if (error || !inserted) {
    return { error: `No se pudo crear el itinerario: ${error?.message ?? "desconocido"}` };
  }
  revalidate();
  return { ok: true, sailingId: inserted.id };
}

export async function updateSailing(
  sailingId: string,
  raw: Partial<SailingInput>,
): Promise<Result> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "naviera");
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateSailingInput(raw);
  if (fieldErrors) {
    return { error: Object.values(fieldErrors)[0] ?? "Datos del itinerario inválidos." };
  }
  const { error } = await supabase
    .from("sailings")
    .update({
      carrier_id: input!.carrierId,
      vessel: input!.vessel,
      voyage: input!.voyage,
      pol: input!.pol,
      pod: input!.pod,
      etd: input!.etd,
      eta: input!.eta,
      cutoff: input!.cutoff,
      transit_days: input!.transitDays,
      status: input!.status,
      space: input!.space,
      notes: input!.notes,
    })
    .eq("id", sailingId);
  if (error) return { error: `No se pudo actualizar el itinerario: ${error.message}` };

  // SDD-0156 · Slice D: la naviera fijó/actualizó el ETA → programa el aviso
  // 'eta_set' para todos los envíos de las consolidaciones de este itinerario.
  // Idempotente (no re-programa el mismo envío/evento); best-effort.
  if (input!.eta) {
    const tenantId = await resolveTenant(supabase);
    if (tenantId) {
      await scheduleSailingEvent(
        createAdminClient(),
        tenantId,
        sailingId,
        "eta_set",
      );
    }
  }
  revalidate();
  return { ok: true };
}

export async function changeSailingStatus(
  sailingId: string,
  status: SailingStatus,
): Promise<Result> {
  if (!VALID_SAILING_STATUS.has(status)) return { error: "Estado inválido." };
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "naviera");
  if (denial) return { error: denial };

  const { error } = await supabase
    .from("sailings")
    .update({ status })
    .eq("id", sailingId);
  if (error) return { error: `No se pudo cambiar el estado: ${error.message}` };
  revalidate();
  return { ok: true };
}

// ── Reservas (bookings) ────────────────────────────────────────

export async function createBooking(
  raw: Partial<BookingInput>,
): Promise<{ ok?: boolean; error?: string; bookingCode?: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "naviera");
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateBookingInput(raw);
  if (fieldErrors) {
    return { error: Object.values(fieldErrors)[0] ?? "Datos de la reserva inválidos." };
  }
  const tenantId = await resolveTenant(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  const { data: codeData, error: codeErr } = await supabase.rpc(
    "next_booking_code",
    { p_tenant_id: tenantId },
  );
  if (codeErr || !codeData) {
    return { error: "No se pudo generar el código de la reserva." };
  }
  const bookingCode = String(codeData);

  const { error } = await supabase.from("bookings").insert({
    tenant_id: tenantId,
    code: bookingCode,
    carrier_id: input!.carrierId,
    sailing_id: input!.sailingId,
    bl_number: input!.blNumber,
    container_type: input!.containerType,
    mode: input!.mode,
    shipper: input!.shipper,
    commodity: input!.commodity,
    status: input!.status,
    notes: input!.notes,
  });
  if (error) return { error: `No se pudo crear la reserva: ${error.message}` };
  revalidate();
  return { ok: true, bookingCode };
}

export async function updateBooking(
  bookingId: string,
  raw: Partial<BookingInput>,
): Promise<Result> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "naviera");
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateBookingInput(raw);
  if (fieldErrors) {
    return { error: Object.values(fieldErrors)[0] ?? "Datos de la reserva inválidos." };
  }
  const { error } = await supabase
    .from("bookings")
    .update({
      carrier_id: input!.carrierId,
      sailing_id: input!.sailingId,
      bl_number: input!.blNumber,
      container_type: input!.containerType,
      mode: input!.mode,
      shipper: input!.shipper,
      commodity: input!.commodity,
      status: input!.status,
      notes: input!.notes,
    })
    .eq("id", bookingId);
  if (error) return { error: `No se pudo actualizar la reserva: ${error.message}` };
  revalidate();
  return { ok: true };
}

export async function changeBookingStatus(
  bookingId: string,
  status: BookingStatus,
): Promise<Result> {
  if (!VALID_BOOKING_STATUS.has(status)) return { error: "Estado inválido." };
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "naviera");
  if (denial) return { error: denial };

  const { error } = await supabase
    .from("bookings")
    .update({ status })
    .eq("id", bookingId);
  if (error) return { error: `No se pudo cambiar el estado: ${error.message}` };
  revalidate();
  return { ok: true };
}

// ── Contenedores (consolidations) ──────────────────────────────

export async function createConsolidation(
  raw: Partial<ConsolidationInput>,
): Promise<{ ok?: boolean; error?: string; consolidationRef?: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "naviera");
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateConsolidationInput(raw);
  if (fieldErrors) {
    return { error: Object.values(fieldErrors)[0] ?? "Datos del contenedor inválidos." };
  }
  const tenantId = await resolveTenant(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  const { data: refData, error: refErr } = await supabase.rpc(
    "next_consolidation_ref",
    { p_tenant_id: tenantId },
  );
  if (refErr || !refData) {
    return { error: "No se pudo generar la referencia del contenedor." };
  }
  const consolidationRef = String(refData);

  const { error } = await supabase.from("consolidations").insert({
    tenant_id: tenantId,
    ref: consolidationRef,
    booking_id: input!.bookingId,
    sailing_id: input!.sailingId,
    container_type: input!.containerType,
    container_no: input!.containerNo,
    status: input!.status,
    notes: input!.notes,
  });
  if (error) return { error: `No se pudo crear el contenedor: ${error.message}` };
  revalidate();
  return { ok: true, consolidationRef };
}

/**
 * Setea / actualiza el nº físico del contenedor (SDD-0101 · tracking). Se suele
 * cargar post-creación, cuando la naviera confirma el contenedor. Normaliza
 * (mayúsculas, sin espacios); vacío lo limpia a null. RLS filtra por tenant.
 */
export async function setConsolidationContainerNo(
  consolidationId: string,
  containerNoRaw: string,
): Promise<Result> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "naviera");
  if (denial) return { error: denial };

  const containerNo = normalizeContainerNo(containerNoRaw);
  const { error } = await supabase
    .from("consolidations")
    .update({ container_no: containerNo })
    .eq("id", consolidationId);
  if (error) return { error: `No se pudo guardar el contenedor: ${error.message}` };
  revalidate();
  return { ok: true };
}

/** Suma 1 al contador mensual del tracking + guarda el remaining (read-modify-write). */
async function recordTrackingUsage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  period: string,
  remaining: number | null,
): Promise<void> {
  const cur = await getTrackingUsage(supabase, tenantId, period);
  await supabase.from("searates_tracking_usage").upsert(
    {
      tenant_id: tenantId,
      period,
      calls: cur.calls + 1,
      last_remaining: remaining,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,period" },
  );
}

/**
 * Refresca el tracking de un contenedor desde SeaRates (SDD-0101 · Slice B.2).
 * Gasta como máximo **1 llamada**, guardada por la cuota (tope mensual + reserva
 * del plan). Resuelve el número a trackear (container_no, fallback BL) + el SCAC
 * de la naviera, llama al API, cachea el snapshot (o el error) y actualiza el
 * contador. El operador la dispara a mano (nunca por pageview).
 */
export async function refreshTracking(
  consolidationId: string,
): Promise<{ ok?: boolean; error?: string; remaining?: number | null }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "naviera");
  if (denial) return { error: denial };

  const tenantId = await resolveTenant(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  const { data: c } = await supabase
    .from("consolidations")
    .select("id, container_no, sailing_id, booking_id")
    .eq("id", consolidationId)
    .maybeSingle();
  if (!c) return { error: "Contenedor no encontrado." };

  // Número a trackear: nº de contenedor (preferido) o BL del booking. SCAC del
  // carrier del sailing (SeaRates autodetecta si falta).
  let number = normalizeContainerNo(c.container_no as string | null);
  let numberType: "CT" | "BL" = "CT";
  let scac: string | null = null;

  if (c.sailing_id) {
    const { data: s } = await supabase
      .from("sailings")
      .select("carrier_id")
      .eq("id", c.sailing_id as string)
      .maybeSingle();
    if (s?.carrier_id) {
      const { data: car } = await supabase
        .from("carriers")
        .select("scac")
        .eq("id", s.carrier_id as string)
        .maybeSingle();
      scac = (car?.scac as string | null)?.trim() || null;
    }
  }
  if (!number && c.booking_id) {
    const { data: b } = await supabase
      .from("bookings")
      .select("bl_number")
      .eq("id", c.booking_id as string)
      .maybeSingle();
    const bl = (b?.bl_number as string | null)?.trim() || null;
    if (bl) {
      number = bl.toUpperCase();
      numberType = "BL";
    }
  }
  if (!number) {
    return { error: "Carga el nº de contenedor o el BL antes de rastrear." };
  }

  // Guard de cuota ANTES de gastar.
  const period = trackingPeriod(new Date());
  const { monthlyCap, reserve } = trackingQuotaConfig();
  const usage = await getTrackingUsage(supabase, tenantId, period);
  const decision = trackingQuotaDecision({
    callsThisPeriod: usage.calls,
    lastRemaining: usage.lastRemaining,
    monthlyCap,
    reserve,
  });
  if (!decision.allowed) return { error: decision.message ?? "Cuota de tracking agotada." };

  const result = await getContainerTracking({ number, type: numberType, sealine: scac });

  // mock / red caída → NO se consumió llamada; no contamos ni cacheamos.
  if (!result.ok && (result.error === "mock_no_key" || result.error.startsWith("network"))) {
    return {
      error:
        result.error === "mock_no_key"
          ? "Tracking no configurado (falta la API key de SeaRates)."
          : "No se pudo conectar con SeaRates. Reintenta en un momento.",
    };
  }

  // Hubo llamada real (ok o error de proveedor) → cuenta + remaining.
  const remaining = result.remaining ?? null;
  await recordTrackingUsage(supabase, tenantId, period, remaining);

  if (!result.ok) {
    // Error de proveedor (no encontrado, etc.): marca el estado sin pisar un
    // snapshot bueno previo (UPDATE parcial, no upsert).
    await supabase
      .from("tracking_snapshots")
      .update({
        fetch_status: "error",
        error_code: result.code ?? result.error,
        api_remaining: remaining,
        fetched_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("number", number);
    revalidate();
    return { error: `SeaRates: ${result.code ?? result.error}`, remaining };
  }

  const live = result.live;
  const { error: upErr } = await supabase.from("tracking_snapshots").upsert(
    {
      tenant_id: tenantId,
      consolidation_id: consolidationId,
      number,
      number_type: numberType,
      sealine: live.sealine,
      sealine_name: live.sealineName,
      status: live.status,
      vessel: live.vessel,
      pol_date: live.polDate,
      pol_actual: live.polActual,
      pod_eta: live.podEta,
      pod_actual: live.podActual,
      last_lat: live.lastLat,
      last_lng: live.lastLng,
      milestones: live.milestones,
      raw: result.raw ?? null,
      fetch_status: "ok",
      error_code: null,
      api_remaining: live.apiCallsRemaining,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,number" },
  );
  if (upErr) return { error: `No se pudo guardar el tracking: ${upErr.message}`, remaining };

  revalidate();
  return { ok: true, remaining };
}

export async function changeConsolidationStatus(
  consolidationId: string,
  status: ContainerStatus,
): Promise<Result> {
  if (!VALID_CONTAINER_STATUS.has(status)) return { error: "Estado inválido." };
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "naviera");
  if (denial) return { error: denial };

  const { error } = await supabase
    .from("consolidations")
    .update({ status })
    .eq("id", consolidationId);
  if (error) return { error: `No se pudo cambiar el estado: ${error.message}` };

  // SDD-0156 · Slice D: al CERRAR el contenedor (consolidando → cerrado) la carga
  // quedó consolidada → programa el aviso 'consolidated' para sus envíos.
  // Idempotente; best-effort (no rompe el cambio de estado).
  if (status === "cerrado") {
    const tenantId = await resolveTenant(supabase);
    if (tenantId) {
      await scheduleConsolidationEvent(
        createAdminClient(),
        tenantId,
        consolidationId,
        "consolidated",
      );
    }
  }
  revalidate();
  return { ok: true };
}

/** Cerrar contenedor: consolidando → cerrado (atajo de changeConsolidationStatus). */
export async function closeConsolidation(
  consolidationId: string,
): Promise<Result> {
  return changeConsolidationStatus(consolidationId, "cerrado");
}

/** Atar un contenedor a una reserva y/o un itinerario. */
export async function linkConsolidation(
  consolidationId: string,
  link: { bookingId?: string | null; sailingId?: string | null },
): Promise<Result> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "naviera");
  if (denial) return { error: denial };

  const patch: Record<string, unknown> = {};
  if ("bookingId" in link) patch.booking_id = link.bookingId || null;
  if ("sailingId" in link) patch.sailing_id = link.sailingId || null;
  if (Object.keys(patch).length === 0) return { ok: true };
  const { error } = await supabase
    .from("consolidations")
    .update(patch)
    .eq("id", consolidationId);
  if (error) return { error: `No se pudo vincular el contenedor: ${error.message}` };

  // SDD-0156 · Slice D: atar el contenedor a un itinerario que YA tiene ETA
  // también dispara 'eta_set' (cubre el orden "creo el zarpe con ETA y después
  // le cuelgo la consolidación"). Idempotente; best-effort.
  if (link.sailingId) {
    const { data: sailing } = await supabase
      .from("sailings")
      .select("eta")
      .eq("id", link.sailingId)
      .maybeSingle<{ eta: string | null }>();
    if (sailing?.eta) {
      const tenantId = await resolveTenant(supabase);
      if (tenantId) {
        await scheduleConsolidationEvent(
          createAdminClient(),
          tenantId,
          consolidationId,
          "eta_set",
        );
      }
    }
  }
  revalidate();
  return { ok: true };
}

// ── Asignación de carga suelta (guard advisory) ────────────────

/**
 * Asigna una pieza de carga suelta a un contenedor (loose_cargo →
 * consolidation_items). Guard de capacidad ADVISORY: si supera el CBM/kg del
 * tipo, igual asigna pero devuelve `warning` para que la UI lo muestre.
 */
export async function assignLooseCargo(
  consolidationId: string,
  raw: Partial<ConsolidationItemInput>,
): Promise<{ ok?: boolean; error?: string; warning?: string | null }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "naviera");
  if (denial) return { error: denial };


  const { input, fieldErrors } = validateConsolidationItemInput(raw);
  if (fieldErrors) {
    return { error: Object.values(fieldErrors)[0] ?? "Datos de la pieza inválidos." };
  }
  const tenantId = await resolveTenant(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  // Leer el contenedor (tipo) + items actuales para el guard advisory.
  const { data: consRow, error: consErr } = await supabase
    .from("consolidations")
    .select("id, container_type, status")
    .eq("id", consolidationId)
    .maybeSingle<{ id: string; container_type: string | null; status: string }>();
  if (consErr) return { error: `No se pudo leer el contenedor: ${consErr.message}` };
  if (!consRow) return { error: "El contenedor no existe o no es accesible." };
  if (consRow.status !== "consolidando") {
    return { error: "Solo se puede asignar carga a un contenedor en consolidación." };
  }

  const { data: existingRows, error: itemsErr } = await supabase
    .from("consolidation_items")
    .select("cbm, weight_kg, pieces")
    .eq("consolidation_id", consolidationId);
  if (itemsErr) return { error: `No se pudieron leer las piezas: ${itemsErr.message}` };

  const existing: StatItem[] = ((existingRows as Record<string, unknown>[] | null) ?? []).map(
    (r) => ({
      cbm: Number(r.cbm) || 0,
      weight_kg: Number(r.weight_kg) || 0,
      pieces: Number(r.pieces) || 0,
    }),
  );
  const incoming: StatItem = {
    cbm: input!.cbm,
    weight_kg: input!.weightKg,
    pieces: input!.pieces,
  };
  const guard = evaluateCapacity(existing, incoming, consRow.container_type);

  const { error } = await supabase.from("consolidation_items").insert({
    tenant_id: tenantId,
    consolidation_id: consolidationId,
    shipment_id: input!.shipmentId,
    client_markbox: input!.clientMarkbox,
    client_name: input!.clientName,
    supplier_name: input!.supplierName,
    cbm: input!.cbm,
    weight_kg: input!.weightKg,
    pieces: input!.pieces,
  });
  if (error) return { error: `No se pudo asignar la carga: ${error.message}` };

  revalidate();
  return { ok: true, warning: guard.message };
}

/** Quita una pieza asignada (vuelve a carga suelta si tenía shipment_id). */
export async function removeConsolidationItem(itemId: string): Promise<Result> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "naviera");
  if (denial) return { error: denial };

  const { error } = await supabase
    .from("consolidation_items")
    .delete()
    .eq("id", itemId);
  if (error) return { error: `No se pudo quitar la pieza: ${error.message}` };
  revalidate();
  return { ok: true };
}

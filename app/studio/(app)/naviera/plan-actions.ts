/**
 * SDD-0184 · Fase 3 — server action del plan de carga.
 *
 * Calcula el reparto con el motor puro (`lib/shared/estiba-plan.ts`) y lo guarda
 * como una versión nueva. El cálculo corre EN EL SERVIDOR: no viaja ni una línea
 * del motor al navegador, que es la diferencia estructural con EasyCargo (su
 * solver es Unity compilado a WebGL y corre en la máquina del cliente, por eso su
 * API no puede calcular sin abrir la aplicación).
 *
 * VERSIONADO: recalcular NO pisa. Se apaga la versión vigente y se inserta la
 * nueva. Sin eso no se puede responder "¿el operario cargó distinto al plan, o el
 * plan cambió después de que cargó?" — que es lo que la Fase 4 necesita.
 *
 * El flip y el insert no van en una transacción SQL (el cliente de Supabase no
 * las expone). La red de seguridad real es el índice único parcial
 * `consolidation_plans_one_current` de la migración 0298: si dos pedidos corren a
 * la vez, el segundo insert falla con 23505 en vez de dejar dos vigentes.
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial, moduleViewDenial } from "@/lib/studio/rbac-guard";
import { planificarCarga, type EspacioCarga } from "@/lib/shared/estiba-plan";
import {
  ALGORITHM_VERSION,
  listLotesForPlan,
  getCurrentPlan,
} from "@/lib/studio/naviera/plan-queries";
import { parseZoneLayout } from "@/lib/studio/naviera/zones";
import { CONTAINER_TYPES, isContainerTypeCode } from "@/lib/studio/naviera/types";
import { readNormalAssociations, readNormalPlanInput, normalReadMessage } from "@/lib/studio/client-consolidation/queries";
import { normalFlowError } from "@/lib/studio/client-consolidation/normal-flow";

export type PlanActionState = {
  ok?: boolean;
  error?: string;
  /** Versión que quedó vigente tras el cálculo. */
  versionNo?: number;
};

export async function calcularPlanCargaAction(
  consolidationId: string,
  normalReference?: string,
): Promise<PlanActionState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, "naviera");
  if (denial) {
    // An exact historical read cannot become a new calculation after write
    // authority is lost. Ordinary legacy callers keep their existing denial.
    if (!normalReference || await moduleViewDenial(supabase, "naviera")) return { error: denial };
    try {
      const scope = await readNormalAssociations(supabase, { containerIds: [consolidationId] });
      if (!scope.containerIds.length) return { error: denial };
      const historical = await supabase.rpc("client_consolidation_plan_replay", { p_container_id: consolidationId, p_reference: normalReference });
      if (historical.error) return { error: normalFlowError(historical.error) };
      if (historical.data?.outcome === "replay" && historical.data.reference === normalReference
        && Number.isSafeInteger(historical.data.versionNo) && historical.data.versionNo > 0) return { ok: true, versionNo: historical.data.versionNo };
      return { error: denial };
    } catch (error) { return { error: normalReadMessage(error) }; }
  }

  if (!consolidationId) return { error: "Falta el contenedor." };

  try {
    const scope = await readNormalAssociations(supabase, { containerIds: [consolidationId] });
    if (scope.containerIds.length) {
      if (!normalReference || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalReference)) {
        return { error: "Abre el manifiesto por cliente y revisa la carga antes de calcular el plan." };
      }
      const historical = await supabase.rpc("client_consolidation_plan_replay", { p_container_id: consolidationId, p_reference: normalReference });
      if (historical.error) return { error: normalFlowError(historical.error) };
      if (historical.data !== null) {
        if (!historical.data || historical.data.outcome !== "replay" || historical.data.reference !== normalReference
          || !Number.isSafeInteger(historical.data.versionNo) || historical.data.versionNo < 1) return { error: "No se pudo comprobar el plan anterior." };
        return { ok: true, versionNo: historical.data.versionNo };
      }
      const source = await readNormalPlanInput(supabase, consolidationId);
      const plan = planificarCarga(source.input, source.space);
      const { data, error } = await supabase.rpc("client_consolidation_save_plan", {
        p_container_id: consolidationId, p_expected_revision: source.manifestRevision, p_manifest_hash: source.manifestHash,
        p_previous_plan_version: source.previousPlanVersion, p_input: source.input, p_space: source.space, p_result: plan, p_reference: normalReference,
      });
      if (error) {
        // Another invocation of this SAME server-captured request may have
        // committed after the lookup but before this input was read.
        if (error.hint === "dtd-client-normal" && error.message === "NORMAL_INTENT_CONFLICT") {
          const concurrent = await supabase.rpc("client_consolidation_plan_replay", { p_container_id: consolidationId, p_reference: normalReference });
          if (!concurrent.error && concurrent.data?.outcome === "replay" && concurrent.data.reference === normalReference
            && Number.isSafeInteger(concurrent.data.versionNo) && concurrent.data.versionNo > 0) return { ok: true, versionNo: concurrent.data.versionNo };
        }
        return { error: normalFlowError(error) };
      }
      if (!data || !["recorded", "replay"].includes(data.outcome) || data.reference !== normalReference
        || !Number.isSafeInteger(data.versionNo) || data.versionNo < 1) return { error: "No se pudo comprobar el plan guardado. Consulta el estado actual." };
      revalidatePath("/studio/naviera");
      return { ok: true, versionNo: data.versionNo };
    }
  } catch (error) { return { error: normalReadMessage(error) }; }

  // ── 1. El contenedor y su tipo ─────────────────────────────
  const { data: cons, error: consError } = await supabase
    .from("consolidations")
    .select("id, tenant_id, container_type")
    .eq("id", consolidationId)
    .maybeSingle<{ id: string; tenant_id: string; container_type: string | null }>();

  if (consError || !cons) return { error: "No se encontró el contenedor." };

  const code = cons.container_type ?? "";
  if (!isContainerTypeCode(code)) {
    return { error: "El contenedor no tiene un tipo válido asignado." };
  }
  const spec = CONTAINER_TYPES[code];

  // El layout sale del catálogo (cada tipo puede tener el suyo); si la fila viene
  // rara, `parseZoneLayout` cae al default sin reventar.
  const { data: tipo } = await supabase
    .from("container_types")
    .select("zone_layout")
    .eq("code", code)
    .maybeSingle<{ zone_layout: unknown }>();

  const espacio: EspacioCarga = {
    code,
    label: spec.label,
    cbmCapacity: spec.cbm,
    cbmAlertCeiling: spec.alertCeiling,
    layout: parseZoneLayout(tipo?.zone_layout),
  };

  // ── 2. Los lotes ───────────────────────────────────────────
  let lotes;
  try {
    lotes = await listLotesForPlan(supabase, consolidationId);
  } catch {
    return { error: "No se pudo leer la carga del contenedor." };
  }

  if (lotes.length === 0) {
    return {
      error:
        "El contenedor todavía no tiene carga asignada. Asigna al menos un cliente antes de calcular el plan.",
    };
  }

  // ── 3. El reparto (motor puro, determinista) ───────────────
  const plan = planificarCarga(lotes, espacio);

  // ── 4. Versionado ──────────────────────────────────────────
  const vigente = await getCurrentPlan(supabase, consolidationId).catch(() => null);
  const versionNo = (vigente?.version_no ?? 0) + 1;

  if (vigente) {
    const { error } = await supabase
      .from("consolidation_plans")
      .update({ is_current: false })
      .eq("id", vigente.id);
    if (error) return { error: "No se pudo archivar el plan anterior." };
  }

  const { data: userData } = await supabase.auth.getUser();

  const { error: insertError } = await supabase.from("consolidation_plans").insert({
    tenant_id: cons.tenant_id,
    consolidation_id: consolidationId,
    version_no: versionNo,
    is_current: true,
    container_type: code,
    cbm_capacity: espacio.cbmCapacity,
    zone_layout: espacio.layout,
    input: lotes,
    result: plan,
    algorithm_version: ALGORITHM_VERSION,
    created_by: userData?.user?.id ?? null,
  });

  if (insertError) {
    // 23505 = otro pedido calculó el plan al mismo tiempo y ganó la carrera.
    if (insertError.code === "23505") {
      return {
        error:
          "Alguien más calculó el plan al mismo tiempo. Recarga la pantalla para ver el vigente.",
      };
    }
    return { error: "No se pudo guardar el plan de carga." };
  }

  revalidatePath("/studio/naviera");
  return { ok: true, versionNo };
}

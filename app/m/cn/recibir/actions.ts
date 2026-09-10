"use server";

/**
 * SDD-0154 · Recepción por escaneo (operario CN).
 *
 * Dos pasos:
 *  1. `lookupForReceptionAction(code)` · SOLO LECTURA. Escaneó una etiqueta
 *     pre-declarada (DTD-B) → dice de quién es, qué compra y cuántas cajas se
 *     anunciaron. Es el "¿esta mercancía es de tal cliente, quieres recibir?".
 *  2. `receivePrealertaAction(code, boxesConfirmed)` · muta vía RPC
 *     `receive_prealerta_as_operario` (0245, SECURITY DEFINER + service_role):
 *     crea la recepción y adopta las cajas por la cantidad rectificada.
 *
 * El operario no es `auth.users` → admin client con tenant explícito, igual que
 * app/m/cn/estibar/actions.ts. RLS no aplica en esta ruta.
 */

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/db/admin";
import { getCurrentOperario } from "@/lib/auth/operario-session";
import { isBoxCode } from "@/lib/studio/etiquetas-qr";
import {
  notaSinAviso,
  scheduleReceiptInWarehouse,
} from "@/lib/studio/notifications/schedule-fanout";

async function requireCnOperario() {
  const session = await getCurrentOperario();
  if (!session) return { error: "Sesión inválida · ingresa de nuevo." as const };
  if (session.region !== "cn") {
    return { error: "Solo operarios de China reciben acá." as const };
  }
  return { session };
}

// ─────────────────────────────────────────────────────────────
// Paso 1 · lookup (read-only): ¿de quién es esta etiqueta?
// ─────────────────────────────────────────────────────────────

export type ReceptionLookup = {
  found: true;
  alreadyReceived: boolean;
  boxCode: string;
  prealertaCode: string;
  clientMarkbox: string;
  clientName: string | null;
  supplierName: string | null;
  pendingCodes: string[];
  services: { code: string; status: string }[];
  expected: number; // cuántas esperadas siguen sin recibir en esa compra
};

export type ReceptionLookupState =
  | ReceptionLookup
  | { found: false; error: string };

export async function lookupForReceptionAction(
  code: string,
): Promise<ReceptionLookupState> {
  const auth = await requireCnOperario();
  if ("error" in auth) {
    return { found: false, error: auth.error ?? "Sesión inválida." };
  }

  const trimmed = code.trim().toUpperCase();
  if (!isBoxCode(trimmed)) {
    return {
      found: false,
      error:
        "Esa no es una etiqueta DTD de caja. Escanea la etiqueta con el código DTD-B.",
    };
  }

  const admin = createAdminClient();

  const { data: box } = await admin
    .from("warehouse_boxes")
    .select("code, status, prealerta_id")
    .eq("tenant_id", auth.session.tenant_id)
    .eq("code", trimmed)
    .is("deleted_at", null)
    .maybeSingle<{
      code: string;
      status: string;
      prealerta_id: string | null;
    }>();

  if (!box) {
    return {
      found: false,
      error: `La caja ${trimmed} no existe. ¿Es una etiqueta de otra compra?`,
    };
  }
  if (!box.prealerta_id) {
    return {
      found: false,
      error: `La caja ${trimmed} no viene de una compra anunciada.`,
    };
  }

  const { data: pre } = await admin
    .from("prealertas")
    .select("code, client_markbox, supplier_id, status")
    .eq("id", box.prealerta_id)
    .is("deleted_at", null)
    .maybeSingle<{
      code: string;
      client_markbox: string;
      supplier_id: string | null;
      status: string;
    }>();

  if (!pre || pre.status === "cancelada") {
    return {
      found: false,
      error: `La compra de la caja ${trimmed} no está activa.`,
    };
  }

  // El nombre real del cliente no se consulta: China opera sólo con Shipping Mark.
  const { data: supplier } = pre.supplier_id
    ? await admin
        .from("suppliers_cn")
        .select("name")
        .eq("id", pre.supplier_id)
        .maybeSingle<{ name: string }>()
    : { data: null };

  // Cuántas esperadas siguen sin recibir en esa compra.
  const [{ data: pending, count: pendingCount, error: pendingError }, { data: services, error: servicesError }] = await Promise.all([
    admin.from("warehouse_boxes").select("code", { count: "exact" }).eq("tenant_id", auth.session.tenant_id)
      .eq("prealerta_id", box.prealerta_id).eq("status", "esperada").is("receipt_id", null).is("deleted_at", null).order("seq").limit(1000),
    admin.from("prealerta_service_requests").select("addon_code,status").eq("tenant_id", auth.session.tenant_id)
      .eq("prealerta_id", box.prealerta_id).in("status", ["solicitada", "en_proceso"]).is("deleted_at", null),
  ]);
  if (pendingError || servicesError) return { found: false, error: "No se pudieron consultar las cajas y servicios. Intenta otra vez." };

  if ((pendingCount ?? 0) > (pending?.length ?? 0)) return { found: false, error: "Este lote supera 1000 cajas. Solicita recepción asistida al equipo de operaciones." };
  return {
    found: true,
    alreadyReceived: box.status === "recibida",
    boxCode: box.code,
    prealertaCode: pre.code,
    clientMarkbox: pre.client_markbox,
    // PRIVACIDAD (hallazgo H-7): solo Shipping Mark, nunca el nombre real.
    clientName: null,
    supplierName: supplier?.name ?? null,
    pendingCodes: (pending ?? []).map(b => b.code as string),
    expected: pending?.length ?? 0,
    services: (services ?? []).map(s => ({ code: s.addon_code as string, status: s.status as string })),
  };
}

// ─────────────────────────────────────────────────────────────
// Paso 2 · recibir (muta vía RPC)
// ─────────────────────────────────────────────────────────────

export type ReceiveState = {
  ok?: boolean;
  error?: string;
  receiptCode?: string;
  prealertaCode?: string;
  clientName?: string | null;
  clientMarkbox?: string;
  received?: number;
  remaining?: number;
};

export async function receivePrealertaAction(
  code: string,
  boxCodes: string[],
): Promise<ReceiveState> {
  const auth = await requireCnOperario();
  if ("error" in auth) return { error: auth.error };

  const trimmed = code.trim().toUpperCase();
  if (!isBoxCode(trimmed)) {
    return { error: "Código de caja inválido." };
  }
  if (!Array.isArray(boxCodes) || boxCodes.length < 1 || boxCodes.length > 5000 ||
      boxCodes.some(code => typeof code !== "string" || !isBoxCode(code))) {
    return { error: "Selecciona las cajas presentes." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("receive_prealerta_boxes_as_operario", {
    p_operario_id: auth.session.operario_id,
    p_code: trimmed,
    p_box_codes: boxCodes,
  });

  if (error) {
    return { error: humanizeReceiveError(error.code + " " + error.message) };
  }

  const res = (data ?? {}) as {
    receipt_id?: string;
    receipt_code?: string;
    prealerta_code?: string;
    client_name?: string | null;
    client_markbox?: string;
    received?: number;
    remaining?: number;
  };

  // SDD-0162 · aviso al cliente "Recibido en bodega China" (status:in_warehouse).
  // Best-effort fire-and-forget (mismo patrón que scheduleReceiptVeReceived en
  // warehouse-receipt-ve-queries.ts): no bloquea la respuesta del operario y un
  // fallo del fan-out no rompe la recepción ya confirmada por el RPC.
  //
  // SDD-0282 · si el cliente no tiene envío abierto, el aviso no se puede colgar
  // (`client_notification_schedule.shipment_id` es not null) y antes eso se
  // perdía en silencio. Ahora queda asentado en la bitácora de la recepción:
  // la oficina lo ve y decide si le escribe a mano.
  // SDD-0283 · se pasa también la COMPRA: si el cliente todavía no tiene envío
  // abierto (el caso normal en una primera compra), el aviso cuelga de ella.
  // El RPC devuelve el código de la compra pero no su id — se resuelve acá.
  void (async () => {
    const { data: pre } = res.prealerta_code
      ? await admin
          .from("prealertas")
          .select("id")
          .eq("tenant_id", auth.session.tenant_id)
          .eq("code", res.prealerta_code)
          .is("deleted_at", null)
          .maybeSingle<{ id: string }>()
      : { data: null };

    return scheduleReceiptInWarehouse(admin, auth.session.tenant_id, [
      {
        markbox: res.client_markbox,
        prealertaId: pre?.id ?? null,
        prealertaCode: res.prealerta_code ?? null,
      },
    ]);
  })()
    .then(async (r) => {
      const nota = notaSinAviso(r.sinDestino);
      if (!nota || !res.receipt_id) return;
      await admin.from("warehouse_receipt_events").insert({
        tenant_id: auth.session.tenant_id,
        receipt_id: res.receipt_id,
        event_type: "note",
        description: nota,
      });
    })
    .catch((err) => {
      console.error("[recibir] scheduleReceiptInWarehouse falló:", err);
    });

  // El Studio web refresca KPIs + listado; el home del operario, sus recientes.
  revalidatePath("/studio/cn");
  revalidatePath("/m/cn");

  return {
    ok: true,
    receiptCode: res.receipt_code,
    prealertaCode: res.prealerta_code,
    clientName: null, // privacidad · hallazgo H-7
    clientMarkbox: res.client_markbox,
    received: res.received,
    remaining: res.remaining,
  };
}

function humanizeReceiveError(msg: string): string {
  if (msg.includes("P0001")) return "Operario no encontrado.";
  if (msg.includes("P0002")) return "Operario inactivo.";
  if (msg.includes("P0003")) return "Solo operarios de China reciben acá.";
  if (msg.includes("P0135")) return "No tienes un almacén asignado.";
  if (msg.includes("P0130"))
    return "Esa caja no existe · revisa la etiqueta.";
  if (msg.includes("P0131")) return "Esa caja ya se había recibido.";
  if (msg.includes("P0132"))
    return "Esa etiqueta no viene de una compra anunciada.";
  if (msg.includes("P0133")) return "La compra de esa caja no está activa.";
  if (msg.includes("P0136")) return "Selecciona las cajas presentes, incluida la escaneada.";
  if (msg.includes("P0137")) return "Las cajas cambiaron o ya fueron recibidas. Escanea de nuevo para actualizar.";
  if (msg.includes("P0134")) return "No hay cajas para recibir en esa compra.";
  return "No se pudo recibir. Intenta de nuevo.";
}

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
  const { count: expected } = await admin
    .from("warehouse_boxes")
    .select("id", { count: "exact", head: true })
    .eq("prealerta_id", box.prealerta_id)
    .eq("status", "esperada")
    .is("receipt_id", null)
    .is("deleted_at", null);

  return {
    found: true,
    alreadyReceived: box.status === "recibida",
    boxCode: box.code,
    prealertaCode: pre.code,
    clientMarkbox: pre.client_markbox,
    // PRIVACIDAD (hallazgo H-7): solo Shipping Mark, nunca el nombre real.
    clientName: null,
    supplierName: supplier?.name ?? null,
    expected: expected ?? 0,
  };
}

// ─────────────────────────────────────────────────────────────
// Paso 2 · recibir (muta vía RPC)
// ─────────────────────────────────────────────────────────────

export type ReceiveState = {
  ok?: boolean;
  error?: string;
  failureKind?: "permanent" | "transient";
  receiptCode?: string;
  prealertaCode?: string;
  clientName?: string | null;
  clientMarkbox?: string;
  received?: number;
  remaining?: number;
};

export async function receivePrealertaAction(
  code: string,
  boxesConfirmed: number | null,
): Promise<ReceiveState> {
  const auth = await requireCnOperario();
  if ("error" in auth) return { error: auth.error };

  const trimmed = code.trim().toUpperCase();
  if (!isBoxCode(trimmed)) {
    return { error: "Código de caja inválido." };
  }
  // El conteo rectificado, si vino, tiene que ser un entero ≥ 1.
  let confirmed: number | null = null;
  if (boxesConfirmed != null) {
    if (!Number.isInteger(boxesConfirmed) || boxesConfirmed < 1) {
      return { error: "La cantidad tiene que ser un número entero de 1 o más." };
    }
    confirmed = boxesConfirmed;
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("receive_prealerta_as_operario", {
    p_operario_id: auth.session.operario_id,
    p_code: trimmed,
    p_boxes_confirmed: confirmed,
  });

  if (error) {
    return humanizeReceiveError(error);
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

function humanizeReceiveError(error: {
  code?: string | null;
  message?: string | null;
}): Pick<ReceiveState, "error" | "failureKind"> {
  const hasCode = (code: string) =>
    error.code === code || Boolean(error.message?.includes(code));

  // PostgREST no encontró la RPC en el schema cache: ningún reintento del
  // operario puede reparar un contrato de servidor/base ausente.
  if (hasCode("PGRST202")) {
    return {
      error:
        "La recepción no está disponible. Avisa al responsable; no la intentes de nuevo.",
      failureKind: "permanent",
    };
  }

  if (hasCode("P0001")) return { error: "Operario no encontrado." };
  if (hasCode("P0002")) return { error: "Operario inactivo." };
  if (hasCode("P0003"))
    return { error: "Solo operarios de China reciben acá." };
  if (hasCode("P0135")) return { error: "No tienes un almacén asignado." };
  if (hasCode("P0130"))
    return { error: "Esa caja no existe · revisa la etiqueta." };
  if (hasCode("P0131"))
    return { error: "Esa caja ya se había recibido." };
  if (hasCode("P0132"))
    return { error: "Esa etiqueta no viene de una compra anunciada." };
  if (hasCode("P0133"))
    return { error: "La compra de esa caja no está activa." };
  if (hasCode("P0134"))
    return { error: "No hay cajas para recibir en esa compra." };

  return {
    error: "No se pudo recibir por un problema temporal. Intenta de nuevo.",
    failureKind: "transient",
  };
}

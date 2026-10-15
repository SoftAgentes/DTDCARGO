/**
 * SDD-0524 · Vincular una recepción de Yiwu a su compra y avisarle al cliente.
 *
 * La recepción manual del móvil (`/m/cn/nueva`, RPC `create_receipt_as_operario`
 * de la 0045) no avisaba a nadie y nunca vinculaba: la mercancía que el equipo de
 * China registraba a mano llegaba a la bodega en silencio, y en el Portal la
 * compra seguía diciendo que no había llegado. Este módulo le da a ese camino lo
 * mismo que ya hace el Studio de escritorio (`app/studio/(app)/cn/actions.ts`,
 * `createReceiptAction`):
 *
 *   1. **Vínculo operativo** (SDD-0284): si el Shipping Mark tiene EXACTAMENTE
 *      una compra viva en `anunciada` o `en_camino`, la recepción queda atada a
 *      ella (`prealerta_id`). Con dos o más no se elige: atar la equivocada le
 *      mostraría al cliente que llegó algo que no llegó.
 *   2. **Vínculo financiero**, con la regla estricta de siempre: la orden de
 *      venta de esa compra (`sales_order_id`) sólo si existe y la compra no está
 *      facturada. Aflojar el operativo no factura de más: el RPC
 *      `sales_order_claim_and_invoice` (0128) ignora la compra sin OV.
 *   3. **Aviso** `status:in_warehouse` con `scheduleReceiptInWarehouse`, la
 *      misma función de los otros dos caminos. Si quedó vinculada, cuelga de la
 *      compra; si no, del envío abierto o de ninguno.
 *   4. **Nota en la bitácora** de la recepción si el cliente se quedó sin aviso,
 *      con el motivo (`notaSinAvisoBodega`).
 *
 * **Sin migración, a propósito.** El RPC ya devuelve `receipt_id`; el vínculo
 * se escribe después, desde el servidor, con el cliente admin y el tenant de la
 * sesión del operario como filtro explícito (`eq tenant_id`), igual que el
 * escritorio lo escribe después de su INSERT. No es atómico con la recepción en
 * ninguno de los dos caminos: si el vínculo falla, la recepción queda como
 * antes (sin compra) y el aviso usa el envío o deja la nota.
 *
 * Una recepción huérfana no llega aquí: todavía no se sabe de quién es.
 *
 * Best-effort: nunca lanza. Un fallo acá no invalida una recepción ya escrita.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  notaSinAvisoBodega,
  scheduleReceiptInWarehouse,
  type FanoutBodega,
} from "./schedule-fanout";

/** Estados en los que una compra todavía espera mercancía (regla del Studio). */
export const ESTADOS_COMPRA_ABIERTA = ["anunciada", "en_camino"] as const;

export interface CompraVinculada {
  id: string;
  code: string;
}

export interface ResultadoRecepcionCn {
  /** La compra a la que quedó vinculada la recepción, o `null`. */
  compra: CompraVinculada | null;
  /** Lo que pasó con el aviso. */
  aviso: FanoutBodega;
  /** La nota que se dejó en la bitácora, si el cliente se quedó sin aviso. */
  nota: string | null;
}

interface Candidata {
  id: string;
  code: string;
  sales_order_id: string | null;
  invoice_id: string | null;
}

/**
 * La compra de esta mercancía, sólo si es inequívoca. `limit(2)` basta para
 * distinguir «una» de «más de una». Cualquier error → `null` (no se adivina).
 */
async function compraUnicaAbierta(
  admin: SupabaseClient,
  tenantId: string,
  markbox: string,
): Promise<Candidata | null> {
  const { data, error } = await admin
    .from("prealertas")
    .select("id, code, sales_order_id, invoice_id")
    .eq("tenant_id", tenantId)
    .eq("client_markbox", markbox)
    .in("status", [...ESTADOS_COMPRA_ABIERTA])
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(2);
  if (error) return null;
  const lista = (data as Candidata[] | null) ?? [];
  return lista.length === 1 ? lista[0] : null;
}

export async function vincularYAvisarRecepcionCn(
  admin: SupabaseClient,
  args: { tenantId: string; receiptId: string; markbox: string | null | undefined },
): Promise<ResultadoRecepcionCn> {
  const markbox = (args.markbox ?? "").trim();
  const resultado: ResultadoRecepcionCn = {
    compra: null,
    aviso: { scheduled: 0, sinDestino: [], detalle: [] },
    nota: null,
  };
  if (!markbox || !args.receiptId) return resultado;

  // ── 1-2 · Vínculo ──
  try {
    const candidata = await compraUnicaAbierta(admin, args.tenantId, markbox);
    if (candidata) {
      const patch: { prealerta_id: string; sales_order_id?: string } = {
        prealerta_id: candidata.id,
      };
      if (candidata.sales_order_id && !candidata.invoice_id) {
        patch.sales_order_id = candidata.sales_order_id;
      }
      // `select` + `maybeSingle`: sólo cuenta como vinculada si la fila de ESTE
      // tenant se actualizó de verdad.
      const { data: actualizada, error } = await admin
        .from("warehouse_receipts_cn")
        .update(patch)
        .eq("id", args.receiptId)
        .eq("tenant_id", args.tenantId)
        .select("id")
        .maybeSingle<{ id: string }>();
      if (!error && actualizada) {
        resultado.compra = { id: candidata.id, code: candidata.code };
      }
    }
  } catch (err) {
    console.error("[recepcion-cn] no se pudo vincular la recepción a su compra:", err);
  }

  // ── 3 · Aviso ── (cuelga de la compra sólo si la recepción quedó vinculada)
  resultado.aviso = await scheduleReceiptInWarehouse(admin, args.tenantId, [
    {
      markbox,
      prealertaId: resultado.compra?.id ?? null,
      prealertaCode: resultado.compra?.code ?? null,
    },
  ]);

  // ── 4 · Nota si el cliente se quedó sin aviso ──
  const nota = notaSinAvisoBodega(resultado.aviso);
  if (nota) {
    try {
      const { error } = await admin.from("warehouse_receipt_events").insert({
        tenant_id: args.tenantId,
        receipt_id: args.receiptId,
        event_type: "note",
        description: nota,
      });
      if (!error) resultado.nota = nota;
      else console.error("[recepcion-cn] no se pudo anotar el aviso faltante:", error.message);
    } catch (err) {
      console.error("[recepcion-cn] no se pudo anotar el aviso faltante:", err);
    }
  }

  return resultado;
}

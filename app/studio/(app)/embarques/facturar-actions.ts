/**
 * SDD-0674 · EXC-0674 — Server action del botón «Facturar» en Embarques.
 *
 * Factura un cliente del contenedor, o todos los clientes a la vez (modo contenedor completo), con
 * la RPC `exc0674_facturar` (migr 0564). La RPC hace todo o nada en una transacción: correlativo,
 * factura emitida en USD, asiento y rastro. Antes de llamarla se comprueba el rol (accounting o
 * admin; Sam, 2026-11-18: operaciones no factura) y se parsea cada monto. La base vuelve a comprobarlo todo.
 *
 * Después, como `emitInvoice`, avisa por correo cada factura emitida según las reglas de Mailing
 * (best-effort: si el correo falla, la factura ya se emitió).
 *
 * Excepción con nombre: estas facturas NO pasan por el gate legal AUT-04 de la app. Lo decidió Sam
 * el 2026-11-18 y queda como `legal_ack = 'exc_0674'` en `exc0674_facturas` (spec §3.1 a).
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { getStudioAccess } from "@/lib/studio/rbac-guard";
import { fireMailEvent } from "@/lib/studio/mail/mail-rule-engine";
import { varsDeFacturaEmitida } from "@/lib/studio/invoice-mail-vars";
import {
  claveMarkbox,
  mensajeErrorExc0674,
  parsearMontoUsd,
  rolFacturaExc0674,
} from "@/lib/studio/exc0674";

export type MontoAFacturar = { clientMarkbox: string; total: string };

export type ResultadoFacturarExc0674 =
  | { ok: true; facturas: { clientMarkbox: string; invoiceCode: string; totalUsd: number }[] }
  | { ok: false; error: string };

type FacturaDeRpc = {
  client_markbox: string;
  invoice_id: string;
  invoice_code: string;
  billed_markbox: string;
  billed_name: string | null;
  shipment_code: string | null;
  issued_at: string;
  due_date: string;
  total_usd: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function facturarExc0674Action(
  consolidationId: string,
  montos: MontoAFacturar[],
  confirmacion: string,
): Promise<ResultadoFacturarExc0674> {
  const supabase = await createClient();
  const { role, tenantId } = await getStudioAccess(supabase);
  if (!rolFacturaExc0674(role) || !tenantId) {
    return { ok: false, error: "Tu rol no puede facturar desde Embarques." };
  }
  if (confirmacion !== "Confirmado") {
    return { ok: false, error: "Falta la confirmación. No se emitió ninguna factura." };
  }
  if (typeof consolidationId !== "string" || !UUID.test(consolidationId)) {
    return { ok: false, error: "No se reconoce el contenedor." };
  }
  if (!Array.isArray(montos) || montos.length === 0 || montos.length > 500) {
    return { ok: false, error: "No hay clientes para facturar." };
  }

  const vistos = new Set<string>();
  const pMontos: { client_markbox: string; total_usd: number }[] = [];
  for (const m of montos) {
    const mb = claveMarkbox(m?.clientMarkbox);
    if (!mb || vistos.has(mb)) return { ok: false, error: "La lista de clientes no es válida." };
    vistos.add(mb);
    const p = parsearMontoUsd(String(m?.total ?? ""));
    if (!p.ok) return { ok: false, error: `${mb}: ${p.error}` };
    pMontos.push({ client_markbox: mb, total_usd: p.centavos / 100 });
  }

  const { data, error } = await supabase.rpc("exc0674_facturar", {
    p_consolidation_id: consolidationId,
    p_montos: pMontos,
    p_confirmacion: "Confirmado",
  });
  if (error) return { ok: false, error: mensajeErrorExc0674(error.message) };

  const facturas = (((data ?? {}) as { facturas?: FacturaDeRpc[] }).facturas ?? []);

  // Correo de factura emitida, igual que emitInvoice (SDD-0305). Best-effort.
  try {
    const admin = createAdminClient();
    for (const f of facturas) {
      await fireMailEvent(admin, tenantId, {
        event: "invoice_emitted",
        vars: varsDeFacturaEmitida(
          {
            invoice_code: f.invoice_code,
            client_markbox: f.billed_markbox,
            client_name: f.billed_name,
            shipment_code: f.shipment_code,
            currency: "USD",
            fx_rate: null,
            total_amount: Number(f.total_usd),
            due_date: f.due_date,
          },
          f.issued_at,
          f.due_date,
        ),
        clientMarkbox: f.billed_markbox,
        clientName: f.billed_name ?? "",
        sourceRef: { kind: "invoice", id: f.invoice_id },
      });
    }
  } catch (e) {
    console.error("[exc0674] fireMailEvent falló:", e);
  }

  revalidatePath("/studio/embarques");
  revalidatePath("/studio/facturacion");
  return {
    ok: true,
    facturas: facturas.map((f) => ({
      clientMarkbox: f.client_markbox,
      invoiceCode: f.invoice_code,
      totalUsd: Number(f.total_usd),
    })),
  };
}

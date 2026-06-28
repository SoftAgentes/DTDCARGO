/**
 * SDD-0117 Slice A · GET /m/emp/recibo/[period]/pdf
 *
 * Devuelve el recibo de pago del empleado autenticado como PDF real
 * (@react-pdf/renderer, server-side). Reemplaza el window.print() de ReciboTab.
 *
 * Seguridad: NO recibe employee_id por param. getMyPayslip usa el RPC
 * get_my_payslip (SECURITY DEFINER, fail-closed: resuelve auth.uid()→empleado,
 * solo cortes confirmado/pagado). Un período ajeno o en borrador → 404 (no
 * filtra existencia ni PII). Cache-Control private/no-store: el PDF lleva
 * sueldo + PII, nunca se cachea.
 */

import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createClient } from "@/lib/db/server";
import { getMyPayslip } from "@/lib/studio/nomina/employee-self-queries";
import { ReciboDocument } from "@/lib/studio/pdf/recibo-pdf";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ period: string }> },
) {
  const { period } = await params;
  const periodLabel = decodeURIComponent(period);
  const supabase = await createClient();

  const payslip = await getMyPayslip(supabase, periodLabel || null);
  if (!payslip) {
    return new Response("Recibo no encontrado.", { status: 404 });
  }

  const doc = createElement(ReciboDocument, { payslip }) as ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(doc);

  // filename = período decodificado y saneado (sin chars raros en el nombre sugerido).
  const safePeriod = periodLabel.replace(/[^A-Za-z0-9_-]/g, "");
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="recibo-${safePeriod}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

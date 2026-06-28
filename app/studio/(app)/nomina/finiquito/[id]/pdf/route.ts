/**
 * SDD-0117 Slice B · GET /studio/nomina/finiquito/[id]/pdf
 *
 * Finiquito (liquidación LOTTT) del empleado como PDF real (@react-pdf/renderer).
 *
 * Seguridad doble: la ruta vive bajo /studio (proxy exige sesión Studio) Y
 * getSettlement usa el cliente autenticado → la RLS de nomina_settlements acota
 * por tenant + rol (nomina_can_access · admin/accounting). Un id ajeno o de un
 * usuario sin el rol → null → 404. private/no-store: lleva money + PII.
 */

import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createClient } from "@/lib/db/server";
import { getSettlement, listSettlementLines } from "@/lib/studio/nomina/settlement-queries";
import { FiniquitoDocument } from "@/lib/studio/pdf/finiquito-pdf";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const settlement = await getSettlement(supabase, id);
  if (!settlement) {
    return new Response("Finiquito no encontrado.", { status: 404 });
  }
  const lines = await listSettlementLines(supabase, id);

  const doc = createElement(FiniquitoDocument, { settlement, lines }) as ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(doc);

  const safeCode = settlement.settlement_code.replace(/[^A-Za-z0-9_-]/g, "");
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="finiquito-${safeCode}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

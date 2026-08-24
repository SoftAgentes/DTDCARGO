/**
 * SDD-0287 · GET /studio/clientes/[markbox]/estado-de-cuenta/pdf
 *
 * El mismo estado de cuenta que la pantalla, en papel. Es lo que el asesor manda
 * cuando el cliente pregunta "¿cuánto debo?".
 *
 * Reusa `filasParaLedger` de la propia página: ese mapeo es el que descarta
 * borradores y anuladas, y duplicarlo acá sería abrir la puerta a que el papel y
 * la pantalla difieran en qué cuenta como deuda.
 *
 * Seguridad: la ruta vive bajo `/studio` (el proxy ya exigió sesión) y además
 * gatea el módulo `invoices` con el rol; las facturas salen por `listInvoices`
 * con el cliente autenticado, así que la RLS acota por tenant. Un markbox ajeno
 * o inexistente → 404, sin distinguir entre los dos casos.
 */

import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { createClient } from "@/lib/db/server";
import { getStudioAccess } from "@/lib/studio/rbac-guard";
import { canAccessModule } from "@/lib/studio/rbac";
import { getClientByMarkbox } from "@/lib/studio/client-queries";
import { listInvoices } from "@/lib/studio/invoice-queries";
import { getCompanyData } from "@/lib/studio/company-queries";
import { buildStatementLedger } from "@/lib/portal/statement-ledger";
import { EstadoDeCuentaDocument } from "@/lib/studio/pdf/estado-de-cuenta-pdf";
import { noEncontrado, nombreSeguro, respuestaPdf } from "@/lib/studio/pdf/pdf-response";
import { filasParaLedger } from "../page";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ markbox: string }> },
) {
  const { markbox: raw } = await params;
  const markbox = decodeURIComponent(raw);

  const supabase = await createClient();

  const { role, overrides } = await getStudioAccess(supabase);
  if (!canAccessModule(role, "invoices", overrides)) {
    return noEncontrado("Estado de cuenta");
  }

  const client = await getClientByMarkbox(supabase, markbox);
  if (!client) return noEncontrado("Estado de cuenta");

  const invoices = await listInvoices(supabase, { clientMarkbox: markbox });
  const ledger = buildStatementLedger(filasParaLedger(invoices));

  const company = await getCompanyData(supabase).catch(() => null);

  const doc = createElement(EstadoDeCuentaDocument, {
    input: {
      clientName: client.name,
      markbox: client.markbox,
      ledger,
      emitidoEl: new Date().toISOString().slice(0, 10),
    },
    emisor: company
      ? {
          tradeName: company.identity.tradeName,
          email: company.identity.commercialEmail,
          phone: company.identity.phone,
          website: company.identity.website,
        }
      : undefined,
  }) as ReactElement<DocumentProps>;

  return respuestaPdf(doc, {
    nombreArchivo: `estado-de-cuenta-${nombreSeguro(client.markbox)}.pdf`,
  });
}

/**
 * SDD-0287 · GET /portal/facturas/estado-de-cuenta/pdf
 *
 * El cliente se lleva SU estado de cuenta. Es el documento que le pasa a su
 * contador; hasta ahora sólo existía como tabla en pantalla (SDD-0177).
 *
 * ⚠️ **Un route handler NO ejecuta el layout `(app)`.** El gate de sesión del
 * portal vive ahí, así que acá no protege nada. Protegen `getPortalClient`, que
 * corta sin principal Portal vivo y coherente, y `listMyInvoices`, que resuelve
 * ese principal y filtra por su tenant + Shipping Mark + `neq borrador`
 * (SDD-0462). Sin sesión de portal responde 404 antes de consultar facturas.
 * Fail-closed por construcción, no por el layout.
 *
 * No hay parámetro de cliente **a propósito**: la cuenta es la del que está
 * logueado y no hay forma de pedir la de otro. Un `[markbox]` en la URL sería
 * una superficie que habría que defender; no tenerlo es no tener que hacerlo.
 *
 * Sale como `attachment`: el cliente entra acá para guardar el archivo, no para
 * leerlo — la tabla ya la tiene en `/portal/facturas?vista=estado`.
 */

import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { createClient } from "@/lib/db/server";
import { listMyInvoices, getPortalClient } from "@/lib/portal/portal-queries";
import { buildStatementLedger } from "@/lib/portal/statement-ledger";
import { getCompanyData } from "@/lib/studio/company-queries";
import { EstadoDeCuentaDocument } from "@/lib/studio/pdf/estado-de-cuenta-pdf";
import { noEncontrado, nombreSeguro, respuestaPdf } from "@/lib/studio/pdf/pdf-response";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();

  const client = await getPortalClient(supabase);
  if (!client) return noEncontrado("Estado de cuenta");

  // `listMyInvoices` ya excluye borradores en la query. Las anuladas SÍ llegan,
  // y el ledger las trata como cargo — es el mismo comportamiento que la tabla
  // del portal (SDD-0177), así que el papel y la pantalla dicen lo mismo.
  // Cambiarlo acá los separaría, que es justo lo que este documento evita.
  const invoices = await listMyInvoices(supabase);
  const ledger = buildStatementLedger(invoices);

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
    disposicion: "attachment",
  });
}

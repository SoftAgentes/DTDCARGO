/**
 * SDD-0281 · GET /studio/facturacion/[code]/pdf — la factura en papel.
 *
 * Tres candados, en este orden:
 *  1. La ruta vive bajo `/studio` → el proxy ya exigió sesión del Studio.
 *  2. RBAC del módulo `invoices`: un rol sin acceso a Facturación no saca la
 *     factura por la puerta de atrás. El guard es propio y NO `requireModuleView`
 *     porque aquel hace `redirect()`, y una descarga que responde 307 a un
 *     dashboard es peor que un 404 limpio.
 *  3. RLS: `getInvoiceByCode` usa el cliente autenticado → una factura de otro
 *     tenant no existe para esta consulta.
 *
 * Y un candado de negocio: **un borrador no tiene PDF**. Emitir el papel es un
 * acto comercial; mientras la factura no esté emitida no debe poder salir del
 * ERP, ni siquiera "para revisar" — es exactamente así como un borrador termina
 * en el WhatsApp de un cliente.
 */

import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { createClient } from "@/lib/db/server";
import { getStudioAccess } from "@/lib/studio/rbac-guard";
import { canAccessModule } from "@/lib/studio/rbac";
import { getInvoiceByCode } from "@/lib/studio/invoice-queries";
import { getCompanyData } from "@/lib/studio/company-queries";
import { FacturaDocument } from "@/lib/studio/pdf/factura-pdf";
import { noEncontrado, nombreSeguro, respuestaPdf } from "@/lib/studio/pdf/pdf-response";
import { domicilioFiscalSellado } from "@/lib/studio/invoice-client-doc";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code: raw } = await params;
  const code = decodeURIComponent(raw);

  const supabase = await createClient();

  const { role, overrides, grants } = await getStudioAccess(supabase);
  if (!canAccessModule(role, "invoices", overrides, grants)) return noEncontrado("Factura");

  const inv = await getInvoiceByCode(supabase, code);
  if (!inv) return noEncontrado("Factura");
  if (inv.status === "borrador") {
    return new Response(
      "Esta factura está en borrador: emítela antes de generar el PDF.",
      { status: 409, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  // Los datos de la empresa son decorado del pie: si el tenant no los cargó, la
  // factura sale igual. Un fallo acá no puede tumbar el documento.
  const company = await getCompanyData(supabase).catch(() => null);
  // SDD-0487: domicilio fiscal sellado; sin 0466 no hay columna y sale sin él.
  const fiscalAddress = await domicilioFiscalSellado(supabase, inv.id);

  const doc = createElement(FacturaDocument, {
    invoice: {
      code: inv.invoice_code,
      clientName: inv.client_name,
      clientRif: inv.client_rif,
      clientDocKind: inv.client_doc_kind,
      clientFiscalAddress: fiscalAddress,
      clientMarkbox: inv.client_markbox,
      shipmentCode: inv.shipment_code,
      currency: inv.currency,
      fxRate: inv.fx_rate,
      ivaRate: inv.iva_rate,
      base: inv.base_amount,
      ivaAmount: inv.iva_amount,
      total: inv.total_amount,
      paid: inv.paid_amount,
      status: inv.status,
      issuedAt: inv.issued_at,
      dueDate: inv.due_date,
      lines: inv.lines,
      notes: inv.notes,
    },
    emisor: company
      ? {
          tradeName: company.identity.tradeName,
          // SDD-0297: la razón social y el RIF ya venían en `getCompanyData`;
          // esta ruta los leía y los tiraba. Sin ellos el PDF no le sirve al
          // contador del cliente.
          legalName: company.identity.legalName,
          rif: company.identity.rif,
          email: company.identity.commercialEmail,
          phone: company.identity.phone,
          website: company.identity.website,
          cuentas: company.bankAccounts.map((b) => ({
            bankName: b.bankName,
            accountType: b.accountType,
            currency: b.currency,
            accountNumber: b.accountNumber,
          })),
        }
      : undefined,
  }) as ReactElement<DocumentProps>;

  return respuestaPdf(doc, {
    nombreArchivo: `factura-${nombreSeguro(inv.invoice_code)}.pdf`,
  });
}

/**
 * SDD-0281 · GET /portal/facturas/[code]/pdf — el cliente se lleva su factura.
 *
 * El portal ya dejaba VER la factura y reportar su pago (SDD-0134), pero no
 * TENERLA. Para un importador la factura es el documento que va a su contador y
 * a su banco: sin PDF, el equipo la armaba a mano o mandaba una captura.
 *
 * ⚠️ **Un route handler NO ejecuta el layout `(app)`.** El gate de sesión del
 * portal vive en ese layout, así que acá no protege nada. Quien protege es
 * `getMyInvoice`: resuelve el markbox vía la RPC `get_portal_client_markbox`
 * (acotada a `auth.uid()`) y filtra por `client_markbox` + `neq borrador`. Sin
 * sesión de portal el markbox es null y la función devuelve null antes de
 * consultar nada. Fail-closed por construcción, no por el layout.
 *
 * Los tres casos —no existe, no es tuya, es un borrador interno— responden el
 * MISMO 404. Distinguirlos le confirmaría a cualquiera qué códigos existen.
 *
 * Sale como `attachment` (a diferencia del Studio, que abre el visor): el
 * cliente entra a esto para guardar el archivo, no para leerlo en pantalla —
 * la pantalla ya la tiene en `/portal/facturas/[code]`.
 */

import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { getMyInvoice, getPortalClient } from "@/lib/portal/portal-queries";
import { getCompanyDataForTenant } from "@/lib/studio/company-queries";
import { FacturaDocument } from "@/lib/studio/pdf/factura-pdf";
import { noEncontrado, nombreSeguro, respuestaPdf } from "@/lib/studio/pdf/pdf-response";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code: raw } = await params;
  const code = decodeURIComponent(raw);

  const supabase = await createClient();

  const inv = await getMyInvoice(supabase, code);
  if (!inv) return noEncontrado("Factura");

  // El markbox no viene en el detalle de la factura del portal; sale del propio
  // cliente logueado. Si por lo que sea no resuelve, el papel sale sin esa
  // línea en vez de no salir.
  // 🔴 Los datos del emisor NO se pueden leer con el cliente del portal:
  // `getCompanyData` resuelve el tenant por `user_tenants`, y un cliente del
  // portal no está ahí (medido 2026-08-25: 2 de 133 cuentas). Con el cliente
  // del usuario, esta factura salía sin razón social, sin RIF y sin datos de
  // pago — y es la copia que el cliente le lleva a su contador.
  //
  // La propiedad ya quedó probada arriba por `getMyInvoice` (markbox del
  // usuario logueado); recién por eso se lee con admin, acotado a ESE tenant.
  const [client, company] = await Promise.all([
    getPortalClient(supabase).catch(() => null),
    getCompanyDataForTenant(createAdminClient(), inv.tenantId).catch(() => null),
  ]);

  const doc = createElement(FacturaDocument, {
    invoice: {
      code: inv.code,
      clientName: inv.clientName,
      clientRif: inv.clientRif,
      clientDocKind: inv.clientDocKind,
      clientMarkbox: client?.markbox ?? null,
      shipmentCode: inv.shipmentCode,
      currency: inv.currency,
      fxRate: inv.fxRate,
      ivaRate: inv.ivaRate,
      base: inv.base,
      ivaAmount: inv.ivaAmount,
      total: inv.total,
      paid: inv.paid,
      status: inv.status,
      issuedAt: inv.issuedAt,
      dueDate: inv.dueDate,
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
    nombreArchivo: `factura-${nombreSeguro(inv.code)}.pdf`,
    disposicion: "attachment",
  });
}

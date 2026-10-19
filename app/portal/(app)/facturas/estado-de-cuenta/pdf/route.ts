/**
 * SDD-0287 · GET /portal/facturas/estado-de-cuenta/pdf
 *
 * El cliente se lleva SU estado de cuenta. Es el documento que le pasa a su
 * contador; hasta ahora sólo existía como tabla en pantalla (SDD-0177).
 *
 * ⚠️ **Un route handler NO ejecuta el layout `(app)`.** El gate de sesión del
 * portal vive ahí, así que acá no protege nada. Protege el principal Portal
 * (SDD-0462, SDD-0556): `getPortalClientPrincipal` exige sesión, vínculo activo
 * y cliente vivo del mismo tenant, y se resuelve UNA vez, ANTES de leer
 * facturas o construir el cliente admin. Sin principal responde 404 sin
 * consultar facturas. Con principal, `listMyInvoicesForPrincipal` filtra por su
 * tenant + Shipping Mark + `neq borrador`. Fail-closed por construcción, no por
 * el layout.
 *
 * No hay parámetro de cliente **a propósito**: la cuenta es la del que está
 * logueado y no hay forma de pedir la de otro. Un `[markbox]` en la URL sería
 * una superficie que habría que defender; no tenerlo es no tener que hacerlo.
 *
 * Sale como `attachment`: el cliente entra acá para guardar el archivo, no para
 * leerlo — la tabla ya la tiene en `/portal/facturas?vista=cuenta`.
 */

import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import {
  getPortalClientPrincipal,
  listMyInvoicesForPrincipal,
} from "@/lib/portal/portal-queries";
import type { PortalInvoiceRow } from "@/lib/portal/portal-types";
import { buildStatementLedger } from "@/lib/portal/statement-ledger";
import { getCompanyDataForTenant } from "@/lib/studio/company-queries";
import { EstadoDeCuentaDocument } from "@/lib/studio/pdf/estado-de-cuenta-pdf";
import { noEncontrado, nombreSeguro, respuestaPdf } from "@/lib/studio/pdf/pdf-response";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();

  // Primero el principal: su tenant gobierna las facturas y el emisor.
  const principal = await getPortalClientPrincipal(supabase);
  if (!principal) return noEncontrado("Estado de cuenta");
  const { client } = principal;

  // Todas las facturas, sin tope (SDD-0556). Las anuladas llegan y el ledger
  // las pone en 0 —es lo mismo que la tabla del portal, así que el papel y la
  // pantalla dicen lo mismo—. Si la lectura falla o queda incompleta, el papel
  // NO sale: un estado de cuenta vacío o parcial con cara de completo es peor
  // que un «intenta más tarde».
  let invoices: PortalInvoiceRow[];
  try {
    invoices = await listMyInvoicesForPrincipal(supabase, principal);
  } catch {
    return new Response("Estado de cuenta no disponible. Intenta más tarde.", {
      status: 503,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  const ledger = buildStatementLedger(invoices);

  // 🔴 El emisor NO se lee con el cliente del portal: `getCompanyData` resuelve
  // el tenant por `user_tenants`, y un cliente del portal no está ahí (salía
  // sin emisor) o, en una sesión híbrida, tomaba el tenant de equipo. La
  // propiedad ya quedó probada arriba (principal + sus facturas); recién por
  // eso se lee con admin, acotado al tenant DEL PRINCIPAL — mismo patrón que el
  // PDF de la factura (`facturas/[code]/pdf/route.ts`).
  const company = await getCompanyDataForTenant(
    createAdminClient(),
    principal.tenantId,
  ).catch(() => null);

  const doc = createElement(EstadoDeCuentaDocument, {
    input: {
      clientName: client.name,
      markbox: client.markbox,
      ledger,
      emitidoEl: new Date().toISOString().slice(0, 10),
    },
    // ⚠️ Sin `legalName` ni `rif` a propósito. La regla de marca deja la razón
    // social y el RIF sólo en el schema, nunca en texto visible
    // (`docs/engineering/project-rules.md`, «Identidad pública»), y la
    // excepción que dio Sam el 2026-08-25 (SDD-0297) cubre sólo la factura.
    // Si Sam la extiende al estado de cuenta, encenderlo es agregar aquí
    // `legalName: company.identity.legalName` y `rif: company.identity.rif`
    // (el documento ya los imprime bajo el membrete) y cambiar la prueba que
    // fija que hoy no se pasan. Ver `docs/specs/0556-portal-facturas-anuladas-fuera/spec.md`.
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

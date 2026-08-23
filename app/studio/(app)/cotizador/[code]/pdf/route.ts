/**
 * SDD-0281 · GET /studio/cotizador/[code]/pdf — el estimado en papel.
 *
 * Mismos candados que la factura: sesión del Studio (proxy) + RBAC del módulo
 * `quotes` + RLS por tenant en la query.
 *
 * A diferencia de la factura, **el borrador SÍ se puede imprimir**. Un estimado
 * en `draft` es material de trabajo del asesor —lo lleva a una reunión, lo
 * revisa con el cliente— y el documento ya avisa en su pie que es una oferta
 * sujeta a volumen y peso reales. Lo que no se puede es confundir un estimado
 * vencido con uno vigente, y de eso se encarga el propio documento.
 */

import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { createClient } from "@/lib/db/server";
import { getStudioAccess } from "@/lib/studio/rbac-guard";
import { canAccessModule } from "@/lib/studio/rbac";
import { getQuoteByCode } from "@/lib/studio/quote-queries";
import { getCompanyData } from "@/lib/studio/company-queries";
import { EstimadoDocument } from "@/lib/studio/pdf/estimado-pdf";
import { noEncontrado, nombreSeguro, respuestaPdf } from "@/lib/studio/pdf/pdf-response";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code: raw } = await params;
  const code = decodeURIComponent(raw);

  const supabase = await createClient();

  const { role, overrides } = await getStudioAccess(supabase);
  if (!canAccessModule(role, "quotes", overrides)) return noEncontrado("Estimado");

  const quote = await getQuoteByCode(supabase, code);
  if (!quote) return noEncontrado("Estimado");

  const company = await getCompanyData(supabase).catch(() => null);

  const doc = createElement(EstimadoDocument, {
    quote,
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
    nombreArchivo: `estimado-${nombreSeguro(quote.quote_code)}.pdf`,
  });
}

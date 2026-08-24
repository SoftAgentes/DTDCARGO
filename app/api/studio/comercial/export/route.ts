/**
 * SDD-0281 · GET /api/studio/comercial/export — los listados en CSV.
 *
 *   ?tipo=estimados  [&status&q&client&source]
 *   ?tipo=facturas   [&tab&q&client]
 *
 * Route FINA: el armado del CSV vive en `lib/studio/export/comercial-csv.ts` y
 * los filtros los parsean los MISMOS parsers que usan las páginas
 * (`parseQuoteFiltersFromSearchParams`, `parseInvoiceFiltersFromSearchParams`).
 * Eso no es elegancia: es lo que hace que "Exportar" baje exactamente lo que la
 * pantalla está mostrando. Si el export tuviera su propio parser, el día que
 * cambie un filtro el CSV empezaría a traer otra cosa sin que nadie lo note.
 *
 * ## Seguridad — dos capas, en este orden
 *
 * 1. **`requireStudioSession()`** → 401 sin sesión, 403 sin tenant. La primera
 *    versión de esta ruta arrancaba directo con `getStudioAccess` +
 *    `canAccessModule`, que autoriza por ROL pero no distingue "no tienes
 *    permiso" de "no estás autenticado": un anónimo recibía un 403 hablándole
 *    de módulos. El contrato `studio-api-auth-guard.test.ts` lo cazó en el gate
 *    — y tiene razón: el proxy refresca la sesión en `/studio/*` pero su
 *    matcher ni siquiera incluye `/api/studio`.
 * 2. **Gate de VISTA del módulo** (`quotes` / `invoices`). Exportar no muta, así
 *    que view alcanza — mismo criterio que el export de Bitácora (SDD-0146).
 *
 * Y los datos salen por las queries con el **cliente autenticado**, nunca
 * service-role: cada quien exporta lo que su RLS le deja ver. `private,
 * no-store` porque el archivo lleva plata y nombres de clientes.
 */

import { NextResponse } from "next/server";
import { apiError } from "@/lib/http/api-error";
import { requireStudioSession } from "@/lib/http/studio-session";
import { getStudioAccess } from "@/lib/studio/rbac-guard";
import { canAccessModule } from "@/lib/studio/rbac";
import {
  listQuotes,
  parseQuoteFiltersFromSearchParams,
} from "@/lib/studio/quote-queries";
import {
  listInvoices,
  parseInvoiceFiltersFromSearchParams,
} from "@/lib/studio/invoice-queries";
import { respuestaCsv } from "@/lib/studio/export/csv";
import {
  buildEstimadosCsv,
  buildFacturasCsv,
  estimadosCsvFilename,
  facturasCsvFilename,
} from "@/lib/studio/export/comercial-csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** `URLSearchParams` → el `Record` que esperan los parsers de las páginas. */
function comoRecord(sp: URLSearchParams): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of sp.entries()) out[k] = v;
  return out;
}

export async function GET(req: Request) {
  try {
    const sesion = await requireStudioSession();
    if (sesion instanceof NextResponse) return sesion;
    const { supabase } = sesion;

    const url = new URL(req.url);
    const tipo = url.searchParams.get("tipo");
    const raw = comoRecord(url.searchParams);
    const hoy = new Date().toISOString().slice(0, 10);

    // El rol NO sale de `sesion.role` a propósito: `getStudioAccess` además
    // resuelve los overrides por rol (SDD-0085), y `canAccessModule` los
    // necesita para no negarle el módulo a quien lo tiene concedido a mano.
    const { role, overrides } = await getStudioAccess(supabase);

    if (tipo === "estimados") {
      if (!canAccessModule(role, "quotes", overrides)) {
        return apiError("No tienes acceso a Estimados.", null, 403, "comercial-export");
      }
      const quotes = await listQuotes(
        supabase,
        parseQuoteFiltersFromSearchParams(raw),
      );
      return respuestaCsv(buildEstimadosCsv(quotes), estimadosCsvFilename(hoy));
    }

    if (tipo === "facturas") {
      if (!canAccessModule(role, "invoices", overrides)) {
        return apiError("No tienes acceso a Facturación.", null, 403, "comercial-export");
      }
      // `listInvoices` ya aplica el filtro de tab in-memory (`filterByTab`), que
      // es donde se derivan "vencida" y "por cobrar" — el mismo camino que la
      // página. Por eso se le pasan los filtros completos, tab incluido.
      const invoices = await listInvoices(
        supabase,
        parseInvoiceFiltersFromSearchParams(raw),
      );
      return respuestaCsv(buildFacturasCsv(invoices), facturasCsvFilename(hoy));
    }

    return apiError(
      "Parámetro `tipo` inválido: usa `estimados` o `facturas`.",
      null,
      400,
      "comercial-export",
    );
  } catch (e) {
    return apiError("No se pudo generar el CSV.", e, 500, "comercial-export");
  }
}

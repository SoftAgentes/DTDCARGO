/**
 * /api/studio/contabilidad/export · GET — el libro diario COMPLETO en CSV
 * (SDD-0557).
 *
 *   `?tipo=diario[&desde=AAAA-MM-DD][&hasta=AAAA-MM-DD]`
 *
 * Por qué una ruta y no un CSV armado en la pantalla: la pantalla del diario
 * tiene un tope DECLARADO de 500 asientos (`DIARIO_PANTALLA_MAX`) y no tiene
 * sentido mandarle miles al navegador. El archivo, en cambio, sale completo:
 * pagina con `fetchAllPaged` y lanza si no puede leer todo. Solo asientos
 * asentados y vivos, una fila por línea: así Σ debe del archivo = total debe
 * del balance de comprobación a la misma fecha.
 *
 * Seguridad:
 *  - sesión (`requireStudioSession`) y gate de VISTA del módulo `accounting`
 *    (`moduleViewDenial`), antes de leer: accounting y admin;
 *  - las lecturas van con el cliente de sesión bajo la RLS del tenant;
 *  - `Cache-Control: private, no-store` (respuestaCsv).
 *
 * Datos personales: los conceptos de los asientos llevan el nombre del
 * trabajador en el finiquito (settlement-posting.ts) y el Shipping Mark del
 * referidor (referral-credit-posting.ts), además del texto libre de los
 * asientos manuales. Revisado con revisar-datos-ve (handoff de la 0557). El
 * CSV neutraliza fórmulas por el mismo camino que Reportes (`rowsToCsv`).
 */

import { NextResponse } from "next/server";
import { apiError } from "@/lib/http/api-error";
import { requireStudioSession } from "@/lib/http/studio-session";
import { moduleViewDenial } from "@/lib/studio/rbac-guard";
import { respuestaCsv } from "@/lib/studio/export/csv";
import { leerDiarioCompleto } from "@/lib/studio/accounting/libro-control-queries";
import {
  diarioCsv,
  nombreDelDiario,
  rangoDelDiario,
} from "@/lib/studio/accounting/libro-control";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TAG = "contabilidad:export";

export async function GET(request: Request) {
  const sesion = await requireStudioSession();
  if (sesion instanceof NextResponse) return sesion;
  const { supabase } = sesion;

  try {
    const denial = await moduleViewDenial(supabase, "accounting");
    if (denial) return apiError(denial, null, 403, TAG);

    const url = new URL(request.url);
    if (url.searchParams.get("tipo") !== "diario") {
      return apiError("Parámetro «tipo» inválido: usa «diario».", null, 400, TAG);
    }
    const { rango, error } = rangoDelDiario(
      url.searchParams.get("desde"),
      url.searchParams.get("hasta"),
    );
    if (error) return apiError(error, null, 400, TAG);

    const filas = await leerDiarioCompleto(supabase, rango);
    const hoy = new Date().toISOString().slice(0, 10);
    return respuestaCsv(diarioCsv(filas), nombreDelDiario(rango, hoy));
  } catch (e) {
    return apiError("No se pudo generar el CSV del diario.", e, 500, TAG);
  }
}

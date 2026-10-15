/**
 * SDD-0289 · GET /api/studio/operativo/export — Clientes, Cobranzas y Tracking en CSV.
 *
 *   ?tipo=clientes | cobranzas | embarques
 *
 * Route FINA: el armado vive en `lib/studio/export/operativo-csv.ts`.
 *
 * ## Por qué NO reusa las queries de las páginas
 *
 * `listShipments` corta en 100 filas y `listClients` en `CLIENTS_MAX`: topes
 * correctos para una pantalla, mentirosos para un archivo. El export usa
 * lecturas propias que paginan entero y **lanzan** si topan — un error se ve, un
 * CSV corto no. Cobranzas sí reusa `receivablesQueue`, que ya pagina completo y
 * ya grita por su cuenta.
 *
 * ## A diferencia del export comercial, éste NO filtra
 *
 * Es deliberado. Los tres listados filtran en el cliente (tabs, búsqueda en
 * memoria) y no en la URL, así que no hay un "lo que muestra la vista" que se
 * pueda reproducir en el servidor. Antes que bajar un archivo que **parezca**
 * filtrado y no lo esté, baja el conjunto completo y quien lo abre filtra en su
 * planilla.
 *
 * Seguridad: `requireStudioSession()` primero (401 sin sesión / 403 sin tenant),
 * después el gate de VISTA del módulo — exportar no muta. Los datos salen con el
 * cliente autenticado, nunca service-role.
 *
 * SDD-0531 · el CSV de embarques respeta la misma regla que la pantalla de
 * Tracking: al equipo de China (región cn, no admin) la columna `cliente` le
 * sale vacía. La cabecera no cambia, para que una planilla armada sobre ella no
 * se descuadre.
 */

import { NextResponse } from "next/server";
import { apiError } from "@/lib/http/api-error";
import { requireStudioSession } from "@/lib/http/studio-session";
import { getStudioAccess } from "@/lib/studio/rbac-guard";
import { canAccessModule } from "@/lib/studio/rbac";
import { receivablesQueue } from "@/lib/studio/payment-queries";
import {
  readCanSeeClientNames,
  segunVisibilidad,
} from "@/lib/studio/privacidad-cn";
import { respuestaCsv } from "@/lib/studio/export/csv";
import {
  buildClientesCsv,
  buildCobranzasCsv,
  buildTrackingCsv,
  clientesCsvFilename,
  cobranzasCsvFilename,
  listarClientesParaExport,
  listarEmbarquesParaExport,
  trackingCsvFilename,
} from "@/lib/studio/export/operativo-csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const sesion = await requireStudioSession();
    if (sesion instanceof NextResponse) return sesion;
    const { supabase } = sesion;

    const tipo = new URL(req.url).searchParams.get("tipo");
    const hoy = new Date().toISOString().slice(0, 10);

    // El rol NO sale de `sesion.role`: `getStudioAccess` además resuelve los
    // overrides por rol (SDD-0085), que `canAccessModule` necesita.
    const { role, overrides } = await getStudioAccess(supabase);

    if (tipo === "clientes") {
      if (!canAccessModule(role, "clients", overrides)) {
        return apiError("No tienes acceso a Clientes.", null, 403, "operativo-export");
      }
      const clientes = await listarClientesParaExport(supabase);
      return respuestaCsv(buildClientesCsv(clientes), clientesCsvFilename(hoy));
    }

    if (tipo === "cobranzas") {
      if (!canAccessModule(role, "collections", overrides)) {
        return apiError("No tienes acceso a Cobranzas.", null, 403, "operativo-export");
      }
      const cola = await receivablesQueue(supabase);
      return respuestaCsv(buildCobranzasCsv(cola), cobranzasCsvFilename(hoy));
    }

    if (tipo === "embarques") {
      if (!canAccessModule(role, "tracking", overrides)) {
        return apiError("No tienes acceso a Tracking.", null, 403, "operativo-export");
      }
      const embarques = segunVisibilidad(
        await listarEmbarquesParaExport(supabase),
        await readCanSeeClientNames(supabase),
      );
      return respuestaCsv(buildTrackingCsv(embarques), trackingCsvFilename(hoy));
    }

    return apiError(
      "Parámetro `tipo` inválido: usa `clientes`, `cobranzas` o `embarques`.",
      null,
      400,
      "operativo-export",
    );
  } catch (e) {
    return apiError("No se pudo generar el CSV.", e, 500, "operativo-export");
  }
}

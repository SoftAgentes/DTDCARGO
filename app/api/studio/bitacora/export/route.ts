/**
 * /api/studio/bitacora/export · GET — reportes con branding (SDD-0146 · Fase 7).
 *
 * Route FINA (sin lógica de negocio; el armado vive en `lib/studio/bitacora/reports.ts`):
 *   - `?tipo=acta&id={meetingId}`                → HTML autocontenido del acta.
 *   - `?tipo=tareas&formato=html`                → HTML de la lista de tareas.
 *   - `?tipo=tareas&formato=csv`  (default)      → CSV (UTF-8 BOM, CRLF).
 *   filtros de tareas: `estado`, `prioridad`, `tipoTarea`, `persona` (respetan
 *   lo que el usuario ve en la Lista).
 *
 * Seguridad:
 *   (a) sesión Supabase + gate de VISTA (`moduleViewDenial("bitacora")`) — exportar
 *       NO muta, así que **view alcanza** (no `moduleEditDenial`).
 *   (b) los datos salen SOLO por las queries gated por RLS con el **user client**
 *       (NUNCA service-role): un usuario solo exporta lo que puede ver.
 *   (c) el HTML nunca embebe signed URLs de Storage; el isólogo viaja como
 *       data-URI leído de `public/brand/` (ya trazado en next.config para prod;
 *       si el fs falla → wordmark de texto, sigue branded).
 *   `apiError` no filtra el error crudo en prod.
 */

import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@/lib/db/server";
import { apiError } from "@/lib/http/api-error";
import { moduleViewDenial } from "@/lib/studio/rbac-guard";
import {
  listTasks,
  listAssignableProfiles,
} from "@/lib/studio/bitacora/bitacora-queries";
import {
  getMeeting,
  listMeetings,
} from "@/lib/studio/bitacora/bitacora-meeting-queries";
import { todayCaracasISO, VE_TIME_ZONE } from "@/lib/studio/bitacora/dates";
import {
  ESTADO_META,
  PRIORIDAD_META,
  isBitacoraTaskEstado,
  isBitacoraPrioridad,
  isBitacoraTaskTipo,
} from "@/lib/studio/bitacora/bitacora-types";
import {
  buildActaHtml,
  buildTasksCsv,
  buildTasksReportHtml,
  filterTasksForExport,
  actaHtmlFilename,
  tasksCsvFilename,
  tasksReportFilename,
  type TasksExportFilter,
} from "@/lib/studio/bitacora/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type StudioClient = Awaited<ReturnType<typeof createClient>>;

/** Isólogo mono-dark (variante de impresión/sello) → data-URI. Nunca http. */
async function readIsologoDataUri(): Promise<string | null> {
  try {
    const buf = await readFile(
      path.join(process.cwd(), "public", "brand", "dtdcargo-isologo-mono-dark.png"),
    );
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null; // degrada al wordmark de texto (sigue branded)
  }
}

/** Fecha/hora de generación legible es-VE en Caracas. */
function formatGeneratedAt(now: Date): string {
  return new Intl.DateTimeFormat("es-VE", {
    timeZone: VE_TIME_ZONE,
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);
}

/** Cliente/contacto de la reunión (nombre · Shipping Mark) o texto libre. */
async function resolveClienteLabel(
  supabase: StudioClient,
  clientId: string | null,
  contactoLibre: string | null,
): Promise<string | null> {
  if (clientId) {
    const { data } = await supabase
      .from("clients")
      .select("name, markbox")
      .eq("id", clientId)
      .maybeSingle<{ name: string | null; markbox: string | null }>();
    if (data?.name) {
      return data.markbox ? `${data.name} · ${data.markbox}` : data.name;
    }
  }
  return contactoLibre ?? null;
}

/** Descripción es-VE del filtro activo (para el sub-encabezado del reporte). */
function describeFilter(
  filter: TasksExportFilter,
  nameByUserId: Record<string, string>,
): string | null {
  const parts: string[] = [];
  if (filter.tipo === "entregable_cliente") parts.push("Esperando al cliente");
  else if (filter.tipo === "empleado") parts.push("Internas");
  if (filter.estado) {
    parts.push(
      `Estado ${ESTADO_META[filter.estado as keyof typeof ESTADO_META]?.label ?? filter.estado}`,
    );
  }
  if (filter.prioridad) {
    parts.push(
      `Prioridad ${PRIORIDAD_META[filter.prioridad as keyof typeof PRIORIDAD_META]?.label ?? filter.prioridad}`,
    );
  }
  if (filter.persona) {
    parts.push(`Persona ${nameByUserId[filter.persona] ?? filter.persona}`);
  }
  return parts.length > 0 ? `Filtro activo · ${parts.join(" · ")}` : null;
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // (a) sesión + gate de VISTA (exportar no muta → view alcanza).
    const { data: userResp } = await supabase.auth.getUser();
    if (!userResp.user) {
      return apiError("No autorizado.", null, 401, "bitacora:export");
    }
    const denial = await moduleViewDenial(supabase, "bitacora");
    if (denial) {
      return apiError(denial, null, 403, "bitacora:export");
    }

    const url = new URL(request.url);
    const tipo = url.searchParams.get("tipo");
    const todayISO = todayCaracasISO();
    const generatedAt = formatGeneratedAt(new Date());

    // Nombre a mostrar del usuario (footer): del pool si está, si no el email.
    const profiles = await listAssignableProfiles(supabase);
    const nameByUserId: Record<string, string> = {};
    for (const p of profiles) nameByUserId[p.user_id] = p.display_name;
    const generatedBy =
      nameByUserId[userResp.user.id] ?? userResp.user.email ?? "Usuario";

    // ── Acta → HTML ──────────────────────────────────────────
    if (tipo === "acta") {
      const id = (url.searchParams.get("id") ?? "").trim();
      if (!UUID_RE.test(id)) {
        return apiError("Falta el acta a exportar.", null, 400, "bitacora:export");
      }
      // RLS: getMeeting solo devuelve lo visible (borrador propio / confirmada del
      // tenant / confidencial solo dirección + creador).
      const meeting = await getMeeting(supabase, id);
      if (!meeting) {
        return apiError("Acta no encontrada.", null, 404, "bitacora:export");
      }
      // Tareas de esta acta (RLS-gated) — filtra por meeting_id en memoria.
      const allTasks = await listTasks(supabase, { includeDone: true, limit: 500 });
      const tasks = allTasks.filter((t) => t.meeting_id === id);
      const clienteLabel = await resolveClienteLabel(
        supabase,
        meeting.client_id,
        meeting.contacto_libre,
      );
      const logoDataUri = await readIsologoDataUri();

      const html = buildActaHtml(meeting.acta, meeting, tasks, {
        generatedAt,
        generatedBy,
        nameByUserId,
        clienteLabel,
        logoDataUri,
      });
      return new NextResponse(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="${actaHtmlFilename(meeting.titulo, todayISO)}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    // ── Tareas → HTML | CSV ──────────────────────────────────
    if (tipo === "tareas") {
      const formato = (url.searchParams.get("formato") ?? "csv").toLowerCase();

      // Filtros de la Lista (validados contra los enums; los inválidos se ignoran).
      const estadoRaw = url.searchParams.get("estado");
      const prioridadRaw = url.searchParams.get("prioridad");
      const tipoTareaRaw = url.searchParams.get("tipoTarea");
      const filter: TasksExportFilter = {
        estado: isBitacoraTaskEstado(estadoRaw) ? estadoRaw : null,
        prioridad: isBitacoraPrioridad(prioridadRaw) ? prioridadRaw : null,
        tipo: isBitacoraTaskTipo(tipoTareaRaw) ? tipoTareaRaw : null,
        persona: url.searchParams.get("persona"),
      };

      const [allTasks, meetings] = await Promise.all([
        listTasks(supabase, { includeDone: true, limit: 1000 }),
        listMeetings(supabase, { limit: 500 }),
      ]);
      const tasks = filterTasksForExport(allTasks, filter);
      const meetingTitleById: Record<string, string> = {};
      for (const m of meetings) meetingTitleById[m.id] = m.titulo;

      if (formato === "html") {
        const logoDataUri = await readIsologoDataUri();
        const html = buildTasksReportHtml(tasks, {
          generatedAt,
          generatedBy,
          nameByUserId,
          meetingTitleById,
          logoDataUri,
          filterLabel: describeFilter(filter, nameByUserId),
        });
        return new NextResponse(html, {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Content-Disposition": `attachment; filename="${tasksReportFilename(todayISO)}"`,
            "Cache-Control": "no-store",
          },
        });
      }

      const csv = buildTasksCsv(tasks, { nameByUserId, meetingTitleById });
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${tasksCsvFilename(todayISO)}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return apiError("Tipo de exportación inválido.", null, 400, "bitacora:export");
  } catch (err) {
    return apiError("No se pudo generar la descarga.", err, 500, "bitacora:export");
  }
}

/**
 * Reportes con branding de Bitácora (SDD-0146 · Fase 7 · PROMPT-BITACORA §7).
 *
 * Funciones PURAS (sin red, sin fs, sin reloj no-inyectado) → testeables:
 *   - `buildActaHtml`        → HTML autocontenido del acta (branding DTD embebido).
 *   - `buildTasksReportHtml` → HTML autocontenido de la lista de tareas.
 *   - `buildTasksCsv`        → CSV (UTF-8 BOM, CRLF, escape) de las tareas.
 *   - `filterTasksForExport` → aplica los filtros activos de la Lista (RLS aparte).
 *   - `escapeHtml` / `csvCell` → primitivas de escape (XSS / inyección CSV).
 *
 * CERO dependencia nueva: el HTML + Ctrl+P ES el "PDF" del sistema (sin librería
 * de PDF); el CSV es string manual (sin librería CSV).
 *
 * Marca: los tokens del design system van embebidos en `:root` (documento
 * autocontenido — se abre offline / se imprime sin la app; BRAND.md
 * mono-dark = variante de impresión). Tipografía Archivo con fallback
 * `system-ui, sans-serif` (sin CDN → offline cae al system font). El isólogo
 * llega como **data-URI** desde la route (fs, `public/brand/`) — NUNCA un
 * http/https ni una signed URL de Storage (expiran 1h + filtrarían acceso).
 * TODO el contenido dinámico se escapa (el acta viene de IA + edición humana).
 */

import type { BitacoraTask } from "./bitacora-queries";
import type { BitacoraMeeting } from "./bitacora-meeting-queries";
import {
  ESTADO_META,
  PRIORIDAD_META,
  MEETING_TIPO_META,
  ROLE_QUEUE_LABELS,
  type ActaData,
  type BitacoraBadgeTone,
  type BitacoraTaskTipo,
} from "./bitacora-types";
import { UNASSIGNED_KEY } from "./grouping";

// ─── Primitivas de escape ────────────────────────────────────

/**
 * Escapa contenido dinámico para HTML (defensa XSS). `&` PRIMERO (si no, se
 * doble-escaparían las entidades que produce el resto). Cubre atributos y texto.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Escapa una celda CSV (RFC 4180): entrecomilla si hay coma / comilla / salto de
 * línea, y duplica las comillas internas (`"` → `""`). null/undefined → "".
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ─── Etiquetas para el export ────────────────────────────────

/** Etiqueta del tipo para el CSV/reportes (más clara que la del tablero). */
const CSV_TIPO_LABEL: Record<BitacoraTaskTipo, string> = {
  empleado: "Interna",
  entregable_cliente: "Entregable de cliente",
};

/**
 * Texto de los asignados de una tarea: dueños resueltos unidos por `"; "`; si no
 * hay dueño, cae al nombre crudo que sugirió la IA, luego a la cola por rol.
 */
function asignadosText(
  t: Pick<BitacoraTask, "assignees" | "responsable_nombre" | "assigned_role">,
  nameByUserId: Record<string, string>,
): string {
  if (t.assignees.length > 0) {
    return t.assignees
      .map((a) => nameByUserId[a.user_id] ?? "Usuario")
      .join("; ");
  }
  if (t.responsable_nombre) return t.responsable_nombre;
  if (t.assigned_role) {
    return `Cola ${
      ROLE_QUEUE_LABELS[t.assigned_role as keyof typeof ROLE_QUEUE_LABELS] ??
      t.assigned_role
    }`;
  }
  return "";
}

// ─── CSV de tareas ───────────────────────────────────────────

export interface TasksCsvMeta {
  nameByUserId: Record<string, string>;
  meetingTitleById: Record<string, string>;
}

/** Columnas EXACTAS del CSV (contrato del spec Fase 7). */
export const TASKS_CSV_HEADERS = [
  "titulo",
  "estado",
  "prioridad",
  "tipo",
  "vence",
  "asignados",
  "checklist_hecho",
  "checklist_total",
  "reunion",
  "creada",
] as const;

/**
 * CSV de las tareas: UTF-8 con **BOM** (`﻿` — sin él Excel/Windows abre en
 * Windows-1252 y rompe ñ/acentos), separador coma, fin de línea **CRLF**, celdas
 * escapadas, fechas ISO `YYYY-MM-DD`, asignados unidos por `"; "`. PURA.
 */
export function buildTasksCsv(
  tasks: readonly BitacoraTask[],
  meta: TasksCsvMeta,
): string {
  const rows = tasks.map((t) => {
    const doneCount = t.checklist.filter((c) => c.done).length;
    return [
      t.titulo,
      ESTADO_META[t.estado]?.label ?? t.estado,
      PRIORIDAD_META[t.prioridad]?.label ?? t.prioridad,
      CSV_TIPO_LABEL[t.tipo] ?? t.tipo,
      t.due_date ?? "",
      asignadosText(t, meta.nameByUserId),
      doneCount,
      t.checklist.length,
      t.meeting_id ? (meta.meetingTitleById[t.meeting_id] ?? "") : "",
      (t.created_at ?? "").slice(0, 10),
    ];
  });

  const lines = [
    TASKS_CSV_HEADERS.join(","),
    ...rows.map((r) => r.map(csvCell).join(",")),
  ];
  // BOM UTF-8 (U+FEFF) explícito + CRLF entre filas.
  return "﻿" + lines.join("\r\n");
}

// ─── Filtro (respeta lo que ve la Lista; la RLS es capa aparte) ─

export interface TasksExportFilter {
  estado?: string | null;
  prioridad?: string | null;
  /** Tipo de tarea: `empleado` | `entregable_cliente`. */
  tipo?: string | null;
  /** userId del dueño, o `UNASSIGNED_KEY` para las sin asignar. */
  persona?: string | null;
}

/**
 * Filtra las tareas por los criterios activos de la Lista (persona/estado/
 * prioridad/tipo). PURA — la seguridad real la da la RLS del user en la query;
 * esto solo recorta a "lo que el usuario ve". Filtro vacío/ausente = passthrough.
 */
export function filterTasksForExport<
  T extends {
    estado: string;
    prioridad: string;
    tipo: string;
    assignees: { user_id: string }[];
  },
>(tasks: readonly T[], filter: TasksExportFilter): T[] {
  return tasks.filter((t) => {
    if (filter.estado && t.estado !== filter.estado) return false;
    if (filter.prioridad && t.prioridad !== filter.prioridad) return false;
    if (filter.tipo && t.tipo !== filter.tipo) return false;
    if (filter.persona) {
      if (filter.persona === UNASSIGNED_KEY) {
        if (t.assignees.length > 0) return false;
      } else if (!t.assignees.some((a) => a.user_id === filter.persona)) {
        return false;
      }
    }
    return true;
  });
}

// ─── Documento HTML autocontenido (shell + estilos de marca) ──

/**
 * CSS embebido: tokens de marca en `:root` (valores canónicos de BRAND.md /
 * tokens.css) + layout + `@media print` con `page-break-inside: avoid` y
 * `print-color-adjust: exact` (= el "PDF" del sistema; el usuario hace Ctrl+P).
 * Sin @import, sin url() externa, sin fuente remota.
 */
const DOC_STYLE = `
:root{
  --wine:#7F0F1A;--wine-deep:#5E0A12;--wine-soft:#C2747F;--wine-tint:rgba(127,15,26,0.08);
  --ink:#0F1E3D;--ink-soft:#6B6B6B;--ink-mute:#9B9B9B;
  --bg-base:#FBFAF7;--bg-surface:#FFFFFF;--bg-elevated:#F2F0EC;
  --border:#E8E6E2;--border-strong:#D8D4CE;
  --success:#1F8A5B;--success-bg:rgba(31,138,91,0.10);
  --warning:#B8893A;--warning-bg:rgba(184,137,58,0.12);
  --danger:#A8323E;--danger-bg:rgba(168,50,62,0.10);
  --info:#2A6FDB;--info-bg:rgba(42,111,219,0.10);
  --neutral:#6B6B6B;--neutral-bg:rgba(107,107,107,0.10);
  --r-sm:5px;--r-md:7px;--r-lg:10px;--r-pill:999px;
  --f-sans:'Archivo',system-ui,-apple-system,'Segoe UI',sans-serif;
  --f-mono:'JetBrains Mono',ui-monospace,'SFMono-Regular',Menlo,monospace;
}
*{box-sizing:border-box;}
html,body{margin:0;padding:0;}
body{background:var(--bg-base);color:var(--ink);font-family:var(--f-sans);
  font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased;}
.doc{max-width:820px;margin:0 auto;padding:32px 28px 48px;}
.doc-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;
  flex-wrap:wrap;border-bottom:2px solid var(--ink);padding-bottom:16px;margin-bottom:24px;}
.brand{display:flex;align-items:center;gap:10px;}
.isologo{width:40px;height:auto;display:block;}
.wordmark{font-family:var(--f-sans);font-weight:900;font-size:24px;letter-spacing:-0.02em;
  line-height:0.9;white-space:nowrap;}
.w-dtd{color:var(--wine);}
.w-gap{display:inline-block;width:0.15em;}
.w-cargo{color:var(--ink);}
.doc-meta{text-align:right;}
.eyebrow{font-weight:800;font-size:10.5px;letter-spacing:0.12em;text-transform:uppercase;
  color:var(--wine);}
.doc-date{font-size:11.5px;color:var(--ink-soft);margin-top:3px;}
.kv-card{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--r-lg);
  padding:16px 18px;margin-bottom:20px;display:grid;grid-template-columns:auto 1fr;gap:6px 16px;}
.kv{display:contents;}
.kv-k{font-weight:700;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;
  color:var(--ink-mute);white-space:nowrap;}
.kv-v{font-size:13px;color:var(--ink);}
.section{margin-bottom:22px;}
.section h2{font-weight:800;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;
  color:var(--wine);margin:0 0 10px;}
.prose{font-size:13px;line-height:1.6;color:var(--ink);margin:0;}
.points{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:5px;}
.points li{font-size:13px;line-height:1.5;color:var(--ink);}
.empty{font-size:12.5px;color:var(--ink-mute);margin:0;}
.note{font-size:11.5px;color:var(--ink-mute);margin:8px 0 0;}
.tasks{display:flex;flex-direction:column;gap:10px;}
.task-card{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--r-md);
  padding:12px 14px;}
.task-title{font-weight:700;font-size:13px;color:var(--ink);margin-bottom:6px;}
.task-meta{display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--ink-soft);}
.tm-k{font-weight:700;font-size:10px;letter-spacing:0.06em;text-transform:uppercase;color:var(--ink-mute);}
.badge{display:inline-block;padding:2px 9px;border-radius:var(--r-pill);
  font-weight:700;font-size:10.5px;letter-spacing:0.02em;}
.tone-success{color:var(--success);background:var(--success-bg);}
.tone-warning{color:var(--warning);background:var(--warning-bg);}
.tone-danger{color:var(--danger);background:var(--danger-bg);}
.tone-info{color:var(--info);background:var(--info-bg);}
.tone-wine{color:var(--wine);background:var(--wine-tint);}
.tone-neutral{color:var(--ink-soft);background:var(--neutral-bg);}
.checklist{list-style:none;margin:10px 0 0;padding:0;display:flex;flex-direction:column;gap:5px;}
.checklist li{display:flex;align-items:flex-start;gap:8px;font-size:12.5px;color:var(--ink);}
.checklist .chk{flex-shrink:0;width:13px;height:13px;margin-top:2px;border:1.5px solid var(--border-strong);
  border-radius:3px;background:var(--bg-elevated);}
.checklist li.done{color:var(--ink-soft);text-decoration:line-through;}
.checklist li.done .chk{background:var(--success);border-color:var(--success);}
.count{font-size:12px;color:var(--ink-soft);margin:0 0 12px;}
.filter-note{display:inline-block;font-size:11.5px;color:var(--wine);background:var(--wine-tint);
  border-radius:var(--r-pill);padding:4px 12px;margin:0 0 12px;}
.tasks-table{width:100%;border-collapse:collapse;font-size:12px;}
.tasks-table th{text-align:left;font-weight:800;font-size:10px;letter-spacing:0.06em;
  text-transform:uppercase;color:var(--ink-soft);border-bottom:1.5px solid var(--border-strong);
  padding:8px 10px;background:var(--bg-elevated);}
.tasks-table td{padding:9px 10px;border-bottom:1px solid var(--border);color:var(--ink);vertical-align:top;}
.tasks-table .mono{font-family:var(--f-mono);font-size:11px;color:var(--ink-soft);white-space:nowrap;}
.doc-foot{margin-top:32px;padding-top:14px;border-top:1px solid var(--border);
  font-size:11px;color:var(--ink-mute);}
@media print{
  body{background:#fff;}
  .doc{max-width:none;padding:0;}
  .task-card,.section,.kv-card,.tasks-table tr,.tasks-table thead{page-break-inside:avoid;}
  .section h2{page-break-after:avoid;}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  @page{margin:16mm;}
}
`;

function badgeClass(tone: BitacoraBadgeTone): string {
  return `badge tone-${tone}`;
}

/** Shell branded compartido por el acta y el reporte de tareas. */
function docShell(opts: {
  docTitle: string;
  generatedAt: string;
  generatedBy: string;
  logoDataUri?: string | null;
  bodyHtml: string;
}): string {
  // El logo es un data-URI (data:image/png;base64,…) — jamás http/https. Si no
  // vino (fs falló), el wordmark de texto ya lleva la marca.
  const logo = opts.logoDataUri
    ? `<img class="isologo" src="${escapeHtml(opts.logoDataUri)}" alt="DTD Cargo" />`
    : "";
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(opts.docTitle)} · DTD Cargo</title>
<style>${DOC_STYLE}</style>
</head>
<body>
<main class="doc">
<header class="doc-head">
<div class="brand">${logo}<span class="wordmark"><span class="w-dtd">DTD</span><span class="w-gap"></span><span class="w-cargo">Cargo</span></span></div>
<div class="doc-meta"><div class="eyebrow">${escapeHtml(opts.docTitle)}</div><div class="doc-date">Generado el ${escapeHtml(opts.generatedAt)}</div></div>
</header>
${opts.bodyHtml}
<footer class="doc-foot">Generado por DTD Cargo · ${escapeHtml(opts.generatedAt)} · ${escapeHtml(opts.generatedBy)}</footer>
</main>
</body>
</html>`;
}

function sectionBlock(label: string, inner: string): string {
  return `<section class="section"><h2>${escapeHtml(label)}</h2>${inner}</section>`;
}

function pointsSection(label: string, items: readonly string[]): string {
  if (!items || items.length === 0) return "";
  const lis = items.map((i) => `<li>${escapeHtml(i)}</li>`).join("");
  return sectionBlock(label, `<ul class="points">${lis}</ul>`);
}

function proximaSection(p: ActaData["proxima_reunion"] | null | undefined): string {
  if (!p || (!p.fecha && !p.foco)) return "";
  const txt = `${p.fecha ?? "por definir"}${p.foco ? ` · ${p.foco}` : ""}`;
  return sectionBlock("Próxima reunión", `<p class="prose">${escapeHtml(txt)}</p>`);
}

/** Tarjeta de tarea del acta: responsable · prioridad · vence · checklist. */
function actaTaskCard(
  t: BitacoraTask,
  nameByUserId: Record<string, string>,
): string {
  const asign = asignadosText(t, nameByUserId) || "Sin asignar";
  const prio = PRIORIDAD_META[t.prioridad];
  const due = t.due_date
    ? `<span><span class="tm-k">Vence</span> ${escapeHtml(t.due_date)}</span>`
    : "";
  const checklist =
    t.checklist.length > 0
      ? `<ul class="checklist">${t.checklist
          .map(
            (c) =>
              `<li class="${c.done ? "done" : ""}"><span class="chk" aria-hidden="true"></span>${escapeHtml(c.texto)}</li>`,
          )
          .join("")}</ul>`
      : "";
  return `<article class="task-card"><div class="task-title">${escapeHtml(t.titulo)}</div><div class="task-meta"><span><span class="tm-k">Responsable</span> ${escapeHtml(asign)}</span><span class="${badgeClass(prio.tone)}">${escapeHtml(prio.label)}</span>${due}</div>${checklist}</article>`;
}

function actaTasksSection(
  label: string,
  tasks: readonly BitacoraTask[],
  nameByUserId: Record<string, string>,
): string {
  if (tasks.length === 0) {
    return sectionBlock(label, `<p class="empty">Sin tareas registradas.</p>`);
  }
  const cards = tasks.map((t) => actaTaskCard(t, nameByUserId)).join("");
  return sectionBlock(`${label} (${tasks.length})`, `<div class="tasks">${cards}</div>`);
}

// ─── Acta HTML ───────────────────────────────────────────────

export interface ActaHtmlMeta {
  /** Fecha/hora de generación (display es-VE). */
  generatedAt: string;
  /** Nombre/email de quien descargó (footer). */
  generatedBy: string;
  nameByUserId: Record<string, string>;
  /** Cliente/contacto ya resuelto (nombre · Shipping Mark) o null. */
  clienteLabel: string | null;
  /** data-URI del isólogo (nunca http/https ni signed URL). Opcional. */
  logoDataUri?: string | null;
}

type MeetingForActa = Pick<
  BitacoraMeeting,
  "titulo" | "fecha" | "tipo" | "resumen"
>;

/**
 * HTML del acta 100% autocontenido: branding DTD embebido, `@media print`,
 * XSS escapado, y **sin** signed URLs de Storage (los adjuntos se consultan en
 * la app). PURA.
 */
export function buildActaHtml(
  acta: ActaData | null,
  meeting: MeetingForActa,
  tasks: readonly BitacoraTask[],
  meta: ActaHtmlMeta,
): string {
  const a: ActaData = acta ?? {
    puntos: [],
    hablaron: [],
    decisiones: [],
    pendientes: [],
    proxima_reunion: { fecha: null, foco: null },
  };
  const tipoLabel = MEETING_TIPO_META[meeting.tipo]?.label ?? meeting.tipo;
  const empleado = tasks.filter((t) => t.tipo === "empleado");
  const cliente = tasks.filter((t) => t.tipo === "entregable_cliente");

  const kvRows: Array<[string, string]> = [
    ["Título", meeting.titulo],
    ["Tipo", tipoLabel],
  ];
  if (meta.clienteLabel) kvRows.push(["Cliente", meta.clienteLabel]);
  kvRows.push(["Fecha", meeting.fecha]);
  if (a.hablaron.length > 0) kvRows.push(["Participantes", a.hablaron.join(", ")]);

  const kvHtml = kvRows
    .map(
      ([k, v]) =>
        `<div class="kv"><span class="kv-k">${escapeHtml(k)}</span><span class="kv-v">${escapeHtml(v)}</span></div>`,
    )
    .join("");

  const body = `<section class="kv-card">${kvHtml}</section>
${meeting.resumen ? sectionBlock("Resumen", `<p class="prose">${escapeHtml(meeting.resumen)}</p>`) : ""}
${pointsSection("Puntos clave", a.puntos)}
${pointsSection("Decisiones", a.decisiones)}
${pointsSection("Quedó en el aire", a.pendientes)}
${proximaSection(a.proxima_reunion)}
${actaTasksSection("Tareas creadas", empleado, meta.nameByUserId)}
${cliente.length > 0 ? actaTasksSection("Entregables del cliente", cliente, meta.nameByUserId) : ""}
<p class="note">Los archivos adjuntos de cada tarea se consultan dentro de la app.</p>`;

  return docShell({
    docTitle: "Acta de reunión",
    generatedAt: meta.generatedAt,
    generatedBy: meta.generatedBy,
    logoDataUri: meta.logoDataUri,
    bodyHtml: body,
  });
}

// ─── Reporte HTML de tareas (Vista Lista → "Reporte (HTML)") ──

export interface TasksReportMeta {
  generatedAt: string;
  generatedBy: string;
  nameByUserId: Record<string, string>;
  meetingTitleById: Record<string, string>;
  logoDataUri?: string | null;
  /** Descripción del filtro activo, para el sub-encabezado (opcional). */
  filterLabel?: string | null;
}

/** HTML autocontenido de la lista de tareas (branding + `@media print`). PURA. */
export function buildTasksReportHtml(
  tasks: readonly BitacoraTask[],
  meta: TasksReportMeta,
): string {
  const rows = tasks
    .map((t) => {
      const done = t.checklist.filter((c) => c.done).length;
      const asign = asignadosText(t, meta.nameByUserId) || "Sin asignar";
      const reunion = t.meeting_id
        ? meta.meetingTitleById[t.meeting_id] ?? ""
        : "";
      const est = ESTADO_META[t.estado];
      const prio = PRIORIDAD_META[t.prioridad];
      return `<tr><td>${escapeHtml(t.titulo)}</td><td><span class="${badgeClass(est.tone)}">${escapeHtml(est.label)}</span></td><td><span class="${badgeClass(prio.tone)}">${escapeHtml(prio.label)}</span></td><td>${escapeHtml(asign)}</td><td class="mono">${escapeHtml(t.due_date ?? "—")}</td><td class="mono">${t.checklist.length > 0 ? `${done}/${t.checklist.length}` : "—"}</td><td>${escapeHtml(reunion || "—")}</td></tr>`;
    })
    .join("");

  const body = `${meta.filterLabel ? `<p class="filter-note">${escapeHtml(meta.filterLabel)}</p>` : ""}
<p class="count">${tasks.length} tarea${tasks.length === 1 ? "" : "s"}</p>
<table class="tasks-table"><thead><tr><th>Tarea</th><th>Estado</th><th>Prioridad</th><th>Dueño</th><th>Vence</th><th>Checklist</th><th>Reunión</th></tr></thead><tbody>${rows || `<tr><td colspan="7" class="empty">Sin tareas para exportar.</td></tr>`}</tbody></table>`;

  return docShell({
    docTitle: "Tareas del equipo",
    generatedAt: meta.generatedAt,
    generatedBy: meta.generatedBy,
    logoDataUri: meta.logoDataUri,
    bodyHtml: body,
  });
}

// ─── Nombres de archivo (Content-Disposition) ────────────────

/** Slug ascii-safe (a-z0-9-) para el filename — evita inyección en el header. */
function slugify(input: string): string {
  const clean = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
  return clean || "acta";
}

export function actaHtmlFilename(titulo: string, todayISO: string): string {
  return `acta-${todayISO}-${slugify(titulo)}.html`;
}

export function tasksCsvFilename(todayISO: string): string {
  return `tareas-${todayISO}.csv`;
}

export function tasksReportFilename(todayISO: string): string {
  return `tareas-${todayISO}.html`;
}

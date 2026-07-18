/**
 * Tests de los reportes de Bitácora (SDD-0146 · Fase 7).
 *
 * Todo PURO: BOM/CRLF/escape/columnas del CSV, y que el HTML sea autocontenido
 * (sin http/https de CDN salvo el data-URI del logo), escape XSS del acta, sin
 * signed URLs, y `@media print`.
 */

import { describe, it, expect } from "vitest";
import {
  buildActaHtml,
  buildTasksReportHtml,
  buildTasksCsv,
  filterTasksForExport,
  escapeHtml,
  csvCell,
  actaHtmlFilename,
  tasksCsvFilename,
  tasksReportFilename,
  TASKS_CSV_HEADERS,
} from "./reports";
import type { BitacoraTask, BitacoraChecklistItem } from "./bitacora-queries";
import type { ActaData } from "./bitacora-types";
import { UNASSIGNED_KEY } from "./grouping";

// ─── Fixtures ────────────────────────────────────────────────

function chk(over: Partial<BitacoraChecklistItem> = {}): BitacoraChecklistItem {
  return {
    id: "c",
    texto: "punto",
    done: false,
    done_by: null,
    done_at: null,
    orden: 0,
    ...over,
  };
}

function task(over: Partial<BitacoraTask> = {}): BitacoraTask {
  return {
    id: "t1",
    tenant_id: "ten",
    meeting_id: null,
    titulo: "Tarea",
    descripcion: null,
    estado: "pendiente",
    prioridad: "media",
    tipo: "empleado",
    assigned_role: null,
    para_agente: false,
    client_id: null,
    responsable_nombre: null,
    due_date: null,
    orden: 0,
    completed_at: null,
    created_by: null,
    created_at: "2026-07-04T09:30:00Z",
    updated_at: "2026-07-04T09:30:00Z",
    assignees: [],
    checklist: [],
    ...over,
  };
}

const nameByUserId = { u1: "Ana Pérez", u2: "José Ñandú" };
const meetingTitleById = { m1: "Reunión, semanal" };

// ─── escapeHtml ──────────────────────────────────────────────

describe("escapeHtml", () => {
  it("escapa < > & \" ' (con & primero, sin doble-escape)", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
    expect(escapeHtml("a & b")).toBe("a &amp; b");
    expect(escapeHtml('"x"')).toBe("&quot;x&quot;");
    expect(escapeHtml("it's")).toBe("it&#39;s");
    // & primero: "&lt;" que quiera inyectar no se re-escapa a "&amp;lt;"
    expect(escapeHtml("<")).toBe("&lt;");
  });

  it("null/undefined → cadena vacía", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });
});

// ─── csvCell ─────────────────────────────────────────────────

describe("csvCell", () => {
  it("deja pasar valores simples sin comillas", () => {
    expect(csvCell("hola")).toBe("hola");
    expect(csvCell(42)).toBe("42");
  });

  it("entrecomilla si hay coma, comilla o salto de línea", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('di "hola"')).toBe('"di ""hola"""');
    expect(csvCell("línea1\nlínea2")).toBe('"línea1\nlínea2"');
    expect(csvCell("con\r\ncrlf")).toBe('"con\r\ncrlf"');
  });

  it("null/undefined → vacío", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });
});

// ─── buildTasksCsv ───────────────────────────────────────────

describe("buildTasksCsv", () => {
  const t = task({
    titulo: 'Revisar "cotización", urgente',
    estado: "en_curso",
    prioridad: "alta",
    tipo: "entregable_cliente",
    due_date: "2026-07-10",
    meeting_id: "m1",
    created_at: "2026-07-04T09:30:00Z",
    assignees: [{ user_id: "u1" }, { user_id: "u2" }],
    checklist: [chk({ done: true }), chk({ done: false })],
  });
  const csv = buildTasksCsv([t], { nameByUserId, meetingTitleById });

  it("empieza con BOM UTF-8 (U+FEFF)", () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("usa CRLF entre líneas", () => {
    expect(csv).toContain("\r\n");
    // sin CRLF el header y la fila estarían pegados
    expect(csv.slice(1).split("\r\n").length).toBe(2);
  });

  it("tiene las columnas EXACTAS del spec", () => {
    const header = csv.slice(1).split("\r\n")[0];
    expect(header).toBe(
      "titulo,estado,prioridad,tipo,vence,asignados,checklist_hecho,checklist_total,reunion,creada",
    );
    expect(TASKS_CSV_HEADERS.length).toBe(10);
  });

  it("escapa comas y comillas del contenido (comilla interna duplicada)", () => {
    const row = csv.slice(1).split("\r\n")[1];
    expect(row).toContain('"Revisar ""cotización"", urgente"');
    // reunion con coma → entrecomillada
    expect(row).toContain('"Reunión, semanal"');
  });

  it("une asignados por '; ' y usa etiquetas es-VE", () => {
    const row = csv.slice(1).split("\r\n")[1];
    expect(row).toContain("Ana Pérez; José Ñandú");
    expect(row).toContain("En curso");
    expect(row).toContain("Alta");
    expect(row).toContain("Entregable de cliente");
  });

  it("fechas ISO (vence + creada) y conteo del checklist", () => {
    const row = csv.slice(1).split("\r\n")[1];
    expect(row).toContain("2026-07-10"); // vence
    expect(row).toContain("2026-07-04"); // creada (created_at recortado a fecha)
    expect(row).toContain(",1,2,"); // checklist_hecho=1, checklist_total=2
  });

  it("tarea sin dueño ni checklist → celdas vacías, sin romper", () => {
    const csv2 = buildTasksCsv([task()], { nameByUserId, meetingTitleById });
    const row = csv2.slice(1).split("\r\n")[1];
    // titulo,Pendiente,Media,Interna,(vence vacío),(asignados vacío),0,0,(reunion vacío),2026-07-04
    expect(row).toContain("Tarea,Pendiente,Media,Interna,,,0,0,,2026-07-04");
  });
});

// ─── filterTasksForExport ────────────────────────────────────

describe("filterTasksForExport", () => {
  const tasks = [
    task({ id: "a", estado: "pendiente", prioridad: "alta", tipo: "empleado", assignees: [{ user_id: "u1" }] }),
    task({ id: "b", estado: "hecho", prioridad: "baja", tipo: "entregable_cliente", assignees: [] }),
    task({ id: "c", estado: "en_curso", prioridad: "alta", tipo: "empleado", assignees: [{ user_id: "u2" }] }),
  ];

  it("filtro vacío = passthrough", () => {
    expect(filterTasksForExport(tasks, {}).length).toBe(3);
  });

  it("filtra por estado / prioridad / tipo", () => {
    expect(filterTasksForExport(tasks, { estado: "hecho" }).map((t) => t.id)).toEqual(["b"]);
    expect(filterTasksForExport(tasks, { prioridad: "alta" }).map((t) => t.id)).toEqual(["a", "c"]);
    expect(filterTasksForExport(tasks, { tipo: "entregable_cliente" }).map((t) => t.id)).toEqual(["b"]);
  });

  it("filtra por persona (dueño) y por sin-asignar", () => {
    expect(filterTasksForExport(tasks, { persona: "u2" }).map((t) => t.id)).toEqual(["c"]);
    expect(filterTasksForExport(tasks, { persona: UNASSIGNED_KEY }).map((t) => t.id)).toEqual(["b"]);
  });

  it("combina filtros (AND)", () => {
    expect(
      filterTasksForExport(tasks, { prioridad: "alta", tipo: "empleado", persona: "u1" }).map((t) => t.id),
    ).toEqual(["a"]);
  });
});

// ─── buildActaHtml ───────────────────────────────────────────

const acta: ActaData = {
  puntos: ["Punto normal", "<img src=x onerror=alert(1)>"],
  hablaron: ["Ana", "José"],
  decisiones: ["Se aprueba el flete"],
  pendientes: ["Confirmar naviera"],
  proxima_reunion: { fecha: "2026-07-11", foco: "Cierre" },
};

const meeting = {
  titulo: "Reunión con <b>ACME</b>",
  fecha: "2026-07-04",
  tipo: "cliente" as const,
  resumen: "Se acordó todo <script>alert('xss')</script>",
};

const actaTasks: BitacoraTask[] = [
  task({
    id: "e1",
    titulo: "Enviar cotización",
    tipo: "empleado",
    prioridad: "alta",
    due_date: "2026-07-08",
    assignees: [{ user_id: "u1" }],
    checklist: [chk({ texto: "armar PDF", done: true }), chk({ texto: "enviar", done: false })],
  }),
  task({
    id: "c1",
    titulo: "Recibir de ACME: packing list",
    tipo: "entregable_cliente",
    responsable_nombre: "ACME",
  }),
];

const actaMeta = {
  generatedAt: "04 de julio de 2026, 10:00",
  generatedBy: "Ana Pérez",
  nameByUserId,
  clienteLabel: "ACME · DTD-0001",
  logoDataUri: null,
};

describe("buildActaHtml", () => {
  const html = buildActaHtml(acta, meeting, actaTasks, actaMeta);

  it("es 100% autocontenido: sin http/https de CDN (sin logo → cero imágenes)", () => {
    expect(html).not.toContain("http://");
    expect(html).not.toContain("https://");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("@import");
    expect(html).not.toContain("url(");
  });

  it("embebe los tokens de marca en :root y el wordmark DTD Cargo", () => {
    expect(html).toContain(":root");
    expect(html).toContain("--wine:#7F0F1A");
    expect(html).toContain("--ink:#0F1E3D");
    expect(html).toContain(">DTD<");
    expect(html).toContain(">Cargo<");
  });

  it("incluye título y resumen ESCAPADOS (XSS)", () => {
    expect(html).toContain("Reunión con &lt;b&gt;ACME&lt;/b&gt;");
    expect(html).toContain("Se acordó todo &lt;script&gt;");
  });

  it("un <script> inyectado en el acta NO queda ejecutable", () => {
    // el template no emite ningún <script>; el inyectado va escapado
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img src=x onerror");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("tiene @media print con page-break y color-adjust exact", () => {
    expect(html).toContain("@media print");
    expect(html).toContain("page-break-inside:avoid");
    expect(html).toContain("print-color-adjust:exact");
  });

  it("NO embebe signed URLs de Storage ni tokens de acceso", () => {
    expect(html).not.toContain("supabase.co");
    expect(html).not.toContain("token=");
    expect(html).not.toContain("X-Amz");
    expect(html).not.toContain("/storage/v1/");
  });

  it("footer 'Generado por DTD Cargo · fecha · usuario'", () => {
    expect(html).toContain("Generado por DTD Cargo · 04 de julio de 2026, 10:00 · Ana Pérez");
  });

  it("lista las tareas creadas y los entregables del cliente", () => {
    expect(html).toContain("Enviar cotización");
    expect(html).toContain("Ana Pérez"); // responsable resuelto
    expect(html).toContain("armar PDF");
    expect(html).toContain("Entregables del cliente");
    expect(html).toContain("Recibir de ACME: packing list");
  });

  it("nota de adjuntos in-app (no se embeben archivos)", () => {
    expect(html).toContain("Los archivos adjuntos de cada tarea se consultan dentro de la app.");
  });

  it("con logo data-URI: lo embebe y SIGUE sin http/https", () => {
    const withLogo = buildActaHtml(acta, meeting, actaTasks, {
      ...actaMeta,
      logoDataUri: "data:image/png;base64,iVBORw0KGgoAAAANS",
    });
    expect(withLogo).toContain("data:image/png;base64,iVBORw0KGgoAAAANS");
    expect(withLogo).toContain('<img class="isologo"');
    expect(withLogo).not.toContain("http://");
    expect(withLogo).not.toContain("https://");
  });

  it("acta null (borrador sin análisis) no rompe", () => {
    const h = buildActaHtml(null, meeting, [], actaMeta);
    expect(h).toContain("Acta de reunión");
    expect(h).toContain("Sin tareas registradas.");
  });
});

// ─── buildTasksReportHtml ────────────────────────────────────

describe("buildTasksReportHtml", () => {
  const html = buildTasksReportHtml(actaTasks, {
    generatedAt: "04 de julio de 2026, 10:00",
    generatedBy: "Ana Pérez",
    nameByUserId,
    meetingTitleById,
    logoDataUri: null,
    filterLabel: "Filtro activo · Esperando al cliente",
  });

  it("autocontenido, con marca y @media print", () => {
    expect(html).not.toContain("http://");
    expect(html).not.toContain("https://");
    expect(html).toContain("@media print");
    expect(html).toContain("--wine:#7F0F1A");
    expect(html).toContain("Tareas del equipo");
  });

  it("escapa el contenido y muestra el filtro activo", () => {
    expect(html).toContain("Enviar cotización");
    expect(html).toContain("Filtro activo · Esperando al cliente");
    expect(html).toContain("2 tareas");
  });

  it("sin tareas → tabla vacía sin romper", () => {
    const empty = buildTasksReportHtml([], {
      generatedAt: "x",
      generatedBy: "y",
      nameByUserId,
      meetingTitleById,
    });
    expect(empty).toContain("Sin tareas para exportar.");
    expect(empty).toContain("0 tareas");
  });
});

// ─── Nombres de archivo ──────────────────────────────────────

describe("filenames", () => {
  it("acta: slug ascii-safe + fecha ISO inyectada", () => {
    expect(actaHtmlFilename("Reunión Semanal!! con ACME", "2026-07-04")).toBe(
      "acta-2026-07-04-reunion-semanal-con-acme.html",
    );
    // título vacío → fallback 'acta'
    expect(actaHtmlFilename("", "2026-07-04")).toBe("acta-2026-07-04-acta.html");
  });

  it("tareas csv/html", () => {
    expect(tasksCsvFilename("2026-07-04")).toBe("tareas-2026-07-04.csv");
    expect(tasksReportFilename("2026-07-04")).toBe("tareas-2026-07-04.html");
  });
});

// @vitest-environment node
/**
 * SDD-0549 · Academia y Reclamos del Portal por principal y tenant.
 *
 * Disposición infeliz: una sesión híbrida (cliente Portal del tenant A con el
 * Shipping Mark DTD-0001, y el mismo Shipping Mark existe en el tenant B). El
 * doble aplica los filtros y no modela la RLS: devuelve las filas de los DOS
 * tenants que pasen la consulta, como la policy permisiva «by tenant». Con el
 * código anterior (RPC `get_portal_client_markbox` + filtro sólo por Shipping
 * Mark) estas pruebas fallan: la Academia mezcla inscripciones, diplomas,
 * progreso y catálogo del tenant B, y Reclamos lista el reclamo ajeno.
 *
 * Las RPC legadas se siembran con el valor que devolvían, para que el código
 * anterior tuviera con qué correr: la diferencia la hace el filtro, no la RPC.
 */
import { describe, expect, it } from "vitest";
import {
  getPortalAcademy,
  getPortalCourseDetail,
  getPortalLesson,
} from "../portal-academy-queries";
import { listMyClaims } from "../portal-claims";
import {
  MARKBOX,
  TENANT_A,
  TENANT_B,
  portalDouble,
  portalMembership,
  type Row,
} from "./portal-tenant-double";

const LEGACY_RPC = { get_portal_client_markbox: MARKBOX, get_portal_client_tenant: TENANT_A };

function course(id: string, tenantId: string, title: string): Row {
  return { id, tenant_id: tenantId, title, tier: "inicial", summary: null, level: null, status: "publicado", deleted_at: null };
}

function lesson(id: string, tenantId: string, courseId: string, moduleId: string, sort: number): Row {
  return {
    id,
    tenant_id: tenantId,
    course_id: courseId,
    module_id: moduleId,
    title: `Lección ${id}`,
    sort,
    kind: "video",
    duration_min: 5,
    free_preview: false,
    widget: null,
    video_url: null,
    status: "publicado",
    deleted_at: null,
  };
}

function academyTables(membership: Row = portalMembership()): Record<string, Row[]> {
  return {
    client_users: [membership],
    academy_courses: [
      course("course-a", TENANT_A, "Curso A"),
      course("course-b", TENANT_B, "Curso B"),
      // Curso del tenant A donde sólo el tenant B tiene una inscripción con el
      // mismo Shipping Mark: para el principal no está inscrito.
      course("course-a2", TENANT_A, "Curso A2"),
    ],
    academy_modules: [
      { id: "mod-a", tenant_id: TENANT_A, course_id: "course-a", title: "Módulo A", sort: 1, deleted_at: null },
      { id: "mod-b", tenant_id: TENANT_B, course_id: "course-b", title: "Módulo B", sort: 1, deleted_at: null },
      // Fila incoherente del catálogo: módulo del tenant B colgado del curso A.
      // La policy Portal de 0418 la excluye por tenant; el filtro explícito también.
      { id: "mod-bx", tenant_id: TENANT_B, course_id: "course-a", title: "Módulo ajeno", sort: 2, deleted_at: null },
      { id: "mod-a2", tenant_id: TENANT_A, course_id: "course-a2", title: "Módulo A2", sort: 1, deleted_at: null },
      // Al revés: módulo del tenant A colgado del curso B. Sólo el filtro del
      // curso por tenant impide abrirlo desde el reproductor.
      { id: "mod-ax", tenant_id: TENANT_A, course_id: "course-b", title: "Módulo cruzado", sort: 1, deleted_at: null },
    ],
    academy_lessons: [
      lesson("les-a1", TENANT_A, "course-a", "mod-a", 1),
      lesson("les-a2", TENANT_A, "course-a", "mod-a", 2),
      lesson("les-b1", TENANT_B, "course-b", "mod-b", 1),
      // Lección incoherente: del tenant B, en el curso y módulo del A.
      lesson("les-bx", TENANT_B, "course-a", "mod-a", 3),
      lesson("les-a2-1", TENANT_A, "course-a2", "mod-a2", 1),
      lesson("les-ax", TENANT_A, "course-b", "mod-ax", 1),
    ],
    academy_enrollments: [
      { id: "enr-a", tenant_id: TENANT_A, course_id: "course-a", client_markbox: MARKBOX, deleted_at: null, academy_courses: { title: "Curso A", tier: "inicial" } },
      { id: "enr-b", tenant_id: TENANT_B, course_id: "course-b", client_markbox: MARKBOX, deleted_at: null, academy_courses: { title: "Curso B", tier: "pro" } },
      // Inscripción incoherente: del tenant B, sobre el curso A2 del tenant A.
      { id: "enr-bx", tenant_id: TENANT_B, course_id: "course-a2", client_markbox: MARKBOX, deleted_at: null, academy_courses: { title: "Curso A2", tier: "inicial" } },
    ],
    academy_diplomas: [
      { id: "dip-a", tenant_id: TENANT_A, client_markbox: MARKBOX, folio: "FOLIO-A", course_title: "Curso A", issued_at: "2026-10-01", deleted_at: null },
      { id: "dip-b", tenant_id: TENANT_B, client_markbox: MARKBOX, folio: "FOLIO-B", course_title: "Curso B", issued_at: "2026-10-02", deleted_at: null },
    ],
    academy_lesson_progress: [
      { tenant_id: TENANT_A, client_markbox: MARKBOX, course_id: "course-a", lesson_id: "les-a1" },
      // Progreso del tenant B con el mismo Shipping Mark sobre una lección del curso A.
      { tenant_id: TENANT_B, client_markbox: MARKBOX, course_id: "course-a", lesson_id: "les-a2" },
      { tenant_id: TENANT_B, client_markbox: MARKBOX, course_id: "course-b", lesson_id: "les-b1" },
    ],
  };
}

const ACADEMY_TABLES = [
  "academy_courses",
  "academy_modules",
  "academy_lessons",
  "academy_enrollments",
  "academy_diplomas",
  "academy_lesson_progress",
];

describe("SDD-0549 · Academia del Portal por principal y tenant", () => {
  it("«Mi academia» lista sólo inscripciones, diplomas y progreso del tenant del principal", async () => {
    const { db } = portalDouble({ tables: academyTables(), rpc: LEGACY_RPC });
    const academy = await getPortalAcademy(db);
    expect(academy.isMember).toBe(true);
    // Curso A: 2 lecciones publicadas del tenant A (les-bx es del B), 1 completada
    // por el tenant A (el progreso de les-a2 es del B).
    expect(academy.courses).toEqual([
      { courseId: "course-a", title: "Curso A", tier: "inicial", progressPct: 50, completed: false },
    ]);
    expect(academy.diplomas.map((d) => d.folio)).toEqual(["FOLIO-A"]);
  });

  it("el detalle de un curso propio no mezcla módulos, lecciones ni progreso de otro tenant", async () => {
    const { db } = portalDouble({ tables: academyTables(), rpc: LEGACY_RPC });
    const detail = await getPortalCourseDetail(db, "course-a");
    expect(detail?.enrolled).toBe(true);
    expect(detail?.modules.map((m) => m.id)).toEqual(["mod-a"]);
    expect(detail?.modules[0].lessons.map((l) => [l.id, l.done])).toEqual([
      ["les-a1", true],
      ["les-a2", false],
    ]);
    expect(detail?.progress).toEqual({ done: 1, total: 2, pct: 50, completed: false });
    expect(detail?.nextLessonId).toBe("les-a2");
  });

  it("una inscripción de otro tenant no abre un curso del principal: sus lecciones siguen bloqueadas", async () => {
    const { db } = portalDouble({ tables: academyTables(), rpc: LEGACY_RPC });
    const detail = await getPortalCourseDetail(db, "course-a2");
    expect(detail?.enrolled).toBe(false);
    expect(detail?.modules[0].lessons.map((l) => [l.id, l.locked])).toEqual([["les-a2-1", true]]);
  });

  it("un curso de otro tenant no existe para el principal, aunque tenga inscripción con su Shipping Mark", async () => {
    const { db } = portalDouble({ tables: academyTables(), rpc: LEGACY_RPC });
    await expect(getPortalCourseDetail(db, "course-b")).resolves.toBeNull();
    await expect(getPortalLesson(db, "course-b", "les-b1")).resolves.toBeNull();
    // Aunque el catálogo tenga filas del tenant A colgadas de ese curso.
    await expect(getPortalLesson(db, "course-b", "les-ax")).resolves.toBeNull();
  });

  it("el reproductor lista sólo las lecciones del tenant del principal", async () => {
    const { db } = portalDouble({ tables: academyTables(), rpc: LEGACY_RPC });
    const view = await getPortalLesson(db, "course-a", "les-a2");
    expect(view?.lessons).toEqual([
      { id: "les-a1", title: "Lección les-a1", done: true },
      { id: "les-a2", title: "Lección les-a2", done: false },
    ]);
    expect(view?.lesson.done).toBe(false);
    expect(view?.prevId).toBe("les-a1");
    expect(view?.nextId).toBeNull();
    await expect(getPortalLesson(db, "course-a", "les-bx")).resolves.toBeNull();
  });

  it("principal incoherente o sin sesión: corta antes de leer la Academia", async () => {
    for (const double of [
      portalDouble({ tables: academyTables(portalMembership({ clientTenant: TENANT_B })), rpc: LEGACY_RPC }),
      portalDouble({ tables: academyTables(portalMembership({ deletedAt: "2026-10-01T00:00:00Z" })), rpc: LEGACY_RPC }),
      portalDouble({ userId: null, tables: academyTables(), rpc: LEGACY_RPC }),
    ]) {
      await expect(getPortalAcademy(double.db)).resolves.toEqual({ isMember: false, courses: [], diplomas: [] });
      await expect(getPortalCourseDetail(double.db, "course-a")).resolves.toBeNull();
      await expect(getPortalLesson(double.db, "course-a", "les-a1")).resolves.toBeNull();
      expect(double.operations.filter((op) => ACADEMY_TABLES.includes(op.table))).toEqual([]);
      expect(double.rpcCalls).toEqual([]);
    }
  });
});

function claim(id: string, tenantId: string, code: string): Row {
  return {
    id,
    tenant_id: tenantId,
    client_markbox: MARKBOX,
    claim_code: code,
    claim_type: "danio",
    description: `Reclamo ${code}`,
    status: "abierto",
    amount_usd: 10,
    insured: false,
    shipment_code: null,
    container_code: null,
    resolution_note: null,
    created_at: "2026-10-01T00:00:00Z",
    deleted_at: null,
  };
}

function claimTables(membership: Row = portalMembership()): Record<string, Row[]> {
  return {
    client_users: [membership],
    client_claims: [
      claim("claim-a", TENANT_A, "RC-A"),
      claim("claim-b", TENANT_B, "RC-B"),
      { ...claim("claim-a-borrado", TENANT_A, "RC-A-BORRADO"), deleted_at: "2026-10-02T00:00:00Z" },
    ],
  };
}

describe("SDD-0549 · Reclamos del Portal por principal y tenant", () => {
  it("lista sólo los reclamos vivos del tenant del principal", async () => {
    const { db } = portalDouble({ tables: claimTables(), rpc: LEGACY_RPC });
    const claims = await listMyClaims(db);
    expect(claims.map((c) => c.code)).toEqual(["RC-A"]);
  });

  it("principal incoherente o sin sesión: lista vacía sin consultar reclamos", async () => {
    for (const double of [
      portalDouble({ tables: claimTables(portalMembership({ clientTenant: TENANT_B })), rpc: LEGACY_RPC }),
      portalDouble({ userId: null, tables: claimTables(), rpc: LEGACY_RPC }),
    ]) {
      await expect(listMyClaims(double.db)).resolves.toEqual([]);
      expect(double.on("client_claims")).toEqual([]);
      expect(double.rpcCalls).toEqual([]);
    }
  });
});

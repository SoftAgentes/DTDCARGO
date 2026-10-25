// @vitest-environment node
/**
 * SDD-0549 · Marcar/desmarcar una lección del Portal por principal y tenant.
 *
 * Sesión híbrida con el Shipping Mark DTD-0001 en los tenants A (el del
 * principal) y B. El doble aplica los filtros y no modela la RLS. Con el código
 * anterior (RPC `get_portal_client_markbox` y filtros sólo por Shipping Mark):
 * la inscripción del tenant B habilitaba sellar progreso, y el desmarcar
 * borraba el progreso del tenant B.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MARKBOX,
  TENANT_A,
  TENANT_B,
  portalDouble,
  portalMembership,
  type PortalDouble,
  type Row,
} from "@/lib/portal/__tests__/portal-tenant-double";

const h = vi.hoisted(() => ({ double: null as unknown as PortalDouble }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => h.double.db }));

import { setLessonComplete } from "../actions";

const LEGACY_RPC = { get_portal_client_markbox: MARKBOX, get_portal_client_tenant: TENANT_A };

function tables(membership: Row = portalMembership()): Record<string, Row[]> {
  return {
    client_users: [membership],
    academy_enrollments: [
      { id: "enr-a", tenant_id: TENANT_A, course_id: "course-a", client_markbox: MARKBOX, deleted_at: null },
      { id: "enr-b", tenant_id: TENANT_B, course_id: "course-b", client_markbox: MARKBOX, deleted_at: null },
    ],
    academy_lesson_progress: [
      { id: "prog-a1", tenant_id: TENANT_A, client_markbox: MARKBOX, course_id: "course-a", lesson_id: "les-a1" },
      // Progreso del tenant B, mismo Shipping Mark, sobre una lección colgada del curso A.
      { id: "prog-bx", tenant_id: TENANT_B, client_markbox: MARKBOX, course_id: "course-a", lesson_id: "les-bx" },
      { id: "prog-b1", tenant_id: TENANT_B, client_markbox: MARKBOX, course_id: "course-b", lesson_id: "les-b1" },
    ],
  };
}

const progressIds = () => h.double.store.academy_lesson_progress.map((r) => r.id).sort();

beforeEach(() => {
  h.double = portalDouble({ tables: tables(), rpc: LEGACY_RPC });
});

describe("SDD-0549 · setLessonComplete por principal y tenant", () => {
  it("completar una lección de un curso propio sella tenant y Shipping Mark del principal", async () => {
    await expect(setLessonComplete("course-a", "les-a2", true)).resolves.toEqual({ ok: true, done: true });
    const nuevo = h.double.store.academy_lesson_progress.find((r) => r.lesson_id === "les-a2");
    expect(nuevo).toMatchObject({ tenant_id: TENANT_A, client_markbox: MARKBOX, course_id: "course-a" });
    // Sin las RPC legadas: el tenant sale del principal.
    expect(h.double.rpcCalls).toEqual([]);
  });

  it("una inscripción del mismo Shipping Mark en otro tenant no habilita el progreso", async () => {
    await expect(setLessonComplete("course-b", "les-b2", true)).resolves.toEqual({
      ok: false,
      error: "No estás inscrito en este curso.",
    });
    expect(h.double.on("academy_lesson_progress")).toEqual([]);
    await expect(setLessonComplete("course-b", "les-b1", false)).resolves.toEqual({
      ok: false,
      error: "No estás inscrito en este curso.",
    });
    expect(progressIds()).toEqual(["prog-a1", "prog-b1", "prog-bx"]);
  });

  it("desmarcar borra sólo el progreso del tenant del principal", async () => {
    await expect(setLessonComplete("course-a", "les-bx", false)).resolves.toEqual({ ok: true, done: false });
    expect(progressIds()).toEqual(["prog-a1", "prog-b1", "prog-bx"]);
    await expect(setLessonComplete("course-a", "les-a1", false)).resolves.toEqual({ ok: true, done: false });
    expect(progressIds()).toEqual(["prog-b1", "prog-bx"]);
  });

  it("principal incoherente o sin sesión: corta sin tocar la Academia", async () => {
    for (const double of [
      portalDouble({ tables: tables(portalMembership({ clientTenant: TENANT_B })), rpc: LEGACY_RPC }),
      portalDouble({ userId: null, tables: tables(), rpc: LEGACY_RPC }),
    ]) {
      h.double = double;
      await expect(setLessonComplete("course-a", "les-a2", true)).resolves.toEqual({
        ok: false,
        error: "Tu sesión expiró. Vuelve a entrar.",
      });
      expect(double.operations.filter((op) => op.table !== "client_users")).toEqual([]);
      expect(double.rpcCalls).toEqual([]);
    }
  });
});

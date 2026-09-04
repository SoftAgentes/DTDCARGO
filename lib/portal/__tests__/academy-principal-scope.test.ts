import { beforeEach, describe, expect, it, vi } from "vitest";

type Membership = {
  client_id: string;
  tenant_id: string;
  clients: {
    id: string;
    tenant_id: string;
    markbox: string;
    name: string;
    email: null;
    phone: null;
    address: null;
    rif: null;
    doc_kind: null;
    city: null;
    state: null;
    deleted_at: string | null;
  };
};

type Operation = {
  table: string;
  op: "select" | "upsert" | "delete";
  filters: Array<[string, unknown]>;
  payload?: Record<string, unknown>;
};

const state = vi.hoisted(() => ({
  membership: null as Membership | null,
  operations: [] as Operation[],
  revalidated: [] as string[],
}));

function membership(clientTenant = "tenant-a", deletedAt: string | null = null): Membership {
  return {
    client_id: "client-a",
    tenant_id: "tenant-a",
    clients: {
      id: "client-a",
      tenant_id: clientTenant,
      markbox: "DTD-0001",
      name: "Alumno sintético",
      email: null,
      phone: null,
      address: null,
      rif: null,
      doc_kind: null,
      city: null,
      state: null,
      deleted_at: deletedAt,
    },
  };
}

function resultFor(table: string, single: boolean) {
  if (table === "client_users") return { data: state.membership, error: null };
  if (single && table === "academy_courses") {
    return {
      data: {
        id: "course-a", title: "Curso A", tier: "inicial", summary: null,
        level: null, status: "publicado",
      },
      error: null,
    };
  }
  if (single && table === "academy_enrollments") {
    return { data: { id: "enrollment-a" }, error: null };
  }
  return { data: [], error: null };
}

function database() {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: "portal-user" } }, error: null }),
    },
    rpc(name: string) {
      if (name === "get_portal_client_markbox") {
        return Promise.resolve({ data: state.membership?.clients.markbox ?? null, error: null });
      }
      if (name === "get_portal_client_tenant") {
        return Promise.resolve({ data: state.membership?.tenant_id ?? null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
    from(table: string) {
      let operation: Operation | null = null;
      const ensure = (op: Operation["op"]) => {
        if (!operation) {
          operation = { table, op, filters: [] };
          state.operations.push(operation);
        }
        return operation;
      };
      const chain = {
        select: () => { ensure("select"); return chain; },
        eq: (column: string, value: unknown) => {
          ensure("select").filters.push([column, value]);
          return chain;
        },
        is: (column: string, value: unknown) => {
          ensure("select").filters.push([column, value]);
          return chain;
        },
        in: (column: string, value: unknown) => {
          ensure("select").filters.push([column, value]);
          return chain;
        },
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => resultFor(table, true),
        upsert: async (payload: Record<string, unknown>) => {
          const op = ensure("upsert");
          op.op = "upsert";
          op.payload = payload;
          return { error: null };
        },
        delete: () => {
          const op = ensure("delete");
          op.op = "delete";
          return chain;
        },
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve(resultFor(table, false)).then(resolve),
      };
      return chain;
    },
  };
}

vi.mock("@/lib/db/server", () => ({ createClient: async () => database() }));
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => state.revalidated.push(path),
}));

import {
  getPortalAcademy,
  getPortalCourseDetail,
  getPortalLesson,
} from "@/lib/portal/portal-academy-queries";
import { setLessonComplete } from "@/app/portal/(app)/academia/actions";

function domainOperations() {
  return state.operations.filter((op) => op.table !== "client_users");
}

function expectTenant(op: Operation) {
  expect(op.filters).toContainEqual(["tenant_id", "tenant-a"]);
}

beforeEach(() => {
  state.membership = membership();
  state.operations.length = 0;
  state.revalidated.length = 0;
});

describe("SDD0387 · Academia Portal por principal y tenant", () => {
  it.each([
    ["tenant cruzado", () => membership("tenant-b")],
    ["cliente retirado", () => membership("tenant-a", "2026-09-03T00:00:00Z")],
  ])("principal %s no consulta Academia", async (_label, fixture) => {
    state.membership = fixture();
    expect(await getPortalAcademy(database() as never)).toEqual({
      isMember: false, courses: [], diplomas: [],
    });
    expect(domainOperations()).toEqual([]);
  });

  it("principal incoherente no escribe progreso", async () => {
    state.membership = membership("tenant-b");
    const result = await setLessonComplete("course-a", "lesson-a", true);
    expect(result.ok).toBe(false);
    expect(domainOperations()).toEqual([]);
    expect(state.revalidated).toEqual([]);
  });

  it("home fija tenant en todas las lecturas y markbox en las propias", async () => {
    await getPortalAcademy(database() as never);
    const operations = domainOperations();
    expect(operations.map((op) => op.table)).toEqual([
      "academy_enrollments", "academy_diplomas",
    ]);
    operations.forEach(expectTenant);
    operations.forEach((op) =>
      expect(op.filters).toContainEqual(["client_markbox", "DTD-0001"]));
  });

  it("detalle y lección fijan tenant en catálogo, inscripción y progreso", async () => {
    await getPortalCourseDetail(database() as never, "course-a");
    await getPortalLesson(database() as never, "course-a", "lesson-a");
    const operations = domainOperations();
    expect(operations).toHaveLength(9);
    operations.forEach(expectTenant);
    for (const op of operations.filter((item) =>
      ["academy_enrollments", "academy_lesson_progress"].includes(item.table))) {
      expect(op.filters).toContainEqual(["client_markbox", "DTD-0001"]);
    }
  });

  it("completar exige inscripción propia y persiste ids derivados", async () => {
    const result = await setLessonComplete("course-a", "lesson-a", true);
    expect(result).toEqual({ ok: true, done: true });
    const enrollment = domainOperations().find((op) => op.table === "academy_enrollments")!;
    expectTenant(enrollment);
    expect(enrollment.filters).toContainEqual(["client_markbox", "DTD-0001"]);
    const upsert = domainOperations().find((op) => op.op === "upsert")!;
    expect(upsert.payload).toEqual({
      tenant_id: "tenant-a",
      client_markbox: "DTD-0001",
      course_id: "course-a",
      lesson_id: "lesson-a",
    });
  });

  it("descompletar fija tenant, markbox, curso y lección", async () => {
    const result = await setLessonComplete("course-a", "lesson-a", false);
    expect(result).toEqual({ ok: true, done: false });
    const deletion = domainOperations().find((op) => op.op === "delete")!;
    expect(deletion.filters).toEqual(expect.arrayContaining([
      ["tenant_id", "tenant-a"],
      ["client_markbox", "DTD-0001"],
      ["course_id", "course-a"],
      ["lesson_id", "lesson-a"],
    ]));
  });
});

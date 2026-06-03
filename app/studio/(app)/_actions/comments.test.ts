import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests de las 4 server actions de Comentarios (SDD-0045) — cubren el GAP del
 * review (actions 0% antes). Foco: authz (solo-autor edita/borra), toggle on/off
 * idempotente, y validación. createClient/getUser/getUserTenantId/revalidatePath
 * y las queries que tocan I/O se mockean; la lógica de la action corre real.
 *
 * Patrón nuevo en el repo: es el primer test con vi.mock (las actions llaman
 * createClient() internamente, no es inyectable como las funciones puras).
 */

// ─── Mocks de dependencias con I/O ───────────────────────────
const mockGetUser = vi.fn();
const mockGetTenant = vi.fn();
const mockCreateClient = vi.fn();
const mockGetCommentById = vi.fn();
const mockLoadTenantUsers = vi.fn();
const mockRevalidate = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getUser: () => mockGetUser(),
  getUserTenantId: () => mockGetTenant(),
}));
vi.mock("@/lib/db/server", () => ({
  createClient: () => mockCreateClient(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => mockRevalidate(...a),
}));
vi.mock("@/lib/studio/comments/comments-queries", () => ({
  getCommentById: (...a: unknown[]) => mockGetCommentById(...a),
  loadTenantUsers: (...a: unknown[]) => mockLoadTenantUsers(...a),
}));

import {
  postComment,
  toggleReaction,
  editComment,
  deleteComment,
} from "./comments";

/**
 * Stub chainable de Supabase. `handler(state)` resuelve cada operación por
 * (table, op). op = primer verbo (insert/update/delete/upsert/select); los
 * filtros (eq/in/is/order/limit/select-tras-insert) solo encadenan. Terminales:
 * single()/maybeSingle() y `await builder` (thenable).
 */
type OpState = { table: string; op: string; payload?: unknown };
function makeSupabase(handler: (s: OpState) => { data?: unknown; error?: unknown }) {
  return {
    from(table: string) {
      const state: OpState = { table, op: "select" };
      let opSet = false;
      const setOp = (o: string) => {
        if (!opSet) {
          state.op = o;
          opSet = true;
        }
      };
      const resolve = () => Promise.resolve(handler(state));
      const builder: Record<string, unknown> = {
        select: () => {
          setOp("select");
          return builder;
        },
        insert: (p: unknown) => {
          setOp("insert");
          state.payload = p;
          return builder;
        },
        update: (p: unknown) => {
          setOp("update");
          state.payload = p;
          return builder;
        },
        delete: () => {
          setOp("delete");
          return builder;
        },
        upsert: (p: unknown) => {
          setOp("upsert");
          state.payload = p;
          return builder;
        },
        eq: () => builder,
        in: () => builder,
        is: () => builder,
        order: () => builder,
        limit: () => builder,
        single: () => resolve(),
        maybeSingle: () => resolve(),
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
          resolve().then(res, rej),
      };
      return builder;
    },
  };
}

function fd(body: string): FormData {
  const f = new FormData();
  f.set("body", body);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ id: "u1" });
  mockGetTenant.mockResolvedValue("t1");
  mockLoadTenantUsers.mockResolvedValue([]); // sin users → parseMentions = []
});

// ─── postComment ─────────────────────────────────────────────
describe("postComment", () => {
  it("rechaza sin sesión", async () => {
    mockGetUser.mockResolvedValue(null);
    mockCreateClient.mockReturnValue(makeSupabase(() => ({})));
    const res = await postComment("shipment", "e1", "DTDU-1", {}, fd("hola"));
    expect(res.error).toBe("No autenticado.");
  });

  it("rechaza entity_type inválido", async () => {
    mockCreateClient.mockReturnValue(makeSupabase(() => ({})));
    const res = await postComment("banana", "e1", null, {}, fd("hola"));
    expect(res.error).toBe("Tipo de entidad inválido.");
  });

  it("rechaza body vacío con fieldError", async () => {
    mockCreateClient.mockReturnValue(makeSupabase(() => ({})));
    const res = await postComment("shipment", "e1", null, {}, fd("   "));
    expect(res.fieldErrors?.body).toBeTruthy();
  });

  it("happy path: inserta y devuelve commentId", async () => {
    mockCreateClient.mockReturnValue(
      makeSupabase((s) =>
        s.table === "comments" && s.op === "insert"
          ? { data: { id: "c1" }, error: null }
          : { data: null, error: null },
      ),
    );
    const res = await postComment("shipment", "e1", "DTDU-1", {}, fd("hola @nadie"));
    expect(res.ok).toBe(true);
    expect(res.commentId).toBe("c1");
    expect(mockRevalidate).toHaveBeenCalledWith("/studio/tracking/e1");
  });

  it("error de insert se reporta sin romper", async () => {
    mockCreateClient.mockReturnValue(
      makeSupabase(() => ({ data: null, error: { message: "boom" } })),
    );
    const res = await postComment("shipment", "e1", null, {}, fd("hola"));
    expect(res.error).toBe("No se pudo publicar el comentario.");
  });
});

// ─── toggleReaction ──────────────────────────────────────────
describe("toggleReaction", () => {
  it("rechaza emoji fuera del set", async () => {
    mockCreateClient.mockReturnValue(makeSupabase(() => ({})));
    const res = await toggleReaction("c1", "💩");
    expect(res.ok).toBe(false);
    expect(res.error).toBe("Emoji inválido.");
  });

  it("toggle ON: sin reacción previa → insert", async () => {
    const calls: string[] = [];
    mockCreateClient.mockReturnValue(
      makeSupabase((s) => {
        calls.push(s.op);
        if (s.op === "select") return { data: null }; // no existe
        return { error: null }; // insert ok
      }),
    );
    const res = await toggleReaction("c1", "👍");
    expect(res.ok).toBe(true);
    expect(calls).toContain("insert");
    expect(calls).not.toContain("delete");
  });

  it("toggle OFF: con reacción previa → delete", async () => {
    const calls: string[] = [];
    mockCreateClient.mockReturnValue(
      makeSupabase((s) => {
        calls.push(s.op);
        if (s.op === "select") return { data: { id: "r1" } }; // ya existe
        return { error: null }; // delete ok
      }),
    );
    const res = await toggleReaction("c1", "👍");
    expect(res.ok).toBe(true);
    expect(calls).toContain("delete");
    expect(calls).not.toContain("insert");
  });
});

// ─── editComment ─────────────────────────────────────────────
describe("editComment", () => {
  it("rechaza si no es el autor", async () => {
    mockGetCommentById.mockResolvedValue({
      id: "c1",
      author_id: "OTRO",
      deleted_at: null,
      entity_type: "shipment",
      entity_id: "e1",
      entity_code: "DTDU-1",
    });
    mockCreateClient.mockReturnValue(makeSupabase(() => ({})));
    const res = await editComment("c1", {}, fd("editado"));
    expect(res.error).toBe("Solo el autor puede editar su comentario.");
  });

  it("rechaza si el comentario está soft-deleted", async () => {
    mockGetCommentById.mockResolvedValue({
      id: "c1",
      author_id: "u1",
      deleted_at: "2026-06-03T00:00:00Z",
      entity_type: "shipment",
      entity_id: "e1",
      entity_code: null,
    });
    mockCreateClient.mockReturnValue(makeSupabase(() => ({})));
    const res = await editComment("c1", {}, fd("editado"));
    expect(res.error).toBe("Comentario eliminado.");
  });

  it("happy path: autor edita → ok + revalida", async () => {
    mockGetCommentById.mockResolvedValue({
      id: "c1",
      author_id: "u1",
      deleted_at: null,
      entity_type: "shipment",
      entity_id: "e1",
      entity_code: "DTDU-1",
    });
    mockCreateClient.mockReturnValue(
      makeSupabase(() => ({ error: null })),
    );
    const res = await editComment("c1", {}, fd("editado"));
    expect(res.ok).toBe(true);
    expect(mockRevalidate).toHaveBeenCalledWith("/studio/tracking/e1");
  });
});

// ─── deleteComment ───────────────────────────────────────────
describe("deleteComment", () => {
  it("rechaza si no existe", async () => {
    mockGetCommentById.mockResolvedValue(null);
    mockCreateClient.mockReturnValue(makeSupabase(() => ({})));
    const res = await deleteComment("c1");
    expect(res.ok).toBe(false);
    expect(res.error).toBe("Comentario no encontrado.");
  });

  it("happy path: soft-delete → ok + revalida", async () => {
    mockGetCommentById.mockResolvedValue({
      id: "c1",
      author_id: "u1",
      deleted_at: null,
      entity_type: "shipment",
      entity_id: "e1",
      entity_code: "DTDU-1",
    });
    mockCreateClient.mockReturnValue(makeSupabase(() => ({ error: null })));
    const res = await deleteComment("c1");
    expect(res.ok).toBe(true);
    expect(mockRevalidate).toHaveBeenCalledWith("/studio/tracking/e1");
  });
});

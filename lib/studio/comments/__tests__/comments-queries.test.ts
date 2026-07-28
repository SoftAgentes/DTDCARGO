/**
 * Tests de comments-queries (SDD-0045) con un stub de SupabaseClient.
 *
 * Cubre criterios de aceptación §6 (Lib):
 *  - listComments devuelve hilo cronológico con autor + reacciones agrupadas
 *    + menciones (y myReactions del caller)
 *  - countUnreadMentions cuenta solo read_at is null del user actual
 *  - listMyMentions arma el item de bandeja con entidad + autor resuelto
 */

import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  listComments,
  countUnreadMentions,
  listMyMentions,
} from "../comments-queries";
import type { CommentTenantUser } from "../types";

const USERS: CommentTenantUser[] = [
  { id: "u-002", name: "Martina Acosta", avatar: "MA", role: "Comercial" },
  { id: "u-005", name: "Yusneidy Ramírez", avatar: "YR", role: "Operaciones" },
];

/**
 * Stub keyed por tabla. Cada tabla devuelve una cadena chainable que ignora los
 * filtros (eq/is/in/order/limit) y resuelve a las filas configuradas. Para
 * `head: true` (count), devuelve `{ count }`.
 */
function makeClient(tables: Record<string, unknown[]>): SupabaseClient {
  return {
    from(table: string) {
      const rows = tables[table] ?? [];
      const chain: Record<string, unknown> = {};
      const passthrough = () => chain;
      // bandera: si el select pidió count (head:true) la cadena resuelve a count
      let headCount = false;
      for (const m of ["eq", "is", "in", "order", "limit", "select"]) {
        chain[m] = (...args: unknown[]) => {
          if (m === "select" && args[1] && (args[1] as { head?: boolean }).head) {
            headCount = true;
          }
          return passthrough();
        };
      }
      chain.maybeSingle = () =>
        Promise.resolve({ data: rows[0] ?? null, error: null });
      // thenable: count si fue un head-select, data si no.
      chain.then = (resolve: (v: Record<string, unknown>) => unknown) =>
        Promise.resolve(
          headCount
            ? { count: rows.length, error: null }
            : { data: rows, error: null },
        ).then(resolve);
      return chain;
    },
  } as unknown as SupabaseClient;
}

describe("listComments", () => {
  it("arma hilo con autor, reacciones agrupadas, myReactions y menciones", async () => {
    const client = makeClient({
      comments: [
        {
          id: "c1",
          tenant_id: "t1",
          entity_type: "shipment",
          entity_id: "s1",
          entity_code: "DTDU-1",
          author_id: "u-002",
          body: "hola",
          parent_id: null,
          edited_at: null,
          created_at: "2026-06-01T10:00:00Z",
          deleted_at: null,
        },
      ],
      comment_reactions: [
        { comment_id: "c1", user_id: "u-005", emoji: "👍" },
        { comment_id: "c1", user_id: "u-002", emoji: "👍" },
        { comment_id: "c1", user_id: "u-002", emoji: "🔥" },
      ],
      comment_mentions: [{ comment_id: "c1", mentioned_user_id: "u-005" }],
    });

    const res = await listComments(client, "shipment", "s1", USERS, "u-002");
    expect(res).toHaveLength(1);
    const c = res[0];
    expect(c.author?.name).toBe("Martina Acosta");
    expect(c.reactions["👍"]).toEqual(["u-005", "u-002"]);
    expect(c.reactions["🔥"]).toEqual(["u-002"]);
    // caller u-002 reaccionó 👍 y 🔥
    expect(c.myReactions.sort()).toEqual(["🔥", "👍"].sort());
    expect(c.mentionedUserIds).toEqual(["u-005"]);
  });

  it("devuelve [] sin comentarios (no consulta reacciones)", async () => {
    const client = makeClient({ comments: [] });
    const res = await listComments(client, "shipment", "s1", USERS, "u-002");
    expect(res).toEqual([]);
  });

  it("autor null si el author_id no está en la lista de usuarios", async () => {
    const client = makeClient({
      comments: [
        {
          id: "c2",
          tenant_id: "t1",
          entity_type: "client",
          entity_id: "cl1",
          entity_code: "DTD-9",
          author_id: "u-999",
          body: "x",
          parent_id: null,
          edited_at: null,
          created_at: "2026-06-01T10:00:00Z",
          deleted_at: null,
        },
      ],
      comment_reactions: [],
      comment_mentions: [],
    });
    const res = await listComments(client, "client", "cl1", USERS, "u-002");
    expect(res[0].author).toBeNull();
    expect(res[0].reactions).toEqual({});
    expect(res[0].myReactions).toEqual([]);
  });
});

describe("countUnreadMentions", () => {
  it("cuenta las filas devueltas (RLS + filtro de la query acotan a no leídas del user)", async () => {
    const client = makeClient({
      comment_mentions: [{ id: "m1" }, { id: "m2" }, { id: "m3" }],
    });
    const n = await countUnreadMentions(client, "u-005");
    expect(n).toBe(3);
  });

  it("devuelve 0 sin menciones", async () => {
    const client = makeClient({ comment_mentions: [] });
    const n = await countUnreadMentions(client, "u-005");
    expect(n).toBe(0);
  });

  it("une el comentario padre activo para que el badge no cuente eliminados", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "eq", "is"]) {
      chain[method] = (...args: unknown[]) => {
        calls.push([method, ...args]);
        return chain;
      };
    }
    chain.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ count: 1, error: null }).then(resolve);
    const client = {
      from: () => chain,
    } as unknown as SupabaseClient;

    expect(await countUnreadMentions(client, "u-005")).toBe(1);
    expect(calls[0][0]).toBe("select");
    expect(calls[0][1]).toContain("comments!inner");
    expect(calls).toContainEqual(["is", "comment.deleted_at", null]);
  });
});

describe("listMyMentions", () => {
  it("arma el item de bandeja con entidad + autor resuelto", async () => {
    const client = makeClient({
      comment_mentions: [
        {
          id: "m1",
          comment_id: "c1",
          read_at: null,
          created_at: "2026-06-01T12:00:00Z",
          comment: {
            entity_type: "shipment",
            entity_id: "s1",
            entity_code: "DTDU-472816",
            body: "@Yusneidy R. revisá",
            author_id: "u-002",
          },
        },
      ],
    });
    const items = await listMyMentions(client, "u-005", USERS);
    expect(items).toHaveLength(1);
    expect(items[0].entity_code).toBe("DTDU-472816");
    expect(items[0].entity_type).toBe("shipment");
    expect(items[0].author?.name).toBe("Martina Acosta");
    expect(items[0].read_at).toBeNull();
  });

  it("descarta menciones cuyo comentario no vino (join nulo)", async () => {
    const client = makeClient({
      comment_mentions: [
        {
          id: "m2",
          comment_id: "c2",
          read_at: "2026-06-01T13:00:00Z",
          created_at: "2026-06-01T12:00:00Z",
          comment: null,
        },
      ],
    });
    const items = await listMyMentions(client, "u-005", USERS);
    expect(items).toEqual([]);
  });
});

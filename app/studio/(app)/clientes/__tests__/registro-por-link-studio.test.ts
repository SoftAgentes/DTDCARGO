/**
 * SDD-0646 · Las acciones del Studio del registro por link y del código real.
 *
 * Lo que defiende:
 *   1. el link lleva un token de 256 bits y NO lleva el Shipping Mark; a la base
 *      va sólo el sha256 del token;
 *   2. los errores de la RPC se traducen (permiso, ya tiene portal, sin migración);
 *   3. el alta con código escrito a mano NO llama a ningún generador, valida el
 *      formato antes de escribir y, si el código es el viejo de otra ficha, manda
 *      a recuperarlo ahí en vez de crear una ficha nueva.
 *
 * Supabase se mockea — sin red ni DB real.
 */
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({ redirect: () => {} }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/studio/welcome-email", () => ({ sendWelcomeEmail: async () => ({ ok: true }) }));

let denial: string | null = null;
vi.mock("@/lib/studio/rbac-guard", () => ({ moduleEditDenial: async () => denial }));

type RpcCall = { name: string; args: Record<string, unknown> };
let rpcCalls: RpcCall[] = [];
let rpcResult: { data: unknown; error: { code?: string; message: string } | null } = {
  data: null,
  error: null,
};
let historyRow: { client_id: string } | null = null;
let inserted: Record<string, unknown> | null = null;
let insertError: { code?: string; message: string } | null = null;

function makeSupabase() {
  return {
    from(table: string) {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        is: () => chain,
        ilike: () => chain,
        limit: () => chain,
        maybeSingle: async () => {
          if (table === "user_tenants") return { data: { tenant_id: "tenant-1" }, error: null };
          if (table === "client_markbox_history") return { data: historyRow, error: null };
          if (table === "clients") {
            return { data: { name: "Ana", phone: "0414-555-0101", markbox: "DTD-8007" }, error: null };
          }
          return { data: null, error: null };
        },
        insert(row: Record<string, unknown>) {
          inserted = row;
          return {
            select: () => ({
              single: async () =>
                insertError ? { data: null, error: insertError } : { data: { id: "c-1" }, error: null },
            }),
          };
        },
      };
      return chain;
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      if (name === "next_markbox") return { data: "DTD-9059", error: null };
      if (name === "portal_registration_link_create") return rpcResult;
      return { data: null, error: null };
    },
  };
}

vi.mock("@/lib/db/server", () => ({ createClient: async () => makeSupabase() }));

import { createClientAction, registrationLinkAction } from "../actions";

beforeEach(() => {
  denial = null;
  rpcCalls = [];
  rpcResult = { data: [{ link_id: "l-1", expires_at: "2026-11-30T12:00:00Z" }], error: null };
  historyRow = null;
  inserted = null;
  insertError = null;
});

describe("registrationLinkAction", () => {
  it("⭐ el link lleva un token de 256 bits, no el Shipping Mark, y a la base va sólo su hash", async () => {
    const res = await registrationLinkAction("c-1");
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const token = res.link.split("/registro/link/")[1];
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(res.link).not.toMatch(/DTD-|markbox/i);

    const call = rpcCalls.find((c) => c.name === "portal_registration_link_create");
    expect(call?.args).toEqual({
      p_client_id: "c-1",
      p_token_hash: createHash("sha256").update(token).digest("hex"),
    });
    expect(JSON.stringify(call?.args)).not.toContain(token);
    expect(res.whatsappRaw).toBe("04145550101");
  });

  it("dos links seguidos no repiten token", async () => {
    const a = await registrationLinkAction("c-1");
    const b = await registrationLinkAction("c-1");
    expect(a.ok && b.ok && a.link !== b.link).toBe(true);
  });

  it("sin permiso de edición no llega a la base", async () => {
    denial = "No tienes permiso para realizar esta acción.";
    const res = await registrationLinkAction("c-1");
    expect(res).toEqual({ ok: false, error: denial });
    expect(rpcCalls).toHaveLength(0);
  });

  it.each([
    [{ code: "42501", message: "No tienes permiso" }, "No tienes permiso para generar el link de registro."],
    [{ code: "22023", message: "El cliente ya tiene acceso al portal" }, "Este cliente ya tiene acceso al portal."],
    [{ code: "PGRST202", message: "not found" }, "Esta acción todavía no está disponible."],
    [{ code: "XX000", message: "boom interno" }, "No se pudo generar el link. Intenta de nuevo."],
  ])("traduce el error %o", async (error, mensaje) => {
    rpcResult = { data: null, error };
    const res = await registrationLinkAction("c-1");
    expect(res).toEqual({ ok: false, error: mensaje });
  });
});

function altaForm(extra: Record<string, string> = {}): FormData {
  const f = new FormData();
  f.set("doc_kind", "persona");
  f.set("name", "Ana Pérez");
  f.set("tier", "regular");
  f.set("rif", "V-12345678");
  for (const [k, v] of Object.entries(extra)) f.set(k, v);
  return f;
}

describe("createClientAction · Shipping Mark escrito a mano", () => {
  it("⭐ con código a mano no llama a ningún generador y guarda ese código", async () => {
    const res = await createClientAction({}, altaForm({ markbox: " vj-77 " }));
    expect(res.error).toBeUndefined();
    expect(res.createdMarkbox).toBe("VJ-77");
    expect(inserted?.markbox).toBe("VJ-77");
    expect(rpcCalls.map((c) => c.name)).not.toContain("next_markbox");
    expect(rpcCalls.map((c) => c.name)).not.toContain("next_markbox_aliado");
  });

  it("sin código sigue autogenerando", async () => {
    const res = await createClientAction({}, altaForm());
    expect(res.createdMarkbox).toBe("DTD-9059");
  });

  it("un formato inválido se rechaza antes de escribir", async () => {
    const res = await createClientAction({}, altaForm({ markbox: "VJ 77" }));
    expect(res.fieldErrors?.markbox).toMatch(/letras, números y guiones/);
    expect(inserted).toBeNull();
  });

  it("⭐ el código viejo de otra ficha manda a recuperarlo en esa ficha", async () => {
    historyRow = { client_id: "c-otro" };
    const res = await createClientAction({}, altaForm({ markbox: "VJ-77" }));
    expect(res.fieldErrors?.markbox).toContain("DTD-8007");
    expect(res.fieldErrors?.markbox).toMatch(/recupéralo/);
    expect(inserted).toBeNull();
  });

  it("el código vivo de otra ficha se dice como tal, no como carrera de correlativo", async () => {
    insertError = { code: "23505", message: 'duplicate key value violates unique constraint "clients_tenant_id_markbox_key"' };
    const res = await createClientAction({}, altaForm({ markbox: "VJ-77" }));
    expect(res.fieldErrors?.markbox).toBe("Ese Shipping Mark ya es de otro cliente.");
  });

  it("el candado de la base (código retirado) también se traduce", async () => {
    insertError = { code: "23505", message: "El Shipping Mark VJ-77 está retirado y reservado; no se reutiliza" };
    const res = await createClientAction({}, altaForm({ markbox: "VJ-77" }));
    expect(res.fieldErrors?.markbox).toMatch(/reservado/);
  });
});

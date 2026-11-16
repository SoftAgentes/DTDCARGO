/**
 * SDD-0646 · El POST público del registro por link.
 *
 * Lo que defiende:
 *   1. ⭐ completa la ficha existente: nunca pide un código nuevo
 *      (`next_markbox_service`) ni inserta en `clients`;
 *   2. a la base va el hash del token, nunca el token;
 *   3. un token sin forma ni se consulta; todo link inválido da el mismo mensaje;
 *   4. las validaciones son las del registro normal (`validateRegisterInput`);
 *   5. el correo con cuenta vuelve al campo del correo (y la base no gastó el link);
 *   6. si la cuenta o el vínculo fallan, queda `access_error` y el cliente sabe
 *      que lo contactamos; si todo sale, recibe el enlace de un clic y su código.
 *
 * Supabase se mockea — sin red ni DB real.
 */
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Call = { name: string; args: Record<string, unknown> };
let calls: Call[] = [];
let completeResult: { data: unknown; error: { code?: string; message: string } | null };
let bindError: { message: string } | null = null;
let createUserError: { message: string } | null = null;
let fromTables: string[] = [];

const admin = {
  rpc: async (name: string, args: Record<string, unknown>) => {
    calls.push({ name, args });
    if (name === "portal_registration_link_complete") return completeResult;
    if (name === "portal_registration_link_bind") return { data: null, error: bindError };
    return { data: null, error: null };
  },
  from: (t: string) => {
    fromTables.push(t);
    throw new Error(`no debería tocar la tabla ${t}`);
  },
  auth: {
    admin: {
      createUser: async (args: Record<string, unknown>) => {
        calls.push({ name: "createUser", args });
        return createUserError
          ? { data: { user: null }, error: createUserError }
          : { data: { user: { id: "auth-1" } }, error: null };
      },
    },
  },
};

vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => admin }));
vi.mock("@/lib/studio/portal-invite-email", () => ({
  generatePortalAccessLink: async () => "https://auth.example.test/magic",
}));

import { registerByLinkAction } from "../actions";
import { REGISTRO_LINK_INVALIDO } from "@/lib/portal/registro-link-types";

const TOKEN = "A".repeat(43);

function form(extra: Record<string, string> = {}): FormData {
  const f = new FormData();
  f.set("token", TOKEN);
  f.set("kind", "persona");
  f.set("name", "Ana Pérez");
  f.set("document", "V12345678");
  f.set("email", "Ana@Example.test");
  f.set("whatsapp", "+58 4145550101");
  f.set("city", "Valencia");
  f.set("state", "Carabobo");
  for (const [k, v] of Object.entries(extra)) f.set(k, v);
  return f;
}

beforeEach(() => {
  calls = [];
  fromTables = [];
  bindError = null;
  createUserError = null;
  completeResult = {
    data: [{ client_id: "c-1", markbox: "DTD-8001", email: "ana@example.test", link_id: "l-1" }],
    error: null,
  };
});

describe("registerByLinkAction", () => {
  it("⭐ completa la ficha existente, sin código nuevo ni insert, y deja al cliente dentro", async () => {
    const res = await registerByLinkAction({}, form());

    expect(res).toEqual({
      ok: true,
      markbox: "DTD-8001",
      portalUrl: "https://auth.example.test/magic",
    });
    const nombres = calls.map((c) => c.name);
    expect(nombres).toEqual([
      "portal_registration_link_complete",
      "createUser",
      "portal_registration_link_bind",
    ]);
    expect(nombres).not.toContain("next_markbox_service");
    expect(fromTables).toEqual([]);
  });

  it("⭐ a la base va el hash del token, nunca el token, y los datos ya normalizados", async () => {
    await registerByLinkAction({}, form());
    const args = calls[0].args;
    expect(args.p_token_hash).toBe(createHash("sha256").update(TOKEN).digest("hex"));
    expect(JSON.stringify(args)).not.toContain(TOKEN);
    expect(args.p_document).toBe("V-12345678");
    expect(args.p_email).toBe("ana@example.test");
    expect(args).not.toHaveProperty("p_markbox");
  });

  it("la contraseña de la cuenta es aleatoria, nunca la cédula", async () => {
    await registerByLinkAction({}, form());
    const pw = calls.find((c) => c.name === "createUser")?.args.password as string;
    expect(pw.length).toBeGreaterThanOrEqual(32);
    expect(pw).not.toContain("12345678");
  });

  it("un token sin forma no se consulta", async () => {
    const res = await registerByLinkAction({}, form({ token: "DTD-8001" }));
    expect(res).toEqual({ error: REGISTRO_LINK_INVALIDO });
    expect(calls).toHaveLength(0);
  });

  it("el honeypot corta sin escribir nada", async () => {
    const res = await registerByLinkAction({}, form({ empresa_web: "bot" }));
    expect(res.error).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it("las validaciones son las del registro normal", async () => {
    const res = await registerByLinkAction({}, form({ document: "123", email: "no-es-correo", city: "" }));
    expect(res.fieldErrors?.document).toMatch(/inválido/);
    expect(res.fieldErrors?.email).toBe("Email inválido.");
    expect(res.fieldErrors?.city).toBe("Indica tu ciudad.");
    expect(calls).toHaveLength(0);
  });

  it("todo link que no sirve da el mismo mensaje", async () => {
    completeResult = { data: null, error: { code: "P0002", message: "link_invalido" } };
    const res = await registerByLinkAction({}, form());
    expect(res).toEqual({ error: REGISTRO_LINK_INVALIDO });
    expect(calls.map((c) => c.name)).toEqual(["portal_registration_link_complete"]);
  });

  it("el correo con cuenta vuelve al campo del correo", async () => {
    completeResult = { data: null, error: { code: "23505", message: "correo_en_uso" } };
    const res = await registerByLinkAction({}, form());
    expect(res.fieldErrors?.email).toMatch(/ya tiene una cuenta/);
  });

  it("si la cuenta de auth falla, queda anotado y el cliente sabe que lo contactamos", async () => {
    createUserError = { message: "rate limit" };
    const res = await registerByLinkAction({}, form());
    expect(res.ok).toBe(true);
    expect(res.markbox).toBe("DTD-8001");
    expect(res.portalUrl).toBeNull();
    expect(res.warning).toMatch(/Te contactamos/);
    const nota = calls.find((c) => c.name === "portal_registration_link_access_error");
    expect(nota?.args.p_link_id).toBe("l-1");
  });

  it("si el vínculo falla, también queda anotado", async () => {
    bindError = { message: "ya tiene acceso" };
    const res = await registerByLinkAction({}, form());
    expect(res.warning).toMatch(/Te contactamos/);
    expect(calls.map((c) => c.name)).toContain("portal_registration_link_access_error");
  });
});

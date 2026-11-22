/**
 * SDD-0672 (entrega 2) · El POST del enlace de autoservicio.
 *
 * Lo que defiende:
 *   1. ⭐ la guarda: si la base dice `no_coincide`, no se crea cuenta ni acceso,
 *      y el mensaje NO dice cuál dato falló — es el mismo que para un correo que
 *      ya tiene cuenta;
 *   2. ⭐ con el mismo correo al que llegó el enlace, la cuenta nace con el correo
 *      real (probado) y se vincula con `bind_self`, sin «sin comprobar»;
 *   3. ⭐ con otro correo, el camino de la SDD-0646 D-1: dirección interna, bind de
 *      la 0559 y comprobación al correo nuevo;
 *   4. a la base va el hash del token; un token sin forma ni se consulta;
 *   5. sin la migración 0562, «enlace no disponible», sin tocar nada;
 *   6. si la cuenta o el vínculo fallan, queda `access_error` y el cliente sabe
 *      que lo contactamos.
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
let throttleCount = 0;
let accessLinkEmails: string[] = [];

const admin = {
  rpc: async (name: string, args: Record<string, unknown>) => {
    calls.push({ name, args });
    if (name === "portal_registration_link_complete_self") return completeResult;
    if (name === "portal_registration_link_bind_self") return { data: null, error: bindError };
    if (name === "portal_registration_link_bind") return { data: null, error: bindError };
    if (name === "portal_email_check_issue") {
      return {
        data: [{ tenant_id: "t-1", markbox: "DTD-8001", pending_email: "otro@example.test" }],
        error: null,
      };
    }
    return { data: null, error: null };
  },
  from: (t: string) => {
    if (t === "client_email_checks") {
      const check = {
        select: () => check,
        eq: () => check,
        maybeSingle: async () => ({ data: { id: "chk-1" }, error: null }),
      };
      return check;
    }
    if (t !== "portal_registro_throttle") throw new Error(`no debería tocar la tabla ${t}`);
    const chain = {
      select: () => chain,
      eq: () => chain,
      gte: async () => ({ count: throttleCount, error: null }),
      insert: async () => ({ error: null }),
    };
    return chain;
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
vi.mock("@/lib/studio/registro-link-aviso-email", () => ({
  sendRegistroLinkAvisoEmail: async (_a: unknown, tenantId: string, input: Record<string, unknown>) => {
    calls.push({ name: "aviso", args: { tenantId, ...input } });
    return { ok: true };
  },
}));
vi.mock("@/lib/http/request-ip", () => ({ getRequestIp: async () => "203.0.113.7" }));
vi.mock("@/lib/studio/portal-invite-email", () => ({
  generatePortalAccessLink: async (_a: unknown, email: string) => {
    accessLinkEmails.push(email);
    return "https://auth.example.test/magic";
  },
}));

import { registerBySelfLinkAction } from "../actions";
import { esCorreoInterno } from "@/lib/portal/correo-comprobacion";
import {
  REGISTRO_AUTOSERVICIO_INVALIDO,
  REGISTRO_AUTOSERVICIO_NO_SIRVEN,
} from "@/lib/portal/registro-link-types";

const TOKEN = "B".repeat(43);

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

function okRow(correoProbado: boolean) {
  return {
    data: [
      {
        estado: "ok",
        client_id: "c-1",
        tenant_id: "t-1",
        markbox: "DTD-8001",
        email: correoProbado ? "ana@example.test" : "otro@example.test",
        link_id: "l-1",
        correo_probado: correoProbado,
        duplicate_matched_by: null,
        rif_skipped: false,
      },
    ],
    error: null,
  };
}

beforeEach(() => {
  calls = [];
  throttleCount = 0;
  bindError = null;
  createUserError = null;
  accessLinkEmails = [];
  completeResult = okRow(true);
});

const nombres = () => calls.map((c) => c.name);

describe("registerBySelfLinkAction", () => {
  it("⭐ con el correo al que llegó el enlace: cuenta con el correo real, bind_self y adentro", async () => {
    const res = await registerBySelfLinkAction({}, form());

    expect(res).toEqual({ ok: true, markbox: "DTD-8001", portalUrl: "https://auth.example.test/magic" });
    expect(nombres()).toEqual([
      "portal_registration_link_complete_self",
      "createUser",
      "portal_registration_link_bind_self",
    ]);
    const crear = calls.find((c) => c.name === "createUser")!.args;
    expect(crear.email).toBe("ana@example.test");
    expect(crear.email_confirm).toBe(true);
    // Contraseña aleatoria, nunca la cédula.
    expect(String(crear.password)).not.toContain("12345678");
    expect(accessLinkEmails).toEqual(["ana@example.test"]);
    // Nada de «sin comprobar»: ni bind de la 0559 ni enlace de comprobación.
    expect(nombres()).not.toContain("portal_registration_link_bind");
    expect(nombres()).not.toContain("portal_email_check_issue");
  });

  it("⭐ con otro correo: dirección interna, bind de la 0559 y comprobación al correo nuevo", async () => {
    completeResult = okRow(false);

    const res = await registerBySelfLinkAction({}, form({ email: "otro@example.test" }));

    expect(res).toMatchObject({ ok: true, markbox: "DTD-8001", correoPorComprobar: true });
    const crear = calls.find((c) => c.name === "createUser")!.args;
    expect(esCorreoInterno(String(crear.email))).toBe(true);
    expect(nombres()).toContain("portal_registration_link_bind");
    expect(nombres()).not.toContain("portal_registration_link_bind_self");
    expect(nombres()).toContain("portal_email_check_issue");
    expect(accessLinkEmails).toEqual([crear.email]);
  });

  it("⭐ si los datos no coinciden con la ficha: ni cuenta ni acceso, y el mensaje no dice cuál dato", async () => {
    completeResult = {
      data: [{ estado: "no_coincide", client_id: null, tenant_id: null, markbox: null, email: null, link_id: null, correo_probado: null }],
      error: null,
    };

    const res = await registerBySelfLinkAction({}, form());

    expect(res).toEqual({ error: REGISTRO_AUTOSERVICIO_NO_SIRVEN });
    expect(nombres()).toEqual(["portal_registration_link_complete_self"]);
    // Nombra el canal de ayuda (WhatsApp), nunca el dato que se comparó.
    expect(res.error).not.toMatch(/cédula|RIF|documento|teléfono|correo|coincid/i);
  });

  it("⭐ un correo con cuenta da el MISMO mensaje que un dato que no coincide", async () => {
    completeResult = { data: null, error: { code: "23505", message: "correo_en_uso" } };
    const res = await registerBySelfLinkAction({}, form());
    expect(res).toEqual({ error: REGISTRO_AUTOSERVICIO_NO_SIRVEN });
    expect(nombres()).toEqual(["portal_registration_link_complete_self"]);
  });

  it("a la base va el hash del token, nunca el token", async () => {
    await registerBySelfLinkAction({}, form());
    const args = calls[0].args;
    expect(args.p_token_hash).toBe(createHash("sha256").update(TOKEN, "utf8").digest("hex"));
    expect(JSON.stringify(calls)).not.toContain(TOKEN);
  });

  it("un token sin forma ni se consulta", async () => {
    const res = await registerBySelfLinkAction({}, form({ token: "corto" }));
    expect(res).toEqual({ error: REGISTRO_AUTOSERVICIO_INVALIDO });
    expect(calls).toEqual([]);
  });

  it.each([
    [{ code: "P0002", message: "link_invalido" }],
    [{ code: "PGRST202", message: "no existe" }],
    [{ code: "42883", message: "no existe" }],
  ])("enlace inválido o sin la migración 0562 (%j): «no disponible» y nada más", async (error) => {
    completeResult = { data: null, error };
    const res = await registerBySelfLinkAction({}, form());
    expect(res).toEqual({ error: REGISTRO_AUTOSERVICIO_INVALIDO });
    expect(nombres()).toEqual(["portal_registration_link_complete_self"]);
  });

  it("las validaciones son las del registro: sin cédula no se consulta la base", async () => {
    const res = await registerBySelfLinkAction({}, form({ document: "" }));
    expect(res.fieldErrors?.document).toBeTruthy();
    expect(calls).toEqual([]);
  });

  it("el throttle por IP corta antes de tocar la ficha", async () => {
    throttleCount = 5;
    const res = await registerBySelfLinkAction({}, form());
    expect(res.error).toMatch(/demasiados intentos/i);
    expect(calls).toEqual([]);
  });

  it("si la cuenta no se puede crear: access_error y «te contactamos»", async () => {
    createUserError = { message: "boom" };
    const res = await registerBySelfLinkAction({}, form());
    expect(res).toMatchObject({ ok: true, markbox: "DTD-8001", portalUrl: null });
    expect(res.warning).toMatch(/te contactamos/i);
    expect(nombres()).toContain("portal_registration_link_access_error");
  });

  it("si bind_self falla: access_error y «te contactamos»", async () => {
    bindError = { message: "ya tiene fila" };
    const res = await registerBySelfLinkAction({}, form());
    expect(res.warning).toMatch(/te contactamos/i);
    expect(nombres()).toContain("portal_registration_link_access_error");
    expect(accessLinkEmails).toEqual([]);
  });

  it("el campo trampa lleno no toca nada", async () => {
    const res = await registerBySelfLinkAction({}, form({ empresa_web: "bot" }));
    expect(res.error).toBeTruthy();
    expect(calls).toEqual([]);
  });
});

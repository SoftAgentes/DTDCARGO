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
 *      que lo contactamos; si todo sale, recibe el enlace de un clic y su código;
 *   7. ⭐ D-1 (opción C): el correo que escribió NO entra a la cuenta de Auth. La
 *      cuenta nace con una dirección interna, la entrada se acuña para esa
 *      dirección, y al correo sólo le llega el enlace de comprobación.
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
let throttleCount = 0;
let issueError: { message: string } | null = null;
let accessLinkEmails: string[] = [];

const admin = {
  rpc: async (name: string, args: Record<string, unknown>) => {
    calls.push({ name, args });
    if (name === "portal_registration_link_complete") return completeResult;
    if (name === "portal_registration_link_bind") return { data: null, error: bindError };
    if (name === "portal_email_check_issue") {
      return issueError
        ? { data: null, error: issueError }
        : {
            data: [{ tenant_id: "t-1", markbox: "DTD-8001", pending_email: "ana@example.test" }],
            error: null,
          };
    }
    return { data: null, error: null };
  },
  from: (t: string) => {
    fromTables.push(t);
    // Accesos directos permitidos: el throttle de /registro y la fila de
    // comprobación del propio registro. Nunca `clients`.
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

import { registerByLinkAction } from "../actions";
import { esCorreoInterno } from "@/lib/portal/correo-comprobacion";
import {
  REGISTRO_LINK_DATOS_NO_SIRVEN,
  REGISTRO_LINK_INVALIDO,
} from "@/lib/portal/registro-link-types";

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
  throttleCount = 0;
  bindError = null;
  createUserError = null;
  issueError = null;
  accessLinkEmails = [];
  completeResult = {
    data: [
      { client_id: "c-1", tenant_id: "t-1", markbox: "DTD-8001", email: "ana@example.test", link_id: "l-1" },
    ],
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
      correoPorComprobar: true,
    });
    const nombres = calls.map((c) => c.name);
    expect(nombres).toEqual([
      "portal_registration_link_complete",
      "createUser",
      "portal_registration_link_bind",
      "portal_email_check_issue",
      "aviso",
    ]);
    expect(nombres).not.toContain("next_markbox_service");
    // Sólo el throttle (lectura + intento) y la fila de comprobación; nunca `clients`.
    expect(new Set(fromTables)).toEqual(new Set(["portal_registro_throttle", "client_email_checks"]));
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

  it("⭐ D-1: el correo que escribió NO entra a la cuenta de Auth: nace con una dirección interna", async () => {
    await registerByLinkAction({}, form());
    const cuenta = calls.find((c) => c.name === "createUser")?.args;
    expect(esCorreoInterno(String(cuenta?.email))).toBe(true);
    expect(cuenta?.email_confirm).toBe(false);
    // Ni en el correo ni en ningún otro dato de la cuenta va el correo real.
    expect(JSON.stringify(cuenta).toLowerCase()).not.toContain("ana@example.test");
    // La dirección interna no sale del Shipping Mark, del nombre ni de la cédula.
    expect(String(cuenta?.email)).not.toMatch(/8001|ana|12345678/i);
  });

  it("⭐ D-1: la entrada directa se acuña para la dirección interna, nunca para el correo real", async () => {
    await registerByLinkAction({}, form());
    const interna = String(calls.find((c) => c.name === "createUser")?.args.email);
    expect(accessLinkEmails).toEqual([interna]);
  });

  it("⭐ D-1: al correo le llega SOLO el enlace de comprobación, con el Shipping Mark y sin nombre", async () => {
    await registerByLinkAction({}, form());
    const aviso = calls.find((c) => c.name === "aviso")?.args as Record<string, string>;
    expect(Object.keys(aviso).sort()).toEqual(["email", "markbox", "tenantId", "url"]);
    expect(aviso.email).toBe("ana@example.test");
    expect(aviso.markbox).toBe("DTD-8001");
    // El enlace es el de comprobación, no uno de entrada.
    expect(aviso.url).toMatch(/\/registro\/correo\/[A-Za-z0-9_-]{43}$/);
    expect(aviso.url).not.toBe("https://auth.example.test/magic");
    // A la base va el hash de ese token, nunca el token.
    const token = aviso.url.split("/registro/correo/")[1];
    const emitido = calls.find((c) => c.name === "portal_email_check_issue")?.args;
    expect(emitido?.p_check_id).toBe("chk-1");
    expect(emitido?.p_token_hash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(JSON.stringify(emitido)).not.toContain(token);
  });

  it("D-1: si el correo de comprobación no sale, el cliente entra igual (lo reenvía el equipo)", async () => {
    issueError = { message: "boom" };
    const res = await registerByLinkAction({}, form());
    expect(res.ok).toBe(true);
    expect(res.portalUrl).toBe("https://auth.example.test/magic");
    expect(calls.map((c) => c.name)).not.toContain("aviso");
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

  it("⭐ el correo con cuenta da un mensaje genérico, sin señalar el correo", async () => {
    completeResult = { data: null, error: { code: "23505", message: "correo_en_uso" } };
    const res = await registerByLinkAction({}, form());
    expect(res).toEqual({ error: REGISTRO_LINK_DATOS_NO_SIRVEN });
    expect(JSON.stringify(res)).not.toMatch(/cuenta|correo/i);
  });

  it("⭐ con el tope de la IP alcanzado no se consulta el link", async () => {
    throttleCount = 5;
    const res = await registerByLinkAction({}, form());
    expect(res.error).toMatch(/Demasiados intentos/);
    expect(calls).toHaveLength(0);
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

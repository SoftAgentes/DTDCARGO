/**
 * SDD-0646 (D-1, opción C) · El enlace de comprobación del correo.
 *
 * Lo que defiende:
 *   1. ⭐ EL ENLACE SOLO NO COMPRUEBA: sin la sesión del portal no se consulta ni
 *      se gasta nada; el usuario sale de la sesión, nunca del formulario; y la
 *      base recibe ese usuario al reclamar y al confirmar;
 *   2. ⭐ con la sesión de OTRA cuenta tampoco: mismo texto que sin sesión, sin
 *      tocar Auth;
 *   3. ⭐ SOLO comprueba: no crea sesión ni acuña ningún enlace de entrada. El
 *      doble de Auth no tiene `generateLink`, `createUser` ni nada de sesión: si
 *      la acción los tocara, la prueba revienta;
 *   4. ⭐ un GET no lo gasta: la página sólo llama a `peek`;
 *   5. vencido, usado, reemplazado o inventado: un solo mensaje, sin tocar Auth;
 *   6. a la base va el hash del token, nunca el token;
 *   7. si ese correo ya tiene otra cuenta: mensaje genérico, queda marcado y no
 *      se toca ninguna cuenta; un 422 a secas NO es un choque;
 *   8. cada paso de la vuelta se revisa: si no se puede deshacer, el enlace no
 *      se suelta y queda para revisión del equipo;
 *   9. ni la pantalla de éxito ni la de error ofrecen una entrada al portal.
 *
 * Supabase se mockea — sin red ni DB real.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Call = { name: string; args: Record<string, unknown> };
type Err = { status?: number; code?: string; message: string } | null;
let calls: Call[] = [];
let claimResult: { data: unknown; error: Err };
/** Errores de `updateUserById`, en orden de llamada (ida, vuelta). */
let authErrors: Err[] = [];
let confirmError: Err = null;
let filaError: Err = null;
/** Lo que la base dice de la fila al releerla después de un error de confirmar. */
let filaVerificada: string | null = null;
let releaseError: Err = null;
/** Lo que `getUserById` dice de la cuenta (para la respuesta perdida). */
let cuentaActual: { email: string | null; error?: Err } = { email: null };
let sessionUser: { id: string } | null = { id: "auth-1" };
let sessionThrows = false;
const INTERNA = `c-${"a".repeat(32)}@sin-comprobar.invalid`;

const admin = {
  rpc: async (name: string, args: Record<string, unknown>) => {
    calls.push({ name, args });
    if (name === "portal_email_check_claim") return claimResult;
    if (name === "portal_email_check_confirm") return { data: null, error: confirmError };
    if (name === "portal_email_check_release") return { data: null, error: releaseError };
    return { data: null, error: null };
  },
  from: (t: string) => {
    calls.push({ name: `from:${t}`, args: {} });
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () =>
        filaError
          ? { data: null, error: filaError }
          : { data: { internal_email: INTERNA, verified_at: filaVerificada }, error: null },
    };
    return chain;
  },
  auth: {
    // A propósito: SÓLO `updateUserById` y `getUserById` (leer). Nada que cree
    // una sesión, un usuario o un enlace de entrada existe en este doble.
    admin: {
      getUserById: async (id: string) => {
        calls.push({ name: "getUserById", args: { id } });
        return cuentaActual.error
          ? { data: { user: null }, error: cuentaActual.error }
          : { data: { user: cuentaActual.email ? { id, email: cuentaActual.email } : null }, error: null };
      },
      updateUserById: async (id: string, attrs: Record<string, unknown>) => {
        calls.push({ name: "updateUserById", args: { id, ...attrs } });
        const error = authErrors.shift() ?? null;
        return error ? { data: { user: null }, error } : { data: { user: { id } }, error: null };
      },
    },
  },
};

vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => admin }));
// La sesión: SÓLO `getUser`. Si la acción intentara iniciar o cambiar una sesión, revienta.
vi.mock("@/lib/db/server", () => ({
  createClient: async () => {
    if (sessionThrows) throw new Error("sin cookies");
    return { auth: { getUser: async () => ({ data: { user: sessionUser } }) } };
  },
}));

import { comprobarCorreoAction } from "../actions";
import {
  COMPROBAR_CORREO_ENTRA_PRIMERO,
  COMPROBAR_CORREO_NO_SIRVE,
  COMPROBAR_CORREO_REINTENTA,
} from "@/lib/portal/correo-comprobacion";

const TOKEN = "B".repeat(43);
const AQUI = dirname(fileURLToPath(import.meta.url));
const sinComentarios = (f: string) =>
  readFileSync(resolve(AQUI, f), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

function form(token = TOKEN, extra: Record<string, string> = {}): FormData {
  const f = new FormData();
  f.set("token", token);
  for (const [k, v] of Object.entries(extra)) f.set(k, v);
  return f;
}

const nombres = () => calls.map((c) => c.name);
const ok = (extra: Record<string, unknown> = {}) => ({
  data: [
    { check_id: "chk-1", auth_user_id: "auth-1", pending_email: "ana@example.test", outcome: "ok", ...extra },
  ],
  error: null,
});

beforeEach(() => {
  calls = [];
  authErrors = [];
  confirmError = null;
  filaError = null;
  filaVerificada = null;
  releaseError = null;
  cuentaActual = { email: null };
  sessionUser = { id: "auth-1" };
  sessionThrows = false;
  claimResult = ok();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("comprobarCorreoAction · la sesión del titular", () => {
  it("⭐ sin sesión no confirma, no gasta el enlace y ni siquiera lo consulta", async () => {
    sessionUser = null;
    const res = await comprobarCorreoAction({}, form());
    expect(res).toEqual({ error: COMPROBAR_CORREO_ENTRA_PRIMERO });
    expect(calls).toHaveLength(0);
  });

  it("⭐ si la sesión no se puede leer, es lo mismo que no tenerla", async () => {
    sessionThrows = true;
    const res = await comprobarCorreoAction({}, form());
    expect(res).toEqual({ error: COMPROBAR_CORREO_ENTRA_PRIMERO });
    expect(calls).toHaveLength(0);
  });

  it("⭐ el usuario sale de la sesión, nunca del formulario, y va a la base al reclamar y al confirmar", async () => {
    sessionUser = { id: "auth-1" };
    const res = await comprobarCorreoAction(
      {},
      form(TOKEN, { auth_user_id: "auth-999", p_session_user_id: "auth-999", user_id: "auth-999" }),
    );
    expect(res).toEqual({ ok: true });
    expect(calls[0]).toEqual({
      name: "portal_email_check_claim",
      args: {
        p_token_hash: createHash("sha256").update(TOKEN).digest("hex"),
        p_session_user_id: "auth-1",
      },
    });
    expect(calls.at(-1)).toEqual({
      name: "portal_email_check_confirm",
      args: { p_check_id: "chk-1", p_session_user_id: "auth-1" },
    });
    expect(JSON.stringify(calls)).not.toContain("auth-999");
  });

  it("⭐ con la sesión de OTRA cuenta no confirma: mismo texto que sin sesión y Auth no se toca", async () => {
    sessionUser = { id: "otra-cuenta" };
    // Lo que responde la base cuando la sesión no es la del titular: nada de la cuenta.
    claimResult = {
      data: [{ check_id: null, auth_user_id: null, pending_email: null, outcome: "sin_sesion_del_titular" }],
      error: null,
    };
    const res = await comprobarCorreoAction({}, form());
    expect(res).toEqual({ error: COMPROBAR_CORREO_ENTRA_PRIMERO });
    expect(nombres()).toEqual(["portal_email_check_claim"]);
    expect(calls[0].args.p_session_user_id).toBe("otra-cuenta");
  });

  it("⭐ cinturón: si la base devolviera una cuenta que no es la de la sesión, la app no sigue", async () => {
    sessionUser = { id: "otra-cuenta" };
    claimResult = ok(); // auth_user_id = auth-1
    const res = await comprobarCorreoAction({}, form());
    expect(res).toEqual({ error: COMPROBAR_CORREO_ENTRA_PRIMERO });
    expect(nombres()).not.toContain("updateUserById");
    expect(nombres()).not.toContain("portal_email_check_confirm");
    expect(calls.at(-1)).toEqual({
      name: "portal_email_check_release",
      args: { p_check_id: "chk-1", p_conflicto: false },
    });
  });

  it("el texto de «entra primero» no dice de quién es la comprobación", () => {
    expect(COMPROBAR_CORREO_ENTRA_PRIMERO).not.toMatch(/DTD-|@|cuenta de/i);
  });
});

describe("comprobarCorreoAction · con la sesión del titular", () => {
  it("⭐ comprueba: reclama, pasa el correo a la cuenta y recién entonces marca comprobado", async () => {
    const res = await comprobarCorreoAction({}, form());
    expect(res).toEqual({ ok: true });
    expect(nombres()).toEqual([
      "portal_email_check_claim",
      "updateUserById",
      "portal_email_check_confirm",
    ]);
    expect(calls[1].args).toEqual({ id: "auth-1", email: "ana@example.test", email_confirm: true });
  });

  it("⭐ no crea sesión ni devuelve nada con qué entrar", async () => {
    const res = await comprobarCorreoAction({}, form());
    expect(Object.keys(res)).toEqual(["ok"]);
    expect(JSON.stringify(res)).not.toMatch(/http|token|portal/i);
    // El archivo lee la sesión (`getUser`) y nada más: no la crea ni acuña una entrada.
    const codigo = sinComentarios("../actions.ts");
    expect(codigo).toContain("auth.getUser()");
    expect(codigo).not.toMatch(
      /generateLink|generatePortalAccessLink|mintPortalMagicToken|signIn|verifyOtp|exchangeCodeForSession|createUser|setSession|refreshSession|cookies\(|redirect\(/,
    );
  });

  it("⭐ un GET no lo gasta: la página sólo mira", () => {
    const codigo = sinComentarios("../page.tsx");
    expect(codigo).toContain("portal_email_check_peek");
    expect(codigo).not.toMatch(/portal_email_check_(claim|confirm|release|issue|revisar)|updateUserById/);
    // El POST no se dispara al cargar: el formulario es un botón.
    const form = readFileSync(resolve(AQUI, "../ComprobarCorreoForm.tsx"), "utf8");
    expect(form).toContain('type="submit"');
    expect(form).not.toMatch(/useEffect|requestSubmit|\.submit\(/);
  });

  it("⭐ ninguna pantalla de esta ruta ofrece una entrada al portal ni invita a pedir un enlace", () => {
    for (const f of ["../page.tsx", "../ComprobarCorreoForm.tsx"]) {
      const codigo = sinComentarios(f);
      expect(codigo, f).not.toMatch(/href=|<Link|next\/link|["`]\/entrar|["`]\/portal|enlace de acceso/);
    }
  });

  it("a la base va el hash del token, nunca el token", async () => {
    await comprobarCorreoAction({}, form());
    expect(calls[0].args.p_token_hash).toBe(createHash("sha256").update(TOKEN).digest("hex"));
    expect(JSON.stringify(calls)).not.toContain(TOKEN);
  });

  it("un token sin forma ni se consulta", async () => {
    const res = await comprobarCorreoAction({}, form("DTD-8001"));
    expect(res).toEqual({ error: COMPROBAR_CORREO_NO_SIRVE });
    expect(calls).toHaveLength(0);
  });

  it("⭐ vencido, usado o reemplazado: un solo mensaje y Auth no se toca", async () => {
    claimResult = { data: [], error: null };
    const res = await comprobarCorreoAction({}, form());
    expect(res).toEqual({ error: COMPROBAR_CORREO_NO_SIRVE });
    expect(nombres()).toEqual(["portal_email_check_claim"]);
  });

  it("⭐ si ese correo ya tiene otra cuenta: mensaje genérico y no se toca ninguna cuenta", async () => {
    claimResult = ok({ outcome: "conflicto" });
    const res = await comprobarCorreoAction({}, form());
    expect(res).toEqual({ error: COMPROBAR_CORREO_NO_SIRVE });
    expect(nombres()).toEqual(["portal_email_check_claim"]);
  });

  it("si Auth dice que el correo ya es de otra cuenta, queda marcado como choque", async () => {
    authErrors = [{ status: 422, code: "email_exists", message: "already registered" }];
    const res = await comprobarCorreoAction({}, form());
    expect(res).toEqual({ error: COMPROBAR_CORREO_NO_SIRVE });
    expect(nombres()).toEqual(["portal_email_check_claim", "updateUserById", "portal_email_check_release"]);
    expect(calls[2].args).toEqual({ p_check_id: "chk-1", p_conflicto: true });
  });

  it("⭐ un 422 a secas NO es un choque permanente: se suelta para reintentar", async () => {
    authErrors = [{ status: 422, code: "validation_failed", message: "Unable to validate email address" }];
    const res = await comprobarCorreoAction({}, form());
    expect(res).toEqual({ error: COMPROBAR_CORREO_REINTENTA });
    expect(calls.at(-1)).toEqual({
      name: "portal_email_check_release",
      args: { p_check_id: "chk-1", p_conflicto: false },
    });
  });

  it("⭐ la forma real del choque (500 · 23505, Auth de prueba 2026-11-18) queda como choque", async () => {
    authErrors = [{ status: 500, code: "23505", message: "Database error updating user" }];
    const res = await comprobarCorreoAction({}, form());
    expect(res).toEqual({ error: COMPROBAR_CORREO_NO_SIRVE });
    expect(nombres()).toEqual(["portal_email_check_claim", "updateUserById", "portal_email_check_release"]);
    expect(calls[2].args).toEqual({ p_check_id: "chk-1", p_conflicto: true });
    expect(nombres()).not.toContain("portal_email_check_revisar");
  });

  it("un 500 sin código que dice violación de unicidad sobre el correo también es choque", async () => {
    authErrors = [
      { status: 500, message: 'duplicate key value violates unique constraint "users_email_partial_key"' },
    ];
    await comprobarCorreoAction({}, form());
    expect(calls.find((c) => c.name === "portal_email_check_release")?.args).toEqual({
      p_check_id: "chk-1",
      p_conflicto: true,
    });
  });

  it("⭐ un 500 de otra causa NO es choque: no se suelta y queda para revisión", async () => {
    for (const err of [
      { status: 500, code: "unexpected_failure", message: "Database error updating user" },
      { status: 500, message: 'duplicate key value violates unique constraint "identities_pkey"' },
      { status: 503, message: "boom" },
    ]) {
      calls = [];
      authErrors = [err];
      const res = await comprobarCorreoAction({}, form());
      expect(res).toEqual({ error: COMPROBAR_CORREO_NO_SIRVE });
      expect(nombres()).not.toContain("portal_email_check_release");
      expect(calls.at(-1)).toEqual({ name: "portal_email_check_revisar", args: { p_check_id: "chk-1" } });
      expect(nombres()).not.toContain("portal_email_check_confirm");
    }
  });

  it("⭐ un 23505 que no viene como 500 no se toma por choque sin más", async () => {
    authErrors = [{ status: 400, code: "23505", message: "algo" }];
    const res = await comprobarCorreoAction({}, form());
    expect(res).toEqual({ error: COMPROBAR_CORREO_REINTENTA });
    expect(calls.at(-1)?.args).toEqual({ p_check_id: "chk-1", p_conflicto: false });
  });

  describe("⭐ la respuesta de Auth se perdió (sin status o status 0): se relee la cuenta", () => {
    for (const perdida of [{ message: "fetch failed" }, { status: 0, message: "fetch failed" }]) {
      it(`si ya tiene el correo real, sigue a marcar comprobado (${JSON.stringify(perdida)})`, async () => {
        authErrors = [perdida];
        cuentaActual = { email: "ANA@example.test" };
        const res = await comprobarCorreoAction({}, form());
        expect(res).toEqual({ ok: true });
        expect(nombres()).toEqual([
          "portal_email_check_claim",
          "updateUserById",
          "getUserById",
          "portal_email_check_confirm",
        ]);
        expect(calls.find((c) => c.name === "getUserById")?.args).toEqual({ id: "auth-1" });
      });

      it(`si sigue con su dirección interna, se suelta para reintentar (${JSON.stringify(perdida)})`, async () => {
        authErrors = [perdida];
        cuentaActual = { email: INTERNA };
        const res = await comprobarCorreoAction({}, form());
        expect(res).toEqual({ error: COMPROBAR_CORREO_REINTENTA });
        expect(calls.at(-1)).toEqual({
          name: "portal_email_check_release",
          args: { p_check_id: "chk-1", p_conflicto: false },
        });
        expect(nombres()).not.toContain("portal_email_check_confirm");
      });

      it(`si no se puede leer la cuenta, queda para revisión sin soltar (${JSON.stringify(perdida)})`, async () => {
        authErrors = [perdida];
        cuentaActual = { email: null, error: { status: 500, message: "boom" } };
        const res = await comprobarCorreoAction({}, form());
        expect(res).toEqual({ error: COMPROBAR_CORREO_NO_SIRVE });
        expect(nombres()).not.toContain("portal_email_check_release");
        expect(nombres()).not.toContain("portal_email_check_confirm");
        expect(calls.at(-1)).toEqual({ name: "portal_email_check_revisar", args: { p_check_id: "chk-1" } });
      });
    }

    it("si Auth no devuelve la cuenta, o lleva otro correo, también queda para revisión", async () => {
      for (const email of [null, "otra@example.test"]) {
        calls = [];
        authErrors = [{ message: "fetch failed" }];
        cuentaActual = { email };
        const res = await comprobarCorreoAction({}, form());
        expect(res).toEqual({ error: COMPROBAR_CORREO_NO_SIRVE });
        expect(nombres()).not.toContain("portal_email_check_release");
        expect(calls.at(-1)?.name).toBe("portal_email_check_revisar");
      }
    });

    it("con un status de verdad no se relee: un 429 se suelta sin preguntar", async () => {
      authErrors = [{ status: 429, message: "slow down" }];
      await comprobarCorreoAction({}, form());
      expect(nombres()).not.toContain("getUserById");
    });
  });

  it("un fallo pasajero de Auth suelta el enlace para reintentar y no marca comprobado", async () => {
    authErrors = [{ status: 429, code: "over_request_rate_limit", message: "slow down" }];
    const res = await comprobarCorreoAction({}, form());
    expect(res).toEqual({ error: COMPROBAR_CORREO_REINTENTA });
    expect(calls.at(-1)).toEqual({
      name: "portal_email_check_release",
      args: { p_check_id: "chk-1", p_conflicto: false },
    });
    expect(nombres()).not.toContain("portal_email_check_confirm");
  });

  it("si no se puede soltar, no promete un reintento: el enlace quedó gastado", async () => {
    authErrors = [{ status: 429, message: "slow down" }];
    releaseError = { code: "XX000", message: "boom" };
    const res = await comprobarCorreoAction({}, form());
    expect(res).toEqual({ error: COMPROBAR_CORREO_NO_SIRVE });
  });

  it("si reclamar falla, no se toca Auth", async () => {
    claimResult = { data: null, error: { code: "XX000", message: "boom" } };
    const res = await comprobarCorreoAction({}, form());
    expect(res).toEqual({ error: COMPROBAR_CORREO_REINTENTA });
    expect(nombres()).toEqual(["portal_email_check_claim"]);
  });
});

describe("comprobarCorreoAction · la vuelta cuando la base no marca comprobado", () => {
  beforeEach(() => {
    confirmError = { code: "22023", message: "no lleva el correo" };
  });

  it("⭐ la cuenta vuelve a su dirección interna y recién entonces se suelta el enlace", async () => {
    const res = await comprobarCorreoAction({}, form());
    expect(res).toEqual({ error: COMPROBAR_CORREO_REINTENTA });
    const cambios = calls.filter((c) => c.name === "updateUserById").map((c) => c.args.email);
    expect(cambios).toEqual(["ana@example.test", INTERNA]);
    expect(calls.at(-1)).toEqual({
      name: "portal_email_check_release",
      args: { p_check_id: "chk-1", p_conflicto: false },
    });
    expect(nombres()).not.toContain("portal_email_check_revisar");
  });

  it("⭐ si la cuenta NO vuelve, el enlace no se suelta y queda para revisión del equipo", async () => {
    authErrors = [null, { status: 500, message: "boom" }];
    const res = await comprobarCorreoAction({}, form());
    expect(res).toEqual({ error: COMPROBAR_CORREO_NO_SIRVE });
    expect(nombres()).not.toContain("portal_email_check_release");
    expect(calls.at(-1)).toEqual({ name: "portal_email_check_revisar", args: { p_check_id: "chk-1" } });
  });

  it("⭐ si la confirmación quedó hecha aunque la respuesta volvió con error, es un éxito y no se revierte", async () => {
    filaVerificada = "2026-11-17T12:00:00Z";
    const res = await comprobarCorreoAction({}, form());
    expect(res).toEqual({ ok: true });
    // La cuenta se queda con el correo comprobado: no hay vuelta ni se suelta nada.
    const cambios = calls.filter((c) => c.name === "updateUserById").map((c) => c.args.email);
    expect(cambios).toEqual(["ana@example.test"]);
    expect(nombres()).not.toContain("portal_email_check_release");
    expect(nombres()).not.toContain("portal_email_check_revisar");
  });

  it("⭐ si no se puede leer la dirección interna, tampoco se suelta: queda para revisión", async () => {
    filaError = { code: "XX000", message: "boom" };
    const res = await comprobarCorreoAction({}, form());
    expect(res).toEqual({ error: COMPROBAR_CORREO_NO_SIRVE });
    expect(nombres()).not.toContain("portal_email_check_release");
    expect(nombres().filter((n) => n === "updateUserById")).toHaveLength(1);
    expect(calls.at(-1)?.name).toBe("portal_email_check_revisar");
  });

  it("⭐ los avisos de consola no llevan el correo ni el token", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    authErrors = [null, { status: 500, message: "ana@example.test boom" }];
    await comprobarCorreoAction({}, form());
    const texto = JSON.stringify(consoleError.mock.calls);
    expect(texto).not.toContain("ana@example.test");
    expect(texto).not.toContain(TOKEN);
    expect(texto).not.toContain(INTERNA);
  });
});

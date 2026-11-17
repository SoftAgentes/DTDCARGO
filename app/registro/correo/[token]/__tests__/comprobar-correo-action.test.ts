/**
 * SDD-0646 (D-1, opción C) · El enlace de comprobación del correo.
 *
 * Lo que defiende:
 *   1. ⭐ SOLO comprueba: no crea sesión ni acuña ningún enlace de entrada. El
 *      doble de Auth no tiene `generateLink`, `createUser` ni nada de sesión: si
 *      la acción los tocara, la prueba revienta;
 *   2. ⭐ un GET no lo gasta: la página sólo llama a `peek`;
 *   3. vencido, usado, reemplazado o inventado: un solo mensaje, sin tocar Auth;
 *   4. a la base va el hash del token, nunca el token;
 *   5. el correo pasa a la cuenta ANTES de marcar comprobado, y sólo después de
 *      reclamar el enlace;
 *   6. si ese correo ya tiene otra cuenta: mensaje genérico, queda marcado y no
 *      se toca ninguna cuenta;
 *   7. un fallo pasajero suelta el enlace para reintentar.
 *
 * Supabase se mockea — sin red ni DB real.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Call = { name: string; args: Record<string, unknown> };
let calls: Call[] = [];
let claimResult: { data: unknown; error: { code?: string; message: string } | null };
let authError: { status?: number; code?: string; message: string } | null = null;
let confirmError: { code?: string; message: string } | null = null;

const admin = {
  rpc: async (name: string, args: Record<string, unknown>) => {
    calls.push({ name, args });
    if (name === "portal_email_check_claim") return claimResult;
    if (name === "portal_email_check_confirm") return { data: null, error: confirmError };
    return { data: null, error: null };
  },
  from: (t: string) => {
    calls.push({ name: `from:${t}`, args: {} });
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => ({
        data: { internal_email: `c-${"a".repeat(32)}@sin-comprobar.invalid` },
        error: null,
      }),
    };
    return chain;
  },
  auth: {
    // A propósito: SÓLO `updateUserById`. Nada que cree una sesión, un usuario
    // o un enlace de entrada existe en este doble.
    admin: {
      updateUserById: async (id: string, attrs: Record<string, unknown>) => {
        calls.push({ name: "updateUserById", args: { id, ...attrs } });
        return authError ? { data: { user: null }, error: authError } : { data: { user: { id } }, error: null };
      },
    },
  },
};

vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => admin }));

import { comprobarCorreoAction } from "../actions";
import {
  COMPROBAR_CORREO_NO_SIRVE,
  COMPROBAR_CORREO_REINTENTA,
} from "@/lib/portal/correo-comprobacion";

const TOKEN = "B".repeat(43);
const AQUI = dirname(fileURLToPath(import.meta.url));

function form(token = TOKEN): FormData {
  const f = new FormData();
  f.set("token", token);
  return f;
}

const nombres = () => calls.map((c) => c.name);

beforeEach(() => {
  calls = [];
  authError = null;
  confirmError = null;
  claimResult = {
    data: [
      { check_id: "chk-1", auth_user_id: "auth-1", pending_email: "ana@example.test", outcome: "ok" },
    ],
    error: null,
  };
});

describe("comprobarCorreoAction", () => {
  it("⭐ comprueba: reclama, pasa el correo a la cuenta y recién entonces marca comprobado", async () => {
    const res = await comprobarCorreoAction({}, form());
    expect(res).toEqual({ ok: true });
    expect(nombres()).toEqual([
      "portal_email_check_claim",
      "updateUserById",
      "portal_email_check_confirm",
    ]);
    expect(calls[1].args).toEqual({ id: "auth-1", email: "ana@example.test", email_confirm: true });
    expect(calls[2].args).toEqual({ p_check_id: "chk-1" });
  });

  it("⭐ no crea sesión ni devuelve nada con qué entrar", async () => {
    const res = await comprobarCorreoAction({}, form());
    // El resultado es sólo «listo»: ni URL, ni token, ni enlace.
    expect(Object.keys(res)).toEqual(["ok"]);
    expect(JSON.stringify(res)).not.toMatch(/http|token|portal/i);
    // Y el archivo no nombra nada que abra una sesión o acuñe una entrada.
    const fuente = readFileSync(resolve(AQUI, "../actions.ts"), "utf8");
    const codigo = fuente.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    expect(codigo).not.toMatch(
      /generateLink|generatePortalAccessLink|mintPortalMagicToken|signIn|verifyOtp|exchangeCodeForSession|createUser|cookies\(|redirect\(|@\/lib\/db\/server/,
    );
  });

  it("⭐ un GET no lo gasta: la página sólo mira", () => {
    const fuente = readFileSync(resolve(AQUI, "../page.tsx"), "utf8");
    const codigo = fuente.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    expect(codigo).toContain("portal_email_check_peek");
    expect(codigo).not.toMatch(/portal_email_check_(claim|confirm|release|issue)|updateUserById|\.rpc\([^)]*claim/);
    // El POST no se dispara al cargar: el formulario es un botón.
    const form = readFileSync(resolve(AQUI, "../ComprobarCorreoForm.tsx"), "utf8");
    expect(form).toContain('type="submit"');
    expect(form).not.toMatch(/useEffect|requestSubmit|\.submit\(/);
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
    claimResult = {
      data: [
        { check_id: "chk-1", auth_user_id: "auth-1", pending_email: "ana@example.test", outcome: "conflicto" },
      ],
      error: null,
    };
    const res = await comprobarCorreoAction({}, form());
    // El mismo mensaje que un enlace que no sirve: no dice que el correo tiene cuenta.
    expect(res).toEqual({ error: COMPROBAR_CORREO_NO_SIRVE });
    expect(nombres()).toEqual(["portal_email_check_claim"]);
  });

  it("si Auth dice que el correo ya es de otra cuenta, queda marcado como choque", async () => {
    authError = { status: 422, code: "email_exists", message: "already registered" };
    const res = await comprobarCorreoAction({}, form());
    expect(res).toEqual({ error: COMPROBAR_CORREO_NO_SIRVE });
    expect(nombres()).toEqual(["portal_email_check_claim", "updateUserById", "portal_email_check_release"]);
    expect(calls[2].args).toEqual({ p_check_id: "chk-1", p_conflicto: true });
    expect(nombres()).not.toContain("portal_email_check_confirm");
  });

  it("un fallo pasajero de Auth suelta el enlace para reintentar y no marca comprobado", async () => {
    authError = { status: 500, message: "boom" };
    const res = await comprobarCorreoAction({}, form());
    expect(res).toEqual({ error: COMPROBAR_CORREO_REINTENTA });
    expect(calls.at(-1)).toEqual({
      name: "portal_email_check_release",
      args: { p_check_id: "chk-1", p_conflicto: false },
    });
    expect(nombres()).not.toContain("portal_email_check_confirm");
  });

  it("⭐ si la base no marca comprobado, la cuenta vuelve a su dirección interna", async () => {
    confirmError = { code: "22023", message: "no lleva el correo" };
    const res = await comprobarCorreoAction({}, form());
    expect(res).toEqual({ error: COMPROBAR_CORREO_REINTENTA });
    const cambios = calls.filter((c) => c.name === "updateUserById").map((c) => c.args.email);
    expect(cambios).toEqual(["ana@example.test", `c-${"a".repeat(32)}@sin-comprobar.invalid`]);
    expect(calls.at(-1)?.name).toBe("portal_email_check_release");
  });

  it("si reclamar falla, no se toca Auth", async () => {
    claimResult = { data: null, error: { code: "XX000", message: "boom" } };
    const res = await comprobarCorreoAction({}, form());
    expect(res).toEqual({ error: COMPROBAR_CORREO_REINTENTA });
    expect(nombres()).toEqual(["portal_email_check_claim"]);
  });
});

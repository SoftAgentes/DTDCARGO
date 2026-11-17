/**
 * SDD-0646 (D-1, opción C) · Studio: «Reenviar comprobación» y la corrección del
 * correo en la ficha.
 *
 * Lo que defiende:
 *   1. ⭐ service_role sólo después del control de rol (la app) y de la RPC que
 *      vuelve a exigir rol y tenant (la base): sin permiso, ni se crea;
 *   2. una cuenta que todavía lleva un correo real pasa PRIMERO a su dirección
 *      interna, y recién después se emite y se envía;
 *   3. si ese paso falla, no se emite ningún enlace;
 *   4. ⭐ corregir el correo en la ficha deja la cuenta sin comprobar: si llevaba
 *      un correo real, pasa a su dirección interna;
 *   5. cambiar otro dato no toca la cuenta.
 *
 * Supabase se mockea — sin red ni DB real.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({ redirect: () => {} }));
vi.mock("@/lib/studio/welcome-email", () => ({ sendWelcomeEmail: async () => ({ ok: true }) }));

let pasos: string[] = [];
let denial: string | null = null;
vi.mock("@/lib/studio/rbac-guard", () => ({
  moduleEditDenial: async () => {
    pasos.push("rol");
    return denial;
  },
}));

type Check = {
  id: string;
  auth_user_id: string;
  internal_email: string;
  auth_interno: boolean;
  verified_at: string | null;
};
const INTERNA = `c-${"a".repeat(32)}@sin-comprobar.invalid`;
let checkRow: Check | null = null;

vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => {
    pasos.push("service_role");
    return {
      from: () => {
        const chain = {
          select: () => chain,
          eq: () => chain,
          maybeSingle: async () => ({ data: checkRow, error: null }),
          insert: async () => ({ error: null }),
        };
        return chain;
      },
    };
  },
}));

let moverOk = true;
let enviarOk = true;
vi.mock("@/lib/studio/portal/correo-comprobacion", () => ({
  pasarCuentaADireccionInterna: async (_a: unknown, input: Record<string, unknown>) => {
    pasos.push(`interna:${String(input.authUserId)}:${String(input.internalEmail)}`);
    return moverOk ? { ok: true } : { ok: false, error: "auth: boom" };
  },
  emitirYEnviarComprobacion: async (_a: unknown, checkId: string) => {
    pasos.push(`emitir:${checkId}`);
    return enviarOk ? { ok: true } : { ok: false, error: "correo: boom" };
  },
}));

let prepare: { data: unknown; error: { code?: string; message: string } | null };
let fichaPrevia = { id: "c-1", tenant_id: "t-1", name: "Ana", rif: null, phone: null, email: "ana@example.test" };

function makeSupabase() {
  return {
    auth: { getUser: async () => ({ data: { user: { id: "u-1" } } }) },
    rpc: async (name: string) => {
      pasos.push(`rpc:${name}`);
      return name === "portal_email_check_prepare" ? prepare : { data: null, error: null };
    },
    from() {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: fichaPrevia, error: null }),
        update: () => ({ eq: async () => ({ error: null }) }),
      };
      return chain;
    },
  };
}
vi.mock("@/lib/db/server", () => ({ createClient: async () => makeSupabase() }));

import { resendEmailCheckAction, updateClientAction } from "../actions";

function ficha(extra: Record<string, string> = {}): FormData {
  const f = new FormData();
  f.set("doc_kind", "persona");
  f.set("name", "Ana");
  f.set("email", "ana@example.test");
  f.set("tier", "regular");
  for (const [k, v] of Object.entries(extra)) f.set(k, v);
  return f;
}

beforeEach(() => {
  pasos = [];
  denial = null;
  moverOk = true;
  enviarOk = true;
  checkRow = null;
  fichaPrevia = { id: "c-1", tenant_id: "t-1", name: "Ana", rif: null, phone: null, email: "ana@example.test" };
  prepare = {
    data: [{ check_id: "chk-1", auth_user_id: "auth-1", internal_email: INTERNA, auth_interno: true }],
    error: null,
  };
});

describe("resendEmailCheckAction", () => {
  it("⭐ sin permiso de edición no llega a la base ni toca service_role", async () => {
    denial = "No tienes permiso para realizar esta acción.";
    const res = await resendEmailCheckAction("l-1");
    expect(res).toEqual({ error: denial });
    expect(pasos).toEqual(["rol"]);
  });

  it("⭐ service_role entra sólo después del rol y de la RPC que exige rol y tenant", async () => {
    const res = await resendEmailCheckAction("l-1");
    expect(res).toEqual({ ok: true });
    expect(pasos).toEqual(["rol", "rpc:portal_email_check_prepare", "service_role", "emitir:chk-1"]);
  });

  it("⭐ si la base rechaza (rol o tenant), no se crea service_role ni se emite nada", async () => {
    prepare = { data: null, error: { code: "42501", message: "No tienes permiso" } };
    const res = await resendEmailCheckAction("l-1");
    expect(res.error).toMatch(/permiso/);
    expect(pasos).toEqual(["rol", "rpc:portal_email_check_prepare"]);
  });

  it("⭐ una cuenta que todavía lleva un correo real pasa primero a su dirección interna", async () => {
    prepare = {
      data: [{ check_id: "chk-1", auth_user_id: "auth-1", internal_email: INTERNA, auth_interno: false }],
      error: null,
    };
    const res = await resendEmailCheckAction("l-1");
    expect(res).toEqual({ ok: true });
    expect(pasos.slice(2)).toEqual(["service_role", `interna:auth-1:${INTERNA}`, "emitir:chk-1"]);
  });

  it("⭐ si la cuenta no pasa a su dirección interna, no se emite ningún enlace", async () => {
    prepare = {
      data: [{ check_id: "chk-1", auth_user_id: "auth-1", internal_email: INTERNA, auth_interno: false }],
      error: null,
    };
    moverOk = false;
    const res = await resendEmailCheckAction("l-1");
    expect(res.error).toBeTruthy();
    expect(pasos.some((p) => p.startsWith("emitir"))).toBe(false);
  });

  it.each([
    ["ya_comprobado", /ya está comprobado/],
    ["sin_correo", /no tiene un correo válido/],
    ["sin_acceso", /ya no tiene el acceso/],
  ])("traduce %s", async (mensaje, esperado) => {
    prepare = { data: null, error: { code: "22023", message: mensaje } };
    const res = await resendEmailCheckAction("l-1");
    expect(res.error).toMatch(esperado);
    expect(pasos).not.toContain("service_role");
  });

  it("sin la migración 0559 lo dice y no hace nada", async () => {
    prepare = { data: null, error: { code: "PGRST202", message: "no existe" } };
    const res = await resendEmailCheckAction("l-1");
    expect(res).toEqual({ error: "Esta acción todavía no está disponible." });
    expect(pasos).not.toContain("service_role");
  });

  it("si el correo no sale, lo dice", async () => {
    enviarOk = false;
    const res = await resendEmailCheckAction("l-1");
    expect(res.error).toMatch(/No se pudo enviar/);
  });
});

describe("updateClientAction · corregir el correo de una cuenta por link", () => {
  it("⭐ correo corregido y la cuenta llevaba un correo real: pasa a su dirección interna", async () => {
    checkRow = { id: "chk-1", auth_user_id: "auth-1", internal_email: INTERNA, auth_interno: false, verified_at: null };
    const res = await updateClientAction("DTD-8001", {}, ficha({ email: "ana.nueva@example.test" }));
    expect(res.ok).toBe(true);
    expect(res.warning).toMatch(/quedó sin comprobar/);
    expect(pasos).toContain(`interna:auth-1:${INTERNA}`);
    // Después del control de rol.
    expect(pasos.indexOf("rol")).toBeLessThan(pasos.indexOf("service_role"));
    // Corregir el correo no manda nada por su cuenta.
    expect(pasos.some((p) => p.startsWith("emitir"))).toBe(false);
  });

  it("correo corregido y la cuenta ya llevaba su dirección interna: sólo avisa", async () => {
    checkRow = { id: "chk-1", auth_user_id: "auth-1", internal_email: INTERNA, auth_interno: true, verified_at: null };
    const res = await updateClientAction("DTD-8001", {}, ficha({ email: "ana.nueva@example.test" }));
    expect(res.warning).toMatch(/Registros por link/);
    expect(pasos.some((p) => p.startsWith("interna"))).toBe(false);
  });

  it("si la cuenta no pasa a su dirección interna, el equipo lo lee", async () => {
    checkRow = { id: "chk-1", auth_user_id: "auth-1", internal_email: INTERNA, auth_interno: false, verified_at: null };
    moverOk = false;
    const res = await updateClientAction("DTD-8001", {}, ficha({ email: "ana.nueva@example.test" }));
    expect(res.ok).toBe(true);
    expect(res.warning).toMatch(/Reenviar comprobación/);
  });

  it("un cliente sin cuenta por link: corregir el correo no toca nada", async () => {
    checkRow = null;
    const res = await updateClientAction("DTD-8001", {}, ficha({ email: "ana.nueva@example.test" }));
    expect(res).toEqual({ ok: true });
    expect(pasos.some((p) => p.startsWith("interna"))).toBe(false);
  });

  it("cambiar otro dato (o el mismo correo con otras mayúsculas) no toca la cuenta", async () => {
    checkRow = { id: "chk-1", auth_user_id: "auth-1", internal_email: INTERNA, auth_interno: false, verified_at: null };
    const res = await updateClientAction("DTD-8001", {}, ficha({ email: "ANA@example.test", notes: "nota" }));
    expect(res).toEqual({ ok: true });
    expect(pasos.some((p) => p.startsWith("interna"))).toBe(false);
  });
});

/**
 * SDD-0251 · el login del Studio exige MEMBRESÍA, no sólo credenciales.
 *
 * El portal cliente comparte el mismo Supabase Auth que el ERP. Antes de este
 * gate, un cliente tecleaba su correo y clave en /studio/login, el login le
 * decía que sí, y recién el layout lo rebotaba: se vive como "entré al ERP" y
 * el 2026-08-06 llegó como reporte de incidente.
 *
 * Lo que fija este test:
 *   1. con membresía activa → sigue entrando al `next` de siempre,
 *   2. cliente del portal → va a /portal y NO se le cierra la sesión,
 *   3. sin membresía ni portal (p. ej. desactivado) → signOut + mensaje,
 *   4. credenciales inválidas → ni siquiera se consulta la membresía
 *      (no se filtra si el correo existe).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signInError: null as { message: string } | null,
  userId: "user-1" as string | undefined,
  membership: null as { user_id: string } | null,
  portalClientId: null as string | null,
  redirects: [] as string[],
  signOutCalls: 0,
  membershipQueries: 0,
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mocks.redirects.push(url);
    throw new Error("NEXT_REDIRECT");
  },
}));

vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    auth: {
      signInWithPassword: async () => ({
        data: { user: mocks.userId ? { id: mocks.userId } : null },
        error: mocks.signInError,
      }),
      signOut: async () => {
        mocks.signOutCalls += 1;
        return { error: null };
      },
    },
    from() {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        is: () => chain,
        limit: () => chain,
        maybeSingle: async () => {
          mocks.membershipQueries += 1;
          return { data: mocks.membership, error: null };
        },
      };
      return chain;
    },
    rpc: async () => ({ data: mocks.portalClientId, error: null }),
  }),
}));

import { signIn } from "../actions";

function form(next?: string) {
  const data = new FormData();
  data.set("email", "quien@dtd.test");
  data.set("password", "secreto-123");
  if (next) data.set("next", next);
  return data;
}

describe("login del Studio · gate de membresía", () => {
  beforeEach(() => {
    mocks.signInError = null;
    mocks.userId = "user-1";
    mocks.membership = null;
    mocks.portalClientId = null;
    mocks.redirects = [];
    mocks.signOutCalls = 0;
    mocks.membershipQueries = 0;
  });

  it("con membresía activa entra al destino de siempre", async () => {
    mocks.membership = { user_id: "user-1" };

    await expect(signIn({}, form())).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.redirects).toEqual(["/studio/resumen"]);
    expect(mocks.signOutCalls).toBe(0);
  });

  it("respeta el ?next= validado cuando hay membresía", async () => {
    mocks.membership = { user_id: "user-1" };

    await expect(signIn({}, form("/studio/tesoreria"))).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(mocks.redirects).toEqual(["/studio/tesoreria"]);
  });

  it("manda al cliente del portal a su portal, sin cerrarle la sesión", async () => {
    mocks.membership = null;
    mocks.portalClientId = "client-9";

    await expect(signIn({}, form())).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.redirects).toEqual(["/portal"]);
    // Su sesión es legítima: cerrarla sería sacarlo también del portal.
    expect(mocks.signOutCalls).toBe(0);
  });

  it("sin membresía ni portal cierra la sesión y avisa", async () => {
    mocks.membership = null;
    mocks.portalClientId = null;

    const state = await signIn({}, form());

    expect(state.error).toMatch(/no tiene acceso al Studio/i);
    expect(mocks.redirects).toEqual([]);
    expect(mocks.signOutCalls).toBe(1);
  });

  it("con credenciales inválidas ni consulta la membresía", async () => {
    mocks.signInError = { message: "Invalid login credentials" };

    const state = await signIn({}, form());

    expect(state.error).toBe("Email o contraseña incorrectos.");
    expect(mocks.membershipQueries).toBe(0);
    expect(mocks.redirects).toEqual([]);
  });
});

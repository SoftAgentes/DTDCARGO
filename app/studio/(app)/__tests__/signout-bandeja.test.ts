// @vitest-environment node
/**
 * SDD-0585 E2-D13 · El signOut de Studio borra la marca del SSO de la Bandeja:
 * sin ella, el próximo ingreso pide un SSO nuevo y la sesión del panel de
 * Chatwoot de este navegador se reemplaza por la del usuario que entra.
 */
import { describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ signOut: vi.fn(async () => ({ error: null })), borrar: vi.fn(), redirect: vi.fn() }));

vi.mock("@/lib/db/server", () => ({ createClient: async () => ({ auth: { signOut: m.signOut } }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ delete: m.borrar }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));

import { signOut } from "../actions";

describe("signOut de Studio (SDD-0585)", () => {
  it("cierra la sesión, borra dtd_cw_sso en /studio y manda al login", async () => {
    await signOut();
    expect(m.signOut).toHaveBeenCalledTimes(1);
    expect(m.borrar).toHaveBeenCalledWith({ name: "dtd_cw_sso", path: "/studio" });
    expect(m.redirect).toHaveBeenCalledWith("/studio/login");
  });
});

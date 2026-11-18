// @vitest-environment node
/**
 * SDD-0585 E2-D13 · El signOut de Studio borra la marca del SSO de la Bandeja:
 * sin ella, el próximo ingreso pide un SSO nuevo y la sesión del panel de
 * Chatwoot de este navegador se reemplaza por la del usuario que entra.
 *
 * Paso 2.7: si había marca (la Bandeja se abrió en este navegador), pasa antes
 * por `/studio/cerrar-chat`, que cierra la sesión del chat y sigue al login.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  signOut: vi.fn(async () => ({ error: null })),
  borrar: vi.fn(),
  redirect: vi.fn(),
  marca: undefined as string | undefined,
}));

vi.mock("@/lib/db/server", () => ({ createClient: async () => ({ auth: { signOut: m.signOut } }) }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    delete: m.borrar,
    get: (nombre: string) => (nombre === "dtd_cw_sso" && m.marca !== undefined ? { name: nombre, value: m.marca } : undefined),
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));

import { signOut } from "../actions";

beforeEach(() => {
  vi.clearAllMocks();
  m.marca = undefined;
});

describe("signOut de Studio (SDD-0585)", () => {
  it("sin marca del chat: cierra la sesión, borra dtd_cw_sso en /studio y manda al login", async () => {
    await signOut();
    expect(m.signOut).toHaveBeenCalledTimes(1);
    expect(m.borrar).toHaveBeenCalledWith({ name: "dtd_cw_sso", path: "/studio" });
    expect(m.redirect).toHaveBeenCalledWith("/studio/login");
  });

  it("2.7 · con marca del chat: borra la marca y pasa por /studio/cerrar-chat", async () => {
    m.marca = "20000000-0000-4000-8000-000000000003";
    await signOut();
    expect(m.borrar).toHaveBeenCalledWith({ name: "dtd_cw_sso", path: "/studio" });
    expect(m.redirect).toHaveBeenCalledWith("/studio/cerrar-chat");
  });

  it("2.7 · una marca vacía no cuenta", async () => {
    m.marca = "";
    await signOut();
    expect(m.redirect).toHaveBeenCalledWith("/studio/login");
  });
});

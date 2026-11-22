/**
 * SDD-0646 (D-1, opción C) · la página del enlace de comprobación (GET).
 *
 * El correo por comprobar sólo aparece si la sesión del portal es la del
 * titular: sin sesión, o con la sesión de otra cuenta, no sale en la respuesta.
 * El usuario de la sesión lo lee el servidor y va a la base; la base decide.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  COMPROBAR_CORREO_ENTRA_PRIMERO,
  COMPROBAR_CORREO_NO_ES_MIO,
} from "@/lib/portal/correo-comprobacion";

const CORREO = "ana.perez@example.test";
const TITULAR = "auth-1";
const TOKEN = "A".repeat(43);

let sessionUser: { id: string } | null = null;
let rpcs: Array<{ name: string; args: Record<string, unknown> }> = [];
/** Si la base «se equivocara» y devolviera el correo sin sesión: la página no lo muestra igual. */
let baseDevuelveSiempre = false;

vi.mock("@/lib/fonts", () => ({ jetbrainsMonoUi: { variable: "" } }));
vi.mock("@/components/Nav", () => ({ Nav: () => null }));
vi.mock("@/components/Footer", () => ({ Footer: () => null }));
vi.mock("../actions", () => ({ comprobarCorreoAction: vi.fn(async () => ({})) }));
vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: sessionUser } }) } }),
}));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => ({
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcs.push({ name, args });
      // Como la 0559: el correo sólo para la sesión del titular.
      const esTitular = args.p_session_user_id === TITULAR;
      return {
        data: [{ markbox: "DTD-8001", pending_email: esTitular || baseDevuelveSiempre ? CORREO : null }],
        error: null,
      };
    },
  }),
}));

import ComprobarCorreoPage from "../page";

async function abrir() {
  const ui = await ComprobarCorreoPage({ params: Promise.resolve({ token: TOKEN }) });
  return render(ui);
}

beforeEach(() => {
  sessionUser = null;
  rpcs = [];
  baseDevuelveSiempre = false;
});
afterEach(() => cleanup());

describe("/registro/correo/[token] · qué correo se confirma", () => {
  it("⭐ sin sesión el correo no aparece; se pide entrar primero y no hay botón", async () => {
    const { container } = await abrir();
    expect(container.innerHTML).not.toContain(CORREO);
    expect(container.innerHTML).not.toContain("@");
    expect(screen.getByText(COMPROBAR_CORREO_ENTRA_PRIMERO)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(rpcs).toEqual([
      { name: "portal_email_check_peek", args: { p_token_hash: expect.any(String), p_session_user_id: null } },
    ]);
  });

  it("⭐ con la sesión de OTRA cuenta el correo no aparece; mismo texto que sin sesión", async () => {
    sessionUser = { id: "auth-9" };
    const { container } = await abrir();
    expect(container.innerHTML).not.toContain(CORREO);
    expect(screen.getByText(COMPROBAR_CORREO_ENTRA_PRIMERO)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    // El usuario va a la base desde la sesión que leyó el servidor.
    expect(rpcs[0].args.p_session_user_id).toBe("auth-9");
  });

  it("⭐ con la sesión del titular muestra el correo completo y pide revisarlo", async () => {
    sessionUser = { id: TITULAR };
    const { container } = await abrir();
    expect(container.innerHTML).toContain(CORREO);
    expect(screen.getByText("¿Es este tu correo?")).toBeTruthy();
    expect(screen.getByText("Revísalo letra por letra antes de confirmarlo.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sí, este correo es mío" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "No es mi correo" })).toBeTruthy();
  });

  it("⭐ «No es mi correo» no confirma: no manda nada y dice cómo corregirlo", async () => {
    sessionUser = { id: TITULAR };
    const { comprobarCorreoAction } = await import("../actions");
    await abrir();
    fireEvent.click(screen.getByRole("button", { name: "No es mi correo" }));
    expect(screen.getByText(COMPROBAR_CORREO_NO_ES_MIO)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sí, este correo es mío" })).toBeNull();
    expect(comprobarCorreoAction).not.toHaveBeenCalled();
  });

  it("cinturón: sin sesión no se muestra el correo aunque la base lo devolviera", async () => {
    baseDevuelveSiempre = true;
    const { container } = await abrir();
    expect(container.innerHTML).not.toContain(CORREO);
  });

  it("el texto de «No es mi correo» no invita a pedir un enlace de entrada", () => {
    expect(COMPROBAR_CORREO_NO_ES_MIO).not.toMatch(/enlace de acceso|\/entrar|portal/i);
  });
});

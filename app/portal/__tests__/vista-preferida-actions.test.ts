/**
 * SDD-0654 fase 1 · acciones del selector de vista (`app/portal/actions.ts`).
 *
 * Con el interruptor apagado no tocan la base. Encendido, van con la sesión del
 * cliente y solo llaman a las RPC de la 0557 con la vista: nunca con un id.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const createClient = vi.fn(async () => ({ rpc }));

vi.mock("@/lib/db/server", () => ({ createClient: () => createClient() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const { markPortalGuiaVistaAction, setPortalVistaAction } = await import("../actions");

beforeEach(() => {
  rpc.mockReset();
  createClient.mockClear();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("setPortalVistaAction", () => {
  it("con el interruptor apagado no abre sesión ni llama a la base", async () => {
    for (const valor of ["", "1", "on", "TRUE"]) {
      vi.stubEnv("PORTAL_VISTA_SIMPLE", valor);
      await expect(setPortalVistaAction("simple")).resolves.toEqual({ ok: false });
    }
    expect(createClient).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("encendido, guarda la vista con la RPC y devuelve la que quedó", async () => {
    vi.stubEnv("PORTAL_VISTA_SIMPLE", "true");
    rpc.mockResolvedValue({ data: "simple", error: null });
    await expect(setPortalVistaAction("simple")).resolves.toEqual({ ok: true, vista: "simple" });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("portal_set_vista", { p_vista: "simple" });
  });

  it("un valor que no es simple ni pro no llega a la base", async () => {
    vi.stubEnv("PORTAL_VISTA_SIMPLE", "true");
    for (const v of ["light", "Pro", "", "simple; drop table"]) {
      await expect(setPortalVistaAction(v)).resolves.toEqual({ ok: false });
    }
    await expect(setPortalVistaAction(undefined as unknown as string)).resolves.toEqual({ ok: false });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sin la 0557 (o sin vínculo activo) responde ok: false sin lanzar", async () => {
    vi.stubEnv("PORTAL_VISTA_SIMPLE", "true");
    vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "not found" } });
    await expect(setPortalVistaAction("pro")).resolves.toEqual({ ok: false });
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "sin vínculo activo del Portal" } });
    await expect(setPortalVistaAction("pro")).resolves.toEqual({ ok: false });
  });
});

describe("markPortalGuiaVistaAction", () => {
  it("con el interruptor apagado no llama a la base", async () => {
    await expect(markPortalGuiaVistaAction()).resolves.toEqual({ ok: false });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("encendido, llama a la RPC sin argumentos", async () => {
    vi.stubEnv("PORTAL_VISTA_SIMPLE", "true");
    rpc.mockResolvedValue({ data: "2026-11-17T12:00:00Z", error: null });
    await expect(markPortalGuiaVistaAction()).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("portal_marcar_guia_vista");
  });

  it("si falla responde ok: false", async () => {
    vi.stubEnv("PORTAL_VISTA_SIMPLE", "true");
    vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    await expect(markPortalGuiaVistaAction()).resolves.toEqual({ ok: false });
  });
});

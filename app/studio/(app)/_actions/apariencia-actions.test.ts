/**
 * guardarAparienciaAction (SDD-0714): solo valores del catálogo y solo la clave
 * `studio_apariencia` del metadata propio.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  user: { id: "u1" } as { id: string } | null,
  updateError: null as { message: string } | null,
  updateUser: vi.fn(),
}));

vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: db.user } }),
      updateUser: async (attrs: unknown) => {
        db.updateUser(attrs);
        return { data: {}, error: db.updateError };
      },
    },
  }),
}));

import { guardarAparienciaAction } from "./apariencia-actions";
import type { AparienciaGuardada } from "@/app/studio/_components/apariencia-usuario";

beforeEach(() => {
  db.user = { id: "u1" };
  db.updateError = null;
  db.updateUser.mockClear();
});

describe("guardarAparienciaAction", () => {
  it.each([
    ["compact", "dark"],
    ["normal", "light"],
    ["ultra", "auto"],
  ] as const)("guarda %s + %s en studio_apariencia y nada más", async (vista, tema) => {
    expect(await guardarAparienciaAction({ vista, tema })).toEqual({ ok: true });
    expect(db.updateUser).toHaveBeenCalledWith({ data: { studio_apariencia: { vista, tema } } });
  });

  it("descarta campos de más: no se cuelan otras claves al metadata", async () => {
    await guardarAparienciaAction({ vista: "normal", tema: "light", role: "admin" } as unknown as AparienciaGuardada);
    expect(db.updateUser).toHaveBeenCalledWith({ data: { studio_apariencia: { vista: "normal", tema: "light" } } });
  });

  it.each([
    { vista: "spacious", tema: "dark" },
    { vista: "compact", tema: "sepia" },
    { vista: "compact" },
    null,
    "compact",
  ])("rechaza %j sin escribir", async (entrada) => {
    expect(await guardarAparienciaAction(entrada as unknown as AparienciaGuardada)).toEqual({
      error: "Vista o tema inválidos.",
    });
    expect(db.updateUser).not.toHaveBeenCalled();
  });

  it("sin sesión no guarda", async () => {
    db.user = null;
    expect(await guardarAparienciaAction({ vista: "compact", tema: "dark" })).toEqual({ error: "Inicia sesión primero." });
    expect(db.updateUser).not.toHaveBeenCalled();
  });

  it("si Auth falla, lo dice sin filtrar el detalle", async () => {
    db.updateError = { message: "detalle interno" };
    expect(await guardarAparienciaAction({ vista: "compact", tema: "dark" })).toEqual({
      error: "No se pudo guardar en tu usuario.",
    });
  });
});

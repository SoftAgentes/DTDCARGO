// @vitest-environment node
/** SDD-0704 F1-B · Lectura y validación de la pestaña «Funciones». */
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { cadenaDelFormulario, codigoDeErrorDeCadena, leerFunciones, modelosOfrecidos } from "../funciones";

function cliente(respuestas: Record<string, { data: unknown; error: { code?: string; message?: string } | null }>): SupabaseClient {
  const cadena = (tabla: string) => {
    const fin = Promise.resolve(respuestas[tabla]);
    const q: Record<string, unknown> = {};
    for (const k of ["select", "in", "neq", "order", "limit"]) q[k] = () => q;
    q.then = fin.then.bind(fin);
    return q;
  };
  return { from: cadena } as unknown as SupabaseClient;
}

describe("leerFunciones", () => {
  it("arma la cadena de cada función y toma el salto más reciente", async () => {
    const lectura = await leerFunciones(
      cliente({
        ia_cadenas: {
          data: [
            { funcion: "a1_noticias", puesto: 1, proveedor: "anthropic", modelo: "claude-sonnet-5-5" },
            { funcion: "a1_noticias", puesto: 2, proveedor: "anthropic", modelo: "claude-haiku-5-5" },
            { funcion: "otra", puesto: 1, proveedor: "anthropic", modelo: "claude-opus-5-5" },
          ],
          error: null,
        },
        ia_eventos: {
          data: [
            { funcion: "a2_brief", ts: "2026-11-22T10:00:00Z", puesto: 1, modelo: "claude-sonnet-5-5", resultado: "proveedor_caido" },
            { funcion: "a2_brief", ts: "2026-11-21T10:00:00Z", puesto: 2, modelo: "claude-haiku-5-5", resultado: "otro" },
          ],
          error: null,
        },
      }),
    );
    expect(lectura.ok).toBe(true);
    if (!lectura.ok) return;
    expect(lectura.datos.cadenas.a1_noticias.map((p) => p.modelo)).toEqual(["claude-sonnet-5-5", "claude-haiku-5-5"]);
    expect(lectura.datos.cadenas.a2_brief).toEqual([]);
    expect(lectura.datos.ultimoSalto.a2_brief).toMatchObject({ puesto: 1, resultado: "proveedor_caido" });
    expect(lectura.datos.ultimoSalto.a1_noticias).toBeNull();
  });

  it("sin la 0571 dice que falta la migración", async () => {
    const lectura = await leerFunciones(
      cliente({ ia_cadenas: { data: null, error: { code: "PGRST205" } }, ia_eventos: { data: null, error: { code: "PGRST205" } } }),
    );
    expect(lectura).toEqual({ ok: false, motivo: "sin_migracion" });
  });
});

describe("cadenaDelFormulario", () => {
  it("acepta de 1 a 3 en orden", () => {
    expect(cadenaDelFormulario("a2_brief", ["anthropic/claude-sonnet-5-5", "", ""])).toEqual({
      ok: true, proveedores: ["anthropic"], modelos: ["claude-sonnet-5-5"],
    });
  });
  it("no deja un hueco, un formato raro ni un modelo que la lista no ofrece", () => {
    expect(cadenaDelFormulario("a1_noticias", ["anthropic/claude-sonnet-5-5", "", "anthropic/claude-opus-5-5"])).toMatchObject({ ok: false, codigo: "cadena_invalida" });
    expect(cadenaDelFormulario("a1_noticias", ["anthropic/claude/x", "", ""])).toMatchObject({ ok: false, codigo: "cadena_invalida" });
    expect(cadenaDelFormulario("a1_noticias", ["openai/gpt-x", "", ""])).toMatchObject({ ok: false, codigo: "no_permitido" });
  });
  it("la lista solo ofrece modelos no chinos de la fase", () => {
    for (const f of ["a1_noticias", "a2_brief"] as const) {
      expect(modelosOfrecidos(f).every((o) => o.proveedor === "anthropic")).toBe(true);
    }
  });
});

describe("codigoDeErrorDeCadena", () => {
  it("convierte el error de la base en un código", () => {
    expect(codigoDeErrorDeCadena(null)).toBe("ok_cadena");
    expect(codigoDeErrorDeCadena({ message: "ia:cadena_invalida" })).toBe("cadena_invalida");
    expect(codigoDeErrorDeCadena({ message: 'duplicate key value violates unique constraint "ia_cadenas_sin_repetir"' })).toBe("repetido");
    expect(codigoDeErrorDeCadena({ message: "violates check constraint ia_cadenas_datos_no_chino" })).toBe("no_permitido");
    expect(codigoDeErrorDeCadena({ code: "23503", message: "fk" })).toBe("fuera_del_catalogo");
    expect(codigoDeErrorDeCadena({ code: "42883", message: "x" })).toBe("sin_migracion");
    expect(codigoDeErrorDeCadena({ message: "otra cosa" })).toBe("error");
  });
});

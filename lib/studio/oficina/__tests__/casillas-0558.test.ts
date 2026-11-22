/**
 * SDD-0626 · 0558: las casillas con tres estados (null ≠ false) y el cierre por conversación, del lado del ERP.
 * La base lo repite con checks (supabase/tests/0558_…test.sql); aquí se fija lo que manda la página.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  CASILLAS,
  type EstadoCriterio,
  estadoDeMarcas,
  guardarRevision,
  leerPorCerrar,
  registrarCierre,
  revisionValida,
} from "../revisiones";

function cliente(respuesta: { data?: unknown; error?: { code: string; message?: string } | null }) {
  const llamadas: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const supabase = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      llamadas.push({ fn, args });
      return { data: respuesta.data ?? null, error: respuesta.error ?? null };
    },
  } as unknown as SupabaseClient;
  return { supabase, llamadas };
}

const todos = (e: EstadoCriterio) =>
  Object.fromEntries(CASILLAS.map((c) => [c.clave, e])) as Record<(typeof CASILLAS)[number]["clave"], EstadoCriterio>;

describe("0558 · marcas → tres estados", () => {
  it("sin marca = cumple; «Falló» = fallo; «No evaluado» = no_evaluado; las dos a la vez no valen", () => {
    expect(estadoDeMarcas(false, false)).toBe("cumple");
    expect(estadoDeMarcas(true, false)).toBe("fallo");
    expect(estadoDeMarcas(false, true)).toBe("no_evaluado");
    expect(estadoDeMarcas(true, true)).toBeNull();
  });

  it("son 4 criterios por mensaje: el cierre no va en la revisión", () => {
    expect(CASILLAS.map((c) => c.clave)).toEqual(["acuse", "guion_o_escalado", "cero_inventados", "pii_no_repetida"]);
  });

  it("un rechazo exige al menos un «Falló» (ni «cumple» ni «no evaluado» bastan)", () => {
    expect(revisionValida({ veredicto: "rechazado", criterios: todos("cumple") })).toEqual({ ok: false, codigo: "rechazo_sin_fallo" });
    expect(revisionValida({ veredicto: "rechazado", criterios: todos("no_evaluado") })).toEqual({
      ok: false,
      codigo: "rechazo_sin_fallo",
    });
    expect(revisionValida({ veredicto: "rechazado", criterios: { ...todos("no_evaluado"), acuse: "fallo" } })).toEqual({ ok: true });
    expect(revisionValida({ veredicto: "aprobado", criterios: todos("cumple") })).toEqual({ ok: true });
  });
});

describe("0558 · guardarRevision", () => {
  it("manda true / false / null a office_revisar_borrador_v2, sin p_cierre_3", async () => {
    const { supabase, llamadas } = cliente({});
    const r = await guardarRevision(supabase, {
      borradorId: "00000000-0000-4000-8000-000000000001",
      veredicto: "rechazado",
      criterios: { acuse: "fallo", guion_o_escalado: "cumple", cero_inventados: "no_evaluado", pii_no_repetida: "cumple" },
      motivo: "Prueba: rechazo previsto.",
      etapa: 1,
    });
    expect(r).toEqual({ ok: true });
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0].fn).toBe("office_revisar_borrador_v2");
    expect(llamadas[0].args).toEqual({
      p_borrador: "00000000-0000-4000-8000-000000000001",
      p_veredicto: "rechazado",
      p_motivo: "Prueba: rechazo previsto.",
      p_etapa: 1,
      p_acuse: false,
      p_guion_o_escalado: true,
      p_cero_inventados: null,
      p_pii_no_repetida: true,
    });
    expect(llamadas[0].args).not.toHaveProperty("p_cierre_3");
  });

  it("sin la 0558 (la función no existe) → sin_0558, y no prueba con la función vieja", async () => {
    const { supabase, llamadas } = cliente({ error: { code: "PGRST202" } });
    const r = await guardarRevision(supabase, {
      borradorId: "00000000-0000-4000-8000-000000000001",
      veredicto: "aprobado",
      criterios: todos("cumple"),
      motivo: "Bien.",
      etapa: 1,
    });
    expect(r).toEqual({ ok: false, codigo: "sin_0558" });
    expect(llamadas.map((l) => l.fn)).toEqual(["office_revisar_borrador_v2"]);
  });

  it.each([
    ["OFR01", "rechazo_sin_fallo"],
    ["23514", "no_aprobable"],
    ["23505", "ya_revisado"],
    ["42501", "sin_permiso"],
    ["55000", "no_en_aprobacion"],
    ["22023", "invalido"],
    ["XX000", "error"],
  ])("el código %s de la base → %s", async (code, codigo) => {
    const { supabase } = cliente({ error: { code } });
    const r = await guardarRevision(supabase, {
      borradorId: "00000000-0000-4000-8000-000000000001",
      veredicto: "aprobado",
      criterios: todos("cumple"),
      motivo: "x",
      etapa: 1,
    });
    expect(r).toEqual({ ok: false, codigo });
  });
});

describe("0558 · cierres", () => {
  it("registrarCierre manda la conversación, si cumple, el motivo y la etapa", async () => {
    const { supabase, llamadas } = cliente({});
    expect(await registrarCierre(supabase, { conversacion: "22", cumple: false, motivo: "Cuatro vueltas.", etapa: 2 })).toEqual({
      ok: true,
    });
    expect(llamadas[0]).toEqual({
      fn: "office_registrar_cierre",
      args: { p_conversacion: "22", p_cumple: false, p_motivo: "Cuatro vueltas.", p_etapa: 2 },
    });
  });

  it.each([
    ["PGRST202", "sin_0558"],
    ["23505", "ya_cerrada"],
    ["42501", "sin_permiso"],
    ["P0002", "invalido"],
  ])("el código %s de la base → %s", async (code, codigo) => {
    const { supabase } = cliente({ error: { code } });
    expect(await registrarCierre(supabase, { conversacion: "22", cumple: true, motivo: "x", etapa: 1 })).toEqual({ ok: false, codigo });
  });

  it("leerPorCerrar devuelve las conversaciones, y sin la 0558 → sin_migracion", async () => {
    const ok = cliente({ data: [{ conversacion: "22", revisiones: 2, ultima_revision: "2026-11-17T19:24:00Z" }] });
    expect(await leerPorCerrar(ok.supabase, 1)).toEqual({
      ok: true,
      datos: [{ conversacion: "22", revisiones: 2, ultimaRevision: "2026-11-17T19:24:00Z" }],
    });
    expect(ok.llamadas[0]).toEqual({ fn: "office_conversaciones_por_cerrar", args: { p_etapa: 1 } });
    const sin = cliente({ error: { code: "PGRST202" } });
    expect(await leerPorCerrar(sin.supabase, 1)).toEqual({ ok: false, motivo: "sin_migracion" });
  });
});

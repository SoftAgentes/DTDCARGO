// @vitest-environment node
/** SDD-0704 F1-B · Lectura y validación de la pestaña «Funciones». */
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { cadenaDelFormulario, codigoDeErrorDeCadena, leerFunciones, modelosOfrecidos } from "../funciones";

type Fila = Record<string, unknown>;
type Tablas = Record<string, { filas: Fila[]; error?: { code?: string; message?: string } | null }>;

/**
 * Un doble de PostgREST que FILTRA de verdad (`in`, `eq`, `neq`, `order`, `limit`), para que quitar un filtro de
 * `leerFunciones` cambie lo que devuelve. Anota el `limit` de cada consulta.
 */
function cliente(tablas: Tablas, limites: Array<{ tabla: string; limite: number | null }> = []): SupabaseClient {
  const desde = (tabla: string) => {
    let filas = [...(tablas[tabla]?.filas ?? [])];
    let limite: number | null = null;
    const q: Record<string, unknown> = {
      select: () => q,
      in: (c: string, vs: unknown[]) => ((filas = filas.filter((f) => vs.includes(f[c]))), q),
      eq: (c: string, v: unknown) => ((filas = filas.filter((f) => f[c] === v)), q),
      neq: (c: string, v: unknown) => ((filas = filas.filter((f) => f[c] !== v)), q),
      order: (c: string, o?: { ascending?: boolean }) => {
        const asc = o?.ascending !== false;
        filas.sort((a, b) => (String(a[c]) < String(b[c]) ? (asc ? -1 : 1) : String(a[c]) > String(b[c]) ? (asc ? 1 : -1) : 0));
        return q;
      },
      limit: (n: number) => ((limite = n), q),
    };
    q.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => {
      limites.push({ tabla, limite });
      const error = tablas[tabla]?.error ?? null;
      const data = error ? null : limite === null ? filas : filas.slice(0, limite);
      return Promise.resolve({ data, error }).then(ok, ko);
    };
    return q;
  };
  return { from: desde } as unknown as SupabaseClient;
}

const CADENAS: Fila[] = [
  { funcion: "a1_noticias", puesto: 2, proveedor: "anthropic", modelo: "claude-haiku-5-5" },
  { funcion: "a1_noticias", puesto: 1, proveedor: "anthropic", modelo: "claude-sonnet-5-5" },
  { funcion: "otra", puesto: 1, proveedor: "anthropic", modelo: "claude-opus-5-5" },
];

/**
 * Los eventos están pensados para que quitar cualquier filtro cambie el resultado:
 * - el más reciente de todos es de A2 y NO es salto (sin `eq("salto", true)` saldría ese);
 * - A2 tiene un salto más nuevo que todos los de A1 (sin `eq("funcion")`, A1 se quedaría sin el suyo);
 * - van desordenados por fecha (sin `order` saldría el viejo).
 */
const EVENTOS: Fila[] = [
  { funcion: "a1_noticias", ts: "2026-11-20T08:00:00Z", puesto: 1, modelo: "claude-sonnet-5-5", resultado: "llave_invalida", salto: true },
  { funcion: "a2_brief", ts: "2026-11-23T09:00:00Z", puesto: 2, modelo: "claude-haiku-5-5", resultado: "otro", salto: false },
  { funcion: "a1_noticias", ts: "2026-11-21T08:00:00Z", puesto: 1, modelo: "claude-sonnet-5-5", resultado: "proveedor_caido", salto: true },
  { funcion: "a2_brief", ts: "2026-11-22T10:00:00Z", puesto: 1, modelo: "claude-sonnet-5-5", resultado: "falta_de_pago", salto: true },
  { funcion: "a1_noticias", ts: "2026-11-22T07:00:00Z", puesto: 1, modelo: "claude-sonnet-5-5", resultado: "limite_de_uso", salto: false },
];

type Leer = typeof leerFunciones;

async function comprobar(leer: Leer): Promise<void> {
  const limites: Array<{ tabla: string; limite: number | null }> = [];
  const lectura = await leer(cliente({ ia_cadenas: { filas: CADENAS }, ia_eventos: { filas: EVENTOS } }, limites));
  expect(lectura.ok).toBe(true);
  if (!lectura.ok) return;
  expect(lectura.datos.cadenas.a1_noticias.map((p) => p.modelo)).toEqual(["claude-sonnet-5-5", "claude-haiku-5-5"]);
  expect(lectura.datos.cadenas.a2_brief).toEqual([]);
  // El salto real más reciente de CADA función; ni el «otro» de A2 ni el 429 de A1 cuentan.
  expect(lectura.datos.ultimoSalto.a1_noticias).toMatchObject({ ts: "2026-11-21T08:00:00Z", resultado: "proveedor_caido" });
  expect(lectura.datos.ultimoSalto.a2_brief).toMatchObject({ ts: "2026-11-22T10:00:00Z", resultado: "falta_de_pago" });
  // Cada consulta de eventos trae una sola fila.
  const deEventos = limites.filter((l) => l.tabla === "ia_eventos");
  expect(deEventos).toHaveLength(2);
  expect(deEventos.every((l) => l.limite === 1)).toBe(true);
}

describe("leerFunciones", () => {
  it("arma la cadena en orden y toma el último salto real de cada función", async () => {
    await comprobar(leerFunciones);
  });

  it("sin salto registrado, la función queda sin último salto", async () => {
    const lectura = await leerFunciones(
      cliente({ ia_cadenas: { filas: [] }, ia_eventos: { filas: EVENTOS.filter((e) => e.funcion === "a1_noticias") } }),
    );
    expect(lectura.ok && lectura.datos.ultimoSalto.a2_brief).toBeNull();
  });

  it("sin la 0571 dice que falta la migración", async () => {
    const lectura = await leerFunciones(
      cliente({ ia_cadenas: { filas: [], error: { code: "PGRST205" } }, ia_eventos: { filas: [], error: { code: "PGRST205" } } }),
    );
    expect(lectura).toEqual({ ok: false, motivo: "sin_migracion" });
  });

  // MUTANTES: cada uno quita un filtro de `leerFunciones` y la comprobación tiene que caer.
  const FUENTE = resolve(dirname(fileURLToPath(import.meta.url)), "../funciones.ts");
  const mutantes: Array<[string, string, string]> = [
    ["sin el filtro de salto", '        .eq("salto", true)\n', ""],
    ["sin el filtro de función", '        .eq("funcion", clave)\n', ""],
    ["sin el orden por fecha", '        .order("ts", { ascending: false })\n', ""],
    ["sin el límite de una fila", "        .limit(1),\n", ",\n"],
    ["el orden al revés", '.order("ts", { ascending: false })', '.order("ts", { ascending: true })'],
  ];
  for (const [nombre, buscar, poner] of mutantes) {
    it(`MUTANTE: ${nombre} → la comprobación cae`, async () => {
      const original = readFileSync(FUENTE, "utf8");
      expect(original.includes(buscar), `el mutante no encontró: ${buscar}`).toBe(true);
      const copia = resolve(dirname(FUENTE), `.funciones.mutante-${process.pid}-${mutantes.findIndex((m) => m[0] === nombre)}.ts`);
      writeFileSync(copia, original.replace(buscar, poner));
      try {
        const mod = (await import(/* @vite-ignore */ pathToFileURL(copia).href)) as { leerFunciones: Leer };
        await expect(comprobar(mod.leerFunciones)).rejects.toThrow();
      } finally {
        rmSync(copia, { force: true });
      }
    });
  }
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

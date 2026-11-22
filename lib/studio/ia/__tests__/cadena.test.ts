import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { CATALOGO_MODELOS, MARCA_DE_LA_FUNCION, esChino, proveedorPermitido } from "../catalogo";
import {
  type FuenteDeCadena,
  type Intento,
  MODELO_POR_DEFECTO,
  type Puesto,
  cadenaEfectiva,
  conCadenaAnthropic,
  fuenteConSesion,
  fuenteDeServicio,
} from "../cadena";

/** Un error del SDK de Anthropic, por forma (sin el SDK). */
function errorApi(status: number, tipo: string): Error {
  return Object.assign(new Error(`${status} ${tipo}`), { status, error: { type: "error", error: { type: tipo, message: "x" } } });
}

const P = (puesto: number, modelo: string): Puesto => ({ puesto, proveedor: "anthropic", modelo });

function fuenteFalsa(cadena: Puesto[] | null): FuenteDeCadena & { intentos: Intento[] } {
  const intentos: Intento[] = [];
  return {
    intentos,
    leer: async () => cadena,
    registrar: async (_f, i) => {
      intentos.push(i);
    },
  };
}

const TRES = [P(1, "claude-sonnet-5-5"), P(2, "claude-haiku-5-5"), P(3, "claude-opus-5-5")];

describe("cadenaEfectiva", () => {
  it("sin cadena vale el modelo por defecto", () => {
    expect(cadenaEfectiva("a1_noticias", null)).toEqual([P(1, MODELO_POR_DEFECTO.a1_noticias)]);
    expect(cadenaEfectiva("a2_brief", [])).toEqual([P(1, MODELO_POR_DEFECTO.a2_brief)]);
  });
  it("ordena, quita repetidos, lo de fuera del catálogo y lo que no es de la fase, y corta en 3", () => {
    const leida: Puesto[] = [
      P(3, "claude-opus-5-5"),
      P(1, "claude-sonnet-5-5"),
      P(2, "claude-sonnet-5-5"),
      P(2, "modelo-inventado"),
      { puesto: 2, proveedor: "zai", modelo: "glm-5.3" },
      P(4, "claude-haiku-5-5"),
      P(5, "claude-sonnet-4-6"),
    ];
    expect(cadenaEfectiva("a1_noticias", leida)).toEqual([P(1, "claude-sonnet-5-5"), P(2, "claude-opus-5-5"), P(3, "claude-haiku-5-5")]);
  });
});

describe("conCadenaAnthropic · el cambio automático (§4.1)", () => {
  it("un 5xx en el 1.º pasa al 2.º; un 5xx en el 2.º pasa al 3.º y la tarea termina", async () => {
    const fuente = fuenteFalsa(TRES);
    const llamar = vi.fn(async (modelo: string) => {
      if (modelo !== "claude-opus-5-5") throw errorApi(529, "overloaded_error");
      return { texto: "listo", usage: { input_tokens: 10, output_tokens: 20 } };
    });
    await expect(conCadenaAnthropic({ funcion: "a1_noticias", fuente, llamar })).resolves.toMatchObject({ texto: "listo" });
    expect(llamar.mock.calls.map((c) => c[0])).toEqual(["claude-sonnet-5-5", "claude-haiku-5-5", "claude-opus-5-5"]);
    expect(fuente.intentos.map((i) => [i.puesto, i.resultado, i.salto])).toEqual([
      [1, "proveedor_caido", true],
      [2, "proveedor_caido", true],
      [3, "ok", false],
    ]);
    expect(fuente.intentos[2]).toMatchObject({ tokensEntrada: 10, tokensSalida: 20 });
  });

  it("falta de pago y llave no válida también saltan", async () => {
    for (const err of [errorApi(402, "billing_error"), errorApi(401, "authentication_error")]) {
      const fuente = fuenteFalsa(TRES.slice(0, 2));
      const llamar = vi.fn(async (m: string) => {
        if (m === "claude-sonnet-5-5") throw err;
        return "ok";
      });
      await expect(conCadenaAnthropic({ funcion: "a2_brief", fuente, llamar })).resolves.toBe("ok");
      expect(llamar).toHaveBeenCalledTimes(2);
    }
  });

  it("un 400 o un 429 de ritmo NO saltan: relanza el error original y no prueba el 2.º", async () => {
    for (const err of [errorApi(400, "invalid_request_error"), errorApi(429, "rate_limit_error")]) {
      const fuente = fuenteFalsa(TRES);
      const llamar = vi.fn(async () => {
        throw err;
      });
      await expect(conCadenaAnthropic({ funcion: "a1_noticias", fuente, llamar })).rejects.toBe(err);
      expect(llamar).toHaveBeenCalledTimes(1);
      expect(fuente.intentos).toHaveLength(1);
      expect(fuente.intentos[0].salto).toBe(false);
    }
  });

  it("un fallo de la función (no del proveedor) no salta", async () => {
    const fuente = fuenteFalsa(TRES);
    const err = new TypeError("respuesta sin bloques");
    const llamar = vi.fn(async () => {
      throw err;
    });
    await expect(conCadenaAnthropic({ funcion: "a1_noticias", fuente, llamar })).rejects.toBe(err);
    expect(llamar).toHaveBeenCalledTimes(1);
  });

  it("si los tres fallan, relanza el último error (la función sigue su salida manual)", async () => {
    const fuente = fuenteFalsa(TRES);
    const errores = [errorApi(500, "api_error"), errorApi(503, "api_error"), errorApi(529, "overloaded_error")];
    let n = 0;
    const llamar = vi.fn(async () => {
      throw errores[n++];
    });
    await expect(conCadenaAnthropic({ funcion: "a1_noticias", fuente, llamar })).rejects.toBe(errores[2]);
    expect(llamar).toHaveBeenCalledTimes(3);
    // La falla del último puesto no es un salto: no hubo a dónde pasar.
    expect(fuente.intentos.map((i) => i.salto)).toEqual([true, true, false]);
  });

  it("cada llamada nueva empieza por el 1.º (D-2 de Sam)", async () => {
    const fuente = fuenteFalsa(TRES);
    const vistos: string[] = [];
    let primera = true;
    const llamar = async (m: string) => {
      vistos.push(m);
      if (primera && m === "claude-sonnet-5-5") {
        primera = false;
        throw errorApi(503, "api_error");
      }
      return "ok";
    };
    await conCadenaAnthropic({ funcion: "a1_noticias", fuente, llamar });
    await conCadenaAnthropic({ funcion: "a1_noticias", fuente, llamar });
    expect(vistos).toEqual(["claude-sonnet-5-5", "claude-haiku-5-5", "claude-sonnet-5-5"]);
  });

  it("si leer la cadena o anotar falla, la función sigue con el modelo por defecto", async () => {
    const fuente: FuenteDeCadena = {
      leer: async () => {
        throw new Error("base caída");
      },
      registrar: async () => {
        throw new Error("base caída");
      },
    };
    const llamar = vi.fn(async (m: string) => m);
    await expect(conCadenaAnthropic({ funcion: "a2_brief", fuente, llamar })).resolves.toBe(MODELO_POR_DEFECTO.a2_brief);
  });

  it("sin fuente (sin base) usa el modelo por defecto y no anota nada", async () => {
    const llamar = vi.fn(async (m: string) => m);
    await expect(conCadenaAnthropic({ funcion: "a1_noticias", fuente: null, llamar })).resolves.toBe(MODELO_POR_DEFECTO.a1_noticias);
  });

  it("lo anotado nunca lleva el texto del error", async () => {
    const fuente = fuenteFalsa(TRES.slice(0, 1));
    const err = Object.assign(new Error("credit balance is too low para cuenta de alguien@correo.prueba"), { status: 400 });
    await expect(conCadenaAnthropic({ funcion: "a1_noticias", fuente, llamar: async () => { throw err; } })).rejects.toBe(err);
    expect(JSON.stringify(fuente.intentos)).not.toContain("alguien@correo.prueba");
    expect(fuente.intentos[0].resultado).toBe("falta_de_pago");
  });
});

describe("regla D-2 en el catálogo", () => {
  it("ninguna función con datos de clientes permite un proveedor chino", () => {
    for (const [funcion, marca] of Object.entries(MARCA_DE_LA_FUNCION)) {
      for (const m of CATALOGO_MODELOS) {
        if (marca === "con_datos" && esChino(m.proveedor)) expect(proveedorPermitido(funcion, m.proveedor), `${funcion} ${m.modelo}`).toBe(false);
      }
    }
  });
  it("la cadena efectiva de una función nunca trae un chino", () => {
    const leida: Puesto[] = [
      { puesto: 1, proveedor: "zai", modelo: "glm-5.3" },
      { puesto: 2, proveedor: "deepseek", modelo: "deepseek-chat" },
    ];
    for (const f of ["a1_noticias", "a2_brief"] as const) {
      expect(cadenaEfectiva(f, leida).every((p) => !esChino(p.proveedor))).toBe(true);
    }
  });
});

describe("fuentes", () => {
  it("con sesión: lee por ia_cadena_de y anota por ia_registrar_evento", async () => {
    const llamadas: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const supabase = {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        llamadas.push({ fn, args });
        return fn === "ia_cadena_de"
          ? { data: [{ puesto: 1, proveedor: "anthropic", modelo: "claude-haiku-5-5" }], error: null }
          : { data: null, error: null };
      },
    } as unknown as SupabaseClient;
    const f = fuenteConSesion(supabase);
    expect(await f.leer("a1_noticias")).toEqual([P(1, "claude-haiku-5-5")]);
    await f.registrar("a1_noticias", {
      puesto: 1, proveedor: "anthropic", modelo: "claude-haiku-5-5", resultado: "ok", status: null, codigo: null, tokensEntrada: 1, tokensSalida: 2, salto: false,
    });
    expect(llamadas.map((l) => l.fn)).toEqual(["ia_cadena_de", "ia_registrar_evento"]);
    expect(llamadas[1].args).toMatchObject({ p_funcion: "a1_noticias", p_resultado: "ok", p_tokens_salida: 2, p_salto: false });
  });

  it("con sesión: sin la 0571 (error de la base) no hay cadena", async () => {
    const supabase = { rpc: async () => ({ data: null, error: { code: "PGRST202", message: "x" } }) } as unknown as SupabaseClient;
    expect(await fuenteConSesion(supabase).leer("a1_noticias")).toBeNull();
  });

  it("de servicio: lee la cadena del tenant y agrega el evento con su tenant", async () => {
    const filtros: Array<[string, string]> = [];
    let insertado: Record<string, unknown> | null = null;
    const admin = {
      from: (tabla: string) => ({
        select: () => ({
          eq: (c1: string, v1: string) => ({
            eq: (c2: string, v2: string) => ({
              order: async () => {
                filtros.push([c1, v1], [c2, v2]);
                return { data: tabla === "ia_cadenas" ? [{ puesto: 1, proveedor: "anthropic", modelo: "claude-sonnet-5-5" }] : [], error: null };
              },
            }),
          }),
        }),
        insert: async (fila: Record<string, unknown>) => {
          insertado = { tabla, ...fila };
          return { data: null, error: null };
        },
      }),
    } as unknown as SupabaseClient;
    const f = fuenteDeServicio(admin, "00000000-0000-0000-0000-00000000aaaa");
    expect(await f.leer("a2_brief")).toEqual([P(1, "claude-sonnet-5-5")]);
    expect(filtros).toEqual([["tenant_id", "00000000-0000-0000-0000-00000000aaaa"], ["funcion", "a2_brief"]]);
    await f.registrar("a2_brief", {
      puesto: 1, proveedor: "anthropic", modelo: "claude-sonnet-5-5", resultado: "proveedor_caido", status: 529, codigo: "overloaded_error", tokensEntrada: null, tokensSalida: null, salto: true,
    });
    expect(insertado).toMatchObject({ tabla: "ia_eventos", tenant_id: "00000000-0000-0000-0000-00000000aaaa", funcion: "a2_brief", resultado: "proveedor_caido", status: 529, salto: true });
  });
});

describe("la 0571 y el catálogo en código dicen lo mismo", () => {
  const sql = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), "../../../../supabase/migrations/0571_ia_cadenas_y_eventos.sql"),
    "utf8",
  );
  const lista = (texto: string) => [...texto.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]).sort();

  it("la lista fija del disparador es la de las funciones con datos de clientes de catalogo.ts", () => {
    const m = sql.match(/new\.datos_clientes := new\.funcion in \(([^)]*)\)/);
    expect(m, "no se encontró la lista del disparador").not.toBeNull();
    const conDatos = Object.entries(MARCA_DE_LA_FUNCION).filter(([, v]) => v === "con_datos").map(([k]) => k).sort();
    expect(lista(m![1])).toEqual(conDatos);
  });

  it("las funciones válidas de ia_cadenas e ia_eventos son las de catalogo.ts", () => {
    const funciones = Object.keys(MARCA_DE_LA_FUNCION).sort();
    for (const nombre of ["ia_cadenas_funcion_valida", "ia_eventos_funcion_valida"]) {
      const m = sql.match(new RegExp(`constraint ${nombre} check \\(funcion in \\(([^)]*)\\)`));
      expect(m, nombre).not.toBeNull();
      expect(lista(m![1]), nombre).toEqual(funciones);
    }
  });
});

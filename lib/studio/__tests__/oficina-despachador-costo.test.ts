// @vitest-environment node
/**
 * SDD-0704 F1-A · El despachador con el costo de la pantalla (0570): tope, tarifa por modelo, plan fijo y tokens,
 * con las variables de entorno de respaldo. Almacén y agente son dobles en memoria; las funciones SQL de la 0570
 * tienen su propio contrato (`ia-catalogo-y-costo.migration.test.ts`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { leerCosto, tick, type DepsDespachador } from "../oficina/despachador";
import { type AlmacenDespachador, ErrorDelAlmacen, type PasoDeBitacora, SinMigracion } from "../oficina/despachador-almacen";
import { configDespachador } from "../oficina/despachador-config";
import { olvidarAvisosParaPruebas } from "../oficina/escritura";

const ENV = {
  OFICINA_DESPACHADOR_ACTIVO: "1",
  OFICINA_VACIADO_ACTIVO: "1",
  OFICINA_RUNTIME_URL: "http://runtime.prueba:18642",
  OFICINA_RUNTIME_TOKEN: "token-de-prueba-del-cable",
  OFICINA_CHATWOOT_TOKEN_LECTURA: "token-de-lectura-de-prueba",
  OFICINA_CHATWOOT_API_URL: "http://chatwoot.prueba:3000",
  OFICINA_CHATWOOT_ACCOUNT_ID: "2",
  OFICINA_CHATWOOT_INBOX_PRUEBA: "11",
  OFICINA_TOPE_MENSUAL_USD: "4",
  OFICINA_PRECIO_ENTRADA_USD_MTOK: "2",
  OFICINA_PRECIO_SALIDA_USD_MTOK: "10",
};

const RESPUESTA = JSON.stringify({
  respuesta: {
    acuse: "Entiendo tu consulta.",
    texto: "Entiendo tu consulta. Se la paso ya a una persona del equipo de DTD Cargo, que te responde por este mismo chat.",
    guion: "derivar-equipo",
  },
});

type Costo = (() => Promise<unknown>) | undefined;

function armar(o: { costo?: Costo; modelo?: string | null; sinFuncionesNuevas?: boolean } = {}) {
  const pasos: PasoDeBitacora[] = [];
  const autopausas: Array<[number, number]> = [];
  const porLlamadas: Array<[number, number]> = [];
  const registros: string[] = [];
  let tareas = 1;
  const almacen: AlmacenDespachador = {
    tomarTurno: async () => true,
    soltarTurno: async () => {},
    estaPausada: async () => false,
    autopausar: async (t, u) => {
      autopausas.push([t, u]);
      return false;
    },
    recuperar: async () => 0,
    convertir: async () => 0,
    tomarTarea: async () =>
      tareas-- > 0 ? { taskId: "t-1", runId: "r-1", entidadRef: "chatwoot:conversations/7/messages/1", prioridad: 1 } : null,
    anotar: async (p) => void pasos.push(p),
    entregar: async () => true,
    soltar: async () => true,
    ...(o.sinFuncionesNuevas
      ? {}
      : {
          leerCostoOficina: o.costo ?? (async () => null),
          autopausarPorLlamadas: async (t: number, u: number) => {
            porLlamadas.push([t, u]);
            return false;
          },
        }),
  };
  const d: DepsDespachador = {
    config: { ...configDespachador(ENV), vigilarPausaMs: 50 },
    almacen,
    leer: async () => [{ rol: "cliente", texto: "Hola, ¿cómo va lo mío?" }],
    llamar: async () => ({ contenido: RESPUESTA, entrada: 1_000_000, salida: 100_000, modelo: o.modelo === undefined ? "claude-haiku-5-5" : o.modelo }),
    borrarSesion: async () => true,
    registrar: (m) => registros.push(m),
  };
  const respuesta = () => pasos.find((p) => p.tipo === "modelo.respuesta");
  return { d, pasos, autopausas, porLlamadas, registros, respuesta };
}

const configuracion = (o: Record<string, unknown> = {}) => async () => ({
  version: 1,
  tope_usd: 2,
  cuenta: { tipo_cobro: "por_token", tope_llamadas_mes: null },
  modelos: [
    { proveedor: "anthropic", modelo: "claude-sonnet-5-5", entrada: 3, salida: 15 },
    { proveedor: "anthropic", modelo: "claude-haiku-5-5", entrada: 1, salida: 5 },
  ],
  ...o,
});

let espias: Array<ReturnType<typeof vi.spyOn>> = [];
beforeEach(() => {
  olvidarAvisosParaPruebas();
  espias = (["log", "info", "warn", "error"] as const).map((n) => vi.spyOn(console, n).mockImplementation(() => {}));
});
afterEach(() => {
  for (const e of espias) e.mockRestore();
});

describe("despachador · costo de la pantalla (SDD-0704 F1-A)", () => {
  it("sin la 0570: tope y tarifa del entorno, sin tokens, y lo avisa una vez", async () => {
    const a = armar({ costo: async () => Promise.reject(new SinMigracion()) });
    expect(await tick(a.d)).toMatchObject({ estado: "corrida" });
    expect(a.autopausas[0]).toEqual([4, 0.8]);
    // 1 M de entrada × 2 + 0,1 M de salida × 10 = 3 USD, con la tarifa global de siempre.
    expect(a.respuesta()).toMatchObject({ costoUsd: 3, modelo: "claude-haiku-5-5" });
    expect(a.respuesta()?.tokens).toBeUndefined();
    expect(a.registros.filter((r) => r.includes("0570"))).toHaveLength(1);
  });

  it("sin las funciones nuevas en el almacén: como hoy", async () => {
    const a = armar({ sinFuncionesNuevas: true });
    await tick(a.d);
    expect(a.respuesta()).toMatchObject({ costoUsd: 3 });
    expect(a.respuesta()?.tokens).toBeUndefined();
  });

  it("con la pantalla: su tope, la tarifa del modelo que respondió y los tokens", async () => {
    const a = armar({ costo: configuracion() });
    await tick(a.d);
    expect(a.autopausas.every(([t]) => t === 2)).toBe(true);
    // haiku: 1 M × 1 + 0,1 M × 5 = 1,5 USD (no la global de 3).
    expect(a.respuesta()).toMatchObject({ costoUsd: 1.5, tokens: { entrada: 1_000_000, salida: 100_000 } });
  });

  it("si el modelo no consta, cobra con la tarifa más alta declarada", async () => {
    const a = armar({ costo: configuracion(), modelo: null });
    await tick(a.d);
    // la más alta: 3 y 15 → 1 M × 3 + 0,1 M × 15 = 4,5 USD.
    expect(a.respuesta()).toMatchObject({ costoUsd: 4.5 });
  });

  it("plan fijo: 0 USD por llamada y auto-pausa por llamadas", async () => {
    const a = armar({ costo: configuracion({ cuenta: { tipo_cobro: "plan_fijo", tope_llamadas_mes: 150 }, modelos: [] }) });
    await tick(a.d);
    expect(a.respuesta()).toMatchObject({ costoUsd: 0, tokens: { entrada: 1_000_000, salida: 100_000 } });
    expect(a.porLlamadas.length).toBeGreaterThanOrEqual(2);
    expect(a.porLlamadas.every(([t, u]) => t === 150 && u === 0.8)).toBe(true);
  });

  it("un tope de la pantalla sobre el techo vale el techo", async () => {
    const c = await leerCosto(armar({ costo: configuracion({ tope_usd: 40 }) }).d);
    expect(c.topeMensualUsd).toBe(15);
  });

  it("si la base falla al leer la configuración, no corre nada (falla cerrado)", async () => {
    const a = armar({ costo: async () => Promise.reject(new ErrorDelAlmacen("57014")) });
    await expect(tick(a.d)).rejects.toBeInstanceOf(ErrorDelAlmacen);
    expect(a.pasos).toHaveLength(0);
  });
});

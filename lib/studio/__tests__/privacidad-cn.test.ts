/**
 * SDD-0531 · La regla y el ocultamiento de nombres para el equipo de China.
 *
 * Tres cosas que tienen que ser ciertas para que Tracking y Naviera no le
 * entreguen nombres a quien no debe verlos:
 *
 *  1. la regla es la de Almacén CN (SDD-0039 B.9), sin cambios;
 *  2. la lectura toma la membresía ACTIVA del usuario de la SESIÓN — el doble
 *     filtra de verdad, así que leer la de un compañero o la desactivada se nota —
 *     y ante la duda oculta;
 *  3. el ocultamiento no deja ningún dato del cliente con valor, a ninguna
 *     profundidad, y no toca lo que recibe (propiedad sobre estructuras al azar).
 */
import { describe, expect, it } from "vitest";
import {
  CLAVES_DE_DATOS_DEL_CLIENTE,
  LOTE_SIN_NOMBRE,
  canSeeClientNames,
  etiquetaDelCliente,
  ocultarDatosDelCliente,
  ocultarDatosDelPlanDeCarga,
  readCanSeeClientNames,
  segunVisibilidad,
} from "../privacidad-cn";
import { datosDelClienteConValor, dobleSupabase } from "./privacidad-cn-double";
import type { SupabaseClient } from "@supabase/supabase-js";

const YO = "u-yiwu";
const COMPANERO = "u-valencia";

function membresia(over: Record<string, unknown>) {
  return {
    user_id: YO,
    tenant_id: "t1",
    region: "cn",
    role: "operations",
    disabled_at: null,
    ...over,
  };
}

async function leer(opciones: Parameters<typeof dobleSupabase>[0]) {
  const { client } = dobleSupabase(opciones);
  return readCanSeeClientNames(client as SupabaseClient);
}

describe("regla: la misma de Almacén CN (SDD-0039 B.9)", () => {
  it.each([
    [{ region: "cn", role: "operations" }, false],
    [{ region: "cn", role: "warehouse" }, false],
    [{ region: "cn", role: "accounting" }, false],
    [{ region: "cn", role: null }, false],
    [{ region: "cn", role: "admin" }, true],
    [{ region: "ve", role: "operations" }, true],
    [{ region: "ve", role: "admin" }, true],
    [{ region: null, role: "operations" }, true],
  ])("%j → ve nombres: %s", (m, esperado) => {
    expect(canSeeClientNames(m)).toBe(esperado);
  });

  it("sin membresía la regla pura no oculta: así se comportaba Almacén CN", () => {
    // Almacén CN llama la regla con lo que leyó; nunca llega sin membresía
    // porque requireModuleView la exige. La lectura de abajo sí oculta.
    expect(canSeeClientNames(null)).toBe(true);
    expect(canSeeClientNames(undefined)).toBe(true);
  });
});

describe("lectura: la membresía activa del usuario de la sesión", () => {
  it("usuario de China sin rol admin → no ve nombres", async () => {
    expect(
      await leer({ userId: YO, tablas: { user_tenants: [membresia({})] } }),
    ).toBe(false);
  });

  it("usuario de Venezuela → sí", async () => {
    expect(
      await leer({
        userId: YO,
        tablas: { user_tenants: [membresia({ region: "ve" })] },
      }),
    ).toBe(true);
  });

  it("admin de China → sí (la excepción de la regla)", async () => {
    expect(
      await leer({
        userId: YO,
        tablas: { user_tenants: [membresia({ role: "admin" })] },
      }),
    ).toBe(true);
  });

  it("lee SU membresía, no la del compañero de Venezuela que aparece primero", async () => {
    expect(
      await leer({
        userId: YO,
        tablas: {
          user_tenants: [
            membresia({ user_id: COMPANERO, region: "ve" }),
            membresia({}),
          ],
        },
      }),
    ).toBe(false);
  });

  it("ignora su membresía desactivada aunque venga primero", async () => {
    expect(
      await leer({
        userId: YO,
        tablas: {
          user_tenants: [
            membresia({ region: "ve", disabled_at: "2026-10-01T00:00:00Z" }),
            membresia({}),
          ],
        },
      }),
    ).toBe(false);
  });

  it.each([
    ["sin sesión", { userId: null, tablas: { user_tenants: [membresia({ region: "ve" })] } }],
    ["sin membresía", { userId: YO, tablas: { user_tenants: [] } }],
    [
      "con la membresía desactivada",
      {
        userId: YO,
        tablas: {
          user_tenants: [membresia({ region: "ve", disabled_at: "2026-10-01T00:00:00Z" })],
        },
      },
    ],
    [
      "con la lectura en error",
      {
        userId: YO,
        tablas: { user_tenants: [membresia({ region: "ve" })] },
        fallar: ["user_tenants"],
      },
    ],
  ])("%s → la duda oculta", async (_caso, opciones) => {
    expect(await leer(opciones)).toBe(false);
  });
});

// ── Ocultamiento ──────────────────────────────────────────────────

/**
 * El inventario de SDD-0531 (§Inventario), escrito acá y no leído del módulo: si
 * alguien saca una clave del conjunto, las pruebas que lo usan como vara dejarían
 * de verla. Ésta no.
 */
const INVENTARIO_MINIMO = [
  "client_name",
  "clientName",
  "destination_gps",
  "delivery_address",
  "pod_signed_by",
  "phone",
  "email",
  "address",
  "rif",
  "cedula",
];

describe("el conjunto cubre el inventario de la spec", () => {
  it.each(INVENTARIO_MINIMO)("%s está entre las claves que se ocultan", (clave) => {
    expect(CLAVES_DE_DATOS_DEL_CLIENTE.has(clave)).toBe(true);
  });

  it("el Shipping Mark y los códigos NO se ocultan", () => {
    for (const clave of ["client_markbox", "markbox", "code", "ref", "name", "notes", "supplier_name"]) {
      expect(CLAVES_DE_DATOS_DEL_CLIENTE.has(clave), clave).toBe(false);
    }
  });
});

const ENVIO = {
  id: "s1",
  code: "S-2026-0042",
  client_name: "María Pérez",
  client_markbox: "DTD-0042",
  origin: "Yiwu",
  destination: "Valencia",
  destination_gps: "10.1620, -68.0077",
  shipment_service: "transporte_terrestre",
  status: "in_transit",
  notes: "Fragil",
  weight_kg: 120,
  created_at: "2026-10-10T12:00:00Z",
};

describe("ocultarDatosDelCliente", () => {
  it("al envío le saca nombre y ubicación y le deja el Shipping Mark y la operación", () => {
    const fuera = ocultarDatosDelCliente(ENVIO);
    expect(fuera).toEqual({
      ...ENVIO,
      client_name: null,
      destination_gps: null,
    });
  });

  it("no toca lo que recibe", () => {
    const antes = structuredClone(ENVIO);
    ocultarDatosDelCliente(ENVIO);
    expect(ENVIO).toEqual(antes);
  });

  it("una clave ausente sigue ausente: no inventa campos", () => {
    const fuera = ocultarDatosDelCliente({ code: "S-1", client_markbox: "DTD-1" });
    expect(fuera).toEqual({ code: "S-1", client_markbox: "DTD-1" });
    expect("client_name" in fuera).toBe(false);
  });

  it("llega adentro: piezas de un contenedor, estiba y plan", () => {
    const naviera = {
      contenedores: [
        {
          consolidation: { id: "c1", ref: "DTD-CONSOL-0001", notes: null },
          items: [
            { id: "i1", client_markbox: "DTD-0042", client_name: "María Pérez", supplier_name: "Yiwu Lamps" },
          ],
          stats: { cbmUsed: 3.2 },
        },
      ],
      estiba: { c1: [{ boxId: "b1", markbox: "DTD-0042", clientName: "María Pérez" }] },
    };
    const fuera = ocultarDatosDelCliente(naviera);
    expect(datosDelClienteConValor(fuera, CLAVES_DE_DATOS_DEL_CLIENTE)).toEqual([]);
    expect(fuera.contenedores[0].items[0]).toMatchObject({
      client_markbox: "DTD-0042",
      supplier_name: "Yiwu Lamps",
    });
    expect(fuera.estiba.c1[0].markbox).toBe("DTD-0042");
  });

  it("lo que no es objeto plano pasa tal cual", () => {
    const fecha = new Date("2026-10-10T00:00:00Z");
    const fuera = ocultarDatosDelCliente({ cuando: fecha, n: 3, s: "x" });
    expect(fuera.cuando).toBe(fecha);
    expect(fuera.n).toBe(3);
    expect(fuera.s).toBe("x");
  });

  it("segunVisibilidad: con permiso devuelve lo mismo; sin permiso, la copia oculta", () => {
    expect(segunVisibilidad(ENVIO, true)).toBe(ENVIO);
    expect(segunVisibilidad(ENVIO, false).client_name).toBeNull();
  });
});

// ── Propiedad ─────────────────────────────────────────────────────

/** PRNG determinista (mulberry32): una falla se reproduce con su semilla. */
function prng(semilla: number) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CLAVES_PII = [...CLAVES_DE_DATOS_DEL_CLIENTE];
const CLAVES_NEUTRAS = [
  "id", "code", "client_markbox", "markbox", "origin", "destination", "notes",
  "supplier_name", "status", "cbm", "items", "result", "input", "name", "ref",
];

function generar(r: () => number, profundidad: number): unknown {
  const tirada = r();
  if (profundidad <= 0 || tirada < 0.3) {
    const hoja = r();
    if (hoja < 0.25) return null;
    if (hoja < 0.5) return Math.round(r() * 1000);
    return `v${Math.round(r() * 1e6)}`;
  }
  if (tirada < 0.5) {
    return Array.from({ length: 1 + Math.floor(r() * 3) }, () => generar(r, profundidad - 1));
  }
  const obj: Record<string, unknown> = {};
  const n = 1 + Math.floor(r() * 5);
  for (let i = 0; i < n; i++) {
    const usarPii = r() < 0.4;
    const pool = usarPii ? CLAVES_PII : CLAVES_NEUTRAS;
    const clave = pool[Math.floor(r() * pool.length)];
    obj[clave] = usarPii ? `dato-personal-${i}` : generar(r, profundidad - 1);
  }
  return obj;
}

/** Hojas de `valor` cuya ruta no pasa por ninguna clave de datos del cliente. */
function hojasNeutras(valor: unknown, ruta = "$"): [string, unknown][] {
  if (Array.isArray(valor)) return valor.flatMap((v, i) => hojasNeutras(v, `${ruta}[${i}]`));
  if (valor === null || typeof valor !== "object") return [[ruta, valor]];
  return Object.entries(valor as Record<string, unknown>).flatMap(([k, v]) =>
    CLAVES_DE_DATOS_DEL_CLIENTE.has(k) ? [] : hojasNeutras(v, `${ruta}.${k}`),
  );
}

describe("propiedad: para un usuario de China no queda ningún dato del cliente", () => {
  it("en 500 estructuras al azar: cero datos con valor, el resto intacto, la entrada sin tocar", () => {
    for (let semilla = 1; semilla <= 500; semilla++) {
      const r = prng(semilla);
      const entrada = generar(r, 4);
      const antes = structuredClone(entrada);

      const fuera = segunVisibilidad(entrada, false);

      expect(
        datosDelClienteConValor(fuera, CLAVES_DE_DATOS_DEL_CLIENTE),
        `semilla ${semilla}`,
      ).toEqual([]);
      expect(JSON.stringify(fuera), `semilla ${semilla}`).not.toContain("dato-personal-");
      expect(hojasNeutras(fuera), `semilla ${semilla}`).toEqual(hojasNeutras(entrada));
      expect(entrada, `semilla ${semilla}`).toEqual(antes);
    }
  });

  it("con permiso de ver nombres, la misma estructura sale idéntica", () => {
    for (let semilla = 1; semilla <= 100; semilla++) {
      const entrada = generar(prng(semilla), 4);
      expect(segunVisibilidad(entrada, true)).toBe(entrada);
    }
  });
});

// ── Plan de carga ─────────────────────────────────────────────────

const PLAN = {
  id: "p1",
  consolidation_id: "c1",
  input: [
    { id: "l1", markbox: "DTD-0042", clientName: "María Pérez", cajas: 4, cbm: 2 },
    { id: "l2", markbox: null, clientName: "Ana María Rojas", cajas: 9, cbm: 6 },
    { id: "l3", markbox: null, clientName: "Ana", cajas: 1, cbm: 1 },
  ],
  result: {
    espacio: { code: "20GP", label: "20' estándar" },
    pasos: [{ paso: 1, loteId: "l1", markbox: "DTD-0042", clientName: "María Pérez", destino: "Valencia" }],
    sinUbicar: [{ loteId: "l2", markbox: null, clientName: "Ana María Rojas", cajas: 3, cbm: 2 }],
    avisos: [
      {
        tipo: "lote_partido",
        mensaje: "Ana María Rojas no entró completo: quedan 3 cajas (2 CBM) para el próximo contenedor.",
      },
      { tipo: "lote_partido", mensaje: "Ana no entró completo: quedan 1 cajas (1 CBM) para el próximo contenedor." },
      { tipo: "sobre_capacidad", mensaje: "34 CBM supera la capacidad útil de 28 CBM." },
    ],
  },
};

describe("ocultarDatosDelPlanDeCarga", () => {
  it("saca el nombre de los avisos, que lo llevan dentro del texto", () => {
    const fuera = ocultarDatosDelPlanDeCarga(PLAN);
    expect(fuera.result.avisos.map((a) => a.mensaje)).toEqual([
      `${LOTE_SIN_NOMBRE} no entró completo: quedan 3 cajas (2 CBM) para el próximo contenedor.`,
      `${LOTE_SIN_NOMBRE} no entró completo: quedan 1 cajas (1 CBM) para el próximo contenedor.`,
      "34 CBM supera la capacidad útil de 28 CBM.",
    ]);
  });

  it("el nombre largo se reemplaza entero antes que el corto que contiene", () => {
    const fuera = ocultarDatosDelPlanDeCarga(PLAN);
    expect(fuera.result.avisos[0].mensaje).not.toContain("María Rojas");
  });

  it("no queda ningún nombre en el plan, ni en claves ni en textos", () => {
    const fuera = ocultarDatosDelPlanDeCarga(PLAN);
    expect(datosDelClienteConValor(fuera, CLAVES_DE_DATOS_DEL_CLIENTE)).toEqual([]);
    const texto = JSON.stringify(fuera);
    for (const nombre of ["María Pérez", "Ana María Rojas", "Ana "]) {
      expect(texto).not.toContain(nombre);
    }
    expect(fuera.result.pasos[0].markbox).toBe("DTD-0042");
  });

  it("no toca el plan que recibe", () => {
    const antes = structuredClone(PLAN);
    ocultarDatosDelPlanDeCarga(PLAN);
    expect(PLAN).toEqual(antes);
  });

  it("un plan sin avisos o sin lotes con nombre sale bien", () => {
    expect(ocultarDatosDelPlanDeCarga({ input: [], result: { avisos: [] } })).toEqual({
      input: [],
      result: { avisos: [] },
    });
    expect(ocultarDatosDelPlanDeCarga({ input: null, result: null })).toEqual({
      input: null,
      result: null,
    });
  });
});

describe("etiquetaDelCliente", () => {
  it("con nombres ocultos dice el Shipping Mark, no «Sin cliente»", () => {
    expect(etiquetaDelCliente({ client_name: null, client_markbox: "DTD-0042" }, true)).toBe(
      "DTD-0042",
    );
    expect(etiquetaDelCliente({ client_name: null, client_markbox: null }, true)).toBe(
      "Sin Shipping Mark",
    );
  });

  it("aunque la fila trajera el nombre, oculto no lo muestra", () => {
    expect(
      etiquetaDelCliente({ client_name: "María Pérez", client_markbox: "DTD-0042" }, true),
    ).toBe("DTD-0042");
  });

  it("con nombres visibles hace lo de siempre", () => {
    expect(
      etiquetaDelCliente({ client_name: "María Pérez", client_markbox: "DTD-0042" }, false),
    ).toBe("María Pérez");
    expect(etiquetaDelCliente({ client_name: null, client_markbox: "DTD-0042" }, false)).toBe(
      "Sin cliente",
    );
  });
});

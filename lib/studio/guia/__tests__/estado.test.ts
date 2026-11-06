/**
 * SDD-0589 · 9.3 · Estado de la guía por usuario: validador, almacenes y lectura.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { crearAlmacenLocal, crearAlmacenMemoria, crearAlmacenServidor, ESPERA_GUARDADO_MS } from "../almacen";
import { estadoGuiaVacio, validarEstadoGuia, type EstadoGuia } from "../estado-types";
import { leerEstadoGuia } from "../estado-queries";
import type { GuiaRecorrido } from "../tipos";

const CATALOGO: GuiaRecorrido[] = [
  { id: "dashboard", ruta: "/studio/dashboard", pasos: [{ id: "D1", ancla: "dashboard.a", clave: "k.a" }, { id: "D2", ancla: "dashboard.b", clave: "k.b" }] },
  { id: "bandeja", ruta: "/studio/bandeja", pasos: [{ id: "B1", ancla: "bandeja.a", clave: "k.c" }] },
];

function storageFalso(): Storage {
  const datos = new Map<string, string>();
  return {
    get length() {
      return datos.size;
    },
    clear: () => datos.clear(),
    getItem: (k) => datos.get(k) ?? null,
    key: (i) => [...datos.keys()][i] ?? null,
    removeItem: (k) => void datos.delete(k),
    setItem: (k, v) => void datos.set(k, String(v)),
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("validarEstadoGuia", () => {
  it("deja solo recorridos y pasos del catálogo, con booleanos por defecto", () => {
    const e = validarEstadoGuia(
      {
        v: 1,
        recorridos: {
          dashboard: { pasoId: "D2", terminado: true, noMostrar: true, vistoEn: "2026-11-06T04:00:00.000Z" },
          bandeja: { pasoId: "XX", terminado: "sí", vistoEn: "ayer" },
          inventado: { pasoId: "Z1", terminado: true },
        },
      },
      CATALOGO,
    );
    expect(e).toEqual({
      v: 1,
      recorridos: {
        dashboard: { pasoId: "D2", terminado: true, noMostrar: true, vistoEn: "2026-11-06T04:00:00.000Z" },
        bandeja: { pasoId: null, terminado: false, noMostrar: false },
      },
    });
  });

  it("cualquier otra cosa queda como estado vacío", () => {
    for (const entrada of [null, undefined, 3, "x", [], { recorridos: [] }, { recorridos: "x" }, { recorridos: { dashboard: [] } }]) {
      expect(validarEstadoGuia(entrada, CATALOGO)).toEqual(estadoGuiaVacio());
    }
  });

  it("una fecha larga no entra", () => {
    const e = validarEstadoGuia({ recorridos: { dashboard: { vistoEn: `2026-11-06T04:00:00Z${" ".repeat(40)}` } } }, CATALOGO);
    expect(e.recorridos.dashboard?.vistoEn).toBeUndefined();
  });
});

describe("guardar conserva lo que ya había", () => {
  it("en memoria conserva los campos anteriores", () => {
    const a = crearAlmacenMemoria();
    a.guardar("dashboard", { vistoEn: "2026-11-06T04:00:00Z" });
    a.guardar("dashboard", { pasoId: "D2" });
    expect(a.leer("dashboard")).toEqual({ pasoId: "D2", terminado: false, vistoEn: "2026-11-06T04:00:00Z" });
  });

  it("en el navegador conserva los campos anteriores", () => {
    const s = storageFalso();
    const a = crearAlmacenLocal(s);
    a.guardar("dashboard", { noMostrar: true });
    a.guardar("dashboard", { pasoId: "D1", terminado: true });
    expect(JSON.parse(s.getItem("dtd.guia.v1.dashboard") ?? "null")).toEqual({ pasoId: "D1", terminado: true, noMostrar: true });
  });
});

describe("crearAlmacenServidor", () => {
  const inicial: EstadoGuia = { v: 1, recorridos: { dashboard: { pasoId: "D2", terminado: false, noMostrar: false } } };

  it("se siembra con el estado de la base y no lee el navegador", () => {
    const s = storageFalso();
    s.setItem("dtd.guia.v1.dashboard", JSON.stringify({ pasoId: "D1", terminado: true }));
    const getItem = vi.spyOn(s, "getItem");
    const a = crearAlmacenServidor({ inicial, guardarRemoto: vi.fn(async () => ({ ok: true })), storage: s });
    expect(a.conServidor).toBe(true);
    expect(a.leer("dashboard")).toEqual(inicial.recorridos.dashboard);
    expect(getItem).not.toHaveBeenCalled();
  });

  it("agenda un solo envío con el estado completo, 650 ms después del último cambio", async () => {
    vi.useFakeTimers();
    const guardarRemoto = vi.fn(async () => ({ ok: true }));
    const s = storageFalso();
    const a = crearAlmacenServidor({ inicial, guardarRemoto, storage: s });
    a.guardar("dashboard", { pasoId: "D1" });
    a.guardar("bandeja", { vistoEn: "2026-11-06T04:00:00Z" });
    vi.advanceTimersByTime(ESPERA_GUARDADO_MS - 1);
    expect(guardarRemoto).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(guardarRemoto).toHaveBeenCalledTimes(1);
    expect(guardarRemoto).toHaveBeenCalledWith({
      v: 1,
      recorridos: {
        dashboard: { pasoId: "D1", terminado: false, noMostrar: false },
        bandeja: { pasoId: null, terminado: false, vistoEn: "2026-11-06T04:00:00Z" },
      },
    });
    // Copia en el navegador.
    expect(JSON.parse(s.getItem("dtd.guia.v1.bandeja") ?? "null")).toEqual({ pasoId: null, terminado: false, vistoEn: "2026-11-06T04:00:00Z" });
  });

  it("vaciar manda ya lo pendiente, y un rechazo de la base no rompe nada", async () => {
    vi.useFakeTimers();
    const guardarRemoto = vi.fn(async () => {
      throw new Error("sin red");
    });
    const a = crearAlmacenServidor({ inicial, guardarRemoto, storage: storageFalso() });
    a.guardar("dashboard", { terminado: true });
    a.vaciar();
    expect(guardarRemoto).toHaveBeenCalledTimes(1);
    a.vaciar();
    expect(guardarRemoto).toHaveBeenCalledTimes(1);
    await Promise.resolve();
  });

  it("sin estado de la base no llama al servidor y toma el navegador al montar", () => {
    vi.useFakeTimers();
    const guardarRemoto = vi.fn(async () => ({ ok: true }));
    const s = storageFalso();
    s.setItem("dtd.guia.v1.dashboard", JSON.stringify({ pasoId: "D2", terminado: false }));
    const a = crearAlmacenServidor({ inicial: null, guardarRemoto, storage: s });
    expect(a.conServidor).toBe(false);
    expect(a.leer("dashboard")).toBeNull();
    a.sincronizarAlMontar(["dashboard", "bandeja"]);
    expect(a.leer("dashboard")).toEqual({ pasoId: "D2", terminado: false });
    a.guardar("dashboard", { terminado: true });
    vi.advanceTimersByTime(5_000);
    a.vaciar();
    expect(guardarRemoto).not.toHaveBeenCalled();
  });

  it("con estado de la base, al montar lo copia al navegador", () => {
    const s = storageFalso();
    const a = crearAlmacenServidor({ inicial, guardarRemoto: vi.fn(async () => ({ ok: true })), storage: s });
    a.sincronizarAlMontar(["dashboard"]);
    expect(JSON.parse(s.getItem("dtd.guia.v1.dashboard") ?? "null")).toEqual(inicial.recorridos.dashboard);
  });
});

describe("leerEstadoGuia", () => {
  function supabaseCon(resultado: { data: unknown; error: unknown } | Error) {
    const maybeSingle = vi.fn(async () => {
      if (resultado instanceof Error) throw resultado;
      return resultado;
    });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    return { cliente: { from } as unknown as SupabaseClient, from, eq };
  }

  it("sin fila, estado vacío: nunca la vio", async () => {
    const { cliente, from, eq } = supabaseCon({ data: null, error: null });
    expect(await leerEstadoGuia(cliente, "u1")).toEqual(estadoGuiaVacio());
    expect(from).toHaveBeenCalledWith("user_guide_prefs");
    expect(eq).toHaveBeenCalledWith("user_id", "u1");
  });

  it("con fila, el estado validado", async () => {
    const { cliente } = supabaseCon({ data: { state: { recorridos: { dashboard: { pasoId: "D1", terminado: true }, x: {} } } }, error: null });
    expect(await leerEstadoGuia(cliente, "u1")).toEqual({
      v: 1,
      recorridos: { dashboard: { pasoId: "D1", terminado: true, noMostrar: false } },
    });
  });

  it("si la base falla o la tabla no existe, null y no lanza", async () => {
    expect(await leerEstadoGuia(supabaseCon({ data: null, error: { code: "42P01" } }).cliente, "u1")).toBeNull();
    expect(await leerEstadoGuia(supabaseCon(new Error("caída")).cliente, "u1")).toBeNull();
  });
});

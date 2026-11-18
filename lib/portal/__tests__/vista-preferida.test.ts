/**
 * SDD-0654 fase 1 · lectura de la vista preferida y llamadas a las RPC de la 0557.
 *
 * Lo que no se puede romper (AC-5): sin la columna, sin red, sin fila o con un
 * valor raro, la lectura degrada a «pro» y a «guía ya vista», no lanza y no
 * redirige. La escritura solo va por las dos RPC y nunca manda a quién escribir.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  VISTA_POR_OMISION,
  esPortalVista,
  getMyPortalVista,
  isPortalVistaSimpleEnabled,
  markMyPortalGuiaVista,
  setMyPortalVista,
} from "../vista-preferida";

const USER = "aaaaaaaa-0654-0000-0000-000000000001";

type Respuesta = { data: unknown; error: unknown };

/** Doble mínimo de la consulta encadenada; registra cada filtro. */
function dbLectura(respuesta: Respuesta | (() => never)) {
  const filtros: [string, unknown][] = [];
  const select = vi.fn();
  const chain = {
    select: (cols: string) => {
      select(cols);
      return chain;
    },
    eq: (col: string, val: unknown) => {
      filtros.push([col, val]);
      return chain;
    },
    maybeSingle: async () => {
      if (typeof respuesta === "function") respuesta();
      return respuesta as Respuesta;
    },
  };
  const from = vi.fn(() => chain);
  return { db: { from } as unknown as SupabaseClient, from, select, filtros };
}

function dbRpc(respuesta: Respuesta | Error) {
  const rpc = vi.fn(async () => {
    if (respuesta instanceof Error) throw respuesta;
    return respuesta;
  });
  return { db: { rpc } as unknown as SupabaseClient, rpc };
}

afterEach(() => vi.restoreAllMocks());

describe("isPortalVistaSimpleEnabled", () => {
  it("solo el texto exacto «true» enciende el interruptor", () => {
    expect(isPortalVistaSimpleEnabled({})).toBe(false);
    expect(isPortalVistaSimpleEnabled({ PORTAL_VISTA_SIMPLE: "" })).toBe(false);
    for (const v of ["1", "on", "TRUE", "True", " true", "yes"]) {
      expect(isPortalVistaSimpleEnabled({ PORTAL_VISTA_SIMPLE: v })).toBe(false);
    }
    expect(isPortalVistaSimpleEnabled({ PORTAL_VISTA_SIMPLE: "true" })).toBe(true);
  });

  it(".env.example lo declara apagado (vacío)", () => {
    const ejemplo = readFileSync(join(process.cwd(), ".env.example"), "utf8");
    const lineas = ejemplo.split(/\r?\n/).filter((l) => l.startsWith("PORTAL_VISTA_SIMPLE"));
    expect(lineas).toEqual(["PORTAL_VISTA_SIMPLE="]);
  });
});

describe("esPortalVista", () => {
  it("acepta simple y pro, nada más", () => {
    expect(esPortalVista("simple")).toBe(true);
    expect(esPortalVista("pro")).toBe(true);
    for (const v of ["light", "Simple", "PRO", "", null, undefined, 1, {}]) {
      expect(esPortalVista(v)).toBe(false);
    }
  });
});

describe("getMyPortalVista", () => {
  it("lee su fila activa, aparte del principal, y devuelve la vista guardada", async () => {
    const { db, from, select, filtros } = dbLectura({
      data: { portal_vista: "simple", portal_guia_vista_at: null },
      error: null,
    });
    await expect(getMyPortalVista(db, USER)).resolves.toEqual({ vista: "simple", guiaVista: false });
    expect(from).toHaveBeenCalledWith("client_users");
    expect(select).toHaveBeenCalledWith("portal_vista, portal_guia_vista_at");
    expect(filtros).toEqual([
      ["auth_user_id", USER],
      ["status", "active"],
    ]);
  });

  it("con la guía ya marcada devuelve guiaVista true", async () => {
    const { db } = dbLectura({
      data: { portal_vista: "pro", portal_guia_vista_at: "2026-11-17T12:00:00Z" },
      error: null,
    });
    await expect(getMyPortalVista(db, USER)).resolves.toEqual({ vista: "pro", guiaVista: true });
  });

  it("AC-5: sin la columna (0557 sin aplicar) degrada a pro y no lanza", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { db } = dbLectura({
      data: null,
      error: { code: "42703", message: "column client_users.portal_vista does not exist" },
    });
    await expect(getMyPortalVista(db, USER)).resolves.toEqual(VISTA_POR_OMISION);
    // El log lleva el código, nunca el id del usuario.
    expect(log).toHaveBeenCalledWith("[vista-preferida] no se pudo leer:", "42703");
    expect(JSON.stringify(log.mock.calls)).not.toContain(USER);
  });

  it("AC-5: error de PostgREST, red caída, fila ausente o valor raro: pro", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const casos: (Respuesta | (() => never))[] = [
      { data: null, error: { code: "PGRST204", message: "column not found" } },
      () => {
        throw new TypeError("fetch failed");
      },
      { data: null, error: null },
      { data: [], error: null },
      { data: { portal_vista: "light", portal_guia_vista_at: null }, error: null },
      { data: { portal_vista: null, portal_guia_vista_at: null }, error: null },
    ];
    for (const caso of casos) {
      const { db } = dbLectura(caso);
      await expect(getMyPortalVista(db, USER)).resolves.toEqual(VISTA_POR_OMISION);
    }
  });

  it("un valor de guía que no es null cuenta como «ya vista»", async () => {
    const { db } = dbLectura({ data: { portal_vista: "simple" }, error: null });
    await expect(getMyPortalVista(db, USER)).resolves.toEqual({ vista: "simple", guiaVista: true });
  });

  it("sin usuario no consulta", async () => {
    const { db, from } = dbLectura({ data: null, error: null });
    await expect(getMyPortalVista(db, "  ")).resolves.toEqual(VISTA_POR_OMISION);
    expect(from).not.toHaveBeenCalled();
  });

  it("devuelve una copia: nadie puede cambiar el valor por omisión", async () => {
    const { db } = dbLectura({ data: null, error: null });
    const r = await getMyPortalVista(db, USER);
    r.vista = "simple";
    expect(VISTA_POR_OMISION.vista).toBe("pro");
  });
});

describe("setMyPortalVista", () => {
  it("llama a portal_set_vista solo con la vista, sin identificadores", async () => {
    const { db, rpc } = dbRpc({ data: "simple", error: null });
    await expect(setMyPortalVista(db, "simple")).resolves.toBe("simple");
    expect(rpc).toHaveBeenCalledWith("portal_set_vista", { p_vista: "simple" });
  });

  it("un valor que no vale no llega a la base", async () => {
    const { db, rpc } = dbRpc({ data: "simple", error: null });
    for (const v of ["light", "", null, "Pro"]) {
      await expect(setMyPortalVista(db, v)).resolves.toBeNull();
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sin la 0557, sin vínculo o sin red devuelve null y no lanza", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const r of [
      { data: null, error: { code: "PGRST202", message: "function not found" } },
      { data: null, error: { code: "42501", message: "sin vínculo activo del Portal" } },
      { data: "otra", error: null },
      new TypeError("fetch failed"),
    ]) {
      const { db } = dbRpc(r);
      await expect(setMyPortalVista(db, "pro")).resolves.toBeNull();
    }
  });
});

describe("markMyPortalGuiaVista", () => {
  it("llama a portal_marcar_guia_vista sin argumentos", async () => {
    const { db, rpc } = dbRpc({ data: "2026-11-17T12:00:00Z", error: null });
    await expect(markMyPortalGuiaVista(db)).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith("portal_marcar_guia_vista");
  });

  it("degrada a false si falla", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const r of [{ data: null, error: { code: "PGRST202" } }, new Error("x")]) {
      const { db } = dbRpc(r);
      await expect(markMyPortalGuiaVista(db)).resolves.toBe(false);
    }
  });
});

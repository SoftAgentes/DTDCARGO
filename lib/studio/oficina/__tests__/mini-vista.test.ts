/**
 * SDD-0626 §3.6 (Paso 4) · La mini-vista del cable: solo lectura, solo superadministrador, apagada por defecto.
 *
 * Lo que se fija aquí:
 * - El candado: sin el «sí» de `is_platform_admin()` NO se crea el cliente de servicio (ni una consulta sale).
 * - Solo lectura: ninguna escritura (insert, update, upsert, delete) y una sola función, `office_gasto_del_mes`.
 * - Minimización: se piden las columnas de `COLUMNAS` y ninguna más (nunca `meta_datos` ni `clave_dedupe`).
 * - Sin la 0541 la lectura dice `sin_migracion`; un error cualquiera no repite el mensaje de la base en el log.
 * - La página: 404 con el interruptor apagado, sin acciones ni formularios, y todo como texto plano.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { vistaActiva } from "../config";
import { COLUMNAS, ESTADOS_EVENTO, ESTADOS_TAREA, LIMITES, conversacionDe, leerMiniVista } from "../mini-vista";

const ROOT = resolve(__dirname, "..", "..", "..", "..");
const PAGINA = "app/studio/(app)/admin/oficina-virtual/vista/page.tsx";

type Respuesta = { data?: unknown; error?: { code: string; message?: string } | null; count?: number | null };
interface Consulta {
  tabla: string;
  columnas: string;
  cabeza: boolean;
  orden: string | null;
  limite: number | null;
  estado: string | null;
}

/** Un doble del cliente de Supabase que solo sabe LEER: cualquier escritura revienta la prueba. */
function clienteDeLectura(filas: Record<string, Respuesta>, opciones: { conteo?: Respuesta; gasto?: Respuesta } = {}) {
  const consultas: Consulta[] = [];
  const funciones: string[] = [];
  const admin = {
    from(tabla: string) {
      const c: Consulta = { tabla, columnas: "", cabeza: false, orden: null, limite: null, estado: null };
      const consulta = {
        select(columnas: string, o?: { count?: string; head?: boolean }) {
          c.columnas = columnas;
          c.cabeza = o?.head === true;
          consultas.push(c);
          return consulta;
        },
        order(columna: string, o: { ascending: boolean }) {
          c.orden = `${columna} ${o.ascending ? "asc" : "desc"}`;
          return consulta;
        },
        limit(n: number) {
          c.limite = n;
          return consulta;
        },
        eq(columna: string, valor: string) {
          if (columna !== "estado") throw new Error(`filtro inesperado: ${columna}`);
          c.estado = valor;
          return consulta;
        },
        then(resolver: (r: { data: unknown; error: unknown; count: number | null }) => unknown) {
          const r = c.cabeza ? (opciones.conteo ?? { count: 0 }) : (filas[tabla] ?? { data: [] });
          return Promise.resolve(resolver({ data: r.data ?? null, error: r.error ?? null, count: r.count ?? null }));
        },
      };
      return new Proxy(consulta, {
        get(objetivo, prop) {
          if (typeof prop === "string" && ["insert", "update", "upsert", "delete"].includes(prop)) {
            throw new Error(`la mini-vista intentó escribir: ${prop} en ${tabla}`);
          }
          return Reflect.get(objetivo, prop);
        },
      });
    },
    async rpc(fn: string) {
      funciones.push(fn);
      const r = opciones.gasto ?? { data: 0 };
      return { data: r.data ?? null, error: r.error ?? null };
    },
  } as unknown as SupabaseClient;
  return { admin, consultas, funciones };
}

const FILAS: Record<string, Respuesta> = {
  office_paused: {
    data: [
      { pausada: false, cambiado_por: "11111111-1111-4111-8111-111111111111", cambiado_en: "2026-11-18T10:42:08Z", motivo: "Etapa 1" },
      { pausada: true, cambiado_por: null, cambiado_en: "2026-11-15T20:51:38Z", motivo: "La oficina nace pausada (SDD-0626 §3.1)." },
    ],
  },
  office_tasks: {
    data: [
      {
        id: "aaaaaaaa-0000-4000-8000-000000000001",
        titulo: "Mensaje de la bandeja de prueba",
        estado: "aprobación",
        asignado_a: "agente:soporte-chatwoot",
        prioridad: 2,
        entidad_ref: "chatwoot:conversations/25/messages/900",
        origen: "chatwoot",
        creado_en: "2026-11-18T10:43:00Z",
      },
    ],
  },
  event_inbox: {
    data: [
      {
        id: "bbbbbbbb-0000-4000-8000-000000000001",
        tipo: "chatwoot.message_created",
        origen: "chatwoot",
        prioridad: 2,
        payload_ref: "chatwoot:conversations/25/messages/900",
        estado: "convertido",
        ts: "2026-11-18T10:42:40Z",
      },
    ],
  },
  task_events: {
    data: [
      {
        id: "cccccccc-0000-4000-8000-000000000001",
        task_id: "aaaaaaaa-0000-4000-8000-000000000001",
        run_id: "dddddddd-0000-4000-8000-000000000001",
        tipo: "run.terminada",
        actor: "agente:soporte-chatwoot",
        resumen: null,
        costo_usd: "0.020700",
        modelo_usado: "glm-5.3",
        ts: "2026-11-18T10:44:17Z",
      },
    ],
  },
};

describe("mini-vista · el candado de superadministrador", () => {
  it("si la base dice que no es superadministrador, no se crea el cliente de servicio", async () => {
    let creados = 0;
    const r = await leerMiniVista({
      esAdmin: async () => false,
      crearAdmin: () => {
        creados++;
        return clienteDeLectura(FILAS).admin;
      },
    });
    expect(r).toEqual({ ok: false, motivo: "sin_permiso" });
    expect(creados).toBe(0);
  });

  it("si la pregunta a la base falla, tampoco (falla cerrado)", async () => {
    let creados = 0;
    const r = await leerMiniVista({
      esAdmin: async () => {
        throw new Error("sin red");
      },
      crearAdmin: () => {
        creados++;
        return clienteDeLectura(FILAS).admin;
      },
    });
    expect(r).toEqual({ ok: false, motivo: "sin_permiso" });
    expect(creados).toBe(0);
  });

  it("un «sí» que no es exactamente true no abre (un valor raro no es un permiso)", async () => {
    let creados = 0;
    const r = await leerMiniVista({
      esAdmin: (async () => "si") as unknown as () => Promise<boolean>,
      crearAdmin: () => {
        creados++;
        return clienteDeLectura(FILAS).admin;
      },
    });
    expect(r.ok).toBe(false);
    expect(creados).toBe(0);
  });
});

describe("mini-vista · solo lectura y solo las columnas del cable", () => {
  it("lee las 4 tablas con sus columnas, de lo nuevo a lo viejo y con tope; no escribe nada", async () => {
    const { admin, consultas, funciones } = clienteDeLectura(FILAS, { conteo: { count: 3 }, gasto: { data: "0.0207" } });
    const r = await leerMiniVista({ esAdmin: async () => true, crearAdmin: () => admin });
    expect(r.ok).toBe(true);

    const filas = consultas.filter((c) => !c.cabeza);
    expect(filas.map((c) => [c.tabla, c.columnas, c.orden, c.limite])).toEqual([
      ["office_paused", COLUMNAS.office_paused, "id desc", LIMITES.pausa],
      ["office_tasks", COLUMNAS.office_tasks, "creado_en desc", LIMITES.cola],
      ["event_inbox", COLUMNAS.event_inbox, "ts desc", LIMITES.eventos],
      ["task_events", COLUMNAS.task_events, "ts desc", LIMITES.bitacora],
    ]);
    // Los conteos: solo el id, sin filas, uno por estado.
    const conteos = consultas.filter((c) => c.cabeza);
    expect(conteos.every((c) => c.columnas === "id")).toBe(true);
    expect(conteos.filter((c) => c.tabla === "office_tasks").map((c) => c.estado)).toEqual([...ESTADOS_TAREA]);
    expect(conteos.filter((c) => c.tabla === "event_inbox").map((c) => c.estado)).toEqual([...ESTADOS_EVENTO]);
    // Una sola función, y es de lectura.
    expect(funciones).toEqual(["office_gasto_del_mes"]);
  });

  it("nunca pide meta_datos, clave_dedupe ni «*»", () => {
    const todas = Object.values(COLUMNAS).join(", ");
    expect(todas).not.toMatch(/meta_datos|clave_dedupe|\*/);
  });

  it("arma la vista: bandera vigente, conversación de la referencia, costo numérico y gasto del mes", async () => {
    const { admin } = clienteDeLectura(FILAS, { conteo: { count: 3 }, gasto: { data: "0.0207" } });
    const r = await leerMiniVista({ esAdmin: async () => true, crearAdmin: () => admin });
    if (!r.ok) throw new Error("se esperaba una lectura correcta");
    expect(r.datos.pausa.vigente).toEqual({
      pausada: false,
      cambiadoEn: "2026-11-18T10:42:08Z",
      quien: "persona:11111111-1111-4111-8111-111111111111",
      motivo: "Etapa 1",
    });
    expect(r.datos.pausa.historial[1].quien).toBe("sistema");
    expect(r.datos.cola.filas[0]).toMatchObject({ estado: "aprobación", conversacion: 25, asignadoA: "agente:soporte-chatwoot" });
    expect(r.datos.cola.porEstado["aprobación"]).toBe(3);
    expect(r.datos.eventos.porEstado.convertido).toBe(3);
    expect(r.datos.bitacora.filas[0]).toMatchObject({ costoUsd: 0.0207, resumen: null, modelo: "glm-5.3" });
    expect(r.datos.gastoMesUsd).toBe(0.0207);
  });

  it("sin filas de pausa no hay bandera vigente (la página la trata como pausada)", async () => {
    const { admin } = clienteDeLectura({ ...FILAS, office_paused: { data: [] } });
    const r = await leerMiniVista({ esAdmin: async () => true, crearAdmin: () => admin });
    if (!r.ok) throw new Error("se esperaba una lectura correcta");
    expect(r.datos.pausa.vigente).toBeNull();
  });

  it("una fila de pausa con un valor raro cuenta como pausada (falla cerrado)", async () => {
    const { admin } = clienteDeLectura({
      ...FILAS,
      office_paused: { data: [{ pausada: null, cambiado_por: null, cambiado_en: "2026-11-18T00:00:00Z", motivo: "x" }] },
    });
    const r = await leerMiniVista({ esAdmin: async () => true, crearAdmin: () => admin });
    if (!r.ok) throw new Error("se esperaba una lectura correcta");
    expect(r.datos.pausa.vigente?.pausada).toBe(true);
  });

  it("un conteo que falla queda en «?» (null) y el gasto que falla también: la vista no se cae", async () => {
    const { admin } = clienteDeLectura(FILAS, { conteo: { error: { code: "57014" } }, gasto: { error: { code: "42883" } } });
    const r = await leerMiniVista({ esAdmin: async () => true, crearAdmin: () => admin });
    if (!r.ok) throw new Error("se esperaba una lectura correcta");
    expect(r.datos.cola.porEstado.listo).toBeNull();
    expect(r.datos.gastoMesUsd).toBeNull();
  });
});

describe("mini-vista · cuando la base no acompaña", () => {
  it("sin la 0541 (la tabla no existe) dice sin_migracion y no anota nada", async () => {
    const anotado: string[] = [];
    const { admin } = clienteDeLectura({ ...FILAS, office_tasks: { error: { code: "42P01" } } });
    const r = await leerMiniVista({ esAdmin: async () => true, crearAdmin: () => admin, registrar: (m) => anotado.push(m) });
    expect(r).toEqual({ ok: false, motivo: "sin_migracion" });
    expect(anotado).toEqual([]);
  });

  it("otro error: dice error y el log lleva la tabla y el código, nunca el mensaje de la base", async () => {
    const anotado: string[] = [];
    const { admin } = clienteDeLectura({
      ...FILAS,
      task_events: { error: { code: "57014", message: "canceling statement: fila con resumen SECRETO-DE-PRUEBA" } },
    });
    const r = await leerMiniVista({ esAdmin: async () => true, crearAdmin: () => admin, registrar: (m) => anotado.push(m) });
    expect(r).toEqual({ ok: false, motivo: "error" });
    expect(anotado).toEqual(["[oficina-vista] no se pudo leer task_events (código 57014)"]);
  });

  it("si el cliente de servicio no se puede crear, dice error sin repetir el motivo", async () => {
    const anotado: string[] = [];
    const r = await leerMiniVista({
      esAdmin: async () => true,
      crearAdmin: () => {
        throw new Error("SUPABASE_SERVICE_ROLE_KEY no está configurada — VALOR-QUE-NO-DEBE-SALIR");
      },
      registrar: (m) => anotado.push(m),
    });
    expect(r).toEqual({ ok: false, motivo: "error" });
    expect(anotado.join(" ")).not.toContain("VALOR-QUE-NO-DEBE-SALIR");
  });
});

describe("mini-vista · la referencia de la conversación", () => {
  it("saca el número solo de una referencia de conversación de Chatwoot", () => {
    expect(conversacionDe("chatwoot:conversations/25/messages/900")).toBe(25);
    expect(conversacionDe("chatwoot:conversations/25")).toBe(25);
    expect(conversacionDe("erp:envios/25")).toBeNull();
    expect(conversacionDe("chatwoot:conversations/abc/messages/1")).toBeNull();
    expect(conversacionDe(null)).toBeNull();
  });
});

describe("mini-vista · el interruptor y la página", () => {
  it("nace apagada: solo «1» o «true» la encienden", () => {
    expect(vistaActiva({})).toBe(false);
    for (const v of ["", "0", "false", "si", "on", "yes"]) expect(vistaActiva({ OFICINA_VISTA_ACTIVA: v })).toBe(false);
    for (const v of ["1", "true", " TRUE "]) expect(vistaActiva({ OFICINA_VISTA_ACTIVA: v })).toBe(true);
  });

  const pagina = readFileSync(resolve(ROOT, PAGINA), "utf8");

  it("con el interruptor apagado la página es un 404, antes de preguntar o leer nada", () => {
    const corte = pagina.indexOf("if (!vistaActiva()) notFound();");
    expect(corte).toBeGreaterThan(-1);
    expect(corte).toBeLessThan(pagina.indexOf("await createClient()"));
    expect(corte).toBeLessThan(pagina.indexOf("leerMiniVista({"));
  });

  it("el cliente de servicio solo se le pasa a leerMiniVista, que es quien pone el candado", () => {
    expect(pagina).toMatch(/leerMiniVista\(\{ esAdmin: \(\) => isPlatformAdmin\(supabase\), crearAdmin: createAdminClient \}\)/);
    // Ninguna otra mención fuera del import y de esa llamada: nadie más lo crea.
    expect(pagina.match(/createAdminClient/g)).toHaveLength(2);
    expect(pagina).toMatch(/if \(!vista\.ok && vista\.motivo === "sin_permiso"\) notFound\(\);/);
  });

  it("es solo lectura: sin formularios, botones ni acciones de servidor, y todo como texto plano", () => {
    expect(pagina).not.toMatch(/<form\b|<button\b|<input\b|<textarea\b|"use server"|from ["']\.\.\/actions["']/);
    expect(pagina).not.toMatch(/dangerouslySetInnerHTML\s*=|from ["'][^"']*(?:marked|markdown|remark|rehype)/i);
  });

  it("la revisión de borradores solo enlaza la mini-vista cuando está encendida", () => {
    const revision = readFileSync(resolve(ROOT, "app/studio/(app)/admin/oficina-virtual/page.tsx"), "utf8");
    expect(revision).toMatch(/\{vistaActiva\(\) \? \(\s*<p[^>]*>\s*<Link href="\/studio\/admin\/oficina-virtual\/vista"/);
  });

  it("la lectura no importa nada que escriba ni que salga a Chatwoot o al runtime", () => {
    const lib = readFileSync(resolve(ROOT, "lib/studio/oficina/mini-vista.ts"), "utf8");
    expect(lib.match(/^import .*$/gm)).toEqual([
      'import type { SupabaseClient } from "@supabase/supabase-js";',
      'import { faltaLaMigracion } from "./escritura";',
    ]);
    expect(lib).not.toMatch(/\.(insert|update|upsert|delete)\(/);
    expect(lib).not.toMatch(/\bfetch\(/);
  });
});

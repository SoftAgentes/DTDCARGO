// @vitest-environment node
/**
 * SDD-0626 Paso 3a · El despachador mínimo con el MODELO SIMULADO, sobre las funciones reales de la 0548 en
 * PostgreSQL embebido (PGlite) como service_role. Ninguna llamada sale a la red: Chatwoot y el runtime de la
 * oficina son dobles. Lo que se prueba (pedido §D):
 *   · pausa: aborta en ≤ 10 s con un agente lento;
 *   · auto-pausa al 80 % con un tope de juguete;
 *   · caída y reinicio sin duplicar corridas;
 *   · JSON inválido → reintenta una vez y escala; cifra inventada → escala;
 *   · ninguna fila ni log guarda el texto del cliente, y al agente le llega con los datos tapados (SDD-0700);
 *   · con el interruptor apagado no hace nada; sin las migraciones no tumba nada.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PGlite } from "@electric-sql/pglite";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AVISO_CLIENTE } from "../oficina/aviso-cliente";
import type { MensajeLeido } from "../oficina/chatwoot-lectura";
import {
  CORRECCION_DEL_ACUSE,
  REGLA_DEL_ACUSE,
  correrTanda,
  ejecutarCorrida,
  tick,
  type DepsDespachador,
} from "../oficina/despachador";
import { type AlmacenDespachador, ErrorDelAlmacen, SinMigracion } from "../oficina/despachador-almacen";
import { configDespachador } from "../oficina/despachador-config";
import { olvidarAvisosParaPruebas } from "../oficina/escritura";
import type { RespuestaAgente } from "../oficina/runtime-cliente";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const leer = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

const BASE = `
  create schema if not exists auth;
  create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  do $r$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  end $r$;
  grant usage on schema public to service_role;
  create table public.platform_admins (user_id uuid primary key);
  create function public.is_platform_admin() returns boolean language sql security definer stable
    set search_path = public as $$ select false $$;
`;

const MARCA = "MARCA-CLIENTE-7Q9Z";
const MENSAJES: MensajeLeido[] = [{ rol: "cliente", texto: `Hola, ${MARCA}, mi teléfono es 0414-555-1234, ¿dónde está mi caja?` }];

async function base(migraciones: string[] = ["0541_oficina_cable_tablas", "0544_oficina_filtro_bandeja", "0548_oficina_despachador"]) {
  const db = await pgliteLimpio();
  await db.exec(BASE + migraciones.map((m) => leer(`supabase/migrations/${m}.sql`)).join("\n"));
  return db;
}

async function despausar(db: PGlite) {
  await db.exec("insert into public.office_paused (pausada, motivo) values (false, 'prueba: despausada');");
}
async function pausar(db: PGlite) {
  await db.exec("insert into public.office_paused (pausada, motivo) values (true, 'prueba: pausada por Sam');");
}
async function eventoEnTriaje(db: PGlite, n = 1) {
  await db.exec(
    `insert into public.event_inbox (tipo, origen, clave_dedupe, prioridad, payload_ref, estado, triaje_en)
     values ('chatwoot.message_created', 'chatwoot', 'chatwoot:conv:${n}:msg:${n}', 2,
             'chatwoot:conversations/${n}/messages/${n}', 'triaje', now());`,
  );
}

/** El almacén sobre PGlite, como service_role: las mismas funciones de la 0548 que llama Supabase. */
function almacenPglite(db: PGlite): AlmacenDespachador {
  const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> => {
    try {
      return await db.transaction(async (tx) => {
        await tx.exec("set local role service_role");
        return (await tx.query<T>(sql, params)).rows;
      });
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "42883" || code === "42P01") throw new SinMigracion();
      throw new ErrorDelAlmacen(code);
    }
  };
  const uno = async <T>(sql: string, params: unknown[] = []) => Object.values((await q(sql, params))[0] ?? {})[0] as T;
  return {
    tomarTurno: (d, s) => uno<boolean>("select public.office_despachador_turno($1::uuid, $2::int)", [d, s]),
    soltarTurno: async (d) => void (await q("select public.office_despachador_soltar($1::uuid)", [d])),
    estaPausada: () => uno<boolean>("select public.office_esta_pausada()"),
    autopausar: (t, u) => uno<boolean>("select public.office_autopausar_por_tope($1::numeric, $2::numeric)", [t, u]),
    recuperar: (a, t) => uno<number>("select public.office_recuperar_corridas($1, $2::int)", [a, t]),
    convertir: (a, l) => uno<number>("select public.office_convertir_triaje($1, $2::int)", [a, l]),
    async tomarTarea(a, p, t) {
      const f = (await q<Record<string, unknown>>("select * from public.office_tomar_tarea($1, $2::int, $3::int)", [a, p, t]))[0];
      if (!f) return null;
      return { taskId: String(f.task_id), runId: String(f.run_id), entidadRef: (f.entidad_ref as string) ?? null, prioridad: Number(f.prioridad) as 1 | 2 | 3 };
    },
    async anotar(p) {
      await q(
        "insert into public.task_events (task_id, run_id, tipo, actor, resumen, costo_usd, modelo_usado) values ($1, $2, $3, $4, $5, $6, $7)",
        [p.taskId, p.runId, p.tipo, p.actor, p.resumen, p.costoUsd ?? 0, p.modelo ?? null],
      );
    },
    entregar: (e) =>
      uno<boolean>("select public.office_entregar_corrida($1, $2, $3, $4, $5, $6, $7::smallint, $8, $9)", [
        e.taskId,
        e.runId,
        e.tipo,
        e.tipo === "respuesta" ? e.texto : null,
        e.tipo === "respuesta" ? e.guion : null,
        e.tipo === "escalado" ? e.motivo : null,
        e.tipo === "escalado" ? e.prioridad : null,
        e.actor,
        e.resumen,
      ]),
    soltar: (t, r, s) => uno<boolean>("select public.office_soltar_corrida($1, $2, $3)", [t, r, s]),
  };
}

const ENV = {
  OFICINA_DESPACHADOR_ACTIVO: "1",
  OFICINA_VACIADO_ACTIVO: "1",
  OFICINA_RUNTIME_URL: "http://runtime.prueba:18642",
  OFICINA_RUNTIME_TOKEN: "token-de-prueba-del-cable",
  OFICINA_CHATWOOT_TOKEN_LECTURA: "token-de-lectura-de-prueba",
  OFICINA_CHATWOOT_API_URL: "http://chatwoot.prueba:3000",
  OFICINA_CHATWOOT_ACCOUNT_ID: "2",
  OFICINA_CHATWOOT_INBOX_PRUEBA: "11",
};

const respuestaBuena = JSON.stringify({
  respuesta: {
    acuse: "Entiendo tu consulta.",
    texto: "Entiendo tu consulta. Se la paso ya a una persona del equipo de DTD Cargo, que te responde por este mismo chat.",
    guion: "derivar-equipo",
  },
});

interface Doble {
  llamadas: number;
  sesionesBorradas: string[];
  lecturas: number;
  /** Las instrucciones («sistema») de cada llamada al agente, en orden. */
  sistemas: string[];
  /** Lo que recibió el agente («usuario») en cada llamada, en orden. */
  usuarios: string[];
}

function deps(db: PGlite, o: { env?: Record<string, string>; contenidos?: Array<string | "lento">; ajustes?: Partial<ReturnType<typeof configDespachador>> } = {}) {
  const doble: Doble = { llamadas: 0, sesionesBorradas: [], lecturas: 0, sistemas: [], usuarios: [] };
  const contenidos = [...(o.contenidos ?? [respuestaBuena])];
  const registros: string[] = [];
  const config = { ...configDespachador({ ...ENV, ...(o.env ?? {}) }), vigilarPausaMs: 50, tickMs: 20, ...(o.ajustes ?? {}) };
  const d: DepsDespachador = {
    config,
    almacen: almacenPglite(db),
    async leer() {
      doble.lecturas += 1;
      return MENSAJES.map((m) => ({ ...m }));
    },
    async llamar({ signal, sistema, usuario }): Promise<RespuestaAgente> {
      doble.llamadas += 1;
      doble.sistemas.push(sistema);
      doble.usuarios.push(usuario);
      const c = contenidos.length > 1 ? contenidos.shift()! : contenidos[0];
      if (c === "lento") {
        await new Promise((_, rechazar) => {
          const t = setTimeout(() => rechazar(new Error("el agente lento terminó: no debía")), 60_000);
          signal.addEventListener("abort", () => {
            clearTimeout(t);
            rechazar(Object.assign(new Error("abortada"), { name: "AbortError" }));
          });
        });
      }
      return { contenido: c, entrada: 1200, salida: 150, modelo: "zai/glm-5.3" };
    },
    async borrarSesion(id) {
      doble.sesionesBorradas.push(id);
      return true;
    },
    registrar: (m) => registros.push(m),
    dormir: (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 5))),
  };
  return { d, doble, registros };
}

async function filas(db: PGlite, sql: string) {
  return (await db.query<Record<string, unknown>>(sql)).rows;
}

let espiasConsola: Array<ReturnType<typeof vi.spyOn>> = [];
beforeEach(() => {
  olvidarAvisosParaPruebas();
  espiasConsola = (["log", "info", "warn", "error"] as const).map((n) => vi.spyOn(console, n).mockImplementation(() => {}));
});
afterEach(() => {
  for (const e of espiasConsola) e.mockRestore();
});
const textoDeConsola = () =>
  espiasConsola.flatMap((e) => (e.mock.calls as unknown[][]).map((c) => c.map(String).join(" "))).join("\n");

describe("despachador del cable (Paso 3a, modelo simulado)", () => {
  it("con el interruptor apagado no hace nada: ni base, ni Chatwoot, ni runtime", async () => {
    const tocado: string[] = [];
    const almacen = new Proxy({} as AlmacenDespachador, {
      get: (_, k) => () => {
        tocado.push(String(k));
        throw new Error("no debía tocar la base");
      },
    });
    const llamar = vi.fn();
    const leerC = vi.fn();
    const d: DepsDespachador = {
      config: configDespachador({ ...ENV, OFICINA_DESPACHADOR_ACTIVO: "" }),
      almacen,
      leer: leerC,
      llamar,
      borrarSesion: vi.fn(),
    };
    expect(await tick(d)).toEqual({ estado: "apagado" });
    expect(await correrTanda(d, { duracionMs: 1000 })).toMatchObject({ estado: "apagado", ticks: 0 });
    for (const v of ["0", "false", "si", "on", "yes", " "]) {
      expect(configDespachador({ ...ENV, OFICINA_DESPACHADOR_ACTIVO: v }).activo).toBe(false);
    }
    expect(tocado).toEqual([]);
    expect(llamar).not.toHaveBeenCalled();
    expect(leerC).not.toHaveBeenCalled();
  });

  it("encendido pero con el vaciado apagado (los borradores no se purgarían a 90 días): no hace nada", async () => {
    const tocado: string[] = [];
    const almacen = new Proxy({} as AlmacenDespachador, {
      get: (_, k) => () => {
        tocado.push(String(k));
        throw new Error("no debía tocar la base");
      },
    });
    const registros: string[] = [];
    for (const v of ["", "0", "false", "si"]) {
      const d: DepsDespachador = {
        config: configDespachador({ ...ENV, OFICINA_VACIADO_ACTIVO: v }),
        almacen,
        leer: vi.fn(),
        llamar: vi.fn(),
        borrarSesion: vi.fn(),
        registrar: (m) => registros.push(m),
      };
      expect(d.config.vaciadoActivo).toBe(false);
      expect(await tick(d)).toEqual({ estado: "sin_vaciado" });
      expect(await correrTanda(d, { duracionMs: 1000 })).toMatchObject({ estado: "sin_vaciado", ticks: 0 });
      expect(d.llamar).not.toHaveBeenCalled();
    }
    expect(tocado).toEqual([]);
    expect(registros.filter((r) => r.includes("OFICINA_VACIADO_ACTIVO"))).toHaveLength(1);
  });

  it("sin las migraciones (ni la 0541, o sin la 0548) no tumba nada: «sin_migracion», una vez en el log", async () => {
    for (const migraciones of [[], ["0541_oficina_cable_tablas", "0544_oficina_filtro_bandeja"]]) {
      const db = await base(migraciones);
      try {
        const { d, doble, registros } = deps(db);
        expect(await tick(d)).toEqual({ estado: "sin_migracion" });
        expect(await tick(d)).toEqual({ estado: "sin_migracion" });
        expect(await correrTanda(d, { duracionMs: 50 })).toMatchObject({ estado: "sin_migracion" });
        expect(doble.llamadas).toBe(0);
        expect(registros.filter((r) => r.includes("falta la 0548"))).toHaveLength(1);
        olvidarAvisosParaPruebas();
      } finally {
        await db.close();
      }
    }
  }, 60_000);

  it("una corrida buena: borrador en «aprobación», costo y modelo en task_events, sesión borrada, nada enviado", async () => {
    const db = await base();
    try {
      await despausar(db);
      await eventoEnTriaje(db);
      const { d, doble } = deps(db);
      const r = await tick(d);
      expect(r).toMatchObject({ estado: "corrida", convertidas: 1, resultado: { fin: "borrador" } });
      const [t] = await filas(db, "select estado from public.office_tasks");
      expect(t.estado).toBe("aprobación");
      const [b] = await filas(db, "select tipo, guion, texto from public.office_borradores");
      expect(b).toMatchObject({ tipo: "respuesta", guion: "derivar-equipo" });
      // SDD-0705 v0.2: primera respuesta de DTD (solo hay mensajes del cliente) → el aviso va al final, una vez.
      expect(String(b.texto).endsWith(`\n\n${AVISO_CLIENTE}`)).toBe(true);
      expect(String(b.texto).split(AVISO_CLIENTE)).toHaveLength(2);
      const ev = await filas(db, "select tipo, actor, costo_usd::float8 as costo, modelo_usado from public.task_events order by ts, tipo");
      expect(ev.map((e) => e.tipo)).toEqual(expect.arrayContaining(["tarea.creada", "run.iniciada", "conversacion.leida", "modelo.respuesta", "run.terminada"]));
      const modelo = ev.find((e) => e.tipo === "modelo.respuesta")!;
      expect(modelo).toMatchObject({ actor: "agente:soporte-chatwoot", modelo_usado: "zai/glm-5.3" });
      expect(Number(modelo.costo)).toBeCloseTo((1200 * 1 + 150 * 3.2) / 1_000_000, 6);
      expect(doble).toMatchObject({ llamadas: 1, lecturas: 1 });
      expect(doble.sesionesBorradas).toHaveLength(1);
      expect(doble.sesionesBorradas[0]).toMatch(/^cable-[0-9a-f-]{36}-1$/);
    } finally {
      await db.close();
    }
  }, 60_000);

  it("SDD-0705: si DTD ya respondió en la conversación, el borrador NO repite el aviso al cliente", async () => {
    const db = await base();
    try {
      await despausar(db);
      await eventoEnTriaje(db);
      const { d } = deps(db);
      d.leer = async () => [
        { rol: "cliente", texto: "Hola" },
        { rol: "agente", texto: "Hola, ¿en qué te ayudo?" },
        { rol: "cliente", texto: "¿Dónde está mi caja?" },
      ];
      const r = await tick(d);
      expect(r).toMatchObject({ estado: "corrida", resultado: { fin: "borrador" } });
      const [b] = await filas(db, "select texto from public.office_borradores");
      expect(String(b.texto)).not.toContain(AVISO_CLIENTE);
    } finally {
      await db.close();
    }
  }, 60_000);

  it("SDD-0705 v0.2: si con el aviso el borrador pasa de 4000 caracteres, escala `borrador_largo` (no `fallo_interno`)", async () => {
    const db = await base();
    try {
      await despausar(db);
      await eventoEnTriaje(db);
      const relleno = "Se la paso ya a una persona del equipo de DTD Cargo. ".repeat(80);
      const texto = `Entiendo tu consulta. ${relleno}`.slice(0, 3950).trim();
      const largo = JSON.stringify({ respuesta: { acuse: "Entiendo tu consulta.", texto, guion: "derivar-equipo" } });
      const { d } = deps(db, { contenidos: [largo] });
      expect(await tick(d)).toMatchObject({ estado: "corrida", resultado: { fin: "escalado", motivo: "borrador_largo" } });
      const [b] = await filas(db, "select tipo, motivo, texto from public.office_borradores");
      expect(b).toMatchObject({ tipo: "escalado", motivo: "borrador_largo", texto: null });
    } finally {
      await db.close();
    }
  }, 60_000);

  it("SDD-0702 modelo real: si la respuesta no lo dice, se lee de la sesión ANTES de borrarla; sin dato queda null", async () => {
    for (const [lectura, esperado] of [
      ["deepseek/deepseek-chat", "deepseek/deepseek-chat"],
      [null, null],
      ["lanza", null],
      [undefined, null],
    ] as const) {
      const db = await base();
      try {
        await despausar(db);
        await eventoEnTriaje(db);
        const { d, doble } = deps(db);
        const orden: string[] = [];
        const llamarOriginal = d.llamar;
        d.llamar = async (o) => ({ ...(await llamarOriginal(o)), modelo: null });
        const borrarOriginal = d.borrarSesion;
        d.borrarSesion = async (id) => {
          orden.push(`borrar:${id}`);
          return borrarOriginal(id);
        };
        if (lectura !== undefined) {
          d.modeloDeSesion = async (id) => {
            orden.push(`leer:${id}`);
            if (lectura === "lanza") throw new Error("red");
            return lectura;
          };
        }
        expect(await tick(d)).toMatchObject({ estado: "corrida", resultado: { fin: "borrador" } });
        const [ev] = await filas(db, "select modelo_usado from public.task_events where tipo = 'modelo.respuesta'");
        expect(ev.modelo_usado).toBe(esperado);
        const sesion = doble.sesionesBorradas[0];
        expect(orden).toEqual(lectura === undefined ? [`borrar:${sesion}`] : [`leer:${sesion}`, `borrar:${sesion}`]);
      } finally {
        await db.close();
      }
    }
  }, 120_000);

  it("SDD-0702 modelo real: si la respuesta ya trae el modelo, no se consulta la sesión", async () => {
    const db = await base();
    try {
      await despausar(db);
      await eventoEnTriaje(db);
      const { d } = deps(db);
      const leer = vi.fn(async () => "otro");
      d.modeloDeSesion = leer;
      await tick(d);
      expect(leer).not.toHaveBeenCalled();
      const [ev] = await filas(db, "select modelo_usado from public.task_events where tipo = 'modelo.respuesta'");
      expect(ev.modelo_usado).toBe("zai/glm-5.3");
    } finally {
      await db.close();
    }
  }, 60_000);

  it("JSON inválido: reintenta UNA vez; si sigue mal, escala (y si el segundo sale bien, guarda el borrador)", async () => {
    const db = await base();
    try {
      await despausar(db);
      await eventoEnTriaje(db, 1);
      await eventoEnTriaje(db, 2);
      const mal = deps(db, { contenidos: ["no es json", "```json\n{}\n```"] });
      expect(await tick(mal.d)).toMatchObject({ resultado: { fin: "escalado", motivo: "json_invalido" } });
      expect(mal.doble.llamadas).toBe(2);
      const bien = deps(db, { contenidos: ["{\"respuesta\": 1}", respuestaBuena], ajustes: { pausaEntreCorridasS: 0 } });
      expect(await tick(bien.d)).toMatchObject({ resultado: { fin: "borrador" } });
      expect(bien.doble.llamadas).toBe(2);
      const bs = await filas(db, "select tipo, motivo from public.office_borradores order by creado_en");
      expect(bs).toEqual([
        { tipo: "escalado", motivo: "json_invalido" },
        { tipo: "respuesta", motivo: null },
      ]);
    } finally {
      await db.close();
    }
  }, 60_000);

  it("una cifra, fecha o estado inventado: escala (eval.md)", async () => {
    const db = await base();
    try {
      await despausar(db);
      await eventoEnTriaje(db);
      const inventada = JSON.stringify({
        respuesta: {
          acuse: "Entiendo tu consulta.",
          texto: "Entiendo tu consulta. Tu caja ya está en tránsito y llega el 20 de noviembre; cuesta $35.",
          guion: "derivar-equipo",
        },
      });
      const { d } = deps(db, { contenidos: [inventada] });
      const r = await tick(d);
      expect(r).toMatchObject({ resultado: { fin: "escalado" } });
      const [b] = await filas(db, "select tipo, motivo, texto from public.office_borradores");
      expect(b.tipo).toBe("escalado");
      expect(String(b.motivo)).toContain("dato_inventado");
      expect(b.texto).toBeNull();
    } finally {
      await db.close();
    }
  }, 60_000);

  // Ficha 0.3 (etapa 1, 18/11/2026): un saludo simple escaló con `eval:sin_acuse` porque el agente partió el mensaje
  // entre «acuse» y «texto». Lo que el agente devolvió entonces:
  const partida = JSON.stringify({
    respuesta: {
      acuse: "¡Hola! Gracias por escribirle a DTD Cargo.",
      texto: "Ya vi tu mensaje y te ayudo con gusto. Cuéntame un poco más de lo que necesitas.",
      guion: "acuse-general",
    },
  });
  const completa = JSON.stringify({
    respuesta: {
      acuse: "¡Hola! Gracias por escribirle a DTD Cargo.",
      texto: "¡Hola! Gracias por escribirle a DTD Cargo. Ya vi tu mensaje y te ayudo con gusto. Cuéntame un poco más de lo que necesitas.",
      guion: "acuse-general",
    },
  });

  it("las instrucciones dicen que «texto» empieza con el acuse, con el ejemplo del guion; sin corrección en el primer intento", async () => {
    const db = await base();
    try {
      await despausar(db);
      await eventoEnTriaje(db);
      const { d, doble } = deps(db);
      expect(await tick(d)).toMatchObject({ resultado: { fin: "borrador" } });
      expect(doble.sistemas).toHaveLength(1);
      expect(doble.sistemas[0]).toContain(REGLA_DEL_ACUSE);
      expect(doble.sistemas[0]).not.toContain(CORRECCION_DEL_ACUSE);
      // El ejemplo de la regla es una salida válida y pasa el eval: no se le enseña al agente una forma que escala.
      expect(REGLA_DEL_ACUSE).toContain(completa);
    } finally {
      await db.close();
    }
  }, 60_000);

  it("sin acuse al inicio: se le pide UNA vez más con la corrección; si el segundo intento lo trae, guarda el borrador", async () => {
    const db = await base();
    try {
      await despausar(db);
      await eventoEnTriaje(db);
      const { d, doble } = deps(db, { contenidos: [partida, completa] });
      expect(await tick(d)).toMatchObject({ resultado: { fin: "borrador" } });
      expect(doble.llamadas).toBe(2);
      // La corrección es una línea fija al final de las mismas instrucciones: no lleva nada del borrador rechazado.
      expect(doble.sistemas[1]).toBe(`${doble.sistemas[0]}\n${CORRECCION_DEL_ACUSE}`);
      expect(await filas(db, "select tipo, guion, motivo from public.office_borradores")).toEqual([
        { tipo: "respuesta", guion: "acuse-general", motivo: null },
      ]);
      const pasos = await filas(db, "select tipo, actor from public.task_events where tipo = 'eval.reintento'");
      expect(pasos).toEqual([{ tipo: "eval.reintento", actor: "sistema:despachador" }]);
      // Los dos intentos quedan con su costo en la bitácora (AC-2 y AC-5).
      const modelo = await filas(db, "select count(*)::int as n, sum(costo_usd) > 0 as con_costo from public.task_events where tipo = 'modelo.respuesta'");
      expect(modelo).toEqual([{ n: 2, con_costo: true }]);
    } finally {
      await db.close();
    }
  }, 60_000);

  it("si el segundo intento tampoco trae el acuse al inicio: escala `eval:sin_acuse`, sin un tercer intento", async () => {
    const db = await base();
    try {
      await despausar(db);
      await eventoEnTriaje(db);
      const { d, doble } = deps(db, { contenidos: [partida] });
      expect(await tick(d)).toMatchObject({ resultado: { fin: "escalado", motivo: "eval:sin_acuse" } });
      expect(doble.llamadas).toBe(2);
      expect(await filas(db, "select tipo, motivo, texto from public.office_borradores")).toEqual([
        { tipo: "escalado", motivo: "eval:sin_acuse", texto: null },
      ]);
    } finally {
      await db.close();
    }
  }, 60_000);

  it("con el tope en 1 llamada por corrida no hay reintento: escala `eval:sin_acuse` como antes", async () => {
    const db = await base();
    try {
      await despausar(db);
      await eventoEnTriaje(db);
      const { d, doble } = deps(db, { contenidos: [partida, completa], env: { OFICINA_TOPE_LLAMADAS_CORRIDA: "1" } });
      expect(await tick(d)).toMatchObject({ resultado: { fin: "escalado", motivo: "eval:sin_acuse" } });
      expect(doble.llamadas).toBe(1);
    } finally {
      await db.close();
    }
  }, 60_000);

  it("solo el acuse se reintenta: con un dato inventado además, escala al momento y no vuelve a llamar", async () => {
    const db = await base();
    try {
      await despausar(db);
      await eventoEnTriaje(db);
      const partidaEInventada = JSON.stringify({
        respuesta: {
          acuse: "Entiendo tu consulta.",
          texto: "Tu caja ya está en tránsito y llega el 20 de noviembre.",
          guion: "derivar-equipo",
        },
      });
      const { d, doble } = deps(db, { contenidos: [partidaEInventada, completa] });
      const r = await tick(d);
      expect(r).toMatchObject({ resultado: { fin: "escalado" } });
      expect(doble.llamadas).toBe(1);
      const [b] = await filas(db, "select motivo from public.office_borradores");
      expect(String(b.motivo)).toBe("eval:sin_acuse,dato_inventado");
    } finally {
      await db.close();
    }
  }, 60_000);

  it("pausa (AC-3): con un agente lento, la llamada en vuelo se aborta en ≤ 10 s y la tarea vuelve a «listo»", async () => {
    const db = await base();
    try {
      await despausar(db);
      await eventoEnTriaje(db);
      const { d, doble } = deps(db, { contenidos: ["lento"] });
      const inicio = Date.now();
      const corriendo = tick(d);
      await new Promise((r) => setTimeout(r, 300));
      await pausar(db);
      const pausadaEn = Date.now();
      const r = await corriendo;
      expect(Date.now() - pausadaEn).toBeLessThan(10_000);
      expect(Date.now() - inicio).toBeLessThan(10_000);
      expect(r).toMatchObject({ estado: "corrida", resultado: { fin: "abortada" } });
      const [t] = await filas(db, "select estado from public.office_tasks");
      expect(t.estado).toBe("listo");
      expect(await filas(db, "select 1 from public.task_events where tipo = 'run.abortada'")).toHaveLength(1);
      expect(await filas(db, "select 1 from public.office_borradores")).toHaveLength(0);
      // Pausada: no toma nada nuevo.
      expect(await tick(d)).toEqual({ estado: "pausada" });
      expect(doble.llamadas).toBe(1);
    } finally {
      await db.close();
    }
  }, 60_000);

  it("auto-pausa al 80 % con un tope de juguete: la base pausa la oficina y el despachador para", async () => {
    const db = await base();
    try {
      await despausar(db);
      await eventoEnTriaje(db, 1);
      await eventoEnTriaje(db, 2);
      // Una llamada cuesta 0,00168 USD con la tarifa por defecto: el tope de juguete de 0,002 se pasa del 80 %.
      const { d, doble } = deps(db, { env: { OFICINA_TOPE_MENSUAL_USD: "0.002" } });
      expect(d.config.topeMensualUsd).toBe(0.002);
      expect(await tick(d)).toMatchObject({ resultado: { fin: "borrador" } });
      const pausas = await filas(db, "select pausada, cambiado_por, motivo from public.office_paused order by id desc limit 1");
      expect(pausas[0]).toMatchObject({ pausada: true, cambiado_por: null });
      expect(String(pausas[0].motivo)).toMatch(/^Auto-pausa/);
      expect(await tick(d)).toEqual({ estado: "pausada" });
      expect(doble.llamadas).toBe(1);
      // Un precio 0, negativo o inválido no vale: la auto-pausa no saltaría nunca. Cae al valor por defecto.
      for (const malo of ["0", "-1", "-0.5", "abc", "0,0"]) {
        const c = configDespachador({ ...ENV, OFICINA_PRECIO_ENTRADA_USD_MTOK: malo, OFICINA_PRECIO_SALIDA_USD_MTOK: malo });
        expect(c.precios).toEqual({ entradaPorMTok: 1, salidaPorMTok: 3.2 });
      }
      expect(configDespachador({ ...ENV, OFICINA_PRECIO_ENTRADA_USD_MTOK: "0,5" }).precios.entradaPorMTok).toBe(0.5);
      // Y el tope solo se puede bajar: más de 15 vale 15.
      expect(configDespachador({ ...ENV, OFICINA_TOPE_MENSUAL_USD: "999" }).topeMensualUsd).toBe(15);
    } finally {
      await db.close();
    }
  }, 60_000);

  it("caída y reinicio: la corrida a medias se escala como interrumpida, sin repetirla, y la tanda nueva retoma", async () => {
    const db = await base();
    try {
      await despausar(db);
      await eventoEnTriaje(db, 1);
      await eventoEnTriaje(db, 2);
      const almacen = almacenPglite(db);
      // El proceso viejo: toma el turno (1 s), convierte, toma la tarea… y se cae antes de llamar al agente.
      const viejo = "00000000-0000-4000-8000-00000000c0de";
      expect(await almacen.tomarTurno(viejo, 1)).toBe(true);
      await almacen.convertir("soporte-chatwoot", 20);
      const tomada = await almacen.tomarTarea("soporte-chatwoot", 10, 200);
      expect(tomada).not.toBeNull();
      // Pasa el tiempo: la corrida quedó sin cierre más allá de su tope (el dueño, en sesión propia, mueve la hora).
      await db.exec(`update public.task_events set ts = now() - interval '10 minutes' where run_id = '${tomada!.runId}'`);
      const { d, doble } = deps(db, { ajustes: { pausaEntreCorridasS: 0 } });
      // Mientras el turno viejo no vence, otra tanda no entra.
      expect(await correrTanda(d, { duracionMs: 10 })).toMatchObject({ estado: "ocupado" });
      await new Promise((r) => setTimeout(r, 1100));
      const resumen = await correrTanda(d, { duracionMs: 10 });
      expect(resumen).toMatchObject({ estado: "hecha" });
      const interrumpida = await filas(db, `select tipo, motivo from public.office_borradores where run_id = '${tomada!.runId}'`);
      expect(interrumpida).toEqual([{ tipo: "escalado", motivo: expect.stringContaining("Corrida interrumpida") }]);
      expect(await filas(db, `select 1 from public.task_events where task_id = '${tomada!.taskId}' and tipo = 'run.iniciada'`)).toHaveLength(1);
      // La otra tarea sí corrió; la caída no se repitió: una sola llamada al modelo en total.
      expect(doble.llamadas).toBe(1);
      // Otra tanda más: no vuelve a correr nada ya cerrado.
      await correrTanda(d, { duracionMs: 10 });
      expect(doble.llamadas).toBe(1);
      expect(await filas(db, "select 1 from public.office_borradores")).toHaveLength(2);
      // Un resultado tardío del proceso viejo no pisa nada.
      expect(
        await almacen.entregar({ taskId: tomada!.taskId, runId: tomada!.runId, tipo: "respuesta", texto: "tarde", guion: "acuse-general", actor: "agente:soporte-chatwoot", resumen: "x" }),
      ).toBe(false);
    } finally {
      await db.close();
    }
  }, 60_000);

  it("ninguna fila ni log guarda el texto del cliente (ni su teléfono), y al agente le llega el teléfono tapado", async () => {
    const db = await base();
    try {
      await despausar(db);
      await eventoEnTriaje(db, 1);
      await eventoEnTriaje(db, 2);
      const a = deps(db);
      await tick(a.d);
      const b = deps(db, { contenidos: ["roto", "roto"], ajustes: { pausaEntreCorridasS: 0 } });
      await tick(b.d);
      const volcado = JSON.stringify(
        await Promise.all(
          ["office_tasks", "task_events", "event_inbox", "office_borradores", "office_paused", "office_despachador"].map((t) =>
            filas(db, `select * from public.${t}`),
          ),
        ),
      );
      for (const prohibido of [MARCA, "0414-555-1234", "dónde está mi caja"]) {
        expect(volcado).not.toContain(prohibido);
        expect(a.registros.join("\n") + b.registros.join("\n")).not.toContain(prohibido);
        expect(textoDeConsola()).not.toContain(prohibido);
      }
      // El texto sí viajó al agente (es su trabajo), pero con el teléfono tapado (SDD-0700); y la sesión de cada
      // llamada se borró en la oficina.
      const alAgente = [...a.doble.usuarios, ...b.doble.usuarios];
      expect(alAgente).toHaveLength(3);
      for (const u of alAgente) {
        expect(u).toContain(MARCA);
        expect(u).toContain("[teléfono]");
        expect(u).not.toContain("0414-555-1234");
      }
      expect(a.doble.sesionesBorradas.length + b.doble.sesionesBorradas.length).toBe(3);
    } finally {
      await db.close();
    }
  }, 60_000);

  it("un escalado del agente se guarda como escalado, con su prioridad y sin datos personales en el motivo", async () => {
    const db = await base();
    try {
      await despausar(db);
      await eventoEnTriaje(db);
      const esc = JSON.stringify({ escalado: { motivo: "Pide un cobro; llamar al 0414-555-1234", prioridad: 3 } });
      const { d } = deps(db, { contenidos: [esc] });
      expect(await tick(d)).toMatchObject({ resultado: { fin: "escalado" } });
      const [b] = await filas(db, "select tipo, prioridad, motivo from public.office_borradores");
      expect(b).toMatchObject({ tipo: "escalado", prioridad: 3 });
      expect(String(b.motivo)).not.toContain("0414");
    } finally {
      await db.close();
    }
  }, 60_000);

  it("la corrida respeta los topes: sin conversación del cliente o con una referencia mala, escala sin llamar al modelo", async () => {
    const db = await base();
    try {
      await despausar(db);
      await eventoEnTriaje(db);
      const { d, doble } = deps(db);
      d.leer = async () => [{ rol: "agente", texto: "solo nosotros" }];
      expect(await tick(d)).toMatchObject({ resultado: { fin: "escalado", motivo: "sin_mensaje_del_cliente" } });
      expect(doble.llamadas).toBe(0);
      const r = await ejecutarCorrida(d, { taskId: "00000000-0000-4000-8000-000000000001", runId: "00000000-0000-4000-8000-000000000002", entidadRef: "otra:cosa", prioridad: 1 });
      expect(r).toEqual({ fin: "descartada" });
    } finally {
      await db.close();
    }
  }, 60_000);
});

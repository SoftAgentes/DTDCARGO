// @vitest-environment node
/**
 * SDD-0626 Paso 3b · El despachador y el envío sobre las funciones reales de la 0548 y la 0549 en PostgreSQL
 * embebido (PGlite). Chatwoot y el runtime de la oficina son dobles: ninguna llamada sale a la red.
 *   · el cobro: prioridad 3 y escalado, sin llamar al agente (pendiente del 3a);
 *   · la sesión de una llamada abortada se vuelve a borrar en el tick siguiente, no a las 48 h;
 *   · el aviso «hay N pendientes» sin el texto;
 *   · sin la 0549 el despachador sigue como en el 3a;
 *   · el envío: nace apagado; solo lo aprobado; solo la bandeja de prueba; otra vez la pausa y la huella; una vez;
 *   · la prueba F en miniatura: 3 conversaciones, Sam aprueba 2 y rechaza 1 → 2 salientes en la bandeja 11, 0 en
 *     las demás, y las revisiones registradas.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PGlite } from "@electric-sql/pglite";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MensajeLeido } from "../oficina/chatwoot-lectura";
import { type DepsDespachador, tick } from "../oficina/despachador";
import { type AlmacenDespachador, ErrorDelAlmacen, SinMigracion } from "../oficina/despachador-almacen";
import { configDespachador } from "../oficina/despachador-config";
import {
  type AlmacenEnvio,
  type ChatwootEnvio,
  ErrorDeChatwoot,
  type Reserva,
  configEnvio,
  procesarEnvios,
} from "../oficina/envio";
import { olvidarAvisosParaPruebas } from "../oficina/escritura";
import type { RespuestaAgente } from "../oficina/runtime-cliente";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const leer = (p: string) => readFileSync(resolve(ROOT, p), "utf8");
const SAM = "00000000-0000-4000-8000-00000000a001";

const BASE = `
  create schema if not exists auth;
  create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  do $r$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  end $r$;
  grant usage on schema public, auth to anon, authenticated, service_role;
  create table public.platform_admins (user_id uuid primary key);
  insert into public.platform_admins values ('${SAM}');
  create function public.is_platform_admin() returns boolean language sql security definer stable
    set search_path = public as $$ select exists (select 1 from public.platform_admins where user_id = (select auth.uid())) $$;
  grant execute on function public.is_platform_admin() to authenticated;
`;

const TODAS = ["0541_oficina_cable_tablas", "0544_oficina_filtro_bandeja", "0548_oficina_despachador", "0549_oficina_revisiones_envio"];

async function base(migraciones = TODAS) {
  const db = await pgliteLimpio();
  await db.exec(BASE + migraciones.map((m) => leer(`supabase/migrations/${m}.sql`)).join("\n"));
  await db.exec("insert into public.office_paused (pausada, motivo) values (false, 'prueba: despausada');");
  return db;
}

async function q<T = Record<string, unknown>>(db: PGlite, sql: string, params: unknown[] = [], rol = "service_role", uid = ""): Promise<T[]> {
  try {
    return await db.transaction(async (tx) => {
      await tx.exec(`set local role ${rol}`);
      await tx.query("select set_config('test.uid', $1, true)", [uid]);
      return (await tx.query<T>(sql, params)).rows;
    });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "42883" || code === "42P01") throw new SinMigracion();
    throw new ErrorDelAlmacen(code);
  }
}
const uno = async <T>(db: PGlite, sql: string, params: unknown[] = []) => Object.values((await q(db, sql, params))[0] ?? {})[0] as T;

function almacenDespachador(db: PGlite): AlmacenDespachador {
  return {
    tomarTurno: (d, s) => uno<boolean>(db, "select public.office_despachador_turno($1::uuid, $2::int)", [d, s]),
    soltarTurno: async (d) => void (await q(db, "select public.office_despachador_soltar($1::uuid)", [d])),
    estaPausada: () => uno<boolean>(db, "select public.office_esta_pausada()"),
    autopausar: (t, u) => uno<boolean>(db, "select public.office_autopausar_por_tope($1::numeric, $2::numeric)", [t, u]),
    recuperar: (a, t) => uno<number>(db, "select public.office_recuperar_corridas($1, $2::int)", [a, t]),
    convertir: (a, l) => uno<number>(db, "select public.office_convertir_triaje($1, $2::int)", [a, l]),
    async tomarTarea(a, p, t) {
      const f = (await q(db, "select * from public.office_tomar_tarea($1, $2::int, $3::int)", [a, p, t]))[0];
      if (!f) return null;
      return { taskId: String(f.task_id), runId: String(f.run_id), entidadRef: (f.entidad_ref as string) ?? null, prioridad: Number(f.prioridad) as 1 | 2 | 3 };
    },
    async anotar(p) {
      await q(
        db,
        "insert into public.task_events (task_id, run_id, tipo, actor, resumen, costo_usd, modelo_usado) values ($1, $2, $3, $4, $5, $6, $7)",
        [p.taskId, p.runId, p.tipo, p.actor, p.resumen, p.costoUsd ?? 0, p.modelo ?? null],
      );
    },
    entregar: (e) =>
      uno<boolean>(db, "select public.office_entregar_corrida($1, $2, $3, $4, $5, $6, $7::smallint, $8, $9)", [
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
    soltar: (t, r, s) => uno<boolean>(db, "select public.office_soltar_corrida($1, $2, $3)", [t, r, s]),
    anotarSesionPorBorrar: async (s, m) => void (await q(db, "select public.office_anotar_sesion_por_borrar($1, $2::int)", [s, m])),
    sesionesPorBorrar: async () =>
      (await q<{ sesion_id: string; vencida: boolean }>(db, "select * from public.office_sesiones_por_borrar()")).map((f) => ({
        sesionId: f.sesion_id,
        vencida: f.vencida,
      })),
    quitarSesionPorBorrar: (s) => uno<boolean>(db, "select public.office_quitar_sesion_por_borrar($1)", [s]),
    contarPendientes: async () => Number(await uno<number>(db, "select public.office_pendientes_conteo()")),
  };
}

function almacenEnvio(db: PGlite): AlmacenEnvio {
  return {
    estaPausada: () => uno<boolean>(db, "select public.office_esta_pausada()"),
    porHacer: async (l) =>
      (await q(db, "select * from public.office_envios_por_hacer($1::int)", [l])).map((f) => ({
        revisionId: String(f.revision_id),
        taskId: String(f.task_id),
        entidadRef: (f.entidad_ref as string) ?? null,
        texto: String(f.texto),
        guion: String(f.guion),
        huella: String(f.huella),
        borradorCreadoEn: new Date(f.borrador_creado_en as string).toISOString(),
      })),
    reservar: (r, h, b, c) => uno<Reserva>(db, "select public.office_reservar_envio($1::uuid, $2, $3::int, $4::bigint)", [r, h, b, c]),
    bloquear: (r, c, b) => uno<boolean>(db, "select public.office_bloquear_envio($1::uuid, $2, $3::int)", [r, c, b]),
    cerrar: (r, e, c, m) => uno<boolean>(db, "select public.office_cerrar_envio($1::uuid, $2, $3, $4::bigint)", [r, e, c, m]),
    marcarIncierto: (r, c) => uno<boolean>(db, "select public.office_marcar_envio_incierto($1::uuid, $2)", [r, c]),
  };
}

async function eventoEnTriaje(db: PGlite, n: number, prioridad = 2) {
  await db.exec(
    `insert into public.event_inbox (tipo, origen, clave_dedupe, prioridad, payload_ref, estado, triaje_en)
     values ('chatwoot.message_created', 'chatwoot', 'chatwoot:conv:${n}:msg:${n}', ${prioridad},
             'chatwoot:conversations/${n}/messages/${n}', 'triaje', now());`,
  );
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
  OFICINA_ENVIO_ACTIVO: "1",
  OFICINA_CHATWOOT_TOKEN_ENVIO: "token-de-envio-de-prueba",
};

const respuesta = (guion: string, texto: string, acuse = texto.split(".")[0] + ".") =>
  JSON.stringify({ respuesta: { acuse, texto, guion } });
const ACUSE_GENERAL = "¡Hola! Gracias por escribirle a DTD Cargo. Ya vi tu mensaje y te ayudo con gusto. Cuéntame un poco más de lo que necesitas.";
// Guiones v0.4: estado-sin-guia reemplaza a pedir-guia.
const PEDIR_GUIA = "Entendí que quieres saber de tu paquete. Para verlo necesito tu número de guía. ¿Me lo compartes?";

function despachador(db: PGlite, o: { mensajes?: Record<number, string>; contenido?: string | "lento"; sinBorrar?: boolean } = {}) {
  const doble = { llamadas: 0, borradas: [] as string[], avisos: [] as number[], registros: [] as string[] };
  const d: DepsDespachador = {
    config: { ...configDespachador(ENV), vigilarPausaMs: 50, tickMs: 20, pausaEntreCorridasS: 0 },
    almacen: almacenDespachador(db),
    async leer(id): Promise<MensajeLeido[]> {
      return [{ rol: "cliente", texto: o.mensajes?.[id] ?? "Hola, quiero saber cómo enviar una caja desde Miami" }];
    },
    async llamar({ signal }): Promise<RespuestaAgente> {
      doble.llamadas += 1;
      if (o.contenido === "lento") {
        await new Promise((_, rechazar) => {
          const t = setTimeout(() => rechazar(new Error("no debía terminar")), 60_000);
          signal.addEventListener("abort", () => {
            clearTimeout(t);
            rechazar(Object.assign(new Error("abortada"), { name: "AbortError" }));
          });
        });
      }
      return { contenido: o.contenido ?? respuesta("acuse-general", ACUSE_GENERAL, "¡Hola!"), entrada: 1000, salida: 100, modelo: "zai/glm-5.3" };
    },
    async borrarSesion(id) {
      doble.borradas.push(id);
      return !o.sinBorrar;
    },
    avisar: async (n) => void doble.avisos.push(n),
    registrar: (m) => doble.registros.push(m),
  };
  return { d, doble };
}

/** Un Chatwoot de mentira: conversaciones por bandeja y los mensajes salientes que recibe. */
function chatwootDoble(
  bandejas: Record<number, number>,
  o: {
    falla?: "rechazo" | "incierto" | "entrega_y_corte";
    salidaPrevia?: Record<number, number>;
    entradaPrevia?: Record<number, number>;
    forma?: "desconocida";
    bandejas?: Record<number, number>;
  } = {},
) {
  const salientes: Array<{ conversacion: number; bandeja: number; texto: string }> = [];
  const c: ChatwootEnvio = {
    async conversacion(id) {
      if (o.forma === "desconocida") return { forma: "desconocida" };
      return {
        forma: "conocida",
        cuenta: 2,
        bandeja: bandejas[id] ?? 11,
        ultimaSalidaS: o.salidaPrevia?.[id] ?? null,
        ultimaEntradaS: o.entradaPrevia?.[id] ?? null,
      };
    },
    async enviar(id, texto) {
      if (o.falla === "rechazo") throw new ErrorDeChatwoot("http_422");
      if (o.falla === "incierto") throw new ErrorDeChatwoot("red", true);
      salientes.push({ conversacion: id, bandeja: bandejas[id] ?? 11, texto });
      if (o.falla === "entrega_y_corte") throw new ErrorDeChatwoot("json", true);
      return 900 + salientes.length;
    },
  };
  return { c, salientes };
}

async function revisar(db: PGlite, veredicto: "aprobado" | "rechazado", conv: number, casillas = true) {
  const b = (await q<{ id: string }>(db, "select b.id from public.office_borradores b join public.office_tasks t on t.id = b.task_id where t.entidad_ref like $1", [`chatwoot:conversations/${conv}/%`]))[0];
  await q(
    db,
    "select public.office_revisar_borrador($1::uuid, $2, $3, true, true, true, true, 'prueba', 1::smallint)",
    [b.id, veredicto, casillas],
    "authenticated",
    SAM,
  );
}

let espias: Array<ReturnType<typeof vi.spyOn>> = [];
beforeEach(() => {
  olvidarAvisosParaPruebas();
  espias = (["log", "info", "warn", "error"] as const).map((n) => vi.spyOn(console, n).mockImplementation(() => {}));
});
afterEach(() => {
  for (const e of espias) e.mockRestore();
});

describe("despachador · pendientes del 3a (Paso 3b)", () => {
  it("un cobro sale escalado con prioridad 3 y SIN llamar al agente", async () => {
    const db = await base();
    await eventoEnTriaje(db, 19);
    const { d, doble } = despachador(db, { mensajes: { 19: "Me cobraron de más" } });
    expect(await tick(d)).toMatchObject({ estado: "corrida", resultado: { fin: "escalado", motivo: "dinero" } });
    expect(doble.llamadas).toBe(0);
    const [b] = await q(db, "select tipo, prioridad, guion from public.office_borradores");
    expect(b).toMatchObject({ tipo: "escalado", prioridad: 3, guion: null });
    expect(doble.avisos).toEqual([1]);
  }, 60_000);

  it("SDD-0701 · un enlace del cliente sale escalado («cliente:enlace», prioridad 2) y SIN llamar al agente", async () => {
    const db = await base();
    await eventoEnTriaje(db, 6);
    const { d, doble } = despachador(db, { mensajes: { 6: "Hola, mi guía está aquí: bit.ly/x7Kp2" } });
    expect(await tick(d)).toMatchObject({ estado: "corrida", resultado: { fin: "escalado", motivo: "cliente:enlace" } });
    expect(doble.llamadas).toBe(0);
    const [b] = await q(db, "select tipo, prioridad, guion, motivo from public.office_borradores");
    expect(b).toMatchObject({ tipo: "escalado", prioridad: 2, guion: null, motivo: "cliente:enlace" });
    expect(doble.avisos).toEqual([1]);
  }, 60_000);

  it("SDD-0701 · dinero y enlace a la vez: gana el dinero (prioridad 3)", async () => {
    const db = await base();
    await eventoEnTriaje(db, 8);
    const { d, doble } = despachador(db, { mensajes: { 8: "Ya pagué, el comprobante: https://pagos.example/x" } });
    expect(await tick(d)).toMatchObject({ resultado: { fin: "escalado", motivo: "dinero" } });
    expect(doble.llamadas).toBe(0);
  }, 60_000);

  it("un evento de dinero (prioridad 3 por etiqueta) también escala sin llamar al agente", async () => {
    const db = await base();
    await eventoEnTriaje(db, 5, 3);
    const { d, doble } = despachador(db);
    expect(await tick(d)).toMatchObject({ resultado: { fin: "escalado", motivo: "dinero" } });
    expect(doble.llamadas).toBe(0);
  }, 60_000);

  it("la sesión de una llamada abortada por la pausa se vuelve a borrar en el tick siguiente", async () => {
    const db = await base();
    await eventoEnTriaje(db, 7);
    const { d, doble } = despachador(db, { contenido: "lento" });
    const corrida = tick(d);
    await new Promise((r) => setTimeout(r, 200));
    await db.exec("insert into public.office_paused (pausada, motivo) values (true, 'prueba: Sam pausa');");
    expect(await corrida).toMatchObject({ resultado: { fin: "abortada" } });
    const [sesion] = await q<{ sesion_id: string }>(db, "select * from public.office_sesiones_por_borrar()");
    expect(sesion.sesion_id).toMatch(/^cable-[0-9a-f-]{36}-1$/);
    expect(doble.borradas).toEqual([sesion.sesion_id]);
    // Tick siguiente (pausada): la vuelve a borrar igual.
    expect(await tick(d)).toEqual({ estado: "pausada" });
    expect(doble.borradas).toEqual([sesion.sesion_id, sesion.sesion_id]);
    // Pasados sus 15 min y con el DELETE bien, sale de la lista.
    await db.exec("update public.office_sesiones_por_borrar set hasta = now() - interval '1 second';");
    await tick(d);
    expect(await q(db, "select * from public.office_sesiones_por_borrar()")).toEqual([]);
  }, 60_000);

  it("si el DELETE falla, la sesión queda anotada y se reintenta (no espera a la purga de 24 h)", async () => {
    const db = await base();
    await eventoEnTriaje(db, 8);
    const { d, doble } = despachador(db, { sinBorrar: true });
    await tick(d);
    expect((await q(db, "select * from public.office_sesiones_por_borrar()")).length).toBe(1);
    expect(doble.registros.join("\n")).toMatch(/se reintenta en los próximos ticks/);
  }, 60_000);

  it("sin la 0549 el despachador sigue como en el 3a y lo anota una sola vez", async () => {
    const db = await base(TODAS.slice(0, 3));
    await eventoEnTriaje(db, 9);
    await eventoEnTriaje(db, 10);
    const { d, doble } = despachador(db, { sinBorrar: true });
    expect(await tick(d)).toMatchObject({ estado: "corrida", resultado: { fin: "borrador" } });
    expect(await tick(d)).toMatchObject({ estado: "corrida", resultado: { fin: "borrador" } });
    expect(doble.avisos).toEqual([]);
    expect(doble.registros.filter((r) => r.includes("falta la 0549")).length).toBe(1);
  }, 60_000);
});

describe("envío (Paso 3b, C)", () => {
  it("apagado no toca ni la base ni Chatwoot", async () => {
    const tocado: string[] = [];
    const almacen = new Proxy({} as AlmacenEnvio, { get: (_, k) => () => void tocado.push(String(k)) });
    const { c, salientes } = chatwootDoble({});
    expect(await procesarEnvios({ config: configEnvio({ ...ENV, OFICINA_ENVIO_ACTIVO: "" }), almacen, chatwoot: c })).toEqual({
      estado: "apagado",
      resultados: [],
    });
    expect(tocado).toEqual([]);
    expect(salientes).toEqual([]);
  });

  it("PRUEBA F en miniatura: 3 conversaciones, Sam aprueba 2 y rechaza 1 → 2 salientes en la 11, 0 en las demás", async () => {
    const db = await base();
    for (const n of [31, 32, 33]) await eventoEnTriaje(db, n);
    const { d, doble } = despachador(db, {
      mensajes: { 31: "Hola, quiero enviar una caja", 32: "¿Dónde está mi paquete?", 33: "Hola" },
    });
    // El agente redacta las 3 (respuestas de guion). Nada sale todavía.
    const contenidos: Record<number, string> = {
      31: respuesta("acuse-general", ACUSE_GENERAL, "¡Hola!"),
      32: respuesta("estado-sin-guia", PEDIR_GUIA, "Entendí que quieres saber de tu paquete."),
      33: respuesta("acuse-general", ACUSE_GENERAL, "¡Hola!"),
    };
    let actual = 31;
    d.leer = async (id) => {
      actual = id;
      return [{ rol: "cliente", texto: "Hola" }];
    };
    d.llamar = async () => ({ contenido: contenidos[actual], entrada: 1000, salida: 100, modelo: "zai/glm-5.3" });
    for (let i = 0; i < 3; i += 1) expect(await tick(d)).toMatchObject({ resultado: { fin: "borrador" } });
    expect(doble.avisos).toEqual([1, 2, 3]);

    const { c, salientes } = chatwootDoble({ 31: 11, 32: 11, 33: 11 });
    const env = { config: configEnvio(ENV), almacen: almacenEnvio(db), chatwoot: c };
    expect(await procesarEnvios(env)).toEqual({ estado: "hecho", resultados: [] });
    expect(salientes).toEqual([]);

    await revisar(db, "aprobado", 31);
    await revisar(db, "aprobado", 32);
    await revisar(db, "rechazado", 33, false);
    expect(await procesarEnvios(env)).toEqual({ estado: "hecho", resultados: ["enviado", "enviado"] });
    expect(salientes.map((s) => [s.conversacion, s.bandeja])).toEqual([
      [31, 11],
      [32, 11],
    ]);
    expect(salientes.every((s) => s.bandeja === 11)).toBe(true);
    // Otra pasada: nada se manda dos veces.
    expect(await procesarEnvios(env)).toEqual({ estado: "hecho", resultados: [] });
    expect(salientes.length).toBe(2);
    const revisiones = await q(db, "select veredicto, revisor from public.office_revisiones order by veredicto");
    expect(revisiones).toEqual([
      { veredicto: "aprobado", revisor: SAM },
      { veredicto: "aprobado", revisor: SAM },
      { veredicto: "rechazado", revisor: SAM },
    ]);
    expect(await q(db, "select estado, count(*)::int as n from public.office_tasks group by estado")).toEqual([{ estado: "terminada", n: 3 }]);
    expect(await q(db, "select estado, count(*)::int as n from public.office_envios group by estado order by estado")).toEqual([
      { estado: "enviado", n: 2 },
      { estado: "enviando", n: 2 },
    ]);
  }, 90_000);

  async function unaAprobada(conv = 41) {
    const db = await base();
    await eventoEnTriaje(db, conv);
    const { d } = despachador(db);
    await tick(d);
    await revisar(db, "aprobado", conv);
    return db;
  }

  it("con la oficina pausada no envía nada", async () => {
    const db = await unaAprobada();
    await db.exec("insert into public.office_paused (pausada, motivo) values (true, 'prueba: pausa');");
    const { c, salientes } = chatwootDoble({ 41: 11 });
    expect(await procesarEnvios({ config: configEnvio(ENV), almacen: almacenEnvio(db), chatwoot: c })).toMatchObject({ estado: "pausada" });
    expect(salientes).toEqual([]);
  }, 60_000);

  it("si la pausa llega entre la lectura y la reserva, la reserva la ve y no envía", async () => {
    const db = await unaAprobada();
    const { c, salientes } = chatwootDoble({ 41: 11 });
    const almacen = almacenEnvio(db);
    const reservar = almacen.reservar;
    almacen.reservar = async (...a) => {
      await db.exec("insert into public.office_paused (pausada, motivo) values (true, 'prueba: pausa justo antes');");
      return reservar(...a);
    };
    expect(await procesarEnvios({ config: configEnvio(ENV), almacen, chatwoot: c })).toEqual({ estado: "hecho", resultados: ["pausada"] });
    expect(salientes).toEqual([]);
  }, 60_000);

  it("un borrador que cambió desde la aprobación no se envía (bloqueado)", async () => {
    const db = await unaAprobada();
    const { c, salientes } = chatwootDoble({ 41: 11 });
    const almacen = almacenEnvio(db);
    const porHacer = almacen.porHacer;
    almacen.porHacer = async (l) => (await porHacer(l)).map((e) => ({ ...e, texto: `${e.texto} Visita otro-sitio.com` }));
    expect(await procesarEnvios({ config: configEnvio(ENV), almacen, chatwoot: c })).toEqual({ estado: "hecho", resultados: ["borrador_cambio"] });
    expect(salientes).toEqual([]);
    expect(await q(db, "select estado, codigo from public.office_envios")).toEqual([{ estado: "bloqueado", codigo: "borrador_cambio" }]);
    expect(await q(db, "select estado from public.office_tasks")).toEqual([{ estado: "terminada" }]);
  }, 60_000);

  const enUnMinuto = () => Math.floor(Date.now() / 1000) + 60;
  it.each([
    ["otra_bandeja", { bandejas: { 41: 6 } }],
    ["ya_contestada", { salidaPrevia: { 41: enUnMinuto() } }],
    ["cliente_escribio", { entradaPrevia: { 41: enUnMinuto() } }],
    ["forma_desconocida", { forma: "desconocida" as const }],
  ] as const)("%s: no se envía, queda «bloqueado» y la tarea termina (no se reintenta)", async (codigo, o) => {
    const db = await unaAprobada();
    const { c, salientes } = chatwootDoble("bandejas" in o ? o.bandejas : { 41: 11 }, o);
    const env = { config: configEnvio(ENV), almacen: almacenEnvio(db), chatwoot: c };
    expect(await procesarEnvios(env)).toEqual({ estado: "hecho", resultados: [codigo] });
    expect(await procesarEnvios(env)).toEqual({ estado: "hecho", resultados: [] });
    expect(salientes).toEqual([]);
    expect(await q(db, "select estado, codigo from public.office_envios")).toEqual([{ estado: "bloqueado", codigo }]);
    expect(await q(db, "select estado from public.office_tasks")).toEqual([{ estado: "terminada" }]);
  }, 60_000);

  it("B3: si la tarea pasó a otra conversación, no se envía a ninguna (conversacion_cambio)", async () => {
    const db = await unaAprobada();
    await db.exec("update public.office_tasks set entidad_ref = 'chatwoot:conversations/99/messages/99';");
    const { c, salientes } = chatwootDoble({ 41: 11, 99: 11 });
    expect(await procesarEnvios({ config: configEnvio(ENV), almacen: almacenEnvio(db), chatwoot: c })).toEqual({
      estado: "hecho",
      resultados: ["conversacion_cambio"],
    });
    expect(salientes).toEqual([]);
  }, 60_000);

  it("B1: una aprobación de más de 24 h no se envía (aprobacion_vencida)", async () => {
    const db = await unaAprobada();
    // El dueño en su propia sesión (como una migración) puede correr la hora; la API no.
    await db.exec("update public.office_revisiones set revisado_en = now() - interval '25 hours';");
    const { c, salientes } = chatwootDoble({ 41: 11 });
    expect(await procesarEnvios({ config: configEnvio(ENV), almacen: almacenEnvio(db), chatwoot: c })).toEqual({
      estado: "hecho",
      resultados: ["aprobacion_vencida"],
    });
    expect(salientes).toEqual([]);
  }, 60_000);

  it("si Chatwoot RECHAZA el envío (4xx), queda «fallido» y no se reintenta solo", async () => {
    const db = await unaAprobada();
    const mala = chatwootDoble({ 41: 11 }, { falla: "rechazo" });
    const env = { config: configEnvio(ENV), almacen: almacenEnvio(db), chatwoot: mala.c };
    expect(await procesarEnvios(env)).toEqual({ estado: "hecho", resultados: ["fallido"] });
    expect(await procesarEnvios(env)).toEqual({ estado: "hecho", resultados: [] });
    expect((await q(db, "select codigo from public.office_envios where estado = 'fallido'"))[0]).toEqual({ codigo: "http_422" });
  }, 60_000);

  it.each(["incierto", "entrega_y_corte"] as const)(
    "M1 · %s: si el mensaje pudo haber salido, queda «enviando» con el aviso, nunca «fallido», y no se reintenta",
    async (falla) => {
      const db = await unaAprobada();
      const { c, salientes } = chatwootDoble({ 41: 11 }, { falla });
      const env = { config: configEnvio(ENV), almacen: almacenEnvio(db), chatwoot: c };
      expect(await procesarEnvios(env)).toEqual({ estado: "hecho", resultados: ["incierto"] });
      expect(await procesarEnvios(env)).toEqual({ estado: "hecho", resultados: [] });
      expect(salientes.length).toBe(falla === "entrega_y_corte" ? 1 : 0);
      expect(await q(db, "select estado from public.office_envios")).toEqual([{ estado: "enviando" }]);
      expect((await q(db, "select count(*)::int as n from public.task_events where tipo = 'envio.incierto'"))[0]).toEqual({ n: 1 });
    },
    60_000,
  );

  it("M1 · Chatwoot lo entregó y el cierre en la base falla: «incierto», nunca «fallido»", async () => {
    const db = await unaAprobada();
    const { c, salientes } = chatwootDoble({ 41: 11 });
    const almacen = almacenEnvio(db);
    almacen.cerrar = async () => {
      throw new ErrorDelAlmacen("08006");
    };
    const env = { config: configEnvio(ENV), almacen, chatwoot: c };
    expect(await procesarEnvios(env)).toEqual({ estado: "hecho", resultados: ["incierto"] });
    expect(salientes.length).toBe(1);
    expect(await procesarEnvios(env)).toEqual({ estado: "hecho", resultados: [] });
    expect(salientes.length).toBe(1);
    expect(await q(db, "select estado from public.office_envios")).toEqual([{ estado: "enviando" }]);
  }, 60_000);

  it("sin la 0549 el envío responde sin_migracion y no toca Chatwoot", async () => {
    const db = await base(TODAS.slice(0, 3));
    const { c, salientes } = chatwootDoble({});
    expect(await procesarEnvios({ config: configEnvio(ENV), almacen: almacenEnvio(db), chatwoot: c })).toMatchObject({ estado: "sin_migracion" });
    expect(salientes).toEqual([]);
  }, 60_000);
});

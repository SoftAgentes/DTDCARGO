// @vitest-environment node
/**
 * SDD-0626 §3.2, §3.3 y §9 · El webhook de Chatwoot, el filtro nivel 1 y el vaciado diario, con eventos
 * SIMULADOS (sin Chatwoot real) contra el esquema REAL (la 0541 y la 0544 en PGlite): los CHECK, la
 * clave única, los privilegios por columna y las funciones son los de la migración, no los de un
 * doble. El procesador y las dos corridas son el código de producción; solo cambia el cable a la base.
 */
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PGlite } from "@electric-sql/pglite";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { correrFiltroDeLaBandeja, correrVaciadoDeResumenes, crearAlmacenSupabase, ErrorDeBandeja } from "../oficina/bandeja-store";
import { type ConfigWebhookOficina, configWebhookOficina } from "../oficina/config";
import { avisarUnaVez, escribirEnElCable, faltaLaMigracion, olvidarAvisosParaPruebas } from "../oficina/escritura";
import { reglasDeEntorno } from "../oficina/filtro-nivel1";
import { type BandejaStore, type FilaBandeja, procesarWebhookOficina } from "../oficina/webhook-chatwoot";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const sql = (f: string) => readFileSync(resolve(ROOT, "supabase/migrations", f), "utf8");

const SECRETO = "secreto-sintetico-del-cable";
const BANDEJA = 7;
const TEXTO_DEL_CLIENTE = "Hola, soy Juan Pérez, mi correo es juan.perez@correo.test y mi teléfono 0414-1234567: ¿dónde está mi paquete?";

const config = (o: Partial<ConfigWebhookOficina> = {}): ConfigWebhookOficina => ({
  activo: true,
  secreto: SECRETO,
  bandejaPrueba: BANDEJA,
  cuenta: 1,
  reglas: reglasDeEntorno(undefined, undefined),
  ...o,
});

function mensaje(o: { conv: number; msg: number; inbox?: number; tipo?: string; privado?: boolean; etiquetas?: string[]; cuenta?: number; evento?: string }) {
  return {
    event: o.evento ?? "message_created",
    id: o.msg,
    message_type: o.tipo ?? "incoming",
    private: o.privado ?? false,
    content: TEXTO_DEL_CLIENTE,
    account: { id: o.cuenta ?? 1 },
    conversation: {
      id: o.conv,
      inbox_id: o.inbox ?? BANDEJA,
      status: "open",
      labels: o.etiquetas ?? [],
      meta: { sender: { name: "Juan Pérez", phone_number: "+584141234567" } },
    },
  };
}

function peticion(payload: unknown, o: { secreto?: string; ts?: number; firma?: string | null } = {}) {
  const cuerpo = JSON.stringify(payload);
  const ts = String(o.ts ?? Math.floor(Date.now() / 1000));
  const firma =
    o.firma === undefined ? `sha256=${createHmac("sha256", o.secreto ?? SECRETO).update(`${ts}.${cuerpo}`).digest("hex")}` : o.firma;
  const headers: Record<string, string> = { "Content-Type": "application/json", "X-Chatwoot-Timestamp": ts };
  if (firma) headers["X-Chatwoot-Signature"] = firma;
  return new Request("https://dtdcargo.test/api/oficina/webhook-chatwoot", { method: "POST", headers, body: cuerpo });
}

// ─── El cable a la base REAL (PGlite), como service_role ──────────────────────────────────
function almacenPglite(db: PGlite): BandejaStore {
  return {
    async guardar(f: FilaBandeja) {
      await db.exec("set role service_role");
      try {
        const r = await db.query(
          "insert into public.event_inbox (tipo, origen, clave_dedupe, prioridad, payload_ref) values ($1, $2, $3, $4, $5) on conflict (clave_dedupe) do nothing returning id",
          [f.tipo, f.origen, f.clave_dedupe, f.prioridad, f.payload_ref],
        );
        return r.rows.length > 0 ? "guardado" : "duplicado";
      } catch (e) {
        if (faltaLaMigracion({ code: (e as { code?: string }).code })) return "sin_migracion";
        throw e;
      } finally {
        await db.exec("reset role");
      }
    },
  };
}

/** Un cliente con solo `rpc`, que llama a las funciones reales como service_role. */
function adminPglite(db: PGlite): SupabaseClient {
  const FUNCIONES: Record<string, string> = {
    office_filtrar_bandeja: "select public.office_filtrar_bandeja($1::integer) as r",
    office_vaciar_resumenes_viejos: "select public.office_vaciar_resumenes_viejos() as r",
  };
  return {
    rpc: vi.fn(async (fn: string, args?: Record<string, unknown>) => {
      await db.exec("set role service_role");
      try {
        const r = await db.query<{ r: number }>(FUNCIONES[fn], fn === "office_filtrar_bandeja" ? [args?.p_cuota] : []);
        return { data: r.rows[0].r, error: null };
      } catch (e) {
        return { data: null, error: { code: (e as { code?: string }).code ?? "XX000" } };
      } finally {
        await db.exec("reset role");
      }
    }),
  } as unknown as SupabaseClient;
}

const BASE = `
  create schema if not exists auth;
  create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated, service_role;
  create table public.platform_admins (user_id uuid primary key);
  create function public.is_platform_admin() returns boolean language sql security definer stable
    set search_path = public as $$ select exists (select 1 from public.platform_admins where user_id = (select auth.uid())) $$;
`;
const ROLES = `
  do $r$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  end $r$;
`;

const filas = async (db: PGlite) => (await db.query<Record<string, unknown>>("select * from public.event_inbox order by id")).rows;
const cuantas = async (db: PGlite, donde = "true") =>
  Number((await db.query<{ n: string }>(`select count(*)::text n from public.event_inbox where ${donde}`)).rows[0].n);
const pausar = (db: PGlite, valor: boolean) =>
  db.query("insert into public.office_paused (pausada, motivo) values ($1, 'prueba del Paso 2')", [valor]);

describe("SDD-0626 · webhook, filtro y vaciado (esquema real en PGlite)", () => {
  let db: PGlite;
  const registro: string[] = [];
  const registrar = (m: string) => registro.push(m);

  beforeAll(async () => {
    db = await pgliteLimpio();
    await db.exec(ROLES + BASE + sql("0541_oficina_cable_tablas.sql") + sql("0544_oficina_filtro_bandeja.sql"));
  }, 60_000);
  afterAll(async () => {
    await db?.close();
  });
  beforeEach(async () => {
    registro.length = 0;
    olvidarAvisosParaPruebas();
    await db.exec("delete from public.event_inbox");
    await pausar(db, true); // cada caso arranca con la oficina pausada, como nace
  });

  const entregar = (payload: unknown, o: Parameters<typeof peticion>[1] = {}, cfg = config()) =>
    procesarWebhookOficina(peticion(payload, o), { config: cfg, crearAlmacen: () => almacenPglite(db), registrar });

  // ── §9 · ráfaga de 50 eventos con duplicados ────────────────────────────────────────────
  it("ráfaga de 50 eventos con 20 repetidos: dedupe (30 filas) y cuota (20 a triaje, dinero primero, nada descartado)", async () => {
    // 30 mensajes distintos: 5 de dinero, 10 de cliente y 15 internos; y 20 entregas repetidas.
    const evento = (g: number) => {
      const conv = (g % 30) + 1;
      const etiquetas = conv <= 5 ? ["pago"] : conv <= 15 ? [] : ["interno"];
      return mensaje({ conv, msg: conv * 10, etiquetas });
    };
    const resultados: string[] = [];
    for (let g = 1; g <= 50; g++) {
      const r = await entregar(evento(g));
      expect(r.status).toBe(200);
      resultados.push(String(r.cuerpo.resultado));
    }
    expect(resultados.filter((x) => x === "guardado")).toHaveLength(30);
    expect(resultados.filter((x) => x === "duplicado")).toHaveLength(20);
    expect(await cuantas(db)).toBe(30);
    expect(await cuantas(db, "prioridad = 3")).toBe(5);
    expect(await cuantas(db, "prioridad = 2")).toBe(10);
    expect(await cuantas(db, "prioridad = 1")).toBe(15);

    // Sin pausa, el filtro pasa 20 y no más: primero el dinero, luego el cliente, luego lo interno.
    await pausar(db, false);
    const admin = adminPglite(db);
    expect(await correrFiltroDeLaBandeja(admin, config())).toEqual({ estado: "ok", cantidad: 20 });
    expect(await cuantas(db, "estado = 'triaje' and prioridad = 3")).toBe(5);
    expect(await cuantas(db, "estado = 'triaje' and prioridad = 2")).toBe(10);
    expect(await cuantas(db, "estado = 'triaje' and prioridad = 1")).toBe(5);
    expect(await cuantas(db, "estado = 'nuevo'")).toBe(10);
    expect(await cuantas(db, "estado = 'descartado'")).toBe(0);
    // Dentro de la misma hora no pasa ninguno más: la cuota no descarta, espera.
    expect(await correrFiltroDeLaBandeja(admin, config())).toEqual({ estado: "ok", cantidad: 0 });
    expect(await cuantas(db, "estado = 'nuevo'")).toBe(10);
    // Una entrega repetida después de pasar a triaje sigue sin entrar.
    expect((await entregar(evento(1))).cuerpo.resultado).toBe("duplicado");
    expect(await cuantas(db)).toBe(30);
  }, 60_000);

  // ── Lo que NO se guarda ─────────────────────────────────────────────────────────────────
  describe("no se guarda nada", () => {
    const casos: Array<[string, () => Promise<{ status: number; cuerpo: Record<string, unknown> }>, number, string?]> = [
      ["firma mala", () => entregar(mensaje({ conv: 1, msg: 1 }), { secreto: "otro-secreto" }), 401],
      ["sin firma", () => entregar(mensaje({ conv: 1, msg: 1 }), { firma: null }), 401],
      ["firma vencida (ts de hace 1 h)", () => entregar(mensaje({ conv: 1, msg: 1 }), { ts: Math.floor(Date.now() / 1000) - 3600 }), 401],
      ["bandeja ajena", () => entregar(mensaje({ conv: 1, msg: 1, inbox: 99 })), 200, "bandeja"],
      ["nota interna", () => entregar(mensaje({ conv: 1, msg: 1, privado: true })), 200, "nota_interna"],
      ["mensaje propio (saliente)", () => entregar(mensaje({ conv: 1, msg: 1, tipo: "outgoing" })), 200, "no_entrante"],
      ["otro tipo de evento", () => entregar(mensaje({ conv: 1, msg: 1, evento: "conversation_status_changed" })), 200, "evento"],
      ["cuenta de otro Chatwoot", () => entregar(mensaje({ conv: 1, msg: 1, cuenta: 2 })), 200, "cuenta"],
      ["interruptor apagado", () => entregar(mensaje({ conv: 1, msg: 1 }), {}, config({ activo: false })), 200, "apagado"],
      ["bandeja de prueba vacía (se rechaza todo)", () => entregar(mensaje({ conv: 1, msg: 1 }), {}, config({ bandejaPrueba: null })), 503],
      ["sin secreto configurado", () => entregar(mensaje({ conv: 1, msg: 1 }), {}, config({ secreto: null })), 503],
      // Paso 3a (opcional del DG): sin OFICINA_CHATWOOT_ACCOUNT_ID no entra ningún aviso, de ninguna cuenta.
      ["sin OFICINA_CHATWOOT_ACCOUNT_ID (se rechaza todo)", () => entregar(mensaje({ conv: 1, msg: 1 }), {}, config({ cuenta: null })), 503],
    ];
    for (const [nombre, correr, status, motivo] of casos) {
      it(`${nombre}: ${status} y la bandeja queda vacía`, async () => {
        const r = await correr();
        expect(r.status).toBe(status);
        if (motivo) expect(r.cuerpo.ignorado).toBe(motivo);
        expect(await cuantas(db)).toBe(0);
        expect(JSON.stringify(r.cuerpo)).not.toContain("Juan");
      });
    }

    it("firma mala o interruptor apagado: ni siquiera se crea el almacén (no hay cliente de base)", async () => {
      const crearAlmacen = vi.fn(() => almacenPglite(db));
      const mala = await procesarWebhookOficina(peticion(mensaje({ conv: 1, msg: 1 }), { secreto: "otro" }), { config: config(), crearAlmacen, registrar });
      const apagado = await procesarWebhookOficina(peticion(mensaje({ conv: 1, msg: 1 })), { config: config({ activo: false }), crearAlmacen, registrar });
      expect([mala.status, apagado.status]).toEqual([401, 200]);
      expect(crearAlmacen).not.toHaveBeenCalled();
    });

    it("un cuerpo de más de 256 KiB se rechaza antes de la firma (413)", async () => {
      const grande = new Request("https://dtdcargo.test/api/oficina/webhook-chatwoot", {
        method: "POST",
        headers: { "content-length": String(300 * 1024) },
        body: "x",
      });
      const r = await procesarWebhookOficina(grande, { config: config(), crearAlmacen: () => almacenPglite(db), registrar });
      expect(r.status).toBe(413);
    });
  });

  // ── Con la pausa activa: se guarda y no avanza ───────────────────────────────────────────
  it("pausa activa: el aviso se guarda igual y el filtro no mueve nada; al despausar, avanza", async () => {
    for (let i = 1; i <= 5; i++) expect((await entregar(mensaje({ conv: i, msg: i }))).cuerpo.resultado).toBe("guardado");
    expect(await cuantas(db, "estado = 'nuevo'")).toBe(5);
    const admin = adminPglite(db);
    expect(await correrFiltroDeLaBandeja(admin, config())).toEqual({ estado: "ok", cantidad: 0 });
    expect(await cuantas(db, "estado = 'nuevo'")).toBe(5);
    await pausar(db, false);
    expect(await correrFiltroDeLaBandeja(admin, config())).toEqual({ estado: "ok", cantidad: 5 });
  });

  it("el filtro apagado no llama a la base", async () => {
    const admin = adminPglite(db);
    await pausar(db, false);
    await entregar(mensaje({ conv: 1, msg: 1 }));
    expect(await correrFiltroDeLaBandeja(admin, config({ activo: false }))).toEqual({ estado: "apagado" });
    expect(admin.rpc).not.toHaveBeenCalled();
    expect(await cuantas(db, "estado = 'nuevo'")).toBe(1);
  });

  // ── R5: nunca el texto del mensaje ───────────────────────────────────────────────────────
  it("ninguna fila contiene el texto del mensaje, ni datos de contacto, ni el cuerpo", async () => {
    await entregar(mensaje({ conv: 123456789, msg: 987654321, etiquetas: ["pago"] }));
    const r = await filas(db);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      tipo: "chatwoot.message_created",
      origen: "chatwoot",
      clave_dedupe: "chatwoot:conv:123456789:msg:987654321",
      payload_ref: "chatwoot:conversations/123456789/messages/987654321",
      prioridad: 3,
      estado: "nuevo",
    });
    const todo = JSON.stringify(r);
    for (const dato of ["Juan", "juan.perez", "correo.test", "0414", "1234567:", "paquete", "584141234567"]) {
      expect(todo, `la fila guarda «${dato}»`).not.toContain(dato);
    }
    expect(registro.join("\n")).not.toContain("Juan");
  });

  it("la base misma rechaza una referencia con el mensaje (payload_ref con espacios)", async () => {
    await db.exec("set role service_role");
    await expect(
      db.query("insert into public.event_inbox (tipo, origen, clave_dedupe, payload_ref) values ('chatwoot.message_created', 'chatwoot', 'x:1', $1)", [TEXTO_DEL_CLIENTE]),
    ).rejects.toMatchObject({ code: "23514" });
    await db.exec("reset role");
    expect(await cuantas(db)).toBe(0);
  });

  // ── Vaciado diario (decisión A de Sam, privacidad.md) ────────────────────────────────────
  describe("vaciado diario de task_events.resumen", () => {
    const ENV_SI = { OFICINA_VACIADO_ACTIVO: "1" };
    async function sembrar() {
      await db.exec("delete from public.task_events; delete from public.office_tasks;");
      await db.exec(`insert into public.office_tasks (id, titulo) values ('00000000-0000-4000-8000-000000000001', 'Tarea de prueba');`);
      // ts lo escribe el dueño en la prueba: service_role nunca lo escribe.
      await db.exec(`
        insert into public.task_events (task_id, tipo, actor, resumen, costo_usd, modelo_usado, ts) values
          ('00000000-0000-4000-8000-000000000001', 'run.terminada', 'agente:soporte-chatwoot', 'viejo 100 días', 0.5, 'glm-5.3', now() - interval '100 days'),
          ('00000000-0000-4000-8000-000000000001', 'run.terminada', 'agente:soporte-chatwoot', 'viejo 91 días',  0.25, 'glm-5.3', now() - interval '91 days'),
          ('00000000-0000-4000-8000-000000000001', 'run.terminada', 'agente:soporte-chatwoot', 'reciente 89 días', 0.1, 'glm-5.3', now() - interval '89 days'),
          ('00000000-0000-4000-8000-000000000001', 'run.terminada', 'agente:soporte-chatwoot', 'reciente 10 días', 0.1, 'glm-5.3', now() - interval '10 days'),
          ('00000000-0000-4000-8000-000000000001', 'run.iniciada',  'sistema:despachador', null, 0, null, now() - interval '200 days');
      `);
    }
    const eventos = async () =>
      (await db.query<{ resumen: string | null; resto: unknown }>("select resumen, to_jsonb(t) - 'resumen' as resto from public.task_events t order by ts")).rows;

    it("vacía las de más de 90 días, deja las recientes, no toca ningún otro campo y repetirlo da lo mismo", async () => {
      await sembrar();
      const antes = await eventos();
      const admin = adminPglite(db);
      // La oficina está pausada (como nace): el vaciado corre igual, es privacidad.
      expect(await db.query<{ p: boolean }>("select public.office_esta_pausada() p").then((r) => r.rows[0].p)).toBe(true);
      expect(await correrVaciadoDeResumenes(admin, ENV_SI)).toEqual({ estado: "ok", cantidad: 2 });
      const despues = await eventos();
      // Orden por hora: 200 d (ya era null), 100 d y 91 d (vaciados), 89 d y 10 d (intactos).
      expect(despues.map((e) => e.resumen)).toEqual([null, null, null, "reciente 89 días", "reciente 10 días"]);
      expect(despues.find((e) => e.resumen === "reciente 89 días")).toBeDefined();
      expect(despues.find((e) => e.resumen === "reciente 10 días")).toBeDefined();
      // Ninguna otra columna cambió: tipo, actor, costo, modelo, hora, ids.
      expect(despues.map((e) => e.resto)).toEqual(antes.map((e) => e.resto));
      // Segunda corrida: nada que vaciar y el estado es idéntico.
      expect(await correrVaciadoDeResumenes(admin, ENV_SI)).toEqual({ estado: "ok", cantidad: 0 });
      expect(await eventos()).toEqual(despues);
    });

    it("apagado (el defecto): no llama a la base y no vacía nada", async () => {
      await sembrar();
      const admin = adminPglite(db);
      for (const env of [{}, { OFICINA_VACIADO_ACTIVO: "" }, { OFICINA_VACIADO_ACTIVO: "0" }, { OFICINA_VACIADO_ACTIVO: "false" }]) {
        expect(await correrVaciadoDeResumenes(admin, env)).toEqual({ estado: "apagado" });
      }
      expect(admin.rpc).not.toHaveBeenCalled();
      expect((await eventos()).filter((e) => e.resumen !== null)).toHaveLength(4);
    });
  });
});

// ─── Sin la 0541: no hace nada y no tumba nada ────────────────────────────────────────────
describe("sin la 0541 en la base", () => {
  let vacia: PGlite;
  const registro: string[] = [];
  beforeAll(async () => {
    vacia = await pgliteLimpio();
    await vacia.exec(ROLES);
  }, 60_000);
  afterAll(async () => {
    await vacia?.close();
  });
  beforeEach(() => {
    registro.length = 0;
    olvidarAvisosParaPruebas();
    vi.spyOn(console, "warn").mockImplementation((m: string) => void registro.push(String(m)));
  });

  it("el webhook responde 200 «omitido», no falla y lo anota UNA sola vez", async () => {
    const rs = [];
    for (let i = 1; i <= 3; i++) {
      rs.push(
        await procesarWebhookOficina(peticion(mensaje({ conv: i, msg: i })), {
          config: config(),
          crearAlmacen: () => almacenPglite(vacia),
          registrar: (m) => registro.push(m),
        }),
      );
    }
    expect(rs.map((r) => [r.status, r.cuerpo.omitido])).toEqual([[200, "sin_migracion"], [200, "sin_migracion"], [200, "sin_migracion"]]);
    expect(registro.filter((m) => m.includes("falta la 0541"))).toHaveLength(1);
  });

  it("el filtro y el vaciado no hacen nada, no fallan y lo anotan una vez cada uno", async () => {
    const admin = adminPglite(vacia);
    for (let i = 0; i < 3; i++) {
      expect(await correrFiltroDeLaBandeja(admin, config())).toEqual({ estado: "sin_migracion" });
      expect(await correrVaciadoDeResumenes(admin, { OFICINA_VACIADO_ACTIVO: "1" })).toEqual({ estado: "sin_migracion" });
    }
    expect(registro.filter((m) => m.includes("el filtro no mueve nada"))).toHaveLength(1);
    expect(registro.filter((m) => m.includes("el vaciado no hace nada"))).toHaveLength(1);
  });

  it("con la 0541 pero sin la 0544: el filtro dice «sin migración» (función inexistente) y no rompe", async () => {
    const solo41 = await pgliteLimpio();
    try {
      await solo41.exec(ROLES + BASE + sql("0541_oficina_cable_tablas.sql"));
      expect(await correrFiltroDeLaBandeja(adminPglite(solo41), config())).toEqual({ estado: "sin_migracion" });
    } finally {
      await solo41.close();
    }
  }, 60_000);
});

// ─── El almacén real de Supabase: lo que hace con cada respuesta de PostgREST ─────────────
describe("crearAlmacenSupabase", () => {
  const FILA: FilaBandeja = {
    tipo: "chatwoot.message_created",
    origen: "chatwoot",
    clave_dedupe: "chatwoot:conv:1:msg:1",
    prioridad: 2,
    payload_ref: "chatwoot:conversations/1/messages/1",
  };
  const cliente = (resultado: { data?: unknown; error?: { code: string; message?: string } | null }) => {
    const upsert = vi.fn(() => ({ select: async () => ({ data: resultado.data ?? null, error: resultado.error ?? null }) }));
    return { admin: { from: vi.fn(() => ({ upsert })) } as unknown as SupabaseClient, upsert };
  };

  it("inserta con ON CONFLICT DO NOTHING sobre clave_dedupe y distingue guardado de duplicado", async () => {
    const nuevo = cliente({ data: [{ id: "a" }] });
    expect(await crearAlmacenSupabase(nuevo.admin).guardar(FILA)).toBe("guardado");
    expect(nuevo.upsert).toHaveBeenCalledWith(FILA, { onConflict: "clave_dedupe", ignoreDuplicates: true });
    expect(await crearAlmacenSupabase(cliente({ data: [] }).admin).guardar(FILA)).toBe("duplicado");
  });

  it("tabla inexistente (PGRST205 o 42P01) → sin_migracion; otro error → ErrorDeBandeja solo con su código", async () => {
    for (const code of ["PGRST205", "42P01"]) {
      expect(await crearAlmacenSupabase(cliente({ error: { code } }).admin).guardar(FILA)).toBe("sin_migracion");
    }
    const otro = crearAlmacenSupabase(cliente({ error: { code: "23514", message: `viola el CHECK con ${TEXTO_DEL_CLIENTE}` } }).admin);
    const error = await otro.guardar(FILA).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeBandeja);
    expect(error.code).toBe("23514");
    expect(String(error.message)).not.toContain("Juan");
  });

  it("un error del almacén da 500 y el log lleva solo el código", async () => {
    const log: string[] = [];
    const r = await procesarWebhookOficina(peticion(mensaje({ conv: 1, msg: 1 })), {
      config: config(),
      crearAlmacen: () => crearAlmacenSupabase(cliente({ error: { code: "XX000", message: TEXTO_DEL_CLIENTE } }).admin),
      registrar: (m) => log.push(m),
    });
    expect(r.status).toBe(500);
    expect(log.join("\n")).toContain("XX000");
    expect(log.join("\n")).not.toContain("Juan");
  });
});

// ─── La regla de escritura del cable ──────────────────────────────────────────────────────
describe("escribirEnElCable (exigirTextosDelCable)", () => {
  it("un texto con datos personales NO se escribe y el log dice por qué sin repetir el dato", async () => {
    const escribir = vi.fn(async () => "escrito");
    const log: string[] = [];
    const r = await escribirEnElCable({ titulo: "Llamar al 0414-1234567 o a juan.perez@correo.test" }, escribir, (m) => log.push(m));
    expect(r).toEqual({ escrito: false, codigos: ["titulo_con_datos_personales"] });
    expect(escribir).not.toHaveBeenCalled();
    expect(log.join("\n")).toContain("titulo_con_datos_personales");
    for (const dato of ["0414", "1234567", "juan.perez", "correo.test"]) expect(log.join("\n")).not.toContain(dato);
  });

  it("un identificador que no es identificador (un nombre) tampoco se escribe; una referencia sí", async () => {
    const escribir = vi.fn(async () => 1);
    expect((await escribirEnElCable({ actor: "Juan Pérez" }, escribir, () => undefined)).escrito).toBe(false);
    expect((await escribirEnElCable({ actor: "agente:soporte-chatwoot", metaDatos: { payload_ref: "chatwoot:conversations/987654321/messages/123456789" } }, escribir)).escrito).toBe(true);
    expect(escribir).toHaveBeenCalledTimes(1);
  });

  it("avisarUnaVez anota una sola vez por clave", () => {
    olvidarAvisosParaPruebas();
    const log: string[] = [];
    expect([avisarUnaVez("k", "a", (m) => log.push(m)), avisarUnaVez("k", "b", (m) => log.push(m)), avisarUnaVez("otra", "c", (m) => log.push(m))]).toEqual([true, false, true]);
    expect(log).toEqual(["a", "c"]);
  });
});

// ─── Interruptores y configuración: todo nace apagado ─────────────────────────────────────
describe("configuración", () => {
  it("sin variables: todo apagado y se rechaza todo", () => {
    expect(configWebhookOficina({})).toMatchObject({ activo: false, secreto: null, bandejaPrueba: null, cuenta: null });
  });

  it("solo un «sí» explícito enciende", () => {
    for (const v of [undefined, "", " ", "0", "false", "no", "off", "apagado", "2", "si", "sí", "yes", "on"]) {
      expect(configWebhookOficina({ OFICINA_WEBHOOK_ACTIVO: v }).activo, String(v)).toBe(false);
    }
    for (const v of ["1", "true", "TRUE", " true "]) {
      expect(configWebhookOficina({ OFICINA_WEBHOOK_ACTIVO: v }).activo, v).toBe(true);
    }
  });

  it("la bandeja de prueba tiene que ser un id numérico; una etiqueta o un texto no vale", () => {
    expect(configWebhookOficina({ OFICINA_CHATWOOT_INBOX_PRUEBA: "7" }).bandejaPrueba).toBe(7);
    for (const v of ["", "0", "-1", "siete", "7,8", "07a"]) {
      expect(configWebhookOficina({ OFICINA_CHATWOOT_INBOX_PRUEBA: v }).bandejaPrueba, v).toBeNull();
    }
  });

  it("si la bandeja de prueba es la del portal, de clientes o de leads, se rechaza todo (null)", () => {
    for (const v of ["CHATWOOT_INBOX_PORTAL_ID", "CHATWOOT_INBOX_CLIENTES_ID", "CHATWOOT_INBOX_LEADS_ID"]) {
      expect(configWebhookOficina({ OFICINA_CHATWOOT_INBOX_PRUEBA: "7", [v]: "7" }).bandejaPrueba, v).toBeNull();
      expect(configWebhookOficina({ OFICINA_CHATWOOT_INBOX_PRUEBA: "7", [v]: " 7 " }).bandejaPrueba, v).toBeNull();
      expect(configWebhookOficina({ OFICINA_CHATWOOT_INBOX_PRUEBA: "7", [v]: "8" }).bandejaPrueba, v).toBe(7);
    }
  });

  it("las etiquetas de prioridad son configurables y, vacías, valen las de por defecto", () => {
    const r = configWebhookOficina({ OFICINA_ETIQUETAS_DINERO: " Cobro-Urgente , deuda ,, ", OFICINA_ETIQUETAS_INTERNO: "" });
    expect(r.reglas.dinero).toEqual(["cobro-urgente", "deuda"]);
    expect(r.reglas.interno).toContain("prueba");
  });
});

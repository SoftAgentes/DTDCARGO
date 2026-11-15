// @vitest-environment node
/**
 * SDD-0626 §3.1 · La migración 0541 (las tres tablas del cable y office_paused)
 * corrida de verdad sobre PostgreSQL embebido, con el contrato
 * `supabase/tests/0541_…test.sql` y los `.sql` reales inlineados: la migración y
 * su desarme (`supabase/desarmes/0541_desarme.sql`), en el orden
 * arriba → abajo → arriba.
 *
 * CONTROL ROJO: sin la migración el contrato falla. MUTANTES: cada uno quita una
 * barrera de la migración (o del desarme) y el contrato tiene que caer en el
 * punto que la protege. El mismo contrato corre en Postgres 17 con Docker en el
 * workflow «Contratos SQL».
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0541_oficina_cable_tablas.test.sql");
const MIGRATION = "0541_oficina_cable_tablas.sql";
const DESARME = "0541_desarme.sql";

type Transform = (sql: string) => string;

// Entre la bajada y la segunda subida: el desarme quitó todo lo de la 0541 y nada más.
const ABAJO = `
do $abajo$
begin
  if to_regclass('public.office_tasks') is not null
     or to_regclass('public.task_events') is not null
     or to_regclass('public.event_inbox') is not null
     or to_regclass('public.office_paused') is not null
     or to_regprocedure('public.office_solo_insertar()') is not null
     or to_regprocedure('public.office_esta_pausada()') is not null
     or to_regprocedure('public.office_cambiar_pausa(boolean, text)') is not null then
    raise exception 'CONTRATO 1: el desarme dejó objetos de la 0541';
  end if;
  if to_regprocedure('public.is_platform_admin()') is null
     or (select count(*) from public.platform_admins) <> 1 then
    raise exception 'CONTRATO 1: el desarme tocó lo que no es de la 0541';
  end if;
end;
$abajo$;
`;

/**
 * El contrato con los `\ir` resueltos. Con `vuelta`, el PRIMER `\ir` de la
 * migración se vuelve 0541 → desarme → comprobación → 0541 (arriba → abajo →
 * arriba); el resto del contrato corre sobre la segunda subida. El contrato de
 * Postgres 17 no incluye el desarme porque el control C4 del CI solo copia
 * migraciones, contratos y cargas.
 */
function inline(
  file: string,
  opts: { omit?: boolean; vuelta?: boolean; migracion?: Transform; desarme?: Transform } = {},
): string {
  let primera = true;
  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((line) => {
      const include = line.match(/^\\ir\s+(\S+)/);
      if (include) {
        if (include[1] !== `../migrations/${MIGRATION}`) {
          throw new Error(`\\ir inesperado en el contrato: ${include[1]}`);
        }
        if (opts.omit) return "";
        const leida = readFileSync(resolve(dirname(file), include[1]), "utf8");
        const mig = opts.migracion ? opts.migracion(leida) : leida;
        if (!opts.vuelta || !primera) return mig;
        primera = false;
        const des = readFileSync(resolve(ROOT, "supabase/desarmes", DESARME), "utf8");
        return [mig, opts.desarme ? opts.desarme(des) : des, ABAJO, mig].join("\n");
      }
      return /^\\(set|echo)\s/.test(line) ? "" : line;
    })
    .join("\n");
}

async function run(sql: string): Promise<string | null> {
  const db = await pgliteLimpio();
  try {
    await db.exec(sql);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  } finally {
    await db.close();
  }
}

function mutar(buscar: string, poner: string, todas = false): Transform {
  return (sql: string) => {
    const mutado = todas ? sql.split(buscar).join(poner) : sql.replace(buscar, poner);
    if (mutado === sql) throw new Error(`el mutante no encontró: ${buscar}`);
    return mutado;
  };
}

describe("0541 · tablas del cable y office_paused (PGlite)", () => {
  it("el contrato completo pasa con la migración real (como en Postgres 17)", async () => {
    expect(await run(inline(CONTRACT))).toBeNull();
  }, 60_000);

  it("el contrato completo pasa después de arriba → abajo → arriba, con la migración y el desarme reales", async () => {
    expect(await run(inline(CONTRACT, { vuelta: true }))).toBeNull();
  }, 60_000);

  it("control rojo: sin la migración el contrato falla", async () => {
    expect(await run(inline(CONTRACT, { omit: true }))).toMatch(/office_esta_pausada|office_tasks/);
  }, 60_000);

  it("mutante: un desarme que deja office_esta_pausada(), el contrato lo detecta", async () => {
    const desarme = mutar("drop function if exists public.office_esta_pausada();", "");
    expect(await run(inline(CONTRACT, { vuelta: true, desarme }))).toMatch(
      /CONTRATO 1: el desarme dejó objetos de la 0541/,
    );
  }, 60_000);

  it("mutante: la primera fila sin la guarda de una sola vez, se duplica al reaplicar", async () => {
    const migracion = mutar(" where not exists (select 1 from public.office_paused);", ";");
    expect(await run(inline(CONTRACT, { migracion }))).toMatch(/CONTRATO 1: aplicar la 0541 de nuevo duplicó/);
  }, 60_000);

  // El postflight cuenta los disparadores ALWAYS; sin esa cuenta, el contrato tiene que verlo solo.
  const sinCuentaDeDisparadores = mutar(
    "<> 2 then\n      raise exception '0541 postflight: faltan los disparadores",
    "< 0 then\n      raise exception '0541 postflight: faltan los disparadores",
  );

  it.each<[string, string]>([
    ["task_events", "task_events_solo_insertar"],
    ["office_paused", "office_paused_solo_insertar"],
  ])("mutante: sin el disparador de UPDATE/DELETE de %s, un privilegio dado por error la edita", async (tabla, disparador) => {
    const migracion = (sql: string) =>
      mutar(`alter table public.${tabla.padEnd(13)} enable always trigger ${disparador};\n`, "")(
        mutar(
          `create or replace trigger ${disparador}\n  before update or delete on public.${tabla}\n  for each row execute function public.office_solo_insertar();`,
          "",
        )(sql),
      );
    // Sin uno, la migración misma no termina.
    expect(await run(inline(CONTRACT, { migracion }))).toMatch(
      new RegExp(`faltan los disparadores de solo agregar \\(ENABLE ALWAYS\\) en ${tabla}`),
    );
    // Y sin esa comprobación, el contrato lo ve en la tabla.
    expect(await run(inline(CONTRACT, { migracion: (sql) => sinCuentaDeDisparadores(migracion(sql)) }))).toMatch(
      new RegExp(`CONTRATO 2: con privilegio dado por error, service_role pudo ejecutar: update public\\.${tabla}`),
    );
  }, 60_000);

  it("mutante: disparadores ORIGIN y no ALWAYS, session_replication_role = replica los apaga", async () => {
    const migracion = (sql: string) => {
      const sinAlways = sql.replace(/^alter table public\.\S+\s+enable always trigger \S+;\n/gm, "");
      if (sinAlways === sql) throw new Error("el mutante no encontró los ENABLE ALWAYS");
      return sinAlways;
    };
    expect(await run(inline(CONTRACT, { migracion }))).toMatch(
      /faltan los disparadores de solo agregar \(ENABLE ALWAYS\) en task_events/,
    );
    const sinPostflight = (sql: string) =>
      mutar("t.tgenabled = 'A'", "t.tgenabled in ('O', 'A')")(migracion(sql));
    expect(await run(inline(CONTRACT, { migracion: sinPostflight }))).toMatch(
      /CONTRATO 2: con session_replication_role = replica, service_role pudo ejecutar: update public\.task_events/,
    );
  }, 60_000);

  it("mutante: sin exigir session_user, una función SECURITY DEFINER del dueño edita la bitácora", async () => {
    const migracion = mutar(
      "if current_user = v_dueno and session_user = v_dueno then",
      "if current_user = v_dueno then",
    );
    expect(await run(inline(CONTRACT, { migracion }))).toMatch(
      /CONTRATO 2: una función SECURITY DEFINER del dueño editó task_events/,
    );
  }, 60_000);

  it("mutante: sin la excepción del dueño, el dueño de las migraciones tampoco corrige", async () => {
    const migracion = mutar(
      "if current_user = v_dueno and session_user = v_dueno then",
      "if false then",
    );
    expect(await run(inline(CONTRACT, { migracion }))).toMatch(/CONTRATO 2: el dueño de las migraciones no pudo/);
  }, 60_000);

  it.each<[string, string, RegExp]>([
    [
      "estado de office_tasks",
      "check (estado in ('borrador', 'listo', 'en-ejecución', 'auditoría', 'aprobación', 'terminada'))",
      /CONTRATO 3\/4: entró una fila inválida \(estado fuera de la lista\)/,
    ],
    ["modo de office_tasks", "check (modo in ('solo', 'equipo'))", /CONTRATO 3\/4: entró una fila inválida \(modo fuera de la lista\)/],
    ["prioridad de event_inbox", "check (prioridad in (3, 2, 1))", /CONTRATO 3\/4: entró una fila inválida \(prioridad 0\)/],
    [
      "estado de event_inbox",
      "check (estado in ('nuevo', 'triaje', 'convertido', 'descartado'))",
      /CONTRATO 3\/4: entró una fila inválida \(estado de bandeja\)/,
    ],
    [
      "payload_ref como referencia",
      "check (payload_ref is null or payload_ref ~ '^[a-z][a-z0-9_-]{0,31}:[^[:space:]]{1,255}$')",
      /CONTRATO 3\/4: entró una fila inválida \(mensaje completo\)/,
    ],
  ])("mutante: sin el CHECK de %s, el contrato lo detecta", async (_n, check, error) => {
    expect(await run(inline(CONTRACT, { migracion: mutar(check, "check (true)") }))).toMatch(error);
  }, 60_000);

  it("mutante: sin el índice de task_id, el postflight no termina", async () => {
    const migracion = mutar(
      "create index if not exists task_events_task_id_idx\n  on public.task_events (task_id, ts);",
      "",
    );
    expect(await run(inline(CONTRACT, { migracion }))).toMatch(/falta el índice de task_events\.task_id/);
  }, 60_000);

  it("mutante: clave_dedupe con un índice no único, entra el duplicado (AC-4)", async () => {
    // Un índice común en lugar de la restricción única: el contrato 5 sigue viendo un índice, no la unicidad.
    const migracion = (sql: string) =>
      mutar(
        "raise exception '0541 postflight: event_inbox.clave_dedupe no es única (AC-4)';",
        "null;",
      )(
        mutar(
          "  constraint event_inbox_clave_dedupe_unica\n    unique (clave_dedupe),\n",
          "",
        )(sql),
      ) + "\ncreate index if not exists event_inbox_clave_dedupe_comun on public.event_inbox (clave_dedupe);\n";
    expect(await run(inline(CONTRACT, { migracion }))).toMatch(/CONTRATO 5: entró una clave_dedupe repetida/);
    // Con el postflight entero, la migración misma no termina.
    const conPostflight = mutar("  constraint event_inbox_clave_dedupe_unica\n    unique (clave_dedupe),\n", "");
    expect(await run(inline(CONTRACT, { migracion: conPostflight }))).toMatch(
      /event_inbox\.clave_dedupe no es única/,
    );
  }, 60_000);

  it("mutante: la versión anterior aplicada (índice no único), el preflight para", async () => {
    const vieja = (sql: string) =>
      `${sql}\ncreate index if not exists event_inbox_clave_dedupe_idx on public.event_inbox (clave_dedupe, ts);\n`;
    // El primer \ir deja el índice viejo; el segundo (aplicar otra vez) tiene que parar en el preflight.
    expect(await run(inline(CONTRACT, { migracion: vieja }))).toMatch(
      /está aplicada la versión anterior a la revisión de la #572/,
    );
  }, 60_000);

  it("mutante: la oficina nace despausada, el contrato lo detecta", async () => {
    const migracion = mutar("select true, 'La oficina nace pausada", "select false, 'La oficina nace pausada");
    expect(await run(inline(CONTRACT, { migracion }))).toMatch(/CONTRATO 6: la primera subida no nació pausada/);
  }, 60_000);

  it("mutante: sin filas, office_esta_pausada() responde falso, el contrato lo detecta", async () => {
    const migracion = mutar("limit 1),\n    true\n  );", "limit 1),\n    false\n  );");
    expect(await run(inline(CONTRACT, { migracion }))).toMatch(
      /CONTRATO 6: sin filas, office_esta_pausada\(\) no falló cerrado/,
    );
  }, 60_000);

  it.each<[string, string, string]>([
    [
      "office_solo_insertar()",
      "language plpgsql\nset search_path = ''\nas $function$\ndeclare\n  v_dueno name;",
      "language plpgsql\nas $function$\ndeclare\n  v_dueno name;",
    ],
    ["office_esta_pausada()", "stable\nset search_path = ''", "stable"],
    [
      "office_cambiar_pausa(boolean, text)",
      "security definer\nset search_path = ''",
      "security definer",
    ],
  ])("mutante: %s sin search_path vacío, el postflight no termina", async (firma, buscar, poner) => {
    expect(await run(inline(CONTRACT, { migracion: mutar(buscar, poner) }))).toMatch(
      new RegExp(`public\\.${firma.replace(/[()]/g, "\\$&")} sin search_path vacío`),
    );
  }, 60_000);

  // El postflight revisa columna por columna; sin esa revisión, el contrato 8 tiene que verlo solo.
  const sinRevisionDeColumnas = mutar(
    "if pg_catalog.has_column_privilege('service_role', 'public.' || v_col.tabla",
    "if false and pg_catalog.has_column_privilege('service_role', 'public.' || v_col.tabla",
  );

  it.each<[string, string, string, RegExp, RegExp]>([
    [
      "UPDATE de toda event_inbox",
      "grant update (prioridad, estado)\n  on public.event_inbox to service_role;",
      "grant update on public.event_inbox to service_role;",
      /service_role tiene UPDATE sobre event_inbox\.id/,
      /CONTRATO 8: service_role pudo: update public\.event_inbox set clave_dedupe/,
    ],
    [
      "INSERT de toda task_events (hora propia)",
      "grant insert (task_id, run_id, tipo, actor, resumen, costo_usd, modelo_usado)\n  on public.task_events to service_role;",
      "grant insert on public.task_events to service_role;",
      /service_role tiene INSERT sobre task_events\.id/,
      /CONTRATO 8: service_role pudo: insert into public\.task_events \(id,/,
    ],
    [
      "UPDATE de toda office_tasks",
      "grant update (titulo, estado, modo, ejecucion, asignado_a, depto, prioridad, entidad_ref, meta_datos)\n  on public.office_tasks to service_role;",
      "grant update on public.office_tasks to service_role;",
      /service_role tiene UPDATE sobre office_tasks\.id/,
      /CONTRATO 8: service_role pudo: update public\.office_tasks set id/,
    ],
  ])("mutante: grant de %s en vez de por columna, lo detectan el postflight y el contrato", async (_n, buscar, poner, postflight, contrato) => {
    const migracion = mutar(buscar, poner);
    expect(await run(inline(CONTRACT, { migracion }))).toMatch(postflight);
    expect(await run(inline(CONTRACT, { migracion: (sql) => sinRevisionDeColumnas(migracion(sql)) }))).toMatch(contrato);
  }, 60_000);

  it("mutante: office_cambiar_pausa sin exigir administrador, un no administrador la cambia", async () => {
    const migracion = mutar(
      "if v_uid is null or not coalesce(public.is_platform_admin(), false) then",
      "if false then",
    );
    expect(await run(inline(CONTRACT, { migracion }))).toMatch(
      /CONTRATO 6: authenticated \(uid 00000000-0000-4000-8000-00000000b002\) cambió la bandera/,
    );
  }, 60_000);

  it("mutante: con SELECT para authenticated, el contrato lo detecta", async () => {
    const migracion = (sql: string) => `${sql}\ngrant select on public.office_tasks to authenticated;\n`;
    expect(await run(inline(CONTRACT, { migracion }))).toMatch(/CONTRATO 7: authenticated pudo ejecutar: select/);
  }, 60_000);
});

// El desarme (supabase/desarmes/0541_desarme.sql) solo: quita lo de la 0541 y nada más, y repetirlo no falla.
describe("0541 · desarme (PGlite)", () => {
  const FIXTURE = `
    do $r$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
    end $r$;
    create schema if not exists auth;
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    create table public.platform_admins (user_id uuid primary key);
    create function public.is_platform_admin() returns boolean language sql stable as $$ select false $$;
    insert into public.platform_admins values ('00000000-0000-4000-8000-00000000a001');
  `;
  const MIG = readFileSync(resolve(ROOT, "supabase/migrations", MIGRATION), "utf8");
  const DES = readFileSync(resolve(ROOT, "supabase/desarmes", DESARME), "utf8");
  const QUEDA = `
    select (to_regclass('public.office_tasks') is not null)::int
         + (to_regclass('public.task_events') is not null)::int
         + (to_regclass('public.event_inbox') is not null)::int
         + (to_regclass('public.office_paused') is not null)::int
         + (to_regprocedure('public.office_solo_insertar()') is not null)::int
         + (to_regprocedure('public.office_esta_pausada()') is not null)::int
         + (to_regprocedure('public.office_cambiar_pausa(boolean, text)') is not null)::int
         as objetos,
         (select count(*) from public.platform_admins)::int as admins
  `;

  async function medir(sql: string) {
    const db = await pgliteLimpio();
    try {
      await db.exec(`begin; ${sql}`);
      const { rows } = await db.query<{ objetos: number; admins: number }>(QUEDA);
      await db.exec("rollback");
      return rows[0];
    } finally {
      await db.close();
    }
  }

  it("control: con la 0541 sola quedan sus siete objetos", async () => {
    expect(await medir(`${FIXTURE}\n${MIG}`)).toEqual({ objetos: 7, admins: 1 });
  }, 60_000);

  it("el desarme quita los siete y no toca platform_admins; repetirlo no falla", async () => {
    expect(await medir(`${FIXTURE}\n${MIG}\n${DES}\n${DES}`)).toEqual({ objetos: 0, admins: 1 });
  }, 60_000);

  it("el desarme funciona con filas en la bitácora (DROP no dispara el solo agregar)", async () => {
    const conFilas = `${FIXTURE}\n${MIG}
      insert into public.office_tasks (id, titulo) values ('00000000-0000-4000-8000-0000000000c1', 'x');
      insert into public.task_events (task_id, tipo, actor) values ('00000000-0000-4000-8000-0000000000c1', 'x', 'y');
      ${DES}`;
    expect(await medir(conFilas)).toEqual({ objetos: 0, admins: 1 });
  }, 60_000);
});

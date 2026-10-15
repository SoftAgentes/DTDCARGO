// @vitest-environment node
/**
 * SDD-0526 · La migración 0479 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0479_portal_bandeja_avisos.test.sql` aplica las
 * migraciones REALES de la cola (0247 y 0389) sobre un esquema mínimo, siembra un
 * fixture infeliz (cada condición de la RPC tiene una fila que sólo ella excluye)
 * y después aplica 0479. PGlite corre ese mismo contrato, con los `.sql` reales
 * inlineados, así el CI de calidad —que no tiene Docker— lo ejecuta igual.
 *
 * CONTROL ROJO: sin 0479 el contrato falla.
 * MUTANTES: cada condición rota rompe el contrato en SU aserción, no en otra.
 *
 * PGlite tiene UNA conexión: el `for share of cu` de la RPC de visto (que
 * serializa con una revocación concurrente) no se puede ejercer acá. Queda
 * razonado en la cabecera de la migración y en el handoff; su mutante sobrevive
 * a esta batería y se declara allí como hueco conocido, no como prueba.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const TESTS = resolve(ROOT, "supabase/tests");
const MIGRATIONS = resolve(ROOT, "supabase/migrations");
const M0479 = "0479_portal_bandeja_avisos.sql";
const FILE_0479 = readFileSync(resolve(MIGRATIONS, M0479), "utf8");
const CONTRACT_NAME = "0479_portal_bandeja_avisos.test.sql";
const CONTRACT = resolve(TESTS, CONTRACT_NAME);
const CONTRACT_TEXT = readFileSync(CONTRACT, "utf8");
const SLOW = 240_000;

type Vars = Record<string, string>;
type Options = { vars?: Vars; replace?: Record<string, string> };

const TRUE = /^(t|tr|tru|true|on|y|ye|yes|1)$/i;
const FALSE = /^(f|fa|fal|fals|false|of|off|n|no|0)$/i;

/**
 * psql → SQL plano con las metaórdenes de estos contratos: \set, \unset,
 * \if :{?v} / :v, \else, \endif, \ir y \quit. `replace` sustituye el texto de
 * un archivo (un mutante). Mismo expansor que el contrato de 0466.
 */
function psql(file: string, { vars = {}, replace = {} }: Options = {}): string {
  const state: Vars = { ...vars };
  const out: string[] = [];
  let quit = false;
  const value = (token: string) => (token.startsWith(":") ? state[token.slice(1)] : token);
  const source = (path: string) => {
    const name = Object.keys(replace).find((key) => path.endsWith(key));
    return name ? replace[name] : readFileSync(path, "utf8");
  };
  function run(path: string) {
    const stack: { active: boolean; taken: boolean }[] = [];
    const active = () => stack.every((frame) => frame.active);
    for (const line of source(path).split(/\r?\n/)) {
      if (quit) return;
      const meta = line.match(/^\\(\w+)\s*(.*)$/);
      if (!meta) {
        if (active()) out.push(line);
        continue;
      }
      const [, command, rest] = meta;
      if (command === "if") {
        let taken = false;
        if (active()) {
          const defined = rest.match(/^:\{\?(\w+)\}$/);
          const text = defined ? String(defined[1] in state) : String(value(rest.trim()));
          if (!TRUE.test(text) && !FALSE.test(text)) throw new Error("\\if no booleano: " + rest);
          taken = TRUE.test(text);
        }
        stack.push({ active: taken, taken });
      } else if (command === "else") {
        const frame = stack[stack.length - 1];
        frame.active = !frame.taken;
      } else if (command === "endif") {
        stack.pop();
      } else if (!active()) {
        continue;
      } else if (command === "set") {
        const [name, ...values] = rest.trim().split(/\s+/);
        state[name] = values.map(value).join("");
      } else if (command === "unset") {
        delete state[rest.trim()];
      } else if (command === "ir") {
        run(resolve(dirname(path), rest.trim()));
      } else if (command === "quit") {
        quit = true;
        return;
      } else {
        throw new Error("metaorden psql no soportada: \\" + command);
      }
    }
    if (stack.length > 0) throw new Error("\\if sin cerrar en " + path);
  }
  run(file);
  return out.join("\n");
}

async function run(sql: string): Promise<{ error: string | null; notices: string[] }> {
  const db = new PGlite();
  const notices: string[] = [];
  try {
    await db.exec(sql, { onNotice: (notice) => notices.push(notice.message ?? "") });
    return { error: null, notices };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), notices };
  } finally {
    await db.close();
  }
}

/** Un mutante de la migración: el fragmento tiene que aparecer UNA sola vez. */
function mutant(from: string, to: string): string {
  expect(FILE_0479.split(from)).toHaveLength(2);
  return FILE_0479.replace(from, to);
}

/** El contrato con una línea agregada justo antes de aplicar 0479. */
function contractBefore0479(sql: string): string {
  const anchor = "\\if :apply_0479\n\\ir ../migrations/0479_portal_bandeja_avisos.sql";
  const text = CONTRACT_TEXT.replace(/\r\n/g, "\n");
  expect(text.split(anchor)).toHaveLength(2);
  return text.replace(anchor, sql + "\n" + anchor);
}

describe("0479 · bandeja de avisos del Portal (PGlite)", () => {
  it("el contrato completo pasa sobre la cola real 0247 → 0389 → 0479", async () => {
    const { error, notices } = await run(psql(CONTRACT));
    expect(error).toBeNull();
    expect(notices.join("\n")).toMatch(/TEST 0479 GREEN: 61 aserciones/);
  }, SLOW);

  it("mientras no se aplique: cabecera, espera en el baseline y degradación declarada", () => {
    const baseline = JSON.parse(readFileSync(resolve(ROOT, "supabase/migrations-baseline.json"), "utf8")) as {
      cutoff: number;
      pendingBelowCutoff: Record<string, string>;
    };
    const declaraciones = JSON.parse(
      readFileSync(resolve(ROOT, "supabase/pending-migration-symbol-declarations.json"), "utf8"),
    ) as { degradations: { migration: string; symbols: { name: string }[] }[] };

    expect(FILE_0479).toContain(
      "⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en\n--    supabase/migrations-baseline.json › pendingBelowCutoff.",
    );
    expect(baseline.cutoff).toBe(238);
    const espera = baseline.pendingBelowCutoff["0479_portal_bandeja_avisos"];
    expect(espera).toMatch(/^PENDIENTE DE APLICAR — SDD-0526\./);
    expect(espera).toContain("MIGRATE-FIRST");
    expect(espera).toContain("name exacto 0479_portal_bandeja_avisos");
    const grupo = declaraciones.degradations.find((d) => d.migration === "0479_portal_bandeja_avisos");
    expect(grupo?.symbols.map((s) => s.name).sort()).toEqual([
      "portal_list_my_notifications",
      "portal_mark_my_notifications_seen",
    ]);
  });

  it("control rojo: sin 0479 el contrato falla", async () => {
    const { error } = await run(psql(CONTRACT, { vars: { apply_0479: "false" } }));
    expect(error).toMatch(/TEST 0479: la RPC de la bandeja no existe/);
  }, SLOW);

  it.each<[string, string, RegExp]>([
    [
      "sin el CHECK de una sola ancla de 0389",
      "alter table public.client_notification_schedule drop constraint client_notif_sched_una_ancla;",
      /0479 requiere el CHECK client_notif_sched_una_ancla de 0389, validado/,
    ],
    [
      "con una policy de la API sobre la cola",
      "create policy cola_abierta on public.client_notification_schedule for select to authenticated using (true);",
      /0479 abortada: la cola de avisos tiene una policy para la API/,
    ],
    [
      "con FORCE RLS en los vínculos",
      "alter table public.client_users force row level security;",
      /0479 requiere tabla con RLS y sin FORCE: public\.client_users/,
    ],
    [
      "con la tabla del visto ya creada",
      "create table public.portal_notification_seen (client_user_id uuid primary key);",
      /0479 ya aplicada o a medias/,
    ],
  ])("preflight %s: aborta sin crear nada", async (_label, sql, expected) => {
    const contract = contractBefore0479(sql);
    const { error } = await run(psql(CONTRACT, { replace: { [CONTRACT_NAME]: contract } }));
    expect(error).toMatch(expected);
  }, SLOW);

  it("reaplicar 0479 aborta en el preflight", async () => {
    const twice = FILE_0479 + "\n" + FILE_0479;
    const { error } = await run(psql(CONTRACT, { replace: { [M0479]: twice } }));
    expect(error).toMatch(/0479 ya aplicada o a medias/);
  }, SLOW);

  it("locks: sólo los que declara la cabecera sobre las tablas que ya existen", async () => {
    const fixture = psql(CONTRACT, { vars: { en_transaccion: "false", solo_fixture: "true" } });
    const db = new PGlite();
    try {
      await db.exec(fixture);
      await db.exec("begin;\n" + FILE_0479);
      const { rows } = await db.query<{ relation: string; mode: string }>(
        `select c.relname as relation, l.mode
           from pg_locks as l
           join pg_class as c on c.oid = l.relation
           join pg_namespace as n on n.oid = c.relnamespace
          where l.locktype = 'relation' and l.pid = pg_backend_pid()
            and n.nspname = 'public' and c.relkind in ('r', 'p')
          order by 1, 2`,
      );
      await db.exec("rollback;");
      // La tabla nueva nace en la transacción: nadie más la ve hasta el COMMIT.
      const nueva = rows.filter((r) => r.relation === "portal_notification_seen").map((r) => r.mode);
      expect(nueva).toContain("AccessExclusiveLock");
      const locks = rows
        .filter((r) => r.relation !== "portal_notification_seen")
        .map((r) => `${r.relation}:${r.mode}`);
      expect(locks).toEqual([
        "client_notification_rules:AccessShareLock",
        "client_notification_schedule:AccessShareLock",
        "client_notification_schedule:ShareLock",
        "client_users:AccessShareLock",
        "client_users:ShareRowExclusiveLock",
        "clients:AccessShareLock",
        "prealertas:AccessShareLock",
        "shipments:AccessShareLock",
      ]);
    } finally {
      await db.close();
    }
  }, SLOW);

  it.each<[string, string, string, RegExp]>([
    // Principal
    ["vínculo revocado", "    where cu.auth_user_id = (select auth.uid())\n      and cu.status = 'active'\n  ),", "    where cu.auth_user_id = (select auth.uid())\n  ),",
      /TEST 0479: un vínculo revocado vio avisos/],
    ["cliente eliminado", "     and c.tenant_id = cu.tenant_id\n     and c.deleted_at is null\n    where cu.auth_user_id = (select auth.uid())\n      and cu.status = 'active'\n  ),",
      "     and c.tenant_id = cu.tenant_id\n    where cu.auth_user_id = (select auth.uid())\n      and cu.status = 'active'\n  ),",
      /TEST 0479: un cliente eliminado vio avisos/],
    ["vínculo de otro tenant", "      on c.id = cu.client_id\n     and c.tenant_id = cu.tenant_id\n     and c.deleted_at is null\n    where cu.auth_user_id = (select auth.uid())\n      and cu.status = 'active'\n  ),",
      "      on c.id = cu.client_id\n     and c.deleted_at is null\n    where cu.auth_user_id = (select auth.uid())\n      and cu.status = 'active'\n  ),",
      /TEST 0479: un vínculo de otro tenant vio los avisos del cliente/],
    ["dos vínculos activos", "    where (select pg_catalog.count(*) from links) = 1\n", "",
      /TEST 0479: una persona con dos vínculos activos vio avisos/],
    // Estado y fecha
    ["cualquier estado", "   and n.status = 'sent'\n   and n.sent_at is not null\n", "   and n.sent_at is not null\n",
      /TEST 0479: entró un aviso que no está en sent/],
    ["sent sin fecha", "   and n.status = 'sent'\n   and n.sent_at is not null\n", "   and n.status = 'sent'\n",
      /TEST 0479: entró un aviso sent sin sent_at/],
    // Anclas vivas
    ["envío eliminado", "   and s.client_markbox = p.markbox\n   and s.deleted_at is null\n", "   and s.client_markbox = p.markbox\n",
      /TEST 0479: entró el aviso de un envío eliminado/],
    ["compra eliminada", "   and pa.client_markbox = p.markbox\n   and pa.deleted_at is null\n", "   and pa.client_markbox = p.markbox\n",
      /TEST 0479: entró el aviso de una compra eliminada/],
    ["sin exigir ancla", "  where (s.id is not null or pa.id is not null)\n    and (p_prealerta_id", "  where true\n    and (p_prealerta_id",
      /TEST 0479: entró el aviso de un envío eliminado/],
    // Frontera de tenant y Shipping Mark
    ["cola de otro tenant", "    on n.tenant_id = p.tenant_id\n   and n.client_markbox = p.markbox\n", "    on true\n   and n.client_markbox = p.markbox\n",
      /TEST 0479: A vio una fila de la cola de otro tenant/],
    ["envío de otro tenant", "    on s.id = n.shipment_id\n   and s.tenant_id = p.tenant_id\n", "    on s.id = n.shipment_id\n",
      /TEST 0479: A vio un aviso colgado de un envío de otro tenant/],
    ["envío de otro cliente", "   and s.client_markbox = p.markbox\n   and s.deleted_at is null\n", "   and s.deleted_at is null\n",
      /TEST 0479: A vio un aviso colgado del envío de otro cliente/],
    ["compra de otro tenant", "    on pa.id = n.prealerta_id\n   and pa.tenant_id = p.tenant_id\n", "    on pa.id = n.prealerta_id\n",
      /TEST 0479: A vio un aviso colgado de una compra de otro tenant/],
    ["compra de otro cliente", "   and pa.client_markbox = p.markbox\n   and pa.deleted_at is null\n", "   and pa.deleted_at is null\n",
      /TEST 0479: A vio un aviso colgado de la compra de otro cliente/],
    ["Shipping Mark de la cola", "    on n.tenant_id = p.tenant_id\n   and n.client_markbox = p.markbox\n", "    on n.tenant_id = p.tenant_id\n",
      /TEST 0479: A2 vio una fila de la cola con el Shipping Mark de A/],
    // Visible en el portal
    ["precedencia invertida", "        order by (r.client_id is not null) desc\n", "        order by (r.client_id is not null) asc\n",
      /TEST 0479: el override visible del cliente no le ganó al default oculto/],
    ["sin respetar la regla", "    and not exists (select 1 from hidden as h where h.trigger_event = n.trigger_event)\n", "",
      /TEST 0479: el override oculto del cliente no le ganó al default visible/],
    ["overrides de otro cliente", "     and (r.client_id is null or r.client_id = p.client_id)\n", "\n",
      /TEST 0479: el override de un cliente ocultó el aviso de otro/],
    ["reglas de otro tenant", "    join public.client_notification_rules as r\n      on r.tenant_id = p.tenant_id\n", "    join public.client_notification_rules as r\n      on true\n",
      /TEST 0479: sin regla propia el aviso no se vio, o lo ocultó la regla de otro tenant/],
    // Compra y orden
    ["sin filtro por compra", "    and (p_prealerta_id is null or n.prealerta_id = p_prealerta_id)\n", "",
      /TEST 0479: el filtro por compra no acotó a esa compra/],
    ["orden invertido", "  order by n.sent_at desc, n.id desc\n", "  order by n.sent_at asc, n.id desc\n",
      /TEST 0479: la bandeja de A no es la esperada/],
    ["empate sin desempate estable", "  order by n.sent_at desc, n.id desc\n", "  order by n.sent_at desc, n.id asc\n",
      /TEST 0479: la bandeja de A no es la esperada/],
    ["título vacío como texto", "    nullif(pg_catalog.btrim(n.payload ->> 'title'), ''),\n", "    n.payload ->> 'title',\n",
      /TEST 0479: título o texto vacío no vuelven como null/],
    // Tope
    ["tope de 100", "  limit least(greatest(coalesce(p_limit, 20), 1), 50)\n", "  limit least(greatest(coalesce(p_limit, 20), 1), 100)\n",
      /TEST 0479: el tope no es 50/],
    ["sin mínimo", "  limit least(greatest(coalesce(p_limit, 20), 1), 50)\n", "  limit least(coalesce(p_limit, 20), 50)\n",
      /TEST 0479: el mínimo no es 1/],
    ["límite nulo", "  limit least(greatest(coalesce(p_limit, 20), 1), 50)\n", "  limit least(greatest(p_limit, 1), 50)\n",
      /TEST 0479: con límite nulo no devuelve 20/],
    // No leídos
    ["visto inclusivo", "    n.sent_at > coalesce(\n", "    n.sent_at >= coalesce(\n",
      /TEST 0479: visto hasta el aviso de las 17:00 deja sin leer sólo el posterior/],
    ["visto de otro vínculo", "       where seen.client_user_id = p.client_user_id),\n", "       limit 1),\n",
      /TEST 0479: el visto de A cambió los no leídos de A2/],
    ["el visto retrocede", "    set last_seen_at = greatest(seen.last_seen_at, excluded.last_seen_at),\n", "    set last_seen_at = excluded.last_seen_at,\n",
      /TEST 0479: el visto retrocedió/],
    ["visto futuro", "  values (v_links[1], least(p_hasta, pg_catalog.now()), pg_catalog.now())\n", "  values (v_links[1], p_hasta, pg_catalog.now())\n",
      /TEST 0479: el visto futuro no se recortó a now\(\)/],
    ["marcar con vínculo revocado", "    where cu.auth_user_id = (select auth.uid())\n      and cu.status = 'active'\n    for share of cu\n", "    where cu.auth_user_id = (select auth.uid())\n    for share of cu\n",
      /TEST 0479: marcar con vínculo revocado: se esperaba 42501 sin escribir/],
    ["marcar con dos vínculos", "  if coalesce(pg_catalog.array_length(v_links, 1), 0) <> 1 then\n", "  if coalesce(pg_catalog.array_length(v_links, 1), 0) = 0 then\n",
      /TEST 0479: marcar con dos vínculos: se esperaba 42501 sin escribir/],
    ["marcar sin fecha", "  if p_hasta is null then\n", "  if false then\n",
      /TEST 0479: marcar sin fecha: se esperaba 22004 sin escribir/],
    // El visto no sobrevive al vínculo
    ["revocar no borra", "  delete from public.portal_notification_seen where client_user_id = old.id;\n", "  null;\n",
      /TEST 0479: revocar el vínculo no borró su visto/],
    ["cambio de persona ignorado", "    new.status is distinct from old.status\n    or new.auth_user_id is distinct from old.auth_user_id\n", "    new.status is distinct from old.status\n",
      /TEST 0479: cambiar la persona del vínculo no borró el visto/],
    ["sólo al dejar de estar activo", "    new.status is distinct from old.status\n    or new.auth_user_id is distinct from old.auth_user_id\n",
      "    old.status = 'active' and (new.status is distinct from 'active' or new.auth_user_id is distinct from old.auth_user_id)\n",
      /TEST 0479: reactivar el vínculo heredó un visto viejo/],
    // Permisos
    ["la API lee la tabla", "revoke all on table public.portal_notification_seen\n  from public, anon, authenticated, service_role;\n",
      "grant select on table public.portal_notification_seen to authenticated;\n",
      /0479 postflight: portal_notification_seen quedó con privilegios de API/],
    ["anon ejecuta la bandeja", "grant execute on function public.portal_list_my_notifications(uuid, integer) to authenticated;\n",
      "grant execute on function public.portal_list_my_notifications(uuid, integer) to authenticated, anon;\n",
      /0479 postflight: ACL inesperada en public\.portal_list_my_notifications/],
    ["bandeja sin SECURITY DEFINER", "language sql\nstable\nsecurity definer\n", "language sql\nstable\n",
      /0479 postflight: public\.portal_list_my_notifications\(uuid,integer\) no es SECURITY DEFINER/],
  ])("mutante %s → rojo en su aserción", async (_label, from, to, expected) => {
    const sql = psql(CONTRACT, { replace: { [M0479]: mutant(from, to) } });
    const { error } = await run(sql);
    expect(error).toMatch(expected);
  }, SLOW);

});

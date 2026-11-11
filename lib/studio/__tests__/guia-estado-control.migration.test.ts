// @vitest-environment node
/**
 * SDD-0589 · paso 9.3 · Los SQL de control de la 0517, corridos de verdad sobre PostgreSQL embebido.
 *
 * `scripts/qa/0517-control-previo.sql` va antes del apply en producción y
 * `scripts/qa/0517-control-posterior.sql`, después. Aquí corren sobre una base mínima con lo que la
 * 0517 da por sentado (como su contrato) y la 0517 REAL. Cada comprobación sale `si` o `no`.
 *
 * CONTROL: sin la 0517 el previo da todo `si`; con la 0517 real, el posterior da todo `si` y el previo
 * dice que ya no se puede aplicar.
 * MUTANTES: cada uno es una 0517 (o un estado) con un defecto y tiene que tumbar su comprobación,
 * y solo esa: si el control no la ve, el SQL de control no sirve.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const FILE_0517 = read(resolve(ROOT, "supabase/migrations/0517_user_guide_prefs.sql"));
const sinMeta = (sql: string) => sql.split("\n").filter((line) => !line.startsWith("\\")).join("\n");
const PREVIO = sinMeta(read(resolve(ROOT, "scripts/qa/0517-control-previo.sql")));
const POSTERIOR = sinMeta(read(resolve(ROOT, "scripts/qa/0517-control-posterior.sql")));
const SLOW = 120_000;

/** Lo mínimo que la 0517 da por sentado, como en su contrato, más el ledger del servidor propio. */
const BASE = `
do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$roles$;
create schema auth;
create function auth.uid() returns uuid language sql stable set search_path = ''
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table auth.users (id uuid primary key);
create table public.tenants (id uuid primary key, slug text);
create table public.user_tenants (user_id uuid not null, tenant_id uuid not null, role text not null, disabled_at timestamptz);
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;
create schema supabase_migrations;
create table supabase_migrations.schema_migrations (version text primary key, name text);
insert into supabase_migrations.schema_migrations values ('20261106000000', '0513_crm_entrada_leads');
`;
const LEDGER_0517 = `insert into supabase_migrations.schema_migrations values ('20261107000000', '0517_user_guide_prefs');`;

type Resultado = Record<string, string>;

/** Corre la base, lo que se pida antes y el SQL de control; devuelve comprobacion → si/no. */
async function control(sql: string, antes: string): Promise<Resultado> {
  const db = await pgliteLimpio();
  try {
    await db.exec(BASE);
    if (antes) await db.exec(antes);
    const results = await db.exec(sql);
    const rows = results.flatMap((r) => r.rows as Record<string, unknown>[]);
    return Object.fromEntries(
      rows.filter((row) => "comprobacion" in row).map((row) => [String(row.comprobacion), String(row.ok)]),
    );
  } finally {
    await db.close();
  }
}

/** Un único cambio sobre la 0517; falla si lo que se cambia no aparece una sola vez. */
function once(from: string, to: string, text = FILE_0517): string {
  expect(text.split(from), `«${from.slice(0, 60)}…» debe aparecer una sola vez`).toHaveLength(2);
  return text.split(from).join(to);
}

const noes = (r: Resultado) => Object.keys(r).filter((k) => r[k] !== "si").sort();

describe("SDD-0589 · los SQL de control de la 0517 (PGlite)", () => {
  it("control: el previo da todo «si» sin la 0517", { timeout: SLOW }, async () => {
    const r = await control(PREVIO, "");
    expect(Object.keys(r)).toHaveLength(10);
    expect(noes(r)).toEqual([]);
  });

  it("control: con la 0517 real y su fila del ledger, el posterior da todo «si»", { timeout: SLOW }, async () => {
    const r = await control(POSTERIOR, FILE_0517 + "\n" + LEDGER_0517);
    expect(Object.keys(r)).toHaveLength(15);
    expect(noes(r)).toEqual([]);
  });

  it("con la 0517 ya aplicada, el previo dice que no se puede aplicar otra vez", { timeout: SLOW }, async () => {
    const r = await control(PREVIO, FILE_0517 + "\n" + LEDGER_0517);
    expect(noes(r)).toEqual(["ledger_sin_0517", "tabla_ausente"]);
  });

  it("mutante del previo: sin user_tenants.disabled_at cae solo esa comprobación", { timeout: SLOW }, async () => {
    const r = await control(PREVIO, "alter table public.user_tenants drop column disabled_at;");
    expect(noes(r)).toEqual(["user_tenants_disabled_at"]);
  });

  const mutantes: Array<[string, string, string]> = [
    ["sin RLS", once("alter table public.user_guide_prefs enable row level security;\n", ""), "rls_activa"],
    [
      "la policy sin el tenant activo",
      FILE_0517.split(" and ut.disabled_at is null").join(""),
      "policy_owner",
    ],
    [
      "anon con lectura",
      once(
        "grant all on public.user_guide_prefs to service_role;",
        "grant all on public.user_guide_prefs to service_role;\ngrant select on public.user_guide_prefs to anon;",
      ),
      "grants_anon_ninguno",
    ],
    [
      "authenticated con truncate",
      once(
        "grant select, insert, update, delete on public.user_guide_prefs to authenticated;",
        "grant select, insert, update, delete, truncate on public.user_guide_prefs to authenticated;",
      ),
      "grants_authenticated",
    ],
    [
      "el tenant sin cascada",
      once("references public.tenants(id) on delete cascade", "references public.tenants(id)"),
      "fk_tenants_cascada",
    ],
    [
      "el usuario sin cascada",
      once("references auth.users(id) on delete cascade", "references auth.users(id)"),
      "fk_users_cascada",
    ],
    ["sin el unique", once(",\n  unique (tenant_id, user_id)\n", "\n"), "unico_tenant_usuario"],
    [
      "sin el trigger",
      once(
        "create trigger user_guide_prefs_touch\n  before update on public.user_guide_prefs\n  for each row execute function public.touch_updated_at();\n",
        "",
      ),
      "trigger_touch",
    ],
    [
      "el check sin el tope de tamaño",
      once(" and pg_catalog.pg_column_size(state) <= 16384", ""),
      "check_state",
    ],
  ];
  for (const [nombre, migracion, cae] of mutantes) {
    it(`mutante: ${nombre} → cae ${cae} y nada más`, { timeout: SLOW }, async () => {
      const r = await control(POSTERIOR, migracion + "\n" + LEDGER_0517);
      expect(noes(r)).toEqual([cae]);
    });
  }

  it("mutante de estado: una fila en la tabla → cae filas", { timeout: SLOW }, async () => {
    const r = await control(
      POSTERIOR,
      FILE_0517 +
        "\n" +
        LEDGER_0517 +
        "\ninsert into public.tenants values ('00000000-0000-0000-0000-000000000001', 't');" +
        "\ninsert into auth.users values ('00000000-0000-0000-0000-000000000002');" +
        "\ninsert into public.user_guide_prefs (tenant_id, user_id) values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');",
    );
    expect(noes(r)).toEqual(["filas"]);
  });

  it("mutante de estado: dos filas 0517 en el ledger → cae ledger_una_fila", { timeout: SLOW }, async () => {
    const r = await control(
      POSTERIOR,
      FILE_0517 + "\n" + LEDGER_0517 +
        "\ninsert into supabase_migrations.schema_migrations values ('20261107000001', '0517_user_guide_prefs');",
    );
    expect(noes(r)).toEqual(["ledger_una_fila"]);
  });
});

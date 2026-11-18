// @vitest-environment node
/**
 * SDD-0650 F2 · La migración 0554 (lista de uniones chat ↔ ficha, D4) corrida de verdad sobre PostgreSQL
 * embebido, con el contrato `supabase/tests/0554_…test.sql` y el `.sql` real inlineado (dos veces: idempotencia).
 *
 * CONTROL ROJO: sin la 0554 el contrato falla. MUTANTES (16): cada uno quita una barrera de la 0554 (módulo, tenant,
 * actor, ficha borrada, no pisar, autor, disparador, privilegios) y el contrato tiene que caer en la aserción que la
 * cuida. Además: una tabla de una versión anterior con otra llave aborta en el preflight. El mismo
 * contrato corre en Postgres 17 con Docker en «Contratos SQL».
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0554_chatwoot_contact_links.test.sql");
const M0554 = "0554_chatwoot_contact_links.sql";
const leer = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

type Transform = (sql: string) => string;

function inline(opts: { sin0554?: boolean; migracion?: Transform } = {}): string {
  return readFileSync(CONTRACT, "utf8")
    .split(/\r?\n/)
    .map((line) => {
      const include = line.match(/^\\ir\s+(\S+)/);
      if (include) {
        const nombre = include[1].replace("../migrations/", "");
        if (nombre !== M0554) throw new Error(`\\ir inesperado en el contrato: ${include[1]}`);
        if (opts.sin0554) return "";
        const leida = leer(`supabase/migrations/${nombre}`);
        return opts.migracion ? opts.migracion(leida) : leida;
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

function mutar(buscar: string, poner: string): Transform {
  return (sql: string) => {
    const mutado = sql.replace(buscar, poner);
    if (mutado === sql) throw new Error(`el mutante no encontró: ${buscar}`);
    return mutado;
  };
}

describe("0554 · uniones chat ↔ ficha (PGlite)", () => {
  it("el contrato completo pasa con la migración real aplicada dos veces", async () => {
    expect(await run(inline())).toBeNull();
  }, 120_000);

  it("CONTROL ROJO: sin la 0554 el contrato falla", async () => {
    expect(await run(inline({ sin0554: true }))).not.toBeNull();
  }, 120_000);

  const mutantes: Array<[string, Transform, string]> = [
    [
      "la lectura no pide la Bandeja",
      mutar(
        "  using (tenant_id = (select public.get_user_tenant_id())\n         and (select public.user_has_module('bandeja', false)));",
        "  using (tenant_id = (select public.get_user_tenant_id()));",
      ),
      "3d",
    ],
    [
      "la lectura no filtra el tenant",
      mutar(
        "  using (tenant_id = (select public.get_user_tenant_id())\n         and (select public.user_has_module('bandeja', false)));",
        "  using ((select public.user_has_module('bandeja', false)));",
      ),
      "3a",
    ],
    [
      "el actor no tiene que editar la Bandeja",
      mutar("\n            and (select public.user_has_module('bandeja', true));", ";"),
      "4b",
    ],
    [
      "no se comprueba la membresía del actor en ESE tenant",
      (sql) =>
        mutar("            and (select public.get_user_tenant_id()) = p_tenant_id\n", "")(
          mutar(
            "  if not exists (\n    select 1 from public.user_tenants ut\n    where ut.user_id = p_actor_user_id and ut.tenant_id = p_tenant_id and ut.disabled_at is null\n  ) then\n    return false;\n  end if;\n",
            "",
          )(sql),
        ),
      "4e",
    ],
    [
      "la comprobación del actor no devuelve request.jwt.claim.sub",
      mutar(
        "  perform pg_catalog.set_config('request.jwt.claim.sub', coalesce(v_antes, ''), true);\n  return coalesce(v_ok, false);",
        "  return coalesce(v_ok, false);",
      ),
      "4p",
    ],
    [
      "la unión manual acepta fichas de otro tenant",
      mutar(
        "    where c.id = p_client_id and c.tenant_id = p_tenant_id and c.deleted_at is null\n  ) then\n    raise exception 'chatwoot_unir_contacto_manual",
        "    where c.id = p_client_id and c.deleted_at is null\n  ) then\n    raise exception 'chatwoot_unir_contacto_manual",
      ),
      "4e2",
    ],
    [
      "unir a mano abierta a las sesiones (llamada directa por la API)",
      mutar(
        "grant execute on function public.chatwoot_unir_contacto_manual(uuid, uuid, uuid, bigint, text) to service_role;",
        "grant execute on function public.chatwoot_unir_contacto_manual(uuid, uuid, uuid, bigint, text) to service_role, authenticated;",
      ),
      "0554: unir o quitar a mano quedó abierta",
    ],
    [
      "la unión automática acepta fichas de otro tenant o borradas",
      mutar(
        "      where c.id = v_client and c.tenant_id = p_tenant_id and c.deleted_at is null",
        "      where c.id = v_client",
      ),
      "2a",
    ],
    [
      "la unión automática pisa la existente",
      mutar(
        "    on conflict (chatwoot_contact_id) do nothing;",
        "    on conflict (chatwoot_contact_id) do update set client_id = excluded.client_id, origen = excluded.origen;",
      ),
      "2",
    ],
    [
      "el mismo contacto en dos tenants (llave por tenant, como antes de la revisión)",
      // El preflight de la llave también se ajusta: si no, lo que cae es la segunda aplicación, no la aserción.
      (sql) =>
        mutar("     ), '') <> 'chatwoot_contact_id' then", "     ), '') <> 'chatwoot_contact_id,tenant_id' then")(
          mutar("    on conflict (chatwoot_contact_id) do nothing;", "    on conflict (tenant_id, chatwoot_contact_id) do nothing;")(
            mutar("  constraint chatwoot_contact_links_pkey primary key (chatwoot_contact_id),", "  constraint chatwoot_contact_links_pkey primary key (tenant_id, chatwoot_contact_id),")(sql),
          ),
        ),
      "2e",
    ],
    [
      "borrar la ficha no deja auditoría",
      mutar("    if v_contactos is not null then", "    if false then"),
      "6b2",
    ],
    [
      "quitar no filtra el tenant",
      mutar(
        "  where l.tenant_id = p_tenant_id and l.client_id = p_client_id and l.chatwoot_contact_id = p_contact_id\n  returning l.* into v_fila;",
        "  where l.client_id = p_client_id and l.chatwoot_contact_id = p_contact_id\n  returning l.* into v_fila;",
      ),
      "5c2",
    ],
    [
      "sin el disparador, borrar la ficha deja las uniones",
      mutar(
        "create trigger chatwoot_contact_links_al_borrar_ficha\n  after update of deleted_at on public.clients\n  for each row\n  when (new.deleted_at is not null and old.deleted_at is null)",
        "create trigger chatwoot_contact_links_al_borrar_ficha\n  after update of deleted_at on public.clients\n  for each row\n  when (false)",
      ),
      "6b",
    ],
    [
      "una unión manual sin autor",
      mutar(
        ",\n  -- Una unión manual siempre dice quién la hizo; las automáticas, nadie.\n  constraint chatwoot_contact_links_autor check ((origen = 'manual') = (created_by is not null))",
        "",
      ),
      "2j",
    ],
    [
      "authenticated puede escribir la tabla",
      mutar(
        "grant select on public.chatwoot_contact_links to authenticated;",
        "grant select, insert on public.chatwoot_contact_links to authenticated;",
      ),
      "0554: chatwoot_contact_links quedó escribible",
    ],
    [
      "la función automática abierta a authenticated",
      mutar(
        "grant execute on function public.chatwoot_unir_contactos(uuid, text, jsonb) to service_role;",
        "grant execute on function public.chatwoot_unir_contactos(uuid, text, jsonb) to service_role, authenticated;",
      ),
      "0554: chatwoot_unir_contactos quedó abierta",
    ],
  ];

  for (const [nombre, migracion, esperado] of mutantes) {
    it(`MUTANTE: ${nombre} → el contrato cae`, async () => {
      const error = await run(inline({ migracion }));
      expect(error).not.toBeNull();
      expect(error).toContain(esperado);
    }, 120_000);
  }

  it("preflight: una tabla de una versión anterior (llave por tenant y contacto) aborta con mensaje claro", async () => {
    const vieja =
      "create table if not exists public.chatwoot_contact_links (tenant_id uuid not null, client_id uuid not null, " +
      "chatwoot_contact_id bigint not null, origen text not null, created_by uuid, created_at timestamptz not null default now(), " +
      "primary key (tenant_id, chatwoot_contact_id));\n";
    const error = await run(inline({ migracion: (sql) => vieja + sql }));
    expect(error).toContain("ya existe con otra llave primaria");
  }, 120_000);

  it("desarme: quita la tabla, las funciones y el disparador, deja las fichas, y repetirlo no falla", async () => {
    const contrato = inline();
    // El contrato termina en rollback: se corta antes y se sigue en la misma transacción.
    const sinCierre = contrato.slice(0, contrato.lastIndexOf("rollback;"));
    const sql = [
      sinCierre,
      leer("supabase/desarmes/0554_desarme.sql"),
      leer("supabase/desarmes/0554_desarme.sql"),
      `do $c$ begin
        if to_regclass('public.chatwoot_contact_links') is not null
           or to_regprocedure('public.chatwoot_unir_contacto_manual(uuid, uuid, uuid, bigint, text)') is not null
           or to_regprocedure('public.chatwoot_contact_links_actor_puede(uuid, uuid)') is not null
           or to_regprocedure('public.chatwoot_quitar_union(uuid, uuid, uuid, bigint, text)') is not null
           or exists (select 1 from pg_trigger where tgname = 'chatwoot_contact_links_al_borrar_ficha') then
          raise exception 'DESARME: quedó algo de la 0554';
        end if;
        if (select count(*) from public.clients) <> 3 then
          raise exception 'DESARME: tocó las fichas';
        end if;
        if (select status from public.audit_entity_types where entity_type = 'chatwoot_contact_link') <> 'deprecated' then
          raise exception 'DESARME: el tipo de auditoría no quedó deprecated';
        end if;
        -- La ficha se puede volver a borrar sin el disparador.
        update public.clients set deleted_at = now() where deleted_at is null;
      end $c$;`,
      "rollback;",
    ].join("\n");
    expect(await run(sql)).toBeNull();
  }, 120_000);
});

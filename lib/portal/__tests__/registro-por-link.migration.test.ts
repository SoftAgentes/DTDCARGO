// @vitest-environment node
/**
 * SDD-0646 · La migración 0552 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0552_registro_portal_por_link.test.sql` corre en
 * `verify` con Docker; el CI de calidad no tiene Docker. PGlite corre ese MISMO
 * contrato con los `.sql` reales inlineados: se prueba el texto que el runbook
 * aplicará, no un doble.
 *
 * CONTROL ROJO: sin la 0552 el contrato falla.
 * MUTANTES: cada uno cambia la 0552 y tiene que morir con el mensaje que lo
 * caza; si muriera por otro, la prueba falla. PGlite tiene una sola conexión: los
 * FOR UPDATE no se prueban acá.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0552_registro_portal_por_link.test.sql");
const M0552 = "0552_registro_portal_por_link.sql";
const FILE_0552 = readFileSync(resolve(ROOT, "supabase/migrations", M0552), "utf8");
const SLOW = 120_000;

/** psql → SQL plano: quita `\set` e inlinea `\ir` (relativo al archivo). */
function inline(file: string, replace: Record<string, string> = {}): string {
  const out: string[] = [];
  const text = (() => {
    const key = Object.keys(replace).find((name) => file.endsWith(name));
    return key !== undefined ? replace[key] : readFileSync(file, "utf8");
  })();
  for (const line of text.split(/\r?\n/)) {
    const ir = /^\\ir\s+(\S+)\s*$/.exec(line);
    if (ir) {
      out.push(inline(resolve(dirname(file), ir[1]), replace));
    } else if (/^\\set\b/.test(line)) {
      continue;
    } else if (/^\\/.test(line)) {
      throw new Error(`meta-comando no soportado: ${line}`);
    } else {
      out.push(line);
    }
  }
  return out.join("\n");
}

async function correr(migracion: string = FILE_0552): Promise<string> {
  const db = await pgliteLimpio();
  try {
    const res = await db.exec(inline(CONTRACT, { [M0552]: migracion }));
    const ultima = res.filter((r) => r.rows.length > 0).at(-1);
    return String((ultima?.rows[0] as { resultado?: string } | undefined)?.resultado ?? "");
  } finally {
    await db.close();
  }
}

function mutar(desde: string, hacia: string): string {
  expect(FILE_0552.includes(desde), `el mutante no encontró: ${desde.slice(0, 60)}`).toBe(true);
  return FILE_0552.replace(desde, hacia);
}

describe("SDD-0646 · migración 0552 (registro al portal por link)", () => {
  it("el contrato pasa con la migración real", async () => {
    await expect(correr()).resolves.toBe("TEST 0552 GREEN");
  }, SLOW);

  it("el desarme quita la 0552 y devuelve los cuerpos de la 0371 y la 0342", async () => {
    const marca = "-- ── Datos ficticios";
    const completo = inline(CONTRACT);
    const fixture = completo.slice(0, completo.indexOf(marca));
    expect(fixture.length).toBeGreaterThan(0);
    const desarme = readFileSync(resolve(ROOT, "supabase/desarmes/0552_desarme.sql"), "utf8");
    const db = await pgliteLimpio();
    try {
      const res = await db.exec(`${fixture}
${desarme}
select
  (select md5(prosrc) from pg_proc where oid = 'public.rename_client_markbox(uuid,text,text)'::regprocedure) as rename,
  (select md5(prosrc) from pg_proc where oid = 'public.find_duplicate_client_service(uuid,text,text,text)'::regprocedure) as finddup,
  to_regclass('public.client_registration_links') is null as sin_tabla,
  to_regprocedure('public.find_duplicate_client_except_service(uuid,uuid,text,text,text)') is null as sin_except,
  not exists (select 1 from pg_trigger where tgname = 'clients_guard_markbox_retirado_t') as sin_trigger;
rollback;`);
      const fila = res.filter((r) => r.rows.length > 0).at(-1)?.rows[0];
      expect(fila).toEqual({
        rename: "ed233ed2354925960ffc4cd798f8549f",
        finddup: "61d5707d7c63d2c3647a554a497c7569",
        sin_tabla: true,
        sin_except: true,
        sin_trigger: true,
      });
    } finally {
      await db.close();
    }
  }, SLOW);

  it("control rojo: sin la 0552 el contrato falla", async () => {
    await expect(correr("select 1;")).rejects.toThrow();
  }, SLOW);

  it("mutante: el preflight no deja pisar un cuerpo distinto de rename_client_markbox", async () => {
    const m = mutar("ed233ed2354925960ffc4cd798f8549f", "00000000000000000000000000000000");
    await expect(correr(m)).rejects.toThrow(/0552 abortado: rename_client_markbox/);
  }, SLOW);

  it("mutante: rename vuelve a rechazar el código retirado propio", async () => {
    const m = mutar(
      "if v_hist.id is not null and v_hist.client_id is distinct from c.id then",
      "if v_hist.id is not null then",
    );
    await expect(correr(m)).rejects.toThrow(/VJ-77 está retirado/);
  }, SLOW);

  it("mutante: rename deja que otro cliente tome un código retirado", async () => {
    const m = mutar(
      "if v_hist.id is not null and v_hist.client_id is distinct from c.id then",
      "if false then",
    );
    await expect(correr(m)).rejects.toThrow(/un cliente tomó el código retirado de otro/);
  }, SLOW);

  it("mutante: el buscador de duplicados no excluye la ficha propia", async () => {
    const m = mutar("    and c.id is distinct from p_except_client_id\n", "");
    await expect(correr(m)).rejects.toThrow(/duplicada de sí misma/);
  }, SLOW);

  // «Completar copia la cédula de otra ficha» (v_skip_rif := false) es un mutante
  // EQUIVALENTE: el índice único la rechaza y el respaldo deja el mismo
  // resultado. Lo que sí se puede romper es el respaldo.
  it("mutante: el respaldo del índice no avisa que se saltó la cédula", async () => {
    const m = mutar("    v_skip_rif := true;\n", "    v_skip_rif := false;\n");
    await expect(correr(m)).rejects.toThrow(/no se saltó la cédula que el índice rechaza/);
  }, SLOW);

  it("mutante: sin duplicado, la marca de cédula saltada queda en NULL", async () => {
    const m = mutar(
      "v_skip_rif := coalesce(v_dup_by = 'documento', false);",
      "v_skip_rif := (v_dup_by = 'documento');",
    );
    await expect(correr(m)).rejects.toThrow(/rif_skipped/);
  }, SLOW);

  it("mutante: el link se puede usar dos veces", async () => {
    const m = mutar(
      "if l.id is null or l.used_at is not null or l.revoked_at is not null or l.expires_at <= now() then",
      "if l.id is null or l.revoked_at is not null or l.expires_at <= now() then",
    );
    await expect(correr(m)).rejects.toThrow(/el link se usó dos veces/);
  }, SLOW);

  // Regenerar sin revocar choca primero con el índice de un link vivo por
  // cliente: son dos candados. El mutante quita los dos para que lo cace la
  // aserción del contrato y no el índice.
  it("mutante: regenerar no revoca el link anterior", async () => {
    const sinRevocar = mutar(
      `  update public.client_registration_links l
     set revoked_at = now()
   where l.client_id = c.id and l.used_at is null and l.revoked_at is null;
`,
      "",
    );
    const m = sinRevocar.replace(
      `create unique index client_registration_links_one_open
  on public.client_registration_links (client_id)
  where used_at is null and revoked_at is null;`,
      "",
    );
    expect(m).not.toBe(sinRevocar);
    await expect(correr(m)).rejects.toThrow(/regenerar no revocó el link anterior/);
  }, SLOW);

  it("mutante: bind enlaza una cuenta con otro correo", async () => {
    const m = mutar(
      "  if v_email is null or v_email is distinct from (l.submitted_data ->> 'email') then",
      "  if v_email is null then",
    );
    await expect(correr(m)).rejects.toThrow(/enlazó una cuenta con otro correo/);
  }, SLOW);

  it("mutante: completar acepta un correo que ya tiene cuenta", async () => {
    const m = mutar(
      `  if exists (select 1 from auth.users au where lower(au.email) = v_email) then
    raise exception 'correo_en_uso' using errcode = '23505';
  end if;`,
      "",
    );
    await expect(correr(m)).rejects.toThrow(/aceptó un correo que ya tiene cuenta/);
  }, SLOW);

  it("mutante: recuperar el código borra su historia", async () => {
    const m = mutar(
      `    update public.client_markbox_history
       set restored_at = now(), restored_by = auth.uid()
     where id = v_hist.id;`,
      "    delete from public.client_markbox_history where id = v_hist.id;",
    );
    await expect(correr(m)).rejects.toThrow(/se borró o no dice quién lo restauró/);
  }, SLOW);

  it("mutante: mirar devuelve también el nombre de la ficha", async () => {
    const m = mutar(
      "returns table (markbox text)\nlanguage sql",
      "returns table (markbox text, client_name text)\nlanguage sql",
    ).replace("  select c.markbox\n    from public.client_registration_links l", "  select c.markbox, c.name\n    from public.client_registration_links l");
    await expect(correr(m)).rejects.toThrow(/mirar devuelve algo más que el código/);
  }, SLOW);

  it("mutante: la entrada del propio registro cuenta como prueba del correo", async () => {
    const m = mutar(
      "and au.last_sign_in_at > l.used_at + interval '1 hour'",
      "and au.last_sign_in_at > l.used_at",
    );
    await expect(correr(m)).rejects.toThrow(/contó como prueba del correo la entrada del propio registro/);
  }, SLOW);

  it("mutante: un acceso por WhatsApp cuenta como prueba del correo", async () => {
    // Mira sólo los accesos ANTERIORES al registro: el de después pasa de largo.
    const m = mutar("and a.used_at > l.used_at", "and a.used_at < l.used_at");
    await expect(correr(m)).rejects.toThrow(/contó como prueba del correo una entrada por WhatsApp/);
  }, SLOW);

  it("mutante: el link vencido sigue abriendo", async () => {
    const m = mutar("     and l.expires_at > now()\n", "\n");
    await expect(correr(m)).rejects.toThrow(/un link vencido todavía abre/);
  }, SLOW);

  it("mutante: sin el candado, una ficha nueva nace con un código retirado", async () => {
    const m = mutar(
      "create trigger clients_guard_markbox_retirado_t\n  before insert on public.clients\n  for each row execute function public.clients_guard_markbox_retirado();",
      "",
    );
    await expect(correr(m)).rejects.toThrow(/una ficha nueva tomó un código retirado/);
  }, SLOW);
});

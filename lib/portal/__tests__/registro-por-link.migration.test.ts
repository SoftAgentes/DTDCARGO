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

  it("mutante: completar copia la cédula de otra ficha", async () => {
    const m = mutar("v_skip_rif := (v_dup_by = 'documento');", "v_skip_rif := false;");
    await expect(correr(m)).rejects.toThrow(/cédula|unique|duplicate|copió/i);
  }, SLOW);

  it("mutante: el link se puede usar dos veces", async () => {
    const m = mutar(
      "if l.id is null or l.used_at is not null or l.revoked_at is not null or l.expires_at <= now() then",
      "if l.id is null or l.revoked_at is not null or l.expires_at <= now() then",
    );
    await expect(correr(m)).rejects.toThrow(/el link se usó dos veces/);
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

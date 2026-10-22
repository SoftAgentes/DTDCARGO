// @vitest-environment node
/**
 * SDD-0573 · Contrato ejecutable de 0497 sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0497_reverso_al_anular_factura.test.sql` corre en
 * `verify` con Docker, pero el CI de calidad no tiene Docker. PGlite corre ese
 * MISMO contrato, con los `.sql` reales de las migraciones inlineados.
 *
 * Autoría I3-B NO EJECUTADA. El control sin0497 y las veinte propiedades
 * heredadas conservan oráculos concretos. Los mutantes funcionales repinan
 * sólo su propia función TEST; M9 conserva deliberadamente el pin anterior.
 * PGlite no demuestra concurrencia, locks ni COMMIT entre conexiones PG17.
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0497_reverso_al_anular_factura.test.sql");
const M0497 = "0497_reverso_al_anular_factura.sql";
const FILE_0497 = readFileSync(resolve(ROOT, "supabase/migrations", M0497), "utf8");
const M0294 = "0294_audit_d2_human_reasons.sql";
const FILE_0294 = readFileSync(resolve(ROOT, "supabase/migrations", M0294), "utf8");
const SLOW = 240_000;

const TRUE = /^(t|true|on|y|yes|1)$/i;
const FALSE = /^(f|false|off|n|no|0)$/i;

/**
 * psql → SQL plano con las metaórdenes del contrato: \set, \if :{?v} / :v,
 * \else, \endif e \ir. `replace` sustituye el texto de una migración (mutante).
 * Copia de cierre-contable-superclave.migration.test.ts.
 */
function inline(file: string, vars: Record<string, string>, replace: Record<string, string> = {}): string {
  const state = { ...vars };
  const out: string[] = [];
  const read = (path: string) => {
    const key = Object.keys(replace).find((name) => path.endsWith(name));
    return key ? replace[key] : readFileSync(path, "utf8");
  };
  function run(path: string) {
    const stack: { active: boolean; taken: boolean }[] = [];
    const active = () => stack.every((frame) => frame.active);
    for (const line of read(path).split(/\r?\n/)) {
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
          const text = defined ? String(defined[1] in state)
            : rest.trim().startsWith(":") ? String(state[rest.trim().slice(1)]) : rest.trim();
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
        const [name, value] = rest.trim().split(/\s+/);
        if (name !== "ON_ERROR_STOP") state[name] = value;
      } else if (command === "ir") {
        run(resolve(dirname(path), rest.trim()));
      } else {
        throw new Error("metaorden psql no soportada: \\" + command);
      }
    }
    if (stack.length > 0) throw new Error("\\if sin cerrar en " + path);
  }
  run(file);
  return out.join("\n");
}

async function contract(options: { applyFix?: boolean; migration?: string; replace?: Record<string, string>; probe?: string } = {}) {
  const replacements = { ...(options.migration ? { [M0497]: options.migration } : {}), ...(options.replace ?? {}) };
  if (options.probe) {
    const fixture = readFileSync(CONTRACT, "utf8");
    const marker = "-- ── 1. Quién anula y con qué motivo ──";
    expect(fixture.split(marker)).toHaveLength(2);
    // Sólo el clon de TEST: fixture/migraciones reales y §0, luego el oráculo
    // concreto. La candidata normal conserva todas sus aserciones.
    replacements["0497_reverso_al_anular_factura.test.sql"] =
      fixture.slice(0, fixture.indexOf(marker)) + options.probe + "\nrollback;";
  }
  const sql = inline(CONTRACT, { apply_fix: String(options.applyFix ?? true) }, replacements);
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    const results = await db.exec(sql);
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0497 GREEN"));
    return { error: null as string | null, green };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), green: undefined };
  } finally {
    await db.close();
  }
}

/** Inyección singular en TEST. Nunca reescribe FILE_0497 ni dependencias. */
function mutant(from: string, to: string, signature?: string, repin = false): string {
  if (!signature) {
    expect(FILE_0497.split(from)).toHaveLength(2);
    return FILE_0497.split(from).join(to);
  }
  const name = signature.slice("public.".length, signature.indexOf("("));
  const expression = new RegExp(
    "create(?: or replace)? function public\\." + name +
    "\\([\\s\\S]*?\\bas \\$function\\$([\\s\\S]*?)\\$function\\$;", "i",
  );
  const match = FILE_0497.match(expression);
  expect(match).not.toBeNull();
  const original = match![0];
  expect(original.split(from)).toHaveLength(2);
  const changed = original.split(from).join(to);
  let sql = FILE_0497.replace(original, () => changed);
  if (repin) {
    const body = (text: string) => text.slice(
      text.indexOf("$function$") + "$function$".length, text.lastIndexOf("$function$"),
    ).replace(/\r\n/g, "\n");
    const oldHash = createHash("md5").update(body(original), "utf8").digest("hex");
    const newHash = createHash("md5").update(body(changed), "utf8").digest("hex");
    expect(newHash).not.toBe(oldHash);
    const pin = "'" + signature + "','" + oldHash + "'";
    expect(sql.split(pin)).toHaveLength(2);
    sql = sql.split(pin).join("'" + signature + "','" + newHash + "'");
  }
  return sql;
}
const VOID_SIGNATURE = "public.void_invoice_with_audit_reason(uuid,text)";
const APPEND_TYPES = "uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text";
/** Mutante de DEFAULT, no de cuerpo. El clon TEST comprueba todo pg_proc
 * excepto proargdefaults para impedir detección por una deriva colateral. */
function auditDefaultMutation(signature: string): string {
  return `do $default_mutant$
declare
  before_proc pg_catalog.pg_proc%rowtype;
  after_proc pg_catalog.pg_proc%rowtype;
  definition text;
  needle constant text := 'p_result text DEFAULT ''succeeded''::text';
begin
  select p.* into strict before_proc from pg_catalog.pg_proc p
    where p.oid=pg_catalog.to_regprocedure('${signature}');
  definition:=pg_catalog.pg_get_functiondef(before_proc.oid);
  if before_proc.pronargdefaults<>8
     or cardinality(pg_catalog.string_to_array(definition,needle))<>2 then
    raise exception 'TEST I3B: ancla/defaults de escritor no corresponde';
  end if;
  execute pg_catalog.replace(definition,needle,'p_result text DEFAULT ''failed''::text');
  select p.* into strict after_proc from pg_catalog.pg_proc p where p.oid=before_proc.oid;
  if (pg_catalog.to_jsonb(before_proc)-'proargdefaults') is distinct from
       (pg_catalog.to_jsonb(after_proc)-'proargdefaults')
     or before_proc.proargdefaults::text is not distinct from after_proc.proargdefaults::text then
    raise exception 'TEST I3B: mutante no cambió únicamente expresiones de defaults';
  end if;
end;
$default_mutant$;`;
}
const SNAPSHOT = `jsonb_build_object(
  'entries',(select jsonb_agg(to_jsonb(e) order by e.id) from public.journal_entries e),
  'lines',(select jsonb_agg(to_jsonb(l) order by l.id) from public.journal_lines l),
  'audit',(select jsonb_agg(to_jsonb(a) order by a.id) from public.entity_audit_log a),
  'invoices',(select jsonb_agg(to_jsonb(i) order by i.id) from public.invoices i),
  'reason',current_setting('dtd.audit_reason',true))`;
function probe(label: string, operation: string, predicate: string, unchanged = false): string {
  return `do $probe$
declare v_result text; v_before jsonb := ${SNAPSHOT};
begin
  v_result := ${operation};
  perform pg_temp.assert_true((${predicate})${unchanged ? " and (" + SNAPSHOT + ")=v_before" : ""}, '${label}');
end;
$probe$;`;
}


describe("SDD-0573 · 0497 reverso al anular una factura (PGlite)", () => {
  it("el contrato pasa con 0497", async () => {
    const result = await contract();
    expect(result.error).toBeNull();
    expect(result.green).toMatch(/^TEST 0497 GREEN: \d+ aserciones$/);
  }, SLOW);

  it("control rojo: sin 0497 falla en la primera aserción", async () => {
    const result = await contract({ applyFix: false });
    expect(result.error).toBe("TEST 0497: existe journal_entries.reverses_entry_id");
  }, SLOW);

  // Veinte propiedades heredadas; detección NO EJECUTADA.
  const MUTANTS: { name: string; from: string; to: string; fails: string;
    signature?: string; repin?: boolean; probe?: string }[] = [
    {
      name: "commercial anula",
      from: "in ('admin', 'accounting')",
      to: "in ('admin', 'accounting', 'commercial')",
      fails: "TEST 0497: commercial no anula una factura",
      signature: VOID_SIGNATURE,
      repin: true,
      probe: probe("commercial no anula una factura", "pg_temp.error_of('commercial-A',pg_temp.void_sql('inv-abierta'))", "v_result='42501|Solo admin o contabilidad anulan una factura.|dtd-anular'", true),
    },
    {
      name: "sin el tenant de la sesión",
      from: "where i.id = p_id and i.tenant_id = v_tenant\n  for update;",
      to: "where i.id = p_id\n  for update;",
      fails: "TEST 0497: otro tenant no anula la factura (no la encuentra)",
      signature: VOID_SIGNATURE,
      repin: true,
      probe: probe("otro tenant no anula la factura (no la encuentra)", "pg_temp.anular('accounting-B','inv-abierta')", "v_result='false'", true),
    },
    {
      name: "sin rechazar los recibos vivos",
      from: "if v_recibos > 0 then",
      to: "if false then",
      fails: "TEST 0497: con un recibo vivo no se anula",
      signature: VOID_SIGNATURE,
      repin: true,
      probe: probe("con un recibo vivo no se anula", "pg_temp.error_of('accounting-A',pg_temp.void_sql('inv-recibo'))", "v_result='55000|La factura tiene 1 cobro(s) vivo(s): anúlalos primero en Cobranzas.|dtd-anular'", true),
    },
    {
      name: "un recibo anulado cuenta como vivo",
      from: "r.tenant_id = v_tenant and r.deleted_at is null;",
      to: "r.tenant_id = v_tenant;",
      fails: "TEST 0497: un recibo anulado no cuenta: la factura se anula y se revierte",
      signature: VOID_SIGNATURE,
      repin: true,
      probe: probe("un recibo anulado no cuenta: la factura se anula y se revierte", "pg_temp.anular('accounting-A','inv-recibo-anulado')", "v_result='true' and pg_temp.reverso_de('e-recibo-anulado') is not null", false),
    },
    {
      name: "sin rechazar el abono sin recibo",
      from: "if coalesce(v_inv.paid_amount, 0) > 0 then",
      to: "if false then",
      fails: "TEST 0497: con un abono sin recibo (crédito o reporte) no se anula",
      signature: VOID_SIGNATURE,
      repin: true,
      probe: probe("con un abono sin recibo (crédito o reporte) no se anula", "pg_temp.error_of('accounting-A',pg_temp.void_sql('inv-credito'))", "v_result='55000|La factura tiene 80.00 aplicado sin recibo (un crédito de referido o un reporte de pago): revierte el crédito antes de anular.|dtd-anular'", true),
    },
    {
      name: "sin el reverso",
      from: "if v_vivos = 1 then",
      to: "if false then",
      fails: "TEST 0497: el reverso es un asiento asentado de la factura, fechado hoy en Caracas",
      signature: VOID_SIGNATURE,
      repin: true,
      probe: probe("el reverso es un asiento asentado de la factura, fechado hoy en Caracas", "pg_temp.anular('accounting-A','inv-abierta')", "v_result='true' and exists(select 1 from public.journal_entries where id=pg_temp.reverso_de('e-abierta') and status='asentado' and entry_date=pg_temp.hoy())", false),
    },
    {
      name: "las líneas sin dar vuelta",
      from: "select v_nuevo,l.account_id,l.credit,l.debit,",
      to: "select v_nuevo,l.account_id,l.debit,l.credit,",
      fails: "TEST 0497: el reverso tiene las mismas líneas al revés: el par suma cero en cada cuenta",
      signature: VOID_SIGNATURE,
      repin: true,
      probe: probe("el reverso tiene las mismas líneas al revés: el par suma cero en cada cuenta", "pg_temp.anular('accounting-A','inv-abierta')", "v_result='true' and pg_temp.neto_del_par('e-abierta')=0", false),
    },
    {
      name: "el reverso con la fecha de hoy aunque esté cerrada",
      from: "v_fecha := greatest(v_hoy, coalesce(v_cierre + 1,v_hoy), v_entry.entry_date);",
      to: "v_fecha := v_hoy;",
      fails: "TEST 0497: con hoy dentro del cierre, se anula igual",
      signature: VOID_SIGNATURE,
      repin: true,
      probe: "update public.accounting_settings set closing_date=pg_temp.hoy()+10 where tenant_id=pg_temp.fixture_id('tenant-A');\n" + probe("con hoy dentro del cierre, se anula igual", "pg_temp.anular('accounting-A','inv-futuro')", "v_result='true' and (select entry_date=pg_temp.hoy()+11 from public.journal_entries where id=pg_temp.reverso_de('e-futuro'))", false),
    },
    {
      name: "el memo sin el período cerrado",
      from: "case when v_cierre is not null and v_entry.entry_date <= v_cierre",
      to: "case when false",
      fails: "TEST 0497: el reverso de un asiento de período cerrado va hoy, con el memo del período cerrado",
      signature: VOID_SIGNATURE,
      repin: true,
      probe: probe("el reverso de un asiento de período cerrado va hoy, con el memo del período cerrado", "pg_temp.anular('admin-A','inv-cerrada')", "v_result='true' and exists(select 1 from public.journal_entries where id=pg_temp.reverso_de('e-cerrada') and memo like '% — período cerrado: el reverso va en el período abierto.')", false),
    },
    {
      name: "el original se marca anulado",
      from: "        perform pg_catalog.set_config('dtd.audit_reason', v_reason, true);\n        update public.invoices",
      to: "        update public.journal_entries set status='anulado' where id=v_entry.id;\n        perform pg_catalog.set_config('dtd.audit_reason', v_reason, true);\n        update public.invoices",
      fails: "TEST 0497: el asiento original no se toca",
      signature: VOID_SIGNATURE,
      repin: true,
      probe: probe("el asiento original no se toca", "pg_temp.anular('accounting-A','inv-abierta')", "v_result='true' and (select status='asentado' from public.journal_entries where id=pg_temp.fixture_id('e-abierta'))", false),
    },
    {
      name: "sin el motivo para la auditoría",
      from: "        perform pg_catalog.set_config('dtd.audit_reason', v_reason, true);\n        update public.invoices",
      to: "        perform pg_catalog.set_config('dtd.audit_reason', '', true);\n        update public.invoices",
      fails: "TEST 0497: la anulación queda en la auditoría D2 con su motivo",
      signature: VOID_SIGNATURE,
      repin: true,
      probe: probe("la anulación queda en la auditoría D2 con su motivo", "pg_temp.anular('accounting-A','inv-abierta')", "v_result='true' and exists(select 1 from public.entity_audit_log where entity_id=pg_temp.fixture_id('inv-abierta') and event_type='invoice_voided' and reason='Factura emitida por error')", false),
    },
    {
      name: "con dos asientos vivos revierte uno",
      from: "if v_vivos > 1 then",
      to: "if false then",
      fails: "TEST 0497: con dos asientos de venta vivos no se anula",
      signature: VOID_SIGNATURE,
      repin: true,
      probe: probe("con dos asientos de venta vivos no se anula", "pg_temp.error_of('accounting-A',pg_temp.void_sql('inv-doble'))", "v_result='55000|La factura tiene 2 asientos de venta vivos: revisa el libro diario antes de anular.|dtd-anular'", true),
    },
    {
      name: "sin mirar si cuadra",
      from: "if v_debe is null or v_debe = 0 or v_debe <> v_haber\n       or not public.i3_original_valid(v_entry.id,v_tenant,p_id) then",
      to: "if false then",
      fails: "TEST 0497: con un asiento de venta que no cuadra no se anula",
      signature: VOID_SIGNATURE,
      repin: true,
      probe: probe("con un asiento de venta que no cuadra no se anula", "pg_temp.error_of('accounting-A',pg_temp.void_sql('inv-descuadre'))", "v_result='55000|El asiento de venta A-2026-0105 no cuadra: revisa el libro diario antes de anular.|dtd-anular'", true),
    },
    {
      name: "INVOKER en vez de DEFINER",
      from: "returns boolean language plpgsql volatile security definer",
      to: "returns boolean language plpgsql volatile security invoker",
      fails: "0497: postflight — void_invoice_with_audit_reason tiene que ser DEFINER con search_path vacío",
      signature: VOID_SIGNATURE,
    },
    {
      name: "anon ejecuta la anulación",
      from: "grant execute on function public.void_invoice_with_audit_reason(uuid,text) to authenticated;",
      to: "grant execute on function public.void_invoice_with_audit_reason(uuid,text) to authenticated, anon;",
      fails: "0497: postflight — la ACL de void_invoice_with_audit_reason no es la esperada",
    },
    {
      name: "un asiento con dos reversos",
      from: "create unique index journal_entries_un_reverso",
      to: "create index journal_entries_un_reverso",
      fails: "0497: M9 índice UNIQUE del reverso incompatible.",
    },
    {
      name: "sin el CHECK del reverso",
      from: "(source = 'invoice_reversal') = (reverses_entry_id is not null)",
      to: "true",
      fails: "0497: M9 CHECK del reverso incompatible.",
    },
    {
      name: "el original se borra con su reverso",
      from: "references public.journal_entries(id) on delete restrict;",
      to: "references public.journal_entries(id) on delete cascade;",
      fails: "0497: M9 FK RESTRICT del reverso incompatible.",
    },
    {
      name: "el memo sin el asiento original",
      from: "'Reverso de la factura %s (asiento %s del %s).'",
      to: "'Reverso de la factura %s.'",
      fails: "TEST 0497: el memo cita la factura, el asiento original y su fecha sin motivo libre",
      signature: VOID_SIGNATURE,
      repin: true,
      probe: probe("el memo cita la factura, el asiento original y su fecha sin motivo libre", "pg_temp.anular('accounting-A','inv-abierta')", "v_result='true' and (select memo='Reverso de la factura F-0497-01 (asiento A-2026-0101 del 2026-10-01).' from public.journal_entries where id=pg_temp.reverso_de('e-abierta'))", false),
    },
    {
      name: "las líneas sin la marca de reverso",
      from: "pg_catalog.format('Reverso: factura %s; asiento %s.',v_inv.invoice_code,v_entry.entry_code)",
      to: "l.line_memo",
      fails: "TEST 0497: las líneas del reverso dicen que son reverso",
      signature: VOID_SIGNATURE,
      repin: true,
      probe: probe("las líneas del reverso dicen que son reverso", "pg_temp.anular('accounting-A','inv-abierta')", "v_result='true' and (select bool_and(line_memo like 'Reverso: %') from public.journal_lines where entry_id=pg_temp.reverso_de('e-abierta'))", false),
    }
  ];
  for (const m of MUTANTS) {
    it(`mutante ${m.name}: muere donde debe`, async () => {
      const result = await contract({
        migration: mutant(m.from, m.to, m.signature, m.repin),
        probe: m.probe,
      });
      expect(result.error).toBe(m.fails);
    }, SLOW);
  }

  // M9 separado: no repin, no “cualquier error” ni timeout como detección.
  const M9: { name: string; ddl: string; fails: string }[] = [
    { name: "owner del mutex", ddl: "alter function public.i3_lock_entry(uuid) owner to anon;",
      fails: "0497: postflight I3-B función/cuerpo/config de public.i3_lock_entry(uuid) no coincide." },
    { name: "search_path de posting", ddl: "alter function public.post_invoice_journal_entry_atomic(uuid,uuid) set search_path=public;",
      fails: "0497: postflight I3-B función/cuerpo/config de public.post_invoice_journal_entry_atomic(uuid,uuid) no coincide." },
    { name: "STRICT de posting", ddl: "alter function public.post_invoice_journal_entry_atomic(uuid,uuid) strict;",
      fails: "0497: postflight I3-B función/cuerpo/config de public.post_invoice_journal_entry_atomic(uuid,uuid) no coincide." },
    { name: "cuerpo del lock con pin conservado", ddl: "create or replace function public.i3_lock_entry(p_entry_id uuid) returns void language plpgsql volatile security definer set search_path='' as $bad$ begin return; end; $bad$;",
      fails: "0497: postflight I3-B función/cuerpo/config de public.i3_lock_entry(uuid) no coincide." },
    { name: "sobrecarga no autorizada", ddl: "create function public.post_invoice_journal_entry_atomic(uuid) returns jsonb language sql as $bad$ select '{}'::jsonb $bad$;",
      fails: "0497: M9 sobrecarga no autorizada de post_invoice_journal_entry_atomic." },
    { name: "ACL heredada", ddl: "create role i3b_test_executor nologin;grant execute on function public.post_invoice_journal_entry_atomic(uuid,uuid) to i3b_test_executor;grant i3b_test_executor to authenticated;",
      fails: "0497: M9 ACL efectiva/heredada incompatible de public.post_invoice_journal_entry_atomic(uuid,uuid)." },
    { name: "RLS desactivada", ddl: "alter table public.journal_lines disable row level security;",
      fails: "0497: M9 relación/RLS incompatible." },
    { name: "trigger de línea desactivado", ddl: "alter table public.journal_lines disable trigger i3_journal_line_guard;",
      fails: "0497: M9 trigger I3-B incompatible public.journal_lines.i3_journal_line_guard." },
    { name: "D2 histórico sin enlace activo", ddl: "alter table public.invoices disable trigger audit_d2_invoices;",
      fails: "0497: M9 trigger histórico incompatible public.invoices.audit_d2_invoices." },
    { name: "FK vuelve no diferible", ddl: "alter table public.journal_lines alter constraint journal_lines_entry_id_fkey not deferrable;",
      fails: "0497: M9 FK debe ser DEFERRABLE INITIALLY IMMEDIATE." },
    { name: "nombre FK homónimo", ddl: "create table public.i3b_test_homonym(id uuid,constraint journal_lines_entry_id_fkey check(id is not null));",
      fails: "0497: M9 nombre FK no singular." },
    { name: "tipo de columna alterado", ddl: "alter table public.journal_lines alter column debit type numeric(15,2);",
      fails: "0497: M9 columna incompatible public.journal_lines.debit." },
  ];
  for (const m of M9) {
    it(`M9 ${m.name}: catálogo concreto, pin conservado`, async () => {
      const result = await contract({ migration: mutant("do $postflight$", m.ddl + "\ndo $postflight$") });
      expect(result.error).toBe(m.fails);
    }, SLOW);
  }
  it("M9 default de posting no autorizado", async () => {
    const result = await contract({ migration: mutant(
      "p_tenant_id uuid, p_invoice_id uuid)", "p_tenant_id uuid, p_invoice_id uuid default null)",
      "public.post_invoice_journal_entry_atomic(uuid,uuid)",
    ) });
    expect(result.error).toBe("0497: postflight I3-B función/cuerpo/config de public.post_invoice_journal_entry_atomic(uuid,uuid) no coincide.");
  }, SLOW);
  it("M9 constraint final conserva INITIALLY DEFERRED", async () => {
    const result = await contract({ migration: mutant(
      "deferrable initially deferred for each row execute function public.i3_invoice_final();",
      "deferrable initially immediate for each row execute function public.i3_invoice_final();",
    ) });
    expect(result.error).toBe("0497: M9 trigger I3-B incompatible public.invoices.i3_invoice_final_check.");
  }, SLOW);
  it("M9 predicado del índice no sustituible", async () => {
    const result = await contract({ migration: mutant(
      "on public.journal_entries (reverses_entry_id) where reverses_entry_id is not null;",
      "on public.journal_entries (reverses_entry_id) where reverses_entry_id is null;",
    ) });
    expect(result.error).toBe("0497: M9 índice UNIQUE del reverso incompatible.");
  }, SLOW);

  for (const phase of ["preflight", "postflight"] as const) {
    it.each(["append_audit_event", "append_audit_event_v1"])(
      `M9 default real de %s: cardinalidad8/cuerpo conservados en ${phase}`,
      async (name) => {
        const signature = `public.${name}(${APPEND_TYPES})`;
        const marker = `do $${phase}$`;
        const result = await contract({ migration: mutant(
          marker, auditDefaultMutation(signature) + "\n" + marker,
        ) });
        expect(result.error).toBe(`0497: ${phase} defaults de ${signature} no coinciden.`);
      }, SLOW,
    );
  }
  it.each([
    ["invoices", "alter table public.invoices rename to i3b_test_missing_invoices;"],
    ["journal_entries", "alter table public.journal_entries rename to i3b_test_missing_entries;"],
    ["journal_lines", "alter table public.journal_lines rename to i3b_test_missing_lines;"],
    ["payment_receipts", "alter table public.payment_receipts rename to i3b_test_missing_receipts;"],
    ["accounting_settings", "alter table public.accounting_settings rename to i3b_test_missing_settings;"],
    ["user_tenants", "alter table public.user_tenants rename to i3b_test_missing_memberships;"],
    ["get_user_tenant_id()", "alter function public.get_user_tenant_id() rename to i3b_test_missing_tenant;"],
    ["next_entry_code(uuid)", "alter function public.next_entry_code(uuid) rename to i3b_test_missing_code;"],
    ["auth.uid()", "alter function auth.uid() rename to i3b_test_missing_uid;"],
  ])("M9 dependencia nominal ausente %s: rechazo antes del DDL", async (_name, rename) => {
    // OID/cuerpos/ACL se conservan: sólo falta el nombre de esta dependencia.
    // Exclusivamente fixture TEST; no DROP CASCADE ni alteración de predecesoras.
    const result = await contract({ migration: mutant("do $preflight$", rename + "\ndo $preflight$") });
    expect(result.error).toBe("0497 requiere invoices, journal_entries, journal_lines, payment_receipts, accounting_settings, user_tenants, get_user_tenant_id(), next_entry_code(uuid) y auth.uid()");
  }, SLOW);

  it("el preflight aborta si void_invoice_with_audit_reason no es la de la 0294", async () => {
    const antes = "    and status <> 'pagada'\n    and status <> 'anulada';";
    expect(FILE_0294.split(antes)).toHaveLength(2);
    const otra = FILE_0294.split(antes).join("    and status <> 'pagada';");
    const result = await contract({ replace: { [M0294]: otra } });
    expect(result.error).toMatch(/^0497 abortado: void_invoice_with_audit_reason no es la de la 0294 \(md5 [0-9a-f]{32}, definer f, config /);
  }, SLOW);

  it("aplicada dos veces, la segunda aborta con «ya existe»", async () => {
    const result = await contract({ migration: FILE_0497 + "\n" + FILE_0497 });
    expect(result.error).toBe("0497 abortado: el reverso de asientos ya existe");
  }, SLOW);

  it("la 0497 espera en pendingBelowCutoff, MIGRATE-FIRST y con OK nominal de Sam", () => {
    const baseline = JSON.parse(readFileSync(resolve(ROOT, "supabase/migrations-baseline.json"), "utf8")) as {
      pendingBelowCutoff: Record<string, string>;
    };
    const espera = baseline.pendingBelowCutoff["0497_reverso_al_anular_factura"];
    expect(espera).toContain("MIGRATE-FIRST");
    expect(espera).toContain("Requiere OK nominal de Sam");
    expect(FILE_0497).toContain(
      "⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en\n--    supabase/migrations-baseline.json › pendingBelowCutoff",
    );
  });
});

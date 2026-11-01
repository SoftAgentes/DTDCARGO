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
import { describe, expect, it, vi } from "vitest";

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
  const replacements: Record<string, string> = { ...(options.migration ? { [M0497]: options.migration } : {}), ...(options.replace ?? {}) };
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
  const notices: Record<string, unknown>[] = [];
  try {
    const results = await db.exec(sql, { onNotice: (notice) => notices.push({ ...notice }) });
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0497 GREEN"));
    return { error: null as string | null, green, notices, nativeError: null as Record<string, unknown> | null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), green: undefined, notices, nativeError: nativeEvidence(error) };
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


type ClockSample = { utc: string; epochUs: string; txid: string; caracasDate: string };
type NativeAttempt = { ok: boolean; result?: unknown; command: string; state?: string;
  message?: string; hint?: string; context?: string; [field: string]: unknown };
type MidnightStage = { label: string; nominalUtc: string; lowerUs: string; upperUs: string;
  expectedDate: string; sampleBefore?: ClockSample; sampleAfter?: ClockSample;
  before?: Record<string, unknown>; attempt?: NativeAttempt; afterRollback?: Record<string, unknown>;
  afterCommit?: Record<string, unknown>; committed?: boolean; endedTransaction?: boolean };
const MIDNIGHT_CASES = [
  { label: "before", nominalUtc: "2026-11-01T03:59:59.999Z", lowerUs: "1793505599998999",
    upperUs: "1793505599999001", expectedDate: "2026-10-31" },
  { label: "after", nominalUtc: "2026-11-01T04:00:00.001Z", lowerUs: "1793505600000999",
    upperUs: "1793505600001001", expectedDate: "2026-11-01" },
] as const;
const MIDNIGHT_SUCCESS = "M3 éxito público auténtico: ";
const SEQUENTIAL_MARKER = "-- ── 1. Quién anula y con qué motivo ──";
function nativeEvidence(error: unknown): Record<string, unknown> {
  if (typeof error !== "object" || error === null) return { thrown: error };
  return Object.fromEntries(Object.getOwnPropertyNames(error).map((key) =>
    [key, (error as Record<string, unknown>)[key]]));
}
function onlyRow<T>(results: { rows: unknown[] }[], column: string): T {
  const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toHaveProperty(column);
  return rows[0][column] as T;
}
/** Date únicamente del worker Vitest; no modifica reloj SO/controlador/timers. */
async function midnightContract(migration = FILE_0497) {
  const RealDate = Date;
  const entryDateUtc = new RealDate().toISOString();
  const originalTimers = { setTimeout, clearTimeout, setInterval, clearInterval };
  const notices: Record<string, unknown>[] = [];
  const stages: MidnightStage[] = [];
  const cleanupErrors: Record<string, unknown>[] = [];
  let db: PGlite | undefined;
  let error: string | null = null;
  let originalError: Record<string, unknown> | null = null;
  let setup: Record<string, unknown> | undefined;
  let setupCommitted = false;
  let boundary: "NO DISPONIBLE" | "ADMITIDA POR SQL" = "NO DISPONIBLE";
  let dateOwned = false;
  try {
    expect(vi.isFakeTimers()).toBe(false);
    db = new PGlite({ extensions: { pgcrypto } });
    const exec = (sql: string) => db!.exec(sql, { onNotice: (notice) => notices.push({ ...notice }) });
    const fixture = readFileSync(CONTRACT, "utf8");
    expect(fixture.split(SEQUENTIAL_MARKER)).toHaveLength(2);
    // El prefijo REAL incluye BEGIN/migraciones/§0 y las mismas definiciones.
    const bootstrap = inline(CONTRACT, { apply_fix: "true" }, {
      [M0497]: migration,
      "0497_reverso_al_anular_factura.test.sql": fixture.slice(0, fixture.indexOf(SEQUENTIAL_MARKER)),
    });
    await exec(bootstrap);
    expect(db.isInTransaction()).toBe(true);
    setup = onlyRow<Record<string, unknown>>(await exec("select pg_temp.m3_setup() as evidence;"), "evidence");
    await exec("commit;");
    expect(db.isInTransaction()).toBe(false);
    setupCommitted = true;
    // Las bandas TEXT de arriba son previas a observar SQL, no tolerancia aprendida.
    dateOwned = true;
    vi.useFakeTimers({ toFake: ["Date"] });
    for (const nominal of MIDNIGHT_CASES) {
      const stage: MidnightStage = { ...nominal };
      stages.push(stage);
      vi.setSystemTime(new RealDate(nominal.nominalUtc));
      await exec("begin isolation level read committed;");
      expect(db.isInTransaction()).toBe(true);
      stage.sampleBefore = onlyRow<ClockSample>(await exec("select pg_temp.m3_sample() as evidence;"), "evidence");
      const observedUs = BigInt(stage.sampleBefore.epochUs);
      if (observedUs < BigInt(nominal.lowerUs) || observedUs > BigInt(nominal.upperUs)
        || stage.sampleBefore.caracasDate !== nominal.expectedDate) {
        throw new Error("M3 frontera NO DISPONIBLE: SQL fuera de banda previa " + nominal.label);
      }
      const invoice = `pg_temp.fixture_id('m2b1m3-m3-${nominal.label}')`;
      stage.before = onlyRow<Record<string, unknown>>(await exec(
        `select pg_temp.m2b1_assert_sale(${invoice},false,'M3 ${nominal.label} antes') as graph;`), "graph");
      stage.attempt = onlyRow<NativeAttempt>(await exec(
        `select pg_temp.m2b1_attempt('accounting-A',pg_temp.void_sql('m2b1m3-m3-${nominal.label}','M3 motivo temporal sintético')) as evidence;`), "evidence");
      stage.sampleAfter = onlyRow<ClockSample>(await exec("select pg_temp.m3_sample() as evidence;"), "evidence");
      expect(stage.sampleAfter).toEqual(stage.sampleBefore);
      if (!stage.attempt.ok || stage.attempt.result !== true) {
        // Captura primaria COMPLETA antes del nuevo oráculo; no leer un R inexistente.
        await exec("rollback;");
        stage.endedTransaction = !db.isInTransaction();
        stage.afterRollback = onlyRow<Record<string, unknown>>(await exec(
          `select pg_temp.m2b1_assert_sale(${invoice},false,'M3 ${nominal.label} rollback positivo') as graph;`), "graph");
        expect(stage.afterRollback).toEqual(stage.before);
        throw new Error(MIDNIGHT_SUCCESS + nominal.label);
      }
      const after = onlyRow<Record<string, unknown>>(await exec(
        `select pg_temp.m2b1_assert_sale(${invoice},true,'M3 ${nominal.label} par efectivo') as graph;`), "graph");
      const entries = after.entries as Record<string, unknown>[];
      const reversals = entries.filter((entry) => entry.source === "invoice_reversal");
      expect(reversals).toHaveLength(1);
      expect(reversals[0].entry_date).toBe(nominal.expectedDate);
      expect(after.originals).toEqual(stage.before.originals);
      await exec("commit;");
      stage.endedTransaction = !db.isInTransaction();
      expect(stage.endedTransaction).toBe(true);
      stage.committed = true;
      stage.afterCommit = onlyRow<Record<string, unknown>>(await exec(
        `select pg_temp.m2b1_assert_sale(${invoice},true,'M3 ${nominal.label} confirmado') as graph;`), "graph");
      expect(stage.afterCommit).toEqual(after);
    }
    expect(stages).toHaveLength(2);
    expect(stages[0].sampleBefore!.txid).not.toBe(stages[1].sampleBefore!.txid);
    boundary = "ADMITIDA POR SQL";
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
    originalError = nativeEvidence(caught);
  } finally {
    try {
      if (db) {
        try {
          if (db.isInTransaction()) await db.exec("rollback;", { onNotice: (notice) => notices.push({ ...notice }) });
        } catch (cleanup) { cleanupErrors.push(nativeEvidence(cleanup)); }
        try { await db.close(); } catch (cleanup) { cleanupErrors.push(nativeEvidence(cleanup)); }
      }
    } finally {
      if (dateOwned) vi.useRealTimers();
      expect(Date).toBe(RealDate);
      expect({ setTimeout, clearTimeout, setInterval, clearInterval }).toEqual(originalTimers);
    }
  }
  const evidence = { error, originalError, entryDateUtc, setup, setupCommitted, stages, boundary, cleanupErrors, notices,
    secondVoid: stages.length < 2 ? "NO EJECUTADO: no se alcanzó" : "ver segundo stage real" };
  // Fuera del reloj fake: captura durable nativa del worker, sin prometer SQL gold.
  console.info("0573_M3_ORIGINAL_EVIDENCE", JSON.stringify(evidence));
  return evidence;
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

  // El cuerpo vivo de producción (medido el 2026-11-01) es el de la 0078 con otro
  // formato. Se arma desde la 0078 y su md5 tiene que ser el que la 0497 acepta.
  const FILE_0078 = readFileSync(resolve(ROOT, "supabase/migrations/0078_contabilidad.sql"), "utf8").replace(/\r\n/g, "\n");
  const CUERPO_0078 = FILE_0078.slice(
    FILE_0078.indexOf("$$", FILE_0078.indexOf("function public.next_entry_code(p_tenant_id uuid)")) + 2,
    FILE_0078.indexOf("$$;", FILE_0078.indexOf("function public.next_entry_code(p_tenant_id uuid)")),
  );
  const WHERE_0078 = "  where tenant_id = p_tenant_id\n    and entry_code like 'A-' || v_year || '-%';\n\n";
  const WHERE_VIVO = "  where tenant_id = p_tenant_id and entry_code like 'A-' || v_year || '-%';\n";
  expect(CUERPO_0078.split(WHERE_0078)).toHaveLength(2);
  const CUERPO_VIVO = CUERPO_0078.split(WHERE_0078).join(WHERE_VIVO);
  const nextEntryCode = (cuerpo: string) => "create or replace function public.next_entry_code(p_tenant_id uuid) "
    + "returns text language plpgsql security definer set search_path = public as $vivo$" + cuerpo + "$vivo$;";
  const SUMA = "), 0) + 1";

  it("el cuerpo vivo de next_entry_code es la 0078 con otro formato, y su md5 es el pin", () => {
    expect(createHash("md5").update(CUERPO_0078, "utf8").digest("hex")).toBe("6954cb3efb9db4ca131266964d4ed524");
    expect(createHash("md5").update(CUERPO_VIVO, "utf8").digest("hex")).toBe("06b5756a18361fc4d85cec6f6dc4b3bc");
    expect(CUERPO_VIVO).toHaveLength(388);
    const sinEspacios = (cuerpo: string) => cuerpo.replace(/\s/g, "");
    expect(sinEspacios(CUERPO_VIVO)).toBe(sinEspacios(CUERPO_0078));
    expect(CUERPO_VIVO.split(SUMA)).toHaveLength(2);
  });

  it("next_entry_code con el cuerpo vivo de producción: el contrato entero pasa", async () => {
    const result = await contract({ migration: mutant("do $preflight$", nextEntryCode(CUERPO_VIVO) + "\ndo $preflight$") });
    expect(result.error).toBeNull();
    expect(result.green).toMatch(/^TEST 0497 GREEN/);
  }, SLOW);

  it.each([
    ["el cuerpo vivo con otra lógica", () => nextEntryCode(CUERPO_VIVO.split(SUMA).join("), 0) + 2"))],
    ["la 0078 con otra lógica", () => nextEntryCode(CUERPO_0078.split(SUMA).join("), 0) + 2"))],
    ["el cuerpo vivo con un formato desconocido", () => nextEntryCode(CUERPO_VIVO + "\n")],
  ])("el preflight aborta con %s en next_entry_code", async (_name, ddl) => {
    const result = await contract({ migration: mutant("do $preflight$", ddl() + "\ndo $preflight$") });
    expect(result.error).toBe("0497: preflight función/cuerpo/config de public.next_entry_code(uuid) no coincide.");
  }, SLOW);

  it("el postflight aborta si next_entry_code cambió de lógica durante la migración", async () => {
    const otra = nextEntryCode(CUERPO_VIVO.split(SUMA).join("), 0) + 2"));
    const result = await contract({ migration: mutant("do $postflight$", otra + "\ndo $postflight$") });
    expect(result.error).toBe("0497: postflight predecesor conservado función/cuerpo/config de public.next_entry_code(uuid) no coincide.");
  }, SLOW);

  it("el md5 vivo de next_entry_code no vale para otra función", async () => {
    const otra = "create or replace function public.journal_lines_validate_closing() returns trigger language plpgsql "
      + "set search_path = public as $vivo$" + CUERPO_VIVO + "$vivo$;";
    const result = await contract({ migration: mutant("do $preflight$", otra + "\ndo $preflight$") });
    expect(result.error).toBe("0497: preflight función/cuerpo/config de public.journal_lines_validate_closing() no coincide.");
  }, SLOW);

  // PGlite y sql-tests corren como superusuario, y el rol postgres de producción no
  // lo es: el motor le niega crear una función con un parámetro propio en su cabecera.
  it("sin superusuario, un parámetro propio en la cabecera se niega, y la 0497 no lo usa", async () => {
    const db = new PGlite();
    try {
      await db.exec("create role i3b_sin_super nologin; create schema i3b_sonda authorization i3b_sin_super; set role i3b_sin_super;");
      await db.exec("create function i3b_sonda.con_search_path() returns int language sql set search_path = '' as 'select 1';");
      await expect(db.exec(
        "create function i3b_sonda.con_propio() returns int language sql set dtd.audit_reason = '' as 'select 1';",
      )).rejects.toThrow('permission denied to set parameter "dtd.audit_reason"');
    } finally {
      await db.close();
    }
    expect(FILE_0497.match(/\bset\s+"?[a-z_]\w*\.[a-z_]\w*"?\s*(=|to\b)/gi)).toBeNull();
  }, SLOW);

  it("la anulación, por sus dos salidas, restaura el motivo exterior y no lo deja en los eventos", async () => {
    const result = await contract({ probe: `
select set_config('dtd.audit_reason','I3B motivo exterior',true);
select pg_temp.assert_true(pg_temp.anular('accounting-A','inv-abierta')='true','anula con asiento de venta');
select pg_temp.assert_true(current_setting('dtd.audit_reason',true)='I3B motivo exterior','con asiento: restaura el motivo exterior');
select pg_temp.assert_true(pg_temp.anular('accounting-A','inv-borrador')='true','anula sin asiento');
select pg_temp.assert_true(current_setting('dtd.audit_reason',true)='I3B motivo exterior','sin asiento: restaura el motivo exterior');
select pg_temp.assert_true((select count(*) from public.entity_audit_log a
  where a.entity_id in (pg_temp.fixture_id('inv-abierta'),pg_temp.fixture_id('inv-borrador'))
    and a.event_type='invoice_voided' and a.reason='Factura emitida por error')=2,'cada evento lleva el motivo del documento');
select pg_temp.assert_true(not exists(select 1 from public.entity_audit_log a where a.reason='I3B motivo exterior'),
  'el motivo exterior no entra a ningún evento');
select set_config('dtd.audit_reason','',true);
` });
    expect(result.error).toBeNull();
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

  it("M2/B1 oro: dos legados void y excepción auténtica manual/ambos extremos", async () => {
    const result = await contract({ probe: "select pg_temp.m2_void_case('draft-only');\n"
      + "select pg_temp.m2_void_case('posted-and-draft');\nselect pg_temp.m2b1_run();" });
    console.info("0573_M2_B1_ORIGINAL_NOTICES", JSON.stringify(result.notices));
    expect(result.error).toBeNull();
    const witnesses = result.notices.map((notice) => String(notice.message ?? ""))
      .filter((message) => message.startsWith("0573_B1_AUTHENTIC_WITNESS "));
    expect(witnesses).toHaveLength(3);
    for (const label of ["manual", "original", "reverso"]) {
      const rows = witnesses.map((message) => JSON.parse(message.slice("0573_B1_AUTHENTIC_WITNESS ".length)) as Record<string, unknown>)
        .filter((row) => row.case === label);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ observed: 1, matchCount: 1, nonceMatchesGuc: true,
        sameTxid: true, validator: true, operation: "anular", authorizedBy: "superclave" });
      expect(rows[0]).not.toHaveProperty("nonce");
      expect(rows[0]).not.toHaveProperty("secret_hash");
    }
  }, SLOW);

  for (const subject of ["draft-only", "posted-and-draft"] as const) {
    it(`M2 mutante sin revisión borrador: probe independiente ${subject}`, async () => {
      const result = await contract({ migration: mutant("if v_vivos <> v_all then", "if false then", VOID_SIGNATURE, true),
        probe: `select pg_temp.m2_void_case('${subject}');` });
      console.info("0573_M2_MUTANT_ORIGINAL", JSON.stringify({ subject, notices: result.notices, nativeError: result.nativeError }));
      expect(result.error).toBe("TEST 0497: M2 void55000 por borrador: " + subject);
      expect(result.notices.some((notice) => String(notice.message ?? "").startsWith("0573_M2_RAW "))).toBe(true);
    }, SLOW);
  }

  for (const endpoint of ["original", "reverso"] as const) {
    it(`B1 mutante acepta excepción: probe auténtico independiente ${endpoint}`, async () => {
      const from = "  -- OLD o NEW, incluidos los dos extremos y participación inversa.";
      const changed = from + "\n  if tg_op='UPDATE' and public.excepcion_al_cierre_vigente(old.id) then return new; end if;";
      const result = await contract({ migration: mutant(from, changed, "public.i3_journal_entry_guard()", true),
        probe: `select pg_temp.m2b1_run('${endpoint}');` });
      console.info("0573_B1_MUTANT_ORIGINAL", JSON.stringify({ endpoint, notices: result.notices, nativeError: result.nativeError }));
      expect(result.error).toBe("TEST 0497: B1 excepción auténtica no autoriza extremo: " + endpoint);
      const witnesses = result.notices.map((notice) => String(notice.message ?? ""))
        .filter((message) => message.startsWith("0573_B1_AUTHENTIC_WITNESS "));
      expect(witnesses).toHaveLength(1);
      expect(JSON.parse(witnesses[0].slice("0573_B1_AUTHENTIC_WITNESS ".length))).toMatchObject({
        case: endpoint, observed: 1, matchCount: 1, nonceMatchesGuc: true, sameTxid: true, validator: true,
      });
    }, SLOW);
  }

  it("M3 oro: SQL en bandas ±1µs Caracas antes/después y dos COMMIT distintos", async () => {
    const result = await midnightContract();
    expect(result.error).toBeNull();
    expect(result.setupCommitted).toBe(true);
    expect(result.boundary).toBe("ADMITIDA POR SQL");
    expect(result.cleanupErrors).toEqual([]);
    expect(result.stages).toHaveLength(2);
    expect(result.stages.every((stage) => stage.committed && stage.endedTransaction)).toBe(true);
  }, SLOW);

  it("M3 mutante UTC: falla éxito público antes, conserva23514/contexto/rollback", async () => {
    const changed = mutant("v_hoy := (pg_catalog.now() at time zone 'America/Caracas')::date;",
      "v_hoy := (pg_catalog.now() at time zone 'UTC')::date;", VOID_SIGNATURE, true);
    const result = await midnightContract(changed);
    expect(result.error).toBe(MIDNIGHT_SUCCESS + "before");
    expect(result.setupCommitted).toBe(true);
    expect(result.cleanupErrors).toEqual([]);
    expect(result.stages).toHaveLength(1);
    const stage = result.stages[0];
    expect(BigInt(stage.sampleBefore!.epochUs)).toBeGreaterThanOrEqual(BigInt(MIDNIGHT_CASES[0].lowerUs));
    expect(BigInt(stage.sampleBefore!.epochUs)).toBeLessThanOrEqual(BigInt(MIDNIGHT_CASES[0].upperUs));
    expect(stage.attempt).toMatchObject({ ok: false, state: "23514",
      message: "El nuevo reverso no acredita un original íntegro." });
    expect(stage.attempt!.command).toContain("public.void_invoice_with_audit_reason");
    expect(stage.attempt!.context).toContain("i3_assert_new_entry");
    expect(stage.attempt!.context).toContain("i3_journal_entry_guard");
    expect(stage.afterRollback).toEqual(stage.before);
    expect(stage.endedTransaction).toBe(true);
    expect(stage.committed).not.toBe(true);
    expect(result.secondVoid).toBe("NO EJECUTADO: no se alcanzó");
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

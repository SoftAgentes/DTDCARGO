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
import { readdirSync, readFileSync } from "node:fs";
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

/**
 * D2/M4: el motivo se acota en el cuerpo. La cabecera lo restauraba sola ante un error
 * y el cuerpo no, así que cada salida se prueba con una sesión real: begin, savepoint y
 * rollback van por separado, sobre el fixture ya confirmado. El testigo anota el motivo
 * visible en cada escritura y puede forzar un error justo ahí.
 */
const TESTIGO_MOTIVO = `
create table public.i3b_testigo(n bigserial primary key, evento text not null, valor text);
create function public.i3b_testigo_ver() returns trigger language plpgsql security definer set search_path = public as $t$
begin
  if pg_catalog.current_setting('i3b.falla', true) = tg_table_name then
    raise exception 'I3B falla forzada';
  end if;
  insert into public.i3b_testigo(evento, valor)
  values (tg_table_name || ':' || tg_op, pg_catalog.current_setting('dtd.audit_reason', true));
  return coalesce(new, old);
end;
$t$;
create trigger i3b_testigo before insert on public.journal_lines for each row execute function public.i3b_testigo_ver();
create trigger i3b_testigo before insert on public.journal_entries for each row execute function public.i3b_testigo_ver();
create trigger i3b_testigo before update on public.invoices for each row execute function public.i3b_testigo_ver();
create function pg_temp.motivo_factura(p_label text, p_status text default 'emitida', p_total numeric default 100) returns uuid language sql as $f$
  insert into public.invoices(id,tenant_id,invoice_code,client_markbox,client_name,currency,
    base_amount,iva_amount,total_amount,paid_amount,status,issued_at)
  values(pg_temp.fixture_id('motivo-'||p_label),pg_temp.fixture_id('tenant-A'),'F-MOTIVO-'||p_label,'DTD-I3B','Cliente sintético','USD',
    p_total,0,p_total,0,p_status::public.invoice_status,date '2026-10-10')
  returning id
$f$;
create function pg_temp.motivo_post(p_label text) returns jsonb language sql as $f$
  select pg_temp.as_actor(null, format('select public.post_invoice_journal_entry_atomic(%L::uuid,%L::uuid)',
    pg_temp.fixture_id('tenant-A'), pg_temp.fixture_id('motivo-'||p_label)), 'service_role')
$f$;
create function pg_temp.motivo_anular(p_label text) returns jsonb language sql as $f$
  select pg_temp.as_actor('accounting-A', pg_temp.void_sql('motivo-'||p_label))
$f$;
`;
const ANULAR_ABIERTA = "select pg_temp.as_actor('accounting-A', pg_temp.void_sql('inv-abierta'));";
const ANULAR_BORRADOR = "select pg_temp.as_actor('accounting-A', pg_temp.void_sql('inv-borrador'));";
const FALLA_FORZADA = "I3B falla forzada";

async function conSesion(prueba: (db: PGlite, motivo: () => Promise<string | null>) => Promise<void>) {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    const fixture = readFileSync(CONTRACT, "utf8");
    expect(fixture.split(SEQUENTIAL_MARKER)).toHaveLength(2);
    await db.exec(inline(CONTRACT, { apply_fix: "true" }, {
      "0497_reverso_al_anular_factura.test.sql": fixture.slice(0, fixture.indexOf(SEQUENTIAL_MARKER)),
    }));
    await db.exec(TESTIGO_MOTIVO);
    await db.exec("commit;");
    expect(db.isInTransaction()).toBe(false);
    await prueba(db, async () => onlyRow<string | null>(
      await db.exec("select current_setting('dtd.audit_reason',true) as valor;"), "valor"));
  } finally {
    await db.close();
  }
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

  // A2: desde la 0497, una factura de antes cuya venta no cuadra no se puede actualizar.
  // scripts/qa/0497-legado-por-clase.sql las cuenta antes de aplicarla, con la misma
  // lógica; acá se compara ese conteo con la función real sobre las mismas filas.
  describe("el conteo de legado por clase", () => {
    const CONTEO = resolve(ROOT, "scripts/qa/0497-legado-por-clase.sql");
    const ANTES_DE_0497 = "\\if :apply_fix\n\\ir ../migrations/0497_reverso_al_anular_factura.sql";
    const MENSAJE_DE_CLASE: Record<string, string> = {
      factura_borrada_con_venta: "La relación contable de la factura requiere revisión.",
      dos_o_mas_ventas: "La relación contable de la factura requiere revisión.",
      venta_de_otro_tenant: "La venta original requiere revisión.",
      venta_en_borrador: "La venta original requiere revisión.",
      venta_anulada: "La venta original requiere revisión.",
      venta_borrada: "La venta original requiere revisión.",
      venta_sin_codigo: "La venta original requiere revisión.",
      venta_sin_fecha_de_asiento: "La venta original requiere revisión.",
      venta_con_fecha_invalida: "La venta original requiere revisión.",
      lineas_ninguna: "La venta original requiere revisión.",
      lineas_solo_una: "La venta original requiere revisión.",
      lineas_cuenta_no_clasificable: "La venta original requiere revisión.",
      lineas_importe_invalido: "La venta original requiere revisión.",
      lineas_sin_cxc_o_ingreso: "La venta original requiere revisión.",
      lineas_descuadradas: "La venta original requiere revisión.",
      anulada_sin_reverso: "Una factura anulada con venta requiere su reverso íntegro.",
      estado_sin_venta_posible: "Estado de factura y par contable incompatibles.",
      sana: "ok",
      sin_venta: "ok",
    };
    // Una factura por clase, con la venta armada para caer solo en esa. Fixture, antes de la 0497.
    const SEMBRAR = `
create function pg_temp.a2_factura(p_label text, p_status text default 'emitida', p_deleted timestamptz default null) returns uuid language sql as $f$
  insert into public.invoices(id,tenant_id,invoice_code,client_markbox,client_name,currency,
    base_amount,iva_amount,total_amount,paid_amount,status,issued_at,deleted_at)
  values(pg_temp.fixture_id('a2-'||p_label),pg_temp.fixture_id('tenant-A'),'F-A2-'||p_label,'DTD-I3B','Cliente sintético','USD',
    100,0,100,0,p_status::public.invoice_status,date '2026-10-10',p_deleted)
  returning id
$f$;
create function pg_temp.a2_venta(p_label text, p_entry text default null, p_status text default 'asentado', p_code text default null,
  p_deleted timestamptz default null, p_posted timestamptz default now(), p_tenant text default 'tenant-A') returns uuid language sql as $f$
  insert into public.journal_entries(id,tenant_id,entry_code,entry_date,memo,status,source,invoice_id,posted_at,deleted_at)
  values(pg_temp.fixture_id('a2-e-'||coalesce(p_entry,p_label)),pg_temp.fixture_id(p_tenant),
    coalesce(p_code,'A-A2-'||coalesce(p_entry,p_label)),date '2026-10-10','Venta sintética',p_status::public.entry_status,'invoice',
    pg_temp.fixture_id('a2-'||p_label),p_posted,p_deleted)
  returning id
$f$;
create function pg_temp.a2_linea(p_label text, p_cuenta text, p_debe numeric, p_haber numeric) returns void language sql as $f$
  insert into public.journal_lines(entry_id,account_id,debit,credit,line_memo)
  values(pg_temp.fixture_id('a2-e-'||p_label),pg_temp.fixture_id(p_cuenta),p_debe,p_haber,'Línea sintética')
$f$;
create function pg_temp.a2_buenas(p_label text) returns void language sql as $f$
  select pg_temp.a2_linea(p_label,'clientes',100,0); select pg_temp.a2_linea(p_label,'ventas',0,100);
$f$;
select pg_temp.a2_factura('borrada','emitida',now()); select pg_temp.a2_venta('borrada'); select pg_temp.a2_buenas('borrada');
select pg_temp.a2_factura('doble'); select pg_temp.a2_venta('doble','doble-1'); select pg_temp.a2_venta('doble','doble-2');
select pg_temp.a2_factura('tenant'); select pg_temp.a2_venta('tenant',null,'asentado',null,null,now(),'tenant-B'); select pg_temp.a2_buenas('tenant');
select pg_temp.a2_factura('borrador-v'); select pg_temp.a2_venta('borrador-v',null,'borrador',null,null,null); select pg_temp.a2_buenas('borrador-v');
select pg_temp.a2_factura('anulada-v'); select pg_temp.a2_venta('anulada-v',null,'anulado'); select pg_temp.a2_buenas('anulada-v');
select pg_temp.a2_factura('borrada-v'); select pg_temp.a2_venta('borrada-v',null,'asentado',null,now()); select pg_temp.a2_buenas('borrada-v');
select pg_temp.a2_factura('codigo'); select pg_temp.a2_venta('codigo',null,'asentado','   '); select pg_temp.a2_buenas('codigo');
select pg_temp.a2_factura('sin-fecha'); select pg_temp.a2_venta('sin-fecha',null,'asentado',null,null,null); select pg_temp.a2_buenas('sin-fecha');
select pg_temp.a2_factura('infinita'); select pg_temp.a2_venta('infinita',null,'asentado',null,null,'infinity'); select pg_temp.a2_buenas('infinita');
select pg_temp.a2_factura('ninguna'); select pg_temp.a2_venta('ninguna');
select pg_temp.a2_factura('una'); select pg_temp.a2_venta('una'); select pg_temp.a2_linea('una','clientes',100,0);
select pg_temp.a2_factura('cuenta'); select pg_temp.a2_venta('cuenta'); select pg_temp.a2_linea('cuenta','caja',100,0); select pg_temp.a2_linea('cuenta','ventas',0,100);
select pg_temp.a2_factura('importe'); select pg_temp.a2_venta('importe'); select pg_temp.a2_linea('importe','clientes',0,100); select pg_temp.a2_linea('importe','ventas',100,0);
select pg_temp.a2_factura('sin-cxc'); select pg_temp.a2_venta('sin-cxc'); select pg_temp.a2_linea('sin-cxc','ventas',0,50); select pg_temp.a2_linea('sin-cxc','ventas',0,50);
select pg_temp.a2_factura('descuadre'); select pg_temp.a2_venta('descuadre'); select pg_temp.a2_linea('descuadre','clientes',100,0); select pg_temp.a2_linea('descuadre','ventas',0,90);
select pg_temp.a2_factura('anulada','anulada'); select pg_temp.a2_venta('anulada'); select pg_temp.a2_buenas('anulada');
select pg_temp.a2_factura('estado','borrador'); select pg_temp.a2_venta('estado'); select pg_temp.a2_buenas('estado');
select pg_temp.a2_factura('sana'); select pg_temp.a2_venta('sana'); select pg_temp.a2_buenas('sana');
select pg_temp.a2_factura('sin-venta');
`;
    async function sobreFixtureSinLa0497(prueba: (db: PGlite) => Promise<void>) {
      const db = new PGlite({ extensions: { pgcrypto } });
      try {
        const fixture = readFileSync(CONTRACT, "utf8");
        expect(fixture.split(ANTES_DE_0497)).toHaveLength(2);
        await db.exec(inline(CONTRACT, { apply_fix: "false" }, {
          "0497_reverso_al_anular_factura.test.sql": fixture.slice(0, fixture.indexOf(ANTES_DE_0497)),
        }));
        await db.exec("commit;");
        await prueba(db);
      } finally {
        await db.close();
      }
    }
    const contar = async (db: PGlite) => {
      const filas = (await db.exec(inline(CONTEO, {})))
        .flatMap((result) => result.rows as { clase?: string; estado_factura?: string; n?: number | string }[])
        .filter((fila) => fila.clase !== undefined);
      const total: Record<string, number> = {};
      for (const fila of filas) total[fila.clase!] = (total[fila.clase!] ?? 0) + Number(fila.n);
      expect(db.isInTransaction()).toBe(false);
      return total;
    };

    it("cada clase suma una fila y su conteo coincide con la función real", async () => {
      await sobreFixtureSinLa0497(async (db) => {
        const antes = await contar(db);
        await db.exec(SEMBRAR);
        const despues = await contar(db);
        for (const clase of Object.keys(MENSAJE_DE_CLASE)) {
          expect([clase, (despues[clase] ?? 0) - (antes[clase] ?? 0)]).toEqual([clase, 1]);
        }
        expect(Object.keys(despues).filter((clase) => !(clase in MENSAJE_DE_CLASE))).toEqual([]);

        await db.exec(FILE_0497);
        await db.exec(`do $real$
declare f record; v_mensaje text;
begin
  create temporary table a2_real(mensaje text not null);
  for f in select id from public.invoices loop
    begin
      perform public.i3_assert_invoice_final(f.id);
      insert into a2_real values ('ok');
    exception when check_violation then
      get stacked diagnostics v_mensaje = message_text;
      insert into a2_real values (v_mensaje);
    end;
  end loop;
end;
$real$;`);
        const porMensaje = (await db.query<{ mensaje: string; n: number }>(
          "select mensaje, count(*)::int as n from a2_real group by mensaje order by mensaje")).rows;
        const esperado: Record<string, number> = {};
        for (const [clase, n] of Object.entries(despues)) {
          esperado[MENSAJE_DE_CLASE[clase]] = (esperado[MENSAJE_DE_CLASE[clase]] ?? 0) + n;
        }
        expect(Object.fromEntries(porMensaje.map((fila) => [fila.mensaje, fila.n]))).toEqual(esperado);
      });
    }, SLOW);

    it("con la 0497 aplicada, el conteo se niega en vez de contar mal", async () => {
      await sobreFixtureSinLa0497(async (db) => {
        await db.exec(FILE_0497);
        await expect(contar(db)).rejects.toThrow("Este conteo es de antes de la 0497");
        if (db.isInTransaction()) await db.exec("rollback;");
      });
    }, SLOW);

    // Decisión de Sam, 2026-11-02, «Sí, quítalo»: toda escritura de una factura o de un asiento
    // con factura afirma el par al confirmar. Sustituye al filtro del 2026-11-01, que existía para
    // no congelar las facturas de antes; las de producción ya no existen.
    const UNA_VENTA_ANULADA = "pg_temp.fixture_id('a2-anulada-v')";
    const confirmar = async (db: PGlite, ...sentencias: string[]) => {
      await db.exec("begin;");
      for (const sentencia of sentencias) await db.exec(sentencia);
      await db.exec("commit;");
    };
    const confirmarFalla = async (db: PGlite, mensaje: string, ...sentencias: string[]) => {
      await db.exec("begin;");
      for (const sentencia of sentencias) await db.exec(sentencia);
      await expect(db.exec("commit;")).rejects.toThrow(mensaje);
      expect(db.isInTransaction()).toBe(false);
    };

    it("el mecanismo: tras la 0497, actualizar una factura de legado falla al confirmar", async () => {
      await sobreFixtureSinLa0497(async (db) => {
        await db.exec(SEMBRAR);
        const CREDITO = (factura: string, entry: string, code: string) => `insert into public.journal_entries(id,tenant_id,entry_code,entry_date,memo,status,source,invoice_id,posted_at)
values(pg_temp.fixture_id('${entry}'),pg_temp.fixture_id('tenant-A'),'${code}',date '2026-10-10','Crédito sintético','asentado','referral_credit',pg_temp.fixture_id('${factura}'),now());`;
        await db.exec(`
select pg_temp.a2_factura('credito','anulada');
select pg_temp.a2_venta('credito',null,'anulado');
select pg_temp.a2_buenas('credito');
${CREDITO("a2-credito", "a2-e-credito-r", "A-A2-CR")}
select pg_temp.a2_buenas('credito-r');
${CREDITO("a2-sana", "a2-e-sana-cr", "A-A2-SCR")}
select pg_temp.a2_buenas('sana-cr');`);
        await db.exec(FILE_0497);
        for (const [label, mensaje] of [
          ["anulada-v", "La venta original requiere revisión."],
          ["doble", "La relación contable de la factura requiere revisión."],
          ["anulada", "Una factura anulada con venta requiere su reverso íntegro."],
          ["tenant", "La venta original requiere revisión."],
          ["credito", "La venta original requiere revisión."],
        ]) {
          await confirmarFalla(db, mensaje, `update public.invoices set client_markbox = 'DTD-NUEVA', paid_amount = paid_amount where id = pg_temp.fixture_id('a2-${label}');`);
        }
        // El asiento del crédito no cambia el par, pero afirma igual.
        await confirmarFalla(db, "La venta original requiere revisión.", "update public.journal_entries set status = 'anulado' where id = pg_temp.fixture_id('a2-e-credito-r');");
        // Una factura sana pasa por lo mismo: el cambio, el cobro y el asiento de su crédito.
        const SANA = "pg_temp.fixture_id('a2-sana')";
        await confirmar(db, `update public.invoices set client_markbox = 'DTD-NUEVA', paid_amount = paid_amount where id = ${SANA};`);
        await confirmar(db, `update public.invoices set paid_amount = 10, status = 'parcial' where id = ${SANA};`);
        await confirmar(db, `update public.invoices set paid_amount = 100, status = 'pagada' where id = ${SANA};`);
        await confirmar(db, "update public.journal_entries set status = 'anulado' where id = pg_temp.fixture_id('a2-e-sana-cr');");
        expect(onlyRow<string>(await db.exec(`select status::text as valor from public.invoices where id = ${SANA};`), "valor")).toBe("pagada");
      });
    }, SLOW);

    // Ninguna clase se cobra: el cobro falla al confirmar y la factura queda como estaba.
    it.each(["doble", "tenant", "borrador-v", "anulada-v", "borrada-v", "codigo", "sin-fecha", "infinita",
      "ninguna", "una", "cuenta", "importe", "sin-cxc", "descuadre"])(
      "la factura viva «%s», cuya venta no cuadra, no se cobra", async (label) => {
        await sobreFixtureSinLa0497(async (db) => {
          await db.exec(SEMBRAR);
          await db.exec(FILE_0497);
          const factura = `pg_temp.fixture_id('a2-${label}')`;
          await confirmarFalla(db, "requiere revisión", `update public.invoices set paid_amount = 10, status = 'parcial' where id = ${factura};`);
          expect(onlyRow<string>(await db.exec(`select status::text as valor from public.invoices where id = ${factura};`), "valor")).toBe("emitida");
        });
      }, SLOW,
    );

    // El control: con cada parte del filtro de vuelta, lo de arriba deja de fallar.
    const VUELVE_FACTURA = `  if tg_op = 'UPDATE'
     and new.id is not distinct from old.id
     and new.tenant_id is not distinct from old.tenant_id
     and new.deleted_at is not distinct from old.deleted_at
     and (new.status is not distinct from old.status
       or (old.status::text in ('emitida','parcial','vencida','pagada')
         and new.status::text in ('emitida','parcial','vencida','pagada'))) then
    return null;
  end if;
`;
    const VUELVE_ASIENTO = `  if (tg_op = 'INSERT' or (old.source in ('invoice','invoice_reversal') or old.reverses_entry_id is not null) is not true)
     and (tg_op = 'DELETE' or (new.source in ('invoice','invoice_reversal') or new.reverses_entry_id is not null) is not true) then
    return null;
  end if;
`;
    it("mutante: con el filtro de la factura de vuelta, una venta anulada se cobra", async () => {
      const desde = "  if tg_op <> 'INSERT' then perform public.i3_assert_invoice_final(old.id); end if;\n";
      await sobreFixtureSinLa0497(async (db) => {
        await db.exec(SEMBRAR);
        await db.exec(mutant(desde, VUELVE_FACTURA + desde, "public.i3_invoice_final()", true));
        await confirmar(db, `update public.invoices set paid_amount = 10, status = 'parcial' where id = ${UNA_VENTA_ANULADA};`);
        expect(onlyRow<string>(await db.exec(`select status::text as valor from public.invoices where id = ${UNA_VENTA_ANULADA};`), "valor")).toBe("parcial");
      });
    }, SLOW);

    it("mutante: con el filtro del asiento de vuelta, el crédito de una factura de legado se anula", async () => {
      const desde = "  if tg_op <> 'INSERT' then perform public.i3_assert_invoice_final(old.invoice_id); end if;\n";
      await sobreFixtureSinLa0497(async (db) => {
        await db.exec(SEMBRAR);
        await db.exec(`
select pg_temp.a2_factura('credito','anulada');
select pg_temp.a2_venta('credito',null,'anulado');
select pg_temp.a2_buenas('credito');
insert into public.journal_entries(id,tenant_id,entry_code,entry_date,memo,status,source,invoice_id,posted_at)
values(pg_temp.fixture_id('a2-e-credito-r'),pg_temp.fixture_id('tenant-A'),'A-A2-CR',date '2026-10-10','Crédito sintético','asentado','referral_credit',pg_temp.fixture_id('a2-credito'),now());
select pg_temp.a2_buenas('credito-r');`);
        await db.exec(mutant(desde, VUELVE_ASIENTO + desde, "public.i3_journal_entry_final()", true));
        await confirmar(db, "update public.journal_entries set status = 'anulado' where id = pg_temp.fixture_id('a2-e-credito-r');");
      });
    }, SLOW);

    // La puerta: lo que la aserción rechaza frena el apply, y nada más.
    it("el conteo marca FRENA toda clase que la aserción rechaza, y solo esas", async () => {
      await sobreFixtureSinLa0497(async (db) => {
        await db.exec(SEMBRAR);
        const filas = (await db.exec(inline(CONTEO, {})))
          .flatMap((result) => result.rows as { clase?: string; puerta?: string }[])
          .filter((fila) => fila.clase !== undefined);
        expect(filas.length).toBeGreaterThan(2);
        for (const fila of filas) {
          expect([fila.clase, fila.puerta]).toEqual([fila.clase, MENSAJE_DE_CLASE[fila.clase!] === "ok" ? "pasa" : "FRENA"]);
        }
      });
    }, SLOW);

    // El control posterior ve lo que nadie toca: una factura sin asientos, o una venta que quedó
    // inválida por un cambio en accounts. Tocarla ya falla; dejarla quieta no avisa.
    const CONTROL = resolve(ROOT, "scripts/qa/0497-control-posterior.sql");
    const MENSAJE_DEL_CONTROL: Record<string, string> = {
      ...MENSAJE_DE_CLASE,
      reverso_sin_venta: "La relación contable de la factura requiere revisión.",
      otros_asientos_en_el_par: "La relación contable de la factura requiere revisión.",
      par_de_anulacion_invalido: "El par de anulación requiere revisión.",
      sana_anulada_con_reverso: "ok",
    };
    const ledgerEn = (hora: string) => `create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations(version text primary key, name text);
insert into supabase_migrations.schema_migrations values
  (to_char(${hora} at time zone 'UTC','YYYYMMDDHH24MISS'),'0497_reverso_al_anular_factura');`;
    const LEDGER = ledgerEn("clock_timestamp()");
    const leerControl = async (db: PGlite) => (await db.exec(inline(CONTROL, {})))
      .flatMap((result) => result.rows as { clase?: string; estado_factura?: string; diagnostico?: string; n?: number | string }[])
      .filter((fila) => fila.clase !== undefined)
      .map((fila) => ({ clase: fila.clase!, estado: fila.estado_factura!, diagnostico: fila.diagnostico!, n: Number(fila.n) }));
    const realPorMensaje = async (db: PGlite) => {
      await db.exec(`do $real$
declare f record; v_mensaje text;
begin
  create temporary table if not exists a2_real(mensaje text not null);
  truncate a2_real;
  for f in select id from public.invoices loop
    begin
      perform public.i3_assert_invoice_final(f.id);
      insert into a2_real values ('ok');
    exception when check_violation then
      get stacked diagnostics v_mensaje = message_text;
      insert into a2_real values (v_mensaje);
    end;
  end loop;
end;
$real$;`);
      return Object.fromEntries((await db.query<{ mensaje: string; n: number }>(
        "select mensaje, count(*)::int as n from a2_real group by mensaje")).rows.map((fila) => [fila.mensaje, fila.n]));
    };
    const esperar = (ms: number) => new Promise((listo) => { setTimeout(listo, ms); });

    it("el control posterior coincide con la aserción real y da un diagnóstico por fila", async () => {
      await sobreFixtureSinLa0497(async (db) => {
        await db.exec(SEMBRAR);
        await db.exec(FILE_0497);
        await esperar(1100);
        await db.exec(LEDGER);
        await esperar(1100);
        // Una anulación de la 0497, con su reverso.
        await confirmar(db, "select set_config('request.jwt.claim.sub', pg_temp.fixture_id('accounting-A')::text, true);",
          "set local role authenticated;",
          "select public.void_invoice_with_audit_reason(pg_temp.fixture_id('a2-sana'), 'Motivo sintético del control');");
        // Sin asiento y con fechas de después del apply: lo que deja la web vieja.
        await db.exec(`insert into public.invoices(id,tenant_id,invoice_code,client_markbox,client_name,currency,base_amount,iva_amount,total_amount,paid_amount,status,issued_at)
          values(pg_temp.fixture_id('a2-ventana'),pg_temp.fixture_id('tenant-A'),'F-A2-VENTANA','DTD-I3B','Cliente sintético','USD',100,0,100,0,'emitida',(now() at time zone 'America/Caracas')::date);`);
        const filas = await leerControl(db);
        expect(db.isInTransaction()).toBe(false);
        const de = (clase: string, estado: string) => filas.find((fila) => fila.clase === clase && fila.estado === estado);
        expect(filas.filter((fila) => fila.diagnostico === "sin_venta_fechas_viejas").map((fila) => fila.estado)).toContain("emitida");
        expect(filas.filter((fila) => fila.diagnostico === "sin_venta_fechas_recientes")).toEqual(
          [{ clase: "sin_venta", estado: "emitida", diagnostico: "sin_venta_fechas_recientes", n: 1 }]);
        expect(de("venta_anulada", "emitida")).toMatchObject({ diagnostico: "viva_no_cuadra" });
        expect(de("dos_o_mas_ventas", "emitida")).toMatchObject({ diagnostico: "viva_no_cuadra" });
        expect(de("sana_anulada_con_reverso", "anulada")).toMatchObject({ diagnostico: "cuadra" });
        expect(de("anulada_sin_reverso", "anulada")).toMatchObject({ diagnostico: "no_viva_no_cuadra" });
        expect(filas.map((fila) => fila.clase)).not.toContain("venta_invalida_sin_clasificar");
        const esperado: Record<string, number> = {};
        for (const fila of filas) {
          const mensaje = MENSAJE_DEL_CONTROL[fila.clase];
          expect([fila.clase, mensaje === undefined]).toEqual([fila.clase, false]);
          esperado[mensaje] = (esperado[mensaje] ?? 0) + fila.n;
        }
        expect(await realPorMensaje(db)).toEqual(esperado);
      });
    }, SLOW);

    // Las etiquetas dicen cómo está la fila, no de dónde vino. Estos casos son la razón.
    // La hora va fija: el control usa la fecha de Caracas del apply, y `current_date` es la de la sesión, que en el CI
    // es UTC: de 00:00Z a 04:00Z su ayer es el hoy de Caracas. El apply va después de lo sembrado, emitido el 2026-10-10,
    // y antes de cualquier now(): al tocar una factura, su `updated_at` real siempre queda después del apply.
    it.each([
      { franja: "antes de la medianoche UTC", apply: "2026-10-20 23:30:00+00", hoy: "2026-10-20" },
      { franja: "entre la medianoche UTC y la de Caracas", apply: "2026-10-21 03:30:00+00", hoy: "2026-10-20" },
      { franja: "después de la medianoche de Caracas", apply: "2026-10-21 04:30:00+00", hoy: "2026-10-21" },
    ])("el diagnóstico no es procedencia: las fechas fallan en los dos sentidos, $franja", async ({ apply, hoy }) => {
      await sobreFixtureSinLa0497(async (db) => {
        await db.exec(SEMBRAR);
        const antesDelApply = `timestamptz '${apply}' - interval '1 hour'`;
        const despuesDelApply = `timestamptz '${apply}' + interval '1 hour'`;
        const factura = (label: string, emision: string, hora: string) => `insert into public.invoices(id,tenant_id,invoice_code,client_markbox,client_name,currency,base_amount,iva_amount,total_amount,paid_amount,status,issued_at,created_at,updated_at)
          values(pg_temp.fixture_id('${label}'),pg_temp.fixture_id('tenant-A'),'F-${label}','DTD-I3B','Cliente sintético','USD',100,0,100,0,'emitida',${emision},${hora},${hora});`;
        await db.exec(factura("a2-hoy-antes", `date '${hoy}'`, antesDelApply));
        await db.exec(FILE_0497);
        await db.exec(ledgerEn(`timestamptz '${apply}'`));
        const viejas = (filas: Awaited<ReturnType<typeof leerControl>>) =>
          filas.find((fila) => fila.clase === "sin_venta" && fila.estado === "emitida" && fila.diagnostico === "sin_venta_fechas_viejas")?.n ?? 0;
        const antes = await leerControl(db);
        expect(antes.filter((fila) => fila.diagnostico === "sin_venta_fechas_recientes")).toEqual([]);
        // Emitida antes del apply y tocada después: sale con fechas recientes.
        await db.exec("update public.invoices set notes = 'Tocada', updated_at = now() where id = pg_temp.fixture_id('a2-hoy-antes');");
        // Emitida después del apply con fecha anterior: sale con fechas viejas.
        await db.exec(factura("a2-ayer", `date '${hoy}' - 1`, despuesDelApply));
        const despues = await leerControl(db);
        expect(despues.filter((fila) => fila.diagnostico === "sin_venta_fechas_recientes")).toEqual(
          [{ clase: "sin_venta", estado: "emitida", diagnostico: "sin_venta_fechas_recientes", n: 1 }]);
        expect(viejas(despues) - viejas(antes)).toBe(0); // Una salió de viejas y otra entró.
      });
    }, SLOW);

    it("el diagnóstico no es procedencia: una venta sana se invalida desde accounts, deja de cobrarse y se repara", async () => {
      await sobreFixtureSinLa0497(async (db) => {
        await db.exec(SEMBRAR);
        await db.exec(FILE_0497);
        await db.exec(LEDGER);
        const factura = "pg_temp.fixture_id('a2-sana')";
        const COBRO = `update public.invoices set paid_amount = 100, status = 'pagada' where id = ${factura};`;
        const estado = async () => onlyRow<string>(await db.exec(`select status::text as valor from public.invoices where id = ${factura};`), "valor");
        await db.exec(`select public.i3_assert_invoice_final(${factura});`);
        const antes = await leerControl(db);
        expect(antes.find((fila) => fila.clase === "sana" && fila.estado === "emitida")).toMatchObject({ diagnostico: "cuadra" });
        await db.exec("update public.accounts set is_postable = false where id = pg_temp.fixture_id('ventas');");
        const despues = await leerControl(db);
        expect(despues.find((fila) => fila.clase === "sana" && fila.estado === "emitida")).toBeUndefined();
        expect(despues.find((fila) => fila.clase === "lineas_cuenta_no_clasificable" && fila.estado === "emitida"))
          .toMatchObject({ diagnostico: "viva_no_cuadra" });
        await expect(db.exec(`select public.i3_assert_invoice_final(${factura});`)).rejects.toThrow("La venta original requiere revisión.");
        await confirmarFalla(db, "La venta original requiere revisión.", COBRO);
        expect(await estado()).toBe("emitida");
        // Se repara volviendo el valor: las líneas no cambiaron.
        await db.exec("update public.accounts set is_postable = true where id = pg_temp.fixture_id('ventas');");
        await confirmar(db, COBRO);
        expect(await estado()).toBe("pagada");
      });
    }, SLOW);

    // aplicar.sql agrega la fila del ledger DESPUÉS del archivo. Si el archivo suelta los límites,
    // esa fila y el COMMIT esperan sin límite con los locks tomados. Aquí se leen en los dos puntos:
    // el COMMIT, con un disparador diferido. El bloqueo de verdad va en prueba-0497-rol-real.mjs.
    const LIMITES = "select current_setting('lock_timeout') as lock_t, current_setting('statement_timeout') as stmt_t";
    const limitesDe = async (migracion: string) => {
      let leidos: { sesion: unknown; ledger: unknown; alConfirmar: unknown; despues: unknown } | undefined;
      await sobreFixtureSinLa0497(async (db) => {
        // Valores propios: el fixture ya dejó en la sesión los 5 s y 30 s de otra migración con `set`.
        await db.exec("set lock_timeout = '7s'; set statement_timeout = '77s';");
        const sesion = (await db.query(LIMITES)).rows[0];
        await db.exec(`begin;
${migracion}
create table public.z_limites(punto text primary key, lock_t text, stmt_t text);
create function public.z_limites_leer() returns trigger language plpgsql as $z$
begin
  insert into public.z_limites select 'al_confirmar', current_setting('lock_timeout'), current_setting('statement_timeout');
  return null;
end;
$z$;
create constraint trigger z_al_confirmar after insert on public.z_limites deferrable initially deferred
  for each row when (new.punto = 'ledger') execute function public.z_limites_leer();
insert into public.z_limites select 'ledger', current_setting('lock_timeout'), current_setting('statement_timeout');
commit;`);
        const fila = async (punto: string) => (await db.query(`select lock_t, stmt_t from public.z_limites where punto = '${punto}'`)).rows[0];
        leidos = { sesion, ledger: await fila("ledger"), alConfirmar: await fila("al_confirmar"), despues: (await db.query(LIMITES)).rows[0] };
      });
      return leidos!;
    };
    const LIMITES_0497 = { lock_t: "5s", stmt_t: "30s" };

    it("los límites valen para la fila del ledger y el COMMIT, y no quedan en la sesión", async () => {
      const { sesion, ledger, alConfirmar, despues } = await limitesDe(FILE_0497);
      expect(ledger).toEqual(LIMITES_0497);
      expect(alConfirmar).toEqual(LIMITES_0497);
      expect(sesion).not.toEqual(LIMITES_0497);
      expect(despues).toEqual(sesion);
    }, SLOW);

    const SET_LOCK = "set local lock_timeout = '5s'; -- local: valen hasta el COMMIT, también para la fila del ledger\n";
    const SET_STMT = "set local statement_timeout = '30s';\n";
    const CON_RESET = (texto: string, ...parametros: string[]) => texto + parametros.map((p) => `\nreset ${p};`).join("") + "\n";
    const SIN_LOCAL = () => mutant(SET_LOCK, "set lock_timeout = '5s';\n").split(SET_STMT).join("set statement_timeout = '30s';\n");
    it.each([
      ["como estaba: set sin local y reset al final", () => CON_RESET(SIN_LOCAL(), "statement_timeout", "lock_timeout"), "ledger"],
      ["reset de los dos", () => CON_RESET(FILE_0497, "statement_timeout", "lock_timeout"), "ledger"],
      ["reset solo de lock_timeout", () => CON_RESET(FILE_0497, "lock_timeout"), "ledger"],
      ["reset solo de statement_timeout", () => CON_RESET(FILE_0497, "statement_timeout"), "ledger"],
      ["sin el límite de locks", () => mutant(SET_LOCK, ""), "ledger"],
      ["sin el límite de sentencia", () => mutant(SET_STMT, ""), "ledger"],
      ["set sin local: los límites se quedan en la sesión", SIN_LOCAL, "despues"],
    ] as const)("mutante de los límites, %s: muere", async (_nombre, armar, punto) => {
      const { sesion, ledger, alConfirmar, despues } = await limitesDe(armar());
      if (punto === "ledger") {
        expect(ledger).not.toEqual(LIMITES_0497);
        expect(alConfirmar).not.toEqual(LIMITES_0497);
      } else {
        expect(ledger).toEqual(LIMITES_0497);
        expect(despues).not.toEqual(sesion);
      }
    }, SLOW);

    it("cada clase del control posterior coincide con la del conteo previo", async () => {
      await sobreFixtureSinLa0497(async (db) => {
        await db.exec(SEMBRAR);
        const antes = await contar(db);
        await db.exec(FILE_0497);
        await db.exec(LEDGER);
        const despues: Record<string, number> = {};
        for (const fila of await leerControl(db)) despues[fila.clase] = (despues[fila.clase] ?? 0) + fila.n;
        expect(despues).toEqual(antes);
      });
    }, SLOW);

    it("el control posterior se niega sin la 0497, o si la 0497 no está en el ledger", async () => {
      await sobreFixtureSinLa0497(async (db) => {
        await expect(leerControl(db)).rejects.toThrow("Este control es de después de la 0497");
        if (db.isInTransaction()) await db.exec("rollback;");
        await db.exec(FILE_0497);
        await db.exec("create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations(version text primary key, name text);");
        await expect(leerControl(db)).rejects.toThrow("La 0497 no está en el ledger");
        if (db.isInTransaction()) await db.exec("rollback;");
      });
    }, SLOW);

    it("una factura de legado sigue sin poder cambiar lo que importa", async () => {
      await sobreFixtureSinLa0497(async (db) => {
        await db.exec(SEMBRAR);
        await db.exec("select pg_temp.a2_factura('borrador-anulada','borrador'); select pg_temp.a2_venta('borrador-anulada',null,'anulado'); select pg_temp.a2_buenas('borrador-anulada');");
        await db.exec(FILE_0497);
        // Hacia anulada, desde borrador y hacia borrador: pasan por la aserción al confirmar.
        await confirmarFalla(db, "La venta original requiere revisión.", `update public.invoices set status = 'anulada' where id = ${UNA_VENTA_ANULADA};`);
        await confirmarFalla(db, "La venta original requiere revisión.", "update public.invoices set status = 'emitida' where id = pg_temp.fixture_id('a2-borrador-anulada');");
        await confirmarFalla(db, "La venta original requiere revisión.", `update public.invoices set status = 'borrador' where id = ${UNA_VENTA_ANULADA};`);
        // Reabrir y borrar: los frena la guarda de fila, antes de llegar al final.
        await expect(db.exec("update public.invoices set status = 'emitida' where id = pg_temp.fixture_id('a2-anulada');"))
          .rejects.toThrow("No se desvincula ni reabre una factura con asiento automático.");
        await expect(db.exec(`update public.invoices set deleted_at = now() where id = ${UNA_VENTA_ANULADA};`))
          .rejects.toThrow("No se desvincula ni reabre una factura con asiento automático.");
        await expect(db.exec(`delete from public.invoices where id = ${UNA_VENTA_ANULADA};`))
          .rejects.toThrow("No se desvincula ni reabre una factura con asiento automático.");
      });
    }, SLOW);

    it("sin la guarda de fila, el final sigue frenando reabrir, borrar y cambiar de tenant", async () => {
      await sobreFixtureSinLa0497(async (db) => {
        await db.exec(SEMBRAR);
        await db.exec("select pg_temp.a2_factura('anulada-anulada','anulada'); select pg_temp.a2_venta('anulada-anulada',null,'anulado'); select pg_temp.a2_buenas('anulada-anulada');");
        await db.exec(FILE_0497);
        await db.exec("alter table public.invoices disable trigger i3_invoice_guard;");
        await confirmarFalla(db, "La venta original requiere revisión.", "update public.invoices set status = 'emitida' where id = pg_temp.fixture_id('a2-anulada-anulada');");
        await confirmarFalla(db, "La relación contable de la factura requiere revisión.", "update public.invoices set deleted_at = now() where id = pg_temp.fixture_id('a2-sana');");
        await confirmarFalla(db, "La venta original requiere revisión.", "update public.invoices set tenant_id = pg_temp.fixture_id('tenant-B') where id = pg_temp.fixture_id('a2-sana');");
      });
    }, SLOW);

    it("una factura sana sigue frenada al anularla sin reverso o al volverla borrador", async () => {
      await sobreFixtureSinLa0497(async (db) => {
        await db.exec(SEMBRAR);
        await db.exec(FILE_0497);
        await confirmarFalla(db, "Una factura anulada con venta requiere su reverso íntegro.", "update public.invoices set status = 'anulada' where id = pg_temp.fixture_id('a2-sana');");
        await confirmarFalla(db, "Estado de factura y par contable incompatibles.", "update public.invoices set status = 'borrador' where id = pg_temp.fixture_id('a2-sana');");
      });
    }, SLOW);

    // Lo que la conducta no alcanza a mostrar: una factura recién insertada o borrada no
    // tiene asientos que contar, y el FK impide cambiarle el id a una que los tenga. Con
    // un espía en la aserción, se comprueba a quién llama cada operación.
    const ESPIA = `
create table public.i3b_espia(id uuid);
create or replace function public.i3_assert_invoice_final(p_invoice_id uuid) returns void language sql security definer set search_path = '' as $f$
  insert into public.i3b_espia values (p_invoice_id);
$f$;
alter table public.invoices disable trigger i3_invoice_guard;
alter table public.journal_entries disable trigger i3_journal_entry_guard;
alter table public.journal_entries drop constraint journal_entries_reverso_coherente;`;
    const llamadas = async (db: PGlite, sentencia: string) => {
      await db.exec("truncate public.i3b_espia;");
      await confirmar(db, sentencia);
      return (await db.query<{ n: number }>("select count(*)::int as n from public.i3b_espia")).rows[0].n;
    };
    const FACTURA = "pg_temp.fixture_id('a2-sana')";
    const ESTADO = (label: string, status: string) =>
      `update public.invoices set status = '${status}' where id = pg_temp.fixture_id('a2-${label}');`;
    it.each([
      ["INSERT", "select pg_temp.a2_factura('espia-nueva');", 1],
      ["DELETE", "delete from public.invoices where id = pg_temp.fixture_id('a2-sin-venta');", 1],
      ["id", `update public.invoices set id = pg_temp.fixture_id('a2-sin-venta-2') where id = pg_temp.fixture_id('a2-espia-sin-venta');`, 2],
      ["tenant", `update public.invoices set tenant_id = pg_temp.fixture_id('tenant-B') where id = ${FACTURA};`, 2],
      ["deleted_at", `update public.invoices set deleted_at = now() where id = ${FACTURA};`, 2],
      ["emitida a anulada", ESTADO("sana", "anulada"), 2],
      ["emitida a borrador", ESTADO("sana", "borrador"), 2],
      ["anulada a emitida", ESTADO("anulada", "emitida"), 2],
      ["borrador a emitida", ESTADO("estado", "emitida"), 2],
      ["borrador a anulada", ESTADO("estado", "anulada"), 2],
      ["anulada a borrador", ESTADO("anulada", "borrador"), 2],
      ["otra columna", `update public.invoices set paid_amount = 1 where id = ${FACTURA};`, 2],
      ["sin cambio de estado en una anulada", "update public.invoices set paid_amount = 1 where id = pg_temp.fixture_id('a2-anulada');", 2],
      ["emitida a parcial", ESTADO("sana", "parcial"), 2],
      ["emitida a pagada", ESTADO("sana", "pagada"), 2],
      ["emitida a vencida", ESTADO("sana", "vencida"), 2],
    ])("la factura afirma en todo cambio: %s", async (_name, sentencia, esperadas) => {
      await sobreFixtureSinLa0497(async (db) => {
        await db.exec(SEMBRAR);
        await db.exec("select pg_temp.a2_factura('espia-sin-venta');");
        await db.exec(FILE_0497);
        await db.exec(ESPIA);
        expect(await llamadas(db, sentencia)).toBe(esperadas);
      });
    }, SLOW);

    const ASIENTO = (label: string, source: string, reverso = "null") => `insert into public.journal_entries
      (id,tenant_id,entry_code,entry_date,memo,status,source,invoice_id,reverses_entry_id,posted_at)
      values(pg_temp.fixture_id('a2-esp-${label}'),pg_temp.fixture_id('tenant-A'),'A-ESP-${label}',date '2026-10-10','Espía','asentado','${source}',
        pg_temp.fixture_id('a2-sana'),${reverso},now());`;
    const VENTA_SANA = "pg_temp.fixture_id('a2-e-sana')";
    it.each([
      ["insertar una venta", ASIENTO("v", "invoice"), 1],
      ["insertar un reverso", ASIENTO("r", "invoice_reversal"), 1],
      ["insertar con reverses_entry_id", ASIENTO("c", "manual", VENTA_SANA), 1],
      ["insertar un manual", ASIENTO("m", "manual"), 1],
      ["insertar un crédito", ASIENTO("x", "referral_credit"), 1],
      ["tocar una venta", `update public.journal_entries set memo = 'x' where id = ${VENTA_SANA};`, 2],
      ["borrar una venta", `delete from public.journal_entries where id = ${VENTA_SANA};`, 1],
      ["una venta deja de serlo", `update public.journal_entries set source = 'manual' where id = ${VENTA_SANA};`, 2],
      ["un manual pasa a venta", "update public.journal_entries set source = 'invoice' where id = pg_temp.fixture_id('a2-esp-previo');", 2],
      ["un manual deja de tener reverses_entry_id", "update public.journal_entries set reverses_entry_id = null where id = pg_temp.fixture_id('a2-esp-previo-r');", 2],
      ["un manual pasa a tener reverses_entry_id", `update public.journal_entries set reverses_entry_id = ${VENTA_SANA} where id = pg_temp.fixture_id('a2-esp-previo');`, 2],
      ["tocar un manual", "update public.journal_entries set memo = 'x' where id = pg_temp.fixture_id('a2-esp-previo');", 2],
      ["borrar un manual", "delete from public.journal_entries where id = pg_temp.fixture_id('a2-esp-previo');", 1],
    ])("el asiento con factura afirma en todo cambio: %s", async (_name, sentencia, esperadas) => {
      await sobreFixtureSinLa0497(async (db) => {
        await db.exec(SEMBRAR);
        await db.exec(FILE_0497);
        await db.exec(ESPIA);
        await db.exec(ASIENTO("previo", "manual") + ASIENTO("previo-r", "manual", "pg_temp.fixture_id('a2-e-anulada')"));
        expect(await llamadas(db, sentencia)).toBe(esperadas);
      });
    }, SLOW);
  });

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

  describe("el motivo de auditoría en cada salida", () => {
    const MOTIVO_EXTERIOR = "I3B motivo exterior";
    const MOTIVO_DOCUMENTO = "Factura emitida por error";
    const exterior = `select set_config('dtd.audit_reason','${MOTIVO_EXTERIOR}',true);`;
    const testigo = async (db: PGlite) => (await db.query<{ evento: string; valor: string | null }>(
      "select evento, valor from public.i3b_testigo order by n")).rows.map((row) => row.evento + "=" + (row.valor ?? "NULL"));
    const estado = async (db: PGlite, label: string) => onlyRow<string>(
      await db.exec(`select pg_temp.estado('${label}') as valor;`), "valor");
    const reversos = async (db: PGlite, label: string) => onlyRow<string>(await db.exec(
      `select count(*)::text as valor from public.journal_entries where invoice_id = pg_temp.fixture_id('${label}') and source = 'invoice_reversal';`), "valor");
    const conMotivoExterior = async (db: PGlite) => onlyRow<string>(await db.exec(
      `select count(*)::text as valor from public.entity_audit_log where reason = '${MOTIVO_EXTERIOR}';`), "valor");

    it("éxito: vuelve el valor exterior y el motivo existe solo durante el UPDATE", async () => {
      await conSesion(async (db, motivo) => {
        await db.exec("select pg_temp.motivo_factura('exito');");
        await db.exec("truncate public.i3b_testigo;");
        await db.exec("begin;");
        await db.exec(exterior);
        expect((onlyRow<Record<string, string>>(await db.exec("select pg_temp.motivo_post('exito') as r;"), "r")).outcome).toBe("posted");
        expect(await motivo()).toBe(MOTIVO_EXTERIOR);
        expect(onlyRow<boolean>(await db.exec("select pg_temp.motivo_anular('exito') as r;"), "r")).toBe(true);
        expect(await motivo()).toBe(MOTIVO_EXTERIOR);
        await db.exec(ANULAR_BORRADOR);
        expect(await motivo()).toBe(MOTIVO_EXTERIOR);
        await db.exec("commit;");
        expect(await testigo(db)).toEqual([
          "journal_lines:INSERT=", "journal_lines:INSERT=", "journal_entries:INSERT=",
          "journal_lines:INSERT=", "journal_lines:INSERT=", "journal_entries:INSERT=",
          `invoices:UPDATE=${MOTIVO_DOCUMENTO}`,
          `invoices:UPDATE=${MOTIVO_DOCUMENTO}`,
        ]);
        expect(await conMotivoExterior(db)).toBe("0");
      });
    }, SLOW);

    it("éxito sin transacción abierta: el valor de la sesión sigue igual", async () => {
      await conSesion(async (db, motivo) => {
        await db.exec(`set dtd.audit_reason = '${MOTIVO_EXTERIOR}';`);
        await db.exec(ANULAR_ABIERTA);
        expect(db.isInTransaction()).toBe(false);
        expect(await motivo()).toBe(MOTIVO_EXTERIOR);
        expect(await reversos(db, "inv-abierta")).toBe("1");
        expect(await conMotivoExterior(db)).toBe("0");
      });
    }, SLOW);

    it("retornos tempranos: no tocan el valor exterior ni escriben", async () => {
      await conSesion(async (db, motivo) => {
        await db.exec("begin;");
        await db.exec(exterior);
        await db.exec("select pg_temp.motivo_factura('borrador','borrador');");
        await db.exec("select pg_temp.motivo_factura('cero','emitida',0);");
        await db.exec("truncate public.i3b_testigo;");
        const razones: Record<string, string> = {};
        for (const [etiqueta, sql] of [
          ["inexistente", `select pg_temp.as_actor(null, format('select public.post_invoice_journal_entry_atomic(%L::uuid,%L::uuid)',
            pg_temp.fixture_id('tenant-A'), pg_temp.fixture_id('motivo-no-existe')), 'service_role') as r;`],
          ["borrador", "select pg_temp.motivo_post('borrador') as r;"],
          ["cero", "select pg_temp.motivo_post('cero') as r;"],
        ] as const) {
          razones[etiqueta] = (onlyRow<Record<string, string>>(await db.exec(sql), "r")).reason;
          expect(await motivo()).toBe(MOTIVO_EXTERIOR);
        }
        expect(razones).toEqual({ inexistente: "invoice_unavailable", borrador: "invoice_not_postable", cero: "zero_total" });
        expect(onlyRow<boolean>(await db.exec(
          "select pg_temp.as_actor('accounting-A', pg_temp.void_sql('inv-pagada')) as r;"), "r")).toBe(false);
        expect(await motivo()).toBe(MOTIVO_EXTERIOR);
        expect(await testigo(db)).toEqual([]);
        await db.exec("rollback;");
      });
    }, SLOW);

    it("cada return posterior al primer cambio del motivo restaura antes de salir", () => {
      const RESTAURA = "perform pg_catalog.set_config('dtd.audit_reason', coalesce(v_motivo_exterior, ''), true);";
      for (const name of ["post_invoice_journal_entry_atomic", "void_invoice_with_audit_reason"]) {
        const cuerpo = FILE_0497.match(new RegExp(
          "create(?: or replace)? function public\\." + name + "\\([\\s\\S]*?\\bas \\$function\\$([\\s\\S]*?)\\$function\\$;", "i"))![1];
        const lineas = cuerpo.split("\n").map((linea) => linea.trim()).filter((linea) => !linea.startsWith("--"));
        const primero = lineas.findIndex((linea) => linea.includes("set_config('dtd.audit_reason'"));
        expect(primero).toBeGreaterThan(0);
        // \b y no ^: un `then return` en medio de la línea también es una salida.
        const salidas = lineas.flatMap((linea, i) => (i > primero && /\breturn\b/i.test(linea) ? [i] : []));
        expect(salidas.length).toBeGreaterThan(0);
        for (const i of salidas) {
          expect(lineas[i]).toMatch(/^return\b/);
          expect(lineas[i - 1]).toBe(RESTAURA);
        }
      }
    });

    it.each([
      ["anulación con asiento, con el motivo ya puesto", "invoices", ANULAR_ABIERTA, "inv-abierta"],
      ["anulación sin asiento, con el motivo ya puesto", "invoices", ANULAR_BORRADOR, "inv-borrador"],
      ["anulación con asiento, antes de poner el motivo", "journal_entries", ANULAR_ABIERTA, "inv-abierta"],
    ])("excepción capturada con savepoint: %s", async (_name, tabla, anular, factura) => {
      await conSesion(async (db, motivo) => {
        const antes = await estado(db, factura);
        await db.exec(`set i3b.falla = '${tabla}';`);
        await db.exec("begin;");
        await db.exec(exterior);
        await db.exec("savepoint s;");
        await expect(db.exec(anular)).rejects.toThrow(FALLA_FORZADA);
        await db.exec("rollback to savepoint s;");
        expect(await motivo()).toBe(MOTIVO_EXTERIOR);
        expect(await estado(db, factura)).toBe(antes);
        expect(await reversos(db, factura)).toBe("0");
        expect(await conMotivoExterior(db)).toBe("0");
        await db.exec("rollback;");
      });
    }, SLOW);

    it("excepción capturada con savepoint: asiento de venta nuevo", async () => {
      await conSesion(async (db, motivo) => {
        await db.exec("select pg_temp.motivo_factura('savepoint');");
        await db.exec("set i3b.falla = 'journal_entries';");
        await db.exec("begin;");
        await db.exec(exterior);
        await db.exec("savepoint s;");
        await expect(db.exec("select pg_temp.motivo_post('savepoint');")).rejects.toThrow(FALLA_FORZADA);
        await db.exec("rollback to savepoint s;");
        expect(await motivo()).toBe(MOTIVO_EXTERIOR);
        await db.exec("rollback;");
      });
    }, SLOW);

    it.each([
      ["sin transacción abierta", false],
      ["dentro de una transacción que se deshace", true],
    ])("excepción sin capturar, %s: no queda nada en la sesión", async (_name, conTransaccion) => {
      await conSesion(async (db, motivo) => {
        await db.exec("set i3b.falla = 'invoices';");
        for (const previo of [MOTIVO_EXTERIOR, ""]) {
          await db.exec(`set dtd.audit_reason = '${previo}';`);
          if (conTransaccion) await db.exec("begin;");
          await expect(db.exec(ANULAR_ABIERTA)).rejects.toThrow(FALLA_FORZADA);
          if (conTransaccion) await db.exec("rollback;");
          expect(db.isInTransaction()).toBe(false);
          expect(await motivo()).toBe(previo);
          expect(onlyRow<string>(await db.exec("select current_user::text as valor;"), "valor")).toBe("postgres");
        }
        await db.exec("reset dtd.audit_reason;");
        expect(await motivo() ?? "").toBe("");
        await expect(db.exec(ANULAR_ABIERTA)).rejects.toThrow(FALLA_FORZADA);
        expect(await motivo() ?? "").toBe("");
        expect(await reversos(db, "inv-abierta")).toBe("0");
      });
    }, SLOW);

    it("colisión de código: el reintento conserva el motivo exacto y restaura el exterior", async () => {
      await conSesion(async (db, motivo) => {
        await db.exec(`create sequence public.i3b_intentos;
create or replace function public.next_entry_code(p_tenant_id uuid) returns text language plpgsql security definer set search_path = public as $c$
declare n bigint := nextval('public.i3b_intentos');
begin
  if n <= 2 then return 'A-2026-0101'; end if;
  return 'A-2026-0901';
end;
$c$;`);
        await db.exec("begin;");
        await db.exec(exterior);
        await db.exec(ANULAR_ABIERTA);
        expect(await motivo()).toBe(MOTIVO_EXTERIOR);
        await db.exec("commit;");
        expect(onlyRow<string>(await db.exec("select last_value::text as valor from public.i3b_intentos;"), "valor")).toBe("3");
        expect((await testigo(db)).filter((fila) => fila.startsWith("invoices:"))).toEqual([`invoices:UPDATE=${MOTIVO_DOCUMENTO}`]);
        expect(await conMotivoExterior(db)).toBe("0");
      });
    }, SLOW);
  });

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

  describe("el desarme, supabase/desarmes/0497_desarme.sql", () => {
    const DESARME = readFileSync(resolve(ROOT, "supabase/desarmes/0497_desarme.sql"), "utf8").replace(/\r\n/g, "\n");
    const cuerpo = (archivo: string, nombre: string) => {
      const m = archivo.replace(/\r\n/g, "\n").match(
        new RegExp(`function public\\.${nombre}\\([\\s\\S]*?\\bas \\$function\\$([\\s\\S]*?)\\$function\\$;`),
      );
      expect(m).not.toBeNull();
      return m![1];
    };
    const POST = "post_invoice_journal_entry_atomic";
    const VOID = "void_invoice_with_audit_reason";
    const venta = (inv: string) => `(select count(*) from public.journal_entries e
      where e.invoice_id = pg_temp.fixture_id('${inv}') and e.source = 'invoice' and e.status = 'asentado')`;
    const reversos = (inv: string) => `(select count(*) from public.journal_entries e
      where e.invoice_id = pg_temp.fixture_id('${inv}') and e.source = 'invoice_reversal')`;

    it("no es una migración, y copia los cuerpos de la 0294 y de la 0497", () => {
      expect(readdirSync(resolve(ROOT, "supabase/migrations")).filter((f) => f.includes("desarme"))).toEqual([]);
      expect(cuerpo(DESARME, VOID)).toBe(cuerpo(FILE_0294, VOID));
      // Solo salen los dos nombres de triggers, en los tres SET CONSTRAINTS.
      const conNombres = /public\.journal_lines_entry_id_fkey,\s+public\.i3_journal_entry_final_check, public\.i3_invoice_final_check/g;
      const post0497 = cuerpo(FILE_0497, POST);
      expect(post0497.match(conNombres)).toHaveLength(3);
      expect(cuerpo(DESARME, POST)).toBe(post0497.replace(conNombres, "public.journal_lines_entry_id_fkey"));
    });

    it("lo frenado pasa, anular y asentar funcionan, y se ve lo que se pierde", async () => {
      const result = await contract({ probe: `${DESARME}
select pg_temp.assert_true(not exists (select 1 from pg_trigger where not tgisinternal and left(tgname, 3) = 'i3_'),
  'desarme: no queda ningún trigger');
update public.invoices set notes = 'Desarme' where id = pg_temp.fixture_id('inv-doble');
select pg_temp.assert_true((select notes = 'Desarme' from public.invoices where id = pg_temp.fixture_id('inv-doble')),
  'desarme: se escribe una factura con dos ventas');
select pg_temp.assert_true(pg_temp.anular('accounting-A', 'inv-abierta') = 'true', 'desarme: anula');
select pg_temp.assert_true(pg_temp.estado('inv-abierta') = 'anulada' and ${reversos("inv-abierta")} = 0 and ${venta("inv-abierta")} = 1,
  'desarme: anulada, sin reverso y con la venta asentada');
select pg_temp.assert_true(pg_temp.anular('accounting-A', 'inv-recibo') = 'true', 'desarme: la base deja anular con un cobro vivo');
update public.journal_entries set memo = 'Otro' where id = pg_temp.fixture_id('e-futuro');
select pg_temp.assert_true((select memo = 'Otro' from public.journal_entries where id = pg_temp.fixture_id('e-futuro')),
  'desarme: un asiento automático se puede cambiar');
insert into public.invoices (id, tenant_id, invoice_code, client_markbox, client_name, currency, base_amount, iva_amount, total_amount, paid_amount, status, issued_at)
values (pg_temp.fixture_id('inv-desarme'), pg_temp.fixture_id('tenant-A'), 'F-0497-DESARME', 'DTD-0497', 'Cliente 0497', 'USD', 100, 16, 116, 0, 'emitida', current_date);
select pg_temp.assert_true(pg_temp.as_actor('accounting-A', format('select public.${POST}(%L::uuid,%L::uuid)',
    pg_temp.fixture_id('tenant-A'), pg_temp.fixture_id('inv-desarme')), 'service_role')->>'outcome' = 'posted',
  'desarme: asentar sigue funcionando');
select pg_temp.assert_true(${venta("inv-desarme")} = 1, 'desarme: la venta quedó');
select pg_temp.assert_true((select count(*) from public.journal_entries where reverses_entry_id is not null) = 0
  and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'journal_entries' and column_name = 'reverses_entry_id'),
  'desarme: conserva la columna');
` });
      expect(result.error).toBeNull();
    }, SLOW);

    it("control en rojo: sin el ajuste, quitar los triggers rompe asentar", async () => {
      const soloQuitar = DESARME.split("\n").filter((l) => l.startsWith("drop trigger ")).join("\n");
      expect(soloQuitar.split("\n")).toHaveLength(5);
      const result = await contract({ probe: `${soloQuitar}
insert into public.invoices (id, tenant_id, invoice_code, client_markbox, client_name, currency, base_amount, iva_amount, total_amount, paid_amount, status, issued_at)
values (pg_temp.fixture_id('inv-desarme'), pg_temp.fixture_id('tenant-A'), 'F-0497-DESARME', 'DTD-0497', 'Cliente 0497', 'USD', 100, 16, 116, 0, 'emitida', current_date);
select pg_temp.as_actor('accounting-A', format('select public.${POST}(%L::uuid,%L::uuid)',
  pg_temp.fixture_id('tenant-A'), pg_temp.fixture_id('inv-desarme')), 'service_role');
` });
      expect(result.error).toMatch(/constraint "(public\.)?i3_journal_entry_final_check" does not exist/);
    }, SLOW);

    it("aborta si la función no es la de la 0497", async () => {
      const result = await contract({ probe: `create or replace function public.${VOID}(p_id uuid, p_reason text)
returns boolean language plpgsql security definer set search_path = '' as $f$ begin return false; end; $f$;
${DESARME}` });
      expect(result.error).toMatch(/^Desarme abortado: void_invoice_with_audit_reason no es la de la 0497/);
    }, SLOW);
  });

  it("aplicada al servidor propio el 2026-11-03 con el OK nominal de Sam: ya no es una espera y la cabecera «NO APLICADA» no se corrige", () => {
    const baseline = JSON.parse(readFileSync(resolve(ROOT, "supabase/migrations-baseline.json"), "utf8")) as {
      pendingBelowCutoff: Record<string, string>;
    };
    expect(baseline.pendingBelowCutoff["0497_reverso_al_anular_factura"]).toBeUndefined();
    expect(FILE_0497).toContain(
      "⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en\n--    supabase/migrations-baseline.json › pendingBelowCutoff",
    );
  });
});

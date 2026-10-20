// @vitest-environment node
/**
 * SDD-0573 · La migración 0497 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0497_reverso_al_anular_factura.test.sql` corre en
 * `verify` con Docker, pero el CI de calidad no tiene Docker. PGlite corre ese
 * MISMO contrato, con los `.sql` reales de las migraciones inlineados.
 *
 * CONTROL ROJO: sin 0497 el contrato falla en la primera aserción. MUTANTES: sin
 * cada regla de la anulación y del reverso, el contrato (o el postflight) cae en
 * esa regla. Además: el preflight con un cuerpo distinto de la 0294, la
 * reaplicación y la espera.
 */
import { readFileSync } from "node:fs";
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

async function contract(options: { applyFix?: boolean; migration?: string; replace?: Record<string, string> } = {}) {
  const sql = inline(CONTRACT, { apply_fix: String(options.applyFix ?? true) },
    { ...(options.migration ? { [M0497]: options.migration } : {}), ...(options.replace ?? {}) });
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

/** 0497 con un único cambio; falla si el texto a cambiar no aparece una sola vez. */
function mutant(from: string, to: string): string {
  expect(FILE_0497.split(from)).toHaveLength(2);
  return FILE_0497.split(from).join(to);
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

  const MUTANTS: { name: string; from: string; to: string; fails: string }[] = [
    {
      name: "commercial anula",
      from: "in ('admin', 'accounting')\n  ) then\n    raise exception 'Solo admin o contabilidad anulan una factura.'",
      to: "in ('admin', 'accounting', 'commercial')\n  ) then\n    raise exception 'Solo admin o contabilidad anulan una factura.'",
      fails: "TEST 0497: commercial no anula una factura",
    },
    {
      name: "sin el tenant de la sesión",
      from: "  where i.id = p_id and i.tenant_id = v_tenant\n  for update;",
      to: "  where i.id = p_id\n  for update;",
      fails: "TEST 0497: otro tenant no anula la factura (no la encuentra)",
    },
    {
      name: "sin rechazar los recibos vivos",
      from: "  if v_recibos > 0 then",
      to: "  if false then",
      fails: "TEST 0497: con un recibo vivo no se anula",
    },
    {
      name: "un recibo anulado cuenta como vivo",
      from: "where r.invoice_id = p_id and r.deleted_at is null;",
      to: "where r.invoice_id = p_id;",
      fails: "TEST 0497: un recibo anulado no cuenta: la factura se anula y se revierte",
    },
    {
      name: "sin rechazar el abono sin recibo",
      from: "  if coalesce(v_inv.paid_amount, 0) > 0 then",
      to: "  if false then",
      fails: "TEST 0497: con un abono sin recibo (crédito o reporte) no se anula",
    },
    {
      name: "sin el reverso",
      from: "  if v_vivos = 1 then",
      to: "  if false then",
      fails: "TEST 0497: el reverso es un asiento asentado de la factura, fechado hoy en Caracas",
    },
    {
      name: "las líneas sin dar vuelta",
      from: "select v_nuevo, l.account_id, l.credit, l.debit,",
      to: "select v_nuevo, l.account_id, l.debit, l.credit,",
      fails: "TEST 0497: el reverso tiene las mismas líneas al revés: el par suma cero en cada cuenta",
    },
    {
      name: "el reverso con la fecha de hoy aunque esté cerrada",
      from: "v_fecha := greatest(v_hoy, coalesce(v_cierre + 1, v_hoy));",
      to: "v_fecha := v_hoy;",
      fails: "TEST 0497: con hoy dentro del cierre, se anula igual",
    },
    {
      name: "el memo sin el período cerrado",
      from: "case when v_cierre is not null and v_entry.entry_date <= v_cierre",
      to: "case when false",
      fails: "TEST 0497: el reverso de un asiento de período cerrado va hoy, con el memo del período cerrado",
    },
    {
      name: "el original se marca anulado",
      from: "  update public.invoices set status = 'anulada' where id = p_id;\n  return true;",
      to: "  update public.journal_entries set status = 'anulado' where id = v_entry.id;\n  update public.invoices set status = 'anulada' where id = p_id;\n  return true;",
      fails: "TEST 0497: el asiento original no se toca",
    },
    {
      name: "sin el motivo para la auditoría",
      from: "  perform pg_catalog.set_config('dtd.audit_reason', v_reason, true);\n\n  if v_vivos = 1 then",
      to: "  if v_vivos = 1 then",
      fails: "TEST 0497: la anulación queda en la auditoría D2 con su motivo",
    },
    {
      name: "con dos asientos vivos revierte uno",
      from: "  if v_vivos > 1 then",
      to: "  if false then",
      fails: "TEST 0497: con dos asientos de venta vivos no se anula",
    },
    {
      name: "sin mirar si cuadra",
      from: "if v_debe is null or v_debe = 0 or v_debe <> v_haber then",
      to: "if v_debe is null then",
      fails: "TEST 0497: con un asiento de venta que no cuadra no se anula",
    },
    {
      name: "INVOKER en vez de DEFINER",
      from: "returns boolean\nlanguage plpgsql\nsecurity definer\nset search_path = ''",
      to: "returns boolean\nlanguage plpgsql\nset search_path = ''",
      fails: "0497: postflight — void_invoice_with_audit_reason tiene que ser DEFINER con search_path vacío",
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
      fails: "TEST 0497: un asiento tiene un solo reverso",
    },
    {
      name: "sin el CHECK del reverso",
      from: "(source = 'invoice_reversal') = (reverses_entry_id is not null)",
      to: "true",
      fails: "TEST 0497: un invoice_reversal sin el asiento que revierte se rechaza",
    },
    {
      name: "el original se borra con su reverso",
      from: "references public.journal_entries(id) on delete restrict;",
      to: "references public.journal_entries(id) on delete cascade;",
      fails: "TEST 0497: el original no se borra mientras exista su reverso",
    },
    {
      name: "el memo sin el asiento original",
      from: "'Reverso de la factura %s (asiento %s del %s). Motivo: %s'",
      to: "'Reverso de la factura %s. Motivo: %s%s%s'",
      fails: "TEST 0497: el memo cita la factura, el asiento original, su fecha y el motivo",
    },
    {
      name: "las líneas sin la marca de reverso",
      from: "pg_catalog.left('Reverso: ' || coalesce(l.line_memo, ''), 500)",
      to: "l.line_memo",
      fails: "TEST 0497: las líneas del reverso dicen que son reverso",
    },
  ];
  for (const m of MUTANTS) {
    it(`mutante ${m.name}: muere donde debe`, async () => {
      const result = await contract({ migration: mutant(m.from, m.to) });
      expect(result.error).toBe(m.fails);
    }, SLOW);
  }

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

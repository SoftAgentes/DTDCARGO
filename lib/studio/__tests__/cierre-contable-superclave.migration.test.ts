// @vitest-environment node
/**
 * SDD-0566 · La migración 0493 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0493_cierre_contable_superclave.test.sql` corre en
 * `verify` con Docker, pero el CI de calidad no tiene Docker. PGlite corre ese
 * MISMO contrato, con los `.sql` reales de 0078, 0133 y 0493 inlineados: lo que
 * se prueba es el texto que el runbook aplicará a producción, no un doble.
 *
 * CONTROL ROJO: sin 0493 el contrato falla en la primera aserción. MUTANTES: sin
 * cada regla de seguridad del cierre, el contrato cae en la aserción de esa
 * regla. PGlite tiene UNA conexión: que el FOR UPDATE serialice dos intentos en
 * paralelo lo cuida el centinela textual del último caso, no una carrera real.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0493_cierre_contable_superclave.test.sql");
const M0493 = "0493_cierre_contable_superclave.sql";
const FILE_0493 = readFileSync(resolve(ROOT, "supabase/migrations", M0493), "utf8");
const SLOW = 240_000;

const TRUE = /^(t|true|on|y|yes|1)$/i;
const FALSE = /^(f|false|off|n|no|0)$/i;

/**
 * psql → SQL plano con las metaórdenes del contrato: \set, \if :{?v} / :v,
 * \else, \endif e \ir. `replace` sustituye el texto de una migración (mutante).
 * Copia de credito-referido-atomico.migration.test.ts.
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
    { ...(options.migration ? { [M0493]: options.migration } : {}), ...(options.replace ?? {}) });
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    const results = await db.exec(sql);
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0493 GREEN"));
    return { error: null as string | null, green };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), green: undefined };
  } finally {
    await db.close();
  }
}

/** 0493 con un único cambio; falla si el texto a cambiar no aparece una sola vez. */
function mutant(from: string, to: string): string {
  expect(FILE_0493.split(from)).toHaveLength(2);
  return FILE_0493.split(from).join(to);
}

describe("SDD-0566 · 0493 cierre contable con superclave (PGlite)", () => {
  it("el contrato pasa con 0493", async () => {
    const result = await contract();
    expect(result.error).toBeNull();
    expect(result.green).toMatch(/^TEST 0493 GREEN: \d+ aserciones$/);
  }, SLOW);

  it("control rojo: sin 0493 falla en la primera aserción", async () => {
    const result = await contract({ applyFix: false });
    expect(result.error).toBe("TEST 0493: existe public.anular_asiento_en_cierre(uuid,text,text)");
  }, SLOW);

  const MUTANTS: { name: string; from: string; to: string; fails: string }[] = [
    {
      name: "el trigger de asientos sin la excepción (nada se puede cambiar)",
      from: "       or (v_new_date is not null and v_new_date <= v_closing_date))\n     and not public.excepcion_al_cierre_vigente(v_entry_id) then",
      to: "       or (v_new_date is not null and v_new_date <= v_closing_date)) then",
      fails: "Período contable cerrado: no se puede modificar un asiento en período cerrado (cierre: 2026-01-31).",
    },
    {
      name: "la excepción sin mirar el nonce (cualquier GUC abre)",
      from: "      and x.nonce = nullif(pg_catalog.current_setting('dtd.excepcion_cierre', true), '')\n",
      to: "",
      fails: "TEST 0493: sin el nonce, la excepción ya no sirve",
    },
    {
      name: "la excepción sin mirar el txid (sirve de otra transacción)",
      from: "      and x.txid = pg_catalog.txid_current()\n",
      to: "",
      fails: "TEST 0493: el permiso de otra transacción no sirve",
    },
    {
      name: "la excepción sin mirar el asiento (sirve para cualquiera)",
      from: "    where x.entry_id = p_entry_id\n      and x.nonce",
      to: "    where x.nonce",
      fails: "TEST 0493: el permiso de un asiento no abre otro",
    },
    {
      name: "la RPC no limpia el permiso",
      from: "  update public.journal_entries set status = 'anulado' where id = v_entry.id;\n\n  perform pg_catalog.set_config('dtd.excepcion_cierre', '', true);",
      to: "  update public.journal_entries set status = 'anulado' where id = v_entry.id;\n",
      fails: "TEST 0493: la RPC limpia el permiso",
    },
    {
      name: "sin superclave definida se deja pasar",
      from: "    perform extensions.crypt(coalesce(p_clave, ''), extensions.gen_salt('bf', 10));\n    return 'sin_superclave';",
      to: "    return null;",
      fails: "TEST 0493: sin superclave la RPC devuelve sin_superclave",
    },
    {
      name: "la clave mala lanza (el ROLLBACK se lleva el contador)",
      from: "    set failed_attempts = v_secret.failed_attempts + 1\n    where tenant_id = p_tenant_id;\n  end if;\n  return 'incorrecta';",
      to: "    set failed_attempts = v_secret.failed_attempts + 1\n    where tenant_id = p_tenant_id;\n  end if;\n  raise exception 'incorrecta';",
      fails: "incorrecta",
    },
    {
      name: "sin el bloqueo tras cinco fallidos",
      from: "  if v_secret.failed_attempts + 1 >= 5 then",
      to: "  if v_secret.failed_attempts + 1 >= 500 then",
      fails: "TEST 0493: el quinto fallido bloquea",
    },
    {
      name: "bloqueada, igual verifica",
      from: "  if v_secret.locked_until is not null and v_secret.locked_until > pg_catalog.now() then\n    return 'bloqueada';\n  end if;\n",
      to: "",
      fails: "TEST 0493: bloqueada, ni la clave buena entra",
    },
    {
      name: "un acierto no limpia el contador",
      from: "    set failed_attempts = 0, locked_until = null\n    where tenant_id = p_tenant_id;\n    return null;",
      to: "    set locked_until = null\n    where tenant_id = p_tenant_id;\n    return null;",
      fails: "TEST 0493: un acierto pone el contador en 0",
    },
    {
      name: "el motivo se valida después de la clave (gasta un intento)",
      from: "  -- El motivo, antes que la clave: uno inválido no gasta un intento.\n  if p_reason is null or pg_catalog.char_length(pg_catalog.btrim(p_reason)) not between 4 and 1000 then\n    raise exception 'El motivo debe tener entre 4 y 1000 caracteres.' using errcode = '22023';\n  end if;\n",
      to: "",
      fails: "TEST 0493: un motivo inválido se rechaza antes de mirar la clave",
    },
    {
      name: "el modo advertencia también pide clave",
      from: "  if coalesce(v_mode, 'superclave') = 'superclave' then\n    v_motivo := public.cierre_verificar_superclave(p_tenant_id, p_clave);",
      to: "  if true then\n    v_motivo := public.cierre_verificar_superclave(p_tenant_id, p_clave);",
      fails: "TEST 0493: en modo advertencia basta el motivo",
    },
    {
      name: "cualquiera define la superclave",
      from: "  if v_tenant is null or not public.cierre_es_admin(v_tenant) then\n    raise exception 'Solo el admin del tenant define la superclave del cierre.'",
      to: "  if v_tenant is null then\n    raise exception 'Solo el admin del tenant define la superclave del cierre.'",
      fails: "TEST 0493: un no admin no define la superclave",
    },
    {
      name: "cambiarla sin la actual",
      from: "  if coalesce(v_existe, false) then\n    v_motivo := public.cierre_verificar_superclave(v_tenant, p_actual);\n    if v_motivo is not null then\n      return pg_catalog.jsonb_build_object('ok', false, 'motivo', v_motivo);\n    end if;",
      to: "  if coalesce(v_existe, false) then",
      fails: "TEST 0493: para cambiarla hay que dar la actual",
    },
    {
      name: "la autorización interna abierta a la API",
      from: "revoke all on function public.autorizar_excepcion_al_cierre(uuid, uuid, text, date, text, text, text, numeric, numeric)\n  from public, anon, authenticated, service_role;",
      to: "grant execute on function public.autorizar_excepcion_al_cierre(uuid, uuid, text, date, text, text, text, numeric, numeric)\n  to authenticated;",
      fails: "TEST 0493: la autorización interna no se llama desde la API",
    },
    {
      name: "quien no edita contabilidad usa la excepción",
      from: "      else coalesce(d.can_edit, d.role = 'accounting')",
      to: "      else true",
      fails: "TEST 0493: quien no edita contabilidad no usa la excepción",
    },
    {
      name: "el historial no registra el modo",
      from: "  if new.closing_mode is distinct from old.closing_mode then\n    insert into public.accounting_closing_events (tenant_id, kind, old_value, new_value, user_id)\n    values (new.tenant_id, 'modo_cambiado', old.closing_mode, new.closing_mode, (select auth.uid()));\n  end if;\n  return new;",
      to: "  return new;",
      fails: "TEST 0493: el cambio de modo queda en el historial",
    },
    {
      name: "el trigger de líneas sin la excepción (crear no puede)",
      from: "  if coalesce(public.journal_entry_is_closed(v_entry_id), false)\n     and not public.excepcion_al_cierre_vigente(v_entry_id) then",
      to: "  if coalesce(public.journal_entry_is_closed(v_entry_id), false) then",
      fails: "Período contable cerrado: no se pueden modificar las líneas de un asiento cerrado.",
    },
  ];
  for (const m of MUTANTS) {
    it(`mutante ${m.name}: muere donde debe`, async () => {
      const result = await contract({ migration: mutant(m.from, m.to) });
      expect(result.error).toBe(m.fails);
    }, SLOW);
  }

  it("el preflight aborta si el trigger de 0133 que se reemplaza tiene otro cuerpo", async () => {
    // Producción con un trigger distinto del árbol: reemplazarlo perdería lo que tiene.
    const m0133 = readFileSync(resolve(ROOT, "supabase/migrations/0133_period_close.sql"), "utf8");
    const desde = "  v_closing_date := public.get_accounting_closing_date(v_tenant_id);\n";
    expect(m0133.replace(/\r\n/g, "\n").split(desde)).toHaveLength(2);
    const otro = m0133.replace(/\r\n/g, "\n").split(desde).join(desde + "  -- cambio hecho a mano en producción\n");
    const result = await contract({ replace: { "0133_period_close.sql": otro } });
    expect(result.error).toMatch(
      /^0493 abortado: public\.journal_entries_validate_closing\(\) tiene otro cuerpo \(md5 [0-9a-f]{32}, sin espacios [0-9a-f]{32}\); revisar antes de aplicar$/,
    );
  }, SLOW);

  it("la 0493 espera en pendingBelowCutoff, MIGRATE-FIRST y con OK nominal de Sam", () => {
    const baseline = JSON.parse(readFileSync(resolve(ROOT, "supabase/migrations-baseline.json"), "utf8")) as {
      pendingBelowCutoff: Record<string, string>;
    };
    const espera = baseline.pendingBelowCutoff["0493_cierre_contable_superclave"];
    expect(espera).toContain("MIGRATE-FIRST");
    expect(espera).toContain("Requiere OK nominal de Sam");
    expect(FILE_0493).toContain(
      "⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en\n--    supabase/migrations-baseline.json › pendingBelowCutoff",
    );
  });

  it("centinela: la verificación toma la fila de la superclave FOR UPDATE", () => {
    // PGlite tiene una sola conexión: la carrera de dos intentos no se puede
    // armar acá. El texto exacto se fija para que quitarlo se vea.
    expect(FILE_0493).toContain(
      "  from public.accounting_closing_secrets s\n  where s.tenant_id = p_tenant_id\n  for update;",
    );
  });
});

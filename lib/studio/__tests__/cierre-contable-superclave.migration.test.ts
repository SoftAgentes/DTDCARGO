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
 * Por lo mismo, la espera acotada (`lock_timeout` de 1 s) se prueba en el
 * catálogo, §16 del contrato: cuánto espera Postgres con ese valor es suyo.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
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
  const db = await pgliteLimpio({ pgcrypto });
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

const CONTRACT_NAME = "0493_cierre_contable_superclave.test.sql";

/** El prosrc de una función de 0133 (entre `as $$` y `$$;`), con LF. */
function cuerpoDe(sql: string, nombre: string): string {
  const texto = sql.replace(/\r\n/g, "\n");
  const desde = texto.indexOf(`create or replace function public.${nombre}()`);
  const inicio = texto.indexOf("as $$", desde) + "as $$".length;
  return texto.slice(inicio, texto.indexOf("$$;", inicio));
}
const md5DelCuerpo = (sql: string, nombre: string) => createHash("md5").update(cuerpoDe(sql, nombre), "utf8").digest("hex");

/**
 * 0133 como está viva en producción (medido por el Director, 2026-10-20): los dos
 * triggers sin sus comentarios internos y sin tildes en los mensajes.
 */
function vivo0133(): string {
  let texto = readFileSync(resolve(ROOT, "supabase/migrations/0133_period_close.sql"), "utf8").replace(/\r\n/g, "\n");
  for (const nombre of ["journal_entries_validate_closing", "journal_lines_validate_closing"]) {
    const repo = cuerpoDe(texto, nombre);
    const vivo = repo
      .split("\n")
      .filter((linea) => !/^\s*--/.test(linea))
      .join("\n")
      .replace(/Período/g, "Periodo")
      .replace(/período/g, "periodo")
      .replace(/líneas/g, "lineas");
    expect(texto.split(repo)).toHaveLength(2);
    texto = texto.split(repo).join(vivo);
  }
  return texto;
}

/** De `create function public.anular_asiento_en_cierre(` a su primer mensaje propio (el 42501). */
const INICIO_DE_ANULAR = (() => {
  const desde = FILE_0493.indexOf("create function public.anular_asiento_en_cierre(");
  const marca = ", hint = 'dtd-cierre';";
  return FILE_0493.slice(desde, FILE_0493.indexOf(marca, desde) + marca.length);
})();

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
      from: "    set failed_attempts = v_fallidos\n    where tenant_id = p_tenant_id;\n  end if;\n  return 'incorrecta';",
      to: "    set failed_attempts = v_fallidos\n    where tenant_id = p_tenant_id;\n  end if;\n  raise exception 'incorrecta';",
      fails: "incorrecta",
    },
    {
      name: "sin el bloqueo tras cinco fallidos",
      from: "  if v_fallidos % 5 = 0 then",
      to: "  if v_fallidos % 500 = 0 then",
      fails: "TEST 0493: el quinto fallido bloquea 15 minutos, y el contador no vuelve a 0",
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
      from: "  -- El motivo, antes que la clave: uno inválido no gasta un intento.\n  if p_reason is null or pg_catalog.char_length(pg_catalog.btrim(p_reason)) not between 4 and 1000 then\n    raise exception 'El motivo debe tener entre 4 y 1000 caracteres.' using errcode = '22023', hint = 'dtd-cierre';\n  end if;\n",
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
    {
      name: "una función que recibe la clave sin espera acotada",
      from: "create function public.anular_asiento_en_cierre(p_entry_id uuid, p_clave text, p_motivo text)\nreturns jsonb\nlanguage plpgsql\nvolatile\nsecurity definer\nset search_path = ''\nset lock_timeout = '1s'\n",
      to: "create function public.anular_asiento_en_cierre(p_entry_id uuid, p_clave text, p_motivo text)\nreturns jsonb\nlanguage plpgsql\nvolatile\nsecurity definer\nset search_path = ''\n",
      fails: "TEST 0493: toda función que recibe la superclave espera un bloqueo 1 s como mucho",
    },
    {
      name: "una RPC que recibe la clave abierta a service_role",
      from: "grant execute on function public.anular_asiento_en_cierre(uuid, text, text) to authenticated;",
      to: "grant execute on function public.anular_asiento_en_cierre(uuid, text, text) to authenticated, service_role;",
      fails: "TEST 0493: ni anon ni service_role llaman a una función que recibe la superclave",
    },
    {
      name: "un importe con más de 2 decimales entra (lo atrapa recién el recálculo)",
      from: "\n       or v_d <> pg_catalog.round(v_d, 2) or v_c <> pg_catalog.round(v_c, 2) then",
      to: " then",
      fails: "TEST 0493: un importe con más de 2 decimales no entra (el redondeo descuadraba)",
    },
    {
      name: "sin el tope, NaN entra como importe",
      from: "    if v_d > 999999999999.99 or v_c > 999999999999.99\n       or v_d <> pg_catalog.round(v_d, 2)",
      to: "    if v_d <> pg_catalog.round(v_d, 2)",
      fails: "TEST 0493: NaN no entra como importe",
    },
    {
      name: "el bloqueo vuelve el contador a 0",
      from: "    set failed_attempts = v_fallidos,\n        locked_until",
      to: "    set failed_attempts = 0,\n        locked_until",
      fails: "TEST 0493: el quinto fallido bloquea 15 minutos, y el contador no vuelve a 0",
    },
    {
      name: "el bloqueo no se duplica",
      from: "    v_minutos := least(15 * (2 ^ least(v_fallidos / 5 - 1, 7))::integer, 1440);",
      to: "    v_minutos := 15;",
      fails: "TEST 0493: el segundo bloqueo seguido dura 30 minutos",
    },
    {
      name: "el bloqueo sin techo de 24 horas",
      from: "    v_minutos := least(15 * (2 ^ least(v_fallidos / 5 - 1, 7))::integer, 1440);",
      to: "    v_minutos := 15 * (2 ^ least(v_fallidos / 5 - 1, 7))::integer;",
      fails: "TEST 0493: ningún bloqueo dura más de 24 horas",
    },
    {
      name: "una línea puede cambiar de asiento (sale del período cerrado)",
      from: "  if tg_op = 'UPDATE' and new.entry_id is distinct from old.entry_id then",
      to: "  if false then",
      fails: "TEST 0493: una línea no sale de un asiento cerrado cambiándole el asiento",
    },
    {
      name: "borrar la fila del cierre no queda en el historial",
      from: "  after insert or update or delete on public.accounting_settings",
      to: "  after insert or update on public.accounting_settings",
      fails: "TEST 0493: borrar la fila del cierre queda como reapertura",
    },
    {
      name: "un mensaje propio sin el hint dtd-cierre (la app no lo mostraría)",
      from: INICIO_DE_ANULAR,
      to: INICIO_DE_ANULAR.replace(", hint = 'dtd-cierre';", ";"),
      fails: "TEST 0493: los mensajes propios llevan el hint dtd-cierre, que la app usa para mostrarlos",
    },
    {
      name: "la verificación interna abierta a anon",
      from: "revoke all on function public.cierre_verificar_superclave(uuid, text)\n  from public, anon, authenticated, service_role;",
      to: "revoke all on function public.cierre_verificar_superclave(uuid, text)\n  from public, authenticated, service_role;\ngrant execute on function public.cierre_verificar_superclave(uuid, text) to anon;",
      fails: "TEST 0493: ni anon ni service_role llaman a una función que recibe la superclave",
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

  it("deriva de 0133: con el cuerpo vivo de producción de los dos triggers, la 0493 aplica", async () => {
    // Medido por el Director el 2026-10-20: el vivo es el del repo sin comentarios internos ni tildes.
    const vivo = vivo0133();
    expect(md5DelCuerpo(vivo, "journal_entries_validate_closing")).toBe("26b81a55480d3bafb57450efc17663a6");
    expect(md5DelCuerpo(vivo, "journal_lines_validate_closing")).toBe("5e7e21f09f53520aba46c5bbf10c2cfc");
    const result = await contract({ replace: { "0133_period_close.sql": vivo } });
    expect(result.error).toBeNull();
    expect(result.green).toMatch(/^TEST 0493 GREEN: \d+ aserciones$/);
  }, SLOW);

  it("control rojo de la deriva: sin la huella viva en la lista, ese cuerpo aborta", async () => {
    const sinVivo = mutant(
      "     array['bba82f1ee57c6a32f186a2b9dbeda94a',     -- 0133 del repo\n" +
        "           '26b81a55480d3bafb57450efc17663a6'],    -- vivo en producción (903 caracteres)\n" +
        "     array['59e9825c471c993e2f4856e0207c7a71',\n" +
        "           '1dd58682fc49a595900ff03d5030ba21']),",
      "     array['bba82f1ee57c6a32f186a2b9dbeda94a'],\n     array['59e9825c471c993e2f4856e0207c7a71']),",
    );
    const result = await contract({ migration: sinVivo, replace: { "0133_period_close.sql": vivo0133() } });
    expect(result.error).toBe(
      "0493 abortado: public.journal_entries_validate_closing() tiene otro cuerpo " +
        "(md5 26b81a55480d3bafb57450efc17663a6, sin espacios 1dd58682fc49a595900ff03d5030ba21); revisar antes de aplicar",
    );
  }, SLOW);

  it("aplicada dos veces, la segunda aborta con «ya existe» y no con «otro cuerpo»", async () => {
    const result = await contract({ migration: FILE_0493 + "\n" + FILE_0493 });
    expect(result.error).toBe("0493 abortado: el cierre con superclave ya existe");
  }, SLOW);

  it("defensa en profundidad: sin la regla de los 2 decimales, el recálculo de lo guardado atrapa el redondeo", async () => {
    const sinDecimales = mutant(
      "\n       or v_d <> pg_catalog.round(v_d, 2) or v_c <> pg_catalog.round(v_c, 2) then",
      " then",
    );
    const contrato = readFileSync(CONTRACT, "utf8");
    const esperado = "= '22023|Cada importe es un número de hasta 2 decimales.|dtd-cierre',\n  'un importe con más de 2 decimales no entra";
    expect(contrato.split(esperado)).toHaveLength(2);
    const conRecalculo = contrato.split(esperado).join(
      "= '22023|El asiento guardado no balancea.|dtd-cierre',\n  'un importe con más de 2 decimales no entra",
    );
    const verde = await contract({ migration: sinDecimales, replace: { [CONTRACT_NAME]: conRecalculo } });
    expect(verde.error).toBeNull();
    // Control rojo: sin el recálculo tampoco, el asiento descuadrado se guarda.
    const sinNinguna = sinDecimales.split(
      "  if v_guardado_debe <> v_debe or v_guardado_haber <> v_haber then",
    ).join("  if false then");
    const rojo = await contract({ migration: sinNinguna, replace: { [CONTRACT_NAME]: conRecalculo } });
    expect(rojo.error).toBe("TEST 0493: un importe con más de 2 decimales no entra (el redondeo descuadraba)");
  }, SLOW);

  it("aplicada al servidor propio el 2026-10-20 con el OK nominal de Sam: ya no es una espera y la cabecera «NO APLICADA» no se corrige", () => {
    const baseline = JSON.parse(readFileSync(resolve(ROOT, "supabase/migrations-baseline.json"), "utf8")) as {
      pendingBelowCutoff: Record<string, string>;
    };
    expect(baseline.pendingBelowCutoff["0493_cierre_contable_superclave"]).toBeUndefined();
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

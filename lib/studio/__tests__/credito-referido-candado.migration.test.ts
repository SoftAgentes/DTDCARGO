// @vitest-environment node
/**
 * SDD-0567 · La migración 0494 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0494_credito_referido_candado.test.sql` corre en
 * `verify` con Docker, pero el CI de calidad no tiene Docker. PGlite corre ese
 * MISMO contrato, con los `.sql` reales de las migraciones inlineados: lo que se
 * prueba es el texto que el runbook aplicará a producción, no un doble.
 *
 * CONTROL ROJO: sin 0494 el contrato falla en la primera aserción. MUTANTES: sin
 * cada regla del candado, el contrato cae en la aserción de esa regla. Además:
 * la deriva de la 0250 en producción (el cuerpo vivo sin comentarios), con su
 * control rojo, la reaplicación y la espera.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0494_credito_referido_candado.test.sql");
const M0494 = "0494_credito_referido_candado.sql";
const FILE_0494 = readFileSync(resolve(ROOT, "supabase/migrations", M0494), "utf8");
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
    { ...(options.migration ? { [M0494]: options.migration } : {}), ...(options.replace ?? {}) });
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    const results = await db.exec(sql);
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0494 GREEN"));
    return { error: null as string | null, green };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), green: undefined };
  } finally {
    await db.close();
  }
}

/** 0494 con un único cambio; falla si el texto a cambiar no aparece una sola vez. */
function mutant(from: string, to: string): string {
  expect(FILE_0494.split(from)).toHaveLength(2);
  return FILE_0494.split(from).join(to);
}

/** El prosrc de accredit_referral_on_first_invoice en la 0250 (entre `as $$` y `$$;`), con LF. */
function cuerpoDe0250(sql: string): string {
  const texto = sql.replace(/\r\n/g, "\n");
  const desde = texto.indexOf("create or replace function public.accredit_referral_on_first_invoice()");
  const inicio = texto.indexOf("as $$", desde) + "as $$".length;
  return texto.slice(inicio, texto.indexOf("$$;", inicio));
}

/** 0250 como está viva en producción (medido por el Director, 2026-10-20): el trigger sin sus líneas de comentario. */
function vivo0250(): string {
  const texto = readFileSync(resolve(ROOT, "supabase/migrations/0250_referral_settings.sql"), "utf8").replace(/\r\n/g, "\n");
  const repo = cuerpoDe0250(texto);
  const vivo = repo.split("\n").filter((linea) => !/^\s*--/.test(linea)).join("\n");
  expect(texto.split(repo)).toHaveLength(2);
  return texto.split(repo).join(vivo);
}

describe("SDD-0567 · 0494 candado del crédito de referido (PGlite)", () => {
  it("el contrato pasa con 0494", async () => {
    const result = await contract();
    expect(result.error).toBeNull();
    expect(result.green).toMatch(/^TEST 0494 GREEN: \d+ aserciones$/);
  }, SLOW);

  it("control rojo: sin 0494 falla en la primera aserción", async () => {
    const result = await contract({ applyFix: false });
    expect(result.error).toBe("TEST 0494: existe public.avanzar_referido(uuid,text,text)");
  }, SLOW);

  const MUTANTS: { name: string; from: string; to: string; fails: string }[] = [
    {
      name: "authenticated conserva el UPDATE y el DELETE",
      from: "revoke update, delete on public.referrals from authenticated;\n",
      to: "",
      // Lo ataja primero el postflight (la migración aborta entera); detrás, el §1 del contrato.
      fails: "0494: postflight — los grants de referrals para authenticated no son SELECT e INSERT",
    },
    {
      name: "aplicar sigue INVOKER (sin el UPDATE, fallaría)",
      from: "alter function public.apply_referral_credit(uuid,uuid) security definer;\n",
      to: "",
      fails: "0494: postflight — apply y revert sin DEFINER, search_path o ACL esperados",
    },
    {
      name: "un referido nace acreditado",
      from: "    if new.status::text not in ('invitado', 'registrado') then",
      to: "    if false then",
      fails: "TEST 0494: un referido no nace acreditado",
    },
    {
      name: "un referido nace con monto",
      from: "    if new.reward_usd <> 0 or new.accredited_at is not null",
      to: "    if new.reward_usd < 0 or new.accredited_at is not null",
      fails: "TEST 0494: un referido no nace con monto",
    },
    {
      name: "un referido nace registrado sin su cliente",
      from: "    if new.status::text = 'registrado' and new.referred_client_id is null then",
      to: "    if false then",
      fails: "TEST 0494: un referido no nace registrado sin su cliente, tampoco por service_role",
    },
    {
      name: "un crédito nace sin venta ni motivo",
      from: "    if not (\n      (new.accredited_invoice_id is not null",
      to: "    if false and not (\n      (new.accredited_invoice_id is not null",
      fails: "TEST 0494: sin venta ni motivo no nace un crédito",
    },
    {
      name: "la venta de otro cliente acredita",
      from: "      and i.client_markbox = c.markbox\n      and i.deleted_at is null",
      to: "      and i.deleted_at is null",
      fails: "TEST 0494: la venta de otro cliente no acredita",
    },
    {
      name: "el monto acreditado cambia",
      from: "    if new.reward_usd is distinct from old.reward_usd\n",
      to: "    if false\n",
      fails: "TEST 0494: el monto acreditado no cambia",
    },
    {
      name: "cualquier transición vale",
      from: "  if v_nuevo <> v_viejo and not v_espera_por_reversion and (v_viejo, v_nuevo) not in (",
      to: "  if false and (v_viejo, v_nuevo) not in (",
      fails: "TEST 0494: un acreditado no retrocede a invitado",
    },
    {
      name: "un acreditado lleva rastro de aplicación («renacido»)",
      from: "  if v_nuevo <> 'aplicado'\n     and (new.applied_invoice_id is not null",
      to: "  if false\n     and (new.applied_invoice_id is not null",
      fails: "TEST 0494: un acreditado no lleva rastro de aplicación («renacido»)",
    },
    {
      name: "un acreditado se borra",
      from: "    if old.status::text in ('acreditado', 'aplicado')\n       and exists (select 1 from public.tenants t where t.id = old.tenant_id) then",
      to: "    if false then",
      fails: "TEST 0494: un acreditado no se borra",
    },
    {
      name: "un acreditado se borra a medias (deleted_at)",
      from: "  if new.deleted_at is not null and old.deleted_at is null and v_viejo in ('acreditado', 'aplicado') then",
      to: "  if false then",
      fails: "TEST 0494: un acreditado no se borra a medias",
    },
    {
      name: "la factura de la aplicación cambia",
      from: "    if new.applied_invoice_id is distinct from old.applied_invoice_id\n       or new.applied_at is distinct from old.applied_at then",
      to: "    if false then",
      fails: "TEST 0494: la factura de la aplicación no cambia",
    },
    {
      name: "se enlaza cualquier asiento",
      from: "    raise exception 'Ese asiento no es el del crédito.' using errcode = '22023', hint = 'dtd-referidos';",
      to: "    null;",
      fails: "TEST 0494: no se enlaza un asiento que no es del crédito",
    },
    {
      name: "el asiento enlazado cambia",
      from: "    if new.applied_entry_id is distinct from old.applied_entry_id and old.applied_entry_id is not null then",
      to: "    if false then",
      fails: "TEST 0494: el asiento enlazado no cambia",
    },
    {
      name: "anulada la venta, el crédito sin aplicar no vuelve a espera",
      from: "        update public.referrals set status = 'registrado' where id = v_ref.id;",
      to: "        null;",
      fails: "TEST 0494: anulada la venta, el crédito sin aplicar vuelve a espera (registrado) y limpio",
    },
    {
      name: "la vuelta a espera no limpia la acreditación",
      from: "  if v_viejo = 'acreditado' and v_nuevo = 'registrado' then\n    new.reward_usd := 0;",
      to: "  if false then\n    new.reward_usd := 0;",
      fails: "TEST 0494: anulada la venta, el crédito sin aplicar vuelve a espera (registrado) y limpio",
    },
    {
      name: "borrada la venta, el crédito no pasa a otra venta viva",
      from: "      if v_otra is not null then\n        update public.referrals set accredited_invoice_id = v_otra where id = v_ref.id;\n      else\n        update public.referrals set status = 'registrado' where id = v_ref.id;",
      to: "      if false then\n        update public.referrals set accredited_invoice_id = v_otra where id = v_ref.id;\n      else\n        update public.referrals set status = 'registrado' where id = v_ref.id;",
      fails: "TEST 0494: borrada la venta, el crédito pasa a otra venta viva del referido",
    },
    {
      name: "un aplicado con la venta anulada no queda marcado",
      from: "        update public.referrals set sale_voided_at = pg_catalog.now()\n        where id = v_ref.id and sale_voided_at is null;",
      to: "        null;",
      fails: "TEST 0494: un crédito aplicado cuya venta se anula no se revierte solo: queda marcado",
    },
    {
      name: "revertido con la venta anulada, queda acreditado en el aire",
      from: "  if v_viejo = 'aplicado' and v_nuevo = 'acreditado' and old.sale_voided_at is not null then",
      to: "  if false then",
      fails: "TEST 0494: revertido, el crédito con la venta anulada vuelve a espera y no queda acreditado en el aire",
    },
    {
      name: "cualquiera acredita sin venta",
      from: "and ut.disabled_at is null and pg_catalog.lower(pg_catalog.btrim(ut.role)) = 'admin'",
      to: "and ut.disabled_at is null",
      fails: "TEST 0494: commercial no acredita sin venta",
    },
    {
      name: "pasar a registrado no pide el cliente en la RPC",
      from: "    if v_cliente is null then\n      raise exception 'Para marcarlo registrado",
      to: "    if false then\n      raise exception 'Para marcarlo registrado",
      fails: "TEST 0494: pasar a registrado pide el cliente",
    },
    {
      name: "support edita Fidelización",
      from: "      when d.role = 'support' then false\n      else coalesce(d.can_edit, d.role = 'commercial')",
      to: "      else true",
      fails: "TEST 0494: support no edita Fidelización",
    },
    {
      name: "una función interna abierta a la API",
      from: "revoke all on function public.referido_venta_real(uuid, uuid, uuid, timestamptz) from public, anon, authenticated, service_role;",
      to: "grant execute on function public.referido_venta_real(uuid, uuid, uuid, timestamptz) to authenticated;",
      fails: "0494: postflight — una función interna tiene EXECUTE para la API",
    },
    // ── Revisión de seguridad del Director, 2026-10-20 ──
    {
      name: "B1: con el premio en 0, la venta del referido falla",
      from: "  if v_reward <= 0 then\n    return new;\n  end if;\n",
      to: "",
      fails: "TEST 0494: con el premio en 0 la factura del referido se emite y no hay crédito que acreditar (B1)",
    },
    {
      name: "B2: la sesión inserta un registrado con cliente",
      from: "with check (tenant_id = public.get_user_tenant_id() and status = 'invitado' and referred_client_id is null);",
      to: "with check (tenant_id = public.get_user_tenant_id());",
      fails: "TEST 0494: la sesión no inserta un referido registrado con un cliente (B2)",
    },
    {
      name: "B2: dos referidos vivos del mismo cliente",
      from: "create unique index referrals_un_referido_por_cliente",
      to: "create index referrals_un_referido_por_cliente",
      fails: "TEST 0494: un solo referido vivo por cliente: una venta no acredita dos créditos (B2)",
    },
    {
      name: "B2: un cliente se refiere a sí mismo",
      from: "    if public.referido_es_el_referidor(new.referred_client_id, new.referrer_client_id, new.referrer_markbox) then\n      raise exception 'Un cliente no se refiere a sí mismo.'",
      to: "    if false then\n      raise exception 'Un cliente no se refiere a sí mismo.'",
      fails: "TEST 0494: un cliente no se refiere a sí mismo",
    },
    {
      name: "I1: avanzar registra al propio referidor",
      from: "    if public.referido_es_el_referidor(v_cliente, v_ref.referrer_client_id, v_ref.referrer_markbox) then",
      to: "    if false then",
      fails: "TEST 0494: avanzar no registra al propio referidor (I1)",
    },
    {
      name: "I1: avanzar registra un cliente que ya tiene referido",
      from: "    if exists (select 1 from public.referrals o",
      to: "    if false and exists (select 1 from public.referrals o",
      fails: "TEST 0494: avanzar no registra un cliente que ya tiene referido (I1)",
    },
    {
      name: "I1: una factura vieja es la venta del referido (0250)",
      from: "\n     and created_at <= new.created_at;",
      to: ";",
      fails: "Un crédito de referido nace de una venta real del referido o de una acreditación con motivo.",
    },
    {
      name: "I1: una factura vieja es la venta del referido (guardián)",
      from: "      and i.created_at >= p_desde\n  )",
      to: "  )",
      fails: "TEST 0494: una factura anterior al alta del referido no es su venta, ni por un UPDATE directo",
    },
    {
      name: "I2: la validación de clientes corre en todo UPDATE",
      from: "  before insert or update of referrer_client_id, referred_client_id on public.referrals",
      to: "  before insert or update on public.referrals",
      fails: "TEST 0494: anular la venta de un referido con su cliente borrado no falla (I2)",
    },
    {
      name: "M1: un aplicado cuya venta se anula queda marcado aunque haya otra venta",
      from: "Solo sin ella queda marcado.\n      v_otra := public.referido_otra_venta(new.tenant_id, v_ref.referred_client_id, new.id, v_ref.created_at);",
      to: "Solo sin ella queda marcado.\n      v_otra := null;",
      fails: "TEST 0494: un aplicado cuya venta se anula pasa a otra venta viva del referido y no queda marcado (M1)",
    },
    {
      name: "M3: el borrado del tenant entero choca con el guardián",
      from: "    if old.status::text in ('acreditado', 'aplicado')\n       and exists (select 1 from public.tenants t where t.id = old.tenant_id) then",
      to: "    if old.status::text in ('acreditado', 'aplicado') then",
      fails: "TEST 0494: borrar el tenant entero con un crédito acreditado no choca con el guardián",
    },
    {
      name: "M3: la venta que acreditó se borra en silencio (set null)",
      from: "  add column accredited_invoice_id uuid references public.invoices(id) on delete no action,",
      to: "  add column accredited_invoice_id uuid references public.invoices(id) on delete set null,",
      fails: "TEST 0494: la factura que acreditó un crédito no se borra en silencio (M3)",
    },
    {
      name: "M4: un crédito con su venta viva vuelve a espera",
      from: "  if v_viejo = 'acreditado' and v_nuevo = 'registrado'\n     and (old.accredited_invoice_id is null",
      to: "  if false and v_viejo = 'acreditado' and v_nuevo = 'registrado'\n     and (old.accredited_invoice_id is null",
      fails: "TEST 0494: con su venta viva, un crédito no vuelve a espera (M4)",
    },
    {
      name: "M7: avanzar sin el filtro de tenant",
      from: "  where r.id = p_referral_id and r.tenant_id = v_tenant and r.deleted_at is null\n  for update;\n  if not found then\n    raise exception 'El referido no existe.' using errcode = '22023', hint = 'dtd-referidos';\n  end if;\n\n  if v_ref.status::text = 'invitado'",
      to: "  where r.id = p_referral_id and r.deleted_at is null\n  for update;\n  if not found then\n    raise exception 'El referido no existe.' using errcode = '22023', hint = 'dtd-referidos';\n  end if;\n\n  if v_ref.status::text = 'invitado'",
      fails: "TEST 0494: el admin de otro tenant no avanza un referido del tenant A (M7)",
    },
    {
      name: "M7: acreditar sin el filtro de tenant",
      from: "  where r.id = p_referral_id and r.tenant_id = v_tenant and r.deleted_at is null\n  for update;\n  if not found then\n    raise exception 'El referido no existe.' using errcode = '22023', hint = 'dtd-referidos';\n  end if;\n  if v_ref.status::text not in ('registrado', 'primer-embarque') then",
      to: "  where r.id = p_referral_id and r.deleted_at is null\n  for update;\n  if not found then\n    raise exception 'El referido no existe.' using errcode = '22023', hint = 'dtd-referidos';\n  end if;\n  if v_ref.status::text not in ('registrado', 'primer-embarque') then",
      fails: "TEST 0494: el admin de otro tenant no acredita un referido del tenant A (M7)",
    },
    {
      name: "M5: el postflight detecta una RPC abierta a anon",
      from: "grant execute on function public.avanzar_referido(uuid, text, text) to authenticated;",
      to: "grant execute on function public.avanzar_referido(uuid, text, text) to authenticated, anon;",
      fails: "0494: postflight — las tres RPC sin DEFINER, search_path o ACL esperados",
    },
  ];
  for (const m of MUTANTS) {
    it(`mutante ${m.name}: muere donde debe`, async () => {
      const result = await contract({ migration: mutant(m.from, m.to) });
      expect(result.error).toBe(m.fails);
    }, SLOW);
  }

  it("deriva de 0250: con el cuerpo vivo de producción del trigger de acreditación, la 0494 aplica", async () => {
    const vivo = vivo0250();
    expect(createHash("md5").update(cuerpoDe0250(vivo), "utf8").digest("hex")).toBe("4d3026c55e3507024cc3b44e57f0dca9");
    const result = await contract({ replace: { "0250_referral_settings.sql": vivo } });
    expect(result.error).toBeNull();
    expect(result.green).toMatch(/^TEST 0494 GREEN: \d+ aserciones$/);
  }, SLOW);

  it("control rojo de la deriva: sin la huella viva en la lista, ese cuerpo aborta", async () => {
    const sinVivo = mutant(
      "     array['e63cc18830e7b7a291c7429dcbcc3e18',     -- 0250 del repo\n" +
        "           '4d3026c55e3507024cc3b44e57f0dca9'],    -- vivo en producción (994 caracteres)\n" +
        "     array['a2522752dbac935710d568310e1ba18c',\n" +
        "           'c808193448382b4908fd3543cbaa4fcb']),",
      "     array['e63cc18830e7b7a291c7429dcbcc3e18'],\n     array['a2522752dbac935710d568310e1ba18c']),",
    );
    const result = await contract({ migration: sinVivo, replace: { "0250_referral_settings.sql": vivo0250() } });
    expect(result.error).toBe(
      "0494 abortado: public.accredit_referral_on_first_invoice() tiene otro cuerpo " +
        "(md5 4d3026c55e3507024cc3b44e57f0dca9, sin espacios c808193448382b4908fd3543cbaa4fcb); revisar antes de aplicar",
    );
  }, SLOW);

  it("el preflight aborta si apply_referral_credit tiene otro cuerpo", async () => {
    const m0471 = readFileSync(resolve(ROOT, "supabase/migrations/0471_credito_referido_atomico.sql"), "utf8");
    const desde = "  v_applied_at timestamptz := pg_catalog.clock_timestamp();\n";
    expect(m0471.replace(/\r\n/g, "\n").split(desde)).toHaveLength(2);
    const otro = m0471.replace(/\r\n/g, "\n").split(desde).join(desde + "  -- cambio hecho a mano en producción\n");
    const result = await contract({ replace: { "0471_credito_referido_atomico.sql": otro } });
    expect(result.error).toMatch(
      /^0494 abortado: public\.apply_referral_credit\(uuid,uuid\) tiene otro cuerpo \(md5 [0-9a-f]{32}, sin espacios [0-9a-f]{32}\); revisar antes de aplicar$/,
    );
  }, SLOW);

  it("deriva de 0098: con la policy viva de producción (sin deleted_at), la 0494 aplica; con otra, aborta", async () => {
    // Leída por el Director con pg_policies el 2026-10-20: el qual vivo no tiene «and deleted_at is null».
    const m0098 = readFileSync(resolve(ROOT, "supabase/migrations/0098_fidelizacion_referidos.sql"), "utf8").replace(/\r\n/g, "\n");
    const repo = "using (tenant_id = public.get_user_tenant_id() and deleted_at is null)";
    expect(m0098.split(repo)).toHaveLength(2);
    const vivo = await contract({
      replace: { "0098_fidelizacion_referidos.sql": m0098.split(repo).join("using (tenant_id = public.get_user_tenant_id())") },
    });
    expect(vivo.error).toBeNull();
    expect(vivo.green).toMatch(/^TEST 0494 GREEN: \d+ aserciones$/);
    const otra = await contract({
      replace: { "0098_fidelizacion_referidos.sql": m0098.split(repo).join("using (true)") },
    });
    expect(otra.error).toBe(
      "0494 abortado: la policy «referrals by tenant» no es la de 0098 ni la viva de producción; revisar antes de aplicar",
    );
  }, SLOW);

  it("aplicada dos veces, la segunda aborta con «ya existe»", async () => {
    const result = await contract({ migration: FILE_0494 + "\n" + FILE_0494 });
    expect(result.error).toBe("0494 abortado: el candado de referidos ya existe");
  }, SLOW);

  it("la 0494 espera en pendingBelowCutoff, MIGRATE-FIRST y con OK nominal de Sam", () => {
    const baseline = JSON.parse(readFileSync(resolve(ROOT, "supabase/migrations-baseline.json"), "utf8")) as {
      pendingBelowCutoff: Record<string, string>;
    };
    const espera = baseline.pendingBelowCutoff["0494_credito_referido_candado"];
    expect(espera).toContain("MIGRATE-FIRST");
    expect(espera).toContain("Requiere OK nominal de Sam");
    expect(FILE_0494).toContain(
      "⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en\n--    supabase/migrations-baseline.json › pendingBelowCutoff",
    );
  });
});

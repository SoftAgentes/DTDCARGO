// @vitest-environment node
/**
 * SDD-0571 · La migración 0496 (tarifa congelada por recepción) corrida de verdad
 * sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0496_tarifa_congelada_por_embarque.test.sql` corre
 * en `verify` con Docker, pero el CI de calidad no tiene Docker. PGlite corre ese
 * MISMO contrato, con el `.sql` real de la migración inlineado: lo que se prueba
 * es el texto que el runbook aplicará a producción, no un doble.
 *
 * CONTROL ROJO: sin 0496 el contrato falla en la primera aserción. MUTANTES: sin
 * cada regla, el contrato cae en la aserción de esa regla y no en otra. Además:
 * el preflight aborta con un cuerpo ajeno, la reaplicación aborta y la espera
 * está declarada.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0496_tarifa_congelada_por_embarque.test.sql");
const SCHEMA = resolve(ROOT, "supabase/tests/_0496_tarifa_congelada_schema.sql");
const M0496 = "0496_tarifa_congelada_por_embarque.sql";
const FILE_0496 = readFileSync(resolve(ROOT, "supabase/migrations", M0496), "utf8");
const AUDIT_CALL = `  v_audit_id := public.append_audit_event(
    v_tenant, 'warehouse_receipt_cn', v_row.receipt_id,
    'user', v_row.frozen_by,
    case when v_live is null then 'rate_snapshot_frozen' else 'rate_snapshot_replaced' end,
    'rpc', 'succeeded', v_reason,
    v_audit_before,
    pg_catalog.to_jsonb(v_row) - 'client_markbox' - 'reason',
    pg_catalog.jsonb_build_object(
      'operation', 'congelar_tarifa_recepcion',
      'snapshot_id', v_new_id, 'replaced_snapshot_id', v_live),
    pg_catalog.concat('rate-snapshot:', v_new_id::text),
    1, 'internal'
  );`;
const CONTRACT_TEXT = readFileSync(CONTRACT, "utf8");
const AUDIT_BEGIN = "-- SDD0571_AUDIT_FIXTURE_BEGIN";
const AUDIT_END = "-- SDD0571_AUDIT_FIXTURE_END";
if (CONTRACT_TEXT.split(AUDIT_BEGIN).length !== 2 || CONTRACT_TEXT.split(AUDIT_END).length !== 2) {
  throw new Error("Fixture de auditoría0496 ausente o duplicada");
}
const AUDIT_FIXTURE_SQL = CONTRACT_TEXT.split(AUDIT_BEGIN)[1].split(AUDIT_END)[0];
const SLOW = 240_000;

const TRUE = /^(t|true|on|y|yes|1)$/i;
const FALSE = /^(f|false|off|n|no|0)$/i;

/**
 * psql → SQL plano con las metaórdenes del contrato: \set, \if :{?v} / :v,
 * \else, \endif e \ir. `replace` sustituye el texto de un archivo (mutante).
 * Copia de client-outstanding.migration.test.ts.
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

async function contract(options: { applyFix?: boolean; migration?: string; schema?: string } = {}) {
  const replace: Record<string, string> = {};
  if (options.migration) replace[M0496] = options.migration;
  if (options.schema) replace["_0496_tarifa_congelada_schema.sql"] = options.schema;
  const sql = inline(CONTRACT, { apply_fix: String(options.applyFix ?? true) }, replace);
  const db = new PGlite();
  try {
    const results = await db.exec(sql);
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0496 GREEN"));
    return { error: null as string | null, green };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), green: undefined };
  } finally {
    await db.close();
  }
}

/** 0496 con un único cambio; falla si el texto a cambiar no aparece una sola vez. */
function mutant(from: string, to: string): string {
  expect(FILE_0496.split(from)).toHaveLength(2);
  return FILE_0496.replace(from, () => to);
}

describe("SDD-0571 · 0496 tarifa congelada por recepción (PGlite)", () => {
  it("el contrato pasa con 0496", async () => {
    const result = await contract();
    expect(result.error).toBeNull();
    expect(result.green).toMatch(/^TEST 0496 GREEN: \d+ aserciones$/);
  }, SLOW);

  it("control rojo: sin 0496 falla en la primera aserción", async () => {
    const result = await contract({ applyFix: false });
    expect(result.error).toBe("TEST 0496: existe public.shipment_rate_snapshots");
  }, SLOW);

  const MUTANTS: { name: string; from: string; to: string; fails: string }[] = [
    {
      name: "sin exigir el estimado aceptado",
      from: "    if v_quote.status <> 'accepted' then",
      to: "    if false then",
      fails: "TEST 0496: un estimado en borrador no congela",
    },
    {
      name: "sin comparar el cliente del estimado",
      from: "    if pg_catalog.upper(pg_catalog.btrim(coalesce(v_quote.client_markbox, '')))\n       <> pg_catalog.upper(pg_catalog.btrim(v_receipt.client_markbox)) then",
      to: "    if false then",
      fails: "TEST 0496: un estimado de otro cliente no congela",
    },
    {
      name: "sin normalizar el Shipping Mark del estimado",
      from: "    if pg_catalog.upper(pg_catalog.btrim(coalesce(v_quote.client_markbox, '')))",
      to: "    if coalesce(v_quote.client_markbox, '')",
      fails: "TARIFA_ESTIMADO_OTRO_CLIENTE",
    },
    {
      name: "sin el tenant del estimado",
      from: "    where q.id = p_quote_id and q.tenant_id = v_tenant and q.deleted_at is null;",
      to: "    where q.id = p_quote_id and q.deleted_at is null;",
      fails: "TEST 0496: un estimado de otro tenant no existe para este",
    },
    {
      name: "sin el mínimo de la fila del estimado",
      from: "    select x.id, coalesce(x.min_charge, 0) into v_rate_id, v_min",
      to: "    select x.id, 0 into v_rate_id, v_min",
      fails: "TEST 0496: estimado aceptado: su precio, el mínimo de su fila del tarifario y su servicio",
    },
    {
      name: "sin el precio pactado",
      from: "         and v_book_base is not null and v_book_base > 0 then",
      to: "         and false then",
      fails: "TEST 0496: aliado con precio pactado: 700, y el mínimo de la casa",
    },
    {
      name: "sin aplicar el descuento",
      from: "        v_per := pg_catalog.round(v_rate.per_cbm * (1 - v_pct / 100), 2);",
      to: "        v_per := v_rate.per_cbm;",
      fails: "TEST 0496: aliado con descuento: 850 menos 10 % = 765, y el mínimo sin descontar",
    },
    {
      name: "aceptando cualquier lista",
      from: "    elsif v_house is not null and v_rate.price_book_id = v_house then",
      to: "    elsif true then",
      fails: "TEST 0496: la tarifa propia de otro aliado no se usa para un cliente directo",
    },
    {
      name: "sin comparar el servicio",
      from: "    if v_rate.service <> p_service then",
      to: "    if false then",
      fails: "TEST 0496: la fila tiene que ser del servicio pedido",
    },
    {
      name: "sin el tenant de la fila del tarifario",
      from: "    where x.id = p_rate_id and x.tenant_id = v_tenant and x.deleted_at is null;",
      to: "    where x.id = p_rate_id and x.deleted_at is null;",
      fails: "TEST 0496: una fila de otro tenant no existe para este",
    },
    {
      name: "aceptando una fila borrada",
      from: "    where x.id = p_rate_id and x.tenant_id = v_tenant and x.deleted_at is null;",
      to: "    where x.id = p_rate_id and x.tenant_id = v_tenant;",
      fails: "TEST 0496: una fila borrada no congela",
    },
    {
      name: "aceptando una huérfana",
      from: "  if v_receipt.is_orphan then",
      to: "  if false then",
      fails: "TEST 0496: una huérfana no tiene a quién cobrarle",
    },
    {
      name: "sin el tenant de la recepción",
      from: "    where r.id = p_receipt_id and r.tenant_id = v_tenant and r.deleted_at is null\n    for update;",
      to: "    where r.id = p_receipt_id and r.deleted_at is null\n    for update;",
      fails: "TEST 0496: una recepción de otro tenant no existe para este",
    },
    {
      name: "aceptando una recepción eliminada",
      from: "    where r.id = p_receipt_id and r.tenant_id = v_tenant and r.deleted_at is null\n    for update;",
      to: "    where r.id = p_receipt_id and r.tenant_id = v_tenant\n    for update;",
      fails: "TEST 0496: una recepción eliminada no existe",
    },
    {
      name: "sin el rol para ver",
      from: "     or v_role not in ('admin', 'operations', 'warehouse', 'support', 'accounting') then",
      to: "     then",
      fails: "TEST 0496: commercial no ve ni congela",
    },
    {
      name: "sin el rol para congelar",
      from: "  if not v_elevated and v_role not in ('admin', 'operations', 'warehouse', 'accounting') then",
      to: "  if false then",
      fails: "TEST 0496: support no congela",
    },
    {
      name: "sin el rol para lo excepcional",
      from: "  if v_elevated and v_role not in ('admin', 'accounting') then",
      to: "  if false then",
      fails: "TEST 0496: warehouse no fija a mano",
    },
    {
      name: "con 1.000 kg/m³ como algo común",
      from: "  v_elevated := v_source in ('manual', 'excel_yiwu') or p_included_kg_per_cbm = 1000 or v_live is not null;",
      to: "  v_elevated := v_source in ('manual', 'excel_yiwu') or v_live is not null;",
      fails: "TEST 0496: 1.000 kg/m³ no lo fija operations",
    },
    {
      name: "sin pedir motivo para lo excepcional",
      from: "  if v_elevated and v_reason is null then",
      to: "  if false then",
      fails: "TEST 0496: a mano exige motivo",
    },
    {
      name: "volviendo a congelar sin motivo",
      from: "  if v_live is not null and v_reason is null then",
      to: "  if false then",
      fails: "TEST 0496: una recepción con tarifa no se vuelve a congelar sin motivo",
    },
    {
      name: "sin marcar la reemplazada",
      from: "  if v_live is not null then\n    update public.shipment_rate_snapshots",
      to: "  if false then\n    update public.shipment_rate_snapshots",
      fails: "shipment_rate_snapshots_una_viva_por_recepcion",
    },
    {
      name: "sin el mínimo en lo que se factura",
      from: "                        (greatest(round(cbm * per_cbm, 2), min_charge)) stored,",
      to: "                        (round(cbm * per_cbm, 2)) stored,",
      fails: "TEST 0496: el mínimo se cobra: 0.03 × 850 = 25.50 < 50",
    },
    {
      name: "sin el mínimo en la vista previa",
      from: "    v_row.amount_to_invoice := greatest(pg_catalog.round(v_row.cbm * v_row.per_cbm, 2), v_row.min_charge);",
      to: "    v_row.amount_to_invoice := pg_catalog.round(v_row.cbm * v_row.per_cbm, 2);",
      fails: "TEST 0496: la vista previa también cobra el mínimo",
    },
    {
      name: "aceptando una fila vencida",
      from: "    if v_rate.valid_until is not null and v_rate.valid_until < v_today then",
      to: "    if false then",
      fails: "TEST 0496: una tarifa vencida no congela",
    },
    {
      name: "sin comparar el destino",
      from: "    if v_rate.destination not ilike '%' || pg_catalog.btrim(v_receipt.destination_city) || '%' then",
      to: "    if false then",
      fails: "TEST 0496: una tarifa de otro destino no congela",
    },
    {
      name: "sin exigir la ciudad destino",
      from: "    if pg_catalog.btrim(coalesce(v_receipt.destination_city, '')) = '' then",
      to: "    if false then",
      fails: "TEST 0496: sin ciudad destino no se congela desde el tarifario",
    },
    {
      name: "aceptando la casa cuando la lista del cliente tiene su tarifa",
      from: "         and exists (\n           select 1 from public.rates o",
      to: "         and false and exists (\n           select 1 from public.rates o",
      fails: "TEST 0496: si la lista del cliente tiene su tarifa para la ruta, la de la casa no se acepta",
    },
    {
      name: "dejando TRUNCATE a service_role (lo ataja el postflight)",
      from: "revoke truncate on table public.shipment_rate_snapshots from public, anon, authenticated, service_role;",
      to: "",
      fails: "0496: postflight — grants de shipment_rate_snapshots distintos de lo prometido",
    },
    {
      name: "sin la inmutabilidad",
      from: "  if v_fixed_new is distinct from v_fixed_old then",
      to: "  if false then",
      fails: "TEST 0496: ni service_role edita la tarifa",
    },
    {
      name: "dejando borrar",
      from: "    if exists (select 1 from public.warehouse_receipts_cn r where r.id = old.receipt_id)",
      to: "    if false and exists (select 1 from public.warehouse_receipts_cn r where r.id = old.receipt_id)",
      fails: "TEST 0496: ni service_role la borra",
    },
    {
      name: "dejando cambiar el envío",
      from: "  if old.shipment_id is not null and new.shipment_id is distinct from old.shipment_id then",
      to: "  if false then",
      fails: "TEST 0496: y después no lo cambia",
    },
    {
      name: "sin el tenant de la recepción y del cliente en el INSERT",
      from: "    if not exists (select 1 from public.warehouse_receipts_cn r\n                   where r.id = new.receipt_id and r.tenant_id = new.tenant_id)\n       or not exists (select 1 from public.clients c\n                      where c.id = new.client_id and c.tenant_id = new.tenant_id)\n",
      to: "    if false\n",
      fails: "TEST 0496: un INSERT directo no mezcla tenants",
    },
    {
      name: "sin la misma recepción en el reemplazo",
      from: "      and n.receipt_id = new.receipt_id\n",
      to: "",
      fails: "TEST 0496: un reemplazo que apunta a otra recepción no pasa el chequeo diferido",
    },
    {
      name: "sin el rol en la lectura",
      from: "    and (select public.current_studio_role())\n        in ('admin', 'operations', 'warehouse', 'support', 'accounting', 'commercial')\n",
      to: "",
      fails: "TEST 0496: marketing no lee",
    },
    {
      name: "sin el tenant en la lectura",
      from: "    tenant_id = (select public.get_user_tenant_id())\n    and (select",
      to: "    (select",
      fails: "TEST 0496: el otro tenant solo ve la suya",
    },
    {
      name: "sin persistir el evento aunque se invente un identificador",
      from: AUDIT_CALL,
      to: "  v_audit_id := pg_catalog.gen_random_uuid();",
      fails: "TEST 0496: la creación guarda un evento canónico con actor tenant snapshot y correlación",
    },
    {
      name: "sin distinguir el reemplazo en su evento",
      from: "case when v_live is null then 'rate_snapshot_frozen' else 'rate_snapshot_replaced' end",
      to: "'rate_snapshot_frozen'",
      fails: "TEST 0496: el reemplazo guarda otro evento con antes después motivo y vínculo anterior",
    },
    {
      name: "absorbiendo el error del log y fingiendo su identificador",
      from: AUDIT_CALL,
      to: "  begin\n" + AUDIT_CALL + "\n  exception when others then\n    v_audit_id := pg_catalog.gen_random_uuid();\n  end;",
      fails: "TEST 0496: un fallo del log aborta la creación",
    },
    {
      name: "aceptando un evento sin identificador",
      from: "  if v_audit_id is null then",
      to: "  if false then",
      fails: "TEST 0496: un evento sin identificador aborta la creación",
    },
  ];

  for (const m of MUTANTS) {
    it(`mutante: ${m.name}`, async () => {
      const result = await contract({ migration: mutant(m.from, m.to) });
      expect(result.green).toBeUndefined();
      expect(result.error ?? "").toContain(m.fails);
    }, SLOW);
  }

  /**
   * DERIVA de producción (leída por el Director el 2026-10-20): el cuerpo vivo
   * de resolve_price_book es el de la 0382 sin sus dos líneas de comentario
   * (md5 4f39f434…). Misma lógica: el preflight lo acepta y el contrato entero
   * pasa con ese cuerpo.
   */
  const SCHEMA_TEXT = readFileSync(SCHEMA, "utf8");
  const COMENTARIO_0382 =
    "       -- Tope de seguridad: el trigger anti-ciclo de la 0362 lo impide, pero una\n"
    + "       -- recursión sin freno en una función `stable` cuelga la sesión entera.\n";
  const SCHEMA_LF = SCHEMA_TEXT.replace(/\r\n/g, "\n");
  const SCHEMA_VIVO = SCHEMA_LF.replace(COMENTARIO_0382, "");

  it("el cuerpo vivo de resolve_price_book (sin comentarios) se acepta y el contrato pasa", async () => {
    expect(SCHEMA_VIVO).not.toBe(SCHEMA_LF);
    const result = await contract({ schema: SCHEMA_VIVO });
    expect(result.error).toBeNull();
    expect(result.green).toMatch(/^TEST 0496 GREEN: \d+ aserciones$/);
  }, SLOW);

  it("control rojo de la deriva: sin aceptar el cuerpo vivo, el preflight aborta", async () => {
    const sinVivo = mutant(
      "       and not (v_expected.signature = 'public.resolve_price_book(uuid)'\n"
      + "                and (v_md5 = '4f39f4349889a6e5a00bb5d85617751c'\n"
      + "                     or v_md5_normalized = '7004f04b5c3815441a63a99ffab49b4c')) then",
      "       then",
    );
    const result = await contract({ schema: SCHEMA_VIVO, migration: sinVivo });
    expect(result.error).toMatch(/0496 abortado: public\.resolve_price_book\(uuid\) tiene otro cuerpo \(md5 4f39f4349889a6e5a00bb5d85617751c/);
  }, SLOW);

  it("el preflight aborta si resolve_price_book tiene otro cuerpo, sin crear nada", async () => {
    const db = new PGlite();
    try {
      const schema = inline(SCHEMA, {}).replace("  with recursive cliente as (", "  with recursive cliente as ( -- cambiado");
      await db.exec(schema + "\n" + AUDIT_FIXTURE_SQL);
      await expect(db.exec(FILE_0496)).rejects.toThrow(
        /0496 abortado: public\.resolve_price_book\(uuid\) tiene otro cuerpo/,
      );
      const r = await db.query<{ t: string | null }>("select to_regclass('public.shipment_rate_snapshots')::text as t");
      expect(r.rows[0].t).toBeNull();
    } finally {
      await db.close();
    }
  }, SLOW);

  it("aplicada dos veces, la segunda aborta", async () => {
    const db = new PGlite();
    try {
      await db.exec(inline(SCHEMA, {}) + "\n" + AUDIT_FIXTURE_SQL + "\n" + FILE_0496);
      await expect(db.exec(FILE_0496)).rejects.toThrow(/0496 abortado: shipment_rate_snapshots o congelar_tarifa_recepcion ya existen/);
    } finally {
      await db.close();
    }
  }, SLOW);

  it("el preflight exige auditoría antes de crear el dominio", async () => {
    const db = new PGlite();
    try {
      await db.exec(inline(SCHEMA, {}));
      await expect(db.exec(FILE_0496)).rejects.toThrow(
        "0496 requiere el contrato de auditoría y append_audit_event",
      );
      const r = await db.query<{ t: string | null }>(
        "select to_regclass('public.shipment_rate_snapshots')::text as t",
      );
      expect(r.rows[0].t).toBeNull();
    } finally {
      await db.close();
    }
  }, SLOW);

  it("la espera está declarada en el baseline y la migración lo dice", () => {
    const baseline = JSON.parse(readFileSync(resolve(ROOT, "supabase/migrations-baseline.json"), "utf8")) as {
      pendingBelowCutoff: Record<string, string>;
    };
    const espera = baseline.pendingBelowCutoff["0496_tarifa_congelada_por_embarque"];
    expect(espera).toMatch(/^PENDIENTE DE APLICAR — SDD-0571/);
    expect(espera).toContain("MIGRATE-FIRST");
    expect(FILE_0496).toContain("⚠️ NO APLICADA A PRODUCCIÓN");
  });
});

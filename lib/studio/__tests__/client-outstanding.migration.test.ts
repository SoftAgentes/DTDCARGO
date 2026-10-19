// @vitest-environment node
/**
 * SDD-0558 · La migración 0492 (`public.client_outstanding`) corrida de verdad
 * sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0492_client_outstanding.test.sql` corre en
 * `verify` con Docker, pero el CI de calidad no tiene Docker. PGlite corre ese
 * MISMO contrato, con el `.sql` real de la migración inlineado: lo que se
 * prueba es el texto que el runbook aplicará a producción, no un doble.
 *
 * CONTROL ROJO: sin 0492 el contrato falla en la primera aserción. MUTANTES: sin
 * cada regla, el contrato cae en la aserción de esa regla y no en otra.
 *
 * Además, cada una en su propia instancia de PGlite (sin tocar el contrato):
 *  - ANTI-DERIVA de estados: la lista de la 0492 es la de
 *    `ESTADOS_FACTURA_CON_SALDO` y la de las otras copias del repo;
 *  - ANTI-DERIVA del permiso: para cada rol, con y sin override de `clients`,
 *    la 0492 responde lo mismo que `puedeVerSaldoCliente`;
 *  - PARIDAD (propiedad, con semillas fijas): la cola de Cobranzas
 *    (`buildReceivablesQueue`) sumada por los códigos del cliente y por moneda
 *    da `open_amount`, `overdue_amount` y sus conteos.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import {
  ESTADOS_FACTURA_CON_SALDO,
  puedeVerSaldoCliente,
} from "../client-account";
import { buildReceivablesQueue } from "../payment-queries";
import { SALE_STATUSES } from "../fiscal/queries";
import { ESTADOS_DE_INGRESO } from "../accounting/ingreso-periodo";
import type { Invoice, InvoiceCurrency, InvoiceStatus } from "../invoice-types";
import type { RoleModuleOverrides } from "../rbac";
import type { StudioUserRole } from "../user-types";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0492_client_outstanding.test.sql");
const SCHEMA = resolve(ROOT, "supabase/tests/_0492_client_outstanding_schema.sql");
const M0492 = "0492_client_outstanding.sql";
const FILE_0492 = readFileSync(resolve(ROOT, "supabase/migrations", M0492), "utf8");
const SLOW = 240_000;

const TRUE = /^(t|true|on|y|yes|1)$/i;
const FALSE = /^(f|false|off|n|no|0)$/i;

/**
 * psql → SQL plano con las metaórdenes del contrato: \set, \if :{?v} / :v,
 * \else, \endif e \ir. `replace` sustituye el texto de una migración (mutante).
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

async function contract(options: { applyFix?: boolean; migration?: string } = {}) {
  const sql = inline(CONTRACT, { apply_fix: String(options.applyFix ?? true) },
    options.migration ? { [M0492]: options.migration } : {});
  const db = new PGlite();
  try {
    const results = await db.exec(sql);
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0492 GREEN"));
    return { error: null as string | null, green };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), green: undefined };
  } finally {
    await db.close();
  }
}

/** 0492 con un único cambio; falla si el texto a cambiar no aparece una sola vez. */
function mutant(from: string, to: string): string {
  expect(FILE_0492.split(from)).toHaveLength(2);
  return FILE_0492.replace(from, () => to);
}

/** Una base con el esquema mínimo y la 0492 real, sin datos. */
async function baseCon0492(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(inline(SCHEMA, {}) + "\n" + FILE_0492);
  return db;
}

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const pgArray = (ids: string[]) => `{${ids.join(",")}}`;

/** Llama a la 0492 con los claims de la solicitud y el rol API, y vuelve a postgres. */
async function comoActor(
  db: PGlite,
  actor: { sub: string | null; role: "authenticated" | "service_role" },
  ids: string[],
): Promise<{ rows: Record<string, unknown>[]; code: string | null }> {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [actor.sub ?? ""]);
  await db.query("select set_config('request.jwt.claim.role', $1, false)", [actor.role]);
  await db.exec(`set role ${actor.role}`);
  try {
    const r = await db.query<Record<string, unknown>>(
      `select client_id, markboxes, currency, open_amount::text as open_amount,
              overdue_amount::text as overdue_amount, open_invoices, overdue_invoices,
              as_of::text as as_of
       from public.client_outstanding($1::uuid[])`,
      [pgArray(ids)],
    );
    return { rows: r.rows, code: null };
  } catch (error) {
    return { rows: [], code: (error as { code?: string }).code ?? "error" };
  } finally {
    await db.exec("reset role");
  }
}

describe("SDD-0558 · 0492 saldo único por cliente (PGlite)", () => {
  it("el contrato pasa con 0492", async () => {
    const result = await contract();
    expect(result.error).toBeNull();
    expect(result.green).toMatch(/^TEST 0492 GREEN: \d+ aserciones$/);
  }, SLOW);

  it("control rojo: sin 0492 falla en la primera aserción", async () => {
    const result = await contract({ applyFix: false });
    expect(result.error).toBe("TEST 0492: existe public.client_outstanding(uuid[])");
  }, SLOW);

  const MUTANTS: { name: string; from: string; to: string; fails: string }[] = [
    {
      name: "con el borrador en la lista de estados",
      from: "i.status in ('emitida', 'parcial', 'pagada', 'vencida') as counted",
      to: "i.status in ('borrador', 'emitida', 'parcial', 'pagada', 'vencida') as counted",
      fails: "TEST 0492: un borrador no es deuda",
    },
    {
      name: "con la anulada en la lista de estados",
      from: "i.status in ('emitida', 'parcial', 'pagada', 'vencida') as counted",
      to: "i.status in ('emitida', 'parcial', 'pagada', 'vencida', 'anulada') as counted",
      fails: "TEST 0492: una anulada no es deuda",
    },
    {
      name: "sin el piso por factura",
      from: "case when v.counted then greatest(0::numeric, v.net) else 0::numeric end as open_part",
      to: "case when v.counted then v.net else 0::numeric end as open_part",
      fails: "TEST 0492: un sobrepago no compensa otra factura",
    },
    {
      name: "sin el historial de códigos",
      from: "    union all\n    select f.root_id, f.root_tenant, h.markbox\n    from family as f\n"
        + "    join public.client_markbox_history as h\n      on h.client_id = f.member_id and h.tenant_id = f.root_tenant\n",
      to: "\n",
      fails: "TEST 0492: un código retirado del historial cuenta",
    },
    {
      name: "sin el paso recursivo de las fusiones",
      from: "    union all\n    select f.root_id, f.root_tenant, m.id, f.depth + 1\n    from family as f\n"
        + "    join public.clients as m\n      on m.merged_into_client_id = f.member_id and m.tenant_id = f.root_tenant\n"
        + "    where f.depth < 10\n",
      to: "\n",
      fails: "TEST 0492: la ficha fusionada y la fusión encadenada cuentan",
    },
    {
      name: "con current_date en lugar de la fecha de Caracas",
      from: "v_as_of date := (pg_catalog.now() at time zone 'America/Caracas')::date;",
      to: "v_as_of date := current_date;",
      fails: "TEST 0492: la fecha de Caracas manda en Pacific/Kiritimati y en Etc/GMT+12:"
        + " lo que vence hoy no está vencido",
    },
    {
      name: "sin el filtro de facturas eliminadas",
      from: "     and pg_catalog.upper(pg_catalog.btrim(i.client_markbox)) = k.code_key\n    where i.deleted_at is null\n",
      to: "     and pg_catalog.upper(pg_catalog.btrim(i.client_markbox)) = k.code_key\n",
      fails: "TEST 0492: una factura eliminada no es deuda",
    },
    {
      name: "sin el filtro de recibos anulados",
      from: "    where r.deleted_at is null\n",
      to: "\n",
      fails: "TEST 0492: último pago: el recibo anulado, el reporte sin confirmar y el confirmado borrado"
        + " no cuentan; el confirmado sí",
    },
    {
      name: "sin exigir el reporte confirmado",
      from: "    where p.status = 'confirmado' and p.deleted_at is null\n",
      to: "    where p.deleted_at is null\n",
      fails: "TEST 0492: último pago: el recibo anulado, el reporte sin confirmar y el confirmado borrado"
        + " no cuentan; el confirmado sí",
    },
    {
      name: "con el último pago solo de las facturas que cuentan",
      from: "    where w.counted or w.paid_on is not null\n",
      to: "    where w.counted\n",
      fails: "TEST 0492: un recibo vivo sobre una factura anulada cuenta como último pago",
    },
    {
      name: "con igualdad exacta de códigos",
      from: "     and pg_catalog.upper(pg_catalog.btrim(i.client_markbox)) = k.code_key\n",
      to: "     and i.client_markbox = k.code\n",
      fails: "TEST 0492: el código se compara sin espacios ni mayúsculas, como resolve_markbox",
    },
    {
      name: "sin el tenant en el cruce con facturas",
      from: "      on i.tenant_id = k.root_tenant\n     and pg_catalog.upper",
      to: "      on true\n     and pg_catalog.upper",
      fails: "TEST 0492: el mismo código en otro tenant no cuenta",
    },
    {
      name: "sin el filtro de tenant de la ficha pedida",
      from: "      and (v_service or c.tenant_id = v_tenant)\n",
      to: "      and true\n",
      fails: "TEST 0492: una ficha de otro tenant no devuelve fila",
    },
    {
      name: "sin el filtro de fichas borradas",
      from: "    where c.id = any (p_client_ids)\n      and c.deleted_at is null\n",
      to: "    where c.id = any (p_client_ids)\n",
      fails: "TEST 0492: una ficha borrada no devuelve fila",
    },
    {
      name: "sin la rama admin/accounting del permiso",
      from: "       or not (v_role in ('admin', 'accounting')\n               or public.document_entity_authorized",
      to: "       or not (false\n               or public.document_entity_authorized",
      fails: "TEST 0492: accounting ve el saldo aunque un override le quite clients",
    },
    {
      name: "sin el autorizador de clients (solo finanzas)",
      from: "               or public.document_entity_authorized('client', v_tenant, 'view')) then",
      to: "               or false) then",
      fails: "TEST 0492: commercial, operations, admin y el warehouse con override de clients ven el saldo",
    },
    {
      name: "sin reconocer a service_role",
      from: "  v_service boolean := coalesce((select auth.role()), '') = 'service_role';",
      to: "  v_service boolean := false;",
      fails: "TEST 0492: service_role sin sesión ve las fichas de los dos tenants",
    },
    {
      name: "sin el tope de 1000 ids",
      from: "  if pg_catalog.cardinality(p_client_ids) > 1000 then",
      to: "  if pg_catalog.cardinality(p_client_ids) > 100000 then",
      fails: "TEST 0492: más de 1000 ids da 22023",
    },
  ];
  for (const m of MUTANTS) {
    it(`mutante ${m.name}: muere donde debe`, async () => {
      const result = await contract({ migration: mutant(m.from, m.to) });
      expect(result.error).toBe(m.fails);
    }, SLOW);
  }
});

describe("SDD-0558 · la espera y las huellas del preflight", () => {
  const BASELINE = JSON.parse(readFileSync(resolve(ROOT, "supabase/migrations-baseline.json"), "utf8")) as {
    pendingBelowCutoff: Record<string, string>;
  };
  const cuerpo = (archivo: string, firma: string) => {
    const t = readFileSync(resolve(ROOT, "supabase/migrations", archivo), "utf8").replace(/\r\n/g, "\n");
    const i = t.indexOf(firma);
    expect(i).toBeGreaterThanOrEqual(0);
    const a = t.indexOf("as $$", i) + "as $$".length;
    return t.slice(a, t.indexOf("$$;", a));
  };
  const md5 = (s: string) => createHash("md5").update(s).digest("hex");

  it("la 0492 espera en pendingBelowCutoff, MIGRATE-FIRST y con OK nominal de Sam", () => {
    const espera = BASELINE.pendingBelowCutoff["0492_client_outstanding"];
    expect(espera).toContain("MIGRATE-FIRST");
    expect(espera).toContain("Requiere OK nominal de Sam");
    expect(FILE_0492).toContain(
      "⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en\n--    supabase/migrations-baseline.json › pendingBelowCutoff",
    );
  });

  it("cada huella del preflight es el md5 del cuerpo que el árbol define por última vez", () => {
    const huellas: [string, string, string][] = [
      ["0453_portal_helpers_principal_determinista.sql", "function public.get_user_tenant_id()", "5ff0c51c26a49419c34abc78f1d95c37"],
      ["0200_rbac_disabled_enforcement.sql", "create or replace function public.current_studio_role()", "b7157932457d04df4e8cf7621d212965"],
      ["0444_unlinked_document_entity_rbac.sql", "create or replace function public.document_entity_authorized(", "4eb9fd08721e8f754087dddc5cb88953"],
      ["0444_unlinked_document_entity_rbac.sql", "create or replace function public.document_entity_module_contract(", "9c78c98fb29c311926f93a1c28ce1c32"],
    ];
    for (const [archivo, firma, huella] of huellas) {
      expect(md5(cuerpo(archivo, firma)), firma).toBe(huella);
      expect(FILE_0492).toContain(`'${huella}'`);
    }
  });
});

describe("SDD-0558 · anti-deriva de los estados que cuentan", () => {
  it("la lista de la 0492 es ESTADOS_FACTURA_CON_SALDO, y las otras copias del repo coinciden", () => {
    const m = /i\.status in \(([^)]*)\) as counted/.exec(FILE_0492);
    expect(m).not.toBeNull();
    const delSql = m![1].split(",").map((s) => s.trim().replace(/^'|'$/g, ""));
    expect(delSql).toEqual([...ESTADOS_FACTURA_CON_SALDO]);
    // Las mismas cuatro, con otro nombre: el libro de ventas y el ingreso del
    // período (FUERA DE ALCANCE DETECTADO: unificarlas).
    expect([...SALE_STATUSES]).toEqual([...ESTADOS_FACTURA_CON_SALDO]);
    expect([...ESTADOS_DE_INGRESO]).toEqual([...ESTADOS_FACTURA_CON_SALDO]);
  });
});

describe("SDD-0558 · anti-deriva del permiso: puedeVerSaldoCliente = 0492", () => {
  it("para cada rol, sin override, con clients concedido y con clients revocado", async () => {
    const db = await baseCon0492();
    try {
      const ROLES: StudioUserRole[] = [
        "admin", "commercial", "operations", "accounting", "warehouse", "support", "marketing",
      ];
      const VARIANTES: { nombre: string; view: boolean | null }[] = [
        { nombre: "sin override", view: null },
        { nombre: "clients concedido", view: true },
        { nombre: "clients revocado", view: false },
      ];
      const cliente = uuid(9001);
      let n = 0;
      const casos: { rol: StudioUserRole; variante: string; tenant: string; user: string; esperado: boolean }[] = [];
      for (const rol of ROLES) {
        for (const v of VARIANTES) {
          // admin no admite override (CHECK de 0357): solo su caso sin override.
          if (rol === "admin" && v.view !== null) continue;
          n += 1;
          const tenant = uuid(100 + n);
          const user = uuid(500 + n);
          await db.query("insert into public.tenants (id, slug, display_name) values ($1, $2, $2)", [tenant, `t${n}`]);
          await db.query("insert into auth.users (id) values ($1)", [user]);
          await db.query("insert into public.user_tenants (user_id, tenant_id, role) values ($1, $2, $3)", [user, tenant, rol]);
          const overrides: RoleModuleOverrides = {};
          if (v.view !== null) {
            await db.query(
              "insert into public.studio_role_module_overrides (tenant_id, role, module_id, can_view, can_edit) values ($1, $2, 'clients', $3, false)",
              [tenant, rol, v.view],
            );
            Object.assign(overrides, { [`${rol}:clients`]: { view: v.view, edit: false } });
          }
          casos.push({ rol, variante: v.nombre, tenant, user, esperado: puedeVerSaldoCliente(rol, overrides) });
        }
      }
      const obtenido = [];
      for (const c of casos) {
        const r = await comoActor(db, { sub: c.user, role: "authenticated" }, [cliente]);
        expect(r.code === null || r.code === "42501").toBe(true);
        obtenido.push({ rol: c.rol, variante: c.variante, ve: r.code === null });
      }
      expect(obtenido).toEqual(casos.map((c) => ({ rol: c.rol, variante: c.variante, ve: c.esperado })));
      // El fixture no es feliz: hay casos de los dos lados.
      expect(casos.some((c) => c.esperado)).toBe(true);
      expect(casos.some((c) => !c.esperado)).toBe(true);
    } finally {
      await db.close();
    }
  }, SLOW);
});

/** PRNG con semilla (mulberry32): la propiedad se repite igual en cada corrida. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ESTADOS: InvoiceStatus[] = ["borrador", "emitida", "parcial", "pagada", "vencida", "anulada"];
const MONEDAS: InvoiceCurrency[] = ["USD", "VES", "USDT", "CNY"];
const round2 = (n: number) => Math.round(n * 100) / 100;

describe("SDD-0558 · paridad: la cola de Cobranzas sumada por cliente = 0492", () => {
  it("con facturas al azar (semillas fijas) de todos los estados, monedas, códigos y fechas", async () => {
    const db = await baseCon0492();
    try {
      const A = uuid(1);
      const B = uuid(2);
      const P1 = uuid(11);
      const P1_FUSIONADA = uuid(12);
      const P2 = uuid(13);
      const PB = uuid(14);
      await db.exec(`
        insert into public.tenants (id, slug, display_name) values
          ('${A}', 'a', 'A'), ('${B}', 'b', 'B');
        insert into public.clients (id, tenant_id, markbox, deleted_at, merged_into_client_id) values
          ('${P1}', '${A}', 'DTD-0101', null, null),
          ('${P1_FUSIONADA}', '${A}', 'DTD-0102', now(), '${P1}'),
          ('${P2}', '${A}', 'DTD-0201', null, null),
          ('${PB}', '${B}', 'DTD-0101', null, null);
        insert into public.client_markbox_history (tenant_id, client_id, markbox) values
          ('${A}', '${P1}', 'DTD-0191');
      `);
      // Códigos posibles de una factura: los del cliente (con la variante sin
      // normalizar), los de otro cliente y uno huérfano. El tenant B repite
      // el código vigente de P1.
      const CODIGOS_A = ["DTD-0101", "DTD-0191", "DTD-0102", " dtd-0101 ", "DTD-0201", "DTD-0999"];

      for (const seed of [558, 1558, 2558, 3558]) {
        const rnd = prng(seed);
        const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
        await db.exec("delete from public.invoices");
        for (let i = 0; i < 70; i += 1) {
          const total = round2(rnd() * 1000);
          // Pagado: a veces 0, a veces parcial, a veces exacto o de más.
          const forma = rnd();
          const paid = forma < 0.35 ? 0 : forma < 0.7 ? round2(total * rnd()) : forma < 0.85 ? total : round2(total * 1.2);
          const due = rnd() < 0.15 ? null : Math.floor(rnd() * 90) - 60;
          const tenant = rnd() < 0.15 ? B : A;
          await db.query(
            `insert into public.invoices (id, tenant_id, invoice_code, client_markbox, currency, total_amount,
               paid_amount, status, due_date, deleted_at)
             values ($1, $2, $3, $4, $5::public.invoice_currency, $6, $7, $8::public.invoice_status,
               case when $9::int is null then null
                    else (now() at time zone 'America/Caracas')::date + $9::int end,
               case when $10 then now() end)`,
            [uuid(10_000 + i), tenant, `F-${seed}-${i}`, tenant === B ? "DTD-0101" : pick(CODIGOS_A),
              pick(MONEDAS), total, paid, pick(ESTADOS), due, rnd() < 0.1],
          );
        }

        const sql = await comoActor(db, { sub: null, role: "service_role" }, [P1, P2]);
        expect(sql.code).toBeNull();

        // Lo que lee receivablesQueue en el tenant A: vivas (`deleted_at is
        // null`). TODOS los estados llegan a la función pura: el filtro de
        // estados de buildReceivablesQueue también queda bajo prueba.
        const { rows } = await db.query<Record<string, unknown>>(
          `select id::text, tenant_id::text, invoice_code, client_markbox, currency::text, total_amount::text,
                  paid_amount::text, status::text, due_date::text
           from public.invoices where tenant_id = $1 and deleted_at is null`,
          [A],
        );
        const invoices = rows.map((r) => ({
          id: String(r.id), tenant_id: String(r.tenant_id), invoice_code: String(r.invoice_code),
          client_markbox: String(r.client_markbox), client_name: "Cliente", client_rif: null,
          client_doc_kind: null, shipment_id: null, shipment_code: null,
          currency: r.currency as InvoiceCurrency, fx_rate: null, iva_rate: 0, iva_mode: null,
          base_amount: Number(r.total_amount), iva_amount: 0, total_amount: Number(r.total_amount),
          status: r.status as InvoiceStatus, issued_at: null, due_date: (r.due_date as string | null) ?? null,
          paid_amount: Number(r.paid_amount), last_payment_at: null, lines: [], notes: null,
          created_at: "", updated_at: "", deleted_at: null,
        })) as Invoice[];

        for (const clientId of [P1, P2]) {
          const filas = sql.rows.filter((r) => r.client_id === clientId);
          expect(filas.length).toBeGreaterThan(0);
          const asOf = String(filas[0].as_of);
          const codigos = new Set((filas[0].markboxes as string[]).map((m) => m.trim().toUpperCase()));
          const cola = buildReceivablesQueue(invoices, new Map(), asOf)
            .filter((r) => codigos.has(r.invoice.client_markbox.trim().toUpperCase()));
          const esperado = new Map<string, { open: number; overdue: number; n: number; nv: number }>();
          for (const r of cola) {
            const e = esperado.get(r.invoice.currency) ?? { open: 0, overdue: 0, n: 0, nv: 0 };
            e.open += r.balance;
            e.n += 1;
            if ((r.daysOverdue ?? 0) > 0) {
              e.overdue += r.balance;
              e.nv += 1;
            }
            esperado.set(r.invoice.currency, e);
          }
          for (const f of filas.filter((r) => r.currency !== null)) {
            const e = esperado.get(String(f.currency)) ?? { open: 0, overdue: 0, n: 0, nv: 0 };
            expect({ seed, cliente: clientId, moneda: f.currency, abierto: round2(e.open), vencido: round2(e.overdue), n: e.n, nv: e.nv })
              .toEqual({ seed, cliente: clientId, moneda: f.currency, abierto: Number(f.open_amount),
                vencido: Number(f.overdue_amount), n: Number(f.open_invoices), nv: Number(f.overdue_invoices) });
            esperado.delete(String(f.currency));
          }
          // Ninguna moneda de la cola quedó sin su fila en la 0492.
          expect([...esperado.entries()].filter(([, e]) => e.open > 0)).toEqual([]);
        }
      }
    } finally {
      await db.close();
    }
  }, SLOW);
});

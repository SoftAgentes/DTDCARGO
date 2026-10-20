// @vitest-environment node
/**
 * SDD-0530 · La migración 0477 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0477_naviera_zarpe_avanza_envios.test.sql` corre
 * en `verify` con Docker, pero el CI de calidad no tiene Docker. PGlite corre
 * ese MISMO contrato con los `.sql` reales inlineados (0357, la auditoría
 * 0258/0261/0267/0294 y 0477): lo que se prueba es el texto que el runbook
 * aplicará a producción, no un doble.
 *
 * CONTROL ROJO: sin 0477 el contrato cae en su primera aserción. MUTANTES: cada
 * uno quita o cambia UNA regla de 0477 y cae en la aserción de esa regla.
 *
 * PROPIEDADES:
 *  - la regla de la base (`naviera_avance_decision`) y la de la app
 *    (`decidirAvance`) dicen lo mismo para cada servicio × estado × destino;
 *  - la matriz de la base (`naviera_avance_module_authorized`) y
 *    `canEditModule` de rbac.ts dicen lo mismo para cada rol, sin desvío y con
 *    cada desvío posible de 0357, en Naviera y en Tracking;
 *  - los enums del fixture son los de lib/shared/shipment-public.ts.
 *
 * PGlite tiene UNA conexión: el FOR UPDATE de la RPC no se prueba con dos
 * sesiones aquí (riesgo anotado en la spec).
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  LOCKED_MODULES,
  ROLE_MODULE_ACCESS,
  SUPERADMIN_ONLY_MODULES,
  WAREHOUSE_SCOPED_MODULES,
  canEditModule,
  type ModuleAccessOverride,
} from "@/lib/studio/rbac";
import { STUDIO_USER_ROLES, type StudioUserRole } from "@/lib/studio/user-types";
import { SHIPMENT_SERVICES, STATUS_LABELS, type ShipmentStatus } from "@/lib/studio/shipment-types";
import { AVANCE, AVANCES_CONTENEDOR, decidirAvance } from "@/lib/studio/naviera/avance-por-contenedor";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0477_naviera_zarpe_avanza_envios.test.sql");
const M0477 = "0477_naviera_zarpe_avanza_envios.sql";
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const FILE_0477 = read(resolve(ROOT, "supabase/migrations", M0477));
const SLOW = 240_000;

const TRUE = /^(t|true|on|y|yes|1)$/i;
const FALSE = /^(f|false|off|n|no|0)$/i;

/**
 * psql → SQL plano con las metaórdenes del contrato: \set, \if :{?v} / :v,
 * \else, \endif, \ir y \quit. `replace` sustituye el texto de un archivo por el
 * final de su ruta (un mutante de la migración).
 */
function psql(file: string, vars: Record<string, string> = {}, replace: Record<string, string> = {}): string {
  const state = { ...vars };
  const out: string[] = [];
  let quit = false;
  const source = (path: string) => {
    const key = Object.keys(replace).find((name) => path.replace(/\\/g, "/").endsWith(name));
    return key ? replace[key] : readFileSync(path, "utf8");
  };
  function run(path: string) {
    const stack: { active: boolean; taken: boolean }[] = [];
    const active = () => stack.every((frame) => frame.active);
    for (const line of source(path).split(/\r?\n/)) {
      if (quit) return;
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
      } else if (command === "quit") {
        quit = true;
        return;
      } else {
        throw new Error("metaorden psql no soportada: \\" + command);
      }
    }
    if (stack.length > 0 && !quit) throw new Error("\\if sin cerrar en " + path);
  }
  run(file);
  return out.join("\n");
}

async function contract(options: { applyFix?: boolean; migration?: string } = {}) {
  const replace: Record<string, string> = options.migration ? { [M0477]: options.migration } : {};
  const sql = psql(CONTRACT, { apply_fix: String(options.applyFix ?? true) }, replace);
  const db = await pgliteLimpio({ pgcrypto });
  try {
    const results = await db.exec(sql);
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const green = rows.map((row) => String(row.resultado ?? "")).find((t) => t.startsWith("TEST 0477 GREEN"));
    return { error: null as string | null, green };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), green: undefined };
  } finally {
    await db.close();
  }
}

/**
 * 0477 con un único cambio; falla si lo que se cambia no aparece una sola vez.
 * Con split/join y no con replace: en String.replace, `$$` significa un `$` y
 * rompería el dollar quoting de los cuerpos.
 */
function mutant(from: string, to: string): string {
  const parts = FILE_0477.split(from);
  expect(parts, `«${from.slice(0, 60)}…» debe aparecer una sola vez en 0477`).toHaveLength(2);
  return parts.join(to);
}

describe("SDD-0530 · 0477 zarpe y arribo con sus envíos (PGlite)", () => {
  it("el contrato pasa con 0477", async () => {
    const result = await contract();
    expect(result.error).toBeNull();
    // El número exacto: una aserción que deja de correr (un bloque que se
    // saltea) también baja la cuenta.
    expect(result.green).toBe("TEST 0477 GREEN: 60 aserciones");
  }, SLOW);

  it("control rojo: sin 0477 falla en la primera aserción", async () => {
    const result = await contract({ applyFix: false });
    expect(result.error).toBe("TEST 0477: existe public.advance_consolidation_governed(uuid,text)");
  }, SLOW);

  const MUTANTS: { name: string; from: string; to: string; fails: string }[] = [
    {
      name: "sin el trigger que obliga a pasar por la RPC",
      from: "create trigger guard_consolidation_advance_trg\nbefore update of status on public.consolidations\nfor each row execute function public.guard_consolidation_advance();\n",
      to: "",
      fails: "TEST 0477: consolidations tiene el trigger guard_consolidation_advance_trg",
    },
    {
      name: "con el trigger que deja pasar el UPDATE directo",
      from: "     and new.status in ('zarpado', 'arribado')\n",
      to: "     and new.status in ('nunca')\n",
      fails: "TEST 0477: un UPDATE directo a zarpado falla con 42501",
    },
    {
      name: "que avanza un envío eliminado",
      from: "    if v_shipment.deleted_at is not null then\n      v_decision := 'eliminado';\n    else\n      v_decision := public.naviera_avance_decision(",
      to: "    if false then\n      v_decision := 'eliminado';\n    else\n      v_decision := public.naviera_avance_decision(",
      // Lo frena el `deleted_at is null` del UPDATE del envío: la RPC entera
      // aborta con 40001. O sea que sin esta rama UN envío eliminado impediría
      // zarpar todo el contenedor; por eso muere en el resultado del zarpe.
      fails: "TEST 0477: el zarpe devuelve transitioned, el destino shipped, el tenant y la referencia",
    },
    {
      name: "sin la regla de la excepción",
      from: "    when p_status = 'exception' then 'excepcion'\n",
      to: "",
      fails: "TEST 0477: los siete que no avanzan salen con su motivo exacto",
    },
    {
      name: "sin la regla del servicio que no tiene el destino",
      from: "      ('fcl_directo', 'in_customs'), ('fcl_bodega', 'in_customs')\n  )",
      to: "      ('fcl_directo', 'in_customs'), ('fcl_bodega', 'in_customs'),\n      ('transporte_terrestre', 'shipped')\n  )",
      fails: "TEST 0477: avanzan exactamente draft, in_warehouse, consolidating y el FCL directo, ENV-102 una sola vez",
    },
    {
      name: "con el bodegaje antes de la aduana",
      from: "      ('delayed_warehouse', 6),",
      to: "      ('delayed_warehouse', 4),",
      fails: "TEST 0477: avanzan el LCL embarcado, el puerta a puerta en tránsito y el FCL de bodega",
    },
    {
      name: "que no informa los envíos que no avanzan",
      from: "      v_saltados := v_saltados || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(\n",
      to: "      perform pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(\n",
      fails: "TEST 0477: los siete que no avanzan salen con su motivo exacto",
    },
    {
      name: "sin el evento del historial del envío",
      from: "    insert into public.shipment_events (\n      tenant_id, shipment_id, status, note, occurred_at, created_by\n    ) values (\n      v_consolidation.tenant_id, v_shipment.id, v_destino::public.shipment_status,\n      v_nota, v_now, v_actor\n    );\n",
      to: "",
      fails: "TEST 0477: un evento por envío que avanzó, uno solo para ENV-102, ninguno para los demás",
    },
    {
      name: "sin la auditoría de cada envío",
      from: "      'shipment_status_changed',\n",
      to: "      'shipment_status_changed_x',\n",
      fails: "TEST 0477: cuatro eventos AUD-01 shipment_status_changed con actor, antes, después y contenedor",
    },
    {
      name: "que guarda el nombre del cliente en la auditoría",
      from: "        'shipment_code', v_shipment.code,\n        'from', v_shipment.status::text,\n        'to', v_destino\n",
      to: "        'shipment_code', v_shipment.code,\n        'client_name', v_shipment.client_name,\n        'from', v_shipment.status::text,\n        'to', v_destino\n",
      fails: "TEST 0477: la auditoría no guarda nombres ni Shipping Mark de clientes",
    },
    {
      name: "que vuelve a avanzar un contenedor ya zarpado",
      from: "  if v_consolidation.status = v_to then\n",
      to: "  if false then\n",
      fails: "TEST 0477: el segundo zarpe devuelve already, sin avanzados ni saltados",
    },
    {
      name: "que zarpa desde cualquier estado",
      from: "  if v_consolidation.status is distinct from v_from then\n",
      to: "  if false then\n",
      // El `status = v_from` del UPDATE del contenedor también lo frena con
      // 40001, así que el estado no cambia: muere en el mensaje, que es lo que
      // esta rama agrega.
      fails: "TEST 0477: el rechazo dice en qué estado está el contenedor y desde cuál se zarpa",
    },
    {
      name: "sin el permiso de Tracking",
      from: "     or not public.naviera_avance_module_authorized(v_consolidation.tenant_id, 'tracking') then\n",
      to: "     then\n",
      fails: "TEST 0477: operations sin edición de Tracking por desvío no zarpa",
    },
    {
      name: "que deja editar a support con un desvío",
      from: "      when d.role = 'support' then false\n",
      to: "",
      fails: "TEST 0477: support nunca edita, ni con desvío",
    },
    {
      name: "que ignora los desvíos de 0357",
      from: "      else coalesce(d.can_edit, d.role = any(d.default_roles))\n",
      to: "      else d.role = any(d.default_roles)\n",
      fails: "TEST 0477: operations sin edición de Tracking por desvío no zarpa",
    },
    {
      name: "sin la membresía activa en el tenant del contenedor",
      from: "    and exists (\n      select 1\n      from public.user_tenants ut\n      where ut.user_id = v_actor\n        and ut.tenant_id = c.tenant_id\n        and ut.disabled_at is null\n    )\n",
      to: "",
      fails: "TEST 0477: una membresía desactivada no ve el contenedor (P0002)",
    },
  ];
  for (const m of MUTANTS) {
    it(`mutante ${m.name}: muere donde debe`, async () => {
      const result = await contract({ migration: mutant(m.from, m.to) });
      expect(result.error).toBe(m.fails);
    }, SLOW);
  }
});

// ── Propiedades sobre el fixture montado ─────────────────────────

const ALL_STATUSES = Object.keys(STATUS_LABELS) as ShipmentStatus[];

async function openFixture() {
  const db = await pgliteLimpio({ pgcrypto });
  await db.exec(psql(CONTRACT, { fixture_only: "true" }));
  return db;
}

type Override = ModuleAccessOverride | null;
const OVERRIDES: Override[] = [null, { view: false, edit: false }, { view: true, edit: false }, { view: true, edit: true }];

describe("SDD-0530 · propiedades de 0477 (PGlite)", () => {
  let db: PGlite;
  beforeAll(async () => { db = await openFixture(); }, SLOW);
  afterAll(async () => { await db?.close(); });

  it("los enums del fixture son los de shipment-public.ts", async () => {
    const labels = async (type: string) =>
      (await db.query<{ l: string }>(
        `select e.enumlabel::text as l from pg_catalog.pg_enum e where e.enumtypid = '${type}'::regtype order by 1`,
      )).rows.map((r) => r.l);
    expect(await labels("public.shipment_service")).toEqual([...SHIPMENT_SERVICES].sort());
    expect(await labels("public.shipment_status")).toEqual([...ALL_STATUSES].sort());
  }, SLOW);

  it("la regla de la base y decidirAvance dicen lo mismo para cada servicio × estado × destino", async () => {
    const mismatches: string[] = [];
    const services = [...SHIPMENT_SERVICES, "servicio_inexistente"];
    const statuses = [...ALL_STATUSES, "estado_inexistente"];
    let casos = 0;
    for (const to of AVANCES_CONTENEDOR) {
      const destino = AVANCE[to].destino;
      for (const service of services) {
        for (const status of statuses) {
          const base = (await db.query<{ d: string }>(
            "select public.naviera_avance_decision($1, $2, $3) as d", [service, status, destino],
          )).rows[0].d;
          const app = decidirAvance(service, status, destino);
          casos++;
          if (base !== app) mismatches.push(`${service}/${status}→${destino}: base=${base} app=${app}`);
        }
      }
    }
    expect(mismatches).toEqual([]);
    expect(casos).toBe(2 * 6 * 14);
  }, SLOW);

  it("la regla deja avanzar justo lo que la máquina de estados permite", () => {
    // Ancla de la propiedad: si decidirAvance dijera siempre «avanza» o nunca,
    // la comparación de arriba seguiría verde con una base igual de rota.
    expect(decidirAvance("consolidado_lcl", "in_warehouse", "shipped")).toBe("avanza");
    expect(decidirAvance("consolidado_lcl", "draft", "shipped")).toBe("avanza");
    expect(decidirAvance("fcl_bodega", "consolidating", "shipped")).toBe("avanza");
    expect(decidirAvance("puerta_a_puerta_DDP", "in_transit", "in_customs")).toBe("avanza");
    expect(decidirAvance("transporte_terrestre", "in_warehouse", "shipped")).toBe("servicio_sin_estado");
    expect(decidirAvance("consolidado_lcl", "shipped", "shipped")).toBe("ya_en_estado");
    expect(decidirAvance("consolidado_lcl", "in_transit", "shipped")).toBe("mas_avanzado");
    expect(decidirAvance("consolidado_lcl", "delayed_warehouse", "in_customs")).toBe("mas_avanzado");
    expect(decidirAvance("consolidado_lcl", "delivered", "shipped")).toBe("entregado");
    expect(decidirAvance("consolidado_lcl", "cancelled", "in_customs")).toBe("cancelado");
    expect(decidirAvance("consolidado_lcl", "exception", "shipped")).toBe("excepcion");
  });

  it("naviera y tracking no tienen alcance de almacén ni candado de superadmin: canEditModule es toda la regla", () => {
    for (const m of ["naviera", "tracking"]) {
      expect(WAREHOUSE_SCOPED_MODULES[m]).toBeUndefined();
      expect(SUPERADMIN_ONLY_MODULES.has(m)).toBe(false);
      expect(LOCKED_MODULES.has(m)).toBe(false);
    }
  });

  it("la matriz de la base y canEditModule dicen lo mismo para cada rol y cada desvío", async () => {
    const tenant = (await db.query<{ id: string }>("select pg_temp.fixture_id('tenant-A')::text as id")).rows[0].id;
    const mismatches: string[] = [];
    let casos = 0;
    for (const role of STUDIO_USER_ROLES as StudioUserRole[]) {
      const user = `${role}-A`;
      const overrides = role === "admin" ? [null] : OVERRIDES;
      for (const naviera of overrides) {
        for (const tracking of overrides) {
          await db.exec("savepoint caso");
          try {
            await db.query("select pg_temp.set_override($1, 'naviera', $2::boolean, $3::boolean)",
              [role, naviera?.view ?? null, naviera?.edit ?? null]);
            await db.query("select pg_temp.set_override($1, 'tracking', $2::boolean, $3::boolean)",
              [role, tracking?.view ?? null, tracking?.edit ?? null]);
            await db.query("select set_config('request.jwt.claim.sub', pg_temp.fixture_id($1)::text, true)", [user]);
            const base = async (module: string) =>
              (await db.query<{ ok: boolean }>(
                "select public.naviera_avance_module_authorized($1::uuid, $2) as ok", [tenant, module],
              )).rows[0].ok;
            const map: Record<string, ModuleAccessOverride> = {};
            if (naviera) map[`${role}:naviera`] = naviera;
            if (tracking) map[`${role}:tracking`] = tracking;
            const app = {
              naviera: canEditModule(role, "naviera", map),
              tracking: canEditModule(role, "tracking", map),
            };
            const got = { naviera: await base("naviera"), tracking: await base("tracking") };
            casos++;
            if (got.naviera !== app.naviera || got.tracking !== app.tracking) {
              mismatches.push(`${role} nav=${JSON.stringify(naviera)} trk=${JSON.stringify(tracking)} base=${JSON.stringify(got)} app=${JSON.stringify(app)}`);
            }
          } finally {
            await db.exec("rollback to savepoint caso");
          }
        }
      }
    }
    expect(mismatches).toEqual([]);
    expect(casos).toBe(1 + 6 * 16);
  }, SLOW);

  it("los casos de la matriz cubren las dos direcciones del desvío", () => {
    // Un desvío que abre lo que el default cierra (commercial en Naviera) y uno
    // que cierra lo que abre (operations en Tracking): sin los dos, la
    // propiedad pasaría con una base que ignora 0357 en una de las direcciones.
    expect(ROLE_MODULE_ACCESS.naviera).not.toContain("commercial");
    expect(canEditModule("commercial", "naviera", { "commercial:naviera": { view: true, edit: true } })).toBe(true);
    expect(ROLE_MODULE_ACCESS.tracking).toContain("operations");
    expect(canEditModule("operations", "tracking", { "operations:tracking": { view: true, edit: false } })).toBe(false);
  });

  it("una membresía desactivada o de otro tenant no edita", async () => {
    const tenantA = (await db.query<{ id: string }>("select pg_temp.fixture_id('tenant-A')::text as id")).rows[0].id;
    for (const user of ["operations-off-A", "operations-B"]) {
      await db.query("select set_config('request.jwt.claim.sub', pg_temp.fixture_id($1)::text, true)", [user]);
      const ok = (await db.query<{ ok: boolean }>(
        "select public.naviera_avance_module_authorized($1::uuid, 'naviera') as ok", [tenantA],
      )).rows[0].ok;
      expect(ok, user).toBe(false);
    }
  }, SLOW);
});

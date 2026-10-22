// @vitest-environment node
/**
 * SDD-0562 · Paridad: «Por contabilizar» y la radiografía marcan «no comparable» en 1.1.2 los
 * MISMOS tenants, sobre el mismo fixture (criterio 4 de la spec 0562: «una sola cifra»).
 *
 *  - La radiografía (SDD-0559, `scripts/qa/radiografia-integridad.sql`) corre tal cual en PGlite
 *    sobre `scripts/qa/radiografia-integridad.fixture.sql`, como en
 *    `radiografia-integridad.test.ts`. Su fila 91 cuenta los tenants no comparables en 1.1.2.
 *  - «Por contabilizar» (SDD-0557) corre con sus lectores reales (`listAccounts`,
 *    `accountBalances` y `cuadreDelLibro`, como `app/studio/(app)/contabilidad/page.tsx`) sobre
 *    el doble de PostgREST (`dobleListados`), sembrado tenant por tenant con las filas de ESE
 *    tenant leídas de la misma PGlite: lo que la RLS le dejaría ver a una sesión del tenant.
 *  - Control: con la regla vieja del K10 (cualquier recibo vivo VES/CNY con asiento `receipt`
 *    vivo), el conteo difiere de la fila 91. Si diera igual, la paridad no probaría nada.
 *
 * SDD-0563 suma tres cosas:
 *  - El estado COMPLETO de 1.1.2, tenant por tenant, con la equivalencia de su spec (`EQUIVALENTE`).
 *    Control: con la regla anterior de la radiografía (sin la enmienda de la decisión 7), A y H
 *    dejan de coincidir.
 *  - Los dos casos teóricos de la SDD-0562, cada uno como escenario sobre la fixture dentro de una
 *    transacción que se deshace (`escenario`): sin cuenta 1.1.2 y una subcuenta sin su cuenta
 *    intermedia. La prueba deja escrito lo que hace cada definición.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { accountBalances, listAccounts } from "@/lib/studio/account-queries";
import type { EstadoCuadre } from "@/lib/studio/accounting/libro-control";
import { cuadreDelLibro } from "@/lib/studio/accounting/libro-control-queries";
import { dobleListados, type Fila } from "@/lib/studio/__tests__/listados-double";

/**
 * La regla del K10 que usa `cuadreDelLibro`, conmutable. Con `vieja`, el predicado que la SDD-0562
 * reemplazó (libro-control-queries.ts en 69b97f14: `d.vivo && (VES || CNY) && vivos > 0`): sin
 * mirar factura, identificación ni reclasificación. Si no, la función real, la que se prueba.
 */
const regla = vi.hoisted(() => ({ vieja: false }));
vi.mock("@/lib/studio/accounting/libro-control", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/studio/accounting/libro-control")>();
  return {
    ...real,
    reciboVuelveNoComparable: (r: Parameters<typeof real.reciboVuelveNoComparable>[0]) =>
      regla.vieja
        ? r.vivo && (r.moneda === "VES" || r.moneda === "CNY") && r.asientosCobro > 0
        : real.reciboVuelveNoComparable(r),
  };
});

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const QA = resolve(ROOT, "scripts/qa");
const leer = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const SCRIPT = leer(resolve(QA, "radiografia-integridad.sql"));
const FIXTURE = leer(resolve(QA, "radiografia-integridad.fixture.sql"));
const SLOW = 240_000;
/** Las fechas de la fixture llegan hasta el 2026-10-19 (F23, F25): «hoy» de «Por contabilizar». */
const HOY = "2026-10-19";

const TRUE = /^(t|true|on|y|yes|1)$/i;
const FALSE = /^(f|false|off|n|no|0)$/i;

/**
 * psql → SQL plano con las metaórdenes que usan el script y la fixture: \set, \if :{?v} / :v,
 * \else, \endif e \ir (relativo a `dir`). Cualquier otra metaorden lanza.
 * Copia de scripts/__tests__/radiografia-integridad.test.ts.
 */
function inline(text: string, dir: string, vars: Record<string, string> = {}): string {
  const state: Record<string, string> = { ...vars };
  const out: string[] = [];
  function run(source: string, base: string) {
    const stack: { active: boolean; taken: boolean }[] = [];
    const active = () => stack.every((frame) => frame.active);
    for (const line of source.split(/\r?\n/)) {
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
          const value = defined ? String(defined[1] in state)
            : rest.trim().startsWith(":") ? String(state[rest.trim().slice(1)]) : rest.trim();
          if (!TRUE.test(value) && !FALSE.test(value)) throw new Error("\\if no booleano: " + rest);
          taken = TRUE.test(value);
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
        const path = resolve(base, rest.trim());
        run(leer(path), dirname(path));
      } else {
        throw new Error("metaorden psql no soportada: \\" + command);
      }
    }
    if (stack.length > 0) throw new Error("\\if sin cerrar");
  }
  run(text, dir);
  return out.join("\n");
}

type FilaRadiografia = { orden: number; seccion: string; indicador: string; n: number | string; monto_usd: unknown };

/** Sección 8 de la radiografía: el estado de 1.1.2 de cada tenant con movimiento, uno por fila. */
const ESTADOS_1_1_2: Record<number, string> = {
  90: "sin movimiento en el mayor",
  91: "no comparable",
  92: "sin movimiento en la cuenta",
  93: "cuadra",
  94: "mayor por encima",
  95: "mayor por debajo",
};
const FILAS_1_1_2 = Object.keys(ESTADOS_1_1_2).map(Number);
/** El tenant que no aparece en la sección 8: sin documentos ni asientos. */
const SIN_MOVIMIENTO = "fuera de la radiografía (sin movimiento)";

/**
 * SDD-0563 · El estado de «Por contabilizar» que corresponde a cada estado de la radiografía. La
 * radiografía no tiene «cuenta no encontrada» (`sin_cuenta`) y separa «no cuadra» en encima y
 * debajo.
 */
const EQUIVALENTE: Record<string, EstadoCuadre> = {
  "sin movimiento en el mayor": "mayor_sin_movimiento",
  "no comparable": "no_comparable",
  "sin movimiento en la cuenta": "sin_movimiento",
  [SIN_MOVIMIENTO]: "sin_movimiento",
  cuadra: "cuadra",
  "mayor por encima": "no_cuadra",
  "mayor por debajo": "no_cuadra",
};

/**
 * La regla de 1.1.2 antes de la SDD-0563: la factura abierta fuera de USD/USDT no la volvía no
 * comparable. Sin lanzar al cargar: si la enmienda faltara, el control (e) lo dice con su
 * aserción, y (b) y (d) con la diferencia que de verdad aparece.
 */
const ENMIENDA = " or (cuenta = '1.1.2' and fuera) then";
const SCRIPT_ANTERIOR = SCRIPT.split(ENMIENDA).join(" then");

/** Lo que lee «Por contabilizar», tabla por tabla, filtrado por tenant (lo que dejaría la RLS). */
const TABLAS_DEL_TENANT = [
  "accounts",
  "invoices",
  "payment_receipts",
  "supplier_bills",
  "supplier_payments",
  "journal_entries",
] as const;

type Tenant = { id: string; letra: string };

describe("SDD-0562 · «Por contabilizar» y la radiografía cuentan igual los no comparables de 1.1.2", () => {
  let db: PGlite;
  let tenants: Tenant[] = [];
  /** Las tablas de public con `tenant_id`: las que se vacían de los otros tenants. */
  let tablasConTenant: string[] = [];
  let completa: FilaRadiografia[] = [];
  const porFila = (filas: FilaRadiografia[], orden: number) =>
    filas.filter((f) => Number(f.orden) === orden).reduce((s, f) => s + Number(f.n), 0);

  const correr = async (sql: string) =>
    (await db.exec(inline(sql, QA))).flatMap((r) => r.rows as FilaRadiografia[]);

  /**
   * La radiografía sobre UN tenant. Se eligió esto y no una consulta auxiliar que copie el criterio
   * de la fila 91: así cuenta el script real, byte por byte salvo su primera sentencia, y no una
   * segunda definición que podría divergir en silencio. Se cambia `begin transaction read only;`
   * por una transacción de escritura que borra los otros tenants de toda tabla de public con
   * `tenant_id` (la lista sale del catálogo: una tabla nueva entra sola), con
   * `session_replication_role = replica` para que ni las FK ni los disparadores de inmutabilidad
   * de los asientos frenen el borrado. Las líneas de asiento no tienen `tenant_id`: quedan
   * huérfanas y la radiografía no las ve, porque las une por el asiento vivo. El `rollback;` final
   * del propio script deshace el borrado; si algo falla antes, se deshace acá. La última prueba
   * comprueba que la base quedó intacta.
   *
   * `script` permite correr la regla anterior (control) y `escenario`, SQL que cambia la fixture
   * antes de medir (los casos teóricos): los dos se deshacen con el mismo `rollback;`.
   */
  async function radiografiaDe(tenant: Tenant, script = SCRIPT, escenario = ""): Promise<FilaRadiografia[]> {
    expect(tenant.id).toMatch(/^[0-9a-f-]{36}$/);
    const inicio = "begin transaction read only;\n";
    const partes = script.split(inicio);
    expect(partes, "la primera sentencia de la radiografía").toHaveLength(2);
    const borrar = tablasConTenant
      .map((t) => `delete from public.${t} where tenant_id is distinct from '${tenant.id}';`)
      .join("\n");
    const aislada = partes.join(`begin;\nset local session_replication_role = replica;\n${borrar}\n${escenario}\n`);
    try {
      return await correr(aislada);
    } catch (e) {
      await db.exec("rollback;");
      throw e;
    }
  }

  /** Las filas del tenant como las sirve PostgREST: `to_jsonb` da números, fechas ISO y uuid en texto. */
  async function tablasDe(tenant: Tenant): Promise<Record<string, Fila[]>> {
    const leerJson = async (sql: string) =>
      (await db.query<{ fila: Fila }>(sql, [tenant.id])).rows.map((r) => r.fila);
    const tablas: Record<string, Fila[]> = {};
    for (const t of TABLAS_DEL_TENANT) {
      tablas[t] = await leerJson(`select to_jsonb(x) as fila from public.${t} x where x.tenant_id = $1 order by x.id`);
    }
    tablas.journal_lines = await leerJson(
      `select to_jsonb(l) as fila from public.journal_lines l
         join public.journal_entries e on e.id = l.entry_id
        where e.tenant_id = $1 order by l.id`,
    );
    return tablas;
  }

  /** El estado de clientes (1.1.2) de «Por contabilizar», como lo calcula la página. */
  async function porContabilizar(tablas: Record<string, Fila[]>): Promise<EstadoCuadre> {
    return (await cuadreDe(tablas)).subdiario.clientes.estado;
  }

  async function cuadreDe(tablas: Record<string, Fila[]>) {
    // `proyectar`: el doble devuelve solo las columnas del `select`, como PostgREST. Si el lector
    // dejara de pedir `invoice_id` o `identified_at`, el recibo llegaría sin ellos.
    const { client } = dobleListados(tablas, { proyectar: true });
    const [accounts, saldos] = await Promise.all([listAccounts(client), accountBalances(client)]);
    return cuadreDelLibro(client, { accounts, saldos, hoy: HOY });
  }

  /**
   * Un caso teórico: el mismo SQL sobre la fixture, medido por las dos definiciones. La radiografía
   * lo corre dentro de su transacción aislada; «Por contabilizar» lee las filas del tenant dentro de
   * otra transacción, que se deshace al terminar.
   */
  async function escenario(tenant: Tenant, sql: string) {
    const filas = await radiografiaDe(tenant, SCRIPT, sql);
    const estados = FILAS_1_1_2.filter((o) => porFila(filas, o) > 0);
    expect(estados.length, `escenario en ${tenant.letra}: un estado de 1.1.2`).toBe(1);
    await db.exec("begin;\n" + sql);
    try {
      const cuadre = await cuadreDe(await tablasDe(tenant));
      return { radiografia: ESTADOS_1_1_2[estados[0]], cuadre };
    } finally {
      await db.exec("rollback;");
    }
  }

  /** El estado de 1.1.2 de UN tenant en la radiografía: a lo sumo una fila de la sección 8. */
  function estadoEnRadiografia(t: Tenant, filas: FilaRadiografia[]): string {
    const estados = FILAS_1_1_2.filter((o) => porFila(filas, o) > 0);
    expect(estados.length, `tenant ${t.letra}: a lo sumo un estado de 1.1.2`).toBeLessThanOrEqual(1);
    expect(estados.every((o) => porFila(filas, o) === 1), `tenant ${t.letra}: un solo tenant`).toBe(true);
    return estados.length ? ESTADOS_1_1_2[estados[0]] : SIN_MOVIMIENTO;
  }

  let porTenant: {
    letra: string;
    radiografia: string;
    /** La radiografía con la regla de 1.1.2 anterior a la SDD-0563 (control). */
    radiografiaAnterior: string;
    studio: EstadoCuadre;
    studioReglaVieja: EstadoCuadre;
  }[] = [];

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(inline(FIXTURE, QA));
    tenants = (
      await db.query<{ id: string; slug: string }>("select id::text as id, slug from public.tenants")
    ).rows
      // A es el tenant 'dtd' (lo siembran las migraciones reales); los demás, 'centinela-<letra>'.
      .map((t) => ({ id: t.id, letra: t.slug === "dtd" ? "A" : t.slug.replace("centinela-", "").toUpperCase() }))
      .sort((a, b) => a.letra.localeCompare(b.letra));
    tablasConTenant = (
      await db.query<{ tabla: string }>(
        `select c.table_name as tabla
           from information_schema.columns c
           join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
          where c.table_schema = 'public' and c.column_name = 'tenant_id' and t.table_type = 'BASE TABLE'
          order by 1`,
      )
    ).rows.map((r) => r.tabla);
    completa = await correr(SCRIPT);

    porTenant = [];
    for (const t of tenants) {
      const radiografia = estadoEnRadiografia(t, await radiografiaDe(t));
      const radiografiaAnterior = estadoEnRadiografia(t, await radiografiaDe(t, SCRIPT_ANTERIOR));
      const tablas = await tablasDe(t);
      regla.vieja = false;
      const studio = await porContabilizar(tablas);
      regla.vieja = true;
      const studioReglaVieja = await porContabilizar(tablas);
      regla.vieja = false;
      porTenant.push({ letra: t.letra, radiografia, radiografiaAnterior, studio, studioReglaVieja });
    }
  }, SLOW);

  afterAll(async () => {
    regla.vieja = false;
    await db?.close();
  });

  const letras = (pred: (t: (typeof porTenant)[number]) => boolean) => porTenant.filter(pred).map((t) => t.letra).sort();

  it("la fixture tiene sus dieciocho tenants y la radiografía aislada suma lo mismo que la completa", () => {
    expect(tenants.map((t) => t.letra)).toEqual(
      ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "P", "S", "T", "U"],
    );
    // El aislamiento vacía, por lo menos, todo lo que lee «Por contabilizar» (más referidos y
    // reportes de pago, que la radiografía también lee).
    expect(tablasConTenant).toEqual(expect.arrayContaining([...TABLAS_DEL_TENANT, "referrals", "payment_reports"]));
    // Aislar por tenant no cambia lo que se cuenta: cada estado de 1.1.2, sumado tenant por
    // tenant, da la fila de la corrida completa.
    for (const orden of FILAS_1_1_2) {
      const suma = porTenant.filter((t) => t.radiografia === ESTADOS_1_1_2[orden]).length;
      expect(suma, `fila ${orden}`).toBe(porFila(completa, orden));
    }
  });

  it("(a) el número de tenants «no comparable» en clientes es la fila 91", () => {
    const fila91 = porFila(completa, 91);
    expect(fila91).toBe(7);
    expect(letras((t) => t.studio === "no_comparable"), JSON.stringify(porTenant)).toHaveLength(fila91);
  });

  it("(b) tenant por tenant, «Por contabilizar» marca «no comparable» exactamente los de la fila 91", () => {
    const radiografia = letras((t) => t.radiografia === "no comparable");
    // E (FE1), G (FG1), J (FJ2 anulada), N (RN1 con factura) y T (RT1 reclasificado), y desde la
    // SDD-0563 A (F19 F20) y H (FH2), abiertas en VES/CNY sin asiento: el comentario de la fila 91
    // en radiografia-integridad.test.ts. P no: FP3 es un borrador.
    expect(radiografia).toEqual(["A", "E", "G", "H", "J", "N", "T"]);
    expect(letras((t) => t.studio === "no_comparable"), JSON.stringify(porTenant)).toEqual(radiografia);
  });

  it("(c) control: con la regla vieja del K10 el conteo difiere de la fila 91", () => {
    const vieja = letras((t) => t.studioReglaVieja === "no_comparable");
    expect(vieja.length).not.toBe(porFila(completa, 91));
    // K es el que lo distingue: RK1 (sin referencia) y RK2 (identificado sin reclasificar), VES con
    // asiento de cobro vivo a 2.1.8, no tocan 1.1.2; la regla vieja los cuenta. T NO distingue la
    // regla vieja de la nueva (las dos cuentan RT1); protege del otro lado: una regla que dejara
    // afuera a todo recibo identificado lo perdería. I también tiene un recibo así (RI1), pero su
    // 1.1.2 no tiene movimiento y «sin movimiento en el mayor» gana con las dos reglas.
    expect(vieja).toEqual(["A", "E", "G", "H", "J", "K", "N", "T"]);
    expect(porTenant.find((t) => t.letra === "I")?.studioReglaVieja).toBe("mayor_sin_movimiento");
  });

  it("(d) SDD-0563: el estado completo de 1.1.2 es el mismo en los dos lugares, tenant por tenant", () => {
    const distintos = porTenant.filter((t) => EQUIVALENTE[t.radiografia] !== t.studio);
    expect(distintos, JSON.stringify(porTenant)).toEqual([]);
    // La fixture recorre todos los estados que tienen par, para que la equivalencia no quede sin probar.
    expect(new Set(porTenant.map((t) => t.radiografia))).toEqual(new Set(Object.keys(EQUIVALENTE)));
  });

  it("(e) control: con la regla anterior de la radiografía, A y H dejan de coincidir", () => {
    // Sin la enmienda, H (FH2 abierta en VES, sin asiento) cuadra y A (F19 F20) queda por debajo;
    // «Por contabilizar» los marca no comparables. El resto no se mueve.
    expect(SCRIPT.split(ENMIENDA), "la enmienda de la decisión 7 en la radiografía").toHaveLength(2);
    const distintos = letras((t) => EQUIVALENTE[t.radiografiaAnterior] !== t.studio);
    expect(distintos).toEqual(["A", "H"]);
    expect(porTenant.find((t) => t.letra === "H")?.radiografiaAnterior).toBe("cuadra");
    expect(porTenant.find((t) => t.letra === "A")?.radiografiaAnterior).toBe("mayor por debajo");
  });

  it("(f) SDD-0563: la misma factura cuenta en «sin asiento» y vuelve no comparable la 1.1.2", async () => {
    // Decisión del Director: «sin asiento» habla del documento y «no comparable», de la cuenta.
    const h = tenants.find((t) => t.letra === "H")!;
    const cuadre = await cuadreDe(await tablasDe(h));
    expect(cuadre.subdiario.clientes).toMatchObject({ estado: "no_comparable", sinConvertir: 1, diferenciaUsd: null });
    // FH2, la que no suma, es la única factura de H en la lista de «sin asiento».
    const facturasSinAsiento = cuadre.documentos.sinAsiento.filter((d) => d.tipo === "factura");
    expect(facturasSinAsiento.map((d) => [d.codigo, d.moneda, d.motivo])).toEqual([["CENTINELA-F-FH2", "VES", "sin_asiento"]]);
  });

  it("(g) caso teórico: sin cuenta 1.1.2, «cuenta no encontrada» gana sobre «no comparable»; la radiografía no tiene ese estado", async () => {
    // H, con FH2 abierta en VES, sería no comparable. Con su 1.1.2 renombrada, «Por contabilizar»
    // no encuentra la cuenta. La radiografía ve la 1.1.2 sin movimiento y facturas abiertas: gana el
    // mayor vacío (decisión 6). Ninguna de las dos cuenta a H en la fila 91. La pantalla no cambia
    // el código de una cuenta (`updateAccount`): el escenario lo hace con un `update` directo, que
    // la base acepta porque `accounts` tiene grant de update para `authenticated`. Tampoco hay una
    // pantalla que la elimine: ninguna llama hoy a `deleteAccount` (SDD-0565), así que un borrado
    // solo llega con un `delete` directo.
    const h = tenants.find((t) => t.letra === "H")!;
    const r = await escenario(h, `update public.accounts set code = '9.1.2' where tenant_id = '${h.id}' and code = '1.1.2';`);
    expect(r.cuadre.subdiario.clientes).toMatchObject({ estado: "sin_cuenta", mayorUsd: null, diferenciaUsd: null });
    expect(r.radiografia).toBe("sin movimiento en el mayor");
  });

  it("(h) caso teórico: una subcuenta sin su cuenta intermedia entra en la radiografía y no en «Por contabilizar» (divergencia fijada)", async () => {
    // B cuadra. Un asiento manual vivo a 1.1.2.9.1, sin la 1.1.2.9 en el plan: la radiografía lo
    // suma a 1.1.2 (`like '1.1.2.%'`) y queda por encima; `computeBalances` sube una cuenta solo a
    // su padre directo y, si no está, no la sube: B sigue cuadrando. NO se corrige en la SDD-0563:
    // queda para el Director. Si alguien la alinea, esta prueba lo dice.
    const b = tenants.find((t) => t.letra === "B")!;
    const r = await escenario(
      b,
      `insert into public.accounts (tenant_id, code, name, type, is_postable)
         values ('${b.id}', '1.1.2.9.1', 'CENTINELA-SUBCUENTA', 'A', true);
       select pg_temp.asiento('B', 'MB9', 'asentado', 'manual', '1.1.2.9.1', '4.5', 50.00);`,
    );
    expect(r.radiografia).toBe("mayor por encima");
    expect(r.cuadre.subdiario.clientes).toMatchObject({ estado: "cuadra", diferenciaUsd: 0 });
  });

  it("la base quedó intacta: la radiografía completa da lo mismo que antes de aislar", async () => {
    expect(await correr(SCRIPT)).toEqual(completa);
  });
});


/**
 * M7 no redefine T03 como auditor financiero.
 * T03 adoptado: dd51cda9eab2efd87f641bc8a0d9bd5878274dad, Pblob61c9be7781aefeebeb186fe81933a81cfef23463;
 * Qblob02d2cc028acc1605c266939f1bfccd53f0f34b3c. Sólo se prueba el contrato de cabeceras vigente.
 * La paridad heredada anterior permanece literal, incluidos18tenants/91=7/K10/FH2/H/B/restauración.
 */
describe("SDD-0573 M7 · paridad de cabeceras separada del perfil financiero", () => {
  const correrM7 = async (db: PGlite) =>
    (await db.exec(inline(SCRIPT, QA))).flatMap((r) => r.rows as FilaRadiografia[]);
  const nM7 = (filas: FilaRadiografia[], orden: number) =>
    filas.filter((r) => Number(r.orden) === orden).reduce((s, r) => s + Number(r.n), 0);

  /** Filas reales del tenant, con el mismo proyector estricto de los lectores heredados. */
  async function studioM7(db: PGlite, tenantId: string) {
    const tablas: Record<string, Fila[]> = {};
    for (const tabla of TABLAS_DEL_TENANT) {
      tablas[tabla] = (await db.query<{ fila: Fila }>(
        `select to_jsonb(x) as fila from public.${tabla} x where x.tenant_id = $1 order by x.id`,
        [tenantId],
      )).rows.map((r) => r.fila);
    }
    tablas.journal_lines = (await db.query<{ fila: Fila }>(
      `select to_jsonb(l) as fila from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
        where e.tenant_id = $1 order by l.id`, [tenantId],
    )).rows.map((r) => r.fila);
    const { client } = dobleListados(tablas, { proyectar: true });
    const [accounts, saldos] = await Promise.all([listAccounts(client), accountBalances(client)]);
    return cuadreDelLibro(client, { accounts, saldos, hoy: HOY });
  }

  /** Sin aislamiento que borre otros tenants: el QA ve ambos extremos de cruces inválidos. */
  async function casoM7(sql: string, comprobar: (
    db: PGlite, base: FilaRadiografia[], actual: FilaRadiografia[],
    studio: Awaited<ReturnType<typeof studioM7>>,
  ) => Promise<void>) {
    const db = new PGlite();
    try {
      await db.exec(inline(FIXTURE, QA));
      const tenant = (await db.query<{ id: string }>("select pg_temp.t('U')::text as id")).rows[0].id;
      const crudo = (await db.query<{ n: number; posted: boolean }>(
        `select count(*)::int as n, bool_and(posted_at is not null and isfinite(posted_at)) as posted
         from public.journal_entries where id in (pg_temp.id('AFU1'), pg_temp.id('RFU1'))`,
      )).rows[0];
      expect(crudo).toEqual({ n: 2, posted: true });
      const base = await correrM7(db);
      await db.exec(sql);
      const actual = await correrM7(db);
      await comprobar(db, base, actual, await studioM7(db, tenant));
    } finally {
      await db.close();
    }
  }

  it("espejo incompleto: T03 conserva su juicio de cabeceras y M7 exige revisión", async () => {
    await casoM7(
      `update public.journal_lines set debit = 149.15
        where entry_id = pg_temp.id('RFU1') and account_id = pg_temp.cta('U', '4.5');`,
      async (_db, base, actual, studio) => {
        expect(nM7(actual, 40)).toBe(nM7(base, 40) + 1);
        expect(nM7(actual, 48)).toBe(nM7(base, 48) + 1);
        expect(studio.documentos.anuladosConAsiento).toEqual([]);
        expect(studio.subdiario.clientes.estado).toBe("cuadra");
      },
    );
  }, SLOW);

  it("histórico90/documento100 conserva nominal y añade revisión documental sólo en M7", async () => {
    await casoM7(
      `update public.invoices set base_amount = 100, iva_amount = 0, total_amount = 100 where id = pg_temp.id('FU1');
       update public.journal_lines set debit = case when debit > 0 then 90 else 0 end,
         credit = case when credit > 0 then 90 else 0 end
         where entry_id in (pg_temp.id('AFU1'), pg_temp.id('RFU1'));`,
      async (db, base, actual, studio) => {
        const crudo = (await db.query<{ documento: string; original: string }>(
          `select total_amount::text as documento,
            (select sum(debit)::text from public.journal_lines where entry_id = pg_temp.id('AFU1')) as original
           from public.invoices where id = pg_temp.id('FU1')`,
        )).rows[0];
        expect(crudo).toEqual({ documento: "100.00", original: "90.00" });
        expect(nM7(actual, 40)).toBe(nM7(base, 40));
        expect(nM7(actual, 48)).toBe(nM7(base, 48) + 1);
        expect(studio.documentos.anuladosConAsiento).toEqual([]);
        expect(studio.subdiario.clientes.estado).toBe("cuadra");
      },
    );
  }, SLOW);

  it.each(["VES", "CNY"])("nominal %s: M7 conserva no_comparable bruto y T03 sólo neutraliza cabeceras", async (moneda) => {
    await casoM7(
      `update public.invoices set currency = '${moneda}'::invoice_currency, fx_rate = null where id = pg_temp.id('FU1');`,
      async (_db, base, actual, studio) => {
        expect(nM7(actual, 40)).toBe(nM7(base, 40));
        expect(nM7(actual, 48)).toBe(nM7(base, 48));
        expect(nM7(actual, 23)).toBe(nM7(base, 23) + 1);
        expect(nM7(actual, 91)).toBe(nM7(base, 91) + 1);
        expect(studio.documentos.anuladosConAsiento).toEqual([]);
        expect(studio.subdiario.clientes).toMatchObject({ estado: "cuadra", diferenciaUsd: 0, sinConvertir: 0 });
      },
    );
  }, SLOW);

  it.each([
    ["tenant", "tenant_id = pg_temp.t('E')"],
    ["factura", "invoice_id = pg_temp.id('F5')"],
  ])("cruce de %s conserva ambos extremos en QA y no inventa visibilidad RLS", async (_campo, asignacion) => {
    await casoM7(
      `update public.journal_entries set ${asignacion} where id = pg_temp.id('RFU1');`,
      async (db, base, actual, studio) => {
        const extremos = (await db.query<{ id: string; tenant_id: string; invoice_id: string; reverses_entry_id: string | null }>(
          `select id::text, tenant_id::text, invoice_id::text, reverses_entry_id::text from public.journal_entries
           where id in (pg_temp.id('AFU1'), pg_temp.id('RFU1')) order by source`,
        )).rows;
        expect(extremos).toHaveLength(2);
        expect(extremos[1].reverses_entry_id).toBe(extremos[0].id);
        expect(extremos[1].tenant_id !== extremos[0].tenant_id || extremos[1].invoice_id !== extremos[0].invoice_id).toBe(true);
        expect(nM7(actual, 40)).toBe(nM7(base, 40) + 1);
        expect(nM7(actual, 48)).toBe(nM7(base, 48) + 1);
        expect(studio.documentos.anuladosConAsiento.map((d) => [d.codigo, d.motivo]))
          .toEqual([["CENTINELA-F-FU1", "anulado_con_asiento_vivo"]]);
      },
    );
  }, SLOW);
});

// @vitest-environment node
/**
 * SDD-0462 · Las facturas del Portal quedan ligadas al tenant del principal.
 *
 * El transporte en memoria aplica los filtros de verdad y, para `invoices`, la
 * policy Portal de main (0085): ve la fila viva y no borrador cuyo Shipping Mark
 * coincide con `get_portal_client_markbox()`, sin mirar el tenant. El Shipping
 * Mark es único POR TENANT, así que el mismo valor en otro tenant reproduce el
 * cruce: el cliente de T1 veía la lista, el detalle, los KPIs, el estado de
 * cuenta y el PDF de facturas de T2. El cliente admin (service_role) no tiene
 * RLS: sólo lo acotan los filtros del código.
 *
 * SDD-0556: la lista se lee paginada (`fetchAllPaged` → `.range(from, to)`) y
 * el transporte corta por offset, como PostgREST. `rangeRoto` simula un orden
 * que no avanza (siempre las mismas filas) y `invoicesError` una base que no
 * responde: en los dos casos el lector tiene que decir «no sé», no devolver una
 * lista vacía con saldo 0.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;
type Op = {
  client: "sesion" | "admin";
  target: string;
  filters: Array<[string, string, unknown]>;
};

const USER = "11111111-1111-4111-8111-111111111111";
const T1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const T2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C1 = "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1";
const C2 = "c2c2c2c2-c2c2-4c2c-8c2c-c2c2c2c2c2c2";
const MARK = "DTD-SINTETICO";

const state = vi.hoisted(() => ({
  session: undefined as unknown,
  admin: undefined as unknown,
  adminBuilds: 0,
  rendered: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/db/server", () => ({ createClient: async () => state.session }));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => {
    state.adminBuilds += 1;
    return state.admin;
  },
}));
vi.mock("@react-pdf/renderer", () => ({
  renderToBuffer: async (doc: { props: Record<string, unknown> }) => {
    state.rendered.push(doc.props);
    return Buffer.from("%PDF-sintetico");
  },
}));
vi.mock("@/lib/studio/pdf/factura-pdf", () => ({ FacturaDocument: () => null }));
vi.mock("@/lib/studio/pdf/estado-de-cuenta-pdf", () => ({
  EstadoDeCuentaDocument: () => null,
}));

const { getDashboardKpis, getMyInvoice, listMyInvoices, PortalInvoicesUnavailableError } =
  await import("../portal-queries");
const { GET: facturaPdf } = await import("@/app/portal/(app)/facturas/[code]/pdf/route");
const { GET: estadoDeCuentaPdf } = await import(
  "@/app/portal/(app)/facturas/estado-de-cuenta/pdf/route"
);

function clientRow(over: Row = {}): Row {
  return {
    id: C1, tenant_id: T1, markbox: MARK, name: "Cliente sintético T1",
    email: null, phone: null, address: null, rif: null, doc_kind: "empresa",
    city: null, state: null, deleted_at: null, ...over,
  };
}

function membership(over: Row = {}, client: Row = clientRow()): Row {
  return {
    auth_user_id: USER, status: "active", client_id: C1, tenant_id: T1,
    clients: client, ...over,
  };
}

function invoice(tenant: string, code: string, over: Row = {}): Row {
  const own = tenant === T1;
  return {
    id: `${own ? "t1" : "t2"}-${code}`, tenant_id: tenant, invoice_code: code,
    client_markbox: MARK,
    client_name: own ? "Cliente sintético T1" : "Empresa ajena T2",
    client_rif: own ? null : "J-00000000-0", client_doc_kind: null,
    status: "emitida", currency: "USD", fx_rate: null, iva_rate: 0,
    base_amount: 100, iva_amount: 0, total_amount: 100, paid_amount: 0,
    issued_at: "2026-09-01", due_date: "2026-09-30", lines: [], notes: null,
    shipment_id: null, shipment_code: null, created_at: "2026-09-01T00:00:00Z",
    deleted_at: null, ...over,
  };
}

const INVOICES: Row[] = [
  invoice(T1, "F-T1-0001"),
  invoice(T1, "F-T1-BORRADOR", { status: "borrador" }),
  invoice(T1, "F-T1-OTRO-CLIENTE", { client_markbox: "DTD-OTRO" }),
  invoice(T2, "F-T2-0009", { base_amount: 777, total_amount: 777 }),
  invoice(T2, "F-T2-BORRADOR", { status: "borrador" }),
];

const TENANTS: Row[] = [T1, T2].map((id) => {
  const own = id === T1;
  return {
    id,
    legal_name: own ? "Empresa sintética T1, C.A." : "Empresa ajena T2, C.A.",
    trade_name: own ? "Empresa sintética T1" : "Empresa ajena T2",
    rif: own ? "J-11111111-1" : "J-22222222-2",
    commercial_email: null, phone: null, whatsapp: null, website: null,
    iva_enabled: true, iva_rate: 16, islr_rate: 3, igtf_rate: 3,
  };
});

const BANK_ACCOUNTS: Row[] = [T1, T2].map((tenant) => ({
  id: `cuenta-${tenant === T1 ? "t1" : "t2"}`, tenant_id: tenant,
  bank_name: tenant === T1 ? "Banco sintético T1" : "Banco ajeno T2",
  account_type: "corriente", currency: "USD",
  account_number: tenant === T1 ? "0001-T1" : "0002-T2",
  sort_order: 0, deleted_at: null, created_at: "2026-01-01T00:00:00Z",
}));

const PRIVATE = "synthetic_private_db_detail";

/** Constructor encadenable que filtra de verdad y registra cada filtro. */
function transport(
  client: Op["client"],
  tables: Record<string, Row[]>,
  ops: Op[],
  visible: (table: string, rows: Row[]) => Row[],
  faults: { failing?: string; rangeRoto?: boolean } = {},
) {
  return (table: string) => {
    const op: Op = { client, target: table, filters: [] };
    ops.push(op);
    let rows = visible(table, [...(tables[table] ?? [])]);
    const error = faults.failing === table ? { code: "57014", message: PRIVATE } : null;
    const builder = {
      select: () => builder,
      eq(key: string, value: unknown) {
        op.filters.push(["eq", key, value]);
        rows = rows.filter((row) => row[key] === value);
        return builder;
      },
      neq(key: string, value: unknown) {
        op.filters.push(["neq", key, value]);
        rows = rows.filter((row) => row[key] !== value);
        return builder;
      },
      is(key: string, value: unknown) {
        op.filters.push(["is", key, value]);
        rows = rows.filter((row) => row[key] === value);
        return builder;
      },
      // No reordena (las filas ya vienen en orden), pero registra el orden
      // pedido: paginar sin un orden estable repite o saltea filas.
      order(key: string, opts?: { ascending?: boolean }) {
        op.filters.push(["order", key, opts?.ascending ?? true]);
        return builder;
      },
      limit(count: number) {
        rows = rows.slice(0, count);
        return builder;
      },
      // PostgREST corta por offset; `rangeRoto` ignora el offset y devuelve
      // siempre lo mismo (la lectura nunca encuentra su página vacía).
      range(from: number, to: number) {
        if (!faults.rangeRoto) rows = rows.slice(from, to + 1);
        return builder;
      },
      // PostgREST: más de una fila en maybeSingle es error, no una elección.
      maybeSingle: async () => error
        ? { data: null, error }
        : rows.length > 1
          ? { data: null, error: { code: "PGRST116", message: "multiple rows" } }
          : { data: rows[0] ?? null, error: null },
      then(
        resolve: (value: { data: Row[] | null; error: typeof error }) => unknown,
        reject?: (reason: unknown) => unknown,
      ) {
        return Promise.resolve(error ? { data: null, error } : { data: rows, error: null })
          .then(resolve, reject);
      },
    };
    return builder;
  };
}

type ArrangeOptions = {
  user?: string | null;
  memberships?: Row[];
  invoices?: Row[];
  /** La lectura de `invoices` con la sesión devuelve error. */
  invoicesError?: boolean;
  /** El `range` del transporte ignora el offset. */
  rangeRoto?: boolean;
  /**
   * Sesión híbrida: el usuario es además del equipo de T2 (`user_tenants`) y
   * su RLS de equipo le deja ver la fila de T2 en `tenants`.
   */
  equipoDeT2?: boolean;
};

function arrange(options: ArrangeOptions = {}) {
  const ops: Op[] = [];
  const uid = options.user === null ? null : (options.user ?? USER);
  const memberships = options.memberships ?? [membership()];
  // `get_portal_client_markbox()` de 0080: vínculo activo del uid, sin tenant ni baja.
  const legacyMarkbox = () => {
    const link = memberships.find((row) => row.auth_user_id === uid && row.status === "active");
    return ((link?.clients as Row | undefined)?.markbox as string | undefined) ?? null;
  };
  const session = {
    auth: {
      getUser: async () => {
        ops.push({ client: "sesion", target: "auth.getUser", filters: [] });
        return { data: { user: uid ? { id: uid } : null }, error: null };
      },
    },
    rpc: async (name: string) => {
      ops.push({ client: "sesion", target: `rpc:${name}`, filters: [] });
      return { data: name === "get_portal_client_markbox" ? legacyMarkbox() : null, error: null };
    },
    from: transport(
      "sesion",
      {
        client_users: memberships,
        invoices: options.invoices ?? INVOICES,
        user_tenants: [{ user_id: USER, tenant_id: T2 }],
        tenants: TENANTS,
      },
      ops,
      (table, rows) => {
        if (table === "client_users") return rows.filter((row) => row.auth_user_id === uid);
        if (table === "invoices") {
          const mark = legacyMarkbox();
          return rows.filter((row) =>
            row.deleted_at === null && row.status !== "borrador" &&
            row.client_markbox != null && row.client_markbox === mark);
        }
        if (options.equipoDeT2 && table === "user_tenants") return rows;
        if (options.equipoDeT2 && table === "tenants") return rows.filter((row) => row.id === T2);
        // Un cliente Portal puro no ve user_tenants, tenants ni datos de empresa.
        return [];
      },
      {
        failing: options.invoicesError ? "invoices" : undefined,
        rangeRoto: options.rangeRoto,
      },
    ),
  } as unknown as SupabaseClient;
  state.session = session;
  state.admin = {
    from: transport(
      "admin",
      { tenants: TENANTS, company_offices: [], company_bank_accounts: BANK_ACCOUNTS },
      ops,
      (_table, rows) => rows,
    ),
  } as unknown as SupabaseClient;
  return { db: session, ops };
}

const request = new Request("http://portal.test/");
const params = (code: string) => ({
  params: Promise.resolve({ code: encodeURIComponent(code) }),
});

const INVALID_PRINCIPALS: Array<[string, ArrangeOptions]> = [
  ["sesión anónima", { user: null }],
  ["sin vínculo", { memberships: [] }],
  ["vínculo revocado", { memberships: [membership({ status: "revoked" })] }],
  [
    "vínculo de T1 con cliente de T2",
    { memberships: [membership({ client_id: C2 }, clientRow({ id: C2, tenant_id: T2 }))] },
  ],
  [
    "cliente retirado",
    { memberships: [membership({}, clientRow({ deleted_at: "2026-09-02T00:00:00Z" }))] },
  ],
];

beforeEach(() => {
  state.session = undefined;
  state.admin = undefined;
  state.adminBuilds = 0;
  state.rendered.length = 0;
});

describe("SDD-0462 · lectores de facturas del Portal", () => {
  it("la lista excluye la factura de otro tenant con el mismo Shipping Mark", async () => {
    const { db } = arrange();
    expect((await listMyInvoices(db)).map((row) => row.code)).toEqual(["F-T1-0001"]);
  });

  it("lista y detalle filtran explícito por tenant y Shipping Mark del principal", async () => {
    const { db, ops } = arrange();
    await listMyInvoices(db);
    await getMyInvoice(db, "F-T1-0001");
    const reads = ops.filter((op) => op.target === "invoices");
    // SDD-0556: 3 lecturas, no 2. La lista pagina con `fetchAllPaged`, que sólo
    // da por terminada la lectura al recibir una página VACÍA (lib/db/paginate):
    // una página con la factura + la página vacía + el detalle. Cada lectura,
    // la vacía incluida, lleva los mismos filtros; no es una prueba más floja.
    expect(reads).toHaveLength(3);
    for (const read of reads) {
      expect(read.filters).toEqual(expect.arrayContaining([
        ["eq", "tenant_id", T1],
        ["eq", "client_markbox", MARK],
      ]));
    }
  });

  it("el detalle de una factura de otro tenant responde null", async () => {
    const { db } = arrange();
    expect(await getMyInvoice(db, "F-T2-0009")).toBeNull();
  });

  it("con el mismo código en los dos tenants, el detalle es el del tenant del principal", async () => {
    const { db } = arrange({
      invoices: [
        invoice(T1, "F-2026-0001"),
        invoice(T2, "F-2026-0001", { base_amount: 777, total_amount: 777 }),
      ],
    });
    expect(await getMyInvoice(db, "F-2026-0001")).toMatchObject({
      code: "F-2026-0001",
      tenantId: T1,
      total: 100,
      clientName: "Cliente sintético T1",
      clientRif: null,
    });
  });

  it.each(INVALID_PRINCIPALS)("sin principal válido (%s) no consulta facturas", async (_label, options) => {
    const { db, ops } = arrange(options);
    expect(await listMyInvoices(db)).toEqual([]);
    expect(await getMyInvoice(db, "F-T1-0001")).toBeNull();
    expect(ops.some((op) => op.target === "invoices")).toBe(false);
  });
});

describe("SDD-0462 · tablero del Portal", () => {
  it("los KPIs del inicio no suman facturas de otro tenant", async () => {
    const { db } = arrange();
    const kpis = await getDashboardKpis(db, new Date("2026-09-13T00:00:00Z"));
    expect(kpis.invoicedTotal).toBe(100);
    expect(kpis.outstandingBalance).toBe(100);
    expect(kpis.pendingInvoiceCount).toBe(1);
  });
});

describe("SDD-0462 · PDF de la factura", () => {
  it("ajena, inexistente y borrador responden el mismo 404 sin construir admin ni renderizar", async () => {
    arrange();
    const answers = [];
    for (const code of ["F-T2-0009", "F-NO-EXISTE", "F-T1-BORRADOR"]) {
      const response = await facturaPdf(request, params(code));
      answers.push({
        status: response.status,
        body: await response.text(),
        cache: response.headers.get("Cache-Control"),
      });
    }
    expect(answers).toEqual(Array(3).fill({
      status: 404,
      body: "Factura no encontrado.",
      cache: "private, no-store",
    }));
    expect(state.adminBuilds).toBe(0);
    expect(state.rendered).toEqual([]);
  });

  it.each(INVALID_PRINCIPALS)("sin principal válido (%s) responde 404 sin leer facturas", async (_label, options) => {
    const { ops } = arrange(options);
    const response = await facturaPdf(request, params("F-T1-0001"));
    expect(response.status).toBe(404);
    expect(ops.some((op) => op.target === "invoices")).toBe(false);
    expect(state.adminBuilds).toBe(0);
  });

  it("resuelve el principal antes de leer la factura", async () => {
    const { ops } = arrange();
    const response = await facturaPdf(request, params("F-T1-0001"));
    expect(response.status).toBe(200);
    const targets = ops.map((op) => op.target);
    expect(targets.indexOf("client_users")).toBeGreaterThanOrEqual(0);
    expect(targets.indexOf("client_users")).toBeLessThan(targets.indexOf("invoices"));
  });

  it("el emisor y sus cuentas salen sólo del tenant del principal", async () => {
    const { ops } = arrange();
    const response = await facturaPdf(request, params("F-T1-0001"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="factura-F-T1-0001.pdf"',
    );
    expect(state.rendered).toHaveLength(1);
    const [props] = state.rendered;
    const emisor = props.emisor as {
      tradeName: string;
      rif: string;
      cuentas: Array<{ accountNumber: string }>;
    };
    expect(emisor.tradeName).toBe("Empresa sintética T1");
    expect(emisor.rif).toBe("J-11111111-1");
    expect(emisor.cuentas.map((cuenta) => cuenta.accountNumber)).toEqual(["0001-T1"]);
    expect((props.invoice as Row).clientMarkbox).toBe(MARK);
    const adminReads = ops.filter((op) => op.client === "admin");
    expect(adminReads.map((op) => op.target).sort()).toEqual([
      "company_bank_accounts",
      "company_offices",
      "tenants",
    ]);
    for (const read of adminReads) {
      expect(read.filters).toContainEqual(["eq", read.target === "tenants" ? "id" : "tenant_id", T1]);
    }
  });
});

describe("SDD-0462 · estado de cuenta en PDF", () => {
  it("el libro no incluye facturas de otro tenant", async () => {
    arrange();
    const response = await estadoDeCuentaPdf();
    expect(response.status).toBe(200);
    expect(state.rendered).toHaveLength(1);
    const input = state.rendered[0].input as {
      markbox: string;
      ledger: { totalCargo: number; moves: Array<{ concept: string }> };
    };
    expect(input.markbox).toBe(MARK);
    expect(input.ledger.totalCargo).toBe(100);
    expect(input.ledger.moves.map((move) => move.concept)).toEqual(["Factura F-T1-0001"]);
  });
});

/** 150 facturas propias de T1 (más que el viejo tope de 100) y una de T2. */
function muchas(): Row[] {
  const propias = Array.from({ length: 150 }, (_, i) =>
    invoice(T1, `F-T1-${String(i + 1).padStart(4, "0")}`, {
      total_amount: i + 1,
      base_amount: i + 1,
    }));
  return [...propias, invoice(T2, "F-T2-0009", { base_amount: 777, total_amount: 777 })];
}

describe("SDD-0556 · lectura completa de las facturas del Portal", () => {
  it("lee las 150 facturas propias, sin el tope de 100, y ninguna de T2", async () => {
    const { db } = arrange({ invoices: muchas() });
    const rows = await listMyInvoices(db);
    expect(rows).toHaveLength(150);
    expect(rows.some((row) => row.code.startsWith("F-T2"))).toBe(false);
    const kpis = await getDashboardKpis(db, new Date("2026-09-13T00:00:00Z"));
    expect(kpis.invoicedTotal).toBe((150 * 151) / 2);
  });

  it("cada página lleva los filtros del principal y un orden estable que termina en id", async () => {
    const { db, ops } = arrange();
    await listMyInvoices(db);
    const paginas = ops.filter((op) => op.target === "invoices");
    expect(paginas).toHaveLength(2); // la de datos y la vacía que cierra la lectura
    for (const pagina of paginas) {
      expect(pagina.filters).toEqual(expect.arrayContaining([
        ["eq", "tenant_id", T1],
        ["eq", "client_markbox", MARK],
        ["neq", "status", "borrador"],
        ["is", "deleted_at", null],
      ]));
      const orden = pagina.filters.filter(([kind]) => kind === "order");
      expect(orden.at(-1)).toEqual(["order", "id", true]);
    }
  });

  it("si la base no responde, rechaza con un error sin el detalle de la base", async () => {
    const { db } = arrange({ invoicesError: true });
    const error = await listMyInvoices(db).then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(PortalInvoicesUnavailableError);
    expect((error as Error).message).toBe("PORTAL_FACTURAS_NO_DISPONIBLES");
    expect((error as Error).message).not.toContain(PRIVATE);
    expect((error as InstanceType<typeof PortalInvoicesUnavailableError>).motivo).toBe("lectura");
  });

  it("si la lectura no termina (el orden no avanza), rechaza por incompleta", async () => {
    const { db } = arrange({ rangeRoto: true });
    await expect(listMyInvoices(db)).rejects.toMatchObject({
      name: "PortalInvoicesUnavailableError",
      motivo: "incompleta",
    });
  });

  it("una anulada que nunca se emitió queda fuera, como un borrador; la emitida se queda", async () => {
    const { db } = arrange({
      invoices: [
        invoice(T1, "F-T1-0001"),
        invoice(T1, "F-T1-ANULADA-SIN-EMITIR", { status: "anulada", issued_at: null }),
        invoice(T1, "F-T1-ANULADA", { status: "anulada" }),
      ],
    });
    expect((await listMyInvoices(db)).map((row) => row.code)).toEqual([
      "F-T1-0001",
      "F-T1-ANULADA",
    ]);
    expect(await getMyInvoice(db, "F-T1-ANULADA-SIN-EMITIR")).toBeNull();
    expect(await getMyInvoice(db, "F-T1-ANULADA")).toMatchObject({ status: "anulada" });
  });
});

describe("SDD-0556 · estado de cuenta en PDF: principal único, emisor del tenant y fallas visibles", () => {
  it("resuelve el principal antes de leer facturas, y construye el admin sólo después", async () => {
    const { ops } = arrange();
    const response = await estadoDeCuentaPdf();
    expect(response.status).toBe(200);
    const targets = ops.map((op) => op.target);
    expect(targets.indexOf("client_users")).toBeGreaterThanOrEqual(0);
    expect(targets.indexOf("client_users")).toBeLessThan(targets.indexOf("invoices"));
    const primeraAdmin = ops.findIndex((op) => op.client === "admin");
    expect(primeraAdmin).toBeGreaterThan(targets.lastIndexOf("invoices"));
    expect(state.adminBuilds).toBe(1);
    // Una sola resolución del principal (antes eran dos: getPortalClient + listMyInvoices).
    expect(ops.filter((op) => op.target === "client_users")).toHaveLength(1);
  });

  it("el emisor sale del tenant del principal, leído con admin y acotado a T1", async () => {
    const { ops } = arrange();
    await estadoDeCuentaPdf();
    const [props] = state.rendered;
    expect(props.emisor).toMatchObject({ tradeName: "Empresa sintética T1" });
    const adminReads = ops.filter((op) => op.client === "admin");
    expect(adminReads.map((op) => op.target).sort()).toEqual([
      "company_bank_accounts",
      "company_offices",
      "tenants",
    ]);
    for (const read of adminReads) {
      expect(read.filters).toContainEqual(["eq", read.target === "tenants" ? "id" : "tenant_id", T1]);
    }
  });

  it("🔴 hoy NO pasa razón social ni RIF: la excepción de marca cubre sólo la factura (SDD-0297)", async () => {
    // Si Sam extiende la excepción al estado de cuenta, este caso cambia junto
    // con la ruta. Mientras tanto, el papel no imprime la identidad fiscal.
    arrange();
    await estadoDeCuentaPdf();
    const emisor = state.rendered[0].emisor as Record<string, unknown>;
    expect(emisor).not.toHaveProperty("legalName");
    expect(emisor).not.toHaveProperty("rif");
  });

  it("en una sesión híbrida (equipo de T2 + cliente de T1) el emisor es T1, no el tenant de equipo", async () => {
    arrange({ equipoDeT2: true });
    const response = await estadoDeCuentaPdf();
    expect(response.status).toBe(200);
    expect(state.rendered[0].emisor).toMatchObject({ tradeName: "Empresa sintética T1" });
  });

  it.each(INVALID_PRINCIPALS)("sin principal válido (%s) responde 404 sin leer facturas ni construir admin", async (_label, options) => {
    const { ops } = arrange(options);
    const response = await estadoDeCuentaPdf();
    expect(response.status).toBe(404);
    expect(ops.some((op) => op.target === "invoices")).toBe(false);
    expect(state.adminBuilds).toBe(0);
    expect(state.rendered).toEqual([]);
  });

  it("si las facturas no se pueden leer, responde 503 privado y no imprime un papel vacío", async () => {
    arrange({ invoicesError: true });
    const response = await estadoDeCuentaPdf();
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.text()).not.toContain(PRIVATE);
    expect(state.rendered).toEqual([]);
    expect(state.adminBuilds).toBe(0);
  });

  it("la anulada sale en el libro en 0 y su pago se informa aparte", async () => {
    arrange({
      invoices: [
        invoice(T1, "F-T1-0001"),
        invoice(T1, "F-T1-ANULADA", { status: "anulada", total_amount: 500, paid_amount: 200 }),
      ],
    });
    await estadoDeCuentaPdf();
    const ledger = (state.rendered[0].input as {
      ledger: { totalCargo: number; balance: number; moves: Array<{ concept: string; amount: number }>; voidedPayments: unknown[] };
    }).ledger;
    expect(ledger.totalCargo).toBe(100);
    expect(ledger.balance).toBe(100);
    expect(ledger.moves.find((m) => m.concept === "Factura F-T1-ANULADA · anulada")?.amount).toBe(0);
    expect(ledger.voidedPayments).toEqual([
      { code: "F-T1-ANULADA", reference: null, amount: 200, currency: "USD" },
    ]);
  });
});

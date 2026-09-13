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

const { getDashboardKpis, getMyInvoice, listMyInvoices } = await import("../portal-queries");
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

/** Constructor encadenable que filtra de verdad y registra cada filtro. */
function transport(
  client: Op["client"],
  tables: Record<string, Row[]>,
  ops: Op[],
  visible: (table: string, rows: Row[]) => Row[],
) {
  return (table: string) => {
    const op: Op = { client, target: table, filters: [] };
    ops.push(op);
    let rows = visible(table, [...(tables[table] ?? [])]);
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
      order: () => builder,
      limit(count: number) {
        rows = rows.slice(0, count);
        return builder;
      },
      // PostgREST: más de una fila en maybeSingle es error, no una elección.
      maybeSingle: async () => rows.length > 1
        ? { data: null, error: { code: "PGRST116", message: "multiple rows" } }
        : { data: rows[0] ?? null, error: null },
      then(
        resolve: (value: { data: Row[]; error: null }) => unknown,
        reject?: (reason: unknown) => unknown,
      ) {
        return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
      },
    };
    return builder;
  };
}

type ArrangeOptions = {
  user?: string | null;
  memberships?: Row[];
  invoices?: Row[];
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
      { client_users: memberships, invoices: options.invoices ?? INVOICES },
      ops,
      (table, rows) => {
        if (table === "client_users") return rows.filter((row) => row.auth_user_id === uid);
        if (table === "invoices") {
          const mark = legacyMarkbox();
          return rows.filter((row) =>
            row.deleted_at === null && row.status !== "borrador" &&
            row.client_markbox != null && row.client_markbox === mark);
        }
        // Un cliente Portal puro no ve user_tenants, tenants ni datos de empresa.
        return [];
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
    expect(reads).toHaveLength(2);
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

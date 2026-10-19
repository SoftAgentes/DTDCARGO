// @vitest-environment node
/**
 * SDD-0554 · Las lecturas de compras que llama el Portal filtran por el tenant
 * Y el Shipping Mark del principal; el Studio, sin ámbito, no cambia.
 *
 * La sesión es el doble de la SDD-0549: aplica de verdad `eq`/`is`/`in`/`range`
 * y NO modela la RLS, así que devuelve las filas de los dos tenants que pasen la
 * consulta. Es lo que recibe una sesión híbrida (equipo del tenant B y cliente
 * Portal del tenant A) por la policy permisiva «by tenant». Cada tabla siembra:
 *  - la fila propia (tenant A, Shipping Mark del cliente);
 *  - la misma Shipping Mark en el tenant B (lo que corta el tenant);
 *  - otro cliente del tenant A (lo que corta el Shipping Mark);
 *  - una fila borrada.
 * En adjuntos, la fila del tenant B cuelga de la compra de A: la base no lo
 * impide (0118: FK sólo a `prealertas(id)`), y el id de la compra no basta.
 */
import { describe, expect, it } from "vitest";
import {
  MARKBOX,
  TENANT_A,
  TENANT_B,
  portalDouble,
  type Filter,
  type Row,
} from "@/lib/portal/__tests__/portal-tenant-double";
import {
  listPrealertaDocuments,
  listPrealertas,
  listSuppliers,
  type PortalPurchaseScope,
} from "../queries";

const OTRO_MARKBOX = "DTD-0002";
const SCOPE: PortalPurchaseScope = { markbox: MARKBOX, tenantId: TENANT_A };

function supplier(id: string, tenantId: string, markbox: string, extra: Row = {}): Row {
  return {
    id,
    tenant_id: tenantId,
    client_markbox: markbox,
    supplier_seq: 1,
    name: `Proveedor ${id}`,
    city: null,
    wechat: null,
    contact: null,
    notes: null,
    deleted_at: null,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:00:00.000Z",
    ...extra,
  };
}

function prealerta(id: string, tenantId: string, markbox: string, extra: Row = {}): Row {
  return {
    id,
    tenant_id: tenantId,
    client_markbox: markbox,
    supplier_id: null,
    code: `${markbox}-1-${id}`,
    description: `Compra ${id}`,
    tracking_cn: null,
    client_note: null,
    boxes: 2,
    est_value_usd: null,
    status: "anunciada",
    received_at: null,
    shipment_id: null,
    share_token: null,
    sales_order_id: null,
    deleted_at: null,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:00:00.000Z",
    ...extra,
  };
}

function documento(id: string, tenantId: string, markbox: string, extra: Row = {}): Row {
  return {
    id,
    tenant_id: tenantId,
    prealerta_id: "pre-a",
    client_markbox: markbox,
    doc_type: "factura",
    storage_path: `ruta/${id}.pdf`,
    file_name: `${id}.pdf`,
    content_type: "application/pdf",
    size_bytes: 10,
    source: "client",
    deleted_at: null,
    created_at: "2026-10-01T00:00:00.000Z",
    ...extra,
  };
}

function sesionHibrida() {
  return portalDouble({
    tables: {
      suppliers_cn: [
        supplier("sup-a", TENANT_A, MARKBOX),
        supplier("sup-b", TENANT_B, MARKBOX),
        supplier("sup-otro-cliente", TENANT_A, OTRO_MARKBOX),
        supplier("sup-borrado", TENANT_A, MARKBOX, { deleted_at: "2026-10-02T00:00:00.000Z" }),
      ],
      prealertas: [
        prealerta("pre-a", TENANT_A, MARKBOX),
        prealerta("pre-a-recibida", TENANT_A, MARKBOX, { status: "recibida" }),
        prealerta("pre-b", TENANT_B, MARKBOX),
        prealerta("pre-b-recibida", TENANT_B, MARKBOX, { status: "recibida" }),
        prealerta("pre-otro-cliente", TENANT_A, OTRO_MARKBOX),
        prealerta("pre-borrada", TENANT_A, MARKBOX, { deleted_at: "2026-10-02T00:00:00.000Z" }),
      ],
      prealerta_documents: [
        documento("doc-a", TENANT_A, MARKBOX),
        documento("doc-b-en-compra-de-a", TENANT_B, MARKBOX),
        documento("doc-otro-cliente", TENANT_A, OTRO_MARKBOX),
        documento("doc-borrado", TENANT_A, MARKBOX, { deleted_at: "2026-10-02T00:00:00.000Z" }),
        documento("doc-otra-compra", TENANT_A, MARKBOX, { prealerta_id: "pre-a-recibida" }),
      ],
    },
  });
}

const ids = (rows: { id: string }[]) => rows.map((r) => r.id);
const filtros = (ops: { filters: Filter[] }[]) => ops.map((op) => op.filters);

// Ámbitos Portal incompletos: llegan desde JS o con un `as`, nunca con los tipos.
const AMBITOS_INVALIDOS: [string, unknown][] = [
  ["sin tenant", { markbox: MARKBOX }],
  ["tenant vacío", { markbox: MARKBOX, tenantId: "" }],
  ["tenant en blanco", { markbox: MARKBOX, tenantId: "  " }],
  ["sin Shipping Mark", { tenantId: TENANT_A }],
  ["Shipping Mark vacío", { markbox: "", tenantId: TENANT_A }],
  ["Shipping Mark en blanco", { markbox: " ", tenantId: TENANT_A }],
  ["Shipping Mark indefinido", { markbox: undefined }],
  ["tenant que no es texto", { markbox: MARKBOX, tenantId: 7 }],
];

describe("listSuppliers con el ámbito Portal (SDD-0554)", () => {
  it("devuelve sólo los proveedores vivos del tenant y el Shipping Mark del principal", async () => {
    const s = sesionHibrida();
    expect(ids(await listSuppliers(s.db, SCOPE))).toEqual(["sup-a"]);
    const ops = s.on("suppliers_cn");
    expect(ops.length).toBeGreaterThan(0);
    for (const filters of filtros(ops)) {
      expect(filters).toEqual(
        expect.arrayContaining([
          { column: "tenant_id", op: "eq", value: TENANT_A },
          { column: "client_markbox", op: "eq", value: MARKBOX },
        ]),
      );
    }
  });

  it.each(AMBITOS_INVALIDOS)("un ámbito Portal inválido (%s) no consulta ni cae al modo Studio", async (_l, opts) => {
    const s = sesionHibrida();
    expect(await listSuppliers(s.db, opts as PortalPurchaseScope)).toEqual([]);
    expect(s.on("suppliers_cn")).toEqual([]);
  });

  it("el Studio sin ámbito conserva su consulta: sólo vivos, sin tenant ni Shipping Mark", async () => {
    const s = sesionHibrida();
    expect(ids(await listSuppliers(s.db))).toEqual(["sup-a", "sup-b", "sup-otro-cliente"]);
    for (const filters of filtros(s.on("suppliers_cn"))) {
      expect(filters).toEqual([{ column: "deleted_at", op: "is", value: null }]);
    }
  });
});

describe("listPrealertas con el ámbito Portal (SDD-0554)", () => {
  it("devuelve sólo las compras vivas del tenant y el Shipping Mark del principal", async () => {
    const s = sesionHibrida();
    expect(ids(await listPrealertas(s.db, SCOPE))).toEqual(["pre-a", "pre-a-recibida"]);
    const ops = s.on("prealertas");
    expect(ops.length).toBeGreaterThan(0);
    for (const filters of filtros(ops)) {
      expect(filters).toEqual(
        expect.arrayContaining([
          { column: "tenant_id", op: "eq", value: TENANT_A },
          { column: "client_markbox", op: "eq", value: MARKBOX },
        ]),
      );
    }
  });

  it("conserva el filtro por estado junto al ámbito", async () => {
    const s = sesionHibrida();
    expect(ids(await listPrealertas(s.db, { ...SCOPE, status: "recibida" }))).toEqual(["pre-a-recibida"]);
  });

  it.each(AMBITOS_INVALIDOS)("un ámbito Portal inválido (%s) no consulta ni cae al modo Studio", async (_l, opts) => {
    const s = sesionHibrida();
    expect(await listPrealertas(s.db, opts as PortalPurchaseScope)).toEqual([]);
    expect(s.on("prealertas")).toEqual([]);
  });

  it("el Studio sin ámbito conserva su consulta, con y sin estado", async () => {
    const s = sesionHibrida();
    expect(ids(await listPrealertas(s.db))).toEqual([
      "pre-a",
      "pre-a-recibida",
      "pre-b",
      "pre-b-recibida",
      "pre-otro-cliente",
    ]);
    expect(ids(await listPrealertas(s.db, { status: "recibida" }))).toEqual(["pre-a-recibida", "pre-b-recibida"]);
    expect(filtros(s.on("prealertas"))).toEqual([
      [{ column: "deleted_at", op: "is", value: null }],
      [
        { column: "deleted_at", op: "is", value: null },
        { column: "status", op: "eq", value: "recibida" },
      ],
    ]);
  });
});

describe("listPrealertaDocuments con el ámbito Portal (SDD-0554)", () => {
  it("devuelve sólo los adjuntos de la compra con el tenant y el Shipping Mark del principal", async () => {
    const s = sesionHibrida();
    const docs = await listPrealertaDocuments(s.db, { prealertaId: "pre-a", ...SCOPE });
    expect(ids(docs)).toEqual(["doc-a"]);
    expect(filtros(s.on("prealerta_documents"))).toEqual([
      expect.arrayContaining([
        { column: "prealerta_id", op: "eq", value: "pre-a" },
        { column: "tenant_id", op: "eq", value: TENANT_A },
        { column: "client_markbox", op: "eq", value: MARKBOX },
      ]),
    ]);
  });

  it.each([...AMBITOS_INVALIDOS, ["sin ámbito", {}]] as [string, unknown][])(
    "un ámbito Portal inválido (%s) no consulta",
    async (_l, opts) => {
      const s = sesionHibrida();
      const args = { prealertaId: "pre-a", ...(opts as object) } as Parameters<typeof listPrealertaDocuments>[1];
      expect(await listPrealertaDocuments(s.db, args)).toEqual([]);
      expect(s.on("prealerta_documents")).toEqual([]);
    },
  );
});

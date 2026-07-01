/**
 * Tests de `searchGlobalAction` (SDD-0135 · §6 seguridad).
 *
 * Lo NO negociable (spec §6):
 *   - un rol SIN módulo de dinero NUNCA invoca `listInvoices` / `searchReceipts`
 *     (verificado con spy);
 *   - `locked` (candado) sale de la matriz de facetas, no de consultar tablas
 *     financieras;
 *   - `marketing` ubica contacto (faceta Cliente) sin ejecutar ninguna faceta
 *     de dinero;
 *   - monto → facturas/pagos solo para roles con dinero;
 *   - código rutea a la faceta del prefijo.
 *
 * Supabase, el rol y TODAS las capas de query están mockeadas — sin red ni DB.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (antes de importar el SUT) ───────────────────────────────
const getStudioRoleMock = vi.fn<() => Promise<string | null>>();
const listClientsMock = vi.fn(async () => [] as unknown[]);
const getClientByCedulaMock = vi.fn(async () => null as unknown);
const listShipmentsMock = vi.fn(async () => [] as unknown[]);
const listQuotesMock = vi.fn(async () => [] as unknown[]);
const listInvoicesMock = vi.fn(async () => [] as unknown[]);
const searchReceiptsMock = vi.fn(async () => [] as unknown[]);

vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({ __fake: true }),
}));
vi.mock("@/lib/studio/rbac-guard", () => ({
  getStudioRole: () => getStudioRoleMock(),
}));
vi.mock("@/lib/studio/client-queries", () => ({
  listClients: (...a: unknown[]) => listClientsMock(...(a as [])),
  getClientByCedula: (...a: unknown[]) => getClientByCedulaMock(...(a as [])),
}));
vi.mock("@/lib/studio/shipment-queries", () => ({
  listShipments: (...a: unknown[]) => listShipmentsMock(...(a as [])),
}));
vi.mock("@/lib/studio/quote-queries", () => ({
  listQuotes: (...a: unknown[]) => listQuotesMock(...(a as [])),
}));
vi.mock("@/lib/studio/invoice-queries", () => ({
  listInvoices: (...a: unknown[]) => listInvoicesMock(...(a as [])),
}));
vi.mock("@/lib/studio/payment-queries", () => ({
  searchReceipts: (...a: unknown[]) => searchReceiptsMock(...(a as [])),
}));

import { searchGlobalAction } from "./search-action";

beforeEach(() => {
  vi.clearAllMocks();
  listClientsMock.mockResolvedValue([]);
  getClientByCedulaMock.mockResolvedValue(null);
  listShipmentsMock.mockResolvedValue([]);
  listQuotesMock.mockResolvedValue([]);
  listInvoicesMock.mockResolvedValue([]);
  searchReceiptsMock.mockResolvedValue([]);
});

describe("gate de dinero: roles sin módulo de dinero NO tocan invoices/receipts", () => {
  it("commercial + texto: nunca invoca listInvoices ni searchReceipts", async () => {
    getStudioRoleMock.mockResolvedValue("commercial");
    const res = await searchGlobalAction("Juan Pérez");

    expect(listInvoicesMock).not.toHaveBeenCalled();
    expect(searchReceiptsMock).not.toHaveBeenCalled();
    // Operativas sí corren.
    expect(listClientsMock).toHaveBeenCalled();
    expect(listShipmentsMock).toHaveBeenCalled();
    expect(listQuotesMock).toHaveBeenCalled();
    // Candado de dinero derivado de la matriz.
    expect(res.locked.map((l) => l.facet).sort()).toEqual(["invoices", "payments"]);
  });

  it("operations + texto: tampoco toca las facetas de dinero", async () => {
    getStudioRoleMock.mockResolvedValue("operations");
    await searchGlobalAction("caja azul");
    expect(listInvoicesMock).not.toHaveBeenCalled();
    expect(searchReceiptsMock).not.toHaveBeenCalled();
  });

  it("accounting + texto: SÍ invoca listInvoices y searchReceipts, sin candado", async () => {
    getStudioRoleMock.mockResolvedValue("accounting");
    const res = await searchGlobalAction("Juan Pérez");
    expect(listInvoicesMock).toHaveBeenCalled();
    expect(searchReceiptsMock).toHaveBeenCalled();
    expect(res.locked).toEqual([]);
  });
});

describe("marketing: ubica contacto sin facetas de dinero", () => {
  it("solo corre la faceta Cliente; nada de dinero; candado presente", async () => {
    getStudioRoleMock.mockResolvedValue("marketing");
    const res = await searchGlobalAction("Distribuidora XYZ");

    expect(listClientsMock).toHaveBeenCalled();
    expect(listShipmentsMock).not.toHaveBeenCalled();
    expect(listQuotesMock).not.toHaveBeenCalled();
    expect(listInvoicesMock).not.toHaveBeenCalled();
    expect(searchReceiptsMock).not.toHaveBeenCalled();
    expect(res.locked.map((l) => l.facet).sort()).toEqual(["invoices", "payments"]);
  });
});

describe("clasificación de término rutea a la faceta correcta", () => {
  it("monto + commercial: scope solo dinero → nada corre, todo candado", async () => {
    getStudioRoleMock.mockResolvedValue("commercial");
    const res = await searchGlobalAction("$1.500");
    expect(res.kind).toBe("amount");
    expect(listInvoicesMock).not.toHaveBeenCalled();
    expect(searchReceiptsMock).not.toHaveBeenCalled();
    expect(listClientsMock).not.toHaveBeenCalled();
    expect(res.locked.map((l) => l.facet).sort()).toEqual(["invoices", "payments"]);
  });

  it("monto + accounting: consulta facturas (sin q) y recibos por monto", async () => {
    getStudioRoleMock.mockResolvedValue("accounting");
    await searchGlobalAction("$1.500");
    expect(listInvoicesMock).toHaveBeenCalled();
    expect(searchReceiptsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ amount: 1500 }),
    );
    // No debe buscar clientes con un monto.
    expect(listClientsMock).not.toHaveBeenCalled();
  });

  it("cédula + commercial: solo faceta Cliente, sin candado de dinero", async () => {
    getStudioRoleMock.mockResolvedValue("commercial");
    const res = await searchGlobalAction("V-12345678");
    expect(res.kind).toBe("cedula");
    expect(listClientsMock).toHaveBeenCalled();
    expect(listShipmentsMock).not.toHaveBeenCalled();
    expect(listInvoicesMock).not.toHaveBeenCalled();
    expect(res.locked).toEqual([]); // dinero fuera de scope para cédula
  });

  it("código F- + commercial: scope facturas → denegado, candado, sin query", async () => {
    getStudioRoleMock.mockResolvedValue("commercial");
    const res = await searchGlobalAction("F-2026-0001");
    expect(res.kind).toBe("code");
    expect(listInvoicesMock).not.toHaveBeenCalled();
    expect(res.locked.map((l) => l.facet)).toEqual(["invoices"]);
  });

  it("código F- + accounting: consulta facturas por código", async () => {
    getStudioRoleMock.mockResolvedValue("accounting");
    await searchGlobalAction("F-2026-0001");
    expect(listInvoicesMock).toHaveBeenCalled();
    expect(listClientsMock).not.toHaveBeenCalled();
  });

  it("código S- + warehouse: consulta embarques, no clientes", async () => {
    getStudioRoleMock.mockResolvedValue("warehouse");
    await searchGlobalAction("S-2024-001");
    expect(listShipmentsMock).toHaveBeenCalled();
    expect(listClientsMock).not.toHaveBeenCalled();
  });
});

describe("resultados y forma", () => {
  it("agrupa por faceta operativo→dinero y arma hits con href", async () => {
    getStudioRoleMock.mockResolvedValue("accounting");
    listClientsMock.mockResolvedValue([
      { id: "c1", markbox: "DTD-0001", name: "Juan", rif: "V-123" },
    ]);
    listInvoicesMock.mockResolvedValue([
      { id: "i1", invoice_code: "F-1", client_name: "Juan", total_amount: 100, currency: "USD" },
    ]);
    const res = await searchGlobalAction("Juan");

    const clients = res.groups.find((g) => g.facet === "clients");
    expect(clients?.hits[0]).toMatchObject({
      code: "DTD-0001",
      title: "Juan",
      href: "/studio/clientes/DTD-0001",
    });
    // operativo antes que dinero.
    expect(res.groups.map((g) => g.facet)).toEqual(["clients", "invoices"]);
  });

  it("término < 2 chars: sin queries, sin rol", async () => {
    const res = await searchGlobalAction("a");
    expect(getStudioRoleMock).not.toHaveBeenCalled();
    expect(res.groups).toEqual([]);
  });

  it("rol nulo (sin sesión): fail-closed, cero facetas ejecutadas", async () => {
    getStudioRoleMock.mockResolvedValue(null);
    const res = await searchGlobalAction("Juan");
    expect(listClientsMock).not.toHaveBeenCalled();
    expect(res.groups).toEqual([]);
  });
});

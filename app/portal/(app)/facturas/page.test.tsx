/**
 * SDD-0543 · «Mis facturas» con borradores por aceptar: la tarjeta avisa cuántas
 * y cuánto; sin facturas emitidas, el vacío no se contradice con la tarjeta
 * («no tienes facturas» → «no tienes facturas emitidas» y dice cuándo entran al
 * estado de cuenta). Sin borradores, la página de siempre.
 *
 * Se renderiza la página real con sus consultas simuladas; la tarjeta se
 * reemplaza por una que pinta el título que recibe (lo que se prueba es qué le
 * pasa la página).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

const CLIENTE = { id: "c1", markbox: "DTD-8001", name: "Cliente Prueba", email: null, phone: null, address: null };

const h = vi.hoisted(() => ({
  facturas: [] as unknown[],
  pendientes: [] as unknown[],
  principal: null as unknown,
  cargados: [] as unknown[],
}));

vi.mock("@/lib/db/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/portal/demo", () => ({ showNortePortal: () => false }));
vi.mock("@/lib/portal/portal-queries", () => ({
  // SDD-0549: la página resuelve el principal UNA vez. `getPortalClient` se deja
  // para que una versión que volviera a usarlo corra y falle por la aserción.
  getPortalClientPrincipal: async () => h.principal,
  getPortalClient: async () => (h.principal as { client?: unknown } | null)?.client ?? null,
  listMyInvoices: async () => h.facturas,
  listMyShipments: async () => [],
  listMyEstimates: async () => [],
}));
vi.mock("@/lib/portal/pending-acceptance", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/portal/pending-acceptance")>()),
  loadPendingAcceptanceForClient: async (arg: unknown) => {
    h.cargados.push(arg);
    return h.pendientes;
  },
}));
vi.mock("../_components/PendingAcceptanceCard", () => ({
  PendingAcceptanceCard: (p: { heading?: string }) => <section aria-label="Por aceptar">{p.heading}</section>,
}));

import PortalInvoicesPage from "./page";

const PENDIENTE = { code: "F-2026-0007", baseAmount: 876.78, totalAmount: 876.78, currency: "USD", shipmentCode: "DTD-A116-06", cbm: 1.022, weightKg: 408.55 };

async function abrir(searchParams: { saldo?: string; vista?: string } = {}) {
  const ui = await PortalInvoicesPage({ searchParams: Promise.resolve(searchParams) });
  render(ui);
}

/** Una fila de «Mis facturas» como la devuelve `listMyInvoices`. */
function factura(over: Record<string, unknown>) {
  return {
    id: String(over.code),
    status: "emitida",
    currency: "USD",
    total: 1000,
    paid: 0,
    issuedAt: "2026-09-01",
    dueDate: "2026-09-30",
    shipmentCode: null,
    ...over,
  };
}

const VIVA = factura({ code: "F-VIVA", total: 1000, paid: 400 });
const ANULADA_SIN_PAGO = factura({ code: "F-ANULADA-1", status: "anulada", total: 9999, paid: 0 });
const ANULADA_CON_PAGO = factura({ code: "F-ANULADA-2", status: "anulada", total: 500, paid: 300 });
const PAGADA = factura({ code: "F-PAGADA", status: "pagada", total: 200, paid: 200 });

/** El valor de un KPI, buscado por su etiqueta. */
function kpi(label: string): HTMLElement {
  return screen.getByText(label).parentElement as HTMLElement;
}

const NOTA = /Recibimos USD 300\.00 en pagos de facturas que después se anularon \(F-ANULADA-2\)/;

beforeEach(() => {
  h.principal = { userId: "u1", tenantId: "t1", client: CLIENTE };
});

afterEach(() => {
  cleanup();
  h.facturas = [];
  h.pendientes = [];
  h.principal = null;
  h.cargados = [];
});

describe("/portal/facturas · borradores por aceptar con el principal de sesión (SDD-0549)", () => {
  it("le pasa al loader el tenant y el Shipping Mark del principal", async () => {
    await abrir();
    expect(h.cargados).toHaveLength(1);
    expect(h.cargados[0]).toMatchObject({ tenantId: "t1", client: { markbox: "DTD-8001" } });
  });

  it("sin principal Portal no carga borradores", async () => {
    h.principal = null;
    h.pendientes = [PENDIENTE];
    await abrir();
    expect(h.cargados).toEqual([]);
    expect(screen.queryByRole("region", { name: "Por aceptar" })).toBeNull();
  });
});

describe("/portal/facturas con borradores por aceptar (SDD-0543)", () => {
  it("con una por aceptar y ninguna emitida: tarjeta arriba y un vacío que no la contradice", async () => {
    h.pendientes = [PENDIENTE];
    await abrir();
    expect(screen.getByRole("region", { name: "Por aceptar" })).toHaveTextContent("Tienes 1 factura por aceptar.");
    expect(screen.getByText("Todavía no tienes facturas emitidas.")).toBeInTheDocument();
    expect(screen.getByText(/La factura por aceptar que ves arriba .*entra al estado de cuenta cuando la aceptes y se emita/)).toBeInTheDocument();
    expect(screen.queryByText("Todavía no tienes facturas.")).toBeNull();
  });

  it("con dos por aceptar en la misma moneda el título y el vacío traen la suma", async () => {
    h.pendientes = [PENDIENTE, { ...PENDIENTE, code: "F-2026-0008", totalAmount: 123.22 }];
    await abrir();
    expect(screen.getByRole("region", { name: "Por aceptar" })).toHaveTextContent(/Tienes 2 facturas por aceptar · .*1[.,]000[.,]00/);
    expect(screen.getByText(/Las 2 facturas por aceptar que ves arriba \(.*1[.,]000[.,]00\) entran al estado de cuenta cuando las aceptes y se emitan/)).toBeInTheDocument();
  });

  it("sin borradores por aceptar: ni tarjeta ni mención; el vacío de siempre", async () => {
    await abrir();
    expect(screen.queryByRole("region", { name: "Por aceptar" })).toBeNull();
    expect(screen.getByText("Todavía no tienes facturas.")).toBeInTheDocument();
    expect(screen.getByText(/Cuando tu asesor emita una factura a tu nombre/)).toBeInTheDocument();
    expect(screen.queryByText(/por aceptar/)).toBeNull();
  });
});

describe("/portal/facturas · las anuladas no son deuda (SDD-0556)", () => {
  it("los KPIs no suman las anuladas y la nota informa lo pagado en ellas", async () => {
    // Antes: facturado USD 11,499.00 y saldo USD 10,799.00, sin nota.
    h.facturas = [VIVA, ANULADA_SIN_PAGO, ANULADA_CON_PAGO];
    await abrir();
    expect(kpi("Total facturado")).toHaveTextContent("USD 1,000.00");
    expect(kpi("Pagado")).toHaveTextContent("USD 400.00");
    expect(kpi("Saldo pendiente")).toHaveTextContent("USD 600.00");
    expect(screen.getByText(NOTA)).toBeInTheDocument();
  });

  it("la anulada sigue en la lista, con el monto tachado y sin «Saldo»", async () => {
    h.facturas = [VIVA, ANULADA_CON_PAGO];
    await abrir();
    const filas = screen.getAllByRole("link", { name: "Ver detalle de la factura F-ANULADA-2" });
    // Una card móvil y una fila de la tabla: las dos muestran la anulada.
    expect(filas).toHaveLength(2);
    for (const fila of filas) {
      expect(within(fila).getByText("USD 500.00")).toHaveClass("line-through");
      expect(within(fila).queryByText("Saldo")).toBeNull();
    }
    const viva = screen.getAllByRole("link", { name: "Ver detalle de la factura F-VIVA" });
    expect(within(viva[1]).getByText("USD 1,000.00")).not.toHaveClass("line-through");
  });

  it("con ?saldo=1 las anuladas no salen «por pagar» y el aviso dice cuántas sin saldo se ocultan", async () => {
    h.facturas = [VIVA, ANULADA_SIN_PAGO, ANULADA_CON_PAGO];
    await abrir({ saldo: "1" });
    expect(screen.queryAllByRole("link", { name: /F-ANULADA/ })).toEqual([]);
    expect(screen.getAllByRole("link", { name: "Ver detalle de la factura F-VIVA" }).length).toBeGreaterThan(0);
    expect(screen.getByText(/2 facturas sin saldo ocultas/)).toBeInTheDocument();
    // Los KPIs siguen midiendo todo.
    expect(kpi("Saldo pendiente")).toHaveTextContent("USD 600.00");
  });

  it("con ?saldo=1 y nada por pagar: «No tienes facturas por pagar», con KPIs y nota a la vista", async () => {
    h.facturas = [PAGADA, ANULADA_CON_PAGO];
    await abrir({ saldo: "1" });
    expect(screen.getByText("No tienes facturas por pagar.")).toBeInTheDocument();
    expect(screen.queryByText("Todavía no tienes facturas.")).toBeNull();
    expect(screen.getByText(/2 facturas sin saldo ocultas/)).toBeInTheDocument();
    expect(kpi("Saldo pendiente")).toHaveTextContent("USD 0.00");
    expect(screen.getByText(NOTA)).toBeInTheDocument();
  });

  it("sin anuladas no aparece la nota", async () => {
    h.facturas = [VIVA, PAGADA];
    await abrir();
    expect(screen.queryByText(/facturas que después se anularon/)).toBeNull();
  });

  it("en el estado de cuenta la nota sale una sola vez, bajo el libro", async () => {
    h.facturas = [VIVA, ANULADA_CON_PAGO];
    await abrir({ vista: "cuenta" });
    expect(screen.getAllByText(NOTA)).toHaveLength(1);
    expect(screen.getByText("Factura F-ANULADA-2 · anulada")).toBeInTheDocument();
  });
});

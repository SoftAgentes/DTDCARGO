/**
 * SDD-0497 · criterio 7 — las cuatro pantallas MUESTRAN el motivo.
 *
 * Las otras seis suites prueban que las nueve acciones **devuelven** la
 * denegación. Eso no basta, y la distinción es justo la forma de fallo que esta
 * tarea vino a cerrar: un motivo que la acción devuelve y la pantalla tira a la
 * basura deja al usuario viendo el genérico —o peor, una lista vacía
 * indistinguible de «no hay nada»—, que es exactamente el síntoma original.
 *
 * Acá se renderiza cada componente de verdad, con la action devolviendo la
 * denegación, y se mira si el texto llega al DOM.
 *
 * Los cuatro casos cubren huecos distintos:
 *   · Tracking      · el modal decía «Eliminando…» y redirigía: había que ver el motivo.
 *   · Cobranzas     · el historial vacío parecía «esta factura no tiene cobros».
 *   · CRM           · «sin resultados» parecía una búsqueda que no encontró nada.
 *   · Rutas         · `seedState.error` no se renderizaba en NINGÚN lado: botón mudo.
 */

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const DENIAL_VISTA = "No tienes permiso para ver esto.";
const DENIAL_EDICION = "No tienes permiso para realizar esta acción.";

const mocks = vi.hoisted(() => ({
  deleteShipment: vi.fn(),
  cancelShipment: vi.fn(),
  getReceivableHistory: vi.fn(),
  searchKommoContactsAction: vi.fn(),
  convertLeadToClientAction: vi.fn(),
  seedTenantCitiesFromVeCatalogAction: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: mocks.replace, refresh: mocks.refresh }),
  usePathname: () => "/studio/admin/rutas",
  useSearchParams: () => new URLSearchParams("tab=cities"),
}));

vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({
  useToast: () => ({
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("@/app/studio/(app)/tracking/[id]/actions", () => ({
  deleteShipment: (...a: unknown[]) => mocks.deleteShipment(...a),
  cancelShipment: (...a: unknown[]) => mocks.cancelShipment(...a),
}));

vi.mock("@/app/studio/(app)/cobranzas/actions", () => ({
  getReceivableHistory: (...a: unknown[]) => mocks.getReceivableHistory(...a),
  // SDD-0630: el aviso de reportes del portal sin revisar; aquí, sin pendientes.
  getPendingPaymentReports: async () => ({ pending: { count: 0, amount: 0 } }),
  logActivity: vi.fn(),
  registerCollection: vi.fn(),
  voidReceipt: vi.fn(),
}));

vi.mock("@/app/studio/(app)/crm/actions", () => ({
  searchKommoContactsAction: (...a: unknown[]) => mocks.searchKommoContactsAction(...a),
  convertLeadToClientAction: (...a: unknown[]) => mocks.convertLeadToClientAction(...a),
}));

vi.mock("@/app/studio/(app)/admin/rutas/actions", () => ({
  seedTenantCitiesFromVeCatalogAction: (...a: unknown[]) =>
    mocks.seedTenantCitiesFromVeCatalogAction(...a),
  createRouteAction: vi.fn(),
  updateRouteAction: vi.fn(),
  softDeleteRouteAction: vi.fn(),
  toggleRouteActiveAction: vi.fn(),
  createCityAction: vi.fn(),
  updateCityAction: vi.fn(),
  softDeleteCityAction: vi.fn(),
}));

const { FooterActions } = await import(
  "@/app/studio/(app)/tracking/[id]/_components/FooterActions"
);
const { CobranzaDrawer } = await import(
  "@/app/studio/(app)/cobranzas/_components/CobranzaDrawer"
);
const { ConvertLeadDrawer } = await import(
  "@/app/studio/(app)/crm/_components/ConvertLeadDrawer"
);
const { RoutesClient } = await import(
  "@/app/studio/(app)/admin/rutas/_components/RoutesClient"
);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getReceivableHistory.mockResolvedValue({ receipts: [], activities: [] });
  mocks.searchKommoContactsAction.mockResolvedValue({ contacts: [] });
  mocks.seedTenantCitiesFromVeCatalogAction.mockResolvedValue({ ok: true });
});

afterEach(cleanup);

// ── Tracking · el modal de borrado ────────────────────────────
describe("Tracking · modal de eliminar envío", () => {
  const SHIPMENT = { shipmentId: "shp-1", shipmentCode: "S-2026-0042" };

  async function abrirModalYConfirmar() {
    const user = userEvent.setup();
    // SDD-0522: el botón sólo existe para quien puede eliminar (admin).
    render(<FooterActions {...SHIPMENT} status="in_transit" canDelete />);
    await user.click(screen.getByRole("button", { name: "Eliminar envío" }));

    const dialogo = screen.getByRole("dialog");
    // SDD-0522: motivo obligatorio, y además la doble confirmación estilo
    // GitHub: hay que tipear el código exacto.
    await user.type(within(dialogo).getByLabelText(/motivo/i), "Embarque de prueba");
    await user.type(
      within(dialogo).getByLabelText(/escribe el código del envío/i),
      SHIPMENT.shipmentCode,
    );
    await user.click(
      within(dialogo).getByRole("button", { name: "Confirmar eliminación" }),
    );
    return dialogo;
  }

  it("muestra la denegación en vez de dejar al operador creyendo que borró", async () => {
    mocks.deleteShipment.mockResolvedValue({ error: DENIAL_EDICION });

    const dialogo = await abrirModalYConfirmar();

    await waitFor(() =>
      expect(within(dialogo).getByText(DENIAL_EDICION)).toBeInTheDocument(),
    );
    // El modal sigue abierto: nada se borró, así que no hay a dónde ir.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("muestra también el fallo del UPDATE, que antes se tragaba un console.error", async () => {
    mocks.deleteShipment.mockResolvedValue({
      error: "No pudimos eliminar el envío. Intenta de nuevo.",
    });

    const dialogo = await abrirModalYConfirmar();

    await waitFor(() =>
      expect(
        within(dialogo).getByText("No pudimos eliminar el envío. Intenta de nuevo."),
      ).toBeInTheDocument(),
    );
  });

  it("cuando borra de verdad no inventa ningún error", async () => {
    /**
     * El camino feliz redirige, y `redirect()` de Next **lanza**: la action no
     * devuelve nunca. Se modela con una promesa que se controla desde acá.
     *
     * ⚠️ La primera versión de este caso usaba `new Promise(() => {})` —una que
     * no resuelve jamás— y el precio lo pagaba OTRO bloque: la transición de
     * React quedaba abierta para siempre y los dos casos de «Admin · Rutas»,
     * 150 líneas más abajo, fallaban porque su `useActionState` no llegaba a
     * pintar. En aislamiento pasaban los tres. Un rojo lejos de su causa.
     *
     * Por eso el `finally` la cierra: un fixture que deja trabajo colgando no
     * es un fixture, es una fuga.
     */
    let cerrarLaTransicion!: () => void;
    mocks.deleteShipment.mockReturnValue(
      new Promise<never>((_, reject) => {
        cerrarLaTransicion = () =>
          reject(Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT" }));
      }),
    );

    try {
      const dialogo = await abrirModalYConfirmar();

      expect(within(dialogo).queryByText(DENIAL_EDICION)).not.toBeInTheDocument();
      expect(
        within(dialogo).queryByText(/no pudimos eliminar/i),
      ).not.toBeInTheDocument();
    } finally {
      cerrarLaTransicion();
    }
  });
});

// ── Cobranzas · el drawer de la factura ───────────────────────
describe("Cobranzas · drawer de la cuenta por cobrar", () => {
  function receivable() {
    return {
      invoice: {
        id: "inv-1",
        tenant_id: "t1",
        invoice_code: "F-2026-0001",
        client_markbox: "DTD-0042",
        client_name: "María Salazar",
        client_rif: null,
        client_doc_kind: null,
        shipment_id: null,
        shipment_code: null,
        currency: "USD",
        fx_rate: null,
        iva_rate: 0,
        iva_mode: null,
        base_amount: 1000,
        iva_amount: 0,
        total_amount: 1000,
        status: "sent",
        issued_at: "2026-09-01",
        due_date: "2026-09-15",
        paid_amount: 0,
        last_payment_at: null,
        lines: [],
        notes: null,
        created_at: "2026-09-01T00:00:00Z",
        updated_at: "2026-09-01T00:00:00Z",
        deleted_at: null,
      },
      balance: 1000,
      balanceUsd: 1000,
      daysOverdue: 5,
      stage: "vencido",
      lastActivity: null,
      promiseDate: null,
    } as unknown as Parameters<typeof CobranzaDrawer>[0]["receivable"];
  }

  it("muestra la denegación en vez de un historial vacío", async () => {
    mocks.getReceivableHistory.mockResolvedValue({
      receipts: [],
      activities: [],
      error: DENIAL_VISTA,
    });

    render(
      <CobranzaDrawer
        receivable={receivable()}
        cashAccounts={[]}
        onClose={() => {}}
      />,
    );

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(DENIAL_VISTA),
    );
  });

  it("una factura sin cobros NO pinta un error: el vacío legítimo se distingue", async () => {
    mocks.getReceivableHistory.mockResolvedValue({ receipts: [], activities: [] });

    render(
      <CobranzaDrawer
        receivable={receivable()}
        cashAccounts={[]}
        onClose={() => {}}
      />,
    );

    await waitFor(() => expect(mocks.getReceivableHistory).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

// ── CRM · el drawer de conversión ─────────────────────────────
describe("CRM · drawer de convertir lead", () => {
  const LEAD = { id: 4242, name: "Lead de prueba" };

  it("muestra la denegación en vez de «sin resultados»", async () => {
    mocks.searchKommoContactsAction.mockResolvedValue({
      contacts: [],
      error: DENIAL_VISTA,
    });

    render(
      <ConvertLeadDrawer lead={LEAD} onClose={() => {}} onConverted={() => {}} />,
    );

    await waitFor(() =>
      expect(screen.getByText(DENIAL_VISTA)).toBeInTheDocument(),
    );
  });

  it("una búsqueda que no encontró nada NO pinta un error", async () => {
    mocks.searchKommoContactsAction.mockResolvedValue({ contacts: [] });

    render(
      <ConvertLeadDrawer lead={LEAD} onClose={() => {}} onConverted={() => {}} />,
    );

    await waitFor(() => expect(mocks.searchKommoContactsAction).toHaveBeenCalled());
    expect(screen.queryByText(DENIAL_VISTA)).not.toBeInTheDocument();
  });
});

// ── Admin · Rutas · el seed del catálogo ──────────────────────
describe("Admin · Rutas · seed del catálogo VE", () => {
  function pintarCatalogoVacio() {
    render(
      <RoutesClient routes={[]} cities={[]} citiesCount={0} veCatalog={[]} />,
    );
  }

  it("el botón deja de ser mudo: la denegación se ve", async () => {
    const user = userEvent.setup();
    mocks.seedTenantCitiesFromVeCatalogAction.mockResolvedValue({
      error: DENIAL_EDICION,
    });

    pintarCatalogoVacio();
    await user.click(
      screen.getByRole("button", { name: "Seedear desde catálogo VE" }),
    );

    await waitFor(() =>
      expect(mocks.seedTenantCitiesFromVeCatalogAction).toHaveBeenCalled(),
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(DENIAL_EDICION),
    );
  });

  it("un seed exitoso no pinta la alerta de error", async () => {
    const user = userEvent.setup();
    mocks.seedTenantCitiesFromVeCatalogAction.mockResolvedValue({
      ok: true,
      createdCode: "98 ciudades agregadas",
    });

    pintarCatalogoVacio();
    await user.click(
      screen.getByRole("button", { name: "Seedear desde catálogo VE" }),
    );

    await waitFor(() =>
      expect(mocks.seedTenantCitiesFromVeCatalogAction).toHaveBeenCalled(),
    );
    await waitFor(() =>
      expect(screen.getByText("98 ciudades agregadas")).toBeInTheDocument(),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

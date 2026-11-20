/**
 * SDD-0674 · EXC-0674 — render de «Facturar» en Embarques.
 *  - Solo aparece en un contenedor de la lista y solo si la página pasó `facturacion`.
 *  - Por cliente y contenedor completo: dos confirmaciones seguidas. La primera, «¿Estás seguro de
 *    los datos?», con el monto grande, cajas y CBM; la segunda los vuelve a mostrar con el aviso de
 *    que va al portal del cliente y a contabilidad. Nada se emite hasta «Confirmado».
 *  - Un monto inválido no abre la confirmación. Un cliente ya facturado muestra su factura.
 * Datos inventados.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ShipmentListRow } from "@/lib/studio/shipment-queries";
import type { ContenedoresDeEmbarques } from "@/lib/studio/embarques-contenedores";
import type { FacturacionExc0674 } from "@/lib/studio/exc0674";

const mocks = vi.hoisted(() => ({
  accion: vi.fn(),
  show: vi.fn(),
}));

vi.mock("../ShipmentDetailDrawer", () => ({ ShipmentDetailDrawer: () => null }));
vi.mock("../../facturar-actions", () => ({
  facturarExc0674Action: (...a: unknown[]) => mocks.accion(...a),
}));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({
  useToast: () => ({ show: mocks.show, success: vi.fn(), info: vi.fn(), error: vi.fn(), warning: vi.fn(), dismiss: vi.fn() }),
}));

const { EmbarquesClient } = await import("../EmbarquesClient");

function envio(id: string, over: Partial<ShipmentListRow> = {}): ShipmentListRow {
  return {
    id,
    code: `S-${id}`,
    client_name: "Cliente Uno",
    client_markbox: "DTD-1001",
    origin: "Yiwu",
    destination: "La Guaira",
    shipment_service: "puerta_a_puerta_DDP",
    status: "in_transit",
    weight_kg: null,
    volume_m3: 1,
    created_at: "2026-10-02T10:00:00Z",
    ...over,
  };
}

const ENVIOS = [
  envio("a1"),
  envio("a2", { volume_m3: 2 }),
  envio("b1", { client_name: "Cliente Dos", client_markbox: "DTD-1002" }),
  envio("z1", { client_name: "Cliente Tres", client_markbox: "DTD-1003" }),
];

const DATOS: ContenedoresDeEmbarques = {
  contenedores: [
    { id: "c64", ref: "DTD-CONSOL-0002", containerNo: null, numeroDtd: 64, status: "zarpado", naviera: null, eta: null, createdAt: "2026-09-29T00:00:00Z" },
    { id: "c65", ref: "DTD-CONSOL-0003", containerNo: null, numeroDtd: 65, status: "consolidando", naviera: null, eta: null, createdAt: "2026-11-10T00:00:00Z" },
  ],
  porEmbarque: { a1: "c64", a2: "c64", b1: "c64", z1: "c65" },
  cajasPorEmbarque: { a1: 10, a2: 5, b1: 3, z1: 8 },
};

const FACTURACION: FacturacionExc0674 = { estado: "lista", contenedores: ["c64"], facturados: {} };

afterEach(cleanup);
beforeEach(() => {
  mocks.accion.mockReset();
  mocks.show.mockReset();
  mocks.accion.mockResolvedValue({ ok: true, facturas: [{ clientMarkbox: "DTD-1001", invoiceCode: "F-TEST-1", totalUsd: 1234.56 }] });
});

function region(nombre: string): HTMLElement {
  return screen.getByRole("region", { name: nombre });
}

async function abrir(nombre: string) {
  await userEvent.click(within(region(nombre)).getAllByRole("button")[0]);
}

describe("EmbarquesClient · Facturar (EXC-0674)", () => {
  it("sin la prop (commercial, warehouse, support) no hay «Facturar»", async () => {
    render(<EmbarquesClient pestanaInicial="all" shipments={ENVIOS} adjuntos={undefined} contenedores={DATOS} />);
    await abrir("DDP 64");
    expect(screen.queryByRole("button", { name: "Facturar" })).toBeNull();
    expect(screen.queryByText(/Total con IVA/)).toBeNull();
  });

  it("solo en el contenedor de la lista; no en el 65", async () => {
    render(<EmbarquesClient pestanaInicial="all" shipments={ENVIOS} adjuntos={undefined} contenedores={DATOS} facturacion={FACTURACION} />);
    await abrir("DDP 64");
    await abrir("DDP 65");
    expect(within(region("DDP 64")).getAllByRole("button", { name: "Facturar" })).toHaveLength(2);
    expect(within(region("DDP 65")).queryByRole("button", { name: "Facturar" })).toBeNull();
  });

  it("con no_disponible (sin la 0564) no hay «Facturar»", async () => {
    render(
      <EmbarquesClient pestanaInicial="all" shipments={ENVIOS} adjuntos={undefined} contenedores={DATOS} facturacion={{ estado: "no_disponible" }} />,
    );
    await abrir("DDP 64");
    expect(screen.queryByRole("button", { name: "Facturar" })).toBeNull();
  });

  it("por cliente: dos confirmaciones con los datos; nada se emite antes de «Confirmado»", async () => {
    render(<EmbarquesClient pestanaInicial="all" shipments={ENVIOS} adjuntos={undefined} contenedores={DATOS} facturacion={FACTURACION} />);
    await abrir("DDP 64");
    await userEvent.type(screen.getByLabelText(/Total con IVA de Cliente Uno/), "1.234,56");
    await userEvent.click(within(region("DDP 64")).getAllByRole("button", { name: "Facturar" })[0]);

    let dialogo = screen.getByRole("dialog");
    expect(within(dialogo).getByRole("heading").textContent).toBe("¿Estás seguro de los datos?");
    expect(within(dialogo).getByTestId("monto-grande").textContent).toBe("$1,234.56");
    expect(dialogo.textContent).toContain("2 envíos · 15 cajas · 3.00 m³");
    expect(within(dialogo).queryByRole("button", { name: "Confirmado" })).toBeNull();

    await userEvent.click(within(dialogo).getByRole("button", { name: "Sí, los datos están bien" }));
    dialogo = screen.getByRole("dialog");
    expect(within(dialogo).getByRole("heading").textContent).toBe("Confirma la factura");
    expect(within(dialogo).getByTestId("monto-grande").textContent).toBe("$1,234.56");
    expect(dialogo.textContent).toContain("2 envíos · 15 cajas · 3.00 m³");
    expect(dialogo.textContent).toContain("Va al portal del cliente y a la contabilidad");
    expect(mocks.accion).not.toHaveBeenCalled();

    await userEvent.click(within(dialogo).getByRole("button", { name: "Confirmado" }));
    expect(mocks.accion).toHaveBeenCalledWith("c64", [{ clientMarkbox: "DTD-1001", total: "1234.56" }], "Confirmado");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mocks.show).toHaveBeenCalledWith(expect.objectContaining({ tone: "success", message: "Factura F-TEST-1 emitida." }));
  });

  it("«Volver» cierra sin emitir", async () => {
    render(<EmbarquesClient pestanaInicial="all" shipments={ENVIOS} adjuntos={undefined} contenedores={DATOS} facturacion={FACTURACION} />);
    await abrir("DDP 64");
    await userEvent.type(screen.getByLabelText(/Total con IVA de Cliente Uno/), "100");
    await userEvent.click(within(region("DDP 64")).getAllByRole("button", { name: "Facturar" })[0]);
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Volver" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mocks.accion).not.toHaveBeenCalled();
  });

  it("un monto inválido no abre la confirmación y dice por qué", async () => {
    render(<EmbarquesClient pestanaInicial="all" shipments={ENVIOS} adjuntos={undefined} contenedores={DATOS} facturacion={FACTURACION} />);
    await abrir("DDP 64");
    await userEvent.type(screen.getByLabelText(/Total con IVA de Cliente Uno/), "0");
    await userEvent.click(within(region("DDP 64")).getAllByRole("button", { name: "Facturar" })[0]);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("mayor que 0");
  });

  it("contenedor completo: dos confirmaciones seguidas y el total del contenedor", async () => {
    mocks.accion.mockResolvedValue({
      ok: true,
      facturas: [
        { clientMarkbox: "DTD-1001", invoiceCode: "F-TEST-1", totalUsd: 100 },
        { clientMarkbox: "DTD-1002", invoiceCode: "F-TEST-2", totalUsd: 50.5 },
      ],
    });
    render(<EmbarquesClient pestanaInicial="all" shipments={ENVIOS} adjuntos={undefined} contenedores={DATOS} facturacion={FACTURACION} />);
    await abrir("DDP 64");
    await userEvent.type(screen.getByLabelText(/Total con IVA de Cliente Uno/), "100");
    await userEvent.type(screen.getByLabelText(/Total con IVA de Cliente Dos/), "50,5");
    await userEvent.click(screen.getByRole("button", { name: "Facturar contenedor (2 clientes)" }));

    let dialogo = screen.getByRole("dialog");
    expect(within(dialogo).getByRole("heading").textContent).toBe("¿Estás seguro de los datos?");
    expect(dialogo.textContent).toContain("$150.50");
    expect(dialogo.textContent).not.toContain("Va al portal del cliente");
    expect(within(dialogo).queryByRole("button", { name: "Confirmado" })).toBeNull();

    await userEvent.click(within(dialogo).getByRole("button", { name: "Sí, los datos están bien" }));
    dialogo = screen.getByRole("dialog");
    expect(within(dialogo).getByRole("heading").textContent).toBe("Confirma las 2 facturas");
    expect(dialogo.textContent).toContain("Va al portal del cliente y a la contabilidad");
    expect(mocks.accion).not.toHaveBeenCalled();

    await userEvent.click(within(dialogo).getByRole("button", { name: "Confirmado" }));
    expect(mocks.accion).toHaveBeenCalledWith(
      "c64",
      [
        { clientMarkbox: "DTD-1001", total: "100.00" },
        { clientMarkbox: "DTD-1002", total: "50.50" },
      ],
      "Confirmado",
    );
  });

  it("si la base rechaza, el error queda en la confirmación", async () => {
    mocks.accion.mockResolvedValue({ ok: false, error: "Ese cliente ya está facturado en este contenedor (DTD-1001)." });
    render(<EmbarquesClient pestanaInicial="all" shipments={ENVIOS} adjuntos={undefined} contenedores={DATOS} facturacion={FACTURACION} />);
    await abrir("DDP 64");
    await userEvent.type(screen.getByLabelText(/Total con IVA de Cliente Uno/), "100");
    await userEvent.click(within(region("DDP 64")).getAllByRole("button", { name: "Facturar" })[0]);
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Sí, los datos están bien" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirmado" }));
    expect(screen.getByRole("dialog").textContent).toContain("ya está facturado");
  });

  it("un cliente ya facturado muestra su factura y no ofrece «Facturar»", async () => {
    render(
      <EmbarquesClient pestanaInicial="all"
        shipments={ENVIOS}
        adjuntos={undefined}
        contenedores={DATOS}
        facturacion={{
          estado: "lista",
          contenedores: ["c64"],
          facturados: { c64: { "DTD-1001": { invoiceCode: "F-TEST-9", totalUsd: 406, billedMarkbox: "AR" } } },
        }}
      />,
    );
    await abrir("DDP 64");
    expect(within(region("DDP 64")).getByText(/Facturada F-TEST-9 · \$406\.00 · a AR/)).toBeTruthy();
    expect(within(region("DDP 64")).getAllByRole("button", { name: "Facturar" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Facturar contenedor/ })).toBeNull();
  });
});

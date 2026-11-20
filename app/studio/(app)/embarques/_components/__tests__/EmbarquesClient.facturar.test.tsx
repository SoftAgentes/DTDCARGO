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
import type {
  ContenedoresDeEmbarques,
  MontoAcumulado,
  MontosDeContenedores,
} from "@/lib/studio/embarques-contenedores";
import type { FacturacionExc0674 } from "@/lib/studio/exc0674";

const mocks = vi.hoisted(() => ({
  accion: vi.fn(),
  accionPreordenes: vi.fn(),
  show: vi.fn(),
}));

vi.mock("../ShipmentDetailDrawer", () => ({ ShipmentDetailDrawer: () => null }));
vi.mock("../../facturar-actions", () => ({
  facturarExc0674Action: (...a: unknown[]) => mocks.accion(...a),
  emitirPreordenesExc0674Action: (...a: unknown[]) => mocks.accionPreordenes(...a),
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
  mocks.accionPreordenes.mockReset();
  mocks.show.mockReset();
  mocks.accionPreordenes.mockResolvedValue({
    ok: true,
    facturas: [{ clientMarkbox: "DTD-1001", invoiceCode: "F-PO-1", totalUsd: 150.25 }],
  });
  mocks.accion.mockResolvedValue({ ok: true, facturas: [{ clientMarkbox: "DTD-1001", invoiceCode: "F-TEST-1", totalUsd: 1234.56 }] });
});

function region(nombre: string): HTMLElement {
  return screen.getByRole("region", { name: nombre });
}

/** Abre el contenedor si está cerrado (con una búsqueda la vista ya lo abre sola). */
async function abrir(nombre: string) {
  const cabecera = within(region(nombre)).getAllByRole("button")[0];
  if (cabecera.getAttribute("aria-expanded") !== "true") await userEvent.click(cabecera);
}

describe("EmbarquesClient · Facturar (EXC-0674)", () => {
  it("sin la prop (commercial, warehouse, support) no hay «Facturar»", async () => {
    render(<EmbarquesClient shipments={ENVIOS} adjuntos={undefined} contenedores={DATOS} />);
    await abrir("DDP 64");
    expect(screen.queryByRole("button", { name: "Facturar" })).toBeNull();
    expect(screen.queryByText(/Total con IVA/)).toBeNull();
  });

  it("solo en el contenedor de la lista; no en el 65", async () => {
    render(<EmbarquesClient shipments={ENVIOS} adjuntos={undefined} contenedores={DATOS} facturacion={FACTURACION} />);
    await abrir("DDP 64");
    await abrir("DDP 65");
    expect(within(region("DDP 64")).getAllByRole("button", { name: "Facturar" })).toHaveLength(2);
    expect(within(region("DDP 65")).queryByRole("button", { name: "Facturar" })).toBeNull();
  });

  it("con no_disponible (sin la 0564) no hay «Facturar»", async () => {
    render(
      <EmbarquesClient shipments={ENVIOS} adjuntos={undefined} contenedores={DATOS} facturacion={{ estado: "no_disponible" }} />,
    );
    await abrir("DDP 64");
    expect(screen.queryByRole("button", { name: "Facturar" })).toBeNull();
  });

  it("por cliente: dos confirmaciones con los datos; nada se emite antes de «Confirmado»", async () => {
    render(<EmbarquesClient shipments={ENVIOS} adjuntos={undefined} contenedores={DATOS} facturacion={FACTURACION} />);
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
    render(<EmbarquesClient shipments={ENVIOS} adjuntos={undefined} contenedores={DATOS} facturacion={FACTURACION} />);
    await abrir("DDP 64");
    await userEvent.type(screen.getByLabelText(/Total con IVA de Cliente Uno/), "100");
    await userEvent.click(within(region("DDP 64")).getAllByRole("button", { name: "Facturar" })[0]);
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Volver" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mocks.accion).not.toHaveBeenCalled();
  });

  it("un monto inválido no abre la confirmación y dice por qué", async () => {
    render(<EmbarquesClient shipments={ENVIOS} adjuntos={undefined} contenedores={DATOS} facturacion={FACTURACION} />);
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
    render(<EmbarquesClient shipments={ENVIOS} adjuntos={undefined} contenedores={DATOS} facturacion={FACTURACION} />);
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
    render(<EmbarquesClient shipments={ENVIOS} adjuntos={undefined} contenedores={DATOS} facturacion={FACTURACION} />);
    await abrir("DDP 64");
    await userEvent.type(screen.getByLabelText(/Total con IVA de Cliente Uno/), "100");
    await userEvent.click(within(region("DDP 64")).getAllByRole("button", { name: "Facturar" })[0]);
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Sí, los datos están bien" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirmado" }));
    expect(screen.getByRole("dialog").textContent).toContain("ya está facturado");
  });

  it("un cliente ya facturado muestra su factura y no ofrece «Facturar»", async () => {
    render(
      <EmbarquesClient
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
    expect(region("DDP 64").textContent).toMatch(/Facturada F-TEST-9 · \$406\.00 · a AR/);
    // SDD-0690: el código de la factura lleva a Facturación.
    const enlace = within(region("DDP 64")).getByRole("link", { name: "F-TEST-9" });
    expect(enlace.getAttribute("href")).toBe("/studio/facturacion/F-TEST-9");
    expect(within(region("DDP 64")).getAllByRole("button", { name: "Facturar" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Facturar contenedor/ })).toBeNull();
  });
});

/** Un monto con un documento (factura emitida o pre-orden), en USD. */
function conDocumento(
  invoiceId: string,
  invoiceCode: string,
  totalUsd: number,
  preorden: boolean,
  pagadoUsd = 0,
): MontoAcumulado {
  return {
    facturas: 1,
    totalUsd,
    pagadoUsd,
    otraMoneda: 0,
    borradores: preorden ? 1 : 0,
    sinFacturarUsd: preorden ? totalUsd : 0,
    documentos: [{ invoiceId, invoiceCode, preorden, totalUsd }],
  };
}

describe("EmbarquesClient · Facturar emite la pre-orden (SDD-0690)", () => {
  // Cliente Uno tiene pre-orden (precio del Excel); Cliente Dos no tiene precio: se teclea.
  const MONTOS_PO: MontosDeContenedores = {
    estado: "lista",
    porEmbarque: { a1: conDocumento("i1", "F-PO-1", 150.25, true) },
  };

  it("con pre-orden no se teclea: se ve su total con el enlace y «Facturar»; sin precio, el campo de siempre", async () => {
    render(
      <EmbarquesClient
        shipments={ENVIOS}
        adjuntos={undefined}
        contenedores={DATOS}
        facturacion={FACTURACION}
        montos={MONTOS_PO}
      />,
    );
    await abrir("DDP 64");
    expect(screen.queryByLabelText(/Total con IVA de Cliente Uno/)).toBeNull();
    expect(screen.getByLabelText(/Total con IVA de Cliente Dos/)).toBeTruthy();
    const seccion = within(region("DDP 64")).getByRole("region", { name: "Facturar DDP 64" });
    const enlace = within(seccion).getByRole("link", { name: "$150.25" });
    expect(enlace.getAttribute("href")).toBe("/studio/facturacion/F-PO-1");
    expect(seccion.textContent).toContain("Pre-orden F-PO-1");
    expect(within(seccion).getByRole("button", { name: "Facturar todo (1 pre-orden)" })).toBeTruthy();
    expect(within(seccion).queryByRole("button", { name: /Facturar contenedor/ })).toBeNull();
    // En pantalla se dice «pre-orden», nunca «borrador».
    expect(region("DDP 64").textContent ?? "").not.toMatch(/borrador/i);
  });

  it("«Facturar» en la pre-orden: dos confirmaciones y emite por id, sin montos tecleados", async () => {
    render(
      <EmbarquesClient
        shipments={ENVIOS}
        adjuntos={undefined}
        contenedores={DATOS}
        facturacion={FACTURACION}
        montos={MONTOS_PO}
      />,
    );
    await abrir("DDP 64");
    const seccion = within(region("DDP 64")).getByRole("region", { name: "Facturar DDP 64" });
    await userEvent.click(within(seccion).getAllByRole("button", { name: "Facturar" })[0]);
    let dialogo = screen.getByRole("dialog");
    expect(within(dialogo).getByTestId("monto-grande").textContent).toBe("$150.25");
    expect(dialogo.textContent).toContain("Se emite la pre-orden tal como está");
    await userEvent.click(within(dialogo).getByRole("button", { name: "Sí, los datos están bien" }));
    dialogo = screen.getByRole("dialog");
    expect(dialogo.textContent).toContain("La pre-orden pasa a factura");
    expect(mocks.accionPreordenes).not.toHaveBeenCalled();
    await userEvent.click(within(dialogo).getByRole("button", { name: "Confirmado" }));
    expect(mocks.accionPreordenes).toHaveBeenCalledWith("c64", ["i1"], "Confirmado");
    expect(mocks.accion).not.toHaveBeenCalled();
    expect(mocks.show).toHaveBeenCalledWith(expect.objectContaining({ message: "Factura F-PO-1 emitida." }));
  });

  it("«Facturar todo» emite todas las pre-órdenes pendientes en una sola llamada", async () => {
    mocks.accionPreordenes.mockResolvedValue({
      ok: true,
      facturas: [
        { clientMarkbox: "DTD-1001", invoiceCode: "F-PO-1", totalUsd: 150.25 },
        { clientMarkbox: "DTD-1002", invoiceCode: "F-PO-2", totalUsd: 20 },
      ],
    });
    render(
      <EmbarquesClient
        shipments={ENVIOS}
        adjuntos={undefined}
        contenedores={DATOS}
        facturacion={FACTURACION}
        montos={{
          estado: "lista",
          porEmbarque: {
            a1: conDocumento("i1", "F-PO-1", 150.25, true),
            b1: conDocumento("i2", "F-PO-2", 20, true),
          },
        }}
      />,
    );
    await abrir("DDP 64");
    await userEvent.click(screen.getByRole("button", { name: "Facturar todo (2 pre-órdenes)" }));
    let dialogo = screen.getByRole("dialog");
    expect(dialogo.textContent).toContain("$170.25");
    await userEvent.click(within(dialogo).getByRole("button", { name: "Sí, los datos están bien" }));
    dialogo = screen.getByRole("dialog");
    expect(dialogo.textContent).toContain("Las 2 pre-órdenes pasan a factura");
    await userEvent.click(within(dialogo).getByRole("button", { name: "Confirmado" }));
    expect(mocks.accionPreordenes).toHaveBeenCalledTimes(1);
    expect(mocks.accionPreordenes).toHaveBeenCalledWith("c64", ["i1", "i2"], "Confirmado");
  });

  it("con todos los clientes facturados dice «Facturado» y no ofrece ningún botón", async () => {
    render(
      <EmbarquesClient
        shipments={ENVIOS}
        adjuntos={undefined}
        contenedores={DATOS}
        facturacion={{
          estado: "lista",
          contenedores: ["c64"],
          facturados: {
            c64: {
              "DTD-1001": { invoiceCode: "F-1", totalUsd: 10, billedMarkbox: "DTD-1001" },
              "DTD-1002": { invoiceCode: "F-2", totalUsd: 20, billedMarkbox: "DTD-1002" },
            },
          },
        }}
      />,
    );
    await abrir("DDP 64");
    const seccion = within(region("DDP 64")).getByRole("region", { name: "Facturar DDP 64" });
    expect(within(seccion).getByTestId("contenedor-facturado").textContent).toBe("Facturado");
    expect(within(seccion).queryAllByRole("button")).toHaveLength(0);
  });

  it("con un filtro que deja fuera el envío de la pre-orden no se ofrece teclear: cubre el contenedor entero", async () => {
    // La pre-orden de Cliente Uno cuelga de a1; la búsqueda deja solo a2 (también de Cliente Uno).
    render(
      <EmbarquesClient
        shipments={ENVIOS}
        adjuntos={undefined}
        contenedores={DATOS}
        facturacion={FACTURACION}
        montos={MONTOS_PO}
      />,
    );
    await userEvent.type(screen.getByLabelText("Buscar"), "S-a2");
    await abrir("DDP 64");
    const seccion = within(region("DDP 64")).getByRole("region", { name: "Facturar DDP 64" });
    expect(within(seccion).queryByLabelText(/Total con IVA de Cliente Uno/)).toBeNull();
    expect(within(seccion).getByRole("link", { name: "$150.25" }).getAttribute("href")).toBe("/studio/facturacion/F-PO-1");
    // Cliente Dos quedó fuera del filtro, pero es del contenedor: sigue en «Facturar».
    expect(within(seccion).getByLabelText(/Total con IVA de Cliente Dos/)).toBeTruthy();
    await userEvent.click(within(seccion).getByRole("button", { name: "Facturar todo (1 pre-orden)" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Sí, los datos están bien" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirmado" }));
    expect(mocks.accionPreordenes).toHaveBeenCalledWith("c64", ["i1"], "Confirmado");
    expect(mocks.accion).not.toHaveBeenCalled();
  });

  it("con un filtro puesto, «Facturado» sigue cubriendo el contenedor entero", async () => {
    const facturados = {
      c64: {
        "DTD-1001": { invoiceCode: "F-1", totalUsd: 10, billedMarkbox: "DTD-1001" },
        "DTD-1002": { invoiceCode: "F-2", totalUsd: 20, billedMarkbox: "DTD-1002" },
      },
    };
    const soloUno = { estado: "lista" as const, contenedores: ["c64"], facturados: { c64: { "DTD-1001": facturados.c64["DTD-1001"] } } };
    // Con solo Cliente Uno facturado y el filtro dejando solo a Cliente Uno, NO dice «Facturado».
    const { unmount } = render(
      <EmbarquesClient shipments={ENVIOS} adjuntos={undefined} contenedores={DATOS} facturacion={soloUno} />,
    );
    await userEvent.type(screen.getByLabelText("Buscar"), "S-a1");
    await abrir("DDP 64");
    let seccion = within(region("DDP 64")).getByRole("region", { name: "Facturar DDP 64" });
    expect(within(seccion).queryByTestId("contenedor-facturado")).toBeNull();
    expect(within(seccion).getByLabelText(/Total con IVA de Cliente Dos/)).toBeTruthy();
    unmount();
    // Con los dos facturados sí, aunque el filtro deje uno.
    render(
      <EmbarquesClient
        shipments={ENVIOS}
        adjuntos={undefined}
        contenedores={DATOS}
        facturacion={{ estado: "lista", contenedores: ["c64"], facturados }}
      />,
    );
    await userEvent.type(screen.getByLabelText("Buscar"), "S-a1");
    await abrir("DDP 64");
    seccion = within(region("DDP 64")).getByRole("region", { name: "Facturar DDP 64" });
    expect(within(seccion).getByTestId("contenedor-facturado").textContent).toBe("Facturado");
    expect(within(seccion).queryAllByRole("button")).toHaveLength(0);
  });

  it("una pre-orden en $0 no se emite ni se teclea: se corrige en Facturación", async () => {
    render(
      <EmbarquesClient
        shipments={ENVIOS}
        adjuntos={undefined}
        contenedores={DATOS}
        facturacion={FACTURACION}
        montos={{ estado: "lista", porEmbarque: { a1: conDocumento("i0", "F-PO-0", 0, true) } }}
      />,
    );
    await abrir("DDP 64");
    const seccion = within(region("DDP 64")).getByRole("region", { name: "Facturar DDP 64" });
    expect(within(seccion).queryByLabelText(/Total con IVA de Cliente Uno/)).toBeNull();
    const aviso = within(seccion).getByTestId("preorden-invalida-DTD-1001");
    expect(aviso.textContent).toContain("Pre-orden sin monto válido: corrígela en Facturación.");
    expect(within(aviso).getByRole("link", { name: "Pre-orden F-PO-0" }).getAttribute("href")).toBe(
      "/studio/facturacion/F-PO-0",
    );
    expect(within(aviso).queryByRole("button")).toBeNull();
    expect(within(seccion).queryByRole("button", { name: /Facturar todo/ })).toBeNull();
    // Solo Cliente Dos (sin precio) ofrece «Facturar».
    expect(within(seccion).getAllByRole("button", { name: "Facturar" })).toHaveLength(1);
  });

  it("una pre-orden en otra moneda tampoco va al camino tecleado", async () => {
    const otra: MontoAcumulado = {
      facturas: 1, totalUsd: 0, pagadoUsd: 0, otraMoneda: 1, borradores: 1, sinFacturarUsd: 0,
      documentos: [{ invoiceId: "iv", invoiceCode: "F-PO-VES", preorden: true, totalUsd: null }],
    };
    render(
      <EmbarquesClient
        shipments={ENVIOS}
        adjuntos={undefined}
        contenedores={DATOS}
        facturacion={FACTURACION}
        montos={{ estado: "lista", porEmbarque: { a1: otra } }}
      />,
    );
    await abrir("DDP 64");
    const seccion = within(region("DDP 64")).getByRole("region", { name: "Facturar DDP 64" });
    expect(within(seccion).queryByLabelText(/Total con IVA de Cliente Uno/)).toBeNull();
    expect(within(seccion).getByTestId("preorden-invalida-DTD-1001")).toBeTruthy();
  });

  it("en el detalle, el total en color lleva a la factura si está emitida y a la pre-orden si no", async () => {
    render(
      <EmbarquesClient
        shipments={ENVIOS}
        adjuntos={undefined}
        contenedores={DATOS}
        montos={{
          estado: "lista",
          porEmbarque: {
            a1: conDocumento("i1", "F-PO-1", 150.25, true),
            b1: conDocumento("i9", "F-EM-9", 80, false, 30),
          },
        }}
      />,
    );
    await abrir("DDP 64");
    const tabla = within(region("DDP 64")).getByRole("table");
    const uno = within(tabla).getByRole("link", { name: "$150.25" });
    expect(uno.getAttribute("href")).toBe("/studio/facturacion/F-PO-1");
    expect(uno.getAttribute("title")).toBe("Abrir la pre-orden F-PO-1 en Facturación");
    const dos = within(tabla).getByRole("link", { name: "$80.00" });
    expect(dos.getAttribute("href")).toBe("/studio/facturacion/F-EM-9");
    expect(dos.getAttribute("title")).toBe("Abrir la factura F-EM-9 en Facturación");
  });
});

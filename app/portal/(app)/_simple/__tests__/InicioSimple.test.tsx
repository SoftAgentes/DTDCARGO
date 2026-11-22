/**
 * SDD-0654 fase 2 · inicio simple (AC-8, AC-9, AC-12).
 *
 * Con una cuenta vacía y con una con datos: los seis bloques, los mismos y en el
 * mismo orden, cada uno con un estado vacío que enseña y su enlace a la Vista
 * Pro. Con el seguimiento en construcción no se dibuja la ruta de etapas.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { summarizeSuppliers } from "@/lib/studio/prealertas/types";
import { ENLACE_PRO, ORDEN_BLOQUES, armarInicioSimple, type DatosInicioSimple } from "@/lib/portal/simple/bloques";

vi.mock("../../../actions", () => ({
  markPortalGuiaVistaAction: vi.fn(async () => ({ ok: true })),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/portal",
  useSearchParams: () => new URLSearchParams(),
}));

const { InicioSimple } = await import("../InicioSimple");

const KPIS = {
  activeShipments: 0,
  deliveredYtd: 0,
  invoicesAvailable: true,
  invoicedTotal: 0,
  outstandingBalance: 0,
  currency: "USD" as const,
  mixedCurrencies: false,
  pendingInvoiceCount: 0,
};

const vacia: DatosInicioSimple = {
  nombre: "Mariela Ejemplo",
  markbox: "DTD-9999",
  nextArrival: null,
  shipments: [],
  ocultos: { ok: true, ocultos: new Set() },
  kpis: KPIS,
  profile: { hasPhoto: true, hasAddress: true, complete: true },
  pendingAcceptanceCodes: [],
  documentos: [],
  proveedores: [],
  asesor: null,
  seguimientoEnConstruccion: true,
};

const envio = {
  id: "e1",
  code: "DTD-9999-1-1",
  service: "consolidado_lcl" as const,
  status: "in_transit" as const,
  origin: "Guangzhou",
  destination: "La Guaira",
  updatedAt: "2026-11-10T00:00:00Z",
};

const conDatos: DatosInicioSimple = {
  ...vacia,
  nextArrival: { ...envio, etaIso: "2026-12-08T00:00:00Z" },
  shipments: [envio],
  kpis: { ...KPIS, outstandingBalance: 120, pendingInvoiceCount: 1 },
  proveedores: summarizeSuppliers(
    "DTD-9999",
    [{ id: "s1", supplier_seq: 1, name: "Muebles Ejemplo", wechat: null, city: null, contact: null, notes: null }],
    {},
  ),
  asesor: { name: "Laura Pérez", phone: null, avatarUrl: null, positionLabel: "Asesora comercial" },
};

afterEach(cleanup);

function bloques(container: HTMLElement): string[] {
  return [...container.querySelectorAll("section[data-bloque]")].map((s) => s.getAttribute("data-bloque") ?? "");
}

describe("InicioSimple", () => {
  it.each([
    ["vacía", vacia],
    ["con datos", conDatos],
  ])("cuenta %s: seis bloques en el mismo orden, cada uno con su enlace a la Vista Pro", (_, datos) => {
    const { container } = render(<InicioSimple datos={armarInicioSimple(datos)} guiaVista />);
    expect(bloques(container)).toEqual([...ORDEN_BLOQUES]);
    for (const id of ORDEN_BLOQUES) {
      const seccion = container.querySelector(`section[data-bloque="${id}"]`) as HTMLElement;
      expect(within(seccion).getByRole("link", { name: ENLACE_PRO[id].texto })).toHaveAttribute("href", ENLACE_PRO[id].href);
    }
  });

  it("la cuenta vacía enseña en cada bloque qué hacer", () => {
    render(<InicioSimple datos={armarInicioSimple(vacia)} guiaVista />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Hola, Mariela.");
    expect(screen.getByText("Todavía no tienes envíos en camino.")).toBeInTheDocument();
    expect(screen.getByText("No tienes nada pendiente.")).toBeInTheDocument();
    expect(screen.getByText("Estás al día.")).toBeInTheDocument();
    expect(screen.getByText(/Todavía no tienes papeles/)).toBeInTheDocument();
    expect(screen.getByText(/Todavía no tienes proveedores registrados/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir el chat" })).toHaveAttribute("href", "/portal/soporte");
  });

  it("con datos: el estado en palabras, la llegada estimada y el saldo en su moneda", () => {
    render(<InicioSimple datos={armarInicioSimple(conDatos)} guiaVista />);
    expect(screen.getByText("Va en camino a Venezuela.")).toBeInTheDocument();
    expect(screen.getByText(/Llegada estimada/)).toBeInTheDocument();
    expect(screen.getByText(/La fecha de llegada es un estimado/)).toBeInTheDocument();
    expect(screen.getByText("1 factura por pagar")).toBeInTheDocument();
    expect(screen.getByText(/Escríbele a Laura Pérez/)).toBeInTheDocument();
  });

  it("con el seguimiento en construcción no dibuja la ruta de etapas (AC-12)", () => {
    render(<InicioSimple datos={armarInicioSimple(conDatos)} guiaVista />);
    expect(screen.queryByRole("list", { name: "Ruta de tu carga" })).not.toBeInTheDocument();
  });

  it("con el seguimiento encendido dibuja la ruta y marca la etapa actual", () => {
    render(<InicioSimple datos={armarInicioSimple({ ...conDatos, seguimientoEnConstruccion: false })} guiaVista />);
    const ruta = screen.getByRole("list", { name: "Ruta de tu carga" });
    expect(within(ruta).getAllByRole("listitem")).toHaveLength(5);
    expect(ruta.querySelector('[aria-current="step"]')).toHaveTextContent("En camino");
  });

  it("sin vino en la Vista simple: ningún bloque lleva tinte vino (SDD-0686, Vista simple A)", () => {
    const { container } = render(<InicioSimple datos={armarInicioSimple(conDatos)} guiaVista />);
    expect(container.querySelectorAll(".vs-tinte-wine")).toHaveLength(0);
    for (const el of container.querySelectorAll("[class*='vs-']")) {
      expect(el.className.toString()).not.toMatch(/wine/);
    }
  });
});

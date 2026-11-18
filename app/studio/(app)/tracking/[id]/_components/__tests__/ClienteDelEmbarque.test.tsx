/**
 * SDD-0662 · franja «Cliente» de la ficha del embarque.
 *
 *  - con permiso y sin cliente (DTD-0000 o vacío): aviso y «Asignar cliente»;
 *  - con permiso y cliente real: «Pasar a otro cliente», sin aviso;
 *  - sin permiso: sin botón, y una nota con los roles que pueden hacerlo;
 *  - sin ver nombres (equipo de China, SDD-0531): el buscador no se monta aunque
 *    el rol tenga la acción.
 *
 * Datos inventados: los Shipping Marks van en el rango DTD-9xxx.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ preview: vi.fn(), reassign: vi.fn(), buscadores: 0 }));
vi.mock("../../actions", () => ({
  previewReassignShipmentClient: (...a: unknown[]) => mocks.preview(...a),
  reassignShipmentClient: (...a: unknown[]) => mocks.reassign(...a),
}));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({
  useToast: () => ({ show: vi.fn(), success: vi.fn(), info: vi.fn(), error: vi.fn(), warning: vi.fn(), dismiss: vi.fn() }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
// El buscador real habla con el servidor y muestra nombres: se cuenta si se monta.
vi.mock("@/app/studio/_components/ui/ClientCombobox", () => ({
  ClientCombobox: (props: { id: string }) => {
    mocks.buscadores += 1;
    return <input id={props.id} aria-label="Cliente nuevo" readOnly />;
  },
}));

const { ClienteDelEmbarque, esSinCliente, rolesQueCambianElCliente } = await import(
  "../ClienteDelEmbarque"
);

const BASE = {
  shipmentId: "00000000-0000-4000-8000-0000000000a1",
  shipmentCode: "S-2026-9001",
  markbox: "DTD-0000" as string | null,
  puedeVerNombres: true,
  puedeReasignar: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.buscadores = 0;
});
afterEach(cleanup);

describe("esSinCliente", () => {
  it("el comodín o un Shipping Mark vacío es «sin cliente»", () => {
    for (const m of ["DTD-0000", " DTD-0000 ", "", "   ", null, undefined]) {
      expect(esSinCliente(m), String(m)).toBe(true);
    }
    for (const m of ["DTD-9042", "DTD-0001", "DTD-00000"]) {
      expect(esSinCliente(m), m).toBe(false);
    }
  });
});

describe("ClienteDelEmbarque", () => {
  it("con permiso y sin cliente: avisa y ofrece «Asignar cliente», que abre el modal", async () => {
    const user = userEvent.setup();
    render(<ClienteDelEmbarque {...BASE} />);
    expect(screen.getByText("DTD-0000")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Este embarque no tiene cliente asignado.");
    expect(screen.queryByRole("button", { name: "Pasar a otro cliente" })).toBeNull();

    const boton = screen.getByRole("button", { name: "Asignar cliente" });
    expect(boton).toHaveClass("studio-btn-primary");
    await user.click(boton);
    const dialogo = screen.getByRole("dialog", { name: "Asignar cliente" });
    expect(within(dialogo).getByLabelText("Cliente nuevo")).toBeInTheDocument();
    expect(mocks.buscadores).toBeGreaterThan(0);
  });

  it("con permiso y Shipping Mark vacío: también pide asignarlo", () => {
    render(<ClienteDelEmbarque {...BASE} markbox={null} />);
    expect(screen.getByText("Sin Shipping Mark")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Asignar cliente" })).toBeInTheDocument();
  });

  it("con permiso y cliente real: «Pasar a otro cliente», secundario y sin aviso", () => {
    render(<ClienteDelEmbarque {...BASE} markbox="DTD-9042" />);
    expect(screen.getByText("DTD-9042")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pasar a otro cliente" })).toHaveClass(
      "studio-btn-ghost",
    );
    expect(screen.queryByRole("button", { name: "Asignar cliente" })).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("sin permiso y sin cliente: no hay botón; dice qué roles pueden asignarlo", () => {
    render(<ClienteDelEmbarque {...BASE} puedeReasignar={false} />);
    expect(screen.queryByRole("button")).toBeNull();
    const aviso = screen.getByRole("status");
    expect(aviso).toHaveTextContent("Este embarque no tiene cliente asignado.");
    expect(aviso).toHaveTextContent(
      "Asignarlo lo puede hacer quien tenga el rol Admin, Operaciones o Comercial.",
    );
    expect(rolesQueCambianElCliente()).toBe("Admin, Operaciones o Comercial");
    expect(mocks.buscadores).toBe(0);
  });

  it("sin permiso y con cliente: la nota habla de pasarlo a otro cliente", () => {
    render(<ClienteDelEmbarque {...BASE} markbox="DTD-9042" puedeReasignar={false} />);
    expect(screen.queryByRole("button")).toBeNull();
    const aviso = screen.getByRole("status");
    expect(aviso).toHaveTextContent(
      "Pasarlo a otro cliente lo puede hacer quien tenga el rol Admin, Operaciones o Comercial.",
    );
    expect(aviso).not.toHaveTextContent("no tiene cliente asignado");
  });

  it("sin ver nombres: el buscador no se monta aunque el rol tenga la acción", () => {
    for (const markbox of ["DTD-0000", "DTD-9042"]) {
      const { container, unmount } = render(
        <ClienteDelEmbarque {...BASE} markbox={markbox} puedeVerNombres={false} />,
      );
      expect(screen.queryByRole("button"), markbox).toBeNull();
      expect(screen.queryByRole("dialog"), markbox).toBeNull();
      expect(container.querySelector("input"), markbox).toBeNull();
      expect(screen.getByRole("status")).toHaveTextContent(
        "El cliente de un embarque no se cambia desde tu región.",
      );
      // Nada de roles ni de acciones que no puede usar.
      expect(container.textContent, markbox).not.toContain("Asignar cliente");
      expect(container.textContent, markbox).not.toContain("Pasar a otro cliente");
      unmount();
    }
    expect(mocks.buscadores).toBe(0);
    expect(mocks.preview).not.toHaveBeenCalled();
  });
});

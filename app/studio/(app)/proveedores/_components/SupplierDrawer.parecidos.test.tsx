/**
 * SDD-0603 T4c · los proveedores parecidos no viven en la región viva.
 *
 * La lista cambia con cada tecla del nombre. Si estuviera dentro del `Aviso`
 * (`role="status"`), el lector la releería entera en cada pulsación. La franja
 * lleva solo el título fijo y la lista va fuera, como texto (revisión de la #547).
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("../actions", () => ({
  createStudioSupplierAction: vi.fn(),
  updateStudioSupplierAction: vi.fn(),
}));

import { ProveedoresParecidos } from "./SupplierDrawer";

afterEach(() => cleanup());

const SIMILAR = [
  { id: "a", supplier_seq: 7, name: "Guangzhou Textile Co", wechat: "gz-tex" },
  { id: "b", supplier_seq: 9, name: "Guangzhou Textil Sur", wechat: null },
];

describe("ProveedoresParecidos", () => {
  it("la franja avisa con su título y la lista queda fuera de toda región viva", () => {
    render(<ProveedoresParecidos similar={SIMILAR} />);

    const franja = screen.getByRole("status");
    expect(franja).toHaveTextContent("Este cliente ya tiene proveedores parecidos");
    expect(franja).not.toHaveTextContent("Guangzhou");

    const lista = screen.getByRole("list");
    expect(lista.closest('[role="status"], [role="alert"], [aria-live]')).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(lista).toHaveTextContent("#7 · Guangzhou Textile Co · WeChat gz-tex");
    expect(lista).toHaveTextContent("#9 · Guangzhou Textil Sur");
  });
});

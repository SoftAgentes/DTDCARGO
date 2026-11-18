/**
 * SDD-0603 T4c · el banner de pagos vencidos al socio es atención, no alerta.
 *
 * Es persistente al abrir Financiero China y su franja es atómica: con
 * `role="alert"` interrumpiría al cargar y releería la lista entera al pulsar
 * «Ver N más». Decisión del DG en la revisión de la #547: `tono="atencion"`.
 * Datos inventados.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { PartnerBillAlert } from "@/lib/studio/partner-finance/alerts-queries";
import { PartnerAlertsBanner } from "./PartnerAlertsBanner";

afterEach(() => cleanup());

function alerta(i: number): PartnerBillAlert {
  return {
    bill: { id: `b${i}`, bill_code: `CXP-T4C-${i}`, supplier_name: `Proveedor ${i}`, currency: "USD" },
    kind: "pp",
    balance: 100 + i,
    balanceUsd: 100 + i,
    daysOverdue: 10 + i,
  } as unknown as PartnerBillAlert;
}

describe("PartnerAlertsBanner", () => {
  it("es una franja de atención (status), no una alerta", () => {
    render(<PartnerAlertsBanner alerts={[alerta(1), alerta(2), alerta(3), alerta(4), alerta(5)]} />);
    const franja = screen.getByRole("status");
    expect(franja).toHaveAttribute("data-tono", "atencion");
    expect(franja).toHaveTextContent("5 pagos PP/CA vencidos al socio");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("«Ver N más» es un botón secundario y abre la lista completa", () => {
    render(<PartnerAlertsBanner alerts={[alerta(1), alerta(2), alerta(3), alerta(4), alerta(5)]} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    const ver = screen.getByRole("button", { name: "Ver 1 más" });
    expect(ver).toHaveClass("studio-btn", "studio-btn-ghost", "studio-btn-sm");
    fireEvent.click(ver);
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getByRole("button", { name: "Ver menos" })).toBeInTheDocument();
  });

  it("sin alertas no pinta nada", () => {
    const { container } = render(<PartnerAlertsBanner alerts={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

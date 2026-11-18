/**
 * SDD-0614 · S0b (D-6.6-1): Dirección no muestra las cifras de Kommo.
 *
 * La tarjeta «Comercial» pintaba «Pipeline CRM» y «Leads activos», que salían
 * del espejo `kommo_leads`, y enlazaba a `/studio/crm`, donde desde S0 ya no se
 * ve ninguna cifra de Kommo. Con el resumen marcado `oculto`, la tarjeta no se
 * pinta. El control de abajo prueba que la prueba mira algo: sin ocultar, las
 * dos cifras se ven.
 */
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CommercialCard } from "./CommercialCard";

afterEach(() => cleanup());

describe("Dirección › Comercial no muestra cifras de Kommo (SDD-0614 S0b)", () => {
  it("con el resumen oculto, la tarjeta no se pinta", () => {
    const { container } = render(
      createElement(CommercialCard, {
        commercial: { pipeline: 1500, leadsActivos: 3, oculto: true },
      }),
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("Pipeline CRM")).toBeNull();
    expect(screen.queryByText("Leads activos")).toBeNull();
  });

  it("control: sin ocultar, la tarjeta pinta las dos cifras", () => {
    render(
      createElement(CommercialCard, {
        commercial: { pipeline: 1500, leadsActivos: 3, oculto: false },
      }),
    );
    expect(screen.getByText("Pipeline CRM")).toBeInTheDocument();
    expect(screen.getByText("Leads activos")).toBeInTheDocument();
  });
});

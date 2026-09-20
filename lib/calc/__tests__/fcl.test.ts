// @vitest-environment node
import { describe, it, expect } from "vitest";
import { calcFclEstimate, fclRouteLabel } from "../fcl";

describe("calcFclEstimate", () => {
  it("1 contenedor = la tarifa flat de la ruta", () => {
    const e = calcFclEstimate({ flatRate: 8500, minCharge: null }, { containers: 1 });
    expect(e.containers).toBe(1);
    expect(e.subtotal).toBe(8500);
    expect(e.total).toBe(8500);
  });

  it("N contenedores = N × tarifa flat", () => {
    const e = calcFclEstimate({ flatRate: 7800, minCharge: null }, { containers: 3 });
    expect(e.subtotal).toBe(23400);
    expect(e.total).toBe(23400);
  });

  it("normaliza contenedores a entero ≥ 1", () => {
    expect(calcFclEstimate({ flatRate: 8500, minCharge: null }, { containers: 0 }).containers).toBe(1);
    expect(calcFclEstimate({ flatRate: 8500, minCharge: null }, { containers: -5 }).containers).toBe(1);
    expect(calcFclEstimate({ flatRate: 8500, minCharge: null }, { containers: 2.9 }).containers).toBe(2);
    expect(
      calcFclEstimate({ flatRate: 8500, minCharge: null }, { containers: NaN }).containers,
    ).toBe(1);
  });

  it("eleva al piso (minCharge) si el subtotal queda por debajo", () => {
    const e = calcFclEstimate({ flatRate: 500, minCharge: 1000 }, { containers: 1 });
    expect(e.subtotal).toBe(500);
    expect(e.total).toBe(1000);
  });

  it("ignora minCharge si el subtotal ya lo supera", () => {
    const e = calcFclEstimate({ flatRate: 8500, minCharge: 1000 }, { containers: 1 });
    expect(e.total).toBe(8500);
  });

  it("tarifa inválida → 0 (no NaN)", () => {
    const e = calcFclEstimate(
      // @ts-expect-error — fuerza valor inválido como vendría de un row sucio
      { flatRate: "x", minCharge: null },
      { containers: 2 },
    );
    expect(e.flatRate).toBe(0);
    expect(e.total).toBe(0);
  });
});

describe("fclRouteLabel", () => {
  it("formatea 'Origen → Destino'", () => {
    expect(fclRouteLabel({ origin: "Guangzhou", destination: "La Guaira" })).toBe(
      "Guangzhou → La Guaira",
    );
  });
});

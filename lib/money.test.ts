// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fmtAmount, fmtUsd, fmtUsdCompact } from "./money";

/**
 * Estos tests fijan el formato de plata del ERP. Antes de `lib/money.ts` había
 * 13 comportamientos distintos y el mismo monto se veía diferente en cada
 * pantalla; el punto de este archivo es que eso no vuelva a pasar sin que
 * alguien lo decida a propósito.
 */
describe("fmtUsd · el formato por defecto", () => {
  it("muestra siempre dos decimales", () => {
    expect(fmtUsd(1234.5)).toBe("$1,234.50");
    expect(fmtUsd(1234)).toBe("$1,234.00");
  });

  it("no se come los centavos", () => {
    expect(fmtUsd(0.01)).toBe("$0.01");
    expect(fmtUsd(1234.56)).toBe("$1,234.56");
  });

  it("pone el signo antes del símbolo y usa el guion normal", () => {
    expect(fmtUsd(-80.25)).toBe("-$80.25");
    expect(fmtUsd(-80.25)).not.toContain("−"); // U+2212, el que usaban 3 módulos
  });

  it("el cero es $0.00, no vacío ni raya", () => {
    expect(fmtUsd(0)).toBe("$0.00");
  });

  it("aguanta basura sin romper la pantalla", () => {
    expect(fmtUsd(NaN)).toBe("$0.00");
    expect(fmtUsd(Infinity)).toBe("$0.00");
    expect(fmtUsd(undefined as unknown as number)).toBe("$0.00");
  });
});

describe("fmtAmount · sin símbolo", () => {
  it("da el número pelado para los sitios que escriben USD o $ al lado", () => {
    expect(fmtAmount(1234.5)).toBe("1,234.50");
    expect(fmtAmount(0)).toBe("0.00");
  });

  it("no trae el símbolo (si no, saldría $$1,234.50 en cobranzas)", () => {
    expect(fmtAmount(1234.5)).not.toContain("$");
  });
});

describe("fmtUsdCompact · sólo KPIs de Reportes", () => {
  it("abrevia miles y millones", () => {
    expect(fmtUsdCompact(1234.5)).toBe("$1K");
    expect(fmtUsdCompact(1_250_000)).toBe("$1.25M");
    expect(fmtUsdCompact(850)).toBe("$850");
  });

  it("mantiene el signo del lado correcto en negativos", () => {
    // la versión vieja devolvía "$-5,000" para esto
    expect(fmtUsdCompact(-5000)).toBe("-$5K");
    expect(fmtUsdCompact(-850)).toBe("-$850");
  });
});

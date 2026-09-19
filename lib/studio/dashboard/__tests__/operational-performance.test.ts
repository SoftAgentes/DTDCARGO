// @vitest-environment node
/**
 * SDD-0281 · On-time delivery y tránsito promedio.
 *
 * Lo que se prueba con más insistencia NO es la aritmética: es que el KPI se
 * **calle** cuando no puede sostener el número. Un "100% on-time" medido sobre
 * 2 de 47 envíos es la clase de dato que se presenta en una reunión y nadie
 * puede desmentir en el momento.
 */

import { describe, it, expect } from "vitest";
import {
  COBERTURA_MINIMA,
  calcularOnTime,
  calcularTransitoPromedio,
  kpiDesempeno,
  type EnvioMedible,
} from "../operational-performance";

function envio(over: Partial<EnvioMedible> = {}): EnvioMedible {
  return {
    id: "s1",
    plannedDeliveryAt: "2026-08-20",
    deliveredAt: "2026-08-20",
    shippedAt: "2026-07-21",
    ...over,
  };
}

describe("calcularOnTime", () => {
  it("cuenta a tiempo el entregado en la fecha comprometida", () => {
    const m = calcularOnTime([
      envio({ plannedDeliveryAt: "2026-08-20", deliveredAt: "2026-08-20" }),
    ]);
    expect(m.valor).toBe(100);
  });

  it("compara por DÍA, no por instante", () => {
    // Entregar a las 19:00 del día prometido es a tiempo. Comparar timestamps
    // marcaría tarde a media operación por horas que nadie prometió.
    const m = calcularOnTime([
      envio({
        plannedDeliveryAt: "2026-08-20T00:00:00Z",
        deliveredAt: "2026-08-20T23:59:00Z",
      }),
    ]);
    expect(m.valor).toBe(100);
  });

  it("un día tarde es tarde", () => {
    const m = calcularOnTime([
      envio({ plannedDeliveryAt: "2026-08-20", deliveredAt: "2026-08-21" }),
    ]);
    expect(m.valor).toBe(0);
  });

  it("redondea el porcentaje sobre los que SÍ tienen compromiso", () => {
    const m = calcularOnTime([
      envio({ id: "a", deliveredAt: "2026-08-20" }),
      envio({ id: "b", deliveredAt: "2026-08-20" }),
      envio({ id: "c", deliveredAt: "2026-08-25" }),
    ]);
    expect(m.medidos).toBe(3);
    expect(m.universo).toBe(3);
    expect(m.valor).toBe(67);
  });

  it("🔴 se CALLA cuando midió menos de la mitad del universo", () => {
    // 2 con compromiso cargado, 8 sin él. Los 2 entregaron a tiempo: el número
    // "bonito" sería 100%. Lo que se publica es nada, y el motivo.
    const envios = [
      envio({ id: "a" }),
      envio({ id: "b" }),
      ...Array.from({ length: 8 }, (_, i) =>
        envio({ id: `x${i}`, plannedDeliveryAt: null }),
      ),
    ];
    const m = calcularOnTime(envios);
    expect(m.medidos).toBe(2);
    expect(m.universo).toBe(10);
    expect(m.cobertura).toBeLessThan(COBERTURA_MINIMA);
    expect(m.valor).toBeNull();
    expect(m.motivo).toBe("cobertura_insuficiente");
  });

  it("con cobertura justo en el umbral SÍ publica", () => {
    const envios = [
      envio({ id: "a" }),
      envio({ id: "b" }),
      envio({ id: "c", plannedDeliveryAt: null }),
      envio({ id: "d", plannedDeliveryAt: null }),
    ];
    const m = calcularOnTime(envios);
    expect(m.cobertura).toBe(0.5);
    expect(m.valor).toBe(100);
    expect(m.motivo).toBeNull();
  });

  it("sin ningún compromiso cargado → sin datos, no 0%", () => {
    // 0% diría "entregamos todo tarde", que es una acusación, no una medición.
    const m = calcularOnTime([envio({ plannedDeliveryAt: null })]);
    expect(m.valor).toBeNull();
    expect(m.motivo).toBe("sin_datos");
  });

  it("sin envíos entregados no explota", () => {
    expect(calcularOnTime([])).toEqual({
      valor: null,
      medidos: 0,
      universo: 0,
      cobertura: 0,
      motivo: "sin_datos",
    });
  });
});

describe("calcularTransitoPromedio", () => {
  it("mide días entre el zarpe REAL y la entrega", () => {
    const m = calcularTransitoPromedio([
      envio({ shippedAt: "2026-07-01T00:00:00Z", deliveredAt: "2026-07-31T00:00:00Z" }),
    ]);
    expect(m.valor).toBe(30);
  });

  it("🔴 usa MEDIANA: un envío trabado en aduana no mueve el número", () => {
    // Cuatro envíos normales (~30 días) y uno trabado 200. La media daría 64
    // días —un tránsito que no le pasa a casi nadie—; la mediana dice 30.
    const base = ["2026-07-01T00:00:00Z", "2026-07-31T00:00:00Z"] as const;
    const envios = [
      envio({ id: "a", shippedAt: base[0], deliveredAt: base[1] }),
      envio({ id: "b", shippedAt: base[0], deliveredAt: "2026-07-30T00:00:00Z" }),
      envio({ id: "c", shippedAt: base[0], deliveredAt: "2026-08-01T00:00:00Z" }),
      envio({ id: "d", shippedAt: base[0], deliveredAt: "2026-08-02T00:00:00Z" }),
      envio({ id: "trabado", shippedAt: base[0], deliveredAt: "2027-01-17T00:00:00Z" }),
    ];
    const m = calcularTransitoPromedio(envios);
    expect(m.valor).toBe(31);
    const media =
      envios.reduce(
        (a, e) =>
          a + (Date.parse(e.deliveredAt) - Date.parse(e.shippedAt!)) / 86_400_000,
        0,
      ) / envios.length;
    expect(Math.round(media)).toBeGreaterThan(60);
  });

  it("descarta el tránsito negativo (error de carga), no lo promedia", () => {
    const m = calcularTransitoPromedio([
      envio({ id: "a", shippedAt: "2026-07-01T00:00:00Z", deliveredAt: "2026-07-31T00:00:00Z" }),
      envio({ id: "b", shippedAt: "2026-07-31T00:00:00Z", deliveredAt: "2026-07-01T00:00:00Z" }),
      envio({ id: "c", shippedAt: "2026-07-01T00:00:00Z", deliveredAt: "2026-07-31T00:00:00Z" }),
      envio({ id: "d", shippedAt: "2026-07-01T00:00:00Z", deliveredAt: "2026-07-31T00:00:00Z" }),
    ]);
    expect(m.medidos).toBe(3);
    expect(m.valor).toBe(30);
  });

  it("sin evento de zarpe el envío no entra al cálculo pero sí al universo", () => {
    const m = calcularTransitoPromedio([
      envio({ id: "a" }),
      envio({ id: "b", shippedAt: null }),
    ]);
    expect(m.medidos).toBe(1);
    expect(m.universo).toBe(2);
  });

  it("se calla si menos de la mitad tiene zarpe registrado", () => {
    const m = calcularTransitoPromedio([
      envio({ id: "a" }),
      envio({ id: "b", shippedAt: null }),
      envio({ id: "c", shippedAt: null }),
    ]);
    expect(m.valor).toBeNull();
    expect(m.motivo).toBe("cobertura_insuficiente");
  });
});

describe("kpiDesempeno", () => {
  it("🔴 el `sub` SIEMPRE dice sobre cuántos se midió", () => {
    const m = calcularOnTime([envio({ id: "a" }), envio({ id: "b" })]);
    const card = kpiDesempeno(m, "%", "a tiempo");
    expect(card.value).toBe("100%");
    expect(card.sub).toBe("a tiempo · 2 de 2 envíos");
  });

  it("con muestra insuficiente muestra guión y explica, sin porcentaje", () => {
    const envios = [
      envio({ id: "a" }),
      ...Array.from({ length: 9 }, (_, i) =>
        envio({ id: `x${i}`, plannedDeliveryAt: null }),
      ),
    ];
    const card = kpiDesempeno(calcularOnTime(envios), "%", "a tiempo");
    expect(card.value).toBe("—");
    expect(card.sub).toContain("1 de 10");
    expect(card.sub).toContain("muestra insuficiente");
    expect(card.tone).toBe("warning");
  });

  it("sin entregas medibles no acusa a nadie", () => {
    const card = kpiDesempeno(calcularOnTime([]), "%", "a tiempo");
    expect(card.value).toBe("—");
    expect(card.sub).toBe("sin entregas medibles aún");
    expect(card.tone).toBe("neutral");
  });

  it("el tránsito rinde con su unidad en días", () => {
    const m = calcularTransitoPromedio([
      envio({ shippedAt: "2026-07-01T00:00:00Z", deliveredAt: "2026-07-31T00:00:00Z" }),
    ]);
    expect(kpiDesempeno(m, " días", "de tránsito").value).toBe("30 días");
  });
});

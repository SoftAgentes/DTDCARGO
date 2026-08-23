/**
 * SDD-0281 · La capa pura de la factura en papel.
 *
 * No se renderiza el PDF acá a propósito: lo que puede mentirle a un cliente
 * son los NÚMEROS y las etiquetas, y eso vive en `construirFilas` /
 * `calcularTotales` / `estadoLabel`. Renderizar sólo probaría que react-pdf
 * sabe dibujar cajas.
 *
 * El caso que más importa es el descuadre: el papel tiene que DENUNCIARLO, no
 * arreglarlo. Un documento que corrige el total en silencio es peor que uno que
 * no cuadra, porque nadie se entera nunca.
 */

import { describe, it, expect } from "vitest";
import { calcInvoiceTotals } from "@/lib/studio/invoice-types";
import {
  calcularTotales,
  construirFilas,
  estadoLabel,
  fechaCorta,
  montoConMoneda,
  type FacturaPdfInput,
} from "../factura-pdf";

function mkFactura(over: Partial<FacturaPdfInput> = {}): FacturaPdfInput {
  return {
    code: "F-2026-0001",
    clientName: "Importadora Ejemplo C.A.",
    clientMarkbox: "DTD-1234",
    shipmentCode: "SHP-2026-0007",
    currency: "USD",
    fxRate: null,
    ivaRate: 0,
    base: 2720,
    ivaAmount: 0,
    total: 2720,
    paid: 0,
    status: "emitida",
    issuedAt: "2026-08-01",
    dueDate: "2026-08-31",
    lines: [{ desc: "Flete LCL 3.400 m³", qty: 3.4, unitPrice: 800 }],
    notes: null,
    ...over,
  };
}

describe("construirFilas", () => {
  it("calcula el monto de cada línea y redondea a centavo", () => {
    const filas = construirFilas([{ desc: "Flete", qty: 3.4, unitPrice: 800 }]);
    expect(filas).toEqual([
      { desc: "Flete", qty: 3.4, unitPrice: 800, amount: 2720 },
    ]);
  });

  it("descarta la línea completamente vacía de un borrador a medio llenar", () => {
    const filas = construirFilas([
      { desc: "Flete", qty: 1, unitPrice: 100 },
      { desc: "  ", qty: 0, unitPrice: 0 },
    ]);
    expect(filas).toHaveLength(1);
  });

  it("PERO imprime la línea con descripción y monto cero (concepto informativo)", () => {
    // Silenciarla cambiaría el documento sin avisar: el operador la escribió
    // porque quería que se leyera.
    const filas = construirFilas([{ desc: "Seguro incluido", qty: 0, unitPrice: 0 }]);
    expect(filas).toEqual([
      { desc: "Seguro incluido", qty: 0, unitPrice: 0, amount: 0 },
    ]);
  });

  it("no explota con basura en los números ni con un `lines` que no es lista", () => {
    const filas = construirFilas([
      { desc: "Raro", qty: NaN, unitPrice: Infinity },
    ]);
    expect(filas).toEqual([{ desc: "Raro", qty: 0, unitPrice: 0, amount: 0 }]);
    expect(construirFilas(null as never)).toEqual([]);
  });
});

describe("calcularTotales", () => {
  it("saca el saldo restando lo abonado del total", () => {
    const t = calcularTotales(mkFactura({ total: 2720, paid: 720 }));
    expect(t.balance).toBe(2000);
  });

  it("con IVA reporta base, tasa y monto tal como los guardó la factura", () => {
    const t = calcularTotales(
      mkFactura({
        ivaRate: 16,
        base: 2720,
        ivaAmount: 435.2,
        total: 3155.2,
        lines: [{ desc: "Flete", qty: 3.4, unitPrice: 800 }],
      }),
    );
    expect(t.base).toBe(2720);
    expect(t.ivaRate).toBe(16);
    expect(t.ivaAmount).toBe(435.2);
    expect(t.total).toBe(3155.2);
    expect(t.descuadre).toBe(false);
  });

  it("🔴 DENUNCIA el descuadre en vez de corregirlo", () => {
    // Las líneas suman 2000 pero la factura se emitió por 2720. El papel
    // conserva el total emitido —que es el que se cobró— y levanta la bandera.
    const t = calcularTotales(
      mkFactura({ base: 2720, total: 2720, lines: [{ desc: "Flete", qty: 2, unitPrice: 1000 }] }),
    );
    expect(t.sumaLineas).toBe(2000);
    expect(t.base).toBe(2720);
    expect(t.total).toBe(2720);
    expect(t.descuadre).toBe(true);
  });

  it("🔴 suma como el servidor: redondea UNA vez, no por línea", () => {
    // Tres líneas de 33.333. Redondeando por línea daría 33.33×3 = 99.99 y el
    // papel gritaría "descuadre" contra una base de 100.00 perfectamente sana.
    // `calcInvoiceTotals` (el que calculó esa base) suma los productos crudos y
    // redondea al final → 100.00. Este test fija que la fórmula sea la misma.
    const t = calcularTotales(
      mkFactura({
        base: 100,
        total: 100,
        lines: [
          { desc: "a", qty: 1, unitPrice: 33.333 },
          { desc: "b", qty: 1, unitPrice: 33.333 },
          { desc: "c", qty: 1, unitPrice: 33.334 },
        ],
      }),
    );
    expect(t.sumaLineas).toBe(100);
    expect(t.descuadre).toBe(false);
  });

  it("las filas visibles SÍ redondean cada monto (es dinero impreso)", () => {
    const filas = construirFilas([{ desc: "a", qty: 1, unitPrice: 33.333 }]);
    expect(filas[0].amount).toBe(33.33);
  });

  it("una factura sin líneas y sin base no descuadra", () => {
    const t = calcularTotales(mkFactura({ base: 0, total: 0, lines: [] }));
    expect(t.descuadre).toBe(false);
  });
});

describe("contrato con el cálculo real del servidor", () => {
  // Comentar que "se suma igual que calcInvoiceTotals" no vale nada si nadie lo
  // comprueba: el día que cambie el cálculo del servidor, este test es el que
  // avisa. Se comparan las DOS funciones sobre los mismos juegos de líneas, no
  // contra números escritos a mano.
  const CASOS: { nombre: string; lines: { desc: string; qty: number; unitPrice: number }[] }[] = [
    { nombre: "una línea limpia", lines: [{ desc: "a", qty: 3.4, unitPrice: 800 }] },
    {
      nombre: "tercios que no cierran",
      lines: [
        { desc: "a", qty: 1, unitPrice: 33.333 },
        { desc: "b", qty: 1, unitPrice: 33.333 },
        { desc: "c", qty: 1, unitPrice: 33.334 },
      ],
    },
    {
      nombre: "muchas líneas con centavos",
      lines: Array.from({ length: 17 }, (_, i) => ({
        desc: `l${i}`,
        qty: 1 + i * 0.13,
        unitPrice: 19.99 + i * 0.07,
      })),
    },
    { nombre: "cantidades fraccionarias", lines: [{ desc: "a", qty: 0.125, unitPrice: 7.77 }] },
  ];

  it.each(CASOS)("$nombre — la suma del papel = la base del servidor", ({ lines }) => {
    const { base } = calcInvoiceTotals({ lines, ivaRate: 0, ivaOn: false });
    const t = calcularTotales(mkFactura({ base, total: base, lines }));
    expect(t.sumaLineas).toBe(base);
    expect(t.descuadre).toBe(false);
  });
});

describe("estadoLabel", () => {
  it("usa la MISMA etiqueta que el badge de la app", () => {
    expect(estadoLabel("parcial")).toBe("Parcial");
    expect(estadoLabel("pagada")).toBe("Pagada");
    expect(estadoLabel("anulada")).toBe("Anulada");
  });

  it("un status desconocido se imprime crudo en vez de inventar una etiqueta", () => {
    expect(estadoLabel("en_disputa")).toBe("en_disputa");
  });
});

describe("formateo", () => {
  it("montoConMoneda pone el código delante y siempre dos decimales", () => {
    expect(montoConMoneda(2720, "USD")).toBe("USD 2,720.00");
    expect(montoConMoneda(0, "VES")).toBe("VES 0.00");
  });

  it("fechaCorta pasa de ISO a día/mes/año y tolera el hueco", () => {
    expect(fechaCorta("2026-08-23")).toBe("23/08/2026");
    expect(fechaCorta("2026-08-23T14:00:00Z")).toBe("23/08/2026");
    expect(fechaCorta(null)).toBe("—");
  });
});

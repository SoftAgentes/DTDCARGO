/**
 * SDD-0287 · El estado de cuenta en papel.
 *
 * Este documento **no calcula nada**: recibe el `StatementLedger` que ya armó
 * `buildStatementLedger` y sólo lo formatea. Así que lo que hay que probar no es
 * aritmética — es que el papel y la pantalla salgan del mismo lugar, y que el
 * formateo no invente ni pierda información.
 *
 * El test de contrato de abajo es el que importa: si alguien "optimiza" el PDF
 * dándole su propia suma, el cliente podría ver un saldo en su portal y otro en
 * el archivo que se acaba de bajar.
 */

import { describe, it, expect } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { buildStatementLedger } from "@/lib/portal/statement-ledger";
import type { PortalInvoiceRow } from "@/lib/portal/portal-types";
import {
  EstadoDeCuentaDocument,
  fechaCorta,
  montoConMoneda,
  type EstadoDeCuentaEmisor,
} from "../estado-de-cuenta-pdf";
import { Membrete } from "../pdf-doc";

/** Los elementos del árbol que devuelve el documento (sin expandir subcomponentes). */
function elementos(nodo: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(nodo)) return nodo.flatMap(elementos);
  if (!isValidElement<{ children?: ReactNode }>(nodo)) return [];
  return [nodo as ReactElement<Record<string, unknown>>, ...elementos(nodo.props.children)];
}

/** Los textos literales del árbol. */
function textos(nodo: ReactNode): string[] {
  if (typeof nodo === "string" || typeof nodo === "number") return [String(nodo)];
  if (Array.isArray(nodo)) return nodo.flatMap(textos);
  if (isValidElement<{ children?: ReactNode }>(nodo)) return textos(nodo.props.children);
  return [];
}

const EMISOR: EstadoDeCuentaEmisor = {
  tradeName: "Empresa Sintética",
  email: "",
  phone: "",
  website: "",
};

function inv(over: Partial<PortalInvoiceRow> = {}): PortalInvoiceRow {
  return {
    id: "i1",
    code: "F-2026-0001",
    status: "emitida",
    currency: "USD",
    total: 1000,
    paid: 0,
    issuedAt: "2026-08-01",
    dueDate: "2026-08-31",
    shipmentCode: "SHP-1",
    ...over,
  } as PortalInvoiceRow;
}

describe("formateo", () => {
  it("montoConMoneda pone el código delante y siempre dos decimales", () => {
    expect(montoConMoneda(1234.5, "USD")).toBe("USD 1,234.50");
    expect(montoConMoneda(0, "VES")).toBe("VES 0.00");
  });

  it("un saldo negativo (sobrepago) se imprime con su signo, no en positivo", () => {
    // Redondearlo a positivo le diría al cliente que debe plata que ya pagó.
    expect(montoConMoneda(-250, "USD")).toBe("USD -250.00");
  });

  it("fechaCorta pasa de ISO a día/mes/año y tolera el hueco", () => {
    expect(fechaCorta("2026-08-24")).toBe("24/08/2026");
    expect(fechaCorta(null)).toBe("—");
  });
});

describe("contrato: el papel sale del MISMO ledger que la pantalla", () => {
  it("los totales del documento son los que devuelve buildStatementLedger", () => {
    const facturas = [
      inv({ id: "a", code: "F-1", total: 1000, paid: 400 }),
      inv({ id: "b", code: "F-2", total: 600 }),
    ];
    const ledger = buildStatementLedger(facturas);

    // El documento no recalcula: lo que imprime es esto.
    expect(ledger.totalCargo).toBe(1600);
    expect(ledger.totalAbono).toBe(400);
    expect(ledger.balance).toBe(1200);
    expect(montoConMoneda(ledger.balance, ledger.currency)).toBe("USD 1,200.00");
  });

  it("una cuenta sin facturas da un ledger vacío y saldo 0 (no explota)", () => {
    const ledger = buildStatementLedger([]);
    expect(ledger.moves).toEqual([]);
    expect(ledger.balance).toBe(0);
    expect(montoConMoneda(ledger.balance, ledger.currency)).toBe("USD 0.00");
  });

  it("🔴 con dos monedas el ledger avisa — y el papel tiene que decirlo", () => {
    // Si el documento no imprimiera este aviso, parecería el total de la cuenta
    // cuando es sólo una parte.
    const ledger = buildStatementLedger([
      inv({ id: "a", code: "F-1", currency: "USD", total: 100 }),
      inv({ id: "b", code: "F-2", currency: "VES", total: 900 }),
    ]);
    expect(ledger.mixedCurrencies).toBe(true);
    expect(ledger.currency).toBe("VES");
  });

  it("el saldo corrido del último movimiento cuadra con el balance", () => {
    // Es la propiedad que hace legible un estado de cuenta: la última fila de la
    // columna Saldo tiene que ser el saldo total, o el papel no se puede seguir
    // con el dedo.
    const ledger = buildStatementLedger([
      inv({ id: "a", code: "F-1", total: 1000, paid: 400 }),
      inv({ id: "b", code: "F-2", total: 600, issuedAt: "2026-09-01", dueDate: "2026-09-30" }),
    ]);
    const ultimo = ledger.moves[ledger.moves.length - 1];
    expect(ultimo.balance).toBe(ledger.balance);
  });
});

describe("SDD-0556 · el papel con anuladas y la identidad del emisor", () => {
  function documento(facturas: PortalInvoiceRow[], emisor?: EstadoDeCuentaEmisor) {
    return EstadoDeCuentaDocument({
      input: {
        clientName: "Cliente Sintético",
        markbox: "DTD-0000",
        ledger: buildStatementLedger(facturas),
        emitidoEl: "2026-10-18",
      },
      emisor,
    });
  }

  function emisorLines(doc: ReactNode): unknown {
    const membrete = elementos(doc).find((el) => el.type === Membrete);
    return membrete?.props.emisorLines;
  }

  it("con razón social y RIF, el membrete los lleva en un renglón", () => {
    const doc = documento([inv()], { ...EMISOR, legalName: "Razón Sintética, C.A.", rif: "J-00000000-1" });
    expect(emisorLines(doc)).toEqual(["Razón Sintética, C.A. · RIF J-00000000-1"]);
  });

  it("sin razón social ni RIF (como hoy pasa la ruta), el membrete no inventa nada", () => {
    expect(emisorLines(documento([inv()], EMISOR))).toEqual([]);
    expect(emisorLines(documento([inv()]))).toEqual([]);
  });

  it("los pagos en anuladas se informan con el MISMO texto que la pantalla", () => {
    const t = textos(
      documento([
        inv({ id: "a", code: "F-1", total: 1000 }),
        inv({ id: "b", code: "F-2", status: "anulada", total: 500, paid: 200 }),
      ]),
    );
    expect(t).toContain(
      "Recibimos USD 200.00 en pagos de facturas que después se anularon (F-2). " +
        "No se descuentan de tu saldo pendiente: escríbele a tu asesor para aplicarlos a otra factura o pedir su devolución.",
    );
    // La anulada sale en el libro, en 0.
    expect(t).toContain("Factura F-2 · anulada");
  });

  it("sin pagos en anuladas no hay aviso", () => {
    const t = textos(documento([inv({ id: "a", code: "F-1", total: 1000 })]));
    expect(t.some((s) => s.includes("facturas que después se anularon"))).toBe(false);
  });

  it("con un sobrepago, el papel explica lo pagado de más con el MISMO texto que la pantalla", () => {
    const t = textos(
      documento([
        inv({ id: "a", code: "F-1", status: "pagada", total: 100, paid: 120 }),
        inv({ id: "b", code: "F-2", total: 200 }),
      ]),
    );
    // Saldo neto 180 y la nota de los 20.
    expect(t).toContain("USD 180.00");
    expect(t).toContain(
      "Este saldo ya descuenta USD 20.00 pagados de más en facturas ya pagadas. Mientras no se apliquen, lo que falta pagar es USD 200.00: escríbele a tu asesor para aplicarlos a otra factura o pedir su devolución.",
    );
  });

  it("sin sobrepagos no hay esa nota", () => {
    const t = textos(documento([inv({ id: "a", code: "F-1", total: 1000, paid: 400 })]));
    expect(t.some((s) => s.includes("pagados de más"))).toBe(false);
  });
});

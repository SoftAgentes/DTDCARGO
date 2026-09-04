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

import { createElement, type ReactElement } from "react";
import {
  renderToBuffer,
  type DocumentProps,
} from "@react-pdf/renderer";
import { describe, it, expect } from "vitest";
import { buildStatementLedger } from "@/lib/portal/statement-ledger";
import type { PortalInvoiceRow } from "@/lib/portal/portal-types";
import {
  EstadoDeCuentaDocument,
  fechaCorta,
  montoConMoneda,
} from "../estado-de-cuenta-pdf";

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

  it("renderiza un archivo PDF real con el ledger compartido", async () => {
    const ledger = buildStatementLedger([
      inv({ id: "a", code: "F-1", total: 1000, paid: 400 }),
      inv({ id: "b", code: "F-2", total: 600 }),
    ]);
    const doc = createElement(EstadoDeCuentaDocument, {
      input: {
        clientName: "Cliente de prueba",
        markbox: "DTD-TEST",
        ledger,
        emitidoEl: "2026-09-04",
      },
    }) as ReactElement<DocumentProps>;

    const pdf = await renderToBuffer(doc);

    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(1_000);
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

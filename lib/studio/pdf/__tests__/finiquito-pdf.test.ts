// @vitest-environment node
// El PDF se genera en el servidor (Node). Con @react-pdf 4.9, jsdom resuelve el build de navegador y el PDF sale corrupto (SDD-0656 A2).
import { describe, it, expect } from "vitest";
import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { FiniquitoDocument } from "../finiquito-pdf";
import type { Settlement, SettlementLine } from "@/lib/studio/nomina/settlement-types";
import { inflateSync } from "node:zlib";

/**
 * Integridad del PDF (SDD-0656 A2). La cabecera %PDF- sola no detecta un PDF
 * dañado: con @react-pdf 4.9 bajo jsdom salía con la cabecera y el %%EOF bien,
 * pero con el `/Length` de cada stream distinto de sus bytes y el contenido
 * comprimido roto. Aquí: termina en %%EOF, cada `stream` tiene su `endstream`,
 * cada `/Length` coincide con los bytes del stream y cada stream se descomprime.
 * Todo stream tiene que tener su `/Length`: si ninguno hiciera match, el ciclo
 * no comprobaría nada y la prueba pasaría vacía (revisión de #643).
 */
function expectPdfIntegro(buffer: Buffer) {
  const raw = buffer.toString("latin1");
  expect(raw.trimEnd().endsWith("%%EOF")).toBe(true);
  const streams = raw.match(/(?<!end)stream\r?\n/g)?.length ?? 0;
  const endstreams = raw.match(/endstream/g)?.length ?? 0;
  expect(streams).toBeGreaterThan(0);
  expect(endstreams).toBe(streams);
  const conLength = /\/Length (\d+)[^]*?(?<!end)stream\r?\n/g;
  let m: RegExpExecArray | null;
  let conLengthVistos = 0;
  while ((m = conLength.exec(raw))) {
    conLengthVistos++;
    const inicio = m.index + m[0].length;
    const declarado = Number(m[1]);
    expect(raw.slice(inicio + declarado).trimStart().startsWith("endstream")).toBe(true);
    if (/\/FlateDecode/.test(m[0])) {
      expect(() => inflateSync(buffer.subarray(inicio, inicio + declarado))).not.toThrow();
    }
  }
  expect(conLengthVistos).toBe(streams);
}

function mockSettlement(over: Partial<Settlement> = {}): Settlement {
  return {
    id: "s1",
    tenant_id: "t1",
    settlement_code: "LIQ-0001",
    employee_id: "e1",
    employee_code: "EMP-0001",
    employee_name: "Pedro Pérez",
    termination_cause: "despido_injustificado_92",
    hire_date: "2024-01-15",
    termination_date: "2026-06-30",
    base_salary_usd: 500,
    rules_snapshot: {},
    status: "confirmado",
    total_prestaciones_usd: 1200,
    total_fracciones_usd: 300,
    total_indemnizacion_usd: 1200,
    total_intereses_usd: 50,
    total_deductions_usd: 100,
    total_net_usd: 2650,
    salario_integral_usd: 600,
    pdf_path: null,
    journal_entry_id: null,
    confirmed_at: "2026-06-30T00:00:00Z",
    notes: null,
    created_by: null,
    created_at: "2026-06-30T00:00:00Z",
    updated_at: "2026-06-30T00:00:00Z",
    deleted_at: null,
    ...over,
  };
}

const mockLines: SettlementLine[] = [
  { kind: "prestaciones", label: "Prestaciones (garantía)", days: 90, base_usd: 600, amount_usd: 1200 },
  { kind: "indemnizacion_92", label: "Indemnización Art. 92", days: null, base_usd: 600, amount_usd: 1200 },
  { kind: "deduccion_prestamo", label: "Saldo de préstamo", days: null, base_usd: null, amount_usd: -100 },
];

describe("FiniquitoDocument", () => {
  it("renderiza a un PDF (Buffer con cabecera %PDF-)", async () => {
    const doc = createElement(FiniquitoDocument, {
      settlement: mockSettlement(),
      lines: mockLines,
    }) as ReactElement<DocumentProps>;
    const buffer = await renderToBuffer(doc);
    expect(buffer.length).toBeGreaterThan(0);
    expectPdfIntegro(buffer);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  }, 20000);

  it("renderiza sin throw con desglose vacío", async () => {
    const doc = createElement(FiniquitoDocument, {
      settlement: mockSettlement({ total_fracciones_usd: 0, total_indemnizacion_usd: 0, total_intereses_usd: 0, total_deductions_usd: 0 }),
      lines: [],
    }) as ReactElement<DocumentProps>;
    const buffer = await renderToBuffer(doc);
    expect(buffer.length).toBeGreaterThan(0);
    expectPdfIntegro(buffer);
  }, 20000);
});

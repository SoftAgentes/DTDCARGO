// @vitest-environment node
// El PDF se genera en el servidor (Node). Con @react-pdf 4.9, jsdom resuelve el build de navegador y el PDF sale corrupto (SDD-0656 A2).
import { describe, it, expect } from "vitest";
import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { buildPayslipLines, ReciboDocument } from "../recibo-pdf";
import type { MyPayslip } from "@/lib/studio/nomina/employee-self-queries";
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

function mockPayslip(over: Partial<MyPayslip> = {}): MyPayslip {
  return {
    line_id: "l1",
    run_id: "r1",
    period_label: "2026-06",
    run_status: "confirmado",
    paid_at: null,
    confirmed_at: "2026-06-30T00:00:00Z",
    employee_code: "EMP-0001",
    employee_name: "Pedro Pérez",
    base_salary_usd: 500,
    worked_days: 30,
    overtime_hours: 0,
    night_hours: 0,
    overtime_pay_usd: 0,
    night_pay_usd: 0,
    loan_deduction_usd: 50,
    statutory_deductions_usd: 25,
    gross_usd: 500,
    total_deductions_usd: 75,
    net_usd: 425,
    breakdown: [],
    ...over,
  };
}

describe("buildPayslipLines", () => {
  it("usa el fallback de columnas cuando breakdown está vacío", () => {
    const lines = buildPayslipLines(mockPayslip());
    const labels = lines.map((l) => l.label);
    expect(labels).toContain("Sueldo base");
    expect(labels).toContain("Deducciones de ley (SSO/RPE/FAOV)");
    expect(labels).toContain("Cuota de préstamo");
    // las deducciones entran negativas
    const dedLey = lines.find((l) => l.label.startsWith("Deducciones de ley"))!;
    expect(dedLey.amount).toBe(-25);
    expect(dedLey.kind).toBe("deduction");
  });

  it("prioriza el breakdown del renglón si existe", () => {
    const lines = buildPayslipLines(
      mockPayslip({
        breakdown: [
          { label: "Sueldo", amount: 600 },
          { label: "SSO", amount: -30 },
          { label: "sin monto" }, // se ignora (amount no numérico)
        ],
      }),
    );
    expect(lines.find((l) => l.label === "Sueldo")?.amount).toBe(600);
    expect(lines.find((l) => l.label === "SSO")?.kind).toBe("deduction");
    expect(lines.some((l) => l.label === "sin monto")).toBe(false);
  });

  it("siempre cierra con el Neto a cobrar (kind total = net_usd)", () => {
    const lines = buildPayslipLines(mockPayslip({ net_usd: 425 }));
    const last = lines[lines.length - 1];
    expect(last.label).toBe("Neto a cobrar");
    expect(last.kind).toBe("total");
    expect(last.amount).toBe(425);
  });
});

describe("ReciboDocument", () => {
  it("renderiza a un PDF (Buffer no vacío)", async () => {
    const doc = createElement(ReciboDocument, { payslip: mockPayslip() }) as ReactElement<DocumentProps>;
    const buffer = await renderToBuffer(doc);
    expect(buffer.length).toBeGreaterThan(0);
    expectPdfIntegro(buffer);
    // cabecera de un PDF
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  }, 20000);
});

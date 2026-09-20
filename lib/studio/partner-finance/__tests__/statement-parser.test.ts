// @vitest-environment node
/**
 * Tests del parser CSV de estado de cuenta (SDD-0115 · Slice C4) — capa pura.
 *
 * Cubre: parseo CSV robusto (comillas, `;`, BOM, CRLF), detección de header,
 * heurística de mapeo por keyword (es/en/中文), parseo de monto con separadores
 * mixtos, normalización de moneda y fecha, y construcción de líneas.
 */

import { describe, it, expect } from "vitest";
import {
  parseCsv,
  parseStatementCsv,
  inferColumnMap,
  parseAmount,
  normalizeCurrency,
  normalizeDate,
  buildLinesFromRows,
} from "../statement-parser";

describe("parseCsv", () => {
  it("parsea comillas con comas embebidas y `\"\"` escapado", () => {
    const rows = parseCsv('a,"b, con coma","dijo ""hola"""\n1,2,3');
    expect(rows[0]).toEqual(["a", "b, con coma", 'dijo "hola"']);
    expect(rows[1]).toEqual(["1", "2", "3"]);
  });

  it("autodetecta `;` como delimitador (Excel es-ES)", () => {
    const rows = parseCsv("desc;monto;moneda\nFlete;1.234,56;USD");
    expect(rows[0]).toEqual(["desc", "monto", "moneda"]);
    expect(rows[1]).toEqual(["Flete", "1.234,56", "USD"]);
  });

  it("ignora BOM, CRLF y filas vacías", () => {
    const rows = parseCsv("﻿a,b\r\n1,2\r\n\r\n3,4\r\n");
    expect(rows).toEqual([["a", "b"], ["1", "2"], ["3", "4"]]);
  });
});

describe("parseAmount", () => {
  it("formato US 1,234.56", () => expect(parseAmount("1,234.56")).toBe(1234.56));
  it("formato EU 1.234,56", () => expect(parseAmount("1.234,56")).toBe(1234.56));
  it("con símbolo ¥ y espacios", () => expect(parseAmount(" ¥ 12.000,00 ")).toBe(12000));
  it("plano 1234.5", () => expect(parseAmount("1234.5")).toBe(1234.5));
  it("coma como miles 1,000", () => expect(parseAmount("1,000")).toBe(1000));
  it("negativo", () => expect(parseAmount("-50.00")).toBe(-50));
  it("vacío → 0", () => expect(parseAmount("")).toBe(0));
});

describe("normalizeCurrency", () => {
  it("RMB desde 元/¥/CNY", () => {
    expect(normalizeCurrency("¥")).toBe("RMB");
    expect(normalizeCurrency("CNY")).toBe("RMB");
    expect(normalizeCurrency("人民币")).toBe("RMB");
  });
  it("USDT antes que USD", () => expect(normalizeCurrency("USDT")).toBe("USDT"));
  it("VES desde Bs", () => expect(normalizeCurrency("Bs.")).toBe("VES"));
  it("default USD", () => expect(normalizeCurrency("")).toBe("USD"));
});

describe("normalizeDate", () => {
  it("YYYY-MM-DD", () => expect(normalizeDate("2026-03-05")).toBe("2026-03-05"));
  it("YYYY/M/D pad", () => expect(normalizeDate("2026/3/5")).toBe("2026-03-05"));
  it("DD/MM/YYYY → ISO", () => expect(normalizeDate("05/03/2026")).toBe("2026-03-05"));
  it("desconocida → null", () => expect(normalizeDate("marzo")).toBeNull());
});

describe("parseStatementCsv + inferColumnMap", () => {
  it("detecta header y mapea por keyword (es)", () => {
    const parsed = parseStatementCsv(
      "Fecha,Concepto,Monto,Moneda\n2026-03-01,Flete LCL,1500.00,USD",
    );
    expect(parsed.hasHeader).toBe(true);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.suggestedMap.date).toBe(0);
    expect(parsed.suggestedMap.description).toBe(1);
    expect(parsed.suggestedMap.amount).toBe(2);
    expect(parsed.suggestedMap.currency).toBe(3);
  });

  it("mapea headers en chino", () => {
    const map = inferColumnMap(["日期", "摘要", "金额", "币种"]);
    expect(map.date).toBe(0);
    expect(map.description).toBe(1);
    expect(map.amount).toBe(2);
    expect(map.currency).toBe(3);
  });

  it("sin header: infiere por contenido (texto→desc, num→monto)", () => {
    const parsed = parseStatementCsv("Flete LCL,1500.00\nSeguro,80.00");
    expect(parsed.hasHeader).toBe(false);
    expect(parsed.headers).toEqual(["Columna 1", "Columna 2"]);
    expect(parsed.suggestedMap.description).toBe(0);
    expect(parsed.suggestedMap.amount).toBe(1);
  });
});

describe("buildLinesFromRows", () => {
  it("arma líneas y descarta filas basura", () => {
    const rows = [
      ["2026-03-01", "Flete LCL", "1.500,00", "USD"],
      ["", "", "", ""], // basura → descartada
      ["05/03/2026", "Comisión", "¥700", "CNY"],
    ];
    const lines = buildLinesFromRows(rows, {
      date: 0,
      description: 1,
      amount: 2,
      currency: 3,
      descriptionCn: null,
    });
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({
      raw_description: "Flete LCL",
      raw_description_cn: null,
      amount: 1500,
      currency: "USD",
      line_date: "2026-03-01",
    });
    expect(lines[1].currency).toBe("RMB");
    expect(lines[1].amount).toBe(700);
    expect(lines[1].line_date).toBe("2026-03-05");
  });

  it("usa defaultCurrency cuando no hay columna de moneda", () => {
    const lines = buildLinesFromRows(
      [["Flete", "100"]],
      { date: null, description: 0, amount: 1, currency: null, descriptionCn: null },
      "RMB",
    );
    expect(lines[0].currency).toBe("RMB");
  });
});

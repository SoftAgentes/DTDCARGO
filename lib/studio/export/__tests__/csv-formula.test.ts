import { describe, expect, it } from "vitest";
import { buildCsv, csvCell } from "../csv";

describe("csvCell · neutralización de fórmulas", () => {
  it.each([
    [
      "=HYPERLINK(\"https://example.test\")",
      "\"'=HYPERLINK(\"\"https://example.test\"\")\"",
    ],
    ["+CMD()", "'+CMD()"],
    ["-CMD()", "'-CMD()"],
    ["@SUM(A1:A2)", "'@SUM(A1:A2)"],
    ["\t=1+1", "'\t=1+1"],
    ["\r=1+1", "\"'\r=1+1\""],
  ])("fuerza a texto %j", (value, expected) => {
    expect(csvCell(value)).toBe(expected);
  });

  it.each([
    [-100, "-100"],
    [42.5, "42.5"],
    ["-250.5", "-250.5"],
    ["+58", "+58"],
  ])("conserva el número %j", (value, expected) => {
    expect(csvCell(value)).toBe(expected);
  });

  it("neutraliza antes de escapar RFC 4180", () => {
    expect(csvCell("=SUM(A1,A2)")).toBe("\"'=SUM(A1,A2)\"");
    expect(csvCell('=\"hola\"')).toBe("\"'=\"\"hola\"\"\"");
  });

  it("buildCsv aplica la protección a cabeceras y filas", () => {
    const csv = buildCsv(["Nombre", "Nota"], [["Proveedor", "=2+2"]]);
    expect(csv).toBe("﻿Nombre,Nota\r\nProveedor,'=2+2");
  });
});

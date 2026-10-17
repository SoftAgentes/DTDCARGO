/**
 * SDD-0543 · Lectores de Excel sobre libros armados en un directorio temporal
 * con ExcelJS. Marcas, nombres y descripciones inventados.
 */
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fechaIso, leerPacking, leerRastreo, numeroDeEtiqueta, texto } from "../consolidados/leer-excel";

let dir: string;
let rastreo: string;
let packing: string;

async function armarRastreo(ruta: string): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("DTD");
  ws.getRow(2).getCell(2).value = "CONTENEDORES EN TRANSITO DTD";
  ws.getRow(3).values = [
    undefined,
    "# CONTENEDOR", "FCL/DDP", "NOMBRE PUERTO", "FECHA DE CARGA", "NRO DE CONTENEDOR", "PRECINTO",
    "EMPRESA", "LLEGA A PUERTO", "FECHA APROX. DE LLEGADA", "LINK RASTREO",
  ];
  ws.getRow(4).values = [undefined, "DTD #13", undefined, "CONTENEDOR PRUEBA", "13 DE JULIO", "ABCU1111111", "A1", "ZIM", "LA GUAIRA", "28 DE AGOSTO"];
  ws.getRow(5).values = [undefined, "DTD#59", "DDP", "YIWU", new Date(Date.UTC(2026, 7, 11)), "abcu 5488081", undefined, "CMA CGM", "la guaira", new Date(Date.UTC(2026, 9, 15))];
  ws.getRow(5).getCell(11).value = { text: "LINK DE RASTREO", hyperlink: "https://example.test/tracking" };
  ws.getRow(6).values = [undefined, "HR-DTD#60", "FCL/DDP 5.70cbm", "YIWU", "20-APR-2026", "FFAU8030200", undefined, "MSK", "Maracaibo", "13/09/26"];
  ws.getRow(7).values = [undefined, "DTD#61", "FCL", "YIWU", 45086, "MRSU9497682", undefined, "MSK", "Barranquilla"];
  ws.getRow(8).values = [undefined, "DTD#61", "FCL", "YIWU", 45086, "MRSU9497682", undefined, "MSK", "Barranquilla"];
  await wb.xlsx.writeFile(ruta);
}

async function armarPacking(ruta: string): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Hoja1");
  ws.getRow(2).getCell(1).value = "CONTENEDOR DTD # 59 YW: AGOSTO 2026 SALIDA";
  ws.getRow(3).values = [
    "marca de la caja", "Remitente", "Descripciones de paquetes", "cajas", "Peso (kg)", "CBM\nCHINA", "CBM A \nFACTURA",
    "PESO ACORDADO", "CANTIDAD KGS PERMITIDO", "EXTRA PESO", "CONSOLIDADO KG EXTRA", "PRECIO\nX\nKG EXTRA", "VALOR $\nKG EXTRA",
    "COSTO\nCLIENTE", "PRECIO VENTA \nCBM", "TOTAL \nFACTURADO", "Agente", "GANANCIA POR ENVIO",
  ];
  ws.getRow(4).values = ["DTD-J031 PRUEBA PLÁSTICOS", "DTD-J031-05", { richText: [{ text: "Máquina " }, { text: "recta" }] }, 1, 137, 1.134, 1.134, 500, 567, 0, -430, 1, -430, 500, 800, { formula: "G4*O4", result: 907.2 }, "(DTD-X) Agente Prueba", 400];
  ws.getRow(5).values = ["DTD-A116 CLIENTE UNO", "DTD-A116-06", "Alternator", "10", "141", "0,5", "0,5", 500, 250, 0, -109, 0.8, -87.2, 300, 750, 375, "(DTD-X) Agente Prueba", 75];
  ws.getRow(6).values = ["ALIADO PRUEBA MM", "MM-41", "Cajas", 8, undefined, 0.96, 0.96, 500, 480, 0, -480, 1, -480, 500, 630, 604.8, "(DTD-X) Agente Prueba", 100];
  ws.getRow(7).values = ["ALIADO PRUEBA TJ", undefined, undefined, 19, 278, 2.594, 2.594];
  ws.getRow(9).values = [undefined, { formula: "SUM(B4:B7)", result: 0 }, undefined, 15, 416, 1.222];
  await wb.xlsx.writeFile(ruta);
}

beforeAll(async () => {
  dir = mkdtempSync(path.join(os.tmpdir(), "consolidados-"));
  rastreo = path.join(dir, "rastreo.xlsx");
  packing = path.join(dir, "packing.xlsx");
  await armarRastreo(rastreo);
  await armarPacking(packing);
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("celdas", () => {
  it("texto lee richText, fórmulas e hipervínculos", () => {
    expect(texto({ richText: [{ text: "a" }, { text: "b" }] })).toBe("ab");
    expect(texto({ formula: "A1", result: 12 })).toBe("12");
    expect(texto({ text: "LINK", hyperlink: "https://example.test" })).toBe("LINK");
    expect(texto(null)).toBe("");
  });
  it("fechaIso entiende fechas, seriales y los textos del rastreo", () => {
    expect(fechaIso(new Date(Date.UTC(2026, 7, 11)))).toBe("2026-08-11");
    expect(fechaIso(45086)).toBe("2023-06-09");
    expect(fechaIso("07-AUG-2025")).toBe("2025-08-07");
    expect(fechaIso("20-APR-2026")).toBe("2026-04-20");
    expect(fechaIso("13/09/23")).toBe("2023-09-13");
    expect(fechaIso("2026-09-03")).toBe("2026-09-03");
    expect(fechaIso("13 DE JULIO")).toBeNull();
    expect(fechaIso("LINK")).toBeNull();
    expect(fechaIso("31/02/2026")).toBeNull();
  });
  it("numeroDeEtiqueta saca el número después de #", () => {
    expect(numeroDeEtiqueta("DTD #13")).toBe(13);
    expect(numeroDeEtiqueta("HR-DTD#60")).toBe(60);
    expect(numeroDeEtiqueta("DTD-9038 FCL-2#63")).toBe(63);
    expect(numeroDeEtiqueta("DTD #53HERNECA/DTD")).toBe(53);
    expect(numeroDeEtiqueta("sin numero")).toBeNull();
  });
});

describe("leerRastreo", () => {
  it("encuentra la fila del contenedor por su número y normaliza lo que trae", async () => {
    const r = await leerRastreo(rastreo, 59);
    expect(r).toMatchObject({
      numero: 59,
      etiqueta: "DTD#59",
      modalidad: "DDP",
      puertoCarga: "YIWU",
      fechaCarga: "2026-08-11",
      contenedor: "ABCU5488081",
      naviera: "CMA CGM",
      puertoLlegada: "la guaira",
      etaExcel: "2026-10-15",
      link: "https://example.test/tracking",
      filaExcel: 5,
    });
  });
  it("lee fechas en texto y deja null lo ilegible", async () => {
    const r60 = await leerRastreo(rastreo, 60);
    expect(r60.fechaCarga).toBe("2026-04-20");
    expect(r60.etaExcel).toBe("2026-09-13");
    const r13 = await leerRastreo(rastreo, 13);
    expect(r13.fechaCarga).toBeNull();
  });
  it("rechaza contenedores ausentes o repetidos", async () => {
    await expect(leerRastreo(rastreo, 99)).rejects.toThrow(/#99/);
    await expect(leerRastreo(rastreo, 61)).rejects.toThrow(/2 filas/);
  });
});

describe("leerPacking", () => {
  it("lee las filas con remitente, acepta coma decimal y números como texto", async () => {
    const p = await leerPacking(packing);
    expect(p.numeroTitulo).toBe(59);
    expect(p.avisos).toEqual([]);
    expect(p.filas.map((f) => f.remitente)).toEqual(["DTD-J031-05", "DTD-A116-06", "MM-41", ""]);
    expect(p.filas[0]).toMatchObject({ filaExcel: 4, marcaTexto: "DTD-J031 PRUEBA PLÁSTICOS", descripcion: "Máquina recta", cajas: 1, pesoKg: 137, cbmFactura: 1.134, totalFacturado: 907.2, precioCbm: 800, extraKg: -430 });
    expect(p.filas[1]).toMatchObject({ cajas: 10, pesoKg: 141, cbmChina: 0.5, cbmFactura: 0.5, precioKgExtra: 0.8 });
    expect(p.filas[2]).toMatchObject({ marcaTexto: "ALIADO PRUEBA MM", pesoKg: 0, cbmFactura: 0.96 });
    // La fila de totales trae marca pero no remitente: llega y el modelo la descarta con aviso.
    expect(p.filas[3]).toMatchObject({ filaExcel: 7, marcaTexto: "ALIADO PRUEBA TJ", remitente: "", cajas: 19 });
  });
  it("falla si no hay encabezados reconocibles", async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("x").getRow(1).values = ["a", "b"];
    const ruta = path.join(dir, "sin-encabezados.xlsx");
    await wb.xlsx.writeFile(ruta);
    await expect(leerPacking(ruta)).rejects.toThrow(/encabezados/);
  });
});

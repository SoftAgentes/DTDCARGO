/**
 * SDD-0543 · Lectores de los dos Excel del almacén de Yiwu (ExcelJS).
 *
 *  - `leerRastreo`: hoja «DTD» de «DTD RASTREO DE CONTENEDORES.xlsx», una fila por
 *    contenedor; se busca la fila cuyo «# CONTENEDOR» termina en `#<numero>`.
 *  - `leerPacking`: «NUEVO FORMATO CONTENEDOR NN.xlsx», encabezados en la fila 3
 *    (se localizan por texto, no por posición) y una fila por producto.
 *
 * Los archivos son datos ajenos: se leen por ruta pasada como argumento, nunca
 * desde el repo, y nada de lo que traen se ejecuta.
 */
import ExcelJS from "exceljs";
import type { FilaPacking, Rastreo } from "./modelo";
import { normalizarCodigo } from "./modelo";

const SERIAL_EXCEL_BASE = Date.UTC(1899, 11, 30);
const MESES: Record<string, number> = {
  ENE: 1, ENERO: 1, JAN: 1,
  FEB: 2, FEBRERO: 2,
  MAR: 3, MARZO: 3,
  ABR: 4, ABRIL: 4, APR: 4,
  MAY: 5, MAYO: 5,
  JUN: 6, JUNIO: 6,
  JUL: 7, JULIO: 7,
  AGO: 8, AGOSTO: 8, AUG: 8,
  SEP: 9, SEPT: 9, SEPTIEMBRE: 9, SET: 9,
  OCT: 10, OCTUBRE: 10,
  NOV: 11, NOVIEMBRE: 11,
  DIC: 12, DICIEMBRE: 12, DEC: 12,
};

type Celda = ExcelJS.CellValue;

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** Texto visible de una celda: richText, fórmula (su resultado), hipervínculo o valor plano. */
export function texto(v: Celda): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (esObjeto(v)) {
    if (Array.isArray(v.richText)) return (v.richText as { text: string }[]).map((r) => r.text).join("").trim();
    if ("result" in v) return texto(v.result as Celda);
    if ("hyperlink" in v) return String(v.text ?? v.hyperlink ?? "").trim();
    if ("error" in v) return "";
    return "";
  }
  return String(v).replace(/\s+/g, " ").trim();
}

/** Hipervínculo de una celda, si lo tiene. */
export function enlace(v: Celda): string | null {
  if (esObjeto(v) && typeof v.hyperlink === "string") return v.hyperlink;
  return null;
}

/** Número de una celda; coma decimal aceptada; fórmula sin resultado = 0. */
export function numero(v: Celda): number {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (esObjeto(v) && "result" in v) return numero(v.result as Celda);
  const t = texto(v).replace(/\s/g, "").replace(",", ".");
  if (!t) return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

function iso(y: number, m: number, d: number): string | null {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCMonth() !== m - 1) return null;
  return t.toISOString().slice(0, 10);
}

/**
 * Fecha de una celda en ISO. Acepta celdas de fecha, seriales de Excel y los
 * textos que aparecen en el rastreo (`2026-08-11`, `07-AUG-2025`, `13/09/23`,
 * `20-APR-2026`). «13 DE JULIO» no trae año: devuelve null y el llamador pide
 * la fecha a mano.
 */
export function fechaIso(v: Celda): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    if (v < 30000 || v > 80000) return null;
    return new Date(SERIAL_EXCEL_BASE + Math.round(v) * 86_400_000).toISOString().slice(0, 10);
  }
  if (esObjeto(v) && "result" in v) return fechaIso(v.result as Celda);
  const t = texto(v).toUpperCase();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]));
  m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return iso(y, Number(m[2]), Number(m[1]));
  }
  m = t.match(/^(\d{1,2})[-/ ](?:DE )?([A-ZÑ]{3,10})[-/ ](?:DE )?(\d{4})\b/);
  if (m && MESES[m[2]]) return iso(Number(m[3]), MESES[m[2]], Number(m[1]));
  return null;
}

/** Encabezado normalizado: minúsculas, sin acentos ni saltos, espacios simples. */
export function clave(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function mapaEncabezados(fila: ExcelJS.Row): Map<string, number> {
  const mapa = new Map<string, number>();
  fila.eachCell({ includeEmpty: false }, (c, col) => {
    const k = clave(texto(c.value));
    if (k && !mapa.has(k)) mapa.set(k, col);
  });
  return mapa;
}

function columna(mapa: Map<string, number>, ...nombres: string[]): number | null {
  for (const n of nombres) {
    const k = clave(n);
    const exacta = mapa.get(k);
    if (exacta) return exacta;
    for (const [h, col] of mapa) if (h.startsWith(k)) return col;
  }
  return null;
}

async function abrir(ruta: string): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(ruta);
  return wb;
}

/** Número del contenedor en «# CONTENEDOR» (`DTD#59`, `HR-DTD#60`, `MG-019#61`). */
export function numeroDeEtiqueta(etiqueta: string): number | null {
  const m = etiqueta.replace(/\s+/g, "").match(/#(\d{1,4})(?!\d)/);
  return m ? Number(m[1]) : null;
}

export async function leerRastreo(ruta: string, numeroContenedor: number): Promise<Rastreo> {
  const wb = await abrir(ruta);
  const ws = wb.getWorksheet("DTD") ?? wb.worksheets[0];
  if (!ws) throw new Error("El rastreo no tiene hojas.");
  let encabezados: Map<string, number> | null = null;
  let filaEnc = 0;
  for (let i = 1; i <= Math.min(10, ws.rowCount); i++) {
    const m = mapaEncabezados(ws.getRow(i));
    if (columna(m, "# contenedor") && columna(m, "nro de contenedor")) {
      encabezados = m;
      filaEnc = i;
      break;
    }
  }
  if (!encabezados) throw new Error("No encontré la fila de encabezados del rastreo («# CONTENEDOR», «NRO DE CONTENEDOR»).");
  const col = (...n: string[]) => columna(encabezados!, ...n);
  const cEtiqueta = col("# contenedor")!;
  const cModalidad = col("fcl/ddp");
  const cPuerto = col("nombre puerto");
  const cCarga = col("fecha de carga");
  const cNro = col("nro de contenedor")!;
  const cPrecinto = col("precinto");
  const cEmpresa = col("empresa");
  const cLlega = col("llega a puerto");
  const cEta = col("fecha aprox. de llegada", "fecha aprox de llegada");
  const cLink = col("link rastreo", "link de rastreo");

  const candidatas: Rastreo[] = [];
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n <= filaEnc) return;
    const etiqueta = texto(row.getCell(cEtiqueta).value);
    if (numeroDeEtiqueta(etiqueta) !== numeroContenedor) return;
    const celda = (c: number | null) => (c ? texto(row.getCell(c).value) : "");
    const valor = (c: number | null) => (c ? row.getCell(c).value : null);
    candidatas.push({
      numero: numeroContenedor,
      etiqueta,
      modalidad: celda(cModalidad) || null,
      puertoCarga: celda(cPuerto) || null,
      fechaCarga: fechaIso(valor(cCarga)),
      contenedor: normalizarCodigo(celda(cNro)),
      precinto: celda(cPrecinto) || null,
      naviera: celda(cEmpresa) || null,
      puertoLlegada: celda(cLlega) || null,
      etaExcel: fechaIso(valor(cEta)),
      link: enlace(valor(cLink)),
      filaExcel: n,
    });
  });
  if (candidatas.length === 0) throw new Error(`El rastreo no tiene ninguna fila con «#${numeroContenedor}».`);
  if (candidatas.length > 1) {
    throw new Error(`El rastreo tiene ${candidatas.length} filas con «#${numeroContenedor}» (filas ${candidatas.map((c) => c.filaExcel).join(", ")}).`);
  }
  const r = candidatas[0];
  if (!r.contenedor) throw new Error(`La fila ${r.filaExcel} del rastreo no trae número de contenedor.`);
  return r;
}

export interface PackingLeido {
  filas: FilaPacking[];
  /** Número de contenedor que dice el título del packing list, si se lee. */
  numeroTitulo: number | null;
  avisos: string[];
}

export async function leerPacking(ruta: string): Promise<PackingLeido> {
  const wb = await abrir(ruta);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("El packing list no tiene hojas.");
  const avisos: string[] = [];

  let numeroTitulo: number | null = null;
  let encabezados: Map<string, number> | null = null;
  let filaEnc = 0;
  for (let i = 1; i <= Math.min(10, ws.rowCount); i++) {
    const fila = ws.getRow(i);
    const t = texto(fila.getCell(1).value);
    const mt = t.toUpperCase().match(/CONTENEDOR\s+DTD\s*#\s*(\d{1,4})/);
    if (mt && numeroTitulo == null) numeroTitulo = Number(mt[1]);
    const m = mapaEncabezados(fila);
    if (columna(m, "marca de la caja") && columna(m, "remitente")) {
      encabezados = m;
      filaEnc = i;
      break;
    }
  }
  if (!encabezados) throw new Error("No encontré la fila de encabezados del packing list («marca de la caja», «Remitente»).");
  const col = (...n: string[]) => columna(encabezados!, ...n);
  const c = {
    marca: col("marca de la caja")!,
    remitente: col("remitente")!,
    descripcion: col("descripciones de paquetes", "descripcion"),
    cajas: col("cajas"),
    peso: col("peso (kg)", "peso"),
    cbmChina: col("cbm china"),
    cbmFactura: col("cbm a factura", "cbm a facturar"),
    extraKg: col("consolidado kg extra"),
    precioKgExtra: col("precio x kg extra"),
    valorKgExtra: col("valor $ kg extra", "valor kg extra"),
    precioCbm: col("precio venta cbm"),
    total: col("total facturado"),
    agente: col("agente"),
  };
  for (const [k, v] of Object.entries(c)) {
    if (v == null) avisos.push(`El packing list no trae la columna «${k}»; se asume 0 o vacío.`);
  }
  const filas: FilaPacking[] = [];
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n <= filaEnc) return;
    const v = (col: number | null) => (col ? row.getCell(col).value : null);
    const marcaTexto = texto(v(c.marca));
    const remitente = normalizarCodigo(texto(v(c.remitente)));
    if (!marcaTexto && !remitente) return;
    filas.push({
      filaExcel: n,
      marcaTexto,
      remitente,
      descripcion: texto(v(c.descripcion)),
      cajas: Math.round(numero(v(c.cajas))),
      pesoKg: numero(v(c.peso)),
      cbmChina: numero(v(c.cbmChina)),
      cbmFactura: numero(v(c.cbmFactura)),
      extraKg: numero(v(c.extraKg)),
      precioKgExtra: numero(v(c.precioKgExtra)),
      valorKgExtra: numero(v(c.valorKgExtra)),
      precioCbm: numero(v(c.precioCbm)),
      totalFacturado: numero(v(c.total)),
      agente: texto(v(c.agente)),
    });
  });
  return { filas, numeroTitulo, avisos };
}

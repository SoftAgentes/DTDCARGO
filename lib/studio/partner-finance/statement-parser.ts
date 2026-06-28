/**
 * Parser de estado de cuenta CSV del Socio China (SDD-0115 · Slice C4).
 *
 * PURO y determinista: recibe el TEXTO ya leído (el FileReader vive en el
 * cliente), no hace I/O ni usa Date.now. Convierte el CSV heterogéneo del
 * Administrador China (columnas variables, descripciones en chino, montos con
 * separadores mixtos) en líneas que entran al flujo de match existente
 * (`reconcileStatement`). Reemplaza el tecleo línea por línea del
 * ImportStatementDrawer.
 *
 * Decisiones del spec §9: CSV-only (XLSX diferido, D3-bis) · mapeo per-upload
 * (no se persiste el column-map, D3) — la heurística sugiere y el operador
 * corrige antes de importar.
 */

import { PARTNER_CURRENCIES, type PartnerCurrency } from "./types";

/** Mapeo de qué columna del CSV es cada campo (índice de columna, o null). */
export type StatementColumnMap = {
  description: number | null;
  descriptionCn: number | null;
  amount: number | null;
  currency: number | null;
  date: number | null;
};

/** Resultado del parseo crudo del CSV. */
export type ParsedStatement = {
  /** Encabezados (fila 1 si se detectó header, o `Columna 1…N` sintéticos). */
  headers: string[];
  /** Filas de datos (sin el header). */
  rows: string[][];
  /** Si la 1ª fila se interpretó como encabezado. */
  hasHeader: boolean;
  /** Mapeo sugerido por heurística de headers (el operador lo confirma). */
  suggestedMap: StatementColumnMap;
};

/** Una línea ya mapeada, lista para el draft del drawer. */
export type ParsedLine = {
  raw_description: string;
  raw_description_cn: string | null;
  amount: number;
  currency: string;
  line_date: string | null;
};

// ── CSV split (RFC-4180-ish: comillas, comas embebidas, CRLF) ──────

/**
 * Parsea texto CSV a matriz de celdas. Soporta campos entre comillas dobles con
 * comas/saltos embebidos y `""` como comilla escapada. Autodetecta delimitador
 * coma vs punto-y-coma (Excel es-ES exporta con `;`). PURO.
 */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, ""); // saca BOM si Excel lo metió
  const delimiter = pickDelimiter(clean);
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];

    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch === "\r") {
      // ignorar; el \n siguiente cierra la fila
    } else {
      field += ch;
    }
  }
  // último campo/fila si el archivo no termina en newline
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Descartar filas totalmente vacías.
  return rows
    .map((r) => r.map((c) => c.trim()))
    .filter((r) => r.some((c) => c !== ""));
}

/** Elige delimitador: `;` si aparece más que `,` en la 1ª línea, sino `,`. */
function pickDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const semis = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return semis > commas ? ";" : ",";
}

// ── Heurística de mapeo de columnas ───────────────────────────────

const HEADER_HINTS: Record<keyof StatementColumnMap, string[]> = {
  description: ["desc", "concep", "detalle", "glosa", "narration", "摘要", "说明", "项目", "事项"],
  descriptionCn: ["中文", "chino", "描述", "备注"],
  amount: ["monto", "amount", "importe", "valor", "total", "debit", "credit", "金额", "金 额"],
  currency: ["moneda", "currency", "divisa", "curr", "币种", "货币"],
  date: ["fecha", "date", "día", "dia", "日期", "时间"],
};

const NUMERIC_CELL_RE = /^[-+]?[\d.,\s$¥€]*\d[\d.,\s$¥€]*$/;

/** ¿La celda parece un número (monto)? PURA. */
function looksNumeric(cell: string): boolean {
  const c = cell.trim();
  if (c === "") return false;
  return NUMERIC_CELL_RE.test(c) && /\d/.test(c);
}

/**
 * ¿La 1ª fila es encabezado? Sí si NINGUNA celda parece numérica (los headers
 * son texto) y hay al menos 2 columnas. PURA.
 */
function detectHeader(firstRow: string[]): boolean {
  if (firstRow.length < 2) return false;
  return !firstRow.some(looksNumeric);
}

/**
 * Sugiere el mapeo de columnas a partir de los headers (por keyword). Si no hay
 * header, infiere por contenido: 1ª columna textual → descripción, 1ª columna
 * numérica → monto. PURA.
 */
export function inferColumnMap(
  headers: string[],
  sampleRow: string[] = [],
): StatementColumnMap {
  const map: StatementColumnMap = {
    description: null,
    descriptionCn: null,
    amount: null,
    currency: null,
    date: null,
  };

  const norm = headers.map((h) => h.toLowerCase());
  const fields: (keyof StatementColumnMap)[] = [
    "date",
    "currency",
    "descriptionCn",
    "amount",
    "description",
  ];
  for (const field of fields) {
    const hints = HEADER_HINTS[field];
    const idx = norm.findIndex(
      (h, i) =>
        !Object.values(map).includes(i) &&
        hints.some((hint) => h.includes(hint)),
    );
    if (idx >= 0) map[field] = idx;
  }

  // Sin header útil: inferir por el contenido de una fila de muestra.
  if (map.amount == null && sampleRow.length > 0) {
    const numIdx = sampleRow.findIndex(looksNumeric);
    if (numIdx >= 0) map.amount = numIdx;
  }
  if (map.description == null && sampleRow.length > 0) {
    const txtIdx = sampleRow.findIndex(
      (c, i) => i !== map.amount && i !== map.date && c.trim() !== "" && !looksNumeric(c),
    );
    if (txtIdx >= 0) map.description = txtIdx;
  }

  return map;
}

/** Parsea el CSV completo: filas + detección de header + mapeo sugerido. PURA. */
export function parseStatementCsv(text: string): ParsedStatement {
  const matrix = parseCsv(text);
  if (matrix.length === 0) {
    return {
      headers: [],
      rows: [],
      hasHeader: false,
      suggestedMap: { description: null, descriptionCn: null, amount: null, currency: null, date: null },
    };
  }

  const hasHeader = detectHeader(matrix[0]);
  const colCount = Math.max(...matrix.map((r) => r.length));
  const headers = hasHeader
    ? padRow(matrix[0], colCount)
    : Array.from({ length: colCount }, (_, i) => `Columna ${i + 1}`);
  const rows = (hasHeader ? matrix.slice(1) : matrix).map((r) => padRow(r, colCount));
  const suggestedMap = inferColumnMap(hasHeader ? headers : [], rows[0] ?? []);

  return { headers, rows, hasHeader, suggestedMap };
}

function padRow(row: string[], n: number): string[] {
  const out = row.slice(0, n);
  while (out.length < n) out.push("");
  return out;
}

// ── Parseo de monto y moneda ──────────────────────────────────────

/**
 * Parsea un monto con separadores mixtos (1.234,56 · 1,234.56 · 1234.56 · con
 * `$`/`¥`). Determina el separador decimal por el ÚLTIMO `,`/`.` con 1-2 dígitos
 * detrás. Devuelve 0 si no hay número. PURA.
 */
export function parseAmount(raw: string): number {
  let s = (raw ?? "").replace(/[^\d.,\-]/g, "").trim();
  if (s === "" || s === "-") return 0;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    // El separador decimal es el que aparece más a la derecha.
    if (lastComma > lastDot) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (lastComma >= 0) {
    // Sólo comas: decimal si hay 1-2 dígitos detrás, sino separador de miles.
    const decimals = s.length - lastComma - 1;
    s = decimals >= 1 && decimals <= 2 ? s.replace(",", ".") : s.replace(/,/g, "");
  } else {
    // Sólo puntos (o ninguno): si hay varios puntos, son miles.
    if ((s.match(/\./g) ?? []).length > 1) s = s.replace(/\./g, "");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

const CURRENCY_HINTS: Record<PartnerCurrency, string[]> = {
  RMB: ["rmb", "cny", "¥", "元", "人民币", "yuan"],
  USDT: ["usdt", "tether"],
  USD: ["usd", "$", "dolar", "dólar", "us$"],
  VES: ["ves", "bs", "bolivar", "bolívar", "bsd", "bsf"],
};

/**
 * Normaliza un texto de moneda a una PartnerCurrency. Default USD si no matchea.
 * USDT/RMB/VES se chequean antes que USD (USD `$`/`usd` es el más laxo). PURA.
 */
export function normalizeCurrency(raw: string): PartnerCurrency {
  const c = (raw ?? "").toLowerCase().trim();
  if (c === "") return "USD";
  const order: PartnerCurrency[] = ["USDT", "RMB", "VES", "USD"];
  for (const cur of order) {
    if (CURRENCY_HINTS[cur].some((h) => c.includes(h))) return cur;
  }
  return PARTNER_CURRENCIES.includes(c.toUpperCase() as PartnerCurrency)
    ? (c.toUpperCase() as PartnerCurrency)
    : "USD";
}

/** Normaliza una fecha suelta a YYYY-MM-DD, o null si no se reconoce. PURA. */
export function normalizeDate(raw: string): string | null {
  const s = (raw ?? "").trim();
  if (s === "") return null;
  // YYYY-MM-DD o YYYY/MM/DD
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  // DD-MM-YYYY o DD/MM/YYYY (convención VE/CN: día primero)
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

/**
 * Construye las líneas del draft a partir de filas + mapeo. Descarta filas sin
 * descripción ni monto. `defaultCurrency` se usa si no hay columna de moneda.
 * PURA.
 */
export function buildLinesFromRows(
  rows: string[][],
  map: StatementColumnMap,
  defaultCurrency: string = "USD",
): ParsedLine[] {
  const out: ParsedLine[] = [];
  for (const row of rows) {
    const at = (idx: number | null): string => (idx == null ? "" : (row[idx] ?? ""));

    const desc = at(map.description).trim();
    const amount = parseAmount(at(map.amount));
    if (desc === "" && amount === 0) continue; // fila basura

    out.push({
      raw_description: desc || "(sin descripción)",
      raw_description_cn: at(map.descriptionCn).trim() || null,
      amount,
      currency: map.currency != null ? normalizeCurrency(at(map.currency)) : defaultCurrency,
      line_date: normalizeDate(at(map.date)),
    });
  }
  return out;
}

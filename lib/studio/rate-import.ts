/**
 * Importador masivo de tarifas (Fase 3 Slice C, SDD-0055).
 *
 * Parser propio (sin libs) para pegar un CSV de tarifas en un textarea → filas
 * validadas + preview. Las filas válidas se insertan como `draft` (NO van live;
 * se revisan y publican aparte). Dedup por (service, origin, destination).
 *
 * Formato CSV esperado (1ª línea = encabezado, separador coma):
 *
 *   service,origin,destination,per_cbm,flat_rate,min_charge,transit_days,valid_from,valid_until,notes
 *   consolidado_lcl,Yiwu,Valencia,800,,380,38,2026-01-01,2026-12-31,Tarifa Q1
 *   fcl_directo,Shenzhen,La Guaira,,8500,,40,,,Contrato naviero
 *
 * - `service` ∈ {consolidado_lcl, puerta_a_puerta_DDP, fcl_directo, transporte_terrestre}.
 * - per_cbm O flat_rate (al menos uno > 0). Vacíos = null.
 * - origin y destination obligatorios.
 * - El encabezado es flexible en orden; columnas desconocidas se ignoran.
 *
 * Sin Zod — validación manual, igual que el resto del Studio.
 */

import {
  SHIPMENT_SERVICES,
  isShipmentService,
  type ShipmentService,
} from "./shipment-types";
import type { RateInput } from "./rate-types";

/** Columnas reconocidas del CSV (en cualquier orden). */
export const IMPORT_COLUMNS = [
  "service",
  "origin",
  "destination",
  "per_cbm",
  "flat_rate",
  "min_charge",
  "transit_days",
  "valid_from",
  "valid_until",
  "notes",
] as const;

/** Una fila parseada del CSV con su veredicto. */
export type ParsedRateRow = {
  /** Nº de línea en el textarea (1-based, sin contar el encabezado). */
  line: number;
  /** Input listo para insertar (solo si `ok`). */
  input?: RateInput;
  /** Razón del rechazo (si !ok). */
  error?: string;
  /** Texto crudo de la fila (para mostrar en el preview). */
  raw: string;
};

export type RateImportPreview = {
  rows: ParsedRateRow[];
  validCount: number;
  invalidCount: number;
  /** Filas duplicadas DENTRO del mismo CSV (mismo service/origin/destination). */
  duplicateCount: number;
  /** Error global del parse (encabezado faltante, CSV vacío). */
  error?: string;
};

/** Parsea una línea CSV simple respetando comillas dobles. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'; // comilla escapada ""
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseNum(v: string | undefined): number | null {
  if (v == null) return null;
  const s = v.trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseDate(v: string | undefined): {
  value: string | null;
  ok: boolean;
} {
  if (v == null || v.trim() === "") return { value: null, ok: true };
  const s = v.trim();
  const ok = !Number.isNaN(new Date(s).getTime());
  return { value: ok ? s : null, ok };
}

/** Clave de dedup de una fila: service|origin|destination, case-insensitive. */
export function rateDedupKey(
  r: Pick<RateInput, "service" | "origin" | "destination">,
): string {
  return `${r.service}|${r.origin.trim().toLowerCase()}|${r.destination
    .trim()
    .toLowerCase()}`;
}

/**
 * Parsea + valida un CSV de tarifas pegado en el textarea.
 * Marca duplicados internos (mismo service/origin/destination) como inválidos:
 * el primero queda, los siguientes se rechazan.
 */
export function parseRatesCsv(csv: string): RateImportPreview {
  // Lista compacta de líneas con contenido (la 1ª = encabezado).
  const nonEmpty = csv
    .split(/\r?\n/)
    .map((l, idx) => ({ text: l, idx }))
    .filter((l) => l.text.trim() !== "");

  if (nonEmpty.length === 0) {
    return {
      rows: [],
      validCount: 0,
      invalidCount: 0,
      duplicateCount: 0,
      error: "El CSV está vacío. Pega al menos el encabezado y una fila.",
    };
  }

  const header = splitCsvLine(nonEmpty[0].text).map((h) => h.toLowerCase());
  // Mapa columna → índice. Solo columnas conocidas.
  const colIndex: Partial<Record<(typeof IMPORT_COLUMNS)[number], number>> = {};
  header.forEach((h, i) => {
    if ((IMPORT_COLUMNS as readonly string[]).includes(h)) {
      colIndex[h as (typeof IMPORT_COLUMNS)[number]] = i;
    }
  });

  if (
    colIndex.service == null ||
    colIndex.origin == null ||
    colIndex.destination == null
  ) {
    return {
      rows: [],
      validCount: 0,
      invalidCount: 0,
      duplicateCount: 0,
      error:
        "El encabezado debe incluir al menos las columnas: service, origin, destination.",
    };
  }

  const dataLines = nonEmpty.slice(1);
  if (dataLines.length === 0) {
    return {
      rows: [],
      validCount: 0,
      invalidCount: 0,
      duplicateCount: 0,
      error: "El CSV solo tiene encabezado, sin filas de tarifas.",
    };
  }

  const seen = new Set<string>();
  let validCount = 0;
  let invalidCount = 0;
  let duplicateCount = 0;

  const rows: ParsedRateRow[] = dataLines.map((dl, i) => {
    const line = i + 1; // 1-based, sin contar el encabezado
    const cells = splitCsvLine(dl.text);
    const get = (col: (typeof IMPORT_COLUMNS)[number]): string | undefined => {
      const idx = colIndex[col];
      return idx == null ? undefined : cells[idx];
    };

    const serviceRaw = (get("service") ?? "").trim();
    const origin = (get("origin") ?? "").trim();
    const destination = (get("destination") ?? "").trim();

    if (!isShipmentService(serviceRaw)) {
      invalidCount++;
      return {
        line,
        raw: dl.text,
        error: `Servicio inválido: "${serviceRaw}". Usa uno de: ${SHIPMENT_SERVICES.join(", ")}.`,
      };
    }
    const service: ShipmentService = serviceRaw;

    if (!origin || !destination) {
      invalidCount++;
      return {
        line,
        raw: dl.text,
        error: "Faltan origin o destination.",
      };
    }

    const per_cbm = parseNum(get("per_cbm"));
    const flat_rate = parseNum(get("flat_rate"));
    const hasPerCbm = per_cbm != null && per_cbm > 0;
    const hasFlat = flat_rate != null && flat_rate > 0;
    if (!hasPerCbm && !hasFlat) {
      invalidCount++;
      return {
        line,
        raw: dl.text,
        error: "Indica per_cbm o flat_rate (> 0).",
      };
    }
    if (per_cbm != null && per_cbm < 0) {
      invalidCount++;
      return { line, raw: dl.text, error: "per_cbm no puede ser negativo." };
    }
    if (flat_rate != null && flat_rate < 0) {
      invalidCount++;
      return { line, raw: dl.text, error: "flat_rate no puede ser negativo." };
    }

    const min_charge = parseNum(get("min_charge"));
    if (min_charge != null && min_charge < 0) {
      invalidCount++;
      return { line, raw: dl.text, error: "min_charge no puede ser negativo." };
    }

    const transitRaw = parseNum(get("transit_days"));
    if (transitRaw != null && transitRaw < 0) {
      invalidCount++;
      return {
        line,
        raw: dl.text,
        error: "transit_days no puede ser negativo.",
      };
    }
    const transit_days = transitRaw == null ? null : Math.round(transitRaw);

    const vf = parseDate(get("valid_from"));
    const vu = parseDate(get("valid_until"));
    if (!vf.ok) {
      invalidCount++;
      return { line, raw: dl.text, error: "valid_from inválida (usa YYYY-MM-DD)." };
    }
    if (!vu.ok) {
      invalidCount++;
      return {
        line,
        raw: dl.text,
        error: "valid_until inválida (usa YYYY-MM-DD).",
      };
    }
    if (vf.value && vu.value && new Date(vf.value) > new Date(vu.value)) {
      invalidCount++;
      return {
        line,
        raw: dl.text,
        error: "valid_from no puede ser posterior a valid_until.",
      };
    }

    const notes = (get("notes") ?? "").trim() || null;

    const input: RateInput = {
      service,
      origin,
      destination,
      per_cbm: hasPerCbm ? per_cbm : null,
      flat_rate: hasFlat ? flat_rate : null,
      min_charge,
      transit_days,
      valid_from: vf.value,
      valid_until: vu.value,
      is_public: false, // importadas nunca son la pública del calculador
      notes,
    };

    // Dedup interno del CSV: el 1º gana, los repetidos se rechazan.
    const key = rateDedupKey(input);
    if (seen.has(key)) {
      duplicateCount++;
      invalidCount++;
      return {
        line,
        raw: dl.text,
        error: `Duplicada en el CSV (mismo servicio/origen/destino que una fila anterior).`,
      };
    }
    seen.add(key);

    validCount++;
    return { line, raw: dl.text, input };
  });

  return { rows, validCount, invalidCount, duplicateCount };
}

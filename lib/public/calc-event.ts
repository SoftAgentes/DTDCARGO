/**
 * SDD-0259 · el evento anónimo de la calculadora pública.
 *
 * Lógica PURA: valida y arma la fila que se inserta en `public_calc_events`.
 * No toca la DB ni el DOM — eso lo hace `app/api/public/calc-event/route.ts`.
 *
 * ⚠️ ESTO NO ES UN LEAD. La tabla es telemetría anónima y no puede llevar
 * nombre, teléfono, correo, IP, cookie, ni identificador de sesión o usuario.
 * Es lo que la mantiene fuera del régimen de datos personales; si alguien le
 * cuelga un identificador, el cambio pasa por `/revisar-datos-ve`.
 *
 * La defensa de esa regla NO es la buena voluntad: `buildCalcEventRow` copia
 * campo por campo desde una LISTA BLANCA, así que un campo de más en el payload
 * del navegador se cae solo. El test `calc-event.test.ts` lo verifica mandando
 * un payload envenenado con `email`/`phone` y comprobando que no sobrevive.
 */

/** Modalidad calculada. Espeja `CalcModo` de `lib/calculadora.ts`. */
export type CalcEventModo = "ddp" | "consolidado";

/** Lo que el navegador manda. Todo opcional: el visitante no llenó un form. */
export type CalcEventPayload = {
  modo?: unknown;
  cbm?: unknown;
  weightKg?: unknown;
  ciudadId?: unknown;
  embalaje?: unknown;
  bateria?: unknown;
  cargaEspecial?: unknown;
  totalUsd?: unknown;
  alerta?: unknown;
};

/** La fila lista para insertar. Estas claves y NINGUNA otra. */
export type CalcEventRow = {
  modo: CalcEventModo;
  cbm: number;
  weight_kg: number | null;
  ciudad_id: string | null;
  embalaje: "estandar" | "especial" | null;
  bateria: boolean;
  carga_especial: boolean;
  total_usd: number | null;
  alerta: string | null;
};

/**
 * Las únicas claves que pueden viajar a la DB. Existe como valor exportado
 * —y no sólo como tipo— para que el test la recorra: un tipo se borra al
 * compilar y no puede vigilar nada en runtime.
 */
export const CALC_EVENT_COLUMNS = [
  "modo",
  "cbm",
  "weight_kg",
  "ciudad_id",
  "embalaje",
  "bateria",
  "carga_especial",
  "total_usd",
  "alerta",
] as const;

/** Número finito y positivo, o `null`. Cualquier basura cae a `null`. */
function posNum(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Texto corto y saneado, o `null`.
 *
 * El tope de largo no es cosmético: son campos que vienen del navegador y van
 * a columnas `text` sin límite. Sin el corte, un script mete megabytes por
 * `alerta` y llena la tabla.
 */
function shortText(v: unknown, max = 64): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, max);
  return s === "" ? null : s;
}

/**
 * Valida el payload y arma la fila, o dice por qué no.
 *
 * El único campo obligatorio es `cbm`: sin volumen no hubo cálculo que
 * registrar. El peso NO se exige — que falte es justamente el dato (SDD-0257).
 */
export function buildCalcEventRow(
  payload: CalcEventPayload,
): { ok: true; row: CalcEventRow } | { ok: false; error: string } {
  const cbm = posNum(payload.cbm);
  if (cbm == null) return { ok: false, error: "cbm inválido" };

  const modo = payload.modo === "consolidado" ? "consolidado" : "ddp";
  const embalajeRaw = shortText(payload.embalaje, 16);
  const embalaje =
    embalajeRaw === "especial" || embalajeRaw === "estandar" ? embalajeRaw : null;

  return {
    ok: true,
    row: {
      modo,
      cbm,
      weight_kg: posNum(payload.weightKg),
      ciudad_id: shortText(payload.ciudadId, 64),
      embalaje,
      bateria: payload.bateria === true,
      carga_especial: payload.cargaEspecial === true,
      total_usd: posNum(payload.totalUsd),
      alerta: shortText(payload.alerta, 64),
    },
  };
}

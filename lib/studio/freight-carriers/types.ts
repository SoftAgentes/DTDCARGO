/**
 * Transportistas terrestres y su tarifario — tipos y validadores (SDD-0236).
 *
 * NO son las navieras de SDD-0047 (tabla `carriers`): esos mueven contenedores
 * por mar. Estos mueven la carga desde el galpón de Valencia hasta la puerta
 * del cliente dentro de Venezuela.
 *
 * Validación manual, sin Zod — convención del repo.
 */

/** Un transportista terrestre. */
export type FreightCarrier = {
  id: string;
  tenantId: string;
  /** Nombre comercial, el que usa el equipo. */
  name: string;
  /** Razón social exacta de la factura. */
  legalName: string | null;
  /** RIF. */
  taxId: string | null;
  contact: string | null;
  notes: string | null;
  /** El que cotiza la calculadora pública. UNO por tenant. */
  isDefault: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Una tarifa: cuánto cuesta una ciudad con un transportista. */
export type CarrierTariff = {
  id: string;
  tenantId: string;
  carrierId: string;
  /** Espeja `calculator_cities.slug`. */
  citySlug: string;
  /** Lo que le pagamos al transportista, por m³. */
  costUsdCbm: number;
  /** Lo que le cobramos al cliente, por m³. */
  priceUsdCbm: number;
  /** La unidad en que ELLOS cotizaron. Referencia, no se usa para cobrar. */
  priceUsdFt3: number | null;
  minChargeUsd: number | null;
  /** Cada cuántos días sale el camión. 15 = quincenal. */
  dispatchFrequencyDays: number | null;
  /** Lo que dijeron, literal. */
  departureFrequency: string | null;
  transitDays: string | null;
  conditions: string | null;
  validFrom: string | null;
  validTo: string | null;
  createdAt: string;
  updatedAt: string;
};

// ────────────────────────────────────────────────────────────────
// Conversión de unidades
// ────────────────────────────────────────────────────────────────

/**
 * 1 m³ = 35,3147 ft³.
 *
 * Los transportistas cotizan en pie cúbico porque vienen del mundo courier de
 * EE.UU. El número operativo del sistema es SIEMPRE USD/CBM: se convierte una
 * vez, al registrar la tarifa, y nunca más.
 */
export const FT3_POR_CBM = 35.3147;

/** Pasa un precio en USD/ft³ a USD/CBM, redondeado a centavos. */
export function ft3ACbm(usdPorFt3: number): number {
  return Math.round(usdPorFt3 * FT3_POR_CBM * 100) / 100;
}

/** El camino inverso, para mostrarle al proveedor su propio número. */
export function cbmAFt3(usdPorCbm: number): number {
  return Math.round((usdPorCbm / FT3_POR_CBM) * 10000) / 10000;
}

// ────────────────────────────────────────────────────────────────
// Frecuencia de despacho → qué se le dice al cliente
// ────────────────────────────────────────────────────────────────

/**
 * ¿Este destino tarda notablemente más que el resto?
 *
 * Un destino quincenal no sale todas las semanas: según el día en que la carga
 * llegue al galpón, la entrega puede tardar hasta una semana más. El cliente
 * tiene que saberlo ANTES de pagar, no después.
 *
 * El umbral es 8 días y no 15 a propósito: cualquier cosa que salga menos de
 * una vez por semana ya merece el aviso.
 */
export function tardaMasDeLoNormal(dispatchFrequencyDays: number | null): boolean {
  return dispatchFrequencyDays != null && dispatchFrequencyDays > 8;
}

/** El aviso, tal cual lo lee el cliente. `null` si no hace falta avisar. */
export function avisoDeDemora(
  ciudad: string,
  dispatchFrequencyDays: number | null,
): string | null {
  if (!tardaMasDeLoNormal(dispatchFrequencyDays)) return null;
  return (
    `El camión a ${ciudad} no sale todas las semanas. Según el día en que tu ` +
    `carga llegue a nuestro galpón, la entrega puede tardar hasta una semana ` +
    `más que a otros destinos. Te avisamos la fecha exacta de despacho apenas ` +
    `se confirme.`
  );
}

// ────────────────────────────────────────────────────────────────
// Validadores (FormData → input canónico o errores por campo)
// ────────────────────────────────────────────────────────────────

export type CarrierFieldKey = "name" | "legalName" | "taxId" | "contact";

export type CarrierInput = {
  name: string;
  legalName: string | null;
  taxId: string | null;
  contact: string | null;
  notes: string | null;
  isDefault: boolean;
  active: boolean;
};

const MAX = { name: 120, legalName: 200, taxId: 40, contact: 200, notes: 2000 };

export function validateCarrierInput(
  form: FormData,
):
  | { ok: true; value: CarrierInput }
  | { ok: false; errors: Partial<Record<CarrierFieldKey, string>> } {
  const errors: Partial<Record<CarrierFieldKey, string>> = {};
  const str = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v.trim() : "";
  };
  const nullable = (v: string) => (v === "" ? null : v);

  const name = str("name");
  const legalName = str("legalName");
  const taxId = str("taxId");
  const contact = str("contact");
  const notes = str("notes");

  if (name === "") errors.name = "Ponle un nombre al transportista.";
  else if (name.length > MAX.name) errors.name = `Máximo ${MAX.name} caracteres.`;
  if (legalName.length > MAX.legalName)
    errors.legalName = `Máximo ${MAX.legalName} caracteres.`;
  if (taxId.length > MAX.taxId) errors.taxId = `Máximo ${MAX.taxId} caracteres.`;
  if (contact.length > MAX.contact)
    errors.contact = `Máximo ${MAX.contact} caracteres.`;

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      name,
      legalName: nullable(legalName),
      taxId: nullable(taxId),
      contact: nullable(contact),
      notes: nullable(notes),
      isDefault: form.get("isDefault") === "on" || form.get("isDefault") === "true",
      active: form.get("active") !== "off" && form.get("active") !== "false",
    },
  };
}

export type TariffFieldKey =
  | "citySlug"
  | "costUsdCbm"
  | "priceUsdCbm"
  | "priceUsdFt3"
  | "minChargeUsd"
  | "dispatchFrequencyDays"
  | "validTo";

export type TariffInput = {
  carrierId: string;
  citySlug: string;
  costUsdCbm: number;
  priceUsdCbm: number;
  priceUsdFt3: number | null;
  minChargeUsd: number | null;
  dispatchFrequencyDays: number | null;
  departureFrequency: string | null;
  transitDays: string | null;
  conditions: string | null;
  validFrom: string | null;
  validTo: string | null;
};

/**
 * Acepta coma o punto decimal: el equipo carga estas tarifas desde una foto que
 * manda el proveedor, y en Venezuela se escribe `123,60`.
 */
export function parseMonto(raw: string): number | null {
  const limpio = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (limpio === "") return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

export function validateTariffInput(
  form: FormData,
):
  | { ok: true; value: TariffInput }
  | { ok: false; errors: Partial<Record<TariffFieldKey, string>> } {
  const errors: Partial<Record<TariffFieldKey, string>> = {};
  const str = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v.trim() : "";
  };
  const nullable = (v: string) => (v === "" ? null : v);

  const carrierId = str("carrierId");
  const citySlug = str("citySlug");
  if (citySlug === "") errors.citySlug = "Escoge la ciudad.";

  const costo = parseMonto(str("costUsdCbm"));
  if (costo == null) errors.costUsdCbm = "Escribe cuánto te cobra el transportista.";
  else if (costo < 0) errors.costUsdCbm = "No puede ser negativo.";

  // El precio de venta se puede cargar en CBM o en pie cúbico: el proveedor
  // cotiza en ft³ y la UI convierte al vuelo. Con que venga uno de los dos basta.
  const ft3 = parseMonto(str("priceUsdFt3"));
  let venta = parseMonto(str("priceUsdCbm"));
  if (venta == null && ft3 != null) venta = ft3ACbm(ft3);
  if (venta == null) errors.priceUsdCbm = "Escribe el precio de venta, por m³ o por pie cúbico.";
  else if (venta < 0) errors.priceUsdCbm = "No puede ser negativo.";
  if (ft3 != null && ft3 < 0) errors.priceUsdFt3 = "No puede ser negativo.";

  const minimo = parseMonto(str("minChargeUsd"));
  if (minimo != null && minimo < 0) errors.minChargeUsd = "No puede ser negativo.";

  const diasRaw = str("dispatchFrequencyDays");
  const dias = diasRaw === "" ? null : Number(diasRaw);
  if (dias != null && (!Number.isInteger(dias) || dias <= 0))
    errors.dispatchFrequencyDays = "Días enteros, mayor que cero.";

  const validFrom = nullable(str("validFrom"));
  const validTo = nullable(str("validTo"));
  if (validFrom && validTo && validTo < validFrom)
    errors.validTo = "La vigencia no puede terminar antes de empezar.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      carrierId,
      citySlug,
      costUsdCbm: costo as number,
      priceUsdCbm: venta as number,
      priceUsdFt3: ft3,
      minChargeUsd: minimo,
      dispatchFrequencyDays: dias,
      departureFrequency: nullable(str("departureFrequency")),
      transitDays: nullable(str("transitDays")),
      conditions: nullable(str("conditions")),
      validFrom,
      validTo,
    },
  };
}

// ────────────────────────────────────────────────────────────────
// Helpers de presentación
// ────────────────────────────────────────────────────────────────

/**
 * Lo que queda del tramo, por m³.
 *
 * ⚠️ Es una RESTA, no un porcentaje. La venta no se deriva del costo (ver
 * SDD-0236): son dos números independientes y esto sólo muestra la diferencia.
 */
export function margenPorCbm(t: Pick<CarrierTariff, "costUsdCbm" | "priceUsdCbm">): number {
  return Math.round((t.priceUsdCbm - t.costUsdCbm) * 100) / 100;
}

/** Tono del badge del margen. Negativo = le estamos poniendo de nuestro bolsillo. */
export function margenTone(margen: number): "positive" | "neutral" | "negative" {
  if (margen < 0) return "negative";
  if (margen === 0) return "neutral";
  return "positive";
}

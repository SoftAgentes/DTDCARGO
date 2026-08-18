/**
 * Tipos y reglas de las listas de precios (SDD-0269, migr 0382).
 *
 * Una lista de precios es el conjunto de tarifas con las que se le cotiza a
 * alguien. Hay una de la casa —la de todo cliente directo, y la única que
 * alimenta la calculadora del sitio— y una por aliado RAÍZ.
 *
 * Un aliado puede pactar de dos formas, y las dos viven acá:
 *   · TARIFA PROPIA → filas de `rates` dentro de su lista.
 *   · DESCUENTO     → un % sobre la tarifa vigente de la casa, sin copiar nada.
 * Conviven: su tarifa propia manda donde exista, el descuento cubre el resto.
 *
 * Sin Zod: validate*Input() a mano, patrón del proyecto.
 */

import type { Rate } from "../rate-types";

export type PriceBook = {
  id: string;
  tenant_id: string;
  /** null = lista sin dueño: la de la casa. No null = la de ese aliado raíz. */
  aliado_id: string | null;
  name: string;
  is_house: boolean;
  /** % sobre la tarifa de la casa. null = sin descuento. */
  discount_pct: number | null;
  /** $/CBM pactado con este aliado. null = no se pactó un número. */
  base_per_cbm: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

/** Fila liviana para selectores: la lista + de quién es. */
export type PriceBookOption = {
  id: string;
  name: string;
  isHouse: boolean;
  discountPct: number | null;
  /** $/CBM pactado. Manda sobre el descuento donde el tramo se cobra por CBM. */
  basePerCbm: number | null;
  aliadoId: string | null;
  /** Insignia del aliado dueño, para etiquetar el selector (`DC`). */
  aliadoPrefix: string | null;
  /** Cuántas tarifas vivas tiene. Una lista vacía con descuento es válida. */
  tarifas: number;
};

/**
 * De dónde salió el precio que se está mostrando. Se muestra en pantalla: el
 * cotizador tiene que decir por qué el número es ése y no el de la lista.
 */
/**
 * De dónde salió el precio, de lo más específico a lo más general:
 *   propia    — una fila suya en `rates` para esa ruta exacta
 *   pactada   — el $/CBM que se acordó con el aliado (`base_per_cbm`)
 *   descuento — la de la casa menos su %
 *   casa      — la de la casa, tal cual
 */
export type OrigenTarifa = "propia" | "pactada" | "descuento" | "casa";

export type TarifaResuelta = {
  /** La tarifa a usar. Si `origen` es "descuento", los importes ya vienen bajados. */
  rate: Rate;
  /** La fila de `rates` de la que salió — la que se guarda en `rate_used_id`. */
  rateId: string;
  origen: OrigenTarifa;
  /** El % aplicado, sólo cuando `origen` es "descuento". */
  descuentoPct: number | null;
  /** Nombre de la lista con la que se resolvió, para decirlo en pantalla. */
  bookName: string | null;
};

export type PriceBookActionState = { ok?: boolean; error?: string } | null;

export const DESCUENTO_MIN = 0.01;
export const DESCUENTO_MAX = 99.99;

/** Redondeo a centavos. La plata del ERP tiene 2 decimales (ver lib/money.ts). */
function aCentavos(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Aplica el descuento de una lista sobre una tarifa de la casa.
 *
 * ⚠️ `min_charge` NO se descuenta a propósito. El piso es un término comercial
 * aparte —cuánto cuesta como mínimo mover un envío, sin importar el volumen—,
 * no el precio. Descontarlo en silencio le bajaría a un aliado un mínimo que
 * nadie pactó. La pantalla lo dice; una regla que no se ve es una trampa.
 *
 * Devuelve una copia: la tarifa de la casa no se toca.
 */
export function aplicarDescuento(rate: Rate, pct: number | null): Rate {
  if (pct == null || !Number.isFinite(pct) || pct <= 0 || pct >= 100) return rate;
  const factor = 1 - pct / 100;
  return {
    ...rate,
    per_cbm: rate.per_cbm != null ? aCentavos(rate.per_cbm * factor) : null,
    flat_rate: rate.flat_rate != null ? aCentavos(rate.flat_rate * factor) : null,
  };
}

/** `12 %` · `12,5 %`. Sin decimales cuando es redondo. */
export function fmtDescuento(pct: number | null): string {
  if (pct == null) return "—";
  const n = Number(pct);
  if (!Number.isFinite(n)) return "—";
  const txt = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, "");
  return `${txt.replace(".", ",")} %`;
}

/** Cómo se le explica al usuario de dónde salió el precio. */
export function origenTarifaLabel(o: OrigenTarifa, bookName?: string | null): string {
  if (o === "propia") return bookName ? `Tarifa propia de ${bookName}` : "Tarifa propia";
  if (o === "pactada") return bookName ? `Precio pactado con ${bookName}` : "Precio pactado";
  if (o === "descuento") return "Tarifa de la casa con su descuento";
  return "Tarifa de la casa";
}

export function priceBookLabel(b: Pick<PriceBookOption, "name" | "isHouse">): string {
  return b.isHouse ? `${b.name} · la casa` : b.name;
}

/**
 * Valida el descuento que se teclea en la ficha del aliado.
 * Vacío = sin descuento (null), que es distinto de 0 — 0 no es un descuento.
 */
export function validateDescuento(raw: string | null | undefined): {
  value?: number | null;
  error?: string;
} {
  const s = (raw ?? "").trim().replace(",", ".");
  if (s === "") return { value: null };

  const n = Number(s);
  if (!Number.isFinite(n)) {
    return { error: "El descuento es un número, por ejemplo 12 o 12,5." };
  }
  if (n <= 0) {
    return { error: "Un descuento de 0 % no es un descuento: déjalo vacío." };
  }
  if (n > DESCUENTO_MAX) {
    return { error: `El descuento no puede llegar a 100 %. El máximo es ${DESCUENTO_MAX} %.` };
  }
  return { value: aCentavos(n) };
}

/**
 * Valida el $/CBM pactado con el aliado.
 * Vacío = no se pactó un número (null), que no es lo mismo que cero — cero no es
 * un acuerdo, es llevarle la carga gratis.
 */
export function validateBasePerCbm(raw: string | null | undefined): {
  value?: number | null;
  error?: string;
} {
  const s = (raw ?? "").trim().replace(/[$\s]/g, "").replace(",", ".");
  if (s === "") return { value: null };

  const n = Number(s);
  if (!Number.isFinite(n)) {
    return { error: "El precio pactado es un número, por ejemplo 690 o 690,50." };
  }
  if (n <= 0) {
    return { error: "Un precio de $0 el CBM no es un acuerdo: déjalo vacío." };
  }
  if (n > 100000) {
    return { error: "Ese precio por CBM parece un error de tecleo." };
  }
  return { value: aCentavos(n) };
}

export function validatePriceBookName(raw: string | null | undefined): {
  value?: string;
  error?: string;
} {
  const v = (raw ?? "").trim();
  if (!v) return { error: "La lista de precios necesita un nombre." };
  if (v.length > 120) return { error: "El nombre no puede pasar de 120 caracteres." };
  return { value: v };
}

/** Nombre por defecto de la lista de un aliado, a partir de su nombre comercial. */
export function nombreListaDeAliado(tradeName: string): string {
  return `Tarifa ${tradeName}`.slice(0, 120);
}

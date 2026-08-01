/**
 * Direcciones de entrega del cliente (SDD-0138 Slice B · tabla
 * `client_delivery_addresses`, migr 0198). Recurso compartido por DOS superficies
 * sobre el MISMO esquema: el cliente las edita en el Portal (self por markbox) y el
 * asesor en el Studio ERP (equipo por tenant). Tipos + validador propio (no Zod,
 * convención del Studio).
 */

/** Una dirección de entrega tal como la lee la app (fila viva, no borrada). */
export type ClientDeliveryAddress = {
  id: string;
  clientId: string;
  /** Etiqueta corta ("Casa", "Oficina"). Opcional. */
  label: string | null;
  /** Dirección (calle/edificio/nº). Obligatoria. */
  line: string;
  city: string | null;
  /**
   * Slice C: slug de `calculator_cities` (migr 0104) para estimar el recargo de
   * entrega con la MISMA config del calculador (/studio/tarifas). Null = ciudad
   * fuera del catálogo → sin estimado (degrada honesto).
   */
  citySlug: string | null;
  state: string | null;
  /** Punto de referencia / dato de last-mile. Opcional. */
  reference: string | null;
  isDefault: boolean;
};

/** Datos de alta/edición de una dirección (lo que escribe el usuario). */
export type ClientDeliveryAddressInput = {
  label: string | null;
  line: string;
  city: string | null;
  citySlug: string | null;
  state: string | null;
  reference: string | null;
  isDefault: boolean;
};

/** Error de validación → mapa campo→mensaje (mismo shape que el resto del Studio). */
export type ClientAddressFieldErrors = Partial<
  Record<keyof ClientDeliveryAddressInput, string>
>;

const MAX = { label: 40, line: 200, city: 80, state: 80, reference: 200, citySlug: 60 } as const;

/**
 * Parsea + valida un FormData de dirección. Reglas mínimas: `line` obligatoria y
 * dentro de largo; el resto opcional con tope de largo. Devuelve el input limpio o
 * los errores por campo. Espeja el patrón `validate*Input()` del Studio.
 */
export function validateClientAddressInput(
  form: FormData,
): { ok: true; value: ClientDeliveryAddressInput } | { ok: false; errors: ClientAddressFieldErrors } {
  const errors: ClientAddressFieldErrors = {};
  const str = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v.trim() : "";
  };
  const nullable = (v: string) => (v === "" ? null : v);

  const line = str("line");
  const label = str("label");
  const city = str("city");
  const citySlug = str("citySlug");
  const state = str("state");
  const reference = str("reference");
  const isDefault = form.get("isDefault") === "on" || form.get("isDefault") === "true";

  if (line === "") {
    errors.line = "Escribe la dirección de entrega.";
  } else if (line.length > MAX.line) {
    errors.line = `La dirección no puede pasar de ${MAX.line} caracteres.`;
  }
  if (label.length > MAX.label) errors.label = `Máximo ${MAX.label} caracteres.`;
  if (city.length > MAX.city) errors.city = `Máximo ${MAX.city} caracteres.`;
  if (state.length > MAX.state) errors.state = `Máximo ${MAX.state} caracteres.`;
  if (reference.length > MAX.reference)
    errors.reference = `Máximo ${MAX.reference} caracteres.`;
  if (citySlug.length > MAX.citySlug)
    errors.citySlug = `Máximo ${MAX.citySlug} caracteres.`;

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      label: nullable(label),
      line,
      city: nullable(city),
      citySlug: nullable(citySlug),
      state: nullable(state),
      reference: nullable(reference),
      isDefault,
    },
  };
}

/**
 * Cómo se cobra la entrega (last-mile) a una ciudad del catálogo — MISMA regla
 * del calculador público (lib/calculadora.ts §5.7).
 *
 * ⚠️ DEVUELVE UNA TARIFA POR m³, NO UN MONTO. Es la diferencia importante con
 * la versión vieja, y no es un capricho: desde SDD-0237 la entrega se cobra
 * `CBM × precio del tramo`, y una tarjeta de direcciones **no sabe cuántos m³**
 * va a traer el cliente. Mostrar un monto fijo acá sería inventarlo. Se muestra
 * el precio unitario y el total lo hace la calculadora, que sí conoce el
 * volumen.
 *
 * Tres respuestas posibles, y cada una se pinta distinto:
 *  · `included`  — zona sin costo: el cliente no paga entrega ahí.
 *  · `usdPorCbm` — se cobra a ese precio por metro cúbico.
 *  · `sinTarifa` — no hay precio confirmado → el ERP no debe mostrar número.
 */
export type LastMileEstimate =
  | { included: true }
  | { included: false; usdPorCbm: number }
  | { included: false; sinTarifa: true };

export function lastMileEstimate(city: {
  casco: boolean;
  ventaCbm?: number | null;
}): LastMileEstimate {
  if (city.casco) return { included: true };
  if (city.ventaCbm == null || city.ventaCbm <= 0) {
    return { included: false, sinTarifa: true };
  }
  return { included: false, usdPorCbm: city.ventaCbm };
}

/** Texto de una línea para mostrar la dirección compacta (lista, resumen). */
export function formatDeliveryAddress(a: ClientDeliveryAddress): string {
  return [a.line, a.city, a.state].filter((x) => x && x.trim() !== "").join(", ");
}

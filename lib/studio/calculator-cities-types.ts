/**
 * Tipos + validación del módulo Ciudades del calculador (Fase 3 Slice B, SDD-0055).
 * Matchea schema de supabase/migrations/0104_calculator_cities_rate_status.sql.
 *
 * Estas son las ciudades de destino del calculador público LCL DDP (slug, label,
 * km desde Valencia, flag casco). El admin las edita en /studio/tarifas › Ciudades.
 * El sitio las lee vía RPC anon (public_calculator_cities); sin filas → fallback
 * al array CIUDADES de lib/calculadora.ts.
 *
 * Sin Zod — validación manual con `validateCityInput()`, igual que el resto.
 */

/** Fila tal como la devuelve `listCalculatorCities()`. */
export type CalculatorCity = {
  id: string;
  tenant_id: string;
  slug: string;
  label: string;
  km: number;
  casco: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

/** Subset editable de una ciudad (lo que el form manda y la action persiste). */
export type CalculatorCityInput = {
  slug: string;
  label: string;
  km: number;
  casco: boolean;
  sort_order: number;
};

/** Estado de las server actions (consistente con el resto del Studio). */
export type CalculatorCityActionState = {
  ok?: boolean;
  error?: string;
  /** id de la ciudad recién creada · alimenta el highlight de la row. */
  createdId?: string;
  fieldErrors?: Partial<Record<keyof CalculatorCityInput, string>>;
};

/** Normaliza un texto a slug (minúsculas, sin acentos, guiones). */
export function slugify(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos
    .replace(/[^a-z0-9]+/g, "-") // no-alfanumérico → guion
    .replace(/^-+|-+$/g, ""); // sin guiones en los bordes
}

/**
 * Valida el input parcial del form. Retorna `{input}` si pasa o `{fieldErrors}`.
 * Espeja los CHECK de la migración (km ≥ 0, slug no vacío).
 */
export function validateCityInput(input: Partial<CalculatorCityInput>): {
  input?: CalculatorCityInput;
  fieldErrors?: CalculatorCityActionState["fieldErrors"];
} {
  const errors: CalculatorCityActionState["fieldErrors"] = {};

  const label = (input.label ?? "").trim();
  if (!label) errors.label = "Indicá el nombre de la ciudad.";

  // El slug puede venir del form o derivarse del label. Si no hay ninguno → error.
  const slug = (input.slug ?? "").trim() || slugify(label);
  if (!slug) errors.slug = "Indicá un identificador (slug) válido.";
  else if (!/^[a-z0-9-]+$/.test(slug))
    errors.slug = "El slug solo admite minúsculas, números y guiones.";

  const km = input.km;
  if (km == null || !Number.isFinite(km)) {
    errors.km = "Indicá los km desde Valencia (0 si es casco).";
  } else if (km < 0) {
    errors.km = "Los km no pueden ser negativos.";
  }

  const sort = input.sort_order;
  if (sort != null && (!Number.isFinite(sort) || sort < 0)) {
    errors.sort_order = "El orden debe ser un entero positivo.";
  }

  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors };
  }

  return {
    input: {
      slug,
      label,
      km: km!,
      casco: input.casco ?? false,
      sort_order:
        sort != null && Number.isFinite(sort) ? Math.round(sort) : 0,
    },
  };
}

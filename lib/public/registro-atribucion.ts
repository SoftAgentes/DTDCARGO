/**
 * Atribución del alta self-service: los UTM con los que llegó a `/registro`
 * (SDD-0587, paso 6.4). Hasta aquí solo iban a Google Analytics.
 *
 * Terminan en `crm_tarjetas.utm_*` y no se pisan nunca, así que el querystring
 * público no escribe lo que quiera: se acepta un juego corto de caracteres, sin
 * `@` ni `=` ni `%`, para que un correo o una credencial anidada en un enlace
 * reenviado no llegue a la base.
 *
 * Vive en `lib/public/` como `registro-origen.ts`: lo leen la página pública y la
 * server action del alta; no toca Supabase ni el dominio de Studio.
 */

export const CAMPOS_UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

export type CampoUtm = (typeof CAMPOS_UTM)[number];
export type AtribucionUtm = Partial<Record<CampoUtm, string>>;

/** El largo que admite `crm_tarjetas`. */
const MAXIMO = 120;
const PERMITIDOS = /^[\p{L}\p{N} ._\-+~:/|,()&]+$/u;

function limpiar(raw: unknown): string | undefined {
  const valor = Array.isArray(raw) ? raw[0] : raw;
  if (typeof valor !== "string") return undefined;
  const limpio = valor.trim().slice(0, MAXIMO).trim();
  return PERMITIDOS.test(limpio) ? limpio : undefined;
}

/**
 * Normaliza los UTM desde `searchParams` o desde el formulario. Nunca tira: un
 * querystring raro no puede impedirle a nadie registrarse. Lo que no pasa se omite.
 *
 * @param leer cómo obtener cada campo de la fuente.
 */
export function normalizarAtribucion(leer: (campo: CampoUtm) => unknown): AtribucionUtm {
  const atribucion: AtribucionUtm = {};
  for (const campo of CAMPOS_UTM) {
    const valor = limpiar(leer(campo));
    if (valor) atribucion[campo] = valor;
  }
  return atribucion;
}

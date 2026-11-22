/**
 * Microsoft Clarity · configuración pura (sin React ni `"use client"`).
 *
 * La importan el componente `components/Clarity.tsx` y `next.config.ts`; por
 * eso no puede importar nada del bundler (el loader de la config no resuelve
 * `@/`). Evaluación: `docs/marketing/clarity-evaluacion.md` §2.3 y §2.4.
 *
 * Contrato de apagado (fase 1, se fusiona APAGADO):
 *  · `NEXT_PUBLIC_CLARITY_ID` ausente, vacía, con solo espacios o `off`
 *    (sin importar mayúsculas) ⇒ apagado: no se carga ningún script y la CSP
 *    no nombra a Clarity.
 *  · **Sin ID de respaldo en el código.** Es lo contrario de GA (SDD-0518):
 *    si la variable falta, la opción segura es apagado.
 *  · Un valor que no tenga forma de ID de proyecto (letras y números, de 6 a
 *    32) también apaga. El ID se interpola dentro de un `<script>` inline: un
 *    valor con comillas o `</script>` no debe llegar nunca a esa cadena.
 */

/** Forma de un ID de proyecto de Clarity: alfanumérico, sin separadores. */
const CLARITY_ID_PATTERN = /^[a-z0-9]{6,32}$/i;

/** Devuelve el ID utilizable o `""` (apagado). */
export function clarityIdFromEnv(raw: string | undefined | null): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value || value.toLowerCase() === "off") return "";
  return CLARITY_ID_PATTERN.test(value) ? value : "";
}

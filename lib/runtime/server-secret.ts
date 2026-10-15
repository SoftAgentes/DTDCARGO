/**
 * Secretos de servidor con respaldo, sin confundir "vacía" con "configurada" (SDD-0523).
 *
 * Docker Compose pasa `VAR=` como cadena vacía, no como `undefined`. Con
 * `process.env.A ?? process.env.B`, una `A` vacía no cae a `B`: el secreto queda
 * en `""`. El 2026-10-15 el servidor propio tenía `EMAIL_UNSUBSCRIBE_SECRET`
 * vacía. Con `""` exacto, el `!secret` de los llamadores la descartaba y fallaban
 * cerrados, pero sin caer al respaldo: toda baja daba error, también las
 * legítimas, y Actualidad no enviaba. Con sólo espacios era peor: `"  "` pasaba
 * el `!secret` y se usaba como clave, así que cualquiera podía sellar un enlace
 * de baja o una cookie de `/marca` válidos. Y donde no había `!secret`, como la
 * sal del hash de IP del newsletter, `""` sí se usaba.
 *
 * Reglas:
 *   - Vacía o con sólo espacios cuenta como ausente: se pasa a la siguiente.
 *   - El valor elegido se devuelve TAL CUAL, sin recortar. El `trim` sólo decide
 *     si está vacía. Recortar cambiaría la clave de un secreto que hoy tiene
 *     espacios, y con ella invalidaría los enlaces de baja ya enviados, que no
 *     vencen nunca.
 *   - Sin ninguno configurado devuelve `null` y el llamador falla cerrado.
 *
 * Recibe los valores, no los nombres, para que cada sitio siga escribiendo
 * `process.env.X` literal y se encuentre con un grep.
 */
export function firstConfiguredSecret(
  ...candidates: ReadonlyArray<string | null | undefined>
): string | null {
  for (const value of candidates) {
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return null;
}

/**
 * Secretos de servidor con respaldo, sin confundir "vacía" con "configurada" (SDD-0523).
 *
 * Docker Compose pasa `VAR=` como cadena vacía, no como `undefined`. Con
 * `process.env.A ?? process.env.B`, una `A` vacía no cae a `B`: el secreto queda
 * en `""`. El 2026-10-15 el servidor propio tenía `EMAIL_UNSUBSCRIBE_SECRET`
 * vacía, y los enlaces de baja se sellaban con la clave `sha256("")`, que
 * cualquiera puede calcular para falsificar uno.
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

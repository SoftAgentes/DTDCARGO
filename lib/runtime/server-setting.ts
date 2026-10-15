/**
 * Ajustes de servidor con respaldo, sin confundir "vacía" con "configurada" (SDD-0525).
 *
 * Docker Compose pasa `VAR=` como cadena vacía, no como `undefined`. Con
 * `process.env.A ?? DEFAULT`, una `A` vacía no cae al default: el ajuste queda
 * en `""`. Con los modelos de Anthropic eso es una llamada con `model: ""`, que
 * no nombra ningún modelo: el acta de Bitácora, la Escucha Activa y el resumen
 * mensual de Conversaciones fallaban aunque el código tuviera su default. La
 * plantilla del servidor (`infra/dtd-cargo/.env.example`) trae las tres vacías.
 *
 * Reglas:
 *   - Vacía o con sólo espacios cuenta como ausente: se pasa a la siguiente.
 *   - El valor elegido se devuelve RECORTADO. Un ID de modelo no lleva espacios,
 *     y uno pegado con un espacio al final no nombraría ningún modelo.
 *     Es lo contrario de `firstConfiguredSecret` (SDD-0523): un secreto se
 *     devuelve tal cual porque recortarlo cambiaría la clave y sus firmas.
 *   - Sin ninguno configurado devuelve `null` y el llamador pone su default.
 *
 * Recibe los valores, no los nombres, para que cada sitio siga escribiendo
 * `process.env.X` literal y se encuentre con un grep.
 */
export function firstConfiguredSetting(
  ...candidates: ReadonlyArray<string | null | undefined>
): string | null {
  for (const value of candidates) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed !== "") return trimmed;
  }
  return null;
}

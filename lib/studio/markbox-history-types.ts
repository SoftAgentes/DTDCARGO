/**
 * Historial de Shipping Mark (SDD-0258).
 *
 * Un cliente puede cambiar de código. El viejo NO se borra: queda reservado para
 * él, sigue resolviendo si llega carga rotulada con ese código, y se muestra como
 * historial en su ficha. Sólo uno es el actual.
 *
 * Sin Zod: validate*Input() a mano, patrón del proyecto.
 */

export type MarkboxHistoryEntry = {
  id: string;
  markbox: string;
  reason: string | null;
  retiredAt: string;
};

/**
 * SDD-0712 · Los códigos de fichas FUSIONADAS en esta (y sus historiales) también
 * son «códigos anteriores» del cliente: la ficha los muestra junto al historial
 * de renombres. `codigosFicha` es la lista de `listCodigosDeLaFicha` (vigente
 * primero); aquí quedan solo los que no son el vigente ni ya están en el historial.
 * Sin fecha: la fusión no guarda el código, solo la ficha retirada.
 */
export function entradasDeCodigosFusionados(
  codigosFicha: readonly string[],
  vigente: string,
  historial: readonly MarkboxHistoryEntry[],
): MarkboxHistoryEntry[] {
  const conocidos = new Set(
    [vigente, ...historial.map((h) => h.markbox)].map((c) => c.trim().toUpperCase()),
  );
  const salida: MarkboxHistoryEntry[] = [];
  for (const crudo of codigosFicha) {
    const codigo = crudo.trim();
    const clave = codigo.toUpperCase();
    if (!codigo || conocidos.has(clave)) continue;
    conocidos.add(clave);
    salida.push({
      id: `fusion:${clave}`,
      markbox: codigo,
      reason: "Ficha fusionada en esta (el código sigue resolviendo)",
      retiredAt: "",
    });
  }
  return salida;
}

export type RenameMarkboxActionState = { ok?: boolean; error?: string } | null;

/**
 * Espejo de las validaciones de `rename_client_markbox()` (migr 0367). Existe
 * para dar el error en el formulario en vez de esperar el viaje a la base; la
 * base valida igual y ella es la que manda.
 *
 * ⚠️ Deliberadamente NO valida la familia del código (DTD-, insignia de aliado):
 * eso depende de si el cliente cuelga de un aliado y de qué aliados existen, y
 * esa decisión vive en la base, donde no puede quedar desincronizada.
 */
export function validateNuevoMarkbox(
  raw: string | null | undefined,
  actual: string,
): { value?: string; error?: string } {
  const v = (raw ?? "").trim().toUpperCase();
  if (!v) return { error: "El Shipping Mark nuevo es obligatorio." };
  if (v.length > 40) return { error: "El Shipping Mark es muy largo (máx. 40)." };
  if (!/^[A-Z0-9-]+$/.test(v)) {
    return { error: "Sólo letras, números y guiones. Sin espacios ni acentos." };
  }
  if (v === actual.trim().toUpperCase()) {
    return { error: "Ese ya es su Shipping Mark actual." };
  }
  return { value: v };
}

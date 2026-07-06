/**
 * Reset de verificación de identidad al cambiar los datos del cliente (SDD-0151).
 *
 * La verificación contra el registro oficial (CNE persona / SENIAT empresa,
 * SDD-0046) coteja `name` + `rif` y persiste el veredicto en `clients.doc_verify_*`.
 * Si después cambia el nombre o el RIF/cédula, ese veredicto queda apuntando al
 * documento VIEJO — la ficha diría "verificado" contra datos que ya no son.
 *
 * Este helper devuelve el patch que limpia `doc_verify_*` (fuerza re-verificación)
 * cuando cambia algo relevante, o `null` si solo cambió el teléfono / nada. Se usa
 * en las dos rutas que mutan identidad: el edit directo del admin
 * (`updateClientAction`) y la aprobación de una solicitud del cliente
 * (`approveChangeRequestAction`).
 */

/** Normaliza para comparar "cambió de verdad" (ignora espacios/mayúsculas). */
const norm = (v: string | null | undefined): string =>
  (v ?? "").toLowerCase().replace(/\s+/g, " ").trim();

export type IdentityResetPatch = {
  doc_verify_status: null;
  doc_verify_source: null;
  doc_registry_name: null;
  doc_verified_at: null;
  doc_verified_by: null;
};

/**
 * Solo considera un campo si viene definido en `next` (así, en una aprobación que
 * solo toca el teléfono, `name`/`rif` van `undefined` y no gatillan reset).
 * Ante duda (diferencia de formato) resetea — es el lado seguro: re-verificar de
 * más es inocuo; quedarse "verificado" contra un documento viejo, no.
 */
export function identityResetOnChange(
  prev: { name?: string | null; rif?: string | null },
  next: { name?: string | null; rif?: string | null },
): IdentityResetPatch | null {
  const nameChanged = next.name !== undefined && norm(next.name) !== norm(prev.name);
  const rifChanged = next.rif !== undefined && norm(next.rif) !== norm(prev.rif);
  if (!nameChanged && !rifChanged) return null;
  return {
    doc_verify_status: null,
    doc_verify_source: null,
    doc_registry_name: null,
    doc_verified_at: null,
    doc_verified_by: null,
  };
}

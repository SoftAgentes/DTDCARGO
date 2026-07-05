/**
 * lib/studio/bitacora/client-match.ts · SDD-0150 Fase B — match externo→cliente.
 *
 * PURO (sin red, sin DB) → testeable 1:1. Recibe el nombre que detectó la IA y
 * los candidatos que trajo `listClients` del tenant, y decide la sugerencia:
 *   - 1 match EXACTO por nombre (normalizado, sin acentos) → confianza ALTA.
 *   - varios exactos → ambiguo, sin sugerencia (el humano elige).
 *   - 1 solo candidato → confianza MEDIA (sugerir, pero confirmar).
 *   - varios parciales (el caso "González") → ambiguo, sin sugerencia.
 * NUNCA inventa un cliente: si no hay candidatos, no sugiere nada.
 */

import type { BitacoraConfianza } from "./bitacora-types";
import { normalizeName } from "./match";

export interface ClientCandidate {
  id: string;
  name: string;
  markbox?: string | null;
}

export interface ClientMatch {
  client_id: string;
  cliente_nombre: string;
  confianza: BitacoraConfianza;
}

/**
 * Elige el mejor match determinista, o null si es ambiguo / no hay candidatos.
 * `null` significa "que el humano confirme en el combobox".
 */
export function pickClientMatch(
  nombre: string | null | undefined,
  candidates: readonly ClientCandidate[],
): ClientMatch | null {
  const n = normalizeName(nombre ?? "");
  if (!n || candidates.length === 0) return null;

  // (a) match exacto por nombre normalizado.
  const exact = candidates.filter((c) => normalizeName(c.name) === n);
  if (exact.length === 1) {
    return { client_id: exact[0].id, cliente_nombre: exact[0].name, confianza: "alta" };
  }
  if (exact.length > 1) return null; // varios "González 2010" exactos → ambiguo.

  // (b) un único candidato en toda la búsqueda → sugerencia media.
  if (candidates.length === 1) {
    return {
      client_id: candidates[0].id,
      cliente_nombre: candidates[0].name,
      confianza: "media",
    };
  }

  // (c) varios parciales → ambiguo (el humano elige cuál).
  return null;
}

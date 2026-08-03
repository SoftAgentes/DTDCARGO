/**
 * Detección de fichas duplicadas del mismo cliente (SDD-0244).
 *
 * El caso: un cliente que YA existe entra a /registro, se registra como si fuera
 * nuevo, y el sistema le emite un Shipping Mark nuevo. Queda con dos fichas.
 *
 * Acá sólo se LEE la propuesta. La fusión la confirma un humano desde el Studio
 * — nunca corre sola. La razón está en los datos: de los tres duplicados reales
 * que había en producción, uno (`DTD-J000` ↔ `DTD-9001`) coincide ÚNICAMENTE por
 * nombre, y el nombre era "Jose Mendez". Automatizar eso fusiona a dos personas
 * distintas, que es un daño mucho peor que el duplicado.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** Un par (ficha vieja ↔ ficha nueva) que parece el mismo cliente. */
export type DuplicateCandidate = {
  legacyId: string;
  legacyMarkbox: string | null;
  legacyName: string;
  newId: string;
  newMarkbox: string | null;
  newName: string;
  matchEmail: boolean;
  matchPhone: boolean;
  matchName: boolean;
  matchDocument: boolean;
  /** Documento 3 · correo 2 · teléfono 2 · nombre 1. Más alto = más confiable. */
  score: number;
};

type CandidateRow = {
  legacy_id: string;
  legacy_markbox: string | null;
  legacy_name: string;
  new_id: string;
  new_markbox: string | null;
  new_name: string;
  match_email: boolean;
  match_phone: boolean;
  match_name: boolean;
  match_document: boolean;
  score: number;
};

/**
 * Pares candidatos del tenant de la sesión.
 *
 * La RPC NO recibe el tenant a propósito: es security definer (necesita ver las
 * dos fichas para compararlas), así que lo saca de la sesión. Si lo recibiera
 * por parámetro, cualquier usuario podría pedir los duplicados de otro tenant.
 */
export async function listDuplicateCandidates(
  supabase: SupabaseClient,
): Promise<DuplicateCandidate[]> {
  const { data, error } = await supabase.rpc("client_duplicate_candidates");
  if (error) {
    console.error("[listDuplicateCandidates]", error.message);
    return [];
  }
  const rows = (data ?? []) as CandidateRow[];
  return rows.map((r) => ({
    legacyId: r.legacy_id,
    legacyMarkbox: r.legacy_markbox,
    legacyName: r.legacy_name,
    newId: r.new_id,
    newMarkbox: r.new_markbox,
    newName: r.new_name,
    matchEmail: r.match_email,
    matchPhone: r.match_phone,
    matchName: r.match_name,
    matchDocument: r.match_document,
    score: r.score,
  }));
}

/**
 * Qué tan confiable es la coincidencia, para que el operador sepa cuánto mirar
 * antes de confirmar.
 *
 * `debil` = coincide sólo por nombre. Es el caso "Jose Mendez": hay que abrir las
 * dos fichas y comprobar a mano antes de tocar nada.
 */
export function candidateConfidence(c: DuplicateCandidate): "alta" | "media" | "debil" {
  if (c.matchDocument) return "alta";
  if (c.matchEmail && c.matchPhone) return "alta";
  if (c.matchEmail || c.matchPhone) return "media";
  return "debil";
}

/** Lista legible de por qué se propuso el par ("correo, teléfono y nombre"). */
export function candidateReasons(c: DuplicateCandidate): string[] {
  const r: string[] = [];
  if (c.matchDocument) r.push("documento");
  if (c.matchEmail) r.push("correo");
  if (c.matchPhone) r.push("teléfono");
  if (c.matchName) r.push("nombre");
  return r;
}

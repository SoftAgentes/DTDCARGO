/**
 * searchClientsAction — búsqueda read-only de clientes para el combobox
 * cédula-first (SDD-0108, Fase 3 de la identidad por persona · SDD-0106).
 *
 * Compartida por los formularios que ELIGEN un cliente (cotizador, tracking).
 * No muta datos → gate de VISTA (`canAccessModule(role, "clients")`), no
 * `moduleEditDenial`. RLS por tenant filtra el resto.
 *
 * Cédula-first: si `q` normaliza a algo cédula-like, intenta primero el match
 * exacto tolerante a formato (`find_client_by_cedula`, RPC 0174) y lo pone al
 * tope; siempre además corre `listClients` ilike (nombre/markbox/rif/email/
 * teléfono); dedup por `id`; tope `LIMIT` resultados.
 */

"use server";

import { createClient } from "@/lib/db/server";
import { getStudioRole } from "@/lib/studio/rbac-guard";
import { canAccessModule } from "@/lib/studio/rbac";
import { getClientByCedula, listClients } from "@/lib/studio/client-queries";
import { normalizeCedula } from "@/lib/studio/person-types";

/** Forma mínima que el combobox necesita de cada coincidencia. */
export type ClientSearchHit = {
  id: string;
  markbox: string;
  name: string;
  rif: string | null;
  person_id: string | null;
};

export type ClientSearchResult = {
  hits: ClientSearchHit[];
  error?: string;
};

/** Tope de resultados (anti-scraping + UX). */
const LIMIT = 8;

/**
 * Heurística cédula-like: tras normalizar (saca puntos/guiones), queda algo
 * con dígitos suficientes para parecer una cédula/RIF venezolano. Evita
 * gastar el RPC en búsquedas por nombre. No valida el dígito verificador —
 * sólo decide si vale la pena intentar el match exacto.
 */
function looksLikeCedula(normalized: string): boolean {
  if (normalized.length < 5) return false;
  const digits = normalized.replace(/[^0-9]/g, "");
  return digits.length >= 5;
}

export async function searchClientsAction(q: string): Promise<ClientSearchResult> {
  const term = (q ?? "").trim();
  if (term.length < 2) return { hits: [] };

  const supabase = await createClient();

  // Gate de VISTA (read-only): el rol debe poder ver Clientes en su tenant.
  const role = await getStudioRole(supabase);
  if (!canAccessModule(role, "clients")) {
    return { hits: [], error: "No tienes permiso para buscar clientes." };
  }

  const hits: ClientSearchHit[] = [];
  const seen = new Set<string>();

  const push = (c: {
    id: string;
    markbox: string;
    name: string;
    rif: string | null;
    person_id: string | null;
  }) => {
    if (seen.has(c.id)) return;
    seen.add(c.id);
    hits.push({
      id: c.id,
      markbox: c.markbox,
      name: c.name,
      rif: c.rif,
      person_id: c.person_id,
    });
  };

  try {
    // 1. Cédula-first: si parece cédula/RIF, el match exacto va PRIMERO.
    const normalized = normalizeCedula(term);
    if (looksLikeCedula(normalized)) {
      const exact = await getClientByCedula(supabase, term);
      if (exact) push(exact);
    }

    // 2. Búsqueda libre ilike (nombre/markbox/rif/email/teléfono). Dedup por id.
    const matches = await listClients(supabase, { q: term });
    for (const c of matches) {
      if (hits.length >= LIMIT) break;
      push(c);
    }
  } catch {
    return { hits: [], error: "No se pudo completar la búsqueda." };
  }

  return { hits: hits.slice(0, LIMIT) };
}

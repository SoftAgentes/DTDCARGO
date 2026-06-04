/**
 * Sellado server-side de una aceptación legal (SDD-0054 · Slice A).
 *
 * El SERVIDOR sella, el cliente NO: `accepted_at` (server time), `ip` (real, del
 * request) y `hash` (SHA-256 del payload canónico + ip + accepted_at) los pone
 * esta función — nunca el cliente. `sealAcceptance` es PURA y testeable: recibe
 * `ip` y `now` por parámetro (no los lee de `process`/`Date.now`), así el test
 * fija ambos y el hash es reproducible.
 *
 * Usa `node:crypto` (sin dependencia externa).
 */

import { createHash } from "node:crypto";
import {
  acceptanceHashPayload,
  type AcceptanceEvidence,
  type AcceptanceInput,
  type DocRef,
} from "./types";

/** Prefijo de versión del formato de evidencia (margen a futuras revisiones). */
const EVIDENCE_VERSION = 1;

/**
 * Hash SHA-256 (hex) de una evidencia COMPLETA y canónica. ÚNICA fuente de
 * verdad del hash: tanto el sello (`acceptanceHash`/`sealAcceptance`) como el
 * gate (`queries.ts → hasValidAcceptance`, que recomputa desde la fila de la DB)
 * pasan por acá → no hay forma de que sello y verificación deriven. Round-2: el
 * payload es inyectivo e incluye ip + accepted_at, así el hash es load-bearing.
 */
export function hashEvidence(ev: AcceptanceEvidence): string {
  const evidence = JSON.stringify({
    v: EVIDENCE_VERSION,
    payload: acceptanceHashPayload(ev),
  });
  return createHash("sha256").update(evidence, "utf8").digest("hex");
}

/**
 * Registro listo para insertar en `legal_acceptances`. Es el `AcceptanceInput`
 * del cliente + los campos SELLADOS por el servidor (accepted_at/ip/hash) +
 * el snapshot de docs aceptados. `acceptance_code` lo asigna la action vía
 * `next_acceptance_code` (RPC) — no es parte del sello.
 */
export type SealedAcceptance = {
  client_id: string | null;
  client_markbox: string;
  quote_code: string;
  docs: DocRef[];
  cbm: number;
  weight_kg: number;
  total_usd: number;
  idempotency_key: string | null;
  accepted_at: string;
  ip: string | null;
  hash: string;
};

/**
 * Hash SHA-256 (hex) de la evidencia COMPLETA. Round-2: el payload canónico ya
 * incluye TODOS los campos de evidencia, incluidos los server-sellados (`ip`,
 * `accepted_at`) — `acceptanceHashPayload` es inyectivo. El gate (queries.ts)
 * recomputa este mismo hash desde la fila de la DB para verificar que no fue
 * forjado. El prefijo de versión (`v:1`) deja margen a revisar el formato sin
 * colisión futura.
 */
export function acceptanceHash(
  input: AcceptanceInput,
  docs: DocRef[],
  ip: string | null,
  acceptedAt: string,
): string {
  const cleanIp = ip != null && String(ip).trim() !== "" ? String(ip).trim() : null;
  return hashEvidence({
    client_markbox: input.client_markbox,
    quote_code: input.quote_code,
    docs,
    cbm: input.cbm,
    weight_kg: input.weight_kg,
    total_usd: input.total_usd,
    ip: cleanIp,
    accepted_at: acceptedAt,
  });
}

/**
 * Sella una aceptación: arma el record server-sellado a partir de lo que el
 * cliente declaró (`input` + `docs`) y de lo que aporta el servidor (`ip`,
 * `now`). El cliente NO controla accepted_at/ip/hash — se ignoran si vinieran
 * en el input (el tipo `AcceptanceInput` ni siquiera los tiene).
 *
 * PURA: mismas entradas ⇒ mismo output (mismo hash). `now` es un Date que la
 * action pasa como `new Date()` y el test fija.
 *
 * INVARIANTE (M-2 · round-3): `accepted_at` SIEMPRE se sella con precisión de
 * MILISEGUNDOS (`Date.toISOString()` → `…000Z`, 3 cifras). El hash incluye
 * `accepted_at`, y el gate (queries.ts) lo recomputa desde la fila canonizándolo
 * con `new Date(raw).toISOString()` (también ms). Por eso TODA inserción en
 * `legal_acceptances` DEBE sellar `accepted_at` EXPLÍCITO con este valor — NO
 * confiar en el `default now()` de la columna timestamptz: Postgres lo guardaría
 * con MICROsegundos (6 cifras), que `new Date(raw)` trunca a ms al recomputar →
 * el hash no matchearía → la fila válida se descartaría (falso-negativo
 * silencioso del gate). La action de Slice C inserta `accepted_at: seal.accepted_at`
 * explícito; cualquier seed/import/migración futura debe hacer lo mismo.
 */
export function sealAcceptance(
  input: AcceptanceInput,
  docs: DocRef[],
  ip: string | null,
  now: Date,
): SealedAcceptance {
  const acceptedAt = now.toISOString();
  const cleanIp = ip != null && String(ip).trim() !== "" ? String(ip).trim() : null;
  const hash = acceptanceHash(input, docs, cleanIp, acceptedAt);

  return {
    client_id: input.client_id,
    client_markbox: input.client_markbox,
    quote_code: input.quote_code,
    docs: docs.map((d) => ({ key: String(d.key), version: String(d.version) })),
    cbm: input.cbm,
    weight_kg: input.weight_kg,
    total_usd: input.total_usd,
    idempotency_key: input.idempotency_key,
    accepted_at: acceptedAt,
    ip: cleanIp,
    hash,
  };
}

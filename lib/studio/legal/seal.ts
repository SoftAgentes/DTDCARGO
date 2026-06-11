/**
 * Sellado server-side de una aceptación legal (SDD-0054 · Slice A + SDD-0067 · v2).
 *
 * El SERVIDOR sella, el cliente NO: `accepted_at` (server time), `ip` (real, del
 * request), `user_agent` (de los headers del request, NUNCA del body del form) y
 * `hash` (SHA-256 del payload canónico v2) los pone esta función — nunca el
 * cliente. `sealAcceptance` es PURA y testeable: recibe `ip`, `userAgent` y `now`
 * por parámetro (no los lee de `process`/`Date.now`/`headers`), así el test fija
 * todos y el hash es reproducible.
 *
 * Usa `node:crypto` (sin dependencia externa).
 */

import { createHash } from "node:crypto";
import {
  acceptanceHashPayload,
  sanitizeUserAgent,
  type AcceptanceEvidence,
  type AcceptanceInput,
  type DocRef,
} from "./types";

/**
 * Prefijo de versión del formato de evidencia (margen a futuras revisiones).
 *
 * v2 (SDD-0067): el payload canónico suma `user_agent` + `merchant_declaration`.
 * Breaking LIMPIO: verificado 2026-06-10 que `legal_acceptances` tiene 0 filas
 * en prod → no hay evidencia v1 que preservar (v1 nunca selló nada productivo).
 */
const EVIDENCE_VERSION = 2;

/**
 * Hash SHA-256 (hex) de una evidencia COMPLETA y canónica. ÚNICA fuente de
 * verdad del hash: tanto el sello (`acceptanceHash`/`sealAcceptance`) como el
 * gate (`queries.ts → acceptanceRowValid`, que recomputa desde la fila de la DB)
 * y el export de evidencia (`getAcceptanceEvidence`) pasan por acá → no hay
 * forma de que sello y verificación deriven. Round-2: el payload es inyectivo e
 * incluye ip + accepted_at (+ user_agent + merchant_declaration en v2), así el
 * hash es load-bearing.
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
 * + los campos SELLADOS por el servidor (accepted_at/ip/user_agent/hash) +
 * el snapshot de docs aceptados. `acceptance_code` lo asigna la action vía
 * `next_acceptance_code` (RPC) — no es parte del sello. `invoice_id` viaja como
 * METADATO (columna 0120) — no es parte del hash.
 */
export type SealedAcceptance = {
  client_id: string | null;
  client_markbox: string;
  quote_code: string;
  docs: DocRef[];
  cbm: number;
  weight_kg: number;
  total_usd: number;
  user_agent: string | null;
  merchant_declaration: boolean;
  invoice_id: string | null;
  idempotency_key: string | null;
  accepted_at: string;
  ip: string | null;
  hash: string;
};

/**
 * Hash SHA-256 (hex) de la evidencia COMPLETA (v2). El payload canónico incluye
 * TODOS los campos de evidencia, incluidos los server-sellados (`ip`,
 * `user_agent`, `accepted_at`) y la declaración de comerciante —
 * `acceptanceHashPayload` es inyectivo. El gate (queries.ts) recomputa este
 * mismo hash desde la fila de la DB para verificar que no fue forjado. El
 * prefijo de versión (`v:2`) deja margen a revisar el formato sin colisión.
 *
 * `invoice_id` del input NO participa (metadato forense fuera del hash).
 */
export function acceptanceHash(
  input: AcceptanceInput,
  docs: DocRef[],
  ip: string | null,
  userAgent: string | null,
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
    user_agent: sanitizeUserAgent(userAgent),
    merchant_declaration: input.merchant_declaration === true,
    accepted_at: acceptedAt,
  });
}

/**
 * Sella una aceptación: arma el record server-sellado a partir de lo declarado
 * (`input` + `docs`) y de lo que aporta el servidor (`ip`, `userAgent`, `now`).
 * El cliente NO controla accepted_at/ip/user_agent/hash — el `user_agent` que
 * se sella es EL PARÁMETRO (leído de `headers()` por la action), no lo que
 * pudiera traer `input.user_agent` (la action setea ambos del mismo header;
 * acá manda el parámetro para que la procedencia server-side sea inequívoca).
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
 *
 * INVARIANTE v2 (SDD-0067): el `user_agent` se persiste EXACTAMENTE como se
 * hasheó (saneado acá, una sola vez). El recompute del gate lo toma de la fila
 * AS-IS — si alguien lo muta post-hoc (aunque sea 1 char), el hash no matchea.
 */
export function sealAcceptance(
  input: AcceptanceInput,
  docs: DocRef[],
  ip: string | null,
  userAgent: string | null,
  now: Date,
): SealedAcceptance {
  const acceptedAt = now.toISOString();
  const cleanIp = ip != null && String(ip).trim() !== "" ? String(ip).trim() : null;
  const cleanUa = sanitizeUserAgent(userAgent);
  const hash = acceptanceHash(input, docs, cleanIp, cleanUa, acceptedAt);

  return {
    client_id: input.client_id,
    client_markbox: input.client_markbox,
    quote_code: input.quote_code,
    docs: docs.map((d) => ({ key: String(d.key), version: String(d.version) })),
    cbm: input.cbm,
    weight_kg: input.weight_kg,
    total_usd: input.total_usd,
    user_agent: cleanUa,
    merchant_declaration: input.merchant_declaration === true,
    invoice_id: input.invoice_id,
    idempotency_key: input.idempotency_key,
    accepted_at: acceptedAt,
    ip: cleanIp,
    hash,
  };
}

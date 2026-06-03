/**
 * Tests del sellado server-side (SDD-0054 · Slice A). Cubre Acceptance §5:
 *  - hash SHA-256 determinístico: mismo input (con docs en otro orden) → MISMO
 *    hash; payload distinto → hash distinto.
 *  - sealAcceptance sella accepted_at/ip/hash y NO confía en el cliente para
 *    esos campos (recibe now/ip por parámetro, no del entorno).
 */

import { describe, it, expect } from "vitest";
import { sealAcceptance, acceptanceHash } from "../seal";
import type { AcceptanceInput, DocRef } from "../types";

const input: AcceptanceInput = {
  client_id: "client-1",
  client_markbox: "DTD-5452",
  quote_code: "Q-2026-2310",
  cbm: 7,
  weight_kg: 2800,
  total_usd: 5600,
  idempotency_key: "idem-1",
};

const docs: DocRef[] = [
  { key: "tyc", version: "v2.1" },
  { key: "operador", version: "v1.4" },
];

const docsReversed: DocRef[] = [
  { key: "operador", version: "v1.4" },
  { key: "tyc", version: "v2.1" },
];

const NOW = new Date("2026-05-29T10:15:33.000Z");
const IP = "190.142.88.214";

// ── acceptanceHash ────────────────────────────────────────────
describe("acceptanceHash", () => {
  it("es un SHA-256 hex (64 chars)", () => {
    const h = acceptanceHash(input, docs, IP, NOW.toISOString());
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("docs en otro orden, mismo ip/at → MISMO hash (payload canónico)", () => {
    const h1 = acceptanceHash(input, docs, IP, NOW.toISOString());
    const h2 = acceptanceHash(input, docsReversed, IP, NOW.toISOString());
    expect(h1).toBe(h2);
  });

  it("medida distinta → hash distinto", () => {
    const h1 = acceptanceHash(input, docs, IP, NOW.toISOString());
    const h2 = acceptanceHash(
      { ...input, total_usd: 5601 },
      docs,
      IP,
      NOW.toISOString(),
    );
    expect(h1).not.toBe(h2);
  });

  it("ip distinta → hash distinto (la ip entra en la huella)", () => {
    const h1 = acceptanceHash(input, docs, IP, NOW.toISOString());
    const h2 = acceptanceHash(input, docs, "10.0.0.1", NOW.toISOString());
    expect(h1).not.toBe(h2);
  });

  it("accepted_at distinto → hash distinto", () => {
    const h1 = acceptanceHash(input, docs, IP, NOW.toISOString());
    const h2 = acceptanceHash(
      input,
      docs,
      IP,
      new Date("2026-05-29T10:15:34.000Z").toISOString(),
    );
    expect(h1).not.toBe(h2);
  });
});

// ── sealAcceptance ────────────────────────────────────────────
describe("sealAcceptance", () => {
  it("sella accepted_at (server time) e ip, y computa el hash", () => {
    const sealed = sealAcceptance(input, docs, IP, NOW);
    expect(sealed.accepted_at).toBe("2026-05-29T10:15:33.000Z");
    expect(sealed.ip).toBe(IP);
    expect(sealed.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(sealed.hash).toBe(acceptanceHash(input, docs, IP, NOW.toISOString()));
  });

  it("es PURA: mismas entradas → mismo record (mismo hash)", () => {
    const a = sealAcceptance(input, docs, IP, NOW);
    const b = sealAcceptance(input, docs, IP, NOW);
    expect(a).toEqual(b);
  });

  it("docs en otro orden → mismo hash, conserva el orden enviado en el snapshot", () => {
    const a = sealAcceptance(input, docs, IP, NOW);
    const b = sealAcceptance(input, docsReversed, IP, NOW);
    expect(a.hash).toBe(b.hash); // hash canónico independiente del orden
    expect(b.docs).toEqual(docsReversed); // pero el snapshot guarda lo enviado
  });

  it("ip vacía/espacios → null (no confía en input basura)", () => {
    expect(sealAcceptance(input, docs, "   ", NOW).ip).toBeNull();
    expect(sealAcceptance(input, docs, null, NOW).ip).toBeNull();
  });

  it("ip null produce hash distinto que ip real", () => {
    const withIp = sealAcceptance(input, docs, IP, NOW);
    const noIp = sealAcceptance(input, docs, null, NOW);
    expect(withIp.hash).not.toBe(noIp.hash);
  });

  it("propaga la medida y los docs del input al record", () => {
    const sealed = sealAcceptance(input, docs, IP, NOW);
    expect(sealed.cbm).toBe(7);
    expect(sealed.weight_kg).toBe(2800);
    expect(sealed.total_usd).toBe(5600);
    expect(sealed.client_markbox).toBe("DTD-5452");
    expect(sealed.quote_code).toBe("Q-2026-2310");
    expect(sealed.idempotency_key).toBe("idem-1");
  });
});

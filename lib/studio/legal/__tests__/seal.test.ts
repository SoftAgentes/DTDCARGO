/**
 * Tests del sellado server-side (SDD-0054 · Slice A + SDD-0067 · evidencia v2).
 * Cubre Acceptance §5 de ambas specs:
 *  - hash SHA-256 determinístico: mismo input (con docs en otro orden) → MISMO
 *    hash; payload distinto → hash distinto.
 *  - v2: `user_agent` y `merchant_declaration` ENTRAN al hash (alterarlos lo
 *    cambia); `invoice_id` NO entra (metadato forense — alterarlo no lo cambia).
 *  - sealAcceptance sella accepted_at/ip/user_agent/hash y NO confía en el
 *    cliente para esos campos (recibe now/ip/userAgent por parámetro, no del
 *    entorno; el user_agent sellado es el PARÁMETRO, no input.user_agent).
 */

import { describe, it, expect } from "vitest";
import { sealAcceptance, acceptanceHash } from "../seal";
import { USER_AGENT_MAX_LENGTH, type AcceptanceInput, type DocRef } from "../types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0";

const input: AcceptanceInput = {
  client_id: "client-1",
  client_markbox: "DTD-5452",
  quote_code: "Q-2026-2310",
  cbm: 7,
  weight_kg: 2800,
  total_usd: 5600,
  user_agent: UA,
  merchant_declaration: true,
  invoice_id: "inv-1",
  idempotency_key: "idem-1",
};

const docs: DocRef[] = [
  { key: "tyc", version: "v2.1", body_sha256: "sha-tyc-v2.1" },
  { key: "operador", version: "v1.4", body_sha256: "sha-operador-v1.4" },
];

const docsReversed: DocRef[] = [
  { key: "operador", version: "v1.4", body_sha256: "sha-operador-v1.4" },
  { key: "tyc", version: "v2.1", body_sha256: "sha-tyc-v2.1" },
];

const NOW = new Date("2026-05-29T10:15:33.000Z");
const AT = NOW.toISOString();
const IP = "190.142.88.214";

// ── acceptanceHash ────────────────────────────────────────────
describe("acceptanceHash", () => {
  it("es un SHA-256 hex (64 chars)", () => {
    const h = acceptanceHash(input, docs, IP, UA, AT);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("docs en otro orden, mismo ip/ua/at → MISMO hash (payload canónico)", () => {
    const h1 = acceptanceHash(input, docs, IP, UA, AT);
    const h2 = acceptanceHash(input, docsReversed, IP, UA, AT);
    expect(h1).toBe(h2);
  });

  it("medida distinta → hash distinto", () => {
    const h1 = acceptanceHash(input, docs, IP, UA, AT);
    const h2 = acceptanceHash({ ...input, total_usd: 5601 }, docs, IP, UA, AT);
    expect(h1).not.toBe(h2);
  });

  it("ip distinta → hash distinto (la ip entra en la huella)", () => {
    const h1 = acceptanceHash(input, docs, IP, UA, AT);
    const h2 = acceptanceHash(input, docs, "10.0.0.1", UA, AT);
    expect(h1).not.toBe(h2);
  });

  it("accepted_at distinto → hash distinto", () => {
    const h1 = acceptanceHash(input, docs, IP, UA, AT);
    const h2 = acceptanceHash(
      input,
      docs,
      IP,
      UA,
      new Date("2026-05-29T10:15:34.000Z").toISOString(),
    );
    expect(h1).not.toBe(h2);
  });

  // ── v2 (SDD-0067) ───────────────────────────────────────────
  it("v2: user_agent distinto → hash distinto (entra a la huella)", () => {
    const h1 = acceptanceHash(input, docs, IP, UA, AT);
    const h2 = acceptanceHash(input, docs, IP, "OtroNavegador/1.0", AT);
    expect(h1).not.toBe(h2);
  });

  it("v2: user_agent null vs presente → hash distinto", () => {
    const h1 = acceptanceHash(input, docs, IP, UA, AT);
    const h2 = acceptanceHash(input, docs, IP, null, AT);
    expect(h1).not.toBe(h2);
  });

  it("v2: merchant_declaration false vs true → hash distinto (es parte de lo aceptado)", () => {
    const h1 = acceptanceHash(input, docs, IP, UA, AT);
    const h2 = acceptanceHash(
      { ...input, merchant_declaration: false },
      docs,
      IP,
      UA,
      AT,
    );
    expect(h1).not.toBe(h2);
  });

  it("v2: invoice_id distinto → MISMO hash (metadato forense FUERA del hash)", () => {
    // Decisión #1 de la spec: la granularidad de re-aceptación es la ORDEN
    // (quote_code) — re-emitir la factura del mismo shipment NO invalida la
    // aceptación, así que invoice_id no participa de la huella.
    const h1 = acceptanceHash(input, docs, IP, UA, AT);
    const h2 = acceptanceHash({ ...input, invoice_id: "inv-999" }, docs, IP, UA, AT);
    const h3 = acceptanceHash({ ...input, invoice_id: null }, docs, IP, UA, AT);
    expect(h1).toBe(h2);
    expect(h1).toBe(h3);
  });

  it("v2: el user_agent que manda es el PARÁMETRO, no input.user_agent", () => {
    // El sello hashea el UA leído de headers() (parámetro); lo que pudiera
    // traer el input no cambia la huella (el cliente no escribe su evidencia).
    const h1 = acceptanceHash(input, docs, IP, UA, AT);
    const h2 = acceptanceHash(
      { ...input, user_agent: "forjado-por-el-cliente" },
      docs,
      IP,
      UA,
      AT,
    );
    expect(h1).toBe(h2);
  });
});

// ── sealAcceptance ────────────────────────────────────────────
describe("sealAcceptance", () => {
  it("sella accepted_at (server time), ip y user_agent, y computa el hash", () => {
    const sealed = sealAcceptance(input, docs, IP, UA, NOW);
    expect(sealed.accepted_at).toBe("2026-05-29T10:15:33.000Z");
    expect(sealed.ip).toBe(IP);
    expect(sealed.user_agent).toBe(UA);
    expect(sealed.merchant_declaration).toBe(true);
    expect(sealed.invoice_id).toBe("inv-1");
    expect(sealed.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(sealed.hash).toBe(acceptanceHash(input, docs, IP, UA, AT));
  });

  it("es PURA: mismas entradas → mismo record (mismo hash)", () => {
    const a = sealAcceptance(input, docs, IP, UA, NOW);
    const b = sealAcceptance(input, docs, IP, UA, NOW);
    expect(a).toEqual(b);
  });

  it("docs en otro orden → mismo hash, conserva el orden enviado en el snapshot", () => {
    const a = sealAcceptance(input, docs, IP, UA, NOW);
    const b = sealAcceptance(input, docsReversed, IP, UA, NOW);
    expect(a.hash).toBe(b.hash); // hash canónico independiente del orden
    expect(b.docs).toEqual(docsReversed); // pero el snapshot guarda lo enviado
  });

  it("ip vacía/espacios → null (no confía en input basura)", () => {
    expect(sealAcceptance(input, docs, "   ", UA, NOW).ip).toBeNull();
    expect(sealAcceptance(input, docs, null, UA, NOW).ip).toBeNull();
  });

  it("ip null produce hash distinto que ip real", () => {
    const withIp = sealAcceptance(input, docs, IP, UA, NOW);
    const noIp = sealAcceptance(input, docs, null, UA, NOW);
    expect(withIp.hash).not.toBe(noIp.hash);
  });

  // ── v2 (SDD-0067): saneo del user_agent ─────────────────────
  it("v2: user_agent vacío/espacios/null → null sellado", () => {
    expect(sealAcceptance(input, docs, IP, "   ", NOW).user_agent).toBeNull();
    expect(sealAcceptance(input, docs, IP, null, NOW).user_agent).toBeNull();
  });

  it("v2: user_agent con espacios → trim; > 512 chars → truncado a 512", () => {
    const padded = sealAcceptance(input, docs, IP, `  ${UA}  `, NOW);
    expect(padded.user_agent).toBe(UA);

    const long = "x".repeat(USER_AGENT_MAX_LENGTH + 100);
    const sealed = sealAcceptance(input, docs, IP, long, NOW);
    expect(sealed.user_agent).toHaveLength(USER_AGENT_MAX_LENGTH);
  });

  it("v2: lo sellado es EXACTAMENTE lo hasheado (UA truncado → hash del truncado)", () => {
    // El recompute del gate toma user_agent AS-IS de la fila: si el sello
    // persistiera el UA crudo pero hasheara el truncado (o viceversa), TODA
    // fila real fallaría la verificación. Acá se prueba que coinciden.
    const long = "y".repeat(USER_AGENT_MAX_LENGTH + 50);
    const sealed = sealAcceptance(input, docs, IP, long, NOW);
    expect(sealed.hash).toBe(
      acceptanceHash(input, docs, IP, sealed.user_agent, AT),
    );
  });

  it("v2: sella el user_agent del PARÁMETRO aunque input.user_agent traiga otra cosa", () => {
    const sealed = sealAcceptance(
      { ...input, user_agent: "forjado-por-el-cliente" },
      docs,
      IP,
      UA,
      NOW,
    );
    expect(sealed.user_agent).toBe(UA);
  });

  it("v2: merchant_declaration se canoniza a boolean estricto", () => {
    const sealed = sealAcceptance(
      { ...input, merchant_declaration: "true" as unknown as boolean },
      docs,
      IP,
      UA,
      NOW,
    );
    expect(sealed.merchant_declaration).toBe(false); // !== true → false
  });

  it("propaga la medida, los docs y los metadatos del input al record", () => {
    const sealed = sealAcceptance(input, docs, IP, UA, NOW);
    expect(sealed.cbm).toBe(7);
    expect(sealed.weight_kg).toBe(2800);
    expect(sealed.total_usd).toBe(5600);
    expect(sealed.client_markbox).toBe("DTD-5452");
    expect(sealed.quote_code).toBe("Q-2026-2310");
    expect(sealed.idempotency_key).toBe("idem-1");
    expect(sealed.invoice_id).toBe("inv-1");
  });
});

/**
 * Tests de tipos + validación + payload canónico de la Capa Legal
 * (SDD-0054 · Slice A). Cubre Acceptance §5:
 *  - acceptanceHashPayload determinístico: docs en otro orden → MISMO payload;
 *    medida/cliente distinto → payload distinto.
 *  - measureMatches: igual / difiere / tolerancia.
 *  - validateAcceptanceInput: happy + errores.
 */

import { describe, it, expect } from "vitest";
import {
  LEGAL_DOC_KEYS,
  acceptanceHashPayload,
  measureMatches,
  validateAcceptanceInput,
  type AcceptanceEvidence,
  type DocRef,
} from "../types";

const docsA: DocRef[] = [
  { key: "tyc", version: "v2.1" },
  { key: "operador", version: "v1.4" },
];

const baseEvidence: AcceptanceEvidence = {
  client_markbox: "DTD-5452",
  quote_code: "Q-2026-2310",
  docs: docsA,
  cbm: 7,
  weight_kg: 2800,
  total_usd: 5600,
  ip: "190.142.88.214",
  accepted_at: "2026-05-29T10:15:33.000Z",
};

// ── LEGAL_DOC_KEYS ────────────────────────────────────────────
describe("LEGAL_DOC_KEYS", () => {
  it("son las 2 docs de cara al cliente", () => {
    expect(LEGAL_DOC_KEYS).toEqual(["tyc", "operador"]);
  });
});

// ── acceptanceHashPayload (canónico + inyectivo) ──────────────
describe("acceptanceHashPayload", () => {
  it("es determinístico: docs en otro orden → MISMO payload", () => {
    const docsReversed: DocRef[] = [
      { key: "operador", version: "v1.4" },
      { key: "tyc", version: "v2.1" },
    ];
    const p1 = acceptanceHashPayload(baseEvidence);
    const p2 = acceptanceHashPayload({ ...baseEvidence, docs: docsReversed });
    expect(p1).toBe(p2);
  });

  it("dedup de docs: mismo set con duplicados → MISMO payload (no se infla)", () => {
    const withDup: DocRef[] = [
      { key: "tyc", version: "v2.1" },
      { key: "operador", version: "v1.4" },
      { key: "tyc", version: "v2.1" }, // duplicado
    ];
    const p1 = acceptanceHashPayload(baseEvidence);
    const p2 = acceptanceHashPayload({ ...baseEvidence, docs: withDup });
    expect(p1).toBe(p2);
  });

  it("medida distinta → payload distinto", () => {
    const p1 = acceptanceHashPayload(baseEvidence);
    const p2 = acceptanceHashPayload({ ...baseEvidence, cbm: 7.5 });
    expect(p1).not.toBe(p2);
  });

  it("cliente distinto → payload distinto", () => {
    const p1 = acceptanceHashPayload(baseEvidence);
    const p2 = acceptanceHashPayload({
      ...baseEvidence,
      client_markbox: "DTD-9999",
    });
    expect(p1).not.toBe(p2);
  });

  it("versión de doc distinta → payload distinto", () => {
    const p1 = acceptanceHashPayload(baseEvidence);
    const p2 = acceptanceHashPayload({
      ...baseEvidence,
      docs: [
        { key: "tyc", version: "v2.0" },
        { key: "operador", version: "v1.4" },
      ],
    });
    expect(p1).not.toBe(p2);
  });

  it("ip distinta → payload distinto (la ip entra en el payload)", () => {
    const p1 = acceptanceHashPayload(baseEvidence);
    const p2 = acceptanceHashPayload({ ...baseEvidence, ip: "10.0.0.1" });
    expect(p1).not.toBe(p2);
  });

  it("accepted_at distinto → payload distinto (server-time entra en el payload)", () => {
    const p1 = acceptanceHashPayload(baseEvidence);
    const p2 = acceptanceHashPayload({
      ...baseEvidence,
      accepted_at: "2026-05-29T10:15:34.000Z",
    });
    expect(p1).not.toBe(p2);
  });

  it("redondea la medida a 3 decimales (diferencias sub-mili no cambian payload)", () => {
    const p1 = acceptanceHashPayload({ ...baseEvidence, cbm: 7.0001 });
    const p2 = acceptanceHashPayload({ ...baseEvidence, cbm: 7.0002 });
    expect(p1).toBe(p2);
  });

  it("no muta el array de docs que recibe", () => {
    const docs: DocRef[] = [
      { key: "operador", version: "v1.4" },
      { key: "tyc", version: "v2.1" },
    ];
    const snapshot = JSON.stringify(docs);
    acceptanceHashPayload({ ...baseEvidence, docs });
    expect(JSON.stringify(docs)).toBe(snapshot);
  });
});

// ── measureMatches ────────────────────────────────────────────
describe("measureMatches", () => {
  const accepted = { cbm: 7, weight_kg: 2800, total_usd: 5600 };

  it("medida idéntica → true", () => {
    expect(measureMatches(accepted, { ...accepted })).toBe(true);
  });

  it("medida que difiere (sin tolerancia) → false", () => {
    expect(
      measureMatches(accepted, { cbm: 7.5, weight_kg: 2800, total_usd: 5600 }),
    ).toBe(false);
  });

  it("difiere una sola dimensión → false", () => {
    expect(
      measureMatches(accepted, { cbm: 7, weight_kg: 2900, total_usd: 5600 }),
    ).toBe(false);
  });

  it("dentro de la tolerancia relativa → true", () => {
    // 7 → 7.05 = 0.71% < 1%
    expect(
      measureMatches(
        accepted,
        { cbm: 7.05, weight_kg: 2800, total_usd: 5600 },
        0.01,
      ),
    ).toBe(true);
  });

  it("fuera de la tolerancia relativa → false", () => {
    // 7 → 7.5 = 7.1% > 1%
    expect(
      measureMatches(
        accepted,
        { cbm: 7.5, weight_kg: 2800, total_usd: 5600 },
        0.01,
      ),
    ).toBe(false);
  });

  it("cbm/weight ambos 0 (con total > 0) cuenta como match", () => {
    expect(
      measureMatches(
        { cbm: 0, weight_kg: 0, total_usd: 5600 },
        { cbm: 0, weight_kg: 0, total_usd: 5600 },
      ),
    ).toBe(true);
  });

  it("total_usd 0 en cualquier lado → false (no se admite '0 == 0' como atajo)", () => {
    // round-2: una aceptación legal con total 0 no existe → un 0 acá = corrupto.
    expect(
      measureMatches(
        { cbm: 7, weight_kg: 2800, total_usd: 0 },
        { cbm: 7, weight_kg: 2800, total_usd: 0 },
      ),
    ).toBe(false);
    expect(
      measureMatches(
        { cbm: 7, weight_kg: 2800, total_usd: 5600 },
        { cbm: 7, weight_kg: 2800, total_usd: 0 },
      ),
    ).toBe(false);
  });

  it("NaN en cualquier lado → false (fail-closed)", () => {
    expect(
      measureMatches(accepted, {
        cbm: NaN,
        weight_kg: 2800,
        total_usd: 5600,
      } as never),
    ).toBe(false);
  });
});

// ── validateAcceptanceInput ───────────────────────────────────
describe("validateAcceptanceInput", () => {
  it("happy path → input normalizado", () => {
    const { input, fieldErrors } = validateAcceptanceInput(
      {
        client_id: "client-1",
        client_markbox: " DTD-5452 ",
        quote_code: "Q-2026-2310",
        cbm: "7",
        weight_kg: "2800",
        total_usd: "5600",
        idempotency_key: "idem-1",
      },
      docsA,
    );
    expect(fieldErrors).toBeUndefined();
    expect(input).toEqual({
      client_id: "client-1",
      client_markbox: "DTD-5452",
      quote_code: "Q-2026-2310",
      cbm: 7,
      weight_kg: 2800,
      total_usd: 5600,
      idempotency_key: "idem-1",
    });
  });

  it("client_id ausente → null (es opcional)", () => {
    const { input } = validateAcceptanceInput(
      {
        client_markbox: "DTD-1",
        quote_code: "Q-1",
        cbm: 1,
        weight_kg: 1,
        total_usd: 1,
      },
      docsA,
    );
    expect(input?.client_id).toBeNull();
    expect(input?.idempotency_key).toBeNull();
  });

  it("markbox/quote vacíos → fieldErrors", () => {
    const { input, fieldErrors } = validateAcceptanceInput(
      { client_markbox: "  ", quote_code: "", cbm: 1, weight_kg: 1, total_usd: 1 },
      docsA,
    );
    expect(input).toBeUndefined();
    expect(fieldErrors?.client_markbox).toBeTruthy();
    expect(fieldErrors?.quote_code).toBeTruthy();
  });

  it("docs vacío → fieldError docs", () => {
    const { fieldErrors } = validateAcceptanceInput(
      {
        client_markbox: "DTD-1",
        quote_code: "Q-1",
        cbm: 1,
        weight_kg: 1,
        total_usd: 1,
      },
      [],
    );
    expect(fieldErrors?.docs).toBeTruthy();
  });

  it("medida negativa o no numérica → fieldErrors", () => {
    const { fieldErrors } = validateAcceptanceInput(
      {
        client_markbox: "DTD-1",
        quote_code: "Q-1",
        cbm: -1,
        weight_kg: "abc",
        total_usd: 5600,
      },
      docsA,
    );
    expect(fieldErrors?.cbm).toBeTruthy();
    expect(fieldErrors?.weight_kg).toBeTruthy();
    expect(fieldErrors?.total_usd).toBeUndefined();
  });

  it("total_usd = 0 → fieldError (round-2: no existe aceptación con total 0)", () => {
    const { input, fieldErrors } = validateAcceptanceInput(
      {
        client_markbox: "DTD-1",
        quote_code: "Q-1",
        cbm: 7,
        weight_kg: 2800,
        total_usd: 0,
      },
      docsA,
    );
    expect(input).toBeUndefined();
    expect(fieldErrors?.total_usd).toBeTruthy();
  });

  it("total_usd negativo → fieldError", () => {
    const { fieldErrors } = validateAcceptanceInput(
      {
        client_markbox: "DTD-1",
        quote_code: "Q-1",
        cbm: 7,
        weight_kg: 2800,
        total_usd: -5,
      },
      docsA,
    );
    expect(fieldErrors?.total_usd).toBeTruthy();
  });

  it("cbm/weight 0 con total > 0 → válido (cbm/weight pueden ser 0)", () => {
    const { input, fieldErrors } = validateAcceptanceInput(
      {
        client_markbox: "DTD-1",
        quote_code: "Q-1",
        cbm: 0,
        weight_kg: 0,
        total_usd: 100,
      },
      docsA,
    );
    expect(fieldErrors).toBeUndefined();
    expect(input?.cbm).toBe(0);
    expect(input?.total_usd).toBe(100);
  });
});

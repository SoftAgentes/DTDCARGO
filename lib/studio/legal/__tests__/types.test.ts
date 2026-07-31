/**
 * Tests de tipos + validación + payload canónico de la Capa Legal
 * (SDD-0054 · Slice A + SDD-0067 · evidencia v2). Cubre Acceptance §5:
 *  - acceptanceHashPayload determinístico: docs en otro orden → MISMO payload;
 *    medida/cliente distinto → payload distinto. v2: user_agent y
 *    merchant_declaration entran al payload.
 *  - measureMatches: igual / difiere / tolerancia.
 *  - validateAcceptanceInput: happy + errores. v2: merchant_declaration debe
 *    ser estrictamente `true` (sin declaración no hay aceptación válida).
 *  - sanitizeUserAgent: trim / 512 max / vacío → null.
 */

import { describe, it, expect } from "vitest";
import {
  LEGAL_DOC_KEYS,
  USER_AGENT_MAX_LENGTH,
  acceptanceHashPayload,
  measureMatches,
  sanitizeUserAgent,
  validateAcceptanceInput,
  type AcceptanceEvidence,
  type DocRef,
} from "../types";

const docsA: DocRef[] = [
  { key: "tyc", version: "v2.1", body_sha256: "sha-tyc-v2.1" },
  { key: "operador", version: "v1.4", body_sha256: "sha-operador-v1.4" },
];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0";

const baseEvidence: AcceptanceEvidence = {
  client_markbox: "DTD-5452",
  quote_code: "Q-2026-2310",
  docs: docsA,
  cbm: 7,
  weight_kg: 2800,
  total_usd: 5600,
  ip: "190.142.88.214",
  user_agent: UA,
  merchant_declaration: true,
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
      { key: "operador", version: "v1.4", body_sha256: "sha-operador-v1.4" },
      { key: "tyc", version: "v2.1", body_sha256: "sha-tyc-v2.1" },
    ];
    const p1 = acceptanceHashPayload(baseEvidence);
    const p2 = acceptanceHashPayload({ ...baseEvidence, docs: docsReversed });
    expect(p1).toBe(p2);
  });

  it("dedup de docs: mismo set con duplicados → MISMO payload (no se infla)", () => {
    const withDup: DocRef[] = [
      { key: "tyc", version: "v2.1", body_sha256: "sha-tyc-v2.1" },
      { key: "operador", version: "v1.4", body_sha256: "sha-operador-v1.4" },
      { key: "tyc", version: "v2.1", body_sha256: "sha-tyc-v2.1" }, // duplicado
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
        { key: "tyc", version: "v2.0", body_sha256: "sha-tyc-v2.0" },
        { key: "operador", version: "v1.4", body_sha256: "sha-operador-v1.4" },
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

  // ── v2 (SDD-0067) ───────────────────────────────────────────
  it("v2: user_agent distinto → payload distinto (entra al payload)", () => {
    const p1 = acceptanceHashPayload(baseEvidence);
    const p2 = acceptanceHashPayload({
      ...baseEvidence,
      user_agent: "OtroNavegador/1.0",
    });
    expect(p1).not.toBe(p2);
  });

  it("v2: user_agent null vs presente → payload distinto", () => {
    const p1 = acceptanceHashPayload(baseEvidence);
    const p2 = acceptanceHashPayload({ ...baseEvidence, user_agent: null });
    expect(p1).not.toBe(p2);
  });

  it("v2: user_agent se toma AS-IS (sin re-sanear): un append > 512 cambia el payload", () => {
    // Si el payload re-saneara (truncara), un tamper post-hoc más allá del char
    // 512 quedaría ENMASCARADO (recomputaría el mismo hash). AS-IS lo detecta.
    const sealed = "x".repeat(USER_AGENT_MAX_LENGTH); // lo que persistió el sello
    const tampered = sealed + "y"; // mutación post-hoc en la fila
    const p1 = acceptanceHashPayload({ ...baseEvidence, user_agent: sealed });
    const p2 = acceptanceHashPayload({ ...baseEvidence, user_agent: tampered });
    expect(p1).not.toBe(p2);
  });

  it("v2: merchant_declaration true vs false → payload distinto", () => {
    const p1 = acceptanceHashPayload(baseEvidence);
    const p2 = acceptanceHashPayload({
      ...baseEvidence,
      merchant_declaration: false,
    });
    expect(p1).not.toBe(p2);
  });

  it("v2: merchant_declaration se canoniza a boolean estricto (truthy ≠ true → false)", () => {
    const pTrue = acceptanceHashPayload(baseEvidence);
    const pFalse = acceptanceHashPayload({
      ...baseEvidence,
      merchant_declaration: false,
    });
    const pCoerced = acceptanceHashPayload({
      ...baseEvidence,
      merchant_declaration: "true" as unknown as boolean, // corrupción/coerción
    });
    expect(pCoerced).toBe(pFalse); // cualquier cosa !== true recomputa como false
    expect(pCoerced).not.toBe(pTrue);
  });

  it("redondea cbm a 3 decimales (diferencias sub-mili no cambian payload)", () => {
    const p1 = acceptanceHashPayload({ ...baseEvidence, cbm: 7.0001 });
    const p2 = acceptanceHashPayload({ ...baseEvidence, cbm: 7.0002 });
    expect(p1).toBe(p2);
  });

  // m-5: la precisión del hash casa con la del storage (0102): weight_kg y
  // total_usd son numeric(_,2) → el payload los redondea a 2 decimales, así una
  // 3ª cifra (que la DB truncaría) NO produce un hash distinto al recomputado.
  it("redondea weight_kg a 2 decimales (3ª cifra no cambia payload)", () => {
    const p1 = acceptanceHashPayload({ ...baseEvidence, weight_kg: 2800.001 });
    const p2 = acceptanceHashPayload({ ...baseEvidence, weight_kg: 2800.004 });
    expect(p1).toBe(p2);
  });

  it("redondea total_usd a 2 decimales (3ª cifra no cambia payload)", () => {
    const p1 = acceptanceHashPayload({ ...baseEvidence, total_usd: 5600.001 });
    const p2 = acceptanceHashPayload({ ...baseEvidence, total_usd: 5600.004 });
    expect(p1).toBe(p2);
  });

  it("cbm SÍ distingue la 3ª cifra (numeric(12,3), no se trunca a 2)", () => {
    const p1 = acceptanceHashPayload({ ...baseEvidence, cbm: 7.001 });
    const p2 = acceptanceHashPayload({ ...baseEvidence, cbm: 7.002 });
    expect(p1).not.toBe(p2);
  });

  it("no muta el array de docs que recibe", () => {
    const docs: DocRef[] = [
      { key: "operador", version: "v1.4", body_sha256: "sha-operador-v1.4" },
      { key: "tyc", version: "v2.1", body_sha256: "sha-tyc-v2.1" },
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
  it("happy path → input normalizado (v2: con declaración + user_agent + invoice)", () => {
    const { input, fieldErrors } = validateAcceptanceInput(
      {
        client_id: "client-1",
        client_markbox: " DTD-5452 ",
        quote_code: "Q-2026-2310",
        cbm: "7",
        weight_kg: "2800",
        total_usd: "5600",
        user_agent: `  ${UA}  `,
        merchant_declaration: true,
        invoice_id: "inv-1",
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
      user_agent: UA, // saneado (trim)
      merchant_declaration: true,
      invoice_id: "inv-1",
      idempotency_key: "idem-1",
    });
  });

  it("client_id ausente → null (es opcional); user_agent/invoice ausentes → null", () => {
    const { input } = validateAcceptanceInput(
      {
        client_markbox: "DTD-1",
        quote_code: "Q-1",
        cbm: 1,
        weight_kg: 1,
        total_usd: 1,
        merchant_declaration: true,
      },
      docsA,
    );
    expect(input?.client_id).toBeNull();
    expect(input?.idempotency_key).toBeNull();
    expect(input?.user_agent).toBeNull();
    expect(input?.invoice_id).toBeNull();
  });

  it("v2: merchant_declaration ausente → fieldError (sin declaración no hay aceptación)", () => {
    const { input, fieldErrors } = validateAcceptanceInput(
      {
        client_markbox: "DTD-1",
        quote_code: "Q-1",
        cbm: 1,
        weight_kg: 1,
        total_usd: 1,
      },
      docsA,
    );
    expect(input).toBeUndefined();
    expect(fieldErrors?.merchant_declaration).toBeTruthy();
  });

  it("v2: merchant_declaration false → fieldError", () => {
    const { input, fieldErrors } = validateAcceptanceInput(
      {
        client_markbox: "DTD-1",
        quote_code: "Q-1",
        cbm: 1,
        weight_kg: 1,
        total_usd: 1,
        merchant_declaration: false,
      },
      docsA,
    );
    expect(input).toBeUndefined();
    expect(fieldErrors?.merchant_declaration).toBeTruthy();
  });

  it("v2: merchant_declaration truthy-pero-no-true ('on'/'true'/1) → fieldError (estricto)", () => {
    for (const v of ["on", "true", 1]) {
      const { input, fieldErrors } = validateAcceptanceInput(
        {
          client_markbox: "DTD-1",
          quote_code: "Q-1",
          cbm: 1,
          weight_kg: 1,
          total_usd: 1,
          merchant_declaration: v,
        },
        docsA,
      );
      expect(input).toBeUndefined();
      expect(fieldErrors?.merchant_declaration).toBeTruthy();
    }
  });

  it("markbox/quote vacíos → fieldErrors", () => {
    const { input, fieldErrors } = validateAcceptanceInput(
      {
        client_markbox: "  ",
        quote_code: "",
        cbm: 1,
        weight_kg: 1,
        total_usd: 1,
        merchant_declaration: true,
      },
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
        merchant_declaration: true,
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
        merchant_declaration: true,
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
        merchant_declaration: true,
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
        merchant_declaration: true,
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
        merchant_declaration: true,
      },
      docsA,
    );
    expect(fieldErrors).toBeUndefined();
    expect(input?.cbm).toBe(0);
    expect(input?.total_usd).toBe(100);
  });
});

// ── sanitizeUserAgent (v2 · SDD-0067) ─────────────────────────
describe("sanitizeUserAgent", () => {
  it("trim + passthrough de un UA normal", () => {
    expect(sanitizeUserAgent(`  ${UA} `)).toBe(UA);
  });

  it("vacío / espacios / null / undefined → null", () => {
    expect(sanitizeUserAgent("")).toBeNull();
    expect(sanitizeUserAgent("   ")).toBeNull();
    expect(sanitizeUserAgent(null)).toBeNull();
    expect(sanitizeUserAgent(undefined)).toBeNull();
  });

  it("trunca a USER_AGENT_MAX_LENGTH (512)", () => {
    const long = "a".repeat(USER_AGENT_MAX_LENGTH + 1);
    const out = sanitizeUserAgent(long);
    expect(out).toHaveLength(USER_AGENT_MAX_LENGTH);
    expect(out).toBe(long.slice(0, USER_AGENT_MAX_LENGTH));
  });
});

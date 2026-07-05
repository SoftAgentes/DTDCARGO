import { describe, it, expect } from "vitest";
import { pickClientMatch, type ClientCandidate } from "./client-match";

const GONZALEZ: ClientCandidate[] = [
  { id: "cli-001", name: "Comercial González 2010, C.A.", markbox: "DTD-1001" },
  { id: "cli-002", name: "Inversiones González Hnos", markbox: "DTD-1002" },
];

describe("pickClientMatch (SDD-0150 Fase B · match externo→cliente)", () => {
  it("sin nombre o sin candidatos → null", () => {
    expect(pickClientMatch("", GONZALEZ)).toBeNull();
    expect(pickClientMatch(null, GONZALEZ)).toBeNull();
    expect(pickClientMatch("González", [])).toBeNull();
  });

  it("un solo candidato → confianza media", () => {
    const m = pickClientMatch("El Tornillo", [
      { id: "cli-014", name: "Ferretería El Tornillo" },
    ]);
    expect(m).toEqual({
      client_id: "cli-014",
      cliente_nombre: "Ferretería El Tornillo",
      confianza: "media",
    });
  });

  it("match exacto por nombre (sin acentos) → confianza alta", () => {
    const m = pickClientMatch("inversiones gonzalez hnos", GONZALEZ);
    expect(m).toEqual({
      client_id: "cli-002",
      cliente_nombre: "Inversiones González Hnos",
      confianza: "alta",
    });
  });

  it("el caso «González» ambiguo (2 parciales) → null, el humano elige", () => {
    expect(pickClientMatch("González", GONZALEZ)).toBeNull();
  });

  it("varios exactos → ambiguo → null", () => {
    const dup: ClientCandidate[] = [
      { id: "a", name: "González" },
      { id: "b", name: "GONZÁLEZ" },
    ];
    expect(pickClientMatch("gonzalez", dup)).toBeNull();
  });
});

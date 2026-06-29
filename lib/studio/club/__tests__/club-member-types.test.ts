import { describe, it, expect } from "vitest";
import {
  validateClubMemberInput,
  validateClubMemberEditInput,
  planLabel,
  planBadgeTone,
  memberStatusLabel,
  memberStatusTone,
  sourceLabel,
  CLUB_PLANS,
  CLUB_MEMBER_STATUSES,
} from "@/lib/studio/club/club-member-types";

describe("validateClubMemberInput (alta)", () => {
  const base = { ci: "V-18.452.110", name: "María Rodríguez", plan: "comunidad" as const };

  it("acepta un alta válida y normaliza la cédula visible", () => {
    const { input, fieldErrors } = validateClubMemberInput(base);
    expect(fieldErrors).toBeNull();
    expect(input).not.toBeNull();
    expect(input?.ci).toBe("V-18.452.110");
    expect(input?.plan).toBe("comunidad");
    expect(input?.status).toBe("activa"); // default
  });

  it("rechaza sin cédula", () => {
    const { input, fieldErrors } = validateClubMemberInput({ ...base, ci: "" });
    expect(input).toBeNull();
    expect(fieldErrors?.ci).toBeTruthy();
  });

  it("rechaza cédula con formato inválido", () => {
    const { fieldErrors } = validateClubMemberInput({ ...base, ci: "abc" });
    expect(fieldErrors?.ci).toBeTruthy();
  });

  it("rechaza sin nombre", () => {
    const { fieldErrors } = validateClubMemberInput({ ...base, name: "  " });
    expect(fieldErrors?.name).toBeTruthy();
  });

  it("rechaza plan fuera del enum", () => {
    const { fieldErrors } = validateClubMemberInput({
      ...base,
      // @ts-expect-error plan inválido a propósito
      plan: "vip",
    });
    expect(fieldErrors?.plan).toBeTruthy();
  });

  it("rechaza email mal formado pero acepta vacío", () => {
    expect(validateClubMemberInput({ ...base, email: "no-es-mail" }).fieldErrors?.email).toBeTruthy();
    expect(validateClubMemberInput({ ...base, email: "" }).fieldErrors).toBeNull();
  });

  it("acepta source del set y rechaza uno inválido", () => {
    expect(validateClubMemberInput({ ...base, source: "referido" }).input?.source).toBe("referido");
    // @ts-expect-error source inválido a propósito
    expect(validateClubMemberInput({ ...base, source: "tiktok" }).fieldErrors?.source).toBeTruthy();
  });
});

describe("validateClubMemberEditInput (edición)", () => {
  it("no exige cédula ni nombre; valida plan/estado", () => {
    const { input, fieldErrors } = validateClubMemberEditInput({
      plan: "mayorista",
      status: "pausada",
    });
    expect(fieldErrors).toBeNull();
    expect(input?.plan).toBe("mayorista");
    expect(input?.status).toBe("pausada");
  });

  it("rechaza estado fuera del enum", () => {
    const { fieldErrors } = validateClubMemberEditInput({
      // @ts-expect-error estado inválido a propósito
      status: "vencida",
    });
    expect(fieldErrors?.status).toBeTruthy();
  });
});

describe("labels y tonos", () => {
  it("cubre todos los planes y estados sin huecos", () => {
    for (const p of CLUB_PLANS) {
      expect(planLabel(p)).toBeTruthy();
      expect(planBadgeTone(p)).toBeTruthy();
    }
    for (const s of CLUB_MEMBER_STATUSES) {
      expect(memberStatusLabel(s)).toBeTruthy();
      expect(memberStatusTone(s)).toBeTruthy();
    }
  });

  it("sourceLabel mapea y degrada a guion / passthrough", () => {
    expect(sourceLabel("academia")).toBe("Academia");
    expect(sourceLabel(null)).toBe("—");
    expect(sourceLabel("otro-libre")).toBe("otro-libre");
  });
});

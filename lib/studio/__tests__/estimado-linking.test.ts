import { describe, it, expect } from "vitest";
import {
  normalizePhone,
  phonesMatch,
  normalizeEmail,
  emailsMatch,
  prospectMatches,
  resolveClientRecipientEmail,
} from "../estimado-linking";

describe("normalizePhone", () => {
  it("deja solo dígitos", () => {
    expect(normalizePhone("+58 412 166-8021")).toBe("584121668021");
    expect(normalizePhone("(0412) 1668021")).toBe("04121668021");
  });
  it("tolera null/undefined/vacío", () => {
    expect(normalizePhone(null)).toBe("");
    expect(normalizePhone(undefined)).toBe("");
    expect(normalizePhone("  ")).toBe("");
  });
});

describe("phonesMatch", () => {
  it("matchea el mismo número en formatos distintos (sufijo)", () => {
    expect(phonesMatch("+58 412 1668021", "0412-1668021")).toBe(true);
    expect(phonesMatch("+58 412 1668021", "4121668021")).toBe(true);
    expect(phonesMatch("04121668021", "+584121668021")).toBe(true);
  });
  it("NO matchea números distintos", () => {
    expect(phonesMatch("+58 412 1668021", "+58 414 9999999")).toBe(false);
  });
  it("NO matchea si alguno tiene <10 dígitos", () => {
    expect(phonesMatch("12345", "12345")).toBe(false);
    expect(phonesMatch("123456789", "123456789")).toBe(false); // 9 dígitos
    expect(phonesMatch("", "04121668021")).toBe(false);
    expect(phonesMatch(null, "04121668021")).toBe(false);
  });
  it("matchea por los últimos 10 dígitos (número nacional)", () => {
    expect(phonesMatch("4121668021", "584121668021")).toBe(true);
    // distinto número nacional (412 vs 999) → no matchea aunque compartan cola
    expect(phonesMatch("4121668021", "9991668021")).toBe(false);
  });
});

describe("emailsMatch", () => {
  it("exacto case-insensitive con trim", () => {
    expect(emailsMatch("Cliente@Mail.com", "  cliente@mail.com ")).toBe(true);
  });
  it("vacío nunca matchea", () => {
    expect(emailsMatch("", "")).toBe(false);
    expect(emailsMatch(null, "a@b.com")).toBe(false);
  });
  it("distintos no matchean", () => {
    expect(emailsMatch("a@b.com", "a@c.com")).toBe(false);
  });
  it("normalizeEmail baja y trimea", () => {
    expect(normalizeEmail("  AB@C.COM ")).toBe("ab@c.com");
  });
});

describe("prospectMatches (Slice 2 · requiere teléfono Y email)", () => {
  const est = {
    prospect_email: "Sam@dtd.com",
    prospect_whatsapp: "+58 412 1668021",
  };
  it("matchea cuando email y teléfono calzan", () => {
    expect(
      prospectMatches(est, { email: "sam@dtd.com", phone: "0412-1668021" }),
    ).toBe(true);
  });
  it("NO matchea si solo calza el email", () => {
    expect(
      prospectMatches(est, { email: "sam@dtd.com", phone: "0414-0000000" }),
    ).toBe(false);
  });
  it("NO matchea si solo calza el teléfono", () => {
    expect(
      prospectMatches(est, { email: "otro@dtd.com", phone: "0412-1668021" }),
    ).toBe(false);
  });
  it("NO matchea si el estimado no tiene email", () => {
    expect(
      prospectMatches(
        { prospect_email: null, prospect_whatsapp: "+58 412 1668021" },
        { email: "sam@dtd.com", phone: "0412-1668021" },
      ),
    ).toBe(false);
  });
});

describe("resolveClientRecipientEmail (Slice 5)", () => {
  it("prioriza el override directo", () => {
    expect(
      resolveClientRecipientEmail({
        clientEmail: "a@x.com",
        markboxEmail: "b@x.com",
        prospectEmail: "c@x.com",
      }),
    ).toBe("a@x.com");
  });
  it("usa el email del MARKBOX si no hay override", () => {
    expect(
      resolveClientRecipientEmail({
        clientEmail: null,
        markboxEmail: "b@x.com",
        prospectEmail: "c@x.com",
      }),
    ).toBe("b@x.com");
  });
  it("cae al prospecto cuando no hay cliente (estimado web sin markbox)", () => {
    expect(
      resolveClientRecipientEmail({
        clientEmail: null,
        markboxEmail: null,
        prospectEmail: "c@x.com",
      }),
    ).toBe("c@x.com");
  });
  it("null si no hay a quién escribirle", () => {
    expect(resolveClientRecipientEmail({})).toBeNull();
    expect(
      resolveClientRecipientEmail({ clientEmail: "  ", prospectEmail: "" }),
    ).toBeNull();
  });
});

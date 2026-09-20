// @vitest-environment node
// SDD-0244 · resolvedor del enrutado "cliente que vuelve".
//
// Además de los casos del resolvedor, este archivo tiene tests de CONTRATO: el
// núcleo del enrutador duplica helpers que ya existen en `lib/studio/` (el bundle
// de la edge function no puede importar desde ahí). Si una de las dos copias
// cambia y la otra no, estos tests fallan — que es exactamente el punto.

import { describe, expect, it } from "vitest";
import {
  buildMarkboxPayload,
  buildStagePayload,
  contactPhoneKeys,
  decideRoute,
  phoneDigits,
  phoneKey,
  readRecontactoTarget,
  type RouterClientRow,
} from "../kommo-router";
import { normalizePhone, phonesMatch } from "@/lib/studio/estimado-linking";
import {
  buildMarkboxPatchPayload,
  buildStagePatchPayload,
} from "@/lib/studio/kommo-writeback";

const client = (over: Partial<RouterClientRow> = {}): RouterClientRow => ({
  id: "c1",
  markbox: "DTD-9011",
  kommo_contact_id: null,
  phone: "+58 412-1668021",
  ...over,
});

const phoneField = (...values: string[]) => [
  { field_id: 1, field_code: "PHONE", values: values.map((value) => ({ value })) },
];

describe("phoneKey", () => {
  it("lleva las tres variantes del mismo número a la misma clave", () => {
    expect(phoneKey("+58 412-1668021")).toBe("4121668021");
    expect(phoneKey("0412-1668021")).toBe("4121668021");
    expect(phoneKey("4121668021")).toBe("4121668021");
  });

  it("devuelve null si el número está incompleto (no se cruza a ciegas)", () => {
    expect(phoneKey("41216")).toBeNull();
    expect(phoneKey("")).toBeNull();
    expect(phoneKey(null)).toBeNull();
    expect(phoneKey(undefined)).toBeNull();
  });
});

describe("contactPhoneKeys", () => {
  it("extrae los teléfonos del custom field PHONE", () => {
    expect(contactPhoneKeys({ id: 1, custom_fields_values: phoneField("+58 412-1668021") }))
      .toEqual(["4121668021"]);
  });

  it("ignora otros campos y valores basura", () => {
    expect(
      contactPhoneKeys({
        id: 1,
        custom_fields_values: [
          { field_code: "EMAIL", values: [{ value: "a@b.com" }] },
          { field_code: "PHONE", values: [{ value: "123" }] },
          null,
          "basura",
        ],
      }),
    ).toEqual([]);
  });

  it("dedupe cuando el contacto trae el mismo número en dos formatos", () => {
    expect(
      contactPhoneKeys({ id: 1, custom_fields_values: phoneField("+584121668021", "0412-1668021") }),
    ).toEqual(["4121668021"]);
  });

  it("tolera contacto nulo o sin campos", () => {
    expect(contactPhoneKeys(null)).toEqual([]);
    expect(contactPhoneKeys({ id: 1 })).toEqual([]);
  });
});

describe("decideRoute", () => {
  it("sin contacto → desconocido", () => {
    expect(decideRoute(null, [], null, [])).toEqual({
      kind: "desconocido",
      reason: "sin-contacto",
    });
    expect(decideRoute(0, [], null, [])).toEqual({ kind: "desconocido", reason: "sin-contacto" });
  });

  it("vínculo directo por kommo_contact_id → cliente, sin auto-sanado", () => {
    const c = client({ kommo_contact_id: 777 });
    const d = decideRoute(777, [], c, []);
    expect(d).toEqual({ kind: "cliente", client: c, matchedBy: "contact_id", needsHeal: false });
  });

  it("cruce por teléfono → cliente + auto-sanado", () => {
    const c = client();
    const d = decideRoute(777, ["4121668021"], null, [c]);
    expect(d).toEqual({ kind: "cliente", client: c, matchedBy: "phone", needsHeal: true });
  });

  it("el vínculo por id gana sobre el teléfono (no re-sana lo ya vinculado)", () => {
    const linked = client({ id: "linked", kommo_contact_id: 777 });
    const other = client({ id: "other" });
    const d = decideRoute(777, ["4121668021"], linked, [other]);
    expect(d).toMatchObject({ kind: "cliente", client: linked, needsHeal: false });
  });

  it("sin match → desconocido (no se toca nada)", () => {
    expect(decideRoute(777, ["4129999999"], null, [client()])).toEqual({
      kind: "desconocido",
      reason: "sin-match",
    });
  });

  it("🔴 dos clientes con el mismo teléfono → ambiguo, NO enruta", () => {
    const a = client({ id: "a", markbox: "DTD-1000" });
    const b = client({ id: "b", markbox: "DTD-2000" });
    expect(decideRoute(777, ["4121668021"], null, [a, b])).toEqual({
      kind: "desconocido",
      reason: "ambiguo",
    });
  });

  it("clientes con teléfono incompleto nunca matchean", () => {
    expect(decideRoute(777, ["4121668021"], null, [client({ phone: "1668021" })])).toEqual({
      kind: "desconocido",
      reason: "sin-match",
    });
  });
});

describe("readRecontactoTarget — el interruptor del enrutador", () => {
  it("lee el destino cuando está configurado", () => {
    expect(
      readRecontactoTarget({ recontacto: { pipeline_id: 14036567, status_id: 108343835 } }),
    ).toEqual({ pipeline_id: 14036567, status_id: 108343835 });
  });

  it("sin la clave → null (inerte, no encola nada)", () => {
    expect(readRecontactoTarget({ sent: { pipeline_id: 1, status_id: 2 } })).toBeNull();
    expect(readRecontactoTarget(null)).toBeNull();
    expect(readRecontactoTarget("x")).toBeNull();
  });

  it("ids inválidos → null (no se encola un destino roto)", () => {
    expect(readRecontactoTarget({ recontacto: { pipeline_id: 0, status_id: 5 } })).toBeNull();
    expect(readRecontactoTarget({ recontacto: { pipeline_id: 1, status_id: "x" } })).toBeNull();
  });
});

// ── Contratos anti-drift con lib/studio (las copias deben coincidir) ─────────

describe("contrato: el núcleo del enrutador no driftea de lib/studio", () => {
  const samples = ["+58 412-1668021", "0412-1668021", "4121668021", "58 412 166 80 21", "", "123"];

  it("phoneDigits ≡ normalizePhone", () => {
    for (const s of samples) expect(phoneDigits(s)).toBe(normalizePhone(s));
  });

  it("igualdad de phoneKey ≡ phonesMatch", () => {
    for (const a of samples) {
      for (const b of samples) {
        const ka = phoneKey(a);
        const kb = phoneKey(b);
        expect(ka !== null && kb !== null && ka === kb).toBe(phonesMatch(a, b));
      }
    }
  });

  it("buildStagePayload ≡ buildStagePatchPayload", () => {
    const t = { pipeline_id: 14036567, status_id: 108343835 };
    expect(buildStagePayload(t)).toEqual(buildStagePatchPayload(t));
  });

  it("buildMarkboxPayload ≡ buildMarkboxPatchPayload", () => {
    expect(buildMarkboxPayload(1570535, "DTD-9011")).toEqual(
      buildMarkboxPatchPayload(1570535, "DTD-9011"),
    );
  });
});

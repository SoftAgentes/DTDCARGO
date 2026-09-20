// @vitest-environment node
/**
 * SDD-0074 · tests de los builders puros del push del alta a Kommo.
 *
 * La Edge Function `kommo-push-client` (Deno.serve + HTTP) NO la ve el gate (typecheck excluye
 * supabase/functions; vitest no type-checkea). Por eso TODA la lógica decidible (resolución de
 * campos + enums, dedup de contacto, armado de payloads, idempotencia, dry-run) vive en
 * `kommo-outbound.ts` y se cubre acá.
 */

import { describe, it, expect } from "vitest";
import {
  resolveLeadFields,
  buildCfValue,
  leadName,
  buildContactPayload,
  buildLeadCustomFields,
  buildLeadPayload,
  buildLeadPatch,
  buildContactLink,
  normalizePhoneDigits,
  phoneMatches,
  valuesByCode,
  matchContact,
  pickDedupQueries,
  resolveDryRun,
  type OnboardingClient,
  type KommoFieldDef,
  type LeadFields,
} from "../kommo-outbound";

const client = (over: Partial<OnboardingClient> = {}): OnboardingClient => ({
  name: "Comercial Yiwu CA",
  email: "ventas@yiwu.com",
  phone: "+58 412 166 8021",
  rif: "J-12345678-9",
  markbox: "DTD-1042",
  doc_kind: "empresa",
  tier: "regular",
  ...over,
});

// markbox/rif = TEXT, tier = SELECT (con enums) → el caso realista de Kommo.
const FIELD_ROWS: KommoFieldDef[] = [
  { id: 10, entity_type: "leads", name: "Shipping Mark", code: null, type: "text", enums: null },
  { id: 11, entity_type: "leads", name: "RIF / Cédula", code: null, type: "text", enums: null },
  {
    id: 12,
    entity_type: "leads",
    name: "Nivel de cliente",
    code: null,
    type: "select",
    enums: [
      { id: 501, value: "Regular" },
      { id: 502, value: "VIP" },
      { id: 503, value: "Premium" },
    ],
  },
  { id: 99, entity_type: "leads", name: "Otro campo", code: null },
  { id: 50, entity_type: "contacts", name: "Shipping Mark", code: null }, // contacts → NO usar
];
const FIELDS: LeadFields = resolveLeadFields(FIELD_ROWS);

describe("resolveLeadFields", () => {
  it("resuelve markbox/rif/tier (id+type+enums), solo entity_type=leads", () => {
    expect(FIELDS.markbox).toEqual({ id: 10, type: "text", enums: null });
    expect(FIELDS.rif).toEqual({ id: 11, type: "text", enums: null });
    expect(FIELDS.tier?.id).toBe(12);
    expect(FIELDS.tier?.type).toBe("select");
    expect(FIELDS.tier?.enums).toHaveLength(3);
  });
  it("omite campos sin match; ignora los de contacts", () => {
    expect(resolveLeadFields([{ id: 7, entity_type: "leads", name: "Otro", code: null }])).toEqual({});
    // el id 50 (Shipping Mark, contacts) NO debe resolver markbox:
    expect(resolveLeadFields([{ id: 50, entity_type: "contacts", name: "Shipping Mark", code: null }])).toEqual({});
  });
  it("matchea por code (MARKBOX)", () => {
    expect(resolveLeadFields([{ id: 5, entity_type: "leads", name: null, code: "MARKBOX" }]).markbox?.id).toBe(5);
  });
  it("lista vacía/undefined → {}", () => {
    expect(resolveLeadFields([])).toEqual({});
    // @ts-expect-error robustez ante undefined en runtime
    expect(resolveLeadFields(undefined)).toEqual({});
  });
});

describe("buildCfValue", () => {
  it("TEXT → { field_id, values:[{ value }] }", () => {
    expect(buildCfValue({ id: 10, type: "text", enums: null }, "DTD-1")).toEqual({
      field_id: 10,
      values: [{ value: "DTD-1" }],
    });
  });
  it("SELECT con opción equivalente → { field_id, values:[{ enum_id }] } (case-insensitive)", () => {
    expect(buildCfValue(FIELDS.tier, "regular")).toEqual({ field_id: 12, values: [{ enum_id: 501 }] });
    expect(buildCfValue(FIELDS.tier, "VIP")).toEqual({ field_id: 12, values: [{ enum_id: 502 }] });
  });
  it("SELECT sin opción equivalente → null (se OMITE, no fuerza un 400)", () => {
    expect(buildCfValue(FIELDS.tier, "diamond")).toBeNull();
  });
  it("meta ausente o valor vacío → null", () => {
    expect(buildCfValue(undefined, "x")).toBeNull();
    expect(buildCfValue({ id: 10, type: "text", enums: null }, null)).toBeNull();
    expect(buildCfValue({ id: 10, type: "text", enums: null }, "")).toBeNull();
  });
});

describe("leadName", () => {
  it("nombre + markbox", () => {
    expect(leadName(client())).toBe("Comercial Yiwu CA · DTD-1042");
  });
  it("sin nombre → solo markbox", () => {
    expect(leadName(client({ name: null }))).toBe("DTD-1042");
    expect(leadName(client({ name: "   " }))).toBe("DTD-1042");
  });
});

describe("buildContactPayload", () => {
  it("incluye PHONE y EMAIL como field_code", () => {
    const p = buildContactPayload(client());
    expect(p.name).toBe("Comercial Yiwu CA");
    expect(p.custom_fields_values).toEqual([
      { field_code: "PHONE", values: [{ value: "+58 412 166 8021", enum_code: "WORK" }] },
      { field_code: "EMAIL", values: [{ value: "ventas@yiwu.com", enum_code: "WORK" }] },
    ]);
  });
  it("sin email → solo PHONE; sin contacto → name cae al markbox", () => {
    const p = buildContactPayload(client({ email: null, name: null }));
    expect(p.name).toBe("DTD-1042");
    expect(p.custom_fields_values).toEqual([
      { field_code: "PHONE", values: [{ value: "+58 412 166 8021", enum_code: "WORK" }] },
    ]);
  });
  it("sin teléfono ni email → sin custom_fields_values", () => {
    expect(buildContactPayload(client({ phone: null, email: null })).custom_fields_values).toBeUndefined();
  });
});

describe("buildLeadCustomFields / buildLeadPayload / buildLeadPatch", () => {
  it("text markbox+rif + select tier mapeado a enum_id", () => {
    expect(buildLeadCustomFields(client(), FIELDS)).toEqual([
      { field_id: 10, values: [{ value: "DTD-1042" }] },
      { field_id: 11, values: [{ value: "J-12345678-9" }] },
      { field_id: 12, values: [{ enum_id: 501 }] },
    ]);
  });
  it("tier sin opción equivalente → se omite (no rompe el lead)", () => {
    const cfs = buildLeadCustomFields(client({ tier: "diamond" }), FIELDS);
    expect(cfs).toEqual([
      { field_id: 10, values: [{ value: "DTD-1042" }] },
      { field_id: 11, values: [{ value: "J-12345678-9" }] },
    ]);
  });
  it("rif null en el cliente → no se manda aunque exista el field", () => {
    const cfs = buildLeadCustomFields(client({ rif: null, tier: null }), FIELDS);
    expect(cfs).toEqual([{ field_id: 10, values: [{ value: "DTD-1042" }] }]);
  });
  it("buildLeadPayload NO embebe contacto (el enlace va por /link aparte)", () => {
    const lead = buildLeadPayload(client(), FIELDS);
    expect(lead.name).toBe("Comercial Yiwu CA · DTD-1042");
    expect(lead._embedded).toBeUndefined();
    expect(lead.custom_fields_values).toHaveLength(3);
  });
  it("sin fields resueltos → lead solo con nombre", () => {
    const lead = buildLeadPayload(client(), {});
    expect(lead.custom_fields_values).toBeUndefined();
    expect(lead.name).toBe("Comercial Yiwu CA · DTD-1042");
  });
  it("buildLeadPatch solo trae custom fields (sin name)", () => {
    const patch = buildLeadPatch(client(), FIELDS);
    expect(patch.name).toBeUndefined();
    expect(patch.custom_fields_values).toHaveLength(3);
  });
});

describe("buildContactLink", () => {
  it("array de links para POST /leads/{id}/link", () => {
    expect(buildContactLink(555)).toEqual([{ to_entity_id: 555, to_entity_type: "contacts" }]);
  });
});

describe("normalizePhoneDigits / phoneMatches", () => {
  it("normaliza a solo dígitos", () => {
    expect(normalizePhoneDigits("+58 412 166 8021")).toBe("584121668021");
    expect(normalizePhoneDigits(null)).toBe("");
  });
  it("matchea por últimos 10 dígitos (distinto código de país / 0 inicial)", () => {
    expect(phoneMatches("+58 412 166 8021", "584121668021")).toBe(true);
    expect(phoneMatches("04121668021", "+58 412 166 8021")).toBe(true);
    expect(phoneMatches("4121668021", "584121668021")).toBe(true);
  });
  it("no matchea números distintos ni vacíos", () => {
    expect(phoneMatches("+58 412 166 8021", "+58 414 999 0000")).toBe(false);
    expect(phoneMatches(null, "584121668021")).toBe(false);
    expect(phoneMatches("123", "456")).toBe(false);
  });
});

describe("valuesByCode", () => {
  const contact = {
    id: 1,
    custom_fields_values: [
      { field_code: "PHONE", values: [{ value: "+584121668021" }, { value: "02414147886" }] },
      { field_code: "EMAIL", values: [{ value: "a@b.com" }] },
      { field_code: null, values: [{ value: "ignorar" }] },
    ],
  };
  it("devuelve todos los valores del code pedido (case-insensitive)", () => {
    expect(valuesByCode(contact, "PHONE")).toEqual(["+584121668021", "02414147886"]);
    expect(valuesByCode(contact, "phone")).toEqual(["+584121668021", "02414147886"]);
    expect(valuesByCode(contact, "EMAIL")).toEqual(["a@b.com"]);
  });
  it("code inexistente → []", () => {
    expect(valuesByCode(contact, "WEB")).toEqual([]);
    expect(valuesByCode({ id: 2 }, "PHONE")).toEqual([]);
  });
});

describe("matchContact", () => {
  const contacts = [
    { id: 100, custom_fields_values: [{ field_code: "EMAIL", values: [{ value: "Otro@x.com" }] }] },
    { id: 200, custom_fields_values: [{ field_code: "PHONE", values: [{ value: "+58 412 166 8021" }] }] },
    { id: 300, custom_fields_values: [{ field_code: "EMAIL", values: [{ value: "ventas@yiwu.com" }] }] },
  ];
  it("matchea por teléfono (formato distinto)", () => {
    expect(matchContact(contacts, "04121668021", null)).toBe(200);
  });
  it("matchea por email (case-insensitive)", () => {
    expect(matchContact(contacts, null, "VENTAS@YIWU.COM")).toBe(300);
  });
  it("sin coincidencia real → null", () => {
    expect(matchContact(contacts, "+58 000 000 0000", "nadie@x.com")).toBeNull();
  });
  it("lista vacía → null", () => {
    expect(matchContact([], "584121668021", "a@b.com")).toBeNull();
  });
});

describe("pickDedupQueries", () => {
  it("teléfono primero (dígitos), luego email", () => {
    expect(pickDedupQueries(client())).toEqual([
      { by: "phone", q: "584121668021" },
      { by: "email", q: "ventas@yiwu.com" },
    ]);
  });
  it("sin teléfono → solo email", () => {
    expect(pickDedupQueries(client({ phone: null }))).toEqual([{ by: "email", q: "ventas@yiwu.com" }]);
  });
  it("sin teléfono ni email → []", () => {
    expect(pickDedupQueries(client({ phone: null, email: null }))).toEqual([]);
  });
});

describe("resolveDryRun (default seguro = ON)", () => {
  it("env sin setear → dry-run", () => {
    expect(resolveDryRun(undefined)).toBe(true);
    expect(resolveDryRun(null)).toBe(true);
    expect(resolveDryRun("")).toBe(true);
  });
  it("env distinto de 'false' → dry-run", () => {
    expect(resolveDryRun("true")).toBe(true);
    expect(resolveDryRun("1")).toBe(true);
  });
  it("env === 'false' → escritura real", () => {
    expect(resolveDryRun("false")).toBe(false);
    expect(resolveDryRun("false", false)).toBe(false);
  });
  it("el body puede FORZAR dry-run pero no forzar real", () => {
    expect(resolveDryRun("false", true)).toBe(true);
    expect(resolveDryRun("true", false)).toBe(true);
  });
});

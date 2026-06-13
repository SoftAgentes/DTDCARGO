/**
 * SDD-0074 · tests de los builders puros del push del alta a Kommo.
 *
 * La Edge Function `kommo-push-client` (Deno.serve + HTTP) NO la ve el gate (typecheck excluye
 * supabase/functions; vitest no type-checkea). Por eso TODA la lógica decidible (resolución de
 * field_id, dedup de contacto por teléfono/email, armado de payloads, idempotencia) vive en
 * `kommo-outbound.ts` y se cubre acá.
 */

import { describe, it, expect } from "vitest";
import {
  resolveFieldIds,
  leadName,
  buildContactPayload,
  buildLeadCustomFields,
  buildLeadPayload,
  buildLeadPatch,
  normalizePhoneDigits,
  phoneMatches,
  valuesByCode,
  matchContact,
  pickDedupQueries,
  resolveDryRun,
  type OnboardingClient,
  type KommoFieldDef,
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

describe("resolveFieldIds", () => {
  const rows: KommoFieldDef[] = [
    { id: 10, entity_type: "leads", name: "Shipping Mark", code: null },
    { id: 11, entity_type: "leads", name: "RIF / Cédula", code: null },
    { id: 12, entity_type: "leads", name: "Nivel de cliente", code: null },
    { id: 99, entity_type: "leads", name: "Otro campo", code: null },
    { id: 50, entity_type: "contacts", name: "Shipping Mark", code: null }, // NO debe usarse (contacts)
  ];

  it("resuelve markbox/rif/tier por keyword, solo de entity_type=leads", () => {
    expect(resolveFieldIds(rows)).toEqual({ markbox: 10, rif: 11, tier: 12 });
  });

  it("omite los campos que no matchean ninguna keyword", () => {
    const only = resolveFieldIds([{ id: 7, entity_type: "leads", name: "Otro", code: null }]);
    expect(only).toEqual({});
  });

  it("matchea también por code (唛头 / markbox)", () => {
    const out = resolveFieldIds([{ id: 5, entity_type: "leads", name: null, code: "MARKBOX" }]);
    expect(out).toEqual({ markbox: 5 });
  });

  it("lista vacía o undefined → {}", () => {
    expect(resolveFieldIds([])).toEqual({});
    // @ts-expect-error probamos robustez ante undefined en runtime
    expect(resolveFieldIds(undefined)).toEqual({});
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
    const p = buildContactPayload(client({ phone: null, email: null }));
    expect(p.custom_fields_values).toBeUndefined();
  });
});

describe("buildLeadCustomFields / buildLeadPayload / buildLeadPatch", () => {
  const ids = { markbox: 10, rif: 11, tier: 12 };

  it("arma solo los campos resueltos", () => {
    expect(buildLeadCustomFields(client(), ids)).toEqual([
      { field_id: 10, values: [{ value: "DTD-1042" }] },
      { field_id: 11, values: [{ value: "J-12345678-9" }] },
      { field_id: 12, values: [{ value: "regular" }] },
    ]);
  });

  it("si solo resolvió markbox, solo manda markbox", () => {
    expect(buildLeadCustomFields(client(), { markbox: 10 })).toEqual([
      { field_id: 10, values: [{ value: "DTD-1042" }] },
    ]);
  });

  it("rif/tier ausentes en el cliente no se mandan aunque haya field_id", () => {
    expect(buildLeadCustomFields(client({ rif: null, tier: null }), ids)).toEqual([
      { field_id: 10, values: [{ value: "DTD-1042" }] },
    ]);
  });

  it("buildLeadPayload enlaza el contacto y pone el nombre con markbox", () => {
    const lead = buildLeadPayload(client(), 555, ids);
    expect(lead.name).toBe("Comercial Yiwu CA · DTD-1042");
    expect(lead._embedded).toEqual({ contacts: [{ id: 555 }] });
    expect(lead.custom_fields_values).toHaveLength(3);
  });

  it("sin field_ids → lead sin custom_fields_values (no rompe)", () => {
    const lead = buildLeadPayload(client(), 1, {});
    expect(lead.custom_fields_values).toBeUndefined();
    expect(lead._embedded).toEqual({ contacts: [{ id: 1 }] });
  });

  it("buildLeadPatch solo trae custom fields (sin name ni _embedded)", () => {
    const patch = buildLeadPatch(client(), ids);
    expect(patch.name).toBeUndefined();
    expect(patch._embedded).toBeUndefined();
    expect(patch.custom_fields_values).toHaveLength(3);
  });
});

describe("normalizePhoneDigits / phoneMatches", () => {
  it("normaliza a solo dígitos", () => {
    expect(normalizePhoneDigits("+58 412 166 8021")).toBe("584121668021");
    expect(normalizePhoneDigits(null)).toBe("");
  });

  it("matchea por últimos 10 dígitos (distinto código de país / 0 inicial)", () => {
    expect(phoneMatches("+58 412 166 8021", "584121668021")).toBe(true);
    expect(phoneMatches("04121668021", "+58 412 166 8021")).toBe(true); // 0 inicial vs +58
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
  it("devuelve todos los valores del code pedido", () => {
    expect(valuesByCode(contact, "PHONE")).toEqual(["+584121668021", "02414147886"]);
    expect(valuesByCode(contact, "phone")).toEqual(["+584121668021", "02414147886"]); // case-insensitive
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
  it("sin coincidencia real → null (no toma ruido del query difuso)", () => {
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
  it("env sin setear → dry-run (no escribe)", () => {
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
  it("el body puede FORZAR dry-run aunque el env sea real, pero no forzar real", () => {
    expect(resolveDryRun("false", true)).toBe(true); // body fuerza ensayo
    expect(resolveDryRun("true", false)).toBe(true); // body no puede prender real
  });
});

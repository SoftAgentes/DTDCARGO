/**
 * Tests del puente Kommo lead → cliente (SDD-0058).
 *
 * Cubre Acceptance §5:
 *  - convertLead idempotente: lead ya convertido → devuelve el markbox sin insertar.
 *  - convertLead nuevo: next_markbox + insert con kommo_lead_id + registration_channel='kommo'.
 *  - listConvertedLeadIds arma el map por kommo_lead_id (omite nulls).
 *
 * Stub mínimo del SupabaseClient: enruta por tabla, encola los maybeSingle de
 * `clients` (findExisting se llama 1-2 veces), captura el payload del insert.
 */

import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  convertLead,
  listConvertedLeadIds,
  parseContactFields,
  searchKommoContacts,
} from "../kommo-convert";

type StubCfg = {
  clientsMaybeSingle?: ({ markbox: string } | null)[]; // cola para findExisting
  lead?: { name: string | null } | null;
  markbox?: string | null;
  rpcError?: boolean;
  insertError?: { message: string } | null;
  clientsInRows?: { kommo_lead_id: number | null; markbox: string }[]; // listConvertedLeadIds
  contactRows?: { id: number; name: string | null; custom_fields: unknown }[]; // searchKommoContacts
};

function makeStub(cfg: StubCfg) {
  const inserted: Record<string, unknown>[] = [];
  let msIdx = 0;

  const makeChain = (table: string): Record<string, unknown> => {
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      is: () => chain,
      in: () => chain,
      order: () => chain,
      limit: () => chain,
      ilike: () => chain,
      insert: (payload: Record<string, unknown>) => {
        inserted.push(payload);
        return { error: cfg.insertError ?? null };
      },
      maybeSingle: () => {
        if (table === "clients") {
          const v = cfg.clientsMaybeSingle?.[msIdx++] ?? null;
          return Promise.resolve({ data: v, error: null });
        }
        if (table === "kommo_leads") {
          return Promise.resolve({ data: cfg.lead ?? null, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
      // thenable: listConvertedLeadIds / searchKommoContacts awaitean el builder.
      then: (resolve: (v: unknown) => unknown) => {
        const data =
          table === "clients"
            ? cfg.clientsInRows ?? []
            : table === "kommo_contacts"
              ? cfg.contactRows ?? []
              : [];
        return Promise.resolve({ data, error: null }).then(resolve);
      },
    };
    return chain;
  };

  const client = {
    from: (table: string) => makeChain(table),
    rpc: () =>
      Promise.resolve({
        data: cfg.rpcError ? null : cfg.markbox ?? null,
        error: cfg.rpcError ? { message: "rpc fail" } : null,
      }),
  };

  return { client: client as unknown as SupabaseClient, inserted };
}

const TENANT = "11111111-1111-1111-1111-111111111111";

describe("convertLead", () => {
  it("idempotente: lead ya convertido → devuelve markbox sin insertar", async () => {
    const { client, inserted } = makeStub({
      clientsMaybeSingle: [{ markbox: "DTD-0009" }],
    });
    const res = await convertLead(client, TENANT, 123);
    expect(res).toEqual({ ok: true, markbox: "DTD-0009", created: false });
    expect(inserted).toHaveLength(0); // no creó cliente
  });

  it("lead nuevo: next_markbox + insert con kommo_lead_id + canal 'kommo'", async () => {
    const { client, inserted } = makeStub({
      clientsMaybeSingle: [null], // findExisting → no existe
      lead: { name: "Importadora Acme" },
      markbox: "DTD-0010",
    });
    const res = await convertLead(client, TENANT, 456);
    expect(res).toEqual({ ok: true, markbox: "DTD-0010", created: true });
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      tenant_id: TENANT,
      markbox: "DTD-0010",
      name: "Importadora Acme",
      kommo_lead_id: 456,
      tier: "regular",
      registration_channel: "kommo",
    });
  });

  it("lead sin nombre → name fallback 'Lead Kommo <id>'", async () => {
    const { client, inserted } = makeStub({
      clientsMaybeSingle: [null],
      lead: { name: null },
      markbox: "DTD-0011",
    });
    const res = await convertLead(client, TENANT, 789);
    expect(res.created).toBe(true);
    expect(inserted[0].name).toBe("Lead Kommo 789");
  });

  it("lead inexistente en el espejo → error, sin insertar", async () => {
    const { client, inserted } = makeStub({
      clientsMaybeSingle: [null],
      lead: null,
    });
    const res = await convertLead(client, TENANT, 999);
    expect(res.error).toBeTruthy();
    expect(inserted).toHaveLength(0);
  });

  it("leadId inválido → error temprano", async () => {
    const { client } = makeStub({});
    expect((await convertLead(client, TENANT, 0)).error).toBeTruthy();
    expect((await convertLead(client, TENANT, -5)).error).toBeTruthy();
  });
});

describe("listConvertedLeadIds", () => {
  it("arma el map por kommo_lead_id, omite nulls", async () => {
    const { client } = makeStub({
      clientsInRows: [
        { kommo_lead_id: 1, markbox: "DTD-0001" },
        { kommo_lead_id: 2, markbox: "DTD-0002" },
        { kommo_lead_id: null, markbox: "DTD-0003" },
      ],
    });
    const map = await listConvertedLeadIds(client, [1, 2, 3]);
    expect(map).toEqual({ 1: "DTD-0001", 2: "DTD-0002" });
  });

  it("sin ids → {} sin tocar la DB", async () => {
    const { client } = makeStub({});
    expect(await listConvertedLeadIds(client, [])).toEqual({});
  });
});

describe("parseContactFields", () => {
  it("extrae email + teléfono (primer valor de cada code)", () => {
    const cf = [
      { field_code: "PHONE", values: [{ value: "+584244921906" }] },
      { field_code: "EMAIL", values: [{ value: "sabi@acme.com" }] },
    ];
    expect(parseContactFields(cf)).toEqual({
      email: "sabi@acme.com",
      phone: "+584244921906",
    });
  });

  it("solo PHONE → email null", () => {
    const cf = [{ field_code: "PHONE", values: [{ value: "+58000" }] }];
    expect(parseContactFields(cf)).toEqual({ email: null, phone: "+58000" });
  });

  it("toma el primer valor si hay varios", () => {
    const cf = [{ field_code: "PHONE", values: [{ value: "A" }, { value: "B" }] }];
    expect(parseContactFields(cf).phone).toBe("A");
  });

  it("forma inesperada / vacía → { null, null }", () => {
    expect(parseContactFields(null)).toEqual({ email: null, phone: null });
    expect(parseContactFields([])).toEqual({ email: null, phone: null });
    expect(parseContactFields([{ field_code: "PHONE", values: [] }])).toEqual({
      email: null,
      phone: null,
    });
    expect(parseContactFields("nope")).toEqual({ email: null, phone: null });
  });
});

describe("searchKommoContacts", () => {
  it("mapea contactos con email/teléfono parseados", async () => {
    const { client } = makeStub({
      contactRows: [
        {
          id: 25935343,
          name: "Sabi",
          custom_fields: [
            { field_code: "PHONE", values: [{ value: "+584244921906" }] },
            { field_code: "EMAIL", values: [{ value: "sabi@x.com" }] },
          ],
        },
        { id: 25869861, name: null, custom_fields: [] },
      ],
    });
    const rows = await searchKommoContacts(client, "sa");
    expect(rows).toEqual([
      { id: 25935343, name: "Sabi", email: "sabi@x.com", phone: "+584244921906" },
      { id: 25869861, name: "Contacto 25869861", email: null, phone: null },
    ]);
  });
});

describe("convertLead · prefill del contacto (Slice B)", () => {
  it("usa nombre/email/teléfono del contacto en el insert", async () => {
    const { client, inserted } = makeStub({
      clientsMaybeSingle: [null],
      lead: { name: "Lead #21426267" }, // nombre inútil del lead
      markbox: "DTD-0020",
    });
    const res = await convertLead(client, TENANT, 21426267, {
      name: "Sabi Pérez",
      email: "sabi@x.com",
      phone: "+584244921906",
    });
    expect(res).toEqual({ ok: true, markbox: "DTD-0020", created: true });
    expect(inserted[0]).toMatchObject({
      name: "Sabi Pérez", // el del contacto gana sobre el del lead
      email: "sabi@x.com",
      phone: "+584244921906",
      kommo_lead_id: 21426267,
      registration_channel: "kommo",
    });
  });

  it("sin prefill: name del lead, sin email/phone en el insert", async () => {
    const { client, inserted } = makeStub({
      clientsMaybeSingle: [null],
      lead: { name: "Acme" },
      markbox: "DTD-0021",
    });
    await convertLead(client, TENANT, 555);
    expect(inserted[0].name).toBe("Acme");
    expect(inserted[0]).not.toHaveProperty("email");
    expect(inserted[0]).not.toHaveProperty("phone");
  });
});

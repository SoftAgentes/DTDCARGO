// @vitest-environment node
/**
 * Tests de `linkReferralOnRegister` (SDD-0051 Fase 2): al registrarse con `?ref=`,
 * linkea al nuevo cliente con su referido (invitado→registrado) o crea la fila
 * desde un código compartido. Stub del admin client que enruta por tabla+filtros.
 */
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { linkReferralOnRegister } from "../referral-link";

type Ctx = {
  table?: string;
  op?: "select" | "update" | "insert";
  filters: Record<string, unknown>;
  payload?: Record<string, unknown>;
  rpc?: string;
};
type Resolve = (ctx: Ctx) => { data?: unknown; error?: unknown };

function makeAdmin(resolve: Resolve) {
  const inserts: Record<string, unknown>[] = [];
  const updates: { payload: Record<string, unknown>; filters: Record<string, unknown> }[] =
    [];
  function builder(
    table: string,
    op: "select" | "update" | "insert",
    payload?: Record<string, unknown>,
    filters: Record<string, unknown> = {},
  ) {
    const b: Record<string, unknown> = {};
    if (op === "update") updates.push({ payload: payload ?? {}, filters });
    Object.assign(b, {
      select: () => b,
      eq: (c: string, v: unknown) => {
        filters[c] = v;
        return b;
      },
      is: () => b,
      limit: () => b,
      maybeSingle: () => Promise.resolve(resolve({ table, op, filters, payload })),
      then: (r: (v: unknown) => void) =>
        r(resolve({ table, op, filters, payload })),
    });
    return b;
  }
  const admin = {
    from: (table: string) => ({
      select: () => builder(table, "select"),
      update: (payload: Record<string, unknown>) =>
        builder(table, "update", payload),
      insert: (payload: Record<string, unknown>) => {
        inserts.push(payload);
        return builder(table, "insert", payload);
      },
    }),
    rpc: (name: string) =>
      Promise.resolve(resolve({ rpc: name, filters: {} })),
  } as unknown as SupabaseClient;
  return { admin, inserts, updates };
}

const BASE = {
  tenantId: "t-1",
  newClientId: "new-1",
  newClientMarkbox: "DTD-9999",
  newClientName: "Carlos Pérez",
  newClientEmail: "carlos@b.com",
};

describe("linkReferralOnRegister", () => {
  it("sin ref → no-op", async () => {
    const { admin } = makeAdmin(() => ({ data: null }));
    const r = await linkReferralOnRegister(admin, { ...BASE, ref: "  " });
    expect(r.linked).toBe(false);
  });

  it("invitación por correo: código secuencial en 'invitado' → registrado + client_id", async () => {
    const { admin, updates } = makeAdmin((ctx) => {
      if (ctx.table === "referrals" && ctx.filters.referral_code) {
        return {
          data: { id: "r1", status: "invitado", referrer_markbox: "DTD-5000" },
        };
      }
      return { data: null };
    });
    const r = await linkReferralOnRegister(admin, {
      ...BASE,
      ref: "REF-2026-0007",
    });
    expect(r).toMatchObject({ linked: true, mode: "updated", referralId: "r1" });
    expect(updates[0].payload).toMatchObject({
      status: "registrado",
      referred_client_id: "new-1",
    });
    expect(updates[0].filters).toMatchObject({ id: "r1" });
  });

  it("invitación por correo: autoreferido (mismo markbox) → no linkea", async () => {
    const { admin, updates } = makeAdmin(() => ({
      data: { id: "r1", status: "invitado", referrer_markbox: "DTD-9999" },
    }));
    const r = await linkReferralOnRegister(admin, {
      ...BASE,
      ref: "REF-2026-0007",
    });
    expect(r).toMatchObject({ linked: false, reason: "autoreferido" });
    expect(updates).toHaveLength(0);
  });

  it("invitación por correo: código inexistente → no linkea", async () => {
    const { admin } = makeAdmin(() => ({ data: null }));
    const r = await linkReferralOnRegister(admin, {
      ...BASE,
      ref: "REF-2026-9999",
    });
    expect(r).toMatchObject({ linked: false, reason: "código no encontrado" });
  });

  it("invitación por correo: referido ya avanzó (no 'invitado') → no linkea", async () => {
    const { admin, updates } = makeAdmin(() => ({
      data: { id: "r1", status: "acreditado", referrer_markbox: "DTD-5000" },
    }));
    const r = await linkReferralOnRegister(admin, {
      ...BASE,
      ref: "REF-2026-0007",
    });
    expect(r).toMatchObject({ linked: false, reason: "referido ya avanzó" });
    expect(updates).toHaveLength(0);
  });

  it("código compartido: crea la fila 'registrado' cuando el referidor existe y no hay invitación previa", async () => {
    const { admin, inserts } = makeAdmin((ctx) => {
      if (ctx.rpc === "next_referral_code") return { data: "REF-2026-0100" };
      if (ctx.table === "clients" && ctx.filters.markbox === "DTD-5000") {
        return { data: { id: "referrer-1" } };
      }
      if (ctx.table === "referrals" && ctx.op === "insert") {
        return { data: { id: "created-1" } };
      }
      return { data: null }; // already/invited lookups → null
    });
    const r = await linkReferralOnRegister(admin, { ...BASE, ref: "REF-5000" });
    expect(r).toMatchObject({ linked: true, mode: "created", referralId: "created-1" });
    expect(inserts[0]).toMatchObject({
      tenant_id: "t-1",
      referrer_client_id: "referrer-1",
      referrer_markbox: "DTD-5000",
      referred_client_id: "new-1",
      referred_email: "carlos@b.com",
      status: "registrado",
      reward_usd: 0,
    });
  });

  it("código compartido: reclama una invitación previa por correo del mismo referidor (no duplica)", async () => {
    const { admin, inserts, updates } = makeAdmin((ctx) => {
      if (ctx.table === "clients" && ctx.filters.markbox === "DTD-5000") {
        return { data: { id: "referrer-1" } };
      }
      if (ctx.table === "referrals" && ctx.filters.referred_client_id) {
        return { data: null }; // no linkeado aún
      }
      if (ctx.table === "referrals" && ctx.filters.referred_email) {
        return { data: { id: "inv-1" } }; // invitación previa por correo
      }
      return { data: null };
    });
    const r = await linkReferralOnRegister(admin, { ...BASE, ref: "REF-5000" });
    expect(r).toMatchObject({ linked: true, mode: "updated", referralId: "inv-1" });
    expect(inserts).toHaveLength(0);
    expect(updates[0].payload).toMatchObject({
      status: "registrado",
      referred_client_id: "new-1",
    });
  });

  it("código compartido: autoreferido (markbox derivado = propio) → no linkea", async () => {
    const { admin, inserts } = makeAdmin(() => ({ data: null }));
    const r = await linkReferralOnRegister(admin, { ...BASE, ref: "REF-9999" });
    expect(r).toMatchObject({ linked: false, reason: "autoreferido" });
    expect(inserts).toHaveLength(0);
  });

  it("código compartido: referidor inexistente → no linkea", async () => {
    const { admin, inserts } = makeAdmin(() => ({ data: null }));
    const r = await linkReferralOnRegister(admin, { ...BASE, ref: "REF-5000" });
    expect(r).toMatchObject({ linked: false, reason: "referidor inexistente" });
    expect(inserts).toHaveLength(0);
  });

  it("código compartido: cliente ya linkeado → no duplica", async () => {
    const { admin, inserts } = makeAdmin((ctx) => {
      if (ctx.table === "clients" && ctx.filters.markbox === "DTD-5000") {
        return { data: { id: "referrer-1" } };
      }
      if (ctx.table === "referrals" && ctx.filters.referred_client_id) {
        return { data: { id: "existing-link" } };
      }
      return { data: null };
    });
    const r = await linkReferralOnRegister(admin, { ...BASE, ref: "REF-5000" });
    expect(r).toMatchObject({ linked: false, reason: "ya linkeado" });
    expect(inserts).toHaveLength(0);
  });
});

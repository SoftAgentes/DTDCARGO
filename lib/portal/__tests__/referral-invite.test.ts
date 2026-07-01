/**
 * Tests de "Invitar por correo" del Portal (SDD-0051, cara cliente).
 *
 * `inviteReferral` valida el correo, deduplica por referidor+correo, aplica el
 * tope diario, genera el código e inserta la fila `referrals` en 'invitado' con
 * reward_usd 0 (invitar NO acredita — el bono es al primer embarque). Stub del
 * admin client encadenable (patrón de referrals.test.ts).
 */
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  inviteReferral,
  buildReferralInviteEmail,
  MAX_INVITES_PER_DAY,
} from "../referral-invite";

type AdminCfg = {
  dedupeRow?: { id: string } | null;
  todayCount?: number;
  code?: string | null;
  codeErr?: boolean;
  insertErr?: boolean;
};

function makeAdmin(cfg: AdminCfg = {}) {
  const inserts: Record<string, unknown>[] = [];
  const rpcCalls: { name: string; args: unknown }[] = [];
  function builder(): Record<string, unknown> {
    const b: Record<string, unknown> = {};
    Object.assign(b, {
      select: () => b,
      eq: () => b,
      is: () => b,
      gte: () => b,
      limit: () => b,
      // dedupe termina en maybeSingle
      maybeSingle: () =>
        Promise.resolve({ data: cfg.dedupeRow ?? null, error: null }),
      // insert captura el payload
      insert: (payload: Record<string, unknown>) => {
        inserts.push(payload);
        return Promise.resolve({
          error: cfg.insertErr ? { message: "insert failed" } : null,
        });
      },
      // el cap query se AWAITea directo (thenable) → { count }
      then: (resolve: (v: unknown) => void) =>
        resolve({ data: null, count: cfg.todayCount ?? 0, error: null }),
    });
    return b;
  }
  const admin = {
    from: () => builder(),
    rpc: (name: string, args: unknown) => {
      rpcCalls.push({ name, args });
      return Promise.resolve({
        data: cfg.codeErr ? null : cfg.code ?? "REF-2026-0007",
        error: cfg.codeErr ? { message: "rpc failed" } : null,
      });
    },
  } as unknown as SupabaseClient;
  return { admin, inserts, rpcCalls };
}

const BASE = {
  tenantId: "t-1",
  referrerMarkbox: "dtd-9007",
  referrerClientId: "c-1",
};

describe("inviteReferral", () => {
  it("rechaza correo vacío", async () => {
    const { admin } = makeAdmin();
    const r = await inviteReferral(admin, { ...BASE, email: "  " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe("email");
  });

  it("rechaza correo inválido", async () => {
    const { admin } = makeAdmin();
    const r = await inviteReferral(admin, { ...BASE, email: "no-es-correo" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe("email");
  });

  it("rechaza nombre demasiado largo", async () => {
    const { admin } = makeAdmin();
    const r = await inviteReferral(admin, {
      ...BASE,
      email: "a@b.com",
      name: "x".repeat(201),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe("name");
  });

  it("deduplica el mismo correo del mismo referidor", async () => {
    const { admin, inserts } = makeAdmin({ dedupeRow: { id: "existing" } });
    const r = await inviteReferral(admin, { ...BASE, email: "dup@b.com" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/ya invitaste/i);
    expect(inserts).toHaveLength(0);
  });

  it("aplica el tope diario por referidor", async () => {
    const { admin, inserts } = makeAdmin({ todayCount: MAX_INVITES_PER_DAY });
    const r = await inviteReferral(admin, { ...BASE, email: "cap@b.com" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/máximo/i);
    expect(inserts).toHaveLength(0);
  });

  it("falla limpio si no se genera el código", async () => {
    const { admin, inserts } = makeAdmin({ codeErr: true });
    const r = await inviteReferral(admin, { ...BASE, email: "x@b.com" });
    expect(r.ok).toBe(false);
    expect(inserts).toHaveLength(0);
  });

  it("happy path sin nombre: inserta 'invitado' reward 0, correo en minúscula, markbox en mayúscula, display = correo", async () => {
    const { admin, inserts, rpcCalls } = makeAdmin({ code: "REF-2026-0007" });
    const r = await inviteReferral(admin, { ...BASE, email: "Nuevo@Cliente.COM" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.referralCode).toBe("REF-2026-0007");
      expect(r.referredEmail).toBe("nuevo@cliente.com");
      expect(r.referredName).toBe("nuevo@cliente.com");
    }
    expect(rpcCalls[0]).toEqual({
      name: "next_referral_code",
      args: { p_tenant: "t-1" },
    });
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      tenant_id: "t-1",
      referral_code: "REF-2026-0007",
      referrer_client_id: "c-1",
      referrer_markbox: "DTD-9007",
      referred_name: "nuevo@cliente.com",
      referred_email: "nuevo@cliente.com",
      status: "invitado",
      reward_usd: 0,
    });
  });

  it("happy path con nombre: usa el nombre como display", async () => {
    const { admin, inserts } = makeAdmin();
    const r = await inviteReferral(admin, {
      ...BASE,
      email: "carlos@b.com",
      name: "  Carlos Pérez  ",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.referredName).toBe("Carlos Pérez");
    expect(inserts[0]).toMatchObject({ referred_name: "Carlos Pérez" });
  });
});

describe("buildReferralInviteEmail", () => {
  it("arma subject + html con el código, el enlace y el descuento", () => {
    const { subject, html } = buildReferralInviteEmail({
      referrerName: "Ana",
      referredName: "carlos@b.com",
      code: "REF-2026-0007",
      registerUrl: "https://dtdcargo.com/registro?ref=REF-2026-0007",
    });
    expect(subject).toContain("Ana");
    expect(html).toContain("REF-2026-0007");
    expect(html).toContain("https://dtdcargo.com/registro?ref=REF-2026-0007");
    expect(html).toContain("$60"); // referredReward
  });
});

/**
 * Dedup del registro público por las TRES llaves (SDD-0244).
 *
 * El agujero que esto cierra: hasta ahora el dedup comparaba SÓLO el documento,
 * así que un cliente que YA existe se registraba como nuevo y salía con un
 * Shipping Mark nuevo. En el legado eso pasa siempre: 144 fichas no tienen
 * documento cargado, y cuando lo tienen suele venir corrompido por la
 * exportación de Excel ('2108108.0', '123456/822326660'). El correo y el
 * teléfono son las llaves que sí funcionan contra esas fichas.
 *
 * Lo que se afirma acá y no estaba cubierto por ningún test:
 *   1. el dedup dispara por correo y por teléfono, no sólo por documento,
 *   2. el aviso cae EN EL CAMPO que corresponde (SDD-0225: un error dibujado
 *      donde el visitante no lo ve es un error que no existe),
 *   3. ⭐ el dedup corre ANTES de pedir el correlativo — emitir un Shipping Mark
 *      para después descartarlo QUEMA el número: next_markbox hace max()+1 y no
 *      filtra deleted_at, así que ese número no vuelve nunca.
 *
 * El admin client, next/headers y el welcome email se mockean — sin red ni DB.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const ops = {
  rpcNames: [] as string[],
  createUserCalls: 0,
  insertedClients: false,
  reset() {
    this.rpcNames = [];
    this.createUserCalls = 0;
    this.insertedClients = false;
  },
};

const THROTTLE = "portal_registro_throttle";

/** Qué devuelve el dedup de la DB en cada test. null = no hay duplicado. */
let dedupResult: { client_id: string; matched_by: string } | null = null;

function makeAdmin() {
  function resolveFor(table: string, op: string) {
    if (table === THROTTLE && op === "select") return { count: 0, error: null };
    if (table === "tenants" && op === "select") return { data: { id: "tenant-1" }, error: null };
    if (table === "clients" && op === "insert") {
      ops.insertedClients = true;
      return { data: { id: "client-1" }, error: null };
    }
    return { data: null, error: null };
  }

  function builder(table: string) {
    const state = { table, op: "select" };
    let opSet = false;
    const setOp = (o: string) => {
      if (!opSet) {
        state.op = o;
        opSet = true;
      }
    };
    const resolve = () => Promise.resolve(resolveFor(state.table, state.op));
    const chain: Record<string, unknown> = {
      select: () => {
        setOp("select");
        return chain;
      },
      insert: (p: unknown) => {
        setOp("insert");
        void p;
        return chain;
      },
      update: () => chain,
      eq: () => chain,
      is: () => chain,
      ilike: () => chain,
      gte: () => chain,
      order: () => chain,
      limit: () => chain,
      single: () => resolve(),
      maybeSingle: () => resolve(),
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        resolve().then(res, rej),
    };
    return chain;
  }

  return {
    from: (table: string) => builder(table),
    // Despacho POR NOMBRE de RPC: el fake de los otros tests devuelve lo mismo
    // para todos, y eso hacía que el dedup no se pudiera probar.
    rpc: async (name: string) => {
      ops.rpcNames.push(name);
      if (name === "find_duplicate_client_service") {
        return { data: dedupResult ? [dedupResult] : [], error: null };
      }
      if (name === "next_markbox_service") {
        return { data: "DTD-9044", error: null };
      }
      return { data: null, error: null };
    },
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        remove: async () => ({ error: null }),
      }),
    },
    auth: {
      admin: {
        createUser: async () => {
          ops.createUserCalls += 1;
          return { data: { user: { id: "auth-1" } }, error: null };
        },
      },
    },
    functions: { invoke: async () => ({ error: null }) },
  };
}

vi.mock("next/headers", () => ({
  headers: async () => ({ get: (k: string) => (k === "x-forwarded-for" ? "1.2.3.4" : null) }),
}));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => makeAdmin() }));
vi.mock("@/lib/studio/welcome-email", () => ({ sendWelcomeEmail: async () => ({ ok: true }) }));
vi.mock("@/lib/studio/new-client-notify", () => ({ notifyNewClientToAdmin: async () => undefined }));

import { registerClientAction } from "../actions";

function validForm(overrides: Record<string, string> = {}): FormData {
  const f = new FormData();
  f.set("kind", "persona");
  f.set("name", "Elias Acosta");
  f.set("document", "V-20108108");
  f.set("email", "eliasmoes@hotmail.com");
  f.set("whatsapp", "+58 4140538566");
  for (const [k, v] of Object.entries(overrides)) f.set(k, v);
  return f;
}

beforeEach(() => {
  ops.reset();
  dedupResult = null;
});

describe("registerClientAction · dedup por documento, correo y teléfono", () => {
  it("reconoce por CORREO y avisa en el campo del correo", async () => {
    dedupResult = { client_id: "viejo-1", matched_by: "correo" };

    const res = await registerClientAction({}, validForm());

    expect(res.fieldErrors?.email).toMatch(/ya tiene una cuenta/i);
    expect(res.fieldErrors?.document).toBeUndefined();
    expect(res.fieldErrors?.whatsapp).toBeUndefined();
    // No se emitió Shipping Mark ni se creó cuenta.
    expect(res.markbox).toBeUndefined();
    expect(ops.insertedClients).toBe(false);
    expect(ops.createUserCalls).toBe(0);
  });

  it("reconoce por TELÉFONO y avisa en el campo del WhatsApp", async () => {
    dedupResult = { client_id: "viejo-1", matched_by: "telefono" };

    const res = await registerClientAction({}, validForm());

    expect(res.fieldErrors?.whatsapp).toMatch(/ya está registrado/i);
    expect(res.fieldErrors?.email).toBeUndefined();
    expect(res.markbox).toBeUndefined();
  });

  it("reconoce por DOCUMENTO y avisa en el campo del documento", async () => {
    dedupResult = { client_id: "viejo-1", matched_by: "documento" };

    const res = await registerClientAction({}, validForm());

    expect(res.fieldErrors?.document).toMatch(/cédula ya tiene una cuenta/i);
    expect(res.markbox).toBeUndefined();
  });

  it("empresa duplicada por documento dice RIF, no cédula", async () => {
    dedupResult = { client_id: "viejo-1", matched_by: "documento" };

    const res = await registerClientAction(
      {},
      validForm({ kind: "empresa", company: "Importadora X", document: "J-12345678-9" }),
    );

    expect(res.fieldErrors?.document).toMatch(/RIF ya tiene una cuenta/i);
  });

  it("⭐ con duplicado NO pide el correlativo — un Shipping Mark emitido se quema", async () => {
    dedupResult = { client_id: "viejo-1", matched_by: "correo" };

    await registerClientAction({}, validForm());

    expect(ops.rpcNames).toContain("find_duplicate_client_service");
    // Si esto se rompe, cada intento de un cliente viejo consume un número del
    // correlativo que nadie va a usar y que no se puede recuperar.
    expect(ops.rpcNames).not.toContain("next_markbox_service");
  });

  it("sin duplicado sigue de largo y emite el Shipping Mark", async () => {
    dedupResult = null;

    const res = await registerClientAction({}, validForm());

    expect(res.fieldErrors).toBeUndefined();
    expect(res.markbox).toBe("DTD-9044");
    expect(ops.insertedClients).toBe(true);
    expect(ops.rpcNames).toContain("next_markbox_service");
  });
});

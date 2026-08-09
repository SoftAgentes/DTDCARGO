/**
 * Tests del slice "Mi cuenta / perfil" del Portal del Cliente (SDD-0042 · Fase 2).
 *
 * Cubre los criterios de la spec §8 (slice perfil):
 *  - `getPortalClient` ahora trae `address` (dirección/ciudad de entrega) además
 *    de id/markbox/name/email/phone — y lo mapea con null-safety (el alta del
 *    cliente es mediada por el admin: campos opcionales pueden venir null).
 *  - Aislamiento: si la helper `get_portal_client_id()` no resuelve un cliente
 *    (p.ej. un user de equipo del Studio, que NO tiene row en client_users),
 *    `getPortalClient` corta y devuelve null SIN consultar `clients` (no expone
 *    una fila ajena del tenant).
 *  - `buildPortalSupplierMark`: la marca que el proveedor escribe en cada caja
 *    como Shipping Mark (唛头) ES el MARKBOX, normalizado (mayúsculas, sin espacios
 *    accidentales), sin prefijos ni PII.
 *
 * `getPortalClient` recibe un SupabaseClient — usamos un stub mínimo que encadena
 * `rpc(...)` + `from().select().eq().maybeSingle()`, igual que el resto de la suite.
 */
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPortalClient } from "../portal-queries";
import { buildPortalSupplierMark } from "../portal-types";

/**
 * Stub de SupabaseClient para `getPortalClient`.
 *  - `rpc("get_portal_client_id")` → `{ data: portalClientId, error }`.
 *  - `from("clients").select(...).eq(...).maybeSingle()` → `{ data: row, error }`.
 * Registra si se consultó `clients` para poder afirmar el corte temprano.
 */
function clientStub(opts: {
  portalClientId: string | null;
  rpcError?: boolean;
  row?: Record<string, unknown> | null;
  rowError?: boolean;
}): { supabase: SupabaseClient; queriedClients: () => boolean } {
  let queriedClients = false;
  const supabase = {
    rpc(fn: string) {
      if (fn === "get_portal_client_id") {
        return Promise.resolve({
          data: opts.portalClientId,
          error: opts.rpcError ? { message: "rpc fail" } : null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    },
    from() {
      queriedClients = true;
      const chain = {
        select() {
          return chain;
        },
        eq() {
          return chain;
        },
        maybeSingle() {
          return Promise.resolve({
            data: opts.row ?? null,
            error: opts.rowError ? { message: "row fail" } : null,
          });
        },
      };
      return chain;
    },
  } as unknown as SupabaseClient;
  return { supabase, queriedClients: () => queriedClients };
}

const FULL_ROW = {
  id: "c-1",
  markbox: "DTD-1001",
  name: "Empresa Demo S.A.",
  email: "compras@demosa.com.ve",
  phone: "+58 414 1234567",
  address: "Av. Bolívar, Galpón 4, Valencia, Carabobo",
  rif: "J-40551288-3",
  doc_kind: "empresa",
  // Ciudad + estado del registro (migr 0348). Alimentan el campo Ciudad de
  // "Datos de cuenta" mientras el cliente no tenga dirección predeterminada.
  city: "Valencia",
  state: "Carabobo",
};

describe("getPortalClient — incluye address (dirección de entrega)", () => {
  it("mapea la fila completa incluyendo address, identidad (SDD-0138)", async () => {
    const { supabase } = clientStub({ portalClientId: "c-1", row: FULL_ROW });
    const client = await getPortalClient(supabase);

    expect(client).toEqual({
      id: "c-1",
      markbox: "DTD-1001",
      name: "Empresa Demo S.A.",
      email: "compras@demosa.com.ve",
      phone: "+58 414 1234567",
      address: "Av. Bolívar, Galpón 4, Valencia, Carabobo",
      docKind: "empresa",
      rif: "J-40551288-3",
      city: "Valencia",
      state: "Carabobo",
    });
  });

  it("un alta anterior a la 0348 no tiene ciudad y eso no rompe nada", async () => {
    // 432 clientes quedaron así al aplicar la migración: null es "todavía no lo
    // sabemos", y el perfil pinta su texto de vacío.
    const sinUbicacion: Record<string, unknown> = { ...FULL_ROW };
    delete sinUbicacion.city;
    delete sinUbicacion.state;
    const { supabase } = clientStub({ portalClientId: "c-1", row: sinUbicacion });
    const client = await getPortalClient(supabase);

    expect(client?.city).toBeNull();
    expect(client?.state).toBeNull();
  });

  it("doc_kind fuera de los canónicos → null (SDD-0138: sólo persona|empresa)", async () => {
    const { supabase } = clientStub({
      portalClientId: "c-1",
      row: { ...FULL_ROW, doc_kind: "otro" },
    });
    const client = await getPortalClient(supabase);
    expect(client?.docKind).toBeNull();
  });

  it("address/identidad ausente → null (no rompe; el admin puede no haberla cargado)", async () => {
    const { supabase } = clientStub({
      portalClientId: "c-2",
      row: { id: "c-2", markbox: "DTD-1003", name: "Tenant Prueba SRL" }, // sin email/phone/address/rif/doc_kind
    });
    const client = await getPortalClient(supabase);

    expect(client?.markbox).toBe("DTD-1003");
    expect(client?.email).toBeNull();
    expect(client?.phone).toBeNull();
    expect(client?.address).toBeNull();
    expect(client?.docKind).toBeNull();
    expect(client?.rif).toBeNull();
  });

  it("aislamiento: sin client_id del portal → null SIN consultar clients", async () => {
    // Caso user de equipo del Studio: no tiene row en client_users → la helper
    // devuelve null → no debemos leer la tabla clients (evita fuga de una fila ajena).
    const { supabase, queriedClients } = clientStub({ portalClientId: null });
    const client = await getPortalClient(supabase);

    expect(client).toBeNull();
    expect(queriedClients()).toBe(false);
  });

  it("error de la RPC → null, también sin consultar clients", async () => {
    const { supabase, queriedClients } = clientStub({
      portalClientId: null,
      rpcError: true,
    });
    expect(await getPortalClient(supabase)).toBeNull();
    expect(queriedClients()).toBe(false);
  });

  it("error al leer la fila → null", async () => {
    const { supabase } = clientStub({ portalClientId: "c-1", rowError: true });
    expect(await getPortalClient(supabase)).toBeNull();
  });
});

describe("buildPortalSupplierMark — la marca que va en cada caja (唛头)", () => {
  it("la marca ES el MARKBOX (sin prefijos ni PII)", () => {
    expect(buildPortalSupplierMark("DTD-1001")).toBe("DTD-1001");
  });

  it("normaliza a mayúsculas (rótulo físico)", () => {
    expect(buildPortalSupplierMark("dtd-2048")).toBe("DTD-2048");
  });

  it("recorta espacios accidentales del código", () => {
    expect(buildPortalSupplierMark("  DTD-0007  ")).toBe("DTD-0007");
  });
});

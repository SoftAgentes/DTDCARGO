/**
 * Tests del slice "Mi cuenta / perfil" del Portal del Cliente (SDD-0042 · Fase 2).
 *
 * Cubre los criterios de la spec §8 (slice perfil):
 *  - `getPortalClient` ahora trae `address` (dirección/ciudad de entrega) además
 *    de id/markbox/name/email/phone — y lo mapea con null-safety (el alta del
 *    cliente es mediada por el admin: campos opcionales pueden venir null).
 *  - Aislamiento: resuelve `auth.uid()` + `client_users` y valida que el cliente
 *    embebido siga vivo y comparta client_id/tenant. Sin sesión autenticada
 *    se corta antes de consultar la relación.
 *  - `buildPortalSupplierMark`: la marca que el proveedor escribe en cada caja
 *    como Shipping Mark (唛头) ES el MARKBOX, normalizado (mayúsculas, sin espacios
 *    accidentales), sin prefijos ni PII.
 *
 * `getPortalClient` recibe un SupabaseClient — usamos un stub mínimo que encadena
 * `auth.getUser()` + `client_users.select().eq().maybeSingle()`.
 */
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPortalClient } from "../portal-queries";
import { buildPortalSupplierMark } from "../portal-types";

/**
 * Stub de SupabaseClient para `getPortalClient`. Registra si se consultó el
 * vínculo para poder afirmar el corte temprano sin sesión.
 */
function clientStub(opts: {
  portalClientId: string | null;
  authError?: boolean;
  row?: Record<string, unknown> | null;
  rowError?: boolean;
}): { supabase: SupabaseClient; queriedMembership: () => boolean } {
  let queriedMembership = false;
  const authUserId = opts.portalClientId ? "auth-synthetic" : null;
  const supabase = {
    auth: { getUser: async () => ({
      data: { user: authUserId ? { id: authUserId } : null },
      error: opts.authError ? { message: "auth fail" } : null,
    }) },
    from() {
      queriedMembership = true;
      let rows = opts.portalClientId && opts.row ? [{
        auth_user_id: authUserId,
        status: "active",
        client_id: opts.portalClientId,
        tenant_id: opts.row.tenant_id,
        clients: opts.row,
      }] : [];
      const chain = {
        select() {
          return chain;
        },
        eq(key: string, value: unknown) {
          rows = rows.filter(row => row[key as keyof typeof row] === value);
          return chain;
        },
        maybeSingle() {
          return Promise.resolve({
            data: rows.length === 1 ? rows[0] : null,
            error: opts.rowError ? { message: "row fail" } : null,
          });
        },
      };
      return chain;
    },
  } as unknown as SupabaseClient;
  return { supabase, queriedMembership: () => queriedMembership };
}

const FULL_ROW = {
  id: "c-1",
  tenant_id: "tenant-synthetic",
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
  deleted_at: null,
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
      row: {
        id: "c-2", tenant_id: "tenant-synthetic", markbox: "DTD-1003",
        name: "Tenant Prueba SRL", deleted_at: null,
      }, // sin email/phone/address/rif/doc_kind
    });
    const client = await getPortalClient(supabase);

    expect(client?.markbox).toBe("DTD-1003");
    expect(client?.email).toBeNull();
    expect(client?.phone).toBeNull();
    expect(client?.address).toBeNull();
    expect(client?.docKind).toBeNull();
    expect(client?.rif).toBeNull();
  });

  it("aislamiento: sin sesión Portal → null sin consultar el vínculo", async () => {
    // Sin sesión verificada no se consulta el vínculo ni su cliente embebido.
    const { supabase, queriedMembership } = clientStub({ portalClientId: null });
    const client = await getPortalClient(supabase);

    expect(client).toBeNull();
    expect(queriedMembership()).toBe(false);
  });

  it("error de autenticación → null, también sin consultar el vínculo", async () => {
    const { supabase, queriedMembership } = clientStub({
      portalClientId: "c-1",
      authError: true,
      row: FULL_ROW,
    });
    expect(await getPortalClient(supabase)).toBeNull();
    expect(queriedMembership()).toBe(false);
  });

  it("error al leer la fila → null", async () => {
    const { supabase } = clientStub({ portalClientId: "c-1", row: FULL_ROW, rowError: true });
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

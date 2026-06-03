/**
 * Tests del motor de verificación (SDD-0046 · Slice B).
 *
 * Cubre §6 Slice B (acceptance): verifyIdentity con provider MOCK →
 *   - ok (nombre coincide), mismatch (difiere), unavailable (provider null / throw),
 *   - ruteo persona → CNE, empresa → SENIAT-unavailable,
 *   - cédula no parseable → unavailable.
 *
 * El punto mockeable es la factory `getCneProvider()` (env-driven en runtime).
 * Acá la espiamos con `vi.spyOn` para inyectar un `IdentityProvider` fake — sin
 * red, sin importar las impls server-only.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import * as identity from "../index";
import type { IdentityProvider } from "../types";

const { verifyIdentity } = identity;

/** Provider fake que devuelve un nombre fijo. */
function providerReturning(registryName: string): IdentityProvider {
  return { lookup: vi.fn(async () => ({ registryName })) };
}
/** Provider fake que devuelve null (cédula no encontrada). */
function providerNull(): IdentityProvider {
  return { lookup: vi.fn(async () => null) };
}
/** Provider fake que tira (red caída / timeout). */
function providerThrowing(): IdentityProvider {
  return {
    lookup: vi.fn(async () => {
      throw new Error("network down");
    }),
  };
}

function stubProvider(p: IdentityProvider) {
  return vi
    .spyOn(identity.providerRegistry, "getCneProvider")
    .mockResolvedValue(p);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("verifyIdentity · ruteo", () => {
  it("persona (doc_kind) → consulta CNE", async () => {
    const provider = providerReturning("MARIA ACOSTA");
    stubProvider(provider);

    const r = await verifyIdentity({
      rif: "V-12.345.678",
      name: "María Acosta",
      docKind: "persona",
    });

    expect(provider.lookup).toHaveBeenCalledWith("12345678");
    expect(r.source).toBe("cne");
    expect(r.status).toBe("ok");
  });

  it("persona inferida del rif (doc_kind null) → CNE", async () => {
    const provider = providerReturning("JOSE PEREZ");
    stubProvider(provider);

    const r = await verifyIdentity({
      rif: "V-9.999.999",
      name: "Jose Perez",
      docKind: null,
    });

    expect(provider.lookup).toHaveBeenCalledOnce();
    expect(r.source).toBe("cne");
  });

  it("empresa → SENIAT, unavailable (auto es Slice C, hoy piso manual)", async () => {
    const spy = vi.spyOn(identity.providerRegistry, "getCneProvider");

    const r = await verifyIdentity({
      rif: "J-31000000-1",
      name: "ACME C.A.",
      docKind: "empresa",
    });

    expect(r).toEqual({ status: "unavailable", source: "seniat" });
    // No se llama al provider CNE para empresas.
    expect(spy).not.toHaveBeenCalled();
  });

  it("empresa inferida del rif (J) aunque doc_kind null → SENIAT unavailable", async () => {
    const r = await verifyIdentity({
      rif: "J-40000000-0",
      name: "Logística Express S.R.L.",
      docKind: null,
    });
    expect(r).toEqual({ status: "unavailable", source: "seniat" });
  });
});

describe("verifyIdentity · resultado", () => {
  it("nombre coincide → ok + registryName + score", async () => {
    stubProvider(providerReturning("MARIA ACOSTA"));

    const r = await verifyIdentity({
      rif: "V12345678",
      name: "Maria Acosta",
      docKind: "persona",
    });

    expect(r.status).toBe("ok");
    expect(r.source).toBe("cne");
    expect(r.registryName).toBe("MARIA ACOSTA");
    expect(r.score).toBeGreaterThan(0);
  });

  it("nombre difiere claramente → mismatch", async () => {
    stubProvider(providerReturning("PEDRO GOMEZ"));

    const r = await verifyIdentity({
      rif: "V12345678",
      name: "Maria Acosta",
      docKind: "persona",
    });

    expect(r.status).toBe("mismatch");
    expect(r.registryName).toBe("PEDRO GOMEZ");
  });

  it("provider devuelve null (cédula no encontrada) → unavailable", async () => {
    stubProvider(providerNull());

    const r = await verifyIdentity({
      rif: "V12345678",
      name: "Maria Acosta",
      docKind: "persona",
    });

    expect(r).toEqual({ status: "unavailable", source: "cne" });
  });

  it("provider tira (red/timeout) → unavailable (NO propaga la excepción)", async () => {
    stubProvider(providerThrowing());

    const r = await verifyIdentity({
      rif: "V12345678",
      name: "Maria Acosta",
      docKind: "persona",
    });

    expect(r).toEqual({ status: "unavailable", source: "cne" });
  });

  it("cédula no parseable (basura) → unavailable, no se pega al CNE", async () => {
    const spy = vi.spyOn(identity.providerRegistry, "getCneProvider");

    const r = await verifyIdentity({
      rif: "P-abcdef", // pasaporte / no cédula
      name: "Maria Acosta",
      docKind: "persona",
    });

    expect(r).toEqual({ status: "unavailable", source: "cne" });
    expect(spy).not.toHaveBeenCalled();
  });

  it("rif null → unavailable (no hay documento que consultar)", async () => {
    const r = await verifyIdentity({
      rif: null,
      name: "Maria Acosta",
      docKind: "persona",
    });
    expect(r).toEqual({ status: "unavailable", source: "cne" });
  });
});

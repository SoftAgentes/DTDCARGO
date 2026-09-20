// @vitest-environment node
/**
 * Tests de /api/public/cbm-rate (SDD-0474).
 *
 * Lo que protegen: este handler es la única vía por la que un HTML estático
 * (`public/guias/comprar-en-alibaba.html`) alcanza la tarifa del ERP. Si
 * devuelve 500 cuando Supabase está caído, la guía queda sin calculadora; si
 * devolviera más campos de los debidos, filtraría info comercial a una URL
 * pública sin autenticación.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const getPublicCbmRate = vi.fn();
vi.mock("@/lib/public/rates-queries", () => ({
  getPublicCbmRate: () => getPublicCbmRate(),
}));

async function call() {
  const { GET } = await import("../route");
  const res = await GET();
  return { res, body: await res.json() };
}

beforeEach(() => {
  getPublicCbmRate.mockReset();
  vi.resetModules();
});

describe("GET /api/public/cbm-rate", () => {
  it("devuelve la tarifa vigente", async () => {
    getPublicCbmRate.mockResolvedValue({
      per_cbm: 850,
      min_charge: 50,
      valid_until: "2026-10-04",
    });
    const { res, body } = await call();
    expect(res.status).toBe(200);
    expect(body).toEqual({ per_cbm: 850, min_charge: 50, valid_until: "2026-10-04" });
  });

  it("no filtra nada más que los tres campos", async () => {
    // Si la RPC o el tipo crecieran (tenant, internal_price_ref, notas…), esto
    // se pone rojo antes de que la URL pública los publique.
    getPublicCbmRate.mockResolvedValue({
      per_cbm: 850,
      min_charge: 50,
      valid_until: "2026-10-04",
      tenant_id: "no-debe-salir",
      internal_price_ref: "~550/CBM",
    });
    const { body } = await call();
    expect(Object.keys(body).sort()).toEqual(["min_charge", "per_cbm", "valid_until"]);
  });

  it("sin tarifa pública vigente responde 200 con per_cbm null", async () => {
    getPublicCbmRate.mockResolvedValue(null);
    const { res, body } = await call();
    expect(res.status).toBe(200);
    expect(body).toEqual({ per_cbm: null, min_charge: null, valid_until: null });
  });

  it("si la query TIRA no devuelve 500: la guía tiene que poder seguir", async () => {
    getPublicCbmRate.mockRejectedValue(new Error("supabase caído"));
    const { res, body } = await call();
    expect(res.status).toBe(200);
    expect(body.per_cbm).toBeNull();
  });

  it("se puede cachear en el edge (la guía la pide en cada carga)", async () => {
    getPublicCbmRate.mockResolvedValue({ per_cbm: 850, min_charge: 50, valid_until: null });
    const { res } = await call();
    expect(res.headers.get("cache-control")).toContain("s-maxage=300");
  });

  it("min_charge nulo viaja como null, no como 0 (0 sería un piso falso)", async () => {
    getPublicCbmRate.mockResolvedValue({ per_cbm: 800, min_charge: null, valid_until: null });
    const { body } = await call();
    expect(body.min_charge).toBeNull();
  });
});

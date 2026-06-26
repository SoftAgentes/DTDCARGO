/**
 * Tests de `searchClientsAction` (SDD-0108 · combobox cédula-first).
 *
 * Cubre §3 de la spec (verificación):
 *   - cédula-first: cuando `q` parece cédula, el match exacto (find_client_by_cedula)
 *     va PRIMERO en los resultados;
 *   - dedup por id (el match exacto no se repite si también aparece en el ilike);
 *   - tope ~8 resultados;
 *   - gate RBAC: rol sin acceso a Clientes → sin hits + error;
 *   - búsqueda por nombre NO gasta el RPC de cédula.
 *
 * Supabase, el gate de rol y la capa de queries están mockeados — sin red ni DB.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Client } from "./client-types";

// ── Mocks (antes de importar el SUT) ───────────────────────────────────────
const getStudioRoleMock = vi.fn<() => Promise<string | null>>();
const getClientByCedulaMock = vi.fn();
const listClientsMock = vi.fn();

vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({ __fake: true }),
}));
vi.mock("@/lib/studio/rbac-guard", () => ({
  getStudioRole: () => getStudioRoleMock(),
}));
vi.mock("@/lib/studio/client-queries", () => ({
  getClientByCedula: (...args: unknown[]) => getClientByCedulaMock(...args),
  listClients: (...args: unknown[]) => listClientsMock(...args),
}));

import { searchClientsAction } from "./client-search-action";

function client(over: Partial<Client> & { id: string }): Client {
  return {
    id: over.id,
    tenant_id: "t-1",
    markbox: over.markbox ?? "DTD-0001",
    name: over.name ?? "Cliente",
    email: null,
    phone: null,
    address: null,
    rif: over.rif ?? null,
    tier: "regular",
    notes: null,
    lat: null,
    lng: null,
    registration_channel: "admin",
    doc_kind: null,
    doc_verify_status: null,
    doc_verify_source: null,
    doc_registry_name: null,
    doc_verified_at: null,
    cedula_photo_path: null,
    advisor_id: null,
    person_id: over.person_id ?? null,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    deleted_at: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getStudioRoleMock.mockResolvedValue("admin");
  getClientByCedulaMock.mockResolvedValue(null);
  listClientsMock.mockResolvedValue([]);
});

describe("searchClientsAction", () => {
  it("term < 2 chars → sin hits, sin tocar la DB", async () => {
    const r = await searchClientsAction("v");
    expect(r.hits).toEqual([]);
    expect(getStudioRoleMock).not.toHaveBeenCalled();
  });

  it("rol sin acceso a Clientes → sin hits + error", async () => {
    getStudioRoleMock.mockResolvedValue(null);
    const r = await searchClientsAction("Juan");
    expect(r.hits).toEqual([]);
    expect(r.error).toBeTruthy();
    expect(listClientsMock).not.toHaveBeenCalled();
  });

  it("cédula-first: el match exacto va PRIMERO y no se duplica (dedup por id)", async () => {
    const exact = client({ id: "c-exact", markbox: "DTD-0009", name: "Ana", rif: "V-12345678" });
    getClientByCedulaMock.mockResolvedValue(exact);
    // el ilike devuelve otros + el mismo exact (debe deduparse)
    listClientsMock.mockResolvedValue([
      client({ id: "c-2", name: "Otro" }),
      exact,
    ]);

    const r = await searchClientsAction("V-12.345.678");
    expect(getClientByCedulaMock).toHaveBeenCalledTimes(1);
    expect(r.hits[0].id).toBe("c-exact"); // exacto primero
    const ids = r.hits.map((h) => h.id);
    expect(ids.filter((id) => id === "c-exact")).toHaveLength(1); // sin duplicado
    expect(ids).toContain("c-2");
  });

  it("búsqueda por nombre NO intenta el RPC de cédula", async () => {
    listClientsMock.mockResolvedValue([client({ id: "c-1", name: "Juan Pérez" })]);
    const r = await searchClientsAction("Juan");
    expect(getClientByCedulaMock).not.toHaveBeenCalled();
    expect(r.hits.map((h) => h.id)).toEqual(["c-1"]);
  });

  it("tope de 8 resultados", async () => {
    listClientsMock.mockResolvedValue(
      Array.from({ length: 20 }, (_, i) => client({ id: `c-${i}` })),
    );
    const r = await searchClientsAction("cliente");
    expect(r.hits).toHaveLength(8);
  });

  it("mapea sólo los campos que el combobox necesita", async () => {
    listClientsMock.mockResolvedValue([
      client({ id: "c-1", markbox: "DTD-0007", name: "Ana", rif: "V-99", person_id: "p-1" }),
    ]);
    const r = await searchClientsAction("Ana");
    expect(r.hits[0]).toEqual({
      id: "c-1",
      markbox: "DTD-0007",
      name: "Ana",
      rif: "V-99",
      person_id: "p-1",
    });
  });

  it("error en la query → sin hits + error suave", async () => {
    listClientsMock.mockRejectedValue(new Error("boom"));
    const r = await searchClientsAction("Juan");
    expect(r.hits).toEqual([]);
    expect(r.error).toBeTruthy();
  });
});

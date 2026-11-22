// @vitest-environment node
/**
 * SDD-0585 (enmienda 2026-11-16) · la lista de miembros de la Bandeja. El doble APLICA los filtros
 * (eq, is, order, range) y modela la RLS: el cliente de sesión solo ve la fila propia; el admin ve
 * todo el tenant que se le pida.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { miembrosDeBandeja } from "../bandeja-miembros";

type Fila = Record<string, unknown>;

const T1 = "10000000-0000-4000-8000-000000000001";
const T2 = "10000000-0000-4000-8000-000000000002";
const SAM = "20000000-0000-4000-8000-000000000001";
const ANA = "20000000-0000-4000-8000-000000000002";
const LUIS = "20000000-0000-4000-8000-000000000003";
const OTRO = "20000000-0000-4000-8000-000000000004";
const BAJA = "20000000-0000-4000-8000-000000000005";

const FILAS: Fila[] = [
  { user_id: SAM, tenant_id: T1, role: "admin", disabled_at: null, created_at: "2026-01-01", profile: { first_name: "Sam" } },
  { user_id: ANA, tenant_id: T1, role: "operations", disabled_at: null, created_at: "2026-01-02", profile: { first_name: "Ana" } },
  { user_id: LUIS, tenant_id: T1, role: "operations", disabled_at: null, created_at: "2026-01-03", profile: { first_name: "Luis" } },
  { user_id: BAJA, tenant_id: T1, role: "operations", disabled_at: "2026-02-01", created_at: "2026-01-04", profile: null },
  { user_id: OTRO, tenant_id: T2, role: "admin", disabled_at: null, created_at: "2026-01-05", profile: { first_name: "Otro" } },
];

/** `visiblePara` modela la RLS: con él, el cliente solo ve esa fila; sin él, ve todas (service_role). */
function cliente(visiblePara?: string): SupabaseClient {
  const from = (tabla: string) => {
    const filtros: ((f: Fila) => boolean)[] = [];
    if (tabla === "user_tenants" && visiblePara) filtros.push((f) => f.user_id === visiblePara);
    const builder = {
      select: () => builder,
      order: () => builder,
      eq: (c: string, v: unknown) => (filtros.push((f) => f[c] === v), builder),
      is: (c: string, v: unknown) => (filtros.push((f) => (f[c] ?? null) === v), builder),
      range: () => builder,
      then: (r: (v: { data: Fila[]; error: null }) => unknown) =>
        Promise.resolve(r({ data: FILAS.filter((f) => filtros.every((p) => p(f))), error: null })),
    };
    return builder;
  };
  return { from } as unknown as SupabaseClient;
}

describe("miembrosDeBandeja", () => {
  it("un no admin no recibe la lista y ni se crea el cliente admin", async () => {
    const crear = vi.fn(() => cliente());
    for (const role of ["operations", "support", "accounting", null] as const) {
      expect(await miembrosDeBandeja({ role, tenantId: T1 }, crear)).toEqual([]);
    }
    expect(await miembrosDeBandeja({ role: "admin", tenantId: null }, crear)).toEqual([]);
    expect(crear).not.toHaveBeenCalled();
  });

  it("el admin recibe a los demás miembros activos de su tenant y no a los de otro", async () => {
    const crear = vi.fn(() => cliente());
    const lista = await miembrosDeBandeja({ role: "admin", tenantId: T1 }, crear);
    expect(lista.map((m) => m.user_id).sort()).toEqual([SAM, ANA, LUIS].sort());
    expect(lista.some((m) => m.user_id === OTRO)).toBe(false);
    expect(lista.some((m) => m.user_id === BAJA)).toBe(false);
    expect(crear).toHaveBeenCalledTimes(1);
  });

  it("el defecto que corrige: con el cliente de sesión (RLS) solo se ve a uno mismo", async () => {
    // Evidencia del doble: con RLS el mismo filtro devuelve 1 fila; por eso la lista va con admin.
    const { listMembers } = await import("../../user-queries");
    expect(await listMembers(cliente(SAM), { tenantId: T1 })).toHaveLength(1);
  });
});

// @vitest-environment node
/**
 * SDD-0627 · ensayo en seco del aviso `carga_en_camino` y el gancho del zarpe
 * apagado, desde las acciones reales de Naviera, con el doble de PostgREST que
 * SÍ filtra (`lectores-admin-double.ts`).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dobleLectores, type Fila, type Tablas } from "@/lib/studio/__tests__/lectores-admin-double";

const mocks = vi.hoisted(() => ({
  session: null as unknown,
  admin: null as unknown,
  denial: vi.fn(),
  schedule: vi.fn(),
}));

vi.mock("@/lib/db/server", () => ({ createClient: async () => mocks.session }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => mocks.admin }));
vi.mock("@/lib/studio/rbac-guard", () => ({
  moduleEditDenial: (...a: unknown[]) => mocks.denial(...a),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/studio/notifications/schedule-client-notifications", () => ({
  scheduleClientNotifications: (...a: unknown[]) => mocks.schedule(...a),
}));

import { ensayarAvisosZarpe } from "../actions";

const T = "tenant-A";
const OTRO = "tenant-B";

function envio(id: string, code: string, markbox: string | null, extra: Fila = {}): Fila {
  return {
    id,
    tenant_id: T,
    code,
    client_markbox: markbox,
    client_name: `Nombre ${code}`,
    shipment_service: "consolidado_lcl",
    status: "in_warehouse",
    deleted_at: null,
    ...extra,
  };
}

function tablas(): Tablas {
  return {
    user_tenants: [{ user_id: "u1", tenant_id: T, role: "operations", disabled_at: null }],
    consolidations: [
      { id: "con-1", tenant_id: T, ref: "DTD-CONSOL-0001", status: "cerrado", deleted_at: null },
      { id: "con-x", tenant_id: OTRO, ref: "DTD-CONSOL-0900", status: "cerrado", deleted_at: null },
    ],
    consolidation_items: [
      { tenant_id: T, consolidation_id: "con-1", shipment_id: "s1", client_markbox: "DTD-1", client_name: null },
      { tenant_id: T, consolidation_id: "con-1", shipment_id: "s2", client_markbox: "DTD-1", client_name: null },
      { tenant_id: T, consolidation_id: "con-1", shipment_id: "s3", client_markbox: "DTD-2", client_name: null },
      { tenant_id: T, consolidation_id: "con-1", shipment_id: "s4", client_markbox: "DTD-3", client_name: null },
      { tenant_id: T, consolidation_id: "con-1", shipment_id: null, client_markbox: "DTD-9", client_name: null },
      { tenant_id: OTRO, consolidation_id: "con-x", shipment_id: "x1", client_markbox: "DTD-7", client_name: null },
    ],
    shipments: [
      envio("s1", "ENV-1", "DTD-1"),
      envio("s2", "ENV-2", "DTD-1"),
      envio("s3", "ENV-3", "DTD-2"),
      envio("s4", "ENV-4", "DTD-3", { deleted_at: "2026-10-01T00:00:00Z" }),
      envio("x1", "ENV-X", "DTD-7", { tenant_id: OTRO }),
    ],
    client_notification_rules: [
      { tenant_id: T, client_id: null, trigger_event: "carga_en_camino", channel: "email", active: true },
      { tenant_id: OTRO, client_id: null, trigger_event: "carga_en_camino", channel: "push", active: true },
    ],
  };
}

let admin: ReturnType<typeof dobleLectores>;
let session: ReturnType<typeof dobleLectores>;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.denial.mockResolvedValue(null);
  // La sesión del Studio ve sólo su tenant (lo que haría la RLS).
  const propias = Object.fromEntries(
    Object.entries(tablas()).map(([k, filas]) => [k, filas.filter((f) => f.tenant_id === T)]),
  );
  session = dobleLectores(propias);
  admin = dobleLectores(tablas());
  mocks.session = session.client;
  mocks.admin = admin.client;
});

describe("SDD-0627 · ensayarAvisosZarpe", () => {
  it("cuenta un destinatario por cliente con envíos vivos, sin agendar ni escribir", async () => {
    const r = await ensayarAvisosZarpe("con-1");
    expect(r.error).toBeUndefined();
    expect(r.ensayo).toEqual({
      evento: "carga_en_camino",
      encendido: false,
      leido: true,
      envios: 3,
      destinatarios: 2,
      sinMarkbox: 0,
      regla: "email",
      saldrian: 2,
    });
    expect(admin.inserts).toEqual([]);
    expect(admin.updates).toEqual([]);
    expect(mocks.schedule).not.toHaveBeenCalled();
  });

  it("no ensaya un contenedor de otro tenant", async () => {
    const r = await ensayarAvisosZarpe("con-x");
    expect(r.error).toBe("No encontramos ese contenedor.");
    expect(r.ensayo).toBeUndefined();
  });

  it("sin permiso de Naviera no lee nada", async () => {
    mocks.denial.mockResolvedValue("No tienes permiso para editar Naviera.");
    const r = await ensayarAvisosZarpe("con-1");
    expect(r.error).toBe("No tienes permiso para editar Naviera.");
    expect(admin.filtros).toEqual([]);
  });

  it("rechaza un id vacío", async () => {
    expect((await ensayarAvisosZarpe("  ")).error).toBe("Falta el contenedor.");
  });
});

/**
 * SDD-0509 · Las rutas de lectura de envíos no devuelven ni cuentan eliminados.
 *
 * `GET /api/studio/shipments` y `GET /api/studio/kpis` leen `shipments` con la
 * sesión del usuario; la RLS no excluye los eliminados desde la 0230, así que
 * el filtro va en la consulta. El doble APLICA `is("deleted_at", null)`: sin
 * el filtro, el envío eliminado del fixture entra y la aserción lo delata.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { dobleListados, todoVivo, type Fila } from "@/lib/studio/__tests__/listados-double";

const estado = vi.hoisted(() => ({
  tablas: {} as Record<string, Record<string, unknown>[]>,
}));

vi.mock("@/lib/db/server", () => ({
  createClient: async () => {
    const { client } = dobleListados(estado.tablas);
    return Object.assign(client, {
      auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    });
  },
}));

vi.mock("@/lib/studio/rbac-guard", () => ({
  moduleViewDenial: async () => null,
  moduleEditDenial: async () => null,
}));

vi.mock("@/lib/auth/session", () => ({
  getUserTenantId: async () => "t1",
}));

import { GET as getKpis } from "../kpis/route";
import { GET as getShipments } from "../shipments/route";

function embarque(parcial: Fila & { id: string; code: string }): Fila {
  return {
    tenant_id: "t1",
    status: "in_transit",
    created_at: "2026-10-01T00:00:00Z",
    deleted_at: null,
    ...parcial,
  };
}

/** El eliminado es el más reciente: encabeza el `order by created_at desc`. */
const SHIPMENTS = [
  embarque({ id: "s-vivo", code: "DTDU-0001" }),
  embarque({
    id: "s-eliminado",
    code: "DTDU-0002",
    created_at: "2026-10-10T00:00:00Z",
    deleted_at: "2026-10-11T12:00:00Z",
  }),
];

const MEMBRESIA = [{ tenant_id: "t1", role: "admin" }];

describe("API Studio · envíos eliminados fuera de las lecturas (SDD-0509)", () => {
  beforeEach(() => {
    estado.tablas = { shipments: SHIPMENTS, user_tenants: MEMBRESIA };
  });

  it("GET /api/studio/shipments no devuelve el envío eliminado", async () => {
    const res = await getShipments();
    const body = (await res.json()) as { shipments: { code: string }[] };

    expect(res.status).toBe(200);
    expect(body.shipments.map((s) => s.code)).toEqual(["DTDU-0001"]);
  });

  it("GET /api/studio/kpis no cuenta el envío eliminado", async () => {
    const res = await getKpis();
    const body = (await res.json()) as { kpis: { total: number; en_transito: number } };

    expect(res.status).toBe(200);
    expect(body.kpis.total).toBe(1);
    expect(body.kpis.en_transito).toBe(1);
  });

  it("sin el filtro, las dos rutas verían los dos envíos (control del doble)", async () => {
    estado.tablas = {
      ...todoVivo({ shipments: SHIPMENTS }),
      user_tenants: MEMBRESIA,
    };

    const lista = (await (await getShipments()).json()) as { shipments: { code: string }[] };
    const kpis = (await (await getKpis()).json()) as { kpis: { total: number } };

    expect(lista.shipments.map((s) => s.code)).toEqual(["DTDU-0002", "DTDU-0001"]);
    expect(kpis.kpis.total).toBe(2);
  });
});

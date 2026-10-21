/**
 * SDD-0531 · Naviera no le entrega nombres de clientes al equipo de China.
 *
 * La página corre con sus consultas reales sobre un doble que filtra, y se mira
 * lo que recibe NavieraClient (lo que viajaría al navegador): piezas de cada
 * contenedor, carga suelta, estiba y plan de carga guardado — que lleva el
 * nombre también dentro del texto de sus avisos.
 *
 * Y al asignar carga: el usuario de China no ve el nombre, así que no puede
 * mandarlo; lo pone el servidor desde el embarque de ESA pieza o desde el
 * Shipping Mark de su tenant. Si no, la pieza quedaría sin cliente para Venezuela.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  datosDelClienteConValor,
  dobleSupabase,
  type Doble,
} from "@/lib/studio/__tests__/privacidad-cn-double";
import { CLAVES_DE_DATOS_DEL_CLIENTE } from "@/lib/studio/privacidad-cn";

const h = vi.hoisted(() => ({
  doble: null as unknown as { client: unknown },
}));

vi.mock("@/lib/db/server", () => ({ createClient: async () => h.doble.client }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/studio/rbac-guard", () => ({ moduleEditDenial: async () => null, moduleViewDenial: async () => null }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/lib/studio/naviera-tracking/snapshot-queries", async (original) => ({
  ...(await original<typeof import("@/lib/studio/naviera-tracking/snapshot-queries")>()),
  listTrackingSnapshots: async () => [],
}));
vi.mock("@/lib/studio/naviera/consolidation-request-notify", () => ({
  notifyConsolidationAuthorizedToOperario: vi.fn(),
}));
vi.mock("@/lib/studio/notifications/schedule-fanout", () => ({
  scheduleConsolidationEvent: vi.fn(),
  scheduleSailingEvent: vi.fn(),
}));
vi.mock("../_components/NavieraClient", () => ({ NavieraClient: () => null }));

import NavieraPage from "../page";
import { assignLooseCargo } from "../actions";
import { AssignCargoDrawer } from "../_components/AssignCargoDrawer";
import { ToastProvider } from "@/app/studio/_components/ui/ToastProvider";

const YIWU = { user_id: "u1", tenant_id: "t1", region: "cn", role: "operations", disabled_at: null };
const VALENCIA = { ...YIWU, region: "ve" };

const PLAN = {
  id: "p1",
  tenant_id: "t1",
  consolidation_id: "c1",
  version_no: 1,
  is_current: true,
  container_type: "20GP",
  cbm_capacity: 28,
  zone_layout: null,
  input: [
    { id: "i1", markbox: "DTD-0042", clientName: "María Pérez", cajas: 4, cbm: 2 },
    { id: "i2", markbox: null, clientName: "Comercial Rojas", cajas: 9, cbm: 30 },
  ],
  result: {
    espacio: { code: "20GP", label: "20' estándar", cbmCapacity: 28, layout: { nx: 3, ny: 2, nz: 2 } },
    cbmPorZona: 2.3,
    pasos: [{ paso: 1, loteId: "i1", markbox: "DTD-0042", clientName: "María Pérez", zonas: [], destino: "Valencia" }],
    sinUbicar: [{ loteId: "i2", markbox: null, clientName: "Comercial Rojas", cajas: 3, cbm: 4 }],
    stats: {},
    avisos: [
      {
        tipo: "lote_partido",
        mensaje: "Comercial Rojas no entró completo: quedan 3 cajas (4 CBM) para el próximo contenedor.",
      },
    ],
  },
  algorithm_version: "estiba-plan@1",
  created_by: null,
  created_at: "2026-10-12T00:00:00Z",
};

function sembrar(membresia: typeof YIWU, checkedShipmentIds: string[] = []): Doble {
  const d = dobleSupabase({
    userId: "u1",
    rpc: { client_consolidation_scope: { data: { available: true, complete: true,
      checked: { containerIds: ["c1"], shipmentIds: checkedShipmentIds, receiptIds: [], boxIds: [] },
      containerIds: [], shipmentIds: [], receiptIds: [], boxIds: [] }, error: null } },
    tablas: {
      user_tenants: [membresia],
      consolidations: [
        {
          id: "c1",
          tenant_id: "t1",
          ref: "DTD-CONSOL-0001",
          container_type: "20GP",
          status: "consolidando",
          deleted_at: null,
          created_at: "2026-10-10T00:00:00Z",
          updated_at: "2026-10-10T00:00:00Z",
        },
      ],
      consolidation_items: [
        {
          id: "i1",
          tenant_id: "t1",
          consolidation_id: "c1",
          shipment_id: "s9",
          client_markbox: "DTD-0042",
          client_name: "María Pérez",
          supplier_name: "Yiwu Lamps",
          cbm: 2,
          weight_kg: 300,
          pieces: 4,
          created_at: "2026-10-11T00:00:00Z",
        },
      ],
      warehouse_receipts_cn: [
        { id: "r1", shipment_id: "s1", status: "consolidado", deleted_at: null },
      ],
      shipments: [
        { id: "s0", code: "S-2026-0040", client_name: "Otro Cliente", client_markbox: "DTD-0040", shipment_service: "consolidado_lcl", deleted_at: null, weight_kg: 1, volume_m3: 1 },
        { id: "s1", code: "S-2026-0041", client_name: "Comercial Rojas", client_markbox: "DTD-0077", shipment_service: "consolidado_lcl", deleted_at: null, weight_kg: 500, volume_m3: 3 },
      ],
      consolidation_box_positions: [
        {
          consolidation_id: "c1",
          box_id: "b1",
          zx: 0,
          zy: 0,
          zz: 0,
          seq: 1,
          unstuffed_at: null,
          warehouse_boxes: { code: "BX-1", markbox: "DTD-0042", client_name: "María Pérez" },
        },
      ],
      consolidation_plans: [PLAN],
      clients: [
        { id: "c9", tenant_id: "t2", markbox: "DTD-0042", name: "Otro Tenant SA", deleted_at: null },
        { id: "c1", tenant_id: "t1", markbox: "DTD-0042", name: "María Pérez", deleted_at: null },
      ],
      sailings: [],
      bookings: [],
      carriers: [],
      ports: [],
      container_types: [],
    },
  });
  h.doble = d as never;
  return d;
}

afterEach(cleanup);

describe("/studio/naviera", () => {
  // La página devuelve el elemento <NavieraClient …/> sin pintarlo: sus props
  // son exactamente lo que se serializaría hacia el navegador.
  async function propsPara(membresia: typeof YIWU) {
    sembrar(membresia);
    const el = await NavieraPage();
    const props = el.props as Record<string, unknown>;
    expect(props.consolidations).toHaveLength(1);
    expect(props.normal).toEqual({ available: true, checkedContainerIds: ["c1"], containerIds: [], manifests: {}, errors: {} });
    return props;
  }

  it("China: ningún dato del cliente con valor en lo que cruza a NavieraClient", async () => {
    const p = await propsPara(YIWU);
    expect(datosDelClienteConValor(p, CLAVES_DE_DATOS_DEL_CLIENTE)).toEqual([]);
    // Ni dentro de un texto (el aviso del plan nombra al lote sin Shipping Mark).
    const todo = JSON.stringify(p);
    for (const nombre of ["María Pérez", "Comercial Rojas"]) expect(todo).not.toContain(nombre);
    expect(p.nombresOcultos).toBe(true);
  });

  it("China: el Shipping Mark sigue en cada lugar", async () => {
    const p = await propsPara(YIWU);
    const cons = p.consolidations as { items: { client_markbox: string }[] }[];
    expect(cons[0].items[0].client_markbox).toBe("DTD-0042");
    expect((p.looseCargo as { client_markbox: string }[])[0].client_markbox).toBe("DTD-0077");
    expect((p.stuffingByConsolidation as Record<string, { markbox: string }[]>).c1[0].markbox).toBe(
      "DTD-0042",
    );
    const plan = (p.plansByConsolidation as Record<string, typeof PLAN>).c1;
    expect(plan.result.pasos[0].markbox).toBe("DTD-0042");
    expect(plan.result.avisos[0].mensaje).toMatch(/^Lote sin Shipping Mark no entró completo/);
  });

  it("Venezuela: los nombres siguen donde estaban", async () => {
    const p = await propsPara(VALENCIA);
    const cons = p.consolidations as { items: { client_name: string }[] }[];
    expect(cons[0].items[0].client_name).toBe("María Pérez");
    expect((p.looseCargo as { client_name: string }[])[0].client_name).toBe("Comercial Rojas");
    expect(
      (p.stuffingByConsolidation as Record<string, { clientName: string }[]>).c1[0].clientName,
    ).toBe("María Pérez");
    const plan = (p.plansByConsolidation as Record<string, typeof PLAN>).c1;
    expect(plan).toEqual(PLAN);
    expect(p.nombresOcultos).toBe(false);
  });
});

describe("assignLooseCargo", () => {
  async function asignar(
    membresia: typeof YIWU,
    pieza: Partial<Parameters<typeof assignLooseCargo>[1]>,
  ) {
    const d = sembrar(membresia, pieza.shipmentId ? [pieza.shipmentId] : []);
    const r = await assignLooseCargo("c1", { cbm: 1, weightKg: 10, pieces: 1, ...pieza });
    expect(r.error).toBeUndefined();
    expect(d.rpcLlamadas).toEqual([{ name: "client_consolidation_scope", args: { p_receipt_ids: [],
      p_shipment_ids: pieza.shipmentId ? [pieza.shipmentId] : [], p_container_ids: ["c1"], p_box_ids: [] } }]);
    expect(d.escrituras.filter((write) => write.table === "consolidation_items")).toHaveLength(1);
    const insert = d.escrituras.find((e) => e.table === "consolidation_items");
    return insert?.row as Record<string, unknown>;
  }

  it("China, pieza de un embarque: el nombre sale del embarque de ESA pieza", async () => {
    const fila = await asignar(YIWU, {
      shipmentId: "s1",
      clientMarkbox: "DTD-0077",
      clientName: "Lo que sea",
    });
    expect(fila).toMatchObject({ shipment_id: "s1", client_markbox: "DTD-0077", client_name: "Comercial Rojas" });
  });

  it("China, pieza cargada a mano: el nombre sale del Shipping Mark de su tenant", async () => {
    const fila = await asignar(YIWU, { clientMarkbox: "DTD-0042", clientName: "Lo que sea" });
    expect(fila.client_name).toBe("María Pérez");
  });

  it("China sin embarque ni Shipping Mark: sin nombre, no el del navegador", async () => {
    const fila = await asignar(YIWU, { clientName: "Lo que sea" });
    expect(fila.client_name).toBeNull();
  });

  it("Venezuela: guarda lo que escribió, como siempre", async () => {
    const fila = await asignar(VALENCIA, {
      shipmentId: "s1",
      clientMarkbox: "DTD-0077",
      clientName: "Rojas & Hijos",
    });
    expect(fila.client_name).toBe("Rojas & Hijos");
  });
});

describe("AssignCargoDrawer", () => {
  const detalle = {
    consolidation: { id: "c1", ref: "DTD-CONSOL-0001", container_type: "20GP", status: "consolidando" },
    items: [],
    stats: { cbmUsed: 0, kgUsed: 0, pieces: 0, cbmCapacity: 28, kgCapacity: 28000, cbmPct: 0, kgPct: 0 },
  } as never;

  it("China: sin campo «Cliente»; explica que lo completa el sistema", () => {
    render(
      <ToastProvider>
        <AssignCargoDrawer detail={detalle} looseCargo={[]} onClose={() => {}} nombresOcultos />
      </ToastProvider>,
    );
    expect(screen.queryByText("Cliente")).toBeNull();
    expect(screen.getByText("Shipping Mark")).toBeInTheDocument();
    expect(screen.getByText(/Lo\s+completa el sistema/)).toBeInTheDocument();
  });

  it("Venezuela: el campo sigue", () => {
    render(
      <ToastProvider>
        <AssignCargoDrawer detail={detalle} looseCargo={[]} onClose={() => {}} />
      </ToastProvider>,
    );
    expect(screen.getByText("Cliente")).toBeInTheDocument();
  });
});

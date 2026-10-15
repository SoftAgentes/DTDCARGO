/**
 * SDD-0531 · Las rutas de Tracking tampoco le entregan nombres al equipo de China.
 *
 * La pantalla oculta el nombre, pero el mismo dato sale por la exportación CSV
 * (`/api/studio/operativo/export?tipo=embarques`) y por la API JSON de envíos
 * (`GET /api/studio/shipments`, `GET|PATCH /api/studio/shipments/[id]`). Las
 * tres se llaman con el usuario de Yiwu y con el de Valencia sobre un doble que
 * filtra:
 *
 *  - China: ninguna clave de datos del cliente con valor en el JSON, y la
 *    columna `cliente` del CSV vacía con la cabecera intacta;
 *  - Venezuela: lo de siempre.
 */
import { describe, expect, it, vi } from "vitest";
import {
  datosDelClienteConValor,
  dobleSupabase,
} from "@/lib/studio/__tests__/privacidad-cn-double";
import { CLAVES_DE_DATOS_DEL_CLIENTE } from "@/lib/studio/privacidad-cn";
import { TRACKING_CSV_HEADERS } from "@/lib/studio/export/operativo-csv";

const h = vi.hoisted(() => ({ client: null as unknown }));

vi.mock("@/lib/db/server", () => ({ createClient: async () => h.client }));
vi.mock("@/lib/http/studio-session", () => ({
  requireStudioSession: async () => ({ supabase: h.client, user: { id: "u1" }, tenantId: "t1" }),
}));
vi.mock("@/lib/studio/rbac-guard", () => ({
  getStudioAccess: async () => ({ role: "operations", overrides: {} }),
  moduleViewDenial: async () => null,
  moduleEditDenial: async () => null,
}));

import { GET as exportar } from "../../operativo/export/route";
import { GET as listar } from "../route";
import { GET as leerUno, PATCH as editarUno } from "../[id]/route";

const YIWU = { user_id: "u1", tenant_id: "t1", region: "cn", role: "operations", disabled_at: null };
const VALENCIA = { ...YIWU, region: "ve" };

const ENVIO = {
  id: "s1",
  tenant_id: "t1",
  code: "S-2026-0042",
  client_name: "María Pérez",
  client_markbox: "DTD-0042",
  origin: "Yiwu",
  destination: "Valencia",
  destination_gps: "10.1620, -68.0077",
  shipment_service: "transporte_terrestre",
  status: "in_transit",
  weight_kg: 100,
  volume_m3: 1.5,
  vehicle_category: "camion_chico",
  vehicle_model: null,
  notes: null,
  deleted_at: null,
  created_at: "2026-10-10T12:00:00Z",
  updated_at: "2026-10-10T12:00:00Z",
};

function como(membresia: typeof YIWU) {
  h.client = dobleSupabase({
    userId: "u1",
    tablas: { user_tenants: [membresia], shipments: [ENVIO], shipment_events: [] },
  }).client;
}

/** Por clave y por VALOR: lo segundo no depende del conjunto que se prueba. */
const conValor = (v: unknown) => [
  ...datosDelClienteConValor(v, CLAVES_DE_DATOS_DEL_CLIENTE),
  ...["María Pérez", "10.1620"].filter((dato) => JSON.stringify(v).includes(dato)),
];
const params = { params: Promise.resolve({ id: "s1" }) };

async function csvComo(membresia: typeof YIWU) {
  como(membresia);
  const r = await exportar(new Request("http://studio.test/api/studio/operativo/export?tipo=embarques"));
  expect(r.status).toBe(200);
  const [cabecera, ...filas] = (await r.text()).replace(/^﻿/, "").split("\r\n");
  return { cabecera, filas };
}

describe("CSV de embarques", () => {
  it("China: la columna cliente sale vacía y la cabecera no cambia", async () => {
    const { cabecera, filas } = await csvComo(YIWU);
    expect(cabecera).toBe(TRACKING_CSV_HEADERS.join(","));
    expect(filas).toHaveLength(1);
    const celdas = filas[0].split(",");
    expect(celdas[TRACKING_CSV_HEADERS.indexOf("cliente")]).toBe("");
    expect(celdas[TRACKING_CSV_HEADERS.indexOf("shipping_mark")]).toBe("DTD-0042");
    expect(filas[0]).not.toContain("María");
  });

  it("Venezuela: con el nombre, como siempre", async () => {
    const { filas } = await csvComo(VALENCIA);
    expect(filas[0].split(",")[TRACKING_CSV_HEADERS.indexOf("cliente")]).toBe("María Pérez");
  });
});

describe("API JSON de envíos", () => {
  it("China: la lista llega sin nombres", async () => {
    como(YIWU);
    const cuerpo = await (await listar()).json();
    expect(cuerpo.shipments).toHaveLength(1);
    expect(conValor(cuerpo)).toEqual([]);
    expect(cuerpo.shipments[0].client_markbox).toBe("DTD-0042");
  });

  it("China: el envío llega sin nombre ni ubicación", async () => {
    como(YIWU);
    const cuerpo = await (await leerUno(new Request("http://x") as never, params)).json();
    expect(cuerpo.shipment.code).toBe("S-2026-0042");
    expect(conValor(cuerpo)).toEqual([]);
  });

  it("China: lo que devuelve el PATCH tampoco trae el nombre", async () => {
    como(YIWU);
    const r = await editarUno(
      new Request("http://x", { method: "PATCH", body: JSON.stringify({ notes: "ok" }) }) as never,
      params,
    );
    const cuerpo = await r.json();
    // La fila entera vuelve (con el cambio): si no, no habría nada que ocultar.
    expect(cuerpo.shipment).toMatchObject({ code: "S-2026-0042", notes: "ok" });
    expect(conValor(cuerpo)).toEqual([]);
  });

  it("Venezuela: la lista y el envío traen el nombre", async () => {
    como(VALENCIA);
    const lista = await (await listar()).json();
    expect(lista.shipments[0].client_name).toBe("María Pérez");
    const uno = await (await leerUno(new Request("http://x") as never, params)).json();
    expect(uno.shipment.client_name).toBe("María Pérez");
    expect(uno.shipment.destination_gps).toBe("10.1620, -68.0077");
  });
});

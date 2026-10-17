/**
 * SDD-0531 · Guardar los datos del envío sin ver ni borrar la ubicación.
 *
 * El usuario de China recibe el envío sin `destination_gps`, y `updateShipment`
 * guarda como `null` todo campo ausente. Si el panel le diera esa acción, al
 * corregir el peso borraría una ubicación que nunca vio. Se prueba:
 *
 *  - la acción nueva lee la ubicación de ESTE envío en el servidor (el doble
 *    filtra: con otro envío sembrado primero, leer sin `.eq("id")` se nota) y
 *    se la pasa a `updateShipment` junto con el resto del formulario;
 *  - lo que mande el navegador en `destination_gps` no cuenta;
 *  - sin permiso de edición no lee nada ni delega;
 *  - el panel usa esta acción sólo con los nombres ocultos.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { dobleSupabase, type Doble } from "@/lib/studio/__tests__/privacidad-cn-double";

const h = vi.hoisted(() => ({
  doble: null as unknown as { client: unknown; lecturas: string[] },
  denegacion: null as string | null,
  recibido: null as null | { id: string; campos: [string, string][] },
}));

vi.mock("@/lib/db/server", () => ({ createClient: async () => h.doble.client }));
vi.mock("@/lib/studio/rbac-guard", () => ({
  moduleEditDenial: async () => h.denegacion,
}));
vi.mock("../actions", () => ({
  updateShipment: vi.fn(async (id: string, _prev: unknown, fd: FormData) => {
    h.recibido = {
      id,
      campos: [...fd.entries()].map(([k, v]) => [k, String(v)] as [string, string]),
    };
    return { ok: true };
  }),
  changeDestination: vi.fn(),
  lookupRateForNewDestination: vi.fn(),
}));

import { updateShipment } from "../actions";
import { updateShipmentSinUbicacion } from "../datos-reservados-actions";
import { ShipmentDataPanel } from "../_components/ShipmentDataPanel";
import type { Shipment } from "@/lib/studio/shipment-types";

const OTRO = { id: "s0", destination_gps: "8.0000, -66.0000" };
const ESTE = { id: "s1", destination_gps: "10.1620, -68.0077" };

function sembrar(envios: Record<string, unknown>[]) {
  const d: Doble = dobleSupabase({ userId: "u1", tablas: { shipments: envios } });
  h.doble = d as never;
  return d;
}

function formulario(campos: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.append(k, v);
  return fd;
}

beforeEach(() => {
  h.denegacion = null;
  h.recibido = null;
  vi.mocked(updateShipment).mockClear();
});
afterEach(cleanup);

describe("updateShipmentSinUbicacion", () => {
  it("conserva la ubicación de ESTE envío y deja pasar el resto del formulario", async () => {
    sembrar([OTRO, ESTE]);
    const r = await updateShipmentSinUbicacion(
      "s1",
      {},
      formulario({ weight_kg: "135", notes: "Frágil", origin: "Yiwu" }),
    );
    expect(r).toEqual({ ok: true });
    expect(h.recibido?.id).toBe("s1");
    expect(Object.fromEntries(h.recibido!.campos)).toEqual({
      weight_kg: "135",
      notes: "Frágil",
      origin: "Yiwu",
      destination_gps: "10.1620, -68.0077",
    });
  });

  it("lo que mande el navegador en destination_gps no cuenta", async () => {
    sembrar([ESTE]);
    await updateShipmentSinUbicacion(
      "s1",
      {},
      formulario({ weight_kg: "1", destination_gps: "" }),
    );
    const gps = h.recibido!.campos.filter(([k]) => k === "destination_gps");
    expect(gps).toEqual([["destination_gps", "10.1620, -68.0077"]]);
  });

  it("si el envío no tiene ubicación, no la inventa", async () => {
    sembrar([{ id: "s1", destination_gps: null }]);
    await updateShipmentSinUbicacion("s1", {}, formulario({ weight_kg: "1", destination_gps: "x" }));
    expect(h.recibido!.campos.some(([k]) => k === "destination_gps")).toBe(false);
  });

  it("sin permiso de edición no lee ni delega", async () => {
    const d = sembrar([ESTE]);
    h.denegacion = "No tienes permiso para editar.";
    const r = await updateShipmentSinUbicacion("s1", {}, formulario({ weight_kg: "1" }));
    expect(r).toEqual({ error: "No tienes permiso para editar." });
    expect(d.lecturas).toEqual([]);
    expect(updateShipment).not.toHaveBeenCalled();
  });

  it("si el envío no existe (o la RLS lo oculta), no delega", async () => {
    sembrar([OTRO]);
    const r = await updateShipmentSinUbicacion("s1", {}, formulario({ weight_kg: "1" }));
    expect(r).toEqual({ error: "Envío no encontrado." });
    expect(updateShipment).not.toHaveBeenCalled();
  });
});

// ── El panel elige la puerta ──────────────────────────────────────

vi.mock("../datos-reservados-actions", async (original) => {
  const m = await original<typeof import("../datos-reservados-actions")>();
  return { ...m, updateShipmentSinUbicacion: vi.fn(m.updateShipmentSinUbicacion) };
});

const ENVIO: Shipment = {
  id: "s1",
  tenant_id: "t1",
  code: "S-2026-0042",
  client_name: null,
  client_markbox: "DTD-0042",
  origin: "Yiwu",
  destination: "Valencia",
  shipment_service: "transporte_terrestre",
  status: "in_transit",
  weight_kg: 100,
  volume_m3: 1,
  vehicle_category: "camion_chico",
  vehicle_model: null,
  arrived_destination_at: null,
  planned_departure_at: null,
  planned_arrival_at: null,
  planned_delivery_at: null,
  planning_timezone: "America/Caracas",
  planning_version: 1,
  planning_updated_at: null,
  planning_updated_by: null,
  delivered_at: null,
  pod_signed_by: null,
  delivery_address: null,
  cancellation_reason: null,
  destination_gps: null,
  notes: null,
  deleted_at: null,
  created_at: "2026-10-10T12:00:00Z",
  updated_at: "2026-10-10T12:00:00Z",
};

async function guardarCambioDeNotas() {
  fireEvent.change(screen.getByLabelText("Notas"), { target: { value: "Llamar antes" } });
  const form = screen.getByLabelText("Notas").closest("form") as HTMLFormElement;
  fireEvent.input(form);
  fireEvent.submit(form);
  await vi.waitFor(() => expect(updateShipment).toHaveBeenCalled());
}

describe("ShipmentDataPanel", () => {
  it("con los nombres ocultos guarda por la puerta que conserva la ubicación", async () => {
    sembrar([ESTE]);
    render(<ShipmentDataPanel shipment={ENVIO} nombresOcultos />);
    await guardarCambioDeNotas();
    expect(vi.mocked(updateShipmentSinUbicacion)).toHaveBeenCalled();
    // Y la ubicación llegó a updateShipment desde el servidor, no del formulario.
    expect(h.recibido!.campos).toContainEqual(["destination_gps", "10.1620, -68.0077"]);
  });

  it("con los nombres visibles guarda directo, como siempre", async () => {
    sembrar([ESTE]);
    vi.mocked(updateShipmentSinUbicacion).mockClear();
    render(
      <ShipmentDataPanel
        shipment={{ ...ENVIO, client_name: "María Pérez", destination_gps: "10.1620, -68.0077" }}
      />,
    );
    await guardarCambioDeNotas();
    expect(vi.mocked(updateShipmentSinUbicacion)).not.toHaveBeenCalled();
    expect(h.recibido!.campos).toContainEqual(["destination_gps", "10.1620, -68.0077"]);
  });
});

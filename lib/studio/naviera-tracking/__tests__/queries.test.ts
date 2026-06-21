/**
 * Tests de la resolución del snapshot naviero (SDD-0101 · Slice A).
 *
 * Stub mínimo de SupabaseClient que rutea por tabla: cada `.from(t)` devuelve la
 * data configurada para esa tabla, encadenando select/eq/order/limit/maybeSingle
 * (igual estilo que el resto de la suite del portal).
 */
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getShipmentNaviera } from "../queries";

function stub(
  byTable: Record<string, { data: unknown; error?: unknown }>,
): SupabaseClient {
  return {
    from(table: string) {
      const result = byTable[table] ?? { data: null, error: null };
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: () => Promise.resolve(result),
      };
      return chain;
    },
  } as unknown as SupabaseClient;
}

describe("getShipmentNaviera — resuelve la cadena de consolidación", () => {
  it("cadena completa → snapshot con buque/ETD/ETA/contenedor/BL/naviera", async () => {
    const supabase = stub({
      consolidation_items: { data: { consolidation_id: "con-1" } },
      consolidations: {
        data: {
          ref: "DTD-CONSOL-0502",
          status: "zarpado",
          container_no: "COSU1234567",
          container_type: "40HC",
          booking_id: "bk-1",
          sailing_id: "sl-1",
        },
      },
      sailings: {
        data: {
          vessel: "COSCO FORTUNE",
          voyage: "048W",
          pol: "NGB",
          pod: "PBL",
          etd: "2026-06-10",
          eta: "2026-07-25",
          carrier_id: "car-1",
        },
      },
      bookings: { data: { bl_number: "COSU6620041X", container_no: null, carrier_id: "car-2" } },
      carriers: { data: { name: "COSCO", scac: "COSU" } },
    });

    const snap = await getShipmentNaviera(supabase, "ship-1");
    expect(snap).not.toBeNull();
    expect(snap!.consolidationRef).toBe("DTD-CONSOL-0502");
    expect(snap!.navieraStatus).toBe("zarpado");
    expect(snap!.vessel).toBe("COSCO FORTUNE");
    expect(snap!.etd).toBe("2026-06-10");
    expect(snap!.eta).toBe("2026-07-25");
    expect(snap!.containerNo).toBe("COSU1234567");
    expect(snap!.blNumber).toBe("COSU6620041X");
    // La naviera del sailing manda sobre la del booking.
    expect(snap!.carrierName).toBe("COSCO");
    expect(snap!.carrierScac).toBe("COSU");
  });

  it("envío sin consolidar → null (el caller cae a la heurística)", async () => {
    const supabase = stub({ consolidation_items: { data: null } });
    expect(await getShipmentNaviera(supabase, "ship-x")).toBeNull();
  });

  it("consolidado pero sin zarpe → ref/estado pero sin buque/ETA", async () => {
    const supabase = stub({
      consolidation_items: { data: { consolidation_id: "con-2" } },
      consolidations: {
        data: {
          ref: "DTD-CONSOL-0503",
          status: "consolidando",
          container_no: null,
          container_type: "40HC",
          booking_id: null,
          sailing_id: null,
        },
      },
    });

    const snap = await getShipmentNaviera(supabase, "ship-2");
    expect(snap).not.toBeNull();
    expect(snap!.consolidationRef).toBe("DTD-CONSOL-0503");
    expect(snap!.navieraStatus).toBe("consolidando");
    expect(snap!.vessel).toBeNull();
    expect(snap!.eta).toBeNull();
    expect(snap!.blNumber).toBeNull();
  });

  it("contenedor sin BL del booking → usa el container_no del booking como fallback", async () => {
    const supabase = stub({
      consolidation_items: { data: { consolidation_id: "con-3" } },
      consolidations: {
        data: {
          ref: "DTD-CONSOL-0504",
          status: "zarpado",
          container_no: null, // la consolidación no lo tiene…
          container_type: "40HC",
          booking_id: "bk-3",
          sailing_id: null,
        },
      },
      bookings: { data: { bl_number: null, container_no: "MSKU7654321", carrier_id: "car-9" } }, // …pero el booking sí
      carriers: { data: { name: "Maersk", scac: "MAEU" } },
    });

    const snap = await getShipmentNaviera(supabase, "ship-3");
    expect(snap!.containerNo).toBe("MSKU7654321");
    expect(snap!.carrierName).toBe("Maersk");
  });
});

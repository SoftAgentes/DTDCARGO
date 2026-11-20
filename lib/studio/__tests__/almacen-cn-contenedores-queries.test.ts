/**
 * SDD-0682 §2.2 · Lectura de «En camino»: qué contenedores entran, de dónde sale el
 * número DTD y la naviera, y qué recepciones lleva cada uno. El doble APLICA los
 * filtros (eq/in/is), así que una fila que no debía leerse se nota.
 */
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dobleSupabase } from "./privacidad-cn-double";
import { leerContenedoresEnCamino } from "@/lib/studio/almacen-cn-contenedores-queries";

const AHORA = new Date("2026-11-20T12:00:00Z");

function datos() {
  return {
    consolidations: [
      {
        id: "c-mar",
        ref: "DEMO-CONSOL-01",
        sailing_id: "s-1",
        container_type: "40HC",
        container_no: "DEMO 000001-0",
        status: "zarpado",
        notes: "Carga demo · contenedor DTD #91 · ddp",
        updated_at: "2026-11-10T00:00:00Z",
        deleted_at: null,
      },
      {
        id: "c-sin-numero",
        ref: "DEMO-CONSOL-02",
        sailing_id: null,
        container_type: "40HC",
        container_no: null,
        status: "zarpado",
        notes: null,
        updated_at: "2026-11-15T00:00:00Z",
        deleted_at: null,
      },
      // Se carga o está cerrado sin zarpar: no entra (Sam, 2026-11-20: «solo los que ya zarparon»).
      { id: "c-consolidando", ref: "DEMO-CONSOL-05", sailing_id: "s-1", container_type: null, container_no: null, status: "consolidando", notes: "contenedor DTD #95", updated_at: "2026-11-15T00:00:00Z", deleted_at: null },
      { id: "c-cerrado", ref: "DEMO-CONSOL-06", sailing_id: "s-1", container_type: null, container_no: null, status: "cerrado", notes: "contenedor DTD #96", updated_at: "2026-11-15T00:00:00Z", deleted_at: null },
      // Ya arribó: no está en camino.
      { id: "c-arribado", ref: "DEMO-CONSOL-03", sailing_id: null, container_type: null, container_no: null, status: "arribado", notes: null, updated_at: "2026-11-01T00:00:00Z", deleted_at: null },
      // Eliminado: no entra.
      { id: "c-borrado", ref: "DEMO-CONSOL-04", sailing_id: null, container_type: null, container_no: null, status: "zarpado", notes: null, updated_at: "2026-11-01T00:00:00Z", deleted_at: "2026-11-02T00:00:00Z" },
    ],
    consolidation_items: [
      { id: "i-1", consolidation_id: "c-mar", shipment_id: "sh-1", client_markbox: "DEMO-A", client_name: "Importador secreto A", cbm: 1, weight_kg: 10, pieces: 3, created_at: "2026-11-01T00:00:00Z" },
      { id: "i-2", consolidation_id: "c-mar", shipment_id: "sh-2", client_markbox: "DEMO-B", client_name: "Importador secreto B", cbm: 2, weight_kg: 20, pieces: 5, created_at: "2026-11-01T00:00:01Z" },
    ],
    sailings: [{ id: "s-1", vessel: "Buque demo", pol: "Ningbo", pod: "La Guaira", etd: "2026-11-10", eta: "2026-12-08", carrier_id: "k-1" }],
    carriers: [{ id: "k-1", name: "Naviera demo" }],
    warehouse_receipts_cn: [
      { id: "r-1", receipt_code: "WR-C91-B", client_markbox: "DEMO-A", boxes: 3, total_cbm: 1, shipment_id: "sh-1", status: "consolidado", deleted_at: null, client_name: "Importador secreto A" },
      { id: "r-2", receipt_code: "WR-C91-A", client_markbox: "DEMO-B", boxes: 5, total_cbm: 2, shipment_id: "sh-2", status: "consolidado", deleted_at: null, client_name: "Importador secreto B" },
      // Pendiente: sigue en la bodega, no va en el contenedor.
      { id: "r-3", receipt_code: "WR-2026-0001", client_markbox: "DEMO-A", boxes: 1, total_cbm: 0.1, shipment_id: "sh-1", status: "pendiente_consolidacion", deleted_at: null },
      // Eliminada: no se muestra.
      { id: "r-4", receipt_code: "WR-2026-0002", client_markbox: "DEMO-A", boxes: 1, total_cbm: 0.1, shipment_id: "sh-1", status: "consolidado", deleted_at: "2026-11-05T00:00:00Z" },
      // De otro envío: no es de este contenedor.
      { id: "r-5", receipt_code: "WR-2026-0003", client_markbox: "DEMO-Z", boxes: 1, total_cbm: 0.1, shipment_id: "sh-otro", status: "consolidado", deleted_at: null },
    ],
  };
}

async function leer() {
  const doble = dobleSupabase({ tablas: datos() });
  return leerContenedoresEnCamino(doble.client as SupabaseClient, AHORA);
}

describe("leerContenedoresEnCamino (SDD-0682)", () => {
  it("trae solo los zarpados: sin consolidando, cerrado, arribados ni eliminados; sin ETA al final", async () => {
    const lista = await leer();
    expect(lista.map((c) => c.id)).toEqual(["c-mar", "c-sin-numero"]);
    expect(lista.every((c) => c.grupo === "mar")).toBe(true);
  });

  it("el número DTD sale de las notas y la naviera del itinerario", async () => {
    const [mar, sinNumero] = await leer();
    expect(mar.numeroDtd).toBe(91);
    expect(mar.naviera).toBe("Naviera demo");
    expect(mar.eta).toBe("2026-12-08");
    expect(mar.diasRestantes).toBe(18);
    expect(sinNumero.numeroDtd).toBeNull();
    expect(sinNumero.naviera).toBeNull();
    expect(sinNumero.diasRestantes).toBeNull();
  });

  it("lleva solo las recepciones consolidadas de sus envíos, ordenadas por código", async () => {
    const [mar, sinNumero] = await leer();
    expect(mar.recepciones.map((r) => r.codigo)).toEqual(["WR-C91-A", "WR-C91-B"]);
    expect(mar.recepciones[0]).toEqual({ id: "r-2", codigo: "WR-C91-A", markbox: "DEMO-B", cajas: 5, cbm: 2 });
    expect(mar.piezas).toBe(8);
    expect(mar.clientes).toBe(2);
    expect(sinNumero.recepciones).toEqual([]);
  });

  it("un envío que se movió a un contenedor sin zarpar no se lista en el zarpado (no sale dos veces)", async () => {
    const tablas = datos();
    // sh-2 tenía su línea en c-mar (zarpado) y luego se movió a c-consolidando.
    tablas.consolidation_items.push({
      id: "i-3",
      consolidation_id: "c-consolidando",
      shipment_id: "sh-2",
      client_markbox: "DEMO-B",
      client_name: "Importador secreto B",
      cbm: 2,
      weight_kg: 20,
      pieces: 5,
      created_at: "2026-11-12T00:00:00Z",
    });
    const doble = dobleSupabase({ tablas });
    const [mar] = await leerContenedoresEnCamino(doble.client as SupabaseClient, AHORA);
    expect(mar.id).toBe("c-mar");
    expect(mar.recepciones.map((r) => r.codigo)).toEqual(["WR-C91-B"]);
  });

  it("ningún nombre de importador llega al resultado", async () => {
    expect(JSON.stringify(await leer())).not.toContain("Importador secreto");
  });
});

/**
 * SDD-0682 §2.2 · «En camino» de Almacén China: usa la regla de Tracking (días y
 * porcentaje), ordena primero lo que va en el mar, muestra el número DTD y no deja
 * pasar nombres de importador al navegador.
 */
import { describe, expect, it } from "vitest";
import { armarContenedor, type ContenedorCrudo, type ItemCrudo } from "@/lib/studio/tracking-contenedores";
import {
  aContenedorEnCamino,
  enCaminoOrdenados,
  rotuloDelContenedor,
} from "@/lib/studio/almacen-cn-contenedores";

const AHORA = new Date("2026-11-20T12:00:00Z");

function contenedor(id: string, status: ContenedorCrudo["status"]): ContenedorCrudo {
  return {
    id,
    ref: `DEMO-CONSOL-${id}`,
    container_no: `DEMO ${id}0000-0`,
    container_type: "40HC",
    status,
    updated_at: "2026-11-10T00:00:00Z",
  };
}

function item(i: number, markbox: string, pieces: number): ItemCrudo {
  return {
    id: `it-${i}`,
    shipment_id: null,
    client_markbox: markbox,
    client_name: `Importador secreto ${i}`,
    cbm: 1,
    weight_kg: 100,
    pieces,
  };
}

function vista(
  id: string,
  status: ContenedorCrudo["status"],
  eta: string | null,
  items: ItemCrudo[] = [],
) {
  const v = armarContenedor(
    contenedor(id, status),
    items,
    new Map(),
    { vessel: "Buque de prueba", pol: "Ningbo", pod: "La Guaira", etd: "2026-11-01", eta },
    null,
    AHORA,
  );
  if (!v) throw new Error("contenedor sin grupo");
  return v;
}

describe("Almacén China · En camino (SDD-0682)", () => {
  it("lleva el contador de días y el porcentaje de Tracking, y suma cajas y clientes", () => {
    const v = vista("01", "zarpado", "2026-11-30", [item(1, "DEMO-0001", 3), item(2, "DEMO-0001", 2), item(3, "DEMO-0002", 5)]);
    const c = aContenedorEnCamino(v, { numeroDtd: 91, naviera: "Naviera demo", recepciones: [] });
    expect(c).not.toBeNull();
    expect(c!.grupo).toBe("mar");
    expect(c!.diasRestantes).toBe(v.diasRestantes);
    expect(c!.diasRestantes).toBe(10);
    expect(c!.progreso).toBe(v.progreso);
    expect(c!.clientes).toBe(2);
    expect(c!.piezas).toBe(10);
    expect(c!.numeroDtd).toBe(91);
    expect(c!.naviera).toBe("Naviera demo");
  });

  it("se nombra por el número DTD; sin número, por la referencia", () => {
    expect(rotuloDelContenedor({ numeroDtd: 64, nombre: "DTD-CONSOL-0004" })).toBe("DTD #64");
    expect(rotuloDelContenedor({ numeroDtd: null, nombre: "DTD-CONSOL-0004" })).toBe("DTD-CONSOL-0004");
  });

  it("no lleva nombres de importador; el MARKBOX solo viaja en las recepciones", () => {
    const c = aContenedorEnCamino(vista("02", "zarpado", "2026-12-01", [item(1, "DEMO-0009", 1)]), {
      numeroDtd: null,
      naviera: null,
      recepciones: [{ id: "r-1", codigo: "WR-C91-A", markbox: "DEMO-0007", cajas: 1, cbm: 0.5 }],
    });
    const texto = JSON.stringify(c);
    expect(texto).not.toContain("Importador secreto");
    // El MARKBOX de los ítems no se copia: solo el de cada recepción.
    expect(texto).not.toContain("DEMO-0009");
    expect(c!.recepciones[0].markbox).toBe("DEMO-0007");
  });

  it("sin ETA, los días quedan en null (no se inventan)", () => {
    const c = aContenedorEnCamino(vista("03", "zarpado", null));
    expect(c!.diasRestantes).toBeNull();
  });

  it("solo entra lo que ya zarpó, ordenado por ETA; sin ETA, al final", () => {
    const lista = enCaminoOrdenados([
      vista("11", "zarpado", "2026-12-15"),
      vista("14", "zarpado", null),
      vista("12", "zarpado", "2026-11-25"),
    ]);
    expect(lista.map((c) => c.id)).toEqual(["12", "11", "14"]);
    expect(lista.every((c) => c.grupo === "mar")).toBe(true);
  });

  it("un contenedor «consolidando» y uno «cerrado» NO entran (Sam, 2026-11-20)", () => {
    expect(aContenedorEnCamino(vista("30", "consolidando", "2026-12-20"))).toBeNull();
    expect(aContenedorEnCamino(vista("31", "cerrado", "2026-12-20"))).toBeNull();
    const lista = enCaminoOrdenados([
      vista("30", "consolidando", "2026-12-20"),
      vista("31", "cerrado", "2026-12-20"),
      vista("32", "zarpado", "2026-12-20"),
    ]);
    expect(lista.map((c) => c.id)).toEqual(["32"]);
  });

  it("un contenedor que ya arribó no entra", () => {
    expect(aContenedorEnCamino(vista("20", "arribado", "2026-11-10"))).toBeNull();
  });
});

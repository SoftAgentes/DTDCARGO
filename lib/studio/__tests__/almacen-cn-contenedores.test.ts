/**
 * SDD-0682 §2.2 · «En camino» de Almacén China: usa la regla de Tracking (días y
 * porcentaje), ordena primero lo que va en el mar, y no deja pasar nombres de
 * importador al navegador.
 */
import { describe, expect, it } from "vitest";
import { armarContenedor, type ContenedorCrudo, type ItemCrudo } from "@/lib/studio/tracking-contenedores";
import { aContenedorEnCamino, enCaminoOrdenados } from "@/lib/studio/almacen-cn-contenedores";

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
    const v = vista("01", "zarpado", "2026-11-30", [item(1, "DTD-0001", 3), item(2, "DTD-0001", 2), item(3, "DTD-0002", 5)]);
    const c = aContenedorEnCamino(v);
    expect(c).not.toBeNull();
    expect(c!.grupo).toBe("mar");
    expect(c!.diasRestantes).toBe(v.diasRestantes);
    expect(c!.diasRestantes).toBe(10);
    expect(c!.progreso).toBe(v.progreso);
    expect(c!.clientes).toBe(2);
    expect(c!.piezas).toBe(10);
  });

  it("no lleva nombres ni marcas de importador", () => {
    const c = aContenedorEnCamino(vista("02", "zarpado", "2026-12-01", [item(1, "DTD-0009", 1)]));
    const texto = JSON.stringify(c);
    expect(texto).not.toContain("Importador secreto");
    expect(texto).not.toContain("DTD-0009");
  });

  it("sin ETA, los días quedan en null (no se inventan)", () => {
    const c = aContenedorEnCamino(vista("03", "zarpado", null));
    expect(c!.diasRestantes).toBeNull();
  });

  it("primero lo que va en el mar por ETA; después lo cargado sin zarpar", () => {
    const lista = enCaminoOrdenados([
      vista("10", "cerrado", "2026-12-20"),
      vista("11", "zarpado", "2026-12-15"),
      vista("12", "zarpado", "2026-11-25"),
      vista("13", "consolidando", null),
    ]);
    expect(lista.map((c) => c.id)).toEqual(["12", "11", "10", "13"]);
    expect(lista.map((c) => c.grupo)).toEqual(["mar", "mar", "origen", "origen"]);
  });

  it("un contenedor que ya arribó no entra", () => {
    expect(aContenedorEnCamino(vista("20", "arribado", "2026-11-10"))).toBeNull();
  });
});

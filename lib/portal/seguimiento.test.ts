import { describe, it, expect } from "vitest";
import {
  groupTrackByContainer,
  groupCountLabel,
  type TrackItem,
} from "@/lib/portal/seguimiento";
import type { ShipmentConsolidation } from "@/lib/portal/consolidation-queries";

/**
 * Agrupación de "Seguimiento total" por contenedor (SDD-0170). Todo puro: entra
 * la lista de envíos en camino + el mapa de consolidación, sale la lista de
 * grupos ya ordenada.
 */

function item(id: string, code: string, progress: number): TrackItem {
  return { id, code, progress, statusLabel: "En tránsito", route: "Yiwu → Valencia" };
}

function cons(
  consolidationId: string,
  over: Partial<ShipmentConsolidation> = {},
): ShipmentConsolidation {
  return {
    consolidationId,
    ref: `CONS-${consolidationId}`,
    containerNo: null,
    pol: null,
    pod: null,
    eta: null,
    ...over,
  };
}

describe("groupTrackByContainer", () => {
  it("junta en UN grupo las compras del mismo contenedor", () => {
    const track = [item("s1", "DTD-1", 55), item("s2", "DTD-2", 55)];
    const map = { s1: cons("c1"), s2: cons("c1") };

    const groups = groupTrackByContainer(track, map);

    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe("consolidado");
    expect(groups[0].items.map((i) => i.code)).toEqual(["DTD-1", "DTD-2"]);
  });

  it("usa el nº de contenedor como rótulo cuando existe", () => {
    const map = {
      s1: cons("c1", { containerNo: "DTDU-472816" }),
      s2: cons("c1", { containerNo: "DTDU-472816" }),
    };
    const groups = groupTrackByContainer(
      [item("s1", "DTD-1", 55), item("s2", "DTD-2", 55)],
      map,
    );
    expect(groups[0].label).toBe("DTDU-472816");
    expect(groups[0].labelIsContainer).toBe(true);
  });

  it("cae a la ref de consolidación si el contenedor no está cargado", () => {
    const map = { s1: cons("c1", { ref: "CONS-0042" }), s2: cons("c1", { ref: "CONS-0042" }) };
    const groups = groupTrackByContainer(
      [item("s1", "DTD-1", 55), item("s2", "DTD-2", 55)],
      map,
    );
    expect(groups[0].label).toBe("CONS-0042");
    expect(groups[0].labelIsContainer).toBe(false);
  });

  it("un envío sin consolidación sale como grupo de uno", () => {
    const groups = groupTrackByContainer([item("s9", "DTD-9", 35)], {});
    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe("solo");
    expect(groups[0].key).toBe("solo:s9");
    expect(groups[0].label).toBe("DTD-9");
  });

  it("una sola compra dentro de un contenedor NO se rotula 'consolidado'", () => {
    // Existe la fila de consolidación pero no hay nada que agrupar.
    const groups = groupTrackByContainer([item("s1", "DTD-1", 55)], { s1: cons("c1") });
    expect(groups[0].kind).toBe("solo");
    expect(groupCountLabel(groups[0])).toBeNull();
  });

  it("el progreso del grupo es el MENOR de sus envíos", () => {
    // Van en la misma caja: no prometemos el avance del más adelantado.
    const track = [item("s1", "DTD-1", 75), item("s2", "DTD-2", 35)];
    const map = { s1: cons("c1"), s2: cons("c1") };
    expect(groupTrackByContainer(track, map)[0].progress).toBe(35);
  });

  it("ordena por progreso desc y desempata por rótulo", () => {
    const track = [
      item("s1", "DTD-1", 20),
      item("s2", "DTD-2", 80),
      item("s3", "DTD-3", 80),
    ];
    const groups = groupTrackByContainer(track, {});
    expect(groups.map((g) => g.label)).toEqual(["DTD-2", "DTD-3", "DTD-1"]);
  });

  it("arma la ruta del zarpe y cae a la del envío si no hay", () => {
    const conRuta = groupTrackByContainer([item("s1", "DTD-1", 55)], {
      s1: cons("c1", { pol: "Ningbo", pod: "Puerto Cabello" }),
    });
    expect(conRuta[0].route).toBe("Ningbo → Puerto Cabello");

    // POL sin POD = media ruta: no se inventa, se usa la del envío.
    const sinRuta = groupTrackByContainer([item("s1", "DTD-1", 55)], {
      s1: cons("c1", { pol: "Ningbo" }),
    });
    expect(sinRuta[0].route).toBe("Yiwu → Valencia");
  });

  it("propaga la ETA del zarpe al grupo", () => {
    const groups = groupTrackByContainer([item("s1", "DTD-1", 55)], {
      s1: cons("c1", { eta: "2026-08-14" }),
    });
    expect(groups[0].eta).toBe("2026-08-14");
  });

  it("mezcla consolidados y sueltos sin perder envíos", () => {
    const track = [
      item("s1", "DTD-1", 55),
      item("s2", "DTD-2", 55),
      item("s3", "DTD-3", 90),
    ];
    const groups = groupTrackByContainer(track, { s1: cons("c1"), s2: cons("c1") });

    expect(groups).toHaveLength(2);
    const total = groups.reduce((n, g) => n + g.items.length, 0);
    expect(total).toBe(3);
  });

  it("lista vacía → sin grupos", () => {
    expect(groupTrackByContainer([], {})).toEqual([]);
  });
});

describe("groupCountLabel", () => {
  it("cuenta las compras del contenedor", () => {
    const groups = groupTrackByContainer(
      [item("s1", "DTD-1", 55), item("s2", "DTD-2", 55), item("s3", "DTD-3", 55)],
      { s1: cons("c1"), s2: cons("c1"), s3: cons("c1") },
    );
    expect(groupCountLabel(groups[0])).toBe("3 compras en este contenedor");
  });
});

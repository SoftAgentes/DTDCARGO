/**
 * SDD-0172 · Tests del armado de "Así queda tu orden a DTD — en vivo".
 *
 * Cubre las frases del Norte por servicio, el stepper de HOLD (2 vs N, y el
 * clamp 2-10), el acople HOLD↔re-empaque (activa el servicio y reordena la
 * lista) y el fallback para un servicio que el founder active sin frase propia.
 */

import { describe, it, expect } from "vitest";
import {
  buildPurchaseOrderLines,
  holdOrderLine,
  reempaqueTiedOrderLine,
  clampHoldCount,
  ORDER_LINE_FEE,
  HOLD_MIN,
  HOLD_MAX,
} from "@/lib/portal/purchase-order-lines";
import {
  PREALERTA_ADDON_DEFAULTS,
  type PrealertaAddon,
} from "@/lib/studio/prealertas/addons";

/** Los 5 activos en producción, en el orden del catálogo (`sort`). */
const CATALOGO: PrealertaAddon[] = PREALERTA_ADDON_DEFAULTS.filter((a) =>
  [
    "verificacion",
    "inspeccion_recepcion",
    "reempaque_unificar",
    "etiquetado_pieza",
    "hold_consolidar",
  ].includes(a.code),
).sort((a, b) => a.sort - b.sort);

const descs = (ls: { desc: string }[]) => ls.map((l) => l.desc);
const codes = (ls: { code: string }[]) => ls.map((l) => l.code);

describe("clampHoldCount", () => {
  it("encierra al rango del stepper", () => {
    expect(clampHoldCount(1)).toBe(HOLD_MIN);
    expect(clampHoldCount(0)).toBe(HOLD_MIN);
    expect(clampHoldCount(-5)).toBe(HOLD_MIN);
    expect(clampHoldCount(99)).toBe(HOLD_MAX);
    expect(clampHoldCount(4)).toBe(4);
  });

  it("basura no numérica cae al mínimo, no a NaN", () => {
    expect(clampHoldCount("ocho")).toBe(HOLD_MIN);
    expect(clampHoldCount(undefined)).toBe(HOLD_MIN);
    expect(clampHoldCount(null)).toBe(HOLD_MIN);
  });
});

describe("holdOrderLine", () => {
  it("con 2 habla de 'la próxima compra que llegue'", () => {
    expect(holdOrderLine(2)).toContain("la próxima compra que llegue");
    expect(holdOrderLine(2)).not.toContain("esperen hasta");
  });

  it("con 3+ nombra el total y el despacho en espera", () => {
    expect(holdOrderLine(5)).toContain("lleguen 5 compras en total");
  });

  it("el clamp también aplica a la frase", () => {
    expect(holdOrderLine(1)).toBe(holdOrderLine(2));
    expect(holdOrderLine(50)).toContain(`lleguen ${HOLD_MAX} compras`);
  });
});

describe("buildPurchaseOrderLines", () => {
  it("sin servicios elegidos no hay líneas", () => {
    const lines = buildPurchaseOrderLines({ addons: CATALOGO, selected: [] });
    expect(lines).toEqual([]);
  });

  it("usa la frase del Norte de cada servicio, no su descripción de catálogo", () => {
    const lines = buildPurchaseOrderLines({
      addons: CATALOGO,
      selected: ["verificacion"],
    });
    expect(descs(lines)).toEqual([
      "Cuando llegue a bodega, cuéntenla contra mi factura y envíenme fotos.",
    ]);
    expect(lines[0].fee).toBe(ORDER_LINE_FEE);
  });

  it("respeta el orden del catálogo", () => {
    const lines = buildPurchaseOrderLines({
      addons: CATALOGO,
      selected: ["etiquetado_pieza", "verificacion", "inspeccion_recepcion"],
    });
    expect(codes(lines)).toEqual([
      "verificacion",
      "inspeccion_recepcion",
      "etiquetado_pieza",
    ]);
  });

  it("el HOLD toma la frase del stepper", () => {
    const lines = buildPurchaseOrderLines({
      addons: CATALOGO,
      selected: ["hold_consolidar"],
      holdCount: 4,
    });
    expect(lines[0].desc).toBe(holdOrderLine(4));
  });

  it("re-empaque suelto usa su frase normal", () => {
    const lines = buildPurchaseOrderLines({
      addons: CATALOGO,
      selected: ["reempaque_unificar"],
    });
    expect(descs(lines)).toEqual([
      "Únanme mis compras pequeñas en un solo packing list.",
    ]);
  });

  // ── El acople HOLD ↔ re-empaque ──────────────────────────────

  it("holdTie activa el re-empaque aunque no esté marcado aparte", () => {
    const lines = buildPurchaseOrderLines({
      addons: CATALOGO,
      selected: ["hold_consolidar"],
      holdCount: 3,
      holdTie: true,
    });
    expect(codes(lines)).toContain("reempaque_unificar");
    expect(
      lines.find((l) => l.code === "reempaque_unificar")?.desc,
    ).toBe(reempaqueTiedOrderLine(3));
  });

  it("con el acople, el HOLD se lee ANTES que el re-empaque que lo nombra", () => {
    const lines = buildPurchaseOrderLines({
      addons: CATALOGO,
      selected: ["hold_consolidar", "reempaque_unificar"],
      holdTie: true,
    });
    // En el catálogo reempaque (sort 30) va antes que hold (sort 70): acá se invierte.
    expect(codes(lines).indexOf("hold_consolidar")).toBeLessThan(
      codes(lines).indexOf("reempaque_unificar"),
    );
  });

  it("el acople sin HOLD elegido no arrastra nada", () => {
    const lines = buildPurchaseOrderLines({
      addons: CATALOGO,
      selected: ["verificacion"],
      holdTie: true,
    });
    expect(codes(lines)).toEqual(["verificacion"]);
  });

  it("sin acople, el re-empaque conserva su frase suelta junto al HOLD", () => {
    const lines = buildPurchaseOrderLines({
      addons: CATALOGO,
      selected: ["hold_consolidar", "reempaque_unificar"],
      holdCount: 3,
      holdTie: false,
    });
    expect(
      lines.find((l) => l.code === "reempaque_unificar")?.desc,
    ).toBe("Únanme mis compras pequeñas en un solo packing list.");
    // Sin acople manda el catálogo: reempaque (30) antes que hold (70).
    expect(codes(lines)).toEqual(["reempaque_unificar", "hold_consolidar"]);
  });

  // ── Servicio activado sin frase propia ───────────────────────

  it("un servicio sin frase propia se pide por su nombre de catálogo", () => {
    const conCompactar = PREALERTA_ADDON_DEFAULTS.filter((a) =>
      ["verificacion", "compactar"].includes(a.code),
    ).sort((a, b) => a.sort - b.sort);
    const lines = buildPurchaseOrderLines({
      addons: conCompactar,
      selected: ["compactar"],
    });
    expect(lines).toHaveLength(1);
    expect(lines[0].desc).toContain("Quiero el servicio de");
    expect(lines[0].desc).not.toContain("compactar_");
    expect(lines[0].desc).not.toBe("");
  });

  it("un código elegido que no está en el catálogo activo se ignora", () => {
    const lines = buildPurchaseOrderLines({
      addons: CATALOGO,
      selected: ["compactar", "verificacion"],
    });
    expect(codes(lines)).toEqual(["verificacion"]);
  });
});

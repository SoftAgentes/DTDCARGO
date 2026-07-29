/**
 * SDD-0173 · Tests del armado de "Así queda tu orden a DTD — en vivo".
 *
 * Cubre las frases del Norte por servicio, el stepper de HOLD (2 vs N, y el
 * clamp 2-10), el acople HOLD↔re-empaque (activa el servicio y reordena la
 * lista) y el fallback para un servicio que el founder active sin frase propia.
 */

import { describe, it, expect } from "vitest";
import {
  buildPurchaseOrderLines,
  reconcileServiceRequests,
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

// ╔═══════════════════════════════════════════════════════════╗
// ║ reconcileServiceRequests — lo que DTD termina recibiendo   ║
// ╚═══════════════════════════════════════════════════════════╝
//
// Es la lógica más fácil de romper en silencio del asistente: si una línea que
// el cliente LEYÓ no termina en una fila, DTD nunca se entera de un servicio ya
// prometido. Por eso se prueba sola, sin DB.

describe("reconcileServiceRequests", () => {
  const req = (addonCode: string, notes: string | null = null, trackings: string[] = []) =>
    ({ addonCode, notes, trackings }) as never;

  it("fuera del asistente no toca nada (formulario largo)", () => {
    const out = reconcileServiceRequests({
      addons: CATALOGO,
      requests: [req("verificacion", "mi nota")],
      wizard: false,
      holdTie: true,
      holdCount: 5,
    });
    expect(out).toEqual([
      { addonCode: "verificacion", notes: "mi nota", trackings: [] },
    ]);
  });

  it("la línea de la orden ENCABEZA la nota del cliente", () => {
    const out = reconcileServiceRequests({
      addons: CATALOGO,
      requests: [req("verificacion", "ojo con las tallas")],
      wizard: true,
    });
    expect(out[0].notes).toBe(
      "Cuando llegue a bodega, cuéntenla contra mi factura y envíenme fotos.\n\nojo con las tallas",
    );
  });

  it("sin nota del cliente queda sólo la línea", () => {
    const out = reconcileServiceRequests({
      addons: CATALOGO,
      requests: [req("verificacion")],
      wizard: true,
    });
    expect(out[0].notes).toBe(
      "Cuando llegue a bodega, cuéntenla contra mi factura y envíenme fotos.",
    );
  });

  it("el HOLD guarda la frase con SU contador, no la genérica", () => {
    const out = reconcileServiceRequests({
      addons: CATALOGO,
      requests: [req("hold_consolidar")],
      wizard: true,
      holdCount: 4,
    });
    expect(out[0].notes).toContain("lleguen 4 compras en total");
  });

  // ⭐ El caso que motivó extraer esto: el acople promete un servicio que el
  // form puede no traer. Si no se repone, el cliente lo leyó y DTD no lo ve.
  it("repone el re-empaque que arrastró el HOLD aunque el form no lo traiga", () => {
    const out = reconcileServiceRequests({
      addons: CATALOGO,
      requests: [req("hold_consolidar")],
      wizard: true,
      holdCount: 3,
      holdTie: true,
    });
    const codes = out.map((r) => r.addonCode);
    expect(codes).toContain("reempaque_unificar");
    expect(out.find((r) => r.addonCode === "reempaque_unificar")?.notes).toBe(
      "Reempaque de las 3 compras que estoy consolidando en el HOLD.",
    );
  });

  it("no duplica el re-empaque cuando el form SÍ lo traía", () => {
    const out = reconcileServiceRequests({
      addons: CATALOGO,
      requests: [req("hold_consolidar"), req("reempaque_unificar", "unifiquen todo")],
      wizard: true,
      holdCount: 3,
      holdTie: true,
    });
    const reempaques = out.filter((r) => r.addonCode === "reempaque_unificar");
    expect(reempaques).toHaveLength(1);
    // Y conserva la nota propia del cliente debajo de la línea.
    expect(reempaques[0].notes).toContain("unifiquen todo");
  });

  it("conserva los trackings de cada solicitud", () => {
    const out = reconcileServiceRequests({
      addons: CATALOGO,
      requests: [req("reempaque_unificar", null, ["SF1", "SF2"])],
      wizard: true,
    });
    expect(out[0].trackings).toEqual(["SF1", "SF2"]);
  });

  it("toda línea leída por el cliente tiene su fila (invariante)", () => {
    const requests = [req("hold_consolidar"), req("verificacion")];
    const out = reconcileServiceRequests({
      addons: CATALOGO,
      requests,
      wizard: true,
      holdCount: 6,
      holdTie: true,
    });
    const lineas = buildPurchaseOrderLines({
      addons: CATALOGO,
      selected: requests.map((r) => (r as unknown as { addonCode: string }).addonCode) as never,
      holdCount: 6,
      holdTie: true,
    });
    for (const l of lineas) {
      expect(out.some((r) => r.addonCode === l.code)).toBe(true);
    }
  });
});

import { describe, expect, it } from "vitest";

import {
  assignClientColors,
  colorForMarkbox,
  paletteVarForMarkbox,
  CLIENT_PALETTE_VARS,
} from "../client-palette";
import {
  DEFAULT_ZONE_LAYOUT,
  allZones,
  cubeFaces,
  isZoneInLayout,
  isoProject,
  isoViewBox,
  painterSort,
  parseZoneLayout,
  zoneCodeOf,
  zoneCount,
  zoneLabel,
  zoneOccupancy,
  type StuffedBox,
} from "../zones";

const box = (
  zx: number,
  zy: number,
  zz: number,
  markbox: string | null,
  seq = 1,
): StuffedBox => ({
  zx,
  zy,
  zz,
  markbox,
  boxId: `b-${zx}${zy}${zz}-${markbox ?? "x"}`,
  code: `DTD-B-00000${seq}`,
  clientName: markbox ? `Cliente ${markbox}` : null,
  seq,
});

describe("layout", () => {
  it("el default es 3×1×3 = 9 áreas, SIN altura", () => {
    // SDD-0184: la altura no se usa. El operario solo elige izquierda/centro/
    // derecha (SDD-0155) y la interfaz nunca muestra niveles. Espejo de lo que
    // la migración 0294 deja en `container_types.zone_layout` para los 40'.
    expect(DEFAULT_ZONE_LAYOUT).toEqual({ nx: 3, ny: 1, nz: 3 });
    expect(DEFAULT_ZONE_LAYOUT.ny).toBe(1);
    expect(zoneCount(DEFAULT_ZONE_LAYOUT)).toBe(9);
    expect(allZones(DEFAULT_ZONE_LAYOUT)).toHaveLength(9);
  });

  it("parseZoneLayout tolera jsonb basura y cae al default", () => {
    expect(parseZoneLayout({ nx: 4, ny: 3, nz: 2 })).toEqual({ nx: 4, ny: 3, nz: 2 });
    expect(parseZoneLayout(null)).toEqual(DEFAULT_ZONE_LAYOUT);
    expect(parseZoneLayout("40HC")).toEqual(DEFAULT_ZONE_LAYOUT);
    expect(parseZoneLayout({ nx: 0, ny: 2, nz: 3 })).toEqual(DEFAULT_ZONE_LAYOUT);
    expect(parseZoneLayout({ nx: 3.5, ny: 2, nz: 3 })).toEqual(DEFAULT_ZONE_LAYOUT);
  });

  it("isZoneInLayout ataja lo que el RPC rechazaría", () => {
    // Grilla explícita con DOS niveles: acá lo que se prueba son los límites,
    // no el default (que desde SDD-0184 tiene ny=1).
    const l = { nx: 3, ny: 2, nz: 3 };
    expect(isZoneInLayout(l, { zx: 0, zy: 0, zz: 0 })).toBe(true);
    expect(isZoneInLayout(l, { zx: 2, zy: 1, zz: 2 })).toBe(true);
    expect(isZoneInLayout(l, { zx: 3, zy: 0, zz: 0 })).toBe(false); // nx = 3 → max 2
    expect(isZoneInLayout(l, { zx: 0, zy: 2, zz: 0 })).toBe(false); // ny = 2 → max 1
    expect(isZoneInLayout(l, { zx: 0, zy: 0, zz: -1 })).toBe(false);
  });

  it("con el default (sin altura) cualquier nivel > 0 queda fuera", () => {
    expect(isZoneInLayout(DEFAULT_ZONE_LAYOUT, { zx: 2, zy: 0, zz: 2 })).toBe(true);
    expect(isZoneInLayout(DEFAULT_ZONE_LAYOUT, { zx: 0, zy: 1, zz: 0 })).toBe(false);
  });
});

describe("zoneCodeOf", () => {
  // Si esto cambia, hay que cambiar la columna generada de la migración 0241.
  it("calca el formato de la columna generada en la DB", () => {
    expect(zoneCodeOf({ zx: 0, zy: 0, zz: 0 })).toBe("L0-H0-W0");
    expect(zoneCodeOf({ zx: 2, zy: 1, zz: 2 })).toBe("L2-H1-W2");
  });
});

describe("zoneLabel", () => {
  it("nombra las zonas en español VE", () => {
    // Con DOS niveles el nombre del nivel es Piso/Arriba.
    const l = { nx: 3, ny: 2, nz: 3 };
    expect(zoneLabel(l, { zx: 0, zy: 0, zz: 0 })).toBe("Fondo · Izquierda · Piso");
    expect(zoneLabel(l, { zx: 2, zy: 1, zz: 2 })).toBe("Puerta · Derecha · Arriba");
  });

  it("cae a genéricos si la grilla no es 3×2×3", () => {
    expect(zoneLabel({ nx: 5, ny: 4, nz: 5 }, { zx: 3, zy: 2, zz: 1 })).toBe(
      "Tramo 4 · Fila 2 · Nivel 3",
    );
  });
});

describe("isoProject", () => {
  it("el origen cae en (0,0)", () => {
    expect(isoProject(0, 0, 0, 60, 40)).toEqual([0, 0]);
  });

  it("+x va abajo-derecha · +z va abajo-izquierda · +y va arriba", () => {
    const cw = 60;
    const ch = 40;
    const [xr, yr] = isoProject(1, 0, 0, cw, ch);
    expect(xr).toBeGreaterThan(0); // derecha
    expect(yr).toBeGreaterThan(0); // abajo

    const [xl, yl] = isoProject(0, 0, 1, cw, ch);
    expect(xl).toBeLessThan(0); // izquierda
    expect(yl).toBeGreaterThan(0); // abajo

    const [, yu] = isoProject(0, 1, 0, cw, ch);
    expect(yu).toBe(-ch); // arriba, exactamente un nivel
  });

  it("x y z simétricos se cancelan en horizontal (quedan en el eje central)", () => {
    const [x] = isoProject(2, 0, 2, 60, 40);
    expect(x).toBeCloseTo(0, 10);
  });

  it("da los valores exactos de la trigonometría (cos30/sin30)", () => {
    const [x, y] = isoProject(1, 0, 0, 60, 40);
    expect(x).toBeCloseTo(Math.cos(Math.PI / 6) * 60, 10); // ≈ 51.96
    expect(y).toBeCloseTo(Math.sin(Math.PI / 6) * 60, 10); // = 30
  });
});

describe("painterSort", () => {
  it("dibuja de atrás-abajo hacia adelante-arriba", () => {
    const zs = [
      box(2, 1, 2, "A"), // suma 5 · el más cercano → último
      box(0, 0, 0, "B"), // suma 0 · el más lejano → primero
      box(1, 0, 1, "C"), // suma 2
    ];
    const sorted = painterSort(zs);
    expect(sorted.map((z) => z.zx + z.zy + z.zz)).toEqual([0, 2, 5]);
  });

  it("la de abajo se dibuja antes que la de encima", () => {
    const sorted = painterSort([box(0, 1, 0, "A"), box(0, 0, 0, "B")]);
    expect(sorted[0].zy).toBe(0);
    expect(sorted[1].zy).toBe(1);
  });

  it("no muta el array de entrada", () => {
    const input = [box(2, 0, 0, "A"), box(0, 0, 0, "B")];
    const copy = [...input];
    painterSort(input);
    expect(input).toEqual(copy);
  });
});

describe("cubeFaces", () => {
  it("cada cara visible tiene 4 esquinas", () => {
    const f = cubeFaces({ zx: 0, zy: 0, zz: 0 }, 60, 40);
    expect(f.top).toHaveLength(4);
    expect(f.left).toHaveLength(4);
    expect(f.right).toHaveLength(4);
  });

  it("la tapa está por encima de la base del cubo", () => {
    const f = cubeFaces({ zx: 0, zy: 0, zz: 0 }, 60, 40);
    const topY = Math.max(...f.top.map(([, y]) => y));
    const rightY = Math.max(...f.right.map(([, y]) => y));
    expect(topY).toBeLessThan(rightY); // en SVG, menos y = más arriba
  });
});

describe("isoViewBox", () => {
  it("encuadra la grilla entera con su padding", () => {
    const vb = isoViewBox(DEFAULT_ZONE_LAYOUT, 60, 40, 10);
    expect(vb.width).toBeGreaterThan(0);
    expect(vb.height).toBeGreaterThan(0);
    // El extremo izquierdo es P(0,*,nz) y el derecho P(nx,*,0)
    const [leftX] = isoProject(0, 0, DEFAULT_ZONE_LAYOUT.nz, 60, 40);
    expect(vb.minX).toBeCloseTo(leftX - 10, 6);
  });
});

describe("zoneOccupancy", () => {
  it("cuenta zonas ocupadas, no cajas", () => {
    // Dos cajas en LA MISMA zona = 1 zona ocupada
    const occ = zoneOccupancy(DEFAULT_ZONE_LAYOUT, [
      box(0, 0, 0, "DTD-1005", 1),
      box(0, 0, 0, "DTD-1005", 2),
      box(1, 0, 0, "DTD-1012", 3),
    ]);
    expect(occ.filled).toBe(2);
    expect(occ.total).toBe(9); // SDD-0184: 3×1×3, sin altura
    expect(occ.pct).toBeCloseTo((2 / 9) * 100, 6);
  });

  it("agrupa por cliente, de mayor a menor", () => {
    const occ = zoneOccupancy(DEFAULT_ZONE_LAYOUT, [
      box(0, 0, 0, "DTD-1012", 1),
      box(1, 0, 0, "DTD-1005", 2),
      box(1, 0, 1, "DTD-1005", 3),
      box(1, 0, 2, "DTD-1005", 4),
    ]);
    expect(occ.byMarkbox.map((c) => [c.markbox, c.zones])).toEqual([
      ["DTD-1005", 3],
      ["DTD-1012", 1],
    ]);
  });

  it("las huérfanas (sin markbox) caen en '—'", () => {
    const occ = zoneOccupancy(DEFAULT_ZONE_LAYOUT, [box(0, 0, 0, null)]);
    expect(occ.byMarkbox[0].markbox).toBe("—");
  });

  it("contenedor vacío → 0%", () => {
    const occ = zoneOccupancy(DEFAULT_ZONE_LAYOUT, []);
    expect(occ.filled).toBe(0);
    expect(occ.pct).toBe(0);
    expect(occ.byMarkbox).toEqual([]);
  });
});

describe("paleta por cliente", () => {
  it("el mismo MARKBOX da siempre el mismo color", () => {
    const a = colorForMarkbox("DTD-1005");
    const b = colorForMarkbox("DTD-1005");
    expect(a).toBe(b);
    expect(a).toMatch(/^var\(--cat-[1-6]\)$/);
  });

  it("normaliza espacios y mayúsculas", () => {
    expect(colorForMarkbox(" dtd-1005 ")).toBe(colorForMarkbox("DTD-1005"));
  });

  it("sin dueño → superficie neutra, no un color de cliente", () => {
    expect(colorForMarkbox(null)).toBe("var(--bg-elevated)");
    expect(colorForMarkbox("")).toBe("var(--bg-elevated)");
    expect(colorForMarkbox("   ")).toBe("var(--bg-elevated)");
    expect(paletteVarForMarkbox(null)).toBeNull();
  });

  it("siempre cae dentro de la paleta declarada", () => {
    for (let i = 0; i < 300; i++) {
      const v = paletteVarForMarkbox(`DTD-${1000 + i}`);
      expect(CLIENT_PALETTE_VARS).toContain(v!);
    }
  });

  it("nunca repite color entre clientes de un mismo contenedor (hasta 6)", () => {
    // Es lo que hace que el visor sirva: dos clientes del mismo color son
    // indistinguibles justo cuando más importa distinguirlos.
    const markboxes = ["DTD-1005", "DTD-1012", "DTD-1044", "DTD-1077", "DTD-1090", "DTD-1102"];
    const colors = assignClientColors(markboxes);
    expect(new Set(colors.values()).size).toBe(markboxes.length);
  });

  it("es determinista: el mismo set da el mismo reparto", () => {
    const mb = ["DTD-1044", "DTD-1005", "DTD-1012"];
    expect([...assignClientColors(mb)]).toEqual([...assignClientColors([...mb].reverse())]);
  });

  it("con más de 6 clientes recicla en vez de romper", () => {
    const many = Array.from({ length: 9 }, (_, i) => `DTD-${2000 + i}`);
    const colors = assignClientColors(many);
    expect(colors.size).toBe(9);
    for (const c of colors.values()) expect(c).toMatch(/^var\(--cat-[1-6]\)$/);
  });

  it("ignora nulos al repartir", () => {
    const colors = assignClientColors(["DTD-1005", null, "DTD-1012"]);
    expect(colors.size).toBe(2);
  });
});

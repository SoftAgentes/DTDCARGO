/**
 * SDD-0686 (revisión de la #742): el donut de «Mix de servicios» va en grados
 * de tinta. El más claro tiene que dar 3:1 contra la tarjeta, los segmentos se
 * separan con un trazo del color de la tarjeta, y el último segmento, que toca
 * al primero, no repite su grado.
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Donut, GRADOS_DE_TINTA, gradoDeTinta } from "./charts";

afterEach(cleanup);

describe("gradoDeTinta", () => {
  it("el grado más claro es el 50 % de tinta (3,25:1 en claro y 4,36:1 en oscuro)", () => {
    expect(GRADOS_DE_TINTA.at(-1)).toBe("color-mix(in srgb, var(--ink) 50%, var(--bg-surface))");
    for (const g of GRADOS_DE_TINTA.slice(1)) {
      const pct = Number(/var\(--ink\) (\d+)%/.exec(g)?.[1]);
      expect(pct).toBeGreaterThanOrEqual(50);
    }
  });

  it("con cinco segmentos, el quinto no repite el grado del primero ni del cuarto", () => {
    const grados = [0, 1, 2, 3, 4].map((i) => gradoDeTinta(i, 5));
    expect(grados[4]).not.toBe(grados[0]);
    expect(grados[4]).not.toBe(grados[3]);
  });

  it("hasta cuatro segmentos, cada uno tiene su grado; con un solo segmento va en tinta", () => {
    expect([0, 1, 2, 3].map((i) => gradoDeTinta(i, 4))).toEqual([...GRADOS_DE_TINTA]);
    expect(gradoDeTinta(0, 1)).toBe("var(--ink)");
  });

  it("con nueve segmentos tampoco se tocan el último y el primero con el mismo grado", () => {
    expect(gradoDeTinta(8, 9)).not.toBe(gradoDeTinta(0, 9));
    expect(gradoDeTinta(8, 9)).not.toBe(gradoDeTinta(7, 9));
  });
});

describe("Donut", () => {
  it("separa los segmentos con un trazo del color de la tarjeta", () => {
    const { container } = render(
      <Donut
        data={[
          { label: "Aéreo", value: 3, color: gradoDeTinta(0, 2) },
          { label: "Marítimo", value: 5, color: gradoDeTinta(1, 2) },
        ]}
      />,
    );
    const segmentos = container.querySelectorAll("svg path");
    expect(segmentos).toHaveLength(2);
    for (const s of segmentos) {
      expect(s.getAttribute("stroke")).toBe("var(--bg-surface)");
      expect(Number(s.getAttribute("stroke-width"))).toBeGreaterThanOrEqual(2);
    }
  });
});

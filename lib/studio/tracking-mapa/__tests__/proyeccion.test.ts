/**
 * SDD-0659 · El mapa de Tracking va centrado en el Pacífico.
 *
 * Los dos puntos fijos son los que imprimió el generador del contorno con
 * d3-geo: si la proyección de `proyeccion.ts` se desvía de la que dibujó la
 * tierra, los puertos caerían en el mar o tierra adentro.
 */
import { describe, expect, it } from "vitest";
import { CONTORNO_TIERRA } from "../contorno";
import {
  LUGARES,
  MAPA_ALTO,
  MAPA_ANCHO,
  dentroDelLienzo,
  fraccionDeMar,
  fraccionMasCercana,
  proyectar,
  puntoEnRuta,
  trazoDeRuta,
} from "../proyeccion";

describe("proyección del mapa de Tracking", () => {
  it("coincide con la proyección que dibujó el contorno", () => {
    const [nx, ny] = proyectar(...LUGARES.ningbo);
    expect(nx).toBeCloseTo(107.0785, 2);
    expect(ny).toBeCloseTo(149.1188, 2);
    const [gx, gy] = proyectar(...LUGARES.laGuaira);
    expect(gx).toBeCloseTo(834.4002, 2);
    expect(gy).toBeCloseTo(246.4832, 2);
  });

  it("deja China a la izquierda y Venezuela a la derecha", () => {
    const china = proyectar(...LUGARES.ningbo);
    const panama = proyectar(...LUGARES.panama);
    const venezuela = proyectar(...LUGARES.laGuaira);
    expect(china[0]).toBeLessThan(MAPA_ANCHO * 0.25);
    expect(venezuela[0]).toBeGreaterThan(MAPA_ANCHO * 0.75);
    expect(china[0]).toBeLessThan(panama[0]);
    expect(panama[0]).toBeLessThan(venezuela[0]);
    for (const p of [china, panama, venezuela]) expect(dentroDelLienzo(p)).toBe(true);
  });

  it("la ruta empieza en Yiwu, termina en La Guaira y avanza hacia la derecha", () => {
    const inicio = puntoEnRuta(0);
    const fin = puntoEnRuta(1);
    const yiwu = proyectar(...LUGARES.yiwu);
    const guaira = proyectar(...LUGARES.laGuaira);
    expect(inicio[0]).toBeCloseTo(yiwu[0], 5);
    expect(inicio[1]).toBeCloseTo(yiwu[1], 5);
    expect(fin[0]).toBeCloseTo(guaira[0], 5);
    expect(fin[1]).toBeCloseTo(guaira[1], 5);
    // Cruzando el Pacífico, más avance es siempre más a la derecha.
    let anterior = puntoEnRuta(fraccionDeMar(0.05))[0];
    for (let a = 0.1; a <= 0.7; a += 0.05) {
      const x = puntoEnRuta(fraccionDeMar(a))[0];
      expect(x).toBeGreaterThan(anterior);
      anterior = x;
    }
  });

  it("todos los puntos de la ruta caen dentro del lienzo", () => {
    for (let f = 0; f <= 1.0001; f += 0.01) {
      const p = puntoEnRuta(f);
      expect(dentroDelLienzo(p), `fracción ${f}`).toBe(true);
    }
  });

  it("el tramo de mar va del puerto de salida al de llegada", () => {
    const zarpe = puntoEnRuta(fraccionDeMar(0));
    const ningbo = proyectar(...LUGARES.ningbo);
    expect(zarpe[0]).toBeCloseTo(ningbo[0], 5);
    expect(zarpe[1]).toBeCloseTo(ningbo[1], 5);
    expect(fraccionDeMar(1)).toBe(1);
    expect(fraccionDeMar(-3)).toBe(fraccionDeMar(0));
    expect(fraccionDeMar(Number.NaN)).toBe(fraccionDeMar(0));
  });

  it("ubica una posición real sobre la ruta", () => {
    expect(fraccionMasCercana(...LUGARES.laGuaira)).toBeCloseTo(1, 5);
    expect(fraccionMasCercana(...LUGARES.yiwu)).toBeCloseTo(0, 5);
    const medio = fraccionMasCercana(-175, 33);
    expect(medio).toBeGreaterThan(0.3);
    expect(medio).toBeLessThan(0.6);
  });

  it("el trazo parcial termina donde va el contenedor", () => {
    expect(trazoDeRuta(0)).toBe("");
    const completo = trazoDeRuta(1);
    const mitad = trazoDeRuta(0.5);
    expect(completo.startsWith("M")).toBe(true);
    expect(mitad.length).toBeLessThan(completo.length);
    const [x, y] = puntoEnRuta(0.5);
    const fin = `L${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;
    expect(mitad.endsWith(fin)).toBe(true);
  });

  it("el contorno generado es un trazo del tamaño del lienzo", () => {
    expect(CONTORNO_TIERRA.startsWith("M")).toBe(true);
    const numeros = CONTORNO_TIERRA.match(/-?\d+(\.\d+)?/g)!.map(Number);
    expect(numeros.length).toBeGreaterThan(500);
    expect(Math.max(...numeros)).toBeLessThanOrEqual(MAPA_ANCHO + 4);
    expect(Math.min(...numeros)).toBeGreaterThanOrEqual(-4);
    expect(MAPA_ALTO).toBe(380);
  });
});

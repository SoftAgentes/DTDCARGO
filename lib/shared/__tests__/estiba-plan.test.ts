import { describe, it, expect } from "vitest";

import {
  planificarCarga,
  planificarEnCadena,
  ordenarLotes,
  zonasEnOrdenDeCarga,
  zonasNecesarias,
  cbmPorZona,
  cantidadZonas,
  etiquetaZona,
  zonasDelPlan,
  type EspacioCarga,
  type Lote,
} from "../estiba-plan";

/** 40' HC real: capacidad ÚTIL 68 (no el geométrico 76,2), techo medido 66,4. */
const HC40: EspacioCarga = {
  code: "40HC",
  label: "40' HC",
  cbmCapacity: 68,
  cbmAlertCeiling: 66.4,
  layout: { nx: 3, ny: 2, nz: 3 }, // 18 zonas ⇒ 3,777… CBM por zona
};

const GP20: EspacioCarga = {
  code: "20GP",
  label: "20' GP",
  cbmCapacity: 33,
  cbmAlertCeiling: null,
  layout: { nx: 2, ny: 2, nz: 3 }, // 12 zonas ⇒ 2,75 CBM por zona
};

function lote(id: string, cajas: number, cbm: number, extra: Partial<Lote> = {}): Lote {
  return {
    id,
    markbox: extra.markbox ?? `DTD-${id}`,
    clientName: extra.clientName ?? null,
    cajas,
    cbm,
    ordenDescarga: extra.ordenDescarga ?? null,
  };
}

describe("capacidad", () => {
  it("reparte la capacidad ÚTIL entre las zonas, no el volumen geométrico", () => {
    expect(cantidadZonas(HC40.layout)).toBe(18);
    // 68 / 18 = 3,777… — si alguien mete 76,2 acá, esto se cae.
    expect(cbmPorZona(HC40)).toBeCloseTo(3.7778, 3);
    expect(cbmPorZona(GP20)).toBeCloseTo(2.75, 4);
  });

  it("un lote siempre ocupa al menos una zona, aunque mida casi nada", () => {
    const porZona = cbmPorZona(HC40); // 3,777…
    expect(zonasNecesarias(0.01, porZona)).toBe(1);
    expect(zonasNecesarias(porZona, porZona)).toBe(1);
    expect(zonasNecesarias(porZona * 3, porZona)).toBe(3);
    expect(zonasNecesarias(porZona * 3 + 0.01, porZona)).toBe(4);
    expect(zonasNecesarias(3.8, porZona)).toBe(2);
  });

  it("un lote SIN CBM declarado ocupa una zona en vez de ninguna", () => {
    // Prealerta donde el cliente no llenó el volumen: pasa de verdad. Sin el piso
    // de 1 zona el lote quedaría con `zonas` vacío y el plan reventaría al leer
    // `zonas[0]` para armar el destino.
    expect(zonasNecesarias(0, cbmPorZona(HC40))).toBe(1);
  });

  it("el múltiplo exacto no pide una zona de más por ruido binario", () => {
    // porZona = 0,1 es el caso clásico: 0,1×3 = 0,30000000000000004, y dividido
    // otra vez da 3,0000000000000004 → sin el redondeo previo el ceil daría 4.
    // Con las capacidades reales del catálogo esto no se dispara; la guarda
    // protege a `zonasNecesarias` como función general, no a un caso de hoy.
    expect(zonasNecesarias(0.1 * 3, 0.1)).toBe(3);
  });
});

describe("orden de llenado", () => {
  it("llena tramo por tramo desde el fondo, y el piso completo antes de subir", () => {
    const z = zonasEnOrdenDeCarga({ nx: 2, ny: 2, nz: 2 });
    expect(z).toEqual([
      // tramo 0 (fondo): piso izq/der, luego arriba izq/der
      { zx: 0, zy: 0, zz: 0 },
      { zx: 0, zy: 0, zz: 1 },
      { zx: 0, zy: 1, zz: 0 },
      { zx: 0, zy: 1, zz: 1 },
      // tramo 1 (puerta)
      { zx: 1, zy: 0, zz: 0 },
      { zx: 1, zy: 0, zz: 1 },
      { zx: 1, zy: 1, zz: 0 },
      { zx: 1, zy: 1, zz: 1 },
    ]);
  });

  it("no puede volver al fondo después de llegar a la puerta", () => {
    const z = zonasEnOrdenDeCarga(HC40.layout);
    const profundidades = z.map((c) => c.zx);
    // zx nunca decrece: es el orden físico de carga.
    expect(profundidades).toEqual([...profundidades].sort((a, b) => a - b));
  });
});

describe("orden de los lotes", () => {
  it("el que se descarga ÚLTIMO se carga primero y queda al fondo", () => {
    const lotes = [
      lote("a", 10, 3, { ordenDescarga: 1 }), // se descarga primero ⇒ va a la puerta
      lote("b", 10, 3, { ordenDescarga: 3 }), // se descarga último ⇒ va al fondo
      lote("c", 10, 3, { ordenDescarga: 2 }),
    ];
    expect(ordenarLotes(lotes).map((l) => l.id)).toEqual(["b", "c", "a"]);

    const plan = planificarCarga(lotes, HC40);
    expect(plan.pasos.map((p) => p.loteId)).toEqual(["b", "c", "a"]);
    expect(plan.pasos[0].zonas[0].zx).toBe(0); // "b" al fondo
    expect(plan.pasos[0].destino).toBe("Fondo · Izquierda · Piso");
  });

  it("sin orden de descarga agrupa por cliente de forma estable", () => {
    const lotes = [lote("z", 5, 2, { markbox: "DTD-0099" }), lote("a", 5, 2, { markbox: "DTD-0001" })];
    expect(ordenarLotes(lotes).map((l) => l.markbox)).toEqual(["DTD-0001", "DTD-0099"]);
  });

  it("es DETERMINISTA: la misma entrada da el mismo plan", () => {
    const lotes = [
      lote("a", 10, 5.5),
      lote("b", 40, 12.2),
      lote("c", 7, 1.1),
      lote("d", 22, 8),
    ];
    const uno = planificarCarga(lotes, HC40);
    const dos = planificarCarga([...lotes].reverse(), HC40);
    expect(JSON.stringify(dos)).toBe(JSON.stringify(uno));
  });
});

describe("reparto", () => {
  it("un lote chico ocupa una sola zona y arranca en el fondo", () => {
    const plan = planificarCarga([lote("a", 50, 3)], HC40);
    expect(plan.pasos).toHaveLength(1);
    expect(plan.pasos[0].zonas).toHaveLength(1);
    expect(plan.pasos[0].zonas[0]).toEqual({ zx: 0, zy: 0, zz: 0 });
    expect(plan.pasos[0].cajasUbicadas).toBe(50);
    expect(plan.pasos[0].parcial).toBe(false);
    expect(plan.sinUbicar).toHaveLength(0);
  });

  it("un lote grande se lleva varias zonas consecutivas", () => {
    // 12 CBM / 3,777… = 3,17 ⇒ 4 zonas
    const plan = planificarCarga([lote("a", 200, 12)], HC40);
    expect(plan.pasos[0].zonas).toHaveLength(4);
    expect(plan.stats.zonasUsadas).toBe(4);
  });

  it("las zonas no se pisan entre lotes", () => {
    const plan = planificarCarga(
      [lote("a", 30, 9), lote("b", 30, 9), lote("c", 30, 9)],
      HC40,
    );
    const claves = zonasDelPlan(plan).map((z) => `${z.zx}-${z.zy}-${z.zz}`);
    expect(new Set(claves).size).toBe(claves.length);
  });

  it("calcula el % sobre la capacidad ÚTIL (68), no sobre el geométrico", () => {
    const plan = planificarCarga([lote("a", 100, 34)], HC40);
    expect(plan.stats.cbmUbicado).toBe(34);
    expect(plan.stats.pctVolumen).toBe(50); // 34/68. Con 76,2 daría 44,6.
  });
});

describe("desborde", () => {
  it("lo que no entra queda sin ubicar y avisa que hace falta otro contenedor", () => {
    // 18 zonas; cada lote de 20 CBM pide 6 zonas ⇒ entran 3, el cuarto no.
    const lotes = [
      lote("a", 10, 20, { ordenDescarga: 4 }),
      lote("b", 10, 20, { ordenDescarga: 3 }),
      lote("c", 10, 20, { ordenDescarga: 2 }),
      lote("d", 10, 20, { ordenDescarga: 1 }),
    ];
    const plan = planificarCarga(lotes, HC40);
    expect(plan.pasos).toHaveLength(3);
    expect(plan.sinUbicar.map((s) => s.loteId)).toEqual(["d"]);
    expect(plan.avisos.some((a) => a.tipo === "sin_espacio")).toBe(true);
  });

  it("parte un lote cuando entra a medias y manda el resto al próximo contenedor", () => {
    // 16 zonas ocupadas por 'a'; quedan 2 y 'b' pide 6 ⇒ 'b' se parte.
    const plan = planificarCarga(
      [lote("a", 100, 60, { ordenDescarga: 2 }), lote("b", 60, 20, { ordenDescarga: 1 })],
      HC40,
    );
    const b = plan.pasos.find((p) => p.loteId === "b");
    expect(b?.parcial).toBe(true);
    expect(b?.cajasUbicadas).toBeLessThan(60);
    expect(plan.sinUbicar.map((s) => s.loteId)).toEqual(["b"]);
    expect(plan.avisos.some((a) => a.tipo === "lote_partido")).toBe(true);

    // Nada se pierde ni se duplica en el corte.
    const resto = plan.sinUbicar.find((s) => s.loteId === "b");
    expect((b?.cajasUbicadas ?? 0) + (resto?.cajas ?? 0)).toBe(60);
  });

  it("una caja sola NO se parte: viaja entera en el próximo contenedor", () => {
    // 'a' pide 17 de las 18 zonas ⇒ queda UNA libre. 'b' pide 6: entraría a
    // medias, pero es una sola caja y una caja no se corta por la mitad.
    // Ojo: si 'a' se llevara las 18, este caso caería por la rama de "no quedan
    // zonas" y nunca ejercitaría la guarda.
    const plan = planificarCarga(
      [lote("a", 100, 62, { ordenDescarga: 2 }), lote("b", 1, 20, { ordenDescarga: 1 })],
      HC40,
    );
    expect(plan.pasos.map((p) => p.loteId)).toEqual(["a"]);
    expect(plan.pasos[0].zonas).toHaveLength(17);
    expect(plan.stats.zonasUsadas).toBe(17); // la zona libre queda libre
    expect(plan.sinUbicar).toEqual([
      { loteId: "b", markbox: "DTD-b", clientName: null, cajas: 1, cbm: 20 },
    ]);
  });

  it("encadena contenedores hasta ubicar todo", () => {
    const lotes = Array.from({ length: 8 }, (_, i) =>
      lote(`l${i}`, 10, 20, { ordenDescarga: 8 - i }),
    );
    const planes = planificarEnCadena(lotes, HC40);
    expect(planes.length).toBeGreaterThan(1);
    expect(planes[planes.length - 1].sinUbicar).toHaveLength(0);

    // Ningún lote se pierde: 8 lotes × 10 cajas = 80 cajas repartidas.
    const total = planes.reduce(
      (acc, p) => acc + p.pasos.reduce((a, x) => a + x.cajasUbicadas, 0),
      0,
    );
    expect(total).toBe(80);
  });

  it("un lote más grande que el contenedor entero termina igual, sin bucle infinito", () => {
    const planes = planificarEnCadena([lote("gigante", 500, 200)], HC40);
    expect(planes.length).toBeGreaterThan(1);
    expect(planes.length).toBeLessThanOrEqual(10);
    expect(planes[planes.length - 1].sinUbicar).toHaveLength(0);
  });
});

describe("avisos de techo", () => {
  it("avisa al pasar el techo REAL medido sin bloquear el plan", () => {
    const plan = planificarCarga([lote("a", 900, 67)], HC40);
    expect(plan.pasos).toHaveLength(1); // no bloquea
    expect(plan.avisos.some((a) => a.tipo === "techo_real")).toBe(true);
    expect(plan.avisos.some((a) => a.tipo === "sobre_capacidad")).toBe(false);
  });

  it("no avisa por debajo del techo", () => {
    const plan = planificarCarga([lote("a", 900, 60)], HC40);
    expect(plan.avisos).toHaveLength(0);
  });

  it("sin techo configurado no avisa nunca por techo", () => {
    const plan = planificarCarga([lote("a", 100, 30)], GP20);
    expect(plan.avisos.some((a) => a.tipo === "techo_real")).toBe(false);
  });
});

describe("bordes", () => {
  it("contenedor vacío devuelve un plan vacío, no un error", () => {
    const plan = planificarCarga([], HC40);
    expect(plan.pasos).toHaveLength(0);
    expect(plan.sinUbicar).toHaveLength(0);
    expect(plan.stats).toMatchObject({
      cbmUbicado: 0,
      cajasUbicadas: 0,
      zonasUsadas: 0,
      zonasTotales: 18,
      pctVolumen: 0,
    });
    expect(plan.avisos).toHaveLength(0);
  });

  it("un lote sin CBM declarado se planifica igual, no revienta", () => {
    const plan = planificarCarga(
      [lote("sinCbm", 12, 0, { ordenDescarga: 2 }), lote("b", 30, 9, { ordenDescarga: 1 })],
      HC40,
    );
    const a = plan.pasos.find((p) => p.loteId === "sinCbm");
    expect(a?.zonas).toHaveLength(1);
    expect(a?.destino).toBe("Fondo · Izquierda · Piso");
    expect(a?.cajasUbicadas).toBe(12);
    // Y no se come el espacio del que sí declaró volumen.
    expect(plan.pasos.find((p) => p.loteId === "b")?.zonas.length).toBe(3);
    expect(plan.sinUbicar).toHaveLength(0);
  });

  it("rejilla degenerada no revienta: manda todo a sin ubicar", () => {
    const roto: EspacioCarga = { ...HC40, layout: { nx: 0, ny: 0, nz: 0 } };
    const plan = planificarCarga([lote("a", 5, 2)], roto);
    expect(plan.pasos).toHaveLength(0);
    expect(plan.sinUbicar).toHaveLength(1);
    expect(plan.avisos[0].tipo).toBe("sin_espacio");
  });

  it("etiqueta las zonas en español venezolano", () => {
    expect(etiquetaZona(HC40.layout, { zx: 0, zy: 0, zz: 0 })).toBe("Fondo · Izquierda · Piso");
    expect(etiquetaZona(HC40.layout, { zx: 2, zy: 1, zz: 2 })).toBe("Puerta · Derecha · Arriba");
    expect(etiquetaZona(GP20.layout, { zx: 1, zy: 0, zz: 1 })).toBe("Puerta · Centro · Piso");
  });
});

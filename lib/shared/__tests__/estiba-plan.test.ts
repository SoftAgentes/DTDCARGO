// @vitest-environment node
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
  ordenDeDescarga,
  ubicacionDeCliente,
  tramoDe,
  ladosDe,
  frasePosicion,
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
    manejoEspecial: extra.manejoEspecial ?? null,
  };
}

/**
 * El CBM que quedó cargado en el área más llena. Como las áreas se COMPARTEN,
 * esto es el invariante que no se puede violar nunca: ningún área puede recibir
 * más volumen del que aguanta.
 */
function maxCbmPorArea(plan: ReturnType<typeof planificarCarga>): number {
  const porArea = new Map<string, number>();
  for (const p of plan.pasos) {
    for (const z of p.zonas) {
      const k = `${z.zx}-${z.zy}-${z.zz}`;
      porArea.set(k, (porArea.get(k) ?? 0) + z.cbm);
    }
  }
  return porArea.size === 0 ? 0 : Math.max(...porArea.values());
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
    expect(plan.pasos[0].destino).toBe("Fondo a la izquierda · Piso");
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
    expect(plan.pasos[0].zonas[0]).toEqual({ zx: 0, zy: 0, zz: 0, cbm: 3 });
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

  it("varios clientes COMPARTEN un área, uno al lado del otro", () => {
    // Cada área aguanta 3,77 CBM; tres lotes de 2 CBM tienen que convivir en el
    // fondo izquierdo en vez de quedarse cada uno con un área entera.
    const plan = planificarCarga(
      [lote("a", 5, 2), lote("b", 5, 2), lote("c", 5, 2)],
      HC40,
    );
    const enFondoIzq = zonasDelPlan(plan).filter(
      (z) => z.zx === 0 && z.zy === 0 && z.zz === 0,
    );
    expect(enFondoIzq.length).toBeGreaterThan(1);
    // 6 CBM en total no pueden ocupar más de 2 áreas de 3,77.
    expect(plan.stats.zonasUsadas).toBeLessThanOrEqual(2);
  });

  it("ningún área recibe más CBM del que aguanta", () => {
    const plan = planificarCarga(
      [lote("a", 30, 9), lote("b", 30, 9), lote("c", 30, 9), lote("d", 12, 4.5)],
      HC40,
    );
    // Cada área trae su propio CBM: el volumen NO se reparte en partes iguales,
    // se llena un área y se pasa a la siguiente.
    expect(maxCbmPorArea(plan)).toBeLessThanOrEqual(plan.cbmPorZona + 0.001);
  });

  it("compartir áreas hace que el contenedor se llene por CBM, no por casillas", () => {
    // 9 lotes de 3 CBM = 27 CBM. Sin compartir se comerían 9 áreas (de 18);
    // compartiendo caben en 8, que es lo que 27 CBM ocupa de verdad.
    const lotes = Array.from({ length: 9 }, (_, i) => lote(`l${i}`, 10, 3));
    const plan = planificarCarga(lotes, HC40);
    expect(plan.pasos).toHaveLength(9);
    expect(plan.sinUbicar).toHaveLength(0);
    expect(plan.stats.cbmUbicado).toBe(27);
    expect(plan.stats.zonasUsadas).toBeLessThanOrEqual(8);
  });

  it("calcula el % sobre la capacidad ÚTIL (68), no sobre el geométrico", () => {
    const plan = planificarCarga([lote("a", 100, 34)], HC40);
    expect(plan.stats.cbmUbicado).toBe(34);
    expect(plan.stats.pctVolumen).toBe(50); // 34/68. Con 76,2 daría 44,6.
  });
});

describe("desborde", () => {
  it("el contenedor se corta en su capacidad ÚTIL, no antes", () => {
    // 4 lotes × 20 CBM = 80, contra 68 de capacidad. Entran 68: los tres primeros
    // completos y el cuarto partido. Ni un CBM más, ni uno menos.
    const lotes = [
      lote("a", 10, 20, { ordenDescarga: 4 }),
      lote("b", 10, 20, { ordenDescarga: 3 }),
      lote("c", 10, 20, { ordenDescarga: 2 }),
      lote("d", 10, 20, { ordenDescarga: 1 }),
    ];
    const plan = planificarCarga(lotes, HC40);
    expect(plan.stats.cbmUbicado).toBe(68);
    expect(plan.pasos.map((p) => p.loteId)).toEqual(["a", "b", "c", "d"]);
    expect(plan.pasos[3].parcial).toBe(true);
    expect(plan.sinUbicar.map((s) => s.loteId)).toEqual(["d"]);
    expect(plan.sinUbicar[0].cbm).toBe(12); // 20 − 8
    expect(plan.avisos.some((a) => a.tipo === "lote_partido")).toBe(true);
  });

  it("rechazar una pieza indivisible DEVUELVE el espacio al siguiente cliente", () => {
    // 'a' deja 8 CBM libres exactos (68 − 60). 'b' es una máquina de 20 CBM en
    // una sola pieza: no entra y no se parte. 'c' mide justo esos 8, así que solo
    // entra completa si al rechazar a 'b' se devolvió TODO el espacio que alcanzó
    // a recorrer — incluida la fracción del área que estaba a medio llenar.
    const plan = planificarCarga(
      [
        lote("a", 100, 60, { ordenDescarga: 3 }),
        lote("b", 1, 20, { ordenDescarga: 2 }),
        lote("c", 10, 8, { ordenDescarga: 1 }),
      ],
      HC40,
    );
    expect(plan.pasos.map((p) => p.loteId)).toEqual(["a", "c"]);
    expect(plan.pasos[1].cbmUbicado).toBe(8);
    expect(plan.pasos[1].parcial).toBe(false);
    expect(plan.stats.cbmUbicado).toBe(68);
    expect(plan.sinUbicar.map((s) => s.loteId)).toEqual(["b"]);
    // Y el espacio devuelto no puede reaparecer como capacidad de más: el área
    // que 'a' dejó a medio llenar recibe solo lo que le faltaba.
    expect(maxCbmPorArea(plan)).toBeLessThanOrEqual(plan.cbmPorZona + 0.001);
  });

  it("un lote sin CBM no infla la ocupación del área que comparte", () => {
    const plan = planificarCarga(
      [
        lote("sinCbm", 12, 0, { ordenDescarga: 2 }),
        lote("otro", 30, 3, { ordenDescarga: 1 }),
      ],
      HC40,
    );
    const sin = plan.pasos.find((p) => p.loteId === "sinCbm");
    expect(sin?.zonas).toHaveLength(1);
    expect(sin?.zonas[0].cbm).toBe(0);
    // El área compartida solo carga el CBM del que sí lo declaró.
    const k = (z: { zx: number; zy: number; zz: number }) => `${z.zx}-${z.zy}-${z.zz}`;
    const enEsaArea = plan.pasos
      .flatMap((p) => p.zonas)
      .filter((z) => k(z) === k(sin!.zonas[0]))
      .reduce((a, z) => a + z.cbm, 0);
    expect(enEsaArea).toBe(3);
  });

  it("un lote que llega con el contenedor lleno queda entero sin ubicar", () => {
    const plan = planificarCarga(
      [
        lote("lleno", 100, 68, { ordenDescarga: 2 }),
        lote("tarde", 10, 5, { ordenDescarga: 1 }),
      ],
      HC40,
    );
    expect(plan.pasos.map((p) => p.loteId)).toEqual(["lleno"]);
    expect(plan.sinUbicar.map((s) => s.loteId)).toEqual(["tarde"]);
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

describe("aduana · ¿dónde está la carga de este cliente?", () => {
  // 4 lotes de 9 CBM ⇒ 3 zonas cada uno ⇒ 12 de las 18 zonas.
  const lotes = [
    lote("a", 30, 9, { markbox: "DTD-0001", ordenDescarga: 4 }),
    lote("b", 30, 9, { markbox: "DTD-0042", ordenDescarga: 3 }),
    lote("c", 30, 9, { markbox: "DTD-0003", ordenDescarga: 2 }),
    lote("d", 30, 9, { markbox: "DTD-0004", ordenDescarga: 1 }),
  ];

  it("dice tramo, lado y puesto en la fila de descarga", () => {
    const plan = planificarCarga(lotes, HC40);
    const u = ubicacionDeCliente(plan, "DTD-0042");
    expect(u).not.toBeNull();
    expect(u?.cajas).toBe(30);
    expect(u?.cbm).toBe(9);
    // 'b' carga 2º ⇒ de 4 lotes, sale 3º.
    expect(u?.ordenDescarga).toBe(3);
    expect(u?.resumen).toContain("sale 3º de 4");
  });

  it("devuelve null si el cliente no viaja en ese contenedor", () => {
    const plan = planificarCarga(lotes, HC40);
    expect(ubicacionDeCliente(plan, "DTD-9999")).toBeNull();
  });

  it("agrega los lotes cuando un cliente tiene más de uno", () => {
    const plan = planificarCarga(
      [
        lote("x1", 10, 4, { markbox: "DTD-0042", ordenDescarga: 3 }),
        lote("otro", 10, 4, { markbox: "DTD-0001", ordenDescarga: 2 }),
        lote("x2", 5, 4, { markbox: "DTD-0042", ordenDescarga: 1 }),
      ],
      HC40,
    );
    const u = ubicacionDeCliente(plan, "DTD-0042");
    expect(u?.cajas).toBe(15); // 10 + 5
    expect(u?.cbm).toBe(8);
    expect(u?.zonas.length).toBe(4); // 2 lotes × 2 zonas
  });

  it("describe el tramo como rango cuando la carga abarca varios", () => {
    expect(tramoDe(HC40.layout, [{ zx: 1, zy: 0, zz: 0 }])).toBe("Medio");
    expect(
      tramoDe(HC40.layout, [
        { zx: 1, zy: 0, zz: 0 },
        { zx: 2, zy: 0, zz: 1 },
      ]),
    ).toBe("Medio a Puerta");
  });

  it("describe los lados sin repetir y colapsa cuando ocupa todo el ancho", () => {
    expect(ladosDe(HC40.layout, [{ zx: 0, zy: 0, zz: 2 }])).toBe("Derecha");
    expect(
      ladosDe(HC40.layout, [
        { zx: 0, zy: 0, zz: 0 },
        { zx: 0, zy: 1, zz: 0 },
        { zx: 0, zy: 0, zz: 1 },
      ]),
    ).toBe("Izquierda y Centro");
    expect(
      ladosDe(HC40.layout, [
        { zx: 0, zy: 0, zz: 0 },
        { zx: 0, zy: 0, zz: 1 },
        { zx: 0, zy: 0, zz: 2 },
      ]),
    ).toBe("Todo el ancho");
  });
});

describe("despacho · ¿qué sale primero?", () => {
  it("invierte el orden de carga: lo último que entró es lo primero que sale", () => {
    const plan = planificarCarga(
      [
        lote("fondo", 10, 5, { ordenDescarga: 3 }),
        lote("medio", 10, 5, { ordenDescarga: 2 }),
        lote("puerta", 10, 5, { ordenDescarga: 1 }),
      ],
      HC40,
    );
    expect(plan.pasos.map((p) => p.loteId)).toEqual(["fondo", "medio", "puerta"]);
    expect(ordenDeDescarga(plan).map((d) => d.loteId)).toEqual([
      "puerta",
      "medio",
      "fondo",
    ]);
    expect(ordenDeDescarga(plan)[0].orden).toBe(1);
  });

  it("dice CUÁNDO aparece lo que necesita montacargas", () => {
    // El equipo pesado va al fondo ⇒ sale de último ⇒ el montacargas se pide al final.
    const plan = planificarCarga(
      [
        lote("pesado", 4, 12, { ordenDescarga: 3, manejoEspecial: "montacargas" }),
        lote("liviano1", 40, 6, { ordenDescarga: 2 }),
        lote("liviano2", 40, 6, { ordenDescarga: 1 }),
      ],
      HC40,
    );
    const fila = ordenDeDescarga(plan);
    const pesado = fila.find((d) => d.manejoEspecial === "montacargas");
    expect(pesado?.orden).toBe(3);
    // 12 CBM = 4 zonas, y el tramo del fondo tiene 6 (2 alturas × 3 anchos):
    // el lote entero cabe en el fondo sin invadir el medio.
    expect(pesado?.tramo).toBe("Fondo");
    // Los demás no arrastran manejo especial.
    expect(fila.filter((d) => d.manejoEspecial != null)).toHaveLength(1);
  });

  it("cada lote de la fila trae tramo y lado, que es lo que se lee en el teléfono", () => {
    const plan = planificarCarga([lote("a", 30, 9), lote("b", 30, 9)], HC40);
    for (const d of ordenDeDescarga(plan)) {
      expect(d.tramo).not.toBe("—");
      expect(d.lados).not.toBe("—");
    }
  });

  it("contenedor vacío no revienta la fila de descarga", () => {
    expect(ordenDeDescarga(planificarCarga([], HC40))).toEqual([]);
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
    expect(a?.destino).toBe("Fondo a la izquierda · Piso");
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

  it("etiqueta cada zona con UNA frase natural, sin altura", () => {
    // El modelo real (SDD-0155) no tiene niveles: el operario solo elige lado.
    const plano = { nx: 3, ny: 1, nz: 3 };
    expect(etiquetaZona(plano, { zx: 0, zy: 0, zz: 0 })).toBe("Fondo a la izquierda");
    expect(etiquetaZona(plano, { zx: 0, zy: 0, zz: 1 })).toBe("Fondo al centro");
    expect(etiquetaZona(plano, { zx: 0, zy: 0, zz: 2 })).toBe("Fondo a la derecha");
    expect(etiquetaZona(plano, { zx: 1, zy: 0, zz: 1 })).toBe("Medio al centro");
    expect(etiquetaZona(plano, { zx: 2, zy: 0, zz: 2 })).toBe("Puerta a la derecha");
  });

  it("nunca dice 'Medio en el medio'", () => {
    // Por eso el centro es "al centro" y no "en el medio": el tramo del medio ya
    // se llama Medio y la frase se volvía ilegible.
    expect(etiquetaZona({ nx: 3, ny: 1, nz: 3 }, { zx: 1, zy: 0, zz: 1 })).not.toContain(
      "en el medio",
    );
  });

  it("solo agrega el nivel si el contenedor está configurado con más de uno", () => {
    expect(etiquetaZona(HC40.layout, { zx: 0, zy: 0, zz: 0 })).toBe(
      "Fondo a la izquierda · Piso",
    );
    expect(etiquetaZona(HC40.layout, { zx: 2, zy: 1, zz: 2 })).toBe(
      "Puerta a la derecha · Arriba",
    );
  });

  it("frasePosicion usa la forma corta en un tramo y la larga si se desparrama", () => {
    const plano = { nx: 3, ny: 1, nz: 3 };
    expect(frasePosicion(plano, [{ zx: 0, zy: 0, zz: 2 }])).toBe("Fondo a la derecha");
    expect(
      frasePosicion(plano, [
        { zx: 0, zy: 0, zz: 2 },
        { zx: 1, zy: 0, zz: 2 },
      ]),
    ).toBe("Fondo a Medio · Derecha");
    expect(frasePosicion(plano, [])).toBe("—");
  });
});

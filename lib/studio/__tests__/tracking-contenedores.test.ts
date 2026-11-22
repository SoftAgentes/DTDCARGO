/**
 * SDD-0659 · Reglas del Tracking por contenedor.
 *
 * Lo que estas pruebas cuidan: en qué grupo cae un contenedor, que una
 * estimación nunca se confunda con una posición real, que sin fecha no se
 * invente una, y que el buscador no convierta «%» en «tráeme todo».
 */
import { describe, expect, it } from "vitest";
import {
  DIAS_EN_DESTINO_SIN_ENLACE,
  agruparResultados,
  armarContenedor,
  contarClientes,
  contarPorFiltro,
  diasHasta,
  fechasPorEstado,
  filtroPorDefecto,
  grupoDelContenedor,
  hitosDelContenedor,
  idDeUrl,
  normalizarBusqueda,
  ordenarContenedores,
  patronIlike,
  posicionDelContenedor,
  progresoDelContenedor,
  statusDelContenedor,
  type ContenedorCrudo,
  type ContenedorVista,
  type EnvioDelItem,
  type ItemCrudo,
} from "../tracking-contenedores";

const AHORA = new Date("2026-11-18T12:00:00Z");

function contenedor(over: Partial<ContenedorCrudo> = {}): ContenedorCrudo {
  return {
    id: "c1",
    ref: "DTD-CONSOL-0064",
    container_no: "DTDU6400183",
    container_type: "40HC",
    status: "zarpado",
    updated_at: "2026-11-10T00:00:00Z",
    ...over,
  };
}

function item(id: string, over: Partial<ItemCrudo> = {}): ItemCrudo {
  return {
    id,
    shipment_id: null,
    client_markbox: "DTD-9001",
    client_name: "Cliente de prueba",
    cbm: 2,
    weight_kg: 100,
    pieces: 5,
    ...over,
  };
}

const envios = (lista: EnvioDelItem[]) => new Map(lista.map((e) => [e.id, e]));
const ITINERARIO = {
  vessel: "Buque de prueba",
  pol: "Ningbo",
  pod: "La Guaira",
  etd: "2026-11-08",
  eta: "2026-11-28",
};

describe("grupo del contenedor", () => {
  it("una solicitud sin autorizar o rechazada no es de Tracking", () => {
    expect(grupoDelContenedor("solicitada", [], null, AHORA)).toBeNull();
    expect(grupoDelContenedor("rechazada", [], null, AHORA)).toBeNull();
  });

  it("consolidando y cerrado están en origen; zarpado, en mar", () => {
    expect(grupoDelContenedor("consolidando", [], null, AHORA)).toBe("origen");
    expect(grupoDelContenedor("cerrado", [], null, AHORA)).toBe("origen");
    expect(grupoDelContenedor("zarpado", ["in_transit"], null, AHORA)).toBe("mar");
  });

  it("arribado sigue en destino mientras un envío siga en curso", () => {
    expect(grupoDelContenedor("arribado", ["delivered", "in_customs"], null, AHORA)).toBe("destino");
    expect(grupoDelContenedor("arribado", ["delivered", "cancelled"], null, AHORA)).toBe("entregado");
  });

  it("arribado sin envíos enlazados: en destino por un tiempo, luego entregado", () => {
    const hace = (dias: number) =>
      new Date(AHORA.getTime() - dias * 86_400_000).toISOString();
    expect(grupoDelContenedor("arribado", [null], hace(1), AHORA)).toBe("destino");
    expect(
      grupoDelContenedor("arribado", [], hace(DIAS_EN_DESTINO_SIN_ENLACE + 1), AHORA),
    ).toBe("entregado");
    expect(grupoDelContenedor("arribado", [], null, AHORA)).toBe("entregado");
  });
});

describe("estado que representa al contenedor", () => {
  it("en destino manda el envío más atrasado que sigue en curso", () => {
    expect(
      statusDelContenedor("destino", ["out_for_delivery", "in_customs", "delivered"]),
    ).toBe("in_customs");
    expect(statusDelContenedor("destino", ["delivered", "arrived_destination"])).toBe(
      "arrived_destination",
    );
  });

  it("una alerta no define la etapa; sin datos, queda en aduana", () => {
    expect(statusDelContenedor("destino", ["exception", "out_for_delivery"])).toBe(
      "out_for_delivery",
    );
    expect(statusDelContenedor("destino", [null])).toBe("in_customs");
    expect(statusDelContenedor("mar", ["in_warehouse"])).toBe("in_transit");
    expect(statusDelContenedor("origen", [])).toBe("consolidating");
  });
});

describe("posición", () => {
  it("fuera del mar no hay estimación: puerto de salida o de llegada", () => {
    expect(posicionDelContenedor("origen", ITINERARIO, null, AHORA).avanceDeMar).toBe(0);
    expect(posicionDelContenedor("destino", ITINERARIO, null, AHORA).avanceDeMar).toBe(1);
  });

  it("con rastreo de la naviera usa esa posición y dice de cuándo es", () => {
    const p = posicionDelContenedor(
      "mar",
      ITINERARIO,
      { vessel: null, podEta: null, lastLat: 20, lastLng: -150, fetchedAt: "2026-11-17T08:00:00Z" },
      AHORA,
    );
    expect(p).toMatchObject({ fuente: "naviera", lat: 20, lon: -150, fecha: "2026-11-17T08:00:00Z" });
  });

  it("sin rastreo estima con las fechas del itinerario, y lo dice", () => {
    const p = posicionDelContenedor("mar", ITINERARIO, null, AHORA);
    expect(p.fuente).toBe("itinerario");
    expect(p.lat).toBeNull();
    // 8 nov → 28 nov; al 18 nov a mediodía va un poco más de la mitad.
    expect(p.avanceDeMar).toBeGreaterThan(0.5);
    expect(p.avanceDeMar).toBeLessThan(0.55);
  });

  it("un rastreo sin coordenadas no cuenta como posición real", () => {
    const p = posicionDelContenedor(
      "mar",
      ITINERARIO,
      { vessel: null, podEta: "2026-12-08", lastLat: null, lastLng: null, fetchedAt: "2026-11-17T08:00:00Z" },
      AHORA,
    );
    expect(p.fuente).toBe("itinerario");
    // Pero su ETA sí corrige la del itinerario: 8 nov → 8 dic.
    expect(p.avanceDeMar).toBeGreaterThan(0.3);
    expect(p.avanceDeMar).toBeLessThan(0.4);
  });

  it("zarpado nunca queda pegado a un puerto aunque las fechas estén vencidas", () => {
    const tarde = posicionDelContenedor("mar", { ...ITINERARIO, eta: "2026-11-10" }, null, AHORA);
    expect(tarde.avanceDeMar).toBe(0.97);
    const temprano = posicionDelContenedor("mar", { ...ITINERARIO, etd: "2026-11-25" }, null, AHORA);
    expect(temprano.avanceDeMar).toBe(0.03);
  });

  it("sin fechas queda a mitad de camino y marcado como estimación por estado", () => {
    for (const it of [null, { ...ITINERARIO, etd: null }, { ...ITINERARIO, eta: "2026-11-01" }]) {
      const p = posicionDelContenedor("mar", it, null, AHORA);
      expect(p).toMatchObject({ fuente: "estado", avanceDeMar: 0.5 });
    }
  });
});

describe("días y progreso", () => {
  it("cuenta días calendario hasta la ETA; sin ETA no inventa", () => {
    expect(diasHasta("2026-11-25", AHORA)).toBe(7);
    expect(diasHasta("2026-11-17", AHORA)).toBe(-1);
    expect(diasHasta(null, AHORA)).toBeNull();
    expect(diasHasta("no es fecha", AHORA)).toBeNull();
  });

  it("en mar el progreso avanza con el viaje, entre el zarpe y la aduana", () => {
    const base = { lon: null, lat: null, fecha: null } as const;
    const inicio = progresoDelContenedor("mar", "in_transit", { ...base, avanceDeMar: 0.03, fuente: "itinerario" });
    const fin = progresoDelContenedor("mar", "in_transit", { ...base, avanceDeMar: 0.97, fuente: "itinerario" });
    expect(inicio).toBeGreaterThanOrEqual(35);
    expect(fin).toBeLessThanOrEqual(75);
    expect(fin).toBeGreaterThan(inicio);
    expect(progresoDelContenedor("mar", "in_transit", { ...base, avanceDeMar: 0.5, fuente: "estado" })).toBe(55);
    expect(progresoDelContenedor("origen", "consolidating", { ...base, avanceDeMar: 0, fuente: "estado" })).toBe(20);
  });
});

describe("armar el contenedor", () => {
  it("cuenta clientes distintos, no cargas: un cliente con varias cargas cuenta una vez", () => {
    const items = [
      item("i1", { client_markbox: "DTD-9001" }),
      item("i2", { client_markbox: "DTD-9001" }),
      item("i3", { client_markbox: " DTD-9001 " }),
      item("i4", { client_markbox: "DTD-9002" }),
      item("i5", { client_markbox: null, client_name: "Cliente sin marca" }),
      item("i6", { client_markbox: null, client_name: "  cliente SIN marca " }),
    ];
    expect(contarClientes(items)).toBe(3);
    expect(contarClientes([])).toBe(0);
    const v = armarContenedor(contenedor(), items, envios([]), ITINERARIO, null, AHORA)!;
    expect(v.clientes).toBe(3);
    expect(v.items).toHaveLength(6);
  });

  it("junta clientes, carga, ETA y alertas", () => {
    const v = armarContenedor(
      contenedor(),
      [
        item("i1", { shipment_id: "s1", cbm: 2.5 }),
        item("i2", { shipment_id: "s2", cbm: 1.5, client_markbox: "DTD-9002" }),
        item("i3"),
      ],
      envios([
        { id: "s1", code: "S-2026-0001", status: "in_transit", destination: "Valencia" },
        { id: "s2", code: "S-2026-0002", status: "exception", destination: "Caracas" },
      ]),
      ITINERARIO,
      null,
      AHORA,
    )!;
    expect(v).toMatchObject({
      nombre: "DTD-CONSOL-0064",
      grupo: "mar",
      estadoLabel: "Zarpado",
      statusEnvio: "in_transit",
      clientes: 2,
      usedCbm: 6,
      capCbm: expect.any(Number),
      eta: "2026-11-28",
      etaFuente: "itinerario",
      diasRestantes: 10,
      alertas: 1,
      vessel: "Buque de prueba",
    });
    expect(v.items.map((i) => [i.shipmentCode, i.status, i.destination])).toEqual([
      ["S-2026-0001", "in_transit", "Valencia"],
      ["S-2026-0002", "exception", "Caracas"],
      [null, null, null],
    ]);
  });

  it("la ETA de la naviera manda sobre la del itinerario", () => {
    const v = armarContenedor(
      contenedor(),
      [],
      envios([]),
      ITINERARIO,
      { vessel: "Buque rastreado", podEta: "2026-11-30", lastLat: null, lastLng: null, fetchedAt: "2026-11-17T00:00:00Z" },
      AHORA,
    )!;
    expect(v).toMatchObject({ eta: "2026-11-30", etaFuente: "naviera", vessel: "Buque rastreado" });
  });

  it("sin itinerario no hay ETA ni días; tipo desconocido no tiene capacidad", () => {
    const v = armarContenedor(
      contenedor({ ref: null, container_type: "raro" }),
      [],
      envios([]),
      null,
      null,
      AHORA,
    )!;
    expect(v).toMatchObject({
      nombre: "DTDU6400183",
      eta: null,
      etaFuente: null,
      diasRestantes: null,
      capCbm: null,
    });
    expect(armarContenedor(contenedor({ ref: null, container_no: null }), [], envios([]), null, null, AHORA)!.nombre)
      .toBe("Contenedor sin referencia");
  });

  it("una solicitud no se arma", () => {
    expect(armarContenedor(contenedor({ status: "solicitada" }), [], envios([]), null, null, AHORA)).toBeNull();
  });
});

describe("lista y filtros", () => {
  const vista = (id: string, grupo: ContenedorVista["grupo"], eta: string | null) =>
    ({ id, nombre: id, grupo, eta }) as ContenedorVista;

  it("ordena por llegada más próxima y deja sin fecha al final", () => {
    const orden = ordenarContenedores([
      vista("b", "mar", "2026-12-05"),
      vista("z", "mar", null),
      vista("a", "mar", "2026-11-25"),
      vista("c", "mar", null),
    ]).map((v) => v.id);
    expect(orden).toEqual(["a", "b", "c", "z"]);
  });

  it("cuenta por filtro y abre el primero que tenga algo", () => {
    const conteos = contarPorFiltro(
      [vista("a", "origen", null), vista("b", "destino", null), vista("c", "entregado", null)],
      4,
    );
    expect(conteos).toEqual({ mar: 0, origen: 1, destino: 1, sin: 4 });
    expect(filtroPorDefecto(conteos)).toBe("origen");
    expect(filtroPorDefecto({ mar: 2, origen: 1, destino: 0, sin: 0 })).toBe("mar");
    expect(filtroPorDefecto({ mar: 0, origen: 0, destino: 0, sin: 3 })).toBe("sin");
    expect(filtroPorDefecto({ mar: 0, origen: 0, destino: 0, sin: 0 })).toBe("mar");
  });
});

describe("hitos", () => {
  it("los cumplidos llevan la fecha real; del plan solo salen zarpe y llegada", () => {
    const hitos = hitosDelContenedor(
      { statusEnvio: "in_transit", etd: "2026-11-08", eta: "2026-11-28" },
      fechasPorEstado([
        { status: "shipped", occurred_at: "2026-11-09T10:00:00Z" },
        { status: "shipped", occurred_at: "2026-11-09T08:00:00Z" },
        { status: "in_transit", occurred_at: "2026-11-09T12:00:00Z" },
      ]),
    );
    const de = (s: string) => hitos.find((h) => h.status === s)!;
    expect(de("shipped")).toMatchObject({ state: "done", fecha: "2026-11-09T08:00:00Z", planificada: false });
    expect(de("in_transit")).toMatchObject({ state: "active", planificada: false });
    expect(de("in_customs")).toMatchObject({ state: "pending", fecha: "2026-11-28", planificada: true });
    // Cumplido sin evento registrado: sin fecha, y nunca la del plan.
    expect(de("consolidating")).toMatchObject({ state: "done", fecha: null, planificada: false });
    // Pendiente sin plan: sin fecha.
    expect(de("delivered")).toMatchObject({ state: "pending", fecha: null, planificada: false });
  });

  it("en origen el zarpe pendiente muestra la ETD como plan", () => {
    const hitos = hitosDelContenedor(
      { statusEnvio: "consolidating", etd: "2026-11-22", eta: null },
      new Map(),
    );
    expect(hitos.find((h) => h.status === "shipped")).toMatchObject({
      state: "pending",
      fecha: "2026-11-22",
      planificada: true,
    });
    expect(hitos.find((h) => h.status === "in_customs")).toMatchObject({ fecha: null, planificada: false });
  });
});

describe("ids de la URL", () => {
  it("solo pasa lo que tiene forma de UUID", () => {
    expect(idDeUrl("3F2504E0-4F89-41D3-9A0C-0305E82C3301")).toBe(
      "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    );
    for (const raro of ["", "c64", "1 or 1=1", "3f2504e0-4f89-41d3-9a0c-0305e82c330", undefined, null, ["a"], 7]) {
      expect(idDeUrl(raro), String(raro)).toBeNull();
    }
  });
});

describe("búsqueda", () => {
  it("no busca con menos de dos caracteres ni con algo que no es texto", () => {
    expect(normalizarBusqueda(" a ")).toBeNull();
    expect(normalizarBusqueda(undefined)).toBeNull();
    expect(normalizarBusqueda(["ab"])).toBeNull();
    expect(normalizarBusqueda("  DTD   9042 ")).toBe("DTD 9042");
    expect(normalizarBusqueda("x".repeat(200))).toHaveLength(80);
  });

  it("los comodines se buscan como texto: «%» no trae la tabla entera", () => {
    expect(patronIlike("rojas")).toBe("%rojas%");
    expect(patronIlike("50%")).toBe("%50\\%%");
    expect(patronIlike("a_b")).toBe("%a\\_b%");
    expect(patronIlike("a*b")).toBe("%ab%");
    expect(patronIlike("a\\b")).toBe("%a\\\\b%");
  });

  it("agrupa por cliente y lista cada carga con su contenedor", () => {
    const fila = (itemId: string, markbox: string | null, name: string | null, cont: string) => ({
      itemId,
      client_markbox: markbox,
      client_name: name,
      contenedorId: cont,
      contenedorNombre: cont.toUpperCase(),
      estadoLabel: "En tránsito",
      shipmentId: null,
      pieces: 1,
      cbm: 1,
    });
    const grupos = agruparResultados([
      fila("i1", "DTD-9042", null, "c64"),
      fila("i2", "DTD-9042", "Cliente A", "c65"),
      fila("i2", "DTD-9042", "Cliente A", "c65"),
      fila("i3", null, "Cliente B", "c64"),
      fila("i4", null, null, "c64"),
    ]);
    expect(grupos.map((g) => [g.clave, g.client_name, g.cargas.map((c) => c.contenedorId)])).toEqual([
      ["DTD-9042", "Cliente A", ["c64", "c65"]],
      ["Cliente B", "Cliente B", ["c64"]],
      ["item:i4", null, ["c64"]],
    ]);
  });
});

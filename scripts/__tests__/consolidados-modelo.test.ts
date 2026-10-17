/**
 * SDD-0543 · El modelo del lote: marcas, agrupación, fechas, líneas de factura.
 * Fixtures inventados: marcas, nombres y descripciones que no existen.
 */
import { describe, expect, it } from "vitest";
import {
  agruparLote,
  baseDeLineas,
  interpretarMarca,
  interpretarMarcaDueno,
  litSql,
  normalizarCodigo,
  restarDias,
  round2,
  type FilaPacking,
  type Rastreo,
} from "../consolidados/modelo";

const RASTREO: Rastreo = {
  numero: 59,
  etiqueta: "DTD#59",
  modalidad: "DDP",
  puertoCarga: "YIWU",
  fechaCarga: "2026-08-11",
  contenedor: "ABCU1234567",
  precinto: null,
  naviera: "CMA CGM",
  puertoLlegada: "la guaira",
  etaExcel: "2026-10-15",
  link: null,
  filaExcel: 39,
};

function fila(p: Partial<FilaPacking> & { filaExcel: number; marcaTexto: string; remitente: string }): FilaPacking {
  return {
    descripcion: "Producto de prueba",
    cajas: 1,
    pesoKg: 10,
    cbmChina: 0.1,
    cbmFactura: 0.1,
    extraKg: -40,
    precioKgExtra: 1,
    valorKgExtra: -40,
    precioCbm: 800,
    totalFacturado: 80,
    agente: "(DTD-X) Agente Prueba",
    ...p,
  };
}

describe("normalizarCodigo y fechas", () => {
  it("quita espacios y controla mayúsculas", () => {
    expect(normalizarCodigo(" dtd-j031 -05 ")).toBe("DTD-J031-05");
    expect(normalizarCodigo(null)).toBe("");
  });
  it("resta días sin depender de la zona horaria, incluso al cambiar de mes", () => {
    expect(restarDias("2026-08-11", 1)).toBe("2026-08-10");
    expect(restarDias("2026-08-01", 1)).toBe("2026-07-31");
    expect(restarDias("2026-03-01", 1)).toBe("2026-02-28");
    expect(() => restarDias("11/08/2026", 1)).toThrow(/inválida/);
  });
  it("round2 evita el sesgo binario", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(907.2)).toBe(907.2);
  });
});

describe("interpretarMarca", () => {
  it("marca de la casa con letra del legado y nombre al lado", () => {
    const m = interpretarMarca("DTD-J031 PRUEBA PLÁSTICOS", "DTD-J031-05");
    expect(m).toMatchObject({ clave: "DTD-J031", prefijo: "DTD", numero: "J031", esCasa: true, nombreExcel: "PRUEBA PLÁSTICOS" });
    expect(m.candidatos).toEqual(["DTD-J031"]);
  });
  it("marca con el remitente repetido en el texto («DTD-S001-06 NOMBRE»)", () => {
    const m = interpretarMarca("DTD-S001-06 NOMBRE PRUEBA", "DTD-S001-06");
    expect(m.clave).toBe("DTD-S001");
    expect(m.nombreExcel).toBe("NOMBRE PRUEBA");
  });
  it("marca numérica de la casa", () => {
    const m = interpretarMarca("DTD-9038 ALGUIEN", "DTD-9038-02");
    expect(m.candidatos).toEqual(["DTD-9038"]);
  });
  it("aliado: el texto es el nombre del aliado y los candidatos llevan padding", () => {
    const m = interpretarMarca("ALIADO PRUEBA MM", "MM-41");
    expect(m).toMatchObject({ clave: "MM-0041", prefijo: "MM", numero: "41", esCasa: false, nombreExcel: "ALIADO PRUEBA MM" });
    expect(m.candidatos).toEqual(["MM-0041", "MM-41", "MM-041"]);
    const tres = interpretarMarca("ALIADO PRUEBA DC", "DC-014-21");
    expect(tres.clave).toBe("DC-0014");
    expect(tres.candidatos).toEqual(["DC-0014", "DC-014"]);
  });
  it("aliado con cliente no numérico («DC-01-ALESS-16») conserva el texto", () => {
    const m = interpretarMarca("ALIADO PRUEBA DC", "DC-01-Aless-16");
    expect(m.clave).toBe("DC-01-ALESS");
    expect(m.candidatos).toEqual(["DC-01-ALESS"]);
  });
  it("rechaza remitentes sin forma", () => {
    expect(() => interpretarMarca("X", "SINGUION")).toThrow(/PREFIJO-cliente/);
    expect(() => interpretarMarca("X", "123-45")).toThrow(/PREFIJO-cliente/);
  });
});

describe("agruparLote", () => {
  const filas: FilaPacking[] = [
    fila({ filaExcel: 4, marcaTexto: "DTD-A116 CLIENTE UNO", remitente: "DTD-A116-06", descripcion: "Alternador", cajas: 10, pesoKg: 141, cbmChina: 0.5, cbmFactura: 0.5, precioCbm: 750, totalFacturado: 375 }),
    fila({ filaExcel: 5, marcaTexto: "DTD-A116 CLIENTE UNO", remitente: "DTD-A116-06", descripcion: "Regulador", cajas: 1, pesoKg: 141, cbmChina: 0.0125, cbmFactura: 0.0125, extraKg: 134.75, precioKgExtra: 0.8, valorKgExtra: 107.8, precioCbm: 750, totalFacturado: 9.375 }),
    fila({ filaExcel: 6, marcaTexto: "DTD-A116 CLIENTE UNO", remitente: "DTD-A116-08", descripcion: "Filtro", cajas: 1, pesoKg: 13.6, cbmChina: 0.021, cbmFactura: 0.021, precioCbm: 750, totalFacturado: 15.75 }),
    fila({ filaExcel: 7, marcaTexto: "DTD-J031 CLIENTE DOS", remitente: "DTD-J031-05", descripcion: "Máquina", cajas: 1, pesoKg: 137, cbmChina: 1.134, cbmFactura: 1.134, precioCbm: 800, totalFacturado: 907.2 }),
    fila({ filaExcel: 8, marcaTexto: "ALIADO PRUEBA MM", remitente: "MM-41", descripcion: "Cajas", cajas: 8, pesoKg: 0, cbmChina: 0.96, cbmFactura: 0.96, precioCbm: 630, totalFacturado: 604.8 }),
    fila({ filaExcel: 9, marcaTexto: "ALIADO PRUEBA MM", remitente: "", descripcion: "", cajas: 21, pesoKg: 432.6, cbmChina: 2.6275, cbmFactura: 2.6275, precioCbm: 0, totalFacturado: 0 }),
  ];

  it("agrupa por remitente y por cliente, en el orden del Excel", () => {
    const lote = agruparLote(RASTREO, filas, { eta: "2026-10-19" });
    expect(lote.fechaCarga).toBe("2026-08-11");
    expect(lote.fechaRecepcion).toBe("2026-08-10");
    expect(lote.etd).toBe("2026-08-11");
    expect(lote.embarques.map((e) => e.remitente)).toEqual(["DTD-A116-06", "DTD-A116-08", "DTD-J031-05", "MM-41"]);
    expect(lote.clientes.map((c) => c.clave)).toEqual(["DTD-A116", "DTD-J031", "MM-0041"]);
    expect(lote.embarques[0]).toMatchObject({ cajas: 11, pesoKg: 282, cbmFactura: 0.513, orden: 1 });
    expect(lote.totales).toMatchObject({ filas: 5, embarques: 4, clientes: 3, cajas: 21, cbmFactura: 2.628, pesoKg: 432.6 });
    expect(lote.avisos.some((a) => a.includes("Fila 9 sin Remitente"))).toBe(true);
  });

  it("una factura por cliente: una línea por embarque y precio, más el exceso de peso", () => {
    const lote = agruparLote(RASTREO, filas, { eta: "2026-10-19" });
    const uno = lote.clientes[0];
    expect(uno.lineas).toEqual([
      { desc: "Flete DDP · DTD-A116-06 · 0.5125 m³ × $750", qty: 0.5125, unitPrice: 750, remitente: "DTD-A116-06" },
      { desc: "Exceso de peso · DTD-A116-06 · Regulador · 134.75 kg × $0.8", qty: 134.75, unitPrice: 0.8, remitente: "DTD-A116-06" },
      { desc: "Flete DDP · DTD-A116-08 · 0.021 m³ × $750", qty: 0.021, unitPrice: 750, remitente: "DTD-A116-08" },
    ]);
    expect(uno.base).toBe(507.93);
    expect(uno.excesoPeso).toBe(107.8);
    expect(lote.clientes[1].base).toBe(907.2);
    expect(lote.clientes[2].base).toBe(604.8);
    expect(lote.totales.base).toBe(round2(uno.base + 907.2 + 604.8));
    expect(lote.totales.totalFacturadoExcel).toBe(round2(375 + 9.375 + 15.75 + 907.2 + 604.8));
    expect(lote.totales.excesoPeso).toBe(107.8);
    expect(lote.avisos.some((a) => a.includes("Excesos de peso: $107.80"))).toBe(true);
    expect(lote.avisos.some((a) => a.includes("no coincide"))).toBe(false);
  });

  it("con excesoPeso apagado la línea no sale y la base baja", () => {
    const lote = agruparLote(RASTREO, filas, { eta: "2026-10-19", excesoPeso: false });
    expect(lote.clientes[0].lineas).toHaveLength(2);
    // 384.375 + 15.75 = 400.125 → 400.13 (mitad hacia arriba, como round(numeric, 2)).
    expect(lote.clientes[0].base).toBe(400.13);
    expect(lote.clientes[0].excesoPeso).toBe(107.8);
    expect(lote.avisos.some((a) => a.includes("NO se facturan"))).toBe(true);
  });

  it("une MM-41 y MM-041 en el mismo cliente y corrige remitentes con barra", () => {
    const dos = [
      fila({ filaExcel: 4, marcaTexto: "ALIADO PRUEBA MM", remitente: "MM-41", cajas: 1 }),
      fila({ filaExcel: 5, marcaTexto: "ALIADO PRUEBA MM", remitente: "MM-041", cajas: 2 }),
      fila({ filaExcel: 6, marcaTexto: "DTD-S011 TRES", remitente: "DTD-S011/21", cajas: 3 }),
    ];
    const lote = agruparLote(RASTREO, dos, { eta: "2026-10-19" });
    expect(lote.clientes.map((c) => c.clave)).toEqual(["MM-0041", "DTD-S011"]);
    expect(lote.clientes[0].embarques.map((e) => e.remitente)).toEqual(["MM-41", "MM-041"]);
    expect(lote.embarques[2].remitente).toBe("DTD-S011-21");
    expect(lote.avisos.some((a) => a.includes("se corrige a «DTD-S011-21»"))).toBe(true);
    expect(lote.avisos.filter((a) => a.includes("no trae número de embarque"))).toHaveLength(2);
  });

  it("compara con la fila de totales del Excel cuando no cuadra", () => {
    const conTotal = [
      fila({ filaExcel: 4, marcaTexto: "DTD-A116 UNO", remitente: "DTD-A116-06", cajas: 10, pesoKg: 100, cbmFactura: 1 }),
      fila({ filaExcel: 5, marcaTexto: "TOTAL", remitente: "", cajas: 9, pesoKg: 100, cbmFactura: 1 }),
    ];
    const lote = agruparLote(RASTREO, conTotal, { eta: "2026-10-19" });
    expect(lote.avisos.some((a) => a.includes("fila 5) dice 9 cajas") && a.includes("diferencia 1 cajas"))).toBe(true);
  });

  it("el mapa manual pone la marca decidida por Sam primero entre los candidatos", () => {
    const lote = agruparLote(RASTREO, filas, { eta: "2026-10-19", mapa: { "mm-41": "dc-mm-0041" } });
    expect(lote.clientes[2].marca.candidatos).toEqual(["DC-MM-0041", "MM-0041", "MM-41", "MM-041"]);
    const porClave = agruparLote(RASTREO, filas, { eta: "2026-10-19", mapa: { "MM-0041": "DTD-8001" } });
    expect(porClave.clientes[2].marca.candidatos[0]).toBe("DTD-8001");
  });

  it("avisa cuando un embarque mezcla precios o va a $0", () => {
    const mixto = [
      fila({ filaExcel: 4, marcaTexto: "DTD-A116 UNO", remitente: "DTD-A116-06", cbmFactura: 0.5, precioCbm: 750, totalFacturado: 375 }),
      fila({ filaExcel: 5, marcaTexto: "DTD-A116 UNO", remitente: "DTD-A116-06", cbmFactura: 0.2, precioCbm: 0, totalFacturado: 0 }),
    ];
    const lote = agruparLote(RASTREO, mixto, { eta: "2026-10-19" });
    expect(lote.clientes[0].lineas.map((l) => l.unitPrice)).toEqual([750, 0]);
    expect(lote.avisos.some((a) => a.includes("mezcla precios"))).toBe(true);
    expect(lote.avisos.some((a) => a.includes("a $0"))).toBe(true);
  });

  it("rechaza fechas inconsistentes y un remitente con dos marcas", () => {
    expect(() => agruparLote({ ...RASTREO, fechaCarga: null }, filas, { eta: "2026-10-19" })).toThrow(/fecha de carga/);
    expect(() => agruparLote(RASTREO, filas, { eta: "2026-08-01" })).toThrow(/anterior al zarpe/);
    expect(() => agruparLote(RASTREO, filas, { eta: "19/10/2026" })).toThrow(/ETA inválida/);
    const dosMarcas = [
      fila({ filaExcel: 4, marcaTexto: "DTD-A116 UNO", remitente: "DTD-A116-06" }),
      fila({ filaExcel: 5, marcaTexto: "DTD-B200 DOS", remitente: "DTD-A116-06" }),
    ];
    // La marca sale del remitente: el texto distinto no cambia la clave.
    expect(agruparLote(RASTREO, dosMarcas, { eta: "2026-10-19" }).clientes).toHaveLength(1);
    expect(() => agruparLote(RASTREO, [], { eta: "2026-10-19" })).toThrow(/no trae filas/);
  });

  it("la fecha de carga manual manda sobre la del Excel", () => {
    const lote = agruparLote({ ...RASTREO, fechaCarga: null }, filas, { eta: "2026-10-19", fechaCarga: "2026-09-01", etd: "2026-09-03" });
    expect(lote.fechaRecepcion).toBe("2026-08-31");
    expect(lote.etd).toBe("2026-09-03");
  });
});

describe("modalidades fcl y mixto", () => {
  it("interpreta la marca del dueño: insignia pelada o marca normal", () => {
    expect(interpretarMarcaDueno("hr")).toMatchObject({ clave: "HR", prefijo: "HR", numero: "", esCasa: false, candidatos: ["HR"], nombreExcel: "Aliado HR" });
    expect(interpretarMarcaDueno("MG-019")).toMatchObject({ clave: "MG-0019", prefijo: "MG", numero: "019", candidatos: ["MG-0019", "MG-019"], nombreExcel: "Dueño del contenedor MG-019" });
    expect(interpretarMarcaDueno("DTD-9038")).toMatchObject({ clave: "DTD-9038", esCasa: true, candidatos: ["DTD-9038"] });
    expect(() => interpretarMarcaDueno("DTD")).toThrow(/La casa/);
    expect(() => interpretarMarcaDueno("MG019")).toThrow(/sin forma/);
  });
  it("fcl ignora el packing list y exige dueño; mixto exige dueño distinto de los clientes DDP", () => {
    const filas: FilaPacking[] = [
      fila({ filaExcel: 4, marcaTexto: "DTD-A116 UNO", remitente: "DTD-A116-06", cajas: 10, cbmFactura: 0.5, precioCbm: 750, totalFacturado: 375 }),
      fila({ filaExcel: 5, marcaTexto: "DTD-J031 DOS", remitente: "DTD-J031-05", cbmFactura: 1.134, precioCbm: 800, totalFacturado: 907.2 }),
      fila({ filaExcel: 6, marcaTexto: "ALIADO PRUEBA MM", remitente: "MM-41", cajas: 8, cbmFactura: 0.96, precioCbm: 630, totalFacturado: 604.8 }),
      fila({ filaExcel: 7, marcaTexto: "DTD-A116 UNO", remitente: "DTD-A116-08", cbmFactura: 0.021, precioCbm: 750, totalFacturado: 15.75 }),
      fila({ filaExcel: 8, marcaTexto: "DTD-J031 DOS", remitente: "DTD-J031-06", cbmFactura: 0.2, precioCbm: 800, totalFacturado: 160 }),
      fila({ filaExcel: 9, marcaTexto: "ALIADO PRUEBA MM", remitente: "MM-42", cajas: 2, cbmFactura: 0.1, precioCbm: 630, totalFacturado: 63 }),
    ];
    const l = agruparLote(RASTREO, filas, { eta: "2026-10-19", modalidad: "fcl", dueno: "MG-019" });
    expect(l.embarques).toHaveLength(0);
    expect(l.clientes).toHaveLength(0);
    expect(l.totales.cajas).toBe(0);
    expect(l.dueno?.codigo).toBe("MG-019-FCL-59");
    expect(l.avisos.some((a) => a.includes("se ignoran las 6 filas"))).toBe(true);
    expect(l.avisos.some((a) => a.includes("sin m³"))).toBe(true);
    expect(() => agruparLote(RASTREO, filas, { eta: "2026-10-19", modalidad: "fcl" })).toThrow(/exige la marca del dueño/);
    expect(() => agruparLote(RASTREO, filas, { eta: "2026-10-19", dueno: "HR" })).toThrow(/sólo aplica/);
    expect(() => agruparLote(RASTREO, filas, { eta: "2026-10-19", modalidad: "mixto", dueno: "DTD-A116" })).toThrow(/también aparece como cliente DDP/);
    expect(() => agruparLote(RASTREO, filas, { eta: "2026-10-19", gastoEspacio: { monto: 10, usuarioEmail: "a@b.test" } })).toThrow(/sólo aplica a la modalidad mixto/);
    expect(() => agruparLote(RASTREO, filas, { eta: "2026-10-19", modalidad: "mixto", dueno: "HR", gastoEspacio: { monto: 0, usuarioEmail: "a@b.test" } })).toThrow(/mayor que 0/);
    const m = agruparLote(RASTREO, filas, { eta: "2026-10-19", modalidad: "mixto", dueno: "HR", cbmFcl: 61.3, kgFcl: 18000 });
    expect(m.clientes.map((c) => c.clave)).toEqual(["DTD-A116", "DTD-J031", "MM-0041", "MM-0042"]);
    expect(m.dueno).toMatchObject({ codigo: "HR-FCL-59", cbm: 61.3, kg: 18000, servicio: "fcl_directo" });
  });
});

describe("baseDeLineas", () => {
  it("redondea como round(numeric, 2) de Postgres: 507.925 → 507.93", () => {
    expect(baseDeLineas([{ desc: "", qty: 0.5125, unitPrice: 750 }, { desc: "", qty: 134.75, unitPrice: 0.8 }, { desc: "", qty: 0.021, unitPrice: 750 }])).toBe(507.93);
    expect(baseDeLineas([{ desc: "", qty: 1.134, unitPrice: 800 }])).toBe(907.2);
    expect(baseDeLineas([{ desc: "", qty: 0.0125, unitPrice: 750 }])).toBe(9.38);
    expect(baseDeLineas([])).toBe(0);
    expect(baseDeLineas([{ desc: "", qty: 1, unitPrice: -0.005 }])).toBe(-0.01);
  });
});

describe("litSql", () => {
  it("dobla comillas, quita controles y respeta null", () => {
    expect(litSql("O'Higgins\u0000 x")).toBe("'O''Higgins x'");
    expect(litSql(null)).toBe("null");
    expect(litSql("")).toBe("''");
  });
});

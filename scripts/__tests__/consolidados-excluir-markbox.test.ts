/**
 * SDD-0690 · `--excluir-markbox`: dejar fuera del paquete `--solo-facturas` los envíos de uno o
 * varios Shipping Marks (el caso del 64: los que siguen en el comodín DTD-0000 se cargan aparte,
 * después de reasignarlos). Datos inventados; DTD-0000 es el comodín del sistema.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { agruparLote, markboxDelCliente, normalizarExclusiones, type FilaPacking, type Rastreo } from "../consolidados/modelo";
import { generarSql, idDelPaquete, type OpcionesSql } from "../consolidados/lote-sql";
import { manifiestoDelPaquete, parsearArgumentos, resumenMarkdown } from "../consolidados/generar-lote";

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
  etaExcel: null,
  link: null,
  filaExcel: 39,
};

const fila = (filaExcel: number, marcaTexto: string, remitente: string, cbm: number, precio: number): FilaPacking => ({
  filaExcel, marcaTexto, remitente, descripcion: "Cajas", cajas: 2, pesoKg: 10, cbmChina: cbm, cbmFactura: cbm,
  extraKg: -100, precioKgExtra: 1, valorKgExtra: -100, precioCbm: precio, totalFacturado: cbm * precio, agente: "X",
});

// Tres claves: DTD-5001 (dos envíos), el comodín DTD-0000 (dos envíos) y DTD-5002 (uno).
const FILAS: FilaPacking[] = [
  fila(4, "DTD-5001 PRUEBA", "DTD-5001-01", 1, 800),
  fila(5, "DTD-0000 COMODIN", "DTD-0000-01", 2, 800),
  fila(6, "DTD-5001 PRUEBA", "DTD-5001-02", 0.5, 800),
  fila(7, "DTD-0000 COMODIN", "DTD-0000-02", 3, 750),
  fila(8, "DTD-5002 PRUEBA", "DTD-5002-01", 0.25, 750),
];

const SOLO: OpcionesSql = {
  entorno: "produccion",
  crearClientesFaltantes: false,
  facturas: true,
  pol: "NGB",
  polNombre: "Ningbo",
  containerType: "40HC",
  vessel: "Por confirmar",
  lote: "carga-consolidado:59:deadbeef",
  tenantSlug: "dtd",
  soloFacturas: true,
};
const FUENTES = { rastreo: "a".repeat(64), packing: "b".repeat(64) };

const lote = () => agruparLote(RASTREO, FILAS, { eta: "2026-10-19", excesoPeso: false });
/** El lote con `--excluir-markbox`: la exclusión entra por agruparLote. */
const excluir = (markbox: string[], mapa: Record<string, string> = {}, filas: FilaPacking[] = FILAS, excesoPeso = false) =>
  agruparLote(RASTREO, filas, { eta: "2026-10-19", excesoPeso, mapa, excluirMarkbox: markbox });

// generadoEn sale de new Date(): fijo, para comparar byte a byte.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-21T12:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("agruparLote con excluirMarkbox", () => {
  it("saca los clientes del markbox con sus envíos, filas y líneas, y recalcula los totales", () => {
    const completo = lote();
    const l = excluir(["dtd-0000"]);
    expect(l.clientes.map((c) => c.clave)).toEqual(["DTD-5001", "DTD-5002"]);
    expect(l.embarques.map((e) => e.remitente)).toEqual(["DTD-5001-01", "DTD-5001-02", "DTD-5002-01"]);
    expect(l.filas.map((f) => f.remitente)).not.toContain("DTD-0000-01");
    expect(l.clientes.flatMap((c) => c.lineas.map((x) => x.remitente))).not.toContain("DTD-0000-02");
    expect(l.totales).toMatchObject({ filas: 3, embarques: 3, clientes: 2, cajas: 6, cbmFactura: 1.75, base: 1387.5 });
    expect(l.totales.base).toBe(completo.totales.base - 2 * 800 - 3 * 750);
    expect(l.excluidos).toEqual({ markbox: ["DTD-0000"], clientes: 1, envios: 2, filas: 2, remitentes: ["DTD-0000-01", "DTD-0000-02"] });
    expect(l.avisos.at(-1)).toMatch(/^Excluidos por markbox \(DTD-0000\): 2 envíos de 1 claves del Excel \(2 filas\)/);
    expect(l.avisos.at(-1)).not.toMatch(/\$/);
    expect(completo.embarques).toHaveLength(5);
  });

  it("usa el Shipping Mark que decidió el mapa, no sólo la clave", () => {
    const mapa = { "DTD-5002": "DTD-0000" };
    const l = agruparLote(RASTREO, FILAS, { eta: "2026-10-19", mapa, excesoPeso: false });
    expect(markboxDelCliente(l.clientes.find((c) => c.clave === "DTD-5002")!, mapa)).toBe("DTD-0000");
    const fuera = excluir(["DTD-0000"], mapa);
    expect(fuera.clientes.map((c) => c.clave)).toEqual(["DTD-5001"]);
    expect(fuera.excluidos).toMatchObject({ clientes: 2, envios: 3 });
  });

  it("varios markbox, en cualquier orden y con repetidos, dan la misma lista", () => {
    expect(normalizarExclusiones(["dtd-5002", "DTD-0000", " DTD-0000 "])).toEqual(["DTD-0000", "DTD-5002"]);
    const l = excluir(["DTD-5002", "DTD-0000"]);
    expect(l.clientes.map((c) => c.clave)).toEqual(["DTD-5001"]);
    expect(l.excluidos?.markbox).toEqual(["DTD-0000", "DTD-5002"]);
  });

  it("un markbox sin clientes en el lote, un texto que no es código o dejar el lote vacío fallan", () => {
    expect(() => excluir(["DTD-9999"])).toThrow(/ningún cliente del lote tiene el Shipping Mark DTD-9999/);
    expect(() => excluir(["Cliente Uno"])).toThrow(/no es un Shipping Mark/);
    expect(() => excluir(["DTD-0000", "DTD-5001", "DTD-5002"])).toThrow(/sin clientes/);
  });

  it("con la lista vacía el lote es el mismo", () => {
    expect(JSON.stringify(excluir([]))).toBe(JSON.stringify(lote()));
    expect(excluir([])).not.toHaveProperty("excluidos");
  });

  it("los avisos usan las cifras filtradas; la fila de totales del Excel se compara con el contenedor completo", () => {
    // El excluido trae exceso de peso ($40) y el incluido DTD-5001-01 trae $20; la fila de totales cuadra con el contenedor completo.
    const filas: FilaPacking[] = FILAS.map((f) =>
      f.remitente === "DTD-0000-01" ? { ...f, extraKg: 40, valorKgExtra: 40 } : f.remitente === "DTD-5001-01" ? { ...f, extraKg: 20, valorKgExtra: 20 } : f,
    );
    const totalesExcel: FilaPacking = { ...fila(20, "", "", 6.75, 0), cajas: 10, pesoKg: 50, totalFacturado: 0 };
    const conTotales = [...filas, totalesExcel];
    const l = excluir(["DTD-0000"], {}, conTotales, true);
    expect(l.avisos.find((a) => a.startsWith("Excesos de peso"))).toBe(
      "Excesos de peso: $20.00 en líneas aparte (el «TOTAL FACTURADO» del Excel no los incluye). Para no cobrarlos, generar con --sin-exceso-peso.",
    );
    expect(l.avisos.some((a) => a.startsWith("La base de flete calculada no coincide"))).toBe(false);
    expect(l.avisos.some((a) => a.startsWith("La fila de totales del Excel"))).toBe(false);
    // Sin exclusión, el mismo Excel da los $60 del contenedor completo y la fila de totales también cuadra.
    const completo = agruparLote(RASTREO, conTotales, { eta: "2026-10-19" });
    expect(completo.avisos.find((a) => a.startsWith("Excesos de peso"))).toMatch(/^Excesos de peso: \$60\.00 /);
    expect(completo.avisos.some((a) => a.startsWith("La fila de totales del Excel"))).toBe(false);
    // Si la fila de totales no cuadra, el aviso dice que compara el contenedor completo.
    const malos = excluir(["DTD-0000"], {}, [...filas, { ...totalesExcel, cajas: 12 }], true);
    expect(malos.avisos.find((a) => a.startsWith("La fila de totales del Excel"))).toContain(
      "el contenedor completo (con los excluidos por markbox) suma 10 cajas",
    );
    // Los avisos de las filas excluidas no salen (el Remitente corregido de una fila excluida, p. ej.).
    const corregida = excluir(["DTD-0000"], {}, FILAS.map((f) => (f.remitente === "DTD-0000-02" ? { ...f, remitente: "dtd-0000-02 " } : f)));
    expect(corregida.avisos.slice(0, -1).join(" | ")).not.toContain("DTD-0000");
    expect(corregida.avisos.at(-1)).toMatch(/^Excluidos por markbox/);
  });
});

describe("generarSql con --excluir-markbox", () => {
  const conExclusion = () => generarSql(excluir(["DTD-0000"]), { ...SOLO, excluirMarkbox: ["DTD-0000"] }, FUENTES);

  it("los envíos excluidos no viajan: ni envío, ni fila, ni línea, ni pre-orden esperada", () => {
    const s = conExclusion();
    // Sólo aparecen en la guarda de los excluidos reasignados, nunca en las tablas del lote.
    for (const script of [s.aplicar, s.simulacro]) {
      for (const linea of script.split(/\r?\n/).filter((x) => x.startsWith("insert into lote_"))) expect(linea).not.toContain("DTD-0000-0");
      expect(script.split("'DTD-0000-01'")).toHaveLength(2);
    }
    expect(s.verificar).not.toContain("DTD-0000-0");
    expect(s.aplicar).toMatch(/insert into lote_envios values \(\d+, 'DTD-5001-01'/);
    expect(s.manifiesto.esperado).toMatchObject({ envios: 3, recepciones: 3, clientes: 2, facturas: 2, base: 1387.5 });
  });

  it("el manifiesto, la cabecera y la previa dicen cuántos quedaron fuera, sólo con conteos", () => {
    const s = conExclusion();
    expect(s.manifiesto.excluidos).toMatchObject({ markbox: ["DTD-0000"], clientes: 1, envios: 2, filas: 2 });
    expect(s.manifiesto.excluidos?.motivo).toMatch(/--excluir-markbox/);
    expect(manifiestoDelPaquete(s.manifiesto).excluidos).toEqual(s.manifiesto.excluidos);
    expect(s.manifiesto.excluidos).not.toHaveProperty("remitentes");
    expect(JSON.stringify(manifiestoDelPaquete(s.manifiesto))).not.toContain("DTD-0000-0");
    expect(JSON.stringify(s.manifiesto.excluidos)).not.toMatch(/\$|base|monto/);
    expect(s.aplicar).toContain("excluidos por markbox: 2 envíos");
    expect(s.previa).toContain("\\echo === excluidos por markbox: 2");
    expect(s.previa).toContain("2 as excluidos_por_markbox");
    expect(s.previa).toContain("as excluidos_en_otro_markbox,");
    expect(s.previa).toContain("as incluidos_en_markbox_excluido,");
    expect(s.previa.match(/^begin transaction read only;$/gm)).toHaveLength(1);
    expect(s.previa.trimEnd().endsWith("rollback;")).toBe(true);
  });

  it("aplicar aborta si un envío que entra está hoy en un markbox excluido, y el aviso nombra el paquete nuevo", () => {
    const s = conExclusion();
    const id = idDelPaquete({ ...SOLO, excluirMarkbox: ["DTD-0000"] });
    expect(s.aplicar).toContain("select count(*) into v_n_mb from lote_cargados where markbox = any(array['DTD-0000']::text[]);");
    expect(s.aplicar).toContain("están hoy en un Shipping Mark excluido");
    expect(s.aplicar).toContain(`'${id}', cab.contenedor, v_n_marcas`);
    expect(s.aplicar).not.toContain("cab.lote || ':facturas'");
    // La guarda va antes del bucle que crea las pre-órdenes.
    expect(s.aplicar.indexOf("markbox = any(array['DTD-0000']")).toBeLessThan(s.aplicar.indexOf("insert into public.invoices"));
    // El contenedor se sigue buscando por el id de la carga.
    expect(s.aplicar).toContain("insert into lote_cab values (\n  'carga-consolidado:59:deadbeef',");
    expect(s.simulacro).toContain(`'${id}', cab.contenedor`);
  });

  it("aplicar aborta si un envío excluido ya está en otro Shipping Mark (M1)", () => {
    const s = conExclusion();
    expect(s.aplicar).toContain("and upper(sh.code) = any(array['DTD-0000-01', 'DTD-0000-02']::text[])");
    expect(s.aplicar).toContain("envíos excluidos ya están en un Shipping Mark fuera de la lista");
    expect(s.aplicar.indexOf("envíos excluidos ya están")).toBeLessThan(s.aplicar.indexOf("insert into public.invoices"));
  });

  it("la huella cambia con la opción, no depende del orden y conserva la forma que acepta aplicar-lote.sh", () => {
    const sin = idDelPaquete(SOLO);
    const con = idDelPaquete({ ...SOLO, excluirMarkbox: ["DTD-0000"] });
    expect(sin).toBe("carga-consolidado:59:deadbeef:facturas");
    expect(con).not.toBe(sin);
    expect(con).toMatch(/^carga-consolidado:[0-9]+:[0-9a-f]+(:facturas)?$/);
    expect(con).toMatch(/^carga-consolidado:59:[0-9a-f]{8}:facturas$/);
    expect(idDelPaquete({ ...SOLO, excluirMarkbox: ["dtd-0000"] })).toBe(con);
    expect(idDelPaquete({ ...SOLO, excluirMarkbox: ["DTD-5002", "DTD-0000"] })).toBe(idDelPaquete({ ...SOLO, excluirMarkbox: ["DTD-0000", "DTD-5002"] }));
    expect(idDelPaquete({ ...SOLO, excluirMarkbox: ["DTD-0000", "DTD-5002"] })).not.toBe(con);
    expect(idDelPaquete({ ...SOLO, excluirMarkbox: [] })).toBe(sin);
    const s = conExclusion();
    expect(s.manifiesto.lote).toBe(con);
    for (const script of [s.previa, s.aplicar, s.simulacro, s.verificar, s.deshacer]) expect(script).toContain(con);
  });

  it("no va sin --solo-facturas ni con un lote filtrado con otra lista", () => {
    const completo: OpcionesSql = { ...SOLO, soloFacturas: false };
    expect(() => generarSql(excluir(["DTD-0000"]), { ...completo, excluirMarkbox: ["DTD-0000"] }, FUENTES)).toThrow(/sólo va con --solo-facturas/);
    expect(() => generarSql(lote(), { ...SOLO, excluirMarkbox: ["DTD-0000"] }, FUENTES)).toThrow(/no se filtró con la misma lista/);
    expect(() => generarSql(excluir(["DTD-0000"]), SOLO, FUENTES)).toThrow(/no se filtró con la misma lista/);
  });

  it("el resumen dice cuántos quedaron fuera", () => {
    const l = excluir(["DTD-0000"]);
    const s = generarSql(l, { ...SOLO, excluirMarkbox: ["DTD-0000"] }, FUENTES);
    expect(resumenMarkdown(l, s, [])).toContain("- **Excluidos por markbox: 2** envíos (1 claves del Excel, 2 filas) de DTD-0000");
  });
});

describe("sin --excluir-markbox no cambia nada", () => {
  it("el paquete --solo-facturas es idéntico byte a byte con la lista vacía o ausente", () => {
    const a = generarSql(lote(), SOLO, FUENTES);
    const b = generarSql(excluir([]), { ...SOLO, excluirMarkbox: [] }, FUENTES);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    expect(a.manifiesto).not.toHaveProperty("excluidos");
    expect(a.aplicar).toContain("cab.lote || ':facturas', cab.contenedor,");
    for (const script of [a.previa, a.aplicar, a.simulacro, a.verificar]) {
      expect(script).not.toMatch(/excluid/i);
    }
  });

  it("la carga completa tampoco cambia", () => {
    const completo: OpcionesSql = { ...SOLO, soloFacturas: false };
    const a = generarSql(lote(), completo, FUENTES);
    const b = generarSql(lote(), { ...completo, excluirMarkbox: [] }, FUENTES);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    expect(JSON.stringify(a)).not.toMatch(/excluid/i);
  });

  it("parsearArgumentos sin la opción no agrega la clave", () => {
    const base = ["--rastreo", "r.xlsx", "--packing", "p.xlsx", "--contenedor", "59", "--eta", "2026-10-19", "--salida", "s", "--solo-facturas"];
    expect(parsearArgumentos(base)).not.toHaveProperty("excluirMarkbox");
  });
});

describe("parsearArgumentos --excluir-markbox", () => {
  const base = ["--rastreo", "r.xlsx", "--packing", "p.xlsx", "--contenedor", "59", "--eta", "2026-10-19", "--salida", "s"];

  it("es repetible y acepta comas", () => {
    const a = parsearArgumentos([...base, "--solo-facturas", "--excluir-markbox", "dtd-5002,DTD-0000", "--excluir-markbox", "DTD-0000"]);
    expect(a.excluirMarkbox).toEqual(["DTD-0000", "DTD-5002"]);
  });

  it("sólo va con --solo-facturas y sólo con códigos", () => {
    expect(() => parsearArgumentos([...base, "--excluir-markbox", "DTD-0000"])).toThrow(/sólo va con --solo-facturas/);
    expect(() => parsearArgumentos([...base, "--solo-facturas", "--excluir-markbox", "Juan Pérez"])).toThrow(/no es un Shipping Mark/);
    expect(() => parsearArgumentos([...base, "--solo-facturas", "--excluir-markbox"])).toThrow(/Falta el valor de --excluir-markbox/);
  });
});

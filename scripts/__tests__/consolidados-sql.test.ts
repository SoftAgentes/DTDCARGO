/**
 * SDD-0543 · Contratos del lote SQL generado.
 *
 * Lo que una prueba sin base sí puede fijar: que los scripts tengan la forma
 * que el método del servidor exige (ON_ERROR_STOP, una sola transacción, el
 * simulacro termina en rollback), que los datos viajen escapados, que el
 * preflight y el deshacer se apoyen en las claves naturales y que el
 * manifiesto cuadre con el lote. El comportamiento contra Postgres se valida
 * en la base de prueba (verificar.sql), no acá.
 */
import { describe, expect, it } from "vitest";
import { agruparLote, type FilaPacking, type Rastreo } from "../consolidados/modelo";
import { generarSql, naviera, puertoDestino, type OpcionesSql } from "../consolidados/lote-sql";
import { parsearArgumentos } from "../consolidados/generar-lote";

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

const FILAS: FilaPacking[] = [
  { filaExcel: 4, marcaTexto: "DTD-J031 PRUEBA O'HIGGINS", remitente: "DTD-J031-05", descripcion: "Máquina 'recta'", cajas: 1, pesoKg: 137, cbmChina: 1.134, cbmFactura: 1.134, extraKg: -430, precioKgExtra: 1, valorKgExtra: -430, precioCbm: 800, totalFacturado: 907.2, agente: "X" },
  { filaExcel: 5, marcaTexto: "DTD-A116 CLIENTE UNO", remitente: "DTD-A116-06", descripcion: "Regulador", cajas: 1, pesoKg: 141, cbmChina: 0.0125, cbmFactura: 0.0125, extraKg: 134.75, precioKgExtra: 0.8, valorKgExtra: 107.8, precioCbm: 750, totalFacturado: 9.375, agente: "X" },
  { filaExcel: 6, marcaTexto: "ALIADO PRUEBA MM", remitente: "MM-41", descripcion: "Cajas", cajas: 8, pesoKg: 0, cbmChina: 0.96, cbmFactura: 0.96, extraKg: -480, precioKgExtra: 1, valorKgExtra: -480, precioCbm: 630, totalFacturado: 604.8, agente: "X" },
];

const OPCIONES: OpcionesSql = {
  entorno: "prueba",
  crearClientesFaltantes: true,
  facturas: true,
  pol: "NGB",
  polNombre: "Ningbo",
  containerType: "40HC",
  vessel: "Por confirmar",
  lote: "carga-consolidado:59:deadbeef",
  tenantSlug: "dtd",
};

const FUENTES = { rastreo: "a".repeat(64), packing: "b".repeat(64) };

function lote() {
  return agruparLote(RASTREO, FILAS, { eta: "2026-10-19" });
}

describe("catálogos", () => {
  it("resuelve puertos y navieras del rastreo", () => {
    expect(puertoDestino("la guaira")).toEqual({ code: "LGU", name: "La Guaira", country: "VE" });
    expect(puertoDestino("Maracaibo").code).toBe("MAR");
    expect(() => puertoDestino("Puerto Inventado")).toThrow(/desconocido/);
    expect(naviera("CMA CGM")).toEqual({ name: "CMA CGM", scac: "CMDU" });
    expect(naviera("MSK")).toEqual({ name: "Maersk", scac: "MAEU" });
    expect(naviera("Naviera Rara")).toEqual({ name: "NAVIERA RARA", scac: null });
    expect(() => naviera("")).toThrow(/naviera/);
  });
});

describe("generarSql", () => {
  it("aplicar es una transacción con ON_ERROR_STOP y el simulacro termina en rollback", () => {
    const s = generarSql(lote(), OPCIONES, FUENTES);
    for (const script of [s.previa, s.aplicar, s.simulacro, s.verificar, s.deshacer]) {
      expect(script.startsWith("\\set ON_ERROR_STOP on")).toBe(true);
    }
    expect(s.aplicar.match(/^begin;$/gm)).toHaveLength(1);
    expect(s.aplicar.match(/^commit;$/gm)).toHaveLength(1);
    expect(s.aplicar).not.toMatch(/^rollback;$/m);
    expect(s.simulacro).toMatch(/^rollback;$/m);
    expect(s.simulacro).not.toMatch(/^commit;$/m);
    expect(s.previa).toMatch(/^begin transaction read only;$/m);
    expect(s.previa.trimEnd().endsWith("rollback;")).toBe(true);
    expect(s.verificar).toMatch(/^begin transaction read only;$/m);
    expect(s.verificar.trimEnd().endsWith("rollback;")).toBe(true);
    expect(s.deshacer.trimEnd().endsWith("commit;")).toBe(true);
  });

  it("los datos viajan en tablas temporales con las comillas dobladas", () => {
    const s = generarSql(lote(), OPCIONES, FUENTES);
    expect(s.aplicar).toContain("insert into lote_cab values (\n  'carga-consolidado:59:deadbeef', 'ABCU1234567', 59, 'DDP', 'CMA CGM', 'CMDU',");
    expect(s.aplicar).toContain("'NGB', 'Ningbo', 'LGU', 'La Guaira', 'VE',");
    expect(s.aplicar).toContain("'2026-08-11', '2026-08-10', '2026-08-11', '2026-10-19',");
    expect(s.aplicar).toContain("'40HC', 'Por confirmar', true, true, 'prueba', 'dtd'");
    expect(s.aplicar).toContain("insert into lote_clientes values (1, 'DTD-J031', 'PRUEBA O''HIGGINS', 'DTD', true, array['DTD-J031']::text[]);");
    expect(s.aplicar).toContain("insert into lote_clientes values (3, 'MM-0041', 'ALIADO PRUEBA MM', 'MM', false, array['MM-0041', 'MM-41', 'MM-041']::text[]);");
    expect(s.aplicar).toContain("insert into lote_envios values (3, 'MM-41', 'MM-0041', 8, 0, 0.96, 0.96);");
    expect(s.aplicar).toContain("insert into lote_envios values (1, 'DTD-J031-05', 'DTD-J031', 1, 137, 1.134, 1.134);");
    expect(s.aplicar).toContain("insert into lote_filas values (1, 4, 'DTD-J031-05', 'Máquina ''recta''', 1, 137, 1.134, 1.134);");
    expect(s.aplicar).toContain("insert into lote_lineas values (1, 'DTD-J031', 'Flete DDP · DTD-J031-05 · 1.134 m³ × $800', 1.134, 800);");
    expect(s.aplicar).toContain("insert into lote_lineas values (3, 'DTD-A116', 'Exceso de peso · DTD-A116-06 · Regulador · 134.75 kg × $0.8', 134.75, 0.8);");
  });

  it("el preflight aborta por contenedor, lote, envíos, recepciones y facturas repetidos", () => {
    const s = generarSql(lote(), OPCIONES, FUENTES);
    expect(s.aplicar).toContain("raise exception 'preflight: el contenedor % ya está cargado'");
    expect(s.aplicar).toContain("raise exception 'preflight: el lote % ya está aplicado'");
    expect(s.aplicar).toContain("raise exception 'preflight: ya existen envíos con estos códigos: %'");
    expect(s.aplicar).toContain("upper('WR-C' || cab.numero::text || '-' || l.remitente)");
    expect(s.aplicar).toContain("raise exception 'preflight: ya hay facturas del lote %'");
    // El preflight va ANTES de cualquier escritura.
    expect(s.aplicar.indexOf("preflight: el contenedor")).toBeLessThan(s.aplicar.indexOf("insert into public.carriers"));
    expect(s.aplicar).toContain("raise exception 'lote: crear clientes faltantes sólo se permite en prueba'");
  });

  it("escribe lo que el modelo manda: envío por remitente, recepción WR-C59-, factura por cliente en borrador", () => {
    const s = generarSql(lote(), OPCIONES, FUENTES);
    expect(s.aplicar).toContain("'puerta_a_puerta_DDP', 'in_warehouse'");
    expect(s.aplicar).toContain("update public.shipments set status = 'in_transit' where id = v_ship;");
    expect(s.aplicar).toContain("'WR-C' || cab.numero::text || '-' || e.remitente, v_wh");
    expect(s.aplicar).toContain("'consolidado', v_ship, cab.fecha_recepcion");
    expect(s.aplicar).toContain("'USD', v_iva_rate, v_base, v_iva, v_total, 'borrador', v_lines");
    expect(s.aplicar).toContain("public.next_consolidation_ref(v_tenant)");
    expect(s.aplicar).toContain("public.next_invoice_code(v_tenant)");
    expect(s.aplicar).toContain("public.resolve_markbox(v_tenant, m)");
    expect(s.aplicar.match(/public\.append_audit_event\(/g)?.length).toBe(4);
    expect(s.aplicar).toContain("'job', 'succeeded'");
  });

  it("sin facturas no hay inserts de facturas esperados y el manifiesto lo refleja", () => {
    const s = generarSql(lote(), { ...OPCIONES, facturas: false }, FUENTES);
    expect(s.manifiesto.esperado.facturas).toBe(0);
    expect(s.manifiesto.esperado.base).toBe(0);
    expect(s.aplicar).toContain("true, false, 'prueba', 'dtd'");
    expect(s.verificar).toContain("if n_facturas <> 0 then");
  });

  it("verificar compara con los conteos del manifiesto y deshacer se niega con facturas emitidas o cajas estibadas", () => {
    const s = generarSql(lote(), OPCIONES, FUENTES);
    const e = s.manifiesto.esperado;
    expect(e).toEqual({ envios: 3, recepciones: 3, items: 3, cajas: 10, clientes: 3, facturas: 3, cbm: 2.107, kg: 278, base: 1629.18 });
    expect(s.verificar).toContain(`if n_envios <> 3 then`);
    expect(s.verificar).toContain(`if n_cajas <> 10 then`);
    expect(s.verificar).toContain(`abs(s_base - 1629.18) > 0.05`);
    expect(s.verificar).toContain("'DTD-J031-05', 'DTD-A116-06', 'MM-41'");
    expect(s.deshacer).toContain("status <> 'borrador'");
    expect(s.deshacer).toContain("raise exception 'deshacer: hay facturas del lote que ya no son borrador; no se deshace'");
    expect(s.deshacer).toContain("consolidation_box_positions");
    expect(s.deshacer).toContain("set_config('dtd.audit_reason'");
    expect(s.deshacer).toContain("'consolidation_import_undone'");
    // Deshacer no borra clientes.
    expect(s.deshacer).not.toMatch(/update public\.clients/);
    expect(s.deshacer).not.toMatch(/delete from public\.clients/);
  });

  it("rechaza textos que traigan el delimitador del bloque", () => {
    const sucio = [{ ...FILAS[0], descripcion: "x $lote$ y" }];
    expect(() => generarSql(agruparLote(RASTREO, sucio, { eta: "2026-10-19" }), OPCIONES, FUENTES)).toThrow(/delimitador/);
  });

  it("el manifiesto nombra el lote, el contenedor y cada embarque", () => {
    const s = generarSql(lote(), OPCIONES, FUENTES);
    expect(s.manifiesto.contenedor).toEqual({
      numero: 59, etiqueta: "DTD#59", container_no: "ABCU1234567", naviera: "CMA CGM", pol: "NGB", pod: "LGU",
      fechaCarga: "2026-08-11", fechaRecepcion: "2026-08-10", etd: "2026-08-11", eta: "2026-10-19", modalidad: "DDP",
    });
    expect(s.manifiesto.embarques.map((e) => e.remitente)).toEqual(["DTD-J031-05", "DTD-A116-06", "MM-41"]);
    expect(s.manifiesto.clientes[2]).toMatchObject({ clave: "MM-0041", candidatos: ["MM-0041", "MM-41", "MM-041"], base: 604.8 });
    expect(s.manifiesto.opciones).toEqual({ crearClientesFaltantes: true, facturas: true, excesoPeso: true, containerType: "40HC" });
  });
});

describe("parsearArgumentos", () => {
  const base = ["--rastreo", "r.xlsx", "--packing", "p.xlsx", "--contenedor", "59", "--eta", "2026-10-19", "--salida", "out"];
  it("toma los valores y los defaults", () => {
    const a = parsearArgumentos(base);
    expect(a).toMatchObject({ contenedor: 59, eta: "2026-10-19", entorno: "prueba", crearClientesFaltantes: false, facturas: true, excesoPeso: true, pol: "NGB", polNombre: "Ningbo", tipo: "40HC", tenant: "dtd" });
  });
  it("acepta las banderas y valida lo que no puede pasar", () => {
    expect(parsearArgumentos([...base, "--crear-clientes-faltantes", "--sin-facturas", "--sin-exceso-peso"])).toMatchObject({ crearClientesFaltantes: true, facturas: false, excesoPeso: false });
    expect(() => parsearArgumentos([...base, "--entorno", "produccion", "--crear-clientes-faltantes"])).toThrow(/sólo se permite/);
    expect(() => parsearArgumentos([...base, "--entorno", "staging"])).toThrow(/prueba o produccion/);
    expect(() => parsearArgumentos([...base, "--etd", "11/08/2026"])).toThrow(/YYYY-MM-DD/);
    expect(() => parsearArgumentos(base.slice(0, 8))).toThrow(/Falta --salida/);
    expect(() => parsearArgumentos([...base, "--eta"])).toThrow(/Falta el valor/);
    expect(() => parsearArgumentos([...base, "extra"])).toThrow(/inesperado/);
  });
});

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
import { etiquetaEvidencia, generarSql, naviera, puertoDestino, type OpcionesSql } from "../consolidados/lote-sql";
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
    expect(s.aplicar).toContain("'40HC', 'Por confirmar', true, true, 'prueba', 'dtd', 'ddp'");
    // lote_cab ya traía `modalidad` (el texto FCL/DDP de la hoja): el modo del lote es otra columna.
    const ddl = s.aplicar.match(/create temp table lote_cab \(([\s\S]*?)\) on commit drop;/)?.[1] ?? "";
    const columnas = ddl.split(",").map((c) => c.trim().split(/\s+/)[0]);
    expect(new Set(columnas).size).toBe(columnas.length);
    expect(columnas).toContain("modo");
    expect(s.aplicar).toContain("insert into lote_clientes values (1, 'DTD-J031', 'DTD-J031', 'PRUEBA O''HIGGINS', 'DTD', true, false, array['DTD-J031']::text[]);");
    expect(s.aplicar).toContain("insert into lote_clientes values (3, 'MM-0041', 'MM-0041', 'ALIADO PRUEBA MM', 'MM', false, false, array['MM-0041', 'MM-41', 'MM-041']::text[]);");
    // ddp: ni dueño ni gasto.
    expect(s.aplicar).toContain("create temp table lote_dueno (clave text, codigo text, servicio text, cbm numeric, kg numeric) on commit drop;");
    expect(s.aplicar).not.toContain("insert into lote_dueno values");
    expect(s.aplicar).not.toContain("insert into lote_gasto values");
    expect(s.manifiesto.modalidad).toBe("ddp");
    expect(s.manifiesto.dueno).toBeNull();
    expect(s.aplicar).toContain("insert into lote_envios values (3, 'MM-41', 'MM-0041', 8, 0, 0.96, 0.96);");
    expect(s.aplicar).toContain("insert into lote_envios values (1, 'DTD-J031-05', 'DTD-J031', 1, 137, 1.134, 1.134);");
    expect(s.aplicar).toContain("insert into lote_filas values (1, 4, 'DTD-J031-05', 'Máquina ''recta''', 1, 137, 1.134, 1.134);");
    expect(s.aplicar).toContain("insert into lote_lineas values (1, 'DTD-J031', 'Flete DDP · DTD-J031-05 · 1.134 m³ × $800', 1.134, 800);");
    expect(s.aplicar).toContain("insert into lote_lineas values (3, 'DTD-A116', 'Exceso de peso · DTD-A116-06 · Regulador · 134.75 kg × $0.8', 134.75, 0.8);");
  });

  it("previa y los errores del lote no llevan nombres de clientes: terminan en la evidencia", () => {
    const s = generarSql(lote(), OPCIONES, FUENTES);
    expect(s.previa).not.toContain("PRUEBA O''HIGGINS");
    expect(s.previa).not.toContain("ALIADO PRUEBA MM");
    expect(s.previa).not.toMatch(/nombre_excel|nombre_en_base|cl\.name/);
    expect(s.previa).toContain("('DTD-J031', array['DTD-J031']::text[])");
    expect(s.aplicar).toContain("raise exception 'lote: la marca % no resuelve a ningún cliente; mapéala en marcas-mapa.json (ver resumen.md)', c.etiqueta;");
    expect(s.verificar).not.toMatch(/client_name|\.name\b/);
  });

  it("una marca sin número sale en previa y en los errores como etiqueta PREFIJO-#n, nunca como texto", () => {
    const conTexto = [...FILAS, { ...FILAS[2], filaExcel: 7, marcaTexto: "ALIADO PRUEBA DC", remitente: "DC-01-ZUTANO-16", cbmFactura: 0.1, cbmChina: 0.1, precioCbm: 630, totalFacturado: 63 }];
    const s = generarSql(agruparLote(RASTREO, conTexto, { eta: "2026-10-19" }), OPCIONES, FUENTES);
    expect(etiquetaEvidencia("DC-01-ZUTANO", "DC", 4)).toBe("DC-#4");
    expect(etiquetaEvidencia("DC-0014", "DC", 4)).toBe("DC-0014");
    expect(etiquetaEvidencia("DTD-J031", "DTD", 1)).toBe("DTD-J031");
    // La clave impresa es la etiqueta; el texto del Excel sólo viaja dentro del
    // array de candidatos, que la consulta no proyecta (psql no hace eco del SQL).
    expect(s.previa).not.toContain("('DC-01-ZUTANO', array");
    expect(s.previa).toContain("('DC-#4', array['DC-01-ZUTANO']::text[])");
    expect(s.previa.match(/^select m\.clave,$/gm)).toHaveLength(1);
    expect(s.aplicar).toContain("insert into lote_clientes values (4, 'DC-01-ZUTANO', 'DC-#4', 'ALIADO PRUEBA DC', 'DC', false, false, array['DC-01-ZUTANO']::text[]);");
    expect(s.manifiesto.clientes[3]).toMatchObject({ clave: "DC-01-ZUTANO", etiqueta: "DC-#4" });
    expect(s.manifiesto.clientes[0]).toMatchObject({ clave: "DTD-J031", etiqueta: "DTD-J031" });
  });

  it("el preflight aborta por contenedor, lote, envíos, recepciones y facturas repetidos", () => {
    const s = generarSql(lote(), OPCIONES, FUENTES);
    expect(s.aplicar).toContain("raise exception 'preflight: el contenedor % ya está cargado'");
    expect(s.aplicar).toContain("raise exception 'preflight: el lote % ya está aplicado'");
    expect(s.aplicar).toContain("raise exception 'preflight: % envíos del lote ya existen con ese código (ver previa.sql y resumen.md)', v_n_dup;");
    expect(s.aplicar).toContain("raise exception 'preflight: % recepciones del lote ya existen con ese código (ver previa.sql y resumen.md)', v_n_dup;");
    expect(s.aplicar).not.toMatch(/string_agg\(s\.code|string_agg\(w\.receipt_code/);
    // Un deshacer previo deja los códigos ocupados (unique no parcial): se dice antes del insert.
    expect(s.aplicar).toContain("existen BORRADOS (deshacer previo) y ocupan el código");
    expect(s.aplicar).toContain("existen BORRADAS (deshacer previo) y ocupan el código");
    expect(s.aplicar.indexOf("existen BORRADOS")).toBeLessThan(s.aplicar.indexOf("insert into public.carriers"));
    expect(s.aplicar).toContain("upper('WR-C' || cab.numero::text || '-' || l.remitente)");
    expect(s.verificar).not.toMatch(/select invoice_code, client_markbox, shipment_code/);
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
    // psql como postgres no trae JWT: next_markbox (assert_tenant_match) abortó el simulacro
    // del 2026-10-16. El aliado raíz sintético lleva su insignia pelada (migr 0371).
    expect(s.aplicar).toContain("values (v_tenant, upper(c.prefijo), c.nombre_excel || ' (aliado raíz)'");
    expect(s.aplicar).not.toMatch(/public\.next_markbox/);
    expect(s.aplicar).not.toMatch(/assert_tenant_match|get_user_tenant_id/);
    // El guard de clients (0371) exige <cadena>-NNNN para un cliente de aliado: la
    // marca del Excel se usa si ya tiene esa forma y, si no, se calcula la siguiente
    // libre como next_markbox_aliado, sin esa función (segundo simulacro, 2026-10-16).
    expect(s.aplicar).toContain("v_chain := public.aliado_prefix_chain(v_aliado);");
    expect(s.aplicar).toContain("if c.candidatos[1] ~ ('^' || v_chain || '-\\d+$') then");
    expect(s.aplicar).toContain("select h.markbox from public.client_markbox_history h where h.tenant_id = v_tenant");
    expect(s.aplicar).toContain("values (v_tenant, v_markbox_nuevo, c.nombre_excel || ' · ' || c.clave, v_aliado,");
    expect(s.aplicar).not.toMatch(/values \(v_tenant, c\.candidatos\[1\], c\.nombre_excel \|\| ' · '/);
    // envío DDP, recepción, FCL del dueño, factura y contenedor.
    expect(s.aplicar.match(/public\.append_audit_event\(/g)?.length).toBe(5);
    // Ningún alias de tabla de una letra igual a una variable del bloque (c, e, f, r, m).
    const bloque = s.aplicar.slice(s.aplicar.indexOf("do $lote$"), s.aplicar.indexOf("$lote$;"));
    // El nombre de la tabla no lleva «(»: así una llamada a función con la variable m
    // como argumento (resolve_markbox(v_tenant, m)) no cuenta como alias.
    expect(bloque).not.toMatch(/\b(?:from|join)\s+[^\s(]+\s+(?:as\s+)?[cefrm]\b(?!\.)/i);
    expect(bloque).toMatch(/join lote_envios le on le\.clave = lr\.clave/);
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

  it("purgar borra físico en orden de dependencias, sólo en la base de prueba, y exige conteo cero", () => {
    const s = generarSql(lote(), OPCIONES, FUENTES);
    expect(s.purgar.startsWith("\\set ON_ERROR_STOP on")).toBe(true);
    expect(s.purgar.trimEnd().endsWith("commit;")).toBe(true);
    expect(s.purgar).toContain("'05400000-0000-4000-8000-000000000101'::uuid");
    expect(s.purgar).toContain("raise exception 'purgar: esta base no es la de prueba");
    const orden = [
      "delete from public.invoices where id = any(v_invs);",
      "delete from public.warehouse_receipts_cn where id = any(v_recs);",
      "delete from public.shipments where id = any(v_ships);",
      "delete from public.consolidations where id = any(v_cons);",
      "delete from public.sailings where id = any(v_sails);",
      "delete from public.carriers where id = any(v_carriers);",
      "delete from public.clients where id = any(v_clients) and aliado_id is not null;",
      "delete from public.aliados where id = any(v_aliados);",
      "delete from public.clients where id = any(v_clients);",
    ];
    let pos = -1;
    for (const paso of orden) {
      const i = s.purgar.indexOf(paso);
      expect(i, paso).toBeGreaterThan(pos);
      pos = i;
    }
    expect(s.purgar).toContain("notes like 'Creado por la carga ' || v_lote || '%'");
    expect(s.purgar).toContain("raise exception 'purgar: quedaron % filas del lote %'");
    // Otro lote que dependa de este (aliado raíz o marca compartida) para antes del primer delete.
    expect(s.purgar).toContain("cuelgan de un aliado creado por este lote: purga ese lote primero");
    expect(s.purgar).toContain("usan la marca de un cliente creado por este lote: purga ese lote primero o reinicia prueba");
    expect(s.purgar).toContain("substring(cl.notes from '(carga-consolidado:[0-9]+:[0-9a-f]+)')");
    expect(s.purgar.indexOf("cuelgan de un aliado")).toBeLessThan(s.purgar.indexOf("delete from public.expenses"));
    expect(s.purgar).toContain("'consolidation_import_purged'");
    expect(s.purgar).not.toMatch(/delete from public\.entity_audit_log/);
    expect(s.purgar).not.toMatch(/set deleted_at/);
  });

  it("fcl: sólo el envío FCL del dueño, sin recepciones ni facturas (61, 62, 63)", () => {
    const r61: Rastreo = { ...RASTREO, numero: 61, etiqueta: "MG-019#61", modalidad: "FCL", contenedor: "MRSU9497682", naviera: "MSK", puertoLlegada: "Barranquilla", fechaCarga: "2026-09-08" };
    const l = agruparLote(r61, [], { eta: "2026-10-25", modalidad: "fcl", dueno: "MG-019", cbmFcl: 60 });
    expect(l.embarques).toHaveLength(0);
    expect(l.dueno).toMatchObject({ codigo: "MG-019-FCL-61", servicio: "fcl_directo", cbm: 60, kg: null });
    const s = generarSql(l, OPCIONES, FUENTES);
    expect(s.aplicar).toContain("insert into lote_dueno values ('MG-0019', 'MG-019-FCL-61', 'fcl_directo', 60, null);");
    expect(s.aplicar).toContain("insert into lote_clientes values (1, 'MG-0019', 'MG-0019', 'Dueño del contenedor MG-019', 'MG', false, false, array['MG-0019', 'MG-019']::text[]);");
    expect(s.aplicar).not.toContain("insert into lote_envios values");
    expect(s.aplicar).not.toContain("insert into lote_lineas values");
    expect(s.aplicar).toContain("'Yiwu, China', cab.pod_nombre, d.servicio::public.shipment_service, 'in_warehouse'");
    expect(s.aplicar).toContain("'BAQ', 'Barranquilla', 'CO'");
    expect(s.aplicar).toContain("'Maersk', 'MAEU'");
    expect(s.manifiesto.esperado).toEqual({ envios: 1, recepciones: 0, items: 0, cajas: 0, clientes: 1, facturas: 0, cbm: 60, kg: 0, base: 0 });
    expect(s.manifiesto.dueno).toEqual({ etiqueta: "MG-0019", clave: "MG-0019", codigo: "MG-019-FCL-61", servicio: "fcl_directo", cbm: 60, kg: null });
    expect(s.previa).toContain("('MG-0019', array['MG-0019', 'MG-019']::text[])");
    expect(s.verificar).toContain("upper(code) in ('MG-019-FCL-61')");
  });

  it("mixto: el FCL del aliado dueño (insignia pelada) más los DDP facturados y el gasto por el espacio (60)", () => {
    const r60: Rastreo = { ...RASTREO, numero: 60, etiqueta: "HR-DTD#60", modalidad: "FCL/DDP 5.70cbm", contenedor: "FFAU8030200", puertoLlegada: "Maracaibo", fechaCarga: "2026-08-20" };
    const l = agruparLote(r60, FILAS, { eta: "2026-10-22", modalidad: "mixto", dueno: "HR", excesoPeso: false, gastoEspacio: { monto: 1200.5, usuarioEmail: "Admin@prueba.example.test" } });
    expect(l.dueno).toMatchObject({ codigo: "HR-FCL-60", marca: { clave: "HR", prefijo: "HR", numero: "", candidatos: ["HR"] } });
    expect(l.gastoEspacio).toEqual({ monto: 1200.5, usuarioEmail: "admin@prueba.example.test" });
    const s = generarSql(l, OPCIONES, FUENTES);
    expect(s.aplicar).toContain("insert into lote_clientes values (4, 'HR', 'HR', 'Aliado HR', 'HR', false, true, array['HR']::text[]);");
    expect(s.aplicar).toContain("insert into lote_dueno values ('HR', 'HR-FCL-60', 'fcl_directo', null, null);");
    expect(s.aplicar).toContain("insert into lote_gasto values (1200.5, 'admin@prueba.example.test');");
    expect(s.aplicar).toContain("if c.es_raiz_aliado then");
    expect(s.aplicar).toContain("insert into public.expenses");
    expect(s.aplicar).toContain("'shipment', g.monto, 1.0");
    expect(s.manifiesto.esperado).toMatchObject({ envios: 4, recepciones: 3, facturas: 3, clientes: 4, cbm: 2.107, kg: 278 });
    expect(s.manifiesto.gastoEspacio).toEqual({ monto: 1200.5 });
    expect(JSON.stringify(s.manifiesto)).not.toContain("admin@prueba.example.test");
    // expenses no admite deleted_at directo (void_expense_governed exige sesión): deshacer lo borra físico.
    expect(s.deshacer).toContain("delete from public.expenses where tenant_id = v_tenant and note like '%' || v_lote || '%';");
    expect(s.deshacer).not.toMatch(/update public\.expenses/);
    expect(s.purgar).toContain("delete from public.expenses where tenant_id = v_tenant and note like '%' || v_lote || '%';");
    expect(s.purgar.indexOf("delete from public.expenses")).toBeLessThan(s.purgar.indexOf("delete from public.shipments where id = any(v_ships);"));
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
  it("modalidades: fcl sin packing con dueño; mixto con packing, dueño y gasto completo", () => {
    const fcl = ["--rastreo", "r.xlsx", "--contenedor", "61", "--eta", "2026-10-25", "--salida", "out", "--modalidad", "fcl", "--dueno", "MG-019", "--cbm-fcl", "60"];
    expect(parsearArgumentos(fcl)).toMatchObject({ modalidad: "fcl", dueno: "MG-019", packing: undefined, servicioFcl: "fcl_directo", cbmFcl: 60 });
    expect(() => parsearArgumentos([...fcl.slice(0, 8), "--modalidad", "fcl"])).toThrow(/exige --dueno/);
    expect(() => parsearArgumentos([...fcl.slice(0, 8), "--modalidad", "mixto", "--dueno", "HR"])).toThrow(/exige --packing/);
    expect(() => parsearArgumentos([...base, "--dueno", "HR"])).toThrow(/sólo aplica a fcl y mixto/);
    expect(() => parsearArgumentos([...base, "--modalidad", "mixto", "--dueno", "HR", "--gasto-espacio", "100"])).toThrow(/van juntos/);
    expect(() => parsearArgumentos([...base, "--gasto-espacio", "100", "--gasto-usuario", "a@b.test"])).toThrow(/sólo aplica a la modalidad mixto/);
    expect(parsearArgumentos([...base, "--modalidad", "mixto", "--dueno", "HR", "--gasto-espacio", "1200,50", "--gasto-usuario", "a@b.test", "--ignorar-titulo-packing"])).toMatchObject({ modalidad: "mixto", dueno: "HR", gastoEspacio: 1200.5, gastoUsuario: "a@b.test", ignorarTituloPacking: true });
    expect(() => parsearArgumentos([...base, "--modalidad", "lcl"])).toThrow(/ddp, fcl o mixto/);
  });
});

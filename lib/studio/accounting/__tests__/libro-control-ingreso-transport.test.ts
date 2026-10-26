/**
 * SDD-0573 · FICTICIO: transporte de I2 por su API pública.
 * Datos originales en memoria; no fixtures ajenos, SQL ni clientes reales.
 * Los paginadores importados por producción se ejecutan sin mock.
 */
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ingresoDelPeriodo } from "../libro-control-queries";
import { causaDelControlI2, describirIngreso, type ControlDelMayor } from "../ingreso-periodo";

type Fila = Record<string, unknown>;
type Tabla = "invoices" | "journal_entries" | "journal_lines" | "accounts";
type Datos = Record<Tabla, Fila[]>;
type Rol = "oficial" | "candidatos" | "porDocumento" | "originales" | "reversos" | "documentos" | "lineas" | "cuentas";
type Filtro = { op: "is" | "in" | "gte" | "lte"; campo: string; valor: unknown };
type Consulta = {
  tabla: Tabla; columnas: string; filtros: Filtro[]; orden: string;
  ascendente: boolean; desde: number; hasta: number;
};
type Llamada = Consulta & { rol: Rol; ids: unknown[] };
type Fallo = { rol: Rol; desde: number; respuesta: unknown };
type Caso = { nombre: string; datos: Datos; mayor: ControlDelMayor; fallo?: Fallo };
type Builder = {
  select(columnas: string): Builder;
  is(campo: string, valor: unknown): Builder;
  in(campo: string, valor: unknown): Builder;
  gte(campo: string, valor: unknown): Builder;
  lte(campo: string, valor: unknown): Builder;
  order(campo: string, opciones: { ascending: boolean }): Builder;
  range(desde: number, hasta: number): Promise<unknown>;
};

const FICT_UUID = (n: number) => "f1c71000-0000-4000-8000-" + String(n).padStart(12, "0");
const TENANT = FICT_UUID(1);
const DOC = FICT_UUID(11);
const OFICIAL = FICT_UUID(12);
const ORIGINAL = FICT_UUID(21);
const REVERSO = FICT_UUID(22);
const MANUAL = FICT_UUID(23);
const ACTIVO = FICT_UUID(41);
const VENTA = FICT_UUID(42);
const RAIZ = FICT_UUID(43);
const RANGO = { from: "2026-04-01", to: "2026-04-30" };
const COLUMNAS = {
  oficial: "id, status, issued_at, currency, fx_rate, base_amount, fund_class, deleted_at",
  documentos: "id, tenant_id, status, issued_at, currency, fx_rate, base_amount, fund_class, deleted_at",
  asientos: "id, tenant_id, status, source, deleted_at, invoice_id, entry_date, reverses_entry_id",
  lineas: "id, entry_id, account_id, debit, credit",
  cuentas: "id, tenant_id, code, type, parent_id",
};
const ETIQUETA: Record<Exclude<Rol, "oficial">, string> = {
  candidatos: "Ingreso I2 · candidatos del período",
  porDocumento: "Ingreso I2 · asientos por documento",
  originales: "Ingreso I2 · originales por vínculo",
  reversos: "Ingreso I2 · reversos por vínculo",
  documentos: "Ingreso I2 · metadata documental",
  lineas: "Ingreso I2 · líneas de los extremos",
  cuentas: "Ingreso I2 · cuentas y ascendencia",
};
const ROLES_ID: Exclude<Rol, "oficial" | "candidatos">[] =
  ["porDocumento", "originales", "reversos", "documentos", "lineas", "cuentas"];
const ROLES_I2: Exclude<Rol, "oficial">[] = ["candidatos", ...ROLES_ID];

function factura(id: string, status: string, base: number, currency = "USD", fx: number | null = null): Fila {
  return { id, tenant_id: TENANT, status, issued_at: "2026-04-05", currency,
    fx_rate: fx, base_amount: base, fund_class: "local_revenue", deleted_at: null };
}
function asiento(id: string, documento: string, source: string, reverses: string | null = null): Fila {
  return { id, tenant_id: TENANT, status: "asentado", source, deleted_at: null,
    invoice_id: documento, entry_date: "2026-04-10", reverses_entry_id: reverses };
}
function linea(id: number, entry: string, cuenta: string, debit: number, credit: number): Fila {
  return { id: FICT_UUID(id), entry_id: entry, account_id: cuenta, debit, credit };
}
function cuentas(): Fila[] {
  return [
    { id: ACTIVO, tenant_id: TENANT, code: "1.1", type: "A", parent_id: null },
    { id: VENTA, tenant_id: TENANT, code: "4.5.1", type: "I", parent_id: RAIZ },
    { id: RAIZ, tenant_id: TENANT, code: "4.5", type: "I", parent_id: null },
  ];
}
function parUsd(): Datos {
  const fueraDeFecha = { ...factura(FICT_UUID(13), "emitida", 999), issued_at: "2026-03-05" };
  const borrada = { ...factura(FICT_UUID(14), "emitida", 888), deleted_at: "2026-04-06" };
  return {
    invoices: [factura(DOC, "anulada", 120), factura(OFICIAL, "emitida", 175), fueraDeFecha, borrada],
    journal_entries: [
      asiento(ORIGINAL, DOC, "invoice"), asiento(REVERSO, DOC, "invoice_reversal", ORIGINAL),
      asiento(MANUAL, DOC, "manual"),
    ],
    journal_lines: [
      linea(61, ORIGINAL, ACTIVO, 120, 0), linea(62, ORIGINAL, VENTA, 0, 120),
      linea(63, REVERSO, ACTIVO, 0, 120), linea(64, REVERSO, VENTA, 120, 0),
      linea(65, MANUAL, ACTIVO, 50, 0), linea(66, MANUAL, VENTA, 0, 50),
    ],
    accounts: cuentas(),
  };
}
const MAYOR_PAR: ControlDelMayor = {
  ventas: 0, ventasConMovimiento: true, ingresos: 50, facturasConAsiento: new Set([DOC]),
};
const MAYOR_VACIO: ControlDelMayor = {
  ventas: 0, ventasConMovimiento: false, ingresos: 0, facturasConAsiento: new Set(),
};

function clasificar(q: Consulta): Rol {
  const tiene = (op: Filtro["op"], campo: string) => q.filtros.some(f => f.op === op && f.campo === campo);
  if (q.tabla === "invoices" && q.columnas === COLUMNAS.oficial) return "oficial";
  if (q.tabla === "invoices" && q.columnas === COLUMNAS.documentos) return "documentos";
  if (q.tabla === "journal_lines" && q.columnas === COLUMNAS.lineas) return "lineas";
  if (q.tabla === "accounts" && q.columnas === COLUMNAS.cuentas) return "cuentas";
  if (q.tabla === "journal_entries" && q.columnas === COLUMNAS.asientos) {
    if (tiene("gte", "entry_date")) return "candidatos";
    if (tiene("in", "invoice_id")) return "porDocumento";
    if (tiene("in", "reverses_entry_id")) return "reversos";
    if (tiene("in", "id")) return "originales";
  }
  throw new Error("FICT_consulta inesperada: tabla/select");
}
function verificarConsulta(q: Consulta, rol: Rol) {
  const claves: Record<Rol, string[]> = {
    oficial: ["is:deleted_at", "in:status", "gte:issued_at", "lte:issued_at"],
    candidatos: ["in:source", "gte:entry_date", "lte:entry_date"],
    porDocumento: ["in:invoice_id", "in:source"], originales: ["in:id"],
    reversos: ["in:reverses_entry_id"], documentos: ["in:id"],
    lineas: ["in:entry_id"], cuentas: ["in:id"],
  };
  const actuales = q.filtros.map(f => f.op + ":" + f.campo).sort();
  if (JSON.stringify(actuales) !== JSON.stringify([...claves[rol]].sort())
    || q.orden !== "id" || !q.ascendente || !Number.isInteger(q.desde) || q.desde < 0
    || q.hasta !== q.desde + 999) throw new Error("FICT_builder/rango inesperado");
  for (const f of q.filtros) {
    if (f.op === "is" && f.valor !== null) throw new Error("FICT_null filter inesperado");
    if (f.op === "gte" && f.valor !== RANGO.from) throw new Error("FICT_inicio inesperado");
    if (f.op === "lte" && f.valor !== RANGO.to) throw new Error("FICT_fin inesperado");
    if (f.op === "in") {
      if (!Array.isArray(f.valor) || !f.valor.length || !f.valor.every(v => typeof v === "string"))
        throw new Error("FICT_ids ilegibles");
      if (f.campo === "source" && JSON.stringify(f.valor) !== JSON.stringify(["invoice", "invoice_reversal"]))
        throw new Error("FICT_source no conserva invoice/reversal");
      if (f.campo === "status"
        && JSON.stringify(f.valor) !== JSON.stringify(["emitida", "parcial", "pagada", "vencida", "anulada"]))
        throw new Error("FICT_status inesperado");
    }
  }
}

/** Doble FICTICIO: aplica los filtros reales; no enruta por el nombre del test. */
function transporte(datos: Datos, fallo?: Fallo) {
  const llamadas: Llamada[] = [];
  let fallosAplicados = 0;
  const client = {
    from(tabla: string) {
      if (!Object.hasOwn(datos, tabla)) throw new Error("FICT_tabla inesperada");
      const q: Consulta = {
        tabla: tabla as Tabla, columnas: "", filtros: [], orden: "",
        ascendente: false, desde: -1, hasta: -1,
      };
      const filtro = (op: Filtro["op"], campo: string, valor: unknown): Builder => {
        q.filtros.push({ op, campo, valor }); return builder;
      };
      const builder: Builder = {
        select(columnas: string) {
          if (q.columnas) throw new Error("FICT_select repetido");
          q.columnas = columnas; return builder;
        },
        is: (campo: string, valor: unknown) => filtro("is", campo, valor),
        in: (campo: string, valor: unknown) => filtro("in", campo, valor),
        gte: (campo: string, valor: unknown) => filtro("gte", campo, valor),
        lte: (campo: string, valor: unknown) => filtro("lte", campo, valor),
        order(campo: string, opciones: { ascending: boolean }) {
          q.orden = campo; q.ascendente = opciones.ascending; return builder;
        },
        range(desde: number, hasta: number): Promise<unknown> {
          q.desde = desde; q.hasta = hasta;
          const rol = clasificar(q);
          verificarConsulta(q, rol);
          let filas = [...datos[q.tabla]];
          for (const f of q.filtros) {
            filas = filas.filter(row => {
              if (f.op === "is") return row[f.campo] === f.valor;
              if (f.op === "in") return Array.isArray(f.valor) && f.valor.includes(row[f.campo]);
              if (f.op === "gte") return String(row[f.campo]) >= String(f.valor);
              return String(row[f.campo]) <= String(f.valor);
            });
          }
          filas.sort((a, b) => String(a.id).localeCompare(String(b.id)));
          const pagina = filas.slice(desde, hasta + 1).map(row => Object.fromEntries(
            q.columnas.split(",").map(s => s.trim()).filter(c => Object.hasOwn(row, c)).map(c => [c, row[c]])));
          llamadas.push({ ...q, filtros: q.filtros.map(f => ({ ...f })), rol, ids: pagina.map(row => row.id) });
          if (fallo?.rol === rol && fallo.desde === desde) {
            fallosAplicados += 1;
            return Promise.resolve(fallo.respuesta);
          }
          return Promise.resolve({ data: pagina, error: null });
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient;
  return { client, llamadas, fallosAplicados: () => fallosAplicados };
}

// Todos los datos, respuestas y expectativas se fijan antes de registrar tests.
const CASO_PAR: Caso = { nombre: "FICT_par_USD", datos: parUsd(), mayor: MAYOR_PAR };
const CASO_VACIO: Caso = {
  nombre: "FICT_vacio_acreditado",
  datos: { invoices: [], journal_entries: [], journal_lines: [], accounts: [] }, mayor: MAYOR_VACIO,
};
const CASO_OFICIAL: Caso = {
  nombre: "FICT_oficial_sin_posting",
  datos: { invoices: [factura(OFICIAL, "emitida", 175)], journal_entries: [], journal_lines: [], accounts: [] },
  mayor: MAYOR_VACIO,
};
const CASO_ND: Caso = {
  nombre: "FICT_metadata_no_disponible",
  datos: { ...parUsd(), invoices: [factura(OFICIAL, "emitida", 175)] }, mayor: MAYOR_PAR,
};
const CASO_DOMINIO: Caso = {
  nombre: "FICT_tenant_documental_desconocido",
  datos: { ...parUsd(), invoices: [
    { ...factura(DOC, "anulada", 120), tenant_id: null }, factura(OFICIAL, "emitida", 175),
  ] }, mayor: MAYOR_PAR,
};
const DATOS_NOMINALES: Datos = { invoices: [], journal_entries: [], journal_lines: [], accounts: cuentas() };
for (const [i, moneda, base, tasa] of [
  [0, "VES", 300, 3], [1, "CNY", 200, null], [2, "VES", 250, 5],
] as const) {
  const documento = FICT_UUID(100 + i);
  const entry = FICT_UUID(110 + i);
  DATOS_NOMINALES.invoices.push(factura(documento, "emitida", base, moneda, tasa));
  DATOS_NOMINALES.journal_entries.push(asiento(entry, documento, "invoice"));
  DATOS_NOMINALES.journal_lines.push(
    linea(120 + i * 2, entry, ACTIVO, base, 0), linea(121 + i * 2, entry, VENTA, 0, base));
}
const CASO_NOMINAL: Caso = {
  nombre: "FICT_nominal_VES_CNY", datos: DATOS_NOMINALES,
  mayor: { ventas: 750, ventasConMovimiento: true, ingresos: 750,
    facturasConAsiento: new Set(DATOS_NOMINALES.invoices.map(row => String(row.id))) },
};
const PAGINAS_MALAS = [
  { nombre: "null", data: null }, { nombre: "undefined", data: undefined },
  { nombre: "objeto", data: {} }, { nombre: "fila_null", data: [null] },
  { nombre: "fila_escalar", data: [17] }, { nombre: "fila_array", data: [["FICT_array"]] },
  { nombre: "fila_sin_identidad", data: [{}] },
  { nombre: "fila_campo_compuesto", data: [{ id: FICT_UUID(700), source: ["invoice"] }] },
];
const CASOS_MALOS = ROLES_I2.flatMap(rol => PAGINAS_MALAS.map(pagina => ({
  nombre: "FICT_" + rol + "_" + pagina.nombre, datos: parUsd(), mayor: MAYOR_PAR,
  fallo: { rol, desde: 0, respuesta: { data: pagina.data, error: null } },
})));
const CASOS_ERROR = ROLES_I2.map(rol => {
  const causa = new Error("FICT_causa_nativa_" + rol);
  const error = { message: "FICT_error_nativo_" + rol, code: "FICT_503", cause: causa };
  return { nombre: "FICT_error_" + rol, datos: parUsd(), mayor: MAYOR_PAR, error,
    fallo: { rol, desde: 0, respuesta: { data: null, error } } };
});
const CASOS_RESPUESTA = [
  { nombre: "FICT_respuesta_null", respuesta: null },
  { nombre: "FICT_respuesta_undefined", respuesta: undefined },
  { nombre: "FICT_falta_error", respuesta: { data: [] } },
  { nombre: "FICT_error_false", respuesta: { data: [], error: false } },
].map(caso => ({
  ...caso, datos: parUsd(), mayor: MAYOR_PAR,
  fallo: { rol: "candidatos" as const, desde: 0, respuesta: caso.respuesta },
}));
const DATOS_CANDIDATOS_LARGOS = parUsd();
DATOS_CANDIDATOS_LARGOS.journal_entries = Array.from({ length: 1000 }, (_, i) =>
  asiento(FICT_UUID(2000 + i), DOC, "invoice"));
const DATOS_IDS_LARGOS = parUsd();
DATOS_IDS_LARGOS.journal_entries.push(...Array.from({ length: 1000 }, (_, i) => ({
  ...asiento(FICT_UUID(4000 + i), DOC, "invoice"), entry_date: "2026-03-10",
})));
const CASOS_POSTERIORES: Caso[] = [
  { nombre: "FICT_candidatos_segunda_pagina", datos: DATOS_CANDIDATOS_LARGOS, mayor: MAYOR_PAR,
    fallo: { rol: "candidatos", desde: 1000, respuesta: { data: null, error: null } } },
  { nombre: "FICT_porID_segunda_pagina", datos: DATOS_IDS_LARGOS, mayor: MAYOR_PAR,
    fallo: { rol: "porDocumento", desde: 1000, respuesta: { data: {}, error: null } } },
];

describe("ingresoDelPeriodo · transporte I2 FICTICIO, NO EJ financiero", () => {
  it("acepta [] acreditado sin inventar evidencia de una página ilegible", async () => {
    const stub = transporte(CASO_VACIO.datos);
    const dto = await ingresoDelPeriodo(stub.client, RANGO, { mayor: CASO_VACIO.mayor });
    expect(dto.facturado.total).toBe(0);
    expect(dto.facturas).toBe(0);
    expect(dto.controlI2).toMatchObject({ verificacion: "completa", unidadMayor: "usd", hayActividad: false, incidencias: [] });
    expect(describirIngreso(dto).estado).toBe("sin_movimiento");
    expect(stub.llamadas.filter(q => q.rol === "candidatos")).toHaveLength(1);
  });

  it("conserva subtotal 175 y una factura frente al mayor realmente vacío", async () => {
    const stub = transporte(CASO_OFICIAL.datos);
    const dto = await ingresoDelPeriodo(stub.client, RANGO, { mayor: CASO_OFICIAL.mayor });
    expect(dto.facturado).toEqual({ propio: 175, terceros: 0, total: 175 });
    expect(dto.facturas).toBe(1);
    expect(dto.diferenciaUsd).toBe(175);
    expect(describirIngreso(dto).estado).toBe("mayor_menor");
  });

  it("resuelve las seis lecturas por ID, el par USD y su ascendencia sin incluir manuales", async () => {
    const stub = transporte(CASO_PAR.datos);
    const dto = await ingresoDelPeriodo(stub.client, RANGO, { mayor: CASO_PAR.mayor });
    expect(dto.facturado.total).toBe(175);
    expect(dto.facturas).toBe(1);
    expect(dto.ajusteAnulacionesUsd).toBe(0);
    expect(dto.baseComparacionUsd).toBe(175);
    expect(dto.diferenciaUsd).toBe(175);
    expect(dto.mayor?.otrosIngresos).toBe(50);
    expect(dto.controlI2).toMatchObject({ verificacion: "completa", unidadMayor: "usd",
      hayActividad: true, contribucionesAjuste: 2, incidencias: [] });
    for (const rol of ROLES_ID) expect(stub.llamadas.some(q => q.rol === rol)).toBe(true);
    const headers = stub.llamadas.filter(q => ["candidatos", "porDocumento", "originales", "reversos"].includes(q.rol));
    expect(headers.flatMap(q => q.ids)).not.toContain(MANUAL);
    expect(stub.llamadas.some(q => q.rol === "cuentas"
      && q.filtros.some(f => f.campo === "id" && JSON.stringify(f.valor) === JSON.stringify([RAIZ])))).toBe(true);
    expect(stub.llamadas.some(q => q.rol === "candidatos" && q.desde === 2 && q.ids.length === 0)).toBe(true);
  });

  for (const caso of [CASO_ND, CASO_DOMINIO]) {
    it(caso.nombre + ": transporte válido conserva subtotal, conteo y ND del dominio", async () => {
      const stub = transporte(caso.datos);
      const dto = await ingresoDelPeriodo(stub.client, RANGO, { mayor: caso.mayor });
      expect(dto.facturado.total).toBe(175);
      expect(dto.facturas).toBe(1);
      expect(dto.ajusteAnulacionesUsd).toBeNull();
      expect(dto.diferenciaUsd).toBeNull();
      expect(dto.controlI2).toMatchObject({ verificacion: "requiere_revision", unidadMayor: "sin_verificar" });
      expect(describirIngreso(dto).estado).toBe("requiere_revision");
      expect(causaDelControlI2(dto)).toBeTruthy();
      const causa = caso === CASO_ND ? "documento_no_disponible" : "cabecera_invalida";
      expect(dto.controlI2.incidencias.some(i => i.codigo === causa && i.cantidad > 0)).toBe(true);
    });
  }

  it("conserva tres documentos nominales VES/CNY; 150 oficial no convierte 750 del mayor", async () => {
    const stub = transporte(CASO_NOMINAL.datos);
    const dto = await ingresoDelPeriodo(stub.client, RANGO, { mayor: CASO_NOMINAL.mayor });
    expect(dto.facturado).toEqual({ propio: 150, terceros: 0, total: 150 });
    expect(dto.facturas).toBe(2);
    expect(dto.sinConvertir).toBe(1);
    expect(dto.enOtraMoneda).toBe(3);
    expect(dto.mayor?.ventas).toBe(750);
    expect(dto.controlI2).toMatchObject({ verificacion: "completa", unidadMayor: "nominal_mixto", incidencias: [] });
    expect(dto.diferenciaUsd).toBeNull();
    expect(describirIngreso(dto).estado).toBe("no_comparable");
  });

  for (const caso of CASOS_MALOS) {
    it(caso.nombre + ": propaga el transporte ilegible, nunca un DTO completo", async () => {
      const stub = transporte(caso.datos, caso.fallo);
      await expect(ingresoDelPeriodo(stub.client, RANGO, { mayor: caso.mayor }))
        .rejects.toThrow(ETIQUETA[caso.fallo.rol]);
      expect(stub.fallosAplicados()).toBe(1);
      expect(stub.llamadas.at(-1)).toMatchObject({ rol: caso.fallo.rol, desde: 0, hasta: 999 });
    });
  }

  for (const caso of CASOS_ERROR) {
    it(caso.nombre + ": conserva identidad, código y causa nativa", async () => {
      const stub = transporte(caso.datos, caso.fallo);
      await expect(ingresoDelPeriodo(stub.client, RANGO, { mayor: caso.mayor })).rejects.toBe(caso.error);
      expect(caso.error.code).toBe("FICT_503");
      expect(caso.error.cause.message).toBe("FICT_causa_nativa_" + caso.fallo.rol);
      expect(stub.fallosAplicados()).toBe(1);
    });
  }

  for (const caso of CASOS_RESPUESTA) {
    it(caso.nombre + ": rechaza un envelope de transporte que no acredita filas", async () => {
      const stub = transporte(caso.datos, caso.fallo);
      await expect(ingresoDelPeriodo(stub.client, RANGO, { mayor: caso.mayor }))
        .rejects.toThrow(ETIQUETA.candidatos);
      expect(stub.fallosAplicados()).toBe(1);
    });
  }

  for (const caso of CASOS_POSTERIORES) {
    it(caso.nombre + ": un prefijo legible no acredita la página siguiente", async () => {
      const stub = transporte(caso.datos, caso.fallo);
      const fallo = caso.fallo!;
      await expect(ingresoDelPeriodo(stub.client, RANGO, { mayor: caso.mayor }))
        .rejects.toThrow(ETIQUETA[fallo.rol as Exclude<Rol, "oficial">]);
      const paginas = stub.llamadas.filter(q => q.rol === fallo.rol);
      expect(paginas).toHaveLength(2);
      expect(paginas[0]).toMatchObject({ desde: 0, hasta: 999 });
      expect(paginas[0].ids).toHaveLength(1000);
      expect(paginas[1]).toMatchObject({ desde: 1000, hasta: 1999 });
      expect(stub.fallosAplicados()).toBe(1);
    });
  }
});

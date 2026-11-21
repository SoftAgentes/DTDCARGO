// @vitest-environment node
/**
 * SDD-0690 · `--solo-facturas` corrido de verdad en PostgreSQL embebido (PGlite).
 *
 * Una pre-orden por CLIENTE: por el Shipping Mark vivo de los envíos al correr, no por la clave del
 * Excel. El rastro de la 0564/0569 admite un solo cliente vivo por contenedor, así que dos pre-órdenes
 * del mismo dueño no se podrían emitir (hallazgo del 64: el mapa mandaba 11 claves a DTD-0000 y 9 a DC).
 *
 * El bloque que corre es el MISMO `aplicar.sql` que genera `generarSql` (sin los meta-comandos de
 * psql), sobre un esquema mínimo: las tablas y columnas que toca, un `resolve_markbox` por markbox,
 * `next_invoice_code` con una secuencia y `append_audit_event` que no hace nada. Datos inventados.
 */
import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";
import { agruparLote, type FilaPacking, type Lote, type Rastreo } from "../consolidados/modelo";
import { generarSql, idDelPaquete, MARCA_SOLO_FACTURAS, type OpcionesSql } from "../consolidados/lote-sql";

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

// Dos claves del Excel: DTD-J031 con dos envíos y DTD-A116 con uno. Sin exceso de peso.
const fila = (filaExcel: number, marcaTexto: string, remitente: string, cbm: number, precio: number): FilaPacking => ({
  filaExcel, marcaTexto, remitente, descripcion: "Cajas", cajas: 1, pesoKg: 10, cbmChina: cbm, cbmFactura: cbm,
  extraKg: -100, precioKgExtra: 1, valorKgExtra: -100, precioCbm: precio, totalFacturado: cbm * precio, agente: "X",
});
const FILAS: FilaPacking[] = [
  fila(4, "DTD-J031 PRUEBA", "DTD-J031-05", 1, 800),
  fila(5, "DTD-J031 PRUEBA", "DTD-J031-06", 2, 800),
  fila(6, "DTD-A116 PRUEBA", "DTD-A116-06", 0.5, 750),
];

const LOTE = "carga-consolidado:59:deadbeef";
const SOLO: OpcionesSql = {
  entorno: "produccion",
  crearClientesFaltantes: false,
  facturas: true,
  pol: "NGB",
  polNombre: "Ningbo",
  containerType: "40HC",
  vessel: "Por confirmar",
  lote: LOTE,
  tenantSlug: "dtd",
  soloFacturas: true,
};

const T = "00000000-0000-0000-0000-000000000001";
const CONS = "00000000-0000-0000-0000-00000000c059";

const ESQUEMA = `
create table public.tenants (id uuid primary key, slug text, iva_enabled boolean);
create table public.clients (id uuid primary key, tenant_id uuid, markbox text, name text, rif text, doc_kind text,
  aliado_id uuid, deleted_at timestamptz);
create table public.aliados (id uuid primary key, parent_aliado_id uuid, client_id uuid);
create table public.consolidations (id uuid primary key, tenant_id uuid, container_no text, notes text, deleted_at timestamptz);
create table public.shipments (id uuid primary key, tenant_id uuid, code text, client_markbox text, deleted_at timestamptz);
create table public.consolidation_items (id uuid primary key default gen_random_uuid(), tenant_id uuid, shipment_id uuid,
  consolidation_id uuid, created_at timestamptz default now());
create table public.invoices (id uuid primary key default gen_random_uuid(), tenant_id uuid, invoice_code text,
  client_markbox text, client_name text, client_rif text, client_doc_kind text, shipment_id uuid, shipment_code text,
  currency text, iva_rate numeric, base_amount numeric, iva_amount numeric, total_amount numeric, status text,
  lines jsonb, notes text, fund_class text, deleted_at timestamptz);
create table public.exc0674_contenedores (tenant_id uuid, consolidation_id uuid);
create table public.exc0674_factura_envios (invoice_id uuid, shipment_id uuid);
create sequence public.codigos;
create function public.next_invoice_code(p uuid) returns text language sql as
$$ select 'F-T-' || lpad(nextval('public.codigos')::text, 4, '0') $$;
create function public.resolve_markbox(p uuid, m text)
returns table(client_id uuid, canonical_markbox text, was_redirected boolean) language sql stable as
$$ select c.id, c.markbox, false from public.clients c where c.tenant_id = p and upper(c.markbox) = upper(m) limit 1 $$;
create function public.append_audit_event(uuid, text, uuid, text, uuid, text, text, text, text, jsonb, jsonb, jsonb,
  text, integer, text) returns void language sql as $$ select $$;
insert into public.tenants values ('${T}', 'dtd', false);
insert into public.consolidations values ('${CONS}', '${T}', 'ABCU1234567', 'Carga ${LOTE} · contenedor DTD #59', null);
insert into public.exc0674_contenedores values ('${T}', '${CONS}');
insert into public.clients values
  ('00000000-0000-0000-0000-0000000005a1', '${T}', 'DTD-5001', 'Dueño Uno', null, null, null, null),
  ('00000000-0000-0000-0000-0000000005a2', '${T}', 'DTD-5002', 'Dueño Dos', null, null, null, null);`;

/** Los tres envíos del lote, cargados en el contenedor, con el dueño de cada uno. */
function envios(duenos: Record<string, string>): string {
  return Object.entries(duenos)
    .map(([code, mb], i) => {
      const id = `00000000-0000-0000-0000-00000000e00${i + 1}`;
      return `insert into public.shipments values ('${id}', '${T}', '${code}', '${mb}', null);
insert into public.consolidation_items (tenant_id, shipment_id, consolidation_id) values ('${T}', '${id}', '${CONS}');`;
    })
    .join("\n");
}

function loteDe(filas: FilaPacking[] = FILAS, excesoPeso = false): Lote {
  return agruparLote(RASTREO, filas, { eta: "2026-10-19", excesoPeso });
}

function sqlDe(l: Lote, paso: "aplicar" | "verificar"): string {
  const t = generarSql(l, SOLO, { rastreo: "a".repeat(64), packing: "d".repeat(64) })[paso];
  // Sin los meta-comandos de psql (\set …): PGlite no es psql.
  return t.split("\n").filter((x) => !x.startsWith("\\")).join("\n");
}

function aplicarSql(l: Lote = loteDe()): string {
  return sqlDe(l, "aplicar");
}

/** Corre verificar.sql sobre la base ya aplicada y devuelve su aviso (o lanza su FALLÓ). */
async function verificar(l: Lote): Promise<string> {
  const avisos: string[] = [];
  await db!.exec(sqlDe(l, "verificar"), { onNotice: (n) => avisos.push(n.message ?? "") });
  return avisos.find((a) => a.startsWith("verificar solo-facturas")) ?? "";
}

/** Base de unas líneas como la calcula el bloque: round(sum(qty × precio), 2). */
function base(lineas: { qty: number; unitPrice: number }[]): number {
  return Math.round(lineas.reduce((t, x) => t + x.qty * x.unitPrice, 0) * 100) / 100;
}

type Preorden = { client_markbox: string; shipment_code: string; base_amount: string; codigos: string; notes: string };

let db: PGlite | null = null;
afterEach(async () => {
  await db?.close();
  db = null;
});

async function correr(
  duenos: Record<string, string>,
  l: Lote = loteDe(),
): Promise<{ preordenes: Preorden[]; aviso: string }> {
  db = new PGlite();
  await db.exec(ESQUEMA + envios(duenos));
  const avisos: string[] = [];
  await db.exec(aplicarSql(l), { onNotice: (n) => avisos.push(n.message ?? "") });
  const r = await db.query<Preorden>(`
    select client_markbox, shipment_code, base_amount::text as base_amount, notes,
           (select string_agg(l ->> 'shipmentCode', ',' order by l ->> 'shipmentCode')
              from jsonb_array_elements(lines) l) as codigos
      from public.invoices where status = 'borrador' order by client_markbox`);
  return { preordenes: r.rows, aviso: avisos.find((a) => a.startsWith("solo-facturas lote")) ?? "" };
}

// PGlite arranca un Postgres entero en WASM: bajo carga tarda más que el tope de 5 s por prueba.
describe("SDD-0690 · --solo-facturas: una pre-orden por cliente (PGlite)", { timeout: 60_000 }, () => {
  it("dos claves del Excel con el mismo dueño dan UNA pre-orden con las líneas de las dos", async () => {
    const { preordenes, aviso } = await correr({ "DTD-J031-05": "DTD-5001", "DTD-J031-06": "DTD-5001", "DTD-A116-06": "DTD-5001" });
    expect(preordenes).toHaveLength(1);
    expect(preordenes[0]).toMatchObject({
      client_markbox: "DTD-5001",
      shipment_code: "DTD-J031-05",
      codigos: "DTD-A116-06,DTD-J031-05,DTD-J031-06",
      base_amount: "2775.00",
    });
    expect(preordenes[0].notes).toContain(`embarques: DTD-J031-05, DTD-J031-06, DTD-A116-06 · ${MARCA_SOLO_FACTURAS}`);
    expect(aviso).toBe(
      `solo-facturas lote ${LOTE}:facturas · contenedor ABCU1234567 · 1 Shipping Marks · 1 clientes con pre-orden nueva · 0 saltados (ya tenían factura viva) · 0 sin líneas`,
    );
  });

  it("una clave repartida entre dos dueños da DOS pre-órdenes, cada una con las líneas de sus envíos", async () => {
    const { preordenes, aviso } = await correr({ "DTD-J031-05": "DTD-5001", "DTD-J031-06": "DTD-5002", "DTD-A116-06": "DTD-5002" });
    expect(preordenes.map((p) => [p.client_markbox, p.codigos, p.base_amount])).toEqual([
      ["DTD-5001", "DTD-J031-05", "800.00"],
      ["DTD-5002", "DTD-A116-06,DTD-J031-06", "1975.00"],
    ]);
    expect(aviso).toContain("· 2 Shipping Marks · 2 clientes con pre-orden nueva · 0 saltados");
  });

  it("es idempotente por cliente: con la pre-orden ya creada, el segundo aplicar se salta a ese dueño", async () => {
    await correr({ "DTD-J031-05": "DTD-5001", "DTD-J031-06": "DTD-5002", "DTD-A116-06": "DTD-5002" });
    const avisos: string[] = [];
    await db!.exec(aplicarSql(), { onNotice: (n) => avisos.push(n.message ?? "") });
    const n = await db!.query<{ n: number }>("select count(*)::int as n from public.invoices");
    expect(n.rows[0].n).toBe(2);
    expect(avisos.find((a) => a.startsWith("solo-facturas lote"))).toContain(
      "· 2 Shipping Marks · 0 clientes con pre-orden nueva · 2 saltados",
    );
  });

  it("verificar pasa con una factura viva por Shipping Mark", async () => {
    await correr({ "DTD-J031-05": "DTD-5001", "DTD-J031-06": "DTD-5002", "DTD-A116-06": "DTD-5002" });
    expect(await verificar(loteDe())).toBe(
      "verificar solo-facturas: PASÓ · 2 de 2 clientes con una factura viva · 2 pre-órdenes de esta carga",
    );
  });

  it("verificar mira sólo a los dueños de envíos con alguna línea PROPIA, como aplicar", async () => {
    // DTD-J031-06 queda sin ninguna línea (como si su fila no generara cobro) y es de otro dueño. Su clave
    // sí tiene líneas (las de DTD-J031-05): con el criterio por clave, verificar le pedía factura a
    // DTD-5002 y daba un FALLÓ falso. aplicar no le crea pre-orden: cuenta 1 sin líneas.
    const l = loteDe();
    for (const c of l.clientes) c.lineas = c.lineas.filter((x) => x.remitente !== "DTD-J031-06");
    const { preordenes, aviso } = await correr(
      { "DTD-J031-05": "DTD-5001", "DTD-J031-06": "DTD-5002", "DTD-A116-06": "DTD-5001" },
      l,
    );
    expect(preordenes.map((p) => p.client_markbox)).toEqual(["DTD-5001"]);
    expect(aviso).toContain("· 2 Shipping Marks · 1 clientes con pre-orden nueva · 0 saltados (ya tenían factura viva) · 1 sin líneas");
    expect(await verificar(l)).toBe(
      "verificar solo-facturas: PASÓ · 1 de 1 clientes con una factura viva · 1 pre-órdenes de esta carga",
    );
  });

  it("invariante: lo que suman las pre-órdenes por dueño es lo que suman las líneas por clave (con exceso de peso)", async () => {
    // DTD-J031-05 lleva DOS líneas en el mismo envío: el flete y el exceso de peso.
    const filas = FILAS.map((f) =>
      f.remitente === "DTD-J031-05" ? { ...f, extraKg: 50, precioKgExtra: 0.8, valorKgExtra: 40 } : f,
    );
    const l = loteDe(filas, true);
    const duenos = { "DTD-J031-05": "DTD-5001", "DTD-J031-06": "DTD-5002", "DTD-A116-06": "DTD-5002" };
    const lineas = l.clientes.flatMap((c) => c.lineas);
    expect(lineas.filter((x) => x.remitente === "DTD-J031-05")).toHaveLength(2);
    const { preordenes } = await correr(duenos, l);
    // Por dueño: la base de su pre-orden es la de las líneas de sus envíos, y lleva todas esas líneas.
    for (const p of preordenes) {
      const suyas = lineas.filter((x) => duenos[x.remitente as keyof typeof duenos] === p.client_markbox);
      expect(Number(p.base_amount)).toBe(base(suyas));
      expect(p.codigos.split(",")).toHaveLength(suyas.length);
    }
    // En total: la suma por dueño es la suma por clave del Excel.
    const porDueno = Math.round(preordenes.reduce((t, p) => t + Number(p.base_amount), 0) * 100) / 100;
    const porClave = Math.round(l.clientes.reduce((t, c) => t + base(c.lineas), 0) * 100) / 100;
    expect(porDueno).toBe(porClave);
    expect(preordenes.map((p) => [p.client_markbox, p.base_amount])).toEqual([
      ["DTD-5001", "840.00"],
      ["DTD-5002", "1975.00"],
    ]);
  });

  it("un envío sin Shipping Mark aborta todo sin escribir", async () => {
    await expect(correr({ "DTD-J031-05": "DTD-5001", "DTD-J031-06": "", "DTD-A116-06": "DTD-5001" })).rejects.toThrow(
      "solo-facturas: 1 envíos del lote no tienen Shipping Mark",
    );
    // El aplicar quedó a medias en su transacción: se cierra como lo cerraría psql (ON_ERROR_STOP).
    await db!.exec("rollback");
    const n = await db!.query<{ n: number }>("select count(*)::int as n from public.invoices");
    expect(n.rows[0].n).toBe(0);
  });
});

// SDD-0690 · --excluir-markbox: la clave DTD-A116 está mapeada al comodín DTD-0000 y su envío sigue ahí.
describe("SDD-0690 · --solo-facturas con --excluir-markbox (PGlite)", { timeout: 60_000 }, () => {
  const MAPA = { "DTD-A116": "DTD-0000" };
  const CON: OpcionesSql = { ...SOLO, excluirMarkbox: ["DTD-0000"] };

  const paquete = () =>
    generarSql(agruparLote(RASTREO, FILAS, { eta: "2026-10-19", mapa: MAPA, excesoPeso: false, excluirMarkbox: ["DTD-0000"] }), CON, {
      rastreo: "a".repeat(64),
      packing: "d".repeat(64),
    });
  const sinPsql = (t: string) => t.split("\n").filter((x) => !x.startsWith("\\")).join("\n");

  async function correrExcluyendo(duenos: Record<string, string>): Promise<{ preordenes: Preorden[]; aviso: string }> {
    const sql = sinPsql(paquete().aplicar);
    db = new PGlite();
    await db.exec(ESQUEMA + envios(duenos));
    const avisos: string[] = [];
    await db.exec(sql, { onNotice: (n) => avisos.push(n.message ?? "") });
    const r = await db.query<Preorden>(`
      select client_markbox, shipment_code, base_amount::text as base_amount, notes,
             (select string_agg(l ->> 'shipmentCode', ',' order by l ->> 'shipmentCode')
                from jsonb_array_elements(lines) l) as codigos
        from public.invoices where status = 'borrador' order by client_markbox`);
    return { preordenes: r.rows, aviso: avisos.find((a) => a.startsWith("solo-facturas lote")) ?? "" };
  }

  it("los envíos del markbox excluido no llevan pre-orden ni línea, y el aviso nombra el paquete nuevo", async () => {
    const { preordenes, aviso } = await correrExcluyendo({ "DTD-J031-05": "DTD-5001", "DTD-J031-06": "DTD-5001", "DTD-A116-06": "DTD-0000" });
    expect(preordenes.map((p) => [p.client_markbox, p.codigos, p.base_amount])).toEqual([["DTD-5001", "DTD-J031-05,DTD-J031-06", "2400.00"]]);
    expect(preordenes.some((p) => p.client_markbox === "DTD-0000")).toBe(false);
    expect(aviso).toBe(
      `solo-facturas lote ${idDelPaquete(CON)} · contenedor ABCU1234567 · 1 Shipping Marks · 1 clientes con pre-orden nueva · 0 saltados (ya tenían factura viva) · 0 sin líneas`,
    );
  });

  it("aborta sin escribir si un envío que entra está hoy en el markbox excluido", async () => {
    await expect(
      correrExcluyendo({ "DTD-J031-05": "DTD-5001", "DTD-J031-06": "DTD-0000", "DTD-A116-06": "DTD-0000" }),
    ).rejects.toThrow("solo-facturas: 1 envíos del lote están hoy en un Shipping Mark excluido (--excluir-markbox); vuelve a generar");
    await db!.exec("rollback");
    const n = await db!.query<{ n: number }>("select count(*)::int as n from public.invoices");
    expect(n.rows[0].n).toBe(0);
  });

  it("M1: aborta sin escribir si un envío excluido ya se reasignó al dueño de envíos que entran", async () => {
    // DTD-A116-06 sale por el mapa (DTD-0000), pero en la base ya es de DTD-5001, que también tiene envíos que entran.
    // Sin la guarda: la pre-orden de DTD-5001 sale sin él, verificar da PASÓ y el lote de después se salta a DTD-5001.
    await expect(
      correrExcluyendo({ "DTD-J031-05": "DTD-5001", "DTD-J031-06": "DTD-5001", "DTD-A116-06": "DTD-5001" }),
    ).rejects.toThrow(
      "solo-facturas: 1 envíos excluidos ya están en un Shipping Mark fuera de la lista (--excluir-markbox): quedarían sin facturar; vuelve a generar sin excluirlos",
    );
    await db!.exec("rollback");
    const n = await db!.query<{ n: number }>("select count(*)::int as n from public.invoices");
    expect(n.rows[0].n).toBe(0);
  });

  it("M1: también aborta si el excluido reasignado es de un cliente que no tiene envíos que entren", async () => {
    await expect(
      correrExcluyendo({ "DTD-J031-05": "DTD-5001", "DTD-J031-06": "DTD-5001", "DTD-A116-06": "DTD-5002" }),
    ).rejects.toThrow("1 envíos excluidos ya están en un Shipping Mark fuera de la lista");
    await db!.exec("rollback");
  });

  async function previaExclusion(duenos: Record<string, string>): Promise<Record<string, number>> {
    db = new PGlite();
    await db.exec(ESQUEMA + envios(duenos));
    const res = await db.exec(sinPsql(paquete().previa));
    const fila = res.map((r) => r.rows[0] as Record<string, unknown> | undefined).find((r) => r && "excluidos_por_markbox" in r);
    if (!fila) throw new Error("la previa no devolvió la consulta de exclusión");
    return Object.fromEntries(Object.entries(fila).map(([k, v]) => [k, Number(v)]));
  }

  it("B1: la consulta de exclusión de la previa corre y cuenta cada caso", async () => {
    // Un envío que entra (DTD-J031-06) está en el comodín y hay dos del contenedor en el comodín que el Excel no trae.
    expect(
      await previaExclusion({ "DTD-J031-05": "DTD-5001", "DTD-J031-06": "DTD-0000", "DTD-A116-06": "DTD-0000", "DTD-OTRO-01": "DTD-0000", "DTD-OTRO-02": "DTD-0000" }),
    ).toEqual({
      excluidos_por_markbox: 1,
      excluidos_en_el_contenedor: 1,
      excluidos_hoy_en_markbox_excluido: 1,
      excluidos_en_otro_markbox: 0,
      incluidos_en_markbox_excluido: 1,
      otros_del_contenedor_en_markbox_excluido: 2,
    });
    await db!.close();
    // El excluido ya se reasignó (M1): la columna que tiene que dar 0 da 1.
    expect(await previaExclusion({ "DTD-J031-05": "DTD-5001", "DTD-J031-06": "DTD-5001", "DTD-A116-06": "DTD-5001" })).toEqual({
      excluidos_por_markbox: 1,
      excluidos_en_el_contenedor: 1,
      excluidos_hoy_en_markbox_excluido: 0,
      excluidos_en_otro_markbox: 1,
      incluidos_en_markbox_excluido: 0,
      otros_del_contenedor_en_markbox_excluido: 0,
    });
  });
});

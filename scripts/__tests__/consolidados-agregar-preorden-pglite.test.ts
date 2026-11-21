// @vitest-environment node
/**
 * SDD-0690 · `--solo-markbox DTD-0000 --agregar-a-preorden`, corrido de verdad en PGlite.
 *
 * El caso del 64: hoy se cargaron las pre-órdenes sin los envíos del comodín (`--excluir-markbox
 * DTD-0000`). El lunes la oficina reasigna esos envíos a sus clientes reales, y algunos de esos
 * clientes ya tienen pre-orden de hoy. El lote chico les agrega las líneas en vez de saltarlos.
 *
 * El bloque que corre es el MISMO `aplicar.sql` que genera `generarSql` (sin los meta-comandos de
 * psql), sobre el esquema mínimo de `consolidados-solo-facturas-pglite.test.ts` más
 * `exc0674_facturas`. Datos inventados; DTD-0000 es el comodín del sistema.
 */
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { agruparLote, type FilaPacking, type Rastreo } from "../consolidados/modelo";
import { generarSql, idDelPaquete, MARCA_AGREGADO, MARCA_SOLO_FACTURAS, SUFIJO_SOLO_FACTURAS, type OpcionesSql } from "../consolidados/lote-sql";
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

const fila = (filaExcel: number, marcaTexto: string, remitente: string, cbm: number, precio: number): FilaPacking => ({
  filaExcel, marcaTexto, remitente, descripcion: "Cajas", cajas: 1, pesoKg: 10, cbmChina: cbm, cbmFactura: cbm,
  extraKg: -100, precioKgExtra: 1, valorKgExtra: -100, precioCbm: precio, totalFacturado: cbm * precio, agente: "X",
});
// DTD-J031 entra hoy. DTD-A116 y DTD-B200 el mapa los manda al comodín: hoy quedan fuera y entran el lunes.
const FILAS: FilaPacking[] = [
  fila(4, "DTD-J031 PRUEBA", "DTD-J031-05", 1, 800),
  fila(5, "DTD-J031 PRUEBA", "DTD-J031-06", 2, 800),
  fila(6, "DTD-A116 PRUEBA", "DTD-A116-06", 0.5, 750),
  fila(7, "DTD-B200 PRUEBA", "DTD-B200-01", 1, 700),
];
const MAPA = { "DTD-A116": "DTD-0000", "DTD-B200": "DTD-0000" };

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
const HOY: OpcionesSql = { ...SOLO, excluirMarkbox: ["DTD-0000"] };
const LUNES: OpcionesSql = { ...SOLO, soloMarkbox: ["DTD-0000"], agregarAPreorden: true };
const FUENTES = { rastreo: "a".repeat(64), packing: "d".repeat(64) };

const T = "00000000-0000-0000-0000-000000000001";
const CONS = "00000000-0000-0000-0000-00000000c059";
const ID: Record<string, string> = {
  "DTD-J031-05": "00000000-0000-0000-0000-00000000e001",
  "DTD-J031-06": "00000000-0000-0000-0000-00000000e002",
  "DTD-A116-06": "00000000-0000-0000-0000-00000000e003",
  "DTD-B200-01": "00000000-0000-0000-0000-00000000e004",
};

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
create table public.exc0674_facturas (tenant_id uuid, consolidation_id uuid, client_markbox text, anulada_at timestamptz);
create sequence public.codigos;
create function public.next_invoice_code(p uuid) returns text language sql as
$$ select 'F-T-' || lpad(nextval('public.codigos')::text, 4, '0') $$;
create function public.resolve_markbox(p uuid, m text)
returns table(client_id uuid, canonical_markbox text, was_redirected boolean) language sql stable as
$$ select c.id, c.markbox, false from public.clients c where c.tenant_id = p and upper(c.markbox) = upper(m) limit 1 $$;
create table public.auditoria (event_type text, entity_id uuid);
create function public.append_audit_event(p_tenant uuid, p_entity text, p_id uuid, p_actor text, p_actor_id uuid, p_event text,
  p_source text, p_result text, p_summary text, p_before jsonb, p_after jsonb, p_payload jsonb, p_corr text, p_version integer,
  p_visibility text) returns void language sql as $$ insert into public.auditoria values (p_event, p_id) $$;
insert into public.tenants values ('${T}', 'dtd', false);
insert into public.consolidations values ('${CONS}', '${T}', 'ABCU1234567', 'Carga ${LOTE} · contenedor DTD #59', null);
insert into public.exc0674_contenedores values ('${T}', '${CONS}');
insert into public.clients values
  ('00000000-0000-0000-0000-0000000005a1', '${T}', 'DTD-5001', 'Dueño Uno', null, null, null, null),
  ('00000000-0000-0000-0000-0000000005a2', '${T}', 'DTD-5002', 'Dueño Dos', null, null, null, null);
${Object.entries(ID)
  .map(
    ([code, id]) => `insert into public.shipments values ('${id}', '${T}', '${code}', '${code.startsWith("DTD-J031") ? "DTD-5001" : "DTD-0000"}', null);
insert into public.consolidation_items (tenant_id, shipment_id, consolidation_id) values ('${T}', '${id}', '${CONS}');`,
  )
  .join("\n")}`;

// generadoEn sale de new Date(): fijo, para comparar.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-23T12:00:00Z"));
});

const sinPsql = (t: string) => t.split("\n").filter((x) => !x.startsWith("\\")).join("\n");
const paqueteHoy = () => generarSql(agruparLote(RASTREO, FILAS, { eta: "2026-10-19", mapa: MAPA, excesoPeso: false, excluirMarkbox: ["DTD-0000"] }), HOY, FUENTES);
const paqueteLunes = () => generarSql(agruparLote(RASTREO, FILAS, { eta: "2026-10-19", mapa: MAPA, excesoPeso: false, soloMarkbox: ["DTD-0000"] }), LUNES, FUENTES);

let db: PGlite | null = null;
afterEach(async () => {
  await db?.close();
  db = null;
});

type Preorden = { client_markbox: string; status: string; base_amount: string; total_amount: string; codigos: string; notes: string };

/** La base después del paquete de hoy: una pre-orden de DTD-5001 con los dos envíos de DTD-J031. */
async function baseDeHoy(antes = ""): Promise<PGlite> {
  db = new PGlite();
  await db.exec(ESQUEMA);
  if (antes) await db.exec(antes);
  await db.exec(sinPsql(paqueteHoy().aplicar));
  return db;
}

/** La oficina reasigna los envíos del comodín («Asignar cliente»). */
async function reasignar(duenos: Record<string, string>): Promise<void> {
  for (const [code, mb] of Object.entries(duenos)) {
    await db!.exec(`update public.shipments set client_markbox = '${mb}' where id = '${ID[code]}'`);
  }
}

async function aplicarLunes(): Promise<string> {
  const avisos: string[] = [];
  await db!.exec(sinPsql(paqueteLunes().aplicar), { onNotice: (n) => avisos.push(n.message ?? "") });
  return avisos.find((a) => a.startsWith("agregar-a-preorden lote")) ?? "";
}

async function preordenes(): Promise<Preorden[]> {
  const r = await db!.query<Preorden>(`
    select client_markbox, status, base_amount::text as base_amount, total_amount::text as total_amount, notes,
           (select string_agg(l ->> 'shipmentCode', ',' order by l ->> 'shipmentCode') from jsonb_array_elements(lines) l) as codigos
      from public.invoices where deleted_at is null order by client_markbox`);
  return r.rows;
}

async function verificar(): Promise<string> {
  const avisos: string[] = [];
  await db!.exec(sinPsql(paqueteLunes().verificar), { onNotice: (n) => avisos.push(n.message ?? "") });
  return avisos.find((a) => a.startsWith("verificar agregar")) ?? "";
}

async function previa(): Promise<Record<string, number>> {
  const res = await db!.exec(sinPsql(paqueteLunes().previa));
  const f = res.map((r) => r.rows[0] as Record<string, unknown> | undefined).find((r) => r && "envios_a_cargar" in r);
  if (!f) throw new Error("la previa no devolvió los conteos de agregar");
  return Object.fromEntries(Object.entries(f).map(([k, v]) => [k, Number(v)]));
}

async function sinCambios(antes: Preorden[]): Promise<void> {
  await db!.exec("rollback");
  expect(await preordenes()).toEqual(antes);
}

describe("SDD-0690 · --agregar-a-preorden (PGlite)", { timeout: 90_000 }, () => {
  it("el paquete de hoy deja una sola pre-orden, sin los envíos del comodín", async () => {
    await baseDeHoy();
    expect((await preordenes()).map((p) => [p.client_markbox, p.codigos, p.base_amount])).toEqual([["DTD-5001", "DTD-J031-05,DTD-J031-06", "2400.00"]]);
  });

  it("al cliente con pre-orden le agrega las líneas y recalcula; al cliente nuevo le crea la pre-orden", async () => {
    await baseDeHoy();
    await reasignar({ "DTD-A116-06": "DTD-5001", "DTD-B200-01": "DTD-5002" });
    expect(await previa()).toEqual({
      envios_a_cargar: 2,
      envios_cargados: 2,
      siguen_en_markbox_de_origen: 0,
      sin_shipping_mark: 0,
      sin_cliente_a_facturar: 0,
      ya_con_linea_en_factura_viva: 0,
      preordenes_destino_no_borrador: 0,
      clientes_con_varias_preordenes: 0,
      preordenes_destino_otro_titular: 0,
      clientes_ya_emitidos_en_el_contenedor: 0,
      a_preorden_existente: 1,
      a_preorden_nueva: 1,
    });
    const aviso = await aplicarLunes();
    expect(aviso).toBe(
      `agregar-a-preorden lote ${idDelPaquete(LUNES)} · contenedor ABCU1234567 · 2 envíos · 2 Shipping Marks · 1 pre-órdenes con líneas agregadas · 1 pre-órdenes nuevas · 0 sin líneas`,
    );
    const p = await preordenes();
    expect(p.map((x) => [x.client_markbox, x.status, x.codigos, x.base_amount, x.total_amount])).toEqual([
      ["DTD-5001", "borrador", "DTD-A116-06,DTD-J031-05,DTD-J031-06", "2775.00", "2775.00"],
      ["DTD-5002", "borrador", "DTD-B200-01", "700.00", "700.00"],
    ]);
    expect(p[0].notes).toContain(`agregados: DTD-A116-06 · ${MARCA_AGREGADO}`);
    expect(p[1].notes).toContain(`${MARCA_SOLO_FACTURAS} · ${MARCA_AGREGADO}`);
    expect(await verificar()).toBe("verificar agregar: PASÓ · 2 de 2 envíos en una pre-orden de su cliente · 2 pre-órdenes tocadas cuadran con sus líneas");
    const audit = await db!.query<{ event_type: string }>("select event_type from public.auditoria order by 1");
    expect(audit.rows.map((r) => r.event_type)).toEqual(["invoice_imported", "invoice_imported", "invoice_lines_appended"]);
  });

  it("dos envíos reasignados a un cliente sin pre-orden dan UNA pre-orden nueva con los dos", async () => {
    await baseDeHoy();
    await reasignar({ "DTD-A116-06": "DTD-5002", "DTD-B200-01": "DTD-5002" });
    expect(await previa()).toMatchObject({ a_preorden_existente: 0, a_preorden_nueva: 2 });
    expect(await aplicarLunes()).toContain("· 2 envíos · 1 Shipping Marks · 0 pre-órdenes con líneas agregadas · 1 pre-órdenes nuevas ·");
    expect((await preordenes()).map((x) => [x.client_markbox, x.codigos, x.base_amount])).toEqual([
      ["DTD-5001", "DTD-J031-05,DTD-J031-06", "2400.00"],
      ["DTD-5002", "DTD-A116-06,DTD-B200-01", "1075.00"],
    ]);
    expect(await verificar()).toContain("PASÓ · 2 de 2 envíos");
  });

  it("una segunda corrida se niega y no duplica", async () => {
    await baseDeHoy();
    await reasignar({ "DTD-A116-06": "DTD-5001", "DTD-B200-01": "DTD-5002" });
    await aplicarLunes();
    const antes = await preordenes();
    // Ahora los dos destinos tienen pre-orden: la previa los cuenta como existentes, ninguno nuevo.
    expect(await previa()).toMatchObject({ ya_con_linea_en_factura_viva: 2, a_preorden_existente: 2, a_preorden_nueva: 0 });
    await expect(aplicarLunes()).rejects.toThrow("agregar: 2 envíos del lote ya tienen línea en una factura viva; no se cargan dos veces");
    await sinCambios(antes);
  });

  it("si la pre-orden del cliente ya fue emitida, aborta sin tocar nada", async () => {
    await baseDeHoy();
    await db!.exec("update public.invoices set status = 'emitida'");
    await reasignar({ "DTD-A116-06": "DTD-5001", "DTD-B200-01": "DTD-5002" });
    expect((await previa()).preordenes_destino_no_borrador).toBe(1);
    const antes = await preordenes();
    await expect(aplicarLunes()).rejects.toThrow("ya no está en borrador (emitida, pagada o anulada); no se toca");
    await sinCambios(antes);
  });

  it("una pre-orden anulada también aborta (no se crea otra encima)", async () => {
    await baseDeHoy();
    await db!.exec("update public.invoices set status = 'anulada'");
    await reasignar({ "DTD-A116-06": "DTD-5001", "DTD-B200-01": "DTD-5002" });
    const antes = await preordenes();
    await expect(aplicarLunes()).rejects.toThrow("ya no está en borrador");
    await sinCambios(antes);
  });

  it("si el cliente ya está facturado en el contenedor por la regla 0564/0569, aborta", async () => {
    await baseDeHoy();
    await db!.exec(`insert into public.exc0674_facturas values ('${T}', '${CONS}', 'DTD-5002', null)`);
    await reasignar({ "DTD-A116-06": "DTD-5001", "DTD-B200-01": "DTD-5002" });
    expect((await previa()).clientes_ya_emitidos_en_el_contenedor).toBe(1);
    const antes = await preordenes();
    await expect(aplicarLunes()).rejects.toThrow("ya tiene factura emitida en el contenedor; no se toca");
    await sinCambios(antes);
  });

  it("un envío que sigue en DTD-0000 aborta, y la previa lo cuenta", async () => {
    await baseDeHoy();
    await reasignar({ "DTD-A116-06": "DTD-5001" });
    expect((await previa()).siguen_en_markbox_de_origen).toBe(1);
    const antes = await preordenes();
    await expect(aplicarLunes()).rejects.toThrow("agregar: 1 envíos del lote siguen en un Shipping Mark de --solo-markbox; reasígnalos antes de cargar");
    await sinCambios(antes);
  });

  it("un envío que ya está en una factura viva por la tabla de envíos cubiertos también cuenta como cargado", async () => {
    await baseDeHoy();
    await reasignar({ "DTD-A116-06": "DTD-5001", "DTD-B200-01": "DTD-5002" });
    const inv = await db!.query<{ id: string }>("select id from public.invoices limit 1");
    await db!.exec(`insert into public.exc0674_factura_envios values ('${inv.rows[0].id}', '${ID["DTD-B200-01"]}')`);
    await expect(aplicarLunes()).rejects.toThrow("agregar: 1 envíos del lote ya tienen línea en una factura viva");
    await db!.exec("rollback");
  });

  it("verificar falla si una pre-orden tocada no cuadra con sus líneas", async () => {
    await baseDeHoy();
    await reasignar({ "DTD-A116-06": "DTD-5001", "DTD-B200-01": "DTD-5002" });
    await aplicarLunes();
    await db!.exec("update public.invoices set total_amount = total_amount + 1 where client_markbox = 'DTD-5001'");
    await expect(verificar()).rejects.toThrow("verificar agregar: 1 pre-órdenes tocadas con base, IVA o total distintos de la suma de sus líneas");
  });

  // M1 de la revisión de la #756: dos clientes del mismo aliado raíz. La pre-orden de uno no recibe las líneas del otro.
  const ALIADO = `
insert into public.clients values
  ('00000000-0000-0000-0000-0000000005a3', '${T}', 'DTD-5003', 'Sub Uno', null, null, '00000000-0000-0000-0000-0000000000a1', null),
  ('00000000-0000-0000-0000-0000000005a4', '${T}', 'DTD-5004', 'Sub Dos', null, null, '00000000-0000-0000-0000-0000000000a1', null),
  ('00000000-0000-0000-0000-0000000005a9', '${T}', 'DTD-5009', 'Raíz', null, null, null, null);
insert into public.aliados values ('00000000-0000-0000-0000-0000000000a1', null, '00000000-0000-0000-0000-0000000005a9');
update public.shipments set client_markbox = 'DTD-5003' where code like 'DTD-J031-%';`;

  it("M1: con aliado raíz, el envío reasignado a otro cliente del aliado lleva su propia pre-orden", async () => {
    await baseDeHoy(ALIADO);
    // El sábado: la pre-orden de DTD-5003 (sus envíos DTD-J031), facturada a la raíz DTD-5009.
    expect((await preordenes()).map((x) => [x.client_markbox, x.codigos])).toEqual([["DTD-5009", "DTD-J031-05,DTD-J031-06"]]);
    // El lunes: DTD-A116-06 pasa a DTD-5004 (mismo aliado, sin pre-orden) y DTD-B200-01 a DTD-5003 (con pre-orden).
    await reasignar({ "DTD-A116-06": "DTD-5004", "DTD-B200-01": "DTD-5003" });
    expect(await previa()).toMatchObject({ a_preorden_existente: 1, a_preorden_nueva: 1, preordenes_destino_otro_titular: 0, clientes_con_varias_preordenes: 0 });
    expect(await aplicarLunes()).toContain("· 2 envíos · 2 Shipping Marks · 1 pre-órdenes con líneas agregadas · 1 pre-órdenes nuevas ·");
    const r = await db!.query<{ dueno: string; client_markbox: string; codigos: string; base_amount: string }>(`
      select s.client_markbox as dueno, iv.client_markbox, iv.base_amount::text as base_amount,
             (select string_agg(l ->> 'shipmentCode', ',' order by l ->> 'shipmentCode') from jsonb_array_elements(iv.lines) l) as codigos
        from public.invoices iv join public.shipments s on s.id = iv.shipment_id order by s.client_markbox`);
    expect(r.rows).toEqual([
      { dueno: "DTD-5003", client_markbox: "DTD-5009", codigos: "DTD-B200-01,DTD-J031-05,DTD-J031-06", base_amount: "3100.00" },
      { dueno: "DTD-5004", client_markbox: "DTD-5009", codigos: "DTD-A116-06", base_amount: "375.00" },
    ]);
    expect(await verificar()).toContain("PASÓ · 2 de 2 envíos");
  });

  it("M1: verificar falla si el envío quedó en la pre-orden de otro cliente del mismo aliado", async () => {
    await baseDeHoy(ALIADO);
    await reasignar({ "DTD-A116-06": "DTD-5004", "DTD-B200-01": "DTD-5003" });
    await aplicarLunes();
    // Se simula el error de antes: las líneas de DTD-A116-06 terminan en la pre-orden de DTD-5003 (mismo titular).
    await db!.exec(`
      update public.invoices iv set lines = iv.lines || (select n.lines from public.invoices n join public.shipments s on s.id = n.shipment_id where s.code = 'DTD-A116-06')
        from public.shipments s where s.id = iv.shipment_id and s.code = 'DTD-J031-05';
      update public.invoices iv set deleted_at = now() from public.shipments s where s.id = iv.shipment_id and s.code = 'DTD-A116-06';
      update public.invoices set base_amount = 3475, total_amount = 3475 where deleted_at is null;`);
    await expect(verificar()).rejects.toThrow("verificar agregar: 1 envíos en una factura que no es una pre-orden de esta carga de su cliente");
  });

  it("M1: si la pre-orden del cliente factura a otro titular, aborta y la previa lo cuenta", async () => {
    await baseDeHoy();
    await db!.exec("update public.invoices set client_markbox = 'DTD-5002'");
    await reasignar({ "DTD-A116-06": "DTD-5001", "DTD-B200-01": "DTD-5002" });
    expect((await previa()).preordenes_destino_otro_titular).toBe(1);
    const antes = await preordenes();
    await expect(aplicarLunes()).rejects.toThrow("agregar: la pre-orden de la marca DTD-A116 factura a otro titular; resuélvelo a mano");
    await sinCambios(antes);
  });

  it("B1: con IVA, la pre-orden existente recalcula con su propio IVA y la nueva con el del tenant", async () => {
    // El sábado con IVA (16 %); el lunes el tenant ya no lo cobra: la existente conserva su 16 %, la nueva sale en 0.
    await baseDeHoy(`update public.tenants set iva_enabled = true`);
    expect((await preordenes()).map((x) => [x.base_amount, x.total_amount])).toEqual([["2400.00", "2784.00"]]);
    await db!.exec("update public.tenants set iva_enabled = false");
    await reasignar({ "DTD-A116-06": "DTD-5001", "DTD-B200-01": "DTD-5002" });
    await aplicarLunes();
    const r = await db!.query<{ client_markbox: string; iva_rate: string; base_amount: string; iva_amount: string; total_amount: string }>(`
      select client_markbox, iva_rate::text as iva_rate, base_amount::text as base_amount, iva_amount::text as iva_amount, total_amount::text as total_amount
        from public.invoices order by client_markbox`);
    expect(r.rows).toEqual([
      { client_markbox: "DTD-5001", iva_rate: "16", base_amount: "2775.00", iva_amount: "444.00", total_amount: "3219.00" },
      { client_markbox: "DTD-5002", iva_rate: "0", base_amount: "700.00", iva_amount: "0.00", total_amount: "700.00" },
    ]);
    expect(await verificar()).toContain("PASÓ · 2 de 2 envíos en una pre-orden de su cliente · 2 pre-órdenes tocadas cuadran");
    // Con un IVA descuadrado, verificar lo ve.
    await db!.exec("update public.invoices set iva_amount = iva_amount + 1, total_amount = total_amount + 1 where client_markbox = 'DTD-5001'");
    await expect(verificar()).rejects.toThrow("1 pre-órdenes tocadas con base, IVA o total distintos");
  });

  it("verificar falla si un envío quedó en la factura de otro cliente", async () => {
    await baseDeHoy();
    await reasignar({ "DTD-A116-06": "DTD-5001", "DTD-B200-01": "DTD-5002" });
    await aplicarLunes();
    await db!.exec("update public.shipments set client_markbox = 'DTD-5002' where code = 'DTD-A116-06'");
    await expect(verificar()).rejects.toThrow("verificar agregar: 1 envíos en una factura que no es una pre-orden de esta carga de su cliente");
  });
});

describe("SDD-0690 · --agregar-a-preorden: forma del paquete", () => {
  it("tiene id propio, distinto del de la carga, del paquete completo y del de --excluir-markbox", () => {
    const id = idDelPaquete(LUNES);
    expect(id).toMatch(/^carga-consolidado:59:[0-9a-f]{8}:facturas$/);
    expect(id).toMatch(/^carga-consolidado:[0-9]+:[0-9a-f]+(:facturas)?$/);
    for (const otro of [LOTE, idDelPaquete(SOLO), idDelPaquete(HOY), `${LOTE}${SUFIJO_SOLO_FACTURAS}`]) expect(id).not.toBe(otro);
    const s = paqueteLunes();
    expect(s.manifiesto.lote).toBe(id);
    for (const script of [s.previa, s.aplicar, s.simulacro, s.verificar, s.deshacer]) expect(script).toContain(id);
    expect(s.simulacro.trimEnd().endsWith("rollback;")).toBe(true);
    expect(s.aplicar.match(/^begin;$/gm)).toHaveLength(1);
    expect(s.deshacer).toContain("no se deshace por partes");
  });

  it("el manifiesto dice qué entra, sólo con conteos", () => {
    const m = paqueteLunes().manifiesto;
    expect(m.agregarAPreorden).toMatchObject({ soloMarkbox: ["DTD-0000"], clientes: 2, envios: 2, filas: 2, enviosFuera: 2 });
    expect(JSON.stringify(m.agregarAPreorden)).not.toMatch(/\$|base|monto|DTD-A116|DTD-B200/);
    expect(m.esperado).toMatchObject({ envios: 2, clientes: 2 });
  });

  it("las opciones van juntas y sólo con --solo-facturas", () => {
    const l = agruparLote(RASTREO, FILAS, { eta: "2026-10-19", mapa: MAPA, soloMarkbox: ["DTD-0000"] });
    expect(() => generarSql(l, { ...LUNES, soloFacturas: false }, FUENTES)).toThrow(/sólo va con --solo-facturas/);
    expect(() => generarSql(l, { ...LUNES, agregarAPreorden: false }, FUENTES)).toThrow(/--solo-markbox sólo va con --agregar-a-preorden/);
    expect(() => generarSql(agruparLote(RASTREO, FILAS, { eta: "2026-10-19", mapa: MAPA }), LUNES, FUENTES)).toThrow(/no se filtró con la misma lista/);
    expect(() => agruparLote(RASTREO, FILAS, { eta: "2026-10-19", soloMarkbox: ["DTD-0000"], excluirMarkbox: ["DTD-0000"] })).toThrow(/no van juntos/);
    expect(() => agruparLote(RASTREO, FILAS, { eta: "2026-10-19", mapa: MAPA, soloMarkbox: ["DTD-9999"] })).toThrow(/ningún cliente del lote tiene el Shipping Mark DTD-9999/);
    const base = ["--rastreo", "r.xlsx", "--packing", "p.xlsx", "--contenedor", "59", "--eta", "2026-10-19", "--salida", "s"];
    expect(parsearArgumentos([...base, "--solo-facturas", "--solo-markbox", "dtd-0000", "--agregar-a-preorden"])).toMatchObject({
      soloMarkbox: ["DTD-0000"],
      agregarAPreorden: true,
    });
    expect(() => parsearArgumentos([...base, "--solo-facturas", "--agregar-a-preorden"])).toThrow(/exige --solo-markbox/);
    expect(() => parsearArgumentos([...base, "--solo-facturas", "--solo-markbox", "DTD-0000"])).toThrow(/sólo va con --agregar-a-preorden/);
    expect(() => parsearArgumentos([...base, "--solo-markbox", "DTD-0000", "--agregar-a-preorden"])).toThrow(/sólo va con --solo-facturas/);
    expect(() =>
      parsearArgumentos([...base, "--solo-facturas", "--solo-markbox", "DTD-0000", "--agregar-a-preorden", "--excluir-markbox", "DTD-0000"]),
    ).toThrow(/no van juntos/);
    expect(parsearArgumentos([...base, "--solo-facturas"])).not.toHaveProperty("agregarAPreorden");
  });

  it("sin las opciones nuevas, el lote y el paquete no cambian", () => {
    const a = agruparLote(RASTREO, FILAS, { eta: "2026-10-19", mapa: MAPA });
    const b = agruparLote(RASTREO, FILAS, { eta: "2026-10-19", mapa: MAPA, soloMarkbox: [] });
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    expect(a).not.toHaveProperty("seleccion");
    expect(JSON.stringify(generarSql(a, { ...SOLO, soloMarkbox: [], agregarAPreorden: false }, FUENTES))).toBe(JSON.stringify(generarSql(a, SOLO, FUENTES)));
    expect(JSON.stringify(generarSql(a, SOLO, FUENTES))).not.toMatch(/agregar/i);
  });
});

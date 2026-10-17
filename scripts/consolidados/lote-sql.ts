/**
 * SDD-0543 · Del lote al SQL que se aplica con psql.
 *
 * Produce cinco scripts y un manifiesto:
 *  - `previa.sql`     lectura previa (transacción READ ONLY que termina en rollback):
 *                     tenant, almacén, cómo resuelve cada marca, conflictos.
 *  - `aplicar.sql`    UNA transacción con `\set ON_ERROR_STOP on`: preflight que
 *                     aborta ante duplicados y después escribe todo.
 *  - `simulacro.sql`  el mismo cuerpo que aplicar.sql, pero termina en rollback.
 *  - `verificar.sql`  READ ONLY: recuenta el lote y compara con el manifiesto.
 *  - `deshacer.sql`   borrado lógico de todo el lote, con motivo y auditoría; se
 *                     niega si alguna factura dejó de ser borrador o hay cajas
 *                     estibadas.
 *
 * Los datos viajan en tablas temporales (`lote_cab`, `lote_clientes`,
 * `lote_envios`, `lote_filas`); la lógica es un bloque `do $lote$` igual para
 * todos los contenedores. Así el Director lee un script corto y los datos
 * aparte.
 *
 * Las claves naturales que evitan duplicar: `consolidations.container_no` vivo,
 * `shipments.code` (= Remitente), `warehouse_receipts_cn.receipt_code`
 * (`WR-C<NN>-<remitente>`) y la marca del lote en `notes`.
 */
import type { Lote, Marca } from "./modelo";
import { litSql, normalizarCodigo } from "./modelo";

export interface OpcionesSql {
  /** `prueba` o `produccion`. Sólo en prueba se pueden crear clientes faltantes. */
  entorno: "prueba" | "produccion";
  crearClientesFaltantes: boolean;
  facturas: boolean;
  /** Puerto de carga (código del catálogo `ports`). Yiwu embarca por Ningbo. */
  pol: string;
  polNombre: string;
  containerType: string;
  vessel: string;
  /** Identificador del lote, p. ej. `carga-consolidado:59:1a2b3c4d`. */
  lote: string;
  tenantSlug: string;
}

export interface PuertoDestino {
  code: string;
  name: string;
  country: string;
}

/** Puertos de llegada que aparecen en el rastreo; LGU y PBL ya existen en el catálogo (migr 0096). */
export const PUERTOS_DESTINO: Record<string, PuertoDestino> = {
  "LA GUAIRA": { code: "LGU", name: "La Guaira", country: "VE" },
  "PUERTO CABELLO": { code: "PBL", name: "Puerto Cabello", country: "VE" },
  MARACAIBO: { code: "MAR", name: "Maracaibo", country: "VE" },
  GUARANAO: { code: "GUA", name: "Guaranao (Punto Fijo)", country: "VE" },
  BARRANQUILLA: { code: "BAQ", name: "Barranquilla", country: "CO" },
  CARTAGENA: { code: "CTG", name: "Cartagena", country: "CO" },
};

export function puertoDestino(texto: string | null): PuertoDestino {
  const k = String(texto ?? "").toUpperCase().replace(/\s+/g, " ").trim();
  const p = PUERTOS_DESTINO[k];
  if (!p) throw new Error(`Puerto de llegada desconocido: «${texto}». Agrégalo a PUERTOS_DESTINO.`);
  return p;
}

/** Navieras del rastreo → nombre y SCAC que se guardan en `carriers`. */
export const NAVIERAS: Record<string, { name: string; scac: string | null }> = {
  "CMA CGM": { name: "CMA CGM", scac: "CMDU" },
  CMA: { name: "CMA CGM", scac: "CMDU" },
  MSK: { name: "Maersk", scac: "MAEU" },
  MAERSK: { name: "Maersk", scac: "MAEU" },
  ZIM: { name: "ZIM", scac: "ZIMU" },
  "HAPAG-LLOYD": { name: "Hapag-Lloyd", scac: "HLCU" },
  HAPAG: { name: "Hapag-Lloyd", scac: "HLCU" },
  COSCO: { name: "COSCO", scac: "COSU" },
  MSC: { name: "MSC", scac: "MSCU" },
  EVERGREEN: { name: "Evergreen", scac: "EGLV" },
};

export function naviera(texto: string | null): { name: string; scac: string | null } {
  const k = String(texto ?? "").toUpperCase().replace(/\s+/g, " ").trim();
  if (!k) throw new Error("El rastreo no trae la naviera (columna EMPRESA).");
  return NAVIERAS[k] ?? { name: k, scac: null };
}

const DELIMITADORES = ["$lote$", "$undo$", "$v$", "$purga$"];

/** Una marca con la forma PREFIJO-[letra]dígitos, o la insignia pelada de un aliado, es un código; cualquier otra puede llevar texto de un nombre. */
export const RE_MARCA_CODIGO = /^[A-Z]{2,4}(?:-[A-Z]?\d{1,5})?$/;

/**
 * Lo que de una marca puede salir en la evidencia del servidor: la clave si es
 * un código (`DTD-J031`, `DC-0014`) y, si no, una etiqueta por posición
 * (`DC-#29`). `DC-01-ALESS` apareció en un previa.out el 2026-10-16 y llevaba
 * parte de un nombre; `resumen.md`, que vive fuera del servidor, cruza etiqueta
 * y clave.
 */
export function etiquetaEvidencia(clave: string, prefijo: string, orden: number): string {
  return RE_MARCA_CODIGO.test(clave) ? clave : `${prefijo}-#${orden}`;
}

function revisarDelimitadores(lote: Lote): void {
  const textos: string[] = [];
  for (const f of lote.filas) textos.push(f.marcaTexto, f.remitente, f.descripcion, f.agente);
  for (const c of lote.clientes) textos.push(c.marca.nombreExcel, ...c.marca.candidatos);
  if (lote.dueno) textos.push(lote.dueno.codigo, lote.dueno.marca.nombreExcel, ...lote.dueno.marca.candidatos);
  if (lote.gastoEspacio) textos.push(lote.gastoEspacio.usuarioEmail);
  for (const t of textos) for (const d of DELIMITADORES) if (t.includes(d)) throw new Error(`El texto «${t}» contiene el delimitador ${d}.`);
}

export interface Manifiesto {
  lote: string;
  sdd: "0543";
  entorno: string;
  generadoEn: string;
  /** ddp · fcl · mixto (decisión de Sam vía Director, 2026-10-17). */
  modalidad: string;
  /** Dueño del contenedor en fcl/mixto: su etiqueta en la evidencia, el código del envío FCL, el servicio y la medida. */
  dueno: { etiqueta: string; clave: string; codigo: string; servicio: string; cbm: number | null; kg: number | null } | null;
  /** Monto del gasto por espacio (mixto). El correo del usuario no va al manifiesto. */
  gastoEspacio: { monto: number } | null;
  contenedor: { numero: number; etiqueta: string; container_no: string; naviera: string; pol: string; pod: string; fechaCarga: string; fechaRecepcion: string; etd: string; eta: string; modalidad: string | null };
  fuentes: { rastreo: string; packing: string };
  opciones: { crearClientesFaltantes: boolean; facturas: boolean; excesoPeso: boolean; containerType: string };
  esperado: { envios: number; recepciones: number; items: number; cajas: number; clientes: number; facturas: number; cbm: number; kg: number; base: number };
  embarques: { remitente: string; clave: string; cajas: number; cbm: number; kg: number; filas: number }[];
  clientes: { clave: string; etiqueta: string; nombreExcel: string; candidatos: string[]; embarques: number; base: number }[];
  avisos: string[];
}

export interface SalidaSql {
  previa: string;
  aplicar: string;
  simulacro: string;
  verificar: string;
  deshacer: string;
  /** Borrado definitivo, sólo para la base de prueba (ver `purgar`). */
  purgar: string;
  manifiesto: Manifiesto;
}

/** El cliente sintético de la semilla de prueba (infra/ops/staging/semilla-prueba.sql): si no está, no es la base de prueba. */
export const CLIENTE_SINTETICO_PRUEBA = "05400000-0000-4000-8000-000000000101";

/**
 * Guarda de base de prueba para los scripts que escriben (aplicar, deshacer,
 * purgar): un lote generado para prueba aborta donde no esté el cliente
 * sintético de la semilla, así que un psql directo contra la base oficial no
 * toca nada. `aplicar.sql` la lleva dentro del bloque DO (condicionada a
 * `cab.entorno`); deshacer y purgar la emiten al generar.
 */
function guardaBasePrueba(paso: string): string {
  return `  if not exists (select 1 from public.clients where id = '${CLIENTE_SINTETICO_PRUEBA}'::uuid) then
    raise exception '${paso}: esta base no es la de prueba (no está el cliente sintético de la semilla); el lote se generó para prueba';
  end if;`;
}

function cab(lote: Lote, o: OpcionesSql, pod: PuertoDestino, nav: { name: string; scac: string | null }): string {
  const r = lote.rastreo;
  return [
    `create temp table lote_cab (`,
    `  lote text, contenedor text, numero int, modalidad text, naviera text, naviera_scac text,`,
    `  pol text, pol_nombre text, pod text, pod_nombre text, pod_pais text,`,
    `  fecha_carga date, fecha_recepcion date, etd date, eta date,`,
    `  container_type text, vessel text, crear_faltantes boolean, facturas boolean, entorno text, tenant_slug text, modo text`,
    `) on commit drop;`,
    `insert into lote_cab values (`,
    `  ${litSql(o.lote)}, ${litSql(normalizarCodigo(r.contenedor))}, ${r.numero}, ${litSql(r.modalidad)}, ${litSql(nav.name)}, ${litSql(nav.scac)},`,
    `  ${litSql(o.pol)}, ${litSql(o.polNombre)}, ${litSql(pod.code)}, ${litSql(pod.name)}, ${litSql(pod.country)},`,
    `  ${litSql(lote.fechaCarga)}, ${litSql(lote.fechaRecepcion)}, ${litSql(lote.etd)}, ${litSql(lote.eta)},`,
    `  ${litSql(o.containerType)}, ${litSql(o.vessel)}, ${o.crearClientesFaltantes ? "true" : "false"}, ${o.facturas ? "true" : "false"}, ${litSql(o.entorno)}, ${litSql(o.tenantSlug)}, ${litSql(lote.modalidad)}`,
    `);`,
  ].join("\n");
}

interface MarcaDelLote {
  orden: number;
  clave: string;
  etiqueta: string;
  marca: Marca;
  /** `true` para el dueño de un FCL cuya marca es la insignia pelada de un aliado (`HR`). */
  esRaizAliado: boolean;
}

/** Las marcas que el lote tiene que resolver: los clientes DDP y, si lo hay, el dueño del contenedor. */
function marcasDelLote(lote: Lote): MarcaDelLote[] {
  const out: MarcaDelLote[] = lote.clientes.map((c, i) => ({
    orden: i + 1,
    clave: c.clave,
    etiqueta: etiquetaEvidencia(c.clave, c.marca.prefijo, i + 1),
    marca: c.marca,
    esRaizAliado: false,
  }));
  if (lote.dueno) {
    const d = lote.dueno.marca;
    out.push({
      orden: out.length + 1,
      clave: d.clave,
      etiqueta: etiquetaEvidencia(d.clave, d.prefijo, out.length + 1),
      marca: d,
      esRaizAliado: d.numero === "",
    });
  }
  return out;
}

/** Códigos de envío del lote: un DDP por Remitente y, si lo hay, el FCL del dueño. */
export function codigosEnvio(lote: Lote): string[] {
  const codigos = lote.embarques.map((e) => e.remitente);
  if (lote.dueno) codigos.push(lote.dueno.codigo);
  return codigos;
}

function datos(lote: Lote): string {
  const out: string[] = [];
  out.push(
    `create temp table lote_clientes (orden int primary key, clave text unique, etiqueta text, nombre_excel text, prefijo text, es_casa boolean, es_raiz_aliado boolean, candidatos text[]) on commit drop;`,
  );
  for (const m of marcasDelLote(lote)) {
    out.push(
      `insert into lote_clientes values (${m.orden}, ${litSql(m.clave)}, ${litSql(m.etiqueta)}, ${litSql(m.marca.nombreExcel)}, ${litSql(m.marca.prefijo)}, ${m.marca.esCasa}, ${m.esRaizAliado}, array[${m.marca.candidatos.map(litSql).join(", ")}]::text[]);`,
    );
  }
  out.push(`create temp table lote_dueno (clave text, codigo text, servicio text, cbm numeric, kg numeric) on commit drop;`);
  if (lote.dueno) {
    out.push(
      `insert into lote_dueno values (${litSql(lote.dueno.marca.clave)}, ${litSql(lote.dueno.codigo)}, ${litSql(lote.dueno.servicio)}, ${lote.dueno.cbm ?? "null"}, ${lote.dueno.kg ?? "null"});`,
    );
  }
  out.push(`create temp table lote_gasto (monto numeric, usuario_email text) on commit drop;`);
  if (lote.gastoEspacio) {
    out.push(`insert into lote_gasto values (${lote.gastoEspacio.monto}, ${litSql(lote.gastoEspacio.usuarioEmail)});`);
  }
  out.push(
    `create temp table lote_envios (orden int primary key, remitente text unique, clave text, cajas int, peso numeric, cbm numeric, cbm_factura numeric) on commit drop;`,
  );
  for (const e of lote.embarques) {
    out.push(
      `insert into lote_envios values (${e.orden}, ${litSql(e.remitente)}, ${litSql(e.clave)}, ${e.cajas}, ${e.pesoKg}, ${e.cbmChina}, ${e.cbmFactura});`,
    );
  }
  out.push(
    `create temp table lote_filas (orden int primary key, fila_excel int, remitente text, descripcion text, cajas int, peso numeric, cbm numeric, cbm_factura numeric) on commit drop;`,
  );
  lote.filas.forEach((f, i) => {
    out.push(
      `insert into lote_filas values (${i + 1}, ${f.filaExcel}, ${litSql(f.remitente)}, ${litSql(f.descripcion)}, ${f.cajas}, ${f.pesoKg}, ${f.cbmChina}, ${f.cbmFactura});`,
    );
  });
  out.push(`create temp table lote_lineas (orden int primary key, clave text, remitente text, descripcion text, qty numeric, unit_price numeric) on commit drop;`);
  let n = 0;
  for (const c of lote.clientes) {
    for (const l of c.lineas) {
      n++;
      out.push(`insert into lote_lineas values (${n}, ${litSql(c.clave)}, ${litSql(l.remitente)}, ${litSql(l.desc)}, ${l.qty}, ${l.unitPrice});`);
    }
  }
  return out.join("\n");
}

const CUERPO_APLICAR = String.raw`
do $lote$
declare
  cab record;
  v_tenant uuid;
  v_wh uuid;
  v_carrier uuid;
  v_sailing uuid;
  v_cons uuid;
  v_ref text;
  v_n_dup int;
  v_ts_carga timestamptz;
  v_ts_recepcion timestamptz;
  c record;
  e record;
  f record;
  r record;
  m text;
  v_client_id uuid;
  v_markbox text;
  v_creado boolean;
  v_aliado uuid;
  v_padre uuid;
  v_root_client uuid;
  v_chain text;
  v_markbox_nuevo text;
  d record;
  g record;
  v_fcl_ship uuid;
  v_n_fcl int := 0;
  v_user uuid;
  v_exp_code text;
  v_n_gastos int := 0;
  v_fact_id uuid;
  v_ship uuid;
  v_receipt uuid;
  v_pos int;
  v_inv uuid;
  v_code text;
  v_iva_on boolean;
  v_iva_rate numeric;
  v_base numeric;
  v_iva numeric;
  v_total numeric;
  v_lines jsonb;
  v_first_ship uuid;
  v_first_code text;
  v_n_envios int := 0;
  v_n_recepciones int := 0;
  v_n_items int := 0;
  v_n_facturas int := 0;
begin
  select * into cab from lote_cab;
  select id into v_tenant from public.tenants where slug = cab.tenant_slug;
  if v_tenant is null then
    raise exception 'lote: no existe el tenant %', cab.tenant_slug;
  end if;
  if cab.crear_faltantes and cab.entorno <> 'prueba' then
    raise exception 'lote: crear clientes faltantes sólo se permite en prueba';
  end if;
  -- Un lote generado para prueba se niega a correr donde no esté el cliente
  -- sintético de la semilla: un psql directo contra la base oficial aborta aquí,
  -- antes de tocar nada (misma guarda que purgar.sql).
  if cab.entorno = 'prueba' and not exists (select 1 from public.clients where id = '${CLIENTE_SINTETICO_PRUEBA}'::uuid) then
    raise exception 'lote: esta base no es la de prueba (no está el cliente sintético de la semilla); el lote se generó para prueba';
  end if;
  v_ts_carga := (cab.fecha_carga::text || 'T12:00:00Z')::timestamptz;
  v_ts_recepcion := (cab.fecha_recepcion::text || 'T12:00:00Z')::timestamptz;

  -- ── Preflight: nada de esto puede existir ya ──────────────────────────────
  if exists (
    select 1 from public.consolidations
     where tenant_id = v_tenant and deleted_at is null
       and upper(coalesce(container_no, '')) = upper(cab.contenedor)
  ) then
    raise exception 'preflight: el contenedor % ya está cargado', cab.contenedor;
  end if;
  if exists (
    select 1 from public.consolidations
     where tenant_id = v_tenant and deleted_at is null and notes like '%' || cab.lote || '%'
  ) then
    raise exception 'preflight: el lote % ya está aplicado', cab.lote;
  end if;
  -- Sólo conteos en los errores: un Remitente puede llevar texto del Excel y
  -- este mensaje termina en la evidencia del servidor. previa.sql los enumera
  -- en la PC con el resumen.
  -- Códigos de envío del lote: los DDP (Remitente) y el FCL del dueño, si lo hay.
  create temp table lote_codigos on commit drop as
    select remitente as codigo from lote_envios union all select codigo from lote_dueno;
  select count(*) into v_n_dup
    from public.shipments s
    join lote_codigos l on upper(s.code) = upper(l.codigo)
   where s.tenant_id = v_tenant and s.deleted_at is null;
  if v_n_dup > 0 then
    raise exception 'preflight: % envíos del lote ya existen con ese código (ver previa.sql y resumen.md)', v_n_dup;
  end if;
  -- unique (tenant_id, code) no es parcial: un envío borrado con deshacer.sql
  -- sigue ocupando su código. Sin esto, el insert fallaría más abajo citando el
  -- código (corrida local 2026-10-16 23:23Z).
  select count(*) into v_n_dup
    from public.shipments s
    join lote_codigos l on upper(s.code) = upper(l.codigo)
   where s.tenant_id = v_tenant and s.deleted_at is not null;
  if v_n_dup > 0 then
    raise exception 'preflight: % envíos del lote existen BORRADOS (deshacer previo) y ocupan el código; en prueba, purgar.sql; en otra base, decisión del Director', v_n_dup;
  end if;
  select count(*) into v_n_dup
    from public.warehouse_receipts_cn w
    join lote_envios l on upper(w.receipt_code) = upper('WR-C' || cab.numero::text || '-' || l.remitente)
   where w.tenant_id = v_tenant and w.deleted_at is null;
  if v_n_dup > 0 then
    raise exception 'preflight: % recepciones del lote ya existen con ese código (ver previa.sql y resumen.md)', v_n_dup;
  end if;
  select count(*) into v_n_dup
    from public.warehouse_receipts_cn w
    join lote_envios l on upper(w.receipt_code) = upper('WR-C' || cab.numero::text || '-' || l.remitente)
   where w.tenant_id = v_tenant and w.deleted_at is not null;
  if v_n_dup > 0 then
    raise exception 'preflight: % recepciones del lote existen BORRADAS (deshacer previo) y ocupan el código; en prueba, purgar.sql; en otra base, decisión del Director', v_n_dup;
  end if;
  if exists (
    select 1 from public.invoices
     where tenant_id = v_tenant and deleted_at is null and notes like '%' || cab.lote || '%'
  ) then
    raise exception 'preflight: ya hay facturas del lote %', cab.lote;
  end if;

  -- ── Almacén de Yiwu ───────────────────────────────────────────────────────
  select id into v_wh from public.warehouses_cn where code = 'YIW-A1' and active;
  if v_wh is null then
    select id into v_wh from public.warehouses_cn where active order by display_order, code limit 1;
  end if;
  if v_wh is null then
    raise exception 'lote: no hay almacén CN activo en warehouses_cn';
  end if;

  -- ── Naviera, puertos, zarpe y contenedor ─────────────────────────────────
  select id into v_carrier
    from public.carriers
   where tenant_id = v_tenant and deleted_at is null and upper(name) = upper(cab.naviera)
   order by created_at limit 1;
  if v_carrier is null then
    insert into public.carriers (tenant_id, name, scac, notes)
    values (v_tenant, cab.naviera, cab.naviera_scac, 'Creada por la carga ' || cab.lote)
    returning id into v_carrier;
  end if;
  insert into public.ports (tenant_id, code, name, country)
  values (v_tenant, cab.pol, cab.pol_nombre, 'CN')
  on conflict (tenant_id, code) do nothing;
  insert into public.ports (tenant_id, code, name, country)
  values (v_tenant, cab.pod, cab.pod_nombre, cab.pod_pais)
  on conflict (tenant_id, code) do nothing;

  insert into public.sailings (tenant_id, carrier_id, vessel, pol, pod, etd, eta, status, notes, created_at)
  values (v_tenant, v_carrier, cab.vessel, cab.pol, cab.pod, cab.etd, cab.eta, 'transito',
          'Carga ' || cab.lote || ' · contenedor DTD #' || cab.numero::text, v_ts_carga)
  returning id into v_sailing;

  v_ref := public.next_consolidation_ref(v_tenant);
  insert into public.consolidations
    (tenant_id, ref, sailing_id, container_type, status, container_no, notes, created_at, authorized_at)
  values
    (v_tenant, v_ref, v_sailing, cab.container_type, 'zarpado', cab.contenedor,
     'Carga ' || cab.lote || ' · contenedor DTD #' || cab.numero::text || ' · ' || coalesce(cab.modalidad, ''),
     v_ts_carga, v_ts_carga)
  returning id into v_cons;

  select coalesce(iva_enabled, false) into v_iva_on from public.tenants where id = v_tenant;
  v_iva_rate := case when v_iva_on then 16 else 0 end;

  -- ── Clientes: cada marca del Excel resuelve a un cliente vivo ────────────
  create temp table lote_resueltos (
    clave text primary key, client_id uuid, markbox text, nombre text,
    fact_client_id uuid, fact_markbox text, fact_nombre text, fact_rif text, fact_doc_kind text,
    creado boolean
  ) on commit drop;

  for c in select * from lote_clientes order by orden loop
    v_client_id := null;
    v_markbox := null;
    v_creado := false;
    foreach m in array c.candidatos loop
      select x.client_id, x.canonical_markbox into v_client_id, v_markbox
        from public.resolve_markbox(v_tenant, m) x
       limit 1;
      if v_client_id is not null then
        exit;
      end if;
    end loop;
    if v_client_id is not null and exists (
      select 1 from public.clients where id = v_client_id and deleted_at is not null
    ) then
      raise exception 'lote: la marca % resuelve al cliente % pero está eliminado', c.etiqueta, v_markbox;
    end if;

    if v_client_id is null and cab.crear_faltantes then
      v_creado := true;
      if c.es_raiz_aliado then
        -- El dueño de un FCL cuya marca es la insignia pelada: su ficha ES el aliado (migr 0371).
        select a.id, a.client_id into v_aliado, v_root_client
          from public.aliados a
         where a.tenant_id = v_tenant and a.deleted_at is null and upper(a.prefix) = upper(c.prefijo)
         limit 1;
        if v_aliado is null then
          insert into public.clients (tenant_id, markbox, name, notes)
          values (v_tenant, upper(c.prefijo), c.nombre_excel || ' (aliado raíz)',
                  'Creado por la carga ' || cab.lote || ' (prueba): aliado raíz ' || c.prefijo)
          returning id into v_root_client;
          insert into public.aliados (tenant_id, client_id, prefix, trade_name, status, agreement_notes)
          values (v_tenant, v_root_client, upper(c.prefijo), c.nombre_excel, 'activo',
                  'Creado por la carga ' || cab.lote || ' (prueba)')
          returning id into v_aliado;
        end if;
        select id, markbox into v_client_id, v_markbox from public.clients where id = v_root_client;
      elsif c.es_casa then
        insert into public.clients (tenant_id, markbox, name, notes)
        values (v_tenant, c.candidatos[1], c.nombre_excel,
                'Creado por la carga ' || cab.lote || ' (prueba): la marca no existía en la base')
        returning id, markbox into v_client_id, v_markbox;
      else
        select a.id into v_aliado
          from public.aliados a
         where a.tenant_id = v_tenant and a.deleted_at is null and upper(a.prefix) = upper(c.prefijo)
         limit 1;
        if v_aliado is null then
          -- La ficha de un aliado lleva su insignia PELADA como Shipping Mark (migr
          -- 0371: 'DC' es Dynasty Cargo; 'DC-NNNN' son sus clientes). Nada de
          -- next_markbox: exige sesión autenticada y psql como postgres no la trae.
          insert into public.clients (tenant_id, markbox, name, notes)
          values (v_tenant, upper(c.prefijo), c.nombre_excel || ' (aliado raíz)',
                  'Creado por la carga ' || cab.lote || ' (prueba): aliado raíz ' || c.prefijo)
          returning id into v_root_client;
          insert into public.aliados (tenant_id, client_id, prefix, trade_name, status, agreement_notes)
          values (v_tenant, v_root_client, upper(c.prefijo), c.nombre_excel, 'activo',
                  'Creado por la carga ' || cab.lote || ' (prueba)')
          returning id into v_aliado;
        end if;
        -- El guard de clients (migr 0371) exige que un cliente de aliado lleve
        -- <cadena del aliado>-NNNN. Si la marca del Excel ya tiene esa forma
        -- (DC-0014) se usa; si no (DC-01-ALESS), se calcula la siguiente libre con
        -- la misma regla de next_markbox_aliado (max sobre clients y el historial),
        -- sin pasar por esa función porque exige sesión. La marca del Excel queda
        -- en las notas; el envío conserva el Remitente tal cual.
        v_chain := public.aliado_prefix_chain(v_aliado);
        if c.candidatos[1] ~ ('^' || v_chain || '-\d+$') then
          v_markbox_nuevo := c.candidatos[1];
        else
          select v_chain || '-' || lpad((coalesce(max((regexp_match(u.m, '^' || v_chain || '-(\d+)$'))[1]::int), 0) + 1)::text, 4, '0')
            into v_markbox_nuevo
            from (
              select cl.markbox as m from public.clients cl where cl.tenant_id = v_tenant
              union all
              select h.markbox from public.client_markbox_history h where h.tenant_id = v_tenant
            ) u;
        end if;
        insert into public.clients (tenant_id, markbox, name, aliado_id, notes)
        values (v_tenant, v_markbox_nuevo, c.nombre_excel || ' · ' || c.clave, v_aliado,
                'Creado por la carga ' || cab.lote || ' (prueba): cliente de aliado ' || c.prefijo || ' · marca del Excel ' || c.clave)
        returning id, markbox into v_client_id, v_markbox;
      end if;
    end if;
    if v_client_id is null then
      -- Sólo la etiqueta: este error termina en la evidencia del servidor. La
      -- clave y los candidatos están en resumen.md, que se queda en la PC.
      raise exception 'lote: la marca % no resuelve a ningún cliente; mapéala en marcas-mapa.json (ver resumen.md)', c.etiqueta;
    end if;

    -- A quién se factura: al propio cliente o, si es de un aliado, al aliado raíz.
    select aliado_id into v_aliado from public.clients where id = v_client_id;
    v_fact_id := v_client_id;
    if v_aliado is not null then
      loop
        select parent_aliado_id, client_id into v_padre, v_root_client from public.aliados where id = v_aliado;
        exit when v_padre is null;
        v_aliado := v_padre;
      end loop;
      if v_root_client is not null then
        v_fact_id := v_root_client;
      end if;
    end if;

    insert into lote_resueltos
    select c.clave, v_client_id, cl.markbox, cl.name,
           fc.id, fc.markbox, fc.name, fc.rif, fc.doc_kind, v_creado
      from public.clients cl, public.clients fc
     where cl.id = v_client_id and fc.id = v_fact_id;
    -- En los raise va la etiqueta (PREFIJO-#n), nunca la clave: la clave puede
    -- traer texto del Excel y el .err termina en la evidencia del servidor.
    if (select markbox from lote_resueltos where clave = c.clave) is null then
      raise exception 'lote: el cliente % no tiene Shipping Mark', c.etiqueta;
    end if;
    if (select fact_markbox from lote_resueltos where clave = c.clave) is null then
      raise exception 'lote: el cliente a facturar por % no tiene Shipping Mark', c.etiqueta;
    end if;
  end loop;

  -- ── Envíos, recepciones e items ──────────────────────────────────────────
  for e in select * from lote_envios order by orden loop
    select * into r from lote_resueltos where clave = e.clave;

    insert into public.shipments
      (tenant_id, code, client_name, client_markbox, origin, destination, shipment_service, status,
       weight_kg, volume_m3, vehicle_category, notes, created_at, updated_at)
    values
      (v_tenant, e.remitente, r.nombre, r.markbox, 'Yiwu, China', cab.pod_nombre, 'puerta_a_puerta_DDP', 'in_warehouse',
       e.peso, e.cbm_factura, 'contenedor_maritimo',
       'Carga ' || cab.lote || ' · contenedor DTD #' || cab.numero::text || ' (' || cab.contenedor || ')',
       v_ts_recepcion, v_ts_carga)
    returning id into v_ship;
    update public.shipments set status = 'in_transit' where id = v_ship;
    insert into public.shipment_events (tenant_id, shipment_id, status, note, occurred_at) values
      (v_tenant, v_ship, 'consolidating', 'Consolidado en el contenedor ' || cab.contenedor || ' (' || v_ref || ')', v_ts_carga),
      (v_tenant, v_ship, 'shipped', 'Zarpó de ' || cab.pol_nombre || ' con ' || cab.naviera || ' · ETA ' || cab.eta::text, v_ts_carga + interval '1 hour'),
      (v_tenant, v_ship, 'in_transit', 'En tránsito a ' || cab.pod_nombre, v_ts_carga + interval '2 hours');
    v_n_envios := v_n_envios + 1;

    insert into public.consolidation_items
      (tenant_id, consolidation_id, shipment_id, client_markbox, client_name, cbm, weight_kg, pieces, created_at)
    values
      (v_tenant, v_cons, v_ship, r.markbox, r.nombre, e.cbm_factura, e.peso, e.cajas, v_ts_carga);

    insert into public.warehouse_receipts_cn
      (tenant_id, receipt_code, warehouse_id, client_markbox, client_name, boxes, total_cbm, total_weight_kg,
       status, shipment_id, received_at, notes, description, created_at, updated_at)
    values
      (v_tenant, 'WR-C' || cab.numero::text || '-' || e.remitente, v_wh, r.markbox, r.nombre, e.cajas, e.cbm_factura, e.peso,
       'consolidado', v_ship, cab.fecha_recepcion,
       'Carga ' || cab.lote,
       'Packing list del contenedor DTD #' || cab.numero::text || ' · remitente ' || e.remitente,
       v_ts_recepcion, v_ts_carga)
    returning id into v_receipt;
    v_n_recepciones := v_n_recepciones + 1;

    v_pos := 0;
    for f in select * from lote_filas where remitente = e.remitente order by orden loop
      insert into public.warehouse_receipt_items (tenant_id, receipt_id, description, quantity, position, notes)
      values (v_tenant, v_receipt, coalesce(nullif(f.descripcion, ''), 'Sin descripción'), f.cajas, v_pos,
              'Fila ' || f.fila_excel::text || ' del packing list · ' || f.cbm_factura::text || ' m³ · ' || f.peso::text || ' kg');
      v_pos := v_pos + 1;
      v_n_items := v_n_items + 1;
    end loop;
    insert into public.warehouse_receipt_events (tenant_id, receipt_id, event_type, description, occurred_at) values
      (v_tenant, v_receipt, 'received', 'Recibido en bodega Yiwu (carga desde el packing list, SDD-0543)', v_ts_recepcion),
      (v_tenant, v_receipt, 'consolidated', 'Consolidado en ' || cab.contenedor || ' (' || v_ref || ')', v_ts_carga);

    perform public.append_audit_event(
      v_tenant, 'shipment', v_ship, 'system', null, 'shipment_imported', 'job', 'succeeded',
      'Carga desde el packing list del contenedor DTD #' || cab.numero::text || ' (SDD-0543)',
      null, jsonb_build_object('code', e.remitente, 'status', 'in_transit', 'client_markbox', r.markbox),
      jsonb_build_object('lote', cab.lote, 'contenedor', cab.contenedor, 'consolidation_ref', v_ref),
      cab.lote, 1, 'internal');
    perform public.append_audit_event(
      v_tenant, 'warehouse_receipt_cn', v_receipt, 'system', null, 'warehouse_receipt_cn_imported', 'job', 'succeeded',
      'Carga desde el packing list del contenedor DTD #' || cab.numero::text || ' (SDD-0543)',
      null, jsonb_build_object('receipt_code', 'WR-C' || cab.numero::text || '-' || e.remitente, 'status', 'consolidado', 'boxes', e.cajas),
      jsonb_build_object('lote', cab.lote, 'contenedor', cab.contenedor, 'shipment_code', e.remitente),
      cab.lote, 1, 'internal');
  end loop;

  -- ── El envío FCL del dueño del contenedor (modalidades fcl y mixto) ───────
  -- Sin recepción en bodega ni factura: el contenedor es suyo; lo que ve es su
  -- envío con el contenedor, la naviera y el ETA. fcl_directo no pasa por
  -- «consolidating» (lib/studio/shipment-state-machine.ts); fcl_bodega sí.
  for d in select * from lote_dueno loop
    select * into r from lote_resueltos where clave = d.clave;
    insert into public.shipments
      (tenant_id, code, client_name, client_markbox, origin, destination, shipment_service, status,
       weight_kg, volume_m3, vehicle_category, notes, created_at, updated_at)
    values
      (v_tenant, d.codigo, r.nombre, r.markbox, 'Yiwu, China', cab.pod_nombre, d.servicio::public.shipment_service, 'in_warehouse',
       d.kg, d.cbm, 'contenedor_maritimo',
       'Carga ' || cab.lote || ' · contenedor DTD #' || cab.numero::text || ' (' || cab.contenedor || ') · FCL del dueño',
       v_ts_carga - interval '1 day', v_ts_carga)
    returning id into v_fcl_ship;
    update public.shipments set status = 'in_transit' where id = v_fcl_ship;
    if d.servicio = 'fcl_bodega' then
      insert into public.shipment_events (tenant_id, shipment_id, status, note, occurred_at) values
        (v_tenant, v_fcl_ship, 'consolidating', 'Contenedor ' || cab.contenedor || ' cargado en bodega (' || v_ref || ')', v_ts_carga);
    end if;
    insert into public.shipment_events (tenant_id, shipment_id, status, note, occurred_at) values
      (v_tenant, v_fcl_ship, 'shipped', 'Zarpó de ' || cab.pol_nombre || ' con ' || cab.naviera || ' · ETA ' || cab.eta::text, v_ts_carga + interval '1 hour'),
      (v_tenant, v_fcl_ship, 'in_transit', 'En tránsito a ' || cab.pod_nombre, v_ts_carga + interval '2 hours');
    insert into public.consolidation_items
      (tenant_id, consolidation_id, shipment_id, client_markbox, client_name, cbm, weight_kg, pieces, created_at)
    values
      (v_tenant, v_cons, v_fcl_ship, r.markbox, r.nombre, coalesce(d.cbm, 0), coalesce(d.kg, 0), 0, v_ts_carga);
    perform public.append_audit_event(
      v_tenant, 'shipment', v_fcl_ship, 'system', null, 'shipment_imported', 'job', 'succeeded',
      'Envío FCL del dueño del contenedor DTD #' || cab.numero::text || ' (SDD-0543)',
      null, jsonb_build_object('code', d.codigo, 'status', 'in_transit', 'service', d.servicio, 'client_markbox', r.markbox),
      jsonb_build_object('lote', cab.lote, 'contenedor', cab.contenedor, 'consolidation_ref', v_ref),
      cab.lote, 1, 'internal');
    v_n_fcl := v_n_fcl + 1;
  end loop;

  -- ── Una factura por cliente, en borrador ─────────────────────────────────
  if cab.facturas then
    -- Alias de dos letras a propósito: e y r son variables del bloque y
    -- PL/pgSQL (variable_conflict = error) no sabe cuál es cuál (tercer
    -- simulacro, 2026-10-16 23:11Z).
    for c in
      select lr.*, min(le.orden) as primero
        from lote_resueltos lr
        join lote_envios le on le.clave = lr.clave
       group by lr.clave, lr.client_id, lr.markbox, lr.nombre, lr.fact_client_id, lr.fact_markbox, lr.fact_nombre,
                lr.fact_rif, lr.fact_doc_kind, lr.creado
       order by min(le.orden)
    loop
      -- shipmentCode por línea: el Portal lista los embarques de la factura y suma su
      -- medida (una factura junta varios; shipment_code sólo enlaza el primero).
      select coalesce(jsonb_agg(jsonb_build_object('desc', descripcion, 'qty', qty, 'unitPrice', unit_price, 'shipmentCode', remitente) order by orden), '[]'::jsonb),
             coalesce(round(sum(qty * unit_price), 2), 0)
        into v_lines, v_base
        from lote_lineas where clave = c.clave;
      v_iva := round(v_base * v_iva_rate / 100, 2);
      v_total := round(v_base + v_iva, 2);
      select sh.id, sh.code into v_first_ship, v_first_code
        from public.shipments sh
        join lote_envios le on upper(sh.code) = upper(le.remitente)
       where le.clave = c.clave and sh.tenant_id = v_tenant and sh.deleted_at is null
       order by le.orden limit 1;
      v_code := public.next_invoice_code(v_tenant);
      insert into public.invoices
        (tenant_id, invoice_code, client_markbox, client_name, client_rif, client_doc_kind, shipment_id, shipment_code,
         currency, iva_rate, base_amount, iva_amount, total_amount, status, lines, notes, fund_class, created_at)
      values
        (v_tenant, v_code, c.fact_markbox, c.fact_nombre, c.fact_rif, c.fact_doc_kind, v_first_ship, v_first_code,
         'USD', v_iva_rate, v_base, v_iva, v_total, 'borrador', v_lines,
         'Carga ' || cab.lote || ' · contenedor DTD #' || cab.numero::text || ' (' || cab.contenedor || ') · embarques: '
           || (select string_agg(remitente, ', ' order by orden) from lote_envios where clave = c.clave)
           || case when c.fact_client_id <> c.client_id then ' · facturado al aliado raíz de ' || c.markbox else '' end,
         'third_party', v_ts_carga)
      returning id into v_inv;
      v_n_facturas := v_n_facturas + 1;
      perform public.append_audit_event(
        v_tenant, 'invoice', v_inv, 'system', null, 'invoice_imported', 'job', 'succeeded',
        'Factura en borrador por la carga del contenedor DTD #' || cab.numero::text || ' (SDD-0543)',
        null, jsonb_build_object('invoice_code', v_code, 'status', 'borrador', 'base_amount', v_base, 'client_markbox', c.fact_markbox),
        jsonb_build_object('lote', cab.lote, 'contenedor', cab.contenedor, 'shipment_code', v_first_code),
        cab.lote, 1, 'internal');
    end loop;
  end if;

  -- ── El espacio que el aliado nos cobra (mixto), como gasto del envío FCL ──
  -- expenses.user_id es obligatorio y next_expense_code exige sesión: el usuario
  -- se resuelve por correo y el código se calcula acá con la misma regla.
  for g in select * from lote_gasto loop
    if v_fcl_ship is null then
      raise exception 'lote: el gasto por espacio necesita el envío FCL del dueño';
    end if;
    select u.id into v_user from auth.users u where lower(u.email) = lower(g.usuario_email) limit 1;
    if v_user is null then
      raise exception 'lote: no existe un usuario con el correo indicado para registrar el gasto';
    end if;
    select 'EXP-' || to_char(now() at time zone 'America/Caracas', 'YYYY') || '-'
           || lpad((coalesce(max((substring(x.expense_code from 'EXP-' || to_char(now() at time zone 'America/Caracas', 'YYYY') || '-(\d+)$'))::int), 0) + 1)::text, 4, '0')
      into v_exp_code
      from public.expenses x where x.tenant_id = v_tenant;
    insert into public.expenses
      (tenant_id, user_id, expense_code, amount, currency, category, method, shipment_id, note, location, billable,
       occurred_at, scope, amount_usd, fx_rate)
    values
      (v_tenant, v_user, v_exp_code, g.monto, 'USD', 'otro', 'transfer', v_fcl_ship,
       'Carga ' || cab.lote || ' · espacio en el contenedor ' || cab.contenedor || ' (DTD #' || cab.numero::text || ') vendido por el aliado dueño',
       'Yiwu, CN', false, v_ts_carga, 'shipment', g.monto, 1.0);
    v_n_gastos := v_n_gastos + 1;
  end loop;

  perform public.append_audit_event(
    v_tenant, 'consolidation', v_cons, 'system', null, 'consolidation_imported', 'job', 'succeeded',
    'Carga del contenedor DTD #' || cab.numero::text || ' desde el packing list (SDD-0543)',
    null, jsonb_build_object('ref', v_ref, 'container_no', cab.contenedor, 'status', 'zarpado', 'eta', cab.eta, 'modo', cab.modo, 'modalidad_hoja', cab.modalidad),
    jsonb_build_object('lote', cab.lote, 'envios', v_n_envios, 'envios_fcl', v_n_fcl, 'recepciones', v_n_recepciones, 'items', v_n_items,
                       'facturas', v_n_facturas, 'gastos', v_n_gastos, 'clientes_creados', (select count(*) from lote_resueltos where creado)),
    cab.lote, 1, 'internal');

  raise notice 'lote % · contenedor % (%) · % envíos · % FCL del dueño · % recepciones · % items · % facturas · % gastos · % clientes creados',
    cab.lote, cab.contenedor, v_ref, v_n_envios, v_n_fcl, v_n_recepciones, v_n_items, v_n_facturas, v_n_gastos,
    (select count(*) from lote_resueltos where creado);
end
$lote$;
`;

function cuerpoAplicar(lote: Lote, o: OpcionesSql, pod: PuertoDestino, nav: { name: string; scac: string | null }): string {
  return [cab(lote, o, pod, nav), datos(lote), CUERPO_APLICAR.trim()].join("\n\n");
}

function previa(lote: Lote, o: OpcionesSql, pod: PuertoDestino, nav: { name: string; scac: string | null }): string {
  const codigos = codigosEnvio(lote).map(litSql).join(", ") || "''";
  const codigosRecepcion = lote.embarques.map((e) => litSql(`WR-C${lote.rastreo.numero}-${e.remitente}`)).join(", ") || "''";
  const marcas = marcasDelLote(lote);
  const candidatos = marcas
    .map((m) => `(${litSql(m.etiqueta)}, array[${m.marca.candidatos.map(litSql).join(", ")}]::text[])`)
    .join(",\n  ");
  return `\\set ON_ERROR_STOP on
\\set VERBOSITY terse
-- SDD-0543 · lectura previa del lote ${o.lote} (contenedor DTD #${lote.rastreo.numero} · ${lote.rastreo.contenedor})
-- Sólo lee. Termina en rollback.
begin transaction read only;

\\echo === tenant, almacén, naviera y puertos
select t.id as tenant_id, t.slug, t.iva_enabled,
       (select code from public.warehouses_cn where active order by display_order, code limit 1) as almacen_cn,
       (select count(*) from public.carriers where tenant_id = t.id and deleted_at is null and upper(name) = upper(${litSql(nav.name)})) as naviera_existe,
       (select count(*) from public.ports where tenant_id = t.id and code = ${litSql(o.pol)}) as pol_existe,
       (select count(*) from public.ports where tenant_id = t.id and code = ${litSql(pod.code)}) as pod_existe
  from public.tenants t where t.slug = ${litSql(o.tenantSlug)};

\\echo === conflictos (todo debe dar 0)
select
  (select count(*) from public.consolidations c join public.tenants t on t.id = c.tenant_id
     where t.slug = ${litSql(o.tenantSlug)} and c.deleted_at is null and upper(coalesce(c.container_no, '')) = ${litSql(normalizarCodigo(lote.rastreo.contenedor))}) as contenedor_ya_cargado,
  (select count(*) from public.consolidations c join public.tenants t on t.id = c.tenant_id
     where t.slug = ${litSql(o.tenantSlug)} and c.deleted_at is null and c.notes like '%' || ${litSql(o.lote)} || '%') as lote_ya_aplicado,
  (select count(*) from public.shipments s join public.tenants t on t.id = s.tenant_id
     where t.slug = ${litSql(o.tenantSlug)} and s.deleted_at is null and upper(s.code) in (${codigos})) as envios_repetidos,
  (select count(*) from public.warehouse_receipts_cn w join public.tenants t on t.id = w.tenant_id
     where t.slug = ${litSql(o.tenantSlug)} and w.deleted_at is null and upper(w.receipt_code) in (${codigosRecepcion})) as recepciones_repetidas,
  (select count(*) from public.invoices i join public.tenants t on t.id = i.tenant_id
     where t.slug = ${litSql(o.tenantSlug)} and i.deleted_at is null and i.notes like '%' || ${litSql(o.lote)} || '%') as facturas_del_lote;

\\echo === marcas: cómo resuelve cada una (sin_resolver = hay que mapearla o crearla). Las marcas sin número salen como etiqueta PREFIJO-#n (resumen.md las cruza): esto termina en la evidencia.
with marcas(clave, candidatos) as (values
  ${candidatos}
), tenant as (select id from public.tenants where slug = ${litSql(o.tenantSlug)})
select m.clave,
       coalesce((
         select r.canonical_markbox
           from unnest(m.candidatos) with ordinality as cand(marca, pos)
           cross join lateral public.resolve_markbox((select id from tenant), cand.marca) r
          order by cand.pos limit 1
       ), 'sin_resolver') as markbox_canonico,
       (select a.prefix from public.clients cl join public.aliados a on a.id = cl.aliado_id where cl.id = (
         select r.client_id
           from unnest(m.candidatos) with ordinality as cand(marca, pos)
           cross join lateral public.resolve_markbox((select id from tenant), cand.marca) r
          order by cand.pos limit 1
       )) as aliado
  from marcas m
 order by m.clave;

\\echo === resumen de marcas
with marcas(clave, candidatos) as (values
  ${candidatos}
), tenant as (select id from public.tenants where slug = ${litSql(o.tenantSlug)})
select count(*) as marcas,
       count(*) filter (where exists (
         select 1 from unnest(m.candidatos) cand(marca)
          cross join lateral public.resolve_markbox((select id from tenant), cand.marca) r)) as resueltas,
       count(*) filter (where not exists (
         select 1 from unnest(m.candidatos) cand(marca)
          cross join lateral public.resolve_markbox((select id from tenant), cand.marca) r)) as sin_resolver
  from marcas m;

rollback;
`;
}

function verificar(lote: Lote, o: OpcionesSql, man: Manifiesto): string {
  const codigosEnvioSql = codigosEnvio(lote).map(litSql).join(", ");
  const esperado = man.esperado;
  return `\\set ON_ERROR_STOP on
\\set VERBOSITY terse
-- SDD-0543 · verificación del lote ${o.lote}: recuenta y compara con manifiesto.json. Sólo lee.
begin transaction read only;

do $v$
declare
  v_tenant uuid;
  v_cons uuid;
  n_envios int; n_recepciones int; n_items int; n_cajas int; n_facturas int; n_items_cons int;
  s_cbm numeric; s_kg numeric; s_base numeric;
begin
  select id into v_tenant from public.tenants where slug = ${litSql(o.tenantSlug)};
  select id into v_cons from public.consolidations
   where tenant_id = v_tenant and deleted_at is null and notes like '%' || ${litSql(o.lote)} || '%';
  if v_cons is null then
    raise exception 'verificar: no hay contenedor vivo del lote ${o.lote}';
  end if;
  select count(*), coalesce(sum(volume_m3), 0), coalesce(sum(weight_kg), 0)
    into n_envios, s_cbm, s_kg
    from public.shipments
   where tenant_id = v_tenant and deleted_at is null and upper(code) in (${codigosEnvioSql}) and status = 'in_transit';
  select count(*) into n_items_cons from public.consolidation_items where consolidation_id = v_cons;
  select count(*), coalesce(sum(boxes), 0) into n_recepciones, n_cajas
    from public.warehouse_receipts_cn
   where tenant_id = v_tenant and deleted_at is null and notes like '%' || ${litSql(o.lote)} || '%' and status = 'consolidado';
  select count(*) into n_items
    from public.warehouse_receipt_items i
    join public.warehouse_receipts_cn w on w.id = i.receipt_id
   where w.tenant_id = v_tenant and w.deleted_at is null and w.notes like '%' || ${litSql(o.lote)} || '%';
  select count(*), coalesce(sum(base_amount), 0) into n_facturas, s_base
    from public.invoices
   where tenant_id = v_tenant and deleted_at is null and notes like '%' || ${litSql(o.lote)} || '%';

  if n_envios <> ${esperado.envios} then raise exception 'verificar: % envíos en tránsito (se esperaban ${esperado.envios})', n_envios; end if;
  if n_items_cons <> ${esperado.envios} then raise exception 'verificar: % items en el contenedor (se esperaban ${esperado.envios})', n_items_cons; end if;
  if n_recepciones <> ${esperado.recepciones} then raise exception 'verificar: % recepciones (se esperaban ${esperado.recepciones})', n_recepciones; end if;
  if n_cajas <> ${esperado.cajas} then raise exception 'verificar: % cajas (se esperaban ${esperado.cajas})', n_cajas; end if;
  if n_items <> ${esperado.items} then raise exception 'verificar: % items de recepción (se esperaban ${esperado.items})', n_items; end if;
  if n_facturas <> ${esperado.facturas} then raise exception 'verificar: % facturas (se esperaban ${esperado.facturas})', n_facturas; end if;
  if abs(s_cbm - ${esperado.cbm}) > 0.01 then raise exception 'verificar: Σ CBM % (se esperaba ${esperado.cbm})', s_cbm; end if;
  if abs(s_kg - ${esperado.kg}) > 0.05 then raise exception 'verificar: Σ kg % (se esperaba ${esperado.kg})', s_kg; end if;
  if abs(s_base - ${esperado.base}) > 0.05 then raise exception 'verificar: Σ base % (se esperaba ${esperado.base})', s_base; end if;
  raise notice 'verificar: PASÓ · % envíos · % recepciones · % cajas · % items · % facturas · % m³ · % kg · $%',
    n_envios, n_recepciones, n_cajas, n_items, n_facturas, s_cbm, s_kg, s_base;
end
$v$;

\\echo === el contenedor y su zarpe
select c.ref, c.container_no, c.status, c.container_type, s.pol, s.pod, s.etd, s.eta, s.status as zarpe,
       (select count(*) from public.consolidation_items i where i.consolidation_id = c.id) as items
  from public.consolidations c
  left join public.sailings s on s.id = c.sailing_id
 where c.deleted_at is null and c.notes like '%' || ${litSql(o.lote)} || '%';

\\echo === envíos por cliente (sin nombres)
select client_markbox, count(*) as envios, sum(volume_m3) as cbm, sum(weight_kg) as kg
  from public.shipments
 where deleted_at is null and upper(code) in (${codigosEnvioSql})
 group by client_markbox order by client_markbox;

\\echo === facturas del lote (sin nombres ni códigos de embarque: un Remitente puede llevar texto del Excel)
select invoice_code, client_markbox, status, base_amount, total_amount, jsonb_array_length(lines) as lineas
  from public.invoices
 where deleted_at is null and notes like '%' || ${litSql(o.lote)} || '%'
 order by invoice_code;

rollback;
`;
}

function deshacer(lote: Lote, o: OpcionesSql): string {
  return `\\set ON_ERROR_STOP on
\\set VERBOSITY terse
-- SDD-0543 · deshacer el lote ${o.lote} (contenedor DTD #${lote.rastreo.numero} · ${lote.rastreo.contenedor}).
-- Borrado lógico con motivo y auditoría, en una transacción. Se niega si alguna
-- factura dejó de ser borrador o si hay cajas estibadas. Los clientes creados en
-- prueba se conservan (son datos de cliente, no del lote).
begin;

do $undo$
declare
  v_tenant uuid;
  v_cons uuid;
  v_sailing uuid;
  v_lote text := ${litSql(o.lote)};
  v_ship_ids uuid[];
  v_rec_ids uuid[];
  n_inv int; n_items int; n_boxes int; n_rec int; n_ship int; n_exp int := 0;
begin
  select id into v_tenant from public.tenants where slug = ${litSql(o.tenantSlug)};
${o.entorno === "prueba" ? guardaBasePrueba("deshacer") : ""}
  select id, sailing_id into v_cons, v_sailing from public.consolidations
   where tenant_id = v_tenant and deleted_at is null and notes like '%' || v_lote || '%';
  if v_cons is null then
    raise exception 'deshacer: no hay contenedor vivo del lote %', v_lote;
  end if;
  select coalesce(array_agg(id), '{}') into v_ship_ids from public.shipments
   where tenant_id = v_tenant and deleted_at is null and notes like '%' || v_lote || '%';
  select coalesce(array_agg(id), '{}') into v_rec_ids from public.warehouse_receipts_cn
   where tenant_id = v_tenant and deleted_at is null and notes like '%' || v_lote || '%';

  if exists (
    select 1 from public.invoices
     where tenant_id = v_tenant and deleted_at is null and notes like '%' || v_lote || '%' and status <> 'borrador'
  ) then
    raise exception 'deshacer: hay facturas del lote que ya no son borrador; no se deshace';
  end if;
  if exists (
    select 1 from public.consolidation_box_positions p
      join public.warehouse_boxes b on b.id = p.box_id
     where b.receipt_id = any(v_rec_ids)
  ) then
    raise exception 'deshacer: hay cajas del lote estibadas; no se deshace';
  end if;
  if exists (
    select 1 from public.shipments s
     where s.id = any(v_ship_ids) and s.status not in ('in_warehouse', 'consolidating', 'shipped', 'in_transit')
  ) then
    raise exception 'deshacer: algún envío del lote ya avanzó más allá de en tránsito; no se deshace';
  end if;

  perform set_config('dtd.audit_reason', 'Deshacer la carga ' || v_lote || ' (SDD-0543)', true);

  update public.invoices set deleted_at = now()
   where tenant_id = v_tenant and deleted_at is null and notes like '%' || v_lote || '%' and status = 'borrador';
  get diagnostics n_inv = row_count;
  -- expenses no admite deleted_at directo (su trigger exige void_expense_governed,
  -- que pide sesión): el gasto que creó el lote se borra físicamente, igual que
  -- en purgar; el conteo queda en el evento de auditoría.
  delete from public.expenses where tenant_id = v_tenant and note like '%' || v_lote || '%';
  get diagnostics n_exp = row_count;
  delete from public.consolidation_items where consolidation_id = v_cons;
  get diagnostics n_items = row_count;
  update public.warehouse_boxes set deleted_at = now() where receipt_id = any(v_rec_ids) and deleted_at is null;
  get diagnostics n_boxes = row_count;
  update public.warehouse_receipts_cn set deleted_at = now() where id = any(v_rec_ids);
  get diagnostics n_rec = row_count;
  update public.shipments set deleted_at = now() where id = any(v_ship_ids);
  get diagnostics n_ship = row_count;
  update public.consolidations set deleted_at = now() where id = v_cons;
  update public.sailings set deleted_at = now()
   where id = v_sailing and deleted_at is null and notes like '%' || v_lote || '%';

  perform public.append_audit_event(
    v_tenant, 'consolidation', v_cons, 'system', null, 'consolidation_import_undone', 'job', 'succeeded',
    'Deshacer la carga ' || v_lote || ' (SDD-0543)', null, null,
    jsonb_build_object('lote', v_lote, 'facturas', n_inv, 'items_contenedor', n_items, 'cajas', n_boxes,
                       'recepciones', n_rec, 'envios', n_ship, 'gastos_borrados', n_exp),
    v_lote, 1, 'internal');
  raise notice 'deshacer: % facturas · % items del contenedor · % cajas · % recepciones · % envíos · % gastos · contenedor y zarpe eliminados (borrado lógico: los códigos quedan ocupados; para recargar el mismo lote hace falta purgar)',
    n_inv, n_items, n_boxes, n_rec, n_ship, n_exp;
end
$undo$;

commit;
`;
}

/**
 * Borrado DEFINITIVO del lote, sólo en prueba: Sam pidió que los datos reales
 * salgan de prueba con evidencia, y `deshacer.sql` deja los nombres en la base
 * (borrado lógico). Borra físicamente, en orden de dependencias, todo lo que el
 * lote creó —incluidos los clientes y aliados que creó— y termina comprobando
 * conteo cero por lote. Una fila ajena que apunte a algo del lote (un reporte
 * de pago, una aceptación) hace fallar la FK a propósito: entonces el camino es
 * el reinicio de prueba. El log de auditoría es append-only y no lleva nombres:
 * queda como registro de la carga y de la purga.
 */
function purgar(lote: Lote, o: OpcionesSql): string {
  return `\\set ON_ERROR_STOP on
\\set VERBOSITY terse
-- SDD-0543 · PURGA DEFINITIVA del lote ${o.lote} (contenedor DTD #${lote.rastreo.numero} · ${lote.rastreo.contenedor}).
-- SÓLO PRUEBA: se niega si no encuentra el cliente sintético de la semilla de prueba.
-- Borra físicamente lo que el lote creó, en una transacción, y comprueba conteo cero.
begin;

do $purga$
declare
  v_tenant uuid;
  v_lote text := ${litSql(o.lote)};
  v_invs uuid[]; v_recs uuid[]; v_ships uuid[]; v_cons uuid[]; v_sails uuid[]; v_carriers uuid[];
  v_clients uuid[]; v_aliados uuid[]; v_markboxes text[];
  n_invs int; n_recs int; n_ships int; n_cons int; n_sails int; n_carriers int; n_clients int; n_aliados int;
  n_dep int; v_dep text;
  resto int;
begin
  select id into v_tenant from public.tenants where slug = ${litSql(o.tenantSlug)};
  if not exists (select 1 from public.clients where id = '${CLIENTE_SINTETICO_PRUEBA}'::uuid) then
    raise exception 'purgar: esta base no es la de prueba (no está el cliente sintético de la semilla); no se purga';
  end if;

  select coalesce(array_agg(id), '{}') into v_invs from public.invoices
   where tenant_id = v_tenant and notes like '%' || v_lote || '%';
  select coalesce(array_agg(id), '{}') into v_recs from public.warehouse_receipts_cn
   where tenant_id = v_tenant and notes like '%' || v_lote || '%';
  select coalesce(array_agg(id), '{}') into v_ships from public.shipments
   where tenant_id = v_tenant and notes like '%' || v_lote || '%';
  select coalesce(array_agg(id), '{}') into v_cons from public.consolidations
   where tenant_id = v_tenant and notes like '%' || v_lote || '%';
  select coalesce(array_agg(id), '{}') into v_sails from public.sailings
   where tenant_id = v_tenant and notes like '%' || v_lote || '%';
  select coalesce(array_agg(id), '{}') into v_carriers from public.carriers
   where tenant_id = v_tenant and notes like 'Creada por la carga ' || v_lote || '%';
  select coalesce(array_agg(id), '{}') into v_clients from public.clients
   where tenant_id = v_tenant and notes like 'Creado por la carga ' || v_lote || '%';
  select coalesce(array_agg(id), '{}') into v_aliados from public.aliados
   where tenant_id = v_tenant and agreement_notes like 'Creado por la carga ' || v_lote || '%';

  -- ── Otros lotes que dependen de este (prueba, 2026-10-17: el 62 colgó su
  -- cliente del aliado raíz MG que creó el 61; purgar el 61 primero abortaba
  -- por la FK clients.aliado_id). Se dice con conteos y el id del otro lote,
  -- antes de tocar nada: purgar en orden inverso a la carga.
  select coalesce(array_agg(markbox), '{}') into v_markboxes from public.clients where id = any(v_clients) and markbox is not null;
  select count(*), string_agg(distinct coalesce(substring(cl.notes from '(carga-consolidado:[0-9]+:[0-9a-f]+)'), 'origen desconocido'), ', ')
    into n_dep, v_dep
    from public.clients cl
   where cl.tenant_id = v_tenant and cl.aliado_id = any(v_aliados) and not (cl.id = any(v_clients));
  if n_dep > 0 then
    raise exception 'purgar: % cliente(s) de otro lote (%) cuelgan de un aliado creado por este lote: purga ese lote primero', n_dep, v_dep;
  end if;
  select count(*), string_agg(distinct coalesce(substring(x.notes from '(carga-consolidado:[0-9]+:[0-9a-f]+)'), 'origen desconocido'), ', ')
    into n_dep, v_dep
    from (
      select s.notes from public.shipments s
       where s.tenant_id = v_tenant and s.client_markbox = any(v_markboxes) and (s.notes is null or s.notes not like '%' || v_lote || '%')
      union all
      select w.notes from public.warehouse_receipts_cn w
       where w.tenant_id = v_tenant and w.client_markbox = any(v_markboxes) and (w.notes is null or w.notes not like '%' || v_lote || '%')
      union all
      select i.notes from public.invoices i
       where i.tenant_id = v_tenant and i.client_markbox = any(v_markboxes) and (i.notes is null or i.notes not like '%' || v_lote || '%')
    ) x;
  if n_dep > 0 then
    raise exception 'purgar: % fila(s) de otro lote (%) usan la marca de un cliente creado por este lote: purga ese lote primero o reinicia prueba', n_dep, v_dep;
  end if;

  -- Orden de dependencias. Lo ajeno al lote que apunte acá hace fallar la FK: a propósito.
  delete from public.expenses where tenant_id = v_tenant and note like '%' || v_lote || '%';
  delete from public.invoices where id = any(v_invs);
  get diagnostics n_invs = row_count;
  delete from public.warehouse_receipts_cn where id = any(v_recs); -- cascada: items, eventos, cajas y sus posiciones
  get diagnostics n_recs = row_count;
  delete from public.shipments where id = any(v_ships);            -- cascada: eventos
  get diagnostics n_ships = row_count;
  delete from public.consolidations where id = any(v_cons);        -- cascada: items del contenedor
  get diagnostics n_cons = row_count;
  delete from public.sailings where id = any(v_sails);
  get diagnostics n_sails = row_count;
  delete from public.carriers where id = any(v_carriers);
  get diagnostics n_carriers = row_count;
  delete from public.client_markbox_history where client_id = any(v_clients);
  delete from public.clients where id = any(v_clients) and aliado_id is not null; -- clientes de aliado antes que el aliado
  delete from public.aliados where id = any(v_aliados);
  get diagnostics n_aliados = row_count;
  delete from public.clients where id = any(v_clients);                           -- raíces de aliado y clientes de la casa
  select count(*) into n_clients from unnest(v_clients);

  -- Conteo cero por lote: lo único que puede quedar es el log de auditoría (append-only, sin nombres).
  select (select count(*) from public.invoices where tenant_id = v_tenant and notes like '%' || v_lote || '%')
       + (select count(*) from public.warehouse_receipts_cn where tenant_id = v_tenant and notes like '%' || v_lote || '%')
       + (select count(*) from public.shipments where tenant_id = v_tenant and notes like '%' || v_lote || '%')
       + (select count(*) from public.consolidations where tenant_id = v_tenant and notes like '%' || v_lote || '%')
       + (select count(*) from public.sailings where tenant_id = v_tenant and notes like '%' || v_lote || '%')
       + (select count(*) from public.clients where tenant_id = v_tenant and notes like 'Creado por la carga ' || v_lote || '%')
       + (select count(*) from public.aliados where tenant_id = v_tenant and agreement_notes like 'Creado por la carga ' || v_lote || '%')
       + (select count(*) from public.expenses where tenant_id = v_tenant and note like '%' || v_lote || '%')
    into resto;
  if resto <> 0 then
    raise exception 'purgar: quedaron % filas del lote %', resto, v_lote;
  end if;

  perform public.append_audit_event(
    v_tenant, 'consolidation', coalesce(v_cons[1], gen_random_uuid()), 'system', null, 'consolidation_import_purged', 'job', 'succeeded',
    'Purga definitiva del lote ' || v_lote || ' en prueba (SDD-0543)', null, null,
    jsonb_build_object('lote', v_lote, 'facturas', n_invs, 'recepciones', n_recs, 'envios', n_ships, 'contenedores', n_cons,
                       'zarpes', n_sails, 'navieras', n_carriers, 'clientes', n_clients, 'aliados', n_aliados, 'restantes', resto),
    v_lote, 1, 'internal');
  raise notice 'purgar: PASÓ · lote % · conteo cero · borrados: % facturas · % recepciones · % envíos · % contenedores · % zarpes · % navieras · % clientes · % aliados',
    v_lote, n_invs, n_recs, n_ships, n_cons, n_sails, n_carriers, n_clients, n_aliados;
end
$purga$;

commit;
`;
}

export function generarSql(lote: Lote, o: OpcionesSql, fuentes: { rastreo: string; packing: string }): SalidaSql {
  revisarDelimitadores(lote);
  const pod = puertoDestino(lote.rastreo.puertoLlegada);
  const nav = naviera(lote.rastreo.naviera);
  const items = lote.embarques.reduce((s, e) => s + e.filas.length, 0);
  const marcas = marcasDelLote(lote);
  const marcaDueno = lote.dueno ? marcas[marcas.length - 1] : null;
  const manifiesto: Manifiesto = {
    lote: o.lote,
    sdd: "0543",
    entorno: o.entorno,
    generadoEn: new Date().toISOString(),
    modalidad: lote.modalidad,
    dueno:
      lote.dueno && marcaDueno
        ? { etiqueta: marcaDueno.etiqueta, clave: lote.dueno.marca.clave, codigo: lote.dueno.codigo, servicio: lote.dueno.servicio, cbm: lote.dueno.cbm, kg: lote.dueno.kg }
        : null,
    gastoEspacio: lote.gastoEspacio ? { monto: lote.gastoEspacio.monto } : null,
    contenedor: {
      numero: lote.rastreo.numero,
      etiqueta: lote.rastreo.etiqueta,
      container_no: normalizarCodigo(lote.rastreo.contenedor),
      naviera: nav.name,
      pol: o.pol,
      pod: pod.code,
      fechaCarga: lote.fechaCarga,
      fechaRecepcion: lote.fechaRecepcion,
      etd: lote.etd,
      eta: lote.eta,
      modalidad: lote.rastreo.modalidad,
    },
    fuentes,
    opciones: { crearClientesFaltantes: o.crearClientesFaltantes, facturas: o.facturas, excesoPeso: lote.excesoPeso, containerType: o.containerType },
    esperado: {
      envios: lote.embarques.length + (lote.dueno ? 1 : 0),
      recepciones: lote.embarques.length,
      items,
      cajas: lote.totales.cajas,
      clientes: lote.clientes.length + (lote.dueno ? 1 : 0),
      facturas: o.facturas ? lote.clientes.length : 0,
      cbm: Math.round((lote.totales.cbmFactura + (lote.dueno?.cbm ?? 0)) * 1000) / 1000,
      kg: Math.round((lote.totales.pesoKg + (lote.dueno?.kg ?? 0)) * 100) / 100,
      base: o.facturas ? lote.totales.base : 0,
    },
    embarques: lote.embarques.map((e) => ({ remitente: e.remitente, clave: e.clave, cajas: e.cajas, cbm: e.cbmFactura, kg: e.pesoKg, filas: e.filas.length })),
    clientes: lote.clientes.map((c, i) => ({ clave: c.clave, etiqueta: etiquetaEvidencia(c.clave, c.marca.prefijo, i + 1), nombreExcel: c.marca.nombreExcel, candidatos: c.marca.candidatos, embarques: c.embarques.length, base: c.base })),
    avisos: lote.avisos,
  };
  const cuerpo = cuerpoAplicar(lote, o, pod, nav);
  const cabecera = `-- SDD-0543 · lote ${o.lote} · contenedor DTD #${lote.rastreo.numero} (${manifiesto.contenedor.container_no}) · entorno ${o.entorno} · modalidad ${lote.modalidad}\n-- generado ${manifiesto.generadoEn} · ${lote.embarques.length} envíos DDP${lote.dueno ? " + 1 FCL del dueño" : ""} · ${items} items · ${lote.totales.cajas} cajas · ${lote.totales.cbmFactura} m³\n`;
  return {
    previa: previa(lote, o, pod, nav),
    aplicar: `\\set ON_ERROR_STOP on\n\\set VERBOSITY terse\n${cabecera}-- UNA transacción: si algo falla, no queda nada.\nbegin;\n\n${cuerpo}\n\ncommit;\n`,
    simulacro: `\\set ON_ERROR_STOP on\n\\set VERBOSITY terse\n${cabecera}-- SIMULACRO: corre todo y deshace al final. No deja nada en la base.\nbegin;\n\n${cuerpo}\n\nrollback;\n`,
    verificar: verificar(lote, o, manifiesto),
    deshacer: deshacer(lote, o),
    purgar: purgar(lote, o),
    manifiesto,
  };
}

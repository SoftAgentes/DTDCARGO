-- ─────────────────────────────────────────────────────────────
-- SDD-0054 · Capa legal — Slice A (foundation)
--
-- Cierra 2 de las 3 entidades ❌ del cruce blueprint↔Supabase: LegalDoc y
-- LegalAcceptance. Es el keystone que respalda el gate AUT-04 (factura DDP
-- bloqueada sin aceptación legal vigente). Dos tablas:
--
--   · legal_docs         = T&C / Condiciones del Operador VERSIONADAS. Una fila
--                          por (key, version); estado vigente|archivada; body
--                          jsonb (array [heading, párrafo]). Publicar una nueva
--                          versión NO reescribe aceptaciones previas.
--   · legal_acceptances  = PRUEBA LEGAL inmutable, server-sellada. AC-YYYY-NNNN
--                          con hash SHA-256 + ip + accepted_at del servidor,
--                          atada a la medida real (cbm/weight/total). Append-only:
--                          ni UPDATE ni DELETE (trigger DB que los rechaza).
--
-- + RLS fail-closed por tenant_id (patrón get_user_tenant_id, 0100).
-- + Inmutabilidad en la DB (trigger BEFORE UPDATE OR DELETE → raise): la
--   evidencia legal no se reescribe ni borra. Cubre PostgREST directo, no solo
--   la action (lección de prueba legal).
-- + Validación cross-tenant del client_id en la DB (lección [[0045]] / 0093):
--   helper legal_client_in_tenant() + trigger BEFORE INSERT OR UPDATE → un
--   cliente PostgREST directo no puede sellar una aceptación contra un cliente
--   de otro tenant / inexistente.
-- + Idempotencia INTRÍNSECA: unique(tenant_id, hash) → la misma evidencia
--   produce el mismo hash (canónico+inyectivo) y un reintento exacto no duplica.
--   (idempotency_key queda como metadato; NO es el unique real — dos NULL no
--   colisionan en Postgres.) hash es NOT NULL y LOAD-BEARING: el gate AUT-04 lo
--   recomputa desde la fila y descarta evidencia cuyo hash no cuadre.
-- + RPC next_acceptance_code(p_tenant uuid default null) → AC-YYYY-NNNN
--   (calca next_referral_code / next_quote_code; resuelve get_user_tenant_id()
--   si p_tenant null).
-- + Seed: las 2 docs vigentes de CARA AL CLIENTE (tyc v2.1 + operador v1.4) con
--   su body completo desde erp/modules/admin-legal.jsx. Las internas (acuerdo
--   B2B, brief seguro) NO se seedean: no entran al gate.
--
-- Aditiva: NO toca tablas existentes. FK saliente: client_id → clients(id).
-- ⚠️ NO se aplica a prod desde acá (lo hace el founder).
-- Número de migración: 0102 (0100=costing, 0101=rates ya tomados; este es el
-- siguiente libre).
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. LEGAL_DOCS · documentos legales versionados            ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Una fila por (key, version). key ∈ {tyc, operador, …}; audience cliente|interno
-- (solo las de cliente entran al gate); status vigente|archivada. body jsonb =
-- array de [heading, párrafo] (mismo shape que LEGAL_BODY del Norte). La vigente
-- = la última publicada; el índice parcial garantiza ≤1 vigente por (tenant, key).
create table public.legal_docs (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  key             text not null,                       -- 'tyc' | 'operador' | …
  name            text not null,
  audience        text not null default 'cliente'
                    check (audience in ('cliente', 'interno')),
  version         text not null,                       -- 'v2.1'
  effective_date  date not null,
  status          text not null default 'vigente'
                    check (status in ('vigente', 'archivada')),
  sections        int not null default 0,
  body            jsonb not null default '[]'::jsonb,  -- [[heading, párrafo], …]
  created_at      timestamptz not null default now(),
  unique (tenant_id, key, version)
);

comment on table public.legal_docs is
  'SDD-0054: documentos legales versionados (T&C / Condiciones del Operador). Una fila por (tenant,key,version). Solo audience=cliente entra al gate AUT-04. body jsonb = array [heading, párrafo]. RLS por tenant_id.';

-- ≤1 vigente por (tenant, key): la versión que el cliente acepta.
create unique index legal_docs_current_uniq
  on public.legal_docs (tenant_id, key)
  where status = 'vigente';

create index legal_docs_tenant_audience_idx
  on public.legal_docs (tenant_id, audience, status);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. LEGAL_ACCEPTANCES · prueba legal inmutable (append-only)║
-- ╚═══════════════════════════════════════════════════════════╝
-- El servidor sella accepted_at / ip / hash (el cliente NO los provee). docs =
-- snapshot [{key,version}] de lo aceptado (conserva la versión histórica aunque
-- el doc se archive). cbm/weight_kg/total_usd = la medida a la que está atada la
-- aceptación (el gate AUT-04 compara con la medida vigente). idempotency_key →
-- reintentos no duplican.
create table public.legal_acceptances (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  acceptance_code  text not null,                      -- 'AC-2026-0001'
  client_id        uuid references public.clients(id) on delete set null,
  client_markbox   text,                               -- denormalizado (snapshot)
  quote_code       text,                               -- cotización aceptada
  docs             jsonb not null default '[]'::jsonb, -- [{key,version}, …]
  cbm              numeric(12,3),
  weight_kg        numeric(12,2),
  total_usd        numeric(14,2),
  accepted_at      timestamptz not null default now(), -- server time
  ip               text,                               -- real, del request
  hash             text not null,                      -- SHA-256 hex canónico (LOAD-BEARING)
  idempotency_key  text,                               -- metadato (la idempotencia real es por hash)
  created_at       timestamptz not null default now(),
  unique (tenant_id, acceptance_code),
  -- Round-2: idempotencia INTRÍNSECA por hash. La misma evidencia produce el
  -- mismo hash (acceptanceHashPayload es inyectivo e incluye ip+accepted_at) →
  -- un reintento exacto choca contra este unique y no duplica. Resuelve el hueco
  -- de unique(tenant,idempotency_key): en Postgres dos NULL no colisionan, así
  -- que aceptaciones sin idempotency_key se podían duplicar; el hash no.
  unique (tenant_id, hash)
);

comment on table public.legal_acceptances is
  'SDD-0054: registro INMUTABLE (append-only) de aceptaciones legales. PRUEBA LEGAL server-sellada: accepted_at/ip/hash los pone el servidor; hash NOT NULL es LOAD-BEARING (el gate AUT-04 lo recomputa y verifica). Atada a la medida (cbm/weight/total). Trigger rechaza UPDATE/DELETE. Idempotente por (tenant, hash). RLS por tenant_id.';

create index legal_acceptances_tenant_client_idx
  on public.legal_acceptances (tenant_id, client_id, accepted_at desc);

create index legal_acceptances_tenant_quote_idx
  on public.legal_acceptances (tenant_id, quote_code);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. INMUTABILIDAD · append-only (prueba legal)             ║
-- ╚═══════════════════════════════════════════════════════════╝
-- La evidencia legal no se reescribe ni borra. BEFORE UPDATE OR DELETE → raise.
-- Solo INSERT. Cubre PostgREST directo, no solo la server action de Slice C.
create or replace function public.legal_acceptances_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'legal_acceptances es append-only (prueba legal): % no permitido', tg_op
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists legal_acceptances_immutable_trg on public.legal_acceptances;
create trigger legal_acceptances_immutable_trg
  before update or delete on public.legal_acceptances
  for each row execute function public.legal_acceptances_immutable();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4. VALIDACIÓN cross-tenant del client_id (lección 0045)   ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Helper: ¿el cliente existe y es del tenant? (null → true; client_id es
-- nullable). SECURITY DEFINER para no depender del grant SELECT de clients al
-- rol caller; el filtro por tenant_id es explícito (el trigger pasa
-- NEW.tenant_id, que RLS ya forzó = tenant del caller) → sin fuga cross-tenant.
create or replace function public.legal_client_in_tenant(
  p_client uuid,
  p_tenant uuid
) returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_client is null then
    return true;
  end if;
  return exists (
    select 1 from public.clients
    where id = p_client and tenant_id = p_tenant and deleted_at is null
  );
end;
$$;

-- Trigger: rechaza client_id de otro tenant o inexistente. Cubre PostgREST
-- directo, no solo la action (registerAcceptance de Slice C).
create or replace function public.legal_acceptances_validate_client()
returns trigger
language plpgsql
as $$
begin
  if not public.legal_client_in_tenant(new.client_id, new.tenant_id) then
    raise exception 'cliente inexistente o ajeno al tenant: %', new.client_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists legal_acceptances_validate_client_trg on public.legal_acceptances;
create trigger legal_acceptances_validate_client_trg
  before insert or update on public.legal_acceptances
  for each row execute function public.legal_acceptances_validate_client();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 5. RPC next_acceptance_code · AC-YYYY-NNNN                ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Counter por año + tenant (calca next_referral_code 0098 / next_quote_code
-- 0007). Si p_tenant es null resuelve el tenant del caller vía
-- get_user_tenant_id(). Padding 4; se extiende solo si pasa de 9999 en un año.
-- ⚠️ Deuda HEREDADA (round-2): max()+1 sin lock tiene una race bajo concurrencia
-- (calca next_quote_code, que la tolera por la red del unique). NO se cambia el
-- patrón acá; la action de Slice C debe REINTENTAR ante choque de
-- unique(tenant,acceptance_code) — correlativo legal sin huecos. Ver §7 spec.
create or replace function public.next_acceptance_code(p_tenant uuid default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := coalesce(p_tenant, public.get_user_tenant_id());
  v_year   int  := extract(year from current_date);
  v_max    int;
  v_padded text;
begin
  select coalesce(max((regexp_match(acceptance_code, '^AC-\d{4}-(\d+)$'))[1]::int), 0) + 1
  into v_max
  from public.legal_acceptances
  where tenant_id = v_tenant
    and acceptance_code like 'AC-' || v_year || '-%';

  v_padded := lpad(v_max::text, 4, '0');
  return 'AC-' || v_year || '-' || v_padded;
end;
$$;

comment on function public.next_acceptance_code is
  'SDD-0054: genera el próximo acceptance_code AC-YYYY-NNNN para el tenant del año actual (resuelve get_user_tenant_id() si p_tenant null).';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 6. GRANTS EXPLÍCITOS (auto-expose new tables OFF)         ║
-- ╚═══════════════════════════════════════════════════════════╝
-- legal_docs: write reservado a admin/service_role (la RLS de write filtra). Acá
-- el grant de tabla habilita el verbo; la policy decide quién. authenticated lee.
grant select, insert, update, delete on public.legal_docs to authenticated;
grant all on public.legal_docs to service_role;

-- legal_acceptances: insert habilitado (Slice C sella); update/delete los corta
-- el trigger de inmutabilidad aunque el grant exista.
grant select, insert on public.legal_acceptances to authenticated;
grant all on public.legal_acceptances to service_role;

grant execute on function public.next_acceptance_code(uuid) to authenticated;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 7. RLS · fail-closed por tenant_id                        ║
-- ╚═══════════════════════════════════════════════════════════╝
alter table public.legal_docs enable row level security;

-- Read: cualquier autenticado del tenant.
create policy "legal_docs read by tenant"
  on public.legal_docs for select to authenticated
  using (tenant_id = public.get_user_tenant_id());

-- Write (insert/update/delete): solo admin del tenant (publicar/archivar versión).
create policy "legal_docs write by admin"
  on public.legal_docs for insert to authenticated
  with check (
    tenant_id = public.get_user_tenant_id()
    and exists (
      select 1 from public.user_tenants ut
      where ut.user_id = auth.uid()
        and ut.tenant_id = public.get_user_tenant_id()
        and ut.role = 'admin'
        and ut.disabled_at is null
    )
  );

create policy "legal_docs update by admin"
  on public.legal_docs for update to authenticated
  using (
    tenant_id = public.get_user_tenant_id()
    and exists (
      select 1 from public.user_tenants ut
      where ut.user_id = auth.uid()
        and ut.tenant_id = public.get_user_tenant_id()
        and ut.role = 'admin'
        and ut.disabled_at is null
    )
  )
  with check (tenant_id = public.get_user_tenant_id());

create policy "legal_docs delete by admin"
  on public.legal_docs for delete to authenticated
  using (
    tenant_id = public.get_user_tenant_id()
    and exists (
      select 1 from public.user_tenants ut
      where ut.user_id = auth.uid()
        and ut.tenant_id = public.get_user_tenant_id()
        and ut.role = 'admin'
        and ut.disabled_at is null
    )
  );

create policy "legal_docs service_role all"
  on public.legal_docs for all to service_role using (true) with check (true);

alter table public.legal_acceptances enable row level security;

-- Read + insert por tenant. (update/delete los rechaza el trigger de
-- inmutabilidad; igual no hay policy que los habilite.)
create policy "legal_acceptances read by tenant"
  on public.legal_acceptances for select to authenticated
  using (tenant_id = public.get_user_tenant_id());

create policy "legal_acceptances insert by tenant"
  on public.legal_acceptances for insert to authenticated
  with check (tenant_id = public.get_user_tenant_id());

create policy "legal_acceptances service_role all"
  on public.legal_acceptances for all to service_role using (true) with check (true);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 8. SEED · 2 docs vigentes de cara al cliente              ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Desde erp/modules/admin-legal.jsx (LEGAL_DOCS + LEGAL_BODY). Solo las de
-- audiencia cliente vigentes (tyc v2.1, operador v1.4). Las internas (acuerdo
-- B2B, brief seguro) NO se seedean: no entran al gate. Idempotente por tenant
-- (on conflict do nothing sobre el unique (tenant,key,version)).
insert into public.legal_docs (tenant_id, key, name, audience, version, effective_date, status, sections, body)
select t.id, x.key, x.name, 'cliente', x.version, x.effective_date::date, 'vigente', x.sections, x.body::jsonb
from public.tenants t
cross join (values
  (
    'tyc',
    'Términos y Condiciones de DTD',
    'v2.1',
    '2026-05-01',
    11,
    $body$[
      ["1. Objeto", "DTD-Cargo presta servicios de consolidación y transporte puerta a puerta China–Venezuela bajo modalidad DDP. La aceptación de una cotización constituye una orden de servicio en firme sujeta a estos Términos."],
      ["2. Naturaleza del servicio", "DTD-Cargo actúa como agente de carga y comisionista mercantil intermediario, no como transportista principal. Coordina servicios de terceros (operador de consolidación, líneas navieras, transportistas terrestres y agentes aduaneros) por cuenta y orden del Cliente. La relación es mercantil entre comerciantes y se rige por el Código de Comercio venezolano."],
      ["3. Tarifas y vigencia", "La tarifa cotizada es válida por 7 días corridos desde su emisión y está sujeta a la confirmación de volumen y peso reales en el almacén de origen. Las diferencias de CBM/peso se reliquidan al cierre del contenedor."],
      ["4. Responsabilidad", "La responsabilidad de DTD-Cargo, en caso de negligencia grave o dolo propio comprobado, se limita al valor del flete pagado por el envío afectado, y nunca al valor de la mercancía. No cubre lucro cesante ni daños indirectos. DTD-Cargo no responde por pérdida, daño, hurto o demora imputables a terceros (operador de consolidación, naviera o aduana); tales reclamos deben dirigirse al transportista efectivo o a la aseguradora de la carga."],
      ["5. Seguro", "El flete NO incluye seguro de carga. El seguro es opcional y se cotiza por separado. Si el Cliente opta por no asegurar, asume todo el riesgo del transporte sin derecho a reclamo contra DTD-Cargo. DTD-Cargo puede gestionar la contratación del seguro como servicio adicional, bajo solicitud expresa del Cliente."],
      ["6. Plazos", "Los ETD/ETA son estimados y dependen de itinerarios navieros, congestión portuaria y liberación aduanera. DTD-Cargo no responde por demoras ajenas a su control directo."],
      ["7. Mercancía prohibida y peligrosa", "El Cliente declara que la mercancía no incluye artículos prohibidos, mercancía peligrosa no declarada, ni réplicas o falsificaciones. La mercancía peligrosa debe declararse por escrito antes del embarque conforme a la normativa aplicable. La omisión o falsedad traslada la responsabilidad legal y económica al Cliente, quien indemnizará a DTD-Cargo por todo daño, multa o gasto resultante."],
      ["8. Operador de consolidación y subcontratación", "DTD-Cargo subcontrata, por cuenta y orden del Cliente, los servicios de consolidación y transporte con operadores independientes. El contrato de transporte se perfecciona entre el Cliente y el transportista efectivo y/o el operador de consolidación, y el Conocimiento de Embarque (B/L) puede emitirse a nombre del operador de consolidación, no de DTD-Cargo ni del Cliente. La mercancía puede consolidarse con carga de otros clientes. Las condiciones aplicables se detallan en el documento \"Condiciones del Operador de Consolidación\"."],
      ["9. Pagos", "El Cliente pagará el flete y los servicios conforme a la modalidad acordada (pago anticipado o contra entrega). La mercancía viaja bajo derecho de retención a favor de DTD-Cargo hasta el pago íntegro; no se entrega sin pago completo."],
      ["10. Aceptación electrónica y versiones", "Estos Términos se aceptan electrónicamente mediante una casilla de aceptación previa y obligatoria a la confirmación de cada cotización. DTD-Cargo registra como evidencia: identificación del Cliente, cotización, versión del documento, fecha y hora, dirección IP y huella de integridad (hash). Cada operación queda vinculada a la versión vigente al momento de la aceptación."],
      ["11. Ley aplicable y jurisdicción", "Estos Términos se rigen por las leyes de la República Bolivariana de Venezuela. Toda controversia se someterá a [mediación o arbitraje, o a los tribunales competentes en Venezuela — definir con abogado]."]
    ]$body$
  ),
  (
    'operador',
    'Condiciones del Operador de Consolidación',
    'v1.4',
    '2026-04-15',
    9,
    $body$[
      ["1. Rol del operador", "El operador de consolidación agrupa cargas de múltiples clientes en un mismo contenedor (LCL→FCL). El Cliente acepta compartir contenedor, salvo contratación expresa de FCL exclusivo."],
      ["2. Manipulación", "La carga puede ser abierta, pesada, fotografiada y reembalada para optimizar el cubicaje. El operador registra evidencia fotográfica en cada etapa."],
      ["3. Almacenaje", "Los primeros 15 días de almacenaje en origen son sin cargo. A partir del día 16 se aplica una tarifa diaria por CBM según el tarifario vigente."],
      ["4. Consolidación parcial", "Si la carga no entra completa en el contenedor en curso, el operador puede dividirla (P1/P2) y despacharla en embarques sucesivos, notificando al Cliente."],
      ["5. Identificación de la carga", "Cada bulto debe rotularse únicamente con el código de identificación asignado (MarkBox), sin nombre, dirección ni datos personales del Cliente. El operador no responde por decomisos, extravíos o confusión de carga derivados de identificación incorrecta o de datos personales colocados en las cajas."],
      ["6. Mercancía peligrosa", "No se admite mercancía peligrosa sin declaración previa por escrito y cumplimiento de la normativa aplicable (Código IMDG). La mercancía mal declarada puede ser descargada, neutralizada o destruida a riesgo y costo del Cliente, quien indemnizará por todo daño resultante."],
      ["7. Responsabilidad del operador", "El operador de consolidación no es el transportista efectivo ni asegura el valor de la mercancía. Su responsabilidad se limita a la indemnización que el transportista efectivo reconozca, dentro de los límites de responsabilidad del transportista."],
      ["8. Avería gruesa (General Average)", "En caso de avería gruesa declarada por la naviera, el Cliente deberá aportar el depósito o la garantía exigida como condición para la liberación de su carga, conforme a las Reglas de York-Amberes."],
      ["9. Seguro", "La carga viaja sin seguro salvo contratación expresa. El operador no asegura la mercancía por cuenta del Cliente."]
    ]$body$
  )
) as x(key, name, version, effective_date, sections, body)
where t.slug = 'dtd'
on conflict (tenant_id, key, version) do nothing;

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0102_capa_legal.sql
-- Aplicar con: supabase migration apply 0102 · o MCP apply_migration
-- (lo hace el founder; el harness NO aplica a prod).
-- ─────────────────────────────────────────────────────────────

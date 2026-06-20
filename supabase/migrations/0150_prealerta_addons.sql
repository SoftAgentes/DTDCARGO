-- ─────────────────────────────────────────────────────────────
-- SDD-0098: Prealertas · Menú de servicios de recepción ("ads") + video-ayuda
--
-- Cuelga SERVICIOS DE VALOR AGREGADO a la compra/prealerta (SDD-0057). Al registrar
-- (o desde el detalle de) su compra, el cliente pide servicios sobre ella:
-- Verificación (revisar al recibir), Inspección de calidad al recibir, Reempaque
-- (unificar bultos), Compactar (reducir volumen), Etiquetado por pieza, Cotizar /
-- medir, Hold (retener para consolidar). Cobro ADVISORY (lo cotiza el asesor).
--
-- Dos tablas:
--   - prealerta_addons          : CATÁLOGO configurable por tenant (label, copy,
--                                 consent_text, video_url, is_active, multi_tracking).
--                                 Seedeado con los 7. La app respalda con DEFAULTS de
--                                 código (DB pisa, código respalda) → cero pantalla
--                                 vacía y funciona ANTES de aplicar esta migración.
--   - prealerta_service_requests: la SOLICITUD real del cliente sobre UNA prealerta
--                                 (addon_code + status + timing + consent + notas).
--
-- Regla "antes de almacén" (idea del courier de referencia, adaptada a China→VE):
-- una solicitud creada DESPUÉS de que la prealerta fue recibida se marca
-- timing='tardia'. Lo fija el trigger leyendo la prealerta padre (no forjable desde
-- PostgREST), no la action.
--
-- RLS DOBLE fail-closed (espeja 0105): el CLIENTE del portal CRUD de SUS solicitudes
-- (por markbox + tenant), el OPERADOR del tenant las gestiona (get_user_tenant_id).
-- Defensa en DB de la tabla hija polimórfica: el trigger valida que prealerta_id es
-- del mismo (tenant, markbox) — SECURITY INVOKER, la RLS del caller esconde lo ajeno
-- (un id de otro cliente cae en "not found").
--
-- Aditiva · sin DDL destructivo · text+CHECK (sin enum nativo → sin cast enum↔text).
-- Correlativo 0150 (verificado vs origin/main + TODAS las ramas; 0149 = feat/academia).
-- NO se aplica a prod desde acá (lo hace coordinación).
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. prealerta_addons · catálogo configurable (seed 7)      ║
-- ╚═══════════════════════════════════════════════════════════╝
create table public.prealerta_addons (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  code              text not null
                      check (code in (
                        'verificacion','inspeccion_recepcion','reempaque_unificar',
                        'compactar','etiquetado_pieza','cotizar_medir','hold_consolidar'
                      )),
  label             text not null,
  description       text not null,
  notas_placeholder text,
  consent_text      text,
  video_url         text,                          -- NULL = "config lista y vacía" (founder pega el short luego)
  multi_tracking    boolean not null default false,
  sort              int not null default 0,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (tenant_id, code)
);

comment on table public.prealerta_addons is
  'SDD-0098: catálogo configurable (por tenant) de servicios de recepción que el cliente puede pedir sobre su compra/prealerta. La app respalda con defaults de código (lib/studio/prealertas/addons.ts): la DB pisa, el código respalda. video_url NULL hasta que el founder grabe los shorts. is_active prende/apaga cada servicio sin deploy.';

create index prealerta_addons_tenant_active_idx
  on public.prealerta_addons (tenant_id, sort) where is_active;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. prealerta_service_requests · solicitud del cliente     ║
-- ╚═══════════════════════════════════════════════════════════╝
create table public.prealerta_service_requests (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  prealerta_id      uuid not null references public.prealertas(id) on delete cascade,
  client_markbox    text not null,                 -- dueño (MARKBOX del cliente), snapshot p/ RLS
  addon_code        text not null
                      check (addon_code in (
                        'verificacion','inspeccion_recepcion','reempaque_unificar',
                        'compactar','etiquetado_pieza','cotizar_medir','hold_consolidar'
                      )),
  status            text not null default 'solicitada'
                      check (status in ('solicitada','en_proceso','atendida','descartada','invalida')),
  timing            text not null default 'a_tiempo'
                      check (timing in ('a_tiempo','tardia')),   -- lo fija el trigger guard
  trackings         text[],                        -- trackings extra (reempaque/hold multi); null en mono
  consent_accepted  boolean not null default false,
  notes             text,
  quoted_amount_usd numeric(12,2),                 -- lo carga el asesor (advisory)
  processed_by      uuid references auth.users(id) on delete set null,
  processed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

comment on table public.prealerta_service_requests is
  'SDD-0098: solicitud de un servicio de recepción (addon_code) del cliente sobre UNA prealerta. status solicitada→en_proceso→atendida/descartada/invalida. timing a_tiempo|tardia lo fija el trigger guard (tardia si la prealerta ya fue recibida = regla "antes de almacén"). Cobro advisory (quoted_amount_usd lo carga el asesor). RLS doble por markbox+tenant (espeja prealertas, 0105).';

-- una solicitud ACTIVA por (prealerta, addon); re-pedir tras descartar = soft delete + nueva
create unique index prealerta_service_requests_unique_active
  on public.prealerta_service_requests (prealerta_id, addon_code) where deleted_at is null;

create index prealerta_service_requests_prealerta_idx
  on public.prealerta_service_requests (prealerta_id) where deleted_at is null;
create index prealerta_service_requests_tenant_status_idx
  on public.prealerta_service_requests (tenant_id, status) where deleted_at is null;
create index prealerta_service_requests_markbox_idx
  on public.prealerta_service_requests (client_markbox) where deleted_at is null;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. Trigger guard · parent en (tenant, markbox) + timing   ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Defensa en DB: la tabla hija es forjable vía PostgREST si solo validara la action
-- (lección feedback_polymorphic_table_db_validation). SECURITY INVOKER: la RLS del
-- caller ya esconde prealertas ajenas → un prealerta_id de otro cliente cae en
-- "not found". Fija timing='tardia' en el INSERT si la prealerta padre ya fue recibida.
create or replace function public.prealerta_service_request_guard()
returns trigger
language plpgsql
as $$
declare
  v_received timestamptz;
  v_status   text;
begin
  select received_at, status into v_received, v_status
  from public.prealertas
  where id = new.prealerta_id
    and tenant_id = new.tenant_id
    and client_markbox = new.client_markbox
    and deleted_at is null;

  if not found then
    raise exception 'prealerta inexistente o de otro cliente/tenant: %', new.prealerta_id
      using errcode = 'check_violation';
  end if;

  if tg_op = 'INSERT' then
    if v_received is not null or v_status in ('recibida', 'consolidada') then
      new.timing := 'tardia';
    else
      new.timing := 'a_tiempo';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.prealerta_service_request_guard is
  'SDD-0098: BEFORE INSERT/UPDATE de prealerta_service_requests. Valida que prealerta_id pertenece al mismo (tenant_id, client_markbox) — SECURITY INVOKER, la RLS del caller hace el scope. Fija timing=tardia si la prealerta ya fue recibida (regla "antes de almacén").';

revoke execute on function public.prealerta_service_request_guard() from public, anon;

drop trigger if exists prealerta_service_request_guard_trg on public.prealerta_service_requests;
create trigger prealerta_service_request_guard_trg
  before insert or update on public.prealerta_service_requests
  for each row execute function public.prealerta_service_request_guard();

-- updated_at (reusa touch_updated_at existente)
create trigger prealerta_addons_touch
  before update on public.prealerta_addons
  for each row execute function public.touch_updated_at();

create trigger prealerta_service_requests_touch
  before update on public.prealerta_service_requests
  for each row execute function public.touch_updated_at();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4. GRANTS EXPLÍCITOS (auto-expose new tables OFF)         ║
-- ╚═══════════════════════════════════════════════════════════╝
grant select, insert, update, delete on public.prealerta_addons           to authenticated;
grant select, insert, update, delete on public.prealerta_service_requests to authenticated;

grant all on public.prealerta_addons           to service_role;
grant all on public.prealerta_service_requests to service_role;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 5. RLS · prealerta_addons (config: lee portal+equipo)     ║
-- ╚═══════════════════════════════════════════════════════════╝
alter table public.prealerta_addons enable row level security;

-- LECTURA: equipo del tenant + cliente del portal del tenant (para renderizar el menú).
create policy "prealerta_addons read"
  on public.prealerta_addons for select to authenticated
  using (
    tenant_id = public.get_user_tenant_id()
    or tenant_id = public.get_portal_client_tenant()
  );

-- ESCRITURA de config: solo equipo del tenant (futuro editor en Studio; el cliente NO).
create policy "prealerta_addons tenant write"
  on public.prealerta_addons for all to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());

create policy "prealerta_addons service_role all"
  on public.prealerta_addons for all to service_role
  using (true) with check (true);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 6. RLS DOBLE · prealerta_service_requests                 ║
-- ╚═══════════════════════════════════════════════════════════╝
alter table public.prealerta_service_requests enable row level security;

-- CLIENTE del portal: SELECT de las suyas (por markbox).
create policy "psr portal self select"
  on public.prealerta_service_requests for select to authenticated
  using (
    deleted_at is null
    and client_markbox = public.get_portal_client_markbox()
  );

-- CLIENTE del portal: INSERT de las suyas. tenant/markbox forzados al propio +
-- consentimiento OBLIGATORIO en el WITH CHECK (no se puede pedir sin aceptar).
create policy "psr portal self insert"
  on public.prealerta_service_requests for insert to authenticated
  with check (
    tenant_id = public.get_portal_client_tenant()
    and client_markbox = public.get_portal_client_markbox()
    and consent_accepted = true
  );

-- CLIENTE del portal: UPDATE de las suyas (ej. cancelar = soft delete / editar notas).
create policy "psr portal self update"
  on public.prealerta_service_requests for update to authenticated
  using (client_markbox = public.get_portal_client_markbox())
  with check (
    tenant_id = public.get_portal_client_tenant()
    and client_markbox = public.get_portal_client_markbox()
  );

-- OPERADOR del tenant: SELECT + UPDATE (gestiona estado/cotización). No INSERT (lo crea el cliente).
create policy "psr tenant read"
  on public.prealerta_service_requests for select to authenticated
  using (tenant_id = public.get_user_tenant_id());

create policy "psr tenant update"
  on public.prealerta_service_requests for update to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());

-- service_role: all (workers, admin client scopeado de las actions del portal).
create policy "psr service_role all"
  on public.prealerta_service_requests for all to service_role
  using (true) with check (true);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 7. SEED · los 7 servicios por tenant (DB pisa código)     ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Copy en marca DTD, cobro advisory, sin fees inventados. video_url NULL (vacío).
-- Los 7 is_active=true (decisión founder). on conflict do nothing = idempotente.
insert into public.prealerta_addons
  (tenant_id, code, label, description, notas_placeholder, consent_text, multi_tracking, sort, is_active)
select t.id, x.code, x.label, x.description, x.notas_placeholder, x.consent_text, x.multi_tracking, x.sort, x.is_active
from public.tenants t
cross join (values
  ('verificacion', 'Verificación al recibir',
   'Revisamos tu compra cuando llega a la bodega: abrimos, contamos contra tu factura o packing y te enviamos fotos.',
   'Detalla qué debe traer tu compra: cantidades, descripción, tallas, colores y cualquier dato relevante.',
   'Entiendo que este servicio lo coordina y cotiza mi asesor, y que debo pedirlo antes de que mi compra llegue a la bodega.',
   false, 10, true),
  ('inspeccion_recepcion', 'Inspección de calidad al recibir',
   'Revisión técnica al recibir: abrimos el producto, revisamos su interior, etiquetado y gramaje según lo que necesites.',
   'Indica qué quieres que revisemos del producto (medidas, materiales, gramaje, etiquetado, funcionamiento).',
   'Entiendo que este servicio lo coordina y cotiza mi asesor, y que debo pedirlo antes de que mi compra llegue a la bodega.',
   false, 20, true),
  ('reempaque_unificar', 'Reempaque (unificar bultos)',
   'Juntamos varios bultos en un solo empaque para que tu carga viaje ordenada. Esperamos a que lleguen todos y los unimos.',
   'Lista los trackings que quieres unificar en este reempaque.',
   'Entiendo que este servicio lo coordina y cotiza mi asesor, y que debo pedirlo antes de que llegue el primer bulto a la bodega.',
   true, 30, true),
  ('compactar', 'Compactar (reducir volumen)',
   'Eliminamos el exceso de volumen de tu caja para que viaje más liviana y ahorres en flete. Nuestro equipo evalúa si aplica.',
   'Cuéntanos qué trae la caja para evaluar si se puede compactar.',
   'Entiendo que este servicio lo coordina y cotiza mi asesor, y que debo pedirlo antes de que mi compra llegue a la bodega.',
   false, 40, true),
  ('etiquetado_pieza', 'Etiquetado por pieza',
   'Marcamos o etiquetamos tus piezas según tu requerimiento antes de embarcar.',
   'Indica cómo quieres que etiquetemos las piezas.',
   'Entiendo que este servicio lo coordina y cotiza mi asesor, y que debo pedirlo antes de que mi compra llegue a la bodega.',
   false, 50, true),
  ('cotizar_medir', 'Cotizar / medir',
   'Medimos tu paquete (CBM) y te decimos cuánto cuesta enviarlo por aéreo y por marítimo, para que elijas la mejor opción.',
   'Agrega cualquier dato útil del paquete (qué trae, fragilidad, urgencia).',
   'Entiendo que este servicio lo coordina y cotiza mi asesor, y que debo pedirlo antes de que mi compra llegue a la bodega.',
   false, 60, true),
  ('hold_consolidar', 'Hold (retener para consolidar)',
   'Retenemos tu carga en bodega para juntarla con tu próxima compra y consolidar el envío. Pídelo cuando esperas más mercancía.',
   'Cuéntanos qué estás esperando o con qué compra quieres consolidar.',
   'Entiendo que este servicio lo coordina y cotiza mi asesor, y que debo pedirlo antes de que mi compra llegue a la bodega.',
   true, 70, true)
) as x(code, label, description, notas_placeholder, consent_text, multi_tracking, sort, is_active)
on conflict (tenant_id, code) do nothing;

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0150_prealerta_addons.sql
-- Aplicar con: supabase migration apply 0150 · o MCP apply_migration (coordinación)
-- ─────────────────────────────────────────────────────────────

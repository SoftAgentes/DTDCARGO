-- ─────────────────────────────────────────────────────────────
-- SDD-0146 · Bitácora — core (Fase 1 · Fundación)
--
-- Actas de reunión con IA + gestor de tareas del equipo (Studio + móvil staff).
-- 4 tablas: bitacora_meetings (acta, borrador privado + visibilidad),
-- bitacora_tasks (4 estados · 3 prioridades · cola por rol · realtime),
-- bitacora_task_assignees (dueño DRI, trigger anti cross-tenant),
-- bitacora_task_checklist (plano, 1 nivel).
--
-- Moldes: 0090 (freeze trigger) · 0097 (bucket privado + 4 policies por
-- foldername[1]=tenant) · 0181 (helper *_in_tenant fail-closed + trigger
-- same-tenant) · 0012 (get_user_tenant_id + (select …) wrap en policies).
--
-- Defensa-en-DB (lección SDD-0045 · feedback_polymorphic_table_db_validation):
-- la server action valida, PERO un cliente PostgREST directo la saltaría →
-- helpers + triggers en la DB cubren TODO cliente.
--
-- Aditiva. GRANT base JUNTO a cada RLS. REVOKE public/anon + GRANT
-- authenticated en TODA función nueva (regla 0209/0211).
-- NO aplicar a prod (lo hace el founder).
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 0. Helper · ¿el user pertenece al tenant? (fail-closed)    ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Calca de employee_in_tenant (0181). SECURITY DEFINER porque la RLS de
-- user_tenants solo deja ver la fila propia. Fail-closed: null in → false;
-- membership desactivado (disabled_at) → false.
create or replace function public.user_in_tenant(p_user_id uuid, p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (p_user_id is not null and p_tenant_id is not null and exists (
      select 1 from public.user_tenants ut
      where ut.user_id = p_user_id
        and ut.tenant_id = p_tenant_id
        and ut.disabled_at is null
    )),
    false
  );
$$;

comment on function public.user_in_tenant is
  'SDD-0146: ¿el auth.user tiene membership ACTIVO en el tenant? fail-closed (null/disabled → false). Lo usan los triggers de coherencia de Bitácora y el RPC de confirmación. Calca de employee_in_tenant (0181).';

revoke all on function public.user_in_tenant(uuid, uuid) from public;
revoke execute on function public.user_in_tenant(uuid, uuid) from anon;
grant execute on function public.user_in_tenant(uuid, uuid) to authenticated;

-- Helper de policy: ¿el caller es admin de su tenant? (patrón 0090 inline,
-- extraído para no repetir el EXISTS en 3 policies de meetings).
create or replace function public.bitacora_is_tenant_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(exists (
    select 1 from public.user_tenants ut
    where ut.user_id = (select auth.uid())
      and ut.tenant_id = (select public.get_user_tenant_id())
      and ut.role = 'admin'
      and ut.disabled_at is null
  ), false);
$$;

comment on function public.bitacora_is_tenant_admin is
  'SDD-0146: ¿el caller es admin de su propio tenant? Solo para las policies de visibilidad de bitacora_meetings (borrador privado / reunión confidencial).';

revoke all on function public.bitacora_is_tenant_admin() from public;
revoke execute on function public.bitacora_is_tenant_admin() from anon;
grant execute on function public.bitacora_is_tenant_admin() to authenticated;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. BITACORA_MEETINGS · acta (borrador → confirmada)        ║
-- ╚═══════════════════════════════════════════════════════════╝
-- id client-generated aceptado (crypto.randomUUID() antes de subir audio).
-- [DELTA origen] la columna bitacora[] del acta se llama puntos[] (colisión con
-- el nombre del módulo). created_by NULL + SET NULL (resuelve contradicción
-- NOT NULL+SET NULL del MD de origen).
create table public.bitacora_meetings (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  titulo         text not null check (length(trim(titulo)) > 0 and length(titulo) <= 300),
  fecha          date not null default current_date,
  tipo           text not null default 'interna'
    check (tipo in ('interna', 'cliente')),
  client_id      uuid references public.clients(id) on delete set null,
  contacto_libre text,      -- lead sin registrar · NUNCA auto-crear cliente (SDD-0046 exige RIF/cédula)
  resumen        text,
  acta           jsonb,     -- { puntos[], hablaron[], decisiones[], pendientes[], proxima_reunion }
  transcript     text,
  audio_path     text,      -- {tenant}/bitacora_meeting/{meetingId}/{uuid}.{ext} en bucket bitacora
  estado         text not null default 'borrador'
    check (estado in ('borrador', 'confirmada')),
  visibilidad    text not null default 'equipo'
    check (visibilidad in ('equipo', 'gestores')),
  created_by     uuid references auth.users(id) on delete set null,
  confirmed_by   uuid references auth.users(id) on delete set null,
  confirmed_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.bitacora_meetings is
  'SDD-0146: acta de reunión/conversación. borrador (IA propone, solo creador+admin la ven) → confirmada (humano autoriza vía RPC bitacora_confirm_meeting). visibilidad=gestores gatea acta/transcript/audio (las tareas confirmadas siguen tenant-wide). acta.puntos[] = rename deliberado del bitacora[] de origen.';

create index bitacora_meetings_tenant_estado_idx
  on public.bitacora_meetings (tenant_id, estado, fecha desc);

create index bitacora_meetings_client_idx
  on public.bitacora_meetings (client_id)
  where client_id is not null;

-- GRANT base JUNTO a la RLS (auto-expose OFF). Sin DELETE: las actas no se
-- borran (memoria institucional); descartar un borrador = V2 con soft path.
grant select, insert, update on public.bitacora_meetings to authenticated;
grant all on public.bitacora_meetings to service_role;

alter table public.bitacora_meetings enable row level security;

-- SELECT: borradores solo el creador o admin; confirmadas tenant-wide, salvo
-- visibilidad='gestores' → solo admin + creador.
create policy "bitacora_meetings select"
  on public.bitacora_meetings for select to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (
      case
        when estado = 'borrador'
          then (created_by = (select auth.uid()) or (select public.bitacora_is_tenant_admin()))
        when visibilidad = 'gestores'
          then (created_by = (select auth.uid()) or (select public.bitacora_is_tenant_admin()))
        else true
      end
    )
  );

-- INSERT: dentro del tenant y el autor es el caller.
create policy "bitacora_meetings insert"
  on public.bitacora_meetings for insert to authenticated
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and created_by = (select auth.uid())
  );

-- UPDATE: creador o admin, dentro del tenant (la confirmación va por RPC
-- SECURITY INVOKER → esta policy es la que la autoriza).
create policy "bitacora_meetings update"
  on public.bitacora_meetings for update to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (created_by = (select auth.uid()) or (select public.bitacora_is_tenant_admin()))
  )
  with check (tenant_id = (select public.get_user_tenant_id()));

-- DELETE real: bloqueado (no hay grant, y la policy niega por si acaso).
create policy "bitacora_meetings no delete"
  on public.bitacora_meetings for delete to authenticated using (false);

create policy "bitacora_meetings service_role all"
  on public.bitacora_meetings for all to service_role using (true) with check (true);

-- Freeze de identidad (molde 0090): RLS no compara contra OLD → un UPDATE
-- podría mover el acta de tenant/autor. Solo contenido y estado son mutables.
create or replace function public.bitacora_meetings_freeze_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.id         := old.id;
  new.tenant_id  := old.tenant_id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  return new;
end;
$$;

revoke execute on function public.bitacora_meetings_freeze_immutable() from public, anon;

create trigger bitacora_meetings_freeze_trg
  before update on public.bitacora_meetings
  for each row execute function public.bitacora_meetings_freeze_immutable();

create trigger bitacora_meetings_touch
  before update on public.bitacora_meetings
  for each row execute function public.touch_updated_at();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. BITACORA_TASKS · gestor (4 estados · cola por rol)      ║
-- ╚═══════════════════════════════════════════════════════════╝
create table public.bitacora_tasks (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  meeting_id         uuid references public.bitacora_meetings(id) on delete set null,
  titulo             text not null check (length(trim(titulo)) > 0 and length(titulo) <= 300),
  descripcion        text check (descripcion is null or length(descripcion) <= 4000),
  estado             text not null default 'pendiente'
    check (estado in ('pendiente', 'en_curso', 'en_revision', 'hecho')),
  prioridad          text not null default 'media'
    check (prioridad in ('baja', 'media', 'alta')),
  tipo               text not null default 'empleado'
    check (tipo in ('empleado', 'entregable_cliente')),
  -- Cola por rol (patrón Triage de Linear): tarea sin dueño cae a la bandeja
  -- del rol y alguien la "toma". Mismo vocabulario de 7 roles del RBAC.
  assigned_role      text
    check (assigned_role in ('admin', 'commercial', 'operations', 'accounting', 'warehouse', 'support', 'marketing')),
  para_agente        boolean not null default false,
  client_id          uuid references public.clients(id) on delete set null,
  -- Responsable crudo de la IA cuando NO hubo match en el equipo (regla de
  -- oro: sin asignar con el nombre visible — nunca se inventa).
  responsable_nombre text,
  due_date           date,
  orden              int not null default 0,
  completed_at       timestamptz,
  created_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.bitacora_tasks is
  'SDD-0146: tarea interna del equipo. 4 estados / 3 prioridades / tipo entregable_cliente (badge "Esperando al cliente"). assigned_role = cola por rol (sin dueño → bandeja del rol). completed_at lo fija el trigger (port de Rumbo). responsable_nombre = crudo de la IA sin match (nunca se inventa un asignado). RLS tenant-wide (SDD-0085: el gate por rol es capa app).';

create index bitacora_tasks_tenant_estado_idx
  on public.bitacora_tasks (tenant_id, estado, due_date);

-- Índice PARCIAL para la query del digest 8am (due ≤ hoy, no hechas).
create index bitacora_tasks_digest_idx
  on public.bitacora_tasks (tenant_id, due_date)
  where estado != 'hecho';

create index bitacora_tasks_meeting_idx
  on public.bitacora_tasks (meeting_id)
  where meeting_id is not null;

create index bitacora_tasks_client_idx
  on public.bitacora_tasks (client_id)
  where client_id is not null;

-- GRANT base JUNTO a la RLS. Sin DELETE (no hay hard-delete de tareas; el
-- ciclo de vida vive en `estado`).
grant select, insert, update on public.bitacora_tasks to authenticated;
grant all on public.bitacora_tasks to service_role;

alter table public.bitacora_tasks enable row level security;

create policy "bitacora_tasks tenant select"
  on public.bitacora_tasks for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()));

create policy "bitacora_tasks tenant insert"
  on public.bitacora_tasks for insert to authenticated
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and created_by = (select auth.uid())
  );

create policy "bitacora_tasks tenant update"
  on public.bitacora_tasks for update to authenticated
  using (tenant_id = (select public.get_user_tenant_id()))
  with check (tenant_id = (select public.get_user_tenant_id()));

create policy "bitacora_tasks no delete"
  on public.bitacora_tasks for delete to authenticated using (false);

create policy "bitacora_tasks service_role all"
  on public.bitacora_tasks for all to service_role using (true) with check (true);

-- completed_at por trigger (port del comportamiento de Rumbo): entra a
-- 'hecho' → sella now(); sale de 'hecho' → se limpia. Nadie lo setea a mano.
create or replace function public.bitacora_tasks_completed_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.estado = 'hecho' then
    if tg_op = 'INSERT' or old.estado is distinct from 'hecho' then
      new.completed_at := now();
    end if;
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

revoke execute on function public.bitacora_tasks_completed_at() from public, anon;

create trigger bitacora_tasks_completed_at_trg
  before insert or update on public.bitacora_tasks
  for each row execute function public.bitacora_tasks_completed_at();

-- Freeze de identidad (molde 0090).
create or replace function public.bitacora_tasks_freeze_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.id         := old.id;
  new.tenant_id  := old.tenant_id;
  new.meeting_id := old.meeting_id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  return new;
end;
$$;

revoke execute on function public.bitacora_tasks_freeze_immutable() from public, anon;

create trigger bitacora_tasks_freeze_trg
  before update on public.bitacora_tasks
  for each row execute function public.bitacora_tasks_freeze_immutable();

create trigger bitacora_tasks_touch
  before update on public.bitacora_tasks
  for each row execute function public.touch_updated_at();

-- Coherencia client_id same-tenant (defensa-en-DB, molde 0181): un cliente
-- PostgREST directo no puede colgar la tarea/acta de un client ajeno o borrado.
create or replace function public.bitacora_client_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.client_id is not null then
    if not exists (
      select 1 from public.clients c
      where c.id = new.client_id
        and c.tenant_id = new.tenant_id
        and c.deleted_at is null
    ) then
      raise exception 'client_id % no pertenece al tenant %', new.client_id, new.tenant_id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

comment on function public.bitacora_client_check is
  'SDD-0146: valida que client_id (si está) sea un cliente vivo del MISMO tenant. Defensa-en-DB: no se confía solo en la action. Aplica a bitacora_meetings y bitacora_tasks.';

revoke execute on function public.bitacora_client_check() from public, anon;

create trigger bitacora_meetings_client_check_trg
  before insert or update on public.bitacora_meetings
  for each row execute function public.bitacora_client_check();

create trigger bitacora_tasks_client_check_trg
  before insert or update on public.bitacora_tasks
  for each row execute function public.bitacora_client_check();

-- Realtime del tablero/vista Hoy (patrón 0043).
alter publication supabase_realtime add table public.bitacora_tasks;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. BITACORA_TASK_ASSIGNEES · dueño DRI                     ║
-- ╚═══════════════════════════════════════════════════════════╝
create table public.bitacora_task_assignees (
  task_id     uuid not null references public.bitacora_tasks(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,  -- denormalizado para RLS sin join
  assigned_by uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (task_id, user_id)
);

comment on table public.bitacora_task_assignees is
  'SDD-0146: asignación de tarea a un auth.user del tenant (V1 = UN dueño DRI; la PK compuesta deja crecer a co-asignados en V2). Trigger user_in_tenant cierra la fuga cross-tenant por el canal de notificaciones (hallazgo adversarial).';

create index bitacora_task_assignees_user_idx
  on public.bitacora_task_assignees (user_id, tenant_id);

create index bitacora_task_assignees_assigned_by_idx
  on public.bitacora_task_assignees (assigned_by)
  where assigned_by is not null;

-- GRANT base JUNTO a la RLS. DELETE sí: reasignar = borrar fila + insertar.
grant select, insert, delete on public.bitacora_task_assignees to authenticated;
grant all on public.bitacora_task_assignees to service_role;

alter table public.bitacora_task_assignees enable row level security;

create policy "bitacora_task_assignees tenant select"
  on public.bitacora_task_assignees for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()));

create policy "bitacora_task_assignees tenant insert"
  on public.bitacora_task_assignees for insert to authenticated
  with check (tenant_id = (select public.get_user_tenant_id()));

create policy "bitacora_task_assignees tenant delete"
  on public.bitacora_task_assignees for delete to authenticated
  using (tenant_id = (select public.get_user_tenant_id()));

create policy "bitacora_task_assignees service_role all"
  on public.bitacora_task_assignees for all to service_role using (true) with check (true);

-- Coherencia same-tenant (molde 0181, fail-closed):
--   (1) el user asignado tiene membership ACTIVO en el tenant (cierra el
--       assignee cross-tenant — criterio de aceptación Fase 1);
--   (2) la tarea pertenece al MISMO tenant (no se cuelga una asignación a la
--       tarea de otro tenant forjando el task_id).
create or replace function public.bitacora_assignee_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.user_in_tenant(new.user_id, new.tenant_id) then
    raise exception 'user_id % no pertenece al tenant % (o está desactivado)', new.user_id, new.tenant_id
      using errcode = 'check_violation';
  end if;
  if not exists (
    select 1 from public.bitacora_tasks t
    where t.id = new.task_id and t.tenant_id = new.tenant_id
  ) then
    raise exception 'task_id % no pertenece al tenant %', new.task_id, new.tenant_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

comment on function public.bitacora_assignee_check is
  'SDD-0146: rechaza asignar una tarea a un user sin membership activo del tenant, o colgar la asignación de una tarea ajena. Defensa-en-DB fail-closed (molde employee_in_tenant 0181).';

revoke execute on function public.bitacora_assignee_check() from public, anon;

create trigger bitacora_assignee_check_trg
  before insert or update on public.bitacora_task_assignees
  for each row execute function public.bitacora_assignee_check();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4. BITACORA_TASK_CHECKLIST · plano, 1 nivel                ║
-- ╚═══════════════════════════════════════════════════════════╝
create table public.bitacora_task_checklist (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  task_id    uuid not null references public.bitacora_tasks(id) on delete cascade,
  texto      text not null check (length(trim(texto)) > 0 and length(texto) <= 500),
  done       boolean not null default false,
  done_by    uuid references auth.users(id) on delete set null,
  done_at    timestamptz,
  orden      int not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.bitacora_task_checklist is
  'SDD-0146: checklist PLANO de 1 nivel por tarea (si una tarea crece se promueve a plantilla/proyecto, no a más niveles). done_by/done_at = quién tachó (colaborativo).';

create index bitacora_task_checklist_task_idx
  on public.bitacora_task_checklist (task_id, orden);

create index bitacora_task_checklist_done_by_idx
  on public.bitacora_task_checklist (done_by)
  where done_by is not null;

-- GRANT base JUNTO a la RLS. Checklist sí se edita/borra (no es evidencia).
grant select, insert, update, delete on public.bitacora_task_checklist to authenticated;
grant all on public.bitacora_task_checklist to service_role;

alter table public.bitacora_task_checklist enable row level security;

create policy "bitacora_task_checklist tenant all"
  on public.bitacora_task_checklist for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()))
  with check (tenant_id = (select public.get_user_tenant_id()));

create policy "bitacora_task_checklist service_role all"
  on public.bitacora_task_checklist for all to service_role using (true) with check (true);

-- Coherencia: el item pertenece a una tarea del MISMO tenant.
create or replace function public.bitacora_checklist_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.bitacora_tasks t
    where t.id = new.task_id and t.tenant_id = new.tenant_id
  ) then
    raise exception 'task_id % no pertenece al tenant %', new.task_id, new.tenant_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.bitacora_checklist_check() from public, anon;

create trigger bitacora_checklist_check_trg
  before insert or update on public.bitacora_task_checklist
  for each row execute function public.bitacora_checklist_check();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 5. RPC · bitacora_confirm_meeting (transaccional)          ║
-- ╚═══════════════════════════════════════════════════════════╝
-- SECURITY INVOKER a propósito: la RLS es la segunda capa (solo el creador o
-- admin VEN el borrador → solo ellos confirman); el edit-gate por rol vive en
-- la action con moduleEditDenial — la matriz RBAC NO se duplica en SQL.
-- Transaccional: todo o nada (arregla la no-atomicidad conocida de Loop3D).
create or replace function public.bitacora_confirm_meeting(
  p_meeting_id    uuid,
  p_meeting_patch jsonb default '{}'::jsonb,
  p_tasks         jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_meeting        public.bitacora_meetings%rowtype;
  v_task           jsonb;
  v_item           jsonb;
  v_assignee       jsonb;
  v_task_id        uuid;
  v_user_id        uuid;
  v_titulo         text;
  v_prioridad      text;
  v_tipo           text;
  v_role           text;
  v_due            date;
  v_orden          int := 0;
  v_chk_orden      int;
  v_inserted       int := 0;
begin
  -- Lock + guard de estado. FOR UPDATE con RLS del invoker: si el caller no
  -- puede ver el borrador (no es creador ni admin), simplemente "no existe".
  select * into v_meeting
  from public.bitacora_meetings
  where id = p_meeting_id
  for update;

  if not found then
    raise exception 'reunión no encontrada' using errcode = 'P0002';
  end if;

  if v_meeting.estado <> 'borrador' then
    raise exception 'ya confirmada' using errcode = 'P0001';
  end if;

  if p_tasks is null or jsonb_typeof(p_tasks) <> 'array' then
    raise exception 'p_tasks debe ser un array' using errcode = '22023';
  end if;

  if jsonb_array_length(p_tasks) > 50 then
    raise exception 'máximo 50 tareas por confirmación' using errcode = '22023';
  end if;

  -- Insertar tareas (validación de shape campo a campo; fuera de enum → default).
  for v_task in select * from jsonb_array_elements(p_tasks) loop
    v_titulo := nullif(trim(coalesce(v_task->>'titulo', '')), '');
    if v_titulo is null then
      raise exception 'tarea sin título' using errcode = '22023';
    end if;

    v_prioridad := case
      when v_task->>'prioridad' in ('baja', 'media', 'alta') then v_task->>'prioridad'
      else 'media'
    end;

    v_tipo := case
      when v_task->>'tipo' in ('empleado', 'entregable_cliente') then v_task->>'tipo'
      else 'empleado'
    end;

    v_role := case
      when v_task->>'assigned_role' in ('admin','commercial','operations','accounting','warehouse','support','marketing')
        then v_task->>'assigned_role'
      else null
    end;

    -- Fechas SOLO ISO estricto (^\d{4}-\d{2}-\d{2}$) — el post-proceso ya lo
    -- garantiza, la DB lo re-verifica.
    v_due := case
      when coalesce(v_task->>'due_date', '') ~ '^\d{4}-\d{2}-\d{2}$'
        then (v_task->>'due_date')::date
      else null
    end;

    insert into public.bitacora_tasks
      (tenant_id, meeting_id, titulo, descripcion, prioridad, tipo,
       assigned_role, para_agente, client_id, responsable_nombre, due_date,
       orden, created_by)
    values
      (v_meeting.tenant_id, v_meeting.id, left(v_titulo, 300),
       nullif(trim(coalesce(v_task->>'descripcion', '')), ''),
       v_prioridad, v_tipo, v_role,
       coalesce((v_task->>'para_agente')::boolean, false),
       case
         when coalesce(v_task->>'client_id', '') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
           then (v_task->>'client_id')::uuid
         else null
       end,
       nullif(trim(coalesce(v_task->>'responsable_nombre', '')), ''),
       v_due, v_orden, (select auth.uid()))
    returning id into v_task_id;

    v_orden := v_orden + 1;
    v_inserted := v_inserted + 1;

    -- Asignados: DESCARTA (no error) a quien no tenga user_tenants activo del
    -- tenant — la tarea queda sin asignar con responsable_nombre visible.
    if jsonb_typeof(v_task->'assignees') = 'array' then
      for v_assignee in select * from jsonb_array_elements(v_task->'assignees') loop
        if (v_assignee #>> '{}') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
          v_user_id := (v_assignee #>> '{}')::uuid;
          if public.user_in_tenant(v_user_id, v_meeting.tenant_id) then
            insert into public.bitacora_task_assignees (task_id, user_id, tenant_id, assigned_by)
            values (v_task_id, v_user_id, v_meeting.tenant_id, (select auth.uid()))
            on conflict do nothing;
          end if;
        end if;
      end loop;
    end if;

    -- Checklist plano: acepta strings o {texto}.
    if jsonb_typeof(v_task->'checklist') = 'array' then
      v_chk_orden := 0;
      for v_item in select * from jsonb_array_elements(v_task->'checklist') loop
        declare
          v_texto text;
        begin
          v_texto := case
            when jsonb_typeof(v_item) = 'string' then v_item #>> '{}'
            else v_item->>'texto'
          end;
          v_texto := nullif(trim(coalesce(v_texto, '')), '');
          if v_texto is not null then
            insert into public.bitacora_task_checklist (tenant_id, task_id, texto, orden)
            values (v_meeting.tenant_id, v_task_id, left(v_texto, 500), v_chk_orden);
            v_chk_orden := v_chk_orden + 1;
          end if;
        end;
      end loop;
    end if;
  end loop;

  -- Patch del acta (solo claves presentes) + marcar confirmada.
  update public.bitacora_meetings set
    titulo         = coalesce(nullif(trim(coalesce(p_meeting_patch->>'titulo', '')), ''), titulo),
    fecha          = case
                       when coalesce(p_meeting_patch->>'fecha', '') ~ '^\d{4}-\d{2}-\d{2}$'
                         then (p_meeting_patch->>'fecha')::date
                       else fecha
                     end,
    resumen        = case when p_meeting_patch ? 'resumen' then p_meeting_patch->>'resumen' else resumen end,
    acta           = case when p_meeting_patch ? 'acta' then p_meeting_patch->'acta' else acta end,
    contacto_libre = case when p_meeting_patch ? 'contacto_libre' then p_meeting_patch->>'contacto_libre' else contacto_libre end,
    visibilidad    = case
                       when p_meeting_patch->>'visibilidad' in ('equipo', 'gestores')
                         then p_meeting_patch->>'visibilidad'
                       else visibilidad
                     end,
    estado         = 'confirmada',
    confirmed_by   = (select auth.uid()),
    confirmed_at   = now()
  where id = v_meeting.id;

  return jsonb_build_object('meeting_id', v_meeting.id, 'tasks_inserted', v_inserted);
end;
$$;

comment on function public.bitacora_confirm_meeting is
  'SDD-0146: confirma un borrador de acta e inserta sus tareas+assignees+checklist EN UNA transacción (todo o nada). SECURITY INVOKER: la RLS del caller aplica (solo creador/admin ven el borrador). Guard doble-confirm ("ya confirmada"). Tope 50 tareas. Descarta assignees sin membership activo.';

revoke all on function public.bitacora_confirm_meeting(uuid, jsonb, jsonb) from public;
revoke execute on function public.bitacora_confirm_meeting(uuid, jsonb, jsonb) from anon;
grant execute on function public.bitacora_confirm_meeting(uuid, jsonb, jsonb) to authenticated;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 6. RPC · bitacora_assignable_profiles (pool de asignables) ║
-- ╚═══════════════════════════════════════════════════════════╝
-- SECURITY DEFINER porque la RLS de user_tenants solo muestra la fila propia;
-- el filtro explícito por get_user_tenant_id() del caller evita fuga
-- cross-tenant (fail-closed: sin tenant → 0 filas).
create or replace function public.bitacora_assignable_profiles()
returns table (user_id uuid, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select
    ut.user_id,
    coalesce(
      nullif(trim(coalesce(up.first_name, '') || ' ' || coalesce(up.last_name, '')), ''),
      'Usuario'
    ) as display_name
  from public.user_tenants ut
  left join public.user_profiles up on up.user_id = ut.user_id
  where ut.tenant_id = (select public.get_user_tenant_id())
    and ut.disabled_at is null
  order by display_name;
$$;

comment on function public.bitacora_assignable_profiles is
  'SDD-0146: pool de asignables V1 = staff con cuenta Studio (user_tenants ACTIVOS del tenant del caller) + display name de user_profiles. SECURITY DEFINER con filtro explícito por tenant del caller (fail-closed).';

revoke all on function public.bitacora_assignable_profiles() from public;
revoke execute on function public.bitacora_assignable_profiles() from anon;
grant execute on function public.bitacora_assignable_profiles() to authenticated;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 7. Bucket privado `bitacora` + Storage RLS por tenant      ║
-- ╚═══════════════════════════════════════════════════════════╝
-- [DELTA] bucket propio (el hub documents es 10MB sin audio/video). 50MB.
-- Paths: audio → {tenant}/bitacora_meeting/{meetingId}/{uuid}.{ext} (sin fila
-- en documents) · adjuntos → {tenant}/bitacora_task/{taskId}/{uuid}.{ext}
-- (con fila en documents, entity_type='bitacora_task' — enum en 0215).
-- Molde 0097: 4 policies por foldername[1] = tenant.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bitacora',
  'bitacora',
  false,
  50 * 1024 * 1024,
  array[
    'audio/webm',
    'audio/mp4',
    'video/mp4',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "bitacora service_role all storage"
  on storage.objects for all
  to service_role
  using (bucket_id = 'bitacora')
  with check (bucket_id = 'bitacora');

create policy "bitacora tenant insert storage"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'bitacora'
    and (storage.foldername(name))[1] = (public.get_user_tenant_id())::text
  );

create policy "bitacora tenant read storage"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'bitacora'
    and (storage.foldername(name))[1] = (public.get_user_tenant_id())::text
  );

create policy "bitacora tenant delete storage"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'bitacora'
    and (storage.foldername(name))[1] = (public.get_user_tenant_id())::text
  );

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0214_bitacora.sql · aplicar JUNTO a 0215 (enums)
-- ─────────────────────────────────────────────────────────────

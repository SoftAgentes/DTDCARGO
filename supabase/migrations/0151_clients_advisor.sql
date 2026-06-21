-- ─────────────────────────────────────────────────────────────
-- ERP→Norte · Quick win: Asesor asignado del cliente (clients.advisor_id)
--
-- El Norte del portal muestra el "agente" ASIGNADO del cliente (nombre, cargo,
-- contacto directo). Hoy el portal degrada al contacto PÚBLICO (CRM WhatsApp)
-- porque `clients.advisor_id` no existe. Esta migración crea esa columna para que
-- el asesor real reemplace la degradación (card "Tu asesor" de /portal/mensajes +
-- ruteo de Mensajes al asesor correcto).
--
-- Es ADITIVA y NULLABLE:
--   · una columna nueva en public.clients (FK a auth.users, como doc_verified_by),
--   · SIN tocar la RLS de `clients` — la columna hereda la RLS multi-tenant ya
--     vigente (`clients by tenant`); nada que policy-ar de nuevo,
--   · un índice parcial (tenant_id, advisor_id) para "clientes de este asesor",
--   · un trigger de defensa-en-profundidad que valida que el asesor sea miembro
--     ACTIVO del mismo tenant del cliente (evita asignar un user de otro tenant
--     vía PostgREST directo — la action sola es forjable).
--
-- Mapea: lib/studio/client-types.ts (Client.advisor_id), assignAdvisorAction,
-- lib/portal/portal-queries.ts (getPortalAdvisor).
--
-- Sin DDL destructivo. NO aplicar a prod (lo hace el founder / coordinación).
-- ─────────────────────────────────────────────────────────────

-- 1. Asesor asignado: usuario (auth.users) responsable de la relación con el
--    cliente. `on delete set null` — borrar el usuario NO borra al cliente, solo
--    desasigna (vuelve a la degradación de contacto público).
alter table public.clients
  add column if not exists advisor_id uuid references auth.users(id) on delete set null;

comment on column public.clients.advisor_id is
  'ERP→Norte: usuario (auth.users) asesor/account-director asignado a este cliente. Debe ser miembro activo del mismo tenant (trigger clients_advisor_same_tenant). El portal lo muestra como "Tu asesor"; null = degrada al contacto público (CRM).';

-- 2. Índice parcial para el lookup inverso "clientes asignados a este asesor"
--    (futura bandeja del asesor / worklist). Solo clientes vivos.
create index if not exists clients_tenant_advisor_idx
  on public.clients (tenant_id, advisor_id)
  where deleted_at is null and advisor_id is not null;

-- 3. Guard de defensa-en-profundidad: el asesor debe ser miembro ACTIVO del mismo
--    tenant del cliente. La server action valida lo mismo (mejor mensaje), pero un
--    UPDATE crudo vía PostgREST (RLS deja al tenant editar sus clientes) podría
--    setear un advisor_id de OTRO tenant → fuga del nombre de un user ajeno al
--    portal. Esto lo cierra en la DB.
--
--    SECURITY DEFINER a propósito: la RLS de user_tenants restringe a los no-admin
--    a ver solo su propia fila; sin definer, un asesor comercial asignando a otro
--    no "vería" la membresía del target y el chequeo daría falso-negativo. El
--    definer lee user_tenants completo solo para validar (no escribe nada).
create or replace function public.clients_check_advisor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.advisor_id is not null then
    if not exists (
      select 1
      from public.user_tenants ut
      where ut.user_id = new.advisor_id
        and ut.tenant_id = new.tenant_id
        and ut.disabled_at is null
    ) then
      raise exception
        'advisor_id % no es miembro activo del tenant % del cliente', new.advisor_id, new.tenant_id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

comment on function public.clients_check_advisor is
  'Trigger guard: clients.advisor_id debe ser un user_tenants activo del mismo tenant. SECURITY DEFINER para validar la membresía sin depender de la RLS del invocador.';

-- Las funciones nuevas en public reciben EXECUTE a PUBLIC por default. Esta es una
-- trigger function — no se llama directo desde el Data API — así que revocamos el
-- execute público/anon (higiene; deuda RPC anon-execute del proyecto).
revoke execute on function public.clients_check_advisor() from public, anon;

drop trigger if exists clients_advisor_same_tenant on public.clients;
create trigger clients_advisor_same_tenant
  before insert or update of advisor_id on public.clients
  for each row execute function public.clients_check_advisor();

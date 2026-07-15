-- ─────────────────────────────────────────────────────────────
-- SDD-0096 · PORT-4: activar / desactivar el link público del proveedor.
--
-- El link /p/{share_token} (migr 0119) se autogenera al crear la compra y hoy
-- queda ACTIVO PARA SIEMPRE, sin forma de revocarlo. Esta migración agrega una
-- bandera de estado para que el equipo lo pueda DESACTIVAR (revocar) y volver a
-- ACTIVAR desde el Studio.
--
-- Modelo: `share_disabled_at timestamptz` en prealertas. null = activo; una fecha
-- = desactivado desde ese momento (más auditable que un boolean). El route público
-- /p/[token] filtra `share_disabled_at is null` → un link desactivado cae en
-- notFound (404), igual que un token inválido.
--
-- Seguridad del toggle: el EQUIPO del tenant solo tiene SELECT sobre prealertas
-- (migr 0105 — el UPDATE es del cliente del portal y service_role). Por eso el
-- cambio NO va por RLS de UPDATE (abriría toda la fila al equipo) sino por una RPC
-- ESTRECHA `set_prealerta_share_active` (SECURITY DEFINER) que solo toca esta
-- columna, scopeada al tenant del caller (get_user_tenant_id). Hardening: revoke
-- de public/anon (lección project_rpc_anon_execute_debt).
--
-- ⚠️ ORDEN DE DESPLIEGUE: aplicar ESTA migración ANTES (o junto) al deploy del
--    código. El route público empieza a filtrar por `share_disabled_at`; si la
--    columna no existe, la query falla → el link cae a notFound. Aplicar 0225,
--    luego mergear/deployar. NO se aplica a prod desde acá (lo hace el founder).
--    Aditiva: ADD COLUMN (default null seguro) + CREATE FUNCTION. Correlativo 0225
--    (0224 = conversation_digest, último en origin/main).
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. Columna de estado del link                             ║
-- ╚═══════════════════════════════════════════════════════════╝
alter table public.prealertas
  add column if not exists share_disabled_at timestamptz;

comment on column public.prealertas.share_disabled_at is
  'PORT-4: si NO es null, el link público del proveedor (/p/{share_token}) está DESACTIVADO desde esa fecha → el route lo rechaza (notFound). null = activo. Lo alterna el equipo vía set_prealerta_share_active().';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. RPC estrecha · activar/desactivar (equipo del tenant)  ║
-- ╚═══════════════════════════════════════════════════════════╝
-- SECURITY DEFINER porque el equipo no tiene UPDATE directo sobre prealertas.
-- El check de tenant va ADENTRO (get_user_tenant_id lee el JWT del caller, válido
-- aun en definer). Solo toca share_disabled_at — no puede editar otras columnas.
-- Devuelve el nuevo estado (true = activo).
create or replace function public.set_prealerta_share_active(
  p_prealerta_id uuid,
  p_active       boolean
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant   uuid := public.get_user_tenant_id();
  v_disabled timestamptz;
begin
  if v_tenant is null then
    raise exception 'sin tenant' using errcode = '42501';
  end if;

  update public.prealertas
     set share_disabled_at = case when p_active then null else now() end
   where id = p_prealerta_id
     and tenant_id = v_tenant
     and deleted_at is null
  returning share_disabled_at into v_disabled;

  if not found then
    raise exception 'prealerta inexistente o de otro tenant: %', p_prealerta_id
      using errcode = 'check_violation';
  end if;

  return v_disabled is null;
end;
$$;

comment on function public.set_prealerta_share_active is
  'SDD-0096/PORT-4: activa (p_active=true → share_disabled_at=null) o desactiva (now()) el link público del proveedor de UNA prealerta. Scoped al tenant del caller (get_user_tenant_id). SECURITY DEFINER: el equipo no tiene UPDATE directo sobre prealertas, esta RPC solo toca la bandera del link.';

-- Hardening: revoke de public/anon; execute para el equipo (authenticated) + workers.
revoke execute on function public.set_prealerta_share_active(uuid, boolean) from public, anon;
grant  execute on function public.set_prealerta_share_active(uuid, boolean) to authenticated;
grant  execute on function public.set_prealerta_share_active(uuid, boolean) to service_role;

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0225_prealerta_share_active.sql
-- Aplicar con: supabase migration apply 0225 · o MCP apply_migration (con OK del founder)
-- ─────────────────────────────────────────────────────────────

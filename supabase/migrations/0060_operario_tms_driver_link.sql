-- ─────────────────────────────────────────────────────────────
-- 0060 · operario_pins.tms_driver_id · Sprint 0 fix seguridad camionero
--
-- BUG previo: `listOdsForCamionero()` en lib/studio/dispatch-mobile-queries.ts:73
-- filtraba por `ilike(name, operario.display_name)` — equality case-insensitive
-- sobre tms_drivers.name. Problemas:
--   - Si tms_drivers.name = "Luis Hernández González" y operario.display_name
--     = "Luis Hernández" → no matchea (no es contains).
--   - Si hay dos drivers homónimos → operario ve ODs cruzadas (security leak).
--   - Documentado como "deuda D6 del spec" en línea 65 de la query.
--
-- Fix: agregar FK explícito tms_driver_id a operario_pins, linkear los
-- camioneros existentes con sus drivers TMS via backfill, cambiar el
-- query a `.eq("driver_id", operario.tms_driver_id)`.
--
-- Constraint: tms_driver_id solo aplica a camionero/supervisor (otros
-- roles no tienen sentido linkear).
-- ─────────────────────────────────────────────────────────────

-- ALTER columna
alter table public.operario_pins
  add column if not exists tms_driver_id uuid
    references public.tms_drivers(id) on delete set null;

comment on column public.operario_pins.tms_driver_id is
  'Link explícito al driver TMS cuando el operario es camionero/supervisor. NULL para roles operario/bodeguero. Fix anti-pattern de matching por display_name (SDD-Sprint 0).';

create index if not exists operario_pins_tms_driver_idx
  on public.operario_pins (tms_driver_id)
  where tms_driver_id is not null;

-- Constraint: si role es camionero/supervisor en region 've', puede tener
-- tms_driver_id. Otros roles deben tenerlo NULL.
-- NO requerido NOT NULL para camioneros — permite onboarding sin TMS link
-- (admin lo setea después).
alter table public.operario_pins
  add constraint operario_pins_tms_driver_role_check
  check (
    tms_driver_id is null
    or (role in ('camionero', 'supervisor') and region = 've')
  );

-- ─────────────────────────────────────────────────────────────
-- Update RPC verify_operario_pin para retornar tms_driver_id
-- ─────────────────────────────────────────────────────────────

drop function if exists public.verify_operario_pin(text);

create or replace function public.verify_operario_pin(
  p_pin text
)
returns table (
  operario_id      uuid,
  tenant_id        uuid,
  warehouse_id     uuid,
  display_name     text,
  display_name_cn  text,
  role             text,
  region           operario_region,
  tms_driver_id    uuid                          -- NUEVO Sprint 0
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_matches int;
begin
  -- Sanity: PIN no vacío + 4 dígitos numéricos
  if p_pin is null or length(p_pin) <> 4 or p_pin !~ '^\d{4}$' then
    return;
  end if;

  -- Contar matches (improbable colisión pero auditable)
  select count(*) into v_matches
  from public.operario_pins
  where active = true
    and pin_hash = extensions.crypt(p_pin, pin_hash);

  if v_matches <> 1 then
    return;
  end if;

  return query
  update public.operario_pins op
     set last_login_at = now()
   where op.active = true
     and op.pin_hash = extensions.crypt(p_pin, op.pin_hash)
  returning op.id, op.tenant_id, op.warehouse_id,
            op.display_name, op.display_name_cn, op.role, op.region,
            op.tms_driver_id;
end;
$$;

comment on function public.verify_operario_pin(text) is
  'Valida PIN del operario (4 dígitos plain). Retorna identidad incluyendo region + tms_driver_id (Sprint 0 fix). Solo service_role.';

revoke all on function public.verify_operario_pin(text) from public, anon, authenticated;
grant execute on function public.verify_operario_pin(text) to service_role;

-- ─────────────────────────────────────────────────────────────
-- Backfill manual: linkear Luis Hernández (camionero VE) con su driver TMS
-- Verificado via query previa antes de aplicar.
-- ─────────────────────────────────────────────────────────────

update public.operario_pins op
   set tms_driver_id = td.id
  from public.tms_drivers td
 where op.region = 've'
   and op.role in ('camionero', 'supervisor')
   and op.tms_driver_id is null
   and td.deleted_at is null
   and lower(td.name) = lower(op.display_name);

-- NOTE: matching exact por nombre es solo para el backfill inicial. Después
-- de esta migración, nuevos camioneros se linkean explícitamente desde el
-- Studio web (admin elige driver TMS del dropdown al crear el operario_pin).

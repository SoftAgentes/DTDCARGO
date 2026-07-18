-- 0249 · SDD-0157 Slice A — el operario CN solicita abrir contenedor; oficina autoriza
--
-- El operario del hub no puede abrir un contenedor (solo la oficina, en Studio). Esto
-- agrega el lado "solicitud": el operario pide, queda 'solicitada' SIN correlativo, y la
-- oficina la autoriza desde el Studio (server action authenticated → asigna el ref
-- DTD-CONSOL-NNNN vía next_consolidation_ref y pasa a 'consolidando').
--
-- ref → nullable: el correlativo se asigna AL AUTORIZAR, no al solicitar (no se quema un
-- DTD-CONSOL-NNNN en solicitudes que se rechazan). El unique (tenant_id, ref) tolera
-- múltiples null (nulls distinct por default en Postgres).
--
-- Estados nuevos ('solicitada', 'rechazada') se validan en TS (ContainerStatus); la tabla
-- no tiene CHECK sobre status, así que no hace falta tocar constraints.

alter table public.consolidations alter column ref drop not null;

alter table public.consolidations
  add column if not exists requested_by_operario_id uuid references public.operario_pins(id),
  add column if not exists requested_at   timestamptz,
  add column if not exists authorized_by  uuid references auth.users(id),
  add column if not exists authorized_at  timestamptz,
  add column if not exists rejected_reason text;

comment on column public.consolidations.requested_by_operario_id is
  'SDD-0157: operario CN que solicitó abrir el contenedor (status solicitada).';
comment on column public.consolidations.authorized_by is
  'SDD-0157: usuario de oficina que autorizó (status solicitada → consolidando).';

-- ── RPC: el operario CN solicita abrir un contenedor ───────────────────────────
-- Crea la fila 'solicitada' SIN ref. Tenant resuelto desde operario_pins (el operario
-- no tiene auth.uid()). SECURITY DEFINER; solo service_role (lo llama el server del móvil
-- con admin client, patrón de los demás RPC de operario).
create or replace function public.request_consolidation_as_operario(
  p_operario_id   uuid,
  p_container_type text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_id     uuid;
begin
  if p_container_type is null or p_container_type not in ('20GP', '40GP', '40HC') then
    raise exception 'Tipo de contenedor inválido (20GP/40GP/40HC).';
  end if;

  select tenant_id into v_tenant
  from public.operario_pins
  where id = p_operario_id and active is true and region = 'cn';

  if v_tenant is null then
    raise exception 'Operario no válido o sin permiso de consolidación en China.';
  end if;

  insert into public.consolidations
    (tenant_id, ref, container_type, status, requested_by_operario_id, requested_at)
  values
    (v_tenant, null, p_container_type, 'solicitada', p_operario_id, now())
  returning id into v_id;

  return v_id;
end
$$;

comment on function public.request_consolidation_as_operario is
  'SDD-0157: el operario CN solicita abrir un contenedor (status solicitada, sin ref). La oficina autoriza en Studio.';

revoke all on function public.request_consolidation_as_operario(uuid, text) from public, anon, authenticated;
grant execute on function public.request_consolidation_as_operario(uuid, text) to service_role;

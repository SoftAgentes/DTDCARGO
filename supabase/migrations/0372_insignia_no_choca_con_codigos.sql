-- 0372_insignia_no_choca_con_codigos.sql — SDD-0258
--
-- UNA INSIGNIA NUEVA NO PUEDE PISAR UN CÓDIGO QUE YA EXISTE.
--
-- Pedido del founder (2026-08-14): "si otro usuario ya tiene ese código, el
-- sistema no permite grabarlo". Había TRES choques posibles y sólo dos estaban
-- tapados:
--   1. insignia vs insignia          → `aliados_prefix_uq`            ✅
--   2. código de cliente vs cliente  → `clients_tenant_id_markbox_key` ✅
--                                       (+ los jubilados, reservados en la 0367)
--   3. insignia NUEVA vs código de cliente que YA existe → NADA        ❌
--
-- El caso 3 no revienta nunca: revienta el día que pasa. Si un cliente ya lleva
-- `RA-0007` y mañana se crea la aliada `RA`, la base lo aceptaba y ese cliente
-- quedaba PARECIENDO de ella sin serlo — con la insignia de otro en sus
-- etiquetas y en el mensaje a su proveedor. La 0371 dejó la regla escrita para
-- el lado de `clients`; ésta la cierra por el lado de `aliados`.
--
-- Y de paso: RENOMBRAR la insignia de un aliado QUE YA TIENE CLIENTES queda
-- prohibido. Sus códigos guardados llevan la cadena vieja (`DC-FA-1232`), así
-- que cambiar el prefijo los dejaría a todos apuntando a una cadena que ya no
-- existe — el mismo daño silencioso que la migr 0367 se construyó para evitar.
-- Si de verdad hay que cambiarla, primero se renombra a los clientes.

create or replace function public.aliados_guard_prefijo_libre()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_choca text;
  v_clientes int;
begin
  -- Renombrar la insignia con clientes colgando desincroniza sus códigos.
  if tg_op = 'UPDATE' and upper(new.prefix) is distinct from upper(old.prefix) then
    select count(*) into v_clientes
      from public.clients c
     where c.aliado_id = new.id and c.deleted_at is null;
    if v_clientes > 0 then
      raise exception 'No se puede cambiar la insignia de % a %: ya tiene % cliente(s) con códigos que la llevan dentro. Renómbralos primero.',
        upper(old.prefix), upper(new.prefix), v_clientes using errcode = '23514';
    end if;
  end if;

  -- ¿Algún cliente lleva ya esa insignia, pelada o como prefijo de su código?
  -- Se mira también el historial: un código jubilado sigue reservado, así que
  -- tomar su prefijo reabriría la ambigüedad que la 0367 cerró.
  select m into v_choca from (
    select c.markbox as m
      from public.clients c
     where c.tenant_id = new.tenant_id
       and c.deleted_at is null
       -- La ficha del propio aliado puede llevar su insignia pelada (migr 0371).
       and c.id is distinct from new.client_id
    union all
    select h.markbox
      from public.client_markbox_history h
     where h.tenant_id = new.tenant_id
       and h.client_id is distinct from new.client_id
  ) s
   where upper(btrim(s.m)) = upper(new.prefix)
      or upper(btrim(s.m)) ~ ('^' || upper(new.prefix) || '-')
   limit 1;

  if v_choca is not null then
    raise exception 'La insignia % ya está en uso: el Shipping Mark % la lleva. Elige otra.',
      upper(new.prefix), v_choca using errcode = '23505';
  end if;

  return new;
end;
$function$;

comment on function public.aliados_guard_prefijo_libre() is
  'Impide crear (o reasignar) una insignia de aliado que pise un Shipping Mark ya existente —vivo o jubilado— y prohíbe renombrar la insignia de un aliado que ya tiene clientes. SDD-0258.';

drop trigger if exists aliados_guard_prefijo_libre_t on public.aliados;
create trigger aliados_guard_prefijo_libre_t
  before insert or update of prefix, client_id on public.aliados
  for each row execute function public.aliados_guard_prefijo_libre();

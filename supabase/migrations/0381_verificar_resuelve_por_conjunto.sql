-- 0381_verificar_resuelve_por_conjunto.sql — SDD-0258
--
-- /verificar DEJA DE NEGAR CÓDIGOS QUE SÍ SON NUESTROS.
--
-- 🔴 EL PROBLEMA ES DE HOY, NO FUTURO. La página pública busca
-- `clients.markbox` por igualdad exacta, así que **niega los 523 códigos
-- jubilados** que existen ahora mismo en producción. Medido el 2026-08-14:
--
--   select count(*) from client_markbox_history h
--    where not exists (select 1 from clients c
--                       where c.markbox = h.markbox and c.deleted_at is null);
--   → 523
--
-- Cada uno de los 361 clientes migrados hoy tiene al menos un código viejo que
-- está en sus cajas, en los correos que ya recibió y en manos de su proveedor
-- en Yiwu. Y la web les responde, en titular, "No reconocemos este Shipping
-- Mark" — una NEGACIÓN activa, no un "no pudimos confirmarlo". Justo lo que la
-- migr 0367 se construyó para evitar: el código viejo sigue resolviendo del lado
-- del ERP, pero la cara pública decía lo contrario.
--
-- LAS TRES FORMAS QUE TIENE QUE RECONOCER:
--   1. El código ACTUAL          → `DTD-8042`
--   2. Cualquiera de sus JUBILADOS → `DTD-A001`, `DTD-9066`
--   3. La forma IMPRESA de un cliente de sub-aliado → `FA-1232`, cuando lo
--      guardado es `DC-FA-1232`. El QR lleva la forma guardada, así que escanear
--      funciona; lo que fallaba era TECLEAR lo que dice la caja.
--
-- ⚠️ POR QUÉ LA FORMA IMPRESA SE ACOTA. El sufijo se busca sólo si la entrada
-- tiene forma de código impreso (`^[A-Z]{2,4}-\d{3,6}$`). Sin ese guard, teclear
-- `1232` haría match con `%-1232` y la página confirmaría cualquier número — un
-- oráculo de existencia mucho más ancho del que ya tiene.
--
-- DEVUELVE SOLO UN BOOLEANO. Ni nombre, ni datos, ni a quién pertenece: la
-- página sólo necesita saber si el código es nuestro, y ese contrato de
-- privacidad ya lo tenía (`Solo lee markbox (existencia)`).

create or replace function public.markbox_existe_publico(p_markbox text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  with entrada as (
    select upper(btrim(coalesce(p_markbox, ''))) as m
  )
  select
    -- 1 y 3 · vivo: exacto, o su forma impresa
    exists (
      select 1
        from public.clients c, entrada e
       where e.m <> ''
         and c.deleted_at is null
         and (
           upper(btrim(c.markbox)) = e.m
           or (e.m ~ '^[A-Z]{2,4}-\d{3,6}$'
               and upper(btrim(c.markbox)) like '%-' || e.m)
         )
    )
    or
    -- 2 · jubilado: sigue siendo suyo, y la caja rotulada con él existe
    exists (
      select 1
        from public.client_markbox_history h, entrada e
       where e.m <> ''
         and (
           upper(btrim(h.markbox)) = e.m
           or (e.m ~ '^[A-Z]{2,4}-\d{3,6}$'
               and upper(btrim(h.markbox)) like '%-' || e.m)
         )
    );
$function$;

comment on function public.markbox_existe_publico(text) is
  'Dice si un Shipping Mark es nuestro, en cualquiera de sus tres formas: el actual, cualquiera de sus jubilados, o la forma IMPRESA de un cliente de sub-aliado. Devuelve sólo un booleano — nunca datos del cliente. La usa /verificar, que antes negaba los 523 códigos jubilados. SDD-0258.';

-- La usa una página PÚBLICA, así que anon necesita ejecutarla. Es seguro: no
-- devuelve datos, sólo existencia — el mismo alcance que ya tenía la consulta
-- directa que hacía la página con el admin client.
revoke all on function public.markbox_existe_publico(text) from public;
grant execute on function public.markbox_existe_publico(text) to anon, authenticated, service_role;

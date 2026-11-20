-- SDD-0675 · Desarme de la 0565: la Bandeja deja de poder concederse por persona.
-- ⚠️ NO ES UNA MIGRACIÓN TODAVÍA. Vive fuera de supabase/migrations/ y sin número, para que nada la
--    aplique ni la empaquete. Usarla exige OK nominal de Sam: se copia a supabase/migrations/ con el
--    siguiente número libre y se aplica con el runbook de producción.
-- Ensayo: lib/studio/__tests__/bandeja-concedible.migration.test.ts lo corre sobre el contrato
--   supabase/tests/0565_bandeja_concedible_por_persona.test.sql (sin begin/commit, dentro de su
--   transacción): con un acceso vigente aborta; sin accesos devuelve la lista de la 0538.
-- Va entre begin y commit para que los `set local` tengan efecto y para que la guarda y el
--   cambio de la función sean una sola unidad.
--
-- DEVUELVE la lista de la 0538 (sin 'bandeja').
-- ABORTA si queda algún acceso adicional de 'bandeja': la base los seguiría contando en
--   user_has_module aunque la RPC ya no deje concederlos. Antes hay que revocarlos en Usuarios
--   (cada revocación deja su evento y saca a la persona de Chatwoot).
begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $guarda$
begin
  if exists (select 1 from public.studio_user_module_grants where module_id = 'bandeja') then
    raise exception 'desarme 0565: quedan accesos adicionales de bandeja; revocarlos antes en Usuarios';
  end if;
end;
$guarda$;

create or replace function public.studio_module_is_grantable(p_module_id text)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select p_module_id = any (array[
    'kommo', 'clients', 'quotes', 'sales-orders', 'purchase-orders', 'conversaciones', 'rates', 'suppliers'
  ]::text[])
$$;

comment on function public.studio_module_is_grantable(text) is
  'SDD-0622: COVERED de lib/studio/user-module-grants.ts. Solo estos módulos se conceden como extra; la prueba de la 0538 compara la lista con el código.';

commit;

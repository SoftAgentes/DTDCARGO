-- SDD-0647 · Desarme de la 0553: quita la creación de tarjetas de clientes con carga.
-- ⚠️ NO ES UNA MIGRACIÓN TODAVÍA. Vive fuera de supabase/migrations/ y sin número, para que nada la
--    aplique ni la empaquete. Usarla exige OK nominal de Sam: se copia a supabase/migrations/ con el
--    siguiente número libre y se aplica con el runbook de producción.
--
-- QUITA crm_alta_tarjetas_clientes(uuid) y devuelve el CHECK de fuente de la 0506.
-- ABORTA si ya existen tarjetas con fuente 'carga_erp': devolver el CHECK las dejaría inválidas.
--   Antes hay que decidir con Sam qué pasa con ellas (borrarlas pierde sus etapas, notas y tareas).
-- NO TOCA ninguna otra tarjeta ni el resto del CRM.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $guarda$
begin
  if exists (select 1 from public.crm_tarjetas where fuente = 'carga_erp') then
    raise exception 'desarme 0553: hay tarjetas con fuente carga_erp; decidir con Sam antes de quitar la fuente';
  end if;
end;
$guarda$;

drop function if exists public.crm_alta_tarjetas_clientes(uuid);
alter table public.crm_tarjetas drop constraint crm_tarjetas_fuente_check;
alter table public.crm_tarjetas add constraint crm_tarjetas_fuente_check check (fuente in (
  'whatsapp_leads', 'whatsapp_clientes', 'instagram', 'messenger', 'correo',
  'web_registro', 'portal', 'cotizador', 'kommo', 'manual'));

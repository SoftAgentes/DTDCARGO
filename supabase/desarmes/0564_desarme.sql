-- SDD-0674 · Desarme de la 0564: quita la regla transitoria EXC-0674 (botón «Facturar» en Embarques).
-- ⚠️ NO ES UNA MIGRACIÓN TODAVÍA. Vive fuera de supabase/migrations/ y sin número, para que nada lo
--    aplique ni lo empaquete. Usarlo exige el OK nominal de Sam: se copia a supabase/migrations/ con el
--    siguiente número libre y se aplica con el runbook de producción.
-- Ensayo: supabase/tests/0564_exc0674_facturar_contenedor.test.sql (CONTRATO 18: se niega con facturas
-- de la regla y, sin ellas, no deja ningún objeto de la 0564).
-- Se NIEGA si ya hay facturas emitidas por esta regla: esas facturas son reales, se anulan por el
-- camino normal de Facturación y su rastro (exc0674_facturas) no se borra. Sin facturas, borra la
-- función y las dos tablas (la lista transitoria se pierde; hoy solo tiene el 64).
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $guarda$
begin
  if pg_catalog.to_regclass('public.exc0674_facturas') is not null
     and exists (select 1 from public.exc0674_facturas) then
    raise exception '0564 desarme: hay facturas emitidas por la EXC-0674; no se desarma (avisar al DG)';
  end if;
end
$guarda$;

drop function if exists public.exc0674_facturar(uuid, jsonb, text);
drop trigger if exists exc0674_marcar_anulada on public.invoices;
drop function if exists public.exc0674_marcar_anulada();
drop view if exists public.exc0674_envios_cubiertos;
drop table if exists public.exc0674_factura_envios;
drop table if exists public.exc0674_facturas;
-- La baja de la lista se audita y exige motivo: el desarme lo pone.
select pg_catalog.set_config('dtd.audit_reason', 'Desarme 0564 (SDD-0674) con OK nominal de Sam', true);
drop table if exists public.exc0674_contenedores;
drop function if exists public.exc0674_contenedores_auditar();

notify pgrst, 'reload schema';

-- SDD-0690 · Desarme de la 0569: quita la emisión de pre-órdenes desde Embarques (EXC-0674 ampliada).
-- ⚠️ NO ES UNA MIGRACIÓN TODAVÍA. Vive fuera de supabase/migrations/ y sin número, para que nada lo
--    aplique ni lo empaquete. Usarlo exige el OK nominal de Sam: se copia a supabase/migrations/ con el
--    siguiente número libre y se aplica con el runbook de producción.
-- Ensayo: supabase/tests/0569_exc0674_emitir_borradores.test.sql (CONTRATO 12: se niega con facturas
-- de origen_monto borrador y, sin ellas, no deja ningún objeto de la 0569 y no toca los de la 0564).
-- Se NIEGA si ya hay facturas emitidas por esta RPC (exc0674_facturas.origen_monto = 'borrador'): esas
-- facturas son reales, se anulan por el camino normal de Facturación y su rastro no se borra. Sin
-- ellas, borra la función y la columna origen_monto (todas las filas que quedan son 'tecleado', el valor
-- implícito de la 0564). No toca la 0564: para quitar también la regla está 0564_desarme.sql.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $guarda$
declare
  v_hay boolean := false;
begin
  -- Dinámico: si la columna ya no está (desarme repetido), la consulta no se puede ni planear.
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'exc0674_facturas' and column_name = 'origen_monto') then
    execute 'select exists (select 1 from public.exc0674_facturas where origen_monto <> ''tecleado'')' into v_hay;
  end if;
  if v_hay then
    raise exception '0569 desarme: hay facturas emitidas desde una pre-orden (origen_monto borrador); no se desarma (avisar al DG)';
  end if;
end
$guarda$;

drop function if exists public.exc0674_emitir_borradores(uuid, uuid[], text);

do $columna$
begin
  if pg_catalog.to_regclass('public.exc0674_facturas') is not null then
    alter table public.exc0674_facturas drop column if exists origen_monto;
    comment on table public.exc0674_facturas is
      'SDD-0674 · EXC-0674: una fila por cliente del contenedor facturado desde Embarques. Rastro del monto tecleado (total con IVA, USD), de quién lo tecleó y de la excepción al gate AUT-04 (legal_ack = exc_0674). Solo la escribe exc0674_facturar().';
  end if;
end
$columna$;

notify pgrst, 'reload schema';

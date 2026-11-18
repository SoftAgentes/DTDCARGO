-- infra/ops/portal-historial/cola-y-flag.sql — SDD-0586 §10.5.10, paso 4.3 del runbook
-- docs/runbooks/chatwoot-portal-p4-puertas.md: la cola nunca corrió y el flag nunca se encendió.
--
-- SOLO LECTURA: una transacción read only que termina en rollback. Imprime una sola línea HECHO con
-- conteos y el veredicto; nunca ids, nombres ni la hora del corte (solo si está fijado o es nulo).
--
-- Las cuatro condiciones van juntas: un UPDATE del flag por SQL directo no deja auditoría, así que
-- entity_audit_log solo no alcanza.
--   · salida = 0: chatwoot_portal_salida vacía para el tenant;
--   · flag_encendido = 0: feature_flags.enabled apagado para chatwoot_portal;
--   · encendidos_auditados = 0: ningún encendido de chatwoot_portal en entity_audit_log (lo escribe
--     append_audit_event, 0289:890-910);
--   · corte = nulo: chatwoot_portal_estado sin corte.
-- Si alguna no da, cola_y_flag=NO y la puerta 4 no sigue.
--
-- Uso:  docker exec -i dtd-cargo-db-1 psql -X -q -At -v ON_ERROR_STOP=1 -v tenant=<uuid> \
--         -U postgres -d postgres -f - < cola-y-flag.sql
\set ON_ERROR_STOP on
begin transaction read only;
set local statement_timeout = '30s';
with v as (
  select
    (select count(*) from public.chatwoot_portal_salida s where s.tenant_id = :'tenant'::uuid) as salida,
    (select count(*) from public.feature_flags f
       where f.tenant_id = :'tenant'::uuid and f.key = 'chatwoot_portal' and f.enabled) as flag_encendido,
    (select count(*) from public.entity_audit_log a
       where a.tenant_id = :'tenant'::uuid and a.entity_type = 'feature_flag' and a.event_type = 'feature_flag_changed'
         and a.after_data ->> 'key' = 'chatwoot_portal' and a.after_data ->> 'enabled' = 'true') as encendidos_auditados,
    exists (select 1 from public.chatwoot_portal_estado e
       where e.tenant_id = :'tenant'::uuid and e.corte is not null) as hay_corte
)
select 'HECHO salida=' || salida
    || ' flag_encendido=' || flag_encendido
    || ' encendidos_auditados=' || encendidos_auditados
    || ' corte=' || case when hay_corte then 'fijado' else 'nulo' end
    || ' cola_y_flag=' || case
         when salida = 0 and flag_encendido = 0 and encendidos_auditados = 0 and not hay_corte then 'ok'
         else 'NO'
       end
from v;
rollback;

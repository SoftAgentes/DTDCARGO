-- infra/chatwoot/vigilar-whatsapp.sql — lectura de la puerta 7 de 4.9 (SDD-0582) para vigilar.sh (SDD-0583).
--
-- Por bandeja de WhatsApp, una fila «id|salientes_mes|fallas_24h»: los salientes del mes en
-- curso (UTC), contra el cupo de 1.000 mensajes de servicio por número de Meta, y los
-- mensajes en `failed` de las últimas 24 h. vigilar.sh la pasa por stdin a psql, dentro del
-- contenedor de postgres:  psql -X -q -At -F '|' -v ON_ERROR_STOP=1
-- La misma consulta corre en PGlite en infra/ops/tests/vigilar-whatsapp.test.mjs.
--
-- Solo conteos e IDs de bandeja: ni teléfonos ni contenido. Solo lectura.
-- Valores del modelo de Chatwoot 4.19.1 (app/models/message.rb): message_type outgoing = 1 y
-- status failed = 3. `private` saca las notas internas, que también son outgoing. Las
-- plantillas que se mandan desde Chatwoot también son outgoing y cuentan.
-- `created_at` es timestamp sin zona, en UTC (Rails): se compara con now() pasado a UTC, así
-- el resultado no depende del TimeZone de la sesión.
-- El filtro de fechas va en el JOIN y no en el WHERE: una bandeja sin mensajes recientes
-- sale igual, con 0|0, y cada corrida lee solo los mensajes del mes y de las últimas 24 h.
begin transaction read only;
set local statement_timeout = '15s';
select i.id,
       count(m.id) filter (where m.message_type = 1 and not m.private
                           and m.created_at >= date_trunc('month', now() at time zone 'UTC')) as salientes_mes,
       count(m.id) filter (where m.status = 3
                           and m.created_at >= (now() at time zone 'UTC') - interval '24 hours') as fallas_24h
from inboxes i
left join messages m
  on m.inbox_id = i.id
 and m.created_at >= least(date_trunc('month', now() at time zone 'UTC'),
                           (now() at time zone 'UTC') - interval '24 hours')
where i.channel_type = 'Channel::Whatsapp'
group by i.id
order by i.id;
commit;

-- SDD-0586 §10.5.10 · Conteo del chat del portal. SOLO LECTURA.
-- Devuelve conteos y fechas; ni texto, ni nombres, ni ids de clientes.
begin transaction read only;
set local statement_timeout = '30s';

select
  count(*)                                                                as hilos,
  count(*) filter (where c.deleted_at is null)                            as hilos_vivos,
  count(*) filter (where c.deleted_at is not null)                        as hilos_archivados,
  count(*) filter (where c.deleted_at is null and c.status = 'abierto')   as abiertos,
  count(*) filter (where c.deleted_at is null and c.status = 'pendiente') as pendientes,
  count(*) filter (where c.deleted_at is null and c.status = 'resuelto')  as resueltos,
  count(distinct c.client_id)                                             as clientes
from public.conversations c
where c.tenant_id = :'tenant' and c.channel = 'portal';

select
  count(*)                                    as mensajes,
  count(*) filter (where m.direction = 'in')  as del_cliente,
  count(*) filter (where m.direction = 'out') as del_equipo,
  min(m.sent_at)::date                        as primero,
  max(m.sent_at)::date                        as ultimo,
  max(length(m.body))                         as largo_maximo
from public.conversation_messages m
join public.conversations c on c.id = m.conversation_id
where c.tenant_id = :'tenant' and c.channel = 'portal' and c.deleted_at is null;

rollback;

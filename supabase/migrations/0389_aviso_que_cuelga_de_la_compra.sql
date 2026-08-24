-- ─────────────────────────────────────────────────────────────
-- 0389 · SDD-0283 · el aviso al cliente puede colgar de una COMPRA, no solo
--        de un envío
--
-- QUÉ ESTABA ROTO — medido el 2026-08-24 sobre `main`.
--
-- `client_notification_schedule.shipment_id` es `not null references
-- shipments(id)` (migr 0247). O sea: un aviso sólo puede existir si ya hay un
-- envío. Pero el momento en que el cliente MÁS quiere saber algo —"mi carga
-- llegó a la bodega de Yiwu"— ocurre ANTES de que el envío exista: el envío
-- nace al consolidar, que puede ser semanas después de que el proveedor
-- entregue.
--
-- Resultado: el fan-out de la recepción resolvía el envío por Shipping Mark y,
-- si el cliente no tenía uno abierto, descartaba el aviso. Literal:
--
--     if (!shipment) continue;   // nadie se entera nunca
--
-- Y ese caso no es raro: es el NORMAL en una primera compra. SDD-0282 lo hizo
-- visible (queda una nota en la bitácora de la recepción); esta migración
-- habilita la cura de fondo.
--
-- QUÉ HACE
--
--   1. `shipment_id` pasa a nullable y aparece `prealerta_id`.
--   2. Un CHECK exige EXACTAMENTE UNA ancla. No es adorno: sin él, una fila con
--      las dos anclas se dedupe por una y se entrega por la otra, y una con
--      ninguna queda huérfana en la cola para siempre — el drain la levantaría
--      en cada pasada sin poder resolver destino.
--   3. El índice único de idempotencia se parte en dos parciales, uno por
--      ancla. El original —`(shipment_id, trigger_event, rule_id)`— con
--      `shipment_id` nullable dejaría de deduplicar: en Postgres los NULL no
--      son iguales entre sí, así que N avisos de compra con la misma regla y
--      el mismo evento entrarían TODOS. El cliente recibiría el mismo aviso
--      una vez por caja.
--
-- QUÉ **NO** HACE
--
--   · No siembra ninguna regla. Encender un aviso nuevo le manda correo y push
--     a clientes reales, y eso lo decide el founder desde Administración, no
--     una migración.
--   · No cambia el `trigger_event`. El aviso de la recepción en China sigue
--     siendo `status:in_warehouse`: significa lo mismo cuelgue de donde cuelgue,
--     y así el tenant que ya lo tenía configurado no pierde nada ni tiene que
--     volver a configurarlo — simplemente deja de perder los casos que antes se
--     caían.
--
-- SEGURIDAD · sin cambios. La tabla sigue siendo service_role only (el cliente
-- no lee esta cola) y su policy no se toca. `prealerta_id` va con
-- `on delete cascade` igual que `shipment_id`: si la compra se borra, su agenda
-- se va con ella en vez de quedar apuntando a un fantasma.
--
-- REVERSIBLE: sí, mientras no haya filas con `prealerta_id`. Para volver atrás
-- hay que borrar esas filas primero (o migrarlas), porque `shipment_id` no
-- puede volver a `not null` con ellas presentes.
-- ─────────────────────────────────────────────────────────────

-- 1 · La columna nueva y el ancla que deja de ser obligatoria.
alter table public.client_notification_schedule
  add column if not exists prealerta_id uuid
    references public.prealertas(id) on delete cascade;

alter table public.client_notification_schedule
  alter column shipment_id drop not null;

comment on column public.client_notification_schedule.prealerta_id is
  'SDD-0283: la COMPRA de la que cuelga el aviso, cuando todavía no hay envío '
  '(el caso normal al recibir en Yiwu). Excluyente con shipment_id.';

comment on column public.client_notification_schedule.shipment_id is
  'SDD-0283: pasó a nullable. Un aviso cuelga de un envío O de una compra, '
  'nunca de los dos ni de ninguno (constraint client_notif_sched_una_ancla).';

-- 2 · Exactamente una ancla.
--
-- `num_nonnulls` es builtin de Postgres. Se agrega SIN `not valid` a propósito:
-- todas las filas existentes tienen shipment_id no nulo y prealerta_id nulo, así
-- que la validación pasa de una y no queda una constraint a medio verificar que
-- alguien tenga que acordarse de validar después.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'client_notif_sched_una_ancla'
       and conrelid = 'public.client_notification_schedule'::regclass
  ) then
    alter table public.client_notification_schedule
      add constraint client_notif_sched_una_ancla
      check (num_nonnulls(shipment_id, prealerta_id) = 1);
  end if;
end $$;

-- 3 · Idempotencia, ahora por ancla.
--
-- El índice viejo cubría (shipment_id, trigger_event, rule_id). Con shipment_id
-- nullable ya no sirve para las compras: dos NULL no colisionan en un índice
-- único de Postgres, así que no deduplicaría nada. Se parte en dos parciales.
drop index if exists client_notif_sched_idem_uniq;

create unique index if not exists client_notif_sched_idem_envio_uniq
  on public.client_notification_schedule (shipment_id, trigger_event, rule_id)
  where status <> 'canceled' and shipment_id is not null;

create unique index if not exists client_notif_sched_idem_compra_uniq
  on public.client_notification_schedule (prealerta_id, trigger_event, rule_id)
  where status <> 'canceled' and prealerta_id is not null;

-- Búsqueda por compra (el historial del portal y el propio motor la usan).
create index if not exists client_notif_sched_prealerta_idx
  on public.client_notification_schedule (prealerta_id)
  where prealerta_id is not null;

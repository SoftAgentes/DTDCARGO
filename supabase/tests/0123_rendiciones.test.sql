\set ON_ERROR_STOP on

-- Contrato de la rendición quincenal (SDD-0069 · migr 0123).
-- Fixtures ficticios y rollback: no toca prod.
--
-- ── POR QUÉ IMPORTA ───────────────────────────────────────────────────────
--
-- La rendición es el documento con el que se liquida plata con la Operadora:
-- recaudado de terceros menos servicios locales facturados. Sus tres totales
-- quedan CONGELADOS al emitir, a propósito — es un corte de quincena, no un
-- reporte que se recalcula. Si esos números se pueden reescribir después, no
-- hay corte: hay una cifra que dice lo que diga quien la tocó último.
--
-- ── QUÉ SE PROTEGE ────────────────────────────────────────────────────────
--
--   1. 🔴 El snapshot no se borra.
--   2. 🔴 El ÚNICO cambio permitido es anular: `emitida → anulada`. Ni tocar
--      totales, ni re-emitir una anulada.
--   3. 🔴 Y al anular, sólo cambian `status` y `void_reason`. Éste es el caso
--      peligroso de verdad: anular Y reescribir un total en la MISMA
--      sentencia. Un guard que sólo mirara la transición lo dejaría pasar.
--   4. 🔴 Un recibo entra en UNA sola rendición activa. Si entra en dos, la
--      misma plata se le rinde dos veces a la Operadora.
--   5. 🔴 Y al anular, los recibos QUEDAN LIBRES. Es el par del anterior: sin
--      la sincronía del flag, el índice parcial mantiene el recibo preso y una
--      rendición anulada no se puede rehacer nunca. La protección y su escape
--      son dos triggers distintos, y hacen falta los dos.
--   6. 🔴 Un recibo de otro tenant no entra.
--   7. El correlativo RND-YYYY-NNNN no se comparte entre tenants.
--
-- Las afirmaciones miran el ESTADO DE LA FILA después del intento, no el texto
-- de la excepción: un contrato no puede depender de cómo está redactado su
-- propio fallo (lección de 0024, mismo día).
--
-- Cada contrato se validó rompiéndolo a propósito.

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$roles$;

\ir _supabase-platform-stubs.sql

-- ── Esqueleto mínimo ──────────────────────────────────────────────────────
create table public.tenants (id uuid primary key, slug text);

create table public.user_tenants (
  user_id     uuid,
  tenant_id   uuid,
  role        text,
  disabled_at timestamptz
);

create table public.payment_receipts (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null,
  deleted_at timestamptz
);

-- La 0123 re-declara el CHECK de entity_type para admitir 'rendition'. Sólo
-- tiene que existir para que el ALTER aplique.
create table public.entity_audit_log (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null
);

create or replace function public.get_user_tenant_id()
returns uuid language sql stable as $gut$ select null::uuid $gut$;

\ir ../migrations/0123_rendiciones.sql

-- ── Fixtures ──────────────────────────────────────────────────────────────
\set t1 '11111111-1111-1111-1111-111111111111'
\set t2 '22222222-2222-2222-2222-222222222222'
insert into public.tenants (id, slug) values (:'t1', 'dtd'), (:'t2', 'otro');

\set r1 'ea111111-1111-1111-1111-111111111111'
\set r2 'eb222222-2222-2222-2222-222222222222'
insert into public.payment_receipts (id, tenant_id) values
  (:'r1', :'t1'), (:'r2', :'t2');

-- La rendición de la quincena: $5.000 de terceros − $1.200 locales = $3.800.
\set q1 'd1111111-1111-1111-1111-111111111111'
insert into public.renditions
  (id, tenant_id, rendition_code, period_from, period_to,
   third_party_usd, local_revenue_usd, net_to_operadora_usd, receipt_count)
values (:'q1', :'t1', 'RND-2026-0001', '2026-08-01', '2026-08-15',
        5000.00, 1200.00, 3800.00, 1);

insert into public.rendition_receipts (tenant_id, rendition_id, receipt_id, amount_usd)
values (:'t1', :'q1', :'r1', 5000.00);

/*
 * Intenta un UPDATE tragándose cualquier error y devuelve el neto REAL después
 * del intento. Se afirma sobre el número que se liquida, no sobre el mensaje.
 */
create or replace function pg_temp.neto(p_id uuid) returns numeric
language sql as $n$
  select net_to_operadora_usd from public.renditions where id = p_id
$n$;

-- ── 1 · 🔴 El snapshot no se borra ────────────────────────────────────────
do $$
declare v_n int;
begin
  begin
    delete from public.renditions where id = 'd1111111-1111-1111-1111-111111111111';
  exception when others then null;
  end;

  select count(*) into v_n from public.renditions
   where id = 'd1111111-1111-1111-1111-111111111111';
  if v_n <> 1 then
    raise exception 'CONTRATO 1 ROTO: se borro una rendicion emitida — el corte de quincena desaparece';
  end if;
end;
$$;

-- ── 2 · 🔴 Los totales congelados no se reescriben ────────────────────────
do $$
begin
  begin
    update public.renditions
       set net_to_operadora_usd = 1.00, third_party_usd = 1.00
     where id = 'd1111111-1111-1111-1111-111111111111';
  exception when others then null;
  end;

  if pg_temp.neto('d1111111-1111-1111-1111-111111111111') <> 3800.00 then
    raise exception
      'CONTRATO 2 ROTO: el neto de la rendicion cambio a % — el corte deja de ser un corte',
      pg_temp.neto('d1111111-1111-1111-1111-111111111111');
  end if;
end;
$$;

-- ── 3 · 🔴 Anular Y reescribir un total en la misma sentencia ─────────────
--
-- Éste es el que de verdad importa. Un guard que sólo validara la transición
-- `emitida → anulada` dejaría pasar este UPDATE: la transición es legítima y el
-- monto viaja de contrabando en la misma sentencia.
do $$
begin
  begin
    update public.renditions
       set status = 'anulada',
           void_reason = 'error de calculo',
           net_to_operadora_usd = 99999.00
     where id = 'd1111111-1111-1111-1111-111111111111';
  exception when others then null;
  end;

  if pg_temp.neto('d1111111-1111-1111-1111-111111111111') <> 3800.00 then
    raise exception
      'CONTRATO 3 ROTO: se colo un total nuevo (%) dentro de una anulacion',
      pg_temp.neto('d1111111-1111-1111-1111-111111111111');
  end if;
  if (select status from public.renditions where id = 'd1111111-1111-1111-1111-111111111111')
     <> 'emitida' then
    raise exception 'CONTRATO 3 ROTO: el UPDATE mixto se aplico a medias — quedo anulada con el total viejo';
  end if;
end;
$$;

-- ── 4 · 🔴 Un recibo no entra en dos rendiciones activas ──────────────────
--
-- Si entra en dos, la misma plata se le rinde dos veces a la Operadora.
do $$
declare v_q2 uuid; v_n int;
begin
  insert into public.renditions
    (tenant_id, rendition_code, period_from, period_to,
     third_party_usd, local_revenue_usd, net_to_operadora_usd, receipt_count)
  values ('11111111-1111-1111-1111-111111111111', 'RND-2026-0002',
          '2026-08-16', '2026-08-31', 5000.00, 0, 5000.00, 1)
  returning id into v_q2;

  begin
    insert into public.rendition_receipts (tenant_id, rendition_id, receipt_id, amount_usd)
    values ('11111111-1111-1111-1111-111111111111', v_q2,
            'ea111111-1111-1111-1111-111111111111', 5000.00);
  exception when others then null;
  end;

  select count(*) into v_n from public.rendition_receipts
   where receipt_id = 'ea111111-1111-1111-1111-111111111111'
     and rendition_voided = false;
  if v_n <> 1 then
    raise exception
      'CONTRATO 4 ROTO: el mismo recibo esta en % rendiciones activas — se rinde dos veces la misma plata',
      v_n;
  end if;
end;
$$;

-- ── 5 · 🔴 Anular LIBERA los recibos ──────────────────────────────────────
--
-- El par del contrato 4. La protección (índice único parcial) y su escape
-- (sincronía del flag) son dos triggers distintos, y hacen falta los dos: sin
-- el sync, el recibo queda preso y una rendición anulada no se rehace nunca.
do $$
declare v_q3 uuid; v_libre int;
begin
  update public.renditions
     set status = 'anulada', void_reason = 'quincena mal cortada'
   where id = 'd1111111-1111-1111-1111-111111111111';

  if (select status from public.renditions where id = 'd1111111-1111-1111-1111-111111111111')
     <> 'anulada' then
    raise exception 'CONTRATO 5 ROTO: no se pudo anular una rendicion emitida — no hay forma de corregir un error';
  end if;

  select count(*) into v_libre from public.rendition_receipts
   where receipt_id = 'ea111111-1111-1111-1111-111111111111'
     and rendition_voided = false;
  if v_libre <> 0 then
    raise exception 'CONTRATO 5 ROTO: anular no libero el recibo (% siguen activas)', v_libre;
  end if;

  -- Y ahora sí entra en una rendición nueva.
  insert into public.renditions
    (tenant_id, rendition_code, period_from, period_to,
     third_party_usd, local_revenue_usd, net_to_operadora_usd, receipt_count)
  values ('11111111-1111-1111-1111-111111111111', 'RND-2026-0003',
          '2026-08-01', '2026-08-15', 5000.00, 1200.00, 3800.00, 1)
  returning id into v_q3;

  insert into public.rendition_receipts (tenant_id, rendition_id, receipt_id, amount_usd)
  values ('11111111-1111-1111-1111-111111111111', v_q3,
          'ea111111-1111-1111-1111-111111111111', 5000.00);
end;
$$;

-- Y una anulada no se re-emite.
do $$
begin
  begin
    update public.renditions set status = 'emitida'
     where id = 'd1111111-1111-1111-1111-111111111111';
  exception when others then null;
  end;
  if (select status from public.renditions where id = 'd1111111-1111-1111-1111-111111111111')
     <> 'anulada' then
    raise exception 'CONTRATO 5 ROTO: una rendicion ANULADA volvio a emitida';
  end if;
end;
$$;

-- ── 6 · 🔴 Un recibo de otro tenant no entra ──────────────────────────────
do $$
declare v_n int;
begin
  begin
    insert into public.rendition_receipts (tenant_id, rendition_id, receipt_id, amount_usd)
    values ('11111111-1111-1111-1111-111111111111',
            'd1111111-1111-1111-1111-111111111111',
            'eb222222-2222-2222-2222-222222222222',   -- recibo del tenant 2
            100.00);
  exception when others then null;
  end;

  select count(*) into v_n from public.rendition_receipts
   where receipt_id = 'eb222222-2222-2222-2222-222222222222';
  if v_n <> 0 then
    raise exception 'CONTRATO 6 ROTO: se rindio un recibo de OTRO tenant';
  end if;
end;
$$;

-- Un recibo borrado tampoco (el helper exige deleted_at is null).
do $$
declare v_n int; v_r uuid;
begin
  insert into public.payment_receipts (tenant_id, deleted_at)
  values ('11111111-1111-1111-1111-111111111111', now())
  returning id into v_r;

  begin
    insert into public.rendition_receipts (tenant_id, rendition_id, receipt_id, amount_usd)
    values ('11111111-1111-1111-1111-111111111111',
            'd1111111-1111-1111-1111-111111111111', v_r, 100.00);
  exception when others then null;
  end;

  select count(*) into v_n from public.rendition_receipts where receipt_id = v_r;
  if v_n <> 0 then
    raise exception 'CONTRATO 6 ROTO: se rindio un recibo dado de baja';
  end if;
end;
$$;

-- ── 7 · El correlativo no se comparte entre tenants ───────────────────────
do $$
declare v1 text; v2 text;
begin
  v1 := public.next_rendition_code('11111111-1111-1111-1111-111111111111');
  v2 := public.next_rendition_code('22222222-2222-2222-2222-222222222222');

  if v1 !~ '^RND-[0-9]{4}-[0-9]{4}$' then
    raise exception 'CONTRATO 7 ROTO: el codigo no tiene forma RND-YYYY-NNNN (es %)', v1;
  end if;
  -- El tenant 1 ya emitió 3 → el próximo es el 4º.
  if v1 not like '%-0004' then
    raise exception 'CONTRATO 7 ROTO: el tenant 1 iba por 0004 y dio %', v1;
  end if;
  -- El tenant 2 no emitió ninguna → arranca en 1, no sigue el contador ajeno.
  if v2 not like '%-0001' then
    raise exception 'CONTRATO 7 ROTO: el contador se comparte entre tenants (tenant 2 dio %)', v2;
  end if;
end;
$$;

rollback;

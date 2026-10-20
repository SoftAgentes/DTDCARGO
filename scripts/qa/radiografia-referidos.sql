-- SDD-0567 (2.11 del plan contable) · Radiografía de SOLO LECTURA de public.referrals.
--
-- SOLO CONTEOS. No sale ningún monto, nombre, correo, teléfono, código, markbox
-- ni id: cada fila es un chequeo y cuántos referidos (o facturas) lo cumplen,
-- más en cuántos tenants. Los datos personales del referido (referred_name,
-- referred_email, referred_phone, referred_company) no se leen.
--
-- La corre el Director, con la autorización escrita de Sam, en una transacción
-- de solo lectura que termina en ROLLBACK. Decisión 2 de Sam (2026-10-19): lo
-- que hay son datos de prueba. Esto no es para repararlos, sino para saber si
-- el candado nuevo choca con filas existentes (un CHECK que no valide, o un
-- disparador que trabe una transición pendiente).
--
-- Corrida en producción por el Director el 2026-10-20T06:20:12Z, con la
-- autorización literal de Sam «autorizo la radiografía 2.11 de referidos, solo
-- conteos», sobre la versión con sha256 73d48a2c… (la misma consulta, con otra
-- cabecera): 0 filas en todos los chequeos. Se repite después de aplicar la 0494.
-- Su prueba es scripts/__tests__/radiografia-referidos.test.ts (PGlite, fixtures
-- limpio y sucio) y scripts/check-schema-rebuild.mjs la corre sobre el esquema
-- completo.

begin transaction isolation level repeatable read read only;
set local statement_timeout = '15s';
set local lock_timeout = '2s';

with r as (
  select r.id, r.tenant_id, r.status::text as estado, r.referred_client_id,
         r.reward_usd, r.accredited_at, r.applied_invoice_id, r.applied_entry_id, r.applied_at
  from public.referrals r
  where r.deleted_at is null
),
-- Facturas del cliente referido, unidas por markbox como el disparador de 0197/0250.
venta as (
  select r.id as referral_id,
         bool_or(i.status::text in ('emitida', 'parcial', 'pagada', 'vencida')) as con_venta,
         bool_or(i.status::text = 'anulada') as con_anulada
  from r
  join public.clients c on c.id = r.referred_client_id and c.tenant_id = r.tenant_id
  join public.invoices i on i.client_markbox = c.markbox and i.tenant_id = r.tenant_id
                        and i.deleted_at is null
  group by r.id
),
-- Asientos del crédito de referido (source = 'referral_credit', 0237).
asiento as (
  select e.referral_id,
         count(*) as total,
         count(*) filter (where e.status::text <> 'anulado') as vivos,
         bool_or(e.status::text <> 'anulado' and e.invoice_id is not null) as vivo_con_factura,
         array_agg(distinct e.invoice_id) filter (where e.status::text <> 'anulado') as facturas_vivas
  from public.journal_entries e
  where e.source = 'referral_credit' and e.referral_id is not null
  group by e.referral_id
),
chequeos as (
  -- R0 · cómo están hoy
  select 'R0 vivos en estado ' || r.estado as chequeo, r.id, r.tenant_id from r
  union all
  select 'R0 borrados (deleted_at)', x.id, x.tenant_id from public.referrals x where x.deleted_at is not null

  -- R1 · «nace sin venta»: acreditado o aplicado sin una factura que acredite del referido
  union all
  select 'R1 acreditado o aplicado sin venta del referido', r.id, r.tenant_id
  from r left join venta v on v.referral_id = r.id
  where r.estado in ('acreditado', 'aplicado') and not coalesce(v.con_venta, false)
  union all
  select 'R1b acreditado o aplicado sin cliente referido', r.id, r.tenant_id
  from r where r.estado in ('acreditado', 'aplicado') and r.referred_client_id is null

  -- R2 · la regla de anulación: en espera de aplicarse, con la venta del referido anulada
  union all
  select 'R2 acreditado con la venta del referido solo anulada', r.id, r.tenant_id
  from r join venta v on v.referral_id = r.id
  where r.estado = 'acreditado' and v.con_anulada and not v.con_venta

  -- R3 · coherencia del estado con sus columnas
  union all
  select 'R3 acreditado o aplicado sin accredited_at', r.id, r.tenant_id
  from r where r.estado in ('acreditado', 'aplicado') and r.accredited_at is null
  union all
  select 'R3b aplicado sin factura de aplicación', r.id, r.tenant_id
  from r where r.estado = 'aplicado' and r.applied_invoice_id is null
  union all
  select 'R3c «renacido»: no aplicado con factura o fecha de aplicación', r.id, r.tenant_id
  from r where r.estado <> 'aplicado' and (r.applied_invoice_id is not null or r.applied_at is not null)
  union all
  select 'R3d acreditado o aplicado con monto 0 o menos', r.id, r.tenant_id
  from r where r.estado in ('acreditado', 'aplicado') and r.reward_usd <= 0
  union all
  select 'R3e invitado o registrado con monto distinto de 0', r.id, r.tenant_id
  from r where r.estado in ('invitado', 'registrado', 'primer-embarque') and r.reward_usd <> 0

  -- R4 · el asiento del crédito contra el estado («aplicarse dos veces»)
  union all
  select 'R4 asiento vivo y el referido no está aplicado', r.id, r.tenant_id
  from r join asiento a on a.referral_id = r.id
  where a.vivos > 0 and r.estado <> 'aplicado'
  union all
  select 'R4b aplicado sin asiento vivo', r.id, r.tenant_id
  from r left join asiento a on a.referral_id = r.id
  where r.estado = 'aplicado' and coalesce(a.vivos, 0) = 0
  union all
  select 'R4c aplicado con el asiento vivo en otra factura', r.id, r.tenant_id
  from r join asiento a on a.referral_id = r.id
  where r.estado = 'aplicado' and a.vivo_con_factura
    and not (r.applied_invoice_id = any (a.facturas_vivas))
  union all
  select 'R4d con dos o más asientos de crédito (vivos o anulados)', r.id, r.tenant_id
  from r join asiento a on a.referral_id = r.id
  where a.total >= 2
  union all
  select 'R4e asientos de crédito sin referido vivo', e.id, e.tenant_id
  from public.journal_entries e
  where e.source = 'referral_credit' and e.status::text <> 'anulado'
    and not exists (select 1 from r where r.id = e.referral_id)

  -- R5 · facturas del referidor con más de un crédito aplicado
  union all
  select 'R5 facturas con dos o más créditos aplicados', f.applied_invoice_id, f.tenant_id
  from (select applied_invoice_id, tenant_id from r
        where r.estado = 'aplicado' and r.applied_invoice_id is not null
        group by applied_invoice_id, tenant_id having count(*) >= 2) f
)
select chequeo, count(*) as filas, count(distinct tenant_id) as tenants
from chequeos
group by chequeo
order by chequeo;

rollback;

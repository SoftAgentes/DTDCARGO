-- ─────────────────────────────────────────────────────────────
-- SDD-0134 · Reportar pago + comprobante en el portal — Slices A + B
--
-- El cliente, desde el detalle de una factura del portal, REPORTA un pago
-- (monto/método/fecha/comprobante) y el asesor lo CONFIRMA o RECHAZA desde el
-- Studio. NO es una pasarela: el modelo sigue siendo DDP prepago por
-- transferencia; esto solo mete el REPORTE + la EVIDENCIA al sistema.
--
-- Decisiones founder (2026-07-01):
--   - Alcance V1 = A + B. Confirmar = "solo marca" → suma a invoices.paid_amount
--     (saldo visible) y recomputa el status. SIN asiento contable (Slice C, luego).
--   - Métodos: transferencia · pago_movil · zelle · binance · otro (nota libre).
--   - Parciales SÍ (varios reportes por factura) + el cliente puede EDITAR/BORRAR
--     su reporte mientras siga en `reportado` (antes de que el asesor lo toque).
--
-- Modelo espejo de shipment_documents (0086, portal-facing por markbox) + la
-- validación-en-DB de la polimórfica (0097/lección SDD-0045): un trigger valida
-- invoice↔tenant↔markbox para TODO cliente, no solo la server action.
--
-- Path del comprobante en el bucket privado `payment-proofs`:
--   {tenant_id}/{invoice_id}/{report_id}/{uuid}.{ext}
-- Las signed URLs se generan server-side con admin client (un cliente puro del
-- portal NO matchea get_user_tenant_id() → no firma vía storage RLS; el ownership
-- lo garantiza la RLS de tabla por markbox antes de firmar, igual que 0086).
--
-- NO se aplica a prod desde acá (lo hace el Director / MCP). Número 0195.
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. ENUMS                                                   ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Método declarado por el cliente. `otro` habilita el campo libre `note` (por si
-- pagó por una vía no listada — decisión founder: "se puede meditar en una parte").
create type payment_report_method as enum (
  'transferencia',
  'pago_movil',
  'zelle',
  'binance',
  'otro'
);

-- Ciclo de vida del reporte. reportado → confirmado | rechazado (terminal).
create type payment_report_status as enum (
  'reportado',
  'confirmado',
  'rechazado'
);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. TABLA payment_reports                                   ║
-- ╚═══════════════════════════════════════════════════════════╝
create table public.payment_reports (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  invoice_id     uuid not null references public.invoices(id) on delete cascade,
  invoice_code   text not null,                            -- snapshot (F-YYYY-NNNN)
  client_markbox text not null,                            -- denormalizado para la RLS del portal
  amount         numeric(14,2) not null check (amount > 0),
  currency       invoice_currency not null default 'USD',
  method         payment_report_method not null,
  paid_at        date not null,                            -- fecha del pago según el cliente
  proof_path     text,                                     -- comprobante en bucket payment-proofs; unique si existe
  status         payment_report_status not null default 'reportado',
  note           text,                                     -- nota del cliente / motivo de rechazo del asesor
  confirmed_by   uuid references auth.users(id) on delete set null,
  confirmed_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz                               -- soft delete (cliente borra antes de confirmar)
);

comment on table public.payment_reports is
  'SDD-0134: reportes de pago del cliente sobre una factura (monto/método/fecha/comprobante). client_markbox denormalizado para la RLS del portal. Parciales permitidos (varios por factura). reportado → confirmado|rechazado; al confirmar se suma a invoices.paid_amount (RPC confirm_payment_report). Soft delete via deleted_at.';

-- El path del comprobante es único (un object = un reporte). Parcial: solo cuando
-- hay comprobante (proof_path null en los "otro" sin evidencia no choca).
create unique index payment_reports_proof_path_uidx
  on public.payment_reports (proof_path)
  where proof_path is not null;

create index payment_reports_invoice_idx
  on public.payment_reports (tenant_id, invoice_id)
  where deleted_at is null;

create index payment_reports_markbox_idx
  on public.payment_reports (client_markbox)
  where deleted_at is null;

-- Anti-abuso: contar reportes `reportado` pendientes por factura (rate-limit lo
-- aplica la server action sobre este índice).
create index payment_reports_pending_idx
  on public.payment_reports (tenant_id, invoice_id)
  where deleted_at is null and status = 'reportado';

-- GRANTS explícitos (auto-expose new tables OFF).
grant select, insert, update, delete on public.payment_reports to authenticated;
grant all on public.payment_reports to service_role;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. RLS · equipo por tenant + portal self por markbox      ║
-- ╚═══════════════════════════════════════════════════════════╝
alter table public.payment_reports enable row level security;

-- Equipo: CRUD por tenant (confirmar/rechazar, ver comprobante, etc.).
create policy "payment_reports by tenant"
  on public.payment_reports for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

-- service_role: full (server actions con admin client, signed URLs, workers).
create policy "payment_reports service_role all"
  on public.payment_reports for all
  to service_role
  using (true)
  with check (true);

-- Cliente del portal: LEE los suyos por markbox (aditiva).
create policy "payment_reports portal self read"
  on public.payment_reports for select
  to authenticated
  using (
    deleted_at is null
    and client_markbox is not null
    and client_markbox = public.get_portal_client_markbox()
  );

-- Cliente del portal: INSERTA reportes SUYOS, solo en estado inicial `reportado`.
-- La coherencia invoice↔tenant↔markbox la fuerza el trigger de abajo (no confía
-- en el tenant_id que mande el cliente). Insert real va server-side con admin
-- client (defensa en profundidad); esta policy cubre PostgREST directo.
create policy "payment_reports portal self insert"
  on public.payment_reports for insert
  to authenticated
  with check (
    client_markbox is not null
    and client_markbox = public.get_portal_client_markbox()
    and status = 'reportado'
  );

-- Cliente del portal: EDITA/BORRA (soft) su reporte MIENTRAS siga en `reportado`.
-- No puede cambiarlo a confirmado/rechazado (eso es del equipo, vía RPC) — el
-- with check exige que siga en `reportado`.
create policy "payment_reports portal self update"
  on public.payment_reports for update
  to authenticated
  using (
    client_markbox is not null
    and client_markbox = public.get_portal_client_markbox()
    and status = 'reportado'
  )
  with check (
    client_markbox = public.get_portal_client_markbox()
    and status = 'reportado'
  );

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4. Trigger updated_at (reusa touch_updated_at de 0002)    ║
-- ╚═══════════════════════════════════════════════════════════╝
create trigger payment_reports_touch
  before update on public.payment_reports
  for each row execute function public.touch_updated_at();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 5. Validación DB · el reporte apunta a una factura real   ║
-- ║    del MISMO tenant y markbox, y no-borrador (no negociable)║
-- ╚═══════════════════════════════════════════════════════════╝
-- Lección SDD-0045 (memoria feedback_polymorphic_table_db_validation): la server
-- action valida, PERO un cliente Supabase directo (PostgREST) la saltaría. Este
-- trigger BEFORE INSERT/UPDATE defiende en la DB → cubre TODO cliente. Además
-- sella el snapshot `invoice_code` desde la factura (no confía en el del body).
create or replace function public.payment_reports_validate_invoice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  select invoice_code into v_code
  from public.invoices
  where id = new.invoice_id
    and tenant_id = new.tenant_id
    and client_markbox = new.client_markbox
    and status <> 'borrador'      -- no se reporta pago de un borrador
    and deleted_at is null;

  if v_code is null then
    raise exception 'reporte de pago sobre factura inexistente, ajena, en borrador o de otro cliente (invoice %, tenant %, markbox %)',
      new.invoice_id, new.tenant_id, new.client_markbox
      using errcode = 'check_violation';
  end if;

  new.invoice_code := v_code;    -- sella el snapshot desde la fuente
  return new;
end;
$$;

comment on function public.payment_reports_validate_invoice is
  'SDD-0134: valida que payment_reports.invoice_id exista, sea del mismo tenant+markbox y no-borrador; sella invoice_code. Defiende contra un cliente que forje invoice_id/tenant_id vía PostgREST directo.';

drop trigger if exists payment_reports_validate_invoice_trg on public.payment_reports;
create trigger payment_reports_validate_invoice_trg
  before insert or update on public.payment_reports
  for each row execute function public.payment_reports_validate_invoice();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 6. RPC confirm_payment_report · atómico (equipo)          ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Confirmar o rechazar un reporte. Confirmar = "solo marca" (decisión founder):
-- suma a invoices.paid_amount + last_payment_at y recomputa el status (parcial/
-- pagada). Rechazar = solo marca el reporte con el motivo. Atómico (una función).
--
-- SECURITY DEFINER pero con chequeo EXPLÍCITO de tenant contra get_user_tenant_id()
-- del caller → un cliente del portal (tenant null) NO puede invocarla. Se llama con
-- el client de SESIÓN del asesor (no admin), para que auth.uid()/tenant resuelvan.
create or replace function public.confirm_payment_report(
  p_report_id uuid,
  p_action    payment_report_status,   -- 'confirmado' | 'rechazado'
  p_note      text default null
) returns public.payment_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.get_user_tenant_id();
  v_rep    public.payment_reports;
  v_inv    public.invoices;
  v_new_paid numeric(14,2);
  v_new_status invoice_status;
begin
  if v_tenant is null then
    raise exception 'no autorizado: solo el equipo puede confirmar/rechazar reportes'
      using errcode = 'insufficient_privilege';
  end if;
  if p_action not in ('confirmado', 'rechazado') then
    raise exception 'acción inválida: %', p_action using errcode = 'check_violation';
  end if;

  -- Bloquea el reporte (evita doble confirmación concurrente).
  select * into v_rep
  from public.payment_reports
  where id = p_report_id and tenant_id = v_tenant and deleted_at is null
  for update;

  if v_rep.id is null then
    raise exception 'reporte no encontrado o ajeno al tenant' using errcode = 'no_data_found';
  end if;
  if v_rep.status <> 'reportado' then
    raise exception 'el reporte ya fue % (no se puede volver a procesar)', v_rep.status
      using errcode = 'check_violation';
  end if;

  if p_action = 'confirmado' then
    -- Bloquea la factura y suma el monto reportado al acumulador de pagado.
    select * into v_inv
    from public.invoices
    where id = v_rep.invoice_id and tenant_id = v_tenant and deleted_at is null
    for update;

    if v_inv.id is null then
      raise exception 'la factura del reporte ya no existe' using errcode = 'no_data_found';
    end if;

    v_new_paid := round((coalesce(v_inv.paid_amount, 0) + v_rep.amount)::numeric, 2);

    -- Recompute del status visible (no toca borrador/anulada). pagada si cubre el
    -- total; parcial si hay algo pagado; si no, se queda como estaba.
    v_new_status := v_inv.status;
    if v_inv.status in ('emitida', 'parcial', 'vencida') then
      if v_new_paid >= v_inv.total_amount then
        v_new_status := 'pagada';
      elsif v_new_paid > 0 then
        v_new_status := 'parcial';
      end if;
    end if;

    update public.invoices
    set paid_amount     = v_new_paid,
        last_payment_at = now(),
        status          = v_new_status
    where id = v_inv.id;
  end if;

  update public.payment_reports
  set status       = p_action,
      note         = coalesce(p_note, note),
      confirmed_by = auth.uid(),
      confirmed_at = now()
  where id = v_rep.id
  returning * into v_rep;

  return v_rep;
end;
$$;

comment on function public.confirm_payment_report is
  'SDD-0134: confirma (suma a invoices.paid_amount + recomputa status) o rechaza (marca con motivo) un reporte de pago. Atómico, con lock. Chequea tenant del caller (get_user_tenant_id) → el portal no puede invocarla.';

-- Solo el equipo autenticado. Revoke a public/anon (deuda rpc_anon_execute).
revoke all on function public.confirm_payment_report(uuid, payment_report_status, text) from public, anon;
grant execute on function public.confirm_payment_report(uuid, payment_report_status, text) to authenticated;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 7. Bucket privado `payment-proofs` + Storage RLS por tenant║
-- ╚═══════════════════════════════════════════════════════════╝
-- Calca shipment-docs (0086): privado, 10MB, PDF + imágenes. 4 policies por
-- tenant (1er segmento del path = tenant_id). El portal sube/lee server-side con
-- admin client (service_role) — un cliente puro no matchea get_user_tenant_id().
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs',
  'payment-proofs',
  false,
  10 * 1024 * 1024,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "payment-proofs service_role all"
  on storage.objects for all
  to service_role
  using (bucket_id = 'payment-proofs')
  with check (bucket_id = 'payment-proofs');

create policy "payment-proofs tenant insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = (public.get_user_tenant_id())::text
  );

create policy "payment-proofs tenant read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = (public.get_user_tenant_id())::text
  );

create policy "payment-proofs tenant delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = (public.get_user_tenant_id())::text
  );

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0195_payment_reports.sql
-- Aplicar con: MCP apply_migration (Director) · dry-run begin…rollback en prod antes.
-- ─────────────────────────────────────────────────────────────

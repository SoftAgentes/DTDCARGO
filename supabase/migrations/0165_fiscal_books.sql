-- ─────────────────────────────────────────────────────────────
-- SDD-0104 Slice A · Libros fiscales ASENTADOS (snapshot inmutable)
--
-- SDD-0073 entregó los Libros de Ventas/Compras como CLASIFICACIÓN ON-THE-FLY
-- (preview vivo sobre invoices/supplier_bills). Eso muta retroactivamente si se
-- edita una factura de un mes ya declarado — un libro fiscal oficial NO puede
-- mutar. Acá se PERSISTE el período: "asentar" congela un snapshot inmutable.
--
--   fiscal_books          = cabecera del asiento de un libro-período (+ totales)
--   fiscal_book_entries   = líneas congeladas (append-only, jamás se editan)
--
-- Patrones tomados del repo (dinero/fiscal):
--  - Idempotencia por ÍNDICE ÚNICO PARCIAL (un solo libro vigente por
--    período+tipo) — patrón SDD-0102 (claim financials).
--  - Gate de poderes EN LA DB (PostgREST evade la action): asentar/anular exige
--    rol accounting/admin vía current_studio_role() (0156). RBAC fiscal=accounting
--    (0085) + separación de poderes (DINERO = accounting + admin).
--  - Inmutabilidad real con triggers (patrón cierre de período 0133): las líneas
--    no se editan/borran; la cabecera solo transiciona asentado→anulado.
--  - Atomicidad cabecera+N líneas vía RPC security-definer (PostgREST no hace
--    multi-tabla atómico). La RPC recalcula los totales desde las líneas (no
--    confía en totales sueltos del caller). revoke execute from public, anon.
--  - text + CHECK para enums (sin tipo enum nativo → sin landmine de cast).
--
-- La CLASIFICACIÓN gravada/exenta/tasa_cero NO se recalcula acá: la hace el TS
-- (lib/studio/fiscal/types.ts, SDD-0073) leyendo iva_mode + fiscal_settings, y
-- este SDD persiste el resultado. Cero regla fiscal hardcodeada en SQL.
--
-- Reusa: get_user_tenant_id() (0001/0012), current_studio_role() (0156),
-- gen_random_uuid (pgcrypto). Aditiva. NO aplicar a prod (lo hace coordinación).
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. fiscal_books — cabecera del asiento de un libro-período ║
-- ╚═══════════════════════════════════════════════════════════╝

create table public.fiscal_books (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants(id) on delete cascade,
  period               text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),  -- YYYY-MM
  book_type            text not null check (book_type in ('ventas', 'compras')),
  status               text not null default 'asentado'
    check (status in ('asentado', 'anulado')),
  -- Totales congelados (los RECALCULA la RPC desde las líneas; nunca se confía
  -- en totales sueltos del caller). numeric → llega a TS como string (coercer).
  total_base           numeric(14,2) not null default 0,
  total_iva            numeric(14,2) not null default 0,
  total_total          numeric(14,2) not null default 0,
  total_base_exenta    numeric(14,2) not null default 0,
  total_base_gravada   numeric(14,2) not null default 0,
  total_base_tasa_cero numeric(14,2) not null default 0,
  row_count            integer not null default 0,
  currencies           text[] not null default '{}',   -- monedas presentes (nota de mezcla, V1 no normaliza)
  default_iva_mode     text,                            -- snapshot del default vigente al asentar (traza)
  posted_at            timestamptz not null default now(),
  posted_by            uuid references auth.users(id) on delete set null,
  voided_at            timestamptz,
  voided_by            uuid references auth.users(id) on delete set null,
  void_reason          text,
  created_at           timestamptz not null default now()
);

comment on table public.fiscal_books is
  'SDD-0104: cabecera del asiento de un Libro de IVA (ventas/compras) por período. Snapshot inmutable de SDD-0073. status asentado|anulado; corregir = anular + re-asentar. RLS por tenant; asentar/anular solo accounting/admin (gate en DB).';
comment on column public.fiscal_books.default_iva_mode is
  'Snapshot de fiscal_settings.default_invoice_iva_mode vigente al asentar (traza de cómo se clasificó).';

-- Idempotencia (⭐ patrón SDD-0102): un solo libro VIGENTE por período+tipo. El
-- 2º asiento vigente (carrera de doble-submit / PostgREST directo) revienta
-- 23505; la action lo traduce a "ya asentado". El historial de anulados queda.
create unique index fiscal_books_one_live_idx
  on public.fiscal_books (tenant_id, period, book_type)
  where status = 'asentado';

-- Listado por tipo+período (selector de mes) y por estado.
create index fiscal_books_tenant_type_period_idx
  on public.fiscal_books (tenant_id, book_type, period);
create index fiscal_books_tenant_status_idx
  on public.fiscal_books (tenant_id, status);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. fiscal_book_entries — líneas congeladas (append-only)  ║
-- ╚═══════════════════════════════════════════════════════════╝

create table public.fiscal_book_entries (
  id              uuid primary key default gen_random_uuid(),
  book_id         uuid not null references public.fiscal_books(id) on delete cascade,
  -- tenant_id denormalizado → RLS simple sin join a fiscal_books por fila.
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  line_no         integer not null,
  op_date         date,
  document_number text,                 -- factura (ventas) / documento del proveedor (compras)
  control_number  text,                 -- nº de control fiscal (— si sin fuente, V1)
  rif             text,
  party_name      text,                 -- cliente (ventas) / proveedor (compras)
  iva_class       text check (iva_class in ('gravada', 'exenta', 'tasa_cero')),
  base            numeric(14,2),
  rate            numeric(6,3),
  iva             numeric(14,2),
  total           numeric(14,2),
  retention       numeric(14,2),        -- columna preparada (— en V1)
  currency        text,
  source_type     text check (source_type in ('invoice', 'bill')),
  source_ref      text,                 -- invoice_code / bill_code (traza; NO FK: el snapshot sobrevive borrados)
  created_at      timestamptz not null default now()
);

comment on table public.fiscal_book_entries is
  'SDD-0104: líneas congeladas de un libro asentado. APPEND-ONLY: jamás se editan ni borran (trigger). source_ref es traza textual (no FK) para que el snapshot sobreviva al borrado de la factura/compra origen.';

create index fiscal_book_entries_book_idx
  on public.fiscal_book_entries (book_id, line_no);
create index fiscal_book_entries_tenant_idx
  on public.fiscal_book_entries (tenant_id);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. GRANTS explícitos (auto-expose new tables OFF)        ║
-- ╚═══════════════════════════════════════════════════════════╝
-- INSERT/DELETE de filas NO se concede a authenticated: las líneas y la cabecera
-- nacen SOLO por la RPC (security-definer). authenticated solo SELECT (ver) +
-- UPDATE (anular la cabecera, gateado por RLS+trigger).
grant select on public.fiscal_books to authenticated;
grant update on public.fiscal_books to authenticated;
grant select on public.fiscal_book_entries to authenticated;
grant all on public.fiscal_books to service_role;
grant all on public.fiscal_book_entries to service_role;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4. RLS por tenant                                         ║
-- ╚═══════════════════════════════════════════════════════════╝

alter table public.fiscal_books enable row level security;
alter table public.fiscal_book_entries enable row level security;

-- SELECT: cualquier usuario autenticado del tenant ve sus libros.
create policy "fiscal_books_tenant_select"
  on public.fiscal_books for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()));

-- INSERT directo: bloqueado (las cabeceras nacen por la RPC security-definer).
create policy "fiscal_books_no_insert"
  on public.fiscal_books for insert to authenticated
  with check (false);

-- UPDATE: solo accounting/admin del tenant (para ANULAR). El trigger valida que
-- la única transición permitida sea asentado→anulado. USING + WITH CHECK ambos.
create policy "fiscal_books_editor_update"
  on public.fiscal_books for update to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and exists (
      select 1 from public.user_tenants ut
      where ut.user_id = (select auth.uid())
        and ut.tenant_id = fiscal_books.tenant_id
        and ut.role in ('accounting', 'admin')
        and ut.disabled_at is null
    )
  )
  with check (tenant_id = (select public.get_user_tenant_id()));

-- DELETE: bloqueado para authenticated (solo se anula, nunca se borra).
create policy "fiscal_books_no_delete"
  on public.fiscal_books for delete to authenticated using (false);

create policy "service_role_all_fiscal_books"
  on public.fiscal_books for all to service_role using (true) with check (true);

-- Entries: SELECT por tenant; INSERT/UPDATE/DELETE bloqueados a authenticated
-- (nacen por la RPC; inmutables por trigger).
create policy "fiscal_book_entries_tenant_select"
  on public.fiscal_book_entries for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()));

create policy "fiscal_book_entries_no_write"
  on public.fiscal_book_entries for insert to authenticated
  with check (false);

create policy "service_role_all_fiscal_book_entries"
  on public.fiscal_book_entries for all to service_role using (true) with check (true);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 5. Inmutabilidad + coherencia (triggers security-definer)║
-- ╚═══════════════════════════════════════════════════════════╝

-- 5a. Líneas APPEND-ONLY: ningún UPDATE/DELETE jamás (ni service_role por error).
--     security invoker (default) → aplica a todos los roles.
create or replace function public.fiscal_book_entries_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Las líneas de un libro fiscal asentado son inmutables (append-only).'
    using errcode = 'check_violation';
end;
$$;

comment on function public.fiscal_book_entries_immutable() is
  'SDD-0104: bloquea UPDATE/DELETE de fiscal_book_entries (append-only). Corregir un libro = anular la cabecera y re-asentar.';

revoke execute on function public.fiscal_book_entries_immutable() from public, anon;

create trigger fiscal_book_entries_immutable_trg
  before update or delete on public.fiscal_book_entries
  for each row execute function public.fiscal_book_entries_immutable();

-- 5b. Cabecera: BEFORE UPDATE solo permite asentado→anulado (+ campos voided_*);
--     BEFORE DELETE bloqueado. Cualquier otro cambio de datos/totales → raise.
create or replace function public.fiscal_books_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Un libro fiscal no se borra; solo se anula (status=anulado).'
      using errcode = 'check_violation';
  end if;

  -- Única mutación permitida: asentado → anulado. El resto de columnas debe
  -- quedar idéntico (un PATCH de PostgREST no puede alterar montos/líneas).
  if old.status = 'anulado' then
    raise exception 'Un libro fiscal anulado es inmutable.'
      using errcode = 'check_violation';
  end if;
  if new.status not in ('asentado', 'anulado') then
    raise exception 'Estado de libro inválido: %.', new.status
      using errcode = 'check_violation';
  end if;
  if new.status = 'asentado' then
    raise exception 'Un libro asentado solo puede pasar a anulado (o re-asentarse tras anular).'
      using errcode = 'check_violation';
  end if;

  -- Acá new.status = 'anulado'. Inmutabilidad ROBUSTA del snapshot: forzamos
  -- TODOS los campos de datos a su valor previo. Un PATCH de PostgREST solo puede
  -- efectuar status→anulado (+ void_reason); cualquier otro cambio se descarta.
  -- Sobreescribimos con old en vez de enumerar comparaciones (frágil: olvidar
  -- una columna deja un hueco — fue el caso de total_base_exenta/gravada/etc.).
  new.tenant_id            := old.tenant_id;
  new.period               := old.period;
  new.book_type            := old.book_type;
  new.total_base           := old.total_base;
  new.total_iva            := old.total_iva;
  new.total_total          := old.total_total;
  new.total_base_exenta    := old.total_base_exenta;
  new.total_base_gravada   := old.total_base_gravada;
  new.total_base_tasa_cero := old.total_base_tasa_cero;
  new.row_count            := old.row_count;
  new.currencies           := old.currencies;
  new.default_iva_mode     := old.default_iva_mode;
  new.posted_at            := old.posted_at;
  new.posted_by            := old.posted_by;
  new.created_at           := old.created_at;

  new.voided_at := now();
  new.voided_by := auth.uid();
  return new;
end;
$$;

comment on function public.fiscal_books_guard() is
  'SDD-0104: protege fiscal_books — bloquea DELETE y todo UPDATE salvo la transición asentado→anulado (sella voided_*).';

revoke execute on function public.fiscal_books_guard() from public, anon;

create trigger fiscal_books_guard_trg
  before update or delete on public.fiscal_books
  for each row execute function public.fiscal_books_guard();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 6. RPC atómica de asentado (security-definer)            ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Inserta cabecera + N líneas en una transacción. Valida tenant + rol
-- (accounting/admin, atado a user_tenants con disabled_at) DENTRO (al ser definer
-- bypassa RLS → el gate va acá). RECALCULA los totales de cabecera desde las
-- líneas recibidas (la cabecera no confía en totales sueltos del caller).
--
-- MODELO DE CONFIANZA (V1): las LÍNEAS (base/iva/clasificación) las computa la
-- server action desde invoices/supplier_bills + la config (SDD-0073) y se pasan
-- acá; la RPC NO re-deriva la clasificación en SQL — hacerlo duplicaría la lógica
-- de 0073 y arriesgaría divergencia silenciosa (un bug fiscal peor). Por eso el
-- asentado refleja lo que el SISTEMA computó al asentar, bajo responsabilidad de
-- accounting/admin; NO es una verificación independiente contra las facturas (eso
-- es V2). Mismo modelo que cualquier asiento contable del equipo (0079/0157). El
-- índice único parcial garantiza idempotencia.
create or replace function public.fiscal_post_book(
  p_period          text,
  p_book_type       text,
  p_entries         jsonb,
  p_default_iva_mode text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant  uuid := public.get_user_tenant_id();
  v_book_id uuid;
begin
  if v_tenant is null then
    raise exception 'Sin tenant en sesión.' using errcode = '42501';
  end if;
  -- Gate de poderes EN LA DB, atado al MISMO row de user_tenants (tenant +
  -- disabled_at): cierra al accounting deshabilitado y al split-role de un
  -- multi-membership. No se usa current_studio_role() (hace limit 1 sin atar
  -- el tenant ni filtrar disabled_at) — espeja exactamente la RLS de las tablas.
  if not exists (
    select 1 from public.user_tenants ut
    where ut.user_id = auth.uid()
      and ut.tenant_id = v_tenant
      and ut.role in ('accounting', 'admin')
      and ut.disabled_at is null
  ) then
    raise exception 'Solo Contabilidad puede asentar un libro fiscal.' using errcode = '42501';
  end if;
  if p_book_type not in ('ventas', 'compras') then
    raise exception 'Tipo de libro inválido: %.', p_book_type using errcode = 'check_violation';
  end if;
  if p_period !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Período inválido: %.', p_period using errcode = 'check_violation';
  end if;

  with parsed as (
    select * from jsonb_to_recordset(coalesce(p_entries, '[]'::jsonb)) as e(
      line_no         integer,
      op_date         date,
      document_number text,
      control_number  text,
      rif             text,
      party_name      text,
      iva_class       text,
      base            numeric,
      rate            numeric,
      iva             numeric,
      total           numeric,
      retention       numeric,
      currency        text,
      source_type     text,
      source_ref      text
    )
  ),
  agg as (
    select
      coalesce(sum(base), 0)                                            as total_base,
      coalesce(sum(iva), 0)                                             as total_iva,
      coalesce(sum(total), 0)                                           as total_total,
      coalesce(sum(base) filter (where iva_class = 'exenta'), 0)        as total_base_exenta,
      coalesce(sum(base) filter (where iva_class = 'gravada'), 0)       as total_base_gravada,
      coalesce(sum(base) filter (where iva_class = 'tasa_cero'), 0)     as total_base_tasa_cero,
      count(*)::int                                                     as row_count,
      coalesce(array_agg(distinct currency) filter (where currency is not null), '{}') as currencies
    from parsed
  )
  insert into public.fiscal_books (
    tenant_id, period, book_type, status,
    total_base, total_iva, total_total,
    total_base_exenta, total_base_gravada, total_base_tasa_cero,
    row_count, currencies, default_iva_mode, posted_by
  )
  select
    v_tenant, p_period, p_book_type, 'asentado',
    agg.total_base, agg.total_iva, agg.total_total,
    agg.total_base_exenta, agg.total_base_gravada, agg.total_base_tasa_cero,
    agg.row_count, agg.currencies, p_default_iva_mode, auth.uid()
  from agg
  returning id into v_book_id;

  insert into public.fiscal_book_entries (
    book_id, tenant_id, line_no, op_date, document_number, control_number,
    rif, party_name, iva_class, base, rate, iva, total, retention,
    currency, source_type, source_ref
  )
  select
    v_book_id, v_tenant,
    coalesce(p.line_no, row_number() over ())::int,
    p.op_date, p.document_number, p.control_number, p.rif, p.party_name,
    p.iva_class, p.base, p.rate, p.iva, p.total, p.retention,
    p.currency, p.source_type, p.source_ref
  from jsonb_to_recordset(coalesce(p_entries, '[]'::jsonb)) as p(
    line_no integer, op_date date, document_number text, control_number text,
    rif text, party_name text, iva_class text, base numeric, rate numeric,
    iva numeric, total numeric, retention numeric, currency text,
    source_type text, source_ref text
  );

  return v_book_id;
end;
$$;

comment on function public.fiscal_post_book(text, text, jsonb, text) is
  'SDD-0104: asienta atómicamente un libro (cabecera + líneas) para el tenant del caller. Exige rol accounting/admin. Recalcula totales desde las líneas. Idempotente vía índice único parcial (23505 si ya hay asiento vigente).';

revoke execute on function public.fiscal_post_book(text, text, jsonb, text) from public, anon;
grant execute on function public.fiscal_post_book(text, text, jsonb, text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Fin 0165_fiscal_books.sql · Aditiva · NO aplicar a prod (coordinación).
-- ─────────────────────────────────────────────────────────────

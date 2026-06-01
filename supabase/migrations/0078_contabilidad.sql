-- ─────────────────────────────────────────────────────────────
-- SDD-0040: Contabilidad (Bloque 1.2 financiero)
-- Plan de cuentas jerárquico (accounts) + doble partida
-- (journal_entries + journal_lines) + next_entry_code() +
-- RLS por tenant + seed del CoA estándar (84 cuentas) para el
-- tenant dtd. Cierra el gancho del asiento automático de SDD-0021.
--
-- Reusa get_user_tenant_id() (0001) y touch_updated_at() (0002).
--
-- NO incluye: lock/cierre de período, capa fiscal SENIAT, asiento del
-- pago, export de libros, multi-moneda con revaluación. Esos quedan
-- para SDDs futuros. El seed del CoA es genérico estilo QBO (NO datos
-- reales, NO fiscal venezolano) → puede ir commiteado.
-- ─────────────────────────────────────────────────────────────

-- Tipo de cuenta: Activo / Pasivo / Patrimonio / Ingresos /
-- Costo de ventas (COGS) / Gastos.
create type acct_type    as enum ('A', 'P', 'PT', 'I', 'CGS', 'G');
create type entry_status as enum ('borrador', 'asentado', 'anulado');

-- ── Plan de cuentas (árbol padre → hijo) ──────────────────────
create table public.accounts (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  code        text not null,                              -- "1.1.2" (jerárquico)
  name        text not null,
  type        acct_type not null,
  parent_id   uuid references public.accounts(id) on delete cascade,
  qbo_type    text,                                       -- Account Type nativo QBO (referencia)
  is_postable boolean not null default true,              -- true = hoja donde se asienta
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, code)
);

comment on table public.accounts is
  'SDD-0040: plan de cuentas jerárquico por tenant. parent_id self-ref (también derivable del code: parent = code sin el último segmento). is_postable=true son las hojas donde se asienta; los grupos (false) solo agregan. Seed estándar estilo QBO (no fiscal VE). RLS por tenant_id.';

create index accounts_tenant_idx on public.accounts (tenant_id);
create index accounts_parent_idx on public.accounts (parent_id);

-- ── Asientos (cabecera) ───────────────────────────────────────
create table public.journal_entries (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  entry_code text not null,                               -- "A-2026-0001"
  entry_date date not null default current_date,
  memo       text,
  status     entry_status not null default 'borrador',
  source     text not null default 'manual',              -- 'manual' | 'invoice'
  invoice_id uuid references public.invoices(id) on delete set null,
  posted_at  timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, entry_code)
);

comment on table public.journal_entries is
  'SDD-0040: asientos de doble partida. State machine borrador → asentado · anulado. Solo asentado afecta saldos. source=invoice + invoice_id para el asiento automático al emitir factura. Soft delete via deleted_at (solo borrador). RLS por tenant_id.';

create index je_tenant_status_idx
  on public.journal_entries (tenant_id, status) where deleted_at is null;

-- Soporta la idempotencia del asiento automático (no duplicar por factura).
create index je_invoice_idx
  on public.journal_entries (invoice_id) where invoice_id is not null;

-- ── Líneas (debe / haber) ─────────────────────────────────────
create table public.journal_lines (
  id         uuid primary key default gen_random_uuid(),
  entry_id   uuid not null references public.journal_entries(id) on delete cascade,
  account_id uuid not null references public.accounts(id),
  debit      numeric(14,2) not null default 0,
  credit     numeric(14,2) not null default 0,
  line_memo  text,
  -- Una línea tiene debe XOR haber (nunca ambos > 0).
  constraint journal_lines_debit_xor_credit check (not (debit > 0 and credit > 0))
);

comment on table public.journal_lines is
  'SDD-0040: líneas de un asiento. debit XOR credit (CHECK). El balance debe=haber se valida a nivel de acción (postEntry), no por trigger. RLS heredada via entry_id (policy join a journal_entries).';

create index jl_entry_idx   on public.journal_lines (entry_id);
create index jl_account_idx on public.journal_lines (account_id);

-- ── next_entry_code: A-YYYY-NNNN, counter por año + tenant ─────
-- Mismo patrón que next_invoice_code (0077) / next_quote_code (0007).
-- Si pasa de 9999 en un año el padding se extiende automáticamente.
create or replace function public.next_entry_code(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year int := extract(year from current_date);
  v_max int;
  v_padded text;
begin
  select coalesce(max((regexp_match(entry_code, '^A-\d{4}-(\d+)$'))[1]::int), 0) + 1
  into v_max
  from public.journal_entries
  where tenant_id = p_tenant_id
    and entry_code like 'A-' || v_year || '-%';

  v_padded := lpad(v_max::text, 4, '0');
  return 'A-' || v_year || '-' || v_padded;
end;
$$;

comment on function public.next_entry_code is
  'SDD-0040: genera el próximo entry_code A-YYYY-NNNN para el tenant del año actual.';

-- ── entity_audit_log: + 'journal_entry' y 'account' (aditivo) ──
-- Las acciones sensibles (asentar, anular, crear/editar cuenta) escriben
-- en el audit genérico con actor_type='user' via service_role.
do $$
begin
  alter table public.entity_audit_log drop constraint if exists entity_audit_log_entity_type_check;
  alter table public.entity_audit_log
    add constraint entity_audit_log_entity_type_check
    check (entity_type in (
      'shipment',
      'dispatch_order',
      'dispatch_order_package',
      'warehouse_receipt_cn',
      'warehouse_receipt_ve',
      'invoice',
      'journal_entry',
      'account'
    ));
end $$;

-- ── GRANTS EXPLÍCITOS (auto-expose new tables OFF) ────────────
grant select, insert, update, delete on public.accounts         to authenticated;
grant select, insert, update, delete on public.journal_entries  to authenticated;
grant select, insert, update, delete on public.journal_lines    to authenticated;
grant execute on function public.next_entry_code(uuid)          to authenticated;

-- ── RLS por tenant ────────────────────────────────────────────
alter table public.accounts        enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines   enable row level security;

create policy "accounts by tenant"
  on public.accounts for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());

create policy "journal_entries by tenant"
  on public.journal_entries for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

-- journal_lines no tiene tenant_id propio: la RLS se ata al entry (su
-- journal_entry debe pertenecer al tenant del usuario).
create policy "journal_lines by entry tenant"
  on public.journal_lines for all
  to authenticated
  using (
    exists (
      select 1 from public.journal_entries je
      where je.id = journal_lines.entry_id
        and je.tenant_id = public.get_user_tenant_id()
    )
  )
  with check (
    exists (
      select 1 from public.journal_entries je
      where je.id = journal_lines.entry_id
        and je.tenant_id = public.get_user_tenant_id()
    )
  );

-- ── Triggers updated_at ───────────────────────────────────────
create trigger accounts_touch
  before update on public.accounts
  for each row execute function public.touch_updated_at();

create trigger journal_entries_touch
  before update on public.journal_entries
  for each row execute function public.touch_updated_at();

-- ── Seed del plan de cuentas (84 cuentas) para el tenant dtd ───
-- Fuente: docs/specs/0040-contabilidad/assets/chart-of-accounts.md.
-- Genérico estilo QBO (NO datos reales, NO fiscal VE) → commiteado.
-- Idempotente (on conflict do nothing). El parent_id se resuelve en un
-- segundo paso por prefijo del code (parent = code sin el último segmento).

-- Paso 1: insertar todas las cuentas SIN parent_id.
insert into public.accounts (tenant_id, code, name, type, is_postable, qbo_type)
select t.id, x.code, x.name, x.type::acct_type, x.is_postable, x.qbo_type
from public.tenants t
cross join (values
  ('1',       'Activo',                                        'A',   false, null),
  ('1.1',     'Activo corriente',                              'A',   false, null),
  ('1.1.1',   'Caja y bancos',                                 'A',   false, 'Bank'),
  ('1.1.1.1', 'Caja chica',                                    'A',   true,  'Bank'),
  ('1.1.1.2', 'Banco cuenta corriente',                        'A',   true,  'Bank'),
  ('1.1.1.3', 'Banco USD',                                     'A',   true,  'Bank'),
  ('1.1.2',   'Cuentas por cobrar clientes',                   'A',   true,  'Accounts receivable (A/R)'),
  ('1.1.3',   'Fondos no depositados',                         'A',   true,  'Other Current Assets'),
  ('1.1.4',   'Anticipos a proveedores / navieras',            'A',   true,  'Other Current Assets'),
  ('1.1.5',   'Seguros pagados por adelantado',                'A',   true,  'Other Current Assets'),
  ('1.1.6',   'Aranceles de importación por recuperar',        'A',   true,  'Other Current Assets'),
  ('1.1.7',   'Inventario de repuestos',                       'A',   true,  'Other Current Assets'),
  ('1.2',     'Activo fijo',                                   'A',   false, null),
  ('1.2.1',   'Flota — vehículos / camiones',                  'A',   true,  'Fixed Assets'),
  ('1.2.2',   'Remolques',                                     'A',   true,  'Fixed Assets'),
  ('1.2.3',   'Equipos de almacén / montacargas',              'A',   true,  'Fixed Assets'),
  ('1.2.4',   'Mobiliario y equipo de oficina',                'A',   true,  'Fixed Assets'),
  ('1.2.5',   'Equipos de cómputo',                            'A',   true,  'Fixed Assets'),
  ('1.2.9',   'Depreciación acumulada de flota (contra)',      'A',   true,  'Fixed Assets'),
  ('2',       'Pasivo',                                        'P',   false, null),
  ('2.1',     'Pasivo corriente',                              'P',   false, null),
  ('2.1.1',   'Cuentas por pagar proveedores',                 'P',   true,  'Accounts payable (A/P)'),
  ('2.1.2',   'Tarjeta de crédito',                            'P',   true,  'Credit Card'),
  ('2.1.3',   'Sueldos por pagar',                             'P',   true,  'Other Current Liabilities'),
  ('2.1.4',   'Impuestos por pagar',                           'P',   true,  'Other Current Liabilities'),
  ('2.1.5',   'IVA / impuesto a las ventas por pagar',         'P',   true,  'Other Current Liabilities'),
  ('2.1.6',   'Desembolsos a clientes (terceros)',             'P',   true,  'Other Current Liabilities'),
  ('2.2',     'Pasivo no corriente',                           'P',   false, null),
  ('2.2.1',   'Préstamos por compra de vehículos',             'P',   true,  'Long Term Liabilities'),
  ('2.2.2',   'Préstamos bancarios largo plazo',               'P',   true,  'Long Term Liabilities'),
  ('3',       'Patrimonio',                                    'PT',  false, null),
  ('3.1',     'Capital social',                                'PT',  true,  'Equity'),
  ('3.2',     'Aportes del propietario',                       'PT',  true,  'Equity'),
  ('3.3',     'Retiros del propietario',                       'PT',  true,  'Equity'),
  ('3.4',     'Utilidades retenidas',                          'PT',  true,  'Equity'),
  ('3.5',     'Utilidad/pérdida del ejercicio (calculada)',    'PT',  true,  'Equity'),
  ('4',       'Ingresos',                                      'I',   false, null),
  ('4.1',     'Ingresos por flete / transporte',               'I',   false, 'Income'),
  ('4.1.1',   'Flete marítimo — consolidado / LCL',            'I',   true,  'Income'),
  ('4.1.2',   'Flete marítimo — contenedor / FCL',             'I',   true,  'Income'),
  ('4.1.3',   'Puerta a puerta DDP',                           'I',   true,  'Income'),
  ('4.1.4',   'Transporte terrestre nacional',                 'I',   true,  'Income'),
  ('4.2',     'Recargo por combustible',                       'I',   true,  'Income'),
  ('4.3',     'Cargos accesorios',                             'I',   false, 'Income'),
  ('4.3.1',   'Demoras / detención',                           'I',   true,  'Income'),
  ('4.3.2',   'Manipuleo / carga-descarga',                    'I',   true,  'Income'),
  ('4.3.3',   'Almacenaje',                                    'I',   true,  'Income'),
  ('4.4',     'Gestión aduanera / despacho',                   'I',   true,  'Income'),
  ('4.5',     'Otros ingresos por servicios',                  'I',   true,  'Income'),
  ('4.9',     'Descuentos sobre ventas (contra)',              'I',   true,  'Income'),
  ('5',       'Costo de ventas',                               'CGS', false, null),
  ('5.1',     'Flete comprado a navieras / aerolíneas',        'CGS', true,  'Cost of Goods Sold'),
  ('5.2',     'Transporte subcontratado / fletes a terceros',  'CGS', true,  'Cost of Goods Sold'),
  ('5.3',     'Combustible (costo de venta)',                  'CGS', true,  'Cost of Goods Sold'),
  ('5.4',     'Aranceles e impuestos de importación',          'CGS', true,  'Cost of Goods Sold'),
  ('5.5',     'Honorarios de agente aduanal',                  'CGS', true,  'Cost of Goods Sold'),
  ('5.6',     'Peajes y pesaje',                               'CGS', true,  'Cost of Goods Sold'),
  ('5.7',     'Alquiler de equipos para trabajos',             'CGS', true,  'Cost of Goods Sold'),
  ('5.8',     'Seguro de la carga',                            'CGS', true,  'Cost of Goods Sold'),
  ('5.9',     'Manipuleo y almacenaje portuario',              'CGS', true,  'Cost of Goods Sold'),
  ('6',       'Gastos operativos',                             'G',   false, null),
  ('6.1',     'Combustible y lubricantes de flota propia',     'G',   true,  'Expenses'),
  ('6.2',     'Reparación y mantenimiento de vehículos',       'G',   true,  'Expenses'),
  ('6.3',     'Neumáticos',                                    'G',   true,  'Expenses'),
  ('6.4',     'Permisos, licencias y placas',                  'G',   true,  'Expenses'),
  ('6.5',     'Sueldos y salarios',                            'G',   false, 'Expenses'),
  ('6.5.1',   'Sueldos de choferes / operarios',               'G',   true,  'Expenses'),
  ('6.5.2',   'Sueldos administrativos',                       'G',   true,  'Expenses'),
  ('6.5.3',   'Cargas sociales / impuestos de nómina',         'G',   true,  'Expenses'),
  ('6.6',     'Seguros',                                       'G',   false, 'Expenses'),
  ('6.6.1',   'Seguro de flota / responsabilidad',             'G',   true,  'Expenses'),
  ('6.6.2',   'Seguro general / RC',                           'G',   true,  'Expenses'),
  ('6.7',     'Alquiler de local / almacén',                   'G',   true,  'Expenses'),
  ('6.8',     'Servicios públicos',                            'G',   true,  'Expenses'),
  ('6.9',     'Honorarios profesionales',                      'G',   true,  'Expenses'),
  ('6.10',    'Comisiones bancarias y de procesador',          'G',   true,  'Expenses'),
  ('6.11',    'Publicidad y marketing',                        'G',   true,  'Expenses'),
  ('6.12',    'Telecomunicaciones e internet',                 'G',   true,  'Expenses'),
  ('6.13',    'Suministros de oficina',                        'G',   true,  'Expenses'),
  ('6.14',    'Viáticos y viajes',                             'G',   true,  'Expenses'),
  ('6.15',    'Viáticos de chofer / per diem',                 'G',   true,  'Expenses'),
  ('6.16',    'Comisiones a vendedores',                       'G',   true,  'Expenses'),
  ('6.17',    'Depreciación de flota y equipos',               'G',   true,  'Other Expense'),
  ('6.18',    'Intereses de préstamos',                        'G',   true,  'Other Expense'),
  ('6.19',    'Diferencia en cambio',                          'G',   true,  'Other Expense'),
  ('6.99',    'Gastos varios / no categorizados',              'G',   true,  'Expenses')
) as x(code, name, type, is_postable, qbo_type)
where t.slug = 'dtd'
on conflict (tenant_id, code) do nothing;

-- Paso 2: resolver parent_id por prefijo del code (parent = code sin el
-- último segmento). Solo para las filas del tenant dtd que aún no lo tienen.
update public.accounts child
set parent_id = parent.id
from public.accounts parent, public.tenants t
where t.slug = 'dtd'
  and child.tenant_id = t.id
  and parent.tenant_id = t.id
  and child.parent_id is null
  and position('.' in child.code) > 0
  and parent.code = left(child.code, length(child.code) - position('.' in reverse(child.code)));

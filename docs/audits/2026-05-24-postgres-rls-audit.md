# Postgres + RLS audit — 2026-05-24

**Reviewer:** Claude (con skill `supabase-postgres-best-practices` v1.1.1 oficial)
**Scope:** 11 migraciones + 9 query files del Studio (`supabase/migrations/*` + `lib/studio/*-queries.ts`)
**Branch:** main, commit `fb1d85f`
**Tablas auditadas:** 19 (5 catálogo global + 14 multi-tenant con RLS)

---

## Resumen ejecutivo

| Severidad | Findings | Acción recomendada |
|---|---|---|
| 🔴 CRITICAL | 1 | Migración drop-in inmediata |
| 🟠 HIGH | 2 | Migración drop-in pre-Sprint 4 |
| 🟡 MEDIUM | 3 | Backlog (no urgente, escala con tamaño) |
| 🟢 LOW / Info | 4 | Documentar, no fixear |
| ✅ Strengths | 8 | Mantener patrones |

**Bottom line:** El schema está **sólidamente diseñado** — partial indexes correctos, soft delete consistente, multi-tenant con helper function, RPCs atómicos para correlativos, cascade triggers bien hechos. Los findings son afinaciones, no rediseños.

**Single biggest win** — wrappear `auth.uid()` y `get_user_tenant_id()` en `(select ...)` dentro de TODAS las RLS policies. 2-10× speedup en queries que escanean rows. Fix de 1 migración + ~30 líneas.

---

## 🔴 CRITICAL

### FINDING-001 — RPCs de correlativo no validan que el caller pertenezca al tenant

**Reference:** `security-rls-basics.md` + Supabase docs (security definer best practices)

Las 7 funciones `next_*_code(p_tenant_id uuid)` reciben un tenant_id como parámetro y devuelven el siguiente código sin verificar que el usuario autenticado pertenezca a ese tenant. Como son `security definer`, **bypasean RLS**.

**Funciones afectadas:**
- `next_markbox(p_tenant_id)` — [0006:39](../../supabase/migrations/0006_clients.sql)
- `next_quote_code(p_tenant_id)` — [0007:51](../../supabase/migrations/0007_quotes.sql)
- `next_receipt_code(p_tenant_id)` — [0008:150](../../supabase/migrations/0008_warehouses_cn.sql)
- `next_orphan_code(p_tenant_id)` — [0008:176](../../supabase/migrations/0008_warehouses_cn.sql)
- `next_dua_code(p_tenant_id)` — [0010:122](../../supabase/migrations/0010_customs_seniat.sql)
- `next_route_code(p_tenant_id)` — [0011:172](../../supabase/migrations/0011_tms_schema.sql)
- `next_incident_code(p_tenant_id)` — [0011:193](../../supabase/migrations/0011_tms_schema.sql)

**Impacto:** un usuario autenticado del tenant A puede llamar `select next_markbox('<tenant-B-uuid>')` y enumerar contadores de tenant B. NO es un data leak crítico (solo correlativos siguientes), pero es enumeration leak.

**Fix:** agregar guard inicial en cada función:

```sql
if p_tenant_id is null or p_tenant_id <> public.get_user_tenant_id() then
  raise exception 'Tenant mismatch: caller does not belong to tenant %', p_tenant_id;
end if;
```

Ver migración propuesta en sección final.

---

## 🟠 HIGH

### FINDING-002 — Policies usan `get_user_tenant_id()` sin envolver en SELECT

**Reference:** `security-rls-performance.md` (impacto 5-10× declarado por Supabase)

Todas las 16 policies del Studio invocan `public.get_user_tenant_id()` directamente. Aunque la función está marcada `stable` y devuelve un escalar, Postgres **no garantiza** caching dentro de la query sin el SELECT wrap explícito.

**Pattern incorrecto (actual):**
```sql
create policy "shipments by tenant"
  on public.shipments for all to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());
```

**Pattern correcto (recomendado):**
```sql
create policy "shipments by tenant"
  on public.shipments for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null)
  with check (tenant_id = (select public.get_user_tenant_id()));
```

**Impacto:** con 100K+ rows, queries que escanean mucha data ven 2-10× speedup. Con la data actual (~6 clientes, decenas de shipments) es invisible. Pre-Sprint 4 Finanzas (donde habrá reportes con agregaciones) vale fixearlo.

**Aplica a:** 16 policies en 7 migraciones.

### FINDING-003 — `get_user_tenant_id()` interna también sin SELECT wrap

**Reference:** `security-rls-performance.md`

[migration 0001_init_tenancy.sql:43](../../supabase/migrations/0001_init_tenancy.sql)

```sql
create or replace function public.get_user_tenant_id()
returns uuid language sql stable security definer set search_path = public
as $$
  select tenant_id
  from public.user_tenants
  where user_id = auth.uid()    -- ❌ debería ser (select auth.uid())
  limit 1;
$$;
```

**Fix:** wrappear `auth.uid()` igualmente:

```sql
where user_id = (select auth.uid())
```

Aunque la función ya devuelve un escalar (que será cached por la SELECT wrapper de las policies si aplicamos FINDING-002), esto añade robustez si alguien usa la función fuera de policies.

---

## 🟡 MEDIUM

### FINDING-004 — 12 FKs sin índice dedicado

**Reference:** `schema-foreign-key-indexes.md` (impacto 10-100× en JOIN + CASCADE)

Postgres no auto-indexea FK columns. Cada FK sin índice:
- Hace sequential scan en JOIN
- Bloquea la tabla padre en `ON DELETE CASCADE` / `SET NULL`

**FKs faltantes (priorizados):**

| Tabla | FK | Referencia | `ON DELETE` | Prioridad |
|---|---|---|---|---|
| `shipment_events` | `created_by` | `auth.users(id)` | (no cascade) | LOW |
| `quotes` | `rate_used_id` | `rates(id)` | `set null` | MED |
| `quotes` | `converted_to_shipment_id` | `shipments(id)` | `set null` | MED |
| `warehouse_receipts_cn` | `shipment_id` | `shipments(id)` | `set null` | MED |
| `warehouse_receipt_items` | `tenant_id` | `tenants(id)` | `cascade` | LOW (cascade tenant es raro) |
| `warehouse_receipt_events` | `tenant_id` | `tenants(id)` | `cascade` | LOW |
| `warehouse_receipt_events` | `created_by` | `auth.users(id)` | (no cascade) | LOW |
| `customs_documents` | `tenant_id` | `tenants(id)` | `cascade` | LOW |
| `customs_documents` | `uploaded_by` | `auth.users(id)` | (no cascade) | LOW |
| `tms_trucks` | `driver_id` | `tms_drivers(id)` | `set null` | MED (driver borrado dispara update en tabla flota) |
| `tms_routes` | `driver_id` | `tms_drivers(id)` | `set null` | MED |
| `tms_incidents` | `route_id` | `tms_routes(id)` | `set null` | MED |

Las marcadas MED son las que más se benefician.

### FINDING-005 — `getOperationalCounts()` trae TODAS las rows para contar

**Reference:** `data-n-plus-one.md` / `query-missing-indexes.md` (no es N+1 exacto, es "trae todo para agregar en app")

[lib/studio/dashboard-queries.ts:32](../../lib/studio/dashboard-queries.ts)

```ts
const { data } = await supabase.from("shipments").select("status");
// itera en JS para contar por estado
```

Esto trae **todos los shipments del tenant** (sin límite) y los cuenta en TypeScript. Con la data actual son pocos rows, pero crece linealmente.

**Fix recomendado:** RPC SQL con agregación o múltiples queries `count: exact, head: true` paralelos:

```sql
create or replace function public.shipments_dashboard_counts()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'enTransito', count(*) filter (where status in ('shipped','in_transit','last_mile','out_for_delivery')),
    'enAduana',   count(*) filter (where status = 'in_customs'),
    'entregados', count(*) filter (where status = 'delivered'),
    'conAlerta',  count(*) filter (where status in ('exception','delayed_warehouse')),
    'total',      count(*)
  )
  from public.shipments
  where tenant_id = (select public.get_user_tenant_id())
    and deleted_at is null;
$$;
```

**Beneficio:** 1 query con agregación SQL vs trayendo 100/1K/10K rows + loop JS. Postgres usa el index `shipments_tenant_status_idx` para todos los counts.

### FINDING-006 — Search con `.ilike("%X%")` en 6 columnas sin trigram index

**Reference:** `advanced-full-text-search.md` + `query-index-types.md`

[lib/studio/shipment-queries.ts:91-98](../../lib/studio/shipment-queries.ts)

```ts
const orConditions = [
  `code.ilike.%${q}%`,
  `client_name.ilike.%${q}%`,
  `client_markbox.ilike.%${q}%`,
  `origin.ilike.%${q}%`,
  `destination.ilike.%${q}%`,
  `notes.ilike.%${q}%`,
];
```

LIKE con `%` al inicio NO usa B-tree indexes. Cada columna hace seq scan. Con 1K shipments es OK; con 100K es lento.

**Fix futuro (no urgente):**

```sql
create extension if not exists pg_trgm;

create index shipments_code_trgm_idx
  on public.shipments using gin (code gin_trgm_ops) where deleted_at is null;
create index shipments_client_name_trgm_idx
  on public.shipments using gin (client_name gin_trgm_ops) where deleted_at is null;
-- repetir para las 6 columnas
```

Defer hasta que sea bottleneck observable.

---

## 🟢 LOW / Info

### FINDING-007 — `tms_incidents` sin `deleted_at`

[0011_tms_schema.sql:143-157](../../supabase/migrations/0011_tms_schema.sql)

Rompe el patrón de soft delete consistente del resto. Probablemente intencional (incidencias son audit log, no se borran) — pero la policy `for all` permite DELETE físico. Vale documentar o sumar `deleted_at` por consistencia.

### FINDING-008 — `warehouses_cn` policy abierta a todos los autenticados

Policy: `using (active = true)` sin filtro de tenant. **Intencional** según comment: catálogo global compartido. OK, pero documentar.

### FINDING-009 — `quotes.client_markbox` lookup textual sin FK

[0007_quotes.sql:13](../../supabase/migrations/0007_quotes.sql)

Sin FK a `clients(markbox)`. Intencional según comment ("lookup textual (no FK)") — quotes pueden referenciar clientes aún no catalogados. Hay índice composite (`quotes_tenant_client_idx`) que ayuda al lookup. OK.

### FINDING-010 — Composite indexes no son covering

Indexes como `(tenant_id, status)` no incluyen columnas adicionales con `INCLUDE`. Para SELECTs frecuentes que devuelven muchas columnas, Postgres hace Index Scan + heap lookup.

**Reference:** `query-covering-indexes.md`

Defer — premature optimization para volumen actual.

---

## ✅ Strengths (mantener patrones)

1. **Partial indexes con `where deleted_at is null`** en todas las tablas soft-delete → indexes 5-20× más pequeños y rápidos
2. **Composite indexes liderados por `tenant_id`** → óptimo para multi-tenant RLS
3. **FK indexes implícitos via composite indexes** (ej. `(tenant_id, shipment_id, occurred_at desc)`) → cubren el lookup FK + el use case real
4. **Soft delete consistente** con `deleted_at timestamptz` + cascade triggers
5. **`unique (tenant_id, code)` constraints** previenen colisiones de correlativos
6. **RPCs atómicas para correlativos** con `max(regexp_match(...))+1` → tolera huecos, evita race conditions
7. **Catálogos globales sin `tenant_id`** (`warehouses_cn`, `customs_agents`) → modelo correcto cuando data es compartida
8. **Triggers `before update` con `touch_updated_at()`** centralizados → reuso correcto, single source of truth

---

## Migración propuesta (drop-in)

Si decidís aplicar los fixes 1-3 (CRITICAL + HIGH), abajo está la migración completa. NO se aplica automáticamente — sólo si vos confirmás.

```sql
-- supabase/migrations/0012_rls_perf_and_rpc_guards.sql
-- Audit fixes 2026-05-24 (DTD-ERPv1-DIA3 audit):
--   1. RPCs de correlativo validan que p_tenant_id coincida con el caller (FINDING-001)
--   2. RLS policies usan (select get_user_tenant_id()) para caching (FINDING-002)
--   3. get_user_tenant_id() usa (select auth.uid()) internamente (FINDING-003)
-- Drop-in: solo reemplaza definiciones, no toca data.

-- ─── 1. get_user_tenant_id() con SELECT wrap interno ───
create or replace function public.get_user_tenant_id()
returns uuid language sql stable security definer set search_path = public
as $$
  select tenant_id
  from public.user_tenants
  where user_id = (select auth.uid())
  limit 1;
$$;

-- ─── 2. Guard genérico para RPCs (tenant check) ───
create or replace function public.assert_tenant_match(p_tenant_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_tenant_id is null or p_tenant_id <> public.get_user_tenant_id() then
    raise exception 'Tenant mismatch: caller does not belong to tenant %', p_tenant_id
      using errcode = '42501';
  end if;
end;
$$;
revoke execute on function public.assert_tenant_match(uuid) from public;
grant execute on function public.assert_tenant_match(uuid) to authenticated;

-- ─── 3. RPCs de correlativo con guard ───
-- next_markbox
create or replace function public.next_markbox(p_tenant_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_max int; v_padded text;
begin
  perform public.assert_tenant_match(p_tenant_id);
  select coalesce(max((regexp_match(markbox, '^DTD-(\d+)$'))[1]::int), 0) + 1
  into v_max from public.clients where tenant_id = p_tenant_id;
  v_padded := lpad(v_max::text, 4, '0');
  return 'DTD-' || v_padded;
end; $$;

-- next_quote_code
create or replace function public.next_quote_code(p_tenant_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_year int := extract(year from current_date); v_max int; v_padded text;
begin
  perform public.assert_tenant_match(p_tenant_id);
  select coalesce(max((regexp_match(quote_code, '^Q-\d{4}-(\d+)$'))[1]::int), 0) + 1
  into v_max from public.quotes
  where tenant_id = p_tenant_id and quote_code like 'Q-' || v_year || '-%';
  v_padded := lpad(v_max::text, 4, '0');
  return 'Q-' || v_year || '-' || v_padded;
end; $$;

-- next_receipt_code
create or replace function public.next_receipt_code(p_tenant_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_year int := extract(year from current_date); v_max int; v_padded text;
begin
  perform public.assert_tenant_match(p_tenant_id);
  select coalesce(max((regexp_match(receipt_code, '^WR-\d{4}-(\d+)$'))[1]::int), 0) + 1
  into v_max from public.warehouse_receipts_cn
  where tenant_id = p_tenant_id and receipt_code like 'WR-' || v_year || '-%';
  v_padded := lpad(v_max::text, 4, '0');
  return 'WR-' || v_year || '-' || v_padded;
end; $$;

-- next_orphan_code
create or replace function public.next_orphan_code(p_tenant_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_max int; v_padded text;
begin
  perform public.assert_tenant_match(p_tenant_id);
  select coalesce(max((regexp_match(receipt_code, '^SIN-CODIGO-(\d+)$'))[1]::int), 0) + 1
  into v_max from public.warehouse_receipts_cn
  where tenant_id = p_tenant_id and receipt_code like 'SIN-CODIGO-%';
  v_padded := lpad(v_max::text, 4, '0');
  return 'SIN-CODIGO-' || v_padded;
end; $$;

-- next_dua_code
create or replace function public.next_dua_code(p_tenant_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_year int := extract(year from current_date); v_max int; v_padded text;
begin
  perform public.assert_tenant_match(p_tenant_id);
  select coalesce(max((regexp_match(dua_code, '^DUA-VE-\d{4}-(\d+)$'))[1]::int), 0) + 1
  into v_max from public.customs_filings
  where tenant_id = p_tenant_id and dua_code like 'DUA-VE-' || v_year || '-%';
  v_padded := lpad(v_max::text, 6, '0');
  return 'DUA-VE-' || v_year || '-' || v_padded;
end; $$;

-- next_route_code
create or replace function public.next_route_code(p_tenant_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_year int := extract(year from current_date); v_max int; v_padded text;
begin
  perform public.assert_tenant_match(p_tenant_id);
  select coalesce(max((regexp_match(route_code, '^R-\d{4}-(\d+)$'))[1]::int), 0) + 1
  into v_max from public.tms_routes
  where tenant_id = p_tenant_id and route_code like 'R-' || v_year || '-%';
  v_padded := lpad(v_max::text, 4, '0');
  return 'R-' || v_year || '-' || v_padded;
end; $$;

-- next_incident_code
create or replace function public.next_incident_code(p_tenant_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_year int := extract(year from current_date); v_max int; v_padded text;
begin
  perform public.assert_tenant_match(p_tenant_id);
  select coalesce(max((regexp_match(incident_code, '^I-\d{4}-(\d+)$'))[1]::int), 0) + 1
  into v_max from public.tms_incidents
  where tenant_id = p_tenant_id and incident_code like 'I-' || v_year || '-%';
  v_padded := lpad(v_max::text, 4, '0');
  return 'I-' || v_year || '-' || v_padded;
end; $$;

-- ─── 4. RLS policies con SELECT wrap (16 policies) ───
-- shipments
drop policy if exists "shipments by tenant" on public.shipments;
create policy "shipments by tenant" on public.shipments for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null)
  with check (tenant_id = (select public.get_user_tenant_id()));

-- shipment_events
drop policy if exists "shipment_events by tenant" on public.shipment_events;
create policy "shipment_events by tenant" on public.shipment_events for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null)
  with check (tenant_id = (select public.get_user_tenant_id()));

-- rates
drop policy if exists "rates by tenant" on public.rates;
create policy "rates by tenant" on public.rates for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null)
  with check (tenant_id = (select public.get_user_tenant_id()));

-- clients
drop policy if exists "clients by tenant" on public.clients;
create policy "clients by tenant" on public.clients for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null)
  with check (tenant_id = (select public.get_user_tenant_id()));

-- quotes
drop policy if exists "quotes by tenant" on public.quotes;
create policy "quotes by tenant" on public.quotes for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null)
  with check (tenant_id = (select public.get_user_tenant_id()));

-- warehouse_receipts_cn
drop policy if exists "warehouse_receipts_cn by tenant" on public.warehouse_receipts_cn;
create policy "warehouse_receipts_cn by tenant" on public.warehouse_receipts_cn for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null)
  with check (tenant_id = (select public.get_user_tenant_id()));

-- warehouse_receipt_items
drop policy if exists "warehouse_receipt_items by tenant" on public.warehouse_receipt_items;
create policy "warehouse_receipt_items by tenant" on public.warehouse_receipt_items for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()))
  with check (tenant_id = (select public.get_user_tenant_id()));

-- warehouse_receipt_events
drop policy if exists "warehouse_receipt_events by tenant" on public.warehouse_receipt_events;
create policy "warehouse_receipt_events by tenant" on public.warehouse_receipt_events for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null)
  with check (tenant_id = (select public.get_user_tenant_id()));

-- customs_filings
drop policy if exists "customs_filings by tenant" on public.customs_filings;
create policy "customs_filings by tenant" on public.customs_filings for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null)
  with check (tenant_id = (select public.get_user_tenant_id()));

-- customs_documents
drop policy if exists "customs_documents by tenant" on public.customs_documents;
create policy "customs_documents by tenant" on public.customs_documents for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()))
  with check (tenant_id = (select public.get_user_tenant_id()));

-- tms_drivers
drop policy if exists "tms_drivers by tenant" on public.tms_drivers;
create policy "tms_drivers by tenant" on public.tms_drivers for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null)
  with check (tenant_id = (select public.get_user_tenant_id()));

-- tms_trucks
drop policy if exists "tms_trucks by tenant" on public.tms_trucks;
create policy "tms_trucks by tenant" on public.tms_trucks for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null)
  with check (tenant_id = (select public.get_user_tenant_id()));

-- tms_routes
drop policy if exists "tms_routes by tenant" on public.tms_routes;
create policy "tms_routes by tenant" on public.tms_routes for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null)
  with check (tenant_id = (select public.get_user_tenant_id()));

-- tms_incidents
drop policy if exists "tms_incidents by tenant" on public.tms_incidents;
create policy "tms_incidents by tenant" on public.tms_incidents for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()))
  with check (tenant_id = (select public.get_user_tenant_id()));

-- tenants + user_tenants (las únicas que usan auth.uid() directo, no get_user_tenant_id)
drop policy if exists "users see their tenant" on public.tenants;
create policy "users see their tenant" on public.tenants for select to authenticated
  using (id = (select public.get_user_tenant_id()));

drop policy if exists "users see their own user_tenants" on public.user_tenants;
create policy "users see their own user_tenants" on public.user_tenants for select to authenticated
  using (user_id = (select auth.uid()));
```

**Líneas:** ~150. Drop-in seguro (no toca data, solo reemplaza definiciones). Reversible (las definiciones viejas están en las migraciones originales).

---

## Recomendaciones

| # | Cuándo | Qué |
|---|---|---|
| 1 | **Ahora** (antes Sprint 4) | Aplicar migración 0012 con FINDING-001 + 002 + 003 |
| 2 | **Sprint 4 inicio** | FINDING-005 — RPC `shipments_dashboard_counts()` para reemplazar el loop JS |
| 3 | **Sprint 4 / 5** | FINDING-004 — agregar FK indexes a los 5 MED (driver_id, route_id, shipment_id de quotes y warehouse) |
| 4 | **Cuando search se vea lento** | FINDING-006 — `pg_trgm` extension + gin indexes |
| 5 | **Si crece tabla single >100K** | FINDING-010 — covering indexes con `INCLUDE` |
| Skip | — | FINDING-007 (tms_incidents soft delete), 008 (warehouses policy), 009 (markbox text lookup) — todos intencionales |

---

## Cómo verificar después de aplicar la migración

```sql
-- 1. Verificar que get_user_tenant_id devuelve OK
select public.get_user_tenant_id();  -- debe devolver tu tenant_id

-- 2. Probar guard (debe fallar)
select public.next_markbox('00000000-0000-0000-0000-000000000000'::uuid);
-- Expected: ERROR: Tenant mismatch...

-- 3. Probar normal (debe devolver el siguiente DTD-NNNN)
select public.next_markbox(public.get_user_tenant_id());

-- 4. Verificar que policies usan SELECT wrap (debería decir SubPlan)
explain (analyze, buffers)
  select * from public.shipments limit 10;
-- Buscar en el plan: "InitPlan" o "SubPlan" → confirma caching
```

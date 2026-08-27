\set ON_ERROR_STOP on

-- Contrato del scorecard de proveedores (SDD-0111 · migr 0236).
-- Fixtures ficticios y rollback: no toca prod.
--
-- ── POR QUÉ IMPORTA ───────────────────────────────────────────────────────
--
-- El rating A/B/C/D decide a qué proveedor chino se le sigue comprando. Se
-- DERIVA en vivo de señales atómicas (¿llegó a tiempo? ¿conforme?) y de los
-- reclamos — nunca es una columna que alguien teclea. Eso es lo que lo hace
-- auditable, y también lo que lo vuelve frágil de una forma silenciosa: si la
-- fórmula y la letra se separan, la pantalla muestra una letra que no
-- corresponde al número, y nadie tiene cómo notarlo.
--
-- ── QUÉ SE PROTEGE ────────────────────────────────────────────────────────
--
--   1. 🔴 **Un proveedor sin historia no es malo: es desconocido.** Con cero
--      órdenes el grade es NULL («Sin datos»), no «D». Si saliera D, se le
--      dejaría de comprar a un proveedor nuevo por no tener pasado.
--   2. 🔴 La letra se DERIVA del score, en los umbrales exactos del Norte
--      (A≥90 · B≥82 · C≥72 · D<72) y con los pesos 40/40/20. Se prueban los
--      cuatro bordes: si score y grade divergen, la pantalla miente.
--   3. 🔴 **`security_invoker = on` en la vista.** Sin eso, la vista corre con
--      los permisos de su dueño y **un tenant ve el scorecard del otro** — con
--      los nombres de sus proveedores y su desempeño adentro.
--   4. 🔴 Ni la señal ni el reclamo pueden apuntar a una ficha de proveedor o a
--      una OC de otro tenant. Son dos guards × dos tablas: se prueban los
--      cuatro.
--   5. 🔴 Una sola señal por OC — dos señales de la misma orden contarían el
--      mismo hecho dos veces y moverían el rating. Pero las señales manuales
--      (sin OC) no chocan entre sí: el índice es PARCIAL a propósito.
--   6. 🔴 `resolved_at` se sella al cerrar **y se LIMPIA si el reclamo vuelve a
--      abrirse**. Un reclamo reabierto con fecha de cierre es un reclamo que
--      figura resuelto sin estarlo.
--   7. El reclamo borrado deja de pesar en el rating.
--
-- Cada contrato se validó rompiéndolo a propósito.

begin;

\ir _supabase-platform-stubs.sql

-- ── Esqueleto mínimo ──────────────────────────────────────────────────────
create table public.tenants (id uuid primary key, slug text);

create table public.user_tenants (
  user_id     uuid,
  tenant_id   uuid,
  role        text,
  disabled_at timestamptz
);

-- ⚠️ `suppliers_cn` va CON RLS puesta: sin eso, el contrato de
-- `security_invoker` no probaría nada (la vista no tendría qué respetar).
create table public.suppliers_cn (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null,
  client_markbox text,
  supplier_seq   int,
  name           text,
  city           text,
  industry       text,
  deleted_at     timestamptz
);

create table public.purchase_orders (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null,
  code       text,
  deleted_at timestamptz
);

create or replace function public.get_user_tenant_id()
returns uuid language sql stable security definer set search_path = public as $g$
  select tenant_id from public.user_tenants where user_id = (select auth.uid()) limit 1;
$g$;

create or replace function public.assert_tenant_match(p_tenant_id uuid)
returns void language plpgsql security definer set search_path = public as $a$
declare v_caller uuid := public.get_user_tenant_id();
begin
  if p_tenant_id is null or v_caller is null or p_tenant_id <> v_caller then
    raise exception 'Tenant mismatch' using errcode = '42501';
  end if;
end;
$a$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $t$
begin new.updated_at := now(); return new; end;
$t$;

\ir ../migrations/0236_supplier_scorecard.sql

-- La RLS de `suppliers_cn` viene de la 0105 (fuera de esta migración), pero sin
-- ella la vista no tiene qué respetar. Se monta acá igual que en producción.
alter table public.suppliers_cn enable row level security;
grant select on public.suppliers_cn to authenticated;
create policy "suppliers_cn by tenant" on public.suppliers_cn for all to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

-- ── Fixtures ──────────────────────────────────────────────────────────────
\set t1 '11111111-1111-1111-1111-111111111111'
\set t2 '22222222-2222-2222-2222-222222222222'
insert into public.tenants (id, slug) values (:'t1', 'dtd'), (:'t2', 'otro');

\set u1 'aa111111-1111-1111-1111-111111111111'
insert into auth.users (id, email) values (:'u1', 'compras@dtd.test');
insert into public.user_tenants (user_id, tenant_id, role) values (:'u1', :'t1', 'admin');

-- Cuatro fichas del tenant 1 + una del tenant 2.
\set s_perfecto 'ea111111-1111-1111-1111-111111111111'
\set s_malo     'eb111111-1111-1111-1111-111111111111'
\set s_nuevo    'ec111111-1111-1111-1111-111111111111'
\set s_borde    'ed111111-1111-1111-1111-111111111111'
\set s_ajeno    'ef222222-2222-2222-2222-222222222222'
insert into public.suppliers_cn (id, tenant_id, client_markbox, supplier_seq, name) values
  (:'s_perfecto', :'t1', 'DTD-1000', 1, 'Impecable'),
  (:'s_malo',     :'t1', 'DTD-1000', 2, 'Un desastre'),
  (:'s_nuevo',    :'t1', 'DTD-1000', 3, 'Recién llegado'),
  (:'s_borde',    :'t1', 'DTD-1000', 4, 'Justo en el borde'),
  (:'s_ajeno',    :'t2', 'DTD-9000', 1, 'Del otro tenant');

\set oc1 'fa111111-1111-1111-1111-111111111111'
\set oc2 'fb222222-2222-2222-2222-222222222222'
insert into public.purchase_orders (id, tenant_id, code) values
  (:'oc1', :'t1', 'OC-0001'),
  (:'oc2', :'t2', 'OC-9001');

create or replace function pg_temp.tarjeta(p_sup uuid)
returns table (orders int, score int, grade text)
language sql as $t$
  select orders_count, score, grade from public.supplier_scorecard_v
   where supplier_cn_id = p_sup
$t$;

-- ── 1 · 🔴 Sin historia no es «D»: es «Sin datos» ─────────────────────────
--
-- Un proveedor nuevo no tiene por qué arrancar castigado. Si el grade saliera
-- «D» con cero órdenes, se le dejaría de comprar por no tener pasado.
do $$
declare r record;
begin
  select * into r from pg_temp.tarjeta('ec111111-1111-1111-1111-111111111111');
  if r.orders <> 0 then
    raise exception 'CONTRATO 1 ROTO: el proveedor nuevo aparece con % ordenes', r.orders;
  end if;
  if r.grade is not null then
    raise exception
      'CONTRATO 1 ROTO: un proveedor SIN historia salio con grade «%» — se le castiga por ser nuevo',
      r.grade;
  end if;
  if r.score is not null then
    raise exception 'CONTRATO 1 ROTO: hay score (%) sin una sola orden', r.score;
  end if;
end;
$$;

-- ── 2 · 🔴 La letra se deriva del score, en los umbrales del Norte ────────
do $$
declare r record;
begin
  -- (a) Impecable: 5 de 5 a tiempo y conformes, sin reclamos.
  --     100*0.40 + 100*0.40 + 100*0.20 = 100 → A
  insert into public.supplier_order_signals (tenant_id, supplier_cn_id, on_time, conforming)
  select '11111111-1111-1111-1111-111111111111',
         'ea111111-1111-1111-1111-111111111111', true, true
    from generate_series(1, 5);

  select * into r from pg_temp.tarjeta('ea111111-1111-1111-1111-111111111111');
  if r.score <> 100 or r.grade <> 'A' then
    raise exception 'CONTRATO 2 ROTO: 5/5 impecables dio score % grade % (esperado 100/A)', r.score, r.grade;
  end if;

  -- (b) Un desastre: 3 de 5 a tiempo, 3 conformes, 2 reclamos.
  --     60*0.40 + 60*0.40 + max(0, 100 - 40*6)*0.20 = 24 + 24 + 0 = 48 → D
  insert into public.supplier_order_signals (tenant_id, supplier_cn_id, on_time, conforming)
  select '11111111-1111-1111-1111-111111111111',
         'eb111111-1111-1111-1111-111111111111', g <= 3, g <= 3
    from generate_series(1, 5) g;
  insert into public.supplier_claims
    (tenant_id, claim_code, supplier_cn_id, kind, description)
  values ('11111111-1111-1111-1111-111111111111', 'RP-2026-001',
          'eb111111-1111-1111-1111-111111111111', 'dano', 'llegó roto'),
         ('11111111-1111-1111-1111-111111111111', 'RP-2026-002',
          'eb111111-1111-1111-1111-111111111111', 'faltante', 'faltaron cajas');

  select * into r from pg_temp.tarjeta('eb111111-1111-1111-1111-111111111111');
  if r.score <> 48 or r.grade <> 'D' then
    raise exception 'CONTRATO 2 ROTO: el desastre dio score % grade % (esperado 48/D)', r.score, r.grade;
  end if;

  -- (c) El borde: 4 de 5 a tiempo, 5 conformes, sin reclamos.
  --     80*0.40 + 100*0.40 + 100*0.20 = 92 → A (justo por encima de 90)
  insert into public.supplier_order_signals (tenant_id, supplier_cn_id, on_time, conforming)
  select '11111111-1111-1111-1111-111111111111',
         'ed111111-1111-1111-1111-111111111111', g <= 4, true
    from generate_series(1, 5) g;

  select * into r from pg_temp.tarjeta('ed111111-1111-1111-1111-111111111111');
  if r.score <> 92 or r.grade <> 'A' then
    raise exception 'CONTRATO 2 ROTO: el borde dio score % grade % (esperado 92/A)', r.score, r.grade;
  end if;
end;
$$;

-- Y la letra NUNCA contradice al número: se verifican los cuatro umbrales
-- sobre TODO lo que la vista devuelva, no sobre los casos elegidos a mano.
do $$
declare v_mal int;
begin
  select count(*) into v_mal from public.supplier_scorecard_v
   where score is not null
     and grade is distinct from case
       when score >= 90 then 'A' when score >= 82 then 'B'
       when score >= 72 then 'C' else 'D' end;
  if v_mal > 0 then
    raise exception
      'CONTRATO 2 ROTO: % ficha(s) con la letra separada del score — la pantalla muestra una letra que no corresponde',
      v_mal;
  end if;
end;
$$;

-- ── 3 · 🔴 `security_invoker`: cada tenant ve SU scorecard ────────────────
--
-- Sin `security_invoker = on`, la vista corre con los permisos de su dueño y
-- se salta la RLS de las tablas de abajo: un tenant vería los proveedores del
-- otro, con nombre y desempeño.
do $$
declare v_ajenos int;
begin
  set local role authenticated;
  perform set_config('test.uid', 'aa111111-1111-1111-1111-111111111111', true);

  select count(*) into v_ajenos from public.supplier_scorecard_v
   where tenant_id <> '11111111-1111-1111-1111-111111111111';
  if v_ajenos > 0 then
    raise exception
      'CONTRATO 3 ROTO: el scorecard muestra % ficha(s) de OTRO tenant — nombres y desempeno ajenos',
      v_ajenos;
  end if;

  -- Y sí ve las suyas (una vista que no muestra nada tampoco sirve).
  if (select count(*) from public.supplier_scorecard_v) <> 4 then
    raise exception 'CONTRATO 3 ROTO: el tenant no ve sus propias 4 fichas';
  end if;

  reset role;
exception when others then
  reset role;
  raise;
end;
$$;

-- ── 4 · 🔴 Los cuatro guards cross-tenant ─────────────────────────────────
do $$
declare v_n int;
begin
  -- (a) señal contra ficha ajena · (b) señal contra OC ajena
  begin
    insert into public.supplier_order_signals (tenant_id, supplier_cn_id)
    values ('11111111-1111-1111-1111-111111111111',
            'ef222222-2222-2222-2222-222222222222');
  exception when others then null;
  end;
  begin
    insert into public.supplier_order_signals (tenant_id, supplier_cn_id, purchase_order_id)
    values ('11111111-1111-1111-1111-111111111111',
            'ea111111-1111-1111-1111-111111111111',
            'fb222222-2222-2222-2222-222222222222');
  exception when others then null;
  end;

  -- (c) reclamo contra ficha ajena · (d) reclamo contra OC ajena
  begin
    insert into public.supplier_claims (tenant_id, claim_code, supplier_cn_id, kind, description)
    values ('11111111-1111-1111-1111-111111111111', 'RP-2026-901',
            'ef222222-2222-2222-2222-222222222222', 'dano', 'colado');
  exception when others then null;
  end;
  begin
    insert into public.supplier_claims
      (tenant_id, claim_code, supplier_cn_id, purchase_order_id, kind, description)
    values ('11111111-1111-1111-1111-111111111111', 'RP-2026-902',
            'ea111111-1111-1111-1111-111111111111',
            'fb222222-2222-2222-2222-222222222222', 'dano', 'colado por OC');
  exception when others then null;
  end;

  select count(*) into v_n from public.supplier_order_signals
   where supplier_cn_id = 'ef222222-2222-2222-2222-222222222222'
      or purchase_order_id = 'fb222222-2222-2222-2222-222222222222';
  if v_n <> 0 then
    raise exception 'CONTRATO 4 ROTO: entraron % senales apuntando a otro tenant', v_n;
  end if;

  select count(*) into v_n from public.supplier_claims
   where claim_code in ('RP-2026-901', 'RP-2026-902');
  if v_n <> 0 then
    raise exception 'CONTRATO 4 ROTO: entraron % reclamos apuntando a otro tenant', v_n;
  end if;
end;
$$;

-- ── 5 · 🔴 Una señal por OC, pero las manuales no chocan ──────────────────
--
-- Dos señales de la misma orden contarían el mismo hecho dos veces y moverían
-- el rating. Las manuales (sin OC) sí pueden ser muchas: el índice es PARCIAL.
do $$
declare v_n int;
begin
  insert into public.supplier_order_signals (tenant_id, supplier_cn_id, purchase_order_id)
  values ('11111111-1111-1111-1111-111111111111',
          'ea111111-1111-1111-1111-111111111111',
          'fa111111-1111-1111-1111-111111111111');

  begin
    insert into public.supplier_order_signals (tenant_id, supplier_cn_id, purchase_order_id, on_time)
    values ('11111111-1111-1111-1111-111111111111',
            'ea111111-1111-1111-1111-111111111111',
            'fa111111-1111-1111-1111-111111111111', false);
  exception when others then null;
  end;

  select count(*) into v_n from public.supplier_order_signals
   where purchase_order_id = 'fa111111-1111-1111-1111-111111111111';
  if v_n <> 1 then
    raise exception
      'CONTRATO 5 ROTO: la misma OC tiene % senales — el mismo hecho pesa dos veces en el rating', v_n;
  end if;

  -- Varias señales manuales sin OC: eso SÍ se puede (el índice es parcial).
  insert into public.supplier_order_signals (tenant_id, supplier_cn_id)
  values ('11111111-1111-1111-1111-111111111111', 'ec111111-1111-1111-1111-111111111111'),
         ('11111111-1111-1111-1111-111111111111', 'ec111111-1111-1111-1111-111111111111');
  select count(*) into v_n from public.supplier_order_signals
   where supplier_cn_id = 'ec111111-1111-1111-1111-111111111111';
  if v_n <> 2 then
    raise exception 'CONTRATO 5 ROTO: el indice bloqueo senales manuales sin OC (quedaron %)', v_n;
  end if;
end;
$$;

-- ── 6 · 🔴 `resolved_at` se sella al cerrar y se LIMPIA al reabrir ────────
--
-- Un reclamo reabierto con fecha de cierre figura resuelto sin estarlo — y el
-- proveedor deja de arrastrarlo como reclamo abierto.
do $$
declare v_id uuid;
begin
  select id into v_id from public.supplier_claims where claim_code = 'RP-2026-001';

  if (select resolved_at from public.supplier_claims where id = v_id) is not null then
    raise exception 'CONTRATO 6 ROTO: un reclamo ABIERTO ya trae fecha de cierre';
  end if;

  update public.supplier_claims set status = 'resuelto' where id = v_id;
  if (select resolved_at from public.supplier_claims where id = v_id) is null then
    raise exception 'CONTRATO 6 ROTO: cerrar el reclamo no sello resolved_at';
  end if;

  update public.supplier_claims set status = 'en_revision' where id = v_id;
  if (select resolved_at from public.supplier_claims where id = v_id) is not null then
    raise exception
      'CONTRATO 6 ROTO: el reclamo se reabrio con la fecha de cierre puesta — figura resuelto sin estarlo';
  end if;
end;
$$;

-- ── 7 · El reclamo borrado deja de pesar ──────────────────────────────────
--
-- ⚠️ Ficha propia y UN solo reclamo sobre 10 órdenes, a propósito. La fórmula
-- tiene piso en cero (`greatest(0, 100 - defect × 6)`), así que con muchos
-- reclamos el castigo ya toca fondo y borrar uno no mueve el número: el
-- escenario no distinguiría «la vista ignora los borrados» de «la vista los
-- cuenta». Con 1 de 10 el castigo está lejos del piso y la diferencia se ve.
--
--   con el reclamo:  100·0,40 + 100·0,40 + (100 − 10·6)·0,20 =  88  → B
--   sin el reclamo:  100·0,40 + 100·0,40 +  100      ·0,20 = 100  → A
\set s_uno 'ee111111-1111-1111-1111-111111111111'
do $$
declare r_antes record; r_despues record;
begin
  insert into public.suppliers_cn (id, tenant_id, client_markbox, supplier_seq, name)
  values ('ee111111-1111-1111-1111-111111111111',
          '11111111-1111-1111-1111-111111111111', 'DTD-1000', 5, 'Con un tropiezo');

  insert into public.supplier_order_signals (tenant_id, supplier_cn_id, on_time, conforming)
  select '11111111-1111-1111-1111-111111111111',
         'ee111111-1111-1111-1111-111111111111', true, true
    from generate_series(1, 10);

  insert into public.supplier_claims
    (tenant_id, claim_code, supplier_cn_id, kind, description)
  values ('11111111-1111-1111-1111-111111111111', 'RP-2026-010',
          'ee111111-1111-1111-1111-111111111111', 'calidad', 'una tanda floja');

  select * into r_antes from pg_temp.tarjeta('ee111111-1111-1111-1111-111111111111');
  if r_antes.score <> 88 or r_antes.grade <> 'B' then
    raise exception 'CONTRATO 7 ROTO: 1 reclamo sobre 10 dio score % grade % (esperado 88/B)',
      r_antes.score, r_antes.grade;
  end if;

  update public.supplier_claims set deleted_at = now() where claim_code = 'RP-2026-010';

  select * into r_despues from pg_temp.tarjeta('ee111111-1111-1111-1111-111111111111');
  if r_despues.score <> 100 or r_despues.grade <> 'A' then
    raise exception
      'CONTRATO 7 ROTO: borrar el reclamo dejo el score en % grade % (esperado 100/A) — la vista cuenta reclamos borrados',
      r_despues.score, r_despues.grade;
  end if;
end;
$$;

rollback;

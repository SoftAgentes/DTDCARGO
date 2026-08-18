\set ON_ERROR_STOP on

-- Contrato desechable de la migración 0383 (SDD-0270 · vínculo cliente↔contacto).
--
-- Lo que vigila no es "¿vincula?" sino "¿se NIEGA a vincular cuando no está
-- seguro?". Un barrido que vincula de más estampa el Shipping Mark de otra
-- persona, y eso no se ve leyendo el código: se ve midiéndolo.
--
-- Carga la migración REAL con `\i`, no una copia del DDL: un contrato que
-- reimplementa lo que vigila deja de medir el archivo que se aplica.

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$roles$;

grant usage on schema public to anon, authenticated, service_role;

-- ── Fixtures: lo que la 0383 exige en su preflight ──────────────────────────
create table public.clients (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null,
  markbox          text,
  phone            text,
  kommo_contact_id bigint,
  deleted_at       timestamptz
);

-- Gemela de la 0363: el espejo YA trae la columna generada.
create table public.kommo_contacts (
  tenant_id    uuid   not null,
  id           bigint not null,
  phone        text,
  phone_last10 text generated always as (
    case
      when pg_catalog.length(
             pg_catalog.regexp_replace(coalesce(phone, ''), '\D', '', 'g')
           ) >= 10
      then pg_catalog."right"(
             pg_catalog.regexp_replace(coalesce(phone, ''), '\D', '', 'g'),
             10
           )
    end
  ) stored,
  primary key (tenant_id, id)
);

\i /sb/migrations/0383_clients_phone_last10_y_vinculo.sql


-- ═══ 1. La columna generada replica phoneKey() ══════════════════════════════
insert into public.clients (tenant_id, markbox, phone) values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'DTD-0001', '+58 412-1668021'),   -- formateado  → 4121668021
  ('11111111-1111-1111-1111-111111111111'::uuid, 'DTD-0002', '04121668022'),       -- 11 dígitos  → 4121668022
  ('11111111-1111-1111-1111-111111111111'::uuid, 'DTD-0003', '123456789'),         -- 9 dígitos   → NULL
  ('11111111-1111-1111-1111-111111111111'::uuid, 'DTD-0004', null),                -- sin teléfono→ NULL
  ('11111111-1111-1111-1111-111111111111'::uuid, 'DTD-0005', '');                  -- vacío       → NULL

do $$
begin
  if (select phone_last10 from public.clients where markbox = 'DTD-0001') <> '4121668021' then
    raise exception 'CASO 1a: el formateado no dio los ultimos 10 digitos';
  end if;
  if (select phone_last10 from public.clients where markbox = 'DTD-0002') <> '4121668022' then
    raise exception 'CASO 1b: 11 digitos deben dar los ultimos 10';
  end if;
  if (select phone_last10 from public.clients where markbox = 'DTD-0003') is not null then
    raise exception 'CASO 1c: con 9 digitos la clave DEBE ser NULL — un numero incompleto no se cruza';
  end if;
  if (select count(*) from public.clients
       where markbox in ('DTD-0004','DTD-0005') and phone_last10 is not null) > 0 then
    raise exception 'CASO 1d: sin telefono o vacio la clave DEBE ser NULL';
  end if;
end;
$$;

-- ═══ 2. En seco por default: informa y NO escribe ═══════════════════════════
insert into public.kommo_contacts (tenant_id, id, phone) values
  ('11111111-1111-1111-1111-111111111111'::uuid, 9001, '0412-1668021');   -- pareja de DTD-0001

do $$
declare r jsonb;
begin
  r := public.kommo_vincular_clientes_por_telefono('11111111-1111-1111-1111-111111111111'::uuid);   -- sin p_aplicar
  if (r->>'aplicado')::boolean then
    raise exception 'CASO 2a: la corrida por default NO puede reportarse como aplicada';
  end if;
  if (r->>'vinculables')::int <> 1 then
    raise exception 'CASO 2b: debia ver 1 vinculable, vio %', r->>'vinculables';
  end if;
  if (r->>'vinculados')::int <> 0 then
    raise exception 'CASO 2c: en seco no puede vincular nada, vinculo %', r->>'vinculados';
  end if;
  if (select kommo_contact_id from public.clients where markbox = 'DTD-0001') is not null then
    raise exception 'CASO 2d: LA CORRIDA EN SECO ESCRIBIO EN LA TABLA';
  end if;
end;
$$;

-- ═══ 3. Camino feliz: 1 cliente ↔ 1 contacto ════════════════════════════════
do $$
declare r jsonb;
begin
  r := public.kommo_vincular_clientes_por_telefono('11111111-1111-1111-1111-111111111111'::uuid, true);
  if (r->>'vinculados')::int <> 1 then
    raise exception 'CASO 3a: debia vincular 1, vinculo %', r->>'vinculados';
  end if;
  if (select kommo_contact_id from public.clients where markbox = 'DTD-0001') <> 9001 then
    raise exception 'CASO 3b: DTD-0001 debia quedar vinculado al contacto 9001';
  end if;
end;
$$;

-- ═══ 4. Un contacto YA usado no se reutiliza ════════════════════════════════
-- Otro cliente con el MISMO teléfono aparece después. El contacto 9001 ya es de
-- DTD-0001: no puede pasar a ser de dos personas.
insert into public.clients (tenant_id, markbox, phone) values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'DTD-0006', '4121668021');

do $$
declare r jsonb;
begin
  r := public.kommo_vincular_clientes_por_telefono('11111111-1111-1111-1111-111111111111'::uuid, true);
  if (select kommo_contact_id from public.clients where markbox = 'DTD-0006') is not null then
    raise exception 'CASO 4: un contacto YA vinculado se reutilizo en un segundo cliente';
  end if;
  if (select kommo_contact_id from public.clients where markbox = 'DTD-0001') <> 9001 then
    raise exception 'CASO 4b: se piso el vinculo existente de DTD-0001';
  end if;
end;
$$;

-- ═══ 5. Dos CLIENTES con el mismo teléfono ⇒ ambiguo, no se toca ════════════
insert into public.clients (tenant_id, markbox, phone) values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'DTD-0010', '04241112233'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'DTD-0011', '+58 424 111 2233');   -- misma clave que DTD-0010
insert into public.kommo_contacts (tenant_id, id, phone) values
  ('11111111-1111-1111-1111-111111111111'::uuid, 9010, '4241112233');

do $$
declare r jsonb;
begin
  r := public.kommo_vincular_clientes_por_telefono('11111111-1111-1111-1111-111111111111'::uuid, true);
  if (select count(*) from public.clients
       where markbox in ('DTD-0010','DTD-0011') and kommo_contact_id is not null) > 0 then
    raise exception 'CASO 5: con DOS clientes al mismo telefono se vinculo igual — eso estampa el Mark del que no es';
  end if;
  if (r->>'ambiguo_varios_clientes')::int < 1 then
    raise exception 'CASO 5b: el informe debia contar la ambiguedad por cliente';
  end if;
end;
$$;

-- ═══ 6. Dos CONTACTOS con el mismo teléfono ⇒ ambiguo por la OTRA dirección ═
-- Ésta es la guarda que decideRoute() NO tiene: en vivo se enruta desde UN
-- contacto conocido, pero un barrido elige contacto, y ahí hay que decidir.
insert into public.clients (tenant_id, markbox, phone) values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'DTD-0020', '04265556677');
insert into public.kommo_contacts (tenant_id, id, phone) values
  ('11111111-1111-1111-1111-111111111111'::uuid, 9020, '4265556677'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 9021, '0426-555-6677');   -- misma clave, otro contacto

do $$
declare r jsonb;
begin
  r := public.kommo_vincular_clientes_por_telefono('11111111-1111-1111-1111-111111111111'::uuid, true);
  if (select kommo_contact_id from public.clients where markbox = 'DTD-0020') is not null then
    raise exception 'CASO 6: con DOS contactos al mismo telefono se eligio uno al azar';
  end if;
  if (r->>'ambiguo_varios_contactos')::int < 1 then
    raise exception 'CASO 6b: el informe debia contar la ambiguedad por contacto';
  end if;
end;
$$;

-- ═══ 7. Aislamiento por tenant ══════════════════════════════════════════════
insert into public.clients (tenant_id, markbox, phone) values
  ('22222222-2222-2222-2222-222222222222'::uuid, 'OTRO-0001', '04149998877');
insert into public.kommo_contacts (tenant_id, id, phone) values
  ('11111111-1111-1111-1111-111111111111'::uuid, 9030, '4149998877');   -- contacto del tenant 1, teléfono del 2

do $$
declare r jsonb;
begin
  r := public.kommo_vincular_clientes_por_telefono('22222222-2222-2222-2222-222222222222'::uuid, true);
  if (select kommo_contact_id from public.clients where markbox = 'OTRO-0001') is not null then
    raise exception 'CASO 7: se vinculo un cliente con un contacto de OTRO tenant';
  end if;
end;
$$;

-- ═══ 8. El teléfono corto no entra al cruce ═════════════════════════════════
-- DTD-0003 tiene 9 dígitos. Aunque exista un contacto cuyos dígitos terminen
-- igual, no debe cruzarse: phoneKey() devuelve NULL por debajo de 10.
insert into public.kommo_contacts (tenant_id, id, phone) values
  ('11111111-1111-1111-1111-111111111111'::uuid, 9040, '0123456789');   -- 10 dígitos, termina en 123456789

do $$
declare r jsonb;
begin
  r := public.kommo_vincular_clientes_por_telefono('11111111-1111-1111-1111-111111111111'::uuid, true);
  if (select kommo_contact_id from public.clients where markbox = 'DTD-0003') is not null then
    raise exception 'CASO 8: un telefono de 9 digitos se cruzo — phoneKey() exige 10';
  end if;
  if (r->>'sin_clave_telefono')::int < 3 then
    raise exception 'CASO 8b: el informe debia contar los clientes sin clave utilizable, conto %',
      r->>'sin_clave_telefono';
  end if;
end;
$$;

-- ═══ 9. Un contacto ya usado, con UN SOLO cliente candidato ═════════════════
-- Éste AÍSLA la guarda `contacto_libre`. En el CASO 4 había dos clientes al
-- mismo teléfono, así que la guarda de "un solo cliente" ya bloqueaba sola y
-- ésta nunca se ejercitaba: la mutación que la borraba salía VERDE.
-- Acá el cliente es único y el contacto es único — lo único que puede frenarlo
-- es que el contacto ya sea de otra persona.
insert into public.kommo_contacts (tenant_id, id, phone) values
  ('11111111-1111-1111-1111-111111111111'::uuid, 9050, '04161112222');
insert into public.clients (tenant_id, markbox, phone) values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'DTD-0030', '4161112222');
insert into public.clients (tenant_id, markbox, phone, kommo_contact_id) values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'DTD-0031', '04161119999', 9050);

do $$
begin
  perform public.kommo_vincular_clientes_por_telefono('11111111-1111-1111-1111-111111111111'::uuid, true);
  if (select kommo_contact_id from public.clients where markbox = 'DTD-0030') is not null then
    raise exception 'CASO 9: el contacto 9050 YA era de DTD-0031 y se le dio tambien a DTD-0030 — dos clientes apuntando a la misma persona';
  end if;
end;
$$;

-- ═══ 10. Un cliente YA vinculado no se repisa ═══════════════════════════════
-- Éste AÍSLA el `kommo_contact_id is null` del UPDATE. DTD-0040 ya apunta al
-- contacto 9060, pero su teléfono matchea limpio con el 9061: cliente único,
-- contacto único y contacto libre. O sea que el par ENTRA a los aplicables y lo
-- único que impide pisarle el vínculo es la guarda del UPDATE.
insert into public.kommo_contacts (tenant_id, id, phone) values
  ('11111111-1111-1111-1111-111111111111'::uuid, 9061, '04171113333');
insert into public.clients (tenant_id, markbox, phone, kommo_contact_id) values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'DTD-0040', '4171113333', 9060);

do $$
begin
  perform public.kommo_vincular_clientes_por_telefono('11111111-1111-1111-1111-111111111111'::uuid, true);
  if (select kommo_contact_id from public.clients where markbox = 'DTD-0040') <> 9060 then
    raise exception 'CASO 10: se PISO el vinculo existente de DTD-0040 (9060 -> %)',
      (select kommo_contact_id from public.clients where markbox = 'DTD-0040');
  end if;
end;
$$;

-- ═══ 11. p_tenant_id nulo revienta en vez de barrer todo ════════════════════
do $$
declare ok boolean := false;
begin
  begin
    perform public.kommo_vincular_clientes_por_telefono(null, true);
  exception when others then
    ok := true;
  end;
  if not ok then
    raise exception 'CASO 11: con tenant NULL debia fallar, no barrer sin filtro';
  end if;
end;
$$;

\echo '0383 OK — 11 casos'

rollback;

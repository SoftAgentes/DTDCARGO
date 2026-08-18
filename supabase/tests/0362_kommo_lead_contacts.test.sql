\set ON_ERROR_STOP on

-- Contrato desechable de la migración 0362 (SDD-0256 · puente lead↔contacto).
--
-- Se escribió DESPUÉS que la migración, y eso importa: la 0362 llevaba días
-- aplicada en producción sin ningún contrato que la vigilara. Su pieza delicada
-- es la GUARDA DE ORDEN — el gemelo del trigger 0107: un webhook fuera de orden
-- no puede pisar vínculos más nuevos con un snapshot viejo. Eso no se ve
-- leyendo el código, se ve midiéndolo.
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

-- ── Fixture: lo que la 0362 exige en su preflight ───────────────────────────
create table public.kommo_leads (
  tenant_id         uuid    not null,
  id                bigint  not null,
  kommo_updated_at  timestamptz,
  primary key (tenant_id, id)
);

create function public.get_user_tenant_id() returns uuid
language sql stable as $$ select '11111111-1111-1111-1111-111111111111'::uuid $$;

insert into public.kommo_leads (tenant_id, id, kommo_updated_at) values
  ('11111111-1111-1111-1111-111111111111', 900, '2026-08-11T12:00:00Z'),
  ('11111111-1111-1111-1111-111111111111', 901, null);

-- ── La migración bajo prueba ────────────────────────────────────────────────
\i /sb/migrations/0362_kommo_lead_contacts.sql

-- ── 1. Inserta los vínculos y devuelve cuántos ─────────────────────────────
do $inserta$
declare n int;
begin
  n := public.kommo_replace_lead_contacts(
    '11111111-1111-1111-1111-111111111111', 900,
    '[{"id":5001,"is_main":true},{"id":5002}]'::jsonb,
    '2026-08-11T13:00:00Z');
  if n <> 2 then raise exception 'esperaba 2 vinculos, devolvio %', n; end if;

  if (select count(*) from public.kommo_lead_contacts where lead_id = 900) <> 2 then
    raise exception 'no quedaron 2 filas en la tabla';
  end if;
  if not (select is_main from public.kommo_lead_contacts where lead_id = 900 and contact_id = 5001) then
    raise exception 'el contacto principal no quedo marcado';
  end if;
end;
$inserta$;

-- ── 2. ⭐ LA GUARDA DE ORDEN: un snapshot VIEJO no pisa nada ────────────────
--     Es el gemelo de la 0107. Sin esto, un webhook que llega tarde borraria
--     vinculos nuevos y los reemplazaria por los de hace una hora.
do $orden$
declare n int;
begin
  n := public.kommo_replace_lead_contacts(
    '11111111-1111-1111-1111-111111111111', 900,
    '[{"id":9999}]'::jsonb,
    '2026-08-11T11:00:00Z');   -- ANTERIOR al kommo_updated_at espejado
  if n <> -1 then
    raise exception 'un snapshot viejo debia devolver -1 (descartado), devolvio %', n;
  end if;
  -- Y lo importante: NO tocó los vínculos que ya estaban.
  if (select count(*) from public.kommo_lead_contacts where lead_id = 900) <> 2 then
    raise exception 'el snapshot viejo PISO los vinculos buenos';
  end if;
  if exists (select 1 from public.kommo_lead_contacts where contact_id = 9999) then
    raise exception 'el snapshot viejo llego a insertar';
  end if;
end;
$orden$;

-- ── 3. -1 (descartado) es DISTINTO de 0 (no vino ningún vínculo) ───────────
--     Si los dos fueran 0, el llamador no podría distinguir "llegué tarde" de
--     "este lead se quedó sin contactos", que son cosas opuestas.
do $cero$
declare n int;
begin
  n := public.kommo_replace_lead_contacts(
    '11111111-1111-1111-1111-111111111111', 900, '[]'::jsonb,
    '2026-08-11T14:00:00Z');
  if n <> 0 then raise exception 'una lista vacia al dia debia devolver 0, devolvio %', n; end if;
  if (select count(*) from public.kommo_lead_contacts where lead_id = 900) <> 0 then
    raise exception 'una lista vacia debia dejar el lead sin vinculos';
  end if;
end;
$cero$;

-- ── 4. Sin fecha espejada, la guarda no bloquea (lead recién visto) ─────────
do $sinfecha$
declare n int;
begin
  n := public.kommo_replace_lead_contacts(
    '11111111-1111-1111-1111-111111111111', 901,
    '[{"id":7001}]'::jsonb, '2020-01-01T00:00:00Z');
  if n <> 1 then raise exception 'sin kommo_updated_at no se descarta; devolvio %', n; end if;
end;
$sinfecha$;

-- ── 5. Un lead tiene UN principal como máximo (índice único parcial) ────────
do $principal$
declare v_ok boolean := false;
begin
  perform public.kommo_replace_lead_contacts(
    '11111111-1111-1111-1111-111111111111', 901,
    '[{"id":7001,"is_main":true}]'::jsonb, null);
  begin
    insert into public.kommo_lead_contacts (tenant_id, lead_id, contact_id, is_main)
    values ('11111111-1111-1111-1111-111111111111', 901, 7002, true);
  exception when unique_violation then
    v_ok := true;
  end;
  if not v_ok then
    raise exception 'se pudieron marcar DOS contactos principales para el mismo lead';
  end if;
end;
$principal$;

-- ── 6. Borrar el lead se lleva sus vínculos (FK compuesta on delete cascade) ─
do $cascada$
begin
  delete from public.kommo_leads
   where tenant_id = '11111111-1111-1111-1111-111111111111' and id = 901;
  if exists (select 1 from public.kommo_lead_contacts where lead_id = 901) then
    raise exception 'los vinculos sobrevivieron al borrado del lead';
  end if;
end;
$cascada$;

-- ── 7. NO hay FK a kommo_contacts, y es a propósito ────────────────────────
--     El webhook puede ver un lead cuyo contacto todavia no esta espejado. Si
--     alguien "arregla" esto agregando la FK, el sync empieza a fallar.
do $sin_fk$
begin
  perform public.kommo_replace_lead_contacts(
    '11111111-1111-1111-1111-111111111111', 900,
    '[{"id":424242}]'::jsonb, null);
  if not exists (select 1 from public.kommo_lead_contacts where contact_id = 424242) then
    raise exception 'un contacto aun no espejado deberia poder vincularse';
  end if;
end;
$sin_fk$;

-- ── 8. Permisos: authenticated LEE, sólo service_role escribe ──────────────
do $permisos$
begin
  if not has_table_privilege('authenticated', 'public.kommo_lead_contacts', 'SELECT') then
    raise exception 'authenticated deberia poder LEER el puente';
  end if;
  if has_table_privilege('authenticated', 'public.kommo_lead_contacts', 'INSERT') then
    raise exception 'authenticated NO deberia poder escribir el espejo';
  end if;
  if has_table_privilege('anon', 'public.kommo_lead_contacts', 'SELECT') then
    raise exception 'anon no deberia ver el espejo';
  end if;
  if not has_table_privilege('service_role', 'public.kommo_lead_contacts', 'INSERT') then
    raise exception 'service_role SI debe poder escribir';
  end if;
end;
$permisos$;

rollback;

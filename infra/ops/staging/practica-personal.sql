-- SDD-0713. Bootstrap exclusivo de una base nueva de práctica. Fuera
-- del ledger del ERP. La sesión que instala debe identificar expresamente el destino.
begin;
do $inicio$
begin
  if current_setting('dtd.destino', true) is distinct from 'practica-personal-nueva'
    or exists (
      select 1 from pg_namespace
      where nspname not like 'pg\_%' escape '\' and nspname not in ('information_schema','public')
    ) or exists (
      select 1 from pg_class where relnamespace = 'public'::regnamespace
        and relkind in ('r','p','v','m','S','f')
    ) then
    raise exception 'La práctica requiere una base dedicada nueva y vacía';
  end if;
end
$inicio$;

create schema practica_privada;
revoke all on schema practica_privada from public;
revoke create on schema public from public;
create role practica_personal_web nologin;
create table practica_privada.destino (unico boolean primary key default true check (unico), instancia uuid not null default gen_random_uuid());
insert into practica_privada.destino default values;
create table practica_privada.espacios (
  id uuid primary key default gen_random_uuid(),
  propietario text not null unique check (propietario ~ '^[0-9a-f]{64}$')
);
create table practica_privada.pases (
  huella text primary key check (huella ~ '^[0-9a-f]{64}$'),
  propietario text not null check (propietario ~ '^[0-9a-f]{64}$'),
  referencia text not null check (length(referencia) between 64 and 512 and referencia ~ '^[A-Za-z0-9_-]+$'),
  vence timestamptz not null
);
create table practica_privada.sesiones (
  huella text primary key check (huella ~ '^[0-9a-f]{64}$'),
  espacio uuid not null references practica_privada.espacios(id),
  referencia text not null,
  vence timestamptz not null
);
create index on practica_privada.pases (vence);
create index on practica_privada.sesiones (vence);

create function practica_privada.comprobar(p_instancia uuid) returns void
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from practica_privada.destino where instancia = p_instancia) then
    raise exception 'Destino de práctica distinto' using errcode = '42501';
  end if;
end $$;

create function public.practica_reservar(p_instancia uuid, p_huella text, p_propietario text, p_referencia text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform practica_privada.comprobar(p_instancia);
  delete from practica_privada.pases where vence <= now();
  delete from practica_privada.sesiones where vence <= now();
  insert into practica_privada.pases values (p_huella, p_propietario, p_referencia, now() + interval '60 seconds');
  return true;
end $$;

create function public.practica_canjear(p_instancia uuid, p_huella text, p_sesion text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  pase practica_privada.pases%rowtype;
  espacio_id uuid;
begin
  perform practica_privada.comprobar(p_instancia);
  delete from practica_privada.pases where huella = p_huella and vence > now() returning * into pase;
  if not found then return false; end if;
  insert into practica_privada.espacios (propietario) values (pase.propietario)
    on conflict (propietario) do update set propietario = excluded.propietario returning id into espacio_id;
  insert into practica_privada.sesiones values (p_sesion, espacio_id, pase.referencia, now() + interval '4 hours');
  return true;
end $$;

create function public.practica_sesion(p_instancia uuid, p_sesion text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform practica_privada.comprobar(p_instancia);
  return (select jsonb_build_object('espacio', espacio, 'referencia', referencia)
    from practica_privada.sesiones where huella = p_sesion and vence > now());
end $$;

create function public.practica_cerrar(p_instancia uuid, p_sesion text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform practica_privada.comprobar(p_instancia);
  delete from practica_privada.sesiones where huella = p_sesion;
  return true;
end $$;

revoke all on all functions in schema practica_privada from public;
revoke all on function public.practica_reservar(uuid,text,text,text), public.practica_canjear(uuid,text,text),
  public.practica_sesion(uuid,text), public.practica_cerrar(uuid,text) from public;
grant usage on schema public to practica_personal_web;
grant execute on function public.practica_reservar(uuid,text,text,text), public.practica_canjear(uuid,text,text),
  public.practica_sesion(uuid,text), public.practica_cerrar(uuid,text) to practica_personal_web;
commit;

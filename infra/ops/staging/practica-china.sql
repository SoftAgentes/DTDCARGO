-- Aplicar solo en base local desechable después de practica-facturacion.sql.
begin;
create table practica_privada.cargas (
 espacio uuid primary key references practica_privada.espacios(id),
 revision integer not null default 0, documento jsonb
);
create table practica_privada.reinicios_cargas (
 espacio uuid not null references practica_privada.espacios(id),
 fecha timestamptz not null default now(), documento jsonb not null
);
-- El mismo bloqueo de espacio protege ambas RPC y el reinicio global.
create function practica_privada.reiniciar_cargas() returns trigger
language plpgsql set search_path = '' as $$
begin
 if new.documento->>'generacion' is distinct from old.documento->>'generacion' then
  insert into practica_privada.reinicios_cargas(espacio,documento)
   select espacio,documento from practica_privada.cargas where espacio=new.espacio and documento is not null;
  update practica_privada.cargas set documento=null, revision=revision+1 where espacio=new.espacio;
 end if;
 return new;
end $$;
create trigger reiniciar_cargas after update on practica_privada.documentos
for each row execute function practica_privada.reiniciar_cargas();
create function public.practica_china(p_instancia uuid,p_sesion text,p_revision integer default null,p_documento jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare eid uuid; fila practica_privada.cargas%rowtype; gen integer;
begin
 perform practica_privada.comprobar(p_instancia);
 select espacio into eid from practica_privada.sesiones where huella=p_sesion and vence>now();
 if eid is null then raise exception 'Sesión vencida' using errcode='42501'; end if;
 perform 1 from practica_privada.espacios where id=eid for update;
 select coalesce((documento->>'generacion')::integer,1) into gen from practica_privada.documentos where espacio=eid;
 gen := coalesce(gen,1);
 select * into fila from practica_privada.cargas where espacio=eid;
 if fila.espacio is null then
  if p_documento is null then return jsonb_build_object('revision',0,'documento',null,'generacion',gen); end if;
  if p_revision is distinct from 0 then return null; end if;
  insert into practica_privada.cargas(espacio) values(eid);
  select * into fila from practica_privada.cargas where espacio=eid;
 end if;
 if p_documento is not null then
  if (p_documento->>'generacion')::integer <> gen or fila.revision<>p_revision then return null; end if;
  update practica_privada.cargas set documento=p_documento,revision=revision+1 where espacio=eid;
  select * into fila from practica_privada.cargas where espacio=eid;
 end if;
 return jsonb_build_object('revision',fila.revision,'documento',fila.documento,'generacion',gen);
end $$;
revoke all on function public.practica_china(uuid,text,integer,jsonb) from public;
grant execute on function public.practica_china(uuid,text,integer,jsonb) to practica_personal_web;
create function public.practica_reiniciar(p_instancia uuid,p_sesion text,p_revision integer,p_fin_revision integer,p_documento jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare eid uuid; cr integer; fr integer; guardado jsonb; gen integer;
begin
 perform practica_privada.comprobar(p_instancia);
 select espacio into eid from practica_privada.sesiones where huella=p_sesion and vence>now();
 if eid is null then raise exception 'Sesión vencida' using errcode='42501'; end if;
 perform 1 from practica_privada.espacios where id=eid for update;
 select revision into cr from practica_privada.cargas where espacio=eid;
 select revision,(documento->>'generacion')::integer into fr,gen from practica_privada.documentos where espacio=eid;
 if cr is distinct from p_revision or coalesce(fr,-1)<>p_fin_revision
    or (p_documento->>'generacion')::integer is distinct from coalesce(gen,1)+1 then return false; end if;
 guardado:=public.practica_facturacion(p_instancia,p_sesion,p_fin_revision,p_documento);
 if guardado is null then return false; end if;
 -- El INSERT inicial de Facturación no dispara su trigger de UPDATE.
 if fr is null then
  insert into practica_privada.reinicios_cargas(espacio,documento)
   select espacio,documento from practica_privada.cargas where espacio=eid and documento is not null;
  update practica_privada.cargas set documento=null,revision=revision+1 where espacio=eid;
 end if;
 return true;
end $$;
revoke all on function public.practica_reiniciar(uuid,text,integer,integer,jsonb) from public;
grant execute on function public.practica_reiniciar(uuid,text,integer,integer,jsonb) to practica_personal_web;
commit;

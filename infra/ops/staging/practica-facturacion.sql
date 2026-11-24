-- Solo receptor dedicado de fase 1. Aplicación local desechable; sin tablas ERP.
begin;
create table practica_privada.documentos (
  espacio uuid primary key references practica_privada.espacios(id),
  revision integer not null default 0,
  documento jsonb not null
);
create function public.practica_facturacion(p_instancia uuid, p_sesion text, p_revision integer default null, p_documento jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare eid uuid; fila practica_privada.documentos%rowtype;
begin
  perform practica_privada.comprobar(p_instancia);
  select espacio into eid from practica_privada.sesiones where huella = p_sesion and vence > now();
  if eid is null then raise exception 'Sesión vencida' using errcode='42501'; end if;
  -- Serializa también la creación inicial y los reinicios de distintas pestañas.
  perform 1 from practica_privada.espacios where id=eid for update;
  select * into fila from practica_privada.documentos where espacio=eid;
  if p_documento is not null then
    if (fila.espacio is null and p_revision = -1) then
      insert into practica_privada.documentos values(eid,0,p_documento);
    elsif fila.revision = p_revision then
      update practica_privada.documentos set documento=p_documento,revision=revision+1 where espacio=eid;
    else
      return null;
    end if;
    select * into fila from practica_privada.documentos where espacio=eid;
  end if;
  if fila.espacio is null then return null; end if;
  return jsonb_build_object('revision',fila.revision,'documento',fila.documento);
end $$;
revoke all on function public.practica_facturacion(uuid,text,integer,jsonb) from public;
grant execute on function public.practica_facturacion(uuid,text,integer,jsonb) to practica_personal_web;
commit;

-- supabase/cargas/portal-historial-deshacer/deshacer-vinculos.sql — SDD-0586 10.7, el sub-paso 4.6b del runbook
-- docs/runbooks/chatwoot-portal-p4-puertas.md: deshace en Studio los vínculos de la carga P4.
--
-- ⚠️ NO ES UNA MIGRACIÓN y no entra al ledger: borra filas de una carga, no cambia esquema. Es un
--    BORRADO PERMANENTE en producción: lo corre Sam (MODO=aplicar) y el DG lo ensaya antes (MODO=ensayo,
--    que termina en rollback). Lo llama deshacer-vinculos.sh, que arma las tablas temporales de entrada,
--    define esta función, la llama y cierra la transacción.
--
-- Entradas (tablas temporales que crea deshacer-vinculos.sh):
--   · pg_temp.deshacer_param: tenant, cuenta, bandeja, los cuatro conteos esperados (del conteo previo de
--     solo lectura), el entorno ('copia' o 'produccion') y el system_identifier esperado para produccion;
--   · pg_temp.conservados (n, linea): contactos-conservados.ndjson de la pieza de E5 (2c), solo ids:
--     una cabecera {"tipo":"cabecera","version":1,"tenant_id","cuenta","bandeja","contactos"} y una
--     línea {"tipo":"contacto","identificador","contacto_id"} por contacto dtd-portal: que E5 no borra.
--
-- Entorno (la guarda de supabase/cargas/crm-kommo/carga.sql): 'copia' exige la marca dtd.entorno = 'copia'
-- guardada para la base (alter database, la pone el ensayo en la copia efímera); 'produccion' exige que no
-- haya marca y que el system_identifier de pg_control_system() sea el que trae quien opera, del runbook.
-- Si lo pedido no coincide con la base, aborta antes de leer nada.
--
-- Contrato: supabase/tests/deshacer_vinculos_portal.test.sql (Contratos SQL, Postgres 17) y su envoltorio
-- de PGlite, lib/studio/__tests__/deshacer-vinculos-portal.test.ts, con control rojo y mutantes.
--
-- Solo sirve ANTES de encender chatwoot_portal (puerta 5): con el flag nunca encendido y la cola sin
-- correr, todas las filas del tenant salen de la carga. Después de encender no se distingue lo que
-- vinculó la cola, y se niega.
--
-- Hace, todo o nada: borra las filas `cargado` de chatwoot_portal_salida, el espejo de
-- chatwoot_conversations de los hilos vinculados y chatwoot_portal_hilos; deja el corte y cargado_at en
-- nulo; y en chatwoot_portal_contactos pone en nulo chatwoot_contact_id y chatwoot_source_id, salvo en
-- los conservados. No borra ninguna fila de contactos: el identificador es la reserva (riesgo 1), y una
-- carga nueva lo reusa. No toca conversations ni conversation_messages (C-6 y C-7 iguales).
--
-- Datos personales: borra ids y estados, sin nombres ni textos. Devuelve solo líneas HECHO con conteos.
create or replace function pg_temp.deshacer_vinculos()
returns setof text
language plpgsql
as $function$
declare
  p              record;
  v_cab          jsonb;
  v_n            integer;
  v_lineas       integer;
  v_salida       integer;
  v_hilos        integer;
  v_contactos    integer;
  v_espejo       integer;
  v_conservados  integer;
  v_audit_antes  bigint;
  v_audit_despues bigint;
  d_salida       integer;
  d_espejo       integer;
  d_hilos        integer;
  d_vaciados     integer;
  v_marca        text;
  v_guardada     boolean;
  v_sistema      text;
begin
  -- ── Los parámetros ──
  select * into p from pg_temp.deshacer_param;
  if not found or p.tenant is null or p.cuenta is null or p.bandeja is null
     or p.esperados_salida is null or p.esperados_hilos is null
     or p.esperados_contactos is null or p.esperados_espejo is null then
    raise exception 'deshacer_vinculos: faltan los parámetros' using errcode = '22023';
  end if;

  -- ── El entorno: copia o produccion, contra la base ──
  if p.entorno is null or p.entorno not in ('copia', 'produccion') then
    raise exception 'deshacer_vinculos: el entorno tiene que ser copia o produccion' using errcode = '22023';
  end if;
  -- NULL y '' son lo mismo: sin marca.
  v_marca := coalesce(pg_catalog.current_setting('dtd.entorno', true), '');
  if (p.entorno = 'copia' and v_marca <> 'copia') or (p.entorno = 'produccion' and v_marca <> '') then
    raise exception 'deshacer_vinculos: el entorno pedido (%) no coincide con la marca de la base', p.entorno
      using errcode = '22023';
  end if;
  -- La marca de la copia tiene que estar guardada para la base, no solo en la sesión.
  if p.entorno = 'copia' then
    begin
      select exists (
        select 1 from pg_catalog.pg_db_role_setting s
        where s.setrole = 0
          and s.setdatabase = (select d.oid from pg_catalog.pg_database d where d.datname = pg_catalog.current_database())
          and 'dtd.entorno=copia' = any (s.setconfig)
      ) into v_guardada;
    exception when insufficient_privilege then
      raise exception 'deshacer_vinculos: el rol no puede leer pg_db_role_setting; no se comprueba la marca'
        using errcode = '42501';
    end;
    if not v_guardada then
      raise exception 'deshacer_vinculos: la marca copia no está guardada para la base (solo en la sesión)'
        using errcode = '22023';
    end if;
  end if;
  -- Sin marca no prueba que sea producción: hace falta identificarla con el system_identifier del runbook.
  if p.entorno = 'produccion' then
    begin
      select s.system_identifier::text into v_sistema from pg_catalog.pg_control_system() s;
    exception when insufficient_privilege then
      raise exception 'deshacer_vinculos: el rol no puede leer pg_control_system(); no se identifica la base'
        using errcode = '42501';
    end;
    if p.sistema is null or v_sistema is distinct from p.sistema then
      raise exception 'deshacer_vinculos: el identificador del sistema no es el esperado para produccion'
        using errcode = '22023';
    end if;
  end if;

  -- ── Guardas: abortan sin escribir nada ──
  -- La fila del flag queda tomada hasta el fin de la transacción: nadie la enciende a mitad de la corrida.
  perform 1 from public.feature_flags f where f.tenant_id = p.tenant and f.key = 'chatwoot_portal' for update;
  if exists (
    select 1 from public.feature_flags f
    where f.tenant_id = p.tenant and f.key = 'chatwoot_portal' and f.enabled
  ) then
    raise exception 'deshacer_vinculos: chatwoot_portal está encendido' using errcode = '55000';
  end if;
  if exists (
    select 1 from public.entity_audit_log a
    where a.tenant_id = p.tenant and a.entity_type = 'feature_flag' and a.event_type = 'feature_flag_changed'
      and a.after_data ->> 'key' = 'chatwoot_portal' and a.after_data ->> 'enabled' = 'true'
  ) then
    raise exception 'deshacer_vinculos: chatwoot_portal se encendió alguna vez' using errcode = '55000';
  end if;
  if exists (
    select 1 from public.chatwoot_portal_salida s where s.tenant_id = p.tenant and s.estado <> 'cargado'
  ) then
    raise exception 'deshacer_vinculos: la cola corrió (hay salidas que no están cargado)' using errcode = '55000';
  end if;
  if exists (
    select 1 from pg_catalog.pg_trigger t
    where not t.tgisinternal
      and t.tgrelid in (
        'public.chatwoot_portal_salida'::regclass, 'public.chatwoot_portal_hilos'::regclass,
        'public.chatwoot_portal_contactos'::regclass, 'public.chatwoot_portal_estado'::regclass,
        'public.chatwoot_conversations'::regclass)
  ) then
    raise exception 'deshacer_vinculos: hay un trigger en las tablas que toca' using errcode = '55000';
  end if;

  -- ── Los conteos, contra los esperados ──
  select pg_catalog.count(*)::integer into v_salida
  from public.chatwoot_portal_salida s where s.tenant_id = p.tenant and s.estado = 'cargado';
  select pg_catalog.count(*)::integer into v_hilos
  from public.chatwoot_portal_hilos hl where hl.tenant_id = p.tenant;
  select pg_catalog.count(*)::integer into v_contactos
  from public.chatwoot_portal_contactos k where k.tenant_id = p.tenant and k.chatwoot_contact_id is not null;
  select pg_catalog.count(*)::integer into v_espejo
  from public.chatwoot_conversations cc
  join public.chatwoot_portal_hilos hl on hl.tenant_id = cc.tenant_id and hl.chatwoot_conversation_id = cc.conversation_id
  where cc.tenant_id = p.tenant;
  if v_salida is distinct from p.esperados_salida or v_hilos is distinct from p.esperados_hilos
     or v_contactos is distinct from p.esperados_contactos or v_espejo is distinct from p.esperados_espejo then
    raise exception 'deshacer_vinculos: los conteos no son los esperados (salida % hilos % contactos % espejo %)',
      v_salida, v_hilos, v_contactos, v_espejo using errcode = '22023';
  end if;
  if exists (
    select 1 from public.chatwoot_conversations cc
    join public.chatwoot_portal_hilos hl on hl.tenant_id = cc.tenant_id and hl.chatwoot_conversation_id = cc.conversation_id
    where cc.tenant_id = p.tenant and cc.inbox_id is distinct from p.bandeja
  ) then
    raise exception 'deshacer_vinculos: un espejo vinculado no es de la bandeja' using errcode = '22023';
  end if;

  -- ── El archivo de E5 ──
  select pg_catalog.count(*)::integer into v_n from pg_temp.conservados c where c.linea::jsonb ->> 'tipo' = 'cabecera';
  if v_n <> 1 then
    raise exception 'deshacer_vinculos: el archivo de los conservados lleva una sola cabecera' using errcode = '22023';
  end if;
  select c.linea::jsonb into v_cab from pg_temp.conservados c where c.linea::jsonb ->> 'tipo' = 'cabecera';
  if (v_cab ->> 'version') is distinct from '1' or (v_cab ->> 'tenant_id') is distinct from p.tenant::text
     or (v_cab ->> 'cuenta') is distinct from p.cuenta::text or (v_cab ->> 'bandeja') is distinct from p.bandeja::text then
    raise exception 'deshacer_vinculos: la cabecera de los conservados no es la del tenant, la cuenta o la bandeja' using errcode = '22023';
  end if;
  if exists (select 1 from pg_temp.conservados c where c.linea::jsonb ->> 'tipo' not in ('cabecera', 'contacto')) then
    raise exception 'deshacer_vinculos: una línea de los conservados no es cabecera ni contacto' using errcode = '22023';
  end if;
  select pg_catalog.count(*)::integer, pg_catalog.count(distinct c.linea::jsonb ->> 'identificador')::integer
    into v_conservados, v_lineas
  from pg_temp.conservados c where c.linea::jsonb ->> 'tipo' = 'contacto';
  if (v_cab ->> 'contactos')::integer is distinct from v_conservados or v_lineas <> v_conservados then
    raise exception 'deshacer_vinculos: el conteo de los conservados no cuadra' using errcode = '22023';
  end if;
  if exists (
    select 1 from pg_temp.conservados c
    where c.linea::jsonb ->> 'tipo' = 'contacto'
      and not exists (
        select 1 from public.chatwoot_portal_contactos k
        where k.tenant_id = p.tenant
          and k.identificador::text = c.linea::jsonb ->> 'identificador'
          and k.chatwoot_contact_id = (c.linea::jsonb ->> 'contacto_id')::bigint
      )
  ) then
    raise exception 'deshacer_vinculos: un contacto conservado no es el que Studio tiene' using errcode = '22023';
  end if;

  select pg_catalog.count(*) into v_audit_antes from public.entity_audit_log a where a.tenant_id = p.tenant;

  -- ── Las escrituras ──
  delete from public.chatwoot_portal_salida s where s.tenant_id = p.tenant and s.estado = 'cargado';
  get diagnostics d_salida = row_count;
  delete from public.chatwoot_conversations cc
  using public.chatwoot_portal_hilos hl
  where hl.tenant_id = p.tenant and cc.tenant_id = p.tenant and cc.conversation_id = hl.chatwoot_conversation_id;
  get diagnostics d_espejo = row_count;
  delete from public.chatwoot_portal_hilos hl where hl.tenant_id = p.tenant;
  get diagnostics d_hilos = row_count;
  update public.chatwoot_portal_estado e
  set corte = null, cargado_at = null, updated_at = pg_catalog.now()
  where e.tenant_id = p.tenant;
  update public.chatwoot_portal_contactos k
  set chatwoot_contact_id = null, chatwoot_source_id = null, updated_at = pg_catalog.now()
  where k.tenant_id = p.tenant and k.chatwoot_contact_id is not null
    and not exists (
      select 1 from pg_temp.conservados c
      where c.linea::jsonb ->> 'tipo' = 'contacto' and c.linea::jsonb ->> 'identificador' = k.identificador::text
    );
  get diagnostics d_vaciados = row_count;

  -- ── La verificación ──
  select pg_catalog.count(*) into v_audit_despues from public.entity_audit_log a where a.tenant_id = p.tenant;
  if d_salida <> p.esperados_salida or d_espejo <> p.esperados_espejo or d_hilos <> p.esperados_hilos
     or d_vaciados + v_conservados <> p.esperados_contactos
     or exists (select 1 from public.chatwoot_portal_salida s where s.tenant_id = p.tenant)
     or exists (select 1 from public.chatwoot_portal_hilos hl where hl.tenant_id = p.tenant)
     or exists (select 1 from public.chatwoot_portal_estado e where e.tenant_id = p.tenant and (e.corte is not null or e.cargado_at is not null))
     or (select pg_catalog.count(*) from public.chatwoot_portal_contactos k
         where k.tenant_id = p.tenant and k.chatwoot_contact_id is not null) <> v_conservados
     or v_audit_despues <> v_audit_antes then
    raise exception 'deshacer_vinculos: la verificación no cuadra' using errcode = 'P0001';
  end if;

  return next 'HECHO salida=' || d_salida || ' hilos=' || d_hilos || ' espejo=' || d_espejo
    || ' contactos_vaciados=' || d_vaciados || ' contactos_conservados=' || v_conservados || ' corte=nulo';
  return next 'HECHO auditoria_antes=' || v_audit_antes || ' auditoria_despues=' || v_audit_despues;
end;
$function$;

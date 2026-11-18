-- Carga de la 6.5 (programa SDD-0582, E6): leads, etapas, tareas, asesores e IDs de Kommo al CRM propio.
-- ⚠️ NO ES UNA MIGRACIÓN. Vive fuera de supabase/migrations/ y sin número: no crea objetos que queden. Define
--    una función en pg_temp, que muere con la sesión, y quien la llama decide si la transacción se confirma.
--    Cargar en producción exige el OK nominal de Sam (fila 6.5 del checklist) y va con correr.sh.
--
-- Contrato: SDD-0587 §5.2, §5.3, §5.4 y §7, con D3 (a), D4 (a) y D5 (b). Diseño: README.md de esta carpeta.
--   · Lee solo el espejo de Studio (kommo_leads, kommo_contacts, kommo_lead_contacts, kommo_tasks, kommo_users),
--     clients, auth.users y user_tenants. No llama a Kommo, a Chatwoot ni a Meta, y no escribe en kommo_*.
--   · Escribe solo crm_tarjetas, crm_historial_etapas, crm_tareas y crm_ids_externos.
--   · Idempotente por crm_ids_externos: correrla dos veces con el mismo corte da el mismo resultado.
--   · La tarjeta que ya existe gana su etapa (§5.3). Solo se le completa el asesor si no lo tiene.
--   · No copia notas ni etiquetas (D5 b). Nombre visible y últimos 10 dígitos solo del lead sin ficha (D6).
--   · Devuelve solo conteos (clave, valor). Nunca nombres, teléfonos, correos ni textos.
--
-- Uso (lo hace correr.sh, dentro de una transacción):
--   \i carga.sql
--   select clave, valor from pg_temp.crm_carga_kommo('<tenant>'::uuid, '<corte>'::timestamptz, 180, 'copia', null);
--   rollback;   -- modo seco; commit en modo cargar
--
-- Entorno: 'copia' exige que la base tenga la marca dtd.entorno = 'copia' (la pone el ensayo en la copia
-- efímera con «alter database … set dtd.entorno = 'copia'»); 'produccion' exige que no tenga ninguna marca
-- y que el system_identifier de pg_control_system() sea el que trae quien opera (p_sistema, del runbook).
-- Si lo pedido no coincide con la base, aborta antes de leer nada.

create or replace function pg_temp.crm_carga_kommo(
  p_tenant uuid, p_corte timestamptz, p_dias integer, p_entorno text, p_sistema text)
returns table (clave text, valor bigint)
language plpgsql
set search_path = ''
as $carga$
declare
  -- Embudo único «Ventas DTD» (14036567), ids leídos de la API el 2026-08-06
  -- (docs/runbooks/kommo-consolidacion-embudo-unico.md). 142 y 143 son ganado y perdido: cerrados, fuera (D4).
  v_mapa constant jsonb := '{"108343827":"nuevo","108343831":"contactado","108343835":"registrado_recontacto",
                             "108343839":"estimado_enviado","109855104":"negociacion"}';
  v_desde   timestamptz;
  v_c       jsonb := '{}';
  l         record;
  k         record;
  v_act     timestamptz;
  v_etapa   text;
  v_contact bigint;
  v_phone   text;
  v_nombre  text;
  v_client  uuid;
  v_tarjeta uuid;
  v_n       integer;
  v_asesor  uuid;
  v_tarea   uuid;
  v_vence   timestamptz;
  v_marca   text;
  v_sistema text;
  v_guardada boolean;
begin
  -- ─── Preflight ─────────────────────────────────────────────────────────────
  if p_entorno is null or p_entorno not in ('copia', 'produccion') then
    raise exception 'carga kommo→crm: el entorno tiene que ser copia o produccion' using errcode = '22023';
  end if;
  -- NULL y '' son lo mismo: sin marca.
  v_marca := coalesce(pg_catalog.current_setting('dtd.entorno', true), '');
  if (p_entorno = 'copia' and v_marca <> 'copia') or (p_entorno = 'produccion' and v_marca <> '') then
    raise exception 'carga kommo→crm: el entorno pedido (%) no coincide con la marca de la base', p_entorno
      using errcode = '22023';
  end if;
  -- La marca de la copia tiene que estar guardada para la base (alter database), no solo en la sesión: un
  -- PGOPTIONS o un options= del archivo de servicio la pondrían en producción. Se lee de pg_db_role_setting.
  if p_entorno = 'copia' then
    begin
      select exists (
        select 1 from pg_catalog.pg_db_role_setting s
        where s.setrole = 0
          and s.setdatabase = (select d.oid from pg_catalog.pg_database d where d.datname = pg_catalog.current_database())
          and 'dtd.entorno=copia' = any (s.setconfig)
      ) into v_guardada;
    exception when insufficient_privilege then
      raise exception 'carga kommo→crm: el rol no puede leer pg_db_role_setting; no se comprueba la marca'
        using errcode = '42501';
    end;
    if not v_guardada then
      raise exception 'carga kommo→crm: la marca copia no está guardada para la base (solo en la sesión)'
        using errcode = '22023';
    end if;
  end if;
  -- Sin marca no prueba que sea producción: hace falta identificarla. Quien opera trae del runbook el
  -- system_identifier esperado; no vive en el repo. Si el rol no puede leerlo, no se adivina: aborta.
  if p_entorno = 'produccion' then
    begin
      select s.system_identifier::text into v_sistema from pg_catalog.pg_control_system() s;
    exception when insufficient_privilege then
      raise exception 'carga kommo→crm: el rol no puede leer pg_control_system(); no se identifica la base'
        using errcode = '42501';
    end;
    if p_sistema is null or v_sistema is distinct from p_sistema then
      raise exception 'carga kommo→crm: el identificador del sistema no es el esperado para produccion'
        using errcode = '22023';
    end if;
  end if;
  if p_tenant is null or p_corte is null or p_dias is null or p_dias not between 1 and 3650 then
    raise exception 'carga kommo→crm: tenant, corte y días (1 a 3650) son obligatorios' using errcode = '22023';
  end if;
  if p_corte > pg_catalog.now() then
    raise exception 'carga kommo→crm: el corte tiene que estar en el pasado' using errcode = '22023';
  end if;
  if pg_catalog.to_regclass('public.crm_ids_externos') is null
     or pg_catalog.to_regclass('public.crm_historial_etapas') is null
     or pg_catalog.to_regclass('public.kommo_lead_contacts') is null
     or pg_catalog.to_regclass('public.kommo_tasks') is null
     or pg_catalog.to_regclass('public.kommo_users') is null
     or pg_catalog.to_regprocedure('public.crm_ficha_por_telefono(uuid,text)') is null
     or pg_catalog.to_regprocedure('public.crm_asesor_activo(uuid,uuid)') is null then
    raise exception 'carga kommo→crm: requiere la 0506 y la 0513 aplicadas y el espejo de Kommo (0082, 0139, 0362, 0390, 0391)';
  end if;
  if not exists (select 1 from public.tenants t where t.id = p_tenant) then
    raise exception 'carga kommo→crm: el tenant no existe' using errcode = '22023';
  end if;
  if (select pg_catalog.count(*) from public.crm_etapas e
      where e.tenant_id = p_tenant and e.tablero = 'leads' and e.activa
        and e.clave in (select j.value from pg_catalog.jsonb_each_text(v_mapa) j)) <> 5 then
    raise exception 'carga kommo→crm: al tenant le faltan etapas sembradas o activas de la 0506';
  end if;
  -- Una carga a la vez por tenant: candado de transacción, se suelta con el commit o el rollback.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('dtd:carga-kommo-crm:' || p_tenant::text, 0));

  v_desde := p_corte - pg_catalog.make_interval(days => p_dias);

  -- ─── 1. Asesores: por correo, solo si coincide con un usuario activo del tenant (§5.4, E2-D10) ─────────
  for k in
    select u.id, pg_catalog.lower(pg_catalog.btrim(u.email)) as email
    from public.kommo_users u where u.tenant_id = p_tenant order by u.id
  loop
    v_c := pg_catalog.jsonb_set(v_c, '{usuarios_kommo}', pg_catalog.to_jsonb(coalesce((v_c->>'usuarios_kommo')::bigint, 0) + 1));
    if exists (select 1 from public.crm_ids_externos x
               where x.tenant_id = p_tenant and x.sistema = 'kommo' and x.tipo = 'usuario' and x.id_externo = k.id) then
      v_c := pg_catalog.jsonb_set(v_c, '{usuarios_ya_mapeados}', pg_catalog.to_jsonb(coalesce((v_c->>'usuarios_ya_mapeados')::bigint, 0) + 1));
      continue;
    end if;
    v_asesor := null;
    if k.email is not null and k.email <> '' then
      select case when pg_catalog.count(*) = 1 then (pg_catalog.array_agg(au.id))[1] end into v_asesor
      from auth.users au where pg_catalog.lower(pg_catalog.btrim(au.email)) = k.email;
      v_asesor := public.crm_asesor_activo(p_tenant, v_asesor);
    end if;
    if v_asesor is null then
      v_c := pg_catalog.jsonb_set(v_c, '{usuarios_sin_par}', pg_catalog.to_jsonb(coalesce((v_c->>'usuarios_sin_par')::bigint, 0) + 1));
    else
      insert into public.crm_ids_externos (tenant_id, sistema, tipo, id_externo, usuario_id)
      values (p_tenant, 'kommo', 'usuario', k.id, v_asesor);
      v_c := pg_catalog.jsonb_set(v_c, '{usuarios_mapeados}', pg_catalog.to_jsonb(coalesce((v_c->>'usuarios_mapeados')::bigint, 0) + 1));
    end if;
  end loop;

  -- ─── 2. Leads, del más reciente al más viejo: el primero de cada persona fija la etapa ──────────────────
  for l in
    select kl.*, greatest(kl.kommo_updated_at, kl.last_inbound_at, kl.last_outbound_at, kl.kommo_created_at) as act
    from public.kommo_leads kl
    where kl.tenant_id = p_tenant
    order by act desc nulls last, kl.id
  loop
    v_c := pg_catalog.jsonb_set(v_c, '{leads_en_espejo}', pg_catalog.to_jsonb(coalesce((v_c->>'leads_en_espejo')::bigint, 0) + 1));
    v_act := l.act;

    -- Alcance (D4 a): abiertos, con actividad en la ventana, creados hasta el corte.
    if l.status_id in (142, 143) or l.closed_at is not null then
      v_c := pg_catalog.jsonb_set(v_c, '{leads_cerrados}', pg_catalog.to_jsonb(coalesce((v_c->>'leads_cerrados')::bigint, 0) + 1));
      continue;
    end if;
    if l.kommo_created_at > p_corte then
      v_c := pg_catalog.jsonb_set(v_c, '{leads_despues_del_corte}', pg_catalog.to_jsonb(coalesce((v_c->>'leads_despues_del_corte')::bigint, 0) + 1));
      continue;
    end if;
    if v_act is null or v_act < v_desde then
      v_c := pg_catalog.jsonb_set(v_c, '{leads_fuera_de_ventana}', pg_catalog.to_jsonb(coalesce((v_c->>'leads_fuera_de_ventana')::bigint, 0) + 1));
      continue;
    end if;
    v_etapa := v_mapa->>(l.status_id::text);
    if v_etapa is null then
      v_c := pg_catalog.jsonb_set(v_c, '{leads_etapa_desconocida}', pg_catalog.to_jsonb(coalesce((v_c->>'leads_etapa_desconocida')::bigint, 0) + 1));
      continue;
    end if;
    v_c := pg_catalog.jsonb_set(v_c, '{leads_en_alcance}', pg_catalog.to_jsonb(coalesce((v_c->>'leads_en_alcance')::bigint, 0) + 1));

    -- ¿Ya migrado? Solo faltan sus tareas nuevas (paso 3).
    select x.tarjeta_id into v_tarjeta from public.crm_ids_externos x
    where x.tenant_id = p_tenant and x.sistema = 'kommo' and x.tipo = 'lead' and x.id_externo = l.id;
    if found then
      v_c := pg_catalog.jsonb_set(v_c, '{leads_ya_migrados}', pg_catalog.to_jsonb(coalesce((v_c->>'leads_ya_migrados')::bigint, 0) + 1));
    else
      -- La persona: contacto principal del lead, y su ficha por el vínculo, el contacto o el teléfono.
      select lc.contact_id into v_contact from public.kommo_lead_contacts lc
      where lc.tenant_id = p_tenant and lc.lead_id = l.id
      order by lc.is_main desc, lc.contact_id limit 1;
      v_phone := null; v_nombre := null;
      if v_contact is not null then
        select c.phone_last10, nullif(pg_catalog.left(pg_catalog.btrim(coalesce(c.name, '')), 120), '')
          into v_phone, v_nombre
        from public.kommo_contacts c where c.tenant_id = p_tenant and c.id = v_contact;
      end if;
      -- El índice único parcial de la 0108 no deja dos vivas; si las hay, la base no es la que se espera.
      select pg_catalog.count(*), (pg_catalog.array_agg(c.id))[1] into v_n, v_client from public.clients c
      where c.tenant_id = p_tenant and c.kommo_lead_id = l.id and c.deleted_at is null;
      if v_n > 1 then
        raise exception 'carga kommo→crm: hay más de una ficha viva con el mismo kommo_lead_id';
      end if;
      if v_client is null and v_contact is not null then
        select case when pg_catalog.count(*) = 1 then (pg_catalog.array_agg(c.id))[1] end into v_client
        from public.clients c
        where c.tenant_id = p_tenant and c.kommo_contact_id = v_contact and c.deleted_at is null;
      end if;
      if v_client is null and v_phone is not null then
        v_client := public.crm_ficha_por_telefono(p_tenant, v_phone);
      end if;

      -- La tarjeta: la del contacto ya migrado, la de la ficha o la única sin ficha con ese teléfono.
      v_tarjeta := null;
      if v_contact is not null then
        select x.tarjeta_id into v_tarjeta from public.crm_ids_externos x
        where x.tenant_id = p_tenant and x.sistema = 'kommo' and x.tipo = 'contacto' and x.id_externo = v_contact;
      end if;
      if v_tarjeta is null and v_client is not null then
        select t.id into v_tarjeta from public.crm_tarjetas t where t.tenant_id = p_tenant and t.client_id = v_client;
      end if;
      if v_tarjeta is null and v_client is null and v_phone is not null then
        select pg_catalog.count(*), (pg_catalog.array_agg(t.id))[1] into v_n, v_tarjeta
        from public.crm_tarjetas t
        where t.tenant_id = p_tenant and t.client_id is null and t.anonimizada_at is null and t.phone_last10 = v_phone;
        if v_n > 1 then
          -- No se adivina (§5.3): queda para revisar a mano y en el acta.
          v_c := pg_catalog.jsonb_set(v_c, '{leads_ambiguos}', pg_catalog.to_jsonb(coalesce((v_c->>'leads_ambiguos')::bigint, 0) + 1));
          continue;
        end if;
      end if;

      if v_tarjeta is not null then
        if exists (select 1 from public.crm_tarjetas t where t.id = v_tarjeta and t.anonimizada_at is not null) then
          v_c := pg_catalog.jsonb_set(v_c, '{leads_tarjeta_anonimizada}', pg_catalog.to_jsonb(coalesce((v_c->>'leads_tarjeta_anonimizada')::bigint, 0) + 1));
          continue;
        end if;
        -- Gana la etapa de la tarjeta (§5.3). Se completa el asesor vacío y la última actividad.
        select public.crm_asesor_activo(p_tenant, x.usuario_id) into v_asesor from public.crm_ids_externos x
        where x.tenant_id = p_tenant and x.sistema = 'kommo' and x.tipo = 'usuario' and x.id_externo = l.responsible_user_id;
        if v_asesor is not null then
          update public.crm_tarjetas t set asesor_id = v_asesor
          where t.id = v_tarjeta and t.asesor_id is null;
          if found then
            v_c := pg_catalog.jsonb_set(v_c, '{asesor_completado}', pg_catalog.to_jsonb(coalesce((v_c->>'asesor_completado')::bigint, 0) + 1));
          end if;
        end if;
        update public.crm_tarjetas t
        set ultima_actividad_at = greatest(t.ultima_actividad_at, v_act)
        where t.id = v_tarjeta and t.ultima_actividad_at < v_act;
        if exists (select 1 from public.crm_ids_externos x where x.tarjeta_id = v_tarjeta and x.tipo = 'lead') then
          v_c := pg_catalog.jsonb_set(v_c, '{leads_misma_persona}', pg_catalog.to_jsonb(coalesce((v_c->>'leads_misma_persona')::bigint, 0) + 1));
        else
          v_c := pg_catalog.jsonb_set(v_c, '{tarjetas_existentes}', pg_catalog.to_jsonb(coalesce((v_c->>'tarjetas_existentes')::bigint, 0) + 1));
        end if;
      else
        if v_client is null and v_phone is null then
          -- Sin ficha ni teléfono no hay cómo ubicar a la persona (check de la 0506).
          v_c := pg_catalog.jsonb_set(v_c, '{leads_sin_ubicador}', pg_catalog.to_jsonb(coalesce((v_c->>'leads_sin_ubicador')::bigint, 0) + 1));
          continue;
        end if;
        select public.crm_asesor_activo(p_tenant, x.usuario_id) into v_asesor from public.crm_ids_externos x
        where x.tenant_id = p_tenant and x.sistema = 'kommo' and x.tipo = 'usuario' and x.id_externo = l.responsible_user_id;
        if not found then v_asesor := null; end if;
        insert into public.crm_tarjetas (
          tenant_id, client_id, nombre_visible, phone_last10, etapa_leads, etapa_leads_at,
          asesor_id, fuente, fuente_detalle, ultima_actividad_at)
        values (
          p_tenant, v_client,
          case when v_client is null then v_nombre end,
          case when v_client is null then v_phone end,
          v_etapa, coalesce(l.kommo_updated_at, v_act), v_asesor, 'kommo',
          nullif(pg_catalog.left(pg_catalog.btrim(coalesce(l.last_message_origin, '')), 120), ''), v_act)
        on conflict (tenant_id, client_id) where client_id is not null do nothing
        returning id into v_tarjeta;
        if v_tarjeta is null then
          -- Otra escritura creó la tarjeta de esa ficha en el medio: gana la suya.
          select t.id into v_tarjeta from public.crm_tarjetas t where t.tenant_id = p_tenant and t.client_id = v_client;
          v_c := pg_catalog.jsonb_set(v_c, '{tarjetas_existentes}', pg_catalog.to_jsonb(coalesce((v_c->>'tarjetas_existentes')::bigint, 0) + 1));
        else
          insert into public.crm_historial_etapas (tenant_id, tarjeta_id, tablero, de, a, origen, ocurrio_at)
          values (p_tenant, v_tarjeta, 'leads', null, v_etapa, 'migracion', coalesce(l.kommo_updated_at, v_act));
          v_c := pg_catalog.jsonb_set(v_c, '{tarjetas_creadas}', pg_catalog.to_jsonb(coalesce((v_c->>'tarjetas_creadas')::bigint, 0) + 1));
          v_c := pg_catalog.jsonb_set(v_c, array['etapa_' || v_etapa], pg_catalog.to_jsonb(coalesce((v_c->>('etapa_' || v_etapa))::bigint, 0) + 1));
          if v_client is null then
            v_c := pg_catalog.jsonb_set(v_c, '{tarjetas_sin_ficha}', pg_catalog.to_jsonb(coalesce((v_c->>'tarjetas_sin_ficha')::bigint, 0) + 1));
          else
            v_c := pg_catalog.jsonb_set(v_c, '{tarjetas_con_ficha}', pg_catalog.to_jsonb(coalesce((v_c->>'tarjetas_con_ficha')::bigint, 0) + 1));
          end if;
          if v_asesor is not null then
            v_c := pg_catalog.jsonb_set(v_c, '{tarjetas_con_asesor}', pg_catalog.to_jsonb(coalesce((v_c->>'tarjetas_con_asesor')::bigint, 0) + 1));
          end if;
        end if;
      end if;

      insert into public.crm_ids_externos (tenant_id, sistema, tipo, id_externo, tarjeta_id)
      values (p_tenant, 'kommo', 'lead', l.id, v_tarjeta);
      v_c := pg_catalog.jsonb_set(v_c, '{mapeos_lead}', pg_catalog.to_jsonb(coalesce((v_c->>'mapeos_lead')::bigint, 0) + 1));
      if v_contact is not null then
        insert into public.crm_ids_externos (tenant_id, sistema, tipo, id_externo, tarjeta_id)
        values (p_tenant, 'kommo', 'contacto', v_contact, v_tarjeta)
        on conflict (tenant_id, sistema, tipo, id_externo) do nothing;
        if found then
          v_c := pg_catalog.jsonb_set(v_c, '{mapeos_contacto}', pg_catalog.to_jsonb(coalesce((v_c->>'mapeos_contacto')::bigint, 0) + 1));
        end if;
      end if;
    end if;

    -- ─── 3. Tareas abiertas del lead que todavía no se migraron ───────────────────────────────────────
    for k in
      select kt.* from public.kommo_tasks kt
      where kt.tenant_id = p_tenant and kt.entity_type = 'leads' and kt.entity_id = l.id and not kt.is_completed
        and not exists (select 1 from public.crm_ids_externos x
                        where x.tenant_id = p_tenant and x.sistema = 'kommo' and x.tipo = 'tarea' and x.id_externo = kt.id)
      order by kt.id
    loop
      v_asesor := null;
      select public.crm_asesor_activo(p_tenant, x.usuario_id) into v_asesor from public.crm_ids_externos x
      where x.tenant_id = p_tenant and x.sistema = 'kommo' and x.tipo = 'usuario' and x.id_externo = k.responsible_user_id;
      -- Kommo manda segundos; un vencimiento en milisegundos cae en el año 57.000 y es «nunca vence» (0390).
      v_vence := case when k.complete_till > p_corte + interval '20 years' then null else k.complete_till end;
      insert into public.crm_tareas (tenant_id, tarjeta_id, texto, vence_at, asignado_a, origen)
      values (p_tenant, v_tarjeta,
              coalesce(nullif(pg_catalog.btrim(pg_catalog.left(pg_catalog.btrim(coalesce(k.text, '')), 1000)), ''), 'Tarea de Kommo'),
              v_vence, v_asesor, 'migracion')
      returning id into v_tarea;
      insert into public.crm_ids_externos (tenant_id, sistema, tipo, id_externo, tarea_id)
      values (p_tenant, 'kommo', 'tarea', k.id, v_tarea);
      v_c := pg_catalog.jsonb_set(v_c, '{tareas_creadas}', pg_catalog.to_jsonb(coalesce((v_c->>'tareas_creadas')::bigint, 0) + 1));
      if v_vence is null then
        v_c := pg_catalog.jsonb_set(v_c, '{tareas_sin_vencimiento}', pg_catalog.to_jsonb(coalesce((v_c->>'tareas_sin_vencimiento')::bigint, 0) + 1));
      end if;
    end loop;
  end loop;

  -- ─── 4. Comprobaciones: todo lead mapeado apunta a una tarjeta viva del tenant ──────────────────────────
  if exists (
    select 1 from public.crm_ids_externos x
    left join public.crm_tarjetas t on t.id = x.tarjeta_id and t.tenant_id = x.tenant_id
    where x.tenant_id = p_tenant and x.sistema = 'kommo' and x.tipo in ('lead', 'contacto') and t.id is null
  ) then
    raise exception 'carga kommo→crm: hay un mapeo de lead o contacto sin tarjeta del tenant';
  end if;
  v_c := pg_catalog.jsonb_set(v_c, '{total_mapeos_kommo}', pg_catalog.to_jsonb(
    (select pg_catalog.count(*) from public.crm_ids_externos x where x.tenant_id = p_tenant and x.sistema = 'kommo')));
  v_c := pg_catalog.jsonb_set(v_c, '{total_tarjetas_kommo}', pg_catalog.to_jsonb(
    (select pg_catalog.count(*) from public.crm_tarjetas t where t.tenant_id = p_tenant and t.fuente = 'kommo')));

  return query select e.key, (e.value #>> '{}')::bigint from pg_catalog.jsonb_each(v_c) e order by e.key;
end;
$carga$;

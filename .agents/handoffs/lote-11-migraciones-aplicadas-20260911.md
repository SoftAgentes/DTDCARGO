# Lote de 11 migraciones aplicadas a producción — registro en Git · 2026-09-11

- **Owner / sesión escritora:** `registro-lote-worker-20260911-claude` (Worker).
- **Worktree:** `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\c-registro-lote-20260911`.
- **Rama:** `codex/c-registro-lote-20260911`, creada desde `origin/main` `543bbe0a`.
- **Alcance de ESTA tarea:** sólo el registro en Git. No tocó producción, ni ninguna migración,
  ni ejecutó nada contra Supabase.
- **Quién aplicó:** el Director, en otra sesión, de a una y conforme a
  `docs/runbooks/aplicar-migraciones-prod.md`. Proyecto `xpfuzqombmjmxvprjgmi`.
- **SDD afectadas (sólo su nota, nunca el frontmatter ni el `status`):** 0351, 0361, 0363, 0368,
  0381, 0382, 0385, 0400, 0401, 0402 y 0456.

## Autorización de Sam

Sam eligió la opción que **nombra las 11 migraciones** y pidió **aplicarlas de a una**. La
selección registrada es: las 10 migraciones que quedaban pendientes en `main` más
`0450_clients_aliado_mismo_tenant`, en este orden:

`0419` → `0430` → `0432` → `0434` → `0417` → `0429` → `0424` → `0431` → `0433` → `0408` → `0450`.

Las versiones del ledger respetan ese orden. La autorización de aplicar no autoriza merge ni
despliegue: son permisos distintos, y esta PR es sólo registro.

## Evidencia del ledger de producción

En todas, el md5 y el tamaño guardados en el ledger coinciden con el archivo de `main`. Este
Worker verificó además, en la rama, que `md5sum` y `wc -c` de los 11 archivos dan exactamente
esos valores (11 de 11 OK).

| Migración | version | md5 | bytes |
|---|---|---|---|
| 0419_portal_reclamos_tenant_boundary | 20260911235547 | cd137f13102ea292ef792942dd743e20 | 3949 |
| 0430_portal_profile_change_requests_principal_tenant | 20260911235728 | a0c4fd9e747a1027ae269d4f5052d01a | 2818 |
| 0432_portal_warehouse_boxes_tenant_boundary | 20260911235835 | e1de56e0c3888a5b4941b184b7e94426 | 2706 |
| 0434_portal_prealerta_addons_principal_tenant | 20260911235932 | f59e054988b67b57a3f52af1807aa93d | 3233 |
| 0417_portal_prealertas_tenant_boundary | 20260912000050 | ae8b073dbf2df372603b240d1758dc40 | 7767 |
| 0429_portal_service_requests_principal_tenant | 20260912000143 | 021402cccdc04332146975dc6d9ae286 | 3941 |
| 0424_portal_club_principal_tenant | 20260912000248 | 7dc9f0fa324ac8b1892b97b4f09a139c | 6696 |
| 0431_portal_post_message_principal_tenant | 20260912000336 | b780bad79bc4c4179bab2233efec64bc | 6041 |
| 0433_portal_conversation_realtime_principal_tenant | 20260912000449 | 668e8de4389cd11c420e227258c67524 | 5633 |
| 0408_mailing_admin_rbac | 20260912000826 | 8b9baa29ad0e9d1d54cc69238d85d2bb | 14337 |
| 0450_clients_aliado_mismo_tenant | 20260912001001 | 47c7fccc94d1208ad0ad4c8afcbe67e0 | 9264 |

Según el cierre del Director, el ledger quedó con **441 entradas** y los advisors de seguridad se
volcaron completos antes y después: 4 lints antes y 4 después, ninguno nuevo y ninguno resuelto;
22 funciones `SECURITY DEFINER` ejecutables por `anon` antes y después, lista idéntica; 168 para
`authenticated` antes y 168 después, con dos cambios intencionales — entró
`portal_can_read_conversation_message` (la crea 0433) y salió `mail_check_blacklist` (0408 le
retira el EXECUTE a `authenticated`).

## Qué cierra cada una y cómo se verificó

Cada bloque toma «qué cierra» del estado previo capturado y la verificación de las notas del
Director (`NOTAS.md` del lote).

### 0419_portal_reclamos_tenant_boundary · SDD-0363 · L13 · `20260911235547`

**Qué cierra.** Las dos policies SELECT del Portal sobre `client_claims` y
`client_claim_evidence` ligaban la lectura sólo por Shipping Mark, que no es único entre tenants.
Ahora exigen vínculo en `client_users`, `auth.uid()`, tenant y cliente coherentes.

**Verificación.** 4 policies en las dos tablas; las 2 del Portal cumplen el criterio del
postflight (`client_users` + `auth.uid()` + `tenant_id` + `client_id` + `client_markbox`, sin
`WITH CHECK`); 0 policies Portal siguen usando `get_portal_client_markbox`; las 2 «by tenant»
intactas; RLS activa y ACL sin cambios. El ledger registró 1 sentencia.

### 0430_portal_profile_change_requests_principal_tenant · SDD-0382 · L18 · `20260911235728`

**Qué cierra.** La lectura de perfil y de solicitudes de cambio del Portal confiaba en
`get_portal_client_id()` sin comparar el tenant del vínculo con el del cliente.

**Verificación.** «clients portal self read» ya usa `client_users` + `auth.uid()` + `tenant_id` y
no `get_portal_client_id`; «client_change_requests self or tenant read» exige además
`source='client'`; «clients by tenant» intacta; RLS activa en ambas tablas.

### 0432_portal_warehouse_boxes_tenant_boundary · SDD-0400 · L20 · `20260911235835`

**Qué cierra.** La policy Portal de `warehouse_boxes` obtenía tenant y Shipping Mark de dos
helpers independientes, así que un vínculo incoherente podía combinar el tenant de la membresía
con el markbox de un cliente de otro tenant.

**Verificación.** La policy Portal cumple el postflight (`client_users`, `clients`, `auth.uid()`,
`tenant_id`, `markbox`, `deleted_at`); 0 policies de la tabla usan ya helpers
`get_portal_client_*`; «warehouse_boxes by tenant» intacta; 2 policies en total; RLS activa y ACL
sin cambios.

### 0434_portal_prealerta_addons_principal_tenant · SDD-0402 · L22 · `20260911235932`

**Qué cierra.** La rama Portal de la policy SELECT «prealerta_addons read» autorizaba con
`get_portal_client_tenant()`, que sólo lee el tenant de `client_users`: un vínculo activo de
tenant A hacia un cliente de B podía leer el catálogo de A. Ahora exige principal coherente
(vínculo activo, cliente vivo y mismo tenant), y conserva rama de equipo, escritura,
`service_role`, ACL y RLS.

**Verificación.** ⚠️ **La única del lote sin verificación por objeto escrita.** `NOTAS.md` trae su
captura de estado previo y su reversión, pero **no** una sección «0434 — APLICADA Y VERIFICADA»
como las otras diez. Lo que sí consta: la fila del ledger `20260911235932` con md5
`f59e054988b67b57a3f52af1807aa93d` y 3233 B, iguales al archivo de `main` (revalidado en esta
rama); su posición entre 0432 y 0417 respeta el orden autorizado; el cierre del Director afirma
«11 de 11 aplicadas y verificadas»; y el volcado de advisors posterior no muestra ningún lint
nuevo. **Queda pendiente dejar por escrito el detalle contra el objeto** (ver PENDIENTES).

### 0417_portal_prealertas_tenant_boundary · SDD-0361 · L11 · `20260912000050`

**Qué cierra.** Siete policies Portal de `suppliers_cn`, `prealertas` y `prealerta_documents`
seleccionaban por markbox, y el UPDATE comprobaba tenant sólo en la fila resultante, no en la
original. Se aplicó **antes** de 0429, como exigía el orden declarado.

**Verificación.** Las 7 policies Portal cumplen el postflight, incluido `with_check = qual` en
los UPDATE; 0 usan ya helpers `get_portal_client_*`; las 8 policies de equipo y `service_role`
intactas; RLS y ACL sin cambios.

### 0429_portal_service_requests_principal_tenant · SDD-0381 · L11 · `20260912000143`

**Qué cierra.** Las tres policies Portal de `prealerta_service_requests` permitían leerse y
reasignarse filas de otro cliente con el mismo Shipping Mark, porque el USING sólo miraba markbox.
Se aplicó **después** de 0417, porque su contrato la incluye.

**Verificación.** 3 policies Portal nuevas: el INSERT conserva `consent_accepted` y el UPDATE
valida la fila original y la resultante; 3 de equipo y `service_role` intactas; RLS y ACL sin
cambios.

### 0424_portal_club_principal_tenant · SDD-0368 · L15 · `20260912000248`

**Qué cierra.** El helper `get_portal_person_id()` de 0187 resolvía la persona sin comparar el
tenant del vínculo, del cliente y de la persona. Se reemplazó sólo el cuerpo, con
`CREATE OR REPLACE`, para conservar las seis policies dependientes.

**Verificación.** `get_portal_person_id()` con md5 de cuerpo `4dca9b6a048929d7fcfaf2314c6ff61f`
—el que exige su postflight—, `search_path=""`, `SECURITY DEFINER`, `STABLE`, owner `postgres`,
ACL intacta `{postgres=X, service_role=X, authenticated=X}` y `anon` sin EXECUTE; 6 policies
dependientes conservadas; 12 policies de Club intactas; comentario SDD-0368 puesto.

### 0431_portal_post_message_principal_tenant · SDD-0385 · L19 · `20260912000336`

**Qué cierra.** `portal_post_message(text)` derivaba el cliente con `get_portal_client_id()` y
confiaba después en el tenant de ese cliente, así que un vínculo administrativo incoherente creaba
conversación y mensaje para otro cliente.

**Verificación.** `search_path=pg_catalog, public`; definición endurecida verificada
(`client_users` + tenant coherente + cliente vivo + `auth.uid()`, sin `get_portal_client_id`);
`authenticated` y `service_role` con EXECUTE, `anon` y `PUBLIC` sin él; comentario SDD-0385.

### 0433_portal_conversation_realtime_principal_tenant · SDD-0401 · L21 · `20260912000449`

**Qué cierra.** La policy SELECT «conv_messages portal client read own» filtraba con una
subconsulta a `conversations` que el principal Portal no podía leer, así que Realtime no entregaba
mensajes; y `get_portal_client_id()` no comparaba tenants. Crea la función booleana
`portal_can_read_conversation_message(uuid,uuid)` y sustituye la expresión de la policy.

**Verificación.** `portal_can_read_conversation_message(uuid,uuid)`: `boolean`,
`SECURITY DEFINER`, `STABLE`, `search_path` vacío, ACL `{postgres=X, authenticated=X}`; `anon`,
`service_role` y `PUBLIC` sin EXECUTE; comentario SDD-0401. La policy de Realtime usa el helper y
ya no `get_portal_client_id`. Las otras dos policies de `conversation_messages` intactas.

### 0408_mailing_admin_rbac · SDD-0351 · L08 · `20260912000826`

**Qué cierra.** Mailing es admin-only en la aplicación, pero la base daba CRUD por tenant a
cualquier sesión `authenticated` sobre plantillas, firmas, reglas, configuración, lista negra y
programados, y `authenticated` tenía EXECUTE sobre `mail_check_blacklist`. La auditoría de
consumidores se revalidó contra el `main` vigente (`4eedeb8a`): segura.

**Verificación.** 21 policies admin y 4 de `service_role`, 25 en total, y **ninguna** policy extra
para `authenticated` o `public` —la comprobación que pedía la auditoría—; las 21 exigen
`current_studio_role` admin más tenant activo. ACL de `authenticated`: `arwd` en templates,
signatures, rules y scheduled; `rw` en config; `ard` en blacklist — sin TRUNCATE, sin
INSERT/DELETE en config, sin UPDATE en blacklist. `mail_check_blacklist` y
`mail_increment_template_metrics`: sólo `service_role` con EXECUTE. `mail_logs` sin tocar, con sus
5 policies intactas. Comentarios puestos.

### 0450_clients_aliado_mismo_tenant · SDD-0456 · `20260912001001`

**Qué cierra.** `clients.aliado_id` podía apuntar a un aliado de otro tenant, y la marca
white-label se resuelve por ese vínculo: un comprobante o una etiqueta podían salir con la marca de
otra empresa. Añade la FK compuesta `(tenant_id, aliado_id) → aliados (tenant_id, id)`.

**Verificación.** `aliados_tenant_id_id_key`: UNIQUE `(tenant_id, id)` con su comentario.
`clients_aliado_mismo_tenant_fkey`: FOREIGN KEY `(tenant_id, aliado_id)` REFERENCES
`aliados(tenant_id, id)`, MATCH SIMPLE, ON DELETE RESTRICT, ON UPDATE NO ACTION, **validada**, con
su comentario. La FK simple `clients_aliado_id_fkey` de 0362 se conserva, así que el embed
PostgREST `aliados:aliado_id` sigue resolviendo.

## SQL de reversión

> ⚠️ **Advertencia común.** Cada bloque se capturó **de producción y antes de aplicar**: es el
> único artefacto de reversión, porque el estado previo sólo existía en la base. Ninguno retira la
> fila del ledger; si se revierte, hay que registrarlo aparte. Sólo se ejecutan con OK nominal de
> Sam y en una transacción. **Antes de usar cualquiera hay que evaluar la compatibilidad**: cada
> bloque conserva su propia advertencia, y varias reversiones reabren lecturas o escrituras que la
> migración cerró.

### 0419 — reversión

```sql
-- ROLLBACK de 0419_portal_reclamos_tenant_boundary
-- Capturado de producción (pg_policies) el 2026-09-11, ANTES de aplicar. Proyecto: xpfuzqombmjmxvprjgmi.
-- Restituye las expresiones previas de las dos policies SELECT del Portal.
-- 0419 no cambia DML, ACL, RLS, funciones ni triggers: no hay nada más que revertir.
-- Ejecutar en una sola transacción y SOLO con OK nominal de Sam.
-- Al revertir, la lectura del Portal vuelve a ligarse solo por Shipping Mark, sin tenant ni vínculo activo.
-- La fila del ledger NO se revierte con este SQL. Registrar la reversión aparte.
begin;

alter policy "client_claims portal self read" on public.client_claims
  using ((deleted_at is null) and (client_markbox = public.get_portal_client_markbox()));

alter policy "client_claim_evidence portal self read" on public.client_claim_evidence
  using ((deleted_at is null) and (client_markbox is not null)
    and (client_markbox = public.get_portal_client_markbox()));

commit;
```

### 0430 — reversión

```sql
-- ROLLBACK de 0430_portal_profile_change_requests_principal_tenant
-- Capturado de producción (pg_policies) el 2026-09-11, ANTES de aplicar. Proyecto: xpfuzqombmjmxvprjgmi.
-- Solo restituye las dos policies SELECT previas. 0430 no cambia DML, ACL ni RLS.
-- Ejecutar en una transacción y SOLO con OK nominal de Sam. La fila del ledger no se revierte aquí.
begin;

alter policy "clients portal self read" on public.clients
  using ((deleted_at is null) and (id = public.get_portal_client_id()));

alter policy "client_change_requests self or tenant read" on public.client_change_requests
  using ((client_id = public.get_portal_client_id()) or (tenant_id = public.get_user_tenant_id()));

commit;
```

### 0432 — reversión

```sql
-- ROLLBACK de 0432_portal_warehouse_boxes_tenant_boundary
-- Capturado de producción (pg_policies) el 2026-09-11, ANTES de aplicar. Proyecto: xpfuzqombmjmxvprjgmi.
-- Solo restituye la policy SELECT del Portal. La policy de equipo, la RLS y la ACL no cambian.
-- Ejecutar en una transacción y SOLO con OK nominal de Sam. La fila del ledger no se revierte aquí.
begin;

alter policy "warehouse_boxes portal self read" on public.warehouse_boxes
  using ((tenant_id = public.get_portal_client_tenant())
    and (markbox = public.get_portal_client_markbox())
    and (deleted_at is null));

commit;
```

### 0434 — reversión

```sql
-- ROLLBACK de 0434_portal_prealerta_addons_principal_tenant
-- Capturado de producción (pg_policies) el 2026-09-11, ANTES de aplicar. Proyecto: xpfuzqombmjmxvprjgmi.
-- Restituye la policy SELECT completa previa, con sus dos ramas: equipo y Portal por tenant.
-- Las policies de escritura y de service_role, la RLS y la ACL no cambian.
-- Ejecutar en una transacción y SOLO con OK nominal de Sam. La fila del ledger no se revierte aquí.
begin;

alter policy "prealerta_addons read" on public.prealerta_addons
  using ((tenant_id = public.get_user_tenant_id()) or (tenant_id = public.get_portal_client_tenant()));

commit;
```

### 0417 — reversión

```sql
-- ROLLBACK de 0417_portal_prealertas_tenant_boundary
-- Capturado de producción (pg_policies) el 2026-09-11, ANTES de aplicar. Proyecto: xpfuzqombmjmxvprjgmi.
-- Restituye las siete policies Portal previas. Las de equipo y de service_role, la RLS y la ACL no cambian.
-- Ejecutar en una transacción y SOLO con OK nominal de Sam. La fila del ledger no se revierte aquí.
-- OJO: si ya se aplicó 0429, revertir 0417 deja incoherente su contrato; evaluar antes.
begin;

alter policy "suppliers_cn portal self select" on public.suppliers_cn
  using ((deleted_at is null) and (client_markbox = public.get_portal_client_markbox()));

alter policy "suppliers_cn portal self insert" on public.suppliers_cn
  with check ((tenant_id = public.get_portal_client_tenant())
    and (client_markbox = public.get_portal_client_markbox()));

alter policy "suppliers_cn portal self update" on public.suppliers_cn
  using ((client_markbox = public.get_portal_client_markbox()))
  with check ((tenant_id = public.get_portal_client_tenant())
    and (client_markbox = public.get_portal_client_markbox()));

alter policy "prealertas portal self select" on public.prealertas
  using ((deleted_at is null) and (client_markbox = public.get_portal_client_markbox()));

alter policy "prealertas portal self insert" on public.prealertas
  with check ((tenant_id = public.get_portal_client_tenant())
    and (client_markbox = public.get_portal_client_markbox()));

alter policy "prealertas portal self update" on public.prealertas
  using ((client_markbox = public.get_portal_client_markbox()))
  with check ((tenant_id = public.get_portal_client_tenant())
    and (client_markbox = public.get_portal_client_markbox()));

alter policy "prealerta_documents portal self read" on public.prealerta_documents
  using ((deleted_at is null) and (client_markbox is not null)
    and (client_markbox = public.get_portal_client_markbox()));

commit;
```

### 0429 — reversión

```sql
-- ROLLBACK de 0429_portal_service_requests_principal_tenant
-- Capturado de producción (pg_policies) el 2026-09-11, ANTES de aplicar. Proyecto: xpfuzqombmjmxvprjgmi.
-- Restituye las tres policies Portal previas de prealerta_service_requests.
-- Las de equipo y de service_role, la RLS y la ACL no cambian.
-- Ejecutar en una transacción y SOLO con OK nominal de Sam. La fila del ledger no se revierte aquí.
begin;

alter policy "psr portal self select" on public.prealerta_service_requests
  using ((deleted_at is null) and (client_markbox = public.get_portal_client_markbox()));

alter policy "psr portal self insert" on public.prealerta_service_requests
  with check ((tenant_id = public.get_portal_client_tenant())
    and (client_markbox = public.get_portal_client_markbox())
    and (consent_accepted = true));

alter policy "psr portal self update" on public.prealerta_service_requests
  using ((client_markbox = public.get_portal_client_markbox()))
  with check ((tenant_id = public.get_portal_client_tenant())
    and (client_markbox = public.get_portal_client_markbox()));

commit;
```

### 0424 — reversión

```sql
-- ROLLBACK de 0424_portal_club_principal_tenant
-- Cuerpo capturado de producción (pg_get_functiondef) el 2026-09-11, ANTES de aplicar.
-- Proyecto: xpfuzqombmjmxvprjgmi. Es el cuerpo histórico de 0187 (md5 d6d407d74ea4426a960fe03991625b35).
-- CREATE OR REPLACE conserva OID, owner, ACL y las 6 policies dependientes.
-- Ejecutar en una transacción y SOLO con OK nominal de Sam. La fila del ledger no se revierte aquí.
-- Al revertir, las seis lecturas Portal de Club vuelven a no exigir vínculo activo ni tenant coherente.
begin;

CREATE OR REPLACE FUNCTION public.get_portal_person_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select c.person_id
  from public.clients c
  where c.id = public.get_portal_client_id()
    and c.deleted_at is null
  limit 1
$function$;

commit;
```

### 0431 — reversión

```sql
-- ROLLBACK de 0431_portal_post_message_principal_tenant
-- Cuerpo capturado de producción (pg_get_functiondef) el 2026-09-11, ANTES de aplicar.
-- Proyecto: xpfuzqombmjmxvprjgmi. md5 del cuerpo previo: 1eaa70bff7c569ad0266ec45a5d29c04.
-- CREATE OR REPLACE conserva firma, retorno uuid, SECURITY DEFINER, owner y ACL.
-- Ejecutar en una transacción y SOLO con OK nominal de Sam. La fila del ledger no se revierte aquí.
begin;

CREATE OR REPLACE FUNCTION public.portal_post_message(p_body text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_client_id uuid;
  v_tenant    uuid;
  v_name      text;
  v_conv_id   uuid;
  v_ref       text;
  v_body      text := trim(coalesce(p_body, ''));
begin
  if v_body = '' then
    raise exception 'El mensaje no puede estar vacío';
  end if;
  if length(v_body) > 4000 then
    raise exception 'El mensaje es demasiado largo (máx 4000)';
  end if;

  v_client_id := public.get_portal_client_id();
  if v_client_id is null then
    raise exception 'No autorizado: la sesión no es un cliente del portal' using errcode = '42501';
  end if;

  select c.tenant_id, c.name into v_tenant, v_name
  from public.clients c
  where c.id = v_client_id and c.deleted_at is null;
  if v_tenant is null then
    raise exception 'Cliente no encontrado';
  end if;

  select id into v_conv_id
  from public.conversations
  where tenant_id = v_tenant and client_id = v_client_id
    and channel = 'portal' and deleted_at is null
  limit 1;

  if v_conv_id is null then
    v_ref := public.next_conversation_ref(v_tenant);
    insert into public.conversations (tenant_id, client_id, ref, channel, status, last_message_at, unread_count)
    values (v_tenant, v_client_id, v_ref, 'portal', 'abierto', now(), 0)
    returning id into v_conv_id;
  end if;

  insert into public.conversation_messages (tenant_id, conversation_id, direction, author_name, body, sent_at)
  values (v_tenant, v_conv_id, 'in', v_name, v_body, now());

  update public.conversations
  set last_message_at = now(),
      unread_count = unread_count + 1,
      status = case when status = 'resuelto' then 'abierto' else status end
  where id = v_conv_id;

  return v_conv_id;
end;
$function$;

commit;
```

### 0433 — reversión

```sql
-- ROLLBACK de 0433_portal_conversation_realtime_principal_tenant
-- Capturado de producción (pg_policies, pg_proc) el 2026-09-11, ANTES de aplicar.
-- Proyecto: xpfuzqombmjmxvprjgmi.
-- Restituye la policy SELECT previa de conversation_messages y elimina la función nueva,
-- que antes de aplicar NO existía (verificado con to_regprocedure).
-- Ejecutar en una transacción y SOLO con OK nominal de Sam. La fila del ledger no se revierte aquí.
begin;

alter policy "conv_messages portal client read own" on public.conversation_messages
  using (conversation_id in (
    select c.id from public.conversations c
    where (c.client_id = public.get_portal_client_id())
      and (c.channel = 'portal'::conversation_channel)
      and (c.deleted_at is null)));

drop function if exists public.portal_can_read_conversation_message(uuid, uuid);

commit;
```

### 0408 — reversión

```sql
-- ROLLBACK de 0408_mailing_admin_rbac
-- Capturado de producción (pg_policies, pg_class.relacl, pg_proc.proacl, obj_description)
-- el 2026-09-11, ANTES de aplicar. Proyecto: xpfuzqombmjmxvprjgmi.
-- Ejecutar en una sola transacción y SOLO con OK nominal de Sam.
-- ADVERTENCIA: esto devuelve a CUALQUIER sesión authenticated del tenant el CRUD de plantillas,
-- firmas, reglas, configuración, blacklist y programados por PostgREST, y devuelve a authenticated
-- el EXECUTE de mail_check_blacklist, que permite consultar la blacklist de un tenant elegido.
-- La fila del ledger NO se revierte con este SQL. Registrar la reversión aparte.
begin;

-- Plantillas
drop policy if exists mail_templates_admin_select on public.mail_templates;
drop policy if exists mail_templates_admin_insert on public.mail_templates;
drop policy if exists mail_templates_admin_update on public.mail_templates;
drop policy if exists mail_templates_admin_delete on public.mail_templates;
create policy "mail_templates_by_tenant" on public.mail_templates
  as permissive for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()))
  with check (tenant_id = (select public.get_user_tenant_id()));

-- Firmas: cuatro policies owner-scoped (0018) y cuatro tenant-wide (0206)
drop policy if exists mail_signatures_admin_select on public.mail_signatures;
drop policy if exists mail_signatures_admin_insert on public.mail_signatures;
drop policy if exists mail_signatures_admin_update on public.mail_signatures;
drop policy if exists mail_signatures_admin_delete on public.mail_signatures;
create policy "mail_signatures_owner_select" on public.mail_signatures
  as permissive for select to authenticated
  using ((user_id = (select auth.uid())) and (tenant_id = (select public.get_user_tenant_id())));
create policy "mail_signatures_owner_insert" on public.mail_signatures
  as permissive for insert to authenticated
  with check ((user_id = (select auth.uid())) and (tenant_id = (select public.get_user_tenant_id())));
create policy "mail_signatures_owner_update" on public.mail_signatures
  as permissive for update to authenticated
  using (user_id = (select auth.uid()))
  with check ((user_id = (select auth.uid())) and (tenant_id = (select public.get_user_tenant_id())));
create policy "mail_signatures_owner_delete" on public.mail_signatures
  as permissive for delete to authenticated
  using (user_id = (select auth.uid()));
create policy "mail_signatures_tenant_select" on public.mail_signatures
  as permissive for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()));
create policy "mail_signatures_tenant_insert" on public.mail_signatures
  as permissive for insert to authenticated
  with check (tenant_id = (select public.get_user_tenant_id()));
create policy "mail_signatures_tenant_update" on public.mail_signatures
  as permissive for update to authenticated
  using (tenant_id = (select public.get_user_tenant_id()))
  with check (tenant_id = (select public.get_user_tenant_id()));
create policy "mail_signatures_tenant_delete" on public.mail_signatures
  as permissive for delete to authenticated
  using (tenant_id = (select public.get_user_tenant_id()));

-- Reglas
drop policy if exists mail_rules_admin_select on public.mail_rules;
drop policy if exists mail_rules_admin_insert on public.mail_rules;
drop policy if exists mail_rules_admin_update on public.mail_rules;
drop policy if exists mail_rules_admin_delete on public.mail_rules;
create policy "mail_rules_by_tenant" on public.mail_rules
  as permissive for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()))
  with check (tenant_id = (select public.get_user_tenant_id()));

-- Configuración
drop policy if exists mail_config_admin_select on public.mail_config;
drop policy if exists mail_config_admin_update on public.mail_config;
create policy "mail_config_by_tenant_select" on public.mail_config
  as permissive for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()));
create policy "mail_config_by_tenant_update" on public.mail_config
  as permissive for update to authenticated
  using (tenant_id = (select public.get_user_tenant_id()))
  with check (tenant_id = (select public.get_user_tenant_id()));

-- Lista negra
drop policy if exists mail_blacklist_admin_select on public.mail_blacklist;
drop policy if exists mail_blacklist_admin_insert on public.mail_blacklist;
drop policy if exists mail_blacklist_admin_delete on public.mail_blacklist;
create policy "mail_blacklist_by_tenant" on public.mail_blacklist
  as permissive for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()))
  with check (tenant_id = (select public.get_user_tenant_id()));

-- Programados
drop policy if exists mail_scheduled_admin_select on public.mail_scheduled;
drop policy if exists mail_scheduled_admin_insert on public.mail_scheduled;
drop policy if exists mail_scheduled_admin_update on public.mail_scheduled;
drop policy if exists mail_scheduled_admin_delete on public.mail_scheduled;
create policy "mail_scheduled_by_tenant" on public.mail_scheduled
  as permissive for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()))
  with check (tenant_id = (select public.get_user_tenant_id()));

-- ACL previa de authenticated: arwdxtm en templates, signatures, rules y scheduled;
-- ardxtm en blacklist; rwxtm en config.
grant select, insert, update, delete, references, trigger, maintain on public.mail_templates to authenticated;
grant select, insert, update, delete, references, trigger, maintain on public.mail_signatures to authenticated;
grant select, insert, update, delete, references, trigger, maintain on public.mail_rules to authenticated;
grant select, insert, update, delete, references, trigger, maintain on public.mail_scheduled to authenticated;
grant select, insert, delete, references, trigger, maintain on public.mail_blacklist to authenticated;
grant select, update, references, trigger, maintain on public.mail_config to authenticated;

-- RPC: mail_check_blacklist tenía EXECUTE de authenticated.
-- mail_increment_template_metrics ya estaba reservada a service_role y no cambia.
grant execute on function public.mail_check_blacklist(uuid, text) to authenticated;

-- Comentarios previos: ninguna de las dos funciones tenía comentario.
comment on function public.mail_check_blacklist(uuid, text) is null;
comment on table public.mail_scheduled is
  'Cola de correos programados (SDD-0143 Slice D). El cron mail-scheduled procesa los queued con scheduled_for <= now(). RLS por tenant; gating admin en la app.';

commit;
```

### 0450 — reversión

```sql
-- ROLLBACK de 0450_clients_aliado_mismo_tenant
-- Capturado de produccion (pg_constraint) el 2026-09-11, ANTES de aplicar. Proyecto: xpfuzqombmjmxvprjgmi.
-- Estado previo verificado: NI aliados_tenant_id_id_key NI clients_aliado_mismo_tenant_fkey existian.
-- La FK simple clients_aliado_id_fkey -> aliados(id) ON DELETE RESTRICT, de la 0362, no la toca 0450 y se conserva.
-- Ejecutar en una transaccion y SOLO con OK nominal de Sam. La fila del ledger no se revierte aqui.
-- ADVERTENCIA: al revertir, un cliente puede volver a colgar de un aliado de otro tenant.
begin;

alter table public.clients drop constraint if exists clients_aliado_mismo_tenant_fkey;
alter table public.aliados drop constraint if exists aliados_tenant_id_id_key;

commit;
```

## Qué no se midió

- **No se leyeron filas de negocio ni PII.** Todas las capturas y verificaciones son de catálogo
  (`pg_policies`, `pg_proc`, `pg_constraint`, `pg_class.relacl`, `obj_description`) y del ledger.
- **El conteo previo de 0450 lo corrió otra sesión**, con autorización de Sam: dio **0 filas
  incoherentes**. Es un agregado de solo lectura, no un listado; esta tarea no lo repitió.
- **Falta el smoke funcional del Portal y de Mailing.** Nadie ejecutó todavía los flujos reales:
  reclamos y evidencias, compras, proveedores y adjuntos, servicios de recepción, cajas de bodega,
  perfil y solicitudes de cambio, Club, mensajes y su Realtime en `/portal/soporte`, catálogo de
  servicios, y la administración de Mailing con un usuario admin y con uno no-admin. Tampoco el
  smoke del embed de marca de 0450 (etiquetas del Studio o comprobante de un cliente de aliado).
- **La verificación por objeto de 0434 no quedó escrita** (ver su bloque y PENDIENTES).
- **Esta tarea no ejecutó `pnpm verify`** ni ninguna prueba de producto: el cambio es de registro y
  documentación. En particular, el paso `migrations-applied` **no se midió aquí**; será el Director
  quien lea su verde sobre un árbol sincronizado con `origin/main`, como manda el runbook.

---

## OBJETIVO ORIGINAL

Dejar en Git el registro de las 11 migraciones que el Director aplicó a producción el 2026-09-11
con autorización nominal de Sam, de a una: retirar las esperas del baseline, actualizar la nota de
importación de cada spec con la version del ledger y dejar un handoff con la evidencia y los SQL de
reversión. Sin tocar producción ni ninguna migración.

## COMPLETADO

- **`supabase/migrations-baseline.json`**: se retiraron a mano las 11 entradas de
  `pendingBelowCutoff`, que queda en `{}`. `cutoff` sigue en **238** y el bloque `$doc` quedó
  intacto (34 líneas). No se regeneró el archivo. Es exactamente lo que manda su propio `$doc`:
  «AL APLICAR una que estaba en `pendingBelowCutoff`: sacala de ahí».
- **Notas de las 10 specs con nota de importación** (0351, 0361, 0363, 0368, 0381, 0382, 0385,
  0400, 0401, 0402): cada una dice ahora que su migración **fue APLICADA a producción el
  2026-09-11** con OK nominal de Sam, con su `version / name` del ledger, que se verificó contra el
  objeto y dónde está el registro. Se conservaron los avisos propios de cada spec que siguen
  vigentes: el orden 0417 → 0429, la decisión (A) de SDD-0389 en 0402, el Realtime pendiente en
  0401, el checklist histórico de 0351 y la advertencia de que las casillas heredadas del origen no
  acreditan el resto de la spec en las dos `in-progress`.
- **`docs/specs/0456-aliado-tenant-coherence/spec.md`** no tenía nota de importación: se agregó una
  **Nota de aplicación** al inicio de su sección «Producción», su lugar natural, sin reescribir el
  párrafo siguiente, que queda como descripción del estado previo.
- **Frontmatter y `status` de las 11 specs: sin tocar.** Ninguna pasa a `done` por esto; aplicar una
  migración no acredita los criterios de su spec.
- Este handoff, con la autorización, la tabla del ledger, el qué cierra y la verificación por
  migración, los 11 SQL de reversión íntegros y «Qué no se midió».

## VALIDACIÓN

| Comprobación | Alcance observado | Resultado |
|---|---|---|
| `node -e` sobre `supabase/migrations-baseline.json` | JSON parseable, `cutoff` 238, `pendingBelowCutoff` `{}` con 0 entradas, `$doc` de 34 líneas | **PASÓ** |
| `md5sum` + `wc -c` de los 11 `.sql` contra la tabla del ledger | 11 de 11 coinciden en md5 y bytes | **PASÓ** |
| `corepack pnpm docs:check` | `✓ índice sincronizado con 427 specs` | **PASÓ** |
| `corepack pnpm sdd:check` | `427 specs · 429 migraciones`, `[OK] numbering: sin números repetidos` (11 choques históricos declarados, preexistentes) | **PASÓ** |
| `node scripts/check-pending-migration-symbols.mjs` | `[OK] 0 ROJO · 0 AMARILLO declarado(s)` — coherente con el baseline sin esperas | **PASÓ** |
| `git diff --check` | sin errores de espacios en blanco | **PASÓ** |
| `pnpm verify` | **NO EJECUTADO** por decisión del encargo: el cambio es de registro y documentación, sin código de producto. Su paso `migrations-applied` se mide contra un árbol sincronizado con `origin/main`, que es trabajo del Director al integrar | **NO EJECUTADO** |
| Verificación contra el objeto en producción | **NO EJECUTADO** en esta tarea, y así corresponde: el encargo prohíbe ejecutar nada contra Supabase. La evidencia es la del Director | **NO EJECUTADO** |
| Smoke funcional del Portal y de Mailing | **NO EJECUTADO**: requiere sesiones reales de Portal y de Studio admin | **NO EJECUTADO** |

## COMMITS / PR / BRANCH

- **COMMITS:** dos, selectivos.
  1. `chore(db): retirar las 11 esperas aplicadas de migrations-baseline.json` — sólo
     `supabase/migrations-baseline.json`.
  2. `docs(specs): registrar las 11 migraciones aplicadas a producción` — las 11 `spec.md` y el
     commit que contiene este documento. Los hashes finales quedan en la PR.
- **PR / BRANCH:** rama `codex/c-registro-lote-20260911`, base `main`, PR **draft** (queda
  pendiente el smoke funcional y la nota de verificación de 0434). Worktree
  `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\c-registro-lote-20260911`.
- Fusionar esta PR **no aplica nada**: las 11 migraciones ya están aplicadas y verificadas, y el
  diff es de registro y documentación.

## PENDIENTES DE ESTA TAREA

- Ninguno para la aceptación del registro: baseline, notas y handoff quedaron completos y las seis
  comprobaciones aplicables pasaron.
- **Dejar por escrito la verificación por objeto de 0434** (`prealerta_addons read`), la única del
  lote sin ese detalle en `NOTAS.md`. Es un hueco **documental**, no una contradicción: el ledger,
  el md5 y el tamaño están; falta la constancia de la policy resultante. Sondeo sugerido, de sólo
  catálogo: `select policyname, qual from pg_policies where tablename='prealerta_addons'`. **No lo
  ejecutó esta tarea**, que no toca Supabase. Si el Director la deja escrita, conviene sacar la
  advertencia de la nota de este handoff.

## FUERA DE ALCANCE DETECTADO

- **Smoke funcional del Portal y de Mailing, sin hacer.** Once migraciones cambiaron policies de
  lectura y de escritura del Portal y el RBAC de Mailing. Un error de frontera se ve como «no veo
  mis cajas» o «no puedo editar una plantilla», no como un lint. Es la validación más valiosa que
  queda y necesita sesiones reales.
- **Smoke del embed de marca de 0450**: etiquetas del Studio o comprobante de un cliente de aliado,
  para confirmar que la FK compuesta no rompió la resolución white-label.
- **Realtime autenticado de `/portal/soporte`** (0433): validación aparte; el sondeo de 45 s sigue
  como respaldo.
- **Cuatro lints de advisors de seguridad** siguen abiertos en producción, iguales antes y después
  del lote. No los introdujo este lote y nadie los ha triado.
- **Deuda del `name` del ledger**: 44 migraciones históricas viven bajo otro nombre y ~13 se
  aplicaron fuera de banda. Sigue siendo la razón del `cutoff` 238, que no se toca.

## HANDOFF AL DIRECTOR

- **Siguiente acción:** revisar la PR draft y decidir la integración. Fusionar no aplica nada; el
  diff toca `supabase/migrations-baseline.json`, las 11 `spec.md` y este handoff, nada de código.
- **Revisión y dependencias:** la rama parte de `origin/main` `543bbe0a`. Si `main` avanzó, hay que
  hacer fetch y merge de `origin/main` **en esta rama** y repetir `docs:check`, `sdd:check` y
  `check-pending-migration-symbols`. Si otra rama abierta vuelve a declarar una de las 11 esperas
  en el baseline, hay que resolver el conflicto **a favor de retirarla**: ya están aplicadas.
- **Cambios compartidos:** `supabase/migrations-baseline.json` es un archivo de contención que
  cualquier rama con migración pendiente toca. Serializar su integración.
- **Publicación pendiente:** ninguna más. Push y PR draft quedaron hechos con la autorización del
  encargo. **Merge y despliegue siguen sin autorizar**, y «cerrar» esta tarea no los autoriza.
- **Sesiones consumidoras:** ninguna conocida sobre esta rama. La sesión del Director que aplicó el
  lote tiene la evidencia primaria en su scratchpad (`release-lote/NOTAS.md` y los 11
  `NNNN-rollback.sql`), que es efímero: los SQL de reversión están transcritos íntegros acá para
  que no dependan de ese directorio.
- **Ownership:** el claim `registro-lote-worker-20260911-claude` se libera al terminar la escritura.
  El worktree y la rama **se conservan**: no hay evidencia de integración todavía.

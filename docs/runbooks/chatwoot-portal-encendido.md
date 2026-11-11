# Runbook · Encender `chatwoot_portal` (SDD-0586 paso 10.5): prueba de punta a punta y producción

> **Para producción, el guion vigente es [`chatwoot-portal-p4-puertas.md`](chatwoot-portal-p4-puertas.md)** (2026-11-08): las cinco puertas de la carga P4. Sam eligió esperar la carga, y el camino corto queda como anexo. Este documento queda para la punta a punta en prueba y como referencia de los comandos del flag y de la cola.
>
> **Preparado y NO corrido.** Lo armó el Worker de la 10.5 el 2026-11-08, por pedido del Director General, comunicado por el Subdirector de Chatwoot. El orden del DG es: (1) publicar la web; (2) **encender `chatwoot_portal`**, primero en prueba con la punta a punta y después en producción; (3) la 0518. Este documento es el paso (2). **No enciende nada:** lo corre el DG. La web nueva ya está publicada en prueba y en producción desde ~04:20Z del 2026-11-08 (dato del Subdirector).
>
> **El OK de hoy para encender.** La fila 10.5 del checklist de la 0582 pide «Migración, bandeja y variables, y flag `chatwoot_portal`: un OK nominal de Sam cada uno». El del flag está dado, así (comunicado por el Subdirector):
>
> - A eso de las 04:15Z del 2026-11-08, el DG preguntó «¿para qué es el OK?» en un selector con cuatro opciones: «Encender el portal», «Publicar la web», «Aplicar la 0518» y «Solo enterado».
> - **Sam no marcó ninguna.** Respondió con texto libre: «Tú decides cuál va primero. O decide si las tres van al mismo tiempo o cuál va primero, o aplica las tres.»
> - El DG lo leyó como OK para las tres y fijó el orden: (1) publicar la web; (2) encender `chatwoot_portal`, primero en prueba y después en producción; (3) la 0518.
>
> Ese OK cubre encender el flag, en prueba y en producción. **En producción, además, espera a la 1c-1 y a la 1c-1b** (§0, decisión del DG).
>
> **Escrituras en la base, según el DG** (comunicado por el Subdirector):
>
> - **En prueba**, el corte (§2) y el atascado forzado del paso 9 (§3) **entran en el OK de encender en prueba**. El `update` del flag por SQL sigue como alternativa al panel.
> - **En producción**, ninguna escritura en la base entra en ese OK. El corte, o P4, va con su propio OK nominal (§1 y §4). **El flag se enciende y se apaga solo desde el panel. El `update` por SQL en producción queda ⛔ y pide su propio OK nominal de Sam.**
>
> Cada paso marcado **⛔ FUERA DEL OK DE HOY** pide un OK nominal de Sam aparte.

## 0 · Condiciones previas (todas, en cada entorno, antes de encender)

| Condición | Estado el 2026-11-08 (T1 a T4, la 1c-1 y la 1c-1b: el 2026-11-11) | Cómo se comprueba |
|---|---|---|
| La 0519 aplicada | ✅ en prueba y en producción (cierre en la #435) | Ledger: `name = '0519_chatwoot_portal'` |
| La 0520 aplicada | ✅ en prueba y en producción (cierre en la #437) | Ledger: `name = '0520_chatwoot_portal_vuelta'` |
| **T1 a T4 en `main` y publicados en producción** (E10-D42): la línea de Soporte del portal y el `/privacidad` nuevo con su fecha | ✅ **verificado:** entraron a `main` en el tren #441 (`146d5ea5e`). `https://dtdcargo.com/privacidad` muestra «8 de noviembre de 2026», la fecha de T4, medido por el Subdirector el 2026-11-11 | Se mira en la web publicada: Soporte del portal muestra T1, y `/privacidad` muestra T2, T3 y la fecha de T4 |
| La vía del atascado publicada (1b, #434): la tarjeta «Portal → Chatwoot» con «Reintentar los atascados» | ✅ publicada en los dos entornos (~04:20Z) | La tarjeta aparece en `/studio/bandeja` para un admin, con la bandeja configurada |
| La web nueva publicada en el entorno | ✅ en prueba y en producción desde ~04:20Z (dato del Subdirector) | La imagen que corre incluye `efd7e70f6` o posterior |
| **Solo producción: la 1c-1 (Studio en solo lectura, E10-D41) fusionada y publicada en producción** | ✅ **verificado:** la #440 entró a `main` en el tren #441 (`146d5ea5e`). El DG midió en el VPS, el 2026-11-11, que la web de producción corre la revisión `2e2ddeb34` exacta, que la incluye | La imagen de producción incluye el merge de la 1c-1. Con el flag encendido, un hilo del portal en Conversaciones de Studio muestra «Este hilo del portal se responde desde la Bandeja de Chatwoot.» y no tiene caja de respuesta |
| **Solo producción: la 1c-1b (el hilo borrado) fusionada y publicada en producción** | ✅ **verificado:** la #451 entró a `main` en el tren #452 (`2e2ddeb34`). El DG midió en el VPS, el 2026-11-11, que la web de producción corre esa revisión exacta | La imagen de producción incluye el merge de la 1c-1b. `setStatusAction` sobre un hilo borrado da «Conversación no encontrada.» y no escribe: el `update` lleva `deleted_at is null`. Antes, en un hilo del portal borrado, la traba de la 1c-1 no corría |

**Sin T1 a T4 publicados en producción, el flag no se enciende en producción.** En prueba se pueden publicar antes, con la misma PR.

**Sin la 1c-1 y la 1c-1b fusionadas y publicadas en producción, el flag tampoco se enciende en producción** (decisión del DG del 2026-11-08, comunicada por el Subdirector). En prueba, la punta a punta se hace antes, sin esperarlas.

**La bandeja y las variables, antes del flag, en cada entorno.** Desde la 1c-2 (decisión del DG del 2026-11-08, opción b), Studio deja un hilo del portal en solo lectura **con el flag encendido aunque falte la configuración**, y la guarda de la 0521 traba en la base los salientes y el cambio de estado. Si se enciende el flag sin `CHATWOOT_INBOX_PORTAL_ID` y el resto de §1, nadie puede responder un hilo del portal: ni Studio ni Chatwoot, que no recibe nada. Se arregla configurando, o apagando el flag (§5).

**La 0521 (la 1c-2) se aplica antes de fusionar su PR** (migrate-first, decisión del DG del 2026-11-08): primero en prueba y después en producción, cada una con su OK nominal de Sam. No es condición para encender: sin ella, Studio y la base hacen lo de la 1c-1, y el estado y la conciliación esperan.

### Lo que la 10.5 todavía no hace en `main` (I)

Son las piezas de la 1c (§10.5.16). Por decisión del DG, la 1c-1 es condición para producción, y la 1c-2, la 1c-3 y la 1c-4 no lo son:

- **Studio no queda en solo lectura** (E10-D41, la 1c-1). Hasta que la 1c-1 esté publicada, con el flag encendido, Conversaciones de Studio todavía deja responder un hilo del portal. Esa respuesta le llega al cliente, pero **no a Chatwoot**: el agente no la ve. Por eso en producción no se enciende antes. **En prueba, durante la punta a punta, el equipo responde los hilos del portal solo desde la Bandeja.**
- **Sin tarjeta del CRM** para los mensajes del portal (`entrarPortal`, E10-D36 y E10-D22). Los hilos del portal no entran a los embudos.
- **Sin estado** (E10-D39). Resolver en Chatwoot no cambia el estado del hilo en Studio.
- **Sin conciliación** (E10-D40, punto 5). Chatwoot no reintenta los webhooks de cuenta: si Studio está caído cuando un agente responde, esa respuesta no llega al portal y nada la recupera. Solo se reintenta lo que llegó y falló (0504). El aviso de rezago cubre solo la ida.
- **Sin modo de respaldo** (E10-D40, punto 4). Al apagar el flag, lo que el equipo responda desde Studio no sale a Chatwoot cuando se vuelva a encender.

## 1 · Qué hace falta en cada entorno

| Pieza | Prueba (`dtd-cargo-staging`, cuenta 2 de Chatwoot) | Producción (`dtd-cargo`, cuenta 1) | ⛔ |
|---|---|---|---|
| **La bandeja «Conversaciones del portal»** en Chatwoot: canal API, **sin `webhook_url`**, sin saludo, sin asignación automática y sin encuesta (§10.5.9, puerta 3). Miembros: el usuario de servicio de E10 (el del `CHATWOOT_ROUTER_TOKEN`) y solo agentes del equipo de Venezuela, nunca usuarios de China (E10-D36) | Se crea en la cuenta 2 | Se crea en la cuenta 1 | **⛔ FUERA DEL OK DE HOY** en los dos: es un cambio en el Chatwoot vivo (las dos cuentas viven en la misma instancia) |
| **Las variables de la web** (§10.5.8): `CHATWOOT_INBOX_PORTAL_ID` (vacía da `omitido: "sin_configurar"`), `CHATWOOT_ROUTER_TOKEN`, `CHATWOOT_ACCOUNT_ID`, `CHATWOOT_TENANT_ID` y `CHATWOOT_URL` | La cuenta 2, su usuario de servicio y el tenant de prueba | La cuenta 1 | **⛔ FUERA DEL OK DE HOY:** poner las variables en el VPS y **recrear el contenedor de la web** |
| **El webhook de cuenta** a la URL pública de Studio, terminado en `/api/chatwoot/webhook`, con `message_created` | A `https://prueba.dtdcargo.com/api/chatwoot/webhook`, con la ruta abierta en el borde de prueba (autorizada por Sam el 2026-11-03; la abre el DG) | El de E2, que ya existe | Crearlo o tocarlo es **⛔ FUERA DEL OK DE HOY**. Mirarlo, no: la salud lo mide sola (§3, paso 2) |
| **El corte** en `chatwoot_portal_estado`: sin corte, la cola no manda nada | El corte de §2, en la base de prueba | Lo fija la carga P4 (§10.5.10) | Ver la nota debajo |
| **La carga P4** (las conversaciones que ya existen, también las archivadas) | No hace falta para la punta a punta: basta el corte | Decidida por Sam (decisión 6 b), pero **su código (PR 2) no está escrito** | **⛔ FUERA DEL OK DE HOY** |
| **El panel de Chatwoot dentro de prueba** | **No hace falta:** en prueba el agente responde directo en la cuenta 2 de Chatwoot. El panel embebido pide agregar `https://prueba.dtdcargo.com` a `CHATWOOT_FRAME_ANCESTORS`, y eso obliga a recrear `rails` (`chatwoot-bandeja.md`, «El panel dentro de prueba»): `docker restart` no toma la variable. Si algún día se hace, con el compose del VPS y solo ese servicio: `cd /srv/chatwoot && docker compose -f compose.yml up -d --no-deps --force-recreate rails`. **Nunca `compose up` a secas** | No aplica | Recrear `rails` es **⛔ FUERA DEL OK DE HOY** |

**Antes de la punta a punta en prueba: tres pasos, cada uno ⛔ con su OK de Sam.** Lo midió el DG en la punta a punta del 2026-11-08 (evidencia en `/srv/ops/evidencias/portal-prueba-encendido-20261108T132606Z`, comunicada por el Subdirector):

1. **Reactivar la cuenta 2 de Chatwoot.** Estaba suspendida desde el 2026-11-03, y con la cuenta suspendida el envío de la ida da `contacto_no_autorizado` (401).
2. **Crear el webhook de la cuenta 2**, que no existía, hacia `https://prueba.dtdcargo.com/api/chatwoot/webhook` y con `message_created`. Se crea con el secreto del `.env` de prueba, leído en el VPS y **sin imprimirlo** ni pegarlo en el chat ni en el repo.
3. **Reabrir la ruta del borde** `/srv/edge/traefik/dynamic/prueba-chatwoot-webhook.yml`, que se cerró el 2026-11-04.

**Al terminar se cierra todo, en el orden inverso:** se quita la ruta del borde, se borra el webhook de la cuenta 2 y la cuenta 2 vuelve a quedar suspendida. Cada paso queda en la evidencia.

**El corte sin P4 en producción es una decisión, no un paso técnico (I).** Si se fija `corte = now()` sin cargar P4, desde ese momento la cola manda lo nuevo. Pero los 24 hilos y 73 mensajes contados el 2026-11-07 no quedan en Chatwoot, y Sam eligió cargarlos todos, archivados incluidos (decisión 6 b). Además, fijar el corte en producción es escribir en la base. Va con su OK nominal y con la decisión de esperar o no a P4.

## 2 · Comandos (los corre el DG)

**Contenedores de la base:** `dtd-cargo-staging-db-1` (prueba, confirmado con `docker ps` el 2026-11-08) y `dtd-cargo-db-1` (producción). El tenant de cada entorno es el de `CHATWOOT_TENANT_ID` de su web.

**`psql -U postgres` es el superusuario de la base, no `service_role`.** Puede leer y escribir las tablas y las funciones que son solo de `service_role`, y no pasa por la RLS ni por la auditoría de la app.

**El corte. ESCRITURA en la base.** Primero se lee:

```sql
-- Lectura: ¿el tenant ya tiene corte?
select tenant_id, corte, updated_at from public.chatwoot_portal_estado where tenant_id = '<tenant>';
```

Si ya hay corte, se anota y **no se toca**: moverlo cambia qué mensajes salen. Si no hay, se fija sin pisar uno que exista:

```sql
-- ESCRITURA: fija el corte del tenant (la cola manda los mensajes del cliente desde esta hora).
-- Si ya hay un corte, no lo mueve: el where del do update lo deja como está.
insert into public.chatwoot_portal_estado (tenant_id, corte)
values ('<tenant>', pg_catalog.now())
on conflict (tenant_id) do update set corte = excluded.corte, updated_at = pg_catalog.now()
  where public.chatwoot_portal_estado.corte is null
returning tenant_id, corte;
```

Si no devuelve ninguna fila, el corte ya existía y quedó igual.

**Encender el flag**, por tenant. **Se usa el panel:** Studio → Admin → Feature flags → «Conversaciones del portal en Chatwoot», con una sesión de **platform admin** de ese tenant. La policy `feature_flags_platform_admin_update` (0355) no deja hacerlo a un admin común. El panel escribe por la vía D1 (`executeD1Operation`, `feature_flag.toggle`) y **deja la auditoría**: quién, cuándo y el valor.

**En producción, el flag se enciende y se apaga solo desde el panel. El `update` por SQL en producción queda ⛔ y pide su propio OK nominal de Sam.**

**En prueba**, si el panel no se puede usar, sigue permitido por SQL. **Es ESCRITURA**, con el superusuario, y **se salta la auditoría D1**. Se anota en la evidencia quién la corrió y a qué hora:

```sql
-- ESCRITURA, sin auditoría D1. En prueba: solo si el panel no se puede usar.
-- En producción: ⛔ con su propio OK nominal de Sam.
update public.feature_flags set enabled = true, updated_at = pg_catalog.now()
where tenant_id = '<tenant>' and key = 'chatwoot_portal'
returning tenant_id, key, enabled, updated_at;
```

Tiene que devolver una fila. Si no devuelve ninguna, el tenant no tiene la fila del flag y no se encendió nada.

**Apagarlo** es el mismo interruptor del panel. Por SQL es el mismo `update` con `false`, con las mismas reglas: en prueba como alternativa, en producción ⛔ con su propio OK nominal de Sam.

**Comprobar el flag** (solo lectura; el flag no tiene caché, así que rige en el próximo request y en la próxima corrida del cron):

```sql
select tenant_id, enabled, updated_at from public.feature_flags where key = 'chatwoot_portal';
```

**Conteos** (solo lectura, sin texto ni nombres: ids, estados y números):

```sql
begin transaction read only;
-- La cola de la ida, por estado.
select estado, count(*) as filas, max(intentos) as max_intentos
from public.chatwoot_portal_salida where tenant_id = '<tenant>' group by estado order by estado;
-- Los vínculos.
select (select count(*) from public.chatwoot_portal_contactos where tenant_id = '<tenant>') as contactos,
       (select count(*) from public.chatwoot_portal_hilos where tenant_id = '<tenant>') as hilos,
       (select count(*) from public.chatwoot_conversations
          where tenant_id = '<tenant>' and inbox_id = <CHATWOOT_INBOX_PORTAL_ID>) as conversaciones_portal,
       (select corte from public.chatwoot_portal_estado where tenant_id = '<tenant>') as corte;
-- Lo que no llegó (el aviso de E10-D40): mensajes con más de 15 min sin llegar y atascados.
select * from public.chatwoot_portal_rezagados('<tenant>');
rollback;
```

`chatwoot_portal_rezagados` es solo de `service_role`. Con `psql -U postgres`, el superusuario, se puede llamar.

**Leer estos conteos en producción va con su propio OK.** Son solo números, pero leen la base de producción. El OK de ~04:15Z cubre encender, no leer. Pide un OK nominal de Sam que nombre estas consultas de §2: el flag, la cola por estado, los vínculos con el corte, y `chatwoot_portal_rezagados`. Ese OK no cubre otros conteos. En prueba se corren sin datos reales (§3).

## 3 · Prueba de punta a punta en prueba (cuenta 2, sin datos reales)

**Antes:** las condiciones de §0, salvo T1 a T4 en producción, y las piezas de §1 en prueba, cada una con su OK. El cliente de prueba es uno del tenant de prueba, con correo `example.test`. El agente es uno de los usuarios 4 o 5 de la cuenta 2, vinculado en Bandeja › Vínculos.

**Cómo se llega a prueba. La lista de IP no se toca.** El 2026-11-08, con `prueba-sha-efd7e70f6`, el smoke de la puerta de `desplegar-prueba.sh` dio **403 en todo desde el VPS**, y ya pasaba con la imagen anterior (dato del Subdirector). Es la lista de IP: por DNS, `curl` sale del VPS por IPv6, y esa dirección no está en la lista. **`entorno-prueba.md` §2.1 está desactualizado en este punto:** dice que desde el VPS el 403 no se puede ver, porque todo entra como `172.18.0.1` o `217.216.54.70`. Eso vale por IPv4, no por IPv6. Lo medido en este entorno, según las notas del DG:

- **Desde el VPS por DNS, `curl` sale por IPv6 y da 403** en todo, incluido `/`. Por `127.0.0.1` también da 403. Con `curl -4` por `217.216.54.70`, o por la IP de Traefik en `dtd_edge`, da **401**, que es la puerta: entra.
- **La ruta del webhook (medido por el DG el 2026-11-08):** desde el VPS directo a Traefik da **403** en todo, también en `/api/chatwoot/webhook`. Por Cloudflare, un `POST` **sin firma** da **401**: es lo esperado, porque la ruta está abierta y la firma la rechaza Studio.
- **Para el navegador** (el cliente del portal y la Bandeja): Chrome desde la PC de Sam por un túnel, sin tocar ninguna lista.
  - El túnel: `ssh -N -L 127.0.0.1:<puerto>:<IP de Traefik en dtd_edge>:443 root@217.216.54.70`.
  - Chrome con un perfil aparte y `--host-resolver-rules="MAP prueba.dtdcargo.com 127.0.0.1:<puerto>,MAP supabase-prueba.dtdcargo.com 127.0.0.1:<puerto>"`.
  - Antes de abrir, por el túnel tiene que dar 401.
  - Pasar la puerta pide su clave: solo con el OK de Sam que nombre el host, en la sesión que la usa.
  - Al terminar se cierra el túnel.
- **Desde dentro, sin Traefik ni Cloudflare:**
  - `docker exec -i dtd-cargo-staging-web-1 node -`, con un `http.request` a `127.0.0.1:3000` y el `Host` de prueba;
  - el cron, desde su contenedor, con `http://web:3000/…`;
  - los conteos de §2, en `dtd-cargo-staging-db-1`.
  - Sirve para medir. No reemplaza el recorrido por el portal ni la Bandeja.
- **El webhook de la cuenta 2 hacia prueba** entra por la ruta que el DG abrió en el borde, `/srv/edge/traefik/dynamic/prueba-chatwoot-webhook.yml`. Lo que autorizó Sam, según `chatwoot-bandeja.md`: solo `/api/chatwoot/webhook` y solo `POST`, sin la clave y con la misma lista de IP. Se cierra borrándolo. Antes de la punta a punta, se comprueba que siga ahí (`ls`). Si no está, volver a abrirla es tocar el borde compartido: **⛔ FUERA DEL OK DE HOY**. La entrega firmada de Chatwoot a prueba ya pasó en la punta a punta de E2 (2026-11-04).

| # | Paso | Esperado | Cómo se mide |
|---|---|---|---|
| 1 | Conteos de §2, con el flag **apagado** | Todo en 0. Si ya hay un corte, se anota | SQL de §2 |
| 2 | Un admin abre `/studio/bandeja` | La salud no muestra ninguna alerta del webhook. La tarjeta «Portal → Chatwoot» dice «Apagado» | Pantalla |
| 3 | Fijar el corte (leerlo antes; es escritura en la base de prueba) y **encender el flag** en el tenant de prueba, **desde el panel** (en prueba, el SQL de §2 sigue como alternativa). Encender está cubierto por el OK de ~04:15Z: Sam respondió «Tú decides cuál va primero. O decide si las tres van al mismo tiempo o cuál va primero, o aplica las tres.», sin marcar ninguna opción (ver la cabecera) | El flag queda en `t`, con su auditoría D1. La tarjeta muestra los números (0 y 0) | SQL de §2 y pantalla |
| 4 | El cliente de prueba escribe en `/portal/soporte` | El mensaje aparece en el portal, sin error, como antes | Pantalla |
| 5 | En menos de un minuto (con `after()`; si no, en la próxima corrida del cron, cada 5 min) | **Llega a Chatwoot, en la bandeja del portal**, como mensaje entrante del contacto `dtd-portal:<uuid>`, con `source_id = dtd:<id del mensaje>`. La cola dice 1 `enviado`, y hay 1 contacto, 1 hilo y 1 conversación del portal | Pantalla de la Bandeja; el `source_id` se lee con la API de cuenta (abajo); SQL de §2 |
| 6 | El agente responde en la Bandeja | La respuesta **vuelve al portal** con su nombre (o «DTD Cargo» si no está vinculado) y su hora, y el cliente recibe el push. En Studio, `conversation_messages` tiene una fila saliente con `external_msg_id = chatwoot:<id>` | Portal y push; SQL: `count(*) where external_msg_id like 'chatwoot:%'` en el hilo, sin leer el texto |
| 7 | El agente responde con un adjunto | Al portal llega el texto. En Chatwoot queda **una** nota privada: «Este archivo no le llegó al cliente…» | Bandeja |
| 8 | El cliente escribe otra vez | Va a la misma conversación, en orden | Bandeja; la cola dice 2 `enviado` |
| 9 | **Destrabar** (en prueba): **se espera más de 15 min** desde el mensaje del paso 8 y se fuerza un atascado sobre él, con el SQL de abajo. `chatwoot_portal_rezagados` solo cuenta los mensajes con `sent_at` de más de 15 min. Si se fuerza antes, la tarjeta dice «Atascados: 0» y el botón queda deshabilitado. **El cron manda el aviso de rezago** a los admins del tenant de prueba: es lo esperado | La tarjeta muestra «Atascados: 1». **«Reintentar los atascados»** dice «Vuelven a la cola 1 mensaje(s)». En la próxima corrida del cron la fila vuelve a `enviado`, **sin duplicar** el mensaje en Chatwoot, porque busca antes su `source_id` | Tarjeta, SQL de §2 y la API de cuenta: el `source_id` aparece una sola vez |
| 10 | **La salud del webhook**, con sus cuatro alertas | Sin alertas en el estado normal (paso 2). Las cuatro (`webhook_falta`, `webhook_sin_mensajes`, `webhook_sin_ip_publica` y `webhook_no_medido`) están probadas en la PoC de Actions y en las pruebas unitarias. Provocarlas en prueba pide tocar el webhook de la cuenta 2 o las variables | Pantalla. **⛔ Provocarlas en prueba queda FUERA DEL OK DE HOY**: es un cambio en el Chatwoot vivo o en el VPS |
| 11 | **Apagar el flag** y que el cliente escriba | El portal sigue sin error, y el mensaje **no** sale a Chatwoot mientras siga apagado | Bandeja y SQL: la cola no cambia |
| 12 | Encender otra vez | El mensaje del paso 11 sale en la próxima corrida, porque es posterior al corte | Bandeja y SQL |
| 13 | El cron de prueba, disparado desde dentro de su contenedor (comando abajo) | `/api/cron/chatwoot-reintentos` da 200, con `portal` y `avisoPortal` sin errores. **En prueba se puede disparar; en producción no** (purga: N1 de la revisión de la #433) | Salida del comando |

**Forzar un atascado en prueba** (paso 9). **ESCRITURA** en la base de prueba, solo sobre la fila del mensaje sintético del paso 8 y con más de 15 min desde que se escribió:

```sql
-- ESCRITURA (prueba): marca atascado un mensaje que ya llegó.
update public.chatwoot_portal_salida
set estado = 'atascado', proximo_at = null, error = 'prueba_atascado', updated_at = pg_catalog.now()
where tenant_id = '<tenant de prueba>' and message_id = '<id del mensaje del paso 8>' and estado = 'enviado'
returning message_id, estado, updated_at;
```

Tiene que devolver exactamente una fila. Si no devuelve ninguna, el mensaje no estaba en `enviado` y no se tocó nada.

Así queda «atascado» un mensaje que ya llegó. La prueba consiste en que, al reintentarlo, verifique y **no** lo mande otra vez.

**Disparar el cron de prueba** (paso 13). Se corre dentro del contenedor del cron, que tiene `CRON_SECRET` en su entorno, igual que su crontab (`infra/dtd-cargo/cron/crontab`). La clave no pasa por el shell del host. La cabecera la escribe el `printf` interno de `sh` y `curl` la lee por stdin (`-H @-`), así que tampoco aparece en los argumentos que muestra `ps`. El nombre del contenedor sigue el patrón de compose de prueba; antes se confirma con `docker ps`:

```bash
docker exec dtd-cargo-staging-cron-1 sh -c 'printf "Authorization: Bearer %s\n" "$CRON_SECRET" | curl -fsS --max-time 290 -H @- http://web:3000/api/cron/chatwoot-reintentos'
```

**Leer el `source_id` sin el texto** (prueba). Se corre dentro del contenedor de la web, que ya tiene el token del usuario de servicio de la cuenta 2 en su entorno. El token no está en el shell del host, y así no aparece en `ps` ni en el historial. Se cambia solo `<n>`:

```bash
docker exec -i dtd-cargo-staging-web-1 node --input-type=module - <<'EOF'
const n = <n>; // número de la conversación de Chatwoot
const { CHATWOOT_URL, CHATWOOT_ACCOUNT_ID, CHATWOOT_ROUTER_TOKEN } = process.env;
const r = await fetch(`${CHATWOOT_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations/${n}/messages`, {
  headers: { api_access_token: CHATWOOT_ROUTER_TOKEN },
});
if (!r.ok) throw new Error(`HTTP ${r.status}`);
for (const m of (await r.json()).payload) console.log(m.id, m.message_type, m.private, m.source_id);
EOF
```

**Al terminar** apagar el flag de prueba, si no se sigue usando, y cerrar lo de §1: quitar la ruta del borde, borrar el webhook de la cuenta 2 y suspender otra vez la cuenta 2. Revocar el token es el cierre completo de la cuenta 2, de `docs/runbooks/chatwoot-bandeja.md`.

## 4 · Producción

Solo después de:

1. la punta a punta de §3 aprobada por Sam («aprobado en prueba»);
2. T1 a T4 publicados en producción;
3. **la 1c-1 (Studio en solo lectura, la #440) y la 1c-1b (en un hilo borrado, `setStatusAction` da «no encontrada») fusionadas y publicadas en producción** (decisión del DG del 2026-11-08);
4. la bandeja de la cuenta 1, las variables y el contenedor recreado, cada uno **⛔ con su OK nominal**;
5. el corte, o P4, **⛔ con su OK nominal** y la decisión de §1.

Luego:

1. Conteos de §2 con el flag apagado, para tener la línea de base. **⛔ Con el OK nominal de los conteos en producción** (§2): el de encender no los cubre.
2. **Encender** en el tenant de producción y comprobarlo. **En producción, el flag se enciende y se apaga solo desde el panel**, con su auditoría D1. **El `update` por SQL en producción queda ⛔ y pide su propio OK nominal de Sam.** Encender está cubierto por el OK de ~04:15Z, siempre que se cumplan las condiciones de arriba: Sam respondió «Tú decides cuál va primero. O decide si las tres van al mismo tiempo o cuál va primero, o aplica las tres.», sin marcar ninguna opción (ver la cabecera).
3. **⛔ FUERA DEL OK DE HOY: el smoke con un cliente real.** Crea en la cuenta 1 de Chatwoot un contacto `dtd-portal:<uuid>` y una conversación con el nombre del cliente, y le manda un push al cliente. Pide un OK nominal de Sam que nombre al cliente y estas pantallas y roles:
   - **el cliente** (uno que Sam nombre, o Sam desde su propia cuenta de cliente si existe), en `/portal/soporte`: escribe un mensaje y después lee la respuesta, y recibe el push;
   - **un agente del equipo de Venezuela, miembro de la bandeja del portal en la cuenta 1**, en la Bandeja de Chatwoot: ve el mensaje en «Conversaciones del portal» y responde;
   - **un admin del tenant**, en `/studio/bandeja`: la tarjeta «Portal → Chatwoot» con sus números, y sin alertas del webhook;
   - **un usuario del equipo**, en `/studio/conversaciones`: el hilo del portal en solo lectura (la 1c-1).
4. **El cron no se dispara.** Se lee la próxima corrida programada en el log del contenedor del cron.
5. Conteos otra vez, **⛔ con el mismo OK nominal de los conteos** del paso 1.

## 5 · Vuelta atrás: apagar el flag

**Cómo:** el interruptor del panel, con su auditoría D1. Rige en el próximo request.
- **En producción, el flag se enciende y se apaga solo desde el panel. El `update` por SQL en producción queda ⛔ y pide su propio OK nominal de Sam.**
- **En prueba**, el `update … set enabled = false` de §2 sigue como alternativa si el panel no se puede usar. Es escritura y se salta la auditoría.

| Dónde | Qué deja de pasar | Qué queda |
|---|---|---|
| **Studio, la ida** | `enviarPortalPendientes` mira el flag y sale con `omitido: "apagado"` sin tomar nada, y `chatwoot_portal_tomar` tampoco devuelve filas con el flag apagado. `pedirEnvioPortal` **no** mira el flag: el portal sigue agendando el envío, pero no manda nada | Las filas de `chatwoot_portal_salida`, `chatwoot_portal_contactos`, `chatwoot_portal_hilos` y `chatwoot_portal_estado` (el corte), y las de `chatwoot_conversations` del portal, con su `client_id`. **No se borra nada.** Al encender otra vez, salen en orden los mensajes del cliente posteriores al corte que no llegaron, también los escritos mientras estuvo apagado |
| **Studio, la vuelta** | `responderAlPortal` no escribe ni avisa. Las respuestas en Chatwoot con el flag apagado **no llegan al portal**, y al encender otra vez no se recuperan (sin conciliación, 1c) | Las respuestas que ya llegaron siguen en `conversation_messages`: el cliente las ve en su hilo |
| **Studio, la Bandeja** | La tarjeta dice «Apagado» y no se puede reintentar. El aviso de rezago no sale | — |
| **Chatwoot** | Nada nuevo entra a la bandeja del portal | Los contactos `dtd-portal:<uuid>`, las conversaciones, los mensajes y las notas privadas que ya entraron. **No se borran** |
| **El portal** | Nada: el cliente sigue escribiendo y leyendo como siempre | Responder vuelve a ser desde Conversaciones de Studio |

**Apagar no es borrar.** Sacar la bandeja, los contactos o las conversaciones de Chatwoot sería otro paso, con su OK, y no está previsto.

## 6 · Resumen: lo que queda FUERA del OK de hoy

**Lo que SÍ cubre el OK de hoy:** encender el flag `chatwoot_portal`, en prueba y en producción. A eso de las 04:15Z del 2026-11-08, el DG preguntó «¿para qué es el OK?» en un selector («Encender el portal», «Publicar la web», «Aplicar la 0518» y «Solo enterado»). Sam no marcó ninguna opción y respondió con texto libre: «Tú decides cuál va primero. O decide si las tres van al mismo tiempo o cuál va primero, o aplica las tres.» El DG lo leyó como OK para las tres y fijó el orden: la web, el portal y la 0518 (comunicado por el Subdirector).
- Se enciende desde el panel.
- En prueba entran también las dos escrituras de la base de prueba: el corte y el atascado forzado del paso 9. El `update` del flag por SQL sigue como alternativa al panel.
- En producción, solo con las condiciones de §4, incluidas la 1c-1 y la 1c-1b publicadas, y sin escrituras en la base. **En producción, el flag se enciende y se apaga solo desde el panel. El `update` por SQL en producción queda ⛔ y pide su propio OK nominal de Sam.**

**Lo que queda fuera:**

1. **Crear la bandeja del portal** en el Chatwoot vivo: en la cuenta 2 para prueba y en la cuenta 1 para producción.
2. **Poner las variables en el VPS y recrear el contenedor de la web** (prueba y producción).
3. **Cargar P4.** Su código, la PR 2, no está escrito. En producción, el corte sin P4 es una decisión de Sam (§1).
4. **Recrear `rails`** para el panel de Chatwoot dentro de prueba. No hace falta: en prueba el agente responde directo en la cuenta 2.
5. **El smoke en producción con un cliente real** (§4, paso 3). Crea un contacto y una conversación con su nombre en la cuenta 1 y le manda un push. Pide un OK que nombre al cliente, las pantallas y los roles.
6. **Los conteos de §2 en producción.** Leen la base de producción. Piden un OK que nombre esas consultas.

Además, tocar el webhook de cuenta o provocar las alertas de la salud en prueba también es un cambio en el Chatwoot vivo o en el VPS, y queda fuera. Fijar el corte en producción es escribir en la base: va con su OK. Tampoco entran en el OK de hoy tocar la lista de IP de prueba (`ips-prueba.sh` o `cloudflare-private.yml`) ni reabrir la ruta del webhook de prueba en el borde: para llegar a prueba están el túnel y las mediciones desde dentro de §3.

## 7 · Evidencia que queda

| Dónde | Qué |
|---|---|
| SDD-0586 y su handoff | El OK literal de cada paso, la hora de encendido por entorno, los conteos antes y después, y el resultado de cada fila de §3 |
| `/srv/ops/evidencias/` | La salida de los conteos de §2 (solo números) y la del curl del cron de prueba |

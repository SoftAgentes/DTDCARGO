# Runbook · Encender `chatwoot_portal` (SDD-0586 paso 10.5): prueba de punta a punta y producción

> **Preparado y NO corrido.** Lo armó el Worker de la 10.5 el 2026-11-08, por pedido del Director General, comunicado por el Subdirector de Chatwoot. El orden del DG es: (1) publicar la web; (2) **encender `chatwoot_portal`**, primero en prueba con la punta a punta y después en producción; (3) la 0518. Este documento es el paso (2). **No enciende nada:** lo corre el DG cuando la web nueva esté publicada en prueba.
>
> Cada paso marcado **⛔ FUERA DEL OK DE HOY** pide un OK nominal de Sam aparte. Lo exige la fila 10.5 del checklist de la 0582: «Migración, bandeja y variables, y flag `chatwoot_portal`: un OK nominal de Sam cada uno».

## 0 · Condiciones previas (todas, en cada entorno, antes de encender)

| Condición | Estado el 2026-11-08 | Cómo se comprueba |
|---|---|---|
| La 0519 aplicada | ✅ en prueba y en producción (cierre en la #435) | Ledger: `name = '0519_chatwoot_portal'` |
| La 0520 aplicada | ✅ en prueba y en producción (cierre en la #437) | Ledger: `name = '0520_chatwoot_portal_vuelta'` |
| **T1 a T4 en `main` y publicados en producción** (E10-D42): la línea de Soporte del portal y el `/privacidad` nuevo con su fecha | ❌ **todavía no están en `main`**; los prepara la hija del correo en su PR | Se mira en la web publicada: Soporte del portal muestra T1, y `/privacidad` muestra T2, T3 y la fecha de T4 |
| La vía del atascado publicada (1b, #434): la tarjeta «Portal → Chatwoot» con «Reintentar los atascados» | En `main`; falta publicar la web | La tarjeta aparece en `/studio/bandeja` para un admin, con la bandeja configurada |
| La web nueva publicada en el entorno | Pendiente (paso 1 del DG) | La imagen que corre incluye `efd7e70f6` o posterior |

**Sin T1 a T4 publicados en producción, el flag no se enciende en producción.** En prueba se pueden publicar antes, con la misma PR.

### Lo que la 10.5 todavía no hace en `main` (I)

Son las piezas de la 1c (§10.5.16), que no se escribieron. Encender antes de la 1c es una decisión del DG:

- **Studio no queda en solo lectura** (E10-D41). Con el flag encendido, Conversaciones de Studio todavía deja responder un hilo del portal. Esa respuesta le llega al cliente, pero **no a Chatwoot**: el agente no la ve. Mientras no exista la 1c, **el equipo responde los hilos del portal solo desde la Bandeja**.
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
| **Reiniciar Chatwoot**, si hace falta (por ejemplo, `CHATWOOT_FRAME_ANCESTORS` para el panel dentro de prueba) | `docker restart`, nunca `compose up` | Igual | **⛔ FUERA DEL OK DE HOY** |

**El corte sin P4 en producción es una decisión, no un paso técnico (I).** Si se fija `corte = now()` sin cargar P4, desde ese momento la cola manda lo nuevo. Pero los 24 hilos y 73 mensajes contados el 2026-11-07 no quedan en Chatwoot, y Sam eligió cargarlos todos, archivados incluidos (decisión 6 b). Además, fijar el corte en producción es escribir en la base. Va con su OK nominal y con la decisión de esperar o no a P4.

## 2 · Comandos (los corre el DG)

**Contenedores de la base:** `dtd-cargo-staging-db-1` (prueba, confirmado con `docker ps` el 2026-11-08) y `dtd-cargo-db-1` (producción). El tenant de cada entorno es el de `CHATWOOT_TENANT_ID` de su web.

**El corte** (solo `service_role`; con `psql -U postgres`):

```sql
-- Fija el corte del tenant: la cola manda los mensajes del cliente desde esta hora.
insert into public.chatwoot_portal_estado (tenant_id, corte)
values ('<tenant>', pg_catalog.now())
on conflict (tenant_id) do update set corte = excluded.corte, updated_at = pg_catalog.now();
```

**Encender el flag**, por tenant. La vía normal es **Studio → Admin → Feature flags → «Conversaciones del portal en Chatwoot»**, con una sesión de **platform admin** de ese tenant: la policy `feature_flags_platform_admin_update` (0355) no deja hacerlo a un admin común. La alternativa por SQL, con `service_role`, toca una sola fila:

```sql
update public.feature_flags set enabled = true, updated_at = pg_catalog.now()
where tenant_id = '<tenant>' and key = 'chatwoot_portal';
```

**Apagarlo** es lo mismo con `false`, o el mismo interruptor del panel.

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

`chatwoot_portal_rezagados` es solo de `service_role`; con `psql -U postgres` se puede llamar.

## 3 · Prueba de punta a punta en prueba (cuenta 2, sin datos reales)

**Antes:** las condiciones de §0, salvo T1 a T4 en producción, y las piezas de §1 en prueba, cada una con su OK. El cliente de prueba es uno del tenant de prueba, con correo `example.test`. El agente es uno de los usuarios 4 o 5 de la cuenta 2, vinculado en Bandeja › Vínculos.

**Cómo se llega a prueba. La lista de IP no se toca.** El 2026-11-08, con `prueba-sha-efd7e70f6`, el smoke de la puerta de `desplegar-prueba.sh` dio **403 en todo desde el VPS**. Es la lista de IP de Cloudflare, y ya pasaba con la imagen anterior (dato del Subdirector). Lo medido antes en este entorno está en `docs/runbooks/entorno-prueba.md` §2.1 y en las notas del DG:

- **Desde el VPS por DNS, `curl` sale por IPv6 y da 403** en todo, incluido `/`. Por `127.0.0.1` también da 403. Con `curl -4` por `217.216.54.70`, o por la IP de Traefik en `dtd_edge`, da **401**, que es la puerta: entra.
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
- **El webhook de la cuenta 2 hacia prueba** entra por la ruta que el DG abrió en el borde, `/srv/edge/traefik/dynamic/prueba-chatwoot-webhook.yml` (solo `POST` y solo por Cloudflare). Se cierra borrándolo. Antes de la punta a punta, se comprueba que siga ahí (`ls`). Si no está, volver a abrirla es tocar el borde compartido: **⛔ FUERA DEL OK DE HOY**. La entrega firmada de Chatwoot a prueba ya pasó en la punta a punta de E2 (2026-11-04).

| # | Paso | Esperado | Cómo se mide |
|---|---|---|---|
| 1 | Conteos de §2, con el flag **apagado** | Todo en 0. Si ya hay un corte, se anota | SQL de §2 |
| 2 | Un admin abre `/studio/bandeja` | La salud no muestra ninguna alerta del webhook. La tarjeta «Portal → Chatwoot» dice «Apagado» | Pantalla |
| 3 | Fijar el corte y **encender el flag** en el tenant de prueba | El flag queda en `t`. La tarjeta muestra los números (0 y 0) | SQL de §2 y pantalla |
| 4 | El cliente de prueba escribe en `/portal/soporte` | El mensaje aparece en el portal, sin error, como antes | Pantalla |
| 5 | En menos de un minuto (con `after()`; si no, en la próxima corrida del cron, cada 5 min) | **Llega a Chatwoot, en la bandeja del portal**, como mensaje entrante del contacto `dtd-portal:<uuid>`, con `source_id = dtd:<id del mensaje>`. La cola dice 1 `enviado`, y hay 1 contacto, 1 hilo y 1 conversación del portal | Pantalla de la Bandeja; el `source_id` se lee con la API de cuenta (abajo); SQL de §2 |
| 6 | El agente responde en la Bandeja | La respuesta **vuelve al portal** con su nombre (o «DTD Cargo» si no está vinculado) y su hora, y el cliente recibe el push. En Studio, `conversation_messages` tiene una fila saliente con `external_msg_id = chatwoot:<id>` | Portal y push; SQL: `count(*) where external_msg_id like 'chatwoot:%'` en el hilo, sin leer el texto |
| 7 | El agente responde con un adjunto | Al portal llega el texto. En Chatwoot queda **una** nota privada: «Este archivo no le llegó al cliente…» | Bandeja |
| 8 | El cliente escribe otra vez | Va a la misma conversación, en orden | Bandeja; la cola dice 2 `enviado` |
| 9 | **Destrabar** (en prueba): se fuerza un atascado sobre el mensaje del paso 8, con el SQL de abajo | La tarjeta muestra «Atascados: 1». **«Reintentar los atascados»** dice «Vuelven a la cola 1 mensaje(s)». En la próxima corrida del cron la fila vuelve a `enviado`, **sin duplicar** el mensaje en Chatwoot, porque busca antes su `source_id` | Tarjeta, SQL de §2 y la API de cuenta: el `source_id` aparece una sola vez |
| 10 | **La salud del webhook**, con sus cuatro alertas | Sin alertas en el estado normal (paso 2). Las cuatro (`webhook_falta`, `webhook_sin_mensajes`, `webhook_sin_ip_publica` y `webhook_no_medido`) están probadas en la PoC de Actions y en las pruebas unitarias. Provocarlas en prueba pide tocar el webhook de la cuenta 2 o las variables | Pantalla. **⛔ Provocarlas en prueba queda FUERA DEL OK DE HOY**: es un cambio en el Chatwoot vivo o en el VPS |
| 11 | **Apagar el flag** y que el cliente escriba | El portal sigue sin error, y el mensaje **no** sale a Chatwoot mientras siga apagado | Bandeja y SQL: la cola no cambia |
| 12 | Encender otra vez | El mensaje del paso 11 sale en la próxima corrida, porque es posterior al corte | Bandeja y SQL |
| 13 | El cron de prueba | `curl … /api/cron/chatwoot-reintentos` da 200, con `portal` y `avisoPortal` sin errores. **En prueba se puede disparar; en producción no** (purga: N1 de la revisión de la #433) | Salida del curl |

**Forzar un atascado en prueba** (paso 9). Escribe en la base de prueba y solo sobre la fila del mensaje sintético del paso 8:

```sql
update public.chatwoot_portal_salida
set estado = 'atascado', proximo_at = null, error = 'prueba_atascado', updated_at = pg_catalog.now()
where tenant_id = '<tenant de prueba>' and message_id = '<id del mensaje del paso 8>' and estado = 'enviado';
```

Así queda «atascado» un mensaje que ya llegó. La prueba consiste en que, al reintentarlo, verifique y **no** lo mande otra vez.

**Leer el `source_id` sin el texto** (prueba; con el token del usuario de servicio de la cuenta 2, desde el VPS):

```bash
curl -fsS -H "api_access_token: ${CHATWOOT_ROUTER_TOKEN}" "${CHATWOOT_URL}/api/v1/accounts/2/conversations/<n>/messages" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for (const m of JSON.parse(s).payload) console.log(m.id, m.message_type, m.private, m.source_id)})'
```

**Al terminar** apagar el flag de prueba, si no se sigue usando. El cierre de la cuenta 2 (borrar el webhook, suspender la cuenta y revocar el token) es el de `docs/runbooks/chatwoot-bandeja.md` y no corresponde a este paso.

## 4 · Producción

Solo después de:

1. la punta a punta de §3 aprobada por Sam («aprobado en prueba»);
2. T1 a T4 publicados en producción;
3. la bandeja de la cuenta 1, las variables y el contenedor recreado, cada uno **⛔ con su OK nominal**;
4. el corte, o P4, **⛔ con su OK nominal** y la decisión de §1.

Luego:

1. Conteos de §2 con el flag apagado, para tener la línea de base.
2. **Encender** en el tenant de producción (panel o SQL de §2) y comprobarlo.
3. El smoke por rol, como en el paso 5 de §3. El cliente es uno que Sam nombre, o Sam desde su propia cuenta de cliente si existe. Se mira que el mensaje llegue a la bandeja del portal y que la respuesta vuelva.
4. **El cron no se dispara.** Se lee la próxima corrida programada en el log del contenedor del cron.
5. Conteos otra vez.

## 5 · Vuelta atrás: apagar el flag

**Cómo:** el interruptor del panel, o el `update … set enabled = false` de §2, en el tenant. Rige en el próximo request.

| Dónde | Qué deja de pasar | Qué queda |
|---|---|---|
| **Studio, la ida** | `chatwoot_portal_tomar` no devuelve nada, y el portal deja de pedir el envío | Las filas de `chatwoot_portal_salida`, `chatwoot_portal_contactos`, `chatwoot_portal_hilos` y `chatwoot_portal_estado` (el corte), y las de `chatwoot_conversations` del portal, con su `client_id`. **No se borra nada.** Al encender otra vez, salen en orden los mensajes del cliente posteriores al corte que no llegaron, también los escritos mientras estuvo apagado |
| **Studio, la vuelta** | `responderAlPortal` no escribe ni avisa. Las respuestas en Chatwoot con el flag apagado **no llegan al portal**, y al encender otra vez no se recuperan (sin conciliación, 1c) | Las respuestas que ya llegaron siguen en `conversation_messages`: el cliente las ve en su hilo |
| **Studio, la Bandeja** | La tarjeta dice «Apagado» y no se puede reintentar. El aviso de rezago no sale | — |
| **Chatwoot** | Nada nuevo entra a la bandeja del portal | Los contactos `dtd-portal:<uuid>`, las conversaciones, los mensajes y las notas privadas que ya entraron. **No se borran** |
| **El portal** | Nada: el cliente sigue escribiendo y leyendo como siempre | Responder vuelve a ser desde Conversaciones de Studio |

**Apagar no es borrar.** Sacar la bandeja, los contactos o las conversaciones de Chatwoot sería otro paso, con su OK, y no está previsto.

## 6 · Resumen: lo que queda FUERA del OK de hoy

1. **Crear la bandeja del portal** en el Chatwoot vivo: en la cuenta 2 para prueba y en la cuenta 1 para producción.
2. **Poner las variables en el VPS y recrear el contenedor de la web** (prueba y producción).
3. **Cargar P4.** Su código, la PR 2, no está escrito. En producción, el corte sin P4 es una decisión de Sam (§1).
4. **Reiniciar Chatwoot,** si hace falta.

Además, tocar el webhook de cuenta o provocar las alertas de la salud en prueba también es un cambio en el Chatwoot vivo o en el VPS, y queda fuera. Fijar el corte en producción es escribir en la base: va con su OK. Tampoco entran en el OK de hoy tocar la lista de IP de prueba (`ips-prueba.sh` o `cloudflare-private.yml`) ni reabrir la ruta del webhook de prueba en el borde: para llegar a prueba están el túnel y las mediciones desde dentro de §3.

## 7 · Evidencia que queda

| Dónde | Qué |
|---|---|
| SDD-0586 y su handoff | El OK literal de cada paso, la hora de encendido por entorno, los conteos antes y después, y el resultado de cada fila de §3 |
| `/srv/ops/evidencias/` | La salida de los conteos de §2 (solo números) y la del curl del cron de prueba |

# Runbook · Operación de la Bandeja de Chatwoot en Studio

SDD-0585, etapa E2. Cubre cómo se enciende, cómo se diagnostica y qué hacer cuando algo falla en la Bandeja dentro de Studio. Hay dos runbooks hermanos:
- [Ficha DTD](chatwoot-ficha-dtd.md): la Dashboard App;
- [Agentes](chatwoot-agentes.md): altas, bajas y salud.

El servidor de Chatwoot es de E1, en [chatwoot-servidor.md](chatwoot-servidor.md).

> **Estado:** el código está en la rama `codex/0582-e2-poc`, sin desplegar. La 0503 y la 0504 no están aplicadas en producción. Cada puerta de abajo pide su OK nominal de Sam.

## Piezas

| Pieza | Dónde | Qué hace |
|---|---|---|
| Página | `/studio/bandeja` | El panel de Chatwoot en un iframe, con SSO de un solo uso. `?c=N` abre la conversación N |
| Contador | Sidebar, ítem «Bandeja» | Cuenta las conversaciones abiertas con no leídos. Lo actualizan el webhook y la reconciliación, y se mantiene vivo con Realtime |
| Webhook | `POST /api/chatwoot/webhook` | Recibe `message_created` y `conversation_status_changed`, firmados, de hasta 256 KiB. Aplica el estado y avisa por push. Con la entrada de leads (SDD-0587, 6.4) también `conversation_created` y `conversation_updated`: crea la tarjeta del CRM y le da asesor. Solo registra `conversation_updated` si cambió el asignado |
| Reintento | Cron `chatwoot-reintentos`, cada 5 min | Reprocesa los eventos fallidos con espera de 1, 2, 4 y 8 min. Al quinto intento quedan «descartados» y el admin los ve en la Bandeja |
| Agentes | Cron `chatwoot-agentes`, diario a las 12:30 UTC | Altas, bajas y salud de la cuenta |
| Ficha | `/studio/ficha-chat` | La Dashboard App al lado de cada conversación |

## Encender (en orden, cada paso con su OK)

1. **Merge a `main` y despliegue al VPS**, que es automático. Comprueba que `/studio/bandeja` tenga `frame-src https://chat.dtdcargo.com` y que `/studio/ficha-chat` tenga `frame-ancestors https://chat.dtdcargo.com`.
2. **Migraciones 0503, 0504 y 0508** (bajas y purga, 2.7), en ese orden, siguiendo [aplicar-migraciones-prod.md](aplicar-migraciones-prod.md).
3. **Variables en el `.env` del VPS,** contenedor `web`. El token y el secreto nunca van en Git:
   - `CHATWOOT_URL`, `CHATWOOT_PLATFORM_TOKEN` y `CHATWOOT_ACCOUNT_ID`;
   - `CHATWOOT_WEBHOOK_SECRET` y `CHATWOOT_TENANT_ID`;
   - `CHATWOOT_SERVICE_USER_ID`;
   - la matriz (2.7): `CHATWOOT_INBOX_CLIENTES_ID` y `CHATWOOT_TEAM_CLIENTES_ID`. Los de Leads, en el corte.

   Valores en «[Variables del `.env` de `web`](#variables-del-env-de-web)». Los secretos se cargan con `infra/chatwoot/pegar-secretos-web.sh`.
4. **Flag `chatwoot_inbox`** encendido para el tenant, en Ajustes › Funciones.
5. **Vínculos:** cada persona que atiende queda vinculada a su agente, en Bandeja › Vínculos (alta o vínculo manual).
6. **Webhook de cuenta** en Chatwoot (Ajustes → Integraciones → Webhooks), con la URL `https://dtdcargo.com/api/chatwoot/webhook` y los eventos `message_created` y `conversation_status_changed`. El secreto que muestra Chatwoot va en `CHATWOOT_WEBHOOK_SECRET`.
7. **Dashboard App** «Ficha DTD», según [chatwoot-ficha-dtd.md](chatwoot-ficha-dtd.md).
8. **Script del panel** (`DASHBOARD_SCRIPTS`), para que salir de Studio cierre también el chat, según [chatwoot-agentes.md](chatwoot-agentes.md).

**Entrada de leads** (SDD-0587, 6.4), después de lo anterior y en este orden:

1. **Migraciones 0505, 0506 y 0513**, en ese orden. Si los eventos nuevos llegan antes que la 0513, el `check` de la 0504 los rechaza y la ruta responde 500.
2. **Bandejas:** `CHATWOOT_INBOX_LEADS_ID` y `CHATWOOT_INBOX_CLIENTES_ID` son las que dicen la fuente de WhatsApp. Un WhatsApp en otra bandeja no crea tarjeta, y el log lo dice. La bandeja API «Archivo Kommo» tampoco.
3. **Sumar al webhook de cuenta** los eventos `conversation_created` y `conversation_updated`. Si no se suman, la tarjeta se crea igual con el primer mensaje entrante, pero el asesor solo llega si el mensaje ya trae al asignado.
4. **D7, dejar de empujar el alta web a Kommo,** es una puerta aparte: `CRM_ALTA_WEB_SIN_KOMMO=1` exige la lectura L3 con OK de Sam (SDD-0587 §8).

## Variables del `.env` de `web`

Medidas en el VPS el 2026-11-03. Van después de la 0505, en `/srv/dtd-cargo/.env` (producción) o `/srv/dtd-cargo-staging/.env` (prueba). `web` las lee al recrearse.

| Variable | Producción | Prueba | De dónde sale |
|---|---|---|---|
| `CHATWOOT_URL` | `https://chat.dtdcargo.com` | Igual | `CHATWOOT_HOST` de `/srv/chatwoot/.env` |
| `CHATWOOT_ACCOUNT_ID` | `1` | `2` | Cuenta «DTD Cargo»; en prueba, «DTD Prueba» |
| `CHATWOOT_TENANT_ID` | El id de su tenant | El id de su tenant | `select id from public.tenants` en la base de ese entorno, al cargarla |
| `CHATWOOT_SERVICE_USER_ID` | `1` | `4` | `secretos/platform-app.env`; en prueba, `secretos/platform-app-prueba.env` |
| `CHATWOOT_INBOX_CLIENTES_ID` | `2` | `7` | Bandeja «Clientes»; en prueba, «Prueba correo» |
| `CHATWOOT_TEAM_CLIENTES_ID` | `1` | `3` | Equipos `clientes`, creados el 2026-11-03. Chatwoot guarda los nombres en minúscula |
| `CHATWOOT_INBOX_LEADS_ID` | Vacía | `6` | En producción, hasta el corte: sin ella no hay enrutamiento. En prueba, «Prueba API», para probarlo |
| `CHATWOOT_TEAM_LEADS_ID` | Vacía; será `2` | `4` | Equipos `leads`, ya creados. En producción se carga en el corte |
| `WHATSAPP_NUMERO_CLIENTES` | Vacía | `15555550100` | En producción, hasta el corte: necesita el OK del número de clientes. En prueba, un número ficticio |
| `CRM_ALTA_WEB_SIN_KOMMO` | Vacía | Vacía | D7: solo con la lectura L3 y el OK de Sam |

**Los 3 secretos** se cargan con `bash /srv/chatwoot/pegar-secretos-web.sh prueba|produccion`, en una terminal con `ssh -t`. Cada uno se pega sin eco, o con Enter se toma del servidor sin mostrarlo. No corre sin la 0505 de ese entorno y no pisa un valor existente.

| Secreto | Si se pulsa Enter |
|---|---|
| `CHATWOOT_PLATFORM_TOKEN` | Lo toma de `secretos/platform-app.env`; en prueba, de `secretos/platform-app-prueba.env` |
| `CHATWOOT_ROUTER_TOKEN` | Lo toma del token de acceso del usuario de servicio de ese archivo |
| `CHATWOOT_WEBHOOK_SECRET` | Lo toma del webhook de ese entorno. Si el webhook no existe, lo deja sin cargar y sale con 5: se crea y se corre otra vez con ese nombre |

### Prueba no se conecta a la cuenta real

**Un webhook sobre la cuenta 1 hacia prueba está descartado.** Un webhook de cuenta recibe todas sus bandejas, y Studio solo filtra por cuenta (`app/api/chatwoot/webhook/route.ts`): copiaría a prueba nombres y teléfonos de clientes. El cron `chatwoot-agentes` de prueba, además, actuaría sobre los agentes reales.

**Decisión de Sam, 2026-11-03, «Probar WhatsApp al publicar»:** lo registra el Subdirector según el Director General. Prueba usa una segunda cuenta en el mismo Chatwoot, sin datos reales, y lo que depende de un WhatsApp real se prueba en producción justo después de publicar la tanda A.

**Creada el 2026-11-03** con `infra/chatwoot/crear-cuenta-prueba.rb`, con el OK de Sam: cuenta 2, usuarios 4 y 5, bandejas 6 y 7, equipos 3 y 4, sin webhooks ni canales. Evidencia en `/srv/ops/evidencias/chatwoot-cuenta-prueba-20261103T224846Z`. Ensayada antes en local con `infra/chatwoot/pruebas/prueba-cuenta-prueba.sh`, 0 fallas. Medido en el VPS con el token real: 401 sobre la cuenta 1 y su usuario, 200 sobre la cuenta 2. Falta probar la entrega real, que necesita la tanda A en prueba y la ruta del borde.

- **Una Platform App propia de prueba, no la de producción.** La API solo deja tocar lo que esa app creó o adoptó (`validate_platform_app_permissible`), así que su token no alcanza la cuenta 1.
- **Solo correos `example.test`.** `POST /platform/api/v1/users` adopta un usuario existente si el correo coincide (`User.from_email`). Un usuario de prueba con el correo de un agente real le daría a prueba control sobre él.
- **Notificaciones apagadas en los agentes de prueba.** Asignar una conversación puede intentar avisar por SMTP a `example.test`.
- **La puerta de prueba responde 401 al webhook.** Chatwoot no manda credenciales en la URL (`ssrf_filter` no las usa). Sam autorizó abrir en el borde de prueba solo `/api/chatwoot/webhook`, sin la clave y con la misma lista de IP; la abre el Director General. El webhook sigue firmado.
- **Al terminar:** borrar el webhook, suspender la cuenta (`status`) y revocar el token de esa app. **La cuenta no se borra.**

**En producción, justo después de publicar la tanda A,** Sam escribe desde su teléfono al número de prueba, y se comprueba lo que queda como «Al publicar» en la tabla. **Si falla la tarjeta, se quita el webhook.**

| Qué prueba | Bandeja | Dónde se cubre |
|---|---|---|
| Entrega firmada real de Chatwoot 4.19.1 a Studio | Cualquiera | Prueba |
| `conversation_created` crea la tarjeta | Correo, sin IMAP ni SMTP, conversación sin mensaje | Prueba, con fuente `correo` |
| `conversation_updated` da asesor | La misma | Prueba |
| Mensaje entrante: contador y aviso | API | Prueba, sin tarjeta: `fuenteDeCanal` no mapea `Channel::Api` |
| Enrutamiento por segmento (E10) | API como `CHATWOOT_INBOX_LEADS_ID` | Prueba: solo mira el id de la bandeja |
| Tarjeta por primer mensaje entrante y vuelta desde «Perdido» | Número de prueba | **Al publicar:** en prueba no se puede, porque Chatwoot solo admite mensajes entrantes por API en bandejas API |
| Fuente WhatsApp, teléfono y BSUID de un mensaje real | Número de prueba | **Al publicar:** una bandeja de WhatsApp sin Meta dispararía sus trabajos de plantillas y salud contra Meta |
| El panel dentro de prueba | — | Sin cubrir: pide agregar `https://prueba.dtdcargo.com` a `CHATWOOT_FRAME_ANCESTORS`, que recrea `rails` |

## Diagnóstico

| Síntoma | Causa probable | Qué mirar o hacer |
|---|---|---|
| «La bandeja todavía no está conectada» | Falta el token o la cuenta | Variables del paso 3 |
| «Tu usuario no tiene un agente de la bandeja» | No hay vínculo | Bandeja › Vínculos |
| El iframe sale en blanco | La CSP no deja enmarcar el chat, o Traefik manda `X-Frame-Options` | `curl -sI https://dtdcargo.com/studio/bandeja` y la configuración de Traefik de E1 |
| Chatwoot pide elegir qué sesión cerrar | Hay 5 sesiones vivas (`MAX_USER_SESSIONS=5`) y la sexta da 409 | Cerrar sesión en otro navegador. El SSO se pide solo cuando hace falta (E2-D12) |
| 429 al entrar | rack-attack: 5 logins por IP cada 5 min | Esperar 5 minutos. No reintentar en bucle |
| El micrófono no graba | Falta `microphone=(self "https://chat.dtdcargo.com")` en la `Permissions-Policy` | Cabeceras de `/studio/bandeja` |
| El contador no se mueve | No llegan webhooks, o un agente lee sin responder (eso no dispara ningún webhook) | Abrir la Bandeja: la reconciliación corrige el contador al momento |
| Avisos que no llegan | Evento fallido, esperando el reintento | Bandeja › «Eventos que no se pudieron procesar» (admin). Logs `[chatwoot]` de `web` |
| El webhook responde 401 | La firma no coincide o el reloj se desfasó más de 5 min | El secreto del paso 6 y la hora del VPS |
| El webhook responde 503 | Falta `CHATWOOT_WEBHOOK_SECRET` o `CHATWOOT_TENANT_ID` | Variables del paso 3 |
| El webhook responde 413 | El cuerpo pasa de 256 KiB | Revisar qué manda Chatwoot; los adjuntos van por URL |

## Caídas y recuperación

- **Studio caído mientras llegan mensajes.** Chatwoot 4.19.1 **no reintenta** los webhooks de cuenta, así que esos eventos se pierden. Al volver, la reconciliación (al abrir la Bandeja) corrige el contador, pero los avisos push de ese rato no salen. Es un límite conocido.
- **El aviso falla** (push caído). El evento queda «fallido» y el cron `chatwoot-reintentos` lo reintenta con espera creciente. Al quinto intento queda «descartado»: revisar esa conversación a mano.
- **Chatwoot caído.** La Bandeja muestra el error con «Abrir en pestaña aparte». La salud diaria avisa «el servidor de mensajes no responde».

Las tres situaciones están probadas de punta a punta, con la 0504 real en PGlite, en `lib/studio/chatwoot/__tests__/caida-webhook.scenario.test.ts`.

## Apagar

- **Flag `chatwoot_inbox` apagado:** desaparecen la Bandeja, el contador y los avisos, y Chatwoot sigue funcionando solo.
- **Quitar el webhook en Chatwoot:** Studio deja de recibir eventos.

No se borran datos: `chatwoot_conversations` y `chatwoot_webhook_events` quedan como estaban. Con la 0508, el cron `chatwoot-reintentos` borra los eventos procesados o descartados a los 90 días y las conversaciones sin actividad a los 12 meses (2.7; propuesta del Director sin objeción de Sam).

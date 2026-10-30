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
| Webhook | `POST /api/chatwoot/webhook` | Recibe `message_created` y `conversation_status_changed`, firmados, de hasta 256 KiB. Aplica el estado y avisa por push |
| Reintento | Cron `chatwoot-reintentos`, cada 5 min | Reprocesa los eventos fallidos con espera de 1, 2, 4 y 8 min. Al quinto intento quedan «descartados» y el admin los ve en la Bandeja |
| Agentes | Cron `chatwoot-agentes`, diario a las 12:30 UTC | Altas, bajas y salud de la cuenta |
| Ficha | `/studio/ficha-chat` | La Dashboard App al lado de cada conversación |

## Encender (en orden, cada paso con su OK)

1. **Merge a `main` y despliegue al VPS**, que es automático. Comprueba que `/studio/bandeja` tenga `frame-src https://chat.dtdcargo.com` y que `/studio/ficha-chat` tenga `frame-ancestors https://chat.dtdcargo.com`.
2. **Migraciones 0503 y 0504**, siguiendo [aplicar-migraciones-prod.md](aplicar-migraciones-prod.md).
3. **Variables en el `.env` del VPS,** contenedor `web`. El token y el secreto nunca van en Git:
   - `CHATWOOT_URL`, `CHATWOOT_PLATFORM_TOKEN` y `CHATWOOT_ACCOUNT_ID`;
   - `CHATWOOT_WEBHOOK_SECRET` y `CHATWOOT_TENANT_ID`;
   - `CHATWOOT_SERVICE_USER_ID`.
4. **Flag `chatwoot_inbox`** encendido para el tenant, en Ajustes › Funciones.
5. **Vínculos:** cada persona que atiende queda vinculada a su agente, en Bandeja › Vínculos (alta o vínculo manual).
6. **Webhook de cuenta** en Chatwoot (Ajustes → Integraciones → Webhooks), con la URL `https://dtdcargo.com/api/chatwoot/webhook` y los eventos `message_created` y `conversation_status_changed`. El secreto que muestra Chatwoot va en `CHATWOOT_WEBHOOK_SECRET`.
7. **Dashboard App** «Ficha DTD», según [chatwoot-ficha-dtd.md](chatwoot-ficha-dtd.md).

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

No se borran datos: `chatwoot_conversations` y `chatwoot_webhook_events` quedan como estaban. Su plazo de conservación está pendiente (revisar-datos-ve de E2).

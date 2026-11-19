---
sdd: "0679"
title: "Chatwoot: subir de v4.19.1-ce a v4.20.0-ce"
status: proposed
author: "Claude (Worker)"
created: 2026-11-19
updated: 2026-11-19
supersedes: null
superseded_by: null
related: ["0582", "0583", "0584", "0585", "0586", "0588", "0589", "0649", "0677"]
confidencialidad: interno
---

# SDD-0679 — Chatwoot: subir de v4.19.1-ce a v4.20.0-ce

## Pedido

Sam pidió, por el Director General (2026-11-19), preparar la subida del Chatwoot autoalojado de **v4.19.1-ce a v4.20.0-ce** y hacerla **el 2026-11-20 o el 2026-11-21**. La razón principal son los más de 30 arreglos de seguridad de la 4.20.0 ([notas](https://github.com/chatwoot/chatwoot/releases/tag/v4.20.0)).

Esta SDD entrega: (1) el inventario de las piezas propias y si la 4.20.0 rompe cada una, (2) la imagen fijada por digest, (3) el plan de ensayo y (4) el runbook de la subida en producción, [`chatwoot-subida-4-20.md`](../../runbooks/chatwoot-subida-4-20.md). **No toca producción.** La subida la ejecuta el DG o una sesión designada, con el OK nominal de Sam y la hora acordada.

Procedimiento general: [runbook de versiones](../../runbooks/chatwoot-versiones.md) (SDD-0588). Esta SDD es su primera corrida real.

## Etiquetas de evidencia

- **C**: leído en el código. Del lado de Chatwoot, en los tags `v4.19.1` y `v4.20.0` de `chatwoot/chatwoot`, descargados fuera del repo y sin ejecutar nada (`git diff v4.19.1 v4.20.0 -- <ruta>`). Del lado de DTD, en `main` a `80ea7b3b2`.
- **R**: leído en el registro de Docker Hub (manifiesto y configuración de la imagen), sin bajar la imagen.
- **I**: inferencia, no probada.
- **NV**: no verificado; lo cierra el ensayo (§5) o el smoke de la subida.

## 1 · Qué trae la 4.20.0 (lo que nos toca)

| Cambio | Evidencia | Efecto en DTD |
|---|---|---|
| Rails 7.2.3.1 → **8.0.5.2** (actioncable, activejob, activesupport, railties) | C, `Gemfile` y `Gemfile.lock` | El cambio más grande. Nuestros cuatro inicializadores usan API que sigue en Rails 8.0 (`config.to_prepare`, `routes.prepend`, `filter_parameters`, `prepend` sobre clases, `ActionCable` `periodically`), pero **la carga real solo la prueba el ensayo** (NV) |
| Node 24.22.1, libvips con `VIPS_BLOCK_UNTRUSTED=1`, `ruby-vips` 2.3.0 | R (variables de la imagen), C | Ninguno en nuestras piezas. Miniaturas de BMP, ICO y PSD dejan de generarse (`config/initializers/active_storage.rb`): esos adjuntos se bajan igual |
| Ruby 3.4.4, Sidekiq, devise, devise_token_auth, httparty, redis | C, sin cambio en `Gemfile.lock` | Ninguno |
| Messenger exige `FB_APP_SECRET` (`lib/integrations/facebook/webhook_server.rb`) | C | No aplica: Messenger quedó fuera del corte de Kommo |
| WhatsApp Cloud manual: «app secret» de Meta (`Channel::Whatsapp#app_secret_pending?`, `Webhooks::WhatsappController#verify_meta_signature!`) | C | Las bandejas existentes siguen: sin secreto, el webhook se acepta y se escribe `[WHATSAPP_APP_SECRET_PENDING]` con ids de cuenta y canal (no de personas). Al guardar el secreto empieza a verificarse la firma. **Pero** editar y guardar una bandeja manual existente que ya tenía secreto, o crear una nueva, lo exige (`app_secret_required?`). **El secreto lo carga Sam; nadie más lo pide ni lo escribe** |
| Instagram Unified Login (`app/services/instagram/unified_login_service.rb` y compañía; migración `add_unified_login_to_channel_instagram`) | C | Nuevo camino de conexión; la bandeja de Instagram actual no cambia. `renovar-instagram.sh` sigue (NV en el ensayo) |
| Platform API: `POST /platform/api/v1/users` ya **no adopta** un usuario existente que no es de la Platform App (`validate_platform_app_permissible if @resource.persisted?`) | C, `platform/api/v1/users_controller.rb` | Arreglo de seguridad que ya pedíamos a mano (chatwoot-bandeja «Solo correos `example.test`»). Riesgo: un alta de agente desde Studio con el correo de un usuario de Chatwoot que la app no creó ni adoptó ahora da 401 en lugar de adoptarlo (§4, R6) |
| Webhooks: el de bandeja debe ser de la misma cuenta (`Webhook#inbox_must_belong_to_account`) | C | El nuestro es de cuenta (sin bandeja): no aplica. La entrega (`lib/webhooks/trigger.rb`, `WebhookJob`, `WebhookListener`) no cambió |
| `wrap_parameters format: []` en `contacts_controller` | C | Studio manda `custom_attributes` al nivel raíz del JSON (`lib/studio/chatwoot/router-api.ts`), y `permitted_params` los sigue leyendo del raíz y los **mezcla** igual que en 4.19.1: no se rompe |
| Contraseñas: el enlace de invitación vence a los 7 días y la confirmación va después de guardar (`devise_overrides/passwords_controller.rb`) | C | Ninguno: Traefik ya bloquea `POST /auth/password` (regla «clave» del compose) |
| `GET /api` agrega `mobile_app.min_version` | C | Ninguno: el monitor de versión y `vigilar.sh` buscan `"version":"…"` |
| Rack::Attack: tope nuevo de `GET /api/v1/accounts/:id/conversations` por usuario (`RATE_LIMIT_CONVERSATIONS_LIST`, 1000/min) | C | Ninguno a nuestro volumen (I). Studio pagina conversaciones con el usuario de servicio en la reconciliación |
| La función **importar datos** queda encendida para todas las cuentas (migración `enable_data_import_for_all_accounts`) | C | Cambio de producto: un agente con permiso puede importar contactos por CSV. **Fuera de alcance**; se anota para que Sam decida si se apaga (FUERA DE ALCANCE en el handoff) |
| 15 migraciones nuevas (§6) | C | Todas aditivas; las de datos tienen `down` vacío. Vuelta atrás tras migrar = restaurar el respaldo (§7) |

## 2 · Inventario de piezas propias y veredicto

Veredicto **por código** (C). Ninguna pieza se declara sana sin su corrida del ensayo (§5); la columna «Ensayo» dice qué la prueba.

| Pieza | Dónde | De qué depende en Chatwoot | Cambió en 4.20.0 | Veredicto | Ensayo |
|---|---|---|---|---|---|
| **Redacción de logs** `zz_dtd_redaccion_logs.rb` (SDD-0583, 1.7) | `infra/chatwoot/rails/` | Formateador del logger (BroadcastLogger), `Sidekiq::Config::ERROR_HANDLER`, `filter_parameters`, `ActiveJob` `log_arguments`, y las líneas de log de canales que tapan sus patrones (21 lugares en 4.19.1) | Rails 8.0 (logger y ActiveJob); Sidekiq sin cambio. Los 21 lugares siguen, con el mismo texto (`git grep` en los dos tags). Solo se corren dos números de línea que el archivo cita en comentarios: `instagram/message_text.rb` 67/70 → 71/74 y `facebook_messenger.rb` 55/60 → 58/63 | **No se rompe por código.** Rails 8.0 es el riesgo: el formateador o `log_arguments` podrían cambiar de lugar (NV) | `ensayo-local.sh` (A1, C6) y `prueba-redaccion-canales.sh` (T0–T2, C1, M) |
| **Candado de `/register`** `zz_dtd_proteccion_register.rb` (SDD-0584, 4.2) | ídem | `Whatsapp::FacebookApiClient#register_phone_number` y `#deregister_phone_number`, `HTTParty::Request#perform`, `webhook_setup_service.rb`, `webhook_teardown_service.rb` | **Ninguno de los cuatro archivos cambió**; httparty igual. `manual_setup_service.rb` solo suma el `app_secret` | **No se rompe** | `prueba-register.sh` (L1–L8, V, I, control C en rojo) |
| **Revocar sesiones** `zz_dtd_revocar_sesiones.rb` (SDD-0585, 2.7) | ídem | `PlatformController` (`set_resource`, `validate_platform_app_permissible`), `RoomChannel` (`stop_all_streams`, `pubsub_token`, `periodically`), `routes.prepend`, devise_token_auth (`users.tokens`) | `platform_controller.rb` sin cambio; devise_token_auth igual. `RoomChannel` solo suma `work_preferences` dentro de `broadcast_presence`; `pubsub_token` y `ensure_stream` iguales. `routes.rb` suma rutas, ninguna en `/platform/api/v1/users/:id/…` | **No se rompe por código.** Rails 8.0 cambia el dibujo de rutas (la carga perezosa es solo en desarrollo y prueba, I) | `prueba-revocar-sesiones.sh` (R0–R10, control C1 en rojo) |
| **Correos de DTD** `zz_dtd_correo.rb` + `correo/views/` (SDD-0583) | ídem | `ApplicationMailer`, `Devise::Mailer`, plantillas | `app/views/devise/` y `app/views/layouts/mailer/` sin cambio; `account_notification_mailer.rb` cambia 4 líneas (exportación de contactos). Plantilla nueva `contact_export_complete.liquid` en inglés | **No se rompe.** La plantilla de exportación nueva sale en inglés y sin marca (I, menor) | Vista previa de [§2 ter del servidor](../../runbooks/chatwoot-servidor.md) en el ensayo |
| **`devise_overrides`** (sesiones) y **`MAX_USER_SESSIONS`** | compose (`MAX_USER_SESSIONS`, hoy 10 en el `.env` del VPS) | `devise_overrides/sessions_controller.rb` | **Sin cambio** | **No se rompe** | `ensayo-local.sh` C7 |
| `devise_overrides` (contraseñas) y la regla «clave» de Traefik | compose (router `-clave`) | `devise_overrides/passwords_controller.rb` | Cambió el flujo (§1), no la ruta `POST /auth/password` | **No se rompe**: Traefik corta antes de Rails | `prueba-regla-clave.sh` (opcional, no cambia la regla) |
| **`DASHBOARD_SCRIPTS`** (cierre de sesión de 2.7 y guía de la Bandeja, `panel/`) | InstallationConfig en la base | `app/views/layouts/vueapp.html.erb`, `dashboard_controller.rb` | `vueapp.html.erb` **sin cambio**; `dashboard_controller.rb` solo cambia de dónde sale `INSTAGRAM_APP_ID` | **No se rompe** | smoke S13 y `smoke-guia.mjs` |
| Guía: selectores (`lib/studio/guia/chatwoot-selectores.json`) | Studio | `ReplyBox.vue`, `Sidebar.vue`, `ChatListHeader.vue`, `ConversationBox.vue`, `ConversationAction.vue`, `MultiselectDropdown.vue`, `Tabs/`, `WootWriter/` | `ReplyBox.vue` (raíz `div.reply-box` igual) y `Sidebar.vue` (el buscador ahora tiene el atajo de la barra de comandos, pero sigue siendo `RouterLink` a `search`: `a[href$='/search']` sigue). Los demás sin cambio | **No se rompe por código** | `smoke-guia.mjs` |
| **SSO `dtd_cw_sso`** (Bandeja de Studio) | `lib/studio/chatwoot/sso-cookie.ts`, `app/studio/(app)/bandeja/actions.ts` | `POST /platform/api/v1/users/:id/login` (`users_controller#login`), `SsoAuthenticatable`, pantalla `/app/login` | Solo cambió `#create` (§1); `login`, `user.rb`, `sessions_controller.rb` y la vista de login, sin cambio | **No se rompe** | smoke S10 |
| **Platform App** (agentes, cuenta, miembros) | `lib/studio/chatwoot/platform-api.ts`, `miembros-api.ts` | `platform/api/v1/` | `users#create` ya no adopta usuarios ajenos; `agent_bots_controller` suma 9 líneas (no lo usamos) | **No se rompe**; R6 si alguien da de alta un correo que ya existe fuera de la app | cron `chatwoot-agentes` del día siguiente |
| **Webhooks hacia el ERP** (`/api/chatwoot/webhook`, firmado) | Studio, cuenta 1 (y 2 en prueba) | `Webhook`, `WebhookListener`, `WebhookJob`, `lib/webhooks/trigger.rb`, `webhook_data` de mensajes y conversaciones | Solo `Webhook` (validación de bandeja y sintaxis de `enum`). La entrega, la firma y la forma de la carga, sin cambio | **No se rompe** | smoke S11 y prueba de punta a punta (§5, fase C) |
| **Ficha DTD** (Dashboard App, SDD-0649, 0676) | `/studio/ficha-chat` | `DashboardApp/Frame.vue` (`postMessage` con la conversación y el contacto) | **Sin cambio** | **No se rompe** | smoke S11 |
| **Atributos de contacto** (SDD-0649) | `router-api.ts` (`PATCH /contacts/:id`) | `contacts_controller`, `CustomAttributeDefinition` | `wrap_parameters` apagado (§1) y `enum` con la sintaxis nueva; mezcla de `custom_attributes` igual | **No se rompe** | fase C |
| **Chat del portal** (0519/0520, SDD-0586 10.5) | `router-api.ts`, `lib/studio/oficina/envio.ts` | Account API: `POST /contacts`, `contacts/search`, `contacts/:id/conversations`, `conversations/:id/messages`, y el webhook de cuenta de vuelta | Ninguna de esas rutas cambia de forma; `contacts/search` sigue con `include_contact_inboxes` | **No se rompe** | fase C (punta a punta en prueba) |
| **Marca** (`aplicar-marca.rb`, `marca/`) | InstallationConfig y `/dtd-marca/` | `public/`, InstallationConfig | `installation_config.yml` suma claves (Instagram, móvil); las nuestras no cambian | **No se rompe** (cosmético) | vista del login |
| Iframe (`frame-ancestors`, sin XFO) | Traefik | cabeceras de Rails | sin cambio en `content_security_policy.rb` | **No se rompe** | S9 |

**Conclusión:** por código, la 4.20.0 **no rompe ninguna pieza propia**. El riesgo que queda es Rails 8.0, que solo se descarta con las cuatro corridas del ensayo local en verde, cada una con su control en rojo.

Diferencia completa entre los tags: 1.230 archivos (+49.362/−12.023). De la superficie que tocamos: 67 archivos (+1.148/−269). El detalle quedó en las notas de la sesión, fuera del repo.

## 3 · Imagen

| | v4.19.1-ce (hoy) | v4.20.0-ce (nueva) |
|---|---|---|
| Digest del índice | `sha256:04895c7bd0550d9e74b45b7202787b56f7ee4e891ebbde0c429c8c32901b97cf` | `sha256:03cc2004299fec8142481a411906947928678fa0e126beb5248962183593f8be` |
| `linux/amd64` | `sha256:72c2e8903226…` | `sha256:1cf633d4a48434e50f90b3b03de9673f8b21a0d18121fb5a5acbdb23b230c6f2` |
| Creada | — | 2026-11-18T09:07:46Z (R) |
| Tamaño comprimido (amd64) | — | ~752 MB, 12 capas (R) |

Se fija el **digest del índice**, como el pin vigente: `docker` elige `linux/amd64` dentro de él y el pin no cambia si alguien mira desde otra arquitectura. Cambio en [`infra/chatwoot/compose.yml`](../../../infra/chatwoot/compose.yml), ancla `x-imagen`. `pgvector` y `redis` no cambian: las notas no lo piden.

`infra/chatwoot/pruebas/ensayo-local.sh` deja de tener `4.19.1` escrito: C1 y R3b leen la versión esperada de la etiqueta del compose. Así el ensayo mide la imagen del compose que se prueba.

**No se cambian en esta PR** (se cambian después de la subida, en el cierre, porque deben seguir a producción):
- `IMAGEN_CHATWOOT` de `infra/ops/kommo-historial/ensayo-archivo.sh` y `infra/ops/portal-historial/ensayo-portal.sh`.
- La cabecera «medido en la imagen v4.19.1» de los cuatro inicializadores: cambiarla cambia su sha256, y el runbook compara huellas contra el VPS.
- `version` de `lib/studio/guia/chatwoot-selectores.json` (se actualiza con el resultado de `smoke-guia.mjs`).
- El monitor «Chatwoot · versión» de Uptime Kuma (paso del runbook).

## 4 · Riesgos

| # | Riesgo | Probabilidad / impacto | Mitigación |
|---|---|---|---|
| R1 | Rails 8.0 deja un inicializador sin efecto en silencio (formateador, ruta, `prepend`) | Media (I) / alto: datos en logs o bajas que no cierran sesión | Las cuatro corridas del ensayo con control en rojo; S2–S7 en la subida. Un rojo es vuelta atrás, no se depura en caliente |
| R2 | **`sidekiq` del VPS no es igual al compose** del VPS: le faltan `DTD_CHATWOOT_SERVICIO_ID`, `SEARCH_TIME_RANGE_LIMIT_DAYS` y montajes (medido el 2026-11-19 por otra sesión). Cambiar la imagen obliga a recrearlo, y al recrearlo entran esas diferencias | Segura / medio | El runbook compara `docker inspect` contra `docker compose config` **antes** de la ventana y lista las diferencias por nombre. **El OK de Sam tiene que nombrarlas.** Si aparece una que no está en la lista, se para |
| R3 | El `compose.yml` del VPS no es el de `main` | Segura / medio | En el VPS se cambia **solo la línea de la imagen** (`sed` sobre el digest viejo) y se comprueba con `diff` que cambió una línea. No se copia el compose de `main` |
| R4 | Migraciones sin `down` | Segura / medio | Respaldo conjunto en el momento, después del drenaje; vuelta atrás (b) con `restaurar.sh` |
| R5 | Una migración tarda más de lo previsto (índice concurrente en `contact_inboxes`, recorrido de cuentas) | Baja (I: dos cuentas, pocos miles de contactos) / bajo | El ensayo en el VPS (§5, fase B) mide `prepare` con la base real. Sin esa medida, la ventana se calcula con el máximo |
| R6 | Studio da de alta un agente con un correo que ya existe en Chatwoot y no es de la Platform App: 401 en lugar de adoptarlo | Baja / bajo | El cron `chatwoot-agentes` lo muestra como error de alta; se corrige a mano. Es el comportamiento seguro |
| R7 | Bandejas de WhatsApp Cloud manuales: al **editar y guardar** una que ya tenía secreto, o al crear una nueva, Chatwoot exige el app secret | Media / bajo | No se editan bandejas en la ventana. Sam carga el secreto cuando decida; nadie más lo pide ni lo escribe |
| R8 | Las fechas pedidas (vie 20 y sáb 21) caen fuera de la ventana del runbook de versiones (lunes a jueves, 21:00–23:00 de Caracas: «no el viernes») | Segura / bajo | Decisión de Sam. Si va el viernes, hace falta quien atienda el sábado. Se anota en el pedido de OK |
| R9 | Corte de Chatwoot: la Bandeja de Studio, la Ficha DTD, el chat del portal y los avisos se detienen; Chatwoot 4.19.1/4.20.0 **no reintenta** los webhooks de cuenta | Segura / bajo | Aviso a la sesión «Cable Paso 3b» y al equipo; la reconciliación de Studio corrige el contador al abrir la Bandeja; el portal deja lo pendiente en su cola de reintentos |
| R10 | Se rompe un selector de la guía | Baja / bajo | No es vuelta atrás: la tarjeta cae al marco; PR de Studio aparte |

## 5 · Ensayo

**Hallazgo:** el entorno de prueba **no tiene Chatwoot propio**. `prueba.dtdcargo.com` usa la **cuenta 2 del mismo Chatwoot de producción** ([chatwoot-bandeja](../../runbooks/chatwoot-bandeja.md), «Prueba no se conecta a la cuenta real»). Subir la imagen «en prueba» sería subir producción. Por eso el ensayo va en tres fases:

| Fase | Dónde | Qué | Pide |
|---|---|---|---|
| **A · Local** | la PC, Docker, datos sintéticos, una corrida a la vez | `ensayo-local.sh`, `prueba-register.sh`, `prueba-revocar-sesiones.sh`, `prueba-redaccion-canales.sh` y `smoke-guia.mjs` con la v4.20.0-ce (§4 del runbook de versiones). `ensayo-local.sh` ya corre `db:chatwoot_prepare` desde cero y restaura un respaldo | **Turno del DG** |
| **B · Copia en el VPS** | proyecto `chatwoot-ensayo`, sin Traefik ni DNS | restaurar el respaldo de producción sobre la v4.20.0 y medir `prepare` (las 15 migraciones con datos reales); `GET /api` en la red interna; `down -v` al terminar | **OK nominal de Sam** (es una copia de datos reales; no sale del VPS). Lo corre quien tiene SSH |
| **C · Smoke en prueba** | cuenta 2, **después** de la subida real | login por SSO, Bandeja, Ficha DTD y un mensaje de prueba a la bandeja 11 | La cuenta 2 ya estaba activa: la usa la sesión «Cable Paso 3b» (webhook 4, bandeja 11). V7 y S10–S13 quedan pendientes y los hace Sam con su navegador: Bandeja y SSO, Ficha DTD y un mensaje de prueba a la bandeja 11. Si la cuenta 2 se suspende o no, lo decide Sam cuando termine Cable. |

Sin la fase A en verde **no se pide el OK de la subida**. La fase B decide la duración; si no se hace, el runbook usa el máximo.

## 6 · Migraciones de la 4.20.0

`db/migrate/` entre los tags (C):

```
20261006212107 add_slack_channel_id_to_conversation_monitors
20261019130258 create_shopify_custom_apps
20261021105045 add_work_preferences_to_account_users
20261026062035 create_captain_mcp_servers
20261027115208 create_captain_mcp_tools
20261029104503 add_index_to_conversations_sla_policy_id
20261103142055 enable_data_import_for_all_accounts        (datos; down vacío)
20261104085110 add_pending_data_import_items_index
20261104085633 create_data_exports
20261104104833 add_callback_auth_to_channel_sms
20261107075626 add_review_state_to_captain_mcp_tools
20261111031108 replace_retired_gpt_five_captain_models   (corre un job en línea; down vacío)
20261113073350 add_unified_login_to_channel_instagram
20261113115701 remove_redundant_data_exports_account_index
20261116211055 add_contact_id_and_inbox_id_index_to_contact_inboxes  (índice concurrente)
```

Las corre `db:chatwoot_prepare`, en el contenedor de una sola vez del runbook, con `rails` y `sidekiq` detenidos.

## 7 · Vuelta atrás

| Situación | Qué se hace | Tiempo |
|---|---|---|
| a) `prepare` falla y **ninguna** de las 15 versiones está en `schema_migrations` (se cuentan una por una: dos tienen fecha anterior al schema de 4.19.1, así que `max(version)` no sirve) | devolver el `compose.yml` guardado y recrear `rails` y `sidekiq` con la imagen vieja | ~3–5 min |
| b) Rojo y `prepare` **sí** migró | una base migrada no se usa con la imagen vieja: `restaurar.sh` del respaldo conjunto de la ventana, con la imagen vieja | ~15 min (restauración de 200 s medida en P5, más preparar y S1–S9) |
| c) La 4.20.0 anda pero un inicializador no carga | (a) o (b). No se deja corriendo sin el candado ni sin la revocación | — |

Comandos exactos en el [runbook](../../runbooks/chatwoot-subida-4-20.md#6--vuelta-atrás).

## Aceptación

1. [x] Inventario de piezas propias con veredicto por código contra el diff de los dos tags (§2).
2. [x] Imagen `v4.20.0-ce` fijada por digest en `infra/chatwoot/compose.yml` (§3).
3. [x] Runbook de subida con respaldo, aviso a «Cable Paso 3b», comandos sin `compose up` general, verificación, vuelta atrás y duración.
4. [x] Fase A del ensayo en verde, con los controles en rojo: el 2026-11-19, de las 02:33Z a las 03:02Z, con turno del DG. Las cuatro corridas dieron 24/0, 15/0, 14/0 y 44/0. Detalle en el handoff. `smoke-guia.mjs` no se corrió: lo cubre S13.
5. [—] Fase B: omitida por el DG el 2026-11-19. La receta queda en el runbook, §9.
6. [ ] Subida en producción con S1–S13 en verde (OK nominal de Sam y hora acordada; la ejecuta el DG o una sesión designada). **Hecha el 2026-11-19 por el DG:** corte de 3 min 5 s, `prepare` de 50 s, S1–S9 y V1–V8 OK. Faltan S10–S13 y V7.
7. [ ] Fase C en prueba. La cuenta 2 ya estaba activa: la usa la sesión «Cable Paso 3b» (webhook 4, bandeja 11). V7 y S10–S13 quedan pendientes y los hace Sam con su navegador: Bandeja y SSO, Ficha DTD y un mensaje de prueba a la bandeja 11. Si la cuenta 2 se suspende o no, lo decide Sam cuando termine Cable.
8. [ ] Cierre: cabeceras de los inicializadores, `IMAGEN_CHATWOOT` de los dos ensayos, `chatwoot-selectores.json`, monitor de Uptime Kuma y fila del Registro del runbook de versiones.

Los puntos 4 a 8 son de la ejecución; la PR de esta SDD cubre 1 a 3.

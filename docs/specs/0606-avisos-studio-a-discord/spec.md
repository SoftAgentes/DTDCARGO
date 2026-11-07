---
sdd: "0606"
title: "Avisos del Studio: de Telegram a Discord"
status: in-progress
author: "Claude"
created: 2026-11-05
updated: 2026-11-05
supersedes: null
superseded_by: null
related: ["0036", "0146", "0271", "0544"]
confidencialidad: interno
---

# SDD-0606 — Avisos del Studio: de Telegram a Discord

> Los avisos al equipo salen a canales de Discord con lo mínimo: qué pasó, el código y el enlace al Studio. Telegram queda de respaldo hasta que Discord esté probado y se retira en ese mismo paso.

## Contexto

Decisión de Sam (2026-11-05): Discord reemplaza a Telegram como central única de avisos y de conversación con sus agentes, con corte directo y sin semana de doble envío. El diseño acordado para el Studio: un aviso automático de canal (webhook) por canal, cinco canales que calzan con las cinco categorías de SDD-0271, sin menciones por defecto, mensajes de hasta 2.000 caracteres, reintento cuando Discord pide esperar y la dirección del webhook tratada como llave. Los avisos llevan lo mínimo: código y enlace, sin nombre, teléfono ni montos.

**Estado antes de esta spec, medido en el código (`main` 49bdba2e5):**

| Qué | Dónde | Cuántos |
|---|---|---|
| Avisos por categoría (`dispatchTelegramAlert`) | 13 módulos de `lib/studio/`, `lib/news/ceo-brief.ts` y `app/api/cron/alta-health` | 15 llamadas |
| Avisos por persona (chat privado del perfil) | bugs (`bug-email-notify.ts` y su reintento `notify/bug-notif-outbox.ts`), Bitácora, solicitudes de cambio, tarifas por vencer, reporte diario sin rutas | 7 envíos |
| Enlace de chats y respuestas del bot | `app/api/telegram/webhook/route.ts` | 5 envíos, se retiran con Telegram |
| Servidor (no es Studio) | `infra/ops/web/publicar-web.sh`, `infra/ops/web/telegram-webhook.sh`, `infra/ops/uptime-kuma/` | fuera de esta spec |

`app/api/contact` y `app/api/public/estimacion` no envían a Telegram por sí mismos: llaman a `contact-lead-notify` y `estimado-lead-notify`, que están en la primera fila.

Lo que hoy sale a Telegram lleva datos de personas: el alta de un cliente manda nombre, documento, correo y teléfono; el reporte de pago, monto y método; el mensaje del portal, el texto que escribió el cliente.

## Decisiones

### D1 · La dirección de cada webhook vive en una variable del servidor

Una por categoría: `DISCORD_WEBHOOK_REGISTRO`, `DISCORD_WEBHOOK_CONVERSACIONES`, `DISCORD_WEBHOOK_BUGS`, `DISCORD_WEBHOOK_REPORTES`, `DISCORD_WEBHOOK_EQUIPO`.

Por qué no una columna protegida en la base:

- La dirección es una llave: quien la tenga escribe en el canal. En la base quedaría en cada respaldo (los respaldos salen cifrados a Backblaze, pero el dump la tendría), la leería cualquier consulta con `service_role` y habría que ocultarla con una tabla aparte sin `SELECT` o con cifrado. Es más superficie para proteger lo mismo.
- Las demás llaves del Studio (Telegram, Resend, Anthropic) ya viven en el `.env` del servidor y se cargan con `infra/ops/migrate/env-set.sh`. Una llave más sigue el camino conocido.
- Cambiarla exige entrar al servidor. Es un costo aceptado: se cambia sólo si se filtra o si se recrea el canal.

La dirección se valida ENTERA antes de usarla: `https`, uno de los hosts de Discord (`discord.com`, `discordapp.com`, `canary.` y `ptb.`), sin usuario, puerto, query ni fragmento, y la ruta exacta `/api[/vN]/webhooks/<id de 17 a 20 dígitos>/<token>`. Un valor con otra forma cuenta como ausente: una errata no termina en un envío de datos a otro servidor. No aparece en errores, en registros ni en la pantalla.

### D1b · Los canales tienen UN tenant dueño (revisión de Codex, A5)

Las variables son del servidor, no de un tenant, y el cron del reporte diario recorre todos los tenants. Telegram separaba sus destinos por `tenant_id`; Discord no lo hacía. Ahora sólo escribe en estos canales el tenant cuyo ID está en `DISCORD_TENANT_ID`. Sin esa variable, Discord queda apagado para todos (falla cerrado) y los avisos siguen por Telegram. La pantalla de Ajustes de otro tenant dice «Discord no está asignado a esta empresa · sigue por Telegram». La cola guarda el `tenant_id` de cada aviso y el drenado vuelve a comprobarlo antes de mandar.

### D2 · El destino se generaliza en la categoría, no en la tabla de destinos

Las cinco categorías (`registro`, `conversaciones`, `bugs`, `reportes`, `equipo`), la regla de respaldo y la pantalla de Ajustes se reutilizan. Lo que no se reutiliza para Discord es la tabla `telegram_destinations` con sus rutas (migración 0386).

| Categoría | Canal de Discord | Variable |
|---|---|---|
| Registro de clientes | `#registro-clientes` | `DISCORD_WEBHOOK_REGISTRO` |
| Conversaciones del portal | `#conversaciones-portal` | `DISCORD_WEBHOOK_CONVERSACIONES` |
| Bugs reportados | `#bugs` | `DISCORD_WEBHOOK_BUGS` |
| Reporte diario de operaciones | `#reporte-diario` | `DISCORD_WEBHOOK_REPORTES` |
| Otros avisos al equipo | `#avisos-equipo` | `DISCORD_WEBHOOK_EQUIPO` |

Alternativa descartada: agregar a `telegram_destinations` un tipo `discord` y rutear categorías a canales desde la pantalla. Se descartó porque con un webhook por canal y los canales uno a uno con las categorías, la tabla sólo guardaría lo que el diseño ya fija; porque obligaría a guardar en la base una referencia a la llave o la llave misma (D1); y porque dejaría el envío dependiendo de una migración sin aplicar. Si más adelante hace falta mandar una categoría a dos canales, se agrega sin tocar los módulos de aviso: todos entran por `dispatchAlert`.

La puerta de entrada pasa de `dispatchTelegramAlert(…, texto)` a `dispatchAlert(…, { telegramText, discord })` en `lib/studio/alerts/dispatch-alert.ts`. `dispatchTelegramAlert` queda intacta: es el respaldo.

### D3 · Una categoría sin destino cae al respaldo, no calla

Orden de entrega de un aviso:

1. El canal de Discord de su categoría.
2. Si esa categoría no tiene dirección, o Discord no guardó el mensaje: `#avisos-equipo`, con una línea que dice de qué categoría venía («Sin canal propio · Registro de clientes»).
3. Si tampoco se guardó y la categoría no puede perderse (`registro`, `bugs`, `reportes`): la **cola durable** (D3b).
4. Si Discord no aplica, o la categoría no va a la cola, o la cola todavía no existe: el camino de SDD-0271 (rutas de Telegram). **Desde el 2026-11-06 Telegram está retirado del Studio** (D8): ese camino ya no entrega, y el aviso queda sólo en el correo y la campana.

Si Discord entrega, Telegram no se usa: no hay doble envío. Sin ninguna variable de Discord, el Studio se comporta exactamente como antes; lo mide una prueba.

**Entregado, rechazado, reintentable o incierto (revisión de Codex, M2).** Cada envío dice qué pasó con el mensaje:

| Estado | Cuándo | Qué se hace |
|---|---|---|
| entregado | Discord respondió con el mensaje guardado y su ID | Listo |
| rechazado | Dirección inválida o un 4xx (webhook borrado, llave inválida) | No se guardó: se prueba el canal de respaldo |
| reintentable | 429 que pide esperar más de 5 s, un 5xx, o no hubo conexión (DNS, conexión rechazada) | No se guardó: canal de respaldo y después la cola |
| incierto | Tiempo agotado después de enviar, conexión cortada, o un 2xx sin el ID | Pudo quedar guardado: **no se repite** en otro canal, ni por Telegram, ni en la cola. Se registra |

Tratar un 5xx como «no se guardó» es una inferencia de la documentación de Discord, no una medición: si Discord guardara el mensaje y aun así respondiera 5xx, el aviso saldría dos veces. Se prefiere un duplicado a perder un aviso de registro o de bug.

### D3b · Cola durable para lo que no puede perderse (revisión de Codex, A3)

Migración `0515_studio_alert_outbox`, **sin aplicar**. Tabla `studio_alert_outbox`:

- guarda **sólo** el aviso mínimo (un CHECK rechaza cualquier clave fuera de `titulo`, `codigo`, `url` y `conteos`, y más de 2 KB) y los IDs de Discord a mencionar;
- RLS activada sin policies, sin privilegios para `anon` ni `authenticated`: sólo `service_role`;
- la drena el cron que ya corre cada 5 minutos (`/api/cron/bug-notifications-drain`), sin entrada nueva en el crontab;
- reintenta con espera creciente (1, 5, 15, 30, 60, 120 y 240 minutos) hasta 8 intentos y después la deja abandonada con su último error;
- toma cada fila con un candado optimista (`next_attempt_at` como versión): dos drenados a la vez no la mandan dos veces;
- una entrega incierta cierra la fila sin repetir; si Discord pide esperar demasiado, frena el lote hasta la próxima corrida;
- borra las filas cerradas a los 30 días;
- guarda el ID del mensaje de Discord de cada entrega.

Sin la tabla, encolar falla y el aviso sigue por Telegram; el drenado devuelve ceros. No es migrate-first.

Los avisos por persona no van a esta cola: los de bugs tienen la suya (`bug_notifications`, D4) y los de Bitácora caen al Telegram de la persona.

`fallback: "none"` (conversaciones y reporte diario) sigue significando «no difundir a todos los administradores por Telegram». En Discord no aplica: el respaldo es un canal sin menciones y no le suena a nadie.

### D4 · Avisos por persona: mención en el canal

En Discord no hay chat privado. Un aviso por persona se escribe en el canal de su categoría mencionando a la persona, y sólo si enlazó su ID de usuario de Discord en su perfil (Perfil › Preferencias › «Menciones en Discord»).

- Enlazar el ID es lo que enciende las menciones. Sin ID no hay mención y tampoco se escribe en el canal un aviso que era para una sola persona.
- Los interruptores de cada módulo (`channel_telegram` de bugs, el de Bitácora, el del portal) se siguen aplicando antes de enviar. Pasan a significar «avísame por mensajería», sea Telegram o Discord. No se renombran en esta spec.
- Mientras exista el token de Telegram, quien no enlazó Discord sigue recibiendo por Telegram. Al retirarlo, esos avisos quedan en la campana del Studio y el correo, que nunca dependieron de esto.
- El ID se guarda en `user_profiles.discord_user_id` (migración 0514, **sin aplicar**). No es una credencial; sí es un dato personal. El código tolera que la columna no exista: los avisos salen sin menciones y el perfil dice que todavía no se puede guardar.
- Las dos acciones del perfil exigen ser miembro activo del Studio (`getStudioAccess`) y sólo tocan la fila de quien está en sesión.
- El reintento de avisos de bugs (`bug_notifications`) prueba primero la mención en Discord. Si Discord no la guardó por una falla pasajera, la fila sigue viva para el próximo tick aunque la persona no tenga Telegram (revisión de Codex, A4); antes se abandonaba. Una mención incierta cierra la fila sin repetir.
- El ID no se verifica contra Discord: un webhook no puede consultar miembros. Si alguien pega el ID de otra persona, esa persona recibe menciones en un canal que sólo ve si tiene el rol. Riesgo aceptado; el CHECK de la base sólo deja entrar números de 17 a 20 dígitos.

| Aviso por persona | Canal | Qué lleva |
|---|---|---|
| Asesor de una conversación del portal | `#conversaciones-portal` | mención + referencia del hilo + enlace |
| Asesor en una solicitud de cambio de datos o un cambio bloqueado | `#avisos-equipo` | mención + Shipping Mark + enlace a la ficha |
| Quien reportó un bug: cambio de estado o respuesta | `#bugs` | mención + folio + enlace |
| Tarea nueva o resumen del día en Bitácora | `#avisos-equipo` | mención + enlace (el resumen, además, cuántas tareas) |

### D5 · A Discord sale lo mínimo, y el tipo lo impone

Un aviso trae dos textos que no se mezclan:

- `telegramText`: el texto completo de siempre. Sólo va a Telegram.
- `discord`: un `MinimalAlert` con `titulo`, `codigo`, `url` y, para reportes, `conteos` (etiqueta fija y un número). No tiene campo de texto libre.

Qué lleva cada aviso está en [`privacidad.md`](privacidad.md) §2, campo por campo. Resumen: Shipping Mark, folio, código de factura o referencia del hilo, y el enlace; el detalle se ve en el Studio, detrás del inicio de sesión. Los contactos y estimados de la web no quedan guardados en el ERP: su detalle sigue llegando por el correo al equipo y a Discord sólo sale que llegaron.

El reporte diario sale con conteos (recepciones, despachos, gastos cargados, incidencias) y **sin el total de gastos**. El texto que redacta el modelo no sale a Discord porque trae cifras de dinero.

### D6 · Reglas del envío

`lib/studio/discord/send-webhook.ts`:

- Recorta a 2.000 caracteres sin partir un emoji.
- `allowed_mentions.parse = []`: `@everyone`, `@here` y los roles no suenan aunque el texto los traiga. Sólo suenan los ID de usuario que el llamador pasa explícitos.
- Pide `wait=true` y sólo da por entregado lo que vuelve con el ID del mensaje (revisión de Codex, A3).
- Ante un HTTP 429 espera el tiempo que indica Discord (`retry_after` del cuerpo, o las cabeceras `Retry-After` o `X-RateLimit-Reset-After`) y reintenta, hasta 3 intentos. Sin dato legible espera 1 s y nunca menos de 250 ms, para no gastar los intentos de golpe (M1). Si Discord pide más de 5 segundos no espera: devuelve `reintentable` y decide el despachador. Esto corre dentro de pedidos de usuarios y no puede dejarlos colgados.
- Corta un pedido colgado a los 8 segundos.
- Manda `User-Agent: DiscordBot (https://dtdcargo.com, 1.0)`, el formato que documenta Discord (M4).
- Nunca lanza. Devuelve `{ ok, estado, messageId, error }` y el error no contiene la dirección: de un error de red sólo se conserva su nombre o su código.
- Sin vista previa de enlaces.

### D8 · Telegram se retira ahora (decisión de Sam, 2026-11-06)

Sam: «deberíamos eliminar Telegram en este momento, entonces procede a eliminar Telegram». Motivo: lo que el Studio mandaba a Telegram llevaba datos de clientes (el alta con nombre, documento, correo y teléfono; el mensaje del portal con el nombre y un extracto) y el texto de `/privacidad` de la #399 dice que la mensajería interna no los recibe.

- `lib/studio/telegram/send-message.ts` deja de mandar: devuelve `{ ok: false }` sin ningún pedido, con o sin `TELEGRAM_BOT_TOKEN`. Todos los envíos del Studio a Telegram pasan por esa función (medido: los otros dos usos de la API, en `lib/studio/integration-health.ts`, sólo consultan el estado del bot). Lo mide `lib/studio/telegram/__tests__/send-message.test.ts`.
- Ajustes › Alertas del equipo deja de mostrar la matriz de destinos de Telegram y dice que está retirado.
- Consecuencia: si un aviso no sale por Discord, ya no hay respaldo de mensajería. Queda en el correo y la campana del Studio; los de registro, bugs y reporte diario, además, en la cola (0515).
- Este cambio de código protege desde que se publique la #380. Hasta entonces la web en producción sigue mandando a Telegram: para cortarlo antes hay que retirar `TELEGRAM_BOT_TOKEN` del servidor (operación del Director General).
- No se toca el bloque de Telegram del perfil (`ProfileModal.tsx` cruza con la SDD-0603) ni la oficina (Hermes y ALFRED). El borrado de código y datos de Telegram sigue siendo el paso 9 del corte.

### D7 · Entorno de prueba

Con `APP_ENV=staging` Discord queda apagado aunque las variables existan, igual que el correo (SDD-0544). Un alta de prueba no puede sonar en el canal real.

## Alcance

### La pantalla

`/studio/admin/alertas-telegram` conserva su ruta y pasa a llamarse «Alertas del equipo». Arriba, un bloque de sólo lectura con el estado de cada categoría en Discord: «Sale a #canal», «Sin canal propio · cae a #avisos-equipo», «Sin Discord · sigue por Telegram», «Discord no está asignado a esta empresa · sigue por Telegram» o «Apagado en el entorno de prueba». Si una variable tiene un valor que no es un webhook de Discord, se nombra la variable, nunca el valor. Abajo, la matriz de Telegram de SDD-0271 sin cambios, rotulada como respaldo.

En el perfil, dentro de Preferencias, el bloque «Menciones en Discord»: un campo para el ID, Guardar y Quitar, y cómo encontrar el ID en Discord.

### Allowlist

Nuevos:

- `lib/studio/discord/send-webhook.ts`, `channels.ts`, `minimal-alert.ts`
- `lib/studio/discord/__tests__/send-webhook.test.ts`, `channels-y-aviso.test.ts`, `discord-user-id.migration.test.ts`
- `lib/studio/alerts/dispatch-alert.ts`, `user-alert.ts`, `discord-delivery.ts`, `alert-outbox.ts`, `__tests__/dispatch-alert.test.ts`, `__tests__/alert-outbox.test.ts`, `__tests__/alert-outbox.migration.test.ts`
- `lib/studio/discord/__tests__/webhook-fixture.ts` (direcciones falsas con la forma real)
- `lib/studio/__tests__/avisos-discord-minimo.test.ts`
- `app/studio/(app)/admin/alertas-telegram/_components/DiscordChannelsStatus.tsx` y `__tests__/DiscordChannelsStatus.test.tsx`
- `app/studio/(app)/usuarios/__tests__/discord-user-id.test.ts`
- `supabase/migrations/0514_user_profiles_discord_user_id.sql` y `0515_studio_alert_outbox.sql`, con sus contratos en `supabase/tests/`
- `docs/specs/0606-avisos-studio-a-discord/spec.md` y `privacidad.md`
- `.agents/handoffs/sdd-0606-avisos-studio-a-discord.md`

Modificados:

- Avisos por categoría: `lib/studio/new-client-notify.ts`, `contact-lead-notify.ts`, `estimado-lead-notify.ts`, `cotizacion-request-notify.ts`, `payment-report-notify.ts`, `packing-list-notify.ts`, `conversation-inbound-notify.ts`, `change-request-notify.ts`, `rate-expiry-notify.ts`, `bug-email-notify.ts`, `lib/studio/portal/sin-acceso-aviso.ts`, `lib/studio/mail/mail-health-notify.ts`, `lib/studio/searates/ocean-rates-notify.ts`, `lib/studio/naviera/consolidation-request-notify.ts`, `lib/studio/bitacora/notify.ts`, `lib/studio/notify/bug-notif-outbox.ts`, `lib/news/ceo-brief.ts`, `app/api/cron/alta-health/route.ts`, `app/api/cron/ceo-brief/route.ts`, `app/api/cron/bug-notifications-drain/route.ts` (drena también la cola)
- Pruebas existentes: `lib/studio/notify/__tests__/bug-notif-outbox.test.ts` (casos de Discord), `lib/studio/telegram/__tests__/fake-db.ts` (INSERT, y una tabla ausente responde como una migración sin aplicar)
- Pantalla y perfil: `app/studio/(app)/admin/alertas-telegram/page.tsx`, `app/studio/(app)/admin/page.tsx`, `app/studio/(app)/usuarios/actions.ts`, `app/studio/_components/wiring/ProfileModal.tsx`
- Entorno: `.env.example`, `infra/dtd-cargo/.env.example`, `lib/studio/env-status.ts`
- Registro de la migración: `supabase/migrations-baseline.json`, `supabase/pending-migration-symbol-declarations.json`
- Contrato de permisos: `lib/studio/rbac-actions-guard.test.ts` (dos entradas en `EXCEPCIONES` para las acciones del ID de Discord, con su verificación; inventario 459 → 461)
- Documentos: `docs/legal/privacidad/inventario-terceros.md`, `docs/specs/README.md` (índice generado)

### Qué no cambia

- `lib/studio/telegram/` completo, `app/api/telegram/webhook/route.ts`, la matriz de destinos de Telegram y sus acciones, las tablas de la migración 0386.
- Los correos, la campana del Studio y las notificaciones push.
- Los nombres `channel_telegram`, `telegram_attempts`, `delivered_telegram_at` y `telegramAttempted`: pasan a contar la mensajería, sea cual sea. Renombrarlos toca la base y la pantalla de preferencias, y va con el retiro de Telegram.

### Gobernanza

| Política | Estado | Evidencia |
|---|---|---|
| FRM-01 (formulario) | cumplimiento | El campo del ID tiene etiqueta, ayuda asociada con `aria-describedby`, valida formato en el servidor y muestra el motivo |
| ERR-01 (error) | cumplimiento | El error de guardar no muestra el texto de la base; lo mide `discord-user-id.test.ts` |
| A11Y-01 | cumplimiento | Aviso de respaldo con `role="status"`; resultado de guardar con `aria-live`; botones con `aria-busy` |
| CMP-01 (componentes) | cumplimiento | Usa `Badge` y las clases `studio-btn`, `studio-input`, `studio-label`; ningún componente nuevo de interfaz base |
| AUD-01 (auditoría) | no aplica | El ID de Discord es un dato de contacto que la persona edita en su propia fila, como el teléfono del perfil; no cambia accesos ni permisos |
| LOD-01, PRG-01 | no aplica | Sin cargas largas ni progreso |

## El corte: qué se retira de Telegram y en qué orden

Nada de esto lo ejecuta esta spec. Es el orden para cuando Sam descongele la publicación.

1. **Publicar la web con este código.** Sin variables de Discord no cambia nada: todo sigue por Telegram.
1b. **Publicar el texto de `/privacidad`** que cubre los avisos a Discord (aprobado por Sam; PR aparte). Sin eso no se ponen las direcciones del paso 3: los avisos a Discord no se encienden antes.
2. **Crear en Discord** los cinco canales y un webhook por canal (Ajustes del canal › Integraciones › Webhooks).
3. **Poner las cinco direcciones y `DISCORD_TENANT_ID`** (el ID del tenant de DTD Cargo) en el servidor con `infra/ops/migrate/env-set.sh` y reiniciar la web. Desde ese momento los avisos por categoría de ese tenant salen a Discord y dejan de salir por Telegram.
4. **Probar** un aviso por categoría y mirar Ajustes › Alertas del equipo: las cinco deben decir «Sale a #canal».
5. **Aplicar las migraciones 0514 y 0515**, de a una (OK nominal de Sam para cada una, pasando por el Director General, y runbook): la 0514 para que cada persona pueda enlazar su ID; la 0515 para la cola. Pueden ir antes o después del paso 3.
6. **Cada persona enlaza su ID de Discord** en su perfil.
7. **Retirar `TELEGRAM_BOT_TOKEN` del servidor.** Es el apagado: sin token, `sendTelegramMessage` devuelve error sin enviar. A partir de acá, si Discord no entrega, el aviso por mensajería se pierde y queda sólo el correo y la campana.
8. **Dar de baja el webhook del bot** (`infra/ops/web/telegram-webhook.sh`) y retirar `TELEGRAM_WEBHOOK_SECRET` y `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`.
9. **Otra spec, después del corte:** borrar `lib/studio/telegram/`, la ruta del webhook, el bloque de Telegram del perfil y de Ajustes, renombrar `channel_telegram` y los contadores, y decidir qué se hace con `telegram_destinations`, `telegram_alert_routes` y las columnas `telegram_*` de `user_profiles` (guardan identificadores de chat de personas: borrarlos es un cambio de datos con su propio OK).

Vuelta atrás entre los pasos 3 y 7: quitar las variables de Discord y reiniciar. Todo vuelve a Telegram.

## Aceptación

- [x] Con canal propio el aviso sale a Discord y no a Telegram.
- [x] A Discord no llega nada del texto completo: medido sobre el pedido HTTP con nombre, teléfono, correo y monto.
- [x] Alta de cliente y reporte de pago reales: sale el código y no el nombre, documento, correo, teléfono ni monto.
- [x] Una categoría sin dirección cae a `#avisos-equipo` y lo dice; si el canal propio falla, entrega por el respaldo; si Discord no entrega, sale por Telegram.
- [x] Sin variables de Discord, el comportamiento es el de antes y no se hace ningún pedido a Discord.
- [x] Recorte a 2.000, sin menciones por defecto, reintento con el tiempo indicado, tope de espera, nunca lanza, la dirección no sale en el error.
- [x] Mención sólo a quien enlazó su ID; sin ID no se escribe en el canal un aviso por persona.
- [x] En `APP_ENV=staging` no se escribe en Discord.
- [x] La migración 0514 pasa su contrato en PostgreSQL embebido, con control rojo y un mutante.
- [x] Revisión de Codex, cada punto con una prueba que falló antes del arreglo: A3 (`wait=true` e ID del mensaje; cola para registro, bugs y reportes), A4 (el reintento de bugs sigue vivo sin Telegram), A5 (sólo el tenant de `DISCORD_TENANT_ID`), M1 (espera por defecto y mínima ante 429; el drenado frena el lote), M2 (entrega incierta no se repite), M4 (User-Agent y URL entera).
- [x] La migración 0515 pasa su contrato en PostgreSQL embebido, con control rojo y dos mutantes (sin la barrera del aviso mínimo; con privilegios para `authenticated`). El candado del drenado se comprobó con un mutante.
- [x] La pantalla nombra las categorías sin canal y nunca muestra una dirección.
- [ ] `pnpm verify` — **FALLÓ** e incompleto en la única corrida (2026-11-05): un rojo real de esta rama en el contrato de permisos, ya corregido y vuelto a medir aislado; tres archivos ajenos que pasaron en uno de los dos intentos; `migrations-applied`, `sql-tests` y `schema-rebuild` sin medir. Falta una corrida completa sobre la rama final. Detalle por paso en el handoff.
- [ ] Prueba real contra un webhook de Discord: **no hecha**. No existe todavía ningún webhook y crear uno es de Sam. Los formatos de pedido y de respuesta están tomados de la documentación de Discord, no medidos.

## Fuera de alcance

- Scripts del servidor: `infra/ops/web/publicar-web.sh`, `infra/ops/web/telegram-webhook.sh`, `infra/ops/uptime-kuma/` y sus pruebas. Avisan publicaciones y salud por Telegram con su propia llave; pasan a `#publicaciones` y `#salud` en otra tarea.
- `infra/ops/staging/verificar-aislamiento.sh`: conviene sumar las cinco variables a su lista de integraciones que deben estar vacías en prueba. El código ya apaga Discord en prueba (D7); esto sería la segunda barrera.
- La oficina (Hermes, el puente de ALFRED, Paperclip) y el bot conversacional.
- El retiro del código y de los datos de Telegram (paso 9 del corte).
- Estado de Discord en Debug › Estado (`lib/studio/integration-health.ts`): hoy sólo se listan los nombres de las variables presentes.

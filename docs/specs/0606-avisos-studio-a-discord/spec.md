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

La dirección se valida antes de usarla (`https://discord.com/api/webhooks/<id>/<token>` y sus variantes oficiales). Un valor con otra forma cuenta como ausente: una errata no termina en un envío de datos a otro servidor. No aparece en errores, en registros ni en la pantalla.

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
2. Si esa categoría no tiene dirección, o el envío falla: `#avisos-equipo`, con una línea que dice de qué categoría venía («Sin canal propio · Registro de clientes»).
3. Si Discord no entregó por ningún canal: el camino de SDD-0271 (rutas de Telegram y, sin rutas, los administradores), mientras exista el token de Telegram.

Si Discord entrega, Telegram no se usa: no hay doble envío. Sin ninguna variable de Discord, el Studio se comporta exactamente como antes; lo mide una prueba.

`fallback: "none"` (conversaciones y reporte diario) sigue significando «no difundir a todos los administradores por Telegram». En Discord no aplica: el respaldo es un canal sin menciones y no le suena a nadie.

### D4 · Avisos por persona: mención en el canal

En Discord no hay chat privado. Un aviso por persona se escribe en el canal de su categoría mencionando a la persona, y sólo si enlazó su ID de usuario de Discord en su perfil (Perfil › Preferencias › «Menciones en Discord»).

- Enlazar el ID es lo que enciende las menciones. Sin ID no hay mención y tampoco se escribe en el canal un aviso que era para una sola persona.
- Los interruptores de cada módulo (`channel_telegram` de bugs, el de Bitácora, el del portal) se siguen aplicando antes de enviar. Pasan a significar «avísame por mensajería», sea Telegram o Discord. No se renombran en esta spec.
- Mientras exista el token de Telegram, quien no enlazó Discord sigue recibiendo por Telegram. Al retirarlo, esos avisos quedan en la campana del Studio y el correo, que nunca dependieron de esto.
- El ID se guarda en `user_profiles.discord_user_id` (migración 0514, **sin aplicar**). No es una credencial; sí es un dato personal. El código tolera que la columna no exista: los avisos salen sin menciones y el perfil dice que todavía no se puede guardar.
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
- Ante un HTTP 429 espera el tiempo que indica Discord (`retry_after` del cuerpo o la cabecera `Retry-After`) y reintenta, hasta 3 intentos. Si Discord pide más de 5 segundos no espera: devuelve el error y el despachador usa su respaldo. Esto corre dentro de pedidos de usuarios y no puede dejarlos colgados.
- Corta un pedido colgado a los 8 segundos.
- Nunca lanza. Devuelve `{ ok, error }` y el error no contiene la dirección.
- Sin vista previa de enlaces.

### D7 · Entorno de prueba

Con `APP_ENV=staging` Discord queda apagado aunque las variables existan, igual que el correo (SDD-0544). Un alta de prueba no puede sonar en el canal real.

## Alcance

### La pantalla

`/studio/admin/alertas-telegram` conserva su ruta y pasa a llamarse «Alertas del equipo». Arriba, un bloque de sólo lectura con el estado de cada categoría en Discord: «Sale a #canal», «Sin canal propio · cae a #avisos-equipo», «Sin Discord · sigue por Telegram» o «Apagado en el entorno de prueba». Si una variable tiene un valor que no es un webhook de Discord, se nombra la variable, nunca el valor. Abajo, la matriz de Telegram de SDD-0271 sin cambios, rotulada como respaldo.

En el perfil, dentro de Preferencias, el bloque «Menciones en Discord»: un campo para el ID, Guardar y Quitar, y cómo encontrar el ID en Discord.

### Allowlist

Nuevos:

- `lib/studio/discord/send-webhook.ts`, `channels.ts`, `minimal-alert.ts`
- `lib/studio/discord/__tests__/send-webhook.test.ts`, `channels-y-aviso.test.ts`, `discord-user-id.migration.test.ts`
- `lib/studio/alerts/dispatch-alert.ts`, `user-alert.ts`, `__tests__/dispatch-alert.test.ts`
- `lib/studio/__tests__/avisos-discord-minimo.test.ts`
- `app/studio/(app)/admin/alertas-telegram/_components/DiscordChannelsStatus.tsx` y `__tests__/DiscordChannelsStatus.test.tsx`
- `app/studio/(app)/usuarios/__tests__/discord-user-id.test.ts`
- `supabase/migrations/0514_user_profiles_discord_user_id.sql` y su contrato en `supabase/tests/`
- `docs/specs/0606-avisos-studio-a-discord/spec.md` y `privacidad.md`
- `.agents/handoffs/sdd-0606-avisos-studio-a-discord.md`

Modificados:

- Avisos por categoría: `lib/studio/new-client-notify.ts`, `contact-lead-notify.ts`, `estimado-lead-notify.ts`, `cotizacion-request-notify.ts`, `payment-report-notify.ts`, `packing-list-notify.ts`, `conversation-inbound-notify.ts`, `change-request-notify.ts`, `rate-expiry-notify.ts`, `bug-email-notify.ts`, `lib/studio/portal/sin-acceso-aviso.ts`, `lib/studio/mail/mail-health-notify.ts`, `lib/studio/searates/ocean-rates-notify.ts`, `lib/studio/naviera/consolidation-request-notify.ts`, `lib/studio/bitacora/notify.ts`, `lib/studio/notify/bug-notif-outbox.ts`, `lib/news/ceo-brief.ts`, `app/api/cron/alta-health/route.ts`, `app/api/cron/ceo-brief/route.ts`
- Pantalla y perfil: `app/studio/(app)/admin/alertas-telegram/page.tsx`, `app/studio/(app)/admin/page.tsx`, `app/studio/(app)/usuarios/actions.ts`, `app/studio/_components/wiring/ProfileModal.tsx`
- Entorno: `.env.example`, `infra/dtd-cargo/.env.example`, `lib/studio/env-status.ts`
- Registro de la migración: `supabase/migrations-baseline.json`, `supabase/pending-migration-symbol-declarations.json`
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
2. **Crear en Discord** los cinco canales y un webhook por canal (Ajustes del canal › Integraciones › Webhooks).
3. **Poner las cinco direcciones en el servidor** con `infra/ops/migrate/env-set.sh` y reiniciar la web. Desde ese momento los avisos por categoría salen a Discord y dejan de salir por Telegram.
4. **Probar** un aviso por categoría y mirar Ajustes › Alertas del equipo: las cinco deben decir «Sale a #canal».
5. **Aplicar la migración 0514** (OK nominal de Sam y runbook) para que cada persona pueda enlazar su ID. Puede ir antes o después del paso 3.
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
- [x] La pantalla nombra las categorías sin canal y nunca muestra una dirección.
- [ ] `pnpm verify` — resultado por comprobación en el handoff.
- [ ] Prueba real contra un webhook de Discord: **no hecha**. No existe todavía ningún webhook y crear uno es de Sam. Los formatos de pedido y de respuesta están tomados de la documentación de Discord, no medidos.

## Fuera de alcance

- Scripts del servidor: `infra/ops/web/publicar-web.sh`, `infra/ops/web/telegram-webhook.sh`, `infra/ops/uptime-kuma/` y sus pruebas. Avisan publicaciones y salud por Telegram con su propia llave; pasan a `#publicaciones` y `#salud` en otra tarea.
- `infra/ops/staging/verificar-aislamiento.sh`: conviene sumar las cinco variables a su lista de integraciones que deben estar vacías en prueba. El código ya apaga Discord en prueba (D7); esto sería la segunda barrera.
- La oficina (Hermes, el puente de ALFRED, Paperclip) y el bot conversacional.
- El retiro del código y de los datos de Telegram (paso 9 del corte).
- Estado de Discord en Debug › Estado (`lib/studio/integration-health.ts`): hoy sólo se listan los nombres de las variables presentes.

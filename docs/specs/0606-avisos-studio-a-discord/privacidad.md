# SDD-0606 — Revisión de datos personales: Discord como tercero nuevo

Hecha el 2026-11-05 con [`revisar-datos-ve`](../../../.claude/skills/revisar-datos-ve/SKILL.md), sobre la rama `claude/gracious-kapitsa-213515`. Alcance: sólo lo que cambia esta spec — qué sale del Studio hacia Discord y el dato nuevo que se guarda (el ID de Discord del personal). No es una auditoría del sistema.

**No es asesoría legal y no afirma que el proyecto cumple.** Cada punto queda en uno de tres estados: `ENCONTRADO` (un problema visto en el código), `CORRECTO` (la implementación que lo resuelve, vista en el código) o `NO VERIFICABLE` (no se puede comprobar leyendo el repositorio).

Marco aplicable, citado desde la skill y su [checklist](../../../.claude/skills/revisar-datos-ve/references/checklist-datos-ve.md), punto 8 (el texto de los artículos está en [`marco-legal-ve.md`](../../../.claude/skills/revisar-datos-ve/references/marco-legal-ve.md), que esta revisión no reproduce): Venezuela no tiene ley especial de datos personales ni la figura del «encargado»; rigen la Constitución (arts. 28 y 60) y la Ley Especial contra los Delitos Informáticos, arts. 20 a 22, que es responsabilidad penal de personas. Por eso el contrato con cada tercero es lo que delimita quién responde. PIPL (China): el aviso de consolidado nace de una acción del hub en Yiwu, pero a Discord no sale el nombre del operario. Si alguien del equipo de Yiwu recibe un rol en Discord, vería códigos de clientes; eso se decide con los roles (ver «No verificable»).

## 1 · Resumen

| Estado | Cantidad |
|---|---|
| `CORRECTO` | 9 |
| `ENCONTRADO` | 3 |
| `NO VERIFICABLE` | 6 |

## 2 · Inventario: qué sale a Discord

Discord recibe **sólo** lo de la columna «Sale a Discord». El texto completo sigue existiendo en el código para Telegram y deja de enviarse cuando Discord entrega.

| Aviso | Canal | Sale a Discord | Lo que NO sale (y hoy sí va a Telegram) | Evidencia |
|---|---|---|---|---|
| Cliente nuevo | `#registro-clientes` | «Cliente nuevo», Shipping Mark, enlace a la ficha | Nombre, contacto, documento, correo, teléfono, ciudad | `lib/studio/new-client-notify.ts:97` |
| Pidió entrar al portal sin acceso | `#registro-clientes` | Título, Shipping Mark, enlace a la ficha | Nombre, correo | `lib/studio/portal/sin-acceso-aviso.ts:147` |
| Mensaje nuevo del portal | `#conversaciones-portal` | Título, referencia del hilo (o Shipping Mark), enlace; mención al asesor | Nombre del cliente y el texto del mensaje | `lib/studio/conversation-inbound-notify.ts:123` |
| Bug reportado (alta o crítica) | `#bugs` | Etiqueta de severidad, folio, enlace | Título del bug, nombre de quien reportó | `lib/studio/bug-email-notify.ts:255` |
| Tu reporte cambió de estado / te respondieron | `#bugs` | Título fijo, folio, enlace; mención a quien reportó | Título del bug, texto de la respuesta | `lib/studio/bug-email-notify.ts:442` · `:540` · `lib/studio/notify/bug-notif-outbox.ts:236` |
| Reporte diario | `#reporte-diario` | Fecha y 7 conteos (recepciones, incidencias, despachos, gastos cargados) | Total de gastos en dólares; el texto redactado por el modelo | `lib/news/ceo-brief.ts:32` |
| Solicitud de cotización del portal | `#avisos-equipo` | Título, código de la cotización, enlace | Nombre, ruta, descripción de la carga | `lib/studio/cotizacion-request-notify.ts:87` |
| Reporte de pago del portal | `#avisos-equipo` | Título, código de la factura, enlace | Monto, moneda, método, nombre, fecha del pago | `lib/studio/payment-report-notify.ts:94` |
| Packing list nuevo o actualizado | `#avisos-equipo` | Título, folio, enlace | Proveedor, sus contactos, monto, cantidad de cajas | `lib/studio/packing-list-notify.ts:86` |
| Contacto nuevo desde la web | `#avisos-equipo` | Título y código del contacto | Nombre, correo, teléfono, mensaje | `lib/studio/contact-lead-notify.ts:76` |
| Estimado nuevo desde la web | `#avisos-equipo` | Sólo el título | Nombre, teléfono, correo, ruta, total estimado, nota | `lib/studio/estimado-lead-notify.ts:89` |
| Solicitud de cambio de datos / cambio bloqueado | `#avisos-equipo` | Título, Shipping Mark, enlace; mención al asesor | Nombre y qué campos cambian | `lib/studio/change-request-notify.ts:49` · `:136` |
| Solicitud de consolidado | `#avisos-equipo` | Título, tipo de contenedor, enlace | Nombre del operario | `lib/studio/naviera/consolidation-request-notify.ts:49` |
| Clientes sin acceso al portal (control diario) | `#avisos-equipo` | Título, cuántos son, enlace | La lista de Shipping Marks y nombres | `app/api/cron/alta-health/route.ts:94` |
| Correos que no llegaron | `#avisos-equipo` | Título, cuántos, enlace | Destinatarios y asuntos | `lib/studio/mail/mail-health-notify.ts:93` |
| Tarifas de fletes sin actualizar | `#avisos-equipo` | Título, enlace | (no lleva datos de personas) | `lib/studio/searates/ocean-rates-notify.ts:73` |
| Tarifa pública por vencer o vencida | `#avisos-equipo` | Título, enlace | Ruta y vigencia (no son datos de personas) | `lib/studio/rate-expiry-notify.ts:118` |
| Tarea nueva / tareas de hoy en Bitácora | `#avisos-equipo` | Título, enlace, cuántas tareas; mención a la persona | Título de la tarea y la lista | `lib/studio/bitacora/notify.ts:161` |

Además de los avisos, Discord recibe en cada mensaje con mención el **ID de Discord** de un miembro del personal, y registra por su cuenta la IP del servidor que hace el pedido.

Sólo el tenant de `DISCORD_TENANT_ID` escribe en estos canales (`lib/studio/discord/channels.ts`, `discordTenantAuthorized`): un aviso de otra empresa no llega a los canales de DTD.

### Cola de reintento (migración 0515, aplicada en producción el 2026-11-07)

```
studio_alert_outbox | avisos que Discord no guardó (registro, bugs, reportes)
  qué guarda          : el mismo aviso mínimo de la tabla de arriba e IDs de Discord del personal
  barrera en la base  : CHECK que rechaza cualquier clave fuera de titulo, codigo, url y conteos, y más de 2 KB
  retención           : las filas cerradas se borran a los 30 días
  quién la ve         : sólo service_role (sin privilegios para anon ni authenticated)
```

### Dato nuevo que guarda el Studio

```
user_profiles.discord_user_id | ID de la cuenta de Discord de un miembro del personal (17 a 20 dígitos)
  finalidad declarada : mencionar a esa persona en los avisos del canal
  base de licitud     : la persona lo pega ella misma en su perfil; es opcional
  retención           : hasta que la persona lo quite (botón «Quitar») — sin plazo
  quién más lo ve     : los demás miembros del mismo tenant, por la policy de lectura de perfiles
```

No es dato sensible. Los titulares son personal del Studio, no clientes.

## 3 · Hallazgos

### `CORRECTO`

1. **El texto completo no puede llegar a Discord por el despachador.** `dispatchAlert` sólo le pasa a Discord el `MinimalAlert` (`lib/studio/alerts/dispatch-alert.ts:114` y `:137`); `telegramText` se usa en un único lugar, la llamada a Telegram (`:234`). Medido sobre el pedido HTTP en `lib/studio/alerts/__tests__/dispatch-alert.test.ts` («a Discord sólo llega lo mínimo»).
2. **El tipo no tiene campo de texto libre.** `MinimalAlert` es título, código, enlace y conteos numéricos (`lib/studio/discord/minimal-alert.ts:16`).
3. **Los dos avisos con más datos se midieron de punta a punta.** Alta de cliente y reporte de pago, con datos de prueba: sale el código y no el nombre, documento, correo, teléfono, ciudad ni monto (`lib/studio/__tests__/avisos-discord-minimo.test.ts`).
4. **Nadie suena por accidente.** `allowed_mentions.parse = []` (`lib/studio/discord/send-webhook.ts:146`); sólo suenan ID explícitos con forma válida.
5. **La dirección del webhook no se guarda en la base ni en el repositorio**, y no sale en errores ni en la pantalla: el error de red sólo conserva el nombre del error (`lib/studio/discord/send-webhook.ts:201`); la pantalla recibe estados, no direcciones (`lib/studio/discord/channels.ts`, medido en `channels-y-aviso.test.ts` y `DiscordChannelsStatus.test.tsx`).
6. **Una errata en la variable no manda datos a otro servidor.** La dirección se valida contra la forma de un webhook de Discord antes de usarla (`lib/studio/discord/send-webhook.ts:51`).
7. **El entorno de prueba no escribe en Discord** (`lib/studio/discord/channels.ts:66`).
8. **Cada quien edita sólo su propio ID.** La acción escribe con el cliente de la sesión y filtra por el usuario de la sesión (`app/studio/(app)/usuarios/actions.ts:1183`); la base sólo deja entrar 17 a 20 dígitos (`supabase/migrations/0514_user_profiles_discord_user_id.sql:68`). Medido en PostgreSQL embebido: un usuario no puede cambiar el ID de otro.
9. **La persona puede quitar su ID** desde el mismo lugar donde lo puso (botón «Quitar»; guarda `NULL`, `app/studio/(app)/usuarios/actions.ts:1180`).

### `ENCONTRADO`

1. **La política pública no declara una herramienta de mensajería interna.** `app/privacidad/page.tsx:240` («Con quién compartimos datos») lista alojamiento, correo, Meta, analítica y los equipos propios. No nombra a Telegram, que hoy recibe nombre y teléfono de clientes, ni nombraría a Discord. Con esta spec lo que sale baja a un código (el Shipping Mark identifica a un cliente para quien tiene acceso al Studio, no para Discord), pero sigue siendo un destino no declarado.
   - Por qué importa: una política que no dice a dónde van los datos promete menos de lo que el sistema hace. Checklist punto 7 y punto 8.
   - Arreglo: agregar a esa lista una línea del tipo «una herramienta de mensajería interna del equipo, que recibe avisos con el código de tu registro, sin tu nombre ni tus datos de contacto». El texto público lo aprueba Sam; no se toca en esta spec.
2. **Los códigos siguen siendo datos sobre una persona para quien puede cruzarlos.** Shipping Mark, código de factura y referencia del hilo salen a Discord. Cualquiera que vea el canal **y** tenga acceso al Studio llega a la persona; quien sólo ve el canal, no.
   - Por qué importa: la minimización depende de que los canales estén cerrados por rol. Si un canal queda abierto a los 12 miembros del servidor, todos ven qué clientes se registran y cuándo, aunque no vean el nombre.
   - Arreglo: es de configuración de Discord, no de código — los canales nacen privados y se abren por rol, como dice el plan. Queda en «No verificable».
3. **El ID de Discord de un miembro lo ven sus compañeros de tenant.** La policy de lectura de perfiles deja ver los perfiles del mismo tenant (`supabase/migrations/0329_user_profiles_tenant_scope.sql:6`), igual que hoy pasa con el teléfono y el chat de Telegram.
   - Por qué importa: es un identificador de una cuenta personal fuera del trabajo.
   - Arreglo propuesto, no hecho: ninguno urgente — el ID también es visible para cualquier miembro del servidor de Discord. Si se quisiera restringir, sería una vista o una policy por columna, en otra spec.

### `NO VERIFICABLE`

1. **Quién ve cada canal.** Los roles y permisos viven en Discord; no se puede comprobar desde el repositorio. Decisión de Sam informada por la sesión que coordina el plan el 2026-11-05, **no medida por esta revisión**: Sam es el dueño del servidor y nadie más es administrador; el rol «Equipo» ve toda la categoría Operación (los cinco canales de estos avisos), y lo tienen, además de Sam, **un socio de la empresa** y **una cuenta compartida** («DTD Cargo»). Los avisos de Operación los leen entonces tres cuentas, y una de ellas no es de una persona.
   - Por eso la regla de lo mínimo (código y enlace al Studio; sin nombre, teléfono, correo, documento ni montos) **sigue siendo obligatoria**, no una cortesía: es lo que limita lo que ven esas cuentas.
   - **Una cuenta compartida no deja saber quién leyó qué.** Lo que se lea desde ella no se atribuye a una persona. Si se necesita trazabilidad de quién vio un aviso, esa cuenta no la da; la alternativa es una cuenta por persona.
   - Los ID de Discord del personal mencionado también los ven esas tres cuentas.
   - El nombre y el usuario de Discord del socio no se escriben en el repositorio: se registran donde Sam lleve los accesos.
2. **Qué hace Discord con los mensajes.** Retención, uso y cesión dependen de su política y de sus términos. No se leyeron ni se archivaron en esta revisión.
3. **Contrato.** Un servidor gratuito se rige por los términos de servicio de Discord; no hay un acuerdo de tratamiento firmado. Si existe uno aplicable a cuentas gratuitas, no se verificó.
4. **Dónde quedan alojados los mensajes.** Discord Inc. es una empresa de Estados Unidos; la ubicación de los datos no se verificó.
5. **Borrado.** Borrar un cliente en el Studio no borra los mensajes de Discord que llevan su código. El webhook que crea esta spec no puede borrar mensajes. Si un titular pide supresión, alguien tiene que borrar a mano en Discord los avisos con su código; no hay procedimiento escrito.
6. **El comportamiento real del envío.** No se probó contra un webhook real: no existe todavía. El formato del pedido, el 429 y `allowed_mentions` están tomados de la documentación de Discord.

## 4 · Evaluación del proveedor (plantilla `evaluacion-proveedores.md`)

| Pregunta | Respuesta |
|---|---|
| Qué le mandamos | Lo de la tabla de la sección 2: títulos fijos, códigos, conteos, enlaces al Studio e ID de Discord del personal |
| ¿Es necesario que lo reciba? | Sí para que el aviso sirva: sin código no se sabe a qué registro ir |
| ¿Se puede seudonimizar antes? | Ya sale seudonimizado: el código no dice quién es sin acceso al Studio |
| Su rol | Decide sus propias finalidades y medios sobre la plataforma; no trata los datos «bajo nuestras instrucciones» |
| Dónde viven los datos | Estados Unidos (empresa); ubicación exacta `NO VERIFICABLE` |
| ¿La política pública declara este destino? | No — hallazgo `ENCONTRADO` 1 |
| Seguridad de nuestro lado | Llave fuera de la base y del repositorio; validación de la dirección; sin menciones por defecto |
| Al terminar | Borrar los webhooks y los canales desde Discord; el Studio no guarda nada de Discord salvo el ID del personal |
| Veredicto propuesto | **Adelante con condiciones**: canales privados por rol antes de poner las direcciones (según lo informado, ya lo están: rol «Equipo» con tres cuentas, una compartida); mantener la regla de lo mínimo sin excepciones; declarar la herramienta en la política; decidir cómo se atiende una supresión |

## 5 · Fuera de alcance: lo que decide Sam o un abogado

- El texto de la línea nueva en `/privacidad` y si hace falta.
- Si los términos de Discord alcanzan como respaldo contractual para lo que recibe.
- Qué pasa con los mensajes ya enviados a Telegram (nombres y teléfonos de clientes en chats privados del equipo) y con los identificadores de chat guardados cuando se retire Telegram.
- Un procedimiento de supresión que incluya Discord.

Conviene que otro modelo revise este mismo cambio: quien lo escribió no ve sus propios puntos ciegos.

*Esta revisión no es asesoría legal. Es un inventario técnico con evidencia y una lista de preguntas.*

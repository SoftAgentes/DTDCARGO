---
sdd: "0499"
title: "Secretos que viajan mal y gates que faltan en app/api"
status: in-progress
author: "Claude"
created: 2026-09-21
updated: 2026-09-21
supersedes: null
superseded_by: null
related: ["0036", "0085", "0146", "0148", "0238", "0271", "0286", "0309", "0373", "0380", "0462", "0498"]
confidencialidad: interno
---

# SDD-0499 — Secretos que viajan mal y gates que faltan en `app/api`

> Seis hallazgos de dos auditorías de solo lectura sobre `main` `07831a5d`: los
> 99 métodos HTTP de `app/api/**` y las 65 superficies del Portal. El grave es
> uno: el secreto del webhook de Telegram viajaba en el query string, apoyado en
> una premisa falsa —que Telegram no acepta headers— que la documentación
> oficial desmiente. Se suman un envío que cambiaba de estado sin gate de
> módulo, cinco rutas de push que re-asignaban la suscripción de otro con sólo
> conocer su endpoint, dos adjuntos desalineados y veintiún comparaciones de
> secreto que se unifican. Sin migración.

> [!IMPORTANT]
> **Al desplegar, Sam tiene que rotar `TELEGRAM_WEBHOOK_SECRET`.** El valor
> vivo hoy hay que darlo por comprometido: viajó en URLs, así que quedó en logs
> de acceso, en `Referer`, en el historial de proxies y en el `url` que
> `getWebhookInfo` devuelve a cualquiera con el token del bot. El procedimiento
> y su orden están en [el runbook](../../runbooks/setup-telegram-bot.md#rotación-sdd-0499).
> Ningún agente toca ese valor.

## Contexto

### 1 · El secreto del webhook de Telegram viajaba en la URL

`app/api/telegram/webhook/route.ts:44` comparaba
`url.searchParams.get("secret") !== expectedSecret`. El docblock (`:4-6`) lo
justificaba así:

> «El secret se pasa por query param (Telegram no soporta headers custom)»

**La premisa es falsa.** La documentación oficial de `setWebhook`
(core.telegram.org/bots/api#setwebhook, leída el 2026-09-21) documenta el
parámetro `secret_token`:

> «A secret token to be sent in a header "X-Telegram-Bot-Api-Secret-Token" in
> every webhook request, 1-256 characters. Only characters A-Z, a-z, 0-9, _ and
> - are allowed.»

Lo que hay detrás de esa puerta: el webhook enlaza un chat a cualquier
`link_code` vivo y escribe en `user_profiles` (`:108`) y `telegram_destinations`
(`:166`) con `createAdminClient()`, que es `service_role` y **bypasea la RLS**
(`lib/db/admin.ts:2`). Telegram no firma el cuerpo, así que el secreto
compartido es toda la autenticación que existe: importa muchísimo dónde viaja.

Lo que ya estaba bien y no se toca: **fail-closed**. Sin la variable definida
responde 503 antes de comparar (`:36-41`).

### 2 · Un envío cambiaba de estado sin gate de módulo

`app/api/studio/shipments/[id]/events/route.ts` pedía `getUserTenantId()` y
devolvía 403 sin tenant. Nada más. Y es el POST que **muta** `shipments.status`
y inserta en `shipment_events` — el que mueve el estado del envío.

Sus hermanos del mismo recurso sí lo cortaban: `shipments/[id]/route.ts:65` usa
`moduleViewDenial(supabase, "tracking")` y las líneas 87 y 145 usan
`moduleEditDenial`.

El caso concreto: el rol `support` es read-only en V1
(`lib/studio/rbac.ts:344`) pero **sí ve** tracking (`:62`). O sea que un
`support` mandaba este POST y movía un envío de `in_warehouse` a `delivered`.

### 3 · Suscripciones push que se re-asignaban conociendo el endpoint

`endpoint` es único global en las dos tablas de subs, así que las cinco rutas
que registran una resolvían el choque re-asignando la fila al que llamaba. Los
comentarios lo declaraban deliberado —«otro user en el mismo browser»
(`portal/push/subscribe:64-65`), «móvil compartido entre operarios»
(`m/push/subscribe:44-45`)— y el caso es real: la `PushSubscription` cuelga del
REGISTRO del service worker, que es por origen y no por sesión.

**Lo que no había era la comprobación.** El endpoint llega en el cuerpo del
request; que fuera el mismo navegador no se verificaba en ningún lado. Seis
sitios, dos defectos de la misma familia:

| Sitio | Qué hacía |
|---|---|
| `m/push/resubscribe:46-50` | `delete().eq("endpoint", old_endpoint)` con admin, sin dueño |
| `m/push/resubscribe:91-96` | `delete().in("endpoint", …)` con admin, sin dueño |
| `m/push/subscribe:46` | `upsert(onConflict:"endpoint")` → re-asigna al que llama |
| `m/push/resubscribe:51-63` | `upsert(onConflict:"endpoint")` → re-asigna |
| `portal/push/subscribe:66-76` | `upsert(onConflict:"endpoint")` → re-asigna |
| `studio/push/subscribe:75` | delete-then-insert por endpoint → re-asigna |

El hermano `m/push/unsubscribe:33` ya acotaba bien, y
`portal/push/unsubscribe:38-41` también: el molde estaba en la casa.

**Gravedad, dicha con precisión.** Es **integridad y disponibilidad, no
confidencialidad**: el `user_id` sale siempre de la sesión, así que nadie puede
hacer que las notificaciones de OTRO le lleguen a él. Lo que sí puede es dejar
al dueño sin recibirlas —silencio de avisos de envío— y mandar las suyas a un
aparato que no controla. El del portal **cruza clientes dentro del mismo
tenant**, así que no necesita un segundo tenant para estar vivo.

### 4 · Dos adjuntos desalineados con sus hermanos

`attachments/[id]/finalize/route.ts:13` y `.../reauthorize/route.ts:13`
verificaban sesión y nada más, mientras `reserve:15`, `restore:14` y
`download:15` sí llaman a `moduleEditDenial`/`moduleViewDenial` con `"expenses"`.

**No era un hueco explotable.** La RPC `reauthorize_document_upload`
(`supabase/migrations/0309_document_reserve_finalize_rpcs.sql:114-115`) filtra
por `tenant_id` **y** por `user_id = auth.uid()`, así que un llamador sólo
alcanza sus propias reservas. Es inconsistencia de capas y se arregla como tal.

### 5 · Veintiuna comparaciones de secreto, dos criterios

Los 18 `authorize()` de `app/api/cron/*` usaban ``auth === `Bearer ${secret}` ``
y `debug/health:42` usaba `bearer === expected`. La implementación correcta ya
vivía en el repo en tres sitios: `cron/document-import-drain:11`,
`cron/document-import-cleanup:25` y `studio/audit/export:7-12`.

**Es higiene, no urgencia.** Sobre HTTP el jitter de red domina la diferencia de
nanosegundos entre dos `memcmp`, así que el canal de temporización remoto es
poco práctico de explotar. Se unifica porque un criterio es más barato de
auditar que veintiuno. Lo sustancial —**fail-closed**, leer la variable y
devolver 403 antes de comparar— ya estaba bien en los 21 y se conserva.

### 6 · El endpoint «deprecado» que está vivo

`app/api/contact/route.ts` abría con «⚠️ DEPRECADO — NADIE LLAMA A ESTE
ENDPOINT» y se pidió apagarlo si el grep lo confirmaba.

**El grep lo desmiente.** Lo llama
`app/academia/_components/AcademiaLeadForm.tsx:45` con `topic: "academia"`, y
ese form se monta en `app/academia/page.tsx:221`, una página pública sin
bandera. **No se apaga.** Se corrige el docblock, que es lo peligroso: una nota
que dice «nadie lo llama» es lo que hace que el siguiente lo borre.

Este tropiezo ya estaba anotado en el repo. `docs/engineering/project-rules.md:145`
lo trae en rojo, fechado el 2026-08-19, con el mismo endpoint y el mismo error
de método: mirar al consumidor obvio (`/contacto`) en vez de barrer el árbol.

## Decisión

| # | Qué se hace | Por qué esa y no otra |
|---|---|---|
| 1 | El secreto va en `X-Telegram-Bot-Api-Secret-Token`, comparado con `sameSecret`. El query param **deja de aceptarse**. | Aceptar los dos conservaría justo el canal que se viene a cerrar. Un update firmado por Telegram siempre trae el header. |
| 2 | `moduleEditDenial(supabase, "tracking")` al tope del POST, antes de leer el envío. | Mismo criterio que el PATCH de al lado (`shipments/[id]/route.ts:87`). |
| 3 | Los borrados de `old_endpoint` se acotan al dueño. El rebind **se conserva** exigiendo posesión. | Ver abajo. |
| 4 | `moduleEditDenial(client, "expenses")` en `finalize` y `reauthorize`. | Uniformidad de las cinco rutas del recurso. |
| 5 | Un solo `lib/http/secret-compare.ts` para los 21. | Los tres que ya lo hacían bien también se mudan: unificar es tener UN criterio, no dos. |
| 6 | Se corrige el docblock. El endpoint sigue montado. | Tiene un llamador vivo. |

### Por qué el rebind se conserva en vez de prohibirse

El navegador no trae sólo el endpoint: trae `keys.auth`, el secreto de 16 bytes
que el push service le emitió a **esa** suscripción. El mismo registro de
service worker devuelve siempre el mismo par —`pushManager.subscribe()` con la
misma `applicationServerKey` entrega la suscripción que ya existe—, y si se
des-suscribe y vuelve a suscribir cambia el endpoint también, así que no hay
choque. De ahí:

- **El equipo compartido de verdad SIEMPRE supera la prueba.** El puesto que
  comparten dos turnos de almacén, el teléfono que comparte una familia.
- **Quien sólo se enteró del endpoint, no.**

Un 409 seco que prohibiera el rebind rompería al segundo turno y a la familia
sin darles salida. `lib/studio/notify/push-rebind.ts` es esa comprobación, una
vez, para las cinco rutas.

**Decisión explícita sobre el rebind del Studio**
(`studio/push/subscribe/route.ts:75`), que la auditoría marcó como deliberado:
**se conserva**. El puesto compartido entre personal de almacén es una realidad
operativa y quitarlo dejaría al segundo turno sin activar su push. Se le agrega
la comprobación que faltaba, no se le quita la función.

## Alcance

**Entra**

- `app/api/telegram/webhook/route.ts` + `docs/runbooks/setup-telegram-bot.md`.
- `app/api/studio/shipments/[id]/events/route.ts`.
- `app/api/m/push/{subscribe,resubscribe}/route.ts`,
  `app/api/portal/push/subscribe/route.ts`,
  `app/api/studio/push/subscribe/route.ts`,
  `lib/studio/notify/push-rebind.ts` (nuevo).
- `app/api/studio/attachments/[id]/{finalize,reauthorize}/route.ts`.
- `lib/http/secret-compare.ts` (nuevo) + 18 cron + `debug/health` +
  `studio/audit/export` + los dos `document-import-*`.
- `app/api/contact/route.ts` (sólo el docblock).

**No entra**

- **Migraciones.** Ninguna. Nada de esto necesita SQL.
- **Rotar `TELEGRAM_WEBHOOK_SECRET`.** Es de Sam, va después del despliegue.
- **Los tres huecos que necesitan un segundo tenant.** Ver la sección siguiente.
- **Extender el contrato anti-deriva a exigir gate de módulo.** Ver Riesgos.

## Deuda con fecha de vencimiento: el día que se abra un segundo tenant

Sam confirmó el 2026-09-21 que **hay un solo tenant en producción**. Los tres de
abajo no son explotables hoy por eso, y sólo por eso. Quedan inventariados con
su ubicación exacta para el día que deje de ser cierto.

### D1 · `app/portal/(app)/estimados/actions.ts` — lee y **muta** sin `tenant_id`

- Lectura: `:64-69` — `admin.from("quotes").eq("quote_code", code)
  .eq("client_markbox", client.markbox)`.
- Escritura: `:97-100` — `admin.from("quotes").update({source:"studio"})
  .eq("id", q.id).eq("client_markbox", …).eq("source","web")`.

El Shipping Mark es `unique (tenant_id, markbox)`
(`supabase/migrations/0006_clients.sql:23`), o sea **único por tenant, no
global**: con dos tenants, dos clientes distintos pueden tener el mismo markbox.

**¿Corta la RLS igual?** No. `createAdminClient()` es `service_role` y
**bypasea RLS** — `lib/db/admin.ts:2` lo dice literalmente. No hay segundo
candado en esta ruta; lo único que hoy la salva es que no existe el segundo
tenant.

**Y no es sólo la DB.** `:113` llama
`notifyCotizacionRequestToAdmin(admin, q.tenant_id, { markbox: client.markbox,
clientName: client.name, … })`, que resuelve los admins **del tenant de la
fila** (`lib/studio/cotizacion-request-notify.ts:48`). Con dos tenants, avanzar
el estimado ajeno además le manda a los administradores del OTRO tenant un
correo con el nombre y el markbox del llamador. Fuga de PII por el canal de
avisos, no sólo escritura cruzada.

El repo ya arregló esta clase dos veces —facturas en SDD-0462 y la *lectura* de
estimados en SDD-0380—; la escritura quedó atrás.

### D2 · `lib/portal/referral-invite.ts` — dedupe y tope por markbox sin tenant

- Dedupe: `:80-87` — `.eq("referrer_markbox", markbox).eq("referred_email", email)`.
- Tope diario: `:96-101` — `.eq("referrer_markbox", markbox)` + `gte(created_at)`.

Con dos tenants es oráculo de existencia («¿ya invitaron a este correo?») y cupo
diario compartido entre dos referidores distintos que comparten markbox.

### D3 · `lib/marca/access.ts:100-110` — `resolveBrandTenantId()` devuelve el primero

Devuelve siempre el tenant más antiguo por `created_at`, no el del que llama, y
los tres endpoints de `marca` firman URLs del bucket privado sobre ese tenant.
Su propio docblock ya lo dice: «Hoy hay uno solo».

## Pruebas

Todo lo nuevo lleva prueba, y cada gate tiene su mutante medido.

| Archivo | Cubre |
|---|---|
| `app/api/telegram/webhook/__tests__/secret-header.test.ts` | Sin header → 403 sin tocar la base. Header ajeno → 403. **El secreto bueno en el query string → 403.** Prefijo → 403. Header correcto → procesa. Sin variable → 503. |
| `app/api/studio/shipments/[id]/events/__tests__/module-gate.test.ts` | `support` → 403 y el envío **no** se toca. Sin membresía → 403. `operations` → 201 y sí llega al dominio (control de que el 403 es del gate). |
| `app/api/studio/attachments/__tests__/module-gate.test.ts` | Ídem para `finalize` y `reauthorize` con `"expenses"`. |
| `lib/studio/notify/__tests__/push-rebind.test.ts` | Endpoint libre / propio / ajeno con las mismas claves / ajeno sin ellas / fila sin claves. Y un control de que el doble filtra. |
| `app/api/m/push/__tests__/ownership.test.ts` | `old_endpoint` ajeno **no** borra la fila de la víctima; el propio sí. Reclamar sin claves → 409. |
| `app/api/portal/push/__tests__/rebind.test.ts` | Cliente del mismo tenant sin claves → 409 y la sub no cambia de dueño. |
| `app/api/studio/push/__tests__/rebind-possession.test.ts` | El puesto compartido re-vincula; el que sólo conoce el endpoint, 409. |
| `lib/http/__tests__/secret-compare.test.ts` | Fail-closed en las siete formas de vacío. `Bearer` exacto; esquema en minúscula, espacio de más y token pelado rechazados. |

**El doble de PostgREST filtra de verdad.**
`lib/studio/notify/__tests__/push-tables-double.ts` aplica `.eq()`/`.in()` sobre
filas en memoria, y las filas que sobreviven a un `delete` son la aserción. Con
un doble que devuelve la fila sin mirar el filtro, una prueba de «el borrado
está acotado al dueño» sale verde **con el bug adentro** — es exactamente el
filtro que el doble ignoraría. El doble es deliberadamente estrecho y tira ante
cualquier operación que no implemente: uno más permisivo que `supabase-js`
mentiría en la otra dirección.

**Mutantes.** 16 mutantes sobre líneas del diff propio; los 16 mueren, cada uno
en su prueba, con el resto de la suite en verde como control. Dos hicieron falta
dos vueltas:

- `11-studio-sin-posesion` sobrevivió a la primera: faltaba el archivo
  `rebind-possession.test.ts`. El contrato de frontera que ya existía corre con
  el endpoint LIBRE, así que quitar el gate no le cambiaba nada.
- El primer mutante del `secret-compare` resultó **equivalente** (reescribía
  `!expected` en dos ramas con el mismo resultado). No es que la prueba fallara:
  el mutante no cambiaba el comportamiento. Se sustituyó por dos reales —quitar
  el `if (!secret)` de `matchesBearerSecret`, que abre un fail-open de verdad
  (con la variable sin definir, un header `"Bearer "` autenticaría), y comparar
  sólo la longitud— y los dos mueren.

## Riesgos y lo que NO cambia

- **El despliegue de Telegram tiene una ventana ciega.** Entre el deploy y el
  `setWebhook` nuevo, el endpoint responde 403 a todo update. No se pierden:
  Telegram reintenta las entregas fallidas. El orden está en el runbook.
- **Charset del `secret_token`**: Telegram acepta 1-256 caracteres y sólo
  `A-Z a-z 0-9 _ -`. `openssl rand -hex 32` (lo que el runbook ya recomendaba)
  cae dentro; `openssl rand -base64 32` **no**. Queda anotado en el runbook.
- **Nuevo 409 en las rutas de push.** Antes cualquier reclamo del endpoint salía
  200. El caso legítimo no lo ve nunca; el forjado sí.
- **Una lectura más por suscripción.** El gate consulta la fila antes de
  escribir. Es una lectura por `endpoint` con índice único.
- **Fail-closed en el gate de push**: si la lectura falla, se deniega. El costo
  de equivocarse hacia el «no» es que el usuario reintente activar el push.
- **No se extiende el contrato anti-deriva.**
  `lib/http/__tests__/studio-api-auth-guard.test.ts` exige un guard de SESIÓN
  por método; exigir además gate de MÓDULO encendería 11 de las 18 rutas de
  `app/api/studio` con método mutante, y varias no lo llevan por diseño (push
  es autoservicio del propio usuario, `audit/export` autoriza en la base). Es
  una spec aparte, con su inventario. Las tres rutas que esta spec toca siguen
  cumpliendo el contrato vigente.
- **No se toca** el fail-closed de ninguno de los 21 secretos, ni el honeypot y
  el throttle de `/api/contact`, ni el rebind como función de producto.

## Evidencia pendiente

- La documentación de Telegram se leyó **en vivo** el 2026-09-21 contra
  core.telegram.org/bots/api#setwebhook. No se probó un `setWebhook` real con
  `secret_token` contra el bot de producción: eso pasa por Sam, con el token, en
  el despliegue.
- La cita de la RPC `reauthorize_document_upload` sale del **archivo de
  migración del repo**, no de producción. No se verificó contra la base viva que
  el cuerpo que corre hoy sea ése.
- Los tres huecos de la deuda (D1-D3) no llevan prueba: con un solo tenant no
  hay forma de escribir el caso infeliz sin fabricar un segundo tenant, y eso
  excede esta spec.
- `pnpm verify` completo: ver el handoff.

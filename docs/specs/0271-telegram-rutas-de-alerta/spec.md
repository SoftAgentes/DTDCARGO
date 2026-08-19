---
sdd: "0271"
title: "Rutas de alerta de Telegram: un destino por categoría, y que no llegue duplicado"
status: in-progress
author: "Sam (founder) + Claude"
created: 2026-08-19
updated: 2026-08-19
supersedes: null
superseded_by: null
related: ["0036", "0059", "0146", "0148", "0174"]
confidencialidad: interno
---

# SDD-0271 — Rutas de alerta de Telegram

## 1. El problema

Son dos, y sólo uno se ve.

### 1.1 El registro de un cliente llega DOS veces (medido en producción)

No hay doble disparo. `notifyNewClientToAdmin` se llama **una sola vez**
([app/registro/actions.ts:423](../../../app/registro/actions.ts)). Lo que hay es
un **abanico**: el aviso recorre los admins del tenant uno por uno y manda un
Telegram por cada uno.

Medido el 2026-08-19 contra `user_tenants` + `user_profiles` de producción:

| Cuenta | Rol | `telegram_chat_id` |
|---|---|---|
| `hailuway.com@gmail.com` (SAM GMAIL) | admin | `6512220774` @SamDTD |
| `vzla@dtdcargo.com` (VZLA Pérez) | admin | `6512220774` @SamDTD ← **el mismo** |
| `sistemaqb@gmail.com` (Jose Mendez) | admin | — |

Dos admins → **un solo chat** → dos mensajes. El correo NO se duplica porque los
emails sí son distintos, que es exactamente lo que reportó el founder.

Y no es sólo el registro: **nueve** módulos comparten el mismo bucle
(`resolveAdminEntries` + `sendAdminTelegram` por admin) — cotizaciones, reportes
de pago, packing lists, leads de contacto, estimados, salud del correo,
solicitudes de consolidación, change requests y el cron `alta-health`. Todos
duplican hoy; nadie lo había notado porque el registro es el que más entra.

Los avisos de **bug** NO duplican, y la razón importa: `bug-email-notify`
sí consulta `user_notification_prefs`, y de las dos cuentas sólo
`hailuway.com@gmail.com` tiene `channel_telegram = true`. La preferencia lo
salvó de rebote. El resto de los módulos ni siquiera mira las prefs.

### 1.2 Todo cae en el mismo chat

El modelo de ruteo es **por usuario**: `user_profiles.telegram_chat_id`. No
existe la noción de "esta categoría de aviso va a ESTE chat". El founder recibe
en un solo hilo el registro de un cliente, un bug crítico, el brief diario de
operaciones y un reporte de pago — sin forma de separarlos ni de mandarle una
categoría a otro teléfono.

## 2. Qué se construye

Una capa de **ruteo por categoría**, desacoplada del usuario. Un chat de
Telegram pasa a ser un **destino** con nombre propio, y cada categoría de aviso
se dirige a uno o más destinos.

### 2.1 Las cinco categorías

| Categoría | Qué incluye |
|---|---|
| `registro` | Alta de cliente self-service (`/registro`) |
| `conversaciones` | Mensaje entrante del portal del cliente |
| `bugs` | Bug reportado con severidad alta o crítica |
| `reportes` | Brief diario de operaciones y movimientos (`ceo-brief`) |
| `equipo` | El resto: cotizaciones, reportes de pago, packing lists, leads de contacto, estimados, salud del correo, consolidaciones, change requests, salud del alta |

### 2.2 El reparto que pidió el founder (2026-08-19)

| Categoría | +58 414-884.00.00 | +58 412-166.80.21 |
|---|---|---|
| `bugs` | ✅ | — |
| `reportes` | ✅ | ✅ |
| `registro` | — | ✅ |
| `conversaciones` | — | ✅ |
| `equipo` | — | ✅ |

El chat que hoy está enlazado (`6512220774`, @SamDTD) es el **+58 414-884.00.00**.
El otro **todavía no existe como chat**: un `chat_id` de Telegram no se puede
derivar de un número de teléfono — el bot sólo lo aprende cuando esa cuenta le
escribe. Por eso el destino se crea "pendiente" y se enlaza con `/start <código>`,
igual que ya se enlaza una cuenta de usuario.

### 2.3 La regla que evita perder un aviso

Si una categoría **no resuelve ningún chat** —no tiene rutas, o su destino
todavía no se enlazó— el aviso **cae al comportamiento de hoy**: broadcast a los
admins del tenant, deduplicado. Nunca se pierde un aviso por una configuración a
medias. La pantalla lo dice en voz alta cuando pasa.

### 2.4 La deduplicación

El envío deja de ser "un Telegram por destinatario" y pasa a ser "un Telegram
por **chat único**". El despachador junta los chats de las rutas, los de los
destinatarios per-usuario (el asesor asignado a una conversación, por ejemplo) y
los del fallback, mete todo en un `Set` y manda una vez por chat.

Esto arregla 1.1 **de raíz y para los diez módulos a la vez**, no sólo para el
registro: mientras el envío se resuelva por chat y no por persona, dos cuentas
apuntando al mismo Telegram dejan de ser un problema.

## 3. Modelo de datos (migración 0386)

```
telegram_destinations   id · tenant_id · label · chat_id · link_code ·
                        telegram_username · linked_at · active
telegram_alert_routes   id · tenant_id · category · destination_id
```

Un destino sin `chat_id` está **pendiente de enlace** y no recibe nada. RLS:
sólo admin del tenant, más `service_role` para los envíos del servidor.

## 4. Superficie tocada

- **Nuevo** · `lib/studio/telegram/alert-routing.ts` — el despachador y el resolvedor.
- **Nuevo** · `app/studio/(app)/ajustes/` — pantalla de destinos y matriz de categorías.
- **Cambia** · `app/api/telegram/webhook/route.ts` — `/start <código>` también enlaza destinos.
- **Cambia** · los diez módulos de aviso: el bucle `sendAdminTelegram` por admin pasa a un solo `dispatchTelegramAlert` por categoría. El **correo no se toca** — sigue saliendo uno por admin.

## 5. Aceptación

- [x] Un alta self-service produce **un** Telegram, no dos.
- [x] Con dos admins apuntando al mismo `chat_id`, cualquier aviso al equipo llega una sola vez.
- [x] Una categoría con destino enlazado va sólo a ese chat.
- [x] Una categoría con dos destinos va a los dos.
- [x] Una categoría sin rutas —o con el destino sin enlazar— cae al broadcast de admins, deduplicado.
- [x] El asesor asignado a una conversación sigue recibiendo su aviso, y si además es el chat de la categoría, lo recibe **una** vez.
- [x] Un empleado que no es admin no ve los chats; un admin de otro tenant tampoco.
- [ ] `/start <código>` enlaza un destino y la pantalla lo muestra enlazado — **pendiente en vivo**: exige la migración aplicada y una segunda cuenta de Telegram escribiéndole al bot.
- [ ] `node scripts/verify.mjs` verde.

## 6. Mutaciones corridas

Un contrato verde que sigue verde con la protección apagada es decorado. Las
dos protecciones centrales se rompieron a propósito antes de darlas por buenas:

| Qué se rompió | Qué pasó |
|---|---|
| El `Set` de `dedupeChatIds` (se quitó el `seen.has()`) | **7 pruebas en rojo**, entre ellas *"DOS admins con el MISMO chat producen UN solo mensaje"* |
| El gate `is_tenant_admin()` de las 4 policies de la migr 0386 | **Contrato SQL en rojo**: `0386: un no-admin vio 1 destino(s)` |

## 7. Orden de puesta en producción

1. **Aplicar la migración 0386** (runbook `docs/runbooks/aplicar-migraciones-prod.md`, con OK del founder nombrándola).
2. **Desplegar el código.** El orden inverso tampoco rompe nada: sin las tablas, el resolvedor devuelve lista vacía y todo cae al broadcast de admins **ya deduplicado** — o sea, el arreglo del duplicado funciona aun sin la migración; lo que falta es el ruteo.
3. **Enlazar el segundo Telegram** desde Studio › Ajustes › Alertas de Telegram: `/start <código>` desde la cuenta que va a recibir. Hasta ese momento las categorías de ese destino siguen cayendo al broadcast, y la pantalla lo avisa.

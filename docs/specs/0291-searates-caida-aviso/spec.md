---
sdd: "0291"
title: "SeaRates cierra: el ERP avisa cuando el cotizador se queda mudo, el panel deja de mentir y el portal deja de enlazarlo"
status: in-progress
author: "Claude Code (ventana searates-aviso) + founder"
created: 2026-08-24
updated: 2026-08-24
supersedes: null
superseded_by: null
related: ["0092", "0095", "0101", "0247"]
confidencialidad: interna
---

# SDD-0291 — El cotizador de fletes avisa cuando se queda mudo

> El 24-ago-2026 el cron semanal corrió, las 20 rutas volvieron en `error`, `/fcl`
> dejó de dar precio y **nadie se enteró**. El panel que existe para enterarse lo
> pintaba **verde**. Esta spec cierra los dos huecos.

## 1. Qué pasó (medido, no inferido)

SeaRates revocó el acceso a los productos de la cuenta DTD. Medido en vivo el
24-ago-2026:

| Prueba | Resultado |
|---|---|
| `ocean_rates` en prod | **20 de 20 filas en `error`/`graphql_error`**, `fetched_at` = 24-ago 06:00:39 UTC |
| `rates` FCL en vivo | `403 ACCESS_DENIED` · *"No access to rates fcl. Company name: DTD Cargo"* |
| `rates` LCL en vivo | `403 ACCESS_DENIED` · idéntico |
| Container Tracking API | `API_KEY_ACCESS_DENIED` |
| `GET /auth/platform-token` | **HTTP 200, token emitido** |
| `tracking_snapshots` / `searates_tracking_usage` | **0 filas** — el API de tracking nunca se usó en prod |

El 13-ago la caché servía 21 de 25 rutas con tarifas reales. **La caída ocurrió
entre el 13 y el 24 de agosto.**

### Causa raíz (confirmada por el proveedor)

No fue nuestra renovación mensual: **SEARATES FZE está reorganizando y SeaRates
Ukraine LLC entró en liquidación.** Notificación formal de terminación del
**13-ago-2026** a `info@dtdcargo.com` (Contract ID 1998753), bajo el public offer
de su ToS: **todos los servicios cesan permanentemente 30 días después del aviso
→ ~12-sep-2026.**

⏰ **Esta spec NO resuelve el vencimiento** — resuelve el *silencio*. Qué pasa con
`/fcl`, con el deep-link de tracking del portal y con el reembolso pro-rata es
decisión aparte del founder.

## 2. Los dos huecos

### Hueco 1 · el cron falla en silencio

[`refreshOceanRates`](../../../lib/studio/searates/ocean-rates-queries.ts) ya
contaba `ok`/`no_rate`/`error` en su `RefreshSummary`, y
[el route](../../../app/api/cron/searates-refresh/route.ts) lo devolvía en el JSON
de la respuesta — donde no lo lee nadie, porque a un cron de Vercel nadie le mira
el cuerpo. El único vigía era mirar la tabla a mano.

### Hueco 2 · el panel de salud da un VERDE falso

`checkSeaRates()` en
[`integration-health.ts`](../../../lib/studio/integration-health.ts) pinga **sólo**
el endpoint de auth. Ese endpoint emite el platform token con sólo comprobar que
la cuenta exista: **no mira permisos**. Medido: devolvía `200` con token mientras
los tres productos daban `403`. O sea que `/studio/debug` mostraba SeaRates en
verde con todo muerto — el instrumento que existe justo para esto era el último en
enterarse.

## 3. Objetivo y no-objetivos

**Objetivo:** que una corrida sin tarifas **avise sola**, y que el panel de salud
diga la verdad. Ambos sin gastar una sola llamada de cuota.

**Objetivo 2 (agregado tras confirmarse el cierre):** que el CLIENTE no llegue a
ver un enlace muerto.

**No-objetivos:** cambiar de proveedor · tocar `/fcl` o `/fcl/embed` · borrar las
filas en error (son la evidencia y la fuente del chequeo nuevo) · desmontar el
lane de tracking del ERP · decidir qué pasa con `/fcl` después del 12-sep.

## 4. Diseño

### 4.1 · `lib/studio/searates/ocean-rates-alert.ts` (PURO)

- `classifyRefreshHealth(summary)` → `ok | degraded | dead`.
  **`dead` mira `ok === 0`, no `error > 0`**: si todas las rutas vuelven `no_rate`
  el proveedor contestó bien, pero el cliente ve exactamente lo mismo — un
  cotizador sin precio. Una corrida con `total === 0` también es `dead`: un
  refresco que no consulta nada está roto aunque no devuelva errores.
- `dominantErrorCode(errorCodes)` → el código más repetido. Es lo que separa "se
  cayó la red un rato" de "nos revocaron el acceso"; el corte real tuvo la firma
  `{ graphql_error: 20 }`. Desempate alfabético = mensaje determinista.
- `buildOceanRatesAlert(...)` → devuelve **`null` si la salud es `ok`**, para que
  el caller no pueda mandar de más. El texto nombra **qué ve el cliente**, no sólo
  qué falló: un aviso que dice "20 rutas en error" se lee como ruido y se ignora.

### 4.2 · `RefreshSummary.errorCodes`

`refreshOceanRates` ahora tallea `error_code` por tipo. Es el único cambio al lane
de fletes existente, y es aditivo.

### 4.3 · `lib/studio/searates/ocean-rates-notify.ts`

Calca [`mail-health-notify.ts`](../../../lib/studio/mail/mail-health-notify.ts) —el
hermano más cercano: aviso de salud, global, disparado por cron— y reusa los
rieles canónicos: `resolveAdminEntries` (correo) y `dispatchTelegramAlert`
categoría **`equipo`** (Telegram). Sin categoría nueva ni migración: el hint de
`equipo` ya dice "…y avisos de salud del correo". Telegram va **fuera** del bucle
de admins: una vez por chat, no por persona (SDD-0271).

### 4.4 · El enganche + `?dry=1`

El route clasifica, arma y —si hay algo que decir— recorre tenants y notifica,
como todos los crons globales del repo. `?dry=1` corre todo menos el envío.

### 4.5 · El fin del falso verde

`checkSeaRates` cruza el auth con la caché que el cron ya llena (**lectura gratis,
0 cuota**): auth OK + **cero** tarifas usables = no está sano. Si la caché no se
puede leer (`null` — sin service_role, DB caída) **conserva el comportamiento
viejo**: degradar a rojo por no poder mirar sería un falso positivo, y un panel
que grita sin causa entrena al equipo a ignorarlo. El contador es **inyectable**
para poder probar el falso verde sin DB.

### 4.6 · Slice B · fuera el deep-link del portal del cliente

`PortalShipmentDetailNorte.tsx` mostraba **"Ver seguimiento en SeaRates"** en el
detalle del envío — un botón que el CLIENTE ve y que a partir del ~12-sep lleva a
una página muerta. Se quitó el botón (más la `const` y el import que quedaban sin
uso) y **se dejó un comentario en su lugar explicando por qué no se repone**.

**La card no pierde información:** buque, viaje, naviera, ETD/ETA y contenedor
salen de la cadena `shipment → consolidation → sailing/carrier` (SDD-0047), que es
NUESTRA. Lo único que se va es el mapa en vivo del tercero.

Lo que **queda en pie a propósito** (fuera de alcance, ver §6): el botón
equivalente en `/studio/naviera` y el botón "Actualizar desde SeaRates", ambos
staff-facing; y las ramas del snapshot vivo (`liveStatusLabel`, "vía SeaRates"),
que hoy **no renderizan nunca** — `tracking_snapshots` tiene 0 filas en prod.

## 5. Pruebas

- `lib/studio/searates/__tests__/ocean-rates-alert.test.ts` — 15 casos anclados en
  el **conteo**, no en la redacción.
- `ocean-rates-queries.test.ts` — 2 casos nuevos: `errorCodes` cuenta por tipo y
  `no_rate` no lo ensucia.
- `integration-health.test.ts` — 4 casos del falso verde, incluido que con el auth
  caído **ni siquiera mira la caché**.

**Mutación comprobada** (regla del repo · un test que no muerde no prueba nada):

| Mutación | Resultado |
|---|---|
| `classifyRefreshHealth` siempre `"ok"` | **5 rojos** |
| `checkSeaRates` vuelve a confiar en el auth 200 (el bug original) | **2 rojos** |
| El cron deja de contar `errorCodes` | **1 rojo** |

⚠️ **Lo que NO está cubierto por tests, y es a propósito:**

- **El enganche del route** es pegamento de tres líneas (clasificar → armar →
  notificar). Su verificación es de punta a punta, no un unit test con dobles.
- **`notifyOceanRatesHealth`** no lleva test propio, igual que su hermano
  `notifyMailHealth`: lo que se prueba en el repo es el riel
  (`alert-routing.test.ts`), no cada wrapper. Y el riel tiene respaldo — si la
  categoría no resuelve chats, cae al broadcast de admins, así que una categoría
  equivocada no silencia el aviso.
- **La retirada del botón** no tiene test porque no había ninguno que afirmara su
  presencia (verificado). Sí se comprobó que `searates-deeplink.test.ts` sigue
  verde: la función pura sigue viva, la usa `/studio/naviera`.

### Verificación pendiente (decisión del founder)

Comprobar que el aviso **llega** de verdad exige escribir en `ocean_rates` de
producción y mandar un Telegram/correo real. Se decidió **esperar al cron real del
lunes 31-ago 06:00 UTC**, que producirá el aviso solo. Medido de antemano para que
no se pierda en el vacío: hay **1 ruta** configurada en la categoría `equipo`, **2
admins con Telegram enlazado** (de 4) y `mail_config` poblado. Hay a quién avisarle.

## 6. Pendientes que esta spec NO cierra

- 🔴 **~12-sep-2026**: SeaRates cesa. Falta decidir **`/fcl`** (hoy degrada limpio
  a WhatsApp, pero es una página con prioridad 0.9 en el sitemap) y las superficies
  de tracking **del ERP** (`/studio/naviera`: el deep-link y el botón "Actualizar
  desde SeaRates", que ya devuelve `API_KEY_ACCESS_DENIED`). El portal ya está
  cubierto por el Slice B.
- 🟡 **Reembolso pro-rata**: el aviso ofrece devolver la parte no usada, y
  *"pro-rata calculado desde la fecha en que el servicio se interrumpió"* si se
  cayó dentro del período. Se cayó. Hay evidencia con fecha.
- 🟢 **Exportar data**: el aviso pide exportar lo que se quiera conservar. Medido:
  no hay nada nuestro allá — la caché de tarifas vive en `ocean_rates` (Supabase) y
  `tracking_snapshots` tiene **0 filas**.

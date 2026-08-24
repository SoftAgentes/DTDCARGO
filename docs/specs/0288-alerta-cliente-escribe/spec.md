---
sdd: "0288"
title: "El ERP sabe que el cliente escribió — la alerta de 'sin atender' deja de vivir sólo en Kommo"
status: in-progress
author: "Sam (founder) + Claude"
created: 2026-08-24
updated: 2026-08-24
supersedes: null
superseded_by: null
related: ["0043", "0078", "0244", "0245", "0256", "0148"]
confidencialidad: interno
---

# SDD-0288 — El ERP sabe que el cliente escribió

## 1. El problema, medido

El founder pidió que **cuando un cliente escriba se encienda una alerta roja**.
La respuesta corta es que esa alerta existe, pero **no en el ERP**: vive en
Kommo, la produce una tarea vencida, y depende de tres cosas que nadie vigila.

### 1.1 · Lo que hay hoy en Kommo

Configurado el 2026-08-11 en los 4 agentes de IA, pestaña *Acciones*
([`kommo-estado-y-pendientes.md:229`](../../marketing/kommo-estado-y-pendientes.md)):

```
Cuando  El mensaje es recibido en horas específicas: Siempre
Hacer   Agregar tarea · Fecha límite: Ahora · Tipo: Seguimiento
        Comentario: "Responder al cliente"
```

La tarea nace vencida, así que **la tarjeta se pone roja apenas el cliente
escribe y se apaga cuando alguien la completa**. Ésa era la semántica buscada.

### 🔴 1.1.b · Medido el 2026-08-24: eso NO está pasando

El founder mandó una captura del pipeline `Ventas DTD` en vivo. La barra de
KPIs dice:

| Indicador | Valor |
|---|---|
| Leads en el tablero | **99** |
| **Sin tareas** | **94** |
| **Tareas para hoy** | **0** |
| **Caducadas** | **0** |

**Cero caducadas y cero para hoy ⇒ hoy no hay ni un solo rojo en el tablero.**
Y las tarjetas lo confirman una por una: dicen `No hay tareas ●`, incluidas las
de `Contacto inicial` con mensajes de *Ayer*.

⭐ **Esto invalida la premisa de la que colgaba el diseño original de esta
spec.** El doc daba la acción del 11-ago por hecha y funcionando; la pantalla
dice que no produce tareas. Da igual la causa —desarmada, nunca disparó, o el
agente sin créditos—: **un espejo de tareas vencidas espejaría el conjunto
vacío, y el rojo del ERP no se encendería nunca.**

Es exactamente el error que el repo ya documentó y volvió a repetirse: tomar una
línea de un doc como medición. La diferencia es que esta vez la medición llegó
antes de desplegar.

### 1.1.c · Los tres agujeros que ya estaban escritos (siguen abiertos)

| # | Agujero | Evidencia |
|---|---|---|
| 1 | Los 4 agentes cubren **sólo WhatsApp**. Instagram y Facebook son el **32% de la captación** y no crean tarea → nunca se ponen rojos | [`:174`](../../marketing/kommo-estado-y-pendientes.md) |
| 2 | La medición del plazo **nunca se hizo**. El doc dice *"se decide con datos, en unos días"* y no se toca desde el 11-ago | [`:170`](../../marketing/kommo-estado-y-pendientes.md) |
| 3 | Es **configuración de UI sin control de versiones**. Si alguien la desarma, nadie se entera: el síntoma es que deja de haber rojo, y la ausencia de una alerta no se nota | — |

### 1.2 · Lo que NO hay en el ERP

Medido contra el repo el 2026-08-24 (`96f9dba9`), en las tres capas donde
podría estar:

| Capa | Medición |
|---|---|
| **Espejo** | `kommo_leads` (0082 + las 21 migraciones `kommo_*` posteriores) no tiene `last_message_at`, ni `unread`, ni tareas. Cero columnas de mensajería |
| **Webhook** | [`kommo-webhook-parse.ts:14`](../../../supabase/functions/_shared/kommo-webhook-parse.ts) sólo entiende `add\|update\|status\|delete` sobre `leads` y `contacts`. Los eventos de mensaje ni se suscriben ([`setup-kommo-webhook.md:69`](../../runbooks/setup-kommo-webhook.md), 6 eventos) ni se parsearían |
| **Sync** | Los únicos endpoints que tocamos son `/leads`, `/contacts`, `/users`, `/tasks` (sólo POST) y `/leads/unsorted`. Nunca `/chats` |

### 1.3 · El rojo que sí existe en el ERP mide otra cosa

[`KommoBoardView.tsx:55-59`](../../../app/studio/\(app\)/crm/_components/KommoBoardView.tsx)
y [`KommoClient.tsx:62-65`](../../../app/studio/\(app\)/crm/_components/KommoClient.tsx):

```
días desde kommo_updated_at   ≥180 → var(--danger)   ≥30 → var(--warning)
```

Eso es **"lead sin moverse"**, no "cliente sin atender". Y como
`kommo_updated_at` se mueve con cualquier edición —incluida una del propio
ERP—, tampoco sirve de proxy: un lead al que el asesor le cambió una etiqueta
hace un rato aparece "fresco" aunque el cliente lleve tres días esperando.

⚠️ **Los dos rojos coexistiendo sin distinguirse es peor que uno solo.** Si el
Tablero pinta rojo por antigüedad y rojo por sin-atender con el mismo color y
sin rótulo, el asesor no puede saber cuál está mirando. Esta spec lo separa.

## 2. Objetivo

Reformulado el 2026-08-24 con lo que pidió el founder, que es **más que un
booleano rojo**:

> *"Ver qué cliente está activo. A qué cliente le estoy escribiendo y de quién
> estoy esperando una respuesta. Un indicador visual para identificar quién me
> está escribiendo y en qué etapa del proceso está. Algo que prenda en rojo,
> como si fuera un WhatsApp."*

Eso son **tres estados**, no uno — y el modelo es el de una bandeja de chat, no
el de una lista de tareas:

| Estado | Qué significa | Señal |
|---|---|---|
| **Te escribió** | el último mensaje es ENTRANTE y no hubo respuesta | 🔴 rojo + hace cuánto |
| **Esperando** | el último mensaje es SALIENTE | ⚪ neutro + hace cuánto |
| **Sin conversación** | nunca hubo mensaje | sin señal |

La **etapa** ya la da el kanban: la columna en la que está la tarjeta. Lo que
falta es la fila de arriba.

⭐ **La consecuencia de diseño es grande:** el dato que enciende el rojo es el
**último mensaje y su dirección**, no una tarea. La tarea era un proxy — y §1.1.b
acaba de mostrar que es un proxy que hoy vale cero.

**Criterio de éxito, en la voz del founder:** *que deje de trabajar en el CRM y
trabaje en el ERP* (SDD-0256 §1). Un asesor que tiene que abrir Kommo para saber
a quién le debe respuesta no está trabajando en el ERP.

## 3. Diseño

### 3.1 · La decisión que ordena todo: el mensaje es el dato, la tarea era el proxy

Hay dos formas de saber que el cliente escribió y no le contestaron:

| Vía | Qué exige | Estado |
|---|---|---|
| **(a) Espejar las tareas abiertas** | `GET /api/v4/tasks` | ✅ forma conocida (el ERP ya las **escribe**), ❌ **pero hoy el conjunto está vacío**: 94 de 99 leads sin tarea, 0 caducadas (§1.1.b) |
| **(b) El último mensaje y su dirección** | evento de mensaje del webhook | ✅ es el dato que el founder describe, ❌ **el payload no está medido** |

**Se invierte el orden respecto de la primera versión de esta spec.** La (b) pasa
a ser el núcleo y la (a) baja a complemento, por una razón sola: la (a) construye
un semáforo que **no se enciende nunca** mientras las tareas no se creen, y un
semáforo apagado es peor que ninguno — enseña al equipo a no mirarlo.

⚠️ **Y la (b) no se construye a ciegas.** El parser actual no conoce el payload
de mensaje, y el repo ya pagó caro tratar una inferencia como medición. Por eso
la primera rebanada de esta spec **es una medición, no código de producto**.

### 3.1.b · Lo que el founder recuerda que "no se pudo activar"

> *"Según lo que yo me acuerdo, Kommo lo tenía predeterminado y no lo podíamos
> activar por algún motivo."*

Coincide con un pendiente ya anotado: un **ticket de soporte abierto por
*"Mostrar el último mensaje del contacto"***, comportamiento no documentado. La
captura del 24-ago lo corrobora sin ambigüedad: en **`LEADS ENTRANTES` las
tarjetas SÍ muestran el último mensaje** y el ícono del canal; en `Contacto
inicial`, `Recontacto`, `Estimado enviado` y `Negociación` **no lo muestran**.

⭐ **Eso refuerza la decisión de que el ERP tenga su propia señal:** dentro de
Kommo, la vista que el founder quiere depende de un comportamiento que su propio
soporte no supo explicar. Fuera de Kommo, depende de un dato que podemos espejar.

📌 **El botón rojo que describe existe y es de MENSAJES, no de tareas:** en la
captura, la barra lateral muestra **`Inbox de chat · 102`** en rojo. Ése es el
contador de conversaciones sin leer — la semántica exacta que pide, y otra
confirmación de que el dato correcto es el mensaje.

### 3.2 · Migración 0390 — `kommo_tasks`

Espejo de las tareas **abiertas**. Calca la forma de `kommo_leads` (0082) y el
comportamiento de cola de `kommo_unsorted` (0343).

```sql
create table public.kommo_tasks (
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  id                  bigint not null,
  entity_id           bigint,
  entity_type         text,            -- 'leads' | 'contacts' | ...
  responsible_user_id bigint,
  text                text,
  task_type_id        bigint,
  complete_till       timestamptz,     -- epoch SEGUNDOS en Kommo → ISO acá
  is_completed        boolean not null default false,
  kommo_created_at    timestamptz,
  kommo_updated_at    timestamptz,
  synced_at           timestamptz not null default now(),
  primary key (tenant_id, id)
);
```

Índice para la única pregunta que se le hace: *"¿qué leads tienen tarea vencida?"*

```sql
create index kommo_tasks_pendientes_idx
  on public.kommo_tasks (tenant_id, entity_type, entity_id, complete_till)
  where is_completed = false;
```

RLS y GRANTs: patrón exacto de 0082 — `authenticated` = `SELECT` acotado por
tenant, escritura sólo `service_role`.

⚠️ **`complete_till` viaja en epoch de SEGUNDOS.** El mismo aviso que ya lleva
[`buildTaskPayload`](../../../lib/studio/kommo-writeback.ts) en el camino de
ida: confundirlo con milisegundos pone el vencimiento en el año 57.000 y **la
tarea nunca se ve vencida**. Falla en la dirección que no se ve. El espejo hace
el camino inverso y hereda el mismo test de dígitos.

### 3.3 · El sync aprende una entidad más

`kommo-sync` gana el bloque `tasks`, con el patrón de marca de agua de
`unsorted` ([`sync.ts:442-495`](../../../supabase/functions/kommo-sync/sync.ts)):

1. `runAt` **antes** del upsert.
2. Paginar `GET /api/v4/tasks`.
3. Upsert por `(tenant_id, id)`.
4. Borrar lo que quedó con `synced_at < runAt` — **sólo si la lectura fue
   completa**. Una tarea completada desaparece del conjunto abierto y tiene que
   desaparecer del espejo, o el rojo se queda encendido para siempre.

**Optimización, NO requisito de corrección:** se pide
`filter[is_completed]=0` para traer sólo las abiertas. ⚠️ **Ese filtro no está
verificado contra la API.** Por eso el código **no depende de él**: la derivada
de §3.4 evalúa `is_completed = false` sobre la fila espejada. Si Kommo ignora el
filtro, el espejo trae de más y el resultado sigue siendo correcto — sólo más
caro. Un diseño que dependiera del filtro para ser correcto estaría apostando a
algo que nadie midió.

### 3.4 · La derivada: qué significa "sin atender"

Función pura, en `lib/studio/kommo-atencion.ts`:

```
Un lead está SIN ATENDER si tiene ≥1 tarea con
    entity_type = 'leads'  ∧  entity_id = <lead>
  ∧ is_completed = false
  ∧ complete_till < ahora
```

Es la definición literal de Kommo. Ni más estricta ni más laxa: si el ERP
inventara su propio umbral, los dos semáforos divergirían y volveríamos a tener
dos verdades.

### 3.5 · La pantalla

**Tablero (kanban) y tabla del Asesor**, las dos superficies — lo fija el
contrato que ya existe por el error de SDD-0256 §4 (*"el verbo va en las DOS
vistas"*; salió primero sólo en la tabla y en la práctica fue peor que no
tenerlo).

| Señal | Hoy | Con esta spec |
|---|---|---|
| Antigüedad (`≥180d`) | `var(--danger)` sin rótulo | pasa a `var(--warning)` con `title` explícito. **Deja de competir por el rojo** |
| **Te escribió** | no existe | 🔴 `var(--danger)` + *"Te escribió · hace 3 h"* |
| **Esperando respuesta** | no existe | ⚪ `var(--ink-mute)` + *"Esperando · hace 2 d"* |

**La forma del indicador la fijó el founder:** *"un botoncito rojo a la
izquierda"*, como una notificación de WhatsApp. Punto sólido al inicio de la
tarjeta, no un borde ni un fondo: se lee de un vistazo recorriendo la columna en
vertical, que es como se mira un kanban.

⚠️ **El estado "esperando" NO es rojo, y eso no es un detalle.** Si los dos
estados comparten el color, la columna se vuelve un muro rojo y el indicador
muere — que es justo el riesgo anotado y nunca medido en el doc de Kommo. El
rojo se reserva para lo único accionable ahora mismo: **te deben una
respuesta**.

⚠️ **BRAND-CHECK, y por qué no hay violación:** el rojo se toma de
`var(--danger)`, que es semántico y ya está en el sistema. No se agrega ningún
token nuevo. Lo que sí cambia es **a qué se le da el rojo**: hoy lo tiene la
antigüedad, que no es una urgencia accionable; pasa a tenerlo la falta de
atención, que sí lo es. Un tablero con todo en rojo no comunica nada — es el
mismo riesgo que el propio doc de Kommo dejó anotado sin medir
([`:170`](../../marketing/kommo-estado-y-pendientes.md)).

**Contraste:** `--danger` sobre el fondo de tarjeta ya se usa en esta misma
pantalla; no se introduce ninguna combinación nueva que haya que medir.

### 3.6 · El orden de las rebanadas (revisado 2026-08-24)

| # | Rebanada | Estado | Bloqueada por |
|---|---|---|---|
| **0** | 🔴 **Medir el evento de mensaje** | pendiente | **una mirada del founder** a la pantalla de webhooks de Kommo (§3.7) |
| **1** | `last_inbound_at` / `last_outbound_at` en `kommo_leads` + el semáforo de 3 estados | especificada | la 0 |
| **2** | Espejo de tareas (`kommo_tasks`, migración 0390) | ✅ **construida y verificada** | — |
| **3** | Red de seguridad: si el cliente escribió y nadie tomó el caso, **el ERP encola la tarea** | especificada | la 1 |

**Por qué la 2 se queda aunque ya no encienda el rojo.** Tres razones, ninguna
sentimental:

1. **Mide el hueco.** Con el espejo, el ERP puede afirmar *"0 tareas vencidas"*
   sin que nadie tenga que abrir Kommo. Hoy ese dato salió de una captura.
2. **Es el "ya lo tomé".** Cuando la rebanada 3 exista, completar la tarea es lo
   que apaga el rojo en las dos pantallas.
3. **Ya está pagada:** migración, contrato SQL validado por mutación y sync.

⭐ **La rebanada 3 vuelve innecesario el parche de sumarle canales al agente de
IA:** la tarea la crea el ERP, no el agente, así que cubre Instagram y Facebook
**sin gastar un crédito**.

### 3.7 · Lo único que no puedo medir yo

Para la rebanada 0 hace falta saber **qué eventos de mensaje ofrece la cuenta**.
Eso vive detrás de la sesión del founder, en la pantalla donde ya se marcaron los
6 eventos actuales ([`setup-kommo-webhook.md`](../../runbooks/setup-kommo-webhook.md)).

🔴 **No se asume que exista.** Si la cuenta no ofrece evento de mensaje, la
rebanada 1 cambia de fuente (sondear `/api/v4/talks`, o derivar del espejo de la
bandeja `kommo_unsorted`, que **sí** trae el mensaje y es lo que hace que
`LEADS ENTRANTES` muestre el texto) y eso es una decisión de diseño distinta, no
un detalle de implementación.

## 4. Decisiones

- 🔄 **REVERTIDA la decisión "el espejo antes que el webhook".** La primera
  versión de esta spec eligió empezar por las tareas porque era lo construible
  sin sesión de Kommo. La captura del 24-ago mostró que ese camino entrega un
  semáforo que no se enciende. **Se cambió el orden, no el objetivo.**
- **El rojo se decide por el ÚLTIMO MENSAJE y su dirección**, no por una tarea.
  La tarea es un proxy que depende de configuración de UI que nadie versiona.
- **La antigüedad cede el rojo.** No se borra: baja a ámbar y gana rótulo. Dos
  cosas distintas no pueden compartir el color más fuerte.
- **"Esperando respuesta" no es rojo.** Si todo es urgente, nada lo es.
- **El filtro de la API es optimización, no corrección** (§3.3).
- **No se toca la configuración de los agentes de Kommo desde acá.** Eso es
  trabajo de navegador, va por su propio runbook y cuesta créditos.

## 5. Fuera de alcance

- Notificar por Telegram/push cuando entra un mensaje. El patrón existe
  ([[0148]] lo hace para el chat del portal) pero **avisar de 16 leads/día sin
  haber medido el volumen es fabricar ruido**. Primero el semáforo; el aviso, con
  datos.
- Conversar con el cliente desde el ERP (necesita scope OAuth y DTD usa token de
  larga duración — probable 403, y hay que medirlo, no asumirlo).
- Espejar el contenido de los mensajes. No hace falta para el semáforo y mete
  PII de conversaciones en la base sin una razón que lo justifique.

## 6. Verificación

| Qué | Cómo |
|---|---|
| Contrato SQL de la 0390 | RLS por tenant · aislamiento cross-tenant · GRANTs · el índice parcial se usa. **Validado por mutación**: con el `where is_completed = false` fuera, el contrato se pone rojo |
| `complete_till` en segundos | test que cuenta dígitos, gemelo del de ida |
| La derivada | unit sobre casos: sin tareas · tarea abierta futura · tarea abierta vencida · tarea completada vencida · tarea de otro tenant · tarea de `contacts` |
| El drenaje | la tarea que se completa **desaparece** del espejo y el rojo se apaga. Con la lectura truncada **no se borra nada** |
| Las dos vistas | contrato al molde de `stage-control.test.ts` |
| Gate | `node scripts/verify.mjs` en verde, con el número de pruebas impreso |

🔴 **Lo que esta verificación NO prueba:** que Kommo devuelva las tareas con la
forma esperada. Eso exige la cuenta real y queda como paso de cierre explícito,
no como supuesto silencioso.

## 7. Estado

`in-progress`.

- **Rebanada 2 (espejo de tareas): construida y verificada.** Migración 0390,
  contrato SQL de 116 invariantes validado **por mutación** (con la RLS abierta
  el contrato canta la fuga; sin el predicado parcial canta el índice), y el
  sync aprendió la entidad `tasks`.
- **Rebanadas 0, 1 y 3: especificadas, sin una línea escrita.** A propósito. La
  0 es una **medición** y está bloqueada por §3.7 — una mirada del founder a la
  pantalla de webhooks de su Kommo.

🔴 **Lo que esta spec NO afirma:** que Kommo ofrezca un evento de mensaje
suscribible. Nadie lo midió. Todo el diseño de la rebanada 1 cuelga de esa
respuesta y está escrito para poder cambiar de fuente sin rehacerse.

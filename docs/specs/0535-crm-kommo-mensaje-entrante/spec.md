---
sdd: "0535"
title: "Kommo: el cliente que vuelve a escribir llega a Recontacto, con la tarjeta en rojo"
status: in-progress
author: "Sam (founder) + Claude"
created: 2026-10-15
updated: 2026-10-15
supersedes: null
superseded_by: null
related: ["0244", "0245", "0256", "0288"]
confidencialidad: interno
---

# SDD-0535 — El cliente que vuelve a escribir regresa a Recontacto

> Cuando un cliente que ya pasó vuelve a escribir, el webhook del ERP lo deja en
> **Recontacto** con una tarea vencida, por los dos caminos que usa Kommo: el
> trato nuevo que abre en «Leads Entrantes» (`unsorted[add]`) se acepta directo
> en Recontacto, y el mensaje que cae en un trato de `Ventas Perdidos` lo reabre
> en Recontacto. La tarjeta aparece en el embudo y en rojo.

## Contexto

Pedido de Sam (2026-10-15, literal):

> «Cuando los clientes vuelven a escribir, ya no se está mostrando la
> notificación o la alerta en rojo que indica que enviaron un mensaje. […] Que el
> cliente se mueva automáticamente a "activo" otra vez [o] que se muestre una
> alerta o una notificación en rojo que indique que volvió a escribir.»

Y la aclaración del mismo día: «Cada vez que escribe un cliente que ya pasó (ya no
es un lead, sino que volvió a escribir), debe aparecer en recontacto. Ahorita
parece que escriben y no llega a recontacto, sino que se queda en algún lado
atrás.»

### Medido en la cuenta `dtdcargo.kommo.com` el 2026-10-15 (solo lectura)

Con la sesión de Sam, por la API v4 y el panel. Sin cambiar nada.

| Qué | Resultado |
|---|---|
| Tratos con mensaje entrante en los últimos 30 días | **462** |
| De esos, cerrados hoy en `Ventas Perdidos` | **278** |
| Tratos cerrados donde el cliente escribió **después** del cierre | **57** (56 perdidos, 1 ganado), unos 2 por día |
| De esos 57, contactos con un trato **posterior** al cierre | **0**: el 100 % de los mensajes se colgó del trato cerrado |
| Movimientos a Recontacto desde el 2026-07-25 | **18** (sin contar los 14 de la consolidación del 2026-08-04), todos del usuario `DTD CARGO` (persona o token del ERP); ninguno del robot de Kommo |
| Reaperturas de un trato cerrado desde el 2026-07-01 | **10** en total; Kommo no reabrió ninguno |

En esos 57 casos Kommo no creó un trato nuevo: colgó el mensaje del trato
cerrado, y la tarjeta se quedó escondida en Perdidos (caso **B**, abajo).

### Medido por la tarde: el cliente con Shipping Mark sí recibe un trato nuevo

Sam volvió a reportar el mismo día (literal): «Cuando un usuario que ya pasó de
leads y ya es cliente escribe de nuevo, debería moverse a recontacto. Ya se le
atendió antes, ya tiene hasta número de cliente asignado […]. Ahorita que volvió
a escribir no se está moviendo a recontacto.»

**En Kommo** (sesión de Sam, solo lectura, 2026-10-15 ~18:20 UTC):

| Qué | Resultado |
|---|---|
| Tratos con mensaje entrante desde el 2026-10-14 cuyo contacto tiene Shipping Mark | **16** |
| De esos, tratos **nuevos** creados entre el 11 y el 14 de octubre | **6**, todos en `Contacto inicial` |
| Cómo llegaron ahí (eventos de cada trato) | `lead_added` del robot en «Leads Entrantes» y, horas o días después, `Entrantes > Contacto inicial` del usuario `DTD CARGO`: alguien los aceptó a mano |
| Los 18 movimientos a Recontacto desde julio | **todos** ocurrieron 4 horas o más después de creado el trato: ninguno fue automático |

**En el servidor propio** (OK de lectura de Sam: «tienes OK para leer en el
servidor propio, solo lectura, la configuración de la conexión de Kommo […], las
filas de kommo_writeback_outbox con op, estado, error y fecha (sin payload de
clientes) y los registros de las funciones de Kommo»):

| Qué | Resultado | Fuente |
|---|---|---|
| Conexión | `stage_map.recontacto` = `{14036567, 108343835}`, `writeback_enabled` = t, `writeback_dry_run` = f | `kommo_connections` |
| Drenaje de la cola | `kommo-writeback-drain-dtd`, `*/15`, activo, corridas `succeeded` | `cron.job` y `cron.job_run_details` |
| Filas de la cola desde 2026-08-01 | **4** (2 `patch_lead` y 2 `patch_stage`, todas del 11 y 13 de agosto) | `kommo_writeback_outbox` |
| `patch_stage` hacia Recontacto, alguna vez | **0** | ídem |
| Webhook | registros `webhook_leads`/`webhook_contacts` en `ok` todos los días | `sync_logs` |
| Eventos `unsorted[add]` en 5 días | **1.864**, descartados como forma desconocida | `docker logs --since 120h dtd-cargo-functions-1` |
| Otros eventos descartados | `unsorted[update]` 2.184 · `talk[update]` 1.892 · `talk[add]` 528 · `leads[responsible]` 510 · `unsorted[delete]` 238 | ídem |

**Conclusión (verificada):** cuando el cliente que ya pasó vuelve a escribir y
Kommo le abre un trato nuevo, ese trato nace en «Leads Entrantes» y Kommo lo avisa
con `unsorted[add]`, **no con `leads[add]`**. Nuestro parser descarta
`unsorted[...]`, así que el enrutador de SDD-0244 no se disparó nunca: la cola no
tiene un solo `patch_stage` a Recontacto. Lo que «antes funcionaba» era una persona
eligiendo Recontacto al aceptar la entrada. Este es el caso **A**.

El diseño de SDD-0244 suponía «cliente escribe → Kommo crea el trato →
`leads[add]`» (`docs/runbooks/kommo-consolidacion-embudo-unico.md` § «Enrutado
automático a Recontacto»). SDD-0245 §7 ya lo advertía para la bandeja.

**NO VERIFICADO:** qué decide Kommo entre colgar el mensaje del trato cerrado
(caso B) o abrir un trato nuevo en la bandeja (caso A).

### Por qué tampoco hay rojo

El rojo de las tarjetas es el de **tareas vencidas** (`docs/marketing/kommo-estado-y-pendientes.md`
§ «Por qué no llegan las alertas rojas»). Lo producían los **4 agentes de IA**, con
la acción «El mensaje es recibido: Siempre → Agregar tarea». Medido hoy:

| Qué | Resultado |
|---|---|
| Estado de los 4 agentes (`/settings/ai-agent/`) | **apagados** (interruptor sin marcar en los 4) |
| Mensajes salientes de bots o agentes (`created_by = 0`) | el último bloque fue el **2026-09-24** (17); desde el 25-sep, 2 en total |
| Tareas creadas por el robot (`task_added`) | la última, el **2026-09-24**; ninguna abierta hoy |
| Paquete de créditos de IA (US$99, 50.000) | **Caducado**; última renovación 29-08-2026; renovación automática **desactivada** |
| Créditos incluidos en el plan | 3 usados de 2.250 en el ciclo |
| Salesbots (15) | **todos apagados**, incluidos los 4 «Ping 23 h» que corrían en agosto |
| Disparadores de mensaje entrante en el embudo | solo los 4 «23 h después del último mensaje → Salesbot», con los bots apagados |

Quién apagó los agentes y los Salesbots: **NO VERIFICADO**. Kommo no lo registra
en los eventos de la API.

Con el OK nominal de Sam, los 4 agentes se encendieron el 2026-10-15 entre las
13:19 y las 13:30 UTC (canal y etapas en `docs/marketing/kommo-estado-y-pendientes.md`),
y la prueba real de las 13:33:54 UTC creó la tarea. Por la tarde Sam informó que
los volvieron a apagar para no gastar créditos, y que tampoco con ellos el cliente
llegaba a Recontacto: los agentes nunca movían tratos.

No es una actualización de WhatsApp: los mensajes entrantes siguen llegando (entre
13 y 217 por día, hasta hoy) y el canal `whatsapp_cloud_api` está activo. La baja
de la API vieja de WhatsApp Business en Kommo es de octubre de 2024 y no aplica.

### Lo que nuestro código NO hace

Revisado en `supabase/functions/`, `lib/studio/` y `app/`: ninguna llamada marca
chats como leídos, cierra conversaciones, prende o apaga Salesbots o agentes. Los
únicos verbos de escritura salen de la cola (`kommo_writeback_outbox`): cambiar
etapa, precio, responsable, etiquetas, campos, notas y tareas.

## Alcance

**Entra:**

1. **Caso A · trato nuevo en la bandeja.** `kommo-webhook` lee `unsorted[add]`
   (`uid`, `lead_id`, `pipeline_id`, `category`; nada más del cliente). Por cada
   entrada resuelve al contacto con el mismo `decideRoute` de SDD-0244 (vínculo
   `kommo_contact_id` o teléfono, con auto-sanado):
   - **Cliente que ya pasó** → la entrada se **acepta en Recontacto**
     (`POST /api/v4/leads/unsorted/{uid}/accept` con `status_id`), y se encolan su
     Shipping Mark (trato y contacto) y una `add_task` vencida.
   - **Desconocido** → se queda en «Leads Entrantes»: es un lead nuevo de verdad.
   - **Otro embudo** → no se toca.
2. **Caso B · mensaje en un trato cerrado.** Por cada trato con un mensaje
   **entrante** del cliente se pide el trato a Kommo (`GET /api/v4/leads/{id}`):
   - **Perdido (143)** → se encola `patch_stage` a `stage_map.recontacto` y una
     `add_task` vencida («El cliente volvió a escribir. Responder.»).
   - **Ganado (142)** → solo la `add_task`. No se reabre (SDD-0244 §5: «Reabrir
     o modificar tratos ganados. Nunca.»).
   - **Abierto** → nada: ya está en el embudo.
3. Si hubo algo que escribir, se despierta el drenaje (`kommo-writeback`) para no
   esperar al cron de 15 minutos.

**No entra:**

- Encender los agentes, los Salesbots o comprar créditos en Kommo. Es
  configuración con costo: decide Sam (ver «Configuración de Kommo»).
- El rojo para **cualquier** mensaje de un trato abierto. Lo daban los agentes.
- Mover a Recontacto un trato que una persona ya aceptó en otra etapa: el caso A
  actúa al nacer la entrada, no después.
- Leer `unsorted[update]`, `unsorted[delete]` y `talk[...]`: siguen descartados.

## Diseño

### El núcleo puro: `supabase/functions/_shared/kommo-reapertura.ts`

| Función | Qué hace |
|---|---|
| `parseEntradasBandeja(cuerpo)` | caso A: `uid`, `lead_id`, embudo y categoría de cada `unsorted[add]`, sin repetir `uid` |
| `cuerpoAceptarEnRecontacto(entrada, destino)` | caso A: `{ status_id }` solo si la entrada es del embudo de Recontacto |
| `procesarEntradasBandeja(entradas, deps)` | caso A: orquesta resolver → gate → accept → marcas y tarea; dependencias inyectadas, nunca lanza |
| `tokenEntrada(uid)` | caso A: token de la tarea, uno por entrada |
| `leadsConMensajeEntrante(mensajes)` | caso B: leads distintos con al menos un mensaje del cliente (`entrante`) |
| `decidirReapertura(lead, destino, ahora)` | caso B: `reabrir`, `avisar` o `nada`, con los payloads listos |
| `tokenVolvio(closed_at)` | caso B: token de la tarea, uno por episodio de cierre |
| `buildTareaVolvioPayload(...)` | gemelo de `buildTaskPayload` (`lib/studio/kommo-writeback.ts`) |

En `kommo-webhook/index.ts`, la resolución del cliente de `routeNewLeads` se
extrae a `crearCargadorPorClaves`, `resolverCliente` y `encolarMarcas`, que
comparten el enrutador de `leads[add]` y `aceptarClientesEntrantes`.

### Decisiones

| Decisión | Por qué |
|---|---|
| Caso A: la señal es `unsorted[add]` | Es como Kommo avisa el trato nuevo del cliente que vuelve (1.864 en 5 días); `leads[add]` no llega |
| Caso A: solo se acepta a quien `decideRoute` reconoce como cliente | Un desconocido es un lead nuevo de verdad y lo atiende la bandeja como siempre |
| Caso A: el accept va **directo** a Kommo, no por la cola | Tiene que llegar antes de que una persona acepte la entrada a mano, y es idempotente por naturaleza: aceptada una vez, la entrada ya no existe. La cola no tiene una op de accept y sumarla exige migración. El Shipping Mark y la tarea sí van por la cola |
| Caso A: mismo gate que la cola (`writeback_enabled && !writeback_dry_run`) | Con el ensayo encendido se reconoce al cliente y no se escribe |
| Caso A: 404 o 400 del accept no se reintentan ni generan tarea | `unsorted[add]` llega varias veces por entrada: el segundo accept cae en 404 y no puede dejar una segunda tarea |
| Caso A: la tarea lleva `dedupe_token = volvio:entrada:<uid>` | Una tarea por entrada aunque el evento se repita |
| Caso B: la señal es el `message[add]` entrante | En ese caso Kommo no crea un trato (57 de 57) |
| Se pide el trato a Kommo, no al espejo | El espejo puede ir atrás de un cambio manual; el `GET` es uno por trato que escribe |
| Mismo interruptor que SDD-0244 (`stage_map.recontacto`) | Sin él no se encola nada: se puede apagar sin desplegar |
| Caso B: mismo gate de escritura (la cola y su `writeback_dry_run`) | En el caso B el webhook solo encola |
| `patch_stage` **sin** snapshot de `updated_at` | Cada mensaje entrante le sube el `updated_at` al trato (32 de 40 medidos, 1 a 5 s después). Con snapshot, el segundo mensaje de una ráfaga haría que el drenaje saltee el cambio por «el lead cambió» |
| La tarea lleva `dedupe_token = volvio:<closed_at>` | Una tarea por episodio de cierre, aunque lleguen 5 mensajes antes del drenaje (0377: un POST por token, para siempre) |
| La tarea vence al momento del mensaje | Nace vencida: la tarjeta sale en rojo apenas llega a Kommo, igual que con la acción «Ahora» de los agentes |
| Ganado → solo la tarea | Reabrir una venta la borra de los reportes de Kommo. Decisión vigente de SDD-0244 |
| Se despierta el drenaje con `EdgeRuntime.waitUntil` | Sin esto la latencia es de hasta 15 minutos; con esto, segundos. Si falla, el cron drena igual |

### Riesgos aceptados

- **Un perdido que solo agradece vuelve a Recontacto.** De los 57, 13 escribieron
  menos de un día después del cierre. Es la regla que pidió Sam; el asesor lo
  vuelve a cerrar. Si molesta, se agrega una ventana de gracia o se excluye un
  motivo de pérdida (hoy: «No respondió» 11, «Solo consultaba» 25, «Fuera de
  nuestro servicio» 6, «Limpieza 2026-08» 3, sin motivo 12).
- **Sin snapshot, un cambio manual en la misma ventana se pisa.** Si el asesor
  mueve el trato perdido a otra etapa en los segundos entre el mensaje y el
  drenaje, gana Recontacto. Con el drenaje despertado, la ventana es corta.

### Configuración de Kommo (la decide Sam; no la toca este SDD)

Para el rojo en **todos** los mensajes, no solo en los que vuelven:

1. Encender los 4 agentes en `Agente de IA`. Con los créditos del plan (2.250 por
   ciclo) duran pocos días al ritmo de agosto (15.000 a 18.000 por mes); para
   sostenerlos hace falta el paquete Crecimiento (US$99/mes), hoy caducado.
2. Encender los 4 Salesbots «Ping 23 h» si se quieren los seguimientos de las 23 h.

## Gobernanza

| Política | Clasificación |
|---|---|
| SGE-00 / MP-01 (efectos externos) | cumplimiento: el caso B y lo que sigue al accept salen por la cola, con su gate y su idempotencia; el accept del caso A sale directo, con el mismo gate e idempotente por naturaleza (decisión documentada arriba) |
| AUD-01 / AUD-02 | cumplimiento en lo que va por la cola (fila en `kommo_writeback_outbox`). **Excepción** en el accept del caso A: queda en el log del webhook (`[sdd-0535][entradas]`, solo conteos) y en el historial de eventos del trato en Kommo (`lead_status_changed`), no en la cola |
| ERR-01 | cumplimiento: el log del webhook lleva solo conteos, sin texto ni teléfonos |
| VIS-01 / VIS-02 | no aplica: sin cambio de interfaz en Studio |

**Datos personales:** no aplica. No se captura ni se mueve un dato personal nuevo.
Del `unsorted[add]` solo se leen `uid`, `lead_id`, embudo y categoría; el nombre,
el teléfono y el texto que trae el evento no se leen ni se registran. El cruce con
`clients` es el mismo de SDD-0244. Se escribe una tarea con texto fijo.

## Producción

- **OK de despliegue de Sam**, transmitido por el Director (sesión «Revisión de
  tareas en progreso»), que es quien despliega. Primero, para el caso B: «Y TAMBIEN
  autorizo desplegar kommo-webhook en el servidor propio». Después, con el caso A
  sumado: «Confirmo desplegar kommo-webhook con el cambio: los tratos nuevos de
  clientes que ya pasaron se aceptan directo en Recontacto con tarea vencida».
- El Worker no despliega ni escribe en Kommo. Integra, fusiona y despliega el
  Director.

## Aceptación

- [x] Caso A: entrada de un cliente que ya pasó → accept en Recontacto, y después Shipping Mark y tarea vencida.
- [x] Caso A: cliente desconocido → no se acepta: se queda en Leads Entrantes.
- [x] Caso A: entrada repetida o ya aceptada → el accept da 404, no rompe el webhook y no duplica la tarea.
- [x] Caso A: gate apagado → no se acepta; sin `stage_map.recontacto` → inerte; otro embudo → no se toca.
- [x] Caso A: un POST con solo `unsorted[add]` ya no se descarta en la salida temprana.
- [x] Caso B: perdido con mensaje entrante → `patch_stage` a Recontacto + `add_task` vencida.
- [x] Caso B: ganado → solo la `add_task`; abierto, saliente o sin destino → nada.
- [x] Caso B: varios mensajes del mismo cierre → una sola tarea (token por `closed_at`).
- [x] El payload de la tarea es idéntico al de `buildTaskPayload` del Studio.
- [x] El enrutador de `leads[add]` sigue igual, sobre los helpers compartidos.
- [x] Mutantes muertos (6 del caso B y 10 del caso A).
- [x] `edge:check` compila las 4 funciones.
- [ ] Desplegada en el servidor propio y probada con un mensaje real (la despliega el Director).

## Allowlist

- `supabase/functions/_shared/kommo-reapertura.ts` (nuevo).
- `supabase/functions/_shared/__tests__/kommo-reapertura.test.ts` (nuevo).
- `supabase/functions/kommo-webhook/index.ts`.
- `app/studio/(app)/crm/__tests__/punto-conversacion.test.ts`: el texto de la
  condición de salida temprana que busca la prueba de SDD-0288 (la condición
  suma las entradas de la bandeja; lo que la prueba afirma no cambia).
- `docs/specs/0535-crm-kommo-mensaje-entrante/spec.md` y `docs/specs/README.md` (índice regenerado).
- `docs/marketing/kommo-estado-y-pendientes.md` (bloque fechado del 2026-10-15).
- `.agents/handoffs/0535-crm-kommo-mensaje-entrante.md`.

## Evidencia

- **Pruebas:** `kommo-reapertura.test.ts`, 45 casos (21 del caso B y 24 del caso
  A, con dobles para el orquestador y lectura del fuente para el cableado). Con las
  suites vecinas (`kommo-router`, `webhook-parse`, `kommo-writeback-plan`,
  `punto-conversacion`, `kommo-writeback`): 6 archivos, 168 casos, en verde.
- **Mutantes del caso B** (6; cada uno cuenta como muerto solo si la salida trae la
  línea `Tests` con fallos): ganado que se reabre (1 falla), `complete_till` en
  milisegundos (5), salientes que cuentan (1), tarea sin `dedupe_token` (1), token
  distinto por mensaje (4), sin interruptor (1).
- **Mutantes del caso A** (10, control verde 45/45): acepta desconocidos (1),
  tarea tras accept fallido (3), ignora el gate (1), sin inerte (1), sin dedupe de
  `uid` (1), cualquier embudo (2), token por evento (3), salida temprana vieja (1),
  gate fijo en `true` (1), 404 contado como aceptado (1).
- **`pnpm edge:check`:** las 4 funciones compilan con Deno 2.
- **Prueba en producción:** pendiente; la despliega el Director. Prueba: un
  contacto con Shipping Mark escribe y su trato nuevo pasa de la bandeja a
  Recontacto en segundos, con la tarea vencida.

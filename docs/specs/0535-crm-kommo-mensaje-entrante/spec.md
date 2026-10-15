---
sdd: "0535"
title: "Kommo: el cliente que vuelve a escribir en un trato cerrado regresa a Recontacto, con la tarjeta en rojo"
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

> Cuando alguien con el trato en `Ventas Perdidos` vuelve a escribir, el webhook
> del ERP lo pasa a **Recontacto** y le crea una tarea vencida. La tarjeta
> aparece de nuevo en el embudo y en rojo.

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

**Kommo no crea un trato nuevo** cuando alguien con el trato perdido vuelve a
escribir: cuelga el mensaje del trato cerrado. Por eso el enrutador de SDD-0244,
que se dispara con `leads[add]`, nunca se entera. Su diseño suponía «cliente
escribe → Kommo crea el trato → webhook» (`docs/runbooks/kommo-consolidacion-embudo-unico.md`
§ «Enrutado automático a Recontacto»), y eso no pasa. El cliente escribe y la
tarjeta se queda escondida en Perdidos.

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

1. En `kommo-webhook`, por cada trato con un mensaje **entrante** del cliente, se
   pide el trato a Kommo (`GET /api/v4/leads/{id}`) y:
   - **Perdido (143)** → se encola `patch_stage` a `stage_map.recontacto` y una
     `add_task` vencida («El cliente volvió a escribir. Responder.»).
   - **Ganado (142)** → solo la `add_task`. No se reabre (SDD-0244 §5: «Reabrir
     o modificar tratos ganados. Nunca.»).
   - **Abierto** → nada: ya está en el embudo.
2. Después de encolar, se despierta el drenaje (`kommo-writeback`) para no esperar
   al cron de 15 minutos.

**No entra:**

- Encender los agentes, los Salesbots o comprar créditos en Kommo. Es
  configuración con costo: decide Sam (ver «Configuración de Kommo»).
- El rojo para **cualquier** mensaje de un trato abierto. Lo daban los agentes; si
  Sam no los enciende, es otra tarea.
- Crear un trato nuevo para el cliente ganado que vuelve. Exige una op `create_lead`
  nueva en la cola y una migración.

## Diseño

### El núcleo puro: `supabase/functions/_shared/kommo-reapertura.ts`

| Función | Qué hace |
|---|---|
| `leadsConMensajeEntrante(mensajes)` | leads distintos con al menos un mensaje del cliente (`entrante`) |
| `decidirReapertura(lead, destino, ahora)` | `reabrir`, `avisar` o `nada`, con los payloads listos |
| `tokenVolvio(closed_at)` | token de idempotencia de la tarea: uno por episodio de cierre |
| `buildTareaVolvioPayload(...)` | gemelo de `buildTaskPayload` (`lib/studio/kommo-writeback.ts`) |

### Decisiones

| Decisión | Por qué |
|---|---|
| La señal es el `message[add]` entrante, no `leads[add]` | Es lo único que llega: Kommo no crea el trato (57 de 57) |
| Se pide el trato a Kommo, no al espejo | El espejo puede ir atrás de un cambio manual; el `GET` es uno por trato que escribe |
| Mismo interruptor que SDD-0244 (`stage_map.recontacto`) | Sin él no se encola nada: se puede apagar sin desplegar |
| Mismo gate de escritura (la cola y su `writeback_dry_run`) | El webhook solo encola; nunca le escribe a Kommo directo |
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
| SGE-00 / MP-01 (efectos externos) | cumplimiento: el efecto en Kommo sale por la cola existente, con su gate y su idempotencia |
| AUD-01 / AUD-02 | cumplimiento: cada orden queda como fila en `kommo_writeback_outbox` |
| ERR-01 | cumplimiento: el log del webhook lleva solo conteos, sin texto ni teléfonos |
| VIS-01 / VIS-02 | no aplica: sin cambio de interfaz en Studio |

**Datos personales:** no aplica. No se captura ni se mueve un dato personal nuevo:
se lee el estado del trato (etapa, cierre, responsable) y se escribe una tarea con
texto fijo. El cuerpo del mensaje no se lee ni se registra.

## Aceptación

- [x] Perdido con mensaje entrante → `patch_stage` a Recontacto + `add_task` vencida.
- [x] Ganado → solo la `add_task`.
- [x] Abierto, saliente o sin `stage_map.recontacto` → nada.
- [x] Varios mensajes del mismo cierre → una sola tarea (token por `closed_at`).
- [x] El payload de la tarea es idéntico al de `buildTaskPayload` del Studio.
- [x] El webhook estampa el mensaje antes de reabrir y solo encola.
- [x] Mutantes muertos (6).
- [x] `edge:check` compila las 4 funciones.
- [ ] Desplegada en el servidor propio y probada con un mensaje real (necesita el OK de Sam).

## Allowlist

- `supabase/functions/_shared/kommo-reapertura.ts` (nuevo).
- `supabase/functions/_shared/__tests__/kommo-reapertura.test.ts` (nuevo).
- `supabase/functions/kommo-webhook/index.ts`.
- `docs/specs/0535-crm-kommo-mensaje-entrante/spec.md` y `docs/specs/README.md` (índice regenerado).
- `docs/marketing/kommo-estado-y-pendientes.md` (bloque fechado del 2026-10-15).
- `.agents/handoffs/0535-crm-kommo-mensaje-entrante.md`.

## Evidencia

- **Pruebas nuevas:** `kommo-reapertura.test.ts`, 21 casos. Con las suites vecinas
  (`kommo-router`, `webhook-parse`, `kommo-writeback-plan`, `punto-conversacion`,
  `kommo-writeback`): 6 archivos, 144 casos, en verde.
- **Mutantes** (6, sobre líneas del diff; cada uno cuenta como muerto solo si la
  salida trae la línea `Tests` con fallos): ganado que se reabre (1 falla),
  `complete_till` en milisegundos (5), salientes que cuentan (1), tarea sin
  `dedupe_token` (1), token distinto por mensaje (4), sin interruptor (1).
- **`pnpm edge:check`:** las 4 funciones compilan con Deno 2.
- **Prueba en producción:** pendiente. Hace falta desplegar `kommo-webhook` en el
  servidor y que un contacto de prueba con el trato perdido escriba.

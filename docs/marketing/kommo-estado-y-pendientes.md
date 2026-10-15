# Kommo — estado verificado y checklist de pendientes

> **Qué es:** la foto del CRM medida **en vivo el 2026-08-10**, con lo que se arregló ese día, los
> gotchas que costaron horas y el checklist de lo que queda. Todo lo de acá se leyó de la pantalla o
> de la API con la sesión del founder — nada se infiere.
>
> **Cuenta:** `dtdcargo.kommo.com` (id `31589859`) · pipeline **Ventas DTD** (`14036567`).
> ⚠️ `doortudoor.kommo.com` **no existe**.
>
> Relacionados: [`agentes-ia-configuracion.md`](agentes-ia-configuracion.md) ·
> [`agentes-ia-por-etapa.md`](agentes-ia-por-etapa.md) · [`instagram-entrada.md`](instagram-entrada.md)

## 🟢 Resuelto el 2026-08-10

### El usuario del CRM no podía renombrar ni mover leads → eran LICENCIAS

Llevaba días trabado. **No era permisos ni campos obligatorios** — ambos descartados midiendo:

| Hipótesis | Cómo se descartó |
|---|---|
| Permisos del usuario | los 2 usuarios activos eran **admin** con `leads.edit: "A"` |
| Campos obligatorios por etapa | **0 de 19** campos tenían `required_statuses` |
| Razones de pérdida | no bloqueaban |

La causa estaba en `Ajustes → Facturación`: **"Has superado la cantidad de licencias compradas"**,
con **2 usuarios activos / 1 licencia paga**. Kommo bloquea la edición hasta que cuadre.

Se desactivó a **Sergio Quevedo Bermudez** (3 leads asignados, contra 3.125 de DTD CARGO) y quedó
**1/1 usados**, aviso resuelto.

⭐ **La lección:** cuando "no me deja hacer nada" afecta a **varias acciones no relacionadas**
(renombrar Y mover), mirar **facturación** antes que permisos.

### Las tarjetas del pipeline mostraban `Lead #23325167` en vez del cliente

El nombre vive en el **contacto**; el número, en el **lead** — y Kommo bautiza `Lead #NNNNN` a todo
lo que crea automáticamente. Por eso en `Leads Entrantes` se veían nombres y al avanzar desaparecían.

**Arreglo, sin una línea de código:** `…` → **Editar el diseño de la tarjeta** → el campo grande
pasó de *"Nombre del lead"* a **"Contacto: Nombre"**, y el `gclid` de la segunda fila a
**"Contacto: Teléfono"**.

Efecto lateral útil: **ahora se ve el canal de un vistazo.** Tarjeta con teléfono = entró por
WhatsApp; tarjeta en blanco = Instagram/Facebook, que no traen número.

### Las 5 fuentes de leads quedaron con nombre propio

`Whu Dragon Chino` ×4 e `Importador de China` → **Instagram Messenger · Comentarios Instagram ·
Messenger Facebook · Comentarios Facebook · WhatsApp**.

🔴 **Cómo se renombra** (costó tres intentos): hover sobre la tarjeta → aparece un **✏️ lápiz** a la
derecha → clic **en el lápiz** → escribir → **`Tab`**.
- El **✓ verde no confirma: revierte** al valor anterior.
- Un clic **sobre el nombre** abre el panel de integración, que tiene **"Desinstalar"** al lado.
- `Guardar` arriba a la derecha al final, y **recargar para verificar**.

### La respuesta automática a comentarios de Instagram (en Meta)

Creada y activa: **"Respuesta a comentario - Comentarios · info y precio"**. Detalle y textos en
[`instagram-entrada.md`](instagram-entrada.md).

## 📊 La foto de la cuenta

### Plan y consumo

| | |
|---|---|
| Plan | **Pro**, US$45 por licencia/mes · **1 licencia** · renueva **29.08.2026** |
| Créditos de IA | paquete **Inicial**: 5.000/mes por **US$29** |
| Recarga extra | 5.000 comprados el 10-ago — **vencen el 29.08 y NO se renuevan solos** |
| Saldo | **7.659 / 12.250** usados (2.250 incluidos por licencia + 10.000 de complemento) |

**Escalones disponibles:** Inicial 5.000 (US$29) · **Crecimiento 50.000 (US$99)** · Escala 100.000
(US$199) · Escala Personalizado. **No hay nada entre 5.000 y 50.000.**

⭐ **El desglose es lo que importa** (`Facturación → Uso → Gestionar créditos`):

| Función | Créditos | Qué es |
|---|---|---|
| **Agente de IA** | **5.183** | atención real a clientes — 68% |
| **Vista previa del agente** | **1.345** | 🔴 pruebas internas — 17,5% |
| **Respuestas sugeridas con IA** | **966** | el equipo pidiendo sugerencias — 12,6% |
| Reescritor y resúmenes · Copilot · Fuentes | 144 | |

⚠️ **Sólo el 68% del gasto fue atender clientes.** Cualquier proyección que no separe estas líneas
sale inflada — pasó: una primera estimación dio 54.000/mes y el número real ronda **15.000-18.000**.

⚠️ **Las pruebas cuestan.** 1.345 créditos son ~50-70 respuestas del panel de prueba.
⚠️ **"Respuestas sugeridas" sale del mismo pozo** que el agente.

### Los 4 agentes

Todos **activos**, todos sobre el canal **WhatsApp** (`Importador de China`). **Ninguno cubre
Instagram ni Facebook.**

| Agente | id | Etapas | Límite msj | Límite créditos | Notifica al transferir |
|---|---|---|---|---|---|
| **Asistente de ventas** (Entrada) | `326244` | Leads Entrantes · **Contacto inicial** · Ventas Perdidos | 10 | — | **DTD CARGO** |
| **Cotizador** | `350054` | Estimado enviado · Negociación | 20 | 300 | ✅ **DTD CARGO** *(corregido 10-ago)* |
| **Reenganche** | `350032` | Recontacto | 20 | 300 | ✅ **DTD CARGO** *(corregido 10-ago)* |
| **Post-venta** | `28571` | Logrado con éxito | 🔴 **sin límite** | 🔴 **sin límite** | *(no aplica)* |

🟢 **Corregido el 2026-08-10:** el Cotizador y el Reenganche estaban en **"No notificar a nadie"** —
transferían a un humano y la conversación quedaba esperando sin que nadie se enterara, en
`Estimado enviado`, `Negociación` y `Recontacto`. Ambos pasaron a **DTD CARGO** y se verificó
recargando.

🔴 **El Post-venta no tiene ningún techo.** Es el único con `Límite de mensajes` y `Límite de
créditos` desactivados, y atiende `Logrado con éxito`, donde hay cientos de leads ganados. Con el
saldo apretado es el que más puede sangrar sin que se note. Ponerle límite es una decisión de
negocio (afecta a clientes que ya compraron), por eso queda en el checklist y no se tocó.

### Volumen (2026-08-10)

**471 leads** · 436 en `Contacto inicial` · 15 `Recontacto` · **0 `Estimado enviado`** · 10
`Negociación`. Presupuesto total del tablero: **$0**.

**Origen** (contactos nuevos, 30 días): **154 WhatsApp** · **72 Instagram/Facebook (32%)** · 226 total.

## 🔴 2026-10-15 · Otra vez sin rojo, y los que vuelven no llegan a Recontacto

> Medido con la sesión de Sam, solo lectura, por la API v4 y el panel. Detalle y
> cifras en [SDD-0535](../specs/0535-crm-kommo-mensaje-entrante/spec.md).

**El rojo:** los **4 agentes de IA están apagados** (`Agente de IA`, interruptor sin
marcar en los 4). La última tarea del robot y el último bloque de mensajes de bots
son del **2026-09-24**. El paquete de créditos de US$99 figura **Caducado**
(última renovación 29-08, renovación automática desactivada) y los **15 Salesbots
están apagados**, incluidos los 4 «Ping 23 h». Quién los apagó: **NO VERIFICADO**.
Es la misma causa de fondo que el 25-ago: sin agentes corriendo no hay tarea, y sin
tarea no hay rojo. **No es WhatsApp:** los mensajes siguen entrando todos los días.

**Recontacto:** cuando alguien con el trato en `Ventas Perdidos` vuelve a escribir,
**Kommo no crea un trato nuevo**: cuelga el mensaje del trato cerrado (57 casos en
30 días, ninguno con trato posterior). El enrutador de SDD-0244 espera un
`leads[add]` que nunca llega. Lo arregla SDD-0535 desde el webhook: perdido →
Recontacto + tarea vencida; ganado → solo la tarea.

### 🟢 Mismo día · Los 4 agentes encendidos otra vez (13:19-13:30 UTC)

Con el OK nominal de Sam («a los 4 agentes ponles canal WhatsApp con las etapas de
agosto … guarda y enciéndelos»). ⭐ **Apagados, los agentes habían perdido el canal
y las etapas** (Ajustes → «Lanzar agente de IA» vacío): encenderlos así no habría
hecho nada. Se configuró cada uno, se guardó y se activó:

| Agente | Canal | Etapas |
|---|---|---|
| Asistente de ventas (`326244`) | WhatsApp | Leads Entrantes · Contacto inicial · Ventas Perdidos |
| Cotizador (`350054`) | WhatsApp | Estimado enviado · Negociación |
| Reenganche (`350032`) | WhatsApp | Recontacto |
| Atención al cliente de comercio minorista (`28571`, el de post-venta) | WhatsApp | Logrado con éxito |

Verificado recargando: los 4 activos, con su disparador «En un mensaje recibido →
Activar agente de IA» de vuelta en el embudo y la acción «Agregar tarea · Ahora ·
Responder al cliente» en los 4. **Prueba real:** un mensaje a las 13:33:54 UTC; el
robot respondió y creó 3 tareas «Responder al cliente» que vencen a los 5 minutos.

⚠️ **Créditos:** 48 de 2.250 usados a las 13:35 UTC. Al ritmo de agosto (15.000 a
18.000 por mes) alcanzan para unos 4 días (inferido, no medido). Cuando se acaben,
los agentes callan y el rojo se vuelve a apagar: lo sostiene el paquete
Crecimiento (US$99), hoy caducado. Los 4 Salesbots «Ping 23 h» siguen apagados.

## 🔴 Por qué no llegan las alertas rojas

**No es un bug, y no tenía que ver con los dos usuarios.**

Las notificaciones del perfil están **bien**: la fila "Bandeja de entrada" tiene ✓ en Móvil y
Navegador, igual que todas.

⭐ **El rojo de las tarjetas es el semáforo de TAREAS, no de mensajes.** Se verificó ampliando las
tarjetas: las que están en rojo dicen **`1d`** — tarea vencida hace 1 día. Las demás dicen
**"No hay tareas"** y se quedan grises para siempre, aunque el cliente escriba cinco veces.

Y **58 de 63 leads nuevos no tienen ninguna tarea**, porque hoy sólo se crean en dos casos: cuando el
agente transfiere porque el cliente **pide un humano** o porque **confirma que quiere comprar**
(pestaña *Acciones* del agente, tarea de 15 min).

### 🟢 Resuelto el 2026-08-11 — la tarea automática se crea DESDE EL AGENTE

El disparador del pipeline está bloqueado (ver abajo), pero **la misma acción existe dentro del
agente**, en la pestaña **Acciones**, y ahí sí se guarda.

⭐ **La llave es la condición `El mensaje es recibido en horas específicas`, cuyo valor por defecto
es `Siempre`** — o sea, **cada mensaje entrante**, sin restricción de horario. Es la única condición
del catálogo que se dispara con todos los mensajes; las demás van por intención (*el cliente quiere*,
*pregunta sobre*, *el sentimiento es*…).

Quedó configurada **en los 4 agentes**, verificada recargando:

```
Cuando  El mensaje es recibido en horas específicas: Siempre
Hacer   Agregar tarea · Fecha límite: Ahora · Usuario responsable: Responsable actual
        Tipo: Seguimiento · Comentario: "Responder al cliente"
```

> 🔴 **DESACTUALIZADO — leer primero el bloque `2026-08-25` de abajo.** Lo que
> sigue describe la decisión del 11-ago. El plazo real hoy es **5 minutos**, y
> la causa de que esto llevara semanas sin funcionar no era el plazo.

⭐ **El plazo es `Ahora`, no 2 horas** (corregido el 11-ago tras probarlo). Con 2 h la tarjeta se
quedaba verde dos horas y **el rojo llegaba cuando ya no servía**. Con `Ahora` la tarea nace vencida:
**la tarjeta se pone roja apenas el cliente escribe, y se apaga cuando alguien la completa.** O sea,
rojo = *sin atender*, que es la semántica que se buscaba.

Cubre todo el pipeline, porque entre los 4 agentes están las 7 etapas.

### El pipeline, ordenado por quién escribió último

`…` → **Ordenar → Por último mensaje**. Sube al tope de cada columna a quien habló más reciente, para
no depender del Inbox de chat. Aplicado el 11-ago.

⚠️ **Ojo al elegir la acción:** el desplegable de *Hacer* viene en **"Transferir al usuario"**, y
dejarlo así haría que el agente transfiriera en **cada** mensaje. Hay que cambiarlo a **"Agregar
tarea"** — el clic tiene que caer sobre el texto de la opción, no al borde, o el desplegable se
cierra sin aplicar y parece que no pasó nada.

### 🟢 2026-08-25 · Por qué no salía el rojo: NO era la configuración, era el SALDO

El founder preguntó por qué el `Inbox de chat` marca los no leídos en rojo y las
tarjetas del pipeline no. Medido ese día, en este orden:

| Qué se midió | Resultado |
|---|---|
| Tareas abiertas en toda la cuenta (vía `GET /api/v4/tasks`, espejo SDD-0288) | **0** |
| Eventos `task[add]` en el webhook, antes de recargar créditos | **0** de 63 formas capturadas |
| Eventos `task[add]` después de recargar créditos + 1 mensaje de prueba | **aparecen** |

⭐ **La acción del 11-ago nunca estuvo desarmada: estaba correcta y muda.** Vive
DENTRO del agente, y un agente sin créditos no corre. Lo que parecía un problema
de visualización del pipeline era plata. Antes de volver a tocar la
configuración de un agente, **mirar `Facturación → Uso`**.

**El plazo quedó en 5 MINUTOS, no en `Ahora`** (medido sobre la tarea real:
creada 15:32:59, vence 15:37:58). Decisión del founder: **se queda en 5 min** —
si el agente resuelve la conversación en ese rato, la tarea se completa sola y
nunca aparece un rojo que nadie tenía que atender. Cinco minutos filtran ruido;
las 2 horas del problema original llegaban tarde.

#### 🔴 MEDIDO 2 h después: el colchón de 5 minutos NO filtra nada

```
15:00    1 tarea creada  ·  0 completadas
16:00   16 tareas creadas ·  0 completadas   ← 9 leads distintos
─────────────────────────────────────────────
        17 abiertas · 17 vencidas · 0 completadas
```

**Cero completadas.** El razonamiento con el que se defendió el plazo de 5 min
—"si el agente resuelve la conversación en ese rato, la tarea se cierra sola y
no aparece un rojo innecesario"— **es falso**: nadie las completa, ni el agente
ni una persona. El colchón sólo retrasa el rojo cinco minutos.

⭐ **Pero el hallazgo real es otro, y es más grande: las tareas se ACUMULAN
porque nadie las cierra.** Una tarea de Kommo sólo se apaga cuando alguien la
marca hecha. En 2 h: **10 leads en rojo de ~112 activos ≈ 9%**. La alarma del
11-ago ("va a quedar todo rojo") todavía no se cumple, pero la pendiente es
1 → 17 sin una sola completada.

**Decisión del founder (2026-08-25): el plazo se queda en 5 minutos.** Pasar a
`Ahora` no arregla nada de esto —adelanta el rojo cinco minutos y ya— y costaría
tocar los cuatro agentes para nada. **El problema no es de configuración, es de
hábito del equipo**: si nadie completa tareas, el rojo de Kommo se satura solo.

⏳ **Pendiente, con fecha:** volver a medir **el 2026-08-26** en régimen normal.
Las 16 de las 16:00 son en buena parte el arranque tras la recarga de créditos,
con los agentes poniéndose al día — **el ritmo sostenido no está medido**.

```sql
select count(*) filter (where is_completed = false)                           as abiertas,
       count(*) filter (where is_completed = false and complete_till < now()) as vencidas
  from public.kommo_tasks;   -- requiere una corrida de kommo-sync
```

⚠️ **Ojo con el método:** contar eventos `task[...]` en los logs del webhook
**NO** sirve para esto — incluye altas y modificaciones de la MISMA tarea. El
2026-08-25 se leyeron 27 eventos y se dio una alarma de "el tablero va a quedar
rojo entero" que era falsa: en el espejo había **1** tarea abierta. El contador
de eventos no es el contador de tareas.

⚠️ **Pendiente de medir (11-ago, sin cerrar):** con ~16 leads/día habrá mucho rojo. Si el tablero queda rojo
permanentemente el indicador pierde valor y habrá que subir el plazo. La decisión se toma con datos,
en unos días, no antes.

🔴 **Limitación que hay que tener presente: la acción vive DENTRO del agente**, y los 4 agentes
cubren **sólo el canal de WhatsApp**. Los mensajes de **Instagram y Facebook no crean tarea y no se
ponen rojos** — ese es el 32% de la captación. Cubrirlos exige sumarle el canal a un agente, y eso
consume créditos.

🔴 **Y el botón de arriba a la derecha cambia según el contexto.** Sin cambios pendientes dice
**"Desactivar agente"**; con cambios, **"Guardar"**. Están en la misma coordenada: hacer clic a
ciegas ahí abrió el diálogo *"¿Desactivar tu agente de IA?"* en producción. **Verificar el rótulo
antes de cada clic.**

## 🔴 El bloqueo: "Cannot run two different agents in the same status"

Kommo **rechaza cualquier disparador nuevo** en las etapas declaradas por un agente. Pasó **dos
veces** en `Contacto inicial`: con *Detener agente de IA* y con *Agregar tarea* — y la segunda ni
siquiera involucraba un agente.

**No hay conflicto real de configuración.** Se verificaron las etapas de cada agente una por una y
**no se solapan**:

```
Entrada    → Leads Entrantes · Contacto inicial · Ventas Perdidos
Cotizador  → Estimado enviado · Negociación
```

⭐ **Dónde se declaran las etapas:** en el agente, pestaña **Ajustes → "Lanzar agente de IA"** — no
en el pipeline. La "banda ancha" que se dibuja debajo de las columnas **es el reflejo de eso**, no
una regla editable aparte. Por eso la pantalla del pipeline no deja tocar esas etapas.

⚠️ **Consecuencia:** las automatizaciones de `Leads Entrantes`, `Contacto inicial` y `Ventas
Perdidos` **no se editan desde el pipeline** mientras el agente de Entrada las cubra.

⭐ **La vía soportada** está en la misma pantalla del agente: **"Etapas en las que el agente de IA
deja de responder"** → `+ Añadir condición de parada`. Kommo avisa que *"también se añadirá como
disparador en las automatizaciones del pipeline"* — o sea que **ése** es el camino, y no el inverso.

🔴 **`Un usuario responde → Detener agente de IA` no existe en el pipeline.** El desplegable de
disparadores para esa acción trae **una sola opción**: *"cuando es movido a esta etapa"*.

## ✅ Checklist de pendientes

### Requieren al founder (dinero o decisión)

- [ ] 🔴 **Subir el paquete de créditos a Crecimiento (US$99/mes).** Quedan ~4.591 créditos; al ritmo
      medido se agotan **~8 días antes** de la renovación del 29-ago. El prorrateo del checkout
      marcaba **US$89**. ⚠️ Confirmar si Kommo permite **bajar** de paquete en la renovación.
- [ ] **Decidir el vencimiento y el alcance** de la tarea automática (se propuso 2 h en
      `Contacto inicial`) una vez resuelto el bloqueo de arriba.
- [ ] **Dejar de compartir el login.** Se vieron **5 sesiones activas** del usuario `DTD CARGO`
      (3 Chrome + 2 Android). Kommo va expulsando sesiones —pasó dos veces en una tarde— y no hay
      forma de saber quién hizo qué.

### Se pueden hacer sin gastar

- [x] 🟢 **Notificación de traspaso del Cotizador y del Reenganche** → **DTD CARGO** *(hecho 10-ago)*.
- [ ] **Decidir si el Post-venta lleva límite** de mensajes/créditos. Hoy no tiene ninguno.
- [x] 🟢 **Tarea automática al recibir mensaje** *(hecho 11-ago · **revivida el 25-ago al recargar créditos**; plazo real: **5 min**, no 2 h ni `Ahora`)* — en los 4 agentes, vía la acción
      `El mensaje es recibido en horas específicas: Siempre → Agregar tarea (2 h)`. Es lo que
      enciende las alertas rojas. ⚠️ Falta **medir en unos días** si 2 h es el plazo correcto.
- [x] 🟢 ~~Reasignar los 3 leads de Sergio Quevedo~~ — **se resolvió solo**: al desactivar al usuario,
      Kommo reasignó sus leads. Verificado: Sergio en **0** (la API devuelve `204`) y DTD CARGO pasó
      de 3.125 a **3.130**.
- [ ] **Los 63 leads del apagón**: 58 sin tarea de seguimiento, 18 ya en `Ventas Perdidos`.
- [ ] **Renombrar el widget "Tinción no es un leads acti…"** — error de tipeo de quien lo instaló.
- [ ] **Avisar al equipo** que el panel de pruebas y "Respuestas sugeridas" consumen del mismo saldo.

### Desarrollo (SDD, sesión aparte)

### 🔴 El Shipping Mark: los dos campos YA estaban puestos — y aun así no escribe nada (medido 2026-08-11)

⚠️ **Corrige lo que decía esta misma sección el 11-ago por la mañana.** Decía que faltaba "sólo
elegir dos desplegables en `/studio/kommo`". Se midió contra la base de producción: **los dos
campos ya están guardados**, y elegirlos **no habría encendido nada**, porque el problema está
tres pasos más abajo.

| Dónde | Campo en Kommo | id | En `kommo_connections` |
|---|---|---|---|
| **Lead** | `Shipping Mark - j102` | **1570535** | `markbox_field_id` = **1570535** ✅ |
| **Contacto** | `Shipping Mark` | **1570723** | `markbox_contact_field_id` = **1570723** ✅ |

⭐ **El que importa para "reconocer al cliente que vuelve" es el del CONTACTO** (SDD-0244 rebanada B).
El del lead *"se lo lleva el trato al cerrarse"*; el del contacto sobrevive. Y la tarjeta del
pipeline ya muestra `Contacto: Shipping Mark` en su primera fila — o sea que **el día que se llene,
aparece sin tocar nada más**. Eso sigue siendo cierto.

#### La cadena completa, y dónde está cortada

```
① convertLeadToClientAction ──┐
   (Studio: convertir lead)   │
                              ├──► ② kommo_writeback_outbox ──► ③ drenaje ──► ④ PATCH a Kommo
② routeNewLeads (webhook) ────┘
   (cliente que vuelve)
```

| # | Eslabón | Estado medido | Evidencia |
|---|---|---|---|
| ① | Conversión desde el Studio | **nunca corrió** | **0 de 442** clientes tienen `kommo_lead_id` |
| ① | Enrutador del webhook | **corre, 0 aciertos** | 117 leads nuevos desde el 04-ago; `stage_map.recontacto` sí está puesto |
| ② | La cola | **vacía, siempre estuvo** | `kommo_writeback_outbox` = **0 filas** de cualquier `op` |
| ③ | El drenaje | 🟢 **programado el 11-ago** | `cron.job` #3 `kommo-writeback-drain-dtd`, `*/15 * * * *`, `active` |
| ④ | La escritura | 🟢 **abierta el 11-ago** | `writeback_enabled=true` · `writeback_dry_run=false` (16:21 UTC) |

⭐ **Los pasos 3 y 5 del runbook nunca se ejecutaron.**
[`deploy-kommo-writeback.md`](../runbooks/deploy-kommo-writeback.md) pide programar el cron del
drenaje (Paso 3) y recién después apagar el dry-run (Paso 5). El único `writeback_dryrun` de
`sync_logs` es del **2026-06-20** — hace casi dos meses. Nadie drenó nada desde entonces.

⚠️ **Conclusión: el Shipping Mark nunca llegó a Kommo, ni una vez.** No por los desplegables —
esos ya estaban— sino porque nadie drenaba la cola y, aun drenándola, el gate está en ensayo.

#### 🟢 Paso 3 hecho y VERIFICADO (2026-08-11)

Se programó el cron del drenaje con el OK del founder:

```sql
select cron.schedule('kommo-writeback-drain-dtd', '*/15 * * * *',
  $job$select public.kommo_run_writeback_drain();$job$);
```

⭐ **La verificación no fue mirar que el `INSERT` devolviera un id.** La función **no tiene retorno
temprano con la cola vacía**: cada corrida escribe una fila en `sync_logs` pase lo que pase. O sea
que el primer tick es una prueba que **puede salir roja** — si el cron no alcanza a la función (llave
de cron mala, auth, token de Vault), no aparece nada.

Apareció: **`writeback_dryrun · ok · 15:45:01 UTC · records_fetched=0`**. Eso deja probada la cadena
completa **pg_cron → `kommo_run_writeback_drain()` → Edge Function → auth → token de Vault →
`sync_logs`**. Lo único que falta es que haya algo en la cola y que el gate deje escribir.

⚠️ **Ojo con el orden a partir de acá.** Con dry-run encendido el drenaje **consume** las filas: las
marca `skipped`, no las deja pendientes. Si encolas una prueba ahora, el cron se la come en ≤15 min y
apagar el dry-run después **no la reenvía** — hay que volver a encolar.

#### El espejo sí está sano (no confundir una cosa con la otra)

`webhook_leads` **11.124 corridas ok** (la última hoy 15:28) y `webhook_contacts` **699 ok**, contra
**8 errores** en total — caídas intermitentes de HTTP/2 contra `dtdcargo.kommo.com`, 0,07%. El
webhook **no es el problema**; espeja bien. Lo que no se ejecuta es el write-back.

⚠️ **El universo real son 442 clientes, no "3.000+".** El 3.125/3.130 que aparece más arriba en este
documento son **leads asignados al usuario DTD CARGO en Kommo**, que es otra cosa. De los 442: **32**
tienen `kommo_contact_id` y **0** tienen `kommo_lead_id`.

- [x] 🟢 ~~Cargar `markbox_field_id` y `markbox_contact_field_id`~~ — **ya estaban puestos**
      (1570535 y 1570723). Verificado contra `kommo_connections` el 11-ago.
- [x] 🟢 ~~Programar el drenaje de la cola~~ (Paso 3) — **hecho y verificado el 11-ago**: `cron.job`
      #3 `kommo-writeback-drain-dtd`, `*/15 * * * *`, y el primer tick logueó `writeback_dryrun · ok`
      a las 15:45:01 UTC. La Edge Function ya estaba desplegada (v5 `ACTIVE`, Paso 2).
- [x] 🟢 ~~Apagar el dry-run~~ (Paso 5) — **hecho el 11-ago 16:21 UTC** con el OK del founder:
      `writeback_enabled=true` · `writeback_dry_run=false`. Verificado releyendo la fila.
      **Rollback de una línea** si hace falta:
      ```sql
      update public.kommo_connections set writeback_dry_run = true
        where tenant_id = '4ede88a0-b9c4-49ff-962b-e5a5014776e6';
      ```
- [ ] 🔴 ⭐ **Verificar E2E — es lo único que queda, y necesita al founder.** El write-back ya está
      LIVE pero **todavía no escribió nada**, porque la cola está vacía. Hace falta encolar algo:
      1. Entrar a `/studio/kommo` con la cuenta **ADMIN** del Studio *(en la sesión del 11-ago el
         navegador tenía sesión de un cliente de prueba, DTD-9887, y `/studio/kommo` rebotaba a
         `/portal`)*.
      2. Convertir un lead de prueba a cliente → encola un `patch_lead`.
      3. En ≤15 min el cron lo drena. Mirar el trato en Kommo y `kommo_writeback_outbox`:
         `status='sent'` = escribió · `status='error'` tras 5 intentos = ver el punto de abajo.
      ⚠️ Eso valida el campo del **lead**, no el del contacto: el del contacto lo encola **sólo**
      `routeNewLeads` cuando un cliente que ya existe abre un trato nuevo (0 enganches en 117 leads
      hasta ahora).
- [ ] ⚠️ **Vigilar el primer PATCH real** — se destapa la pregunta abierta #4 del SDD-0062: si el
      token de Vault es de **sólo-lectura**, el `PATCH` devuelve **401**, el drenaje reintenta 5
      veces y deja la fila en `status='error'` con el detalle. Ahí habría que regenerar un token de
      Kommo con permiso de escritura. ⚠️ **NO tocar la "Clave secreta" de la integración** —
      invalida el token de larga duración.
- [ ] **Decidir el backfill de los clientes viejos** (decisión del founder, no está construido).
      El universo real es **442 clientes**, no 3.000+. Pero de esos, **0 tienen `kommo_lead_id`** y
      sólo **32 tienen `kommo_contact_id`** — o sea que hoy un backfill sólo podría marcar a esos 32;
      para los otros 410 no hay contra qué escribir sin cruzarlos antes por teléfono (256 lo tienen).
      ⭐ **Por eso el backfill no es el primer paso, es el tercero:** primero que la cadena escriba
      (drenaje + dry-run apagado), después medir cuántos clientes que vuelven engancha el enrutador
      solo, y recién ahí decidir si vale un SDD para los que queden fríos.
- [ ] **Extender el write-back al `name` del lead.** El mismo `PATCH` acepta `name`; escribir algo
      como `María Rodríguez — DTD-9054` dejaría cliente y Shipping Mark en la tarjeta. Hoy el nombre
      se resuelve por la vista (Contacto: Nombre), que funciona pero depende de que el contacto tenga
      nombre — los de Instagram muchas veces no lo traen.

## Cómo entrar y medir (para no repetir el camino)

- Extensión de Chrome con el founder logueado → `dtdcargo.kommo.com`.
- ⭐ **`/api/v4/*` responde con la cookie de sesión** (leads, contactos, usuarios, pipelines).
  `/ajax/v4/contacts` y `/ajax/v4/leads` dan **404** — la que sirve es `/api/v4/`.
  `/ajax/v4/bots` sí funciona (Salesbots).
- **No hay endpoint de difusiones ni de agentes**: eso se mira por UI.
- ⚠️ Los conteos de leads por responsable requieren **paginar**: `_total_items` no viene en `/leads`.

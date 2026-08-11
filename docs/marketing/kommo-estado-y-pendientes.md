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
| **Cotizador** | `350054` | Estimado enviado · Negociación | 20 | **300** | 🔴 **No notificar a nadie** |
| **Reenganche** | `350032` | Recontacto | — | — | — |
| **Post-venta** | `28571` | Logrado con éxito | — | — | — |

🔴 **El Cotizador transfiere a un humano y no avisa a nadie.** En `Estimado enviado` y `Negociación`,
cuando el agente se rinde, la conversación queda esperando sin que nadie lo sepa.

### Volumen (2026-08-10)

**471 leads** · 436 en `Contacto inicial` · 15 `Recontacto` · **0 `Estimado enviado`** · 10
`Negociación`. Presupuesto total del tablero: **$0**.

**Origen** (contactos nuevos, 30 días): **154 WhatsApp** · **72 Instagram/Facebook (32%)** · 226 total.

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

**Lo que falta:** una tarea automática al recibir un mensaje. 🔴 **Y no se pudo crear** — ver abajo.

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

- [ ] 🔴 **Arreglar la notificación del Cotizador**: pasar *"No notificar a nadie"* a **DTD CARGO**,
      como el agente de Entrada. Hoy transfiere al vacío en `Estimado enviado` y `Negociación`.
- [ ] 🔴 **Tarea automática al recibir mensaje** — vía `+ Añadir condición de parada` en el agente, o
      escribiendo a soporte de Kommo por el bloqueo. Es lo que enciende las alertas rojas.
- [ ] **Reasignar los 3 leads de Sergio Quevedo** a DTD CARGO (quedaron con responsable inactivo).
- [ ] **Los 63 leads del apagón**: 58 sin tarea de seguimiento, 18 ya en `Ventas Perdidos`.
- [ ] **Renombrar el widget "Tinción no es un leads acti…"** — error de tipeo de quien lo instaló.
- [ ] **Avisar al equipo** que el panel de pruebas y "Respuestas sugeridas" consumen del mismo saldo.

### Desarrollo (SDD, sesión aparte)

- [ ] ⭐ **Activar el write-back del MARKBOX → Kommo (SDD-0086).** **Ya está construido**:
      `lib/studio/kommo-writeback.ts` → `buildMarkboxPatchPayload()` · `queueMarkboxWriteback()`,
      que resuelven `markbox → clients.kommo_lead_id` y hacen `PATCH /api/v4/leads/{id}`.
      Falta **configuración, no código**: crear/identificar el campo, cargar
      `kommo_connections.markbox_field_id` y encender el doble gate (`writeback_enabled` +
      `writeback_dry_run`). Runbook: [`../runbooks/deploy-kommo-writeback.md`](../runbooks/deploy-kommo-writeback.md).
      ✅ El campo **Shipping Mark ya existe** en Kommo y **ya tiene su lugar en la tarjeta** — está
      vacío sólo porque nadie lo llena.
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

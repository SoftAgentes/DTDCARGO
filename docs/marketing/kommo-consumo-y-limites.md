# Consumo de créditos del agente de IA — la medición y el freno

> **Por qué existe:** el plan de Kommo se agotó **dos veces en una semana** y los cuatro agentes
> quedaron mudos con leads entrando. Este archivo tiene el número real, de dónde sale, y qué se
> cambió el **2026-08-13** para que deje de pasar.

## Lo que pasó, en fechas

| Fecha | Créditos | Estado |
|---|---|---|
| 06-ago | 2.380 / 7.250 | operando |
| 07-ago | **7.281 / 7.250** | 🔴 agotado — los 4 agentes mudos |
| *(se sube el plan a 12.250)* | | |
| 11-ago | **12.222 / 12.250** | 🔴 agotado otra vez |
| 13-ago | 12.222 / 12.250 | 🔴 **dos días sin contestarle a nadie** |

**Subir el plan de 7.250 a 12.250 compró cuatro días.** No era un problema de saldo.

## El número que faltaba: cuánto da el presupuesto por lead

Medido el 2026-08-13 contra la API (`/api/v4/leads?filter[created_at][from]=…`):

| | |
|---|---|
| Leads últimos 7 días | **107** → 15,3/día → **~460/mes** |
| Plan | **12.250** créditos/mes |
| Costo por respuesta *(observado en el panel de prueba: 9 · 10 · 16 · 17 · 22)* | **~15** |
| **Presupuesto por lead** | **~27 créditos ≈ menos de 2 respuestas** |

⭐ **Ese es el techo real, y no se negocia con más saldo:** con ~460 leads al mes, cualquier
configuración que permita más de ~2 respuestas por lead agota el plan antes de fin de mes. La
pregunta no es "cuánto recargamos" sino "cuántas respuestas por lead".

## 🔴 La causa: el límite venía altísimo y nadie lo miró

Kommo tiene una sección **`Ajustes → Límites de conversación`** (marcada `Nuevo`), y los cuatro
agentes traían valores de fábrica:

| Agente | id | `Límite de mensajes` antes | ahora |
|---|---|---|---|
| DTD Cargo asistente de ventas (Entrada) | `326244` | 10 | **2** |
| DTD Cargo Cotizador | `350054` | **20** | **2** |
| DTD Cargo Reenganche | `350032` | **20** | **2** |
| Atención al cliente (Post-venta) | `28571` | *(apagado)* | **2** |

**Con el límite en 20, un solo lead conversador se comía ~400 créditos** — el 3% del plan mensual en
una conversación. Con 2 el techo por lead queda en ~30, que es justo lo que da el presupuesto.

✅ **Los cuatro quedaron en 2, verificados recargando la página** (no basta con que desaparezca el
botón `Guardar`).

## ⭐ El mismo ajuste resuelve el problema del humano pisado

Kommo lo dice en la propia pantalla:

> *"Cuando se alcance un límite, la conversación **se transferirá al usuario** y **se omitirán todas
> las demás acciones del agente**."*

O sea que al llegar a la 2ª respuesta el agente **transfiere y sale**. No es que se calle un rato: se
va de la conversación. Ése era el otro dolor del founder — *"cuando el humano quiere atender, el bot
sigue contestando en automático"*— y se arregla con el mismo campo.

📌 Antes se había buscado esto como automatización de embudo (`Un usuario responde → Detener agente
de IA`) y **no existe**: ese disparador sólo ofrece *"cuando se crea en esta etapa"*. El límite de
mensajes es la vía que sí hay.

## ⛔ Pendiente: el ping de las 23 horas (Salesbot, NO el agente de IA)

**El problema:** WhatsApp cierra la ventana a las 24 h. Si el cliente no escribe, se pierde el canal.

**La decisión de arquitectura, y es la que importa:** el ping **no lo manda el agente de IA**.

- Es siempre el mismo mensaje — no necesita pensar.
- Si lo mandara la IA, **gastaría crédito y contaría contra el límite de 2**. Con ~460 leads/mes y la
  mayoría quedando en silencio, son **~5.000 créditos/mes gastados en gente que no contestó** —
  casi la mitad del plan, en el segmento más frío.
- Un **Salesbot** lo manda por **cero créditos de IA**.

⭐ **Regla general: la IA para conversar, el bot mecánico para recordar.**

### El mensaje aprobado

Se eligió el que pide una **corrección**, no un favor:

```
Voy a cerrar tu solicitud por ahora. ¿La cierro o todavía quieres traer tu mercancía?
```

**Por qué ése y no otro:** a la gente le cuesta iniciar, pero corregir algo que va a pasar es casi un
reflejo. Y es honesto — la solicitud sí se va a cerrar. Además califica solo: el que contesta
"todavía quiero" se identificó como vivo sin que nadie le pregunte nada más.

Las otras dos que se ofrecieron, por si se quiere rotar el mensaje:

| Variante | Resorte | Cuidado |
|---|---|---|
| *"¿Te aparto cupo en el próximo consolidado o lo dejamos para más adelante?"* | binaria, las dos puertas cómodas | la más suave, también la que menos califica |
| *"La tarifa sube el 4 de septiembre. ¿Tu carga sale antes o después de esa fecha?"* | fecha real (cron `rate-ddp-850-sep2026`) | ⚠️ **caduca el 4-sep**; después es mentira |

🔴 **Se descartaron a propósito las que inventan urgencia** (cupos falsos, "última oportunidad").
Además de deshonestas, el equipo después tiene que sostener la mentira en el chat.

⚠️ **Una sola vez, no una secuencia.** Un recordatorio se perdona; tres seguidos hacen que reporten
el número y ahí se pierde el canal entero, no un lead.

### ✅ Armado y disparando en producción (2026-08-13)

Salesbot **"Seguimiento antes de que cierre la ventana de 24 horas"**, creado desde la plantilla del
mismo nombre que ya trae Kommo. **A los pocos minutos de guardarlo había disparado 5 veces**, y se
verificó en el Inbox: cinco conversaciones a las 08:03 con el texto exacto, firmadas `Salesbot:`
(leads `#23331015` · `#23330181` · `#23330565` · `#23331029` · `#23309673`).

| Ajuste | Valor | Por qué |
|---|---|---|
| Disparador | `23 horas después del último mensaje **entrante**` | ⭐ **entrante = del cliente.** Si fuera desde nuestro último mensaje, le escribiría a alguien que acaba de escribirnos y no le hemos contestado |
| `Para todos los leads con` | Etapa ∈ {Leads Entrantes, Contacto inicial, Recontacto, Estimado enviado, Negociación} | 🔴 **lo más importante de toda la configuración** — ver abajo |
| Horas activas | Siempre | la ventana de 24 h es un plazo duro: restringir horario dejaría que se cierre |
| Paso 1 | mensaje al cliente | |
| Paso 2 | aviso interno al usuario responsable | viene de la plantilla; es gratis y útil |

🔴 **El campo de condición venía VACÍO, y así habría sido un desastre.** Sin condición, el bot le
escribe a *cualquier* lead — incluidos los **2.796 perdidos** y los **244 ganados**. Mandarle *"voy a
cerrar tu solicitud"* a alguien que ya te pagó es vergonzoso; un envío masivo a 2.796 perdidos es la
forma más rápida de que reporten el número y **se pierda el canal entero, no un lead**. Las dos etapas
terminales quedaron fuera.

*(Que dispararan **5** y no miles confirmó además que el disparador es un **momento** —justo al
cumplirse 23 h— y no un estado "lleva más de 23 h en silencio".)*

⚠️ **Lo que NO está verificado y hay que mirar en unos días:** si el cliente contesta y vuelve a
quedarse callado 23 h, **el bot debería volver a dispararse**. No se comprobó si Kommo deduplica.
Si un mismo lead recibe el mensaje dos o tres veces, hay que agregarle una etiqueta al dispararse y
excluir a los que ya la tienen. **Un recordatorio se perdona; tres seguidos hacen que te reporten.**

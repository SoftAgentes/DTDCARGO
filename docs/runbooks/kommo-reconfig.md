---
title: "Runbook — Reconfiguración de Kommo (CRM) para SDD-0062"
updated: 2026-08-05
confidencialidad: interno
related: ["0062","0043","0058"]
review-by: 2026-09-07
---

# Runbook — Reconfiguración de Kommo (CRM)

> Operación supervisada de la cuenta **`dtdcargo.kommo.com`** (cuenta `31589859`) para SDD-0062. Se opera vía la extensión de Chrome con el founder logueado y confirmando cada acción destructiva. **Read-only primero; nada destructivo sin OK explícito.**
>
> ⚠️ **`doortudoor.kommo.com` NO existe** — devuelve `x-error: Account not found`, que se lee como un 401 y manda a diagnosticar el token cuando el problema es el subdominio. Este runbook lo decía mal hasta el 2026-08-05.

## ✅ Estado actual del AI Agent (2026-08-05)

> Este bloque reemplaza los snapshots operativos anteriores. Las secciones fechadas más abajo se
> conservan sólo como historial y no deben usarse para decidir la configuración vigente.

**Agente "DTD Cargo asistente de ventas" (#326244) — activo en WhatsApp `Importador de China`.**
Está conectado en `Incoming leads`, `Contacto inicial` y `Recontacto`; no se observó activo en
`Estimado enviado` ni `Negociación`. Esta constatación fue **read-only**: no se activó, desactivó ni
guardó ninguna configuración durante la auditoría.

| Capa | Contenido | Dónde se cambia |
|---|---|---|
| **Persona** | 1.280 car. Prohíbe explícitamente "DDP", "prepago", "financiamiento" y "responsabilidad" | pestaña Personalidad |
| **Pautas** | **25** (tope de Kommo: 50 líneas × 300 car.) | pestaña Personalidad |
| **Acciones** | **6** (tope: 20) | pestaña Acciones |
| **Fuentes** | DOCX **v6** cargado (**34 subsecciones**) + Datos clave + Productos y servicios + Descripción del negocio | pestaña Fuentes |

La configuración observada tiene límite de **10 respuestas**, 6 acciones y 25 pautas. El dashboard
de los últimos 7 días mostraba actividad y uso en cero; eso describe esa ventana de medición, no
demuestra por sí solo que el agente nunca haya respondido.

El diseño vigente, la estrategia por etapa, el inventario de fuentes y la auditoría de los 11
Salesbots están en
[`docs/marketing/kommo-ia-fuente-conocimiento-pipeline.md`](../marketing/kommo-ia-fuente-conocimiento-pipeline.md).

### Salesbots heredados: decisión operativa vigente

Los 11 Salesbots revisados **no están aprobados para reutilizarse tal como están**. Varios contienen
marca, años, tarifas, tiempos, nombres de vendedores o flujos de captura desactualizados; además,
varios muestran sesiones activas sin terminar. La regla es: **cuarentena primero, borrado individual
después de cortar disparadores, mapear referencias y probar qué ocurre con las sesiones activas**.
No ejecutar borrado masivo.

### ⏱️ Una fuente recién subida NO responde de inmediato

Kommo **indexa la fuente en segundo plano y puede tardar hasta ~2 horas** (founder, 2026-08-05).
Mientras tanto el agente sigue contestando con la versión anterior.

**La trampa:** subes el arreglo, pruebas a los cinco minutos, sale el comportamiento viejo y
concluyes que el arreglo no sirve — cuando lo único que pasó es que todavía no indexó. Si vas a
verificar un cambio de contenido, **espera** o valida de otra forma.

**Cómo distinguir de dónde salió una respuesta:** el panel de prueba trae un desplegable
**"Fuentes utilizadas"** en cada mensaje. Y hay una pista de contenido — si la respuesta cita algo
textual que sólo existe en la versión nueva, ya indexó.

⚠️ **Al guardar una fuente de texto NO sale ningún toast y el modal se queda abierto.** Parece que
falló; no falló. La señal real está en la **columna TIPO de la lista**: pasa de `Texto` a
**`Actualizando`** mientras reindexa y vuelve a `Texto` al terminar. Confundió dos veces en la misma
sesión y llevó a re-guardar de más. **Verificá por la columna, no por el toast.**

⚠️ **Editar una Pauta por código no basta.** Si se inyecta el valor con el setter nativo de React, el
botón **Guardar ni siquiera aparece** y el cambio se pierde. Hay que **enfocar el campo de verdad y
escribir con teclas** (o al menos hacer `blur()` después) para que React lo marque sucio. Patrón que
funciona: `triple_click` para seleccionar todo → escribir el texto sin acentos → setter con la
versión acentuada → `blur` → aparece **Guardar**.

⚠️ **Las Pautas NO tienen este retraso**: son parte del prompt y aplican al instante. Por eso una
prueba puede pasar por la pauta y fallar por la fuente, o al revés. **Cuando pautas y fuente se
contradicen, gana la fuente** — verificado el 2026-08-05 con la dirección de la bodega en China: la
pauta decía "ofrece el registro primero" y el agente igual soltó la dirección completa porque la
sección 28 la traía abierta. Los arreglos de CONTENIDO van en la fuente; las Pautas son para
COMPORTAMIENTO.

### ⚠️ Las 3 fuentes de texto no están respaldadas

`Datos clave`, `Productos y servicios` y `Descripción del negocio` viven **sólo dentro de Kommo**.
No están en git: si alguien las edita o las borra no hay historial ni forma de recuperarlas. El DOCX
sí tiene respaldo (se genera desde `faq-knowledge-base.md`). **Pendiente:** bajarlas al repo.

### El traspaso a un humano — cómo funciona de verdad

Kommo trae un intent **nativo**: en una acción, `Cuando → El cliente quiere → **hablar con un agente
humano**`. No hay que escribir palabras clave ni adivinar sinónimos; el modelo clasifica la intención.
La acción es **`Transferir al usuario`**, con dos parámetros que importan:

- **`con` / `sin el permiso del cliente`** — "con permiso" hace que el agente pregunte antes. Para
  este disparador va **`sin`**: el cliente YA pidió una persona, volver a preguntarle molesta.
- **`con resumen de conversaciones`** — el asesor recibe el hilo resumido y el cliente no repite nada.

Hay además un **mensaje de traspaso** opcional que se le manda al cliente en ese momento.

Los tres disparadores de traspaso configurados hoy:

| Cuando | Permiso |
|---|---|
| El cliente quiere **hablar con un agente humano** | sin permiso (creado 2026-08-05) |
| El cliente confirma que **quiere comprar** | sin permiso |
| El **sentimiento** del cliente es frustrado o triste | sin permiso |

### El silencio: por qué NO se arregla con una Acción

Si el cliente pregunta algo que no está en Fuentes, el agente **no dice "no sé": no responde nada**.
Lo lógico sería una acción "cuando no encuentres información → transfiere". **No se puede**, y vale
la pena dejarlo escrito para que nadie vuelva a intentarlo:

1. **No existe un disparador de "no match".** Las condiciones disponibles son exactamente nueve:
   `El cliente quiere` · `Cada vez que el cliente pregunta sobre` · `El cliente pregunta por primera
   vez sobre` · `El sentimiento del cliente es` · `El cliente proporciona su` · `El mensaje entrante
   contiene` · `El cliente no responde desde hace` · `El formato de mensaje es` · `El mensaje es
   recibido en horas específicas`. Ninguna se dispara por ausencia de información.
2. **El tema de `pregunta sobre` es un selector cerrado, no texto libre** (disponibilidad · tiempo de
   entrega · precio · política de reembolso · estado del pedido · solución de problemas…). Si escribes
   un tema propio, el campo **revierte en silencio** al valor por defecto. *(Las acciones viejas sí
   tienen temas propios como "servicios de logística": quedaron de una versión anterior del builder o
   se cargaron por otra vía; hoy la UI no deja crearlos.)*

**Lo que sí funciona: una Pauta**, porque se evalúa en **cada** mensaje en vez de depender de que
matchee un tema. Es la pauta 25: *"Nunca dejes un mensaje sin responder. Si el dato no está en tus
fuentes, dilo con naturalidad… Quedarte callado es peor que no saber."*

**Y el arreglo de fondo sigue siendo el contenido:** cada tema sin política cerrada necesita su
sección de escalamiento **escrita** en la KB. Omitir un tema no produce un traspaso: produce un
cliente en visto.

## Snapshot histórico (en vivo, 2026-06-07 · read-only · ⚠️ desactualizado, ver arriba)

> Registro histórico. Las etapas, canales, fuentes y conexiones que siguen corresponden al
> 2026-06-07 y no representan el estado confirmado el 2026-08-05.

| Área | Estado real | Implicación |
|---|---|---|
| **Canal principal** | WhatsApp **8021 = API oficial** (fuente "WhatsApp API 8021") | Flows / plantillas / broadcasts / AI Agent **disponibles** en el número comercial |
| **Fuentes caídas** | 1 fuente WhatsApp en **"Error de conexión"** ("Door tu door Importad…") + **WeChat desconectado** | Posible pérdida de leads entrantes → reconectar (founder, credenciales) |
| **Otros canales** | Instagram (Whu Dragon Chino) + Facebook/Messenger conectados | El AI Agent hoy vive en Instagram |
| **AI Agent** | "DTD Cargo asistente de ventas" (#326244) **activo solo en Instagram** | Gap: NO cubre el WhatsApp del grueso de leads → lever #1 = extenderlo a WhatsApp 8021 |
| **3 IAs de Kommo** | **Kommo Copilot** [Beta] ON · **Respuesta sugerida** [Beta] ON · **Sugerencias de tareas** ON | Las sugeridas dependen de Fuentes de conocimiento |
| **Fuentes de conocimiento** | Ya cargadas: DOCX de **20 subsecciones** + 3 textos (Datos clave / Productos y servicios / Descripción del negocio) + 1 URL (home). **VECES USADAS = 0 en todas** | El conocimiento existe pero **nunca se usó** → el cuello es el **wiring** de la IA al flujo, no el contenido |
| **Dedup** | Control de duplicados **ON** | Bien |
| **Anti-blast** | Etapa "Atención al cliente" **sin automatizaciones de etapa**; el único automatismo del embudo está en "Leads entrantes" (Salesbot Asignar asesor + Activar AI Agent) | Bulk move/close de los 2.029 **no dispara mensajería** (re-verificar antes de cada bulk) |
| **Usuarios** | Solo **2 (ambos Administrador)**: DTD CARGO (dueño de 2.673 leads) + Sergio Quevedo Bermudez (2 leads) | **Reparto bloqueado** sin crear cuentas de asesores (decisión de negocio + costo/usuario) |
| **Embudo principal** | Etapas: Leads entrantes → Atención al cliente → Asesoría personalizada → Closed-Won/Lost | — |

### Hallazgo central
El conocimiento y la IA **ya existen** pero **no están enchufados al canal del grueso (WhatsApp 8021)** → por eso 0 cierres, 0 usos de la IA. El mayor leverage no es cargar más cosas, es **wiring** (extender el AI Agent a WhatsApp) + **Depurar** el cementerio + **reparto** (requiere asesores).

## Matriz de impacto (qué se rompe si borro/cambio)

| Operación | Qué se rompe | ¿Reversible? | Regla segura |
|---|---|---|---|
| Borrar **etapa** | Leads se reubican; automations del Digital Pipeline de esa etapa desaparecen; Salesbots por "entra a etapa X" quedan huérfanos | Config no; leads se mueven | Mover leads antes; **Closed-Won/Lost NO se borran (solo renombrar)** |
| Borrar/editar **Salesbot** | Referencias desde Digital Pipeline/botones rotas; 1 bot por conversación | No | Desconectar triggers; para editar hay que **reactivar** (desactivado = solo lectura) |
| Reparar **NPS/Cursos** | NPS dispara "al cerrar" → si se cierran 2.029 → blast | — | Trigger acotado; el bulk-close no debe disparar NPS a leads viejos |
| **Bulk** mover/cerrar | Entrar a etapa destino dispara sus automations → posible mensajería masiva (riesgo de ban) | Parcial | **Desactivar automations que envían mensajes ANTES del bulk**; por lotes |
| Crear automation | NO afecta leads ya presentes salvo tildar *"Apply to all leads already in this stage"* | Sí | Default seguro para el backlog |
| Borrar **custom field** | Borra TODA su data; bots/plantillas que lo usan se rompen | **No** | Exportar antes; nunca borrar EMAIL |

## Protocolo seguro
1. Snapshot read-only del estado actual (este documento) **antes de tocar**.
2. Backup: el **espejo en Supabase ya tiene los 2.675 leads** (SDD-0043); para historial de chat, exportar de Kommo si hace falta.
3. **Desactivar** automations que envían mensajes en la etapa destino (anti-blast).
4. **Probar en 1** elemento antes de masivo.
5. Bulk del backlog por **lotes**, confirmando con el founder.
6. Re-activar saneado + registrar en la bitácora.

## Bitácora de cambios
| Fecha | Acción | Por |
|---|---|---|
| 2026-06-07 | Snapshot read-only completo (sin cambios) | Claude (Chrome) |
| 2026-06-07 | **Añadida Fuente de conocimiento URL `https://dtdcargo.com`** (con subpáginas) → procesando crawl (~2h). Reversible (se puede borrar) | Claude (Chrome), OK founder |

## Acciones pendientes del snapshot 2026-06-07 — histórico, no ejecutar

> Esta lista quedó superada por la auditoría del 2026-08-05. Para el trabajo vigente usa el
> [blueprint integral](../marketing/kommo-ia-fuente-conocimiento-pipeline.md), especialmente sus
> secciones 16–18.

**Founder (credenciales / negocio):**
- Reconectar la fuente WhatsApp en "Error de conexión" (+ WeChat si se usa).
- Crear **cuentas de asesores** en Gestión de usuarios para habilitar el reparto.
- Decidir si se prende/paga el AI Agent como add-on de forma estable.

**Claude (con OK, vía Chrome):**
- **Extender el AI Agent al WhatsApp 8021** (hoy solo Instagram) — lever #1 (alto impacto: la IA respondería a clientes reales → probar antes).
- **Depurar** dormidos >180 días (1.752) en lotes (anti-blast verificado). **REGLA DURA: Depurar = cerrar el LEAD como "Perdido" (Closed-Lost), un cambio de etapa — JAMÁS borrar el CONTACTO ni su teléfono/email.** Los contactos quedan intactos en la lista (≈1.448 teléfonos, 149 emails) + respaldados en el espejo Supabase. Antes de cerrar: **analizar y segmentar** (email vs solo-teléfono vs categoría) para campañas de **email** (Resend) y **SMS** (canal a evaluar: costo + opt-in + entrega VE). El cierre del lead NO afecta esos números.
- Afinar instrucciones del AI Agent para Depurar + pedir/guardar email.

## Configuración del AI Agent "DTD Cargo asistente de ventas" (v2 · 2026-08-03)

> ⚠️ **Esto reemplaza el borrador de 2026-06-07**, que quedó desactualizado en tres cosas: ofrecía
> *"puerta a puerta DDP (Financiamiento 100%)"* —término **retirado por riesgo legal el
> 2026-06-09**—, citaba una regla de mínimo (`0,20 CBM`) que no existe en el código, y mandaba a
> `/calculadora`, que hoy es un 301.

### Antes de tocar nada: los límites reales de la plataforma

No son sugerencias, son el techo de Kommo. El diseño se hace **dentro** de esto:

| Campo | Límite duro |
|---|---|
| **Rol y personalidad (Persona)** | **1.500 caracteres** |
| **Guidelines** | **50 líneas × 300 caracteres por línea** |
| **Actions** | **20 por agente** · WHEN hasta 5 condiciones · DO hasta 5 acciones |
| Largo de respuesta | Short 100–200 car. · Medium 150–250 · Long 200–300 |
| Delay antes de responder | 1 s a 24 h (**default 600 s = 10 min**) |
| Sources | URL · PDF · DOC · DOCX · texto · **45 MB** · **100 fuentes** en plan pago |

Y dos comportamientos que condicionan todo:

- ⭐ **Si el agente no encuentra información relevante en sus Sources, NO RESPONDE.** No dice "no
  sé": se queda mudo. **Un hueco en la base de conocimiento es un cliente en visto.** Por eso la
  KB trae las secciones 29–33 redactadas como escalamiento y por eso existe el Action de fallback
  de abajo.
- ⭐ **Advertencia oficial de Kommo:** *"las instrucciones basadas en lógica de sistema no se
  interpretan correctamente y no deberían agregarse"*. **La lógica va en Actions, no en el prompt
  en lenguaje natural.**

### Las tres capas — qué va dónde

El error más común es meter precios en el prompt: ahí no tienen fecha de vigencia ni fuente
citable, y cambiarlos obliga a tocar el comportamiento del agente.

| Capa | Qué va | Dónde vive | Quién la cambia |
|---|---|---|---|
| **Hechos** | precios, plazos, rutas, qué incluye cada servicio, qué se puede enviar | **Sources** — el DOCX de [`faq-knowledge-base.md`](../specs/0062-crm-erp-cierres-automaticos/assets/faq-knowledge-base.md) | Operaciones |
| **Guion** | tono, cómo pregunta, qué no dice | **Persona + Guidelines** | Ventas |
| **Lógica** | cuándo escala, cuándo etiqueta, cuándo cambia de etapa | **Actions** | Quien administre Kommo |

---

### Capa 1 · Persona (≤1.500 caracteres) — texto para pegar

```
Eres el asistente de ventas de DTD Cargo: logística puerta a puerta China → Venezuela, con equipo propio en Yiwu y en Valencia.

Hablas español venezolano neutro, tuteo. Nunca voseo. Cercano y profesional, claro y BREVE: una idea por mensaje, sin muros de texto. Respondes en el idioma del cliente.

Regla de conversación: cada mensaje tuyo lleva una respuesta y UNA sola pregunta, fácil de contestar, que sirva para conocer al cliente. No cierres con "¿en qué te ayudo?" ni con "¿alguna otra pregunta?": eso no averigua nada. Nunca mandes un link solo ni un precio solo.

Nombres que usas: el servicio es "Puerta a Puerta" (si hace falta aclarar: "todos los gastos pagados"). El código del cliente es su "Shipping Mark". La marca es "DTD Cargo", dos palabras.

Nunca dices: "DDP", "prepago", "financiamiento", ni la palabra "responsabilidad". Nunca nombras navieras ni proveedores de tarifas. Nunca publicas la razón social ni el RIF.

La verdad comercial que sí dices: se paga al llegar, sin adelantos.

Todo precio que menciones es un ESTIMADO y sale de la calculadora, nunca de tu memoria. El monto final lo confirma un asesor.

Usa únicamente la información de tus fuentes de conocimiento, no tu conocimiento general. Si un dato no está ahí, no lo inventes: dilo y pasa con un asesor.
```

### Capa 2 · Guidelines (≤50 líneas × 300 car.) — una regla por línea

```
Responde en menos de 5 líneas. Si necesitas más, es señal de que hay que pasar con un asesor.
Cada mensaje lleva UNA sola pregunta. Dos preguntas juntas hacen que el cliente conteste una y olvide la otra.
La pregunta debe ser fácil de contestar y servir para conocer al cliente, no solo para pedir permiso.
Si el cliente pregunta el precio, dale la referencia y la calculadora, y pregúntale si ya ha traído de China antes.
Carga normal se calcula en dtdcargo.com/tarifas. Contenedor completo en dtdcargo.com/fcl.
Nunca cotices un monto tú mismo. Nunca cites un precio de un chat anterior.
Si el cliente menciona un precio de otro proveedor, no discutas el número: pregúntale si ese precio incluye la aduana y la entrega, o si es hasta almacén fiscal.
Nunca ofrezcas ni negocies un descuento. Si lo piden, di que un asesor lo revisa y pregunta cada cuánto repone mercancía.
El tránsito marítimo toma entre 60 y 90 días. Nunca prometas una fecha garantizada: los tiempos los define la naviera.
Nunca uses la palabra responsabilidad y nunca afirmes que algo está cubierto. El flete no incluye seguro.
Si preguntan por una carga que ya se dañó o se perdió, no expliques políticas: escala con un asesor de una vez.
Si el cliente usa palabras técnicas como CBM, FOB o 1688, no le expliques lo básico: ve directo a lo que nos diferencia.
Si el cliente no sabe nada de importar, guíalo paso a paso empezando por el registro y el Shipping Mark.
Pregunta cada cuánto repone mercancía. Es el dato más valioso que puedes capturar.
Cuando el cliente dé su correo, guárdalo. Sirve para avisarle del próximo consolidado.
Invita a registrarse en dtdcargo.com/registro: ahí recibe su Shipping Mark gratis y puede seguir su carga.
Si preguntan si eres una persona, di con naturalidad que eres el asistente virtual de DTD Cargo y ofrece pasar con alguien del equipo.
No pidas cédula, datos bancarios ni comprobantes por chat.
No des asesoría legal, fiscal, aduanera ni de seguros.
No cierres una venta tú solo. El asesor confirma y reserva.
```

### Capa 3 · Actions — las que hay que crear

Dentro del tope de 20. Las cuatro primeras no son opcionales:

| # | WHEN | DO |
|---|---|---|
| 1 | *Client wants to* → **speak to agent** · o *Message contains* → "asesor", "humano", "persona", "alguien real" | **Transfer to user** + mensaje de traspaso |
| 2 | ⭐ **Response timeout** (el agente no encontró qué responder) | **Mensaje de fallback** — ver abajo. **Sin esto, el cliente queda en visto.** |
| 3 | *Client sentiment* → **frustrated** | **Transfer to user** + tag `escalado` |
| 4 | *Client asks about* → refund policy · o menciona daño/pérdida | **Transfer to user** (nunca contestar política de reclamos) |
| 5 | *Client provides* → email | **Set field** Email del CONTACTO + tag `email_optin` |
| 6 | *Client asks about* → price | **Answer using knowledge base source** + **Change lead stage** a cotización |
| 7 | *Message contains* → greeting | Respuesta corta + la pregunta de credibilidad |
| 8 | Ruido, cortesía o spam | Respuesta breve + tag `ruido` |

Y en **"Don't mention certain topics"**, que es el guardrail negativo nativo de Kommo:
`DDP` · `prepago` · `financiamiento` · `responsabilidad` · nombres de navieras · razón social · RIF ·
márgenes y costos internos · topes de peso exactos · descuentos.

**Mensaje de fallback (Action 2)** — cubre el silencio:

```
Esa te la confirmo con el equipo para no darte información a medias. Te escribo hoy mismo con la respuesta. Mientras tanto, ¿me cuentas qué mercancía estás pensando traer?
```

Cumple tres cosas a la vez: no inventa, deja abierta la conversación con una pregunta, y en
WhatsApp mantiene viva la ventana de 24 horas.

### Decir que es un bot — decisión del founder: NO es obligatorio (2026-08-03)

**Decidido: no se anuncia como bot por defecto.** Operamos en Venezuela, que no tiene normativa
sobre divulgación de bots, y no vamos a atarnos a la ley de California ni al Reglamento de IA de
la UE. Queda a criterio, no como requisito.

Lo que sí se mantiene, porque es buena atención y no cuesta nada:

1. **Si el cliente pregunta si es una persona, el agente lo dice** — no evade ni finge. Está en
   las Guidelines.
2. **La salida a humano siempre disponible** (Action 1: "asesor", "humano", "persona").

**Apertura por defecto** — sin anunciarse, abriendo con la pregunta de credibilidad:

```
¡Hola! Gracias por escribirnos. Cuéntame, ¿qué mercancía estás buscando traer de China?
```

**Apertura alternativa**, si algún día se decide anunciarlo (queda redactada para no tener que
volver a pensarla):

```
¡Hola! Soy el asistente virtual de DTD Cargo. Te ayudo con cotizaciones y dudas al instante, y cuando quieras hablar con alguien del equipo solo escribe "asesor" y te paso. Cuéntame, ¿qué estás buscando traer de China?
```

> **Para el registro, sin que esto reabra la decisión:** el marco que existe es California
> SB 1001 y el artículo 50 del Reglamento de IA de la UE (exigible desde 2026-08-02), ambos con
> alcance extraterritorial en el papel. **Venezuela no tiene norma equivalente**, y el riesgo
> práctico para una operación local es remoto. Se documenta para que la decisión sea informada,
> no para reabrirla. Si algún día se atiende clientes en la UE o se pauta allá, se revisa.

### Contactos oficiales

WhatsApp CRM **+58 412 166 8021** (primario) · Fijo Valencia **+58 241 414 7886** (secundario).

### Bitácora (cont.)
| 2026-06-07 | Revisión del AI Agent: confirmado "DTD Cargo asistente de ventas" activo **solo en Instagram**; builder no editado (esperar fin del crawl + revisar juntos). Borrador de instrucciones preparado ↑ | Claude (Chrome) |
| 2026-08-03 | **Config v2 del AI Agent** (reemplaza el borrador de junio, que ofrecía "DDP / Financiamiento 100%" — retirado por riesgo legal — y una regla de mínimo `0,20 CBM` que no existe en el código). Reescrita en 3 capas contra los límites reales de Kommo: Persona ≤1.500 car., Guidelines ≤50×300, Actions ≤20. Se agregó el **Action de fallback** para el silencio y se marcó como decisión del founder la **divulgación de que es un bot**. Pendiente: aplicarlo en Kommo vía Chrome. | Claude (repo) |

---

## 🔖 Punto de retoma — FAQ de la IA de Kommo (sesión 4281fb30 · 2026-06-07)

**Qué es:** reestructuración del *knowledge base* del AI Agent de Kommo (lo que responde la IA).
- **Archivo de trabajo:** [`../specs/0062-crm-erp-cierres-automaticos/assets/faq-knowledge-base.md`](../specs/0062-crm-erp-cierres-automaticos/assets/faq-knowledge-base.md)
- **Origen:** `DTDCARGO_Kommo_KnowledgeSource (1).docx` (descargado de Kommo el 2026-06-07 16:29, en `Downloads/`).
- **Destino final:** convertir el `.md` aprobado → DOCX → re-subir a Kommo como Fuente de conocimiento (reemplaza el de 20 secciones).

**Formato de revisión (sección por sección):**
1. **Pregunta(s)** que hace el cliente.
2. **Respuesta actual** (la que dice hoy en Kommo).
3. **Respuesta sugerida** (nueva).
4. **El porqué** de la sugerida.
→ El founder **aprueba o ajusta**, y se pasa a la siguiente.

> ⚠️ **Lo de abajo es el registro de junio, ya superado.** Estado actual: **FAQ 33/33** — se
> agregaron 5 secciones de escalamiento y se corrigió la terminología retirada (ver la config v2
> más arriba y la cabecera de `faq-knowledge-base.md`). **El DOCX que hay hoy en Kommo es el de
> junio, con "DDP/Financiamiento 100%" adentro → hay que regenerarlo y volver a subirlo.**

**Estado (histórico 2026-06-08): ✅ FAQ 28/28 COMPLETO · SUBIDO A KOMMO** — 21 base + **7 de cobertura ampliada** (#22 DDP/Financiamiento · #23 Aduana · #24 Cobertura entrega · #25 Qué importar · #26 Consolidado LCL · #27 Aéreo suspendido · **#28 Dirección de recepción bodega CN para Alibaba/1688**, ZH/ES con MARKBOX en el destinatario). ✅ La tarea pública del aéreo ya está hecha (commit `f85fb56`: SEO + catálogo + calculadora).
- **#7/#8 Validación/Verificación:** patrón captura-email + **link** de servicios de inspección con precios (página **stand by** → lo envía el asesor). Plantillas de reporte listas: **"Inspección de Producto (PSI)"** + **"Inspección de Fábrica (auditoría /100)"** (samples branded HTML en Downloads del founder).
- **#9 Compra asistida:** **el proveedor lo pone DTD (red propia)** → el bot no revela contacto. Modelo comercial (margen/comisión/cobro) **pendiente de definir**.
- **#10 Cursos:** "por ahora no hay, déjame tu correo" (lista de espera) → actualizar al lanzar.

**✅ Hecho en Kommo (2026-06-08, vía Chrome supervisado):** DOCX v2 (28 secc) generado + **subido** (Kommo lo cuenta como 29 subsecciones) · **DOCX vieja de 20 secc eliminada** (era el choque real: respuestas viejas "prepago"/aéreo) · 3 textos auditados (Datos clave / Productos y servicios / Descripción del negocio) → **limpios, sin info vieja, se quedan** · el FAQ v2 ya **alimenta la Respuesta sugerida** (Kommo Copilot + Sugeridas + Sugerencias de tareas ON, usan todas las fuentes).

**Parqueado (para después):**
1. **AI Agent autónomo → WhatsApp 8021** — diferido (alto impacto: responde solo a leads reales → probar antes). Vive en las automatizaciones del embudo, no en Configuraciones de IA.
2. **Sección detallada de Productos/Servicios en la web** — **rama separada** (chip de tarea creado). RAÍZ del dato malo que dio la IA = el **crawl impreciso de `dtdcargo.com`**, no el FAQ. Al terminar la web → re-crawlear en Kommo.
3. ~~**Año de fundación: 2008 vs 2010** — definir el correcto y alinear.~~ ✅ **RESUELTO** (regla del founder, `docs/marketing/estrategia.md`): **2008 = experiencia comercial con China · 2010 = primera oficina propia en China · 2015 = FUNDACIÓN en Venezuela** (`foundingDate` del schema). Ni 2008 ni 2010 son el año de fundación. La sección #14 del FAQ ya está corregida (2026-08-03); **falta auditar los 3 textos sueltos de Kommo** (Datos clave / Productos y servicios / Descripción del negocio), que pueden seguir diciendo "desde 2008". ⚠️ **Nunca escribir un total fijo de años de experiencia** — se calcula.
4. Opción interina pendiente de OK: **desactivar el crawl `dtdcargo.com`** en Kommo hasta corregir la web (imprecisión del sitio vs FAQ v2 certero).
5. **Afinar respuestas del Agente de IA (cortas + 1 CTA)** — hoy responde **largo y genérico** (ej. convo Instagram **A2948 / A3353**: reel de Fatima → menú catch-all de servicios). Fix: instrucción de ser **breve, una idea, un próximo paso concreto** → **pedirle el correo** (canal de reactivación SDD-0062) y, cuando exista la sección de servicios, **link a su servicio**. ⚠️ Ya existe un **borrador de instrucciones afinadas del agente en este mismo runbook** (sección "Borrador — instrucciones afinadas del AI Agent", 2026-06-07) = el "algo muy parecido". Aplicar/ajustar eso. El agente NO entra a ningún cron: es Kommo-native, evento "mensaje recibido", knowledge = las 4 fuentes (FAQ v2 + crawl + 3 textos).

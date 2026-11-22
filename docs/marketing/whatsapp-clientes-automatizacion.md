# Número de Clientes: quién envía cada plantilla, quién contesta y las fichas listas para Meta

> **Para qué:** antes de subir las plantillas del número de Clientes a Meta, definir:
> - quién **decide** cuándo sale cada una;
> - quién la **envía**;
> - quién **contesta** cada botón;
> - dónde hace falta **IA**, dónde un **bot sin IA** y dónde una **persona**.
>
> Al final van las fichas de cada plantilla, campo por campo, listas para WhatsApp Manager.
>
> **Estado (2026-11-16):** propuesta. **No se creó nada en Meta**; crear las plantillas espera el
> OK nominal de Sam (pregunta 1). Este documento continúa
> [`whatsapp-plantillas-por-numero.md`](whatsapp-plantillas-por-numero.md) §4.
>
> **Etiquetas:** **V** = verificado (fuente o código citado, leído el 2026-11-16) · **R** = está
> en el repo · **I** = inferido o propuesta.

---

## 1 · Quién hace qué (la regla corta)

| Pieza | Qué hace con las plantillas de Clientes | Qué **no** hace |
|---|---|---|
| **ERP (Studio)** | **Decide cuándo** sale cada plantilla, porque es quien sabe del embarque: estados, recepción en China, saldo, entrega. **Llena las variables** con sus datos y **la envía** por la API de Chatwoot. **Lee los botones** para mover lo suyo (tarjeta, tarea, reclamo) | No conversa |
| **Chatwoot** | Es la **bandeja**: muestra la plantilla y la respuesta en el mismo hilo. Sus **reglas de automatización** asignan equipo, etiquetan y resuelven según el botón. Las **personas** contestan aquí | No sabe de embarques: nunca decide sola cuándo mandar una plantilla |
| **dtd-bot** (SDD-0618, **apagado**) | Lo único con **IA**: el texto libre después de «Tengo una duda». Primero en modo **Sugerir** (deja una nota privada que el asesor usa o ignora) | No contesta botones ni manda plantillas |
| **Kommo** | **Nada en el número de Clientes**: ese número nunca estuvo en Kommo (R: spec 0582, enmienda del 0.8). Sigue con el número de leads hasta el corte | No se le arman automatizaciones nuevas: se está reemplazando |

**Lo que ya existe en el ERP y se aprovecha** (R):

- **Motor de avisos por evento** (SDD-0156, migración 0247): reglas por evento del recorrido, con
  canal, ancla, corrimiento y texto; una agenda (`client_notification_schedule`) y un despachador.
  - Hoy manda **correo** en `in_warehouse`, `shipped`, `out_for_delivery` y `delivered`, y
    también **push**.
  - El canal admite solo `email`, `push`, `both` o `none`. **Falta un canal `whatsapp`.**
- **Aviso por hito** (SDD-0627, apagado tras `AVISOS_POR_HITO_LIVE`):
  - «carga en camino» al zarpar, **uno por cliente y contenedor**, no uno por envío (decisión de
    la 0543);
  - «va llegando», según la ETA.
- **Bandeja de avisos del portal** (SDD-0526).
- **Estados del embarque** (`shipment_status`, migración 0002): `in_warehouse`, `consolidating`,
  `shipped`, `in_transit`, `in_customs`, `arrived_destination`, `delayed_warehouse`,
  `out_for_delivery`, `last_mile`, `delivered`, `exception` y `cancelled`.
- **Manejadores del webhook de Chatwoot** (`lib/studio/chatwoot/webhook-procesar.ts`): ya
  etiquetan, enrutan, crean tarjetas del CRM y llevan respuestas al portal. Leer los botones es
  **un manejador más**.
- **Agentes del ERP** (SDD-0020): `tracking-concierge` y `service-advisor`, con herramientas de
  embarques y servicios. Sirven de **fuente** para que dtd-bot conteste «¿dónde está mi carga?»
  con datos reales (I: hay que comprobar cómo se conectan los dos).

**Lo que trae Chatwoot 4.19.1** (V, código de la etiqueta `v4.19.1`):

- **Reglas de automatización** ([`automation_rule.rb`](https://github.com/chatwoot/chatwoot/blob/v4.19.1/app/models/automation_rule.rb)):
  - condiciones: contenido del mensaje, bandeja, etiquetas, estado, etc.;
  - acciones: `assign_team`, `assign_agent`, `add_label`, `send_message`,
    `resolve_conversation`, `add_private_note`, `change_priority` y `send_webhook_event`.

  No están marcadas como Enterprise; solo las condiciones de Captain piden su función. Con eso se
  resuelven sin código las respuestas simples a botones. Que el toque de un botón llegue a
  Chatwoot como un mensaje con el texto del botón es **I**: es lo habitual, pero no vi la función
  que lo arma.
- **API para enviar plantillas** en una conversación: `template_params` con nombre, categoría,
  idioma y variables del cuerpo, del encabezado (imagen por URL) y de los botones (V:
  [Chatwoot, «Create new message»](https://developers.chatwoot.com/api-reference/messages/create-new-message)).
  - Esa página no explica cómo **abrir** una conversación nueva con plantilla; el ERP tendría
    que crear la conversación primero (I).
- **No crea plantillas:** se crean en Meta y se sincronizan (ver
  [`whatsapp-plantillas-utilidad.md`](whatsapp-plantillas-utilidad.md) §4).

---

## 2 · ¿IA, bot o persona? Por respuesta

**Criterio:**

- un **botón** tiene una cantidad cerrada de respuestas, así que se maneja con **reglas fijas,
  sin IA**;
- el **texto libre** («Tengo una duda» seguido de lo que el cliente escriba) es lo único que
  justifica IA;
- lo que toca **plata, reclamos o cambios de entrega** va a una **persona**.

¿Por qué no IA en todo?

- Cada mensaje que sale cuenta contra el cupo de 1.000 gratis al mes por número y después se
  cobra (V: [Meta, «Pricing»](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)).
- Además, la IA cuesta por llamada y puede equivocarse con un dato de embarque.

### La matriz

| Plantilla | La dispara (ERP) | Botón | Quién contesta y cómo | ¿IA? |
|---|---|---|---|---|
| **C1** `bienvenida_cliente` | Se abre el primer embarque del cliente (estimado aceptado y embarque creado) | «Ya los guardé» | **Regla de Chatwoot:** etiqueta `bienvenida_ok` y resuelve. No se contesta: ahorra un mensaje | No |
| | | «Tengo una duda» | Se asigna al asesor del cliente; dtd-bot en **Sugerir** | Sí, solo sugerencia |
| **C2** `recepcion_almacen_china` | Se registra el recibo en el almacén de China (con foto) | «Todo correcto» | **Regla:** etiqueta `recepcion_ok` y resuelve. **ERP:** marca la recepción como confirmada por el cliente | No |
| | | «Algo no cuadra» | **Persona del equipo de China**, prioridad alta. El ERP abre la incidencia de recepción | No |
| **C3** `actualizacion_embarque` | Cambio a `consolidating`, `shipped`, `in_transit` o `in_customs`, **uno por cliente y contenedor** (regla de la 0543) | «Entendido» | **Regla:** resuelve | No |
| | | «Tengo una duda» | dtd-bot **Sugerir**, con el estado leído del ERP; después, una persona | Sí, solo sugerencia |
| **C4** `documento_pendiente_embarque` | **A mano:** el asesor la manda desde Studio o Chatwoot (no hay un evento confiable de «falta documento») | «Lo envío ahora» | Queda abierta esperando el adjunto; una **persona** lo revisa | No |
| | | «Tengo una duda» | Asesor | No |
| **C5** `carga_lista_para_entrega` | `arrived_destination` con saldo mayor que cero (`client_outstanding`) | «Coordinar entrega» | **Persona de logística** (equipo asignado por regla) | No |
| | | «Tengo una duda» | **Persona de cobranza** | No |
| **C6** `entrega_programada` | Se fija la fecha de entrega (`out_for_delivery` o `last_mile` con fecha) | «Confirmo» | **ERP:** marca la entrega como confirmada. **Regla:** resuelve | No |
| | | «Cambiar fecha» / «Cambiar dirección» | **Persona de logística** | No |
| **C7** `pago_recibido` | Se valida un pago reportado | (sin botones) | No espera respuesta | No |
| **C8** `como_llego_tu_carga` | `delivered` + 1 día (corrimiento de +1.440 minutos en el motor de avisos) | «Todo bien» | **Bot sin IA:** un solo mensaje fijo con el enlace a la reseña en Google y la invitación a referir (`portal/referidos`) | No |
| | | «Hubo un problema» | **Persona**, prioridad alta. El ERP abre un reclamo | No |
| **C9** `reposicion_cadencia` (marketing) | Cron diario: días desde la última entrega ≥ cadencia del cliente, sin estimado abierto, **con consentimiento** y sin otro marketing en 7 días | «Sí, cotizar» | Asesor. El ERP pasa la tarjeta a Recompra con tarea | No |
| | | «Todavía no» | **Regla:** resuelve. El ERP lo vuelve a programar en 30 días, una vez | No |
| | | «Detener promociones» | **ERP:** guarda la baja de marketing y no vuelve a mandar ninguno | No |
| **C10** `corte_contenedor` (marketing) | **A mano:** Sam o el asesor la lanzan con la fecha real de corte y la lista con consentimiento | «Tengo para este» | Asesor, con cotización | No |
| | | «Avísame el siguiente» | **Regla:** resuelve. El ERP lo anota para el próximo corte | No |

### Tres reglas de operación

1. **Velocidad:** quien toca un botón espera respuesta ya. Responder en la primera hora hace ~7
   veces más probable calificar (R: `conversacion-crm.md`, dato de HBR). Las respuestas fijas
   salen de inmediato; las que van a una persona, en horario, con una **nota privada** que diga
   qué tocó el cliente y qué embarque es.
2. **Fuera de horario** (de 8:00 a 20:00 todos los días; R: `whatsapp-business.md`), dtd-bot en
   Sugerir deja preparada la respuesta y la persona la manda a primera hora. **No** se manda «te
   respondemos mañana»: sería un mensaje cobrado que no resuelve nada.
3. **Nunca dos avisos el mismo día** al mismo cliente por el mismo contenedor. Si hay correo y
   WhatsApp para el mismo evento, el WhatsApp es el principal y el correo queda como registro (I:
   lo decide Sam, pregunta 3).

---

## 3 · Por fases: qué se puede hacer ya y qué necesita código

| Fase | Qué | Necesita | OK |
|---|---|---|---|
| **A · ya** | Crear las 10 plantillas en la cuenta de mensajes «DTD Cargo Clientes». Sincronizar en Chatwoot. **El asesor las envía a mano** desde la conversación del cliente | Nada de código | **OK nominal de Sam** para crear en Meta (pregunta 1) |
| **A2 · ya** | Reglas de automatización en Chatwoot para los botones con respuesta fija (resolver, etiquetar, asignar equipo) | Configurar Chatwoot en producción | OK de Sam para tocar la configuración del Chatwoot vivo |
| **B · SDD nueva** | Canal `whatsapp` en el motor de avisos (0247): agenda, envío por la API de Chatwoot con la plantilla y sus variables, y el ERP leyendo los botones (confirmar recepción, confirmar entrega, reclamo, baja de marketing). Consentimiento de WhatsApp en el registro y en la ficha del cliente | Migración y código, con su SDD, pruebas y `revisar-datos-ve` | El de siempre para una SDD y su migración |
| **C · cuando E7 esté listo** | dtd-bot en **Sugerir** en la bandeja de Clientes, para el texto libre, con el estado del embarque leído del ERP | La excepción IA-01 y encender la bandeja (SDD-0618 §9) | OK nominal de Sam (SDD-0618) |

**Recomendación (I):**

- empezar con **A** ahora;
- medir **dos semanas** a mano (cuánto responden y qué botón tocan);
- abrir **B** con esos datos.

Automatizar antes de ver las respuestas reales es automatizar a ciegas.

---

## 4 · Fichas listas para WhatsApp Manager

**Para todas:**

- **Idioma:** Español (`es`).
- **Variables:** tipo **Número** (`{{1}}`, `{{2}}`…).
- **Pie de las de utilidad (C1 a C8):** `DTD Cargo · Avisos de tu embarque` (33 caracteres; el tope es 60). Las de marketing (C9 y C10) llevan otro pie, indicado en su ficha.

Ninguna cumple con el patrón que Meta rechaza:

- variables al principio o al final;
- variables seguidas;
- botones mezclados (las de respuesta rápida van solas);
- palabras de promoción en las de utilidad.

Topes de Meta (V: [«Template components»](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/components)):

- encabezado de texto: 60 caracteres;
- cuerpo: 1.024;
- texto de cada botón: 25.

**Los ejemplos son inventados.** Ningún dato de un cliente real va en una ficha: Meta guarda los
ejemplos.

### C1 · `bienvenida_cliente`

- **Categoría:** Utilidad
- **Encabezado (texto):** `Tu embarque quedó registrado`
- **Cuerpo:**

  ```
  Hola {{1}}, tu embarque {{2}} quedó registrado en DTD Cargo.

  Por este número te escribiremos con las novedades de tu embarque. Guárdanos como DTD Cargo Clientes para tenernos a mano.
  ```

- **Botones (respuesta rápida):** `Ya los guardé` · `Tengo una duda`
- **Ejemplos:** `{{1}}` María · `{{2}}` S-2026-0457
- **Variables del ERP:**
  - `{{1}}` = primer nombre del cliente;
  - `{{2}}` = `shipments.code` (formato `S-YYYY-NNNN`; R: migración 0059).

### C2 · `recepcion_almacen_china`

- **Categoría:** Utilidad
- **Encabezado:** **Imagen**
  - Ejemplo para Meta: `public/fotos/bodega-yiwu-china-recepcion-consolidacion-dtd-cargo.jpg`
    (foto pública del sitio, sin datos de clientes).
  - En el envío real, la foto del recibo con un enlace temporal (I).
- **Cuerpo:**

  ```
  Hola {{1}}, recibimos en nuestro almacén de China tu carga con Shipping Mark {{2}}: {{3}}.

  Revisa la foto: ¿todo coincide con lo que compraste?
  ```

- **Botones:** `Todo correcto` · `Algo no cuadra`
- **Ejemplos:** María · DTD-1234 · 3 bultos, 0,42 m³
- **Variables:** `{{3}}` = bultos y m³ del recibo.

### C3 · `actualizacion_embarque`

- **Categoría:** Utilidad
- **Encabezado:** `Actualización de tu embarque`
- **Cuerpo:**

  ```
  Hola {{1}}, te escribe DTD Cargo con una actualización de tu embarque {{2}}.

  Estado: {{3}}
  Próximo paso: {{4}}

  Si tienes alguna duda sobre este embarque, responde a este mensaje.
  ```

- **Botones:** `Entendido` · `Tengo una duda`
- **Ejemplos:** María · S-2026-0457 · En consolidación en nuestro almacén de China · Salida en el
  contenedor estimado para el 28 de noviembre
- **Textos de `{{3}}` y `{{4}}`:** los arma el ERP desde el estado, **siempre con estas frases
  fijas** y sin texto libre. Si alguien mete una promoción en una variable, Meta recategoriza y
  puede sancionar.

  | Estado | `{{3}}` Estado | `{{4}}` Próximo paso |
  |---|---|---|
  | `consolidating` | En consolidación en nuestro almacén de China | Salida en el contenedor estimado para el `<fecha>` |
  | `shipped` | Salió de China en su contenedor | Llegada estimada a Venezuela el `<fecha ETA>` |
  | `in_transit` | En tránsito marítimo hacia Venezuela | Llegada estimada el `<fecha ETA>` |
  | `in_customs` | En proceso de aduana en Venezuela | Al salir de aduana, coordinamos la entrega |
  | `delayed_warehouse` | Con retraso en el almacén de China | Si quieres más detalle, responde a este mensaje |

  `exception` y `cancelled` **no** usan plantilla: los avisa una persona.

### C4 · `documento_pendiente_embarque`

- **Categoría:** Utilidad
- **Encabezado:** `Documento pendiente`
- **Cuerpo:**

  ```
  Hola {{1}}, para continuar con tu embarque {{2}} necesitamos el siguiente documento: {{3}}.

  Sin este documento la carga no puede avanzar a la etapa de {{4}}. Puedes enviarlo respondiendo a este mensaje.
  ```

- **Botones:** `Lo envío ahora` · `Tengo una duda`
- **Ejemplos:** Carlos · S-2026-0458 · factura comercial del proveedor · consolidación

### C5 · `carga_lista_para_entrega`

- **Categoría:** Utilidad
- **Encabezado:** `Tu carga llegó a Venezuela`
- **Cuerpo:**

  ```
  Hola {{1}}, tu carga {{2}} llegó a nuestro almacén en {{3}} y está lista para coordinar la entrega.

  Saldo pendiente: {{4}}. Responde a este mensaje para coordinar el pago y la entrega.
  ```

- **Botones:** `Coordinar entrega` · `Tengo una duda`
- **Ejemplos:** Ana · S-2026-0459 · Valencia · US$ 240,00
- **Variables:** `{{4}}` = saldo de `client_outstanding`, en US$.

### C6 · `entrega_programada`

- **Categoría:** Utilidad
- **Encabezado:** `Entrega programada`
- **Cuerpo:**

  ```
  Hola {{1}}, tu carga {{2}} sale a entrega el {{3}}, entre las {{4}}.

  ¿Confirmas que habrá alguien para recibirla en la dirección registrada?
  ```

- **Botones:** `Confirmo` · `Cambiar fecha` · `Cambiar dirección`
- **Ejemplos:** Ana · S-2026-0459 · martes 25 de noviembre · 9:00 y 12:00

### C7 · `pago_recibido`

- **Categoría:** Utilidad
- **Encabezado:** `Pago recibido`
- **Cuerpo:**

  ```
  Hola {{1}}, recibimos tu pago de {{2}} para el embarque {{3}}.

  Saldo pendiente: {{4}}. El recibo está disponible en tu portal.
  ```

- **Botones:** ninguno
- **Ejemplos:** Carlos · US$ 500,00 · S-2026-0458 · US$ 0,00

### C8 · `como_llego_tu_carga`

- **Categoría:** Utilidad. Es una encuesta atada a un pedido concreto, que es lo que Meta acepta
  (V: [«Template categorization»](https://developers.facebook.com/docs/whatsapp/updates-to-pricing/new-template-guidelines/)).
- **Encabezado:** ninguno
- **Cuerpo:**

  ```
  Hola {{1}}, ya entregamos tu carga {{2}}.

  ¿Cómo llegó todo?
  ```

- **Botones:** `Todo bien` · `Hubo un problema`
- **Ejemplos:** Luis · S-2026-0460
- **Riesgo:** bajo. Si Meta la marca como marketing, se agrega «Queremos confirmar que tu entrega
  de hoy llegó completa» antes de la pregunta.

### C9 · `reposicion_cadencia`

- **Categoría:** Marketing
- **Encabezado:** ninguno
- **Cuerpo:**

  ```
  Hola {{1}}, tu última carga llegó hace {{2}} días. Si te toca reponer, el próximo contenedor cierra recepción el {{3}}.

  ¿Te preparo la cotización con el mismo volumen?
  ```

- **Botones:** `Sí, cotizar` · `Todavía no` · baja de marketing `Detener promociones`. Meta trae
  un tipo de botón propio para la baja; si WhatsApp Manager lo ofrece, se usa ese (I).
- **Ejemplos:** Pedro · 45 · 5 de diciembre
- **Pie:** `DTD Cargo`. No lleva el de avisos de embarque, porque esto no es un aviso. Si se usa el botón de baja de Meta, WhatsApp Manager agrega su propio texto.

### C10 · `corte_contenedor`

- **Categoría:** Marketing
- **Cuerpo:**

  ```
  Hola {{1}}, el próximo contenedor desde {{2}} cierra la recepción en nuestro almacén el {{3}}.

  ¿Tienes mercancía para ese corte o te aviso del siguiente?
  ```

- **Botones:** `Tengo para este` · `Avísame el siguiente` · `Detener promociones` (el mismo botón de baja que C9)
- **Ejemplos:** Rosa · Yiwu · 5 de diciembre
- **Pie:** `DTD Cargo`, igual que C9.

### Cómo se suben (cuando haya OK)

1. **Dónde:** WhatsApp Manager → cuenta de mensajes **«DTD Cargo Clientes»** → Administrar
   plantillas → Crear.
2. **Orden:**
   - primero **C3**, que es la más estándar;
   - se espera su categoría (Meta suele responder en menos de 24 h);
   - después C1, C5 y C8;
   - después el resto.

   Si C3 sale como marketing, se corrige la redacción antes de subir las demás.
3. **Revisar cada aprobación:** la categoría que devuelve Meta y que el estado sea APPROVED.
4. **En Chatwoot:** «Sync Templates» en la bandeja Clientes, o esperar hasta 3 h. Comprobar que
   aparecen.
5. **Registrar** en el handoff nombre, categoría aprobada y fecha. Sin IDs ni datos de cuentas.

---

## 5 · El número de leads mientras siga en Kommo

- Las plantillas de leads (L1 a L9) se pueden crear **ya** en la cuenta de mensajes de **Kommo**
  y usarse desde Kommo hasta el corte.
- Al pasar el número a Chatwoot se copian a la cuenta de mensajes de Chatwoot con la API de
  migración: mismo negocio, solo las aprobadas, y la calidad vuelve a cero (V:
  [Meta, «Template migration»](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-migration)).
- **No conviene** armar automatizaciones nuevas en Kommo para ellas. Se usan a mano desde Kommo, y
  la automatización se hace una sola vez, en Chatwoot y el ERP, después del corte (I).

---

## Preguntas para Sam (con mi recomendación)

1. **¿Das el OK nominal para crear en Meta, en la cuenta de mensajes «DTD Cargo Clientes», las 10
   plantillas de §4 con el texto exacto de este documento?**
   - Recomendación: **sí, en el orden de §4**: primero C3 y, si sale como utilidad, las demás.
   - Crear no envía nada a nadie; enviar sigue siendo a mano.
   - Lo hago yo en el navegador del panel con tu sesión de Meta abierta.
2. **Cuando dices «el número de compras», ¿hablas del número de Clientes que configuramos estos
   días?**
   - Recomendación: confirmarlo antes de crear nada, porque las plantillas quedan en la cuenta de
     mensajes de ese número.
3. **Si un evento tiene correo y WhatsApp, ¿el WhatsApp es el principal y el correo queda como
   registro?**
   - Recomendación: **sí**. Y nunca dos avisos el mismo día por el mismo contenedor.
4. **¿Abro la SDD de la fase B** (canal WhatsApp en el motor de avisos, lectura de botones y
   consentimiento de WhatsApp) **después de las dos semanas a mano?**
   - Recomendación: **sí, después**, con los datos reales de respuesta.

## Fuentes

- **Meta:** [Pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing),
  [Template components](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/components),
  [Template categorization](https://developers.facebook.com/docs/whatsapp/updates-to-pricing/new-template-guidelines/)
  y [Template migration](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-migration).
  Leídas el 2026-11-16.
- **Chatwoot:** [`automation_rule.rb` en `v4.19.1`](https://github.com/chatwoot/chatwoot/blob/v4.19.1/app/models/automation_rule.rb)
  y [«Create new message»](https://developers.chatwoot.com/api-reference/messages/create-new-message).
  Leídas el 2026-11-16.
- **Repo:**
  - `supabase/migrations/0247_client_notifications.sql`, `0002_shipments.sql` y `0059_public_track_rpc.sql`
  - `lib/studio/notifications/avisos-por-hito.ts`
  - `lib/studio/chatwoot/webhook-procesar.ts`, `enrutar.ts` y `bot/`
  - `lib/studio/agents/`
  - `docs/specs/0618-bot-propio-e7/spec.md`, `0582-chatwoot-piloto/spec.md`, `0543-consolidados-en-camino/` y `0627-seguimiento-estimado/`

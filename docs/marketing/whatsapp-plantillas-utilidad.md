# Plantillas de WhatsApp: por qué salen de marketing y cómo tener de utilidad

> **Para qué:** responder las cinco preguntas de Sam sobre plantillas (categorías, propuestas de
> utilidad, el MCP de Meta, plantillas dentro de Chatwoot y el segundo número) con fuentes y una
> recomendación.
>
> **Estado (2026-11-16):** investigación y propuesta. No se creó, editó ni envió ninguna plantilla
> en Meta, Kommo ni Chatwoot, ni se tocó producción ni el VPS.
>
> **Etiquetas:** **V** = verificado en la fuente citada (leída el 2026-11-16) · **R** = registrado
> en el repo (cito el archivo) · **I** = inferido, sin comprobar en la cuenta real.
>
> **Sin datos privados:** no hay números, IDs de cuentas, tokens ni nombres de clientes. Los
> ejemplos usan datos inventados.

---

## Resumen en seis líneas

1. Meta clasifica como **marketing** todo lo que no sea un aviso **concreto sobre algo del cliente**
   (su carga, su pago, su documento). Un mensaje para «reactivar» a alguien es marketing por
   definición, aunque el texto sea amable. Desde el 9 de abril de 2025 Meta ya no rechaza la
   plantilla: **la aprueba directamente como marketing** (V).
2. Una plantilla de marketing **sí puede** abrir una conversación fuera de las 24 h. Pero es más
   cara, exige consentimiento y Meta puede no entregarla si la persona ya recibió mucho marketing
   (error 131049). Lo más probable es que eso sea lo que Sam ve como «no puedo reabrir» (I).
3. Para reabrir con **utilidad**, el mensaje tiene que traer un dato real del embarque: Shipping
   Mark, estado, documento que falta o saldo. Abajo van tres plantillas pensadas para eso.
4. El **MCP de Meta** («WhatsApp Business Tools», beta, 15-sep-2026) es para agentes de IA como
   Claude Code o Codex, con el inicio de sesión de una persona. **No se conecta a Chatwoot ni a
   Studio.** Sirve para crear y revisar plantillas desde una conversación con el agente. Chatwoot
   las trae solo de Meta (V).
5. Las plantillas **no llegan a Chatwoot porque viven en otra cuenta de mensajes**, no porque
   falte transferir el número. Con el modelo nuevo de Meta, cada integración tiene su propia
   cuenta de mensajes con sus propias plantillas. Las 5 de Kommo están en la de Kommo. La bandeja
   «Clientes» lee la cuenta «DTD Cargo Clientes», que tenía **0** el 2026-10-30. Transferir el
   número no las trae por sí solo (V + R).
6. Las plantillas son de la **cuenta de mensajes** (lo que antes era la WABA), no del número. Dos
   números que usan la misma cuenta de mensajes comparten plantillas. Si están en cuentas
   distintas, hay que crearlas dos veces o copiarlas con la API de migración de plantillas. El
   límite de envío se comparte en todo el portfolio de todas formas (V).

---

## 1 · Por qué Meta lo clasifica todo como marketing

### Reglas vigentes

Fuente: [Meta, «Template categorization»](https://developers.facebook.com/docs/whatsapp/updates-to-pricing/new-template-guidelines/), leída el 2026-11-16 (V).

- **Utilidad** exige dos cosas a la vez:
  - **ningún tono promocional ni persuasivo**;
  - que el mensaje sea **específico de la persona o pedido por ella** (su pedido, su cuenta, su
    transacción) o **esencial** para ella (por ejemplo, de seguridad).
- **Pasan a marketing:**
  - mezclar un aviso útil con una promoción;
  - contenido **genérico o poco claro**, incluida una plantilla que es solo un saludo o solo una
    variable;
  - los mensajes de **retargeting** (renovaciones, carrito abandonado), aunque la persona los haya
    pedido;
  - las encuestas genéricas;
  - **invitar a seguir la conversación por WhatsApp** cuando la persona no lo pidió.
- **Ejemplos que Meta acepta como utilidad:** confirmación de pedido, **actualización de envío con
  datos de seguimiento**, confirmación de reembolso, **alerta de saldo de cuenta** y confirmación
  de alta o baja.
- **Recategorización automática:**
  - desde el **1-jul-2024**, Meta revisa cada mes las plantillas ya aprobadas, incluso las que ya
    pasaron revisión;
  - desde el **9-abr-2025**, una utilidad que debería ser marketing **se aprueba como MARKETING**
    sin preguntar;
  - normalmente Meta avisa 1 día antes (correo, webhook o WhatsApp Manager);
  - desde el **16-abr-2025**, a quien ya recibió una advertencia por mal uso se le cambia **al
    instante**.
- **Sanciones por mal uso:**
  - advertencia;
  - límite al volumen de utilidad;
  - todas las utilidades pasan a marketing y no se pueden crear nuevas durante 7 días (30 si se
    repite);
  - una restricción de 30 días a nivel de portfolio.
- **Apelación:** WhatsApp Manager → Business Support → «Template Category Updates» → «Request
  Review», con 60 días de plazo. Se puede apelar una MARKETING aprobada.

### Por qué le pasa a DTD (I, mientras no veamos las plantillas)

- En Kommo hay 5 plantillas aprobadas: **3 de marketing y 2 de utilidad**, y Kommo las describe
  como «avisos de carga y reactivación» (R: `docs/specs/0582-chatwoot-piloto/investigacion-2026-10-29-e0.md`,
  K-19 y M-30). Todo apunta a que las de marketing son las de **reactivación**: «¿sigues
  interesado?», «¿pudiste revisar la cotización?», «tenemos salida esta semana». Meta las trata
  como retargeting.
- También cuentan contra la utilidad:
  - los saludos sin un dato concreto;
  - invitar a escribir sin que haya algo del cliente pendiente;
  - mencionar tarifas, salidas o promociones;
  - variables sueltas que pueden llevar cualquier texto. Meta no puede saber si `{{1}}` será un
    estado o una oferta.

### Qué sí abre conversación y cuánto cuesta

Fuente: [Meta, «Pricing»](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing), leída el 2026-11-16 (V).

- Fuera de la ventana de 24 h **solo** se puede escribir con una plantilla, de **cualquier**
  categoría, y la persona tiene que haber dado su consentimiento. Cuando el cliente responde, se
  abre la ventana de servicio.
- Meta cobra **por mensaje entregado**, según la categoría y el país de quien recibe. Venezuela
  está en «Resto de Latinoamérica» (R: E0, V3-1). La tarifa se consulta en el tarifario de esa
  página. Aquí no se copia una cifra de memoria.
- **Desde el 1-oct-2026:**
  - la utilidad **se cobra también dentro de la ventana** (antes era gratis);
  - los mensajes de servicio se cobran después de los **1.000 gratis al mes por número**.
- Los descuentos por volumen aplican solo a utilidad y autenticación.
- Las respuestas a un anuncio «clic a WhatsApp» son gratis durante 7 días, en todas las
  categorías.
- **Límite de envío:** cuenta las personas distintas a las que se escribe fuera de la ventana en
  24 h móviles. Se fija **por portfolio** y lo comparten todos sus números: 250 al empezar, luego
  2.000, 10.000, 100.000 e ilimitado. Fuente: [Meta, «Messaging limits»](https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits), leída el 2026-11-16 (V).
- **Tope por persona en marketing:** Meta deja de entregar marketing a quien ya recibió demasiado
  de cualquier empresa (error **131049**, «healthy ecosystem engagement»). No publica la cifra ni
  el período, y reintentar no garantiza la entrega. Fuente secundaria:
  [Chakra, «WhatsApp error 131049»](https://chakrahq.com/help/chat/faqs/whatsapp-api-error-code-troubleshooting/whatsapp-error-131049),
  leída el 2026-11-16. No encontré el documento primario de Meta (I).

---

## 2 · Plantillas de utilidad propuestas

### Cómo están pensadas

- Cada una lleva un **dato del embarque del cliente**: Shipping Mark, estado, documento o saldo.
- No tienen promoción, ni pregunta de interés, ni «¿podemos ayudarte en algo más?».
- Las variables nunca van al principio ni al final del texto, nunca van seguidas y cada una tiene
  ejemplo, como pide Meta al revisar.
- Usan «contenedor», no «lote».
- **Idioma:** `es` (Meta no ofrece una variante de Venezuela; I).
- **Categoría al enviarlas:** Utility.
- **Variables por posición** (`{{1}}`, `{{2}}`…), porque Chatwoot las llena así (V: [Chatwoot, «Templates and the 24-hour window»](https://www.chatwoot.com/hc/user-guide/articles/1754940076-whatsapp-templates)).
- **Botones:** solo de respuesta rápida. No llevan botón de URL, para que no se lea como «llevar
  tráfico». Si Sam quiere enlazar el portal, que sea en una versión aparte y después de ver cómo
  la clasifica Meta.

### P1 · `actualizacion_embarque` (la principal; sirve para casi todo el recorrido)

**Categoría esperada:** utilidad. Es el caso que Meta da de ejemplo: «actualización de envío con
datos de seguimiento».

```
Hola {{1}}, te escribe DTD Cargo con una actualización de tu carga con Shipping Mark {{2}}.

Estado: {{3}}
Próximo paso: {{4}}

Si tienes alguna duda sobre este embarque, responde a este mensaje.
```

- **Botones (respuesta rápida):** «Entendido» · «Tengo una duda»
- **Ejemplo para Meta:**
  - `{{1}}` María
  - `{{2}}` DTD-1234
  - `{{3}}` Recibida en nuestro almacén de China: 3 bultos, 0,42 m³
  - `{{4}}` Consolidación en el contenedor con salida estimada el 28 de noviembre
- **Sirve para:**
  - recepción en el almacén de China;
  - consolidación;
  - salida del contenedor;
  - llegada a Venezuela;
  - entrega.

  Basta cambiar `{{3}}` y `{{4}}`.
- **Regla de uso:** `{{3}}` y `{{4}}` describen **hechos del embarque**. Nunca «aprovecha la
  oferta» ni «cotiza tu próxima carga». Si el equipo mete promociones en las variables, Meta puede
  recategorizarla o sancionar la cuenta.

### P2 · `documento_pendiente_embarque`

**Categoría esperada:** utilidad (trámite pendiente de una transacción del cliente).

```
Hola {{1}}, para continuar con tu embarque {{2}} necesitamos el siguiente documento: {{3}}.

Sin este documento la carga no puede avanzar a la etapa de {{4}}. Puedes enviarlo respondiendo a este mensaje.
```

- **Botones (respuesta rápida):** «Lo envío ahora» · «Tengo una duda»
- **Ejemplo:**
  - `{{1}}` Carlos
  - `{{2}}` DTD-5678
  - `{{3}}` factura comercial del proveedor
  - `{{4}}` consolidación

### P3 · `carga_lista_para_entrega`

**Categoría esperada:** utilidad (aviso de llegada con saldo de la cuenta; Meta da de ejemplo las
«alertas de saldo»).

```
Hola {{1}}, tu carga {{2}} llegó a nuestro almacén en {{3}} y está lista para coordinar la entrega.

Saldo pendiente: {{4}}. Responde a este mensaje para coordinar el pago y la entrega.
```

- **Botones (respuesta rápida):** «Coordinar entrega» · «Tengo una duda»
- **Ejemplo:**
  - `{{1}}` Ana
  - `{{2}}` DTD-9012
  - `{{3}}` Valencia
  - `{{4}}` US$ 240,00
- **Nota:** el monto va en dólares (el sistema trabaja en USD). No se ofrecen descuentos por
  pronto pago: eso la haría marketing.

### Lo que **no** conviene intentar como utilidad

- **«Seguimiento de cotización»** a quien solo consultó y no compró: es reactivación, o sea
  marketing. Si se quiere reabrir con utilidad, tiene que **entregar** algo que la persona pidió.
  Por ejemplo: «La cotización que nos pediste para {{2}} es {{3}}», con el monto dentro. Aun así,
  Meta podría clasificarla como marketing (I). Conviene enviarla aparte y ver qué responde.
- **Encuestas de satisfacción genéricas:** son marketing. Solo pasan como utilidad si nombran un
  embarque concreto.

### Contra lo que ya existe

- Todavía **no vi** las plantillas de Kommo ni las aprobadas en Meta: el repo no tiene su
  inventario (R: E0, K-12).
- Hace falta que Sam mande capturas o el listado (nombre, categoría, estado y texto) de
  **WhatsApp Manager → Administrar plantillas** de las dos cuentas de mensajes. Con eso se
  revisan:
  - si las 2 de utilidad de Kommo se parecen a P1–P3 y conviene reutilizarlas;
  - qué frase hizo marketing a las otras 3;
  - que no haya choques de nombre.

---

## 3 · El MCP de Meta: qué es y si se conecta a Chatwoot

Fuentes: [anuncio de Meta, 15-sep-2026](https://developers.facebook.com/blog/post/2026/09/15/whatsapp-business-messaging-mcp-ai-agent/)
y [guía «WhatsApp Business Tools MCP»](https://developers.facebook.com/documentation/mcp/whatsapp-business-tools-mcp),
leídas el 2026-11-16 (V).

### Qué es

- Un servidor MCP **alojado por Meta** (`https://mcp.facebook.com/whatsapp_business_tools`),
  **en beta** y con despliegue gradual: puede no estar disponible todavía en la cuenta.
- Se entra con el inicio de sesión de Meta (OAuth) de **una persona** que administre el negocio y
  la app.
- Clientes compatibles: Claude Code, Claude Desktop, ChatGPT y Codex.
- Meta dice que está hecho para desarrollo y pruebas, no para envíos masivos en producción.

### Qué hace con plantillas

- `whatsapp_biz_list_templates` y `get_template`: listar y revisar.
- `create_template`, `update_template` y `delete_template`: crear, editar y borrar. Lo creado pasa
  por la misma revisión de Meta.
- La guía no documenta una consulta de categoría. Con la Graph API, en cambio, se puede pedir
  `category,correct_category` y ver si Meta piensa recategorizarla.

### Qué más trae

Herramientas peligrosas para DTD:

- `register_phone_number`: en el número principal está **prohibido** volver a registrar (spec
  0582, decisión B; R).
- `send_message`.
- `configure_webhooks` y `subscribe_webhook`: podrían desviar los webhooks de Chatwoot.
- `configure_payments`.

### ¿Se conecta a Chatwoot o a Studio?

- **No.** Lo usa un agente de IA en nombre de una persona que inició sesión. No es una API de
  servidor a servidor, y Chatwoot no es un cliente MCP.
- La misma guía remite a un token de usuario del sistema y a la Cloud API para quien construye su
  propia solución (V).
- Chatwoot tampoco lo necesita: trae las plantillas directo de la Graph API (ver §4).

### Camino propuesto

1. Usarlo, si Sam quiere, **desde Claude Code o Codex con la sesión de Sam**, solo para listar,
   crear o editar plantillas en la cuenta de mensajes de Chatwoot.
2. Después, Chatwoot las sincroniza solo.
3. Cada creación lleva el OK de Sam con el texto exacto, y nunca se usan registro, envío, webhooks
   ni pagos.
4. Sin el MCP, el camino equivalente es crearlas a mano en WhatsApp Manager.
5. Para Studio no hace falta nada nuevo.

---

## 4 · Plantillas aprobadas dentro de Chatwoot

### Cómo sincroniza Chatwoot CE 4.19.1 (V, código de la etiqueta `v4.19.1`)

- [`whatsapp_cloud_service.rb`](https://github.com/chatwoot/chatwoot/blob/v4.19.1/app/services/whatsapp/providers/whatsapp_cloud_service.rb)
  pide `GET graph.facebook.com/v14.0/<business_account_id>/message_templates`, con el token de la
  bandeja y paginando. Guarda **todas** las que devuelve Meta; el panel muestra solo las aprobadas
  de tipos que soporta.
  - **Clave:** usa el `business_account_id` configurado en la bandeja, no el número.
- [`channel/whatsapp.rb`](https://github.com/chatwoot/chatwoot/blob/v4.19.1/app/models/channel/whatsapp.rb)
  sincroniza al crear la bandeja.
- [`templates_sync_scheduler_job.rb`](https://github.com/chatwoot/chatwoot/blob/v4.19.1/app/jobs/channels/whatsapp/templates_sync_scheduler_job.rb)
  vuelve a sincronizar las que llevan **más de 3 h** sin hacerlo.
- La ayuda de Chatwoot documenta además el botón **«Sync Templates»** en Configuración de la
  bandeja ([guía](https://www.chatwoot.com/hc/user-guide/articles/1754940076-whatsapp-templates)).
  Que el botón esté en CE 4.19.1 no lo comprobé (I).
- La ficha del token de Business Management es **solo para Chatwoot Cloud** con Embedded Signup.
  No aplica a nuestra bandeja manual (V: [guía](https://www.chatwoot.com/hc/user-guide/articles/1785260890-whatsapp-business-token)).

### ¿Se pueden crear dentro de Chatwoot? **No**

- Las plantillas se crean y se aprueban en Meta (WhatsApp Manager → Administrar plantillas).
  Chatwoot solo las sincroniza, las muestra y las envía.
- Chatwoot lo dice así: «Templates are created and approved outside Chatwoot, then synced in»
  ([guía](https://www.chatwoot.com/hc/user-guide/articles/1754940076-whatsapp-templates)). Y su
  blog del 20-ago-2026: «Creating and editing templates still happens with your provider»
  ([«All your WhatsApp templates in one place»](https://www.chatwoot.com/blog/all-your-whatsapp-templates-in-one-place)).
  Leído el 2026-11-16 (V).
- El juego de plantillas por número está en [`whatsapp-plantillas-por-numero.md`](whatsapp-plantillas-por-numero.md).

### ¿«No llegan porque el número no se ha transferido»? **Refutado en lo esencial**

- Con el modelo nuevo, las plantillas «pertenecen a la cuenta de mensajes en la que se crearon y
  **no se comparten** entre cuentas de mensajes». Cada socio o integración tiene la suya (V:
  [Meta, «Account model evolution»](https://developers.facebook.com/documentation/business-messaging/whatsapp/account-model-evolution/)).
  El modelo nuevo llegó a todas las empresas entre el 23-sep y mediados de octubre de 2026.
- La bandeja «Clientes» apunta a la cuenta de mensajes **«DTD Cargo Clientes»**. El 2026-10-30
  tenía **0 plantillas**, y la de prueba sí sincronizó `hello_world` (R:
  `.agents/handoffs/0582-e4-meta.md`, filas del 2026-10-30). O sea, **la sincronización funciona;
  no hay nada que traer en esa cuenta.**
- Las 5 aprobadas están en la cuenta de mensajes que usa **Kommo** (R: E0, M-30). Cuando el número
  «Leads» llegue a Chatwoot, lo hará **compartido** con una cuenta de mensajes propia de Chatwoot
  (spec 0582, decisión B; R). Esa cuenta nace **sin** las plantillas de Kommo.
- Lo que Sam intuye tiene una parte cierta: mientras el número no esté en Chatwoot, no hay bandeja
  «Leads» que muestre nada. Pero transferirlo **no basta**.

### Cómo traerlas (dos caminos; ninguno se ejecuta sin OK)

1. **Crearlas de nuevo** en la cuenta de mensajes de Chatwoot (recomendado para P1–P3, que son
   nuevas). Revisión de Meta: normalmente menos de 24 h.
2. **Copiarlas con la API de migración de plantillas.** Se llama
   `POST /<cuenta destino>/migrate_message_templates` con la cuenta de origen (V:
   [Meta, «Template migration»](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-migration)).
   Condiciones:
   - las dos cuentas de mensajes tienen que ser **del mismo negocio de Meta**. Creo que ambas
     están en el portfolio «Importador de China» (I: falta confirmarlo en Business Suite);
   - solo copia las **APPROVED** con calidad GREEN o UNKNOWN, y les da IDs nuevos;
   - la calidad y el nivel **vuelven a cero**, con 2 a 4 semanas de rodaje (V: «Account model
     evolution»).

   Conviene solo para las 2 de utilidad de Kommo, si sirven. Copiar las 3 de marketing no
   resuelve el problema de Sam.

---

## 5 · ¿Se comparten con el segundo número?

- **Las plantillas viven en la cuenta de mensajes** (antes, la WABA), no en el número. La cuenta
  de WhatsApp (WAAC) solo guarda el número, el perfil y el catálogo (V: «Account model
  evolution»).
- **Si los dos números usan la misma cuenta de mensajes, comparten las plantillas.** En el modelo
  viejo, una WABA con varios números compartía las plantillas entre todos.
  - Creo que una cuenta de mensajes puede atender a varias WAAC del mismo portfolio (I: la página
    de Meta no lo dice con esas palabras).
- **Si están en cuentas de mensajes distintas, no se comparten.** Hay que crearlas en cada una o
  copiarlas con la API de migración (mismo negocio), y la calidad vuelve a cero en la copia.
- **Hay cosas que se comparten de todas formas:**
  - el **límite de envío**, que es del portfolio entero y de todos los socios del número;
  - los **descuentos por volumen** de utilidad, que se cuentan por portfolio.
- **Si un número está compartido con dos cuentas de mensajes** (Kommo y Chatwoot durante la
  transición), cada mensaje se factura a la cuenta que lo envía. Cuando el token tiene acceso a
  más de una, el envío lleva `messaging_account_id`. El alias viejo `paid_messaging_account_id`
  vale hasta el 31-dic-2026 (V).
  - Que Chatwoot 4.19.1 mande ese parámetro **no está comprobado** (I). Solo importa si su token
    llega a ver dos cuentas de mensajes del mismo número.

---

## Preguntas para Sam (con mi recomendación)

1. **¿Me mandas capturas o el listado de «Administrar plantillas» de las dos cuentas de mensajes
   (la de Kommo y «DTD Cargo Clientes»), con nombre, categoría, estado y texto?**
   - Recomendación: **sí**. Sin eso no puedo decirte qué frase volvió marketing a cada una.
2. **¿Usamos P1, P2 y P3 tal como están para enviarlas a Meta como utilidad?** (sí / con cambios)
   - Recomendación: **sí, empezando por P1**, que cubre casi todo el recorrido. Manda una y mira
     cómo la clasifica Meta antes de mandar las otras.
3. **¿En qué cuenta de mensajes las creamos?** (a) «DTD Cargo Clientes», la de la bandeja
   Clientes · (b) la que tendrá Chatwoot para «Leads» · (c) las dos
   - Recomendación: **(a) ahora** y **(c)** cuando exista la de «Leads». Cada número usará las de
     su cuenta.
4. **¿Las creamos a mano en WhatsApp Manager o con el MCP de Meta desde Claude Code, con tu
   sesión?**
   - Recomendación: **a mano** la primera vez. El MCP está en beta y trae herramientas de registro
     y webhooks que en el número principal no se pueden tocar.
5. **¿Copiamos las 2 de utilidad de Kommo con la API de migración o las recreamos?**
   - Recomendación: **decidirlo después de ver la pregunta 1**. Si se parecen a P1–P3, basta con
     P1–P3.
6. **¿Apelamos alguna de las 3 de marketing de Kommo?**
   - Recomendación: **no**. Si son de reactivación, Meta tiene razón según sus reglas, y una
     apelación rechazada no ayuda. Mejor reemplazarlas por P1–P3 donde haya un embarque real.

## Fuentes

Todas leídas el 2026-11-16:

- Meta, [Template categorization](https://developers.facebook.com/docs/whatsapp/updates-to-pricing/new-template-guidelines/)
- Meta, [Pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)
- Meta, [Messaging limits](https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits)
- Meta, [Account model evolution](https://developers.facebook.com/documentation/business-messaging/whatsapp/account-model-evolution/)
- Meta, [Template migration](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-migration)
- Meta, [Migrating phone numbers programmatically](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/support/migrating-phone-numbers-among-solution-partners-programmatically):
  dice que la migración de números **no** aplica al modelo nuevo.
- Meta, [anuncio del MCP (15-sep-2026)](https://developers.facebook.com/blog/post/2026/09/15/whatsapp-business-messaging-mcp-ai-agent/)
  y [guía del MCP](https://developers.facebook.com/documentation/mcp/whatsapp-business-tools-mcp)
- Chatwoot, [Templates and the 24-hour window](https://www.chatwoot.com/hc/user-guide/articles/1754940076-whatsapp-templates)
  y [Business Management token](https://www.chatwoot.com/hc/user-guide/articles/1785260890-whatsapp-business-token)
- Chatwoot, código `v4.19.1`: los tres archivos citados en §4
- Secundaria: Chakra, [error 131049](https://chakrahq.com/help/chat/faqs/whatsapp-api-error-code-troubleshooting/whatsapp-error-131049)
- Repo: `docs/specs/0582-chatwoot-piloto/investigacion-2026-10-29-e0.md` (K-12, K-19, K-21, M-30 y
  la decisión B), `.agents/handoffs/0582-e4-meta.md`

> **Corrige una inferencia anterior:** K-21 de E0 suponía que Chatwoot podría usar las plantillas
> de Kommo al conectar el mismo número. Con el modelo nuevo eso es falso, y la decisión B de la
> spec 0582 ya lo había corregido: las plantillas se recrean.

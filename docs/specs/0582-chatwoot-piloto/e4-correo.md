# E4 · 4.8 — Bandeja de correo de `vzla@` (con `info@`) en Chatwoot (diseño)

- **Estado:** diseño, solo lectura. No se cambió nada en Hostinger, Cloudflare, Resend ni el Chatwoot vivo.
- **Pedido:** Sam eligió conectar el correo el 2026-10-30, por selector y con su texto literal: «Correo (info@), Instagram, Messenger, TikTok». Lo trajo el Director de la sesión del programa, que me encargó este paso.
- **Rama:** `codex/0582-e4-correo`, apilada sobre `codex/0582-e1-chatwoot-vps`.
- **Etiquetas de evidencia:** C código, D proveedor documenta, T cuenta o host, R runtime, I inferencia, NV no verificado.

## 1. Lo que hay hoy

| ID | Afirmación | Fuente | Etiqueta |
|---|---|---|---|
| EC-1 | `info@` es un **alias** del buzón `vzla@`: lo que llega a `info@` cae en el INBOX de `vzla@`. No hay reenviadores ni comodín. El plan Premium Business Email tiene **2 de 2 buzones en uso** desde el 2026-10-29 (`vzla@` y `notificaciones@`) | C-10 del paso 0.5; T-33 de SDD-0583 | T |
| EC-2 | DNS de la raíz: MX a Hostinger, SPF `include:_spf.mail.hostinger.com ~all`, DKIM `hostingermail-a/b/c` publicado y DMARC `p=none`. El correo que Hostinger manda por SMTP ya pasa SPF y DKIM alineados | C-2, C-3 y C-5; T-40 de SDD-0583 (consultado otra vez el 2026-10-30) | T |
| EC-3 | Resend no recibe correo: sus 3 dominios tienen `receiving: disabled`, `inbound.dtdcargo.com` no tiene MX y el único webhook es de eventos de envío. La ruta del ERP `app/api/conversaciones/email/route.ts` existe, pero nadie la llama | C-6, C-7 y C-8 | T · C |
| EC-4 | El ERP manda **4 avisos internos con datos de leads** a `info@` (más los admins): contacto web, estimación, packing list y cliente sin acceso al portal | `lib/studio/contact-lead-notify.ts:49`, `estimado-lead-notify.ts:64`, `packing-list-notify.ts:61`, `portal/sin-acceso-aviso.ts:120` | C |
| EC-5 | `info@` está publicado en la web y es el **canal legal**: derechos ARCO (asunto «Privacidad») y mediación previa de 15 días hábiles (asunto «Gerencia») | `lib/legal-public.ts:73` y `:77` | C |
| EC-6 | `info@` es también el correo que la guía de Alibaba pone en la dirección del almacén de China, así que ahí llegan avisos de plataformas y proveedores | `lib/faqs.ts:235` | C |
| EC-7 | Desde el contenedor `sidekiq` se llega a `imap.hostinger.com:993` | TCP desde el VPS, 2026-10-30 | R |

## 2. Cómo trae y manda correo Chatwoot 4.19.1 (canal IMAP/SMTP)

| ID | Afirmación | Fuente | Etiqueta |
|---|---|---|---|
| EC-8 | Cada minuto (`trigger_imap_email_inboxes_job`, `*/1`) entra al buzón por IMAP y busca en `INBOX` con `SEARCH SINCE <ayer>`. **No filtra por destinatario**: trae todo lo del buzón con el que inicia sesión | `config/schedule.yml:42`; `app/services/imap/base_fetch_email_service.rb` (`fetch_available_mail_sequence_numbers`, `since`) | C |
| EC-9 | Lee con `BODY.PEEK[]`: **no marca como leído ni borra**. El buzón queda igual para el webmail y otros programas | `base_fetch_email_service.rb` (`process_message_id`) | C |
| EC-10 | Evita duplicados por `Message-ID` (consulta y candado por mensaje). Trae 500 mensajes por pasada como máximo | `base_fetch_email_service.rb`; `app/mailboxes/imap/imap_mailbox.rb` (`duplicate_email?`) | C |
| EC-11 | **Caída de más de 1 día:** la pasada normal mira solo desde el día anterior. Si Chatwoot o `sidekiq` están caídos más tiempo, lo más viejo no entra solo. Se recupera a mano con `Inboxes::FetchImapEmailsJob.perform_now(channel, N)`, donde N son los días; lo ya traído no se duplica (EC-10) | `app/jobs/inboxes/fetch_imap_emails_job.rb` (`perform(channel, interval = 1)`) | C |
| EC-12 | Solo descarta los correos de remitente inválido y los avisos del propio Chatwoot. **Un rebote de `MAILER-DAEMON` o una respuesta automática entra como conversación** (marcada `auto_reply`) | `app/mailboxes/incoming_email_validity_helper.rb`; `imap_mailbox.rb` (`find_or_create_conversation`) | C |
| EC-13 | Arma el hilo con `In-Reply-To` y `References`. Responde por el SMTP de la bandeja (usuario, clave, host y puerto propios) y el remitente es la dirección de la bandeja | `imap_mailbox.rb`; `app/mailers/conversation_reply_mailer_helper.rb:62-80` | C |
| EC-14 | Las claves IMAP y SMTP se guardan cifradas en la base (`encrypts`). Se cargan en la pantalla de la bandeja, nunca en el `.env` | `app/models/channel/email.rb:46-47` | C |
| EC-15 | La respuesta a un cliente **no usa el diseño de DTD de SDD-0583**: `mailer/base` solo aplica con `branded_email_templates` (función premium). Sale con el diseño simple de Chatwoot y la firma de cada agente | `app/mailers/conversation_reply_mailer.rb:213-224`; T-41 de SDD-0583 | C |

## 3. El problema central y la decisión de Sam

Chatwoot no puede entrar a `info@` porque `info@` no es un buzón (EC-1). Si se conecta a `vzla@`, trae **todo** lo que llega a `vzla@` (EC-8): lo de `info@`, pero también bancos, proveedores y correo interno.

Se le preguntó a Sam qué buzón debe leer Chatwoot, y eligió **«vzla@ completo»** (selector, 2026-10-30, en esta sesión; antes había escrito «es vzla»). El diseño sigue esa decisión: **opción B**.

## 4. Opciones

| | Opción | Qué implica | Veredicto |
|---|---|---|---|
| **B** | **IMAP y SMTP sobre `vzla@`** | Sin costo y sin cambios en Hostinger ni en el DNS. Chatwoot entra con `vzla@` por IMAP (993, SSL) y responde por SMTP (587, STARTTLS). Ve todo lo de `vzla@`, `info@` incluido | **Elegida por Sam.** Hay que separar con reglas lo que no es de clientes (§4.1) |
| A | `info@` como buzón propio (3.er buzón) | Costo de un buzón más (**NV**); se borra el alias y se crea el buzón. Chatwoot solo ve `info@` | Alternativa. Queda por si el ruido de B resulta inmanejable |
| C | `info@` en el lugar de `notificaciones@`, que pasaría a ser alias | Sin costo | Descartada: mezcla los avisos del sistema con la atención |
| D | Canal «reenvío» de Chatwoot (Action Mailbox) | MX en un subdominio y un receptor SMTP (relé Postfix o Mailgun, SendGrid, Postmark o Mandrill; **Resend no está soportado**) | Descartada para el piloto: es un servicio nuevo en el puerto 25 |

### 4.1 Efecto de la opción B y cómo contenerlo

- **Lectores actuales de `vzla@`:** no cambia nada. Chatwoot no marca como leído ni borra (EC-9), así que el webmail y los programas de correo siguen viendo todo igual.
- **Solo desde la conexión hacia adelante:** la primera pasada mira desde el día anterior (EC-8 y EC-11). El histórico de `vzla@` **no** entra al CRM.
- **Ruido y datos ajenos a clientes** (`revisar-datos-ve`, minimización): bancos, proveedores, plataformas como Alibaba (EC-6), correo interno y los 4 avisos del ERP (EC-4) van a crear conversaciones. Para contenerlo:
  1. **Reglas de automatización de Chatwoot** al crearse la conversación: por dominio o remitente (bancos, `alibaba.com` y otros proveedores, `noreply@dtdcargo.com` y `notificaciones@dtdcargo.com`), etiquetar «no-cliente» o «sistema» y **resolver** (fuera de la cola). La lista inicial de remitentes se arma en la prueba, contando por dominio sin guardar direcciones en Git.
  2. **Acceso:** solo los agentes que hoy leen `vzla@` son miembros de esta bandeja. Los demás agentes no la ven.
  3. **Avisos del ERP (EC-4):** la regla los resuelve. A mediano plazo conviene mandarlos a los admins y sacarlos de `info@` (cambio de código aparte, con PR).
  4. **Inventario de terceros** (`docs/legal/privacidad/inventario-terceros.md` §2 bis): agregar que el correo de `vzla@` se copia a Chatwoot, en el mismo VPS. Se hace con la revisión `revisar-datos-ve` antes de PC-3.
- **Canal legal (EC-5):** regla que etiquete «legal» y asigne a un responsable los asuntos «Privacidad» y «Gerencia», porque tienen plazos.
- **Remitente de las respuestas:** Chatwoot responde con una sola dirección por bandeja (EC-13). Las dos variantes:
  - **`vzla@`** (recomendada): es el buzón que inicia sesión, sin riesgo de rechazo del SMTP;
  - **`info@`** como dirección de la bandeja, con usuario `vzla@`: Hostinger dice que el alias sirve «para enviar y recibir» (C-10), pero que el SMTP lo acepte es **NV** y se prueba en P2. Decide Sam.
- **Respuestas al cliente:** salen con el diseño simple de Chatwoot y la firma de cada agente (EC-15), que se configura en su perfil con el formato de DTD.
- **Volumen:** hasta 500 correos por pasada, cada minuto (EC-10). El volumen diario de `vzla@` es **NV**; se mide en la prueba.
- **Resend:** sin efecto. No recibe nada (EC-3) y no se toca.

## 5. DNS

**No hace falta ningún cambio** para la opción A: Hostinger ya firma y pasa SPF (EC-2). Endurecer DMARC (`p=quarantine` con reportes `rua`) es una mejora aparte, con su propio OK y su propio riesgo: afecta también a Resend y a la web. No es parte de 4.8.

## 6. Pruebas (primero en un buzón de prueba, nunca en `vzla@` sin OK)

Con la opción B no se compra buzón, así que no hay cupo para uno nuevo. **El buzón de prueba es `notificaciones@`**: es de DTD, tiene poco volumen y su usuario y clave SMTP ya están probados (SDD-0583). Se crea en Chatwoot una bandeja temporal «Correo · pruebas» sobre ese buzón, se corre P1–P7 escribiendo desde `hailuway.com@gmail.com` y al final **se borra la bandeja**, con sus conversaciones. Mientras exista, también entrarían las respuestas que la gente mande a los avisos del sistema: es poco y se borra con la bandeja.

| # | Prueba | Pasa si |
|---|---|---|
| P1 | Entrada | Un correo externo a la bandeja de prueba crea una conversación en 2 min o menos, con el contacto y el asunto correctos |
| P2 | Hilo y remitente | La respuesta desde Chatwoot llega con el remitente de la bandeja y `In-Reply-To`; la respuesta del cliente vuelve a la misma conversación. Se prueba también la dirección de bandeja distinta del usuario SMTP (variante `info@` de §4.1) |
| P3 | Adjuntos | Un PDF y una imagen entran y salen; se anota el límite de tamaño (NV hoy) |
| P4 | Rebotes | Responder a una dirección inexistente: se anota qué entra (EC-12) y cómo se ve |
| P5 | Webmail intacto | Los correos siguen sin leer en el webmail (EC-9) |
| P6 | Sin bucles | La respuesta automática de `notificaciones@` y los avisos de Chatwoot no generan conversaciones en cadena |
| P7 | Caída de más de 1 día | Apagar IMAP de la bandeja de prueba (`imap_enabled`) más de 26 h, mandar correos, volver a encenderlo: lo viejo no entra solo (EC-11). Con `perform_now(channel, 3)` entra sin duplicar |
| P8 | Reglas | Un correo de un remitente de la lista «no-cliente» queda etiquetado y resuelto; uno con asunto «Privacidad» queda etiquetado «legal» y asignado |

Ninguna prueba toca la producción de DTD. Usan el Chatwoot vivo, pero solo la bandeja de prueba.

### 6.1 Resultados de PC-1 (en curso)

Sam autorizó la prueba en el chat del Worker («Autorizo la prueba», 2026-10-30). La bandeja 3 «Correo · pruebas» (canal 1) se creó el 2026-10-30 a las ~21:20Z con `infra/chatwoot/correo/bandeja-prueba.rb crear`. Los correos de prueba vinieron de `vzla@` y de una cuenta de Hotmail, no de `hailuway.com@gmail.com`. La evidencia se leyó con conteos, horas, dominios y prefijos de `Message-ID`: sin contenido ni direcciones completas.

| # | Resultado | Evidencia |
|---|---|---|
| P1 | **PASÓ** | Dos correos (de `vzla@` y de Hotmail) llegaron al buzón a las 21:27:10Z y 21:27:23Z; las conversaciones #6 y #7 se crearon a las 21:27:42Z y 21:27:43Z, con el asunto correcto |
| P2 | **PASÓ** (hilo y remitente); variante `info@` **NO EJECUTADO** | La respuesta del chat salió de `notificaciones@` a las 22:15:22Z (estado `sent`). La respuesta de Sam llegó a las 06:13:06Z del 31 y entró a la **misma** conversación #6 a las 06:13:21Z, con `in_reply_to` igual al `Message-ID` que generó Chatwoot (`conversation/…`). La variante de §4.1 (dirección distinta del usuario SMTP) no se puede probar en `notificaciones@`, que no tiene alias |
| P3 | Salida **PASÓ**; entrada de imagen en línea **PASÓ**; entrada de archivo adjunto **NO EJECUTADO** | 2026-10-31 09:53Z: respuesta del chat en #8 con un PDF (404 B) y una imagen PNG (21 KB), estado `sent` y sin error. Sam la recibió con los 2 adjuntos (22 KB) y mandó la captura. El correo «Privacidad prueba» llegó sin adjuntos (2 partes MIME: texto y HTML). Sam dijo dos veces que había contestado con adjuntos (10:3xZ y 18:1xZ), pero hasta las 18:18Z no llegó nada al buzón: se revisaron las 5 carpetas, sin filtro de fecha. A las 18:41:37Z llegó «RE: Privacidad prueba» (con IMAP de la bandeja ya apagado), pero tampoco trae archivos: su estructura MIME es `multipart/related` con texto, HTML y la imagen de la firma en línea (52 KB). Esa imagen sí entra. En los mensajes 14, 17 y 18, Chatwoot registra `number_of_attachments=1`, no crea adjuntos sueltos y deja el `<img>` sin `cid:`: lo sube y reescribe la referencia (`process_inline_attachments`, `app/mailboxes/mailbox_helper.rb:26`). Un PDF o una foto como archivo adjunto no se probó; queda para PC-3 |
| P4 | **Hallazgo** | El rebote de `mailchannels.net` («Undelivered Mail Returned to Sender») entró a las 21:23Z como conversación **aparte** (#5) con `auto_reply=true`; no se enhebra a la conversación saliente (#4). Ver el hallazgo de reglas abajo |
| P5 | **PASÓ** | Lectura IMAP en modo `EXAMINE`: lo que trajo Chatwoot sigue sin leer. Solo aparecen leídos los dos correos de `vzla@` que Sam abrió en el webmail |
| P6 | **PASÓ** (en ~12 h) | El buzón tiene activa la respuesta automática de Hostinger «Buzón solo de notificaciones», y Sam la recibió al escribir. No apareció ninguna conversación en cadena: cada correo de Sam creó su conversación y nada más |
| P7 | EN CURSO | IMAP de la bandeja 3 apagado el 2026-10-31 a las 10:34:39Z. Chatwoot busca con `SINCE (Time.zone.today - 1)` en UTC, así que lo que cuenta es el **cambio de fecha**, no las 26 h: los correos del 31 quedan fuera de la búsqueda solo si IMAP se enciende el **2026-11-02 después de las 00:30Z**. Entonces: `encender-imap`, comprobar que lo del 31 no entra solo, `recuperar 3` y comprobar que entra sin duplicar lo que ya estaba. La entrada de adjuntos de P3 se comprueba en esa misma recuperación |
| P8 | «Legal» **PASÓ**; «no-cliente» lo bloquea el hallazgo | El correo «Privacidad prueba» llegó a las 09:50:09Z y creó la conversación #8 a las 09:50:14Z. La regla «Prueba correo · legal» le puso la etiqueta `prueba-legal` (09:50:18Z) y la prioridad urgente (09:50:20Z). La regla no asigna: en PC-3, la regla real lleva también `assign_agent` o `assign_team`. La conversación #3 (soporte de Hostinger) es un caso real de «no-cliente» |

**Hallazgo de reglas (P4/P8).** En Chatwoot 4.19.1, `AutomationRuleListener` ignora las conversaciones con `additional_attributes['auto_reply']` en `conversation_created` y `conversation_opened`, y los mensajes `auto_reply_email?` en `message_created`. Por eso **ninguna regla puede etiquetar ni resolver rebotes ni respuestas automáticas**: la regla «sistema» de §4.1 no sirve para eso. Opciones: (a) que el agente los resuelva a mano, porque son pocos; (b) una tarea periódica de DTD que etiquete «sistema» y resuelva las conversaciones `auto_reply=true` de la bandeja. Decide Sam antes de PC-3.

**Nombre del remitente.** El cliente vio el correo del chat como «Servicio DTD Studio de Correo · pruebas <notificaciones@dtdcargo.com>». La bandeja está en modo `friendly` (el valor por defecto) y no tiene `business_name`, así que Chatwoot arma `%{sender_name} de %{business_name}` con el nombre del agente y el de la bandeja. En PC-3 hay que darle a la bandeja de `vzla@` `business_name` «DTD Cargo» y elegir el modo: `friendly` («Ana de DTD Cargo») o `professional` (solo «DTD Cargo»). Decide Sam.

**Respuesta automática.** Si el buzón que lee la bandeja tiene una respuesta automática encendida, el cliente que contesta un correo del chat recibe también esa respuesta. En `notificaciones@` es aceptable porque es temporal; en `vzla@` hay que confirmar que no tiene ninguna antes de PC-3.

## 7. Puertas (cada una con OK nominal de Sam, nombrando la operación)

| Puerta | Operación | Dónde |
|---|---|---|
| PC-1 | Crear la bandeja temporal «Correo · pruebas» sobre `notificaciones@` (la clave la carga Sam en la pantalla o con un guion sin eco), correr P1–P8 y **borrar la bandeja** al terminar. P7 la deja con IMAP apagado más de 26 h | Chatwoot vivo |
| PC-2 | Revisión `revisar-datos-ve` del flujo `vzla@` → Chatwoot y la línea nueva del inventario de terceros. **Hecha el 2026-10-31:** [`revision-chatwoot-correo-2026-10-31.md`](../../legal/privacidad/revision-chatwoot-correo-2026-10-31.md) (5 hallazgos, 5 correctos, 4 no verificables) y fila nueva en `inventario-terceros.md` §2 bis | Repo (sin puerta de producción, pero antes de PC-3) |
| PC-3 | Crear la bandeja «Correo · vzla@» en Chatwoot sobre `vzla@` (la clave la carga Sam), con sus miembros y las reglas de §4.1 **creadas antes** de encender IMAP. La regla legal asigna a Sam: «Yo, Sam» (2026-11-03, en el chat del Director General; lo registra el Subdirector). Eso no crea la bandeja ni la autoriza | Chatwoot vivo |
| PC-4 | (Aparte, con PR) mandar los 4 avisos internos del ERP a los admins en vez de a `info@` | Código del ERP |

DNS y Hostinger: ninguna puerta, porque no hay cambio.

## 8. Decisiones para Sam

1. ~~Qué buzón lee Chatwoot~~: **`vzla@` completo** (2026-10-30).
2. Remitente de las respuestas: `vzla@` (recomendado) o `info@` (depende de P2).
3. Qué agentes son miembros de la bandeja de `vzla@`.
4. Si se hace PC-4 (sacar los avisos del ERP de `info@`).
5. ~~Cómo se ve el remitente de las respuestas~~: **el agente y la empresa** (2026-10-31, Sam en el chat del Worker: «Manuel DTD Cargo»). En PC-3 la bandeja va en `friendly` con `business_name` «DTD Cargo», y Chatwoot escribe «Manuel de DTD Cargo». Quitar el «de» pide cambiar la traducción `friendly_name`; queda como ajuste opcional.
6. Qué hacer con los rebotes y las respuestas automáticas, que las reglas no pueden tocar: resolverlos a mano o con una tarea periódica (§6.1).

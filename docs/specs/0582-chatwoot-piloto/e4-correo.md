# E4 · 4.8 — Bandeja de correo de `vzla@` (con `info@`) en Chatwoot (diseño)

- **Estado:** diseño. El diseño no cambió nada en Hostinger, Cloudflare ni Resend. En el Chatwoot vivo sí existe la bandeja temporal de PC-1 (§6.1), sin terminar; la bandeja de `vzla@`, PC-3, no está creada.
- **Tramo del 2026-11-07, sin tocar nada vivo:**
  - lectura pública del DNS (§5);
  - plan paso a paso de lo que falta (§6.2);
  - arreglo propuesto de P4, con su prueba, **sin instalar** (§6.3);
  - lista para Sam (§9) y allowlist del paso (§10).

  Lo encargó el Director General el 2026-11-07 a las 19:38Z.
- **Pedido:** Sam eligió conectar el correo el 2026-10-30, por selector y con su texto literal: «Correo (info@), Instagram, Messenger, TikTok». Lo trajo el Director de la sesión del programa, que me encargó este paso.
- **Rama:** `codex/0582-e4-correo`, con base `main` desde el 2026-11-05 (antes, apilada sobre `codex/0582-e1-chatwoot-vps`).
- **Etiquetas de evidencia:** C código, D proveedor documenta, T cuenta o host, R runtime, I inferencia, NV no verificado.

## 1. Lo que hay hoy

| ID | Afirmación | Fuente | Etiqueta |
|---|---|---|---|
| EC-1 | `info@` es un **alias** del buzón `vzla@`: lo que llega a `info@` cae en el INBOX de `vzla@`. No hay reenviadores ni comodín. El plan Premium Business Email tiene **2 de 2 buzones en uso** desde el 2026-10-29 (`vzla@` y `notificaciones@`) | C-10 del paso 0.5; T-33 de SDD-0583 | T |
| EC-2 | DNS de la raíz: MX a Hostinger, SPF `include:_spf.mail.hostinger.com ~all`, DKIM `hostingermail-a/b/c` publicado y DMARC `p=none`. Por el DNS, el correo que Hostinger manda por SMTP **puede** pasar SPF y DKIM alineados. Que pase de verdad no se leyó en ningún encabezado: se comprueba con «Mostrar original» (§5) | C-2, C-3 y C-5; T-40 de SDD-0583 (consultado otra vez el 2026-10-30 y el 2026-11-07, §5) | T (DNS) · NV (encabezado) |
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

**Lectura pública del 2026-11-07 a las 19:58Z.** Fue solo lectura, por DNS sobre HTTPS contra `dns.google` y `cloudflare-dns.com`, y los dos dieron lo mismo. Desde la PC, `Resolve-DnsName` contra 1.1.1.1 y 8.8.8.8 por el puerto 53 se quedó sin respuesta, así que no se usó. No se cambió nada en Cloudflare, Hostinger ni Resend.

| Nombre | Tipo | Qué hay | Qué significa para 4.8 | Etiqueta |
|---|---|---|---|---|
| `dtdcargo.com` | NS | `algin` y `brit.ns.cloudflare.com` | El DNS está en Cloudflare (C-1), no en Hostinger | T |
| `dtdcargo.com` | MX | `5 mx1.hostinger.com` y `10 mx2.hostinger.com` | El correo de `vzla@` y de `info@` entra por Hostinger | T |
| `dtdcargo.com` | TXT (SPF) | `v=spf1 include:_spf.mail.hostinger.com ~all` | Autoriza a Hostinger. Expandido da `relay.mail.hostinger.com` y `relay.mailchannels.net`, con 3 consultas de las 10 permitidas. Hostinger sale por MailChannels, y por eso el rebote de P4 vino de `mailchannels.net`. Chatwoot manda por `smtp.hostinger.com` (`.env.example`), así que no hace falta sumar la IP del VPS | T |
| `hostingermail-a._domainkey` | CNAME → TXT | Apunta a `hostingermail-a.dkim.mail.hostinger.com`, con una clave RSA publicada (`v=DKIM1;k=rsa;p=…`, 408 caracteres) | Hostinger puede firmar con `d=dtdcargo.com` | T |
| `hostingermail-b` y `hostingermail-c._domainkey` | CNAME → TXT | Publicados, con `p=` vacío | Selectores de reserva para que Hostinger rote la clave; una clave vacía es una clave revocada. Con qué selector firma hoy es **NV**: se ve en `DKIM-Signature: s=` de un correo de prueba | T · NV |
| `_dmarc.dtdcargo.com` | TXT | `v=DMARC1; p=none` | DMARC publicado que solo observa: no pide cuarentena ni rechazo, y **no tiene `rua`**, así que nadie recibe reportes | T |
| `send.dtdcargo.com` | MX y TXT | `10 feedback-smtp.us-east-1.amazonses.com` y `v=spf1 include:amazonses.com ~all` | Es de Resend, para los correos del ERP. No participa en 4.8 | T |
| `resend._domainkey` | TXT | Clave publicada | De Resend. No participa | T |
| `_dmarc.send.dtdcargo.com` | TXT | No existe | Hereda la política de la raíz (`p=none`) | T |
| `inbound.dtdcargo.com` | MX | No existe | Resend no recibe (EC-3); la opción B no lo necesita | T |
| `_mta-sts`, `_smtp._tls` y `default._bimi` | TXT | No existen | Son opcionales y 4.8 no los pide | T |

**Qué falta para 4.8:** nada en el DNS, ni para la opción B (la elegida) ni para la A. Las respuestas de Chatwoot salen por el SMTP de Hostinger, así que las cubren el SPF y el DKIM de Hostinger.

Lo que el DNS no dice es si un correo real sale con SPF, DKIM y DMARC en `pass` y alineados con `dtdcargo.com`. Eso se ve en el encabezado `Authentication-Results` de un correo que Sam recibió en su propia cuenta:
- Gmail: «Mostrar original»;
- Outlook o Hotmail: «Ver origen del mensaje».

Vale cualquier respuesta del chat de PC-1 (P2 o P3), y en PC-3 se repite con `vzla@` (§9, paso 1).

**Mejoras que no son de 4.8.** Cada una lleva su propio OK y su propio riesgo, porque también cubren a Resend y a la web:
- `rua` en DMARC, para recibir reportes. Sin reportes, nadie se entera si alguien manda correo falso con el dominio.
- Subir DMARC a `p=quarantine` después de unas semanas de reportes limpios.

## 6. Pruebas (primero en un buzón de prueba, nunca en `vzla@` sin OK)

Con la opción B no se compra buzón, así que no hay cupo para uno nuevo. **El buzón de prueba es `notificaciones@`**: es de DTD, tiene poco volumen y su usuario y clave SMTP ya están probados (SDD-0583). Se crea en Chatwoot una bandeja temporal «Correo · pruebas» sobre ese buzón, se corre P1–P7 escribiendo desde una cuenta personal de Gmail y al final **se borra la bandeja**, con sus conversaciones. Mientras exista, también entrarían las respuestas que la gente mande a los avisos del sistema: es poco y se borra con la bandeja.

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

Sam autorizó la prueba en el chat del Worker («Autorizo la prueba», 2026-10-30). La bandeja 3 «Correo · pruebas» (canal 1) se creó el 2026-10-30 a las ~21:20Z con `infra/chatwoot/correo/bandeja-prueba.rb crear`. Los correos de prueba vinieron de `vzla@` y de una cuenta de Hotmail, no de esa cuenta de Gmail. La evidencia se leyó con conteos, horas, dominios y prefijos de `Message-ID`: sin contenido ni direcciones completas.

| # | Resultado | Evidencia |
|---|---|---|
| P1 | **PASÓ** | Dos correos (de `vzla@` y de Hotmail) llegaron al buzón a las 21:27:10Z y 21:27:23Z; las conversaciones #6 y #7 se crearon a las 21:27:42Z y 21:27:43Z, con el asunto correcto |
| P2 | **PASÓ** (hilo y remitente); variante `info@` **NO EJECUTADO** | La respuesta del chat salió de `notificaciones@` a las 22:15:22Z (estado `sent`). La respuesta de Sam llegó a las 06:13:06Z del 31 y entró a la **misma** conversación #6 a las 06:13:21Z, con `in_reply_to` igual al `Message-ID` que generó Chatwoot (`conversation/…`). La variante de §4.1 (dirección distinta del usuario SMTP) no se puede probar en `notificaciones@`, que no tiene alias |
| P3 | Salida **PASÓ**; entrada de imagen en línea **PASÓ**; entrada de archivo adjunto **NO EJECUTADO** | 2026-10-31 09:53Z: respuesta del chat en #8 con un PDF (404 B) y una imagen PNG (21 KB), estado `sent` y sin error. Sam la recibió con los 2 adjuntos (22 KB) y mandó la captura. El correo «Privacidad prueba» llegó sin adjuntos (2 partes MIME: texto y HTML). Sam dijo dos veces que había contestado con adjuntos (10:3xZ y 18:1xZ), pero hasta las 18:18Z no llegó nada al buzón: se revisaron las 5 carpetas, sin filtro de fecha. A las 18:41:37Z llegó «RE: Privacidad prueba» (con IMAP de la bandeja ya apagado), pero tampoco trae archivos: su estructura MIME es `multipart/related` con texto, HTML y la imagen de la firma en línea (52 KB). Esa imagen sí entra. En los mensajes 14, 17 y 18, Chatwoot registra `number_of_attachments=1`, no crea adjuntos sueltos y deja el `<img>` sin `cid:`: lo sube y reescribe la referencia (`process_inline_attachments`, `app/mailboxes/mailbox_helper.rb:26`). Un PDF o una foto como archivo adjunto no se probó; queda para PC-3 |
| P4 | **Hallazgo** | El rebote de `mailchannels.net` («Undelivered Mail Returned to Sender») entró a las 21:23Z como conversación **aparte** (#5) con `auto_reply=true`; no se enhebra a la conversación saliente (#4). Ver el hallazgo de reglas abajo |
| P5 | **PASÓ** | Lectura IMAP en modo `EXAMINE`: lo que trajo Chatwoot sigue sin leer. Solo aparecen leídos los dos correos de `vzla@` que Sam abrió en el webmail |
| P6 | **PASÓ** (en ~12 h) | El buzón tiene activa la respuesta automática de Hostinger «Buzón solo de notificaciones», y Sam la recibió al escribir. No apareció ninguna conversación en cadena: cada correo de Sam creó su conversación y nada más |
| P7 | EN CURSO | IMAP de la bandeja 3 apagado el 2026-10-31 a las 10:34:39Z. Chatwoot busca con `SINCE (Time.zone.today - 1)` en UTC, así que lo que cuenta es el **cambio de fecha**, no las 26 h: los correos del 31 quedan fuera de la búsqueda solo si IMAP se enciende el **2026-11-02 después de las 00:30Z**. Entonces: `encender-imap`, comprobar que lo del 31 no entra solo, `recuperar 3` y comprobar que entra sin duplicar lo que ya estaba. La entrada de adjuntos de P3 se comprueba en esa misma recuperación. **Medido el 2026-11-05 a las 04:22Z (solo configuración): la bandeja 3 sigue con IMAP apagado.** Nadie lo encendió el 2026-11-02, así que PC-1 sigue abierta y la bandeja temporal sigue creada. Al retomar, `recuperar 3` ya no alcanza: el número tiene que cubrir desde el 2026-10-31 |
| P8 | «Legal» **PASÓ**; «no-cliente» lo bloquea el hallazgo | El correo «Privacidad prueba» llegó a las 09:50:09Z y creó la conversación #8 a las 09:50:14Z. La regla «Prueba correo · legal» le puso la etiqueta `prueba-legal` (09:50:18Z) y la prioridad urgente (09:50:20Z). La regla no asigna: en PC-3, la regla real lleva también `assign_agent` o `assign_team`. La conversación #3 (soporte de Hostinger) es un caso real de «no-cliente» |

**Hallazgo de reglas (P4/P8).** En Chatwoot 4.19.1, `AutomationRuleListener` ignora las conversaciones con `additional_attributes['auto_reply']` en `conversation_created` y `conversation_opened`, y los mensajes `auto_reply_email?` en `message_created`. Por eso **ninguna regla puede etiquetar ni resolver rebotes ni respuestas automáticas**: la regla «sistema» de §4.1 no sirve para eso. Opciones:
- (a) que el agente los resuelva a mano, porque son pocos;
- (b) que DTD los etiquete «sistema» y los resuelva solo. El 2026-11-07 quedó escrito y probado, sin instalar, como inicializador que actúa al crearse la conversación y no como tarea periódica (§6.3).

Decide Sam antes de PC-3.

**Nombre del remitente.** El cliente vio el correo del chat como «Servicio DTD Studio de Correo · pruebas <notificaciones@dtdcargo.com>». La bandeja está en modo `friendly` (el valor por defecto) y no tiene `business_name`, así que Chatwoot arma `%{sender_name} de %{business_name}` con el nombre del agente y el de la bandeja. En PC-3 hay que darle a la bandeja de `vzla@` `business_name` «DTD Cargo» y elegir el modo: `friendly` («Ana de DTD Cargo») o `professional` (solo «DTD Cargo»). Decide Sam.

**Respuesta automática.** Si el buzón que lee la bandeja tiene una respuesta automática encendida, el cliente que contesta un correo del chat recibe también esa respuesta. En `notificaciones@` es aceptable porque es temporal; en `vzla@` hay que confirmar que no tiene ninguna antes de PC-3.

### 6.2 Plan de lo que falta (2026-11-07)

Nada de esto corre sin el OK nominal que nombra cada paso. Las acciones son las de `infra/chatwoot/correo/bandeja-prueba.rb`, desde `/srv/chatwoot` en el VPS:

```bash
docker compose cp correo/bandeja-prueba.rb rails:/tmp/bandeja-prueba.rb
docker compose exec -T rails bundle exec rails runner /tmp/bandeja-prueba.rb <acción>
```

`estado` y `duplicados` imprimen solo ids, conteos, estados, etiquetas y dominios: nunca direcciones, asuntos ni contenido. `docker compose cp` y `exec` no recrean nada; `up` no se usa.

#### P7 · Caída de más de 1 día (bandeja 3, IMAP apagado desde el 2026-10-31 10:34:39Z)

OK nominal: «Enciende el IMAP de la bandeja de prueba y recupera desde el 31».

| Paso | Quién | Qué | Pasa si | No pasa si |
|---|---|---|---|---|
| 1 | Subdirector | `estado` y `duplicados` | IMAP en `false`. Se anotan los mensajes de #8 y los entrantes, con «Message-ID repetidos 0» | IMAP ya encendido: alguien lo tocó, y P7 se rehace desde otra fecha |
| 2 | Sam | Desde su cuenta personal, un correo nuevo a `notificaciones@` con asunto «P7 nuevo» y un PDF inventado como **archivo adjunto**, no pegado en el texto. Cubre también P3 | Lo ve en sus enviados | — |
| 3 | Subdirector | `encender-imap`, esperar 3 min y `estado` | «P7 nuevo» entra como conversación nueva y **#8 sigue igual**: «RE: Privacidad prueba» (2026-10-31 18:41:37Z) no entra solo (EC-11) | #8 crece sin recuperar. Entonces la búsqueda no es la de EC-11 y se relee el código antes de seguir |
| 4 | Subdirector | `recuperar N` y `duplicados`. N son los días desde el 2026-10-30 hasta hoy, en UTC: el 2026-11-08, N = 9. El día de más es margen por la zona horaria del servidor IMAP | #8 suma 1 mensaje, enhebrado. «Message-ID repetidos 0». Ninguna otra conversación ya traída crece | Aparece un repetido, o «RE: …» abre una conversación aparte |
| 5 | Subdirector | `apagar-imap`, salvo que P4 siga enseguida | IMAP en `false` | — |

`recuperar` exige el IMAP encendido (`should_fetch_email?` de `Inboxes::FetchImapEmailsJob`); por eso va después del paso 3. Trae también lo que alguien haya contestado a los avisos del sistema desde el 31 (§6): se cuenta por conversación, no se lee y se va con `borrar`.

#### P3 · Archivo adjunto de entrada (en el turno de P7)

- **Antes del vivo:** la sonda de §6.3 prueba en la imagen real, con datos inventados, que un PDF adjunto entra como 1 adjunto de tipo `file` (T5).
- **Pasa si** la conversación de «P7 nuevo» tiene `adjuntos=1` en `estado`, y Sam abre y descarga el PDF en el panel con el mismo tamaño.
- **No pasa si** llega sin adjunto. Entonces se mira la estructura MIME, solo tipos y tamaños y con OK, como en §6.1.
- El tamaño máximo sigue **NV**. Solo si Sam quiere, se prueba con un PDF inventado de unos 10 MB.

#### P4 · Rebotes

1. **Sam elige la decisión 6 (§8):** (a) a mano, o (b) el inicializador de §6.3, que es la recomendada.
2. **Con (b), puerta PC-5 (§7):** instalar en el Chatwoot vivo. Lo hace el Subdirector:
   - respaldo de Chatwoot antes;
   - copiar `correo/zz_dtd_correo_sistema.rb` a `/srv/chatwoot/correo/` y comparar su sha256 con el de `main`;
   - en el `compose.yml` del VPS (que no es el de `main`), sumar **solo** la línea de montaje en `rails` y en `sidekiq`. El correo lo procesa `sidekiq`;
   - recrear los dos con la receta del 2026-11-07: guardar antes `docker logs`, comparar el servicio contra `docker inspect` y correr `up -d --no-deps --force-recreate rails sidekiq`. Son 1 a 2 min sin panel. Para el reinicio de un inicializador ya montado, ver `.agents/handoffs/0583-logs-canales.md`;
   - crear la etiqueta «sistema» en la cuenta, si no existe.
   - **Pasa si** `docker logs --since` cuenta 1 línea «[DTD] correo automático activo» en `rails`, 1 en `sidekiq` y 0 «NO activo».
3. **Prueba en vivo.** OK nominal: «Manda la prueba de rebote». Es `rebote <dirección inventada>` en un dominio con MX nulo, como `@example.com` (MX `0 .`, RFC 7505): el servidor de salida no tiene a quién entregarlo y no contacta a nadie.
   - **Pasa si** en 3 min o menos el rebote es una conversación nueva con `estado=resolved`, `etiquetas=sistema` y la nota «Correo automático…». La conversación saliente sigue igual. El log dice «[DTD] correo automático: conversación N de la bandeja 3 …», sin direcciones.
   - **Y además** un correo normal de Sam en esa bandeja sigue abierto.
   - **No pasa si** el rebote queda abierto y sin etiqueta. Se quita el montaje (§6.3, «Cómo se quita») y se vuelve a (a).
   - Si Hostinger rechaza el envío en el momento, sin rebote (la salida queda `failed`), se repite con un buzón inventado que no exista en `dtdcargo.com`.
4. **Con (a)** no se instala nada: los agentes resuelven los rebotes a mano.

#### Cierre de PC-1

Con P3, P4 y P7 hechos, `borrar` (OK nominal: «Borra la bandeja de prueba»). **Pasa si** `estado` dice «sin bandeja de prueba» y quedan 0 canales con ese buzón. Las reglas y las etiquetas `prueba-*` se van con ella. La etiqueta «sistema» se queda, porque es la de PC-3.

#### PC-3 · Bandeja de `vzla@`

Antes de empezar:
- las decisiones 2, 3, 4 y 6 de §8;
- que `vzla@` no tenga respuesta automática (N4 de PC-2);
- el texto de `/privacidad` con H3 de PC-2.

El guion de esta bandeja **no está escrito**. Es otro `rails runner` como `bandeja-prueba.rb`, que crea primero las etiquetas y las reglas y después la bandeja con el IMAP apagado.

| Paso | Qué | Pasa si | No pasa si |
|---|---|---|---|
| 1 | Respaldo de Chatwoot | Respaldo del día con sus tres partes | — |
| 2 | Etiquetas «legal», «no-cliente» y «sistema». Reglas al crearse la conversación: «legal» (asunto con «Privacidad» o «Gerencia» → etiqueta, prioridad urgente y `assign_agent` a Sam), «sistema» (remitentes `noreply@` y `notificaciones@` de DTD → etiqueta y resolver) y «no-cliente» (lista inicial por dominio, armada con conteos) | Las 3 reglas activas y limitadas a la bandeja nueva | Alguna regla sin condición de bandeja: actuaría sobre WhatsApp |
| 3 | Si Sam eligió (b), el inicializador ya instalado (P4) | La línea «activo» en `sidekiq` | — |
| 4 | Bandeja «Correo · vzla@» con IMAP **apagado**, SMTP 587 STARTTLS, `business_name` «DTD Cargo», modo `friendly` y los miembros de la decisión 3. Sam carga la clave en la pantalla de la bandeja | La bandeja existe, IMAP `false` y 0 conversaciones | La clave llega por el chat o por un archivo: se cambia la clave en Hostinger |
| 5 | Encender el IMAP | En 5 min entran solo los correos desde el día anterior (C2 de PC-2). Se cuentan por dominio, sin direcciones | Entra correo de hace más de 2 días: alguien recuperó a propósito |
| 6 | P1 y P2 con `vzla@`: un correo de Sam desde su cuenta personal y la respuesta del chat | Conversación en 2 min o menos. La respuesta llega como «Manuel de DTD Cargo» desde la dirección elegida. «Mostrar original» dice SPF, DKIM y DMARC `pass` con `d=dtdcargo.com` (§5) | Algún `fail` o `softfail`: se mira el SPF o el selector DKIM antes de seguir |
| 7 | P3 (PDF de entrada y de salida), P5 (el webmail sigue sin leer), P8 (un correo de Sam con asunto «Privacidad» queda «legal», urgente y asignado a Sam) y N2 (un correo de Sam con una imagen remota: ¿la carga el panel?) | Las cuatro como dice §6 | — |
| 8 | Primera semana: conteo diario por dominio y por etiqueta (N1 de PC-2). Revisar una vez al día lo resuelto con «sistema», por si algo era de un cliente | La lista «no-cliente» se ajusta con conteos, sin guardar direcciones en Git | — |

**Vuelta atrás:** apagar el IMAP de la bandeja corta la entrada al momento. Borrar la bandeja borra lo copiado, y eso lo decide Sam.

### 6.3 Arreglo propuesto de P4: inicializador de correo automático (sin instalar)

**Qué es.** [`infra/chatwoot/correo/zz_dtd_correo_sistema.rb`](../../../infra/chatwoot/correo/zz_dtd_correo_sistema.rb), un inicializador de Rails como los de `rails/`. Antepone un módulo a `Imap::ImapMailbox`. Cuando el buzón acaba de **crear** una conversación con `auto_reply=true` y esa conversación sigue abierta, hace tres cosas: le pone la etiqueta «sistema», la resuelve y deja una nota en español que explica por qué.

**Por qué así y no de otra forma.** Lo que sigue se midió en el código de la etiqueta v4.19.1.
- **Por qué no una regla de Chatwoot:** `AutomationRuleListener` salta esas conversaciones en `conversation_created` (§6.1).
- **Por qué no una regla en `conversation_updated`, que sí las ve:** esa regla se volvería a disparar cuando una persona escribe en el hilo y Chatwoot reabre la conversación. Volvería a cerrar el mensaje de una persona.
- **Por qué no una tarea periódica:** levantaría Rails cada pocos minutos en un VPS con la CPU justa (T-40 de SDD-0583). El inicializador actúa dentro de la pasada de IMAP que ya existe.
- **Por qué se cambia el autor de la acción:** `Current.executed_by` pasa a ser la bandeja, como en los servicios de asignación de Chatwoot (`AssigneeActivityMessageHandler#activity_message_owner`). Sin eso, Chatwoot escribiría «resolved by system due to 0 minutes of inactivity», que es falso.

**Qué no toca:**
- una respuesta automática enhebrada a una conversación que ya existía;
- lo que nace resuelto (contacto bloqueado);
- las reglas de Chatwoot para todo lo demás.

No borra nada. Si después escribe una persona en ese hilo, Chatwoot reabre la conversación como siempre, y el inicializador no la vuelve a cerrar. Si una versión nueva quita `#process` o `#find_or_create_conversation`, no hace nada y lo dice en el log.

**Riesgo que queda.** Un correo real con `Auto-Submitted` distinto de `no`, por ejemplo el de un formulario automático de un tercero, queda resuelto con «sistema». Se mitiga de tres formas:
- la nota pide reabrirlo;
- la etiqueta «sistema» se revisa a diario la primera semana (PC-3, paso 8);
- el ERP no pone esa cabecera en sus avisos (`lib/`, sin coincidencias).

**Prueba.** [`infra/chatwoot/pruebas/prueba-correo-sistema.sh`](../../../infra/chatwoot/pruebas/prueba-correo-sistema.sh) corre en GitHub Actions ([`chatwoot-correo-sistema.yml`](../../../.github/workflows/chatwoot-correo-sistema.yml)), porque en la PC Docker levanta otros 22 contenedores. Usa la imagen real, Postgres y Redis del compose, la red `interna` sin internet y solo datos `example.test`. Mete los correos por `Imap::ImapMailbox#process`, el mismo camino de `FetchImapEmailsJob`, con los trabajos en línea:

| Caso | Correo | Con el inicializador (T) | Sin él (control C) |
|---|---|---|---|
| A | Rebote nuevo (`Auto-Submitted: auto-replied`), con la regla «Sonda · sistema» de P8 activa | `resolved`, `sistema`, 1 nota, 0 avisos de inactividad | **Abierto y sin etiqueta: el hallazgo P4 se reproduce** |
| B | Correo de cliente con asunto «Privacidad» | Abierto y con `prueba-legal` (la regla de Chatwoot sigue actuando) | Igual |
| C | Respuesta automática enhebrada a una conversación de cliente | En la misma conversación, abierta y sin etiqueta | Igual |
| D | Respuesta automática nueva por `X-Autoreply: yes` | `resolved` y `sistema` | Abierta |
| E | El rebote A otra vez (otra pasada de IMAP) | 1 mensaje y 1 nota: nada se repite | — |
| F | Contacto bloqueado: la conversación nace resuelta | No se toca: 0 notas y sin etiqueta | — |
| G | PDF como archivo adjunto (P3) | 1 adjunto `file` con bytes | Igual |
| H | Persona que escribe en el hilo de una automática, y otra automática después | Se reabre y sigue abierta | — |

El control **M0** carga la misma copia por otro camino (`SONDA_CARGAR`) y tiene que dar lo mismo que T. Cada uno de los **7 mutantes** quita una pieza y tiene que romper su comprobación:
1. la guarda de conversación nueva → H;
2. la de automático → B;
3. la de abierta → F;
4. el autor → aviso de inactividad;
5. la etiqueta → A;
6. resolver → A;
7. la nota → A.

Cada mutante comprueba antes que su `sed` cambió el archivo.

**Resultado:** NO EJECUTADO todavía. Corre en la PR de este tramo; el resultado se anota aquí con su SHA.

**Cómo se instala:** puerta PC-5 y P4, paso 2. Al instalarlo se suma también como pieza propia en `docs/runbooks/chatwoot-versiones.md`, con su sonda en cada subida de versión.

**Cómo se quita:** se borra la línea de montaje de `rails` y `sidekiq` y se recrean los dos. Lo ya etiquetado y resuelto queda como está.

## 7. Puertas (cada una con OK nominal de Sam, nombrando la operación)

| Puerta | Operación | Dónde |
|---|---|---|
| PC-1 | Crear la bandeja temporal «Correo · pruebas» sobre `notificaciones@` (la clave la carga Sam en la pantalla o con un guion sin eco), correr P1–P8 y **borrar la bandeja** al terminar. P7 la deja con IMAP apagado más de 26 h | Chatwoot vivo |
| PC-2 | Revisión `revisar-datos-ve` del flujo `vzla@` → Chatwoot y la línea nueva del inventario de terceros. **Hecha el 2026-10-31:** [`revision-chatwoot-correo-2026-10-31.md`](../../legal/privacidad/revision-chatwoot-correo-2026-10-31.md) (5 hallazgos, 5 correctos, 4 no verificables) y fila nueva en `inventario-terceros.md` §2 bis | Repo (sin puerta de producción, pero antes de PC-3) |
| PC-3 | Crear la bandeja «Correo · vzla@» en Chatwoot sobre `vzla@` (la clave la carga Sam), con sus miembros y las reglas de §4.1 **creadas antes** de encender IMAP. La regla legal asigna a Sam: «Yo, Sam» (2026-11-03, en el chat del Director General; lo registra el Subdirector). Eso no crea la bandeja ni la autoriza | Chatwoot vivo |
| PC-4 | (Aparte, con PR) mandar los 4 avisos internos del ERP a los admins en vez de a `info@` | Código del ERP |
| PC-5 | Solo si Sam elige (b) en la decisión 6: instalar `correo/zz_dtd_correo_sistema.rb` en `rails` y `sidekiq` (montaje solo lectura y recrear los dos, de 1 a 2 min sin panel) y probarlo con un rebote en la bandeja de prueba (§6.2, P4). Antes de PC-3 | Chatwoot vivo |

DNS y Hostinger: ninguna puerta, porque no hay cambio (§5, lectura del 2026-11-07).

## 8. Decisiones para Sam

1. ~~Qué buzón lee Chatwoot~~: **`vzla@` completo** (2026-10-30).
2. Remitente de las respuestas: `vzla@` (recomendado) o `info@` (depende de P2).
3. Qué agentes son miembros de la bandeja de `vzla@`.
4. Si se hace PC-4 (sacar los avisos del ERP de `info@`).
5. ~~Cómo se ve el remitente de las respuestas~~: **el agente y la empresa** (2026-10-31, Sam en el chat del Worker: «Manuel DTD Cargo»). En PC-3 la bandeja va en `friendly` con `business_name` «DTD Cargo», y Chatwoot escribe «Manuel de DTD Cargo». Quitar el «de» pide cambiar la traducción `friendly_name`; queda como ajuste opcional.
6. Qué hacer con los rebotes y las respuestas automáticas, que las reglas no pueden tocar: (a) resolverlos a mano o (b) el inicializador de §6.3, que los etiqueta «sistema» y los resuelve al entrar. **Recomendado: (b)**, porque deja la cola limpia sin depender de que alguien se acuerde, no borra nada y su riesgo queda a la vista en la etiqueta «sistema». Si elige (b), instalarlo es la puerta PC-5.

## 9. Lo que tiene que hacer Sam, en orden

Nada en Hostinger ni en Cloudflare: el DNS ya tiene lo que hace falta (§5). Ninguna clave pasa por el chat ni por el repo.

1. **Mirar un encabezado, sin tocar nada vivo.** En una respuesta del chat de PC-1 que le llegó a su cuenta personal, abrir «Mostrar original» (Gmail) o «Ver origen del mensaje» (Outlook o Hotmail).
   - **Tiene que ver** `spf=pass`, `dkim=pass` con `d=dtdcargo.com` y `dmarc=pass`.
   - Le pasa al Subdirector solo esas tres palabras y el `s=` del DKIM, no el correo.
2. **Dar el OK de P7:** «Enciende el IMAP de la bandeja de prueba y recupera desde el 31».
   - Justo antes, manda desde su cuenta personal a `notificaciones@` el correo «P7 nuevo», con un PDF inventado como archivo adjunto.
   - **Tiene que ver:** en el panel, bandeja «Correo · pruebas», la conversación «P7 nuevo» con el PDF, que abre y descarga. El Subdirector le pasa los conteos: la #8 crece en 1 solo después de recuperar, con 0 repetidos.
3. **Elegir los rebotes (decisión 6):** «a mano» o «el inicializador», que es el recomendado.
4. Si eligió el inicializador, **dar el OK de PC-5:** «Instala el inicializador de correo automático y reinicia Chatwoot».
   - **Tiene que ver:** el panel vuelve en 1 a 2 minutos.
5. **Dar el OK de la prueba de rebote:** «Manda la prueba de rebote». Es 1 correo de la bandeja de prueba a una dirección `@example.com`, que no entrega a nadie.
   - **Tiene que ver:** el rebote en «Resueltas» de esa bandeja, en 3 minutos o menos, con la etiqueta «sistema» y la nota «Correo automático…». En «Abiertas» no está.
6. **Dar el OK para borrar la bandeja de prueba:** «Borra la bandeja de prueba». Cierra PC-1.
   - **Tiene que ver:** «Correo · pruebas» ya no aparece en el panel.
7. **Antes de PC-3:**
   - responder las decisiones 2, 3 y 4 de §8;
   - mirar en hPanel → Correos → `vzla@` que la respuesta automática esté **apagada**. **Tiene que ver** el interruptor apagado.
8. **Dar el OK de PC-3** y cargar la clave de `vzla@` en la pantalla de la bandeja de Chatwoot.
   - **Tiene que ver:** la bandeja «Correo · vzla@» con el IMAP apagado y las reglas listas.
   - Después, su primer correo de prueba como conversación nueva en 2 minutos o menos (§6.2, PC-3).

## 10. Allowlist del paso 4.8

El paso 4.8 no tiene SDD hija: su allowlist vive aquí.

- `docs/specs/0582-chatwoot-piloto/e4-correo.md`
- `docs/specs/0582-chatwoot-piloto/checklist.md` (solo la fila 4.8)
- `infra/chatwoot/correo/bandeja-prueba.rb` (PC-1, 2026-10-30)
- `docs/legal/privacidad/revision-chatwoot-correo-2026-10-31.md` y `docs/legal/privacidad/inventario-terceros.md` (PC-2, 2026-10-31)
- `infra/chatwoot/correo/zz_dtd_correo_sistema.rb` (P4, 2026-11-07; sin montar en `compose.yml`)
- `infra/chatwoot/pruebas/{prueba-correo-sistema.sh,sonda-correo-sistema.rb,compose.correo-sistema.yml,compose.correo-sistema-control.yml}` (2026-11-07)
- `.github/workflows/chatwoot-correo-sistema.yml` (2026-11-07)
- `.agents/handoffs/0582-e4-correo.md` (2026-11-07)

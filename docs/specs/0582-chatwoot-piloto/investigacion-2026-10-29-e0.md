# Registro de evidencia E0 — SDD-0582 (2026-10-29)

Continúa el [registro del 2026-10-28](investigacion-2026-10-28.md). Mismas etiquetas: **C** (código), **D** (proveedor o documento), **T** (la cuenta o la infraestructura de DTD lo tiene, medido), **R** (probado en runtime), **I** (inferencia), **NV** (no verificado). Un **D(doc, fecha)** es un documento interno del repo: lo dice, no está medido hoy.

Fuentes de este registro:
- worktree `codex/0582-e0-preparacion` sobre `af3917a71`;
- respuestas de Sam en el chat del 2026-10-29;
- lectura de solo lectura del VPS del ERP (2026-10-29 05:20 UTC);
- DNS público por `dns.google` (2026-10-29).

No contiene datos personales, tokens ni valores de Meta. Los números de teléfono, los IDs de WABA y las URL de callback no se copian aquí aunque aparezcan en otros documentos.

## 0.2 — Decisiones de Sam

| ID | Decisión | Fuente | Etiqueta |
|---|---|---|---|
| E0-D1 | **Máquina: el VPS actual del ERP** (Contabo Cloud VPS 8, el que ya aloja la base de DTD), no un VPS 4 dedicado. Reemplaza la decisión G de la spec | Chat, 2026-10-29 | Decisión |
| E0-D2 | **Roles:** Sam administrador + 1 agente que ve y contesta todas las bandejas | Chat, 2026-10-29 | Decisión |
| E0-D3 | **Tope de gasto del bot: US$25 al mes**, con corte local duro que apaga el bot y pasa a humano | Chat, 2026-10-29 | Decisión |
| E0-D4 | **«Analiza mi contestación» vive en la IA de Kommo.** Se respalda en 7.3 antes del corte | Chat, 2026-10-29 | Decisión |
| E0-D5 | **Kommo vence el 29.05.2027**, con la renovación automática **activada**; el próximo cobro es el 26.05.2027 (plan Pro, 1 licencia paga, 1/1 en uso). El paquete de créditos de IA de 50.000 está caducado desde el 29.08.2026, sin renovación automática | Kommo → Ajustes → Facturación, leído en el Chrome de Sam el 2026-10-29 | T |

Consecuencias de E0-D5:
- el calendario del plan (15–19 semanas, del 2027-02-15 al 2027-03-15) termina unos 2,5 meses **antes** del vencimiento; la fecha probable del 2027-02-28 que suponía la spec queda descartada;
- para no pagar otro período, la renovación automática se desactiva antes del 26.05.2027, y solo después del acta de 8.6 (va con 8.12, con su OK nominal);
- si E8 se atrasa más allá de mayo de 2027, Kommo se renueva solo.

Sobre E0-D4: en Kommo no aparece ninguna función, agente ni Salesbot con ese nombre (K-15). La ubicación exacta se confirma con Sam en 7.3.

### Capacidad del VPS del ERP (para E0-D1)

| ID | Medida (05:20 UTC) | Etiqueta |
|---|---|---|
| VPS-1 | 8 vCPU, 24.031 MiB de RAM, 14.432 MiB disponibles, swap de 4 GiB casi sin uso (30 MiB) | T |
| VPS-2 | Disco `/`: 290 GB, 140 GB usados, 150 GB libres (49 %) | T |
| VPS-3 | 43 contenedores: DTD producción (14), DTD staging (13), Loop 3D (8), Rent Awada pruebas (7), Traefik, Uptime Kuma, cAdvisor y node-exporter | T |
| VPS-4 | Carga media 8,4–9,3 con 8 vCPU; `vmstat` da 67–81 % ocioso; presión de CPU (`/proc/pressure/cpu`) `some` 31 % a 5 min; presión de E/S `some` 1,9 % | T |
| VPS-5 | Ya hay un Uptime Kuma en el host (`ops-uptime-kuma`) que 1.6 puede reutilizar | T |
| VPS-6 | Chatwoot (Rails + Sidekiq + Postgres con pgvector + Redis) cabe en memoria con límites de unos 3–4 GiB | I |
| VPS-7 | El riesgo es la CPU, no la RAM: la presión `some` del 31 % indica esperas de CPU sostenidas antes de sumar Chatwoot | I |

Consecuencias para E1 (sin cambiar los días base):
- 1.1 lleva límites de CPU (`cpus`) y memoria por servicio, y prioridad menor que la de `dtd-cargo-*`;
- 1.5 debe mandar el respaldo de Chatwoot fuera del host: el VPS deja de ser solo el ERP y una caída se lleva las dos cosas;
- 1.6 mide, durante las 72 h, también la latencia del ERP y la presión de CPU antes y después;
- si 1.6 sale mal, el plan B es el VPS 4 dedicado de la decisión G original (vuelve a ser un cambio de alcance con OK de Sam).

## 0.3 — Meta (lo que se puede saber sin tocar nada)

| ID | Afirmación | Fuente | Etiqueta |
|---|---|---|---|
| M-1 | El ERP no tiene ninguna integración directa con Meta: no hay llamadas a `graph.facebook.com`, webhooks de Meta ni variables `WHATSAPP_*`, `META_*` o `FB_*` | `rg` en el worktree | C |
| M-2 | WhatsApp, Instagram y Messenger llegan al ERP solo a través de Kommo (`origin=waba`, `instagram`, `facebook`) | `supabase/functions/_shared/kommo-webhook-parse.ts:180,229,239` | C |
| M-3 | Hubo **dos WABA** conectadas a Kommo: la principal y una segunda sin uso desde enero de 2026; quedó pendiente decidir si se retira | D(`docs/runbooks/kommo-consolidacion-embudo-unico.md:244-252,309`, 2026-08-04) | NV |
| M-4 | El 2026-08-10 el portfolio comercial tenía cero apps de terceros y una automatización de Meta «Respuesta a comentario» activa en Messenger e Instagram | D(`docs/marketing/instagram-entrada.md:217-236`, 2026-08-10) | NV |
| M-5 | La alternativa de callback de una WABA se lee con `GET /<WABA_ID>/subscribed_apps` (devuelve `override_callback_uri`); la del número se fija con `POST /<PHONE_NUMBER_ID>` y `webhook_configuration`. El orden de prioridad es número → WABA → app | developers.facebook.com/docs/whatsapp/cloud-api/webhooks/override | D |
| M-6 | **Los callbacks y overrides no se ven en la interfaz de Meta.** Leerlos exige un token con acceso a la WABA, es decir, la app propia de DTD (4.1). Sin ella, el gate 0.3 solo cubre lo visible en Configuración del negocio y WhatsApp Manager | M-5 y M-1 | I |
| M-7 | No encontramos documentado un `GET` del override por número | Búsqueda del 2026-10-29 | NV |

### Lectura en Meta (2026-10-29, Chrome de Sam con el acceso de la oficina, solo lectura)

| ID | Afirmación | Fuente | Etiqueta |
|---|---|---|---|
| M-8 | La cuenta de Facebook de la oficina ve **un solo portfolio, «DTD Cargo»**, con 2 activos: 1 página de Facebook y 1 perfil de Instagram. Es de INVERSIONES DTD SERVICES, C.A., se creó en febrero de 2024 y está **sin verificar** | Configuración → Información del negocio y selector de portfolios | T |
| M-9 | En «DTD Cargo» hay **0 cuentas de WhatsApp, 0 cuentas de mensajes (Messaging accounts), 0 socios, 0 usuarios del sistema, 0 apps y 0 apps conectadas**. 2 personas con acceso total; la 2FA es obligatoria para administradores y 1 de las 2 todavía no la activó | Configuración → Cuentas, Usuarios, Integraciones y Centro de seguridad | T |
| M-10 | En «DTD Cargo», Facturación tiene 1 cuenta publicitaria activa con tarjeta y **0 cuentas de mensajes**: WhatsApp no se paga desde este portfolio | Facturación y pagos | T |
| M-11 | Messenger (página) e Instagram tienen **2 apps de socios conectadas: Kommo y Metricool**, sin rutas de enrutamiento configuradas | Integraciones → Enrutamiento de conversaciones | T |
| M-12 | El WhatsApp Manager de la cuenta de WhatsApp de las plantillas de Kommo responde «Este contenido no está disponible» con este acceso | URL directa del WhatsApp Manager | T |
| M-13 | Según Kommo, el **único número** conectado está en la cuenta de WhatsApp «Importador de China» (estado Aprobado), dentro de **otro portfolio de Meta, también llamado «Importador de China», que está Verificado**. Calidad Alta, límite de mensajes «Desconocido», método de pago «Activo», embudo Ventas DTD | Kommo → Centro de integraciones → WhatsApp Business → Configuración → detalle del número | T (vía Kommo) |
| M-14 | Para cerrar 0.3 hace falta acceso de administrador al portfolio «Importador de China». No se sabe quién lo tiene; Kommo muestra una cuenta de Facebook conectada a su integración | M-8, M-12 y M-13 | I |
| M-15 | La 2.ª WABA del 2026-08 (M-3) ya no aparece en Kommo: hay 1 solo número | Kommo, mismo panel | T |
| M-16 | Con otra sesión de Facebook, el Chrome de Sam entra al portfolio **«Importador de China»**. Ahí hay **2 cuentas de WhatsApp**: la del número principal y un número de prueba de Meta (+1 555…, «Test Number», 0 socios) | Configuración → Cuentas de WhatsApp, 2026-10-29 | T |
| M-17 | Cuenta del número principal: nombre visible aprobado («Logistica China Venezuela DTD»), estado Conectado, calidad **Alta**, límite de mensajes «No disponible»; 1 persona con acceso total, 0 con acceso parcial y **1 socio** | Mismo panel, pestaña Resumen | T |
| M-18 | El panel de la cuenta de WhatsApp tiene las pestañas del modelo nuevo: Socios, «Linked WhatsApp accounts», «Messaging accounts» y «Conversation routing» | Mismo panel | T |
| M-19 | Meta pide **verificar la cuenta del usuario** («Se necesita verificación») antes de seguir; el aviso tapa las pestañas. Esa verificación la hace Sam, no la IA | Mismo panel | T |
| M-20 | Tras la verificación de Sam, el panel del número muestra: **1 socio, Kommo, con control total**; **0 cuentas de WhatsApp vinculadas** (existe la opción «Vincular cuenta de WhatsApp», no se usó); **1 cuenta de mensajes vinculada, «Importador de China»**, con 1 persona con control total, 0 con control parcial y 1 socio | Cuentas de WhatsApp → número → Socios, «Linked WhatsApp accounts» y «Messaging accounts», 2026-10-29 | T |
| M-21 | El enrutamiento de conversaciones del número está vacío: Meta dice que hacen falta al menos 2 responsables y hoy solo está Kommo | Pestaña «Conversation routing» | T |
| M-22 | 1 persona con acceso total a la cuenta de WhatsApp (el usuario con el que entró Sam). El menú «⋯» de la cuenta ofrece «Asignar personas» y «Suprimir del portfolio empresarial»; se abrió solo para leerlo y no se eligió nada | Pestaña Personas y menú «⋯» | T |
| M-23 | La extensión de Chrome se desconectó un momento; al volver se completó la lectura (M-24 a M-31) | — | — |
| M-24 | «Importador de China» tiene **3 cuentas de mensajes**: «Importador de China» (la del número, 1 socio), «Test WhatsApp Business Account» (0 socios) y **«Door tu door»** (1 socio, Kommo, **0 cuentas de WhatsApp conectadas**: es la 2.ª WABA vieja de M-3, sin número) | Configuración → Cuentas de mensajes | T |
| M-25 | La cuenta de mensajes del número está **verificada y aprobada**, en USD, y tiene **método de pago propio: una Mastercard que coincide en los 4 últimos dígitos con la que paga la suscripción de Kommo** (tarjeta de DTD). «Door tu door» tiene la misma tarjeta | Cuentas de mensajes → Resumen | T |
| M-26 | Portfolio: 3 personas (2 sin actividad), **0 usuarios del sistema**, **1 app propia («Whats DTD»)** con 1 persona, 0 socios y **0 activos conectados** | Configuración → Personas, Usuarios del sistema y Aplicaciones | T |
| M-27 | **1 socio a nivel de portfolio, Kommo**, con acceso total a 4 activos de WhatsApp (las cuentas «Importador de China» y «Door tu door») | Configuración → Socios | T |
| M-28 | Centro de seguridad: **la 2FA no se le exige a nadie** («Nadie»); hay un administrador alternativo; 0 usuarios inactivos de 90 días o más | Centro de seguridad | T |
| M-29 | WhatsApp Manager: 1 cuenta de WhatsApp vinculada; número con nombre aprobado, sin nombre de usuario y sin cuenta empresarial oficial. Del 1 al 28 de octubre de 2026: 1.266 mensajes enviados y entregados, 2.103 recibidos y 1.003 de servicio gratuito | WhatsApp Manager → Números de teléfono → Insights y Perfil | T |
| M-30 | **5 plantillas activas** (3 Marketing y 2 Servicio), con un tope de 5 de 6.000; el tope de 6.000 corresponde a un portfolio verificado | WhatsApp Manager → Administrar plantillas | T |
| M-31 | El PIN de verificación en dos pasos del número **no se ve** en el panel nuevo, y los callbacks y overrides tampoco (M-6) | WhatsApp Manager | NV (se lee por API tras 4.1) |

**Decisión de Sam («Apruebo todo», 2026-10-29):** dejar el número en «Importador de China», sin migrarlo. Razones: el modelo nuevo no permite mover un número a otro portfolio, ese portfolio está verificado y separa WhatsApp de la publicidad. Chatwoot se conectaría ahí con su app (la existente «Whats DTD» u otra nueva), su usuario del sistema, su cuenta de mensajes y su pago.

Sobre D-1 y NV-2: **el modelo nuevo de Meta ya se ve en la cuenta** (pestañas «Cuentas de WhatsApp» y «Cuentas de mensajes», aviso «Updates to your account» al entrar). Según la documentación de los BSP:
- la cuenta de WhatsApp tiene el número y el perfil;
- la cuenta de mensajes tiene las plantillas, la facturación, los webhooks y el throughput de **una** integración;
- un mismo número se comparte con varias integraciones y cada una factura aparte;
- las plantillas **no pasan** de una cuenta de mensajes a otra;
- la migración fue de fines de septiembre a mediados de octubre de 2026 y los IDs, tokens y endpoints viejos siguen hasta el primer semestre de 2028.

Fuentes (D, consultadas el 2026-10-29): docs.360dialog.com/partner/onboarding/new-whatsapp-account-model (revisada el 2026-10-08), support.gupshup.io (artículo «New WhatsApp Account structure / WAME»), unifyport.ai y connect.bitbytecore.com. Los topes que citan las guías (por ejemplo, 2 socios por cuenta de mensajes o 250 plantillas sin verificar) son NV.

### Corrección de la spec (aprobada por Sam, «Apruebo todo», 2026-10-29)

La prohibición «nada de una 2.ª cuenta de mensajería en el mismo usuario del sistema» se escribió con el modelo viejo, donde una 2.ª WABA implicaba registrar el número otra vez. Con el modelo nuevo, Chatwoot (integración directa de Cloud API con la app de DTD) **tiene que** tener su propia cuenta de mensajes. Redacción propuesta:

- se permite **una** cuenta de mensajes propia de DTD para Chatwoot, en el portfolio «Importador de China», creada al compartir el número con la app de DTD (4.1 y 4.5);
- sigue prohibido crear una 2.ª **cuenta de WhatsApp** para el número, registrarlo de nuevo (`/register`), `/deregister` y Embedded Signup sobre el número principal;
- las 5 plantillas aprobadas de Kommo (K-19, M-30) **se recrean y se aprueban** en la cuenta de mensajes de DTD antes de 4.5; no se copian;
- la 2FA de «Importador de China» queda sin exigir por decisión de Sam (2026-10-29, «No quiero activar el verificador de dos pasos de importador de China. Déjalo así por ahora. Quítalo del checklist y avancemos»): riesgo aceptado (M-28);
- el método de pago propio de 0.7 va en la cuenta de mensajes de DTD, no en la de Kommo.

Aplicada en la decisión B y en las prohibiciones de la spec y de `instrucciones-ia.md`.

Por M-6, la lectura por API de suscripciones y overrides se hace justo después de 4.1 y antes de 4.2 y 4.5. Queda escrita como condición previa de 4.5 en el checklist. La guía está en [`e0-guias.md`](e0-guias.md#03).

## 0.4 — Kommo (lo que el repo ya sabe)

| ID | Afirmación | Fuente | Etiqueta |
|---|---|---|---|
| K-1 | Los «15 Salesbots» son 11 antiguos más 4 «Ping 23 h». Al 2026-10-15 estaban **todos apagados** | D(`docs/specs/0535-crm-kommo-mensaje-entrante/spec.md:110`, 2026-10-15) | NV hoy |
| K-2 | Los 11 antiguos **no tienen disparador** (solo NPS declara «Conversación cerrada»); 2 nunca corrieron. Su contenido (menú A–H, ruteo, pedido de datos) está inventariado | D(`docs/runbooks/kommo-salesbots-inventario.md:29-61`, 2026-08-06; leído del endpoint interno `GET /ajax/v4/bots/{id}`) | NV hoy |
| K-3 | La API v4 pública de Kommo **no expone Salesbots**; el editor visual no se puede exportar sin perderlo | Mismo documento, `:3-8` | D |
| K-4 | Los 4 «Ping 23 h»: disparador «23 h después del último mensaje entrante», uno por etapa; 2 escriben al cliente, 1 crea una tarea interna que vence en 1 h | D(`docs/marketing/kommo-consumo-y-limites.md:119-182`, 2026-08-13) | NV hoy |
| K-5 | Hay 4 agentes de IA de Kommo (Entrada, Cotizador, Reenganche, Post-venta), solo en el canal WhatsApp principal; se apagaron el 2026-10-15 por costo. Su texto completo está en el repo | D(`docs/marketing/agentes-ia-configuracion.md:263-666`; `0535/spec.md:115-119`) | NV hoy |
| K-6 | La base de conocimiento v7 está en el repo (DOCX y origen en texto). Tres fuentes de texto viven **solo en Kommo**, sin respaldo | D(`docs/specs/0062-crm-erp-cierres-automaticos/assets/`; `docs/runbooks/kommo-reconfig.md:79-83`) | NV hoy |
| K-7 | «Analiza mi contestación» no aparece en el repo (0 coincidencias); Sam dice que vive en la IA de Kommo | `rg` + E0-D4 | C + Decisión |
| K-8 | Integraciones ERP↔Kommo: 4 edge functions (`kommo-sync`, `kommo-webhook`, `kommo-writeback`, `kommo-push-client`), 2 pg_cron, 1 cron de Next, outbox con 8 operaciones y 12 tablas `kommo_*` más 2 columnas en `clients` | `supabase/functions/`, `0084:52`, `vercel.json:18`, `0365:54-57`, migraciones 0082–0391 | C |
| K-9 | Un segundo webhook de terceros (widgets nova-kommo) recibe notas de leads, contactos y compañías | D(`docs/runbooks/kommo-webhook-tercero-qp1-nova.md:9-33`, 2026-08-24) | NV hoy |
| K-10 | El alta web empuja a Kommo **en ensayo** salvo `KOMMO_PUSH_DRY_RUN="false"` | `supabase/functions/kommo-push-client/index.ts:109-110` | C (valor vivo: NV) |
| K-11 | Ningún código escribe UTM, `gclid` ni `fbclid` en Kommo; los campos existen solo en Kommo | D(`docs/marketing/kommo-campos-y-cartera.md:14-18`) + `rg` | C |
| K-12 | No hay inventario de plantillas de WhatsApp aprobadas por Meta en el repo | `rg` | C |

### Lectura en Kommo (Chrome de Sam, 2026-10-29, solo lectura)

| ID | Afirmación | Fuente | Etiqueta |
|---|---|---|---|
| K-13 | Los **15 Salesbots** están en la lista con los mismos nombres y todos aparecen atenuados (apagados). Los 4 «Ping 23 h» tienen el disparador «Último mensaje entrante» con una alerta roja, NPS tiene «Conversación cerrada» y los 10 restantes no tienen ninguno. Lanzamientos totales: 17, 368, 145 y 589 en los Ping; de 0 a 3.886 en los antiguos. Quedan 4 sesiones activas (2 en Carga marítima y 2 en Bienvenida) | Automatizaciones → Bots | T |
| K-14 | Los **4 agentes de IA** (Cotizador, Reenganche, asistente de ventas y Atención al cliente de comercio minorista) están apagados, sin canal, con última actividad el 15.10.2026. Créditos usados en el ciclo: 48 de 2.250 | Agente de IA | T |
| K-15 | Kommo Copilot, Respuesta sugerida de IA y Sugerencias de tareas de IA están **apagados**. Ninguna función se llama «analiza mi contestación» | Ajustes → Configuraciones de IA | T |
| K-16 | 7 fuentes de conocimiento: el DOCX v7, «DTD FAQ 1» y «DTD FAQ 2», la URL del sitio y 3 textos que **solo viven en Kommo** (Datos clave, Productos y servicios, Descripción del negocio), usados por el agente. Todas tienen 0 usos | Ajustes → Fuentes de conocimiento de IA | T |
| K-17 | 5 usuarios y 1 sola licencia paga (1/1 en uso) | Ajustes → Gestión de usuarios y Facturación | T |
| K-18 | Integraciones instaladas: WhatsApp Business, Instagram, Facebook, WhatsApp Lite, Google Business Messages, Twilio, Google, 3 widgets NOVA (tintado de leads, «no es un lead activo» y análisis de llamadas con IA), la integración privada del ERP («CRM a DTDCARGO.COM») y la de 0.6. Hay 1 webhook configurado | Centro de integraciones | T |
| K-19 | 7 plantillas de chat: 5 de WhatsApp **aprobadas** en la misma WABA (2 Utility y 3 Marketing: avisos de carga y reactivación) y 2 generales sin aprobación | Automatizaciones → Plantillas | T |
| K-20 | En los ajustes del espacio **no hay exportación ni copia de seguridad** de chats, ni reglas de borrado de archivos. Kommo avisa que algunas fuentes de chat no guardan los archivos de más de 5 MB si no se descargan a tiempo | Ajustes → Configuración del espacio | T |
| K-21 | Las plantillas aprobadas pertenecen a la WABA, no a Kommo: Chatwoot debería poder usarlas al conectar el mismo número | K-19 | I (se prueba en 4.5) |
| K-22 | En E5, algunos adjuntos viejos pueden no estar disponibles (K-20) | K-20 | I (se mide en 5.2) |

La matriz de paridad de fuentes de leads y la tabla de los 15 Salesbots están en [`e0-guias.md`](e0-guias.md#04).

## 0.5 — Correo

| ID | Afirmación | Fuente | Etiqueta |
|---|---|---|---|
| C-1 | **El DNS de `dtdcargo.com` está en Cloudflare** (NS `algin` y `brit.ns.cloudflare.com`) y la web pasa por su proxy. Los documentos que dicen «DNS en Hostinger» están desfasados | `dns.google`, NS y A, 2026-10-29 | T |
| C-2 | El MX de la raíz va a `mx1`/`mx2.hostinger.com`: el buzón sigue en Hostinger | `dns.google`, MX | T |
| C-3 | SPF de la raíz: solo `include:_spf.mail.hostinger.com ~all`. DMARC: `p=none` | `dns.google`, TXT | T |
| C-4 | Resend envía desde el subdominio `send.` (MX y SPF de Amazon SES) y tiene DKIM `resend._domainkey` publicado | `dns.google` | T |
| C-5 | El DKIM de Hostinger usa los selectores `hostingermail-a`, `-b` y `-c` (CNAME a `*.dkim.mail.hostinger.com`) y **está publicado** en Cloudflare. Hostinger marca en verde MX, SPF, DKIM y DMARC | hPanel → Emails → dtdcargo.com → Ajustes de dominio, y `dns.google`, 2026-10-29 | T |
| C-6 | `inbound.dtdcargo.com` **no tiene MX**: el subdominio receptor del runbook de Resend Inbound no está publicado | `dns.google`, MX | T |
| C-7 | El ERP recibe correo por `app/api/conversaciones/email/route.ts` (firma Svix, solo `email.received`). El consumidor guarda en `conversation_messages` si el remitente es un cliente; si no, lo descarta. No crea leads ni toca Kommo | `lib/studio/conversaciones/inbound-email.ts:205-273`; route `:143-153` | C |
| C-8 | Resend Inbound **no tiene ningún consumidor**: los 3 dominios de la cuenta tienen `receiving: disabled` y el único webhook apunta a `dtdcargo.com/api/webhooks/resend` con eventos de envío (`email.sent`, `delivered`, `bounced`, `complained`, `opened`, `clicked`, `failed`, `delivery_delayed`), no de recepción | API de Resend (`GET /domains` y `GET /webhooks`) desde el VPS con la llave del ERP, sin imprimirla, 2026-10-29 | T |
| C-13 | La cuenta de Resend del ERP también tiene los dominios `hailuway.com` y `loop3d.store` (los 3 verificados, región `us-east-1`); la llave del ERP los ve todos | Misma lectura | T |
| C-9 | `info@` nunca es remitente en el código; es destinatario de 4 avisos al equipo y se publica en la web | `lib/studio/contact-lead-notify.ts:49` y 3 más; `lib/design-tokens.ts:200` | C |
| C-10 | `info@` es un **alias** del único buzón real, `vzla@` (1/50 alias usados). Hostinger lo describe como dirección secundaria «para enviar y recibir». No hay reenviadores ni buzón comodín. Plan Premium Business Email, 1 de 2 buzones en uso, vence el 2028-05-21 con renovación automática | hPanel → Emails → dtdcargo.com (Buzones, Alias, Reenviadores, Catch-all), Chrome de Sam, 2026-10-29 | T |
| C-11 | Remitente de la app: `noreply@` con `reply_to` `comercial@` (fila sembrada en `mail_config`); el de Auth es `no-responder@` por SMTP de Resend | `supabase/migrations/0018_mailing.sql:407-423`; D(handoff 0505 `:357`) | C (valores vivos: NV) |
| C-12 | `app/studio/(app)/conversaciones/actions.ts:135-141` no responde por correo (decisión del 2026-07-05); la §6 de `docs/runbooks/setup-resend-inbound.md` está desfasada | Código | C |

Consecuencias:
- en 1.2 y 4.8, los registros DNS (`chat.`, SPF y DKIM nuevos) se cambian en **Cloudflare**, no en Hostinger; el OK de Hostinger de 4.8 cubre solo el buzón;
- `info@` es alias de `vzla@` (C-10): la bandeja de 4.8 conecta por IMAP/SMTP el buzón `vzla@`. Si responder como `info@` por SMTP falla (D-4 dice que los alias no envían desde aplicaciones externas; Hostinger dice que sí envían: NV, se prueba en 4.8), la salida es convertir `info@` en el 2.º buzón del plan, que está libre.

## 0.6 — Prueba de extracción de Kommo

**Puerta:** OK nominal de Sam en el chat del 2026-10-29, respuesta literal «Sí, OK para esa lectura» a la pregunta de leer por API, desde el VPS, los mensajes de hasta 20 conversaciones con el token del ERP, sin guardar su texto. Se corrió en el VPS con el token de Vault en memoria. En disco y en este registro solo quedan conteos. Ningún cuerpo de mensaje llegó a imprimirse: el endpoint los negó.

| ID | Resultado (2026-10-29, ~05:40 UTC) | Etiqueta |
|---|---|---|
| X-1 | `GET /api/v4/talks/{id}/messages` responde **403 «Invalid scope»** en las 20 conversaciones de la muestra (10 de WhatsApp y 10 de Instagram) | R |
| X-2 | El token del ERP tiene los alcances `crm`, `files`, `files_delete`, `notifications`, `push_notifications`, `users_activate`, `users_add` y `users_deactivate`. **No tiene el de historial de chats** y vence en unos 533 días | R |
| X-3 | `GET /api/v4/talks/{id}` sí responde 200 y trae `talk_id`, `chat_id`, `contact_id`, `entity_id`/`entity_type`, `origin`, `status`, `is_read`, `is_in_work`, `rate`, `source_id`, fechas y los leads y contactos enlazados. **No trae mensajes** | R |
| X-4 | **Enumeración:** los eventos `incoming_chat_message` dan el `talk_id` y el origen. 1.000 eventos (10 páginas de 100, 0,4–0,8 s por página) cubren 12,6 días y 220 conversaciones distintas: 183 de `waba` y 37 de `instagram_business` | R |
| X-5 | **Volumen:** 2.358 mensajes entrantes en los últimos 30 días (24 páginas), unos 79 al día | R |
| X-6 | **Profundidad:** hay eventos entrantes en ventanas de 30 días que empiezan hace 30, 90, 180, 365 y 730 días: el historial alcanzable tiene al menos 2 años | R |
| X-7 | Los eventos no traen el texto: sin el alcance de historial, el texto solo sale de la exportación nativa de Kommo | I (falta ver la exportación en 0.4, fila 7) |
| X-8 | Orden de magnitud del historial: unos 2.400 entrantes al mes; con los salientes, del orden de 10⁵ mensajes en 2 años | I |
| X-9 | Las cabeceras de límite de velocidad no aparecieron en las respuestas; 0,25 s entre llamadas no dio ningún 429 | R |
| X-10 | El formulario «Crear integración» de Kommo ofrece a una integración privada el alcance «Historial de chats externos», junto a «Acceder a la información de la cuenta», «Enviar a chats externos» y los de archivos, usuarios y notificaciones. Crearla pide un logo de 400×272 y un código enviado al correo de la cuenta | T |
| X-11 | El token de la integración nueva tiene los alcances `list_external_messages` y `crm`, y vence en 100 días | R |
| X-12 | Con ese token, `GET /api/v4/talks/{id}/messages` responde **200 en las 20 conversaciones** de la muestra (10 de WhatsApp y 10 de Instagram), en 0,68 s como máximo | R |
| X-13 | Campos del mensaje: `id`, `chat_id`, `type`, `message_type`, `text`, `created_at`, `sec_created_at`, `delivery_status`, `origin`, `author` (`id`, `type`, `name`, `user_id`, `avatar_url`), `recipient` (igual) y `attachment` (`type`, `file_name`, `link`). Alcanzan para conservar autor, fecha y adjuntos en 5.5 | R |
| X-14 | En la muestra: 67 mensajes (46 entrantes y 21 salientes); autores `external` 46, `internal` 20 y `bot` 1; 3 adjuntos de tipo `picture`. Una conversación cubre 87 días | R |
| X-15 | **Paginación:** sin parámetros, `talks/{id}/messages` devuelve la conversación entera (se vieron 134, 86 y 20 mensajes en una sola respuesta); no hay tope de 10. Con `limit` + `page` pagina y trae `_links.next`/`prev`/`first`; cuando no hay más, responde **204**. `page` sin `limit` da 204 en la página 2, y `offset` y `page[limit]` se ignoran. `limit=250` devolvió los 134 mensajes de la más larga | R |
| X-16 | Medición de la paginación: con un 2.º OK nominal de Sam («Sí, autorizo» a revisar hasta 80 conversaciones solo para contar la primera página y leer completas hasta 5 de más de 10 mensajes, solo conteos). Se revisaron 80 y se recorrieron 5. El token se borró al terminar (comprobado) | R |
| X-17 | En los eventos de los últimos 13 días no aparece ninguna conversación de Messenger (solo `waba` e `instagram_business`); la muestra no cubre Messenger | R |

**Integración nueva (2026-10-29, ~07:00 UTC):** con el OK de Sam («Sí, créala» a «crear en Kommo una integración privada con alcance de historial de chats, solo para repetir la prueba de 0.6»), se creó «DTD 0582 historial (solo lectura)» con solo dos alcances: información de la cuenta e historial de chats externos. Se escribió el código de verificación y la integración aparece en la lista de Kommo (T, ~07:30 UTC). El token de larga duración **no se ha generado ni pasado al VPS**: el procedimiento quedó en pausa hasta hacerlo con Sam en vivo. La IA no debe verlo: Sam lo pega directo en el VPS (`/dev/shm`). Se revoca al cerrar E5.

**Token y prueba (2026-10-29, ~08:20 UTC):** Sam generó el token y lo mandó al VPS desde su portapapeles (`Get-Clipboard | ssh …`); la IA no lo vio. La prueba lo borró de `/dev/shm` al terminar (comprobado). En disco y aquí solo quedan conteos y nombres de campo.

**0.6 entregado.** Alcance (X-1, X-11), enumeración (X-4), volumen y profundidad (X-5, X-6), campos (X-13) y paginación (X-15) medidos en runtime. Para E5: enumerar por eventos `incoming_chat_message` y `outgoing_chat_message`, leer cada conversación con `limit` y `page` hasta el 204, y guardar `id` de Kommo para que la carga sea idempotente. Se generaron 3 tokens de 100 días para esta prueba; ninguno quedó guardado. La integración se revoca al cerrar E5. Si Kommo no concede ese alcance a una integración privada, E5 se rehace sobre la exportación nativa (decisión con Sam, posible cambio de alcance).

## Reestimación (cierre de E0, parcial)

| Paso | Base | Restante reestimado | Motivo |
|---|---|---|---|
| 6.7 | 2 | 0,75 | K-1, K-2 y K-4: 11 bots sin disparador y los 15 apagados. Solo hay que reemplazar el aviso de ventana de 24 h (4 bots «Ping 23 h») y pasar el contenido útil del menú A–H a la base de conocimiento de 7.4 |
| E5 (5.1–5.8) | 7,75 | 7,75 | **Ratificado por 0.6.** La integración con alcance de historial ya existe y funciona (X-11, X-12); la paginación es simple (X-15); el volumen (X-5, X-8) cabe en un extractor incremental. El trabajo extra de la integración se hizo en 0.6. Riesgo que queda: Messenger sin muestra (X-17). El ERP no espeja el contenido de los mensajes (C, migración 0391) |
| 7.3 | 0,5 | 0,5 | Hay que respaldar 3 fuentes de texto y «analiza mi contestación», que viven solo en Kommo (K-6, E0-D4) |
| 7.4 | 1,5 | 1 | La base v7 y los textos de los 4 agentes ya están en el repo (K-5, K-6) |
| 7.1 | 1 | 1 | El tope de US$25 (E0-D3) no cambia el trabajo |
| Resto de E7 | 13,5 | 13,5 | Sin evidencia nueva |

Los días base no cambian: cambiar el peso exige la línea base v2 y el OK de Sam. Lo de arriba solo mueve «Días restantes».

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
| E0-D5 | **Renovación de Kommo:** Sam la mira en Kommo (Configuración → Facturación). El repo solo tiene «Pro, 1 licencia, renueva 29.08.2026» | D(`docs/marketing/kommo-estado-y-pendientes.md:68`, 2026-08) | NV |

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

La matriz de paridad de fuentes de leads y la plantilla de los 15 Salesbots están en [`e0-guias.md`](e0-guias.md#04).

## 0.5 — Correo

| ID | Afirmación | Fuente | Etiqueta |
|---|---|---|---|
| C-1 | **El DNS de `dtdcargo.com` está en Cloudflare** (NS `algin` y `brit.ns.cloudflare.com`) y la web pasa por su proxy. Los documentos que dicen «DNS en Hostinger» están desfasados | `dns.google`, NS y A, 2026-10-29 | T |
| C-2 | El MX de la raíz va a `mx1`/`mx2.hostinger.com`: el buzón sigue en Hostinger | `dns.google`, MX | T |
| C-3 | SPF de la raíz: solo `include:_spf.mail.hostinger.com ~all`. DMARC: `p=none` | `dns.google`, TXT | T |
| C-4 | Resend envía desde el subdominio `send.` (MX y SPF de Amazon SES) y tiene DKIM `resend._domainkey` publicado | `dns.google` | T |
| C-5 | No encontramos el DKIM de Hostinger en los selectores habituales (`hostingermail1-3`, `default`) | `dns.google` | NV (puede usar otro selector) |
| C-6 | `inbound.dtdcargo.com` **no tiene MX**: el subdominio receptor del runbook de Resend Inbound no está publicado | `dns.google`, MX | T |
| C-7 | El ERP recibe correo por `app/api/conversaciones/email/route.ts` (firma Svix, solo `email.received`). El consumidor guarda en `conversation_messages` si el remitente es un cliente; si no, lo descarta. No crea leads ni toca Kommo | `lib/studio/conversaciones/inbound-email.ts:205-273`; route `:143-153` | C |
| C-8 | Por C-6 y C-7, Resend Inbound **no tiene hoy ningún consumidor activo** en el ERP | C-6 + C-7 | I (falta ver el panel de Resend) |
| C-9 | `info@` nunca es remitente en el código; es destinatario de 4 avisos al equipo y se publica en la web | `lib/studio/contact-lead-notify.ts:49` y 3 más; `lib/design-tokens.ts:200` | C |
| C-10 | `info@` es un alias de Hostinger que reenvía al buzón real `vzla@` | D(`docs/marketing/identidad.md:134-161`, 2026-08-19) | NV |
| C-11 | Remitente de la app: `noreply@` con `reply_to` `comercial@` (fila sembrada en `mail_config`); el de Auth es `no-responder@` por SMTP de Resend | `supabase/migrations/0018_mailing.sql:407-423`; D(handoff 0505 `:357`) | C (valores vivos: NV) |
| C-12 | `app/studio/(app)/conversaciones/actions.ts:135-141` no responde por correo (decisión del 2026-07-05); la §6 de `docs/runbooks/setup-resend-inbound.md` está desfasada | Código | C |

Consecuencias:
- en 1.2 y 4.8, los registros DNS (`chat.`, SPF y DKIM nuevos) se cambian en **Cloudflare**, no en Hostinger; el OK de Hostinger de 4.8 cubre solo el buzón;
- si `info@` es alias (C-10), Chatwoot no puede enviar como `info@` por SMTP (D-4): la bandeja de 4.8 conecta el buzón real y responde con «enviar como» o pasa `info@` a buzón.

## Reestimación (cierre de E0, parcial)

| Paso | Base | Restante reestimado | Motivo |
|---|---|---|---|
| 6.7 | 2 | 0,75 | K-1, K-2 y K-4: 11 bots sin disparador y los 15 apagados. Solo hay que reemplazar el aviso de ventana de 24 h (4 bots «Ping 23 h») y pasar el contenido útil del menú A–H a la base de conocimiento de 7.4 |
| E5 (5.1–5.8) | 7,75 | 7,75 | Sin cambio hasta 0.6: el volumen, el plan y el alcance de `talks/{id}/messages` no se han medido. El ERP no espeja el contenido de los mensajes (C, migración 0391), así que todo el historial sale de Kommo |
| 7.3 | 0,5 | 0,5 | Hay que respaldar 3 fuentes de texto y «analiza mi contestación», que viven solo en Kommo (K-6, E0-D4) |
| 7.4 | 1,5 | 1 | La base v7 y los textos de los 4 agentes ya están en el repo (K-5, K-6) |
| 7.1 | 1 | 1 | El tope de US$25 (E0-D3) no cambia el trabajo |
| Resto de E7 | 13,5 | 13,5 | Sin evidencia nueva |

Los días base no cambian: cambiar el peso exige la línea base v2 y el OK de Sam. Lo de arriba solo mueve «Días restantes».

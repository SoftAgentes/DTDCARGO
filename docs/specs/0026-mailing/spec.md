---
sdd: "0026"
title: "DoorTuDoor — Mailing & Notificaciones (Resend + templates + signatures + logs)"
status: approved
author: "founder"
created: 2026-05-24
updated: 2026-05-24
supersedes: null
superseded_by: null
related: ["0007", "0010", "0012", "0014", "0020", "0024", "0025"]
---

# DTD-0026 — Mailing & Notificaciones · Resend + Templates + Logs

> **Sistema de correo transaccional del Studio.** Reemplaza el `EmptyState`
> de `/studio/mailing` por 6 tabs operativas (Templates / Signatures /
> Compose / Rules / Config / Logs) con backend Resend, render de templates
> con variables, firmas por usuario, logs con tracking de aperturas/clicks
> via webhooks, y un endpoint server para que otros módulos disparen envíos.

---

## 1. Resumen en una línea

`/studio/mailing` expone catálogo de templates editables (subject + body
HTML + variables `{{name}}` tipo Handlebars), firmas por usuario, envío
manual desde compose, log de envíos con estado real de delivery, config
de Resend (API key, dominio verificado, blacklist) y reglas que cablean
eventos del ERP a templates. Cualquier módulo del Studio puede llamar
`sendEmail({ template, to, vars })` para disparar envíos transaccionales.

---

## 2. Scope

### Incluye

#### Schema (migración 0018)

- 5 enums:
  - `mail_channel`: `email` (V1) — `whatsapp` reservado para SDD-0021
  - `mail_category`: `operativo` / `comercial` / `cobranza` / `cliente` / `interno` / `sistema`
  - `mail_log_status`: `queued` / `sent` / `delivered` / `bounced` / `complained` / `opened` / `clicked` / `failed`
  - `mail_rule_event`: `shipment_created` / `shipment_arrived` / `quote_sent` / `quote_accepted` / `invoice_emitted` / `invoice_overdue` / `no_olvidar_recovery_requested` / `agent_run_failed`
  - `mail_signature_layout`: `minimal` / `card` / `corporate` / `inline` / `image_only`

- 6 tablas:
  - **`mail_templates`** (RLS por tenant):
    id uuid PK, tenant_id uuid FK,
    slug text unique-per-tenant (ej: `quote_sent`, `invoice_emitted`),
    name text NOT NULL, category mail_category NOT NULL,
    channel mail_channel default 'email',
    subject text NOT NULL (puede contener vars),
    body_html text NOT NULL,
    body_text text (auto-generado si null),
    variables text[] (lista de var keys que usa, ej: `["customer_name", "shipment_code"]`),
    lang text default 'es' (V1 solo es),
    active bool default true,
    metrics_sent int default 0, metrics_opened int default 0,
    metrics_clicked int default 0, metrics_bounced int default 0,
    test_recipient text (default de "Enviar prueba"),
    created_by uuid, updated_by uuid,
    created_at, updated_at, deleted_at

  - **`mail_signatures`** (RLS por tenant + user):
    id uuid PK, tenant_id uuid FK, user_id uuid FK auth.users,
    layout mail_signature_layout default 'card',
    full_name text NOT NULL, role_label text (ej: "Gerente Comercial"),
    phone text, email text, whatsapp text,
    avatar_url text, photo_url text,
    company_name text default 'DTD-Cargo',
    show_offices_link bool default true,
    custom_html text (opcional, override del layout),
    is_default bool default true (1 sola default por user),
    created_at, updated_at

  - **`mail_logs`** (APPEND-only, RLS por tenant):
    id uuid PK, tenant_id uuid FK,
    template_id uuid FK nullable (puede ser envío sin template),
    template_slug text (denorm para no perder ref si se borra template),
    sent_by uuid FK auth.users (quien disparó),
    to_email text NOT NULL, to_name text,
    cc text[], bcc text[],
    subject text NOT NULL,
    rendered_variables jsonb default '{}' (los vars usados al render),
    status mail_log_status default 'queued',
    resend_message_id text (id de Resend para tracking),
    error text (si status='failed'),
    sent_at timestamptz, delivered_at timestamptz,
    opened_at timestamptz, clicked_at timestamptz,
    bounced_at timestamptz, complained_at timestamptz,
    metadata jsonb default '{}' (ip, ua, source, etc.),
    created_at timestamptz default now()

  - **`mail_rules`** (RLS por tenant):
    id uuid PK, tenant_id uuid FK,
    event mail_rule_event NOT NULL,
    template_id uuid FK NOT NULL,
    recipient_kind text NOT NULL CHECK (recipient_kind IN ('client', 'internal', 'custom')),
    recipient_value text (email si custom, sino null),
    active bool default true,
    last_triggered_at timestamptz,
    trigger_count int default 0,
    created_by uuid, created_at, updated_at,
    UNIQUE(tenant_id, event, template_id, recipient_kind)

  - **`mail_config`** (1 row por tenant):
    tenant_id uuid PK FK,
    provider text default 'resend' (V1 solo resend),
    from_email text NOT NULL (ej: `noreply@dtdcargo.com`),
    from_name text NOT NULL default 'DTD-Cargo',
    reply_to text,
    daily_limit int default 1000,
    rate_per_minute int default 30,
    domain_verified bool default false,
    domain_verification_token text,
    test_mode bool default true (en true, envía solo a internal_test_email),
    internal_test_email text,
    updated_at, updated_by uuid

  - **`mail_blacklist`** (RLS por tenant):
    id uuid PK, tenant_id uuid FK,
    email text NOT NULL,
    reason text NOT NULL CHECK (reason IN ('bounce', 'complaint', 'manual', 'unsubscribe')),
    added_by uuid, added_at timestamptz default now(),
    notes text,
    UNIQUE(tenant_id, email)

- RPCs (2):
  - `mail_increment_template_metrics(p_template_id, p_field, p_amount)` →
    void (atómico, evita race en updates de metrics)
  - `mail_check_blacklist(p_tenant_id, p_email)` → bool (caché en cliente)

- RLS por tenant + user-scoped donde aplica:
  - `mail_templates`, `mail_logs`, `mail_rules`, `mail_config`, `mail_blacklist`:
    todas por `tenant_id = get_user_tenant_id()`.
  - `mail_signatures`: `user_id = auth.uid()` + tenant check.
  - `mail_logs`: INSERT solo via service_role (server actions / endpoint).
    UPDATE solo via service_role (webhook handler de Resend).

- Seed:
  - 8 templates iniciales para DTD-Cargo (cotización enviada / aceptada,
    factura emitida / vencida, embarque creado / arribado, recovery no-olvidar,
    bienvenida cliente).
  - `mail_config` row por tenant existente con `from_email='noreply@dtdcargo.com'`,
    `test_mode=true`, `internal_test_email='comercial@dtdcargo.com'`.

#### Lib runtime (`lib/studio/mail/`)

- `resend-client.ts` — wrapper `resend` SDK:
  - `getResendClient()` — singleton con `RESEND_API_KEY`
  - `sendViaResend({ from, to, subject, html, text?, replyTo?, tags? })`
    → `{ messageId }` o throw
  - Retry: 3 intentos exponential backoff para errores 5xx / network
  - Errores 4xx (validation, blacklist) → no retry, return error inmediato

- `template-renderer.ts` — engine de templates:
  - `renderTemplate(template, vars): { subject, html, text }` — reemplaza
    `{{var}}` por valor. Vars no provistas → mantiene placeholder + log warning.
  - `extractVariables(html): string[]` — parse del HTML para encontrar `{{x}}`
  - `validateVariables(template, vars): ValidationResult` — chequea que
    todas las requeridas estén presentes
  - NO usa Handlebars npm para evitar dep grande — implementación regex
    `{{[a-z_][a-z0-9_]*}}` (sin lógica condicional V1)

- `signature-builder.ts` — render de firmas:
  - `buildSignatureHtml(signature: MailSignature): string` — devuelve
    HTML de la firma según layout. 5 layouts del Brand Book:
    `minimal` (1 línea texto), `card` (foto + nombre + cargo + tel + email),
    `corporate` (logo DTD + datos completos + offices), `inline` (en línea
    con avatar), `image_only` (banner imagen sin texto, para campañas).
  - Layouts hardcoded en este file. Customización via `custom_html` field
    si user quiere algo único.

- `send-email.ts` — orchestrator de envío único:
  - `sendEmail({ tenantId, templateSlug?, to, vars?, subject?, html?, ccUser?, attachSignature? }):
      Promise<{ logId, status }>`
  - Flujo:
    1. Resolver template si `templateSlug` (sino requiere `subject` + `html`)
    2. Render vars contra body + subject
    3. Anexar firma del user si `attachSignature=true`
    4. Check blacklist → si está, log status='failed' + return
    5. Si `test_mode=true`, cambiar `to` → `internal_test_email`
    6. Insert mail_log con status='queued'
    7. `sendViaResend(...)` → update log con `resend_message_id` + `status='sent'`
    8. Si error → log status='failed' + error message
  - Idempotency opcional via `idempotency_key` (si se reintenta misma req)

- `webhook-handler.ts` — procesar callbacks de Resend:
  - `processResendWebhook(payload): void` — switch por `payload.type`:
    `email.delivered` → update log delivered_at + status
    `email.opened` → update log opened_at + increment template metrics
    `email.clicked` → update log clicked_at + increment template metrics
    `email.bounced` → update log + agregar a blacklist (auto)
    `email.complained` → update log + blacklist
  - Verificación HMAC del header `svix-signature` (Resend webhook)

#### Lib types & queries

- `lib/studio/mail-types.ts`:
  - 6 entity types
  - 5 enums + LABELS castellano-VE
  - badgeTone helpers por: category, log status, rule event, signature layout
  - Validators sin Zod:
    `validateCreateTemplateInput`, `validateUpdateTemplateInput`,
    `validateSendEmailInput`, `validateCreateSignatureInput`,
    `validateCreateRuleInput`, `validateUpdateConfigInput`
  - Helpers: `formatLogStatus`, `categoryDefaultSubject`, `slugFromName`

- `lib/studio/mail-queries.ts`:
  - `listTemplates(supabase, filters?)` — filtros category/channel/search/active
  - `getTemplate(supabase, id)` / `getTemplateBySlug(supabase, slug)`
  - `listSignatures(supabase, userId?)`
  - `getDefaultSignature(supabase, userId)`
  - `listLogs(supabase, filters?)` — paginado, default 100, orden DESC
  - `getLog(supabase, id)`
  - `listRules(supabase, event?)`
  - `getMailConfig(supabase)` — 1 row por tenant
  - `listBlacklist(supabase)`
  - `computeMailKpis(supabase)` — sent_30d, open_rate, bounce_rate, queued_now

#### Endpoint webhook (público con HMAC)

- `app/api/studio/mail/webhook/resend/route.ts`:
  - POST público (sin auth — Resend lo llama externamente)
  - Valida HMAC `svix-signature` con `RESEND_WEBHOOK_SECRET`
  - Si valid → `processResendWebhook(payload)` → 200
  - Si HMAC inválida → 401
  - Maneja replay: el `id` del evento se chequea contra dedup table o
    se ignora si `event.created_at < now() - 1h`

#### Pages (`app/studio/(app)/mailing/`)

- `page.tsx` — REFACTOR del placeholder: server component con tabs
  URL-state (`?tab=templates|signatures|compose|rules|config|logs`).
  Default `templates`.
- Cada tab renderiza un `_components/Mailing<Tab>Tab.tsx`.

#### Components (`app/studio/(app)/mailing/_components/`)

- `MailingKpisRow.tsx` (server) — 4 KPIs (Enviados 30d / Open rate / Bounce rate / En cola)
- `TemplatesTab.tsx` (server) — grid de TemplateCard + filtros + botón "Nuevo template"
- `TemplateCard.tsx` (server) — preview con icon canal + categoría + name + subject + idiomas + métricas
- `TemplateDrawer.tsx` (client) — editor: tabs Editor / Variables / Preview / Test send
- `TemplateEditor.tsx` (client) — split view: izq=HTML editor con autocompletar de vars, der=preview live con vars de ejemplo
- `TestSendModal.tsx` (client) — input email destinatario + send con vars de demo
- `SignaturesTab.tsx` (server) — lista de firmas del user logueado + preview de cada layout
- `SignatureEditor.tsx` (client) — form: layout select + campos según layout + preview live + "Establecer como default"
- `ComposeTab.tsx` (client) — form simple: to / subject / template select / body / "Adjuntar firma" / Send
- `RulesTab.tsx` (server) — tabla de reglas: evento + template + recipient + activa + último disparo + trigger count
- `RuleDrawer.tsx` (client) — crear/editar regla
- `ConfigTab.tsx` (server) — sidenav 220px + content (similar a admin): Proveedor / Límites / Blacklist / Branding por cliente
- `ProviderConfigSection.tsx` — Resend API key (masked), domain verification status, from_email, test_mode toggle
- `LimitsSection.tsx` — daily_limit + rate_per_minute + slider
- `BlacklistSection.tsx` — tabla emails + agregar manual + razón
- `LogsTab.tsx` (server) — tabla paginada: cuándo / template / destinatario / subject / status badge / "Ver detalle"
- `LogDetailModal.tsx` (client) — detalle: stats (delivered, opened, clicked) + rendered subject/html + error si fail
- `MailStatusBadge.tsx`, `CategoryBadge.tsx`

#### Server actions (`mailing/actions.ts`)

- `createTemplateAction` / `updateTemplateAction` / `softDeleteTemplateAction`
- `createSignatureAction` / `updateSignatureAction` / `setDefaultSignatureAction`
- `sendTestEmailAction(templateId, toEmail, vars)` — render + sendEmail
- `composeAndSendAction(formData)` — envío manual desde compose tab
- `createRuleAction` / `updateRuleAction` / `toggleRuleAction`
- `updateMailConfigAction`
- `addBlacklistAction(email, reason)` / `removeBlacklistAction(id)`

#### Sidebar
- **Sin cambios.** "Mailing" ya existe en `StudioSidebar.tsx:55`.

#### Env y deps
- `package.json`: `resend` (^4.x)
- `.env.example`:
  - `RESEND_API_KEY=re_...` — API key del proyecto Resend
  - `RESEND_WEBHOOK_SECRET=whsec_...` — secret para validar HMAC del webhook
  - `MAIL_DEFAULT_FROM_EMAIL=noreply@dtdcargo.com` — fallback si tenant no configuró
- DNS (acción del founder, NO en código): SPF + DKIM + DMARC para
  `dtdcargo.com` apuntando a Resend. Verificar dominio en Resend dashboard
  antes de salir de `test_mode`.

### NO incluye (diferidos)

- **WhatsApp Business API** (canal `whatsapp` en mail_channel) → SDD-0021.
  El enum está en V1 para forward-compat pero las tools/UI solo manejan `email`.
- **Multi-idioma** (en/zh) → V1 solo `lang='es'`. Cuando aparezca demanda
  real de clientes EN/ZH, agregar columna `body_html_en` + selector lang
  en envío.
- **Editor visual (drag & drop blocks)** estilo Mailchimp → V1 textarea
  HTML directa + preview. V2 considerar.
- **Adjuntos** (PDF factura, contrato) en envío → V1.5. Resend soporta
  attachments en API; falta UI.
- **Campañas masivas** (bulk a lista) → V2. V1 es transaccional 1-a-1.
- **A/B testing** de templates → backlog.
- **Open/click tracking opt-out** por destinatario → V1.5 (regla GDPR
  cuando se exporte a Europa).
- **Sync con Gmail/Outlook** del usuario → fuera de scope. Mailing del
  Studio es transaccional, no reemplaza al cliente de email personal.
- **Inbox unificado** (recibir replies dentro del Studio) → fuera de scope.
  Resend permite reply-to a email del user; las respuestas van al inbox real.
- **Triggers automáticos funcionales** (que las rules ejecuten al evento)
  → SDD-0021. V1 crea schema + UI pero no dispara. Cuando llegue pg_net
  + pg_cron de SDD-0021, cablear `mail_rules` a triggers Postgres.
- **Editor de signatures con custom_html visual** → V1.5. V1 layouts
  predefinidos + textarea `custom_html` opcional.
- **Métricas de delivery time / inbox placement / spam score** → V2.

---

## 3. Archivos a crear / editar

### Nuevos

```
docs/specs/0026-mailing/spec.md                         (este archivo)
supabase/migrations/0018_mailing.sql
lib/studio/mail-types.ts
lib/studio/mail-queries.ts
lib/studio/mail/
├── resend-client.ts
├── template-renderer.ts
├── signature-builder.ts
├── send-email.ts
└── webhook-handler.ts
app/api/studio/mail/webhook/resend/route.ts
app/studio/(app)/mailing/
├── page.tsx                                            (REFACTOR del EmptyState)
├── actions.ts
└── _components/
    ├── MailingKpisRow.tsx
    ├── TemplatesTab.tsx
    ├── TemplateCard.tsx
    ├── TemplateDrawer.tsx
    ├── TemplateEditor.tsx
    ├── TestSendModal.tsx
    ├── SignaturesTab.tsx
    ├── SignatureEditor.tsx
    ├── ComposeTab.tsx
    ├── RulesTab.tsx
    ├── RuleDrawer.tsx
    ├── ConfigTab.tsx
    ├── ProviderConfigSection.tsx
    ├── LimitsSection.tsx
    ├── BlacklistSection.tsx
    ├── LogsTab.tsx
    ├── LogDetailModal.tsx
    ├── MailStatusBadge.tsx
    └── CategoryBadge.tsx
scripts/seed-mail-templates.ts                          (UPSERT 8 templates)
tests/mailing/template-renderer.test.ts
tests/mailing/send-email.test.ts
tests/e2e/mailing.spec.ts
```

### Editados

```
package.json                          add resend dep
.env.example                          + RESEND_API_KEY + RESEND_WEBHOOK_SECRET + MAIL_DEFAULT_FROM_EMAIL
scripts/seed.ts                       call seedMailTemplates()
app/studio/(app)/admin/page.tsx       hacer que sección "Plantillas" linkee a /studio/mailing?tab=templates
```

---

## 4. Decisiones de diseño

### 4.1 Resend como provider único V1

**Por qué:** API simple, DX excelente, npm `resend` oficial, gratis hasta
100 emails/día (suficiente para arranque), $20/mes para 50K. Webhooks
HMAC-firmados (svix-signature) para tracking de delivery/open/click sin
implementación propia. No requiere AWS account ni configuración compleja.

Alternativas evaluadas:
- **Amazon SES**: más barato a escala ($0.10/1K), pero setup AWS, requiere
  S3 para bounces, no incluye webhooks de open/click built-in. Sobreingeniería
  para volumen actual.
- **Postmark**: similar a Resend, $10/mes 10K emails. Resend más nuevo y
  con mejor DX en Next.js.
- **Gmail SMTP**: viable para volúmenes chicos pero rate limits del personal
  account + no webhooks + auth OAuth complejo.

Migración futura: si Resend sube precio o satura volumen, abstraer en
`lib/studio/mail/resend-client.ts` ya está aislado — swap por `aws-sdk-ses`
sin tocar el resto del runtime.

### 4.2 Templates con `{{var}}` regex (sin Handlebars)

**Por qué:** Handlebars npm pesa ~50KB y trae lógica condicional / loops /
helpers que NO necesitamos V1. Una regex simple `{{[a-z_][a-z0-9_]*}}`
cubre el 100% de casos del Brand Book.

Trade-off: si V2 necesita `{{#if customer.tier === 'platinum'}}...{{/if}}`,
swap a Handlebars en ese momento. Hoy las templates son fijas con vars
flat (nombre, código, fecha, monto), sin condicionales.

### 4.3 `body_text` auto-generado de `body_html`

**Por qué:** Resend recomienda multipart MIME (text + html) para inbox
placement. Generar text manual es trabajo extra y se desactualiza.

V1: si user no provee `body_text`, lo derivamos del HTML con regex
`replace(/<[^>]+>/g, '')` + trim + normalize whitespace. No es perfecto
pero es legible. V2 considerar `html-to-text` npm si la calidad importa.

### 4.4 Tracking solo via webhook (no JS beacons)

**Por qué:** Resend ya implementa pixel tracking y link rewriting cuando
las features están en ON. El webhook nos manda los eventos confirmados.
NO insertamos beacons JS propios — eso es engineering extra y nos
acopla a un cliente específico.

Limitación: open tracking falla si destinatario bloquea imágenes (común
en Gmail con "Privacy Protection"). Lo aceptamos: open rate del 60-70%
es estándar industria post-Apple Mail Privacy.

### 4.5 `test_mode` por tenant default ON

**Por qué:** evita que un bug en código mande emails reales a clientes
durante desarrollo / staging / primera vuelta de QA. En `test_mode=true`,
TODO email se redirige a `internal_test_email` con prefijo `[TEST]` en
subject y banner "Este es un envío de prueba — destinatario original
era X".

Founder apaga `test_mode` cuando esté listo para producción real.
Después, mantenerlo OFF pero hay una env var `MAIL_FORCE_TEST=1` para
forzar test_mode en dev sin tocar DB.

### 4.6 Blacklist automática por bounce/complaint

**Por qué:** mandar a una address que rebotó/se quejó hace que el proveedor
nos baje la reputación de envío. Resend lo penaliza con throttling.

Flujo:
- Webhook `email.bounced` (hard bounce) → INSERT mail_blacklist
  con reason='bounce'
- Webhook `email.complained` → INSERT con reason='complaint'
- Pre-envío: `mail_check_blacklist(tenant, email)` → si true, log
  status='failed' inmediato sin llamar Resend

Manual remove: admin puede borrar del blacklist desde UI (ej: hard
bounce temporal por buzón lleno → cuando lo confirme con el cliente,
remover).

### 4.7 Logs append-only via service_role

**Por qué:** el log debe persistir incluso si el user no logueado lo
disparó (webhook de Resend no tiene JWT del user). Y el log NO se
modifica desde UI — solo se INSERTA en send + UPDATEA desde webhook
handler. Ambos van con service_role.

Audit: para que un user no pueda borrar logs propios (ej: cubrir
spam interno), la policy DELETE devuelve false para todos. Si V2
hace falta purgar logs viejos, hacerlo con un job admin separado.

### 4.8 Firmas: 5 layouts del Brand Book

**Por qué:** sin layouts, cada user inventa el suyo y la marca queda
inconsistente. 5 opciones cubre todos los casos (de "minimal" 1 línea
para internos, a "corporate" full con offices CN/VE para clientes
externos).

`custom_html` opcional para excepciones (ej: campaña con disclaimer
legal específico). V1 sin sanitizer del custom_html → trust al user
(uso interno). V1.5 agregar DOMPurify si se abre a tenants externos.

### 4.9 Reglas pendientes de cablear (schema + UI V1, triggers SDD-0021)

**Por qué:** las triggers automáticas requieren pg_net o webhook
infrastructure que llega en SDD-0021 (junto con agentes cron/event).
No tiene sentido duplicar esa infra solo para mailing.

V1: schema `mail_rules` listo + UI para crear/editar (founder configura
qué eventos disparan qué templates), pero las reglas NO se ejecutan
automáticamente. Cuando llegue SDD-0021, los triggers Postgres dispararán
las reglas configuradas con `pg_net.http_post` al endpoint
`/api/studio/mail/dispatch-rule`.

### 4.10 Variables del template como `text[]` declarativo

**Por qué:** para que el editor pueda autocompletar `{{customer_name}}`
y la UI pueda renderizar inputs de "vars de demo" para "Enviar prueba".

`extractVariables(html)` parsea el HTML al guardar y popula `variables`
en DB. UI usa esa lista para preview / validación / autocompletar.

### 4.11 Endpoint webhook con HMAC (Svix)

**Por qué:** sin verificación HMAC, un atacante puede falsear "delivered"
o "opened" llamando nuestro endpoint con payload arbitrario. Resend usa
Svix para firmar webhooks con `svix-signature` header.

Verificación: usar el SDK `svix` o reimplementar HMAC-SHA256. V1 usar
`svix` (es lightweight). Si el header está mal o el cuerpo no matchea
firma → 401.

Dedup: Svix puede reintentar el mismo evento. Usamos `id` del evento
en una tabla `mail_webhook_events_seen` (id + processed_at, índice
único). Si ya existe → skip silencioso. V1 podemos saltarlo si los
updates son idempotentes (ej: setear opened_at a now si null).

### 4.12 NO crear inbox unificado en el Studio

**Por qué:** recibir replies + threading + UI estilo Gmail es 3-6 SDDs
extras. NO es el core del producto.

Diseño: `from_email` del envío usa `reply-to` con email del user que
disparó (`commercial@dtdcargo.com` o el de la firma). Las respuestas
van al inbox real de Gmail/Outlook del operador. Si en V2 se quiere
centralizar, agregar IMAP polling — eso es SDD aparte.

---

## 5. Criterios de aceptación

### Funcional

- [ ] `/studio/mailing` carga con 6 tabs (Templates, Signatures, Compose, Rules, Config, Logs). Default `templates`.
- [ ] 4 KPIs top: Enviados 30d / Open rate / Bounce rate / En cola.
- [ ] Tab Templates muestra 8 templates seeded con: icon canal email + categoría + name + subject + idiomas chip + métricas (sent/opened/clicked).
- [ ] Click en template abre `TemplateDrawer` con editor HTML + preview live.
- [ ] Editor detecta `{{vars}}` y los muestra en panel lateral con valores de ejemplo editables.
- [ ] Botón "Enviar prueba" abre `TestSendModal` con `to` (default `internal_test_email`) + vars + Send.
- [ ] Test send con `test_mode=true` debe llegar al `internal_test_email` (no al `to` real, aunque sea distinto).
- [ ] Crear template nuevo desde botón header → drawer → save → aparece en grid + seed slug si no se provee.
- [ ] Tab Signatures muestra firmas del user con preview live + selector de layout.
- [ ] Editar firma con cambio de layout updatea preview en tiempo real.
- [ ] "Establecer como default" marca esta firma como `is_default=true` (y unset de las demás del user).
- [ ] Tab Compose: envío manual selecciona template, autocompleta vars con datos del cliente si linkeado, attach firma default.
- [ ] Tab Rules: crear regla `quote_accepted → quote_won_internal → recipient=internal` muestra info pero NO dispara (SDD-0021).
- [ ] Tab Config sidenav 220px con 5 secciones (Proveedor, Límites, Blacklist, Branding). Branding shows "Próximamente · V2".
- [ ] Tab Config Proveedor muestra `RESEND_API_KEY` masked, status del dominio verificado (badge wine si verified, warning si pending), botón "Test conexión" que hace ping a Resend API.
- [ ] Tab Logs tabla con últimos 100 envíos: hora relativa / template / to / subject / status badge con tono semántico.
- [ ] Click en log abre `LogDetailModal` con stats (delivered/opened/clicked timestamps), subject final renderizado, error si fail.
- [ ] Envío con email en blacklist NO llama Resend, log queda con status='failed' y error='blacklisted'.
- [ ] Webhook `email.bounced` agrega automáticamente al blacklist con reason='bounce'.
- [ ] Botón "Quitar de blacklist" en tab Config funciona y permite reintentar.

### Sistema

- [ ] `pnpm typecheck` exit 0
- [ ] `pnpm build` pasa
- [ ] `pnpm lint` pasa
- [ ] Migración 0018 corre limpia en Supabase + RLS verificada
- [ ] RLS: user de tenant A no ve templates/logs/firmas de tenant B (test manual con 2 tenants)
- [ ] Test unit de `renderTemplate` con: vars presentes, vars faltantes (warn pero render), HTML mal formado (no crash)
- [ ] Test unit de `sendEmail`: mock de Resend, verifica que en `test_mode=true` el `to` se reescribe a `internal_test_email`
- [ ] Test e2e Playwright: crear template → enviar prueba a inbox local (mailpit/maildev) → verificar status='sent' en logs
- [ ] HMAC del webhook valida correctamente con `svix-signature` y rechaza 401 si firma inválida
- [ ] Dedup de webhook: mismo `event.id` recibido 2 veces no duplica updates
- [ ] Componentes pasan revisión por agente `ui-ux-designer`
- [ ] BRAND-CHECK final: castellano-VE, sentence case en CTAs, badges en 6 tonos oficiales, sin emojis decorativos
- [ ] `docs/mailing/README.md` con guía de cómo agregar template / debuggear log fallido / rotar API key

---

## 6. Out of scope / open questions

### Out V1 (cubierto en sección 2)

WhatsApp, multi-idioma EN/ZH, editor visual drag&drop, adjuntos, campañas
masivas, A/B testing, opt-out tracking, sync Gmail/Outlook, inbox
unificado, triggers automáticos funcionales, editor visual signatures
custom_html, métricas avanzadas (delivery time, spam score).

### Open questions resueltas

- ✅ Provider → Resend (decisión founder 2026-05-24)
- ✅ Template engine → regex `{{var}}` (no Handlebars)
- ✅ Tracking → webhook HMAC, no JS beacons
- ✅ test_mode default ON
- ✅ Blacklist automática por bounce/complaint
- ✅ Logs append-only via service_role
- ✅ 5 layouts de firma del Brand Book
- ✅ Reglas: schema + UI V1, triggers en SDD-0021
- ✅ Inbox unificado fuera de scope

### Open questions diferidas

- **DNS setup**: el founder verifica dominio `dtdcargo.com` en Resend
  (agregar registros SPF + DKIM + DMARC) antes de mergear. Sin esto,
  los emails saldrán como spam.
- **`from_email` único por tenant** vs subdominio (`mail.dtdcargo.com`):
  V1 usar dominio raíz. Si en V2 se abre a tenants externos, ahí
  considerar subdominio por tenant.
- **Limit diario por tenant**: V1 hardcoded 1000. Cuando aparezca tenant
  que necesite más, agregar columna `mail_config.tier` con planes.
- **Retención de logs**: V1 sin TTL. Si crece >100K logs/mes, considerar
  archive mensual a S3 o purga >365 días (legal: retener IGTF / SENIAT
  relevantes).
- **GDPR / opt-out**: V1 no aplica (clientes VE). Si se exporta a EU
  algún día, agregar campo `subscribed` en blacklist + unsubscribe link
  obligatorio en footer del template.
- **API rate limit propio**: Resend tiene rate limit del API, pero
  podríamos sumar el nuestro per-tenant para evitar abuso interno.
  V1 confiar en Resend.

---

## 7. Plan post-SDD-0026

**SDD-0027** (depende de 0026) — Inbox unificado (si demand) o atajos
de mailing en otros módulos:
- "Enviar cotización por email" desde Cotizador
- "Cobrar factura" desde Facturación → template + auto-rule de seguimiento
- "Notificar arribo" desde Tracking

**SDD-0021** ya planeado — cuando llegue, cablear `mail_rules` con
triggers Postgres + pg_net.http_post al endpoint de dispatch.

**V2 grande** — campañas masivas + segmentación + editor visual + A/B.

---

## 8. Plan de implementación por fases

Para evitar PRs gigantes, dividir en fases mergeable por separado:

### Fase 1 — Schema + Types + Queries (NO crypto-sensitive, mergeable solo)
- Migración 0018_mailing.sql
- lib/studio/mail-types.ts
- lib/studio/mail-queries.ts
- scripts/seed-mail-templates.ts (8 templates seed)

### Fase 2 — Runtime Resend + endpoint webhook
- lib/studio/mail/* (resend-client, template-renderer, signature-builder,
  send-email, webhook-handler)
- app/api/studio/mail/webhook/resend/route.ts
- Deps: `resend` + envs en .env.example

### Fase 3 — Pages + Components (UI)
- app/studio/(app)/mailing/page.tsx (refactor) + 6 tabs
- 19 componentes en _components/
- actions.ts con 13 server actions

### Fase 4 — Tests + docs
- Unit tests (template-renderer, send-email)
- E2E tests (crear template → enviar prueba → ver log)
- docs/mailing/README.md

Cada fase typecheck + commit aislado. Fase 2-3 requieren `RESEND_API_KEY`
en .env.local — sin eso, send falla silenciosamente con log status='failed'
(útil para desarrollo sin gastar emails).

---
sdd: "0036"
title: "Bug Reporter · módulo interno de bug tracking con auto-captura técnica e integración Claude Code"
status: approved
author: "founder"
created: 2026-05-26
updated: 2026-05-26
supersedes: null
superseded_by: null
related: ["0024", "0026", "0028"]
---

# DTD-0036 — Bug Reporter · módulo interno de bug tracking

> **Sistema interno de reporte de bugs/mejoras/sugerencias dentro del propio
> ERP DTD Studio.** Reportador (María/Yiwu/Luis) reporta con FAB flotante;
> admin (Sam) triagea desde Kanban + tabla + drawer con auto-captura técnica
> (rrweb session replay + console + network). Integración Claude Code para
> resolver bugs vía `fix: BUG-XXXXX` y cerrar automático con webhook GitHub.

---

## 1. Resumen en una línea

`Botón FAB en /studio/*` abre modal de reporte → bug se guarda con folio
`BUG-XXXXX` + auto-captura técnica invisible → admin lo gestiona desde
`/studio/bugs` (Kanban + tabla + stats) → drawer con conversación + datos
técnicos + botón "Copiar prompt Claude Code" → commit `fix: BUG-XXXXX`
cierra el bug + notifica reportador en 4 canales (in-app + push + email + Telegram opcional).

---

## 2. Scope

### Incluye (Fase 1-6 · este SDD)

#### Schema (migración 0028_bug_reporter.sql)

**7 tablas** (todas con RLS por `tenant_id` excepto `user_notification_prefs` que es por `user_id`):

- **`bug_reports`** — entidad central · folio `BUG-XXXXX` autogenerado · 4 categorías (`error|improve|suggest|question`) · 4 severities (`baja|media|alta|critica`, solo aplica a error) · 6 estados (`nuevo|triaje|espera|progreso|resuelto|descartado`) · columna calculada `progress_pct` (0/25/40/65/100)
- **`bug_attachments`** — fotos del reportador (max 5 por bug, max 5MB cada una)
- **`bug_tech_data`** — auto-captura: console_logs JSONB + network_requests JSONB + session_replay_url + environment JSONB
- **`bug_messages`** — conversación admin↔reportador (author_type: `user|admin|system`)
- **`bug_timeline`** — activity log (new, review, work, commit, done, state_change)
- **`user_notification_prefs`** — 4 canales × eventos por usuario (default in-app+email ON, push+Telegram OFF)
- **`bug_notifications`** — outbox de notificaciones por user (in-app + push + email + Telegram)

**Enums** (en DB):
- `bug_category`: `error | improve | suggest | question`
- `bug_severity`: `baja | media | alta | critica` (solo `error`)
- `bug_state`: `nuevo | triaje | espera | progreso | resuelto | descartado`
- `bug_author_type`: `user | admin | system`
- `bug_notif_type`: `new_reply | state_change | resolved | critical_alert | duplicate_detected`

**RPCs**:
- `next_bug_folio(p_tenant_id)` → genera `BUG-XXXXX` (5 dígitos, secuencial por tenant)
- `bug_dedup_hash(p_module, p_url, p_stack_signature)` → sha256 para detectar duplicados
- `bug_advance_state(p_bug_id, p_new_state, p_actor)` → transición + auto-stamp timestamps + insert timeline + dispara notificación

**Triggers**:
- `bug_reports_dedup_trigger` → al insertar, calcula hash y matchea contra bugs vivos del mismo tenant (incrementa `duplicate_count` del original en vez de crear nuevo, si match exact)
- `bug_reports_updated_at_trigger` → auto-update timestamp

**Bucket Storage**:
- Reusa `receipt-photos` con prefijo `bug/<tenant>/<bug_id>/<timestamp>.<ext>` (sin bucket nuevo)
- Policy: reportador `INSERT/SELECT` solo su prefijo, admin SELECT todos del tenant

#### Server actions + endpoints

- `POST /api/studio/bugs` — crear bug (reportador) · llama next_folio + insert + auto-attach tech_data + insert timeline
- `GET /api/studio/bugs` — listar (filtrado por RLS · query params: state, category, module, reporter)
- `GET /api/studio/bugs/:id` — detalle (admin o dueño)
- `PATCH /api/studio/bugs/:id/state` — cambiar estado (admin) · llama bug_advance_state RPC + dispara notificación
- `POST /api/studio/bugs/:id/messages` — agregar mensaje al hilo
- `POST /api/studio/bugs/:id/attachments` — subir foto (max 5MB)
- `POST /api/studio/bugs/:id/take` — "Tomar bug" (admin) · estado→triaje + notif al reportador
- `GET /api/studio/bugs/:id/prompt` — genera prompt Claude Code (texto plano para copy)
- `POST /api/webhooks/github` — detecta commit `fix: BUG-XXXXX` en push + cierra bug automático

#### UI (cara reportador)

- **`BugFABButton`** componente global · botón flotante en bottom-right del Studio
- **`/studio/mis-bugs`** (page) — vista "Mis reportes" con cards (folio + título + estado + progress bar + timeline visual)
- **`BugReportModal`** — modal con form: título + descripción + categoría + severity (si error) + módulo (autodetect de URL actual) + drag/drop fotos (max 5)

#### UI (cara admin)

- **`/studio/bugs`** (page) — Kanban + tabla + stats (3 tabs)
- **`BugKanban`** — 5 columnas (nuevo · triaje · espera · progreso · resuelto) · drag entre columnas dispara advance_state
- **`BugTable`** — sortable + filtros (tipo · reportador · módulo)
- **`BugStats`** — 4 KPIs: total bugs / resueltos esta semana / tiempo promedio fix / top módulo
- **`BugDrawer`** — drawer 720px con 3 tabs:
  - **Conversación** — hilo + composer (admin replica)
  - **Datos técnicos** — console logs + network + replay player (rrweb) + environment
  - **Acciones** — "Tomar bug" + "Copiar prompt Claude Code" + cambiar estado + cambiar ETA + adjuntar commit URL

#### Auto-captura técnica (invisible)

- **`useBugTechCapture()`** hook montado en layout del Studio
- Captura:
  - 3 últimos errores de consola (vía `window.addEventListener('error')` + `unhandledrejection`)
  - 5 últimos network requests (intercepta `fetch` y `XMLHttpRequest` · solo URL + status + duration, NO body)
  - Buffer rolling rrweb (últimos 30s antes del reporte)
  - Environment snapshot: browser + OS + viewport + URL + módulo (path) + build sha (de `process.env.NEXT_PUBLIC_BUILD_SHA`)

#### Notificaciones · 4 canales

| Canal | Default | Cuándo |
|---|---|---|
| In-app (campanita) | ✅ ON | Todos los eventos |
| Push browser | ⚪ pide permiso al user | Cambios estado + respuestas |
| Email | ✅ ON | Bug resuelto + respuesta admin (vía Resend, depende SDD-0026 Fase 2) |
| Telegram | ⚪ solo admin | Solo bugs críticos |

Sonido (default ON) con beep Web Audio API · toggle persistido en `localStorage`.

#### Integración Claude Code + GitHub

- Botón "Copiar prompt" en drawer admin tab Acciones genera:
  ```
  Bug BUG-12345 reportado por María (operario CN) en /studio/cn:
  Título: "El drawer de nueva recepción no cierra al cancelar"
  Descripción: <...>
  Console errors: <...3 errores...>
  Network últimos requests: <...5 requests...>
  Replay rrweb: <url firmada Supabase Storage>
  Reproducir: <steps inferidos>
  ```
- Webhook `/api/webhooks/github` parsea push events buscando regex `fix: BUG-\d{5}` en commit messages · si match → llama bug_advance_state(id, 'resuelto') + setea commit_url

#### Roles autorizados a ver el FAB

Solo si `user_tenants.role` está en (`admin`, `commercial`, `operations`, `accounting`, `warehouse`, `support`) — es decir, **todos los roles internos**. **NUNCA** en el portal público ni en /m/* (operarios PWAs).

### Fuera de scope (V1)

- Anotación de fotos con markerjs2 (V2)
- Detección de DevTools (heurística poco confiable)
- Bloqueo screenshot web (no existe API real, ver memoria sdd-0025)
- Hilos públicos (cliente del portal viendo bugs)
- Asignación de bugs entre admins (V1 todos los bugs son del admin único Sam)
- SLA real con timer alertas (V1 muestra solo "días desde apertura")
- Reabrir un bug resuelto (V1 estado terminal · si vuelve a fallar, nuevo bug)
- Sync con GitHub Issues bi-direccional (V2 — V1 solo recibe commits)

---

## 3. Decisiones cerradas (NO renegociar — ver HANDOFF.md sec. 2)

### D1 · 4 categorías + severity solo en error
Severidad (baja/media/alta/crítica) **solo aplica a `error`**. Mejora/sugerencia/pregunta no tienen severidad.

### D2 · Engagement profesional, NO gamificación
**SÍ**: barra progreso, timeline visual, mensaje agradecimiento del admin, card "Tu impacto" con números.
**NO**: trofeos, medallas, estrellas, puntos, niveles, confetti, sonidos victoria.
**Razón**: María/Yiwu son profesionales adultos · esto es ERP corporativo, no Duolingo.

### D3 · Auto-captura SIEMPRE (sin opt-in)
El reportador NO sabe que se captura console/network/replay. Implícito al usar el ERP.
**Razón**: si pedís opt-in, nadie lo activa y los reportes son inútiles. Privacy mitigada porque es ERP interno, no público.

### D4 · Estado "Esperando info" pausa SLA
Cuando un bug pasa a `espera`, el reloj de "días desde apertura" se pausa.
**Razón**: no penalizar al admin si está bloqueado esperando respuesta del reportador.

### D5 · Detección automática de duplicados
Sistema agrupa por hash sha256(módulo + url + stack_signature). Muestra contador `×3` en la card del bug original en vez de crear bug nuevo.

### D6 · Folio BUG-XXXXX (5 dígitos)
**Razón**: humano-legible, ordenable, único por tenant. 5 dígitos = capacidad 99,999 bugs por tenant (suficiente).

### D7 · Brand Book v2.4 estricto
Tokens (`var(--*)`) del Brand Book v2.4 · NO hex hardcoded · 3 fuentes (Archivo + Archivo Black + JetBrains Mono · CJK Noto Sans SC si aparece) · NO emojis decorativos en UI · NO gradientes coloridos · NO glassmorphism.

### D8 · Reuso de bucket receipt-photos
NO crear bucket nuevo. Reusa `receipt-photos` con prefijo `bug/<tenant>/<bug_id>/`.
**Razón**: simplifica policies + ya tiene tamaño limits configurados.

---

## 4. Schema (migración 0028_bug_reporter.sql)

Ver `docs/design/studio/bug-reporter-v1.4.1/HANDOFF.md` sec. 5 para el SQL completo de las 7 tablas.

Highlights:

- `bug_reports.progress_pct` es columna GENERATED STORED basada en `state`
- `bug_reports.duplicate_hash` se calcula por trigger antes del insert
- `bug_attachments.size_bytes` con CHECK ≤ 5,242,880 (5MB)
- RLS: usuario solo ve SUS bugs (`reporter_id = auth.uid()`) · admin (`role = 'admin'` en `user_tenants`) ve todos los bugs del tenant

---

## 5. State machine

| De | A | Trigger | Quién | RPC |
|---|---|---|---|---|
| — | `nuevo` | "Reportar" desde FAB | Reportador (modal) | `POST /api/studio/bugs` |
| `nuevo` | `triaje` | "Tomar bug" | Admin (drawer) | `bug_advance_state` |
| `triaje` | `espera` | "Pedir info al reportador" | Admin | `bug_advance_state` |
| `triaje` | `progreso` | "Empezar a trabajar" | Admin | `bug_advance_state` |
| `espera` | `triaje` | Reportador responde | Sistema | trigger en `bug_messages` |
| `progreso` | `resuelto` | "Marcar resuelto" o commit `fix: BUG-XXXXX` | Admin o webhook | `bug_advance_state` |
| `*` (no terminal) | `descartado` | "Descartar" + motivo | Admin | `bug_advance_state` |
| `resuelto`/`descartado` | — | Terminal | — | — |

Transiciones bloqueadas por trigger guard `bug_reports_state_transition_guard`.

---

## 6. Riesgos y mitigación

| # | Riesgo | Severidad | Mitigación |
|---|---|---|---|
| R1 | rrweb session replay pesa MB → bucket fill | Media | Compresión rrweb + retención 30 días + cleanup nightly |
| R2 | Auto-captura console/network captura passwords o tokens | **Alta** | Sanitizer regex en captura (Authorization headers redacted, query params con `token=` redacted) |
| R3 | Webhook GitHub spoofable | Alta | Verificación HMAC con secret env var `GITHUB_WEBHOOK_SECRET` |
| R4 | Push browser permissions denegadas → no notif | Baja | Fallback a in-app + email |
| R5 | Telegram bot caído → critical alert no llega | Media | Fallback a email + log warning · admin chequea Telegram health weekly |
| R6 | Reportador spam de bugs idénticos | Baja | Dedup por hash + rate limit 10 bugs/hora por user |
| R7 | rrweb player no carga en browser viejo | Baja | Fallback a "Ver datos" sin replay · solo console+network |

---

## 7. Open questions

1. **¿Retención de session replays?** V1: 30 días auto-delete. ¿Confirmás?
2. **¿GITHUB_WEBHOOK_SECRET via Vault o env var?** V1: env var directo. Si Vault listo (SDD-0025 Fase 2), migrar.
3. **¿Push subscription guardada por user-agent o por user?** V1: por user (overwrites si cambia browser).
4. **¿Telegram bot único para todo el tenant o uno por user?** V1: uno por tenant (el chat_id del admin). User puede setear su propio chat_id en prefs.

---

## 8. Fases de implementación (12-14 días)

| Fase | Qué | Estimado |
|---|---|---|
| **1** | DB + RLS + RPCs + endpoints API | 3 días |
| **2** | UI base reportador (FAB + modal + mis-bugs) | 2 días |
| **3** | UI admin (Kanban + tabla + stats + drawer) | 2 días |
| **4** | Auto-captura técnica (rrweb + console + network sanitizer) | 2 días |
| **5** | Notificaciones 4 canales (in-app + push + email + Telegram) | 3 días |
| **6** | Integración Claude Code + GitHub webhook | 1 día |

**Total: 13 días** ± 1 (buffer para QA + bugs).

**Dependencias externas**:
- SDD-0026 Fase 2 (Resend runtime) debe estar listo antes de Fase 5 email
- `NEXT_PUBLIC_BUILD_SHA` debe venir del build (Vercel inyecta `VERCEL_GIT_COMMIT_SHA`)
- GitHub webhook secret debe configurarse en repo settings antes de Fase 6

---

## 9. Origen y trazabilidad

- **Handoff completo:** [`docs/design/studio/bug-reporter-v1.4.1/HANDOFF.md`](../../design/studio/bug-reporter-v1.4.1/HANDOFF.md)
- **Mockup vigente:** [`docs/design/studio/bug-reporter-v1.4.1/proyecto/Bug_Reporter_Demo_v1.4.1_FIX.html`](../../design/studio/bug-reporter-v1.4.1/proyecto/Bug_Reporter_Demo_v1.4.1_FIX.html)
- **Diseño iterado en**: sesión 2026-05-26 a través de 8 versiones (v0.1 → v1.4.1)
- **Brand Book base:** v2.4 con tokens light + dark (módulo #15)

---

## 10. Naming de commits

```
feat(studio): SDD-0036 Fase N — <descripción corta>
```

Ejemplos esperados:
- `feat(studio): SDD-0036 Fase 1 — Schema + RLS + RPCs bug_reports`
- `feat(studio): SDD-0036 Fase 2 — BugFABButton + BugReportModal + /mis-bugs`
- `feat(studio): SDD-0036 Fase 4 — Auto-captura rrweb + sanitizer console/network`
- `feat(studio): SDD-0036 Fase 6 — GitHub webhook + Claude Code prompt generator`

---
sdd: "0036"
title: "Bug Reporter · módulo interno de bug tracking con auto-captura técnica e integración Claude Code"
status: done
author: "founder"
created: 2026-05-26
updated: 2026-07-04
supersedes: null
superseded_by: null
related: ["0024", "0026", "0028"]
implementation_commits:
  - "3e54aac feat(studio): Fase 1 backend"
  - "ef1391a feat(studio): Fase 2 UI reportador"
  - "f53ce40 feat(studio): Fase 3 UI admin"
  - "052d917 docs(spec): D9 cero automatizacion"
  - "66f4d7c fix(studio): codex review P1 fixes"
  - "fe63615 feat(studio): Fase 4 V1 captura + sanitizer"
  - "a7cae34 feat(studio): Fase 6 polish admin"
deferred:
  - "Fase 4.5 rrweb session replay (requiere pnpm add rrweb + storage upload)"
  - "Fase 5 P3: outbox durable enqueue→drain con retry/idempotencia + cron (V1 2026-07-04 dispara inline + escribe outbox para la campanita)"
confidencialidad: interno
---

# DTD-0036 — Bug Reporter · módulo interno de bug tracking

> **Sistema interno de reporte de bugs/mejoras/sugerencias dentro del propio
> ERP DTD Studio.** Reportador (María/Yiwu/Luis) reporta con FAB flotante;
> admin (Sam · humano) triagea desde Kanban + tabla + drawer con auto-captura
> técnica (rrweb session replay + console + network). Botón "Copiar prompt"
> arma contexto para asistirse con Claude Code, pero **el admin supervisa
> siempre** y decide manualmente cuándo cerrar. Cero automatización de cierre.

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
- `GET /api/studio/bugs/:id/prompt` — genera markdown listo para que el admin
  copie y pegue en Claude Code (asistencia, no automatización)

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

#### Asistencia al admin con Claude Code

- Botón "Copiar prompt" en drawer admin tab Acciones genera markdown listo
  para pegar en Claude Code (otro contexto, no este ERP):
  ```
  Bug BUG-12345 reportado por María (operario CN) en /studio/cn:
  Título: "El drawer de nueva recepción no cierra al cancelar"
  Descripción: <...>
  Console errors: <...3 errores...>
  Network últimos requests: <...5 requests...>
  Replay rrweb: <url firmada Supabase Storage>
  Reproducir: <steps inferidos>
  ```

**El admin (humano · Sam) supervisa siempre.** Claude Code propone fix, el
admin revisa el código, decide si aplicar, hace commit con
`fix: BUG-XXXXX — <resumen>` (sólo como convención de trazabilidad), y
**cambia el estado del bug a `resuelto` manualmente** desde el drawer.

**NO hay cierre automático.** No hay webhook GitHub que lea commits. No
hay agentes que cambien estado por su cuenta. Cualquier transición de
estado pasa por un click humano en `/studio/bugs`.

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
- Sync con GitHub Issues bi-direccional (V2 — y aún así nunca cierre automático)
- **Webhook GitHub auto-close** (descartado explícito · ver D9). Toda transición
  pasa por un humano en el drawer.
- Agentes IA que actúen sobre el ERP sin supervisión (descartado · sólo
  asistencia de Claude Code via "Copiar prompt", el admin aplica)

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

### D9 · Cero automatización de cierre · admin humano supervisa siempre (2026-05-26)

Decisión explícita del founder al revisar la spec original:

> "Claude no nos lo va a arreglar automáticamente; va a haber una supervisión
> de una persona. Lo que va a hacer Claude es darme la información que se
> requiere para resolver lo que él pensó o entendió."

**Implicaciones**:

- ❌ **NO existe `POST /api/webhooks/github`**. Si se commitea con
  `fix: BUG-XXXXX`, queda solo como convención de trazabilidad en git log;
  el bug NO cambia de estado solo. El admin debe ir a `/studio/bugs`,
  abrir el drawer del bug, y hacer click manual en "→ Resuelto".
- ❌ **NO hay agentes IA (SDD-0020) ni cron jobs que muevan bugs entre
  estados**. Cualquier transición pasa por click humano del admin.
- ✅ **SÍ existe botón "Copiar prompt para Claude Code"** en el drawer
  (`/api/studio/bugs/[id]/prompt`). Esto **NO es una integración**, es un
  helper de copy/paste para que el admin pegue contexto en Claude Code en
  otra ventana y se asista en investigar/proponer fix. La aceptación del
  fix y el cierre del bug son siempre del humano.
- ✅ La convención `fix: BUG-XXXXX — <resumen>` en commits sigue siendo
  útil para auditar manualmente qué commit resolvió cada bug, pero **no
  dispara nada automático**.

**Razón**: el admin no quiere ceder control sobre el estado de su backlog
de bugs a un agente. El costo del error (un bug cerrado en falso, un bug
en espera ignorado) es mayor que el ahorro de unos clicks. Prefiere
mantener el loop humano.

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
| `progreso` | `resuelto` | "Marcar resuelto" (botón manual) | Admin humano | `bug_advance_state` |
| `*` (no terminal) | `descartado` | "Descartar" + motivo | Admin | `bug_advance_state` |
| `resuelto`/`descartado` | — | Terminal | — | — |

Transiciones bloqueadas por trigger guard `bug_reports_state_transition_guard`.

---

## 6. Riesgos y mitigación

| # | Riesgo | Severidad | Mitigación |
|---|---|---|---|
| R1 | rrweb session replay pesa MB → bucket fill | Media | Compresión rrweb + retención 30 días + cleanup nightly |
| R2 | Auto-captura console/network captura passwords o tokens | **Alta** | Sanitizer regex en captura (Authorization headers redacted, query params con `token=` redacted) |
| R3 | Admin olvida actualizar estado de bugs resueltos | Media | Recordatorio in-app cuando hay > 5 bugs en `progreso` desde > 7 días |
| R4 | Push browser permissions denegadas → no notif | Baja | Fallback a in-app + email |
| R5 | Telegram bot caído → critical alert no llega | Media | Fallback a email + log warning · admin chequea Telegram health weekly |
| R6 | Reportador spam de bugs idénticos | Baja | Dedup por hash + rate limit 10 bugs/hora por user |
| R7 | rrweb player no carga en browser viejo | Baja | Fallback a "Ver datos" sin replay · solo console+network |

---

## 7. Open questions

1. **¿Retención de session replays?** V1: 30 días auto-delete. ¿Confirmás?
2. **¿Recordatorio admin cuando hay bugs estancados?** V1 simple banner "tenés N bugs en progreso > 7 días" arriba del Kanban. ¿OK?
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
| **5** | Notificaciones 4 canales (in-app + push + email + Telegram) · ✅ **V1** 2026-07-04 | 3 días |
| **6** | Polish admin · banner bugs estancados + filtros guardados + export CSV | 1 día |

**Total: 13 días** ± 1 (buffer para QA + bugs).

**Fase 5 · V1 (2026-07-04) — qué entró:**
- **Campanita in-app** funcional: `bug_notifications` (el outbox) se puebla en los 3 eventos (bug crítico nuevo → admin · cambio de estado → reportador · respuesta admin → reportador); `NotificationBell` en el topbar con badge de no-leídos + dropdown en tiempo real (Supabase Realtime) + marcar-leído (`markBugNotificationsReadAction`, RLS owner-update).
- **Todos los canales respetan `user_notification_prefs`**: `computeChannelDecision(prefs, type)` (pura, testeada) ramifica cada canal por `channel_*` + el flag por-evento `notify_on_*`. Sin fila de prefs → defaults de la DB (in-app+email ON, push+telegram OFF).
- **Fix de consentimiento de Telegram**: ya NO manda solo por estar linkeado — respeta `channel_telegram` (default OFF). El chat_id sigue en `user_profiles.telegram_chat_id` (fuente única).
- **UI de preferencias**: switches de canal/evento + sonido en el tab Preferencias del perfil (`ProfileModal`), persistidos vía `updateMyPreferencesAction` (upsert de `user_notification_prefs`, preservando push/telegram_chat_id).
- **Fuera de V1 (→ P3)**: outbox durable enqueue→drain (retry/idempotencia + cron). El dispatch de email/push/telegram sigue **inline best-effort**; el outbox se escribe para la campanita y se estampan los `delivered_*_at`.
- Dependencia Resend (SDD-0026 F2) ya satisfecha en prod.

**Dependencias externas**:
- SDD-0026 Fase 2 (Resend runtime) debe estar listo antes de Fase 5 email
- `NEXT_PUBLIC_BUILD_SHA` debe venir del build (Vercel inyecta `VERCEL_GIT_COMMIT_SHA`)

**Cero automatización de cambio de estado.** Ningún webhook, ningún agente IA,
ningún cron que mueva bugs entre columnas. Toda transición pasa por click
humano del admin en el drawer (ver D9).

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
- `feat(studio): SDD-0036 Fase 6 — Banner bugs estancados + export CSV admin`

---
sdd: "0146"
title: "Bitácora — actas de reunión con IA + gestor de tareas del equipo (Studio + móvil staff)"
status: done
author: "Claude Code (Fable) + founder"
created: 2026-07-04
updated: 2026-07-04
supersedes: null
superseded_by: null
related: ["0036", "0045", "0049", "0085", "0108", "0113", "0139", "0141"]
confidencialidad: interno
---

# SDD-0146 · Bitácora

> Port del módulo **Rumbo** de Loop3D (en producción) a los rieles DTD, bautizado
> **Bitácora**. Convierte conversaciones de trabajo en tareas ejecutadas: grabar/subir/pegar
> una conversación → IA propone acta + tareas → un humano confirma → gestor de tareas del
> equipo (desktop + teléfono) → push diario 8am VE. Interno para staff del Studio.
> **Uso principal: el teléfono.** Pedido founder 2026-07-04.

**Regla de oro (no negociable):** la IA propone, el humano autoriza. Ninguna tarea existe
sin confirmación humana. Responsable sin match en el equipo → tarea **sin asignar** con el
nombre crudo visible — nunca se inventa.

**Fuentes:** spec de reconstrucción `nuevo-loop3d\PROMPT-BITACORA.md` (2026-07-04, extraída
del código real de Loop3D) · benchmark de modelos del founder (`Desktop/acta-benchmark.html`,
reunión real de 34 min) · estudio de diseño multi-agente + panel adversarial (3 propuestas →
síntesis → 3 ataques + crítico; 6 hallazgos "rompe" parcheados en este spec) · investigación
de gestores de tareas (Linear/Asana/Todoist/Odoo/Basecamp). Donde este spec diverge del MD
de origen, la divergencia es **deliberada** y está marcada como `[DELTA]`.

## Contexto

Después de una reunión (o una llamada con un cliente), las tareas quedan "en el aire".
Bitácora mete ese flujo al ERP: el acta se genera sola, las tareas nacen asignadas, cada
quien las ve en su teléfono, avanza con un botón, sube foto como prueba, y a las 8am recibe
UN resumen de su día. DTD no tiene hoy ningún módulo de tareas internas (verificado:
`no-olvidar` es una caja fuerte de contraseñas, `menciones` es bandeja de notificación,
`conversaciones` es email con clientes) — el hueco es genuino.

**Kommo vs Bitácora (regla escrita, va también en el empty-state del módulo):**
"Kommo = pipeline y venta · Bitácora = compromisos internos accionables." Las tareas de
venta nacen y viven en Kommo (DTD solo las espeja read-only); las operativas viven acá.
V2: write-back del resumen de una llamada como nota al lead (infra outbox 0136, apagada).

## Decisiones de producto (cerradas con el founder 2026-07-04)

1. **Ubicación:** grupo **OPERACIÓN** del sidebar, junto a Calendario (es tablero de trabajo
   diario, no utilidad de SISTEMA). Icono propio nuevo (`mic`/`clipboard`) en `icons.tsx`.
2. **Móvil:** rutas reales en la PWA staff — `/m/erp/bitacora` (vista **Hoy**, destino del
   push), `/m/erp/bitacora/tarea/[id]`, `/m/erp/bitacora/nueva`. Bottom-nav extraído a
   componente único `ErpBottomNav` compartido con `MobileErpClient` (cero duplicación).
3. **Asignados V1 = solo staff con cuenta Studio** (`user_tenants` activos). Nombres sin
   cuenta → sin asignar + acción "invitar al Studio". `/m/emp` (nómina) = fase posterior
   **con** migración doble-lado (patrón 0181) — NO es "gratis", la RLS plana lo exige.
4. **Modelo de acta: Claude Sonnet 5** (`BITACORA_ACTA_MODEL`, default `claude-sonnet-5`).
   Benchmark real: 🥇 Sonnet 5 ($0.078/acta, 48s, 7/7 matices captados, 100% responsables
   asignados) vs Gemini 2.5 Pro ($0.060, 140s, 4/7) vs Flash ($0.008, 14s, 4/7, responsables
   sin asignar). 0 alucinaciones los tres. La latencia es invisible (procesamiento en
   segundo plano). Flash queda documentado como alternativa por env var.
5. **Transcripción: Cloudflare Workers AI Whisper large-v3-turbo** (probado por el founder;
   Groq geo-bloquea Venezuela). El founder crea la cuenta CF y carga las 2 env vars antes de
   cerrar la Fase 3. Sin keys → `apiError` "transcripción no configurada" (pegar texto sigue
   vivo). El benchmark ya probó chunking (51MB → 7 segmentos 16kHz mono).
6. **Gestor de tareas (mejores prácticas investigadas):** lista como vista default en móvil
   (kanban solo desktop) · **UN dueño por tarea (DRI)** + @menciones = seguidores · **cola
   por rol** (`assigned_role`, patrón Triage de Linear): tarea sin dueño cae a la bandeja
   del rol y alguien la "toma" · checklist **plano de 1 nivel** (si una tarea crece, se
   promueve a plantilla/proyecto, no a más niveles) · 4 estados · 3 prioridades · color solo
   para significado · push = UN digest diario, jamás un ping por tarea.
7. **Del piloto del founder:** agrupación "por persona" con barra de progreso (vista Lista
   desktop) · flag `para_agente` con badge "prompt → CC" + botón "Copiar prompt para Claude
   Code" (automatización real = V2).

## Alcance V1 vs MD de origen

**Se adopta:** flujo completo captura→acta→confirmación · prompt "secretario de actas" con 2
variantes (interna/cliente) + ancla dura de HOY en America/Caracas · post-proceso
determinista 1:1 (matching sin acentos exacto→contención→primer token; fechas solo
`^\d{4}-\d{2}-\d{2}$`) con tests · 4 estados + 3 prioridades + `completed_at` por trigger ·
tipo `entregable_cliente` + badge ámbar "Esperando al cliente" + filtro · Kanban HTML5
nativo (desktop) + botón de avance como acción táctil primaria (móvil) · /hoy agrupada
Atrasadas→Hoy→Próximas→Sin fecha con filtro "mías" default · checklist colaborativo +
adjuntos ≤50MB · meetingId generado en el cliente (`crypto.randomUUID()`) antes de subir
audio · digest 8am · vistas en localStorage + mutaciones optimistas con revert.

**Se recorta `[DELTA]`:** 6 de las 10 tablas de Rumbo — `notifications`→SDD-0036,
`push_subscriptions`→`user_push_subscriptions` (0216), `task_comments`+`task_mentions`→
comments 0045, `task_attachments`→documents 0049 + bucket propio, `customers`→`clients`,
`meeting_participants`→`acta.hablaron[]` · visibilidad fina por asignación/mención
(`puede_ver_tarea`)→RLS tenant-wide + RBAC (regla de la casa SDD-0085; es lo que habilita
reusar comments/documents) · vista Checklist standalone (vive en el drawer) · vista
Calendario propia (→ tipo `tarea` en `listCalendarEvents` de 0141) · Vercel AI SDK +
OpenRouter + Zod + @dnd-kit (tool-use nativo, validación manual, DnD HTML5) ·
`estimate_minutes`.

**Se agrega (Rumbo no tenía):** tareas manuales sin reunión · histórico de actas (tab
Actas — memoria institucional) · realtime en el tablero (`useRealtimeTable`) · outbox
durable de push con retry (0066 + drain cada minuto) · RPC transaccional de confirmación
(arregla la no-atomicidad conocida de Loop3D) · push multi-dispositivo staff (mejora
también bugs) · Telegram como canal opt-in · cola por rol + "Tomar tarea" · `para_agente` +
copiar prompt CC · reunión confidencial + borradores privados · vínculo a cliente real con
Shipping Mark · columnas configurables (regla Studio) · agrupación por-persona con progreso ·
mock de IA sin API key · redirector de deep-link por superficie · **reportes con branding
(Fase 7)**.

## Modelo de datos

### `0214_bitacora.sql` — core (archivo en rama; aplica el founder)

4 tablas, todas con `tenant_id uuid NOT NULL REFERENCES tenants ON DELETE CASCADE`, GRANT
base + RLS juntos, triggers freeze/touch:

- **`bitacora_meetings`** — `id` uuid PK `gen_random_uuid()` (se acepta id client-generated
  para subir audio pre-insert), `titulo` CHECK not-blank, `fecha` date, `tipo` CHECK
  `('interna','cliente')`, `client_id`→clients SET NULL, `contacto_libre` text (lead sin
  registrar — nunca auto-crear cliente, SDD-0046 exige RIF/cédula), `resumen`,
  `acta` jsonb `{puntos[], hablaron[], decisiones[], pendientes[], proxima_reunion}`
  (`[DELTA]` la columna `bitacora[]` del origen se llama **`puntos[]`** — único rename de
  campo, evita colisión con el nombre del módulo; también en la línea del prompt),
  `transcript`, `audio_path`, `estado` CHECK `('borrador','confirmada')`,
  **`visibilidad`** CHECK `('equipo','gestores')` default `'equipo'` (toggle "Reunión
  confidencial"; gatea acta/transcript/audio — las tareas confirmadas siguen tenant-wide),
  `created_by` uuid NULL SET NULL (resuelve la contradicción NOT NULL+SET NULL del origen),
  `confirmed_by/confirmed_at`. Índice `(tenant_id, estado, fecha desc)`.
  **RLS SELECT:** borradores solo `created_by = auth.uid()` OR admin; confirmadas por
  tenant, y si `visibilidad='gestores'` → solo admin + created_by.
- **`bitacora_tasks`** — `estado` CHECK `('pendiente','en_curso','en_revision','hecho')`,
  `prioridad` CHECK `('baja','media','alta')`, `tipo` CHECK `('empleado','entregable_cliente')`,
  **`assigned_role`** text NULL CHECK en roles válidos (cola por rol), **`para_agente`**
  boolean default false, `client_id`→clients SET NULL, `due_date` date NULL, `orden` int,
  `completed_at` (trigger port exacto de Rumbo), `meeting_id` NULL SET NULL, `created_by`
  NULL SET NULL. Índices `(tenant_id, estado, due_date)` y **parcial**
  `(tenant_id, due_date) WHERE estado != 'hecho'` (query del digest).
  `ALTER PUBLICATION supabase_realtime ADD TABLE bitacora_tasks`.
- **`bitacora_task_assignees`** — PK `(task_id, user_id)`, `user_id`→auth.users CASCADE,
  `tenant_id` denormalizado, `assigned_by`. Índice `(user_id, tenant_id)`.
  **Trigger `user_in_tenant(new.user_id, new.tenant_id)`** (calca de `employee_in_tenant`
  0181, fail-closed: exige `user_tenants` del tenant con `disabled_at IS NULL`) — cierra la
  fuga cross-tenant por el canal de notificaciones (hallazgo adversarial "rompe").
- **`bitacora_task_checklist`** — plano (1 nivel), `texto` CHECK not-blank, `done`,
  `done_by/done_at`, `orden`.

**Bucket propio `bitacora`** (`[DELTA]` — el hub documents es 10MB sin audio/video,
hallazgo "rompe"): privado, 50MB, mimes `audio/webm, audio/mp4, video/mp4, image/jpeg,
image/png, image/webp, application/pdf`; 4 policies molde 0097 (`storage.foldername(name)[1]
= get_user_tenant_id()::text`). Audio → `{tenant}/bitacora_meeting/{meetingId}/{uuid}.{ext}`
**sin** fila en documents; adjuntos → `{tenant}/bitacora_task/{taskId}/{uuid}.{ext}` **con**
fila en `documents` (`entity_type='bitacora_task'`). Signed URLs 1h con **user client**.

**RPCs** (todas con `REVOKE ALL FROM public; REVOKE EXECUTE FROM anon; GRANT authenticated`):
- `bitacora_confirm_meeting(p_meeting_id, p_meeting_patch jsonb, p_tasks jsonb)` —
  **SECURITY INVOKER** `set search_path = public` (la RLS es segunda capa; el edit-gate vive
  en la action con `moduleEditDenial`, la matriz RBAC NO se duplica en SQL). Transaccional:
  `SELECT … FOR UPDATE` + guard `estado='borrador'` (doble-confirm → error "ya confirmada"),
  valida shape y tope ~50 tareas, descarta asignaciones a users sin `user_tenants` activo
  del tenant, inserta tasks+assignees+checklist, marca confirmada. Todo o nada.
- `bitacora_assignable_profiles()` — `(user_id, display_name)` de `user_tenants` activos
  JOIN `user_profiles` del tenant del caller.
- Helper `user_in_tenant(p_user_id, p_tenant_id)` SECURITY DEFINER STABLE fail-closed.

### `0215_bitacora_enums.sql` — se aplica **junto a** 0214 (gotcha: enum nuevo no se usa en
la misma transacción): `ALTER TYPE document_entity_type ADD VALUE 'bitacora_task'` +
recreate `document_entity_in_tenant()` con el CASE nuevo · `ALTER TYPE bug_notif_type ADD
VALUE 'bitacora_task', 'bitacora_digest'` · CHECK de `comments.entity_type` + CASE en
`comment_entity_in_tenant()` (texto, no enum — puede vivir en 0214).

### `0216_bitacora_push.sql` — Fase 5: `user_push_subscriptions` (N dispositivos por user,
`endpoint` UNIQUE, `user_agent`, `last_used_at`; RLS self select/insert/delete SIN UPDATE +
service_role) + backfill desde `user_notification_prefs.push_subscription` (JOIN
`user_tenants` activos para el tenant_id) + `enqueue_user_push` (clon de
`enqueue_operario_push` 0071, target_type `'user'`, idempotencia 60s por tag; GRANT **solo**
service_role).

**Proceso:** antes de escribir cada migración, invocar los skills `supabase` (seguridad) y
`postgres-best-practices`. Las migraciones NUNCA las aplica un agente — archivos en rama,
las aplica el founder.

## Capa de IA — `lib/studio/bitacora/`

- `prompts.ts` — "secretario de actas" verbatim del origen con: 2 variantes (reunión interna
  / conversación con cliente — el cliente NO usa el sistema NI recibe tareas; sus
  compromisos nacen como tareas internas `entregable_cliente` "Recibir de {cliente}: {desc}"
  asignadas a `resolver(responsable_seguimiento) ?? quien registró ?? nadie`), ancla dura de
  HOY en America/Caracas (server-side; sin esto "mañana"/"el viernes 10" caen en años
  pasados), línea `puntos` (rename), mapeo contra nombres reales del equipo, "NO inventes
  tareas ni entregables", guard mínimo 20 chars.
- `extract.ts` — Anthropic directo (patrón noticias SDD-0088), **tool-use forzado**
  (`tool_choice: {type:"tool", name:"acta"}`) con `input_schema` = ActaSchema (resumen,
  puntos[], hablaron[], decisiones[], pendientes[], proxima_reunion{fecha,foco}, tareas[
  {titulo, responsable_nombre, due_date, prioridad, checklist[], para_agente}],
  entregables_cliente[]). Modelo `BITACORA_ACTA_MODEL` default `claude-sonnet-5`. Sin
  `ANTHROPIC_API_KEY` → mock determinista (patrón SDD-0020) para dev/tests/verify.
  El implementador carga el skill `/claude-api` antes de escribir esta capa.
- `transcribe.ts` — CF Workers AI POST `@cf/openai/whisper-large-v3-turbo` (base64,
  `language: "es"`), server-only. Route fina `app/api/studio/bitacora/transcribe/route.ts`:
  `requireModuleView` + `canEditModule`, path DEBE matchear
  `^{tenant_del_caller}/bitacora_meeting/{uuid}/{uuid}\.(webm|mp4|m4a)$` (rechazo de `..`),
  descarga con service-role (el borrador puede no existir aún), `apiError()`.
- `match.ts` — post-proceso determinista puro con tests: matching sin acentos en 3 niveles,
  match ambiguo/ausente → `null` (sin asignar, crudo visible), fechas ISO estrictas,
  prioridad fuera de enum → `media`.
- **Flujo en dos momentos:** CAPTURAR (borrador insertado apenas sube; fire-and-forget;
  notif "Tu acta está lista para revisar"; chip "N actas por confirmar"; botón reintentar
  transcripción) y CONFIRMAR (revisión editable desktop-first: editar/reasignar/descartar
  cada tarea, siempre mostrando a quién quedó). La extracción NUNCA bloquea pantalla
  (Sonnet 5 tarda ~48s; límite Vercel hobby 60s).
- **Grabadora = "reunión presencial / activa el altavoz"** (las llamadas NO se pueden grabar
  con getUserMedia — el OS da el mic en exclusiva; para llamadas: subir archivo o pegar
  texto, first-class). iOS: cascada `isTypeSupported` webm→mp4, extensión del mimeType real.
  Cap duro 10 min (contador + auto-stop; medir techo real de CF en Fase 3; chunking = V2
  con el patrón ya probado del benchmark).

## Notificaciones y push (reuso SDD-0036 + outbox 0066)

- Eventos `bitacora_task` (asignación) y `bitacora_digest` (8am). **Máscara de canales
  explícita V1** (no `computeChannelDecision` a ciegas — heredaría email ON con template de
  bugs): in-app siempre + push según `channel_push` + telegram según `channel_telegram` +
  **email OFF**. Union `BugNotifType` ampliada con switch exhaustivo.
- `writeInAppNotification` extraída a `lib/studio/notify/write-inapp.ts` (bugId opcional,
  firma compatible con bugs), **excluye al actor**, tag `task-{id}`.
- Digest: cron `app/api/cron/bitacora-digest/route.ts` + vercel.json `0 12 * * *` (8am VE),
  Bearer `CRON_SECRET` fail-closed, query sobre el índice parcial (due_date ≤ hoy Caracas,
  incluye atrasadas), UNA push por persona "Tienes N tarea(s) pendiente(s) · M atrasada(s) ·
  Empieza por: {la más urgente}", tag `recordatorio-bitacora-{YYYY-MM-DD}`, deep-link
  `/m/erp/bitacora`, sin tareas = sin push, idempotente.
- Push multi-dispositivo: `sendPushToUserDevices` (todas las subs del user, borra muertas
  404/410, fallback lectura del jsonb legacy) + branch `'user'` en el drain **en el mismo
  commit** que el primer caller (hoy el drain quema attempts con target desconocido; se
  corrige el else → mark_sent con log). `sendBugPushToUser` migra a la tabla → bugs gana
  multi-device gratis. Route subscribe **reescrita** (identidad SOLO de sesión, jamás del
  body; DELETE por endpoint; `channel_push=false` solo si quedan 0 filas).
  `pushsubscriptionchange`: `/m/sw.js` → `/api/m/push/resubscribe` unificado (cookie
  `dtd_op` → operario; si no, sesión Supabase → staff); `public/sw.js` → route studio.
- Descubrimiento móvil (el módulo no puede quedar mudo): badge numérico en el tab de
  MobileErpClient + banner opt-in 1ª visita + guía iOS PWA + Telegram recomendado en copy.
- Deep-link neutro: `app/ir/bitacora/tarea/[id]/route.ts` redirige por user-agent
  (móvil → `/m/erp/bitacora/tarea/{id}`; desktop → `/studio/bitacora?task={id}`).

## Headers (`next.config.ts`) — cambios exactos

(1) `microphone=(self)` SOLO en reglas dedicadas `/m/erp/bitacora/:path*` y
`/studio/bitacora/:path*` (operarios PIN quedan sin mic); (2) exclusión de esas rutas en el
negative-lookahead del catch-all (múltiples Permissions-Policy se INTERSECTAN al más
restrictivo — sin la exclusión la regla nueva se anula en silencio); (3) CSP
`media-src 'self' blob: https://*.supabase.co` (sin el host, el playback del audio firmado
muere silencioso). SW/manifest: cero nuevos; fetch de `/m/sw.js` sigue no-op (invariante
iOS). Aceptación de Fase 3 incluye regresión QR/GPS de `/m/cn` y `/m/ve`.

## Registro del módulo

`lib/studio/modules.ts` → `{ id: "bitacora", group: "OPERACIÓN", label: "Bitácora",
icon: <nuevo>, slug: "/studio/bitacora" }` (junto a calendario) · `lib/studio/rbac.ts` →
`bitacora: ["commercial","operations","accounting","warehouse","support","marketing"]`
(support read-only vía `canEditModule`; `rbac.test.ts` anti-drift) · guards
`requireModuleView("bitacora")` en pages y `moduleEditDenial` en actions · ⌘K: sin registro
en V1 (el buscador indexa 5 facetas fijas, no módulos).

## Fases y criterios de aceptación

Gate por fase: `node scripts/verify.mjs` verde + criterios + `/ui-check` si hubo UI nueva.

> **Estado de implementación (2026-07-04):** las **7 fases** están construidas en el
> worktree `feat/bitacora` (Fase 7 — reportes con branding — incluida). Pendiente el
> **merge del founder**; el spec sigue `approved` (el founder lo pasa a `done` tras
> integrar). Las migraciones `0214`/`0215`/`0216` son archivos en rama — las aplica
> el founder (renumera al integrar si colisionan con `main`).

- **Fase 0 — Spec** (este documento): draft → approved por founder; module-sdd-map;
  `pnpm docs:check`.
- **Fase 1 — Fundación**: migr 0214+0215 (archivos), registro módulo+RBAC,
  `lib/studio/bitacora/{types,queries}`, `/studio/bitacora` (Kanban+Lista manuales,
  DrawerShell), `ErpBottomNav` extraído, `/m/erp/bitacora` + `/tarea/[id]` + badge tab.
  ✓ Tarea con dueño y tarea en cola-rol recorren los 4 estados en desktop y teléfono ·
  completed_at por trigger · otro tenant ve 0 filas · support no muta · assignee
  cross-tenant rechazado por trigger.
- **Fase 2 — Ingesta texto + IA + confirmación**: pegar transcript → extract+match →
  revisión editable → RPC confirm → tab Actas. ✓ "mañana"/"el viernes" anclan a Caracas ·
  sin match = sin asignar con crudo visible · doble-confirm = "ya confirmada" · NADA en
  `bitacora_tasks` antes de confirmar · borrador invisible para no-creador.
- **Fase 3 — Audio + headers**: grabadora (cascada iOS, cap 10 min) + subir archivo +
  upload directo + route transcribe + headers/CSP. Founder carga env CF en Vercel.
  ✓ Grabar 1-2 min en teléfono (PWA instalada) y desktop → transcript es-VE legible →
  flujo Fase 2 hasta tareas · reintento tras fallo CF sin re-grabar · >50MB rechazado antes
  de subir · QR/GPS operario sin regresión · playback de audio firmado OK en prod-build.
- **Fase 4 — Colaboración**: comments 0045 en drawer y detalle móvil + adjuntos (bucket
  bitacora + fila documents) + checklist done_by. ✓ @mención genera fila en la bandeja del
  mencionado con link que abre la tarea · foto desde cámara visible en la tarea y en
  /studio/documentos · comentarios inmutables.
- **Fase 5 — Notifs + push + digest**: migr 0216 + todo el bloque de push. ✓ Digest en
  teléfono Y desktop del mismo user · actor no se auto-notifica · email NO llega · push de
  bugs y operarios sin regresión · matar el proceso entre enqueue y send no pierde el push
  (cron del minuto drena) · POST con user_id ajeno en body → la sub queda del user de
  sesión · channel_push OFF = solo campanita · sin tareas = cero push.
- **Fase 6 — Pulido**: realtime tablero/hoy, tipo `tarea` en Calendario 0141, agrupación
  por-persona con progreso, columnas configurables, KpiCard Dashboard, filtro "Esperando al
  cliente", copiar-prompt CC, copy es-VE, limpieza de audios huérfanos (clon
  purge-receipt-orphans) o aceptación explícita. ✓ Avance en desktop se refleja en el
  teléfono <2s sin reload · tarea con due_date aparece en /studio/calendario · recorrido
  completo demostrado en el teléfono del founder · `pnpm build` verde.
- **Fase 7 — Reportes** (PROMPT-BITACORA §7): `lib/studio/bitacora/reports.ts` + route
  `app/api/studio/bitacora/export/route.ts`. Acta → **HTML autocontenido con branding DTD**
  (CSS embebido con los tokens del design system, logo BrandMark data-URI, fuente Archivo
  con fallback, footer "Generado por DoorTuDoor · fecha · usuario", `@media print` con
  `page-break-inside: avoid` = el "PDF" del sistema sin librería; NUNCA embeber signed URLs
  — adjuntos por nombre con "ver en la app"; datos solo vía queries gated por RLS, jamás
  service-role). Tareas → **CSV** (UTF-8 con BOM, CRLF, comillas escapadas, fechas ISO,
  columnas titulo/estado/prioridad/tipo/vence/asignados("; ")/checklist_hecho/
  checklist_total/reunion/creada; **respeta filtros activos** de la Lista). Botones:
  "Descargar acta" en revisión y detalle; "Exportar" (HTML/CSV) en la Lista. Cero dependencia
  nueva. Al cierre: spec a `done` + `pnpm docs:check`. ✓ El acta baja como HTML que se ve
  bien offline y al imprimir con el branding exacto · el CSV abre en Excel con acentos y ñ
  correctos y respeta filtros · un usuario solo exporta lo que puede ver.
  **Implementada (worktree `feat/bitacora`):** `lib/studio/bitacora/reports.ts`
  (`buildActaHtml`/`buildTasksReportHtml`/`buildTasksCsv`/`filterTasksForExport` puros) +
  route `app/api/studio/bitacora/export/route.ts` (gate de VISTA, RLS del user, isólogo
  data-URI por fs con fallback a wordmark) + botones "Descargar acta" (revisión + tab Actas)
  y "Exportar" (Reporte HTML / Datos CSV) en la Vista Lista.

## Env vars

Nuevas: `CLOUDFLARE_ACCOUNT_ID` · `CLOUDFLARE_API_TOKEN` · `BITACORA_ACTA_MODEL` (opcional,
default `claude-sonnet-5`) — documentar en `.env.example` con el patrón fail-closed/mock.
Existentes que se reusan: `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`, `TELEGRAM_BOT_TOKEN`.

## Fuera de alcance V1 (V2 documentado)

Ingesta por Telegram (@DTDStudioBot → borrador) · getDisplayMedia para audio de pestaña
(llamadas en desktop) · chunking de audios largos (patrón probado en el benchmark) · push de
@menciones · tareas para nómina `/m/emp` (con migración doble-lado) y operarios PIN ·
write-back de resumen a Kommo (outbox 0136) · automatización real de tareas `para_agente` ·
flag `notify_on_bitacora` como preferencia por evento · plantillas de checklist ·
recurrencia de tareas · vista "actas de este cliente" en la ficha del cliente.

## Riesgos aceptados (documentados a propósito)

- `support` puede escribir vía PostgREST directo (la RLS tenant-wide lo permite; el gate
  read-only es capa app) — patrón de la casa en comments/documents. Mitigación opcional
  barata si duele: `WITH CHECK (current_studio_role() <> 'support')`.
- Audio huérfano si el usuario abandona antes del insert (basura en bucket; cron de limpieza
  en Fase 6 o aceptación explícita).
- Doble push si el mismo teléfono tiene 2 registrations (TWA + Chrome) — población ~5 staff,
  mitigado con lista de dispositivos en preferencias + limpieza de subs sin uso >90 días.

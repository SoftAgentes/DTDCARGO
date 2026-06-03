---
sdd: "0045"
title: "Comentarios + @menciones transversales — hilo embebible en cualquier entidad"
status: done
author: "Claude (carril operaciones)"
created: 2026-06-03
updated: 2026-06-03
supersedes: null
superseded_by: null
related: ["0036", "0024", "0026", "0034"]
confidencialidad: interno
---

# DTD-0045 — Comentarios + @menciones transversales

> **Colaboración interna del equipo sobre cualquier registro.** Hoy el único hilo de
> conversación es `bug_messages` (acotado a un bug, SDD-0036). Este SDD lo **generaliza** a un
> sistema de comentarios **polimórfico**: un `<CommentsThread>` embebible en el detalle de
> cualquier entidad (embarque, cliente, factura, cotización, orden de despacho, CxP…), con
> **@menciones** que notifican al mencionado y una **bandeja de "Menciones"**. Cierra el hueco
> `Comment ❌` del `schema-reconciliation.md` ("`bug_messages` es hilo acotado a bugs; no
> comentarios transversales con @menciones").

> **🚧 Aislamiento (carril operaciones).** Esta spec se construye en paralelo al carril
> **Finanzas + Portal** (otra ventana: treasury/accounting/journal/portal). **No toca** ninguno
> de esos archivos. Los únicos puntos compartidos —número de migración, ítem de sidebar, docs de
> arquitectura— se resuelven cediendo el turno: ver §8.

---

## 1. Resumen en una línea

Tabla `comments` (polimórfica `entity_type` + `entity_id`, hilo plano con `parent_id` nullable
para futuro) + `comment_mentions` (mencionado + `read_at` → bandeja/badge) + `comment_reactions`
(emoji, 5 fijos) + `lib/studio/comments/` (queries puras + parser de menciones) + componente
cliente `<CommentsThread>` embebible + server actions + página **Menciones**. Multi-tenant por
`get_user_tenant_id()`. **Interno** (el cliente del portal NO ve estos comentarios).

---

## 2. Scope

### Incluye

#### Backend (Supabase) — migración `00XX_comments.sql` (número en §8)
- **`public.comments`** (polimórfica, calca el patrón de `entity_audit_log` de 0066):
  - `id`, `tenant_id` (FK tenants cascade), `entity_type` (text **CHECK** del set en §4),
    `entity_id` (uuid — PK real de la entidad), `entity_code` (text nullable — snapshot legible
    para la bandeja: `DTDU-…`/`DTD-…`/`F-2026-…`), `author_id` (FK `auth.users` set null),
    `body` (text, CHECK `length(trim(body)) > 0`), `parent_id` (self-FK cascade, nullable —
    reply de 1 nivel, **se guarda pero V1 renderiza plano**), `edited_at` (nullable),
    `created_at`, `deleted_at` (soft-delete).
  - Índice `(tenant_id, entity_type, entity_id, created_at)` where `deleted_at is null`.
- **`public.comment_mentions`**: `id`, `comment_id` (FK comments cascade), `tenant_id`
  (denormalizado para RLS), `mentioned_user_id` (FK `auth.users` cascade), `read_at` (nullable),
  `created_at`. `unique (comment_id, mentioned_user_id)`. Índice
  `(mentioned_user_id, read_at)` — "mis menciones sin leer".
- **`public.comment_reactions`**: `id`, `comment_id` (FK cascade), `tenant_id`, `user_id`
  (FK `auth.users` cascade), `emoji` (text **CHECK** `in ('👍','✓','👀','🔥','❓')`),
  `created_at`. `unique (comment_id, user_id, emoji)`.
- **RLS** (las 3, patrón `entity_audit_log`): `SELECT`/`INSERT` a `authenticated` con
  `tenant_id = (select public.get_user_tenant_id())`; `UPDATE`/soft-delete de `comments` solo
  `author_id = auth.uid()` (o admin del tenant); `DELETE` real solo `service_role`. Policy
  `service_role for all`. **Sin RPC de folio** (los comentarios no tienen código legible propio).
- Grants + `enable row level security` en las 3.

#### Lib (`lib/studio/comments/` — dominio ≥3 archivos → carpeta)
- `types.ts`: `CommentEntityType` (union) + `COMMENT_ENTITY_LABELS` (label + ruta para navegar
  desde la bandeja), `Comment`, `CommentMention`, `CommentReaction`,
  `CommentWithMeta` (comment + autor `{name, avatar, role}` + reacciones agrupadas
  `{emoji: userIds[]}` + `myReaction` + `mentionedUsers`), `MentionInboxItem`, `REACTION_EMOJIS`
  (las 5), `validateCommentInput` (body no vacío, ≤ 4000 chars).
- `comments-queries.ts` (puras, reciben `SupabaseClient`):
  `listComments(supabase, entityType, entityId)` (join autor + reacciones + menciones, orden
  cronológico, excluye `deleted_at`), `listMyMentions(supabase, {unreadOnly?})` (bandeja, join
  comment + entidad), `countUnreadMentions(supabase)` (para el badge).
- `mention-parse.ts` (**pura, el corazón testeable**): `parseMentions(body, tenantUsers)` →
  resuelve los tokens `@Nombre A.` del cuerpo contra la lista de usuarios del tenant y devuelve
  `userIds[]` (dedup). Calca el regex del mockup (`@Primer A.`) pero resuelve server-side por
  match de nombre; ignora @desconocidos. + `renderMentionHtml(body, users)` helper opcional para
  resaltar (el componente lo hace en cliente, pero se exporta para tests).

#### Server actions — `app/studio/(app)/_actions/comments.ts` (`"use server"`, dir compartido neutral)
- `postComment(entityType, entityId, entityCode, body, parentId?)`: valida → inserta comment →
  `parseMentions` → inserta `comment_mentions` → **notifica best-effort** a los mencionados
  (in-app vía la fila de mención = núcleo; email/push reusando infra existente = best-effort,
  no se construye nada nuevo) → `revalidatePath` de la entidad.
- `toggleReaction(commentId, emoji)`: upsert/delete en `comment_reactions` (toggle por
  `(comment, user, emoji)`).
- `editComment(commentId, body)`: solo autor; re-parsea menciones (agrega nuevas, no borra
  viejas); set `edited_at`.
- `deleteComment(commentId)`: autor o admin; soft-delete (`deleted_at`).
- `markMentionsRead(scope?)`: set `read_at = now()` a mis menciones (todas, o de una entidad).

#### UI — `app/studio/(app)/_components/comments/`
- **`CommentsThread.tsx`** (client) — embebible:
  `<CommentsThread entityType entityId entityCode users currentUser initialComments />`.
  Replica el mockup del Norte 1:1: composer con **dropdown de @menciones** (autocomplete contra
  `users` del tenant), hilo con **chips de mención** (`.mention-chip` wine-tint), **reacciones**
  (pills + picker de 5 emojis), avatar/rol/timestamp, **⌘/Ctrl + Enter** para enviar, empty
  state. Optimistic UI sobre las server actions; `revalidate` confirma.
- Sub-componentes `CommentItem.tsx`, `MentionDropdown.tsx` si conviene separar.
- **Embed V1 (una superficie de operaciones, fuera del carril finanzas/portal):** el detalle de
  **embarque** (`app/studio/(app)/embarques/…` — el ejemplo canónico del mockup, `DTDU-472816`).
- **Página `app/studio/(app)/menciones/page.tsx`** (server): bandeja "Menciones" — lista de
  comentarios donde me mencionaron, badge de no leídas, click → navega a la entidad + marca leído.

### NO incluye (Fase 2 / SDDs futuros)
- **Threading anidado en UI** — `parent_id` se guarda; V1 renderiza plano (el botón "Responder"
  del mockup queda visual/diferido).
- **Adjuntos en comentarios** (el ⊕ upload del mockup) — depende de DMS/Storage; futuro.
- **Realtime en vivo** — V1 usa `revalidatePath`; canal Supabase Realtime para co-edición = futuro
  (la infra existe, ver [[project_bridge_approach_supabase_realtime]]).
- **Comentarios de cara al cliente** (portal) — esto es **colaboración interna del equipo**; el
  portal NO los expone. (Comentarios cliente↔equipo = otro SDD.)
- **Notificación email/push garantizada** — la mención in-app es el núcleo; email/push es
  best-effort reusando `lib/studio/mail` / push existentes, sin construir infra nueva. Preferencias
  finas de notificación de comentarios = futuro (hoy reusa el patrón de `user_notification_prefs`).
- **Embed en todas las entidades** — V1 prueba E2E en embarque; el resto (cliente, factura,
  cotización, CxP, despacho) se agrega incrementalmente (el componente ya es genérico).
- **Editar historial de menciones / des-mencionar** — `editComment` agrega, no quita.

---

## 3. Archivos a crear / editar

### Nuevos
```
docs/specs/0045-comentarios-menciones/spec.md
supabase/migrations/00XX_comments.sql              ← comments + comment_mentions + comment_reactions + RLS (número en §8)
lib/studio/comments/types.ts
lib/studio/comments/comments-queries.ts
lib/studio/comments/mention-parse.ts
lib/studio/comments/__tests__/mention-parse.test.ts
lib/studio/comments/__tests__/comments-queries.test.ts
app/studio/(app)/_actions/comments.ts
app/studio/(app)/_components/comments/CommentsThread.tsx
app/studio/(app)/_components/comments/CommentItem.tsx
app/studio/(app)/_components/comments/MentionDropdown.tsx
app/studio/(app)/menciones/page.tsx
```
### Editados (mínimos, fuera del carril finanzas/portal)
```
app/studio/(app)/embarques/…                        ← embeber <CommentsThread> en el detalle (operaciones)
app/studio/(app)/_components/StudioSidebar.tsx       ← ítem "Menciones" (grupo neutral; 1 línea — ver §8)
```
### Diferidos a coordinación (NO tocar hasta sincronizar con el carril finanzas)
```
docs/architecture/module-sdd-map.md                 ← fila comentarios → SDD-0045 (lo edita el carril finanzas en cada SDD)
docs/architecture/schema-reconciliation.md          ← Comment ❌ → ✅
docs/specs/README.md                                ← regenerado por pnpm docs:index (NO correr a mano hasta coordinar)
```

---

## 4. Schema (esqueleto)

```sql
create table public.comments (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  entity_type  text not null check (entity_type in (
                 'shipment','client','invoice','quote',
                 'dispatch_order','supplier_bill',
                 'warehouse_receipt_cn','warehouse_receipt_ve'
               )),
  entity_id    uuid not null,
  entity_code  text,                                   -- snapshot legible (DTDU-…, DTD-…, F-2026-…)
  author_id    uuid references auth.users(id) on delete set null,
  body         text not null check (length(trim(body)) > 0),
  parent_id    uuid references public.comments(id) on delete cascade,
  edited_at    timestamptz,
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index comments_entity_idx
  on public.comments (tenant_id, entity_type, entity_id, created_at)
  where deleted_at is null;

create table public.comment_mentions (
  id                uuid primary key default gen_random_uuid(),
  comment_id        uuid not null references public.comments(id) on delete cascade,
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  mentioned_user_id uuid not null references auth.users(id) on delete cascade,
  read_at           timestamptz,
  created_at        timestamptz not null default now(),
  unique (comment_id, mentioned_user_id)
);
create index comment_mentions_inbox_idx
  on public.comment_mentions (mentioned_user_id, read_at);

create table public.comment_reactions (
  id          uuid primary key default gen_random_uuid(),
  comment_id  uuid not null references public.comments(id) on delete cascade,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  emoji       text not null check (emoji in ('👍','✓','👀','🔥','❓')),
  created_at  timestamptz not null default now(),
  unique (comment_id, user_id, emoji)
);

-- RLS (las 3): tenant_id = (select public.get_user_tenant_id()) para authenticated;
-- update/soft-delete de comments solo author_id = auth.uid(); service_role for all.
```
La **bandeja de menciones** y el **conteo de no leídas** se derivan por query de
`comment_mentions` (`read_at is null`), no son tablas nuevas.

---

## 5. Decisiones de diseño

### 5.1 Polimórfico sin N foreign keys (calca `entity_audit_log`)
`(entity_type, entity_id)` en vez de una FK por cada tabla. `entity_type` es texto con CHECK
(set acotado, **aditivo** — sumar un tipo = una línea, no toca enums). Desacopla `comments` de las
~8 entidades comentables y permite embeber el mismo componente en cualquier detalle. `entity_code`
guarda el código legible al momento de comentar para que la bandeja navegue/etiquete sin re-join.

### 5.2 Generaliza `bug_messages`, no lo reemplaza
`bug_messages` (SDD-0036) sigue siendo el hilo nativo del Bug Reporter (tiene `author_type`
`system` para mensajes automáticos). `comments` es el hilo **manual transversal**. No se migra
bugs a comments en V1 (podrían converger en el futuro; fuera de scope).

### 5.3 Menciones = filas, no array
`comment_mentions` como tabla (en vez de `mentions uuid[]`) habilita la **bandeja "Menciones"**
con `read_at` por usuario, el **badge de no leídas**, y el fan-out de notificación, todo por query
indexada. El parser (`parseMentions`) es **puro y testeable** (el punto frágil: resolver `@Nombre`
del texto libre a un user real del tenant).

### 5.4 In-app primero, email/push best-effort
La mención **siempre** crea su fila (eso ya es la notificación in-app: badge + bandeja). Email/push
es best-effort reusando `lib/studio/mail` y el push existente — si falla, el comentario y la mención
quedan igual. **No se construye infra de notificación nueva.**

### 5.5 Interno, no portal
Decisión de alcance: comentarios = colaboración **del equipo**. El portal del cliente (carril de la
otra ventana) **no** los lee. Esto mantiene el aislamiento total y evita tocar `lib/portal`.

### 5.6 Soft-delete + autoría
`deleted_at` (auditable, no se borra). `edit`/`delete` solo del autor (o admin del tenant vía RLS).
`edited_at` marca editado. Reacciones: toggle idempotente por `(comment, user, emoji)`.

---

## 6. Criterios de aceptación

### Backend
- [ ] Migración aplica; `comments` + `comment_mentions` + `comment_reactions` con RLS + `tenant_id`
- [ ] Aislamiento RLS probado: un user de tenant A no ve/inserta comentarios de tenant B
- [ ] CHECK de `entity_type` y de `emoji` rechazan valores fuera del set
- [ ] `unique` de mención y de reacción evitan duplicados

### Lib
- [ ] `parseMentions` resuelve `@Martina A.` → user id correcto; ignora @desconocidos; dedup
- [ ] `validateCommentInput` rechaza body vacío / solo-espacios / > 4000 chars
- [ ] `listComments` devuelve hilo cronológico con autor + reacciones agrupadas + menciones
- [ ] `countUnreadMentions` cuenta solo `read_at is null` del user actual

### UI / flujo E2E
- [ ] `<CommentsThread>` embebido en el detalle de embarque: comentar, @mencionar (dropdown),
      reaccionar, ⌘+Enter envía
- [ ] Al @mencionar a un user, aparece una mención no leída en su bandeja `/studio/menciones`
- [ ] Abrir la mención navega a la entidad y la marca leída (baja el badge)
- [ ] Editar/borrar propio comentario funciona; no se puede editar el de otro
- [ ] light + dark; cero hex (solo `var(--*)`); pasó `ui-ux-designer`

### Sistema
- [ ] `node scripts/verify.mjs` verde · frontera público↔ERP intacta
- [ ] **Cero archivos del carril finanzas/portal modificados** (`git diff --name-only` no toca
      `lib/studio/{treasury,accounting,journal-*}`, `lib/portal/*`, `app/portal/*`,
      `app/studio/(app)/{tesoreria,contabilidad,cobranzas,facturacion}`)

---

## 7. Out of scope / open questions
- **¿`@todos` / menciones a roles ("@bodegueros")?** No en V1 — solo usuarios individuales. Futuro.
- **¿Notificar al autor cuando reaccionan a su comentario?** No en V1 (solo menciones notifican).
- **¿Comentarios en entidades móviles (operario PWA)?** El componente es web; embed móvil = futuro.
- **¿Quién puede borrar?** Autor o admin del tenant. Moderación fina = futuro.

## 8. Aislamiento operacional (cómo no chocar con el carril finanzas/portal)
1. **Número de migración:** al implementar, correr `ls supabase/migrations | tail -1` en vivo y tomar
   **el siguiente libre cediendo el turno al carril finanzas**. Al escribir esta spec el último es
   `0088_tesoreria.sql`; si finanzas ya tomó `0089`, usar `0090`. Confirmar antes de crear el archivo.
2. **Sidebar:** agregar "Menciones" en un grupo neutral (no FINANZAS). Es 1 línea; bajo riesgo de
   conflicto. Si el `StudioSidebar.tsx` tiene cambios sin commitear de la otra ventana, **diferir**
   el ítem (la página `/studio/menciones` funciona igual sin entrada de menú) y avisar.
3. **Docs de arquitectura** (`module-sdd-map.md`, `schema-reconciliation.md`, `docs/specs/README.md`):
   **NO editarlos** en este SDD hasta sincronizar — los toca el carril finanzas en cada cierre.
   Anotar el pendiente y reconciliar después.
4. **Commit aislado** en cada (sub)fase: `node scripts/verify.mjs` verde + `ui-ux-designer` en las
   visuales (regla del founder).

## Diseño
`docs/design/studio/_norte/erp/modules/comments.jsx` (CommentsThread + CommentItem, mock por
`recordId`). **V1 lo porta a backend real** con el patrón polimórfico; mantiene la UX 1:1 (chips de
mención, picker de 5 reacciones, ⌘+Enter, dropdown de @). El "Expandir hilo" / "Responder" del
mockup quedan diferidos (threading = §2 NO incluye).

---

## 9. Estado de implementación (2026-06-03 · harness `/feature`)

**Código V1 completo y `APPROVED` por el `reviewer`.** Gate `node scripts/verify.mjs` 🟢 VERDE
(410 tests, +48 de esta feature). Recorrido: implement → verify → review en **1 ronda**.

**Construido:**
- `supabase/migrations/0090_comments.sql` — `comments` + `comment_mentions` + `comment_reactions`,
  RLS por `get_user_tenant_id()`, CHECKs (entity_type, emoji, body), uniques, índices, grants.
  *(número `0090`: se cedió `0089` al carril finanzas a propósito → gap intencional; finanzas tomó
  `0091`.)*
- `lib/studio/comments/{types,mention-parse,comments-queries}.ts` + `__tests__/` (26 tests).
  `mention-parse` con anti-XSS (escapa el body antes de resaltar) y regex acotado de 2 palabras.
- `app/studio/(app)/_actions/comments.ts` (post/toggleReaction/edit/delete/markRead; tenant
  server-side vía `getUserTenantId`).
- `app/studio/(app)/_components/comments/{CommentsThread,CommentItem,MentionDropdown}.tsx`.
- Embed V1 en `app/studio/(app)/tracking/[id]/page.tsx` (detalle real del embarque).
- Bandeja `app/studio/(app)/menciones/page.tsx` + `_components/MentionsInboxClient.tsx`.

**Migración aplicada a prod ✅ (2026-06-03):** `0090_comments.sql` aplicada al proyecto
`xpfuzqombmjmxvprjgmi` (DoorTuDoor) vía MCP. **Verificada:** las 3 tablas con RLS ON + 14 policies
(comments 5 · mentions 5 · reactions 4) + CHECKs (entity_type, body, emoji) + índices + grants;
`get_advisors(security)` → **0 advisories sobre estas tablas, 0 errores** en la DB. Dependencias
confirmadas pre-apply (`get_user_tenant_id`, `tenants`, `user_tenants.role/disabled_at`, `auth.users`).

**Pendiente para quedar live + cerrar:**
1. **Push/deploy del código** — el commit `9da4960` está local (sin push por decisión del founder).
   La DB ya tiene las tablas, pero la UI (`<CommentsThread>`, `/studio/menciones`) no es visible al
   usuario hasta `git push origin main` → deploy Vercel. *Hasta entonces el E2E de UI no se prueba.*
2. **Coordinación con el carril finanzas (diferido por shared-dir):** ítem de sidebar
   `/studio/menciones` + badge de no-leídas en el chrome · fila en `module-sdd-map.md` · `Comment
   ❌→✅` en `schema-reconciliation.md` · regenerar `docs/specs/README.md` (`pnpm docs:index`).
3. **Email/push de menciones** — hoy in-app (la fila de mención); email/push = best-effort futuro.
4. **Embed en más entidades** (cliente/factura/cotización/CxP/despacho) — el componente ya es
   genérico; sumar = 1 `<CommentsThread …>` por detalle.

→ Pasa a `done` cuando se haga el push/deploy (1) y se verifique el E2E de UI.

### Hallazgos del `/plan-eng-review` (2026-06-03)
Review retrospectivo, 0 P1. **Accionados** (commit `b7f86b9`): href de la bandeja
aterriza en el record (invoice/quote → `[code]`; fix typo `quote /cotizar→/cotizador`)
+ tests de las 4 server actions (cierra el 0% de cobertura de actions). **Diferidos a TODO:**
- **[P3] orden+limit de `listComments`** devuelve los 500 MÁS VIEJOS (`ascending + limit(500)`)
  → en hilos >500 oculta los recientes. Fix: traer `desc` + reverse. (`comments-queries.ts:58`)
- **[P3] `toggleReaction`** read-modify-write: doble-click rápido puede dar error espurio
  (lo salva el `unique`). No usa `ActionButton`. Aceptable por alta frecuencia.
- **[P3] fallo silencioso** si falta `service_role`: `loadTenantUsers`→`[]` → dropdown de @
  vacío sin aviso. (`comments-queries.ts:228`)
- **[P2] badge de no-leídas + email/push de menciones** — ya listados arriba; el badge cruza
  el carril integración (sidebar/chrome), coordinar.

### Hallazgos del `/codex challenge` (2026-06-03) + hardening
Segunda opinión adversarial cross-model. Confirmó: **sin XSS, sin ReDoS**. Encontró huecos que el
eng-review no vio (el patrón: la action valida, pero un cliente Supabase directo se la salta).
**Cerrados** por `0093_comments_hardening.sql` (aplicada a prod + smoke-test verificado):
- **[P1] entidad no validada in-tenant** — trigger `comments_validate_entity` (BEFORE INSERT) +
  helper `comment_entity_in_tenant()` polimórfico sobre las 8 tablas → rechaza comentar entidades
  inexistentes / wrong-type / de otro tenant (cubre todo cliente, no solo la action).
- **[P1] mención a usuario fuera del tenant** — trigger `comment_mentions_validate` exige
  `mentioned_user_id ∈ user_tenants` del tenant.
- **[P2] `comment_mentions` mutable** — trigger `comment_mentions_freeze_immutable`: solo `read_at`
  mutable (espejo del de `comments`).
- **Blast radius:** intra-tenant (no breach cross-tenant; `comment.tenant_id` se fija server-side).
**Quedan TODO (P2/P3 menores):** toggleReaction race (read-modify-write) · parser `startsWith`
ambiguo (`@Ma` resuelve el primer match) · `parent_id` sin validar same-tenant/entity · `editComment`
agrega menciones pero no remueve las viejas.

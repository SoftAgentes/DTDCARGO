---
sdd: "0054"
title: "Capa legal — documentos versionados + aceptaciones inmutables (gate AUT-04); Slice A = foundation · Slice B = admin + gate advisory · Slice C = aceptación del cliente en el Portal"
status: done
author: "Claude Code (carril legal · Norte v2.4)"
created: 2026-06-03
updated: 2026-06-04
supersedes: null
superseded_by: null
related: ["0021", "0011", "0042", "0046", "0016", "0045"]
confidencialidad: interno
---

# DTD-0054 — Capa legal (documentos + aceptaciones)

> Cierra **2 de las 3 entidades ❌** del cruce blueprint↔Supabase: **LegalDoc** y **LegalAcceptance**.
> Es el **keystone**: desbloquea `Invoice` (hoy 🟡 partial por el gate AUT-04 sin respaldo) y respalda
> la **evidencia legal inmutable** que exige el flujo DDP. Diseño completo en el Norte v2.4:
> `erp/modules/admin-legal.jsx` (versionado + bitácora) · `Aceptación T&C · Cotización.html` (flujo
> cliente) · `flujo-reglas.jsx` (AUT-04/04a) · `backend/API-CONTRACT.md §4` (seam, marcado **CRÍTICO**).

## 1. Resumen en una línea
Dos tablas nuevas — `legal_docs` (T&C / Condiciones del Operador **versionadas**, preservando histórico)
+ `legal_acceptances` (registro **inmutable, server-sellado** `AC-YYYY-NNNN` con hash SHA-256 + ip +
server-time, atado a la medida real) — + el helper `hasValidAcceptance()` que respalda AUT-04 (factura
DDP **bloqueada** sin aceptación vigente).

## 2. Por qué (grounding)
- **Hueco confirmado** (`schema-reconciliation.md`): no existen `legal_docs`/`terms`/`consent` ni tabla
  de aceptaciones. Por eso `Invoice` figura 🟡 partial — el gate AUT-04 ("exige aceptación legal
  vigente") **no está respaldado**.
- **El flujo lo exige (AUT-04/04a):** al recibir+medir en CN se (re)liquida la cotización con la medida
  real → el cliente acepta (casilla T&C + evidencia) → recién entonces se emite la factura DDP
  (`borrador → F-2026-XXXX`). Sin aceptación registrada la emisión queda **BLOQUEADA**. Si la medida
  real difiere de la aceptada → **re-aceptación** obligatoria.
- **Evidencia legal real:** la aceptación es prueba (DTD = comisionista, responsabilidad limitada al
  flete — T&C v2.1 §2/§4/§5). Debe ser **inmutable, auditada, server-sellada** (el cliente no forja
  hash/ip/fecha).
- **El Norte ya lo diseñó:** docs versionados (`tyc` v2.1 vigente · `operador` v1.4 vigente, con
  histórico) + bitácora + el seam `window.LegalData` (`API-CONTRACT §4`).

## 3. Decisiones ancladas
1. **Gate AUT-04 = bloqueo duro** (no advisory), tal como el Norte: emitir la factura DDP exige una
   aceptación **vigente** del cliente para esa cotización, **atada a la medida** (cbm/weight/total).
   (A diferencia de 0046 identidad, que es advisory — acá es compliance que **bloquea**.)
   - **§3.1-bis · "Advisory → duro al cerrar C" (decisión founder, Slice B):** el gate se **cablea en
     Slice B** pero arranca en modo **ADVISORY** (avisa, no bloquea), porque el productor de
     aceptaciones reales es Slice C (todavía no existe). Un bloqueo duro hoy dejaría TODA factura DDP sin
     poder emitirse. El gate queda **listo** para volverse bloqueo duro cuando Slice C produzca
     aceptaciones — y entonces se honra §3.1 (bloqueo). El override del operador **siempre queda en la
     auditoría** (`legal_ack: "override"`), así que la decisión es trazable aún en advisory.
2. **Aceptaciones INMUTABLES (append-only):** ni UPDATE ni DELETE (triggers DB que los rechazan). Es
   prueba legal. Publicar una nueva versión de doc **no reescribe** aceptaciones previas (conservan su
   versión histórica).
3. **El servidor sella, el cliente NO:** `accepted_at` (server time), `ip` (real, del request) y `hash`
   (SHA-256 del payload **canónico** + versiones de docs) los pone el servidor. El cliente solo envía
   qué acepta + la medida. **Idempotente** (Idempotency-Key) para no duplicar.
4. **`legal_docs` versionado:** una fila por `(key, version)`; `key ∈ {tyc, operador, …}`; estado
   `vigente|archivada`; `effective_date`. La vigente = la última publicada. `audience` (cliente/interno)
   — solo las de **cliente** entran al gate.
5. **Código `AC-YYYY-NNNN`** vía RPC `next_acceptance_code` (patrón `next_quote_code`), secuencial por
   tenant+año.
6. **Slices:** **A** foundation (migración + lib + seed + tests) · **B** admin (versionado + bitácora)
   + wire del gate en Facturación · **C** flujo de aceptación del cliente (Portal/cotización).

## 4. Approach — Slice A (foundation)

### Migración `0102_capa_legal.sql` (aditiva · números: 0100=costing, 0101=rates ya tomados)
- **`legal_docs`**: `id`, `tenant_id`, `key text`, `name`, `audience` (`cliente|interno`), `version`,
  `effective_date date`, `status` (`vigente|archivada`), `sections int`, `body jsonb` (array
  `[heading, párrafo]`), `created_at`. `unique(tenant_id, key, version)`. Índice parcial `(tenant_id,
  key) where status='vigente'`. RLS por tenant (read authenticated; write admin/service_role).
- **`legal_acceptances`**: `id`, `tenant_id`, `acceptance_code` (`AC-YYYY-NNNN`, unique/tenant),
  `client_id → clients(id)`, `client_markbox` (denormalizado), `quote_code`, `docs jsonb`
  (`[{key,version}]`), `cbm numeric`, `weight_kg numeric`, `total_usd numeric`, `accepted_at
  timestamptz` (server), `ip text`, `hash text` (SHA-256 hex), `idempotency_key text`, `created_at`.
  `unique(tenant_id, idempotency_key)`. RLS por tenant.
  - **Inmutabilidad:** trigger `BEFORE UPDATE OR DELETE` que `raise exception` (append-only · prueba
    legal). Solo INSERT.
  - **Validación cross-tenant** del `client_id` (helper `*_in_tenant` + trigger BEFORE INSERT, lección
    [[0045]]).
- **RPC** `next_acceptance_code(p_tenant uuid default null)` → `AC-YYYY-NNNN` (security definer,
  `set search_path = public`, grant authenticated).
- **Seed:** las 2 docs vigentes de cara al cliente desde `admin-legal.jsx`/`legal/*.md`: `tyc` v2.1
  (2026-05-01) + `operador` v1.4 (2026-04-15) con su `body`. (Las internas — acuerdo B2B, brief seguro
  — NO se seedean: no entran al gate.)
- **NO** se aplica a prod en esta corrida (la aplica el founder).

### `lib/studio/legal/`
- **`types.ts`** (puro, sin Zod): `LegalDoc`, `LegalAcceptance`, `AcceptanceInput`, `DocRef`
  (`{key,version}`), `LEGAL_DOC_KEYS`; `validateAcceptanceInput`; `acceptanceHashPayload(input, docs)`
  (payload **canónico** — orden estable de keys — para hashear); `measureMatches(accepted, current,
  tol)` (¿la medida vigente coincide con la aceptada, con tolerancia?).
- **`seal.ts`**: `sealAcceptance(input, docs, ip, now)` → computa el `hash` SHA-256 canónico + arma el
  record server-sellado. Usa `node:crypto` (sin dep). PURA/testeable (recibe `now`/`ip`).
- **`queries.ts`** (reciben `SupabaseClient`): `currentClientDocs(supabase)` (vigentes audiencia
  cliente) · `listAcceptances(supabase, {client?, doc?, version?})` (bitácora) ·
  **`hasValidAcceptance(supabase, {clientId, quoteCode, cbm, weight, total})` → boolean** (el **gate
  AUT-04**: ¿hay aceptación vigente que matchee la medida?).
- **Tests Vitest** (`lib/studio/legal/__tests__/`): hash canónico determinístico (orden de keys no
  cambia el hash; payload distinto → hash distinto), `measureMatches` (igual/difiere/tolerancia),
  `validateAcceptanceInput`, `hasValidAcceptance` (stub Supabase: hay/no hay, medida coincide/difiere).

### NO en Slice A
UI (admin + cliente), wire del gate en Facturación, registro real de aceptaciones (action de Slice C).
Slice A deja la **fundación verificable**.

## 5. Acceptance

### Slice A
- [x] Migración `0102` aplica limpio: `legal_docs` + `legal_acceptances` con RLS, **trigger de
      inmutabilidad** (UPDATE/DELETE rechazados), unique de idempotencia, validación cross-tenant; RPC
      `next_acceptance_code`; seed `tyc` v2.1 + `operador` v1.4.
- [x] `lib/studio/legal/`: `sealAcceptance` → hash SHA-256 canónico + server-sella at/ip;
      `hasValidAcceptance` resuelve el gate por medida; validadores.
- [x] Tests verdes (hash determinístico, measureMatches, gate, validación).
- [x] `node scripts/verify.mjs` 🟢. Migración `0102` **aplicada a prod** (2026-06-03, verificada).

### Slice B / C
- [x] B: módulo admin `/studio/legal` (read-only, admin-only) — versionado de docs (repositorio +
      histórico + modal "Ver" del body) + bitácora de aceptaciones (KPIs + búsqueda + filtro + modal de
      Evidencia) — + **wire del gate en Facturación** en modo **ADVISORY** (avisa, no bloquea; ver
      decisión §3.1-bis). Flips `Invoice` partial→built (el gate existe y audita, listo para bloqueo duro
      cuando Slice C lo respalde).
- [x] C: flujo de aceptación del cliente en el **Portal** (medida + casilla T&C + evidencia + server-sello).
      Decisión founder = **Opción B "factura borrador, monto exacto"**: el operador crea la factura DDP en
      **borrador** → el cliente la ve en el Portal como "pendiente de aceptar T&C" → acepta el **monto
      EXACTO** (base_amount, pre-IVA) + la medida del envío → el operador emite (el gate de Slice B la
      reconoce). El gate de Facturación **queda en ADVISORY** (no se flipa a bloqueo duro en esta corrida);
      el flip vive en una constante `LEGAL_GATE_HARD_BLOCK = false` trivialmente toggleable (ver §7 · el
      founder la activa cuando haya adopción). Toca Portal respetando la frontera (el Portal SÍ puede usar
      Supabase). Gate 🟢 (969 tests; +21 nuevos).

## 6. Fuera de alcance (respetar)
- **NO UI** en Slice A (admin → B, cliente → C). **NO wire del gate en Facturación** (Slice B). **NO**
  flujo de registro del cliente (Slice C).
- **NO** tocar la frontera público↔ERP en Slice A. **NO** seedear docs internas (no entran al gate).
- **NO** modificar `invoices` ni su máquina de estados en Slice A. **NO** Zod.
- **NO** aplicar la migración a prod (la aplica el founder).

## 7. Notas de implementación

### Slice A (foundation) — cerrado · gate 🟢 (905/905 tests, 41 nuevos en `lib/studio/legal/`)

**Esquema real (`supabase/migrations/0102_capa_legal.sql`, aditiva · aplicada a prod 2026-06-03):**
- `legal_docs(id, tenant_id→tenants, key, name, audience[cliente|interno, CHECK], version,
  effective_date, status[vigente|archivada, CHECK], sections int, body jsonb=[[heading,párrafo]],
  created_at)`. `unique(tenant_id,key,version)`. Índice parcial **`legal_docs_current_uniq` on
  (tenant_id,key) where status='vigente'** → garantiza ≤1 vigente por (tenant,key) a nivel DB (no solo
  por convención). Índice `(tenant_id, audience, status)` para el filtro del gate.
- `legal_acceptances(id, tenant_id, acceptance_code, client_id→clients(id) on delete set null,
  client_markbox, quote_code, docs jsonb=[{key,version}], cbm/weight_kg/total_usd numeric, accepted_at
  timestamptz default now(), ip, hash, idempotency_key, created_at)`. Doble unique:
  `(tenant_id, acceptance_code)` + **`(tenant_id, idempotency_key)`** (idempotencia: reintentos no
  duplican). Índices `(tenant_id, client_id, accepted_at desc)` y `(tenant_id, quote_code)` para
  bitácora + gate.
- RPC **`next_acceptance_code(p_tenant uuid default null)`** → `AC-YYYY-NNNN` (security definer,
  `set search_path = public`, padding 4, resuelve `get_user_tenant_id()` si null). Calca
  `next_referral_code` (0098) / `next_quote_code` (0007). Grant a `authenticated`.
- **RLS fail-closed por tenant.** `legal_docs`: read a cualquier `authenticated` del tenant; write
  (insert/update/delete) **solo admin** del tenant (3 policies que chequean `user_tenants.role='admin'
  and disabled_at is null`, columnas confirmadas en 0019). `legal_acceptances`: read+insert por tenant
  (sin policy de update/delete; además el trigger de inmutabilidad las corta). `service_role all` en
  ambas. Grants explícitos (auto-expose OFF): `legal_acceptances` solo `select, insert` a
  `authenticated` — el update/delete no se otorga (defensa en profundidad junto al trigger).

**Trigger de inmutabilidad (append-only · prueba legal):**
`legal_acceptances_immutable()` es `BEFORE UPDATE OR DELETE FOR EACH ROW` y SIEMPRE hace
`raise exception '… % no permitido', tg_op using errcode='check_violation'` (usa `tg_op` para reportar
si fue UPDATE o DELETE). Solo INSERT pasa. La evidencia no se reescribe ni borra, ni vía PostgREST
directo. (Más fuerte que el freeze de columnas de 0093: acá NINGUNA mutación es válida.)

**Validación cross-tenant del `client_id` (lección [[0045]] / 0093):**
helper `legal_client_in_tenant(p_client, p_tenant)` (security definer, stable, `search_path=public`;
`null → true` porque client_id es nullable) + trigger `legal_acceptances_validate_client()`
`BEFORE INSERT OR UPDATE` → rechaza adjuntar una aceptación a un cliente de otro tenant/inexistente.
Cubre el cliente Supabase directo, no solo la action de Slice C.

**Seed:** las 2 docs **vigentes de cara al cliente** con su `body` jsonb COMPLETO transcrito de
`erp/modules/admin-legal.jsx` (`LEGAL_BODY.tyc` 11 secciones + `LEGAL_BODY.operador` 9 secciones).
Usa dollar-quoting `$body$…$body$` para el array JSON (las comillas internas escapadas con `\"`).
Idempotente: `insert … select from tenants where slug='dtd' … on conflict (tenant_id,key,version) do
nothing` (patrón de 0005 rates). Las internas (acuerdo B2B, brief seguro) **NO** se seedean (no entran
al gate).

**`lib/studio/legal/` (puro donde aplica):**
- `types.ts` — `LegalDoc`/`LegalAcceptance`/`AcceptanceInput`/`DocRef`/`Measure`, const
  `LEGAL_DOC_KEYS=['tyc','operador']`. `validateAcceptanceInput(raw, docs)` (markbox/quote no vacíos,
  docs no vacío, medidas numéricas ≥0; client_id opcional → null). **`acceptanceHashPayload(input,
  docs)`** = payload CANÓNICO: objeto con keys en orden FIJO + docs ordenados estable por (key,version)
  + medida redondeada a 3 decimales, serializado con `JSON.stringify` (no del objeto crudo — el orden
  no dependería del orden de inserción). `measureMatches(accepted, current, tol=0)` = tolerancia
  RELATIVA por dimensión (`diff/max(|a|,|c|) ≤ tol`); ambos 0 → match; NaN → false (fail-closed).
- `seal.ts` — `acceptanceHash(input, docs, ip, acceptedAt)` = SHA-256 hex (`node:crypto`, sin dep) de
  `{v:1, payload:acceptanceHashPayload(...), ip, accepted_at}` → la huella cubre la evidencia completa
  (lo declarado + ip + server-time). `sealAcceptance(input, docs, ip, now)` arma el record
  server-sellado: `accepted_at = now.toISOString()`, `ip` saneada (vacío/espacios → null), `hash`
  computado. **PURA** (recibe now/ip; no toca `Date.now`/`process`) → el test fija ambos y el hash es
  reproducible. El snapshot `docs` conserva el orden enviado, pero el hash es independiente del orden.
- `queries.ts` — `currentClientDocs` (vigente+cliente, parsea body jsonb venga string u objeto),
  `listAcceptances(supabase, {client?, doc?, version?})` (orden desc; cliente en query, doc/version en
  memoria sobre el jsonb), **`hasValidAcceptance(supabase, {clientId, quoteCode, cbm, weight, total,
  tol?})`** = gate AUT-04: busca aceptaciones de ese cliente+cotización y devuelve true si alguna
  matchea la medida vigente vía `measureMatches`; **fail-closed** (sin clientId/quoteCode → false sin
  tocar la DB).

**Decisiones del hash canónico:** (1) el orden de `docs` NO afecta el hash (ordenados estable por
key,version antes de serializar) → aceptar [tyc, operador] o [operador, tyc] da el MISMO hash; (2)
la medida se redondea a 3 decimales en el payload → diferencias sub-mili (ruido de float) no cambian
el hash, pero el gate de medida usa `measureMatches` con su propia tolerancia (independiente); (3) ip
y accepted_at SÍ entran en la huella (`seal.ts`), no en `acceptanceHashPayload` (que es solo "lo que el
cliente declaró") → la evidencia completa queda firmada; (4) prefijo de versión `v:1` en el JSON de
evidencia deja margen a revisar el formato sin colisión futura.

**Pendiente Slice B/C** (fuera de alcance acá): UI admin (versionado + bitácora), wire del gate en
Facturación (`hasValidAcceptance` antes de `draft→emitida`), action de registro del cliente (que llama
`sealAcceptance` + `next_acceptance_code` server-side). Founder: aplicar `0102` a prod.

### Slice A · ROUND 2 — endurecimiento (auditoría adversarial)

Una auditoría de seguridad encontró que la "evidencia inmutable" no era *load-bearing*: `hasValidAcceptance`
decidía solo con 3 números (cbm/weight/total), nunca verificaba el `hash`, ignoraba `docs`/versiones y no
filtraba por tenant. Round-2 cierra eso (gate `node scripts/verify.mjs` 🟢, 919/919 tests, +14 netos):

- **Hash LOAD-BEARING + `acceptanceHashPayload` inyectivo.** El payload canónico ahora incluye **todos**
  los campos de evidencia, también los **server-sellados** (`ip`, `accepted_at`), y **deduplica** `docs`
  por `key+version` con orden estable. Una sola función `hashEvidence(AcceptanceEvidence)` en `seal.ts` es
  la **fuente única** del hash: tanto el sello como el gate pasan por ella → sello y verificación no pueden
  derivar. (Antes `ip`/`accepted_at` quedaban fuera del payload → no sellaban los campos server-sellados.)

- **Gate AUT-04 íntegro** (`hasValidAcceptance`). Para que una aceptación cuente, TODO esto:
  1. **Tenant explícito** — `GateQuery.tenantId` + `.eq("tenant_id", tenantId)` (también en
     `currentClientDocs`). **NO se confía solo en RLS:** el caller de Facturación (Slice B) corre como
     `service_role`, y `service_role using(true)` apaga el aislamiento → sin esto, una aceptación de OTRO
     tenant con el mismo `quote_code` evadiría el gate.
  2. **Hash verificado** — se **recomputa** `hashEvidence` desde los campos de la propia fila y se compara
     con `row.hash`. No cuadra ⇒ evidencia forjada/corrupta ⇒ se descarta.
  3. **Docs vigentes** — la aceptación debe cubrir **TODAS** las keys de cara al cliente
     (`audience='cliente'`) en su **versión vigente** actual (join contra `legal_docs where status='vigente'`).
     **Semántica: re-versión ⇒ re-aceptación** — si se re-versionó un T&C, la aceptación de la versión vieja
     deja de valer (distinto de la re-aceptación por *medida*, que ya existía). Sin docs vigentes
     configuradas ⇒ fail-closed.
  4. **Tol clampeada server-side** (≤ `0.02`) dentro de `hasValidAcceptance` — el caller no puede ablandar
     el gate pasando un `tol` absurdo.

- **`validateAcceptanceInput`: `total_usd > 0`** (no `≥ 0`) — una aceptación legal de un envío con total 0
  no existe (no hay nada que facturar). `cbm`/`weight_kg` sí pueden ser 0 legítimamente.

- **`measureMatches`: cerrado el agujero `0 == 0`** — `total_usd` debe ser `> 0` en **ambos** lados o no hay
  match (un 0 ahí = dato corrupto/coerción fallida → fail-closed, nunca un "0==0" silencioso). `cbm`/`weight`
  ambos 0 sí cuentan como match.

- **Migración `0102` (in-place, sigue sin aplicar a prod):**
  - `hash text NOT NULL` (era nullable).
  - **Idempotencia INTRÍNSECA: `unique(tenant_id, hash)`** — la misma evidencia produce el mismo hash y no
    se duplica. Resuelve el hueco de `unique(tenant_id, idempotency_key)`: en Postgres dos `NULL` no
    colisionan, así que aceptaciones sin `idempotency_key` se podían duplicar; el hash no. `idempotency_key`
    queda como **metadato** (no es el unique real).

- **Deuda HEREDADA del correlativo (`next_acceptance_code`):** `max()+1` sin lock tiene una *race* bajo
  concurrencia — es la **misma deuda de `next_quote_code` / `next_referral_code`**, que la toleran por la red
  del `unique(tenant, code)`. **NO se cambia el patrón ahora.** La action de registro de **Slice C debe
  REINTENTAR** ante un choque de `unique(tenant_id, acceptance_code)` (correlativo legal **sin huecos**):
  re-leer el próximo código y re-insertar. Documentado también en el comentario del RPC en `0102`.

### Slice B (admin + gate advisory) — cerrado · gate 🟢 (948 tests; +17 nuevos en `lib/studio/legal/`)

> **Modo del gate: ADVISORY** ("advisory → duro al cerrar C", §3.1-bis). Sin migración (es una compuerta
> de lectura + audit sobre `invoices`; no se tocó su schema ni su máquina de estados). NO aplicado a prod.

**Gate por MARKBOX (`lib/studio/legal/queries.ts`):**
- La factura DDP (`invoices`, 0077) NO tiene `client_id` ni `quote_code` — el gate de Slice A
  (`hasValidAcceptance`) matchea por esos campos. Por eso Slice B agrega **`hasValidAcceptanceForMarkbox`**
  que matchea por **`client_markbox` + medida**: el MARKBOX está denormalizado en la factura, la medida
  (`cbm`/`weight`) sale del **shipment** (`volume_m3`/`weight_kg`) y el total a comparar = **`base_amount`**
  (pre-IVA, comparable al `total_usd` aceptado).
- **Cero drift entre gates:** la validación de una fila de aceptación (tenant explícito + hash
  load-bearing recomputado desde la fila + docs vigentes + medida con tol clampeada ≤ 0.02) se extrajo a
  un único helper privado **`acceptanceRowValid`**, usado por AMBOS gates. `hasValidAcceptance` se
  refactorizó para usarlo **sin cambiar su comportamiento** (sus tests de Slice A siguen verdes; +2 tests
  de no-regresión nuevos). Fail-closed sin tenant/markbox (no toca la DB).
- **`listLegalDocs`** (nueva): TODOS los docs (vigente + archivada), `key` asc / `version` desc — para el
  repositorio del admin.

**Wire en Facturación (`app/studio/(app)/facturacion/actions.ts`):** helper interno `evaluateLegalGate`
→ `{ required, hasAcceptance }`. `required = shipment.shipment_service === 'puerta_a_puerta_DDP'`
(sin shipment o no-DDP ⇒ `required=false`, el gate no aplica → non-DDP / sin shipment emiten igual que
hoy). `emitInvoice(id, legalOverride?)`: si `required && !hasAcceptance && !legalOverride` ⇒ **no muta** y
devuelve `{ needsLegalAck, warning }`. Si emite con override (sin aceptación) ⇒ audita
`legal_ack: "override"`; con aceptación ⇒ `legal_ack: "valid"`; non-DDP ⇒ no agrega el campo.
**`createInvoice` (emit-on-create):** para no meter un confirm en el drawer, si es DDP sin aceptación
**emite igual** y audita `legal_ack: "override"` — **gap conocido de V1 (advisory):** el create-and-emit no
tiene confirm inline; el confirm explícito vive en el detalle (`emitInvoice`).

**UI (`InvoiceDetailClient.tsx`):** el botón "Emitir factura" llama `emitInvoice(id)`; si vuelve
`needsLegalAck`, NO trata como error ni emite — muestra un **banner warning** (tokens `var(--warning*)`)
con el aviso + un segundo `<ActionButton variant="warning">` "Emitir igual (sin aceptación)" que llama
`emitInvoice(id, true)`. (Detalle: el caso advisory throwea un sentinel interno que el ActionButton
intercepta en `onError` para NO disparar el flash verde de éxito ni el banner rojo de error.)

**Módulo admin `/studio/legal`** (server `force-dynamic`, **admin-only** con el patrón exacto de
`direccion/page.tsx`: `user_tenants.role === 'admin'`, no-admin → `redirect("/studio/dashboard")`).
`LegalClient` con 2 tabs: **Documentos** (repositorio versionado por `key` + histórico en tabla + modal
"Ver" con el `body`) y **Aceptaciones** (3 KPIs: total / este mes / en versión vigente · búsqueda · filtro
por documento · tabla de acuses · modal de Evidencia: cliente/markbox, cotización, docs+versión, medida,
fecha/hora, IP, hash). Read-only (sin "Nueva versión" en este slice). Primitivas reales del Studio
(`Badge`/`EmptyState`/`KpiCard`/`Icon`/tokens), **no** los `ERPUI.*` del mockup. Entry "Legal · T&C" en el
sidebar (grupo SISTEMA, **adminOnly**).

**Pendiente al cerrar Slice B:** Slice C (flujo de aceptación del cliente que *produce* las aceptaciones)
→ cerrado abajo. Founder: aplicar `0102` a prod.

### Slice C (aceptación del cliente en el Portal) — cerrado · gate 🟢 (969 tests; +21 nuevos)

> **Decisión founder: Opción B — "factura borrador, monto exacto".** El operador crea la factura DDP en
> **borrador** → el cliente la ve en el Portal como "pendiente de aceptar T&C" → acepta el **monto EXACTO**
> (`base_amount`, pre-IVA) + la medida del envío → el operador emite (el gate-by-markbox de Slice B la
> reconoce 1:1). Calca el flujo del Norte (reliquidar→aceptar→emitir). **Sin migración** (`0102` ya está en
> prod). **NO** aplicado a prod / **NO** pusheado.

**Descubrimiento (el borrador NO aparece en "Mis facturas").** El Portal OCULTA los borradores
(`listMyInvoices`/`getMyInvoice` filtran `.neq("status","borrador")` + la RLS del portal los excluye), así
que el borrador pendiente se lee con el **admin client** (`createAdminClient`), scopeado EXPLÍCITO por
`tenant_id` + `client_markbox` + `status='borrador'` + shipment DDP. Dos queries nuevas en
**`lib/portal/portal-legal-queries.ts`** (puras, reciben el admin client):
`listPendingAcceptanceInvoices` (card del dashboard) y `getPendingAcceptanceInvoice` (página de
aceptación). Ambas cruzan contra `hasValidAcceptanceForMarkbox` (el gate de Slice B) y EXCLUYEN las que ya
tienen aceptación vigente → idempotencia visible (una orden aceptada deja de aparecer).

**RLS / identidad (insert SOLO vía admin client).** La policy de insert de `legal_acceptances` exige
`tenant_id = get_user_tenant_id()`, que da **NULL** para un cliente del Portal → el cliente **no puede
insertar por su RLS**. Patrón: la **identidad se resuelve PRIMERO con el client de SESIÓN**
(`getPortalClient` → `{id, markbox, …}` + `tenant_id` de `clients`), y **recién después el admin client
escribe**, scopeando TODO explícito (service_role bypassa RLS = defensa en profundidad, no atajo).

**Server action `registerAcceptanceAction`** (`app/portal/(app)/facturas/[code]/aceptar/actions.ts`,
`"use server"`): identidad por sesión → admin client → lee la orden borrador DDP + medida del shipment →
**idempotencia pre-check** (`hasValidAcceptanceForMarkbox` con la medida + `base_amount`: si ya hay
aceptación vigente → ok "ya aceptada" sin insertar) → valida el **checkbox** (fieldError si falta) →
**IP del edge** (helper compartido) → `validateAcceptanceInput` + `sealAcceptance(input, docs, ip,
new Date())` con `cbm`=`shipment.volume_m3`, `weight_kg`=`shipment.weight_kg`, `total_usd`=
`invoice.base_amount`, `quote_code`=`shipment_code` (ref de la orden; si no, `invoice_code`),
`docs`=**TODAS** las vigentes cliente (`currentClientDocs`) → `next_acceptance_code` (admin) con
**reintento ante `23505` de `unique(tenant, acceptance_code)`** (correlativo legal sin huecos, hasta 5
veces) → insert; si el `23505` es por `unique(tenant, hash)` (misma evidencia) → idempotente ok →
`revalidatePath` del Portal. **idempotency_key** determinístico (`inv:<id>|docs:<key@version,…>`) como
metadato; la idempotencia REAL es el `unique(tenant, hash)`.

**Helper de IP compartido (`lib/http/request-ip.ts`).** Extraído de `registro/actions.ts` (ahora ambos lo
reusan): `resolveRequestIp(Headers)` (PURO, testeable) + `getRequestIp()` (lee `next/headers`). Para
**evidencia legal** se confía en el **PRIMER `x-forwarded-for`** porque detrás de Vercel el edge SETEA esa
cadena anteponiendo la IP que observó en el borde (el XFF crudo del cliente queda DESPUÉS); fallback
`x-real-ip` → `"unknown"`. Guarda anti-spoof: si la cadena trae **> 8 saltos** (anómala) no se confía en el
primero y se cae a `x-real-ip`/`unknown`.

**UI del Portal (estilo del Portal, no primitivas del Studio).**
- Página `app/portal/(app)/facturas/[code]/aceptar/page.tsx` (server): resuelve cliente + orden; si no
  aplica → `redirect("/portal/facturas")`. Render: resumen de la orden (subtotal/IVA/total + lines + envío
  con cbm/peso) + el **cuerpo de los dos documentos vigentes** (`<details>` colapsables desde
  `legal_docs.body`) + `<AcceptanceForm>` (client) con **checkbox** + botón "Aceptar y confirmar"
  (anti-doble-submit vía `pending` de `useActionState`). En éxito → confirmación con el **acuse
  `AC-YYYY-NNNN`**.
- Card de descubrimiento `PendingAcceptanceCard` en el dashboard (`app/portal/(app)/page.tsx`): si hay
  pendientes, "Tenés N órden(es) esperando tu aceptación de T&C" con CTA a la única (o lista si son varias).
  Tono atención (dorado `--color-status-warning`, no wine). Solo tokens `var(--*)`, copy es-VE
  sentence-case sin emojis.

**Gate de Facturación = ADVISORY (NO flip a bloqueo duro en esta corrida).** Flipear a duro el día que se
shippea Slice C bloquearía TODA factura DDP en vuelo (cero aceptaciones previas en prod). El flip queda
**trivialmente toggleable** en una sola constante comentada **`LEGAL_GATE_HARD_BLOCK = false`** en
`facturacion/actions.ts`: con `true`, `emitInvoice` de un DDP sin aceptación **no muta y no ofrece
override**, y `createInvoice` con emit-on-create **cae a borrador** (nunca puentea el gate). El **founder lo
pone en `true`** cuando haya adopción (clientes aceptando por el Portal). Honra §3.1 (bloqueo duro) sin el
riesgo de §3.1-bis.

**Tests (Vitest, +21).** El **round-trip** (`lib/studio/legal/__tests__/acceptance-roundtrip.test.ts`) es el
más importante: sella una aceptación EXACTAMENTE como la produce la action (medida del shipment +
`base_amount` + todas las docs vigentes) y asierta que `hasValidAcceptanceForMarkbox` devuelve **true** →
prueba que Slice C produce aceptaciones que el gate de Slice B SÍ reconoce; + negativos (docs incompletos
→ false, medida/total distintos → false). Helper de IP
(`lib/http/__tests__/request-ip.test.ts`): primer XFF / fallback / unknown / cadena anómala. Lógica pura de
`listPendingAcceptanceInvoices`/`getPendingAcceptanceInvoice`
(`lib/portal/__tests__/portal-legal-queries.test.ts`): borrador+DDP+sin-aceptación pasa; emitida / non-DDP
/ ya-aceptada no.

**Gaps conocidos (V1).** (1) El gate sigue advisory hasta que el founder flipee la constante. (2) El flujo
asume el shipment con `volume_m3`/`weight_kg` ya cargados (la reliquidación con medida real es trabajo del
operador en CN, fuera de este slice). (3) No hay notificación push/email al cliente cuando aparece una orden
pendiente (la descubre al entrar al dashboard) — futuro. (4) La página de aceptación no descarga PDF de los
T&C (los muestra inline colapsables) — coherente con el resto del Portal.

### Slice C · ROUND 2 — endurecimiento (auditoría adversarial)

Auditoría read-only: **0 críticos · 2 medios · 4 menores** (los ejes de acceso —IDOR/escalada/cross-tenant—
quedaron cerrados; los hallazgos son de evidencia/robustez). Atendidos:

- **M-1 · la aceptación no estaba atada a la ORDEN puntual.** El gate-by-markbox matcheaba solo por
  `(tenant, client_markbox, medida, total, docs vigentes)` → una aceptación era **fungible** entre facturas
  distintas del mismo cliente con la misma terna (cbm+weight+base_amount). **Fix:** `GateByMarkboxQuery` ahora
  acepta `orderRef?`; cuando llega no-vacío, la query EXIGE `quote_code === orderRef` (filtro
  `.eq("quote_code", orderRef)`). `evaluateLegalGate` (Facturación) pasa `orderRef = invoice.shipment_code` —
  la action de Slice C sella `quote_code = shipment_code`, así que el match es 1:1. **Granularidad = la ORDEN
  (shipment_code), no el invoice_id:** dos facturas del MISMO shipment (re-emisión) comparten aceptación (misma
  orden); facturas de shipments DISTINTOS no. Las queries de descubrimiento + el pre-check de la action también
  pasan `orderRef` (coherencia: una aceptación de otra orden ya no oculta esta ni la da por aceptada). Si
  `shipment_code` fuese null/vacío (non-DDP / sin shipment), NO se pasa `orderRef` → cae al match por terna
  (legacy, no rompe la emisión existente). Para DDP el `shipment_code` SIEMPRE está poblado. Test round-trip +
  negativo cross-shipment.
- **m-5 · precisión del hash vs storage.** El payload canónico redondeaba las 3 dimensiones a 3 decimales,
  pero `legal_acceptances` es `cbm numeric(12,3)` / `weight_kg numeric(12,2)` / `total_usd numeric(14,2)`. Si
  un valor traía 3ª cifra en weight/total, el sello hasheaba distinto a lo que la DB persiste → el gate
  recomputaba otro hash y descartaba la fila válida (falso-negativo silencioso). **Fix:** `roundTo` por
  dimensión — `cbm`→3, `weight_kg`→2, `total_usd`→2 decimales. Seguro hacerlo ahora (cero aceptaciones en prod
  al shippear Slice C).
- **m-6 · `currentClientDocs` con `tenantId` opcional.** Footgun: un caller que lo olvide corriendo con admin
  client (RLS off) recibiría docs vigentes de TODOS los tenants → `requiredVersions` envenenado. **Fix:**
  `tenantId` ahora REQUERIDO (sin `?`); el typechecker lo fuerza. Vacío ⇒ fail-closed (`[]`).

**Documentados (limitaciones aceptadas, sin cambio de runtime):**
- **M-2 · precisión sub-ms de `accepted_at`.** El sello usa SIEMPRE milisegundos (`Date.toISOString()`) y la
  action inserta `accepted_at` EXPLÍCITO (no `default now()`), así que la recomputación del gate matchea.
  INVARIANTE comentada en `seal.ts` + `queries.ts`: toda inserción en `legal_acceptances` debe sellar
  `accepted_at` en ms vía el seal — NO confiar en `default now()` (Postgres guardaría microsegundos → el
  `new Date(raw)` los truncaría a ms → el hash recomputado no matchearía → falso-negativo silencioso). Aplica a
  seeds/imports/migraciones futuras.
- **m-3 · doble-submit concurrente.** Dos submits del mismo form en ms distintos producen 2 filas válidas
  (difieren solo en ms/ip/code). Daño NULO: la factura se emite una vez y ambas filas son evidencia
  consistente; el front-end ya mitiga con `disabled={pending}`. Limitación aceptada (comentada en la action).
- **m-4 · IP solo confiable detrás del edge de Vercel.** En self-host / preview sin edge, el primer XFF es
  spoofeable. La IP es campo de EVIDENCIA, no de control de acceso (no gatea nada). Si se self-hostea, derivar
  la IP de un header FIRMADO por el proxy de confianza. Comentado en `lib/http/request-ip.ts`.

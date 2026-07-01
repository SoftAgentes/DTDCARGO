---
sdd: "0051"
title: "Fidelización & Referidos — niveles por facturación (derivados) + programa de referidos con créditos (Bloque 5 · Comercial)"
status: done
author: "Claude Code (carril Bloque 5 · Norte v2.4)"
created: 2026-06-03
updated: 2026-07-01
supersedes: null
superseded_by: null
related: ["0021", "0041", "0010", "0046", "0043", "0048", "0137"]
confidencialidad: interno
---

# DTD-0051 — Fidelización & Referidos

> **Bloque 5 del roadmap (lado Comercial · Lealtad).** Construye la capa de **retención**: un
> motor de **niveles** (tiers) que clasifica a cada cliente por su facturación real, y un **programa
> de referidos** con créditos que premia a quien trae nuevos clientes. Diseño completo en el Norte
> v2.4 (`erp/modules/fidelizacion-data.jsx` + `fidelizacion.jsx`): 4 pestañas — Dashboard · Niveles ·
> Referidos · Clientes. Filosofía de marca: *"Construyendo confianza cliente a cliente, contenedor a
> contenedor."*

## 1. Resumen en una línea

Modelar lealtad como dos piezas: **niveles** (Bronze/Silver/Gold/Platinum, **derivados** de la
facturación trailing-12-meses de `invoices`, no almacenados) + **referidos** (tabla nueva `referrals`
con ciclo invitado→registrado→primer-embarque→acreditado y crédito al referidor), con su pantalla
`/studio/fidelizacion`.

## 2. Por qué (grounding)

- **Hueco confirmado:** el tier ya se *insinúa* en dos lados pero no tiene casa propia: (a) `clients`
  tiene un `tier` **manual** (`regular|vip|premium`, SDD-0010) que un asesor setea a mano y no refleja
  facturación; (b) el Norte (`fidelizacion-data.jsx`) define un tier **derivado** por facturación anual
  (Bronze/Silver/Gold/Platinum) que **hoy no existe en el backend**. No hay programa de referidos de
  ningún tipo (la tabla `referrals` no existe).
- **Dato real disponible:** la facturación por cliente sale de `invoices` (`client_markbox`,
  `total_amount`, `currency`, `fx_rate`, `status`, `issued_at` — SDD-0021). El motor de niveles se
  **deriva** de ahí (igual que `invoiceKpis.billedYtd` ya agrega por tenant), sin columna nueva ni
  drift.
- **Simetría:** Bloque 5 ya cerró Dirección (0048) y Documentos (0049); Fidelización es la pieza
  **Comercial** que faltaba — retención/crecimiento, sin dependencias externas (a diferencia de
  Conversaciones, que necesita WhatsApp Business API + IMAP/SMTP). Buildable hoy de punta a punta.
- **Norte v2.4 ya lo diseñó completo:** `fidelizacion.jsx` (4 tabs) + `fidelizacion-data.jsx`
  (TIERS, REFERRAL_RULES, tierOf/tierProgress, topReferrers, programStats). Esta spec lo lleva a
  Supabase nativo, anclando los niveles a `invoices` reales en vez del `c.billed` mock del Norte.

## 3. Decisiones ancladas (antes de codear)

1. **Niveles = DERIVADOS, no almacenados.** Se computan de la facturación **trailing-12-meses**
   (USD-normalizada) por cliente, con los umbrales del Norte:
   `Bronze 0` · `Silver 50.000` · `Gold 150.000` · `Platinum 300.000` (USD). Espejo exacto de
   `tierOf()`/`tierProgress()` del Norte. **Coexiste** con el `client.tier` manual
   (`regular|vip|premium`) — son **conceptos distintos**, y esta spec **NO toca** `client.tier` ni su
   UI. (V2 podría reconciliarlos; fuera de alcance.)
2. **Normalización a USD:** `USD`/`USDT` → `total_amount` 1:1; `VES` → `total_amount / fx_rate` (si
   `fx_rate` presente y > 0, sino se omite la factura del cómputo); `CNY` → omitida en V1 (raro;
   documentado). Solo cuentan facturas `status ∈ {emitida, parcial, pagada, vencida}` (excluye
   `borrador`/`anulada`).
3. **Referidos = tabla nueva** `referrals` + RLS fail-closed por tenant. El **referidor es un
   cliente existente** → FK real `referrer_client_id → clients(id)` (no polimórfico); el **referido
   aún no es cliente** → `referred_client_id` nullable hasta que se convierte. Integridad cross-tenant
   reforzada en DB (trigger, lección [[0045]]).
4. **Código de referido (2 conceptos, como el Norte):** (a) `referral_code` = id de registro
   **secuencial** `REF-YYYY-NNNN` vía RPC `next_referral_code` (patrón `next_quote_code`); (b)
   `referralShareCode(markbox)` = código para compartir, **determinístico** y puro (`DTD-5452 → REF-5452`),
   no se persiste.
5. **Reglas de recompensa = constantes en código** (referidor **$80** / referido **$60** USD) para
   V1 (`REFERRAL_RULES`). Tabla de config = V2.
6. **Créditos = ADVISORY.** "Acreditar" marca `status='acreditado'` + setea `reward_usd`; **NO**
   postea a Facturación/CxC ni mueve plata. Mismo patrón advisory que la verificación de identidad
   (0046) — el crédito queda visible ("pendiente de aplicar") y el operador lo aplica a mano en la
   próxima factura. Esto **sigue siendo cierto en la Fase 2** (la acreditación se automatizó, pero
   la **aplicación** del crédito a la próxima factura sigue manual → la diseña [[0137]]).
7. **Slices:** A foundation (migración + `lib/studio/fidelizacion/` + tests) → B UI
   (`/studio/fidelizacion` 4 tabs + acciones registrar/acreditar referido + entrada sidebar COMERCIAL)
   → **C acreditación automática (Fase 2, LIVE)**: captura `?ref=` en `/registro` + trigger que acredita
   al referidor en la 1ª factura del referido. La **aplicación** del crédito (Fase 3) sale del alcance
   de esta spec y se diseña aparte en [[0137]].

## 4. Approach — staged (Slice A arranca)

### Slice A — Foundation: schema + motor + queries (sin UI) ← arranca acá

- **Migración** `0098_fidelizacion_referidos.sql` (aditiva; no toca tablas existentes):
  - enum `referral_status` (`invitado`, `registrado`, `primer-embarque`, `acreditado`).
  - tabla `referrals`:
    - `id uuid pk default gen_random_uuid()`
    - `tenant_id uuid not null → tenants(id) on delete cascade`
    - `referral_code text not null` (`REF-YYYY-NNNN`), **único por tenant** (`unique (tenant_id, referral_code)`)
    - `referrer_client_id uuid → clients(id) on delete set null` (cliente que refiere)
    - `referrer_markbox text not null` (denormalizado, sobrevive si se borra el cliente; display)
    - `referred_name text not null`
    - `referred_company text`
    - `referred_email text`
    - `referred_phone text`
    - `referred_client_id uuid → clients(id) on delete set null` (cuando el referido se hace cliente)
    - `status referral_status not null default 'invitado'`
    - `reward_usd numeric(12,2) not null default 0` (crédito al referidor; se setea al acreditar)
    - `lead_id text` (link opcional al CRM/Kommo)
    - `notes text`
    - `created_at`, `updated_at`, `deleted_at` (soft delete)
  - RLS fail-closed (patrón 0090/0096): policy `referrals by tenant` (`tenant_id = get_user_tenant_id()
    and deleted_at is null` / with check `tenant_id = get_user_tenant_id()`) + `referrals service_role all`.
  - Grants explícitos (`authenticated` CRUD + `service_role` all). Trigger `touch_updated_at` (0002).
  - índices parciales (`where deleted_at is null`): `(tenant_id, status)`, `(tenant_id, referrer_markbox)`.
  - **Validación de integridad cross-tenant en DB** (lección [[0045]]): helper
    `referral_client_in_tenant(p_client uuid, p_tenant uuid) returns boolean` (`security definer`,
    `set search_path = public`; `null → true`; sino `exists(select 1 from clients where id=p_client and
    tenant_id=p_tenant and deleted_at is null)`) + trigger `referrals_validate_clients` **BEFORE INSERT
    OR UPDATE** que valida `referrer_client_id` y `referred_client_id` contra `NEW.tenant_id` (rechaza
    `check_violation` si alguno es de otro tenant / inexistente). Cubre PostgREST directo, no solo la
    action.
  - RPC `next_referral_code(p_tenant uuid default null) returns text` — `REF-YYYY-NNNN` secuencial por
    tenant y año (calca `next_quote_code`: `security definer`, `set search_path = public`, grant a
    `authenticated`; resuelve tenant de `get_user_tenant_id()` si `p_tenant` null; cuenta sobre
    `referrals` del tenant en el año).
  - **Sin seed** (los referidos los carga el operador; los clientes/facturas ya existen).
- **`lib/studio/fidelizacion/types.ts`** (puro, sin Zod):
  - `TIERS` (4 niveles con `id`, `label`, `tone`, `min`, `benefits[]`) — calca `fidelizacion-data.jsx`.
    Tonos del sistema: `neutral`/`info`/`warning`/`wine`.
  - `tierOf(billedUsd)`, `nextTier(tier)`, `tierProgress(billedUsd)` → `{ pct, toNext, tier, next }`
    (espejo exacto del Norte; testeados contra los mismos casos).
  - `REFERRAL_RULES` (`referrerReward: 80`, `referredReward: 60`, `currency: 'USD'`).
  - `REFERRAL_STATUS` (label/tone/step por estado) + `REFERRAL_STEPS` (orden del timeline).
  - `referralShareCode(markbox)` (`DTD-5452 → REF-5452`, determinístico puro).
  - tipos `Referral` (fila), `ReferralInput`, `ReferralActionState`.
  - `validateReferralInput(raw)` — `referrer_markbox` no vacío, `referred_name` no vacío/≤200,
    email válido si viene, status ∈ enum, devuelve `{input}` | `{fieldErrors}`.
  - `invoiceUsdAmount(invoice)` helper de normalización (decisión §3.2).
- **`lib/studio/fidelizacion/queries.ts`** (puras, reciben `SupabaseClient`; confían en RLS por tenant):
  - `clientAnnualBilling(supabase, now?)` → `Map<markbox, billedUsd>` agregando `invoices` de los
    últimos 12 meses, USD-normalizadas (§3.2).
  - `clientsWithTier(supabase, now?)` → clientes + `billedUsd` + `tier` derivado, orden desc por billed.
  - `tierCounts(supabase, now?)` → `[{ tier, count }]` (distribución por nivel).
  - `listReferrals(supabase, { status?, q? })` + `referralsByReferrer(supabase, markbox)`.
  - `programStats(supabase)` → `{ total, acreditados, activos, creditsIssued, convRate }`.
  - `topReferrers(supabase, n=5)` → ranking por acreditados/total + créditos, con datos del cliente.
  - `creditsEarned(referrals, markbox)` / `pendingCredits(...)` (puras sobre el set, como el Norte).
- **Tests Vitest** (`lib/studio/fidelizacion/__tests__/`):
  - `types.test.ts`: `tierOf` (los 4 cortes + bordes 49.999/50.000), `tierProgress` (pct/toNext/
    nivel-máximo), `referralShareCode`, `validateReferralInput` (todos los caminos), `invoiceUsdAmount`
    (USD/USDT 1:1, VES con/sin fx_rate, CNY omitida).
  - `queries.test.ts`: stub `SupabaseClient` chainable que registra filtros → asserta agregación de
    `clientAnnualBilling` (trailing-12m, exclusión borrador/anulada, normalización), `tierCounts`,
    filtros de `listReferrals`.

### Slice B — UI `/studio/fidelizacion` (operable)

`page.tsx` server (lee queries de Slice A) + `FidelizacionClient` con 4 tabs calcando el Norte
(Dashboard: 4 KPI + distribución por nivel + top referidores + "cómo funciona"; Niveles: cards de
tiers; Referidos: tabla + filtro estado + drawer con timeline + acción registrar/acreditar; Clientes:
tabla con tier + progreso + créditos + referidos). Server actions `registerReferral` (usa
`next_referral_code`) + `accreditReferral` (status→acreditado, reward_usd=80, advisory) +
`updateReferralStatus`. Entrada en sidebar grupo **COMERCIAL** (`/studio/fidelizacion`, icon `star`).
`ui-ux-designer` pre-commit. **(No en Slice A.)**

### Slice C — Acreditación automática (Fase 2, LIVE) ✅

> **Shipped** (migr `0197_referral_auto_accredit` + `/registro` + Portal invitar). Cierra el lazo del
> programa: el referido llega por un enlace, se linkea al registrarse, y el referidor cobra su crédito
> **automático** en la 1ª compra real del referido — sin que el operador acredite a mano. **Sigue siendo
> advisory** (no postea a CxC): solo *registra* el crédito. La **aplicación** del crédito a la próxima
> factura la diseña [[0137]].

**1. Captura del referido (`?ref=`) e invitación.**

- **Invitar por correo** (Portal, cara cliente): un cliente logueado invita a un importador por correo.
  `lib/portal/referral-invite.ts` (`inviteReferral`) crea la fila `referrals` en `status='invitado'`,
  `reward_usd=0`, con `referral_code` secuencial (`REF-YYYY-NNNN` vía `next_referral_code`). Anti-abuso:
  dedup por `(referrer_markbox, referred_email)` + tope diario `MAX_INVITES_PER_DAY=10`. El correo
  (`buildReferralInviteEmail`) enlaza a `/registro?ref=REF-YYYY-NNNN`. **Invitar NO acredita nada.**
- **Link al registro.** `app/registro/actions.ts` (paso 6b, best-effort) llama
  `linkReferralOnRegister(admin, …)` con el `?ref=` del form si vino. Dos caminos
  (`lib/portal/referral-link.ts`):
  - **`ref` = código secuencial** (`REF-YYYY-NNNN`, invitación por correo): busca la fila `invitado`
    del tenant, rechaza autoreferido (`referrer_markbox === newMarkbox`), y la avanza a
    `status='registrado'` seteando `referred_client_id = <cliente nuevo>`.
  - **`ref` = código compartido** (`REF-XXXX`) **o markbox** (`DTD-XXXX`): deriva el markbox del
    referidor (`REF-5452 → DTD-5452`), verifica que exista en el tenant, dedup por
    `referred_client_id` ya linkeado; si hay una invitación previa por correo del mismo referidor la
    **reclama** (evita huérfanos), si no **crea** una fila nueva en `registrado`
    (`referral_code` fresco, `reward_usd=0`).
  - Un fallo acá **nunca** rompe el alta (igual que el vínculo del estimado web).

**2. Trigger de acreditación (migr `0197_referral_auto_accredit`).**

- Índice FK parcial `referrals_referred_client_idx` sobre `referred_client_id` (el trigger filtra por
  esa columna en cada factura emitida; sin índice sería un scan).
- Función `accredit_referral_on_first_invoice()` (`security definer`, `set search_path = public`;
  `revoke execute … from public, anon` — convención de seguridad del repo).
- Trigger `invoices_accredit_referral` **AFTER INSERT OR UPDATE OF status ON invoices**. Al emitirse la
  1ª factura *billable* de un cliente referido:
  - **Señal de "primera compra"** = factura en estado `emitida|parcial|pagada|vencida` (**NO** el
    embarque, decisión founder 2026-07-01). Ignora `borrador`/`anulada` y filas con `deleted_at`.
  - En `UPDATE` solo dispara si el `status` **cambió** (`old.status is not distinct from new.status` →
    return) — evita re-disparos por otras ediciones de la factura.
  - Resuelve el cliente por `client_markbox → clients.id` (las facturas linkean por markbox), scopeado
    por `tenant_id` (que RLS ya forzó = tenant del caller) → sin fuga cross-tenant.
  - `update referrals set status='acreditado', reward_usd=80` **where** `referred_client_id = <cliente>`
    **and** `status in ('registrado','primer-embarque')`.

**3. Idempotencia por estado.** No hace falta contar "es la primera factura": solo la 1ª encuentra el
referido en `registrado`/`primer-embarque` y lo pasa a `acreditado`; las facturas siguientes lo ven
`acreditado` y el `where` no matchea → no-op. Barato y a prueba de carreras.

**4. Naturaleza advisory (crítico).** El trigger **solo registra** el crédito (`status='acreditado'`,
`reward_usd=80`, `REFERRAL_RULES.referrerReward`). **NO** postea a CxC/Facturación/Contabilidad ni genera
ningún asiento. El crédito queda visible en el Portal del referidor (`getMyreferralProgram` →
`creditsEarnedUsd`) como "ganado". **Aplicarlo** a la próxima factura sigue siendo manual → lo automatiza
[[0137]].

**Fuera de esta Slice (→ [[0137]] o V2):** aplicar el crédito a la próxima factura (descuento / nota de
crédito) + su asiento contable · auto-avance a `primer-embarque` por evento de embarque · tabla de config
de reglas por tenant.

## 5. Acceptance

### Slice A
- [x] Migración `0098` aplica limpio: enum `referral_status`, tabla `referrals` con RLS fail-closed +
      grants + índices + trigger `touch` + trigger de validación cross-tenant; RPC `next_referral_code`
      devuelve `REF-YYYY-NNNN` secuencial por tenant. _(escrita; pendiente de aplicar por el founder)_
- [x] `lib/studio/fidelizacion/types.ts`: `tierOf`/`tierProgress` dan los mismos resultados que
      `fidelizacion-data.jsx` del Norte; `referralShareCode` determinístico; `validateReferralInput`
      cubre happy path + errores; `invoiceUsdAmount` normaliza por moneda.
- [x] `lib/studio/fidelizacion/queries.ts`: 8 funciones read-only (`clientAnnualBilling`,
      `clientsWithTier`, `tierCounts`, `listReferrals`, `referralsByReferrer`, `programStats`,
      `topReferrers` + helpers puros `creditsEarned`/`pendingCredits`); `clientAnnualBilling` agrega
      `invoices` trailing-12m USD-normalizadas excluyendo borrador/anulada.
- [x] Tests Vitest verdes para tiers, validadores, normalización y agregación (stub Supabase).
- [x] `node scripts/verify.mjs` 🟢 (lint 0 err + typecheck + 753 tests + docs:check). Sin UI, sin server actions.
- [x] La migración `0098` **NO** se aplica a prod en esta corrida (la aplica el founder).

### Slice B
- [x] `/studio/fidelizacion` con 4 tabs operables (Dashboard / Niveles / Referidos / Clientes);
      registrar/acreditar referido funcionan (`registerReferral` con `next_referral_code` +
      resolución de `referrer_client_id` por MARKBOX · `accreditReferral` advisory reward 80 ·
      `updateReferralStatus`); sidebar COMERCIAL muestra la entrada (`star`, `/studio/fidelizacion`);
      gate 🟢 (0 err lint + typecheck + 753 tests + docs:check). _(`ui-ux-designer` lo corre el orquestador.)_

### Slice C — Acreditación automática (Fase 2, LIVE) ✅
- [x] `/registro?ref=` captura el referido: `linkReferralOnRegister` avanza la fila a `registrado` y
      setea `referred_client_id` (best-effort, no rompe el alta). Dos caminos (código secuencial vs
      compartido/markbox), rechazo de autoreferido, reclamo de invitación por correo previa.
- [x] Portal "Invitar por correo" (`inviteReferral`) crea la fila `invitado` (`reward_usd=0`) con dedup
      + tope diario y envía el correo con enlace `/registro?ref=…`.
- [x] Migr `0197_referral_auto_accredit`: índice FK + función `accredit_referral_on_first_invoice`
      (`security definer`, execute revocado a `public`/`anon`) + trigger
      `invoices_accredit_referral` (AFTER INSERT OR UPDATE OF status). Acredita al referidor
      (`status='acreditado'`, `reward_usd=80`) en la 1ª factura *billable* del referido.
- [x] Idempotente por estado (solo `registrado`/`primer-embarque` → `acreditado`); scopeado por
      `tenant_id`; señal = factura billable (no embarque).
- [x] **Advisory**: el trigger NO postea a CxC ni genera asiento. La **aplicación** del crédito queda
      para [[0137]].

## 6. Modelo de datos (resumen)

`referrals` (nueva, polimórfico-free): FK `referrer_client_id`/`referred_client_id → clients(id)`,
`referrer_markbox` denormalizado, `status` (enum), `reward_usd`, `referral_code` único/tenant. Niveles
= **0 tablas** (derivados de `invoices`). No se modifica `clients` ni `invoices`.

## 7. Fuera de alcance (respetar)

- No tocar `client.tier` manual (regular/vip/premium) ni su UI/validación (SDD-0010).
- No **aplicar/postear** créditos a Facturación/CxC/Contabilidad (advisory: el crédito se *registra*,
  Slice C lo automatizó; **aplicarlo** a la próxima factura + su asiento lo diseña [[0137]]).
- No auto-avanzar estados por eventos de embarque (`primer-embarque` sigue manual; la acreditación de
  Slice C dispara directo por la 1ª factura, sin pasar por embarque).
- No tabla de config de reglas (constantes en código: `REFERRAL_RULES`).
- La captura `?ref=` de Slice C vive en el **sitio público** (`/registro`), pero solo escribe vía el
  **admin client del Studio** en la server action; no cruza `@/lib/studio` al bundle público (frontera
  intacta). El resto es Studio (`@/lib/db/server` + Server Actions).

## 8. Notas de implementación

_(Las completa el implementer al cerrar cada slice.)_

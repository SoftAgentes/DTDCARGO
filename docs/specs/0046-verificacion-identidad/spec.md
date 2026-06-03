---
sdd: "0046"
title: "Verificación de identidad de clientes — motor 2 vías (CNE cédula + SENIAT RIF), advisory"
status: in-progress
author: "DTD Cargo"
created: 2026-06-03
updated: 2026-06-03
supersedes: null
superseded_by: null
related: ["0042", "0010"]
confidencialidad: interno
---

# DTD-0046 — Verificación de identidad de clientes

> **"Clientes reales, no basura."** Desde el registro self-service (SDD-0042 Fase 6) los
> clientes se dan de alta solos y quedan **activos al instante** (foto de cédula/RIF + MARKBOX).
> Este SDD le da al equipo una **herramienta interna/CRM** para **verificar la identidad** de esos
> clientes —documento ↔ nombre contra el registro oficial— **sin bloquear** el acceso: un badge
> "corresponde / no corresponde" en el detalle del cliente, y si no corresponde, un aviso al equipo.

> **Plan completo (CEO-reviewed, aprobado 2026-06-03):** las decisiones de scope/arquitectura viven
> en el plan `merry-snuggling-flute.md`. Esta spec lo ancla en el repo y se actualiza a `done`
> cuando las 3 slices estén shipped.

---

## 1. Resumen en una línea

Motor de verificación **document-type-aware**: cédula de **persona → CNE**, RIF de **empresa →
SENIAT**, ambos automáticos con **piso manual** del asesor como fallback. El resultado es
**advisory** (siempre muestra el nombre/razón social que devolvió el registro para cotejo a ojo; el
badge **nunca auto-rechaza** ni bloquea al cliente). Campos genéricos `doc_verify_*` en
`public.clients` (fuente `cne | seniat | manual`). Helpers puros de clasificación/parseo de
documento + comparación tolerante de nombres. Multi-tenant por la RLS ya vigente de `clients`.

---

## 2. Por qué dos vías (grounding)

- El **número de documento se guarda en `clients.rif`** (cédula para persona, RIF para empresa) —
  ver `app/portal/(auth)/registro/actions.ts:184` + comentario `:126`. El dato existe para consultar.
- **`kind` (persona/empresa) NO se persistía** — solo vivía en el form del registro. Este SDD lo
  guarda (`doc_kind`).
- El **CNE solo cubre cédulas (personas).** Un RIF de empresa (`J-…`) no está en el padrón electoral
  → para empresas la fuente es **SENIAT** (Consulta de RIF), que devuelve razón social + estado
  fiscal pero está detrás de **CAPTCHA**.
- **Prefijos VE:** `V-`/`E-` → persona (cédula) · `J-`/`G-` → empresa (RIF). Ojo: el RIF de persona
  natural también empieza con V (= su cédula) → para clasificar el tipo, **J/G = empresa, el resto =
  persona**.

---

## 3. Approach — staged (3 slices)

El valor de la **vía cédula** ships independiente del **SENIAT** (frágil por el CAPTCHA). Cada slice
pasa por `node scripts/verify.mjs` + reviewer del harness.

### Slice A — Foundation (sin llamadas externas) ← **esta entrega**

1. **Migración `0092_identity_verification.sql`** — aditiva, nullable, **sin tocar RLS** (las
   columnas heredan la RLS multi-tenant de `clients`). Agrega a `public.clients`:
   - `registration_channel text not null default 'admin'` — backfill `'portal'` donde
     `cedula_photo_path is not null`.
   - `doc_kind text` — `'persona' | 'empresa'`. Backfill por prefijo del `rif` (J/G → empresa; rif
     no-null y no-J/G → persona; rif null → null).
   - `doc_verify_status text` — `null | 'ok' | 'mismatch' | 'unavailable'`.
   - `doc_verify_source text` — `'cne' | 'seniat' | 'manual'`.
   - `doc_registry_name text` — nombre/razón social devuelto por el registro.
   - `doc_verified_at timestamptz` · `doc_verified_by uuid references auth.users(id)`.
   - *Sin tabla de audit nueva* (los campos en `clients` alcanzan V1).
2. **Helpers puros + tests (Vitest)** en `lib/studio/identity/`:
   - `document.ts` — `classifyDocument(rif): 'persona' | 'empresa' | 'unknown'` (V/E → persona;
     J/G → empresa; sin prefijo numérico → persona; null/basura → unknown) + `parseCedula(rif):
     { nationality: 'V' | 'E'; number: string } | null` (separa prefijo/puntos/guiones/espacios y
     devuelve el número limpio que pide el CNE; null si no parsea como cédula).
   - `name-match.ts` — `normalizeName(s)` (uppercase, sin acentos/Ñ, remueve sufijos societarios
     `C.A./S.A./COMPAÑIA ANONIMA/SRL/…`, tokens ordenados alfabéticamente) + `compareNames(a, b):
     { score, verdict: 'ok' | 'mismatch' }` con **umbral conservador** (ver §5.3).
3. **Wire del registro** — `app/portal/(auth)/registro/actions.ts`: el insert de `clients` setea
   `registration_channel: 'portal'` + `doc_kind: input.kind`. (Nada más en ese archivo.)

> Slice A **NO** hace ninguna llamada externa, NO crea adapter/providers, NO server action de
> verificación, NO UI. Es solo el modelo de datos + la lógica pura testeable + el wire del origen.

### Slice B — Vía cédula/CNE end-to-end (entrega valor aunque SENIAT nunca funcione) · NO en esta entrega

- **Adapter** server-only en `lib/studio/identity/`: `types.ts` (`IdentityProvider` interface +
  `VerifyResult`), `index.ts` (`verifyIdentity(client)` rutea por `doc_kind`; provider
  caído/timeout/parse-fail → `unavailable`, nunca tira; compara con `compareNames`),
  `providers/cne-cedulave.ts` (impl gratis, elegida por env `IDENTITY_CNE_PROVIDER`; hueco
  `cne-verifik.ts` documentado para swap pago).
- **Server action** `verifyIdentityAction` en `app/studio/(app)/clientes/actions.ts` (patrón del
  Studio; RLS scopea al tenant + filtro explícito `tenant_id`): `verifyIdentity()` → UPDATE
  `doc_verify_*` → si `mismatch` dispara **alerta email al equipo** (reusa `lib/studio/mail/`;
  best-effort) → `revalidatePath`. Cache por `doc_verified_at`.
- **Acción manual** `markIdentityAction(clientId, markbox, verdict)` — piso manual (`source='manual'`).
- **UI** `IdentityVerificationCard` en `clientes/[markbox]/page.tsx` (foto vía signed URL + badge
  advisory + "Verificar con CNE" + piso manual con deep-link). **Lista** `clientes`: filtro
  "pendientes de revisar" = `registration_channel='portal'` AND `doc_verify_status is null`.

### Slice C — Vía RIF/SENIAT (gated por spike) · NO en esta entrega

- **Spike PRIMERO** (`scripts/spikes/seniat-captcha.mjs`, fuera del prod path): baja N CAPTCHAs →
  tesseract (OCR local) → reporta accuracy. **Gate:** si el OCR no rinde → SENIAT queda
  `unavailable` y la empresa usa solo el piso manual (deep-link); el solver pago queda deferred.
- `providers/seniat-scrape.ts` — sesión → CAPTCHA → OCR local → POST → parsea razón social + estado;
  retry N, si falla → `unavailable`. Wire al mismo `verifyIdentityAction` (rama empresa) + el mismo
  card (botón "Verificar con SENIAT").

---

## 4. Schema (esqueleto · Slice A)

```sql
alter table public.clients
  add column if not exists registration_channel text not null default 'admin',
  add column if not exists doc_kind             text,   -- 'persona' | 'empresa'
  add column if not exists doc_verify_status    text,   -- null|'ok'|'mismatch'|'unavailable'
  add column if not exists doc_verify_source    text,   -- 'cne'|'seniat'|'manual'
  add column if not exists doc_registry_name    text,
  add column if not exists doc_verified_at       timestamptz,
  add column if not exists doc_verified_by       uuid references auth.users(id);

-- backfill: portal where cedula_photo_path is not null;
--           doc_kind por prefijo del rif (J/G → empresa; resto no-null → persona).
-- RLS: SIN cambios — las columnas heredan la RLS multi-tenant de clients.
```

---

## 5. Decisiones de diseño

### 5.1 Campos genéricos `doc_verify_*`, no `cne_*`
El modelo aguanta **ambas fuentes** (CNE persona / SENIAT empresa) + el piso manual del asesor con
un solo juego de columnas (`doc_verify_source` distingue). Evita duplicar columnas por fuente y deja
el swap de provider transparente al schema.

### 5.2 Advisory, no gate
El resultado **nunca** bloquea ni auto-rechaza al cliente (sigue activo). Siempre se guarda y muestra
`doc_registry_name` para que el asesor **cotee a ojo** aunque el match automático se equivoque. Esto
es revisión **interna/CRM**, no un control de acceso. (`doc_verify_status` no participa de ninguna
RLS ni de ningún gate del portal.)

### 5.3 Umbral conservador en `compareNames` (Slice A)
Los nombres venezolanos son ruidosos: compuestos, apellido de casada, segundo apellido, acentos,
`C.A.`, typos. Un falso `mismatch` desconfía de un cliente legítimo y molesta al asesor; un falso
`ok` solo **no levanta** la alerta (el asesor igual ve ambos nombres). Por eso el umbral favorece
`ok`: `compareNames` declara `mismatch` **solo** cuando hay divergencia clara de tokens, y aplica un
**rescate por subconjunto** (si los tokens del nombre más corto están todos contenidos en el largo
→ `ok`, p.ej. "MARIA PEREZ" ⊆ "MARIA J PEREZ GOMEZ"). El piso está documentado en la constante
`NAME_MATCH_THRESHOLD` (hoy `0.34`, Jaccard de tokens). Si falta el nombre del registro, devuelve
`ok` con score 0 (no inventa divergencia sin datos — aguas arriba el motor decidirá `unavailable`).

### 5.4 Helpers puros separados de la red
`document.ts` y `name-match.ts` no hacen I/O: son el **corazón testeable** (clasificación de
documento, parseo de cédula, comparación de nombres). El adapter/providers (Slice B/C) los consumen,
pero la lógica frágil se valida sin DB ni red. No había normalizador de nombres reutilizable en
`lib/` (el más parecido es el `normalize()` **privado** de `lib/studio/comments/mention-parse.ts`,
acotado a tokens de @mención — no quita sufijos societarios ni ordena tokens), por eso `name-match`
trae el suyo.

### 5.5 Persistir `doc_kind` desde el origen
El registro self-service ya conoce `input.kind`; persistirlo en el alta evita re-inferir el tipo en
cada verificación. El backfill (migración) cubre los clientes históricos por prefijo del `rif`.

---

## 6. Acceptance

### Slice A (esta entrega)
- [x] Migración `0092` aplica: 7 columnas nuevas en `clients`, **aditivas y nullable** (salvo
      `registration_channel` con default `'admin'`), **sin tocar la RLS** existente.
- [x] Backfill: `registration_channel='portal'` donde `cedula_photo_path is not null`; `doc_kind`
      por prefijo del `rif` (J/G → empresa; rif no-null no-J/G → persona; rif null → null).
- [x] `classifyDocument`: V/E → `'persona'` · J/G → `'empresa'` · sin prefijo numérico → `'persona'`
      · null/vacío/prefijo raro → `'unknown'`; case-insensitive en el prefijo.
- [x] `parseCedula`: separa prefijo/puntos/guiones/espacios → `{ nationality, number }` limpio;
      default `V` sin prefijo; **null** para RIF empresa (J/G), sin dígitos, o número absurdo.
- [x] `normalizeName`: quita acentos (Ñ→N), remueve sufijos societarios (`C.A./S.A./COMPAÑIA
      ANONIMA/S.R.L.`), ordena tokens (orden nombre/apellido irrelevante).
- [x] `compareNames`: igual → `ok` (score 1) · orden invertido → `ok` · acentos → `ok` · `C.A.` ↔
      sin `C.A.` → `ok` · claramente distinto → `mismatch` · "MARIA PEREZ" vs "MARIA J PEREZ GOMEZ"
      → `ok` (borderline documentado) · casada/2º apellido (subconjunto) → `ok` · falta un lado →
      `ok` score 0.
- [x] Registro `app/portal/(auth)/registro/actions.ts`: el insert setea `registration_channel:
      'portal'` + `doc_kind: input.kind`.
- [x] `node scripts/verify.mjs` VERDE (lint + typecheck + test + docs:check). Frontera público↔ERP
      intacta.

### Slice B (futuro)
- [ ] `verifyIdentity` con provider mock: `ok` / `mismatch` / `unavailable`, ruteo persona→CNE.
- [ ] `verifyIdentityAction`: update de `doc_verify_*` + filtro `tenant_id` + alerta email en
      `mismatch` (stub supabase/mail) + cache por `doc_verified_at`.
- [ ] `IdentityVerificationCard` en el detalle del cliente (foto + badge advisory + "Verificar con
      CNE" + piso manual); filtro "pendientes de revisar" en la lista. light+dark, solo `var(--*)`,
      `ui-ux-designer`.

### Slice C (futuro, gated por spike)
- [ ] Spike SENIAT reporta accuracy del OCR antes de construir el provider.
- [ ] `providers/seniat-scrape.ts` → `unavailable` si el OCR no rinde N veces; deep-link manual.

---

## 7. Risk register (condensado del review)

| Riesgo | Mitigación |
|---|---|
| Wrapper CNE / SENIAT caído, rate-limit, JSON/HTML basura | `unavailable` + degrade a manual; nunca tira; timeout corto (Slice B/C) |
| OCR resuelve mal el CAPTCHA → razón social equivocada | Resultado **advisory**: se muestra `doc_registry_name` para cotejo; el badge no es autoridad |
| Falsos "no corresponde" (compuestos/casada/acentos/`C.A.`) | Umbral conservador (§5.3) + rescate por subconjunto; el asesor siempre ve ambos nombres |
| Spam de email al equipo (clicks repetidos) | Cache por `doc_verified_at` + alerta solo en `mismatch` (Slice B) |
| Authz (verificar clientes de otro tenant) | Server action vía RLS + filtro explícito `tenant_id` (Slice B) |
| Politeness/legal al sitio gov | Solo click explícito (no bulk/background) + cache; OCR **local** = no comparte la imagen (Slice C) |
| PII | Foto ya en bucket privado; CNE recibe solo el nº de cédula (semi-público); OCR local no filtra |

---

## 8. Out of scope (V1) / Deferred
- **Solver pago de CAPTCHA** (2captcha/anti-captcha) — swap futuro si el OCR local no rinde; ya
  soportado por el adapter.
- **Auto-SENIAT con endpoint/API confiable** — si aparece, swap del provider.
- **OCR de la foto de cédula** para auto-extraer el número y pre-comparar.
- **Provider CNE pago (Verifik)** — swap futuro.
- **Campo "interés / qué querés importar"** en `/portal/registro` (founder lo insinuó para CRM) —
  decisión aparte (slice chico: +1 columna + 1 campo en el form).
- **Rate-limit del registro público** — deuda separada ya flageada.
- **CNE automático/bloqueante en el registro** — esto es revisión manual del asesor, no gate.

---

## 9. Estado de implementación

**Slice A (foundation) implementado** vía harness `/feature` (2026-06-03). Construido:
- `supabase/migrations/0092_identity_verification.sql` — 7 columnas + backfill, aditiva/nullable,
  sin tocar RLS. **NO aplicada a prod** (la aplica el founder).
- `lib/studio/identity/document.ts` (`classifyDocument` + `parseCedula`) +
  `lib/studio/identity/name-match.ts` (`normalizeName` + `compareNames` + `NAME_MATCH_THRESHOLD`) +
  `__tests__/` (34 tests).
- Wire en `app/portal/(auth)/registro/actions.ts` (insert setea `registration_channel` + `doc_kind`).

**Slice B (cédula/CNE) y Slice C (RIF/SENIAT)** quedan pendientes (ver §3 / §6). → Pasa a `done`
cuando B (y, si el spike lo habilita, C) estén shipped.

---
sdd: "0038"
title: "i18n CN · región como fuente de verdad + chrome bilingüe es-VE/zh-CN del Studio"
status: done
author: "founder"
created: 2026-05-28
updated: 2026-05-28
supersedes: null
superseded_by: null
related: ["0016", "0023", "0024", "0036"]
confidencialidad: interno
implementation_commits:
  - "5a99333 feat(studio): i18n CN/VE Fase 1 + Marketing Noticias Web (gated)"
migrations:
  - "0052_user_region — enum user_region + user_tenants.region + user_profiles.locale nullable + bug_reports.reporter_locale"
  - "0057_user_profiles_locale_nullable — captura retroactiva (registrada en DB como user_profiles_locale_nullable)"
  - "0058_user_invitations_region — captura retroactiva + RPCs studio_invite_user/accept con p_region"
deferred:
  - "Revisión nativa de las ~300 keys zh-CN antes de prod (~2h freelancer Yiwu)"
  - "Migrar wizard PWA NuevaRecepcionClient.tsx al dict unificado (hoy usa helper inline t(lang,es,cn), ya funciona)"
  - "Componentes UI shared opt-in i18n (DrawerShell/ActionButton/EmptyState/ToastProvider defaults ES)"
  - "Telemetría locale_used por sesión"
---

# DTD-0038 — i18n CN · región como fuente de verdad

> **El equipo de la oficina China (operarios, logística, contadora) opera el
> Studio en chino mandarín simplificado sin tocar ningún toggle.** El admin
> elige "Oficina: China" al invitar y de ahí se derivan idioma, formato de
> fecha y moneda. Cubre el chrome global + Almacén CN + Bug Reporter + el
> bridge a la PWA del operario.

## Contexto

La oficina CN (Yiwu / Guangzhou / Shenzhen / Shanghai) trabajaba sobre una UI
100% en español. El operador traducía mentalmente labels operativos
(`Pendiente consolidar`, `Pagado`, `Consolidar`) cada vez, con fricción y
riesgo de error. Existía un toggle parcial `?lang=cn` que sólo traducía
nombres bilingües de productos/proveedores (`pickBilingual`), no el chrome.

## Decisión arquitectónica · región es la única decisión

El admin **no piensa en "locale BCP-47"**. Piensa en "este user trabaja en la
oficina de China" o "de Venezuela". Esa única decisión (`user_tenants.region`,
enum `ve|cn`) deriva todo lo demás vía `lib/i18n/region.ts` → `REGION_DEFAULTS`:

| region | locale | timezone | moneda default |
|---|---|---|---|
| `ve` (default) | `es-VE` | America/Caracas | USD |
| `cn` | `zh-CN` | Asia/Shanghai | CNY |

`user_profiles.locale` queda como **override avanzado** (NULL en el flow
normal). Se separó intencionalmente de `LangDisplay` (`original|cn|es`), que
sigue controlando sólo el texto **de datos** bilingües, no el chrome.

## Alcance (qué quedó localizado E2E es-VE ↔ zh-CN)

- **Chrome global**: `StudioSidebar` (31 ítems + 5 grupos + collapse),
  `StudioTopbar` (search, theme, user menu, módulo activo, search modal).
- **Almacén CN** (`app/studio/(app)/cn/`) — 100%: page header, `WarehouseKpis`,
  `HeaderActions`, filtros, tabla, `ReceiptStatusBadge`, `NewReceiptDrawer`
  (5 secciones + orphan + items), `SupplierBilingualInput`, `ItemEditor`,
  `ReceiptRowActions` (cambiar estado/pago/consolidar destino), `BulkBar`,
  `LangToggle`.
- **UI Invitación** (`usuarios/_components/InviteUserDrawer.tsx`): dropdown
  "Oficina" 🇻🇪/🇨🇳 con cards. (Subcomponentes Team/Permission/Scope/Summary/
  Success localizados en cierre de Parte A.)
- **Bug Reporter** (`_components/bug-reporter/`): FAB + Modal + campo opcional
  "Traducción al español" visible sólo si reporter está en zh-CN + columna
  `bug_reports.reporter_locale`.
- **PWA `/m/cn`**: bridge cookie `dtd_op_lang` ↔ Locale. Al login se
  auto-setea según `operario_pins.region`. El wizard sigue con helper inline
  (deferred).

## Diseño

### `lib/i18n/` (infra autónoma, raíz de lib/)

NO importa nada de `lib/studio` ni `lib/db` → es transversal. Hoy sólo lo
consume `app/studio/`, pero está ubicado para servir a más superficies.

- `locales.ts` — `Locale = "es-VE" | "zh-CN"`, `parseAcceptLanguage()`.
- `region.ts` — `UserRegion`, `REGION_DEFAULTS`, `localeForRegion()`,
  `currencyDefaultForRegion()`, `visibleCurrenciesFor()`.
- `format.ts` — `formatDate/formatNumber/formatCurrency/toUsd` con `Intl.*`
  nativo (cero deps).
- `resolve-server.ts` — `resolveLocale()` server-only. Prioridad:
  `?lang=` URL > `user_profiles.locale` > `user_tenants.region` >
  `Accept-Language` header > `es-VE` default.
- `dict.ts` — combina dicts por dominio → `t(locale, key, params?)` + `I18nKey`.
- `LocaleProvider.tsx` — context client + `useT()`/`useLocale()`/`useRegion()`.
  Aplica override `?lang=cn` client-side.
- `error-codes.ts` + `error-message.ts` — contrato errorCode (ver abajo).
- Dicts por dominio en `es-VE/` y `zh-CN/`: `chrome`, `warehouse`,
  `bug-reporter`, `pwa-operario`, `errors` (~300 keys). El tipo
  `<Dict> = Record<keyof typeof esVE.x, string>` fuerza coverage del CN.

### Resolución en el layout

`app/studio/(app)/layout.tsx` resuelve locale+region UNA vez por request y
los propaga vía `<LocaleProvider>`.

### Contrato errorCode (server → client)

Server actions devuelven `errorCode: ErrorCode` (+ `errorParams?`) en vez de
strings ES. El client llama `resolveErrorMessage(t, state)` que prioriza
errorCode traducido sobre el `error: string` legacy. Backward-compat total:
módulos no migrados siguen con `error: string` y funcionan. Migrados: actions
de CN, Usuarios y Bug Reporter.

## Migraciones · nota de versionado (ISO §7.5)

Las 3 migraciones se aplicaron originalmente por MCP (registradas en la DB por
nombre limpio: `user_region`, `user_profiles_locale_nullable`,
`user_invitations_region`). La reorg ISO las materializó a archivos físicos.

⚠️ **Colisión de número en disco** (cosmética, NO rompe): hay dos `0057_*`
(`seo_drafts_brief_fields` + `user_profiles_locale_nullable`) y dos `0058_*`
(`platform_admins` + `user_invitations_region`). El orden lexicográfico del
nombre completo desambigua y las dependencias están en migraciones anteriores.

🚫 **No renombrar** esos archivos: están registrados en la DB con ese nombre
exacto; renombrarlos haría que el CLI los trate como nuevos → re-aplicación →
drift peor. Quedan como están. Documentado también en
`supabase/migrations/` (si se agrega README de numeración).

## Reglas de proyecto

- **"chino" = mandarín simplificado (`zh-CN`, 简体字)** siempre. NO cantonés,
  NO tradicional. Las oficinas son China continental.
- **Moneda china = `CNY`** (renminbi / RMB / 人民币, símbolo ¥). En
  transcripción speech-to-text "remedy/remmeby" = renminbi = CNY.

## Frontera ISO (público ↔ ERP)

`lib/i18n` NO viola la frontera: lo importa sólo `app/studio/` (verificado, 16
archivos), nunca el sitio público. El ESLint rule (`eslint.config.mjs`) que
bloquea imports del público hacia `@/lib/studio`/`@/lib/db`/`@supabase/*` no
aplica a i18n porque es infra autónoma transversal.

## Cierre de Parte A (hecho 2026-05-28)

- ✅ Subcomponentes del `InviteUserDrawer` (Office/Team/Permission/Scope/
  Summary/Success) localizados · dict `lib/i18n/*/users.ts` (61 keys).
- ✅ Status enums centralizados en `warehouse-cn-types.ts`:
  `PAYMENT_STATUS_LABEL_KEYS` + `RECEIPT_STATUS_LABEL_KEYS` + helpers
  `paymentStatusLabel(s, locale)` / `receiptStatusLabel(s, locale)`
  (reusables por módulo Gastos de Parte B).
- ✅ `<ErrorAlert>` reusable en `app/studio/_components/ui/ErrorAlert.tsx`
  (reemplazó el patrón `resolveErrorMessage` duplicado 4×).
- ✅ Componentes UI shared opt-in i18n: `DrawerShell`/`DrawerFooter`
  (cancelLabel/closeLabel/pendingLabel), `ActionButton` (loadingLabel
  fallback), `ToastProvider` (aria-labels). Backward-compat total.
- ✅ `moduleLabelFromSlug(slug, locale?)` locale-aware · reusa keys del
  sidebar. `BugReportModal` lo pasa con locale.

### Gaps remanentes (no bloqueantes)

- **Módulo Bug Tracker admin** (`/studio/bugs/*` + `mis-bugs/BugCard`):
  los listados/kanban/cards siguen en es-VE. Decisión: el triage es rol
  admin que opera en VE; localizarlos requiere migrar también
  `BUG_*_LABELS` (estados/categorías/severidades) — es un módulo aparte
  fuera del scope CN de Parte A. El helper `moduleLabelFromSlug` ya es
  locale-aware para cuando se haga.
- ✅ **Wizard PWA** `NuevaRecepcionClient.tsx` migrado al dict unificado
  (56 keys `pwa.receipt.*`, traducciones CN preservadas del código).
- **Revisión nativa zh-CN antes de prod** · auto-revisión de calidad
  hecha (consistencia + terminología logística); validación final con
  nativo humano sigue recomendada antes de prod (~1-2h).

## Relación con trabajo futuro

Este spec cubre **Parte A** (i18n) del plan original. Parte B (módulo Gastos
CN + alerta consolidado→equipo CN + fx CNY/USD + privacidad nombres cliente) y
Parte C (BL + documentos del contenedor) son features separadas que llevarán
sus propios SDD cuando se implementen.

## Adjuntos

Plan de diseño original (pre-reorg, no congelado):
`~/.claude/plans/estamos-en-modo-planning-glowing-marshmallow.md`.

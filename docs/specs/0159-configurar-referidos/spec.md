---
sdd: "0159"
title: "Configurar referidos — montos del programa editables desde el ERP"
status: done
author: "Sam (founder) + agente adquisición"
created: 2026-07-17
updated: 2026-08-02
supersedes: null
superseded_by: null
related: ["0051", "0137", "0085"]
confidencialidad: interno
---

# DTD-0159 — Configurar referidos (montos editables desde administración)

> **Número:** máx en `docs/specs` = 0158 → **0159 libre** (2026-07-17).

## Contexto

El programa de referidos (SDD-0051) paga dos montos: **crédito al referidor** (hoy $80) y
**descuento al referido** en su primer embarque (hoy $60). Esos dos números estaban
**hardcodeados en tres lugares**, imposibles de cambiar sin tocar código:

| Consumidor | Dónde | Qué usa |
|---|---|---|
| Front del cliente (`/portal/referidos`) | `getMyReferralProgram` | `REFERRAL_RULES.referrerReward/referredReward` |
| Correo de invitación | `buildInviteEmail` | `REFERRAL_RULES.referredReward` |
| **Acreditación automática (trigger SQL)** | `accredit_referral_on_first_invoice` (migr 0197) | `reward_usd = 80` **fijo** |

El trigger es el crítico: estampa `referrals.reward_usd` cuando el referido emite su primera
factura, y de ahí sale el **asiento contable** del crédito (SDD-0137).

**Decisión del founder (2026-07-17):** los montos se editan desde el ERP (Fidelización ›
"Configurar referidos") y bajan solos a los tres consumidores.

## Decisión

Tabla **singleton por tenant** `referral_settings` (mismo patrón que `calculator_settings`,
SDD-0103) con dos montos. El admin la edita en el módulo Fidelización; los tres consumidores
la leen con **fallback a $80/$60** (cero regresión si no hay fila).

- **Congelado por fila:** cambiar la config afecta **solo referidos nuevos**. Los que ya
  acreditaron conservan su `reward_usd` (la columna sigue guardando el monto vigente al
  momento de acreditar). El asiento contable usa ese `reward_usd`, no la config viva.
- **Trigger lee la config:** `accredit_referral_on_first_invoice` pasa a
  `reward_usd = coalesce((select referrer_reward_usd from referral_settings where tenant_id = new.tenant_id), 80)`.
  Se reescribe con `create or replace` en una migración nueva (append-only; 0197 no se edita).
- **RBAC:** editar la config = mismos roles que el módulo Fidelización (admin siempre). Sin
  módulo nuevo — es una acción dentro de `fidelizacion`.
- **`REFERRAL_RULES`** queda como los **defaults/fallback** (documentado), no como la fuente
  de verdad viva.

## Archivos

- `supabase/migrations/0250_referral_settings.sql` — tabla singleton + RLS por tenant + CHECK
  ≥0 + seed `dtd` + `create or replace` del trigger de acreditación. **Archivo en rama; NO se
  aplica a prod sin OK del founder** (runbook `aplicar-migraciones-prod.md`).
- `lib/studio/fidelizacion/referral-settings-types.ts` — tipo + `validateReferralSettingsInput`.
- `lib/studio/fidelizacion/referral-settings-queries.ts` — `getReferralSettings` (fallback
  `REFERRAL_RULES`) + `updateReferralSettings`.
- `app/studio/(app)/fidelizacion/actions.ts` — `saveReferralSettingsAction`.
- `app/studio/(app)/fidelizacion/_components/ReferralSettingsDrawer.tsx` + botón en
  `FidelizacionClient.tsx`.
- Cableo de lecturas: `lib/portal/portal-referral-queries.ts` (`getMyReferralProgram` recibe
  settings) · `app/portal/(app)/referidos/page.tsx` · `lib/portal/referral-invite.ts` ·
  `lib/studio/fidelizacion/queries.ts` (`pendingCredits`).
- `lib/studio/fidelizacion/types.ts` — comentario en `REFERRAL_RULES` (= fallback).

## Verificación

- `pnpm typecheck` + ESLint de los archivos tocados.
- Tests: `referral-settings-types.test.ts` (validación) + `referral-settings-queries.test.ts`
  (fallback cuando no hay fila) + ajuste de los tests de portal/invite que fijaban $80/$60.
- `node scripts/verify.mjs`: el paso `migrations-applied` marcará **0250 pendiente** hasta que
  el founder la aplique a prod — es el comportamiento esperado del gate, no un fallo del código.

## Fuera de alcance (diferido)

- El **"$ por CBM" del nivel Referidor** del motor de Aliados (white-label) — es otro concepto,
  atado al módulo white-label sin construir (memoria `project_aliados_white_label_modulo`).
- Re-espec de SDD-0137 (modelo Delayed Credit QBO) — el asiento de crédito sigue como está.

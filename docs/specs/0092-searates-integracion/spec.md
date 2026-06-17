---
sdd: "0092"
title: "Integración SeaRates Logistics Explorer — fletes marítimos FCL/LCL (benchmark interno, Fase 1)"
status: in-progress
author: "Claude Code (ventana searates) + founder"
created: 2026-06-17
updated: 2026-06-17
supersedes: null
superseded_by: null
related: ["0053", "0050", "0061"]
confidencialidad: interno
---

# SDD-0092 — Integración SeaRates Logistics Explorer (Fase 1)

> Traer **tarifas reales de flete marítimo FCL/LCL China→Venezuela** al stack de DTD como
> **benchmark interno** para el costing — sin exponerlas al cliente público y sin quemar la cuota.

## Contexto

SeaRates entregó credenciales de su API (**Platform ID 46314** + API Key secreta, **cuota 100
llamadas/mes, vence 2026-07-17**). Decisiones del founder (2026-06-17):

- **Rol = benchmark interno.** El rate de SeaRates es REFERENCIA para el costing/pricing de DTD
  (SDD-0053), **no** el precio final al cliente (el cliente sigue viendo el modelo DDP puerta a
  puerta).
- **Arranque = validación interna primero.** Probar la API desde admin, confirmar credenciales +
  calidad de datos, **sin exponer al público** (para no quemar las 100 llamadas).

⇒ Esta Fase 1 **NO toca el sitio público** (`/calculadora`, `/estimacion`, `/cotizar`,
`components/EstimacionForm.tsx`, `lib/calculadora.ts`, `lib/public/**`, `app/api/public/**`). Sin
migración de DB.

### Hechos técnicos (confirmado vs no confirmado)

- **Auth (confirmado):** `GET https://www.searates.com/auth/platform-token?id=<PLATFORM_ID>&api_key=<API_KEY>`
  → devuelve un token → usar como header `Authorization: Bearer <token>`.
- **Rates (NO confirmado):** POST a `get-rates/fcl` y `get-rates/lcl` con el Bearer. La **base URL
  exacta** de los rate endpoints y el **shape de request/response** NO están confirmados (la doc es
  un SPA). Por eso: base URL configurable vía `SEARATES_API_BASE`; el cliente devuelve el **JSON
  crudo (`raw`)** para ajustar la normalización en la validación en vivo. Normalización de
  precio/tránsito/carrier = **best-effort** (`// TODO: ajustar mapeo con respuesta real`).

## Alcance (Fase 1)

1. **Cliente server-only** `lib/studio/searates/`:
   - `searates-api.ts` (`import "server-only"`): `getPlatformToken()` con caché módulo-level +
     expiración (no quema auth); `getOceanRate(input)` POST fcl/lcl con Bearer + timeout vía
     `AbortController`. **Nunca tira** (union ok/error con `raw`). Mock mode sin envs →
     `{ ok:false, error:'mock_no_key' }` SIN fetch.
   - `searates-types.ts`: `SeaRatesQuoteInput`, `SeaRatesRate` (union), `validateSeaRatesInput()`
     (validación manual, **sin Zod**).
2. **`.env.example`**: sección SeaRates server-only (sin `NEXT_PUBLIC_`): `SEARATES_API_BASE`
   (confirmar; auth en www.searates.com), `SEARATES_PLATFORM_ID=46314`, `SEARATES_API_KEY` (vacío,
   secreto → `.env.local` + Vercel, nunca commitear).
3. **Route handler** `app/api/studio/searates/probe/route.ts` (`POST`): admin-gated (sesión Studio +
   `user_tenants` role='admin'), llama `getOceanRate()`, errores via `apiError()` tag `"searates"`.
4. **Health + env status**: `checkSeaRates()` en `lib/studio/integration-health.ts` (pinga el auth,
   reporta active|mock|error) + `SEARATES_API_KEY` en `lib/studio/env-status.ts`.
5. **UI mínima**: pestaña **SeaRates** en `/studio/debug` (Torre de control, SDD-0050) con inputs
   origen/destino/modo/contenedor + botón que hace `fetch('/api/studio/searates/probe')` y muestra
   rate + tránsito + carrier + `raw`. El fetch va al endpoint admin, **nunca** a searates.com.

### Fuera de alcance (Fase 1)

- Cualquier cosa del sitio público (queda igual).
- Migración de DB / tabla `ocean_rates`.
- Cablear el benchmark al módulo costing (eso es Fase 2).

## Acceptance

Verificable con `node scripts/verify.mjs` (lint + typecheck + test) — los tests corren en **mock
mode** (sin key real, `global.fetch` stubeado, **cero llamadas reales**):

1. `validateSeaRatesInput`: FCL exige contenedor; LCL no; LOCODE de 5 chars; normaliza a
   mayúsculas; modo solo FCL|LCL; cbm/peso positivos. → `__tests__/searates-api.test.ts`
2. `getPlatformToken`: sin envs → `null` SIN fetch; con envs → arma el auth GET a
   `www.searates.com` y devuelve el token; **cachea** (2 llamadas → 1 sola request de auth); HTTP
   error → `null`; body sin token → `null`.
3. `getOceanRate`: sin envs → `{ok:false, error:'mock_no_key'}` SIN fetch; input inválido →
   `{ok:false, error:'invalid_input'}` SIN fetch; token ok + rates 2xx → `{ok:true, rateUsd,
   transitDays, carrier, raw}`; FCL→`/get-rates/fcl`, LCL→`/get-rates/lcl`; rates HTTP error →
   `{ok:false, error:'http_<status>'}`; auth falla → `{ok:false, error:'auth_failed'}` sin pegar a
   rates; red caída → `{ok:false, error:'network: …'}`.
4. El secreto **solo** se lee de `process.env.SEARATES_API_KEY` server-side (`import "server-only"`
   en `searates-api.ts`); el panel del front pega a `/api/studio/searates/probe`, nunca a
   searates.com.
5. La frontera público↔ERP sigue intacta (ESLint `no-restricted-imports` no falla; nada del público
   importa el cliente SeaRates).

## Validación en vivo (post-merge · gasta 1–2 de las 100 llamadas) — pendiente founder

1. `SEARATES_API_KEY` + `SEARATES_PLATFORM_ID=46314` (+ `SEARATES_API_BASE` confirmado) en
   `.env.local`.
2. `/studio/debug` → pestaña Estado → SeaRates en **active** (auth OK).
3. Pestaña SeaRates → consultar **Nansha (CNNSA) → La Guaira (VELAG), FCL 40'HQ** → tarifa coherente
   (~USD 5.600–12.500, lo visto manual). Inspeccionar el **raw** y ajustar el mapeo
   (`rateUsd`/`transitDays`/`carrier` + path/body del request) donde dice
   `// TODO: ajustar mapeo con respuesta real`.
4. Network tab: el front llama `/api/studio/searates/probe`, nunca a searates.com.

## TODOs abiertos para la validación en vivo

- **Base URL de rates** (`SEARATES_API_BASE`): confirmar en docs.searates.com (los agentes
  adivinaron `api.searates.com` — verificar; el auth sí es `www.searates.com`).
- **Shape request/response**: `normalizeRate()` y el `requestBody` en `searates-api.ts` son
  best-effort. Ajustar contra la respuesta real (`raw` queda expuesto en el panel para eso).
- **Caché del token**: hoy TTL por defecto 50 min si el proveedor no informa `expires_in`. Si el
  auth devuelve expiración real, ya se respeta.

## Fase 2 (diferida)

- Cablear el benchmark al **módulo costing** (SDD-0053) como referencia al fijar costos/márgenes.
- Si se quiere público white-label: **refresco programado** (cron llena `ocean_rates`; el público
  lee de ahí, 0 llamadas/visita) — pedir a SeaRates tope > 100/mes antes.

## Adjuntos

Plan aprobado (origen de esta spec): conversación founder 2026-06-17 (no versionado en git).

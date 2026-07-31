---
sdd: "0205"
title: "Cliente web — entorno del navegador como fuente de verdad"
status: done
author: "Sam (founder) + Codex"
created: 2026-07-31
updated: 2026-07-31
supersedes: null
superseded_by: null
related: ["0030", "0146", "0196", "0204"]
confidencialidad: interno
---

# SDD-0205 — Cliente web · entorno del navegador como fuente de verdad

## 1. Propósito

Eliminar nueve sincronizaciones de montaje o ruta en ocho componentes, usando
stores externos para preferencias/capacidades y estados asociados a su origen.

## 2. Riesgo y políticas

Riesgo **R2**. SGE-00.01/.05/.07 exige que idioma, tema, plataforma, permisos y
menús representen el entorno real sin un render intermedio falso.

## 3. Contrato resultante

- idioma CN, tema Studio y plataforma se leen con snapshot SSR seguro;
- consentimiento y soporte de video se derivan del entorno sin efecto de copia;
- push separa capacidad síncrona de consulta asíncrona de suscripción;
- menús se cierran al cambiar la ruta que los abrió;
- cada error de PIN dispara una sola sacudida y limpia al finalizar;
- listeners y acciones existentes mantienen cleanup y comportamiento.

## 4. Allowlist exacta

1. `app/m/cn/login/page.tsx`
2. `app/m/ve/login/page.tsx`
3. `app/m/erp/bitacora/_components/PushOptInBanner.tsx`
4. `app/portal/_components/PortalAccountMenu.tsx`
5. `app/studio/(app)/_components/StudioTopbar.tsx`
6. `app/studio/_components/ui/usePlatformMod.ts`
7. `components/CookieConsentBanner.tsx`
8. `components/LazyVideo.tsx`
9. `app/studio/_components/__tests__/browser-state-contract.test.ts`
10. `docs/specs/0205-browser-environment-state/spec.md`
11. `docs/architecture/module-sdd-map.md`
12. `docs/specs/README.md` — generado

## 5. Fuera de alcance

- auth server-side, permisos push, endpoints, cookies de sesión y datos;
- rediseño, copy, service worker y reglas ESLint globales;
- otros estados React del inventario.

## 6. Verificación

- ESLint focalizado: **0 errores · 0 advertencias**;
- Vitest: **10/10** pruebas de stores, plataforma, ruta y confirmación PIN;
- `pnpm typecheck`: verde;
- lint completo: **90 → 81 advertencias**, 0 errores;
- docs, gobernanza, componentes, plugin y `diff --check`: verdes.

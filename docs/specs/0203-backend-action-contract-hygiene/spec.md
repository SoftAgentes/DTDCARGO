---
sdd: "0203"
title: "Backend — firmas explícitas y consultas mínimas"
status: done
author: "Sam (founder) + Codex"
created: 2026-07-31
updated: 2026-07-31
supersedes: null
superseded_by: null
related: ["0016", "0174", "0196", "0202"]
confidencialidad: interno
---

# SDD-0203 — Backend · firmas explícitas y consultas mínimas

## 1. Propósito

Resolver diecinueve bindings backend sin consumidor, haciendo explícitas las
firmas impuestas por React y retirando trabajo de base de datos innecesario.

## 2. Riesgo y políticas

Riesgo **R3** por incluir Server Actions y privacidad móvil. SGE-00.02/.05/.06
exige operaciones verificables, payload mínimo y ausencia de PII innecesaria.

## 3. Contrato resultante

- las firmas de `useActionState` se conservan y documentan con consumo explícito;
- GET shipments sigue derivando tenant del JWT y no acepta tenant del request;
- móvil CN no consulta nombres reales que luego redacta como `null`;
- proveedor, Shipping Mark, conteos y respuestas permanecen iguales;
- helpers e imports muertos se retiran sin cambiar sus consumidores;
- el mapping de calculadora queda exhaustivo por `EstimadoCalcKind`.

## 4. Allowlist exacta

1. `app/api/studio/shipments/route.ts`
2. `app/m/cn/estibar/actions.ts`
3. `app/m/cn/recibir/actions.ts`
4. `app/portal/(app)/perfil/actions.ts`
5. `app/studio/(app)/admin/notificaciones/actions.ts`
6. `app/studio/(app)/admin/rutas/actions.ts`
7. `app/studio/(app)/cotizador/actions.ts`
8. `app/studio/(app)/dashboard/actions.ts`
9. `app/studio/(app)/tarifas/actions.ts`
10. `lib/public/estimado-web.ts`
11. `lib/studio/bug-email-notify.ts`
12. `lib/studio/bug-tech-capture.ts`
13. `lib/studio/fiscal/types.ts`
14. `lib/studio/prealertas/packlist-form.ts`
15. `lib/studio/user-queries.ts`
16. `docs/specs/0203-backend-action-contract-hygiene/spec.md`
17. `docs/architecture/module-sdd-map.md`
18. `docs/specs/README.md` — generado

## 5. Fuera de alcance

- schemas, migraciones, Cloud, ACL, payloads y reglas de negocio;
- UI, copy, componentes y reglas ESLint globales;
- bindings de frontend aún pendientes.

## 6. Verificación

- ESLint focalizado: **0 errores · 0 advertencias**;
- Vitest: **3 suites · 45/45 pruebas**;
- privacidad móvil: sin consultas a `clients` en recibir/estibar;
- `pnpm typecheck`: verde;
- lint completo: **133 → 114 advertencias**, 0 errores;
- docs, gobernanza, componentes, plugin y `diff --check`: verdes.

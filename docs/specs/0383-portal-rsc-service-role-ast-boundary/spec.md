---
sdd: "0383"
title: Frontera AST de service_role en componentes Portal
status: in-progress
author: Codex
created: 2026-09-03
updated: 2026-09-03
supersedes: null
superseded_by: null
related: ["0335", "0348", "0382"]
confidencialidad: interno
---

# SDD0383 · frontera AST de service_role en componentes Portal

## Evidencia y autoridad

La numeración 0383 se confirmó contra 15 refs tras `git fetch origin` y
e7489096. El guard vigente informa 0/0, pero sólo recorre archivos `page.tsx`:
ignora el layout autenticado, que importa `@/lib/db/admin` y construye dos
clientes elevados. Su segunda prueba recorre un baseline vacío y ejecuta cero
aserciones. Una reproducción independiente midió 111 componentes TSX Portal:
30 páginas, 2 layouts, 33 componentes servidor y 46 cliente; 81 quedaban fuera.

Esto demuestra un falso verde del guard, no una fuga de datos. Los usos del
layout parten de un `client.id` autenticado y requieren revisión funcional
separada. No hay autorización para push, `main`, deploy, Cloud, datos reales o
limpieza.

## Fuentes técnicas

- TypeScript instalado: 5.9.3 (`node -p require('typescript/package.json').version`).
- API oficial del compilador para parsear AST y resolver módulos:
  https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API
- Referencia oficial de resolución y `moduleResolution: bundler`:
  https://www.typescriptlang.org/docs/handbook/modules/reference
- Consultadas el 2026-09-03. La configuración real proviene de `tsconfig.json`.

## Contrato acotado

- Recorrer todos los `.tsx/.jsx` de producción bajo `app/portal`, incluidos
  páginas, layouts y componentes; excluir tests y `__tests__`.
- Parsear con la API AST de TypeScript y resolver imports contra el tsconfig
  real. Detectar alias, relativos, namespace, reexports, `require()` e
  `import()` literales que resuelvan a `lib/db/admin`.
- Ignorar comentarios, strings e imports exclusivamente de tipo. Rechazar
  imports/requires dinámicos no literales por ser imposibles de inventariar.
- Fallar si el barrido queda vacío y cubrir explícitamente componentes cliente.
- Mover los dos usos del layout a una fachada `server-only` que primero resuelva
  el cliente con la sesión, cree un solo admin y devuelva sólo timestamp y
  próximo zarpe. Conservar UI, fallback y cálculos.
- No modificar Server Actions, route handlers, DB, RLS, variables o permisos.

## Allowlist exacta

- `scripts/__tests__/portal-service-role-boundary.test.mjs`.
- `app/portal/(app)/layout.tsx`.
- `lib/portal/portal-shell-private-context.ts`.
- `lib/portal/__tests__/portal-shell-private-context.test.ts`.
- Esta spec, `docs/specs/README.md` generado y auditoría local del slice.
- Checklist de arranque y handoff del saneamiento.

## Aceptación

- [x] RED persistente detecta el layout omitido por el guard anterior.
- [x] AST cubre importaciones reales, tipos, comentarios y dinámicos.
- [x] Cero imports directos de admin en componentes Portal de producción.
- [x] Fachada corta antes de elevar sin principal y conserva fallbacks.
- [x] Datos derivados usan el cliente/tenant exactos y no devuelven tenant.
- [x] Suite y gates proporcionales quedan aprobados.
- [x] Checklist histórico queda veraz sin inflar 56/106.

Gobernanza: no conformidad del gate confirmada; la corrección sólo será
cumplimiento tras GREEN. No hay cambio visual ni de comportamiento esperado.

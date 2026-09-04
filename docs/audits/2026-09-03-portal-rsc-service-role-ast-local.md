---
title: Frontera AST de service_role en componentes Portal
tipo: auditoria-tecnica
autor: Codex
created: 2026-09-03
updated: 2026-09-03
review-by: 2026-09-10
confidencialidad: interno
---

# SDD0383 · frontera AST de service_role en componentes Portal

## Estado

Correctivo local verificado. No publicado. No
hay migración en este slice y no se tocó Cloud, datos reales, `main`, despliegue
o limpieza. La numeración 0383 se confirmó contra 15 refs actualizadas.

## Reproducción causal

El guard anterior aprobaba 2/2, pero sólo abría 30 archivos `page.tsx`. Dejaba
fuera 2 layouts, 33 componentes servidor y 46 cliente. Su baseline era `{}` y
la segunda prueba recorría cero entradas. El layout autenticado importaba
`createAdminClient` y lo construía dos veces.

La reproducción aislada también demostró que el regex no resolvía imports
relativos, namespace ni dinámicos calculados, y podía confundir comentarios.
El nuevo test AST produjo RED con un único hallazgo real:
`app/portal/(app)/layout.tsx:5`, import `@/lib/db/admin`. Sus tres controles de
parser pasaron en ese mismo RED.

Esto prueba un falso verde del inventario, no una fuga de datos. Las lecturas
del layout ya partían de `client.id`; se conservaron detrás de una frontera
servidor explícita y con regresión propia.

## Delta

- El guard usa TypeScript 5.9.3, el `tsconfig.json` real,
  `createSourceFile` y `resolveModuleName`. Recorre todos los `.tsx/.jsx` de
  producción bajo Portal: 105 archivos, incluidas 30 páginas, 2 layouts,
  46 componentes cliente y 27 componentes servidor adicionales.
- Detecta imports/reexports por alias o relativos, namespace, `require()` e
  `import()` literales. Ignora tipos, comentarios y strings. Un dinámico no
  literal falla cerrado porque no puede inventariarse.
- `portal-shell-private-context.ts` está marcado `server-only`. Resuelve al
  cliente con la sesión antes de crear un único admin, deriva el tenant desde
  ese cliente y devuelve sólo timestamp de soporte, zarpe y días al corte.
- El layout conserva redirección, tema, navegación, perfil, Club y propiedades
  del shell; ya no importa ni construye `service_role` directamente.

## Verificación local

- RED AST: 1 fallo esperado en el layout; 3 controles del parser aprobados.
- GREEN: guard y fachada 8/8; junto con `PortalShell`, 10/10.
- Sin principal: cero construcciones admin. Constructor/consultas fallidas:
  fallback vacío sin tumbar el shell. Scopes exactos por client y tenant.
- TypeScript y ESLint focal: aprobados.
- Suite unitaria completa: 7.187/7.187 en 557 archivos, 428,07 s, aprobada.
- Docs, numeración, componentes, gobernanza y diff: aprobados al cierre.

## Límites

- El guard cubre componentes `.tsx/.jsx`; Server Actions y route handlers
  quedan fuera deliberadamente porque tienen contratos de escritura distintos.
- Cero imports directos no demuestra ausencia de dependencias transitivas. La
  fachada `server-only` se valida funcionalmente y es la frontera explícita.
- Continúan 30 migraciones preparadas 0401–0430 según el último ledger 0400.
  No se hizo una consulta Cloud nueva. Checklist original 56/106, sin sumar
  este correctivo como una tarea original adicional.

Fuentes: API oficial del compilador TypeScript y referencia oficial de módulos,
ambas enlazadas en SDD-0383 y consultadas el 2026-09-03.

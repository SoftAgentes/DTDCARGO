---
sdd: "0380"
title: Lectura de cotizaciones Portal ligada al principal y tenant
status: in-progress
author: Codex
created: 2026-09-03
updated: 2026-09-03
supersedes: null
superseded_by: null
related: ["0061", "0075", "0359", "0377"]
confidencialidad: interno
---

# SDD0380 · cotizaciones propias del Portal

## Fuente y permisos

Cola local de saneamiento, siguiente slice de permisos Portal. Numeración
consultada en 15 refs después de conservar SDD0379: spec 0380 y migración
0428 disponibles. Sin push, main, Cloud, datos reales ni limpieza final.

Sonda local con 0006/0007/0080/0113/0117/0230 reales: un principal Portal A
lee una cotización del tenant B que comparte su Shipping Mark. Tras retirar
su cliente conserva dos filas visibles. Entorno Postgres desechable,
fixtures sintéticos, rollback y retirada únicamente del contenedor propio.
No es una consulta ni prueba de explotación en producción.

## Contrato

- Reemplazar sólo la lectura Portal de quotes: vínculo activo de auth.uid(),
  cliente vivo, tenant coherente entre vínculo, cliente y cotización,
  Shipping Mark coincidente y cotización no borrada.
- Conservar lectura/escritura de equipo, helpers existentes, ACL, tablas,
  triggers, índices, históricos y filas. Sin nuevo SECURITY DEFINER.
- Preflight falla ante inventario inesperado de policies o RLS ausente.
  Reejecución idempotente; las derivas fallidas no dejan cambios parciales.
- La consulta de aplicación resuelve el vínculo de la sesión y el cliente
  vivo coherente antes de consultar quotes, sin service_role ni PII nueva.
  Filtra tenant + Shipping Mark explícitamente, incluso en sesión híbrida
  equipo/Portal de distintos tenants. Sin principal válido devuelve vacío.
- Los códigos de envíos vinculados usan ese mismo ámbito; un enlace incoherente
  no revela el código de un envío ajeno. Conservar split web/studio, orden,
  límites, mapeo y etiquetas. No rediseñar pantallas.
- No corregir en este slice RBAC del equipo, escrituras de cotización,
  correlativos ni los otros consumidores globales de portalMarkbox.

## Allowlist exacta

- supabase/migrations/0428_portal_quotes_principal_tenant.sql.
- supabase/tests/0428_portal_quotes_principal_tenant.test.sql.
- lib/portal/portal-queries.ts: sólo contexto y consultas de cotizaciones/envíos vinculados.
- lib/portal/__tests__/portal-quote-scope.test.ts.
- lib/portal/__tests__/estimates.test.ts: adaptar fixture de identidad, conservar casos.
- Esta spec y docs/specs/README.md generado.
- docs/audits/2026-09-03-portal-quotes-local.md.
- docs/audits/2026-09-02-codex-arranque-checklist.md.
- .agents/handoffs/2026-09-02-saneamiento-integral-close.md.

## Aceptación

- [x] RED SQL causal antes de aplicar la migración local.
- [x] Lectura propia válida; negar cruce, bajas, vínculo incoherente e inactivo.
- [x] Equipo y catálogo ajeno preservados; preflight y reejecución probados.
- [x] RED/GREEN de queries reales con transporte sintético, incluidos híbridos.
- [x] Contratos SQL, reconstrucción, suite y tipos proporcionales.
- [x] Evidencia y release separado, sin sumar subpasos al 56/106 original.

Gobernanza: no conformidad de aislamiento confirmada localmente; cumplimiento
del nuevo contrato: 63 aserciones SQL,31 casos de aplicación y suite conjunta
7.149/7.149; 170 contratos SQL/rebuild425 correctos. Sigue in-progress por
release Cloud/publicación externos. UI/confirmaciones/auditoría de escritura:
no aplica, lectura sin cambio visual ni mutación de negocio.

---
sdd: "0381"
title: Solicitudes de recepción Portal por principal y tenant
status: in-progress
author: Codex
created: 2026-09-03
updated: 2026-09-03
supersedes: null
superseded_by: null
related: ["0098", "0361", "0380"]
confidencialidad: interno
---

# SDD0381 · solicitudes de servicios de recepción

> **Nota de importación — 2026-09-11, actualizada tras la aplicación.** Esta spec entró a
> `main` desde la PR #21 con su contenido original, `status: in-progress` incluido. Su
> migración `0429_portal_service_requests_principal_tenant` **fue APLICADA a producción el
> 2026-09-11** con OK nominal de Sam (ledger
> `20260912000143 / 0429_portal_service_requests_principal_tenant`) y se verificó contra el
> objeto; el registro y la vuelta atrás están en
> `.agents/handoffs/lote-11-migraciones-aplicadas-20260911.md`. Se aplicó sola y **después** de
> `0417_portal_prealertas_tenant_boundary` (SDD-0361), porque su contrato la incluye. El cambio
> de `lib/studio/prealertas/queries.ts` se adoptó de forma focal sobre main (sólo contexto y
> consulta de solicitudes) y no usa objetos creados por 0417 ni 0429, así que no era
> migrate-first. Falta el smoke funcional de servicios de recepción del Portal.

## Evidencia y autoridad

Cola local acordada; numeración0381/0429 consultada en15refs tras d13f0968.
El catálogo reconstruido confirmó las policies antiguas de0150, sin un
correctivo posterior en prealerta_service_requests. Reproducción independiente
con22 controles en PostgreSQL desechable, usando0006/0080/0105/0118/0150/
0229/0230/0417 reales. Portal A lee solicitudes B con el mismo Shipping Mark.
Aunque0417 esconde el padre B, cambiar tenant_id y prealerta_id al destino
propio permite reasignarse una fila B: USING sólo mira markbox y WITH CHECK/
trigger validan NEW, no la propiedad de OLD. Cliente retirado y vínculo
incoherente también leen solicitudes sin poder ver sus padres.

No Cloud, push, main, despliegues, datos reales ni limpieza final.
No auditoría jurídica ni promesa de privacidad integral.

## Contrato acotado

- Cambiar sólo las tres policies Portal de solicitudes: SELECT, INSERT,
  UPDATE USING/WITH CHECK. Sesión auth.uid, vínculo activo, cliente vivo,
  tenant coherente de vínculo/cliente/fila y Shipping Mark coincidente.
- Conservar SELECT no borrado e INSERT con consentimiento obligatorio.
  No introducir un comando nuevo de borrado ni cambiar su semántica heredada.
- No modificar las tres policies de equipo/servicio, sus permisos ni la unión
  legítima de derechos de una sesión híbrida. Sin DML, ACL, índices ni triggers.
- Inventario de policies y RLS deben ser los esperados; deriva falla.
  Reejecución idempotente, fallos sin cambios parciales.
- listPrealertaServiceRequests con opts.markbox exige principal Portal vivo/
  coherente y coincidencia con ese filtro. Añade tenant explícito: la policy
  de equipo de una sesión híbrida no debe ensanchar el resultado del Portal.
  Ausencia/valor vacío de un markbox expresamente enviado falla cerrado.
- La llamada Studio sin esa propiedad mantiene su comportamiento y RLS.
  Conservar filtro por compra, límite500, orden, mapeo y fallback vacío.
- No cambiar getPortalClient, helpers globales, catálogo de add-ons,
  acciones, pantallas o reglas de campos operativos del asesor.
  Lo último exige su propio inventario/reproducción, no queda certificado.

## Allowlist exacta

- supabase/migrations/0429_portal_service_requests_principal_tenant.sql.
- supabase/tests/0429_portal_service_requests_principal_tenant.test.sql.
- lib/studio/prealertas/queries.ts: sólo contexto y consulta de solicitudes.
- lib/studio/prealertas/__tests__/service-request-scope.test.ts.
- Esta spec y docs/specs/README.md generado.
- docs/audits/2026-09-03-portal-service-requests-local.md.
- docs/audits/2026-09-02-codex-arranque-checklist.md.
- .agents/handoffs/2026-09-02-saneamiento-integral-close.md.

## Aceptación

- [x] RED persistente causal SQL y aplicación.
- [x] Denegación de lecturas/reasignaciones ajenas, bajas e incoherencia.
- [x] Operaciones propias, equipo/servicio, catálogo y filas preservados.
- [x] Derivas e idempotencia, contratos y reconstrucción aprobados.
- [x] Suite completa y gates estáticos proporcionales aprobados.
- [x] Evidencia y límites de release documentados, sin inflar 56/106.

Gobernanza: no conformidad de aislamiento confirmada; cumplimiento del
correctivo sólo tras GREEN. UI/confirmación/auditoría nueva: no aplica,
no se crea una acción ni se amplía escritura. SGE00.05/12: autoridad
demostrada en DB y gates externos conservados.

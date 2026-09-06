---
sdd: "0380"
title: Lectura de cotizaciones Portal ligada al principal y tenant
status: in-progress
author: Codex
created: 2026-09-03
updated: 2026-09-06
supersedes: null
superseded_by: null
related: ["0061", "0075", "0359", "0377"]
confidencialidad: interno
---

# SDD0380 · cotizaciones propias del Portal

> Registro histórico conservado del 2026-09-03. Su allowlist y resultados
> pertenecen a PR21. Para esta extracción rigen la sección final del2026-09-06
> y el handoff pr21-sdd0380-quotes-security; la aceptación general sigue pendiente.

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

## Extracción aislada de PR21 (2026-09-06)

La evidencia anterior describe el trabajo histórico del03 de septiembre, no
valida esta nueva rama por sí sola. Director asignó reutilizar0380/0428 sobre
base74bb52ab9677f96908cc032a15f2364ab9d94716. Fuente: delta
d876f0b59bae5bcac1cea4aaa2655608a753c3cb frente a su padre; contraste final
ea9952a47f4adf14c48c91e6d0147597beb94aa7. Se extraen únicamente
PortalQuoteScope, portalQuoteScope, listMyQuotes y attachShipmentCodes, sus tests,
policy0428 y documentos asignados. No se traslada el RPC de asesor ni resolver0382.

Validación propia, fixtures sintéticos:

- PASÓ controlRED SQL sin0428: rechaza aserción de aislamiento entre tenants con
  igual Shipping Mark (psql exit3). GREEN con0428:63 assertions, rollback final
  confirmado, exit0. PostgreSQL17 desechable networknone, montaje supabase en/sb.
  Primer intento GREEN con montaje/sql falló por referencia/sb del fixture; se
  corrigió el montaje y no se modificó ni debilitó la prueba.
- PASÓ controlRED aplicación sobre base:18 fallos y4 aprobados de22. GREEN
  extracción y dos casos adicionales:33/33 en portal-quote-scope y estimates.
  Incluye híbridos, tenants con igual marca, vínculo retirado/incoherente/ambiguo,
  envíos ajenos, separación web/studio y100 resultados más recientes del ámbito.
- PASÓ equivalencia por AST y texto completo:15 funciones ajenas byte-equivalentes
  a main74bb. Migración/testSQL extraídos idénticos entre fuente y final dePR21.
- Dependencias propias instaladas frozen-lockfile, sin copiar.env.
- Metadata autorizada list_migrations:409 entradas,0428 ausente. No se leyeron
  filas de negocio ni se aplicó SQL productivo. La ausencia en el ledger no prueba
  ausencia de ejecución manual sin registrar.

Logs locales:%TEMP%/sdd0380-sql-red.log,sdd0380-sql-green.log,
sdd0380-unit-red.log,sdd0380-unit-green.log. No se heredan checks remotos.
Verify/build masivo y E2E NO EJECUTADO por coordinación de recursos; aceptación
independiente y validación de combinación pendientes del Director. Estado SDD
in-progress. Sin push/PR remota/main/Cloud; release exige catálogo real coherente
y autorización nominal, nunca aplicar una migración solo para pasar un gate.

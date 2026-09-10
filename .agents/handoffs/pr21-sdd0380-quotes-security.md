# SDD0380 · Extracción de seguridad de cotizaciones Portal

- Task: pr21-sdd0380-quotes-security / 2026-09-06.
- Owner: 01a0734d-a379-78b0-a86a-ed90a9a2d6f9; claim adquirido.
- Worktree: C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/pr21-sdd0380-quotes-security-20260906.
- Rama: codex/pr21-sdd0380-quotes-security-20260906.
- Base: 74bb52ab9677f96908cc032a15f2364ab9d94716.
- Origen: delta d876f0b59bae5bcac1cea4aaa2655608a753c3cb; contraste final ea9952a47f4adf14c48c91e6d0147597beb94aa7.
- Estado: lista-para-revision; SDD in-progress hasta aceptación.

## OBJETIVO ORIGINAL

Extraer el contrato completo0380: principal Portal vivo/coherente, ámbito tenant+
Shipping Mark en cotizaciones y enlaces a envíos, policy0428. No importar resolver
global0382, asesor, perfil, cuotas ni prealertas.

## ALLOWLIST Y PERMISOS

- supabase/migrations/0428_portal_quotes_principal_tenant.sql
- supabase/tests/0428_portal_quotes_principal_tenant.test.sql
- lib/portal/portal-queries.ts (solo PortalQuoteScope, portalQuoteScope, listMyQuotes, attachShipmentCodes)
- lib/portal/__tests__/portal-quote-scope.test.ts
- lib/portal/__tests__/estimates.test.ts (fixtures)
- docs/specs/0380-portal-quotes-principal-tenant/spec.md
- docs/specs/README.md (generado)
- docs/audits/2026-09-03-portal-quotes-local.md
- .agents/handoffs/pr21-sdd0380-quotes-security.md

Instalación local sin.env, SQL sintético y unit focal, commits selectivos locales
autorizados. No push, PR remota, main, Cloud ni verify/build masivo hasta slot.
PR26 y PR33 se conservan intactos; corrección solicitada por auditor26 tiene prioridad.

## COMPLETADO

Lectura del informe independiente y delta fuente. Aislamiento y claim listos.
Metadata list_migrations productiva:409 entradas,0428 ausente; sin filas de negocio.
No se aplica ninguna migración. Ausencia del ledger no prueba ausencia de SQL manual.

## VALIDACIÓN

RED/GREEN SQL y aplicación PASÓ; ver evidencia detallada al final. No se hereda evidencia histórica.

## COMMITS

Base74bb52ab; el commit que contiene este handoff entrega la extracción selectiva.

## PR / BRANCH

Fuente PR21; rama nueva local sin publicación autorizada.

## PENDIENTES DE ESTA TAREA

Revisión independiente del SHA final y validación de combinación/gates generales
cuando Director asigne recursos. Publicación y release requieren autorización.

## FUERA DE ALCANCE DETECTADO

Resolver global0382, RPC asesor y consumidores elevados ajenos no se extraen.

## HANDOFF AL DIRECTOR

Escritura termina con el commit; liberar claim tras comprobar árbol limpio.
Director recibe SHA final para revisión independiente; conservar árbol sin publicar.

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

Comprobaciones de cierre de extracción: PASÓ ESLint en las3rutas TypeScript,
docs:check con índice regenerado, governance:check, components:check,
sdd:check y git diff --check. Numbering conserva las excepciones históricas
aplicadas ya declaradas por el repositorio; no se renumeró ninguna.
NO EJECUTADO: typecheck global, verify/build y E2E. La extracción no incorpora
rebuild/suite global históricos dePR21 como evidencia propia.

---
title: "Codex: cierre técnico de las exportaciones operativas SDD-0289"
tipo: auditoria-operativa
autor: Codex
estado: verificado-local-y-git
created: 2026-09-02
updated: 2026-09-02
review-by: 2026-09-09
confidencialidad: interno
---

# Exportaciones operativas · cierre con evidencia

Se reconcilia SDD-0289, antes `in-progress`, como `done` técnico. No se trata
de una feature nueva: `d838ea2a` ya está contenido en
`origin/main@2a2e81bf554dbe7bd4f05170847e8f02e988d320`, demostrado con
`git merge-base --is-ancestor` (salida 0).

## Contrato comprobado

| Requisito original | Evidencia actual |
|---|---|
| Tres puntos de entrada | ClientsClient y CobranzasClient se montan desde sus pages; Tracking incluye el enlace directamente. Los tres apuntan a `operativo/export` con el tipo correcto |
| No reutilizar listas truncadas de pantalla | Route usa queries dedicadas para clientes/embarques; Cobranzas usa la cola paginada real |
| No descargar filas a medias | Cada tipo entrega 2.501 filas únicas con tope sintético de 400; fallo tardío/tope de páginas devuelve JSON 500, sin `attachment` |
| Cobranzas completa | Se ejecuta `receivablesQueue` real, incluidas facturas, gestiones por lotes y derivación; también rechaza gestiones incompletas |
| Formato | BOM UTF-8 medido en bytes, CRLF, nombres con fecha, cabeceras y etiquetas; montos decimales separados, días nulos distintos de cero |
| Descarga completa sin filtro de vista | Parámetros extra de búsqueda/tab no reducen el conjunto; se conserva la decisión original de la spec |
| Acceso antes de datos | 401/403 de sesión se propagan; rol sin vista de cada módulo no consulta tablas; tipo desconocido devuelve 400 |
| Filas elegibles | Excluye clientes/embarques borrados y facturas anuladas o sin saldo |

El route, queries del export y paginador no difieren de main. El helper común
CSV sí incorpora SDD-0315 de esta rama (neutralización de fórmulas): no se
atribuye a la implementación histórica ni se revierte. Se verifica su contrato
junto con el resto. No se modifican botones, reglas de acceso o formatos.

## Alcance de la prueba

El archivo nuevo ejecuta el endpoint real en Node con Request/Response reales.
Deja reales las queries, paginadores, RBAC puro, builders y `apiError`. Sólo
reemplaza la resolución de sesión/acceso y el transporte de tablas. El fixture
aplica filtros, orden y rangos, pero **no es Postgres ni prueba RLS**.

`fetch` falla ante cualquier llamada y se comprueba que no se invoca. Los datos
son sintéticos y viven en memoria; no se genera un archivo con PII ni se usa una
sesión alojada. Esta prueba del código no acredita una configuración de Cloud,
una descarga de negocio ni el render de una página en navegador/Excel.

La [documentación oficial de range](https://supabase.com/docs/reference/javascript/using-modifiers-range)
confirma rangos inclusivos y dependientes del orden. No se cambian paquetes,
API, schema ni parámetros del proveedor. El changelog consultado no motivó una
actualización de dependencias en este lote.

## Verificación

- `pnpm exec vitest run app/api/studio/operativo/export/__tests__/route.test.ts lib/studio/export/__tests__/operativo-csv.test.ts lib/db/__tests__/paginate.test.ts`:
  **42/42 en tres archivos**, 19 regresiones nuevas.
- Contratos CSV/RBAC adicionales: **29/29 en tres archivos**, mediante
  `pnpm exec vitest run lib/studio/export/__tests__/csv-formula.test.ts lib/studio/export/__tests__/csv-implementation-contract.test.ts lib/studio/rbac-api-guard.test.ts`.
- Suite completa `pnpm test`: **530 archivos / 6.032 pruebas aprobadas**,
  sin omitidas, en 126,81 s.
- ESLint del archivo nuevo, `pnpm typecheck`, `docs:index`, `docs:check`,
  `sdd:check`, `governance:check`, `components:check` y `git diff --check`:
  aprobados. Índice: 353 specs / 414 migraciones; 28 políticas y cinco fuentes
  de componentes. No se renumeraron colisiones históricas aplicadas.
- CI de base `726d2f85`, run `33669760589`: **success**, todos los pasos,
  incluido build y árbol reproducible. Terminó el 2026-09-02 a las 19:05:39 UTC
  (14 min 22 s). Se esperó su final antes de publicar; no se canceló el run.
  El CI del nuevo commit sigue siendo una verificación independiente.
- No hay cambio runtime/SQL: no se repiten E2E, contratos SQL o rebuild por este
  lote. Sus baselines/omisiones permanecen en el handoff integral.

## Efecto sobre el backlog

353 specs: 263 `done`, 1 `superseded`, 74 `in-progress`, 8 `proposed`,
4 `approved`, 3 `draft`: **89 sin cierre documental**. La fecha/estado del
primer lote documental y del acta de acceso son snapshots históricos, no se
reescriben. 0299/0302 siguen abiertas por sus pruebas reales pendientes.

El objetivo integral, PR y 19 gates de aplicación alojada siguen abiertos.
Este cierre no habilita merge/deploy ni retirada del worktree activo.

## Allowlist exacta

- `app/api/studio/operativo/export/__tests__/route.test.ts`
- `docs/specs/0289-exportar-clientes-cobranzas-tracking/spec.md`
- `docs/specs/README.md` (regenerado)
- `docs/audits/2026-09-02-codex-cierre-exportaciones.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `.agents/handoffs/2026-09-02-cierre-exportaciones-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

Gobernanza: cumplimiento del corte por error/acceso en la prueba; no aplica
cambio de comportamiento, componente, visuales, política o tratamiento de PII.
No se abre una SDD duplicada para verificar la implementación existente.

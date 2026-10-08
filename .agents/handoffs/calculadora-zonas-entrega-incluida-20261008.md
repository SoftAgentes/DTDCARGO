# Worker — calculadora-zonas-entrega-incluida-20261008

Fecha: 2026-10-08. Owner: worker-0504-simplificacion-20261008. Sesión interna Worker asignada por Director para la misma SDD-0504; adopción explícita al retomar, sin trasladar trabajo.
Worktree: `C:/Users/AKX generator/.codex/worktrees/calculadora-zonas-entrega-incluida-20261008/DTDCARGO`.
Rama: `codex/calculadora-zonas-entrega-incluida-20261008`.
Base de integración: `c3d37a8eeb347e260a2d047ceb882795e06a408f`; reserva SDD en `eadef1130dd1b192f0d6829b3dac9f4515e4541d`.
HEAD limpio de entrada a esta continuación: `e12a486766619890873c256744fd60aa0298a5ff`.
SDD: `docs/specs/0504-zonas-entrega-incluida/spec.md`, done de implementación: criterios propios cumplidos, verify ejecutado/clasificado y falla TS inicial corregida con typecheck/build aprobados. CI del nuevo SHA, integración y release pendientes para Director, con autorización vigente de Sam. Git y PR #193 conservan el SHA final, sin autorreferencia de este documento.

## OBJETIVO ORIGINAL

Sam pidió administrar la inclusión de la entrega desde la configuración de la calculadora, conservar las demás ciudades y tarifas, y excluir Acarigua. Precisó expresamente: conservar UNA sola opción «Entrega incluida, sin costo adicional» en Editar ciudad y retirar el panel duplicado. La casilla original y updateCityAction ya existían; esta continuación los reutiliza y corrige la precedencia pública que ignoraba false persistido.

Publicación de la misma rama/PR autorizada por Sam. Sam también autorizó integración y producción; Director ejecuta y registra esas operaciones por separado. Worker no mergea ni despliega. No migraciones, escrituras productivas, PII ni secretos copiados.

### Contrato registrado antes de editar producto

Guard, raíz, rama y claim comprobados. Director serializa integración y no escribe estos archivos durante esta continuación. Allowlist exacta, registrada también en SDD antes de las ediciones:

- `docs/specs/0504-zonas-entrega-incluida/spec.md`
- `docs/specs/README.md` (sólo generador)
- `.agents/handoffs/calculadora-zonas-entrega-incluida-20261008.md`
- `app/studio/(app)/admin/_components/calculator/CalculatorSection.tsx`
- `app/studio/(app)/admin/_components/calculator/CiudadesPanel.tsx`
- `app/studio/(app)/admin/_components/calculator/CityDrawer.tsx`
- `app/studio/(app)/admin/_components/calculator/ZonasEntregaPanel.tsx` (retirar duplicado de esta tarea)
- `app/studio/(app)/admin/_components/calculator/__tests__/ZonasEntregaPanel.test.tsx` (retirar pruebas exclusivas del componente eliminado)
- `app/studio/(app)/admin/calculator-actions.ts` (recorrido update original; create/delete intactos)
- `app/studio/(app)/admin/__tests__/delivery-zone-action.test.ts`
- `app/studio/(app)/admin/_components/calculator/__tests__/CityDrawer.test.tsx`
- `lib/studio/rbac-actions-guard.test.ts` (inventario 427; scanner, excepciones, guards y deuda intactos)
- `lib/public/__tests__/combinar-destinos.test.ts` (sólo cobertura adicional necesaria)
- `app/tarifas/embed/page.tsx`
- `app/tarifas/embed/page.test.tsx`
- `lib/geo-zonas.ts` (sólo Acarigua y conteo actual)
- `app/importar-de-china/[ciudad]/page.tsx` (sólo FAQ de Acarigua visible/JSON-LD)
- `app/importar-de-china/[ciudad]/page.test.tsx`
- `docs/marketing/README.md` (entrada SDD-0504)
- `docs/marketing/seo.md` (nota fechada; historia preservada)
- `docs/marketing/calculadora-explicada.html` (lista/conteo actual)
- `docs/marketing/servicios-infografias/PROMPT-CLOUD-DESIGN.md` (lista/conteo actual)

Director aprobó cada ampliación antes de editar. El baseline público detectó que el embed no combinaba tarifas y derivaba al asesor; geo-zonas prometía entrega incluida en Acarigua y cuatro fuentes comerciales actuales mantenían ocho ciudades. Se alinean puntualmente con la exclusión ya autorizada. El FAQ genérico DDP/coordinación dentro de la cotización final se clasifica como ambigüedad, no prueba de una promesa de $0; Director aprobó precisar sólo Acarigua. No otros hallazgos absorbidos.

Se conservan SIN nuevas ediciones lib/public/rates-queries.ts, lib/data/destinos-nacionales.ts, lib/calculadora.ts, __tests__/calculadora.test.ts y la cobertura combinar-destinos previa. No cambios a fórmulas, selector/carrusel u otros módulos.

## COMPLETADO

- Retirados ZonasEntregaPanel y saveDeliveryZoneAction, sin consumidores huérfanos. Montaje de CalculatorSection e inventario RBAC restaurados al baseline; no scanner/guards/excepciones alterados.
- CityDrawer original muestra la etiqueta exacta elegida, descripción comercial y casilla nativa cargada desde city.casco. Envío explícito, pending, éxito después de guardar/refrescar, error seguro con foco y borrador conservado. Cancelar no muta.
- updateCityAction original conserva el CRUD de ciudad y exige admin activo; gate y tenant de la misma membresía, filtros id/tenant/deleted_at, respuesta de fila guardada y cero filas sin falso éxito. Revalida Administración, tarifas y embed. Create/delete y trigger de auditoría existentes intactos.
- combinarDestinos respeta true/false persistidos. Acarigua false y tarifa de respaldo 123,60 USD/m³ intacta; las otras siete inclusiones y las 178 ciudades se conservan. Fórmula subtotal → mínimo normal → batería → descuento intacta.
- El embed usa las mismas RPC públicas y combinarDestinos que la página principal. Sin nuevas fuentes/schema.
- Acarigua deja de prometer entrega incluida en geo-zonas, landing/FAQ/JSON-LD y listas comerciales actuales. Respuestas de las demás ciudades y layout intactos; historia de SEO del 1-ago preservada con nota que la sustituye.
- Preview http://127.0.0.1:4324 actualizada con CiudadesPanel/CityDrawer/DrawerShell reales, estilos y contextos canónicos, filas/acciones sintéticas. Revisión escritorio/móvil light/dark y error/cancelar/guardar PASÓ.

## VALIDACIÓN

| Comprobación de esta continuación | Estado y alcance |
|---|---|
| Slice final | PASÓ 573/573 en 8 archivos, un worker: acción original, UI real, RSC embed/landing, combinación/cálculo, tipos e inventario RBAC |
| Tipos | Primera corrida canónica FALLÓ TS2345 en tabla nueva del test de acción; se tipó explícitamente la tabla, sin cambiar casos/assertions. pnpm typecheck posterior PASÓ y acción 15/15 PASÓ |
| docs:index / docs:check / sdd:check | PASÓ; 490 specs / 467 migraciones, colisiones históricas declaradas |
| governance:check / components:check | PASÓ; 28 políticas / 5 fuentes CMP |
| git diff --check | PASÓ |
| Harness canónico | PASÓ 201/201, 103,289 s |
| Lint canónico / RSC / Edge | PASÓ: 0 errores/15 warnings; 1.641 módulos sin cruces; 4 funciones compilan |
| Unitarios generales | PASÓ 660 archivos/8.961 tests, 1 archivo/1 test omitidos, 1.027,18 s. Omisión: lib/studio/document-import/corpus.test.ts, DOCUMENT_IMPORT_CORPUS ausente; no se probó corpus comercial real |
| E2E general | PASÓ el paso: 177 passed + 1 flaky aprobado al reintentar, 20 skipped, 5,9 min. Flaky: company-photo-carousel.spec.ts:93, captura visual Chromium. Omisiones: 18 recorridos requieren seed/credenciales efímeras y 2 capturas de otros proyectos no aplican porque se ejecutan una vez en Chromium |
| Build de producción | PASÓ, incluido TypeScript del código corregido, páginas y postbuild Norte. tsconfig.json restaurado por el runner; no cambios rastreados derivados |
| pnpm verify | FALLÓ / CIERRE INCOMPLETO, exit 1, 14/17 pasos medidos: única falla inicial TS2345 del test, posteriormente corregida y typecheck/build PASÓ; migrations-applied, sql-tests y schema-rebuild omitidos. No se reescribe el veredicto histórico ni se repite la suite por el cierre documental |
| SQL / schema en esta continuación | NO EJECUTADO: VERIFY_SKIP_SQL=1 por instrucciones del Director, sin nuevo DDL; evidencia independiente reutilizable descrita abajo |
| Ledger en esta continuación | NO EJECUTADO: sin credenciales en WT. Director comprobó el ledger por separado |
| Visual aislado | PASÓ: una casilla original, carga/marcado/desmarcado/FormData, pending, error/borrador/foco, reintento, cancelar sin mutar, no-admin sin controles, light/dark y móvil; cero pageErrors |
| Auth admin real / acción RLS ejecutada / producción por Worker | NO EJECUTADO. Mocks prueban contrato, no una sesión autenticada o mutación real |

Ejecución de verify usa VITEST_MAX_WORKERS=1 soportado por Vitest instalado, sin cambios globales de configuración; E2E_PORT=3677 y Supabase sintético deny-only en 13677. No se debilitan tests ni se cambian timeouts. SQL/schema se omiten expresamente porque sus fuentes no cambiaron y Director conserva evidencia independiente. Logs ignorados propios en graphify-out/qa-0504/: simplification-targeted.log, simplification-typecheck-corrected.log, simplification-action-corrected.log, simplification-verify.log y simplification-visual.log. Todos los checks medidos restantes del gate PASÓ, incluidos feature-constants y pending-migration-symbols.

Evidencia visual vigente: desktop-light.png, desktop-dark.png, mobile-dark.png, mobile-readonly.png, error-draft.png y visual-report.json en la misma carpeta. Servidor de esta tarea PID 14200 verificado, lee los derivados nuevos sin reinicio; no se mataron procesos ajenos. El preview no equivale al módulo autenticado.

### Evidencia independiente anterior entregada por Director

- HEAD anterior e12a4867: CI alojada run 37834226764, Calidad local sin secretos PASÓ. No atribuir este resultado al futuro SHA.
- SQL PASÓ 224 contratos; schema PASÓ 449 migraciones + 18 ledger, 219 tablas. No cambios SQL en esta continuación; no se repiten.
- Ledger productivo sin faltantes salvo 0422/0423 declaradas; metadata RLS vigente y trigger 0293 comprobados por Director. Auditoría histórica calculator_city_updated registra slug/active; no se inventa before/after de casco.
- Configuración productiva ya correcta: 178 ciudades, Acarigua false y otras siete true. No escrituras de datos necesarias.
- Baseline main c3d37a8e: tests públicos 7/7, PR anterior 11/11; E2E dirigido 5 passed/1 skip en Chromium/mobile anterior. No prueba del futuro SHA.
- Producción anterior READY dpl_JBnbc7R49xEE6iCNwbjgsX46fcmn, SHA c3d37, dtdcargo.com/www. Baseline público 18 observaciones: /tarifas Acarigua $850 incluida y Maracaibo $973,60; embed derivaba antes de combinar tarifas. Resultado esperado después del nuevo release: Acarigua/Maracaibo $973,60 en ambas rutas y siete incluidas $850, mismos parámetros. La evidencia de release nueva queda en PR #193 por Director.

### Historia de primera implementación, sustituida

La primera versión añadió un panel duplicado que Sam pidió retirar. Slice anterior PASÓ 554/554; verify anterior FALLÓ/INCOMPLETO (14/17 pasos; suite final 16 archivos fallidos/635 pasaron/1 omitido, 34 tests fallidos/8.743 pasaron/1 omitido, pool/timeouts; E2E final 175 pasaron/3 fallaron/20 omitidos y un error de cierre de worker). Build local anterior PASÓ. Es evidencia del código anterior, no del resultado final. Logs antiguos se conservan sin sobrescribir en graphify-out/qa-0504. No se afirma que todos sus fallos fueran históricos ni que se resolvieran fuera del slice.

## Gobernanza y UI-CHECK

Cumplimiento del slice FRM/BTN/ERR/LOD/A11Y: controles nativos y etiqueta/descripción accesibles, una acción primaria, envío explícito sin autosave, bloqueo de doble envío, error visible con foco, cancelación, componentes y tokens canónicos. Gate y filtros de contexto reales cubiertos por test; evidencia RLS/trigger de metadata conservada con alcance de lectura. NO EJECUTADO: sesión admin real y auditoría de una escritura. No aplica: schema, nuevas tarifas, IA o datos personales. Sin excepción de scanner/guards ni nueva deuda RBAC.

UI-CHECK local realizado: estilos Studio, fuentes Sora/Nunito, tablet/móvil sin desborde nuevo de la casilla, descripción legible y foco de error. React revisado: hooks consistentes, estado mínimo, acción manual en transición para conservar el borrador, consultas paralelas del embed. No servicio pagado ni auditoría transversal inventada.

## COMMITS

Históricos de la rama: c37cd50c0cd784f16668fd3c60760a92eeb883de (primera implementación), b88951f9e321bf12990ec8a5c224500b15f385b7 (cierre inicial), e12a486766619890873c256744fd60aa0298a5ff (HEAD de entrada).
La simplificación y su handoff se publican en un commit selectivo feat(studio): SDD-0504 — reutilizar entrega incluida en Editar ciudad. Git, PR #193 y la entrega al Director guardan el SHA exacto. No commit adicional sólo para registrar su propio SHA.

## PR / BRANCH

PR #193 en borrador hacia main: https://github.com/hailuwaycom-sketch/DTDCARGO/pull/193. Publicación explícita de la misma rama a sí misma autorizada. El título/descripción se reescriben alrededor del cambio final: reutilizar opción original, respetar false, cruzar tarifas en embed y alinear Acarigua. Se conserva draft para revisión de Director. Worker no mergea/deploy; autorizaciones vigentes de Sam para esas operaciones a cargo del Director.

## PENDIENTES DE ESTA TAREA

Implementación, slice, suite general, E2E, build y revisión visual locales terminados; todos los criterios propios de SDD cumplidos y estado done de implementación. El resultado canónico conserva la falla TS inicial corregida y las tres omisiones; Director evalúa ese conjunto junto con SQL/schema/ledger independientes y CI del nuevo SHA. Publicación efectiva y coincidencia local/remoto/PR se comprueban en la entrega, sin convertir pruebas locales en evidencia productiva. Director integra con autorización y confirma deployment/alias/DOM público. Recorrido admin autenticado NO EJECUTADO, con alcance de mocks/metadata explícito; no es evidencia productiva. Actualizar/publicar conocimiento compartido y verificarlo en Obsidian corresponde a Director desde main integrado.

## FUERA DE ALCANCE DETECTADO

Quince warnings de lint en módulos ajenos (Wizard/Detalle, KommoBoardView, DocumentCalculator y knowledge-vault) intactos. La captura de carrusel fue flaky en esta corrida y pasó al reintentar; no se modificó el módulo. Fallos de suite/E2E de la primera corrida se preservan con su fecha/SHA y no se absorben: selector SDD-0360/0441, carrusel y errores de pool/cierre. Graphify advierte extracción parcial de dos TSX de Legal. Semántica global pendiente es deuda de conocimiento independiente, no una certificación de este Worker. No se amplía la tarea.

## HANDOFF AL DIRECTOR

Implementación corregida y pruebas del recorrido original listas. No nuevas migraciones/RPCs ni escritura productiva. Conservar WT/rama y preview 4324; no eliminar. Claim se libera sólo después de terminar escritura, commit/push y derivados. Git/PR/cierre entregan SHA exacto y estado remoto.

Al publicar, confirmar Acarigua false y otras siete true sin escribir si ya coinciden; comparar las mismas cargas en /tarifas y /tarifas/embed y el mensaje real de Acarigua, conservando otras ciudades/fórmula. Confirmar integración, CI, deployment READY y aliases con SHA exacto, por separado de pruebas locales. Rollback de código mediante PR/redeploy autorizado; no SQL para pasar gates.

### Impacto documental y conocimiento

Fuentes canónicas actualizadas: SDD-0504/índice, handoff propio, README/SEO y guía/prompt comerciales actuales. README Marketing estable SHA256 21edb31d1d00ea2ce1a69d0bab0cf850373d690bd29e77270f4d4a73d7eb99ad. Es la única fuente del piloto de 16 modificada; Director prepara extracción semántica genuina de ese README y refresco de encabezados en main integrado, conservando las otras quince fuentes. Worker no copia grafos/recibos de otra raíz.

Refresco Graphify estructural 0.9.61 PASÓ: 37.502 nodos/68.719 relaciones/2.411 comunidades, dos warnings de Legal conservados. Al registrar los resultados, sólo este handoff quedó estructuralmente PENDING; no se oculta la deriva documental ni se entra en recursión para conocer el propio SHA. Archify 2.16.0 build/check PASÓ: mapa CURRENT, 11 fuentes/9 checks, JSON canónico intacto y estructuras/semántica pendientes explícitas. Preview Obsidian PASÓ: modo PREVIEW, 1.169 documentos/41 advertencias históricas de vínculos, snapshot HEAD de entrada más cambios del WT. Piloto 0/16 PENDING y global 0/1.170 PENDING en este WT sin recibos, sin elevar cobertura por la extracción estructural.

Logs ignorados: simplification-graphify.log, simplification-archify-build.json, simplification-archify-check.json y simplification-obsidian-preview.json. Tras el commit se sincronizan los derivados y la preview para el SHA publicado; sus resultados exactos quedan en PR #193, logs final del WT y entrega al Director, sin otro commit autorreferencial. Publicación compartida y revisión visible en Obsidian NO EJECUTADAS por Worker: corresponden a Director desde main integrado comprobado.

# Rescate DTD-0441 · portal público del proveedor

## OBJETIVO ORIGINAL

Rescatar únicamente el fix de producto de `c8c79298` sobre main actual, o demostrar su redundancia. Task ID: `rescate-dtd-0441-proveedor`. Owner/sesión: `rescate-dtd-0441-proveedor-root-20260910` (Worker). Fecha: 2026-09-10. Estado: lista-para-revision (PR draft; no integrada).

Worktree escritor: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/rescate-dtd-0441-proveedor-20260910`. Rama: `codex/rescate-dtd-0441-proveedor-20260910`. Base: `origin/main` en `13facbada82da3f09e295e90bbcccbfc10ed165c`, verificada con fetch.

SDD reutilizado: [0441](../../docs/specs/0441-colores-semanticos-marca/spec.md); [0443](../../docs/specs/0443-prealertas-proveedor-etiquetas-recepcion/spec.md) aporta contexto histórico. Sin nuevo ID ni cambio a done.

Aceptación: respaldo previo de la rama original; veredicto contra main; si persiste, fix mínimo revalidado y PR draft; si es redundante, evidencia documental sin producto. Alcance máximo: los dos componentes públicos PackingListFormSection/SupplierUploadSection, spec/allowlist 0441, spec/qa 0443 y este handoff. Publicar rama y PR draft autorizado. No merge, migraciones, ruleset, borrado de ramas/worktrees ni otros commits históricos.

## COMPLETADO

- Primer cambio de estado remoto: publicación íntegra de `codex/portal-colors-reception-integration-20260906` en `dbecd209042e7b5b48fc7cfc237a738db65de74a`; `git ls-remote` confirmó el mismo SHA antes de crear este worktree o editar archivos. Rama original conservada sin cambios de contenido.
- Worktree nuevo creado desde main, guard y claim propios verificados. Evita incluir los merges y handoffs históricos de la rama original.
- Lecturas de BRAND.md, diseño/Norte, AGENTS, runbook, reglas de proyecto y gobernanza aplicables realizadas antes de producto.
- **Veredicto: el defecto sigue vivo en main; el fix no es redundante.** Revisión independiente completada. Ambos blobs de main coinciden con `c8c79298^`: PackingList `2e2fed754f5bfdecf5716a486cd87bf29cfd7d35`, SupplierUpload `ba3f1f514f536d28667b7c0cfecea4d2430073f8`. Todo `app/p` y el lockfile son iguales a ese padre; globals.css solo difiere en un comentario. No hay solución equivalente compartida.
- PR #33 (merge `94a94f2d`) incorporó los blobs previos al fix mediante `e2ec0adc`; PR #46 (merge `8e1bae5e`) no modificó `app/p`. Ambas ya integradas en la base inspeccionada.
- Portados exactamente cuatro cambios de clases: tabla `relative`; errores de campos, envío genérico y adjuntos con `text-ink` y borde localizado `border-status-danger`. Los dos blobs de producto resultantes coinciden exactamente con c8c79298: `0020c6215afd93403a70f298141a79de7b0bc7ce` y `c8af4b7777be997427b3fb458e154322737e690c`.
- Añadidas las dos rutas a la allowlist 0441 y ampliación explícita del slice en su spec. Sin cambios de lógica, mensajes, datos, contratos, aria, impresión ni otras acciones. No se portó documentación histórica ni se modificó 0443.
- Gobernanza: cumplimiento del delta de presentación frente a BRAND/VIS-01/ERR-01/A11Y-01; no aplica cambio de privacidad, DB o componente compartido. No se certifica adopción global del sistema.

## VALIDACIÓN

Evidencia nueva: `C:/Users/AKX generator/Desktop/Developer/DTD-backups/rescate-dtd-0441-proveedor-20260910/` (`audit.json`, `vitest-focal.log`, `verify.log`, `visual/`). Corresponde a la base y blobs anteriores; no reutiliza resultados históricos.

- **PASÓ** `corepack pnpm install --frozen-lockfile`: 813 paquetes, pnpm 12.3.4, lockfile intacto. Aviso de pnpm sobre `onlyBuiltDependencies` conservado; no se cambió configuración.
- **PASÓ** `corepack pnpm exec vitest run 'app/p/[token]/supplier-flow.test.tsx' 'lib/studio/prealertas/__tests__/packlist-vis-02.test.ts' --maxWorkers=2`: 7 tests / 2 archivos, sin skips.
- **PASÓ** `corepack pnpm docs:check`: índice sincronizado, 407 specs.
- **PASÓ** `corepack pnpm sdd:check`: 407 specs / 414 migraciones; exenciones históricas de numeración reportadas por el gate, sin alterarlas.
- **PASÓ** revisión independiente de equivalencia exacta de producto, alcance, enlace del handoff y accesibilidad preservada; `git diff --check`.
- **PASÓ** matriz visual local 8/8: Chromium/WebKit × claro/oscuro × main/rescate, 390 px. Cuatro escenarios acreditan la reproducción en main y cuatro la corrección. Documento main 874 px Chromium / 883 px WebKit; rescate 390 px. Scroll interno 200 px, 15 etiquetas sr-only y nombres accesibles Total uds / P. unit conservados; contenedor posicionado BODY → TABLE.
- **PASÓ** 24 estados de error medidos (12 baseline, 12 posteriores): campos/envío/adjuntos. Texto posterior igual a ink; borde danger de 2 px; contraste 16.491:1 claro / 13.083:1 oscuro. Main oscuro 3.004:1. Live regions preservadas. Capturas revisadas; sin errores JS ni solicitudes externas.
- **PASÓ lo medido** `corepack pnpm verify` con `VERIFY_SKIP_SQL=1` y `VERIFY_SKIP_E2E=1`: exit 0, 13/17 pasos ejecutados. Veredicto literal: **CIERRE INCOMPLETO — CRÍTICOS SIN MEDIR**; no es un cierre verde completo. Worktree sin .env.local ni variables de Supabase; no se copiaron credenciales.

| Gate de verify | Resultado y alcance |
|---|---|
| harness | PASÓ, 18 tests |
| lint | PASÓ, 0 errores / 8 warnings ajenos |
| rsc-boundary | PASÓ, 1597 módulos |
| typecheck | PASÓ |
| edge-functions | PASÓ, 4 funciones con Deno |
| test | PASÓ, 6526 tests / 521 archivos; 167.03 s, sin skips |
| docs:check | PASÓ, 407 specs |
| numbering | PASÓ, 407 specs / 414 migraciones; exenciones históricas declaradas |
| feature-constants | PASÓ, 5 banderas |
| components:check | PASÓ, agregado reproducible y cero rutas rotas |
| governance:check | PASÓ, 28 políticas aprobadas y cápsula vigente |
| migrations-applied | NO DISPONIBLE: sin credenciales; auto-SKIP, no se consultó producción |
| pending-migration-symbols | PASÓ, 0 rojo / 0 amarillo |
| sql-tests | NO EJECUTADO: excluido por NO migraciones; VERIFY_SKIP_SQL=1 |
| schema-rebuild | NO EJECUTADO: misma exclusión |
| e2e | NO DISPONIBLE según encargo: sin credenciales; omitido con VERIFY_SKIP_E2E=1 |
| build | PASÓ; Next completó compilación, tipos y generación de páginas. tsconfig.json restaurado por el gate. Hubo mensajes recuperados de consultas públicas por falta de configuración Supabase; no valida su contenido remoto |

Límites de la matriz: fixture del componente/wrapper real y CSS actual, datos sintéticos, respuestas interceptadas, shim de navegación y fuentes fallback locales; oscuro es contexto sintético. No mide Next integrado, fullscreen, impresión, lector de pantalla real, dispositivo físico, WeChat ni UAT. No sustituye E2E integrado. Integridad de fuentes verificada en `visual/source-integrity.json`. Vite propio y navegadores cerrados: PID 12032 ausente, puerto 5173 libre; recibo `visual/cleanup.json`.

## COMMITS

Fuente histórica: `c8c79298e7c18f121d6f7c700beb15cfc419bfbb`.

- `33da9caed468b74a985043399356825cc99057a9`: fix mínimo, allowlist, spec y handoff inicial; fuente de producto medida.
- Commit que contiene este cierre: solo actualización del handoff. Hash final registrado en la PR.

## PR / BRANCH

Respaldo: `origin/codex/portal-colors-reception-integration-20260906` en `dbecd209`. Entrega: `codex/rescate-dtd-0441-proveedor-20260910` contra main, [PR draft #57](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/57). GitHub confirmó las cinco rutas autorizadas y ningún commit histórico ajeno. CI se ejecuta al publicar; sus resultados se consultan por SHA y no sustituyen las pruebas locales.

## PENDIENTES DE ESTA TAREA

Ninguno de implementación o validación local dentro del rescate autorizado. Antes de integrar, Director revisa el SHA final, CI y las cuatro limitaciones anteriores; E2E/ledger no están disponibles y no se autorizaron migraciones. El estado global de SDD-0441 continúa in-progress.

## FUERA DE ALCANCE DETECTADO

No se trasladan el handoff histórico incluido en c8c79298 ni los demás commits originales. E2E con credenciales y ledger de producción no están disponibles; SQL/schema con migraciones quedan fuera de la autorización. ESLint: 0 errores y 8 warnings preexistentes en archivos ajenos al delta. Build: consultas públicas de noticias, servicios y tarifas emitieron mensajes recuperados por falta de configuración Supabase; la generación final pasó, sin validar esos datos remotos. No se corrigen otros aspectos visuales del proveedor ni los hallazgos históricos de 0443.

## HANDOFF AL DIRECTOR

Entrega para revisión en PR #57. Revisar únicamente sus cinco rutas y los cuatro cambios de clases; base inspeccionada 13facbad. No hay dependencias de implementación ni contratos compartidos nuevos. El cierre integral de producto queda limitado por los gates no medidos y la matriz sintética detallada arriba.

Conservar ambos worktrees, ramas y evidencia. El original queda intacto en dbecd209 y respaldado remotamente; esta sesión solo escribe en el nuevo worktree. Subagentes finalizados, sin sesiones escritoras independientes; servidores y navegadores propios cerrados. Al finalizar commit/push, liberar el claim con `node scripts/harness-worktree.mjs release --owner rescate-dtd-0441-proveedor-root-20260910`; el recibo de liberación y SHA final se confirman en la PR. Merge y producción conservan sus autorizaciones separadas.

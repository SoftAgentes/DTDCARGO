# Retirada de Agentation — 2026-09-10

- Task ID / owner: `remove-agentation-20260910` / `cursor-agentation-removal-20260910`.
- Sesión: subagente `dtd_cursor_audit` del encargo de configuración de Cursor.
- Worktree: `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\remove-agentation-20260910`.
- Rama: `codex/remove-agentation-20260910`.
- Base: `origin/main`, SHA `7921c120111acdc55b1d616e47c890c513afb57e`, actualizado con fetch antes de crear el worktree.
- Estado: lista-para-revision local; sin integración ni publicación.
- Objetivo: retirar la integración de desarrollo, dependencias y skills activas de Agentation en DTD por petición expresa del usuario.
- SDD: no aplica; retirada de herramienta de desarrollo, sin nuevo comportamiento Studio ni cambio funcional de producción. No se reserva un ID.
- Gobernanza: no aplica a patrones de producto; se conserva el diseño y comportamiento existente.
- Permisos: cambios y commit local de esta tarea; sin push, PR, merge, deploy, producción, Docker ni E2E global. El agente principal gestiona instalaciones/configuración global; este Worker no las modifica.
- Dependencias: ninguna tarea de producto. Preservar cambios del checkout principal y demás worktrees.

## Aceptación y allowlist

No quedan imports, montaje de toolbar, dependencias o instrucciones de instalación/uso activas de Agentation en este worktree. Las referencias históricas no se reescriben. El test de desborde mantiene sus aserciones y deja de ocultar una toolbar retirada.

Archivos permitidos:

- `app/layout.tsx`.
- `e2e/sin-scroll-horizontal.spec.ts`.
- `package.json` y `pnpm-lock.yaml`.
- `skills-lock.json`.
- `.agents/skills/agentation/SKILL.md`.
- `.agents/skills/agentation-self-driving/SKILL.md`.
- `.agents/skills/agentation-self-driving/references/two-session-workflow.md`.
- Este handoff.

Validación acordada: consistencia del lockfile con instalación congelada, búsqueda de referencias activas, lint focal y colección del test afectado. El agente principal acotó el cierre a comprobaciones livianas; TypeScript global, build y ejecución de navegadores no se incluyen.

## Estado inicial preservado

El checkout principal tenía dos skills tracked ya borradas y los untracked `docs/runbooks/assets/` y `docs/runbooks/restauracion-laptop-2026-09-05.md`. No se trasladaron esos cambios. El worktree propio empezó limpio con claim adquirido.

## OBJETIVO ORIGINAL

Desinstalar Agentation del proyecto DTD sin afectar otros trabajos.

## COMPLETADO

- Retirados import y montaje de la toolbar de desarrollo en `app/layout.tsx`.
- Eliminadas dependencias `agentation` y `agentation-mcp` del manifiesto; regenerado `pnpm-lock.yaml` con pnpm 11.19.0.
- El lock pasó de 932 a 855 entradas de paquetes: 77 eliminadas, ninguna entrada de paquete/versión nueva. pnpm recalculó contextos de peers existentes de `supports-color`; no se realizó actualización de dependencias.
- Eliminados tres archivos de skills de uso/instalación y sus dos entradas en `skills-lock.json`.
- El helper de desborde dejó de ocultar/excluir la toolbar retirada. El cuerpo completo de los tests, sus casos y aserciones se conserva idéntico al de la base.
- Conservadas dos referencias históricas: comentario de procedencia en `app/page.tsx:410` y auditoría fechada `docs/audits/2026-09-05-codex-engineering.md:20`.
- No se modificó checkout principal, otros worktrees, configuración global ni documentos de la conversación.

## VALIDACIÓN

Entorno: Windows, Node v24.20.0 y pnpm 11.19.0; base `7921c120111acdc55b1d616e47c890c513afb57e` más el diff de esta tarea. Sin copiar archivos de entorno ni usar credenciales de producción.

| Comprobación | Resultado y alcance |
|---|---|
| `pnpm install --lockfile-only --ignore-scripts` | PASÓ, exit 0; actualizó el lock a partir de la retirada de dos dependencias. |
| `pnpm install --frozen-lockfile --ignore-scripts` | PASÓ, exit 0; resolución omitida por lock vigente. Dependencias instaladas únicamente en este worktree antes de la instrucción posterior de no realizar más instalaciones. |
| `pnpm exec eslint app/layout.tsx e2e/sin-scroll-horizontal.spec.ts` | PASÓ para `app/layout.tsx`, exit 0 sin errores. `e2e/sin-scroll-horizontal.spec.ts` fue IGNORADO por la configuración existente (1 aviso); no se atribuye cobertura de lint a ese archivo. |
| `pnpm exec playwright test e2e/sin-scroll-horizontal.spec.ts --project=chromium --list` | PASÓ, exit 0; colectó 10 casos de un archivo. NO ES ejecución E2E. |
| Comparación del cuerpo de los tests desde `for (const ancho of ANCHOS)` | PASÓ; idéntico a la base tras normalizar finales de línea. |
| Búsqueda de referencias activas con `git grep` | PASÓ; cero coincidencias fuera de los dos antecedentes históricos y este handoff. |
| Comparación de identidades de paquetes del lock | PASÓ; 77 eliminadas, cero agregadas. |
| Ausencia de `node_modules/agentation` y `node_modules/agentation-mcp` | PASÓ en este worktree. |
| `git diff --check` y guard con owner | PASÓ, exit 0. |
| `pnpm verify`, TypeScript global, build y pruebas de navegador | NO EJECUTADO; cierre proporcional acotado por el encargo, sin presentar colección como ejecución. |
| Docker, SQL, migraciones, producción, E2E global | NO EJECUTADO; fuera de autorización. |

## COMMITS

El commit que contiene este documento agrupa exclusivamente la retirada y su handoff. Sin publicación autorizada.

## PR / BRANCH

Sin PR. Rama local `codex/remove-agentation-20260910`.

## PENDIENTES DE ESTA TAREA

Ninguno de implementación dentro de la allowlist. Revisión e integración a cargo del Director; no autorizadas en este encargo. La validación dinámica y global no se ejecutó; sus límites figuran arriba.

## FUERA DE ALCANCE DETECTADO

pnpm 11.19.0 avisa que `pnpm.onlyBuiltDependencies` en `package.json` ya no se lee. Es configuración preexistente; se usó `--ignore-scripts` y no se amplió el alcance para corregirla.

El agente principal gestiona la desinstalación global y el inventario de otras copias. Este commit no cambia su estado ni se propaga automáticamente a ellas.

## HANDOFF AL DIRECTOR

Revisar el diff local y decidir su incorporación con las autorizaciones correspondientes. La propagación a otros worktrees requiere atender el estado y owner de cada uno; no sobreescribirlos en bloque. El Worker libera el claim al terminar el commit y comunica el resultado en la entrega; no elimina rama ni worktree.

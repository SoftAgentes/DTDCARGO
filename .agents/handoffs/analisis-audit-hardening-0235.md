# analisis-audit-hardening-0235

Dueño / sesión: `worker-w4-analisis-0235-20260914` · Fecha: 2026-09-14 · Estado: lista-para-revision; análisis completo y PR en borrador publicada.

- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/analisis-audit-hardening-0235`.
- Rama: `codex/analisis-audit-hardening-0235`; base: `origin/main` = `b07ad98bda4da35086d8207640321a7995fc8f24`.
- Fuente de solo lectura: `origin/codex/audit-hardening-20260801` = `ec7adeb98a2e03f398cc004f9dbab75f19b68b2c` (5 commits, 42 rutas, base común `c13dfa8cd30dd5095abdcad32f28245569c47c56`). No se modificó ni se publicó.
- Objetivo: análisis por lotes de la rama SDD-0235 contra main, al estilo del bloque C: qué sigue vigente, qué entró por otra vía, qué choca y qué lotes son extraíbles y en qué orden.
- SDD: no aplica; no se cambió estado ni texto de la spec 0235.
- Aceptación: (1) tabla de 42 archivos con clase, blobs y evidencia; (2) lotes con riesgo, orden, condición de arranque, migración, pruebas y spec; (3) descarte con evidencia y decisiones reservadas a Sam; (4) enlaces verificados e índice si aplica.
- Alcance escritor: `docs/audits/analisis-audit-hardening-0235.md`, índice si corresponde y este handoff. Exclusiones respetadas: producto, SQL, PRs de extracción, specs.
- Dependencias: ninguna; tres Workers paralelos en otros worktrees, ninguno toca `docs/audits`.
- Permisos: commits locales selectivos `docs(audits): …`; push de la rama propia y PR en borrador contra `main` autorizados por el encargo; sin merge ni producción. Producción Supabase no se consultó.
- Ownership: guard PASÓ; claim `worker-w4-analisis-0235-20260914` adquirido antes del primer cambio y liberado al cierre, después del último commit y push.

**VEREDICTO: no hay lotes de producto extraíbles.** 17 de los 42 archivos son idénticos por blob en main (incluidas 0325–0329 y sus contratos) y los otros 25 están superados por versiones posteriores que contienen y amplían su conducta; 0 vigentes y 0 en conflicto semántico. La rama entró a main por otra vía el 2026-08-01 (hotfix `1955474e` vía `5a1723cf`) y el 2026-08-03 (Gobernanza 9, REV-SGE-052, merge `76b242bd`); 0325 aplicada el 2026-08-01 y 0326–0329 el 2026-08-03 (REV-SGE-054). El dictamen del 2026-09-12 §3 («nunca se integró») queda corregido: lo pendiente es cierre documental y descarte autorizado.

## OBJETIVO ORIGINAL

Entregar `docs/audits/analisis-audit-hardening-0235.md` con la clasificación archivo por archivo de `origin/codex/audit-hardening-20260801` contra `main` `b07ad98b`, lotes extraíbles con orden y condiciones, descarte recomendado con evidencia y decisiones reservadas a Sam, sin extraer código ni SQL, sin editar specs y sin consultar producción.

## COMPLETADO

- [Análisis](../../docs/audits/analisis-audit-hardening-0235.md): tabla de los 42 archivos con estado desde la base, blob de rama y de main, clase (17 IDÉNTICO EN MAIN, 25 SUPERADO EN MAIN, 0 VIGENTE, 0 EN CONFLICTO), commit de main que lo superó, choque textual según `merge-tree` (13 content, 7 add/add, 2 modify/delete) y una línea de evidencia por fila con números de línea de main. Criterio 1 cumplido.
- Lotes propuestos: C1 cierre documental de SDD-0235 en main; C2 descarte autorizado de la rama remota; R1 residual funcional fuera de la rama (retención de `public_track_log`, hallazgo de SDD-0455). Cada uno con archivos, riesgo (auth, privacidad, adjuntos, API), orden y condición de arranque, migración (ninguna asignada ni necesaria), pruebas y spec. Criterio 2 cumplido.
- Descarte recomendado de la rama completa con evidencia y condiciones del runbook, más cuatro decisiones reservadas a Sam. Criterio 3 cumplido.
- Enlaces verificados con script propio; `docs/README.md` ubica las auditorías por carpeta sin listar archivos y `docs/audits/` no tiene índice, por lo que no corresponde agregar entrada. Criterio 4 cumplido.
- Únicas escrituras versionables: el análisis y este handoff. Sin producto, SQL, specs, cambios a la rama fuente ni PRs de extracción.

## VALIDACIÓN

| Comprobación | Estado y evidencia |
|---|---|
| Guard / claim / rama | PASÓ; `Guard OK` sobre el worktree, claim `worker-w4-analisis-0235-20260914`, HEAD inicial `b07ad98b` |
| Inventario y blobs | PASÓ; `git diff --name-status c13dfa8c ec7adeb9` = 42 rutas; blobs de rama, main y base por `git rev-parse` |
| `git merge-tree --write-tree main origin/codex/audit-hardening-20260801` | PASÓ como medición; 22 rutas en choque (13 content, 7 add/add, 2 modify/delete) |
| `git cherry -v main origin/codex/audit-hardening-20260801` | PASÓ como medición; 5 commits `+`, ningún parche equivalente |
| Historia por ruta `git log c13dfa8c..main -- <ruta>` | PASÓ; commit que superó cada archivo citado en la tabla |
| Enlaces relativos (script propio sobre análisis y handoff) | PASÓ; 12 revisados, 0 rotos |
| `git diff --check` | PASÓ antes de cada commit |
| `corepack pnpm docs:check` | PASÓ; «índice sincronizado con 452 specs». pnpm 12 instaló dependencias al no existir `node_modules`; `pnpm-lock.yaml` intacto |
| `corepack pnpm sdd:check` | PASÓ; «sin números repetidos», con los avisos históricos habituales de 0342/0363/0394 |
| `pnpm verify` | NO EJECUTADO; cambio solo documental, sin producto, SQL ni harness |
| Ledger / producción Supabase | NO EJECUTADO; prohibido por el encargo. Estado de 0325–0329 tomado de la spec y de REV-SGE-054 en main |
| Ensamblado o compilación de la rama fuente | NO EJECUTADO; equivalencia demostrada por blob y lectura línea a línea de los deltas |

## COMMITS

- `bde4185bb23b873466b4a68b1db7642b1d8c764e`: análisis por lotes y handoff inicial.
- Commit que contiene este documento: cierre del handoff y enlace de la PR en la cabecera del análisis. Su hash se registra en la PR, no aquí.

## PR / BRANCH

[PR #113 en borrador](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/113), base `main`, head `codex/analisis-audit-hardening-0235`, publicada con `git push -u origin codex/analisis-audit-hardening-0235:codex/analisis-audit-hardening-0235` desde el worktree `DTD-worktrees/analisis-audit-hardening-0235`. Sin merge ni despliegue.

## PENDIENTES DE ESTA TAREA

Ninguno.

## FUERA DE ALCANCE DETECTADO

- Textos desfasados en main sobre el rollout: spec 0235 líneas 37–38 («`0326`–`0329` permanecen sin aplicar»), `docs/legal/privacidad/mapa-de-borrado.md` §8 l.272 («siguen fuera de Producción») y `docs/legal/privacidad/registro-tratamiento.md` §4.2 l.95 (`public_track_log` «Cloud NO VERIFICABLE») contradicen REV-SGE-054. Materia del lote C1; no se corrigió porque las specs quedan excluidas.
- El dictamen del 2026-09-12 §3 afirma que el endurecimiento nunca se integró; la evidencia lo desmiente.
- Método de inventario de ramas: `git log main..rama` y `git cherry` no detectan integraciones re-aterrizadas con otros commits; comparar blobs por ruta sí. El mismo patrón puede afectar a `codex/governance-final-100` y `codex/portal-colors-reception-integration-20260906`, dejadas en revisión propia por el dictamen.
- `lib/public/tracking-queries.ts` sigue huérfano (ya documentado en reglas técnicas): el beneficio en runtime de 0326 es latente mientras `/track` redirija al portal.
- Criterio de aceptación de 0235 «el throttle y su purga tienen tests» parcial: `public_track_log` no tiene purga (SDD-0455). Es el residual R1, con spec nueva; no pertenece a la rama.

## HANDOFF AL DIRECTOR

- Siguiente acción: revisar la PR #113 y su veredicto. Si se acepta, convertir C1 en una tarea Worker (spec 0235, `mapa-de-borrado.md` §8, `registro-tratamiento.md` §4.2, índice regenerado) una vez Sam decida el estado final de la spec; pedir a Sam la autorización de C2 (borrado de `origin/codex/audit-hardening-20260801`, con o sin tag de archivo sobre `ec7adeb9`). R1 espera la política de retención de `public_track_log` y, si la hubiera, número de spec y de migración asignados por el Director.
- Corregir el dictamen del 2026-09-12 §3 y, antes de dictaminar las otras ramas en revisión propia, comparar blobs por ruta.
- Cambios compartidos: ninguno; solo `docs/audits/` y este handoff. Sin dependencias de API, schema ni UI.
- Integración pendiente: PR en borrador para revisión; no hay permiso de merge ni de despliegue. La PR no toca código, así que un merge futuro no dispararía build por el `ignoreCommand` de Vercel.
- Sesiones consumidoras: ninguna. Subagentes no se usaron. Claim liberado al cierre; rama y worktree se conservan.

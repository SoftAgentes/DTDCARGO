# Integración local y validación de la cadena de perfil

- Task: profile-integration-validation-20260906.
- Owner: 01a07370-bf34-7252-a63d-186ed7d4a407.
- Rama: codex/profile-integration-validation-20260906.
- Worktree: C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/profile-integration-validation-20260906.
- Base remota/local verificada: main74bb52ab9677f96908cc032a15f2364ab9d94716.
- Fuente26: 07d1dea12529fda9cf55217d1be2fd8deaf7d730, código revisado ce9312a3.
- Fuente27 (incluye23): 3f2e80f17f293e8022528dbe12a63d4413b05cac, código revisado d7717861.
- Estado: lista para revisión independiente; validación local terminada el 2026-09-06.
- SHA de producto y gates: 45186f89191aae5a4339aa3047dde5cdc6ec73bb.

## OBJETIVO ORIGINAL

Combinar cadena26+23+27 y medir contratos/checks sobre su resultado real.
Preservar0445 byte a byte, incorporar0446 final/0447 contención y SDDperfil0439.

## Alcance y permisos

Sólo este worktree. Fuentes permanecen limpias, no se editan26/27/30 ni main.
Merges locales asignados, índice generado y corrección related0438→0439;
conflictos de producto requieren propuesta previa. Dependencias propias frozen,
sin junction a worktrees, sin .env/secretos/Cloud. Commits selectivos locales;
no publicar, merge main ni migraciones de producción. Gate pesado después de
base combinada y plan de entorno/E2E comunicado al Director.

## COMPLETADO

Raíz/rama/base y refs verificadas. Guard y claim propio adquiridos.
Merge26: fdf42108aaa0505f5a1c161bf9d5eefa0fa33507, sin conflictos.
Merge27: 124f3da5cb944ccfb64acac49f692d7d786d1c8c, único conflicto en índice
generado docs/specs/README.md, resuelto por build-docs-index.mjs (312 specs).
Sin conflictos de producto ni alteraciones de fuentes. Related de spec0438
corregido de SDD0435 a SDD0439, referencia vigente de perfil.

Merge del fix de arranque PostgreSQL75e3: 45186f89191aae5a4339aa3047dde5cdc6ec73bb.
Sólo cambia runner y handoff respecto del SHA4207 medido en el primer E2E.
0445 conserva blob d1a1e8c6a367cf607cf13b9b3c25af7a9d0a5019 y SHA256
5A256A83E1E8C056D7AAE7EA6A22D39607D60B8C329683C6EE2AEA9557EACD4B.
0446 idéntica a07d1 y0447 idéntica a3f2e, confirmado después del merge final.
Dependencias propias instaladas con frozen-lockfile e ignore-scripts, sin junction.

## VALIDACIÓN

- PASÓ: `node scripts/qa/profile-merge-chain.mjs --baseline-ref 7f68d38436a75ca3a84c087ca36d689f79ecd31e --privacy-ref 3f2e80f17f293e8022528dbe12a63d4413b05cac`,
  14 grupos en PostgreSQL17 efímero, exit0, handle72631. El primer intento
  FALLÓ antes de SQL por readiness; se conserva y el fix75e3 resolvió ese fallo.
- PASÓ con exclusiones: `node scripts/verify.mjs` (entrada de `pnpm verify`),
  SHA45186, 06:46:35–06:58 UTC, handle28274 exit0. 14/16 pasos ejecutados:
  harness, lint (8 advertencias,0 errores), rsc-boundary, typecheck, edge-functions
  (4), test (6224 pruebas/504 archivos), docs, numbering, feature-constants,
  components, governance, SQL (142 contratos), schema y build.
  Schema:382 migraciones desde cero,18 sólo-ledger;219 tablas y2 tenants sintéticos.
- NO EJECUTADO dentro de verify: E2E por `VERIFY_SKIP_E2E=1`, autorizado y medido
  aparte. Migrations-applied sin credenciales: pendiente de release, no verde completo.
  Deno2.9.6 y Vitest4 workers; sin credenciales ni acceso Cloud en este gate.
- FALLÓ: primer E2E sobre4207,150 seleccionados de168,142 expected,7 unexpected,
  1 flaky,0 skipped. JSON completo; duración554327.504ms, exit1 natural.
  Fallos concentrados en calc-event:15 (chromium/mobile-chrome), calculadora-sin-peso:24
  (ambos móviles; chromium flaky), calculadora-sin-peso:86 (3 proyectos).
  Valores9600/9550,9000/6000kg y4000/2000kg divergían de DEFAULT_PARAMS.
- PASÓ en aserciones / FALLÓ en cierre: repetición normalizada sobre45186,
  150 expected,0 unexpected,0 flaky,0 skipped.150 tuplas archivo/línea/título/proyecto
  coinciden exactamente con la selección revisada. Chromium/mobile-chrome/mobile-safari,
  workers1,traceoff,retries1,timeouts60s originales. Nuevo servidor y dist.
  Inicio06:58:19.990Z, fin07:09:49.329Z, duración689305.728ms, handle31714 exit1.
  Dos errores globales duplicados: `worker-2 process did not exit within 300000ms
  after stop, force-killed it`. Playwright terminó su propio worker; no intervención
  manual, no timeout global alcanzado. No se convierte el exit1 en proceso aprobado.
- NO EJECUTADO:18 casos autenticados excluidos expresamente de ambas selecciones.
  No se crearon usuarios/sesiones/seed Auth. Normalización TEST ejecutada por Director
  y verificada06:47:07UTC; esta sesión sólo utilizó URL y anon público TEST autorizado.
  No se cambiaron assertions/retries para obtener el resultado.
- PASÓ: comparación y restauración exclusiva de includes generados de tsconfig;
  git limpio y diff-check al terminar gates. Puerto3763 y procesos propios liberados.

Fuentes tienen revisión independiente favorable acotada; pendiente revisión del
resultado combinado. PR26 conserva riesgo de deadlock preexistente: quietud de
operaciones relevantes para release y retry completo de transacción abortada40P01,
sin garantía de wait-only. Persistieron mensajes fetch timeout del servidor:
los tests aprobados no demuestran disponibilidad completa del backend TEST.

Evidencia durable externa (sin claves en Git):
`C:/Users/AKX generator/Desktop/Developer/DTD-backups/profile-integration-validation-20260906/`.
Subdirectorios `verify`, `e2e-150` y `e2e-150-normalized`; logs, metadata, result y
JSON íntegros, matriz y validated-summary. `profile-chain.log` y `profile-chain-tcp.log`.
Normalización: recibo Director bajo backuppr28/calculator-normalization-review;
SQL SHA25686629f532b519d88a2d19fcbd9dd40e52d9e5510ee015d63e069dc2cef3cb171.

## COMMITS

- fdf42108: merge26.
- 124f3da5: merge27 e índice generado.
- 4207b8de: handoff inicial y related0438→0439.
- 45186f89: merge75e3, fix de readiness TCP del runner.
- Commit que contiene este documento: evidencia de validación y cierre local;
  no cambia producto respecto del SHA45186 medido.

## PR / BRANCH

Rama local arriba, sin PR/publicación nueva autorizada.

## PENDIENTES DE ESTA TAREA

Revisión independiente del resultado combinado;18 casos autenticados;
resolución/aceptación explícita del fallo de cierre Playwright. Validación release
0446/0447 y publicación/integración permanecen separadas y sin ejecutar aquí.

## FUERA DE ALCANCE DETECTADO

Retención/región/hold y operaciónCloud no se cierran con esta integración local.
La evaluación visual de la combinación31/30/33 y el zoom nativo200% no están
validados por este gate de perfil. PR30 original no se modificó en este encargo.

## HANDOFF AL DIRECTOR

Resultado y liberación de consumo TEST/slot pesado notificados al Director07:09UTC.
Solicitar auditoría final sobre45186 y el delta exclusivamente documental de cierre.
Sin publicación, merge main ni migraciones productivas. No borrar este worktree.

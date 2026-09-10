---
sdd: "0376"
title: Comprobaciones Git agrupadas sin relajar el cierre seguro
status: done
author: Codex
created: 2026-09-03
updated: 2026-09-03
supersedes: null
superseded_by: null
related: ["0370", "0375"]
confidencialidad: interno
---

# SDD-0376 — Reducir subprocessos del cierre seguro

## Fuente y alcance autorizado

La cola local de saneamiento incluye corregir fallos del verificador. El gate
de SDD-0375 produjo 2 y luego 4 timeouts en el CLI sintético de worktrees.
No fallaron aserciones de seguridad. Con un trabajador todavía falló 1/4.
Perfil sobre fixture y dry-run: 72 subprocessos Git, 3.801 ms sin contención.
Hay seis resoluciones git-path por checkout y por inspección, 24 subprocessos
para las mismas seis clases de operación. No se elimina la doble inspección.

pnpm sdd:next consultó 15 refs después del checkpoint47b1dd0b: 0376 libre.
Sin reserva remota. Sólo cambios y pruebas locales; nunca ejecutar finish
sobre los worktrees reales. No push, main, limpieza final, Cloud o deploy.

## Hipótesis y contrato

Agrupar las seis opciones --git-path en una invocación git rev-parse con
--path-format=absolute reduce 72 a 52 procesos en un finish dry-run.
Cada respuesta debe contener exactamente seis rutas absolutas, ordenadas y
con los basenames esperados; una respuesta incompleta/ambigua bloquea.
Se comprueba existencia de todas las rutas en main y candidato, dos veces.
Git decide las rutas: no inferirlas desde .git ni ignorar worktrees vinculados.

No cambiar permisos, decisiones, attestation externa, comparación remota,
contención, estado limpio, ignorados, junctions, handoff, remove sin force,
confirmación posterior ni conservación de rama. No aumentar timeouts ni
cambiar maxWorkers en este experimento. La presión de memoria es contexto,
no causa demostrada de todos los fallos.

## Allowlist

- scripts/harness-worktree.mjs: principal, agrupación de lectura.
- scripts/__tests__/harness-operation-paths.test.mjs: pruebas independientes.
- Esta spec y docs/specs/README.md generado.
- docs/audits/2026-09-03-worktree-git-probe-local.md.
- docs/audits/2026-09-03-public-verify-atomic-local.md: resultado final del gate.
- docs/specs/0375-public-verify-atomic-reservation/spec.md: aceptación local verificada.
- docs/audits/2026-09-02-codex-arranque-checklist.md.
- .agents/handoffs/2026-09-02-saneamiento-integral-close.md.

## Aceptación

- [x] RED causal de consultas repetidas; no fallo por importación ausente.
- [x] Seis estados de operación en ambas raíces bloquean sin mutación.
- [x] Respuestas Git truncadas, relativas o mal ordenadas bloquean.
- [x] Conservación de las 52 pruebas existentes, sin bajar aserciones.
- [x] Perfil antes/después repetido y mejora fuera del ruido; descartar si no mejora.
- [x] Suite/gates y documentación con fallos/SKIP explícitos.

Cierre técnico local: 6.936/6.936 unitarios en 545 archivos, 214,59 s,
configuración original. Docs, numeración, lint focal, gobernanza y componentes
aprobados. Se conserva el primer gate exit 1 y sus reservas E2E/Cloud en el
acta; no se afirma un segundo verify completo ni permiso de limpieza real.

## Gobernanza

SGE-00.02/04/05/07/12: cumplimiento esperado mediante conservación de todos los
gates y de la evidencia del cierre. MP-01: no se modifica clasificación ni
autoriza disposición real. ERR-01: error ambiguo bloquea y no expone stderr
de transporte. Sin UI, campos personales, nueva retención ni restauración.
La prueba sólo retira sus propios repositorios sintéticos con ownership.

Fuente: [git rev-parse, opciones de rutas](https://git-scm.com/docs/git-rev-parse).
--path-format afecta las opciones siguientes; comando compuesto ejecutado
localmente con seis resultados antes de diseñar el cambio.

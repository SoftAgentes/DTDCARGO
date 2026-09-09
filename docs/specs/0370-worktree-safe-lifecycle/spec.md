---
sdd: "0370"
title: Cerrar worktrees solamente después de verificar su preservación
status: in-progress
author: Codex
created: 2026-09-03
updated: 2026-09-03
supersedes: null
superseded_by: null
related: ["0349"]
confidencialidad: interno
---

# SDD-0370 — Ciclo seguro del helper de worktrees

## Objetivo y fuente

Aplicar al helper existente las condiciones de
[`git-worktrees-multiventana.md`](../../runbooks/git-worktrees-multiventana.md),
sin cambiar permisos de las sesiones ni automatizar integración/publicación.
El saneamiento continuo autoriza corregir el pendiente local; no constituye GO
para ejecutar `finish` sobre una carpeta real, hacer push o modificar Cloud.
Numeración consultada con `pnpm sdd:next`: 15 refs, 0370 libre; sin reserva/push.

La versión anterior copiaba `.env.local`, instalaba sin lockfile congelado y
ocultaba errores de instalación si encontraba Vitest. Intentaba retirar la
carpeta antes de verificar contención, usaba borrado recursivo como fallback y
`branch -D`, con comparación permisiva contra main local si faltaba origin/main.

## Contrato verificable

1. `start <slug>` crea `codex/<slug>` desde `origin/main` actual, sin upstream,
   mediante `git worktree add --no-track`. Admite `--from <ref>` explícita.
   Rechaza argumentos desconocidos, opciones incompletas y rutas/refs inválidas.
   No copia variables ni secretos. Instala con `pnpm install --frozen-lockfile`:
   un error retorna distinto de cero y conserva el worktree recién creado.
2. `finish` sólo opera desde la raíz del checkout principal, en main limpio.
   El candidato debe ser el hijo directo registrado del contenedor hermano
   `DTD-worktrees`, con rama `codex/<slug>` o `feat/<slug>` heredada, sin enlaces
   simbólicos/junctions, detached, lock, submódulos o estado prunable.
   Nunca permite retirar el principal ni operar desde el propio candidato.
3. Antes de cualquier retirada exige árbol/índice limpios, incluidos untracked,
   y ausencia de ignorados. No hay allowlist automática de node_modules, .next,
   bundles ni secretos: preservación/retiro de regenerables es una operación
   previa separada y autorizada. No imprime contenidos. Rechaza flags del índice
   que oculten cambios y configuraciones de entorno Git que redirijan el repo.
4. Comprueba SHA remoto vivo de main y de la rama, upstream exacto de origin,
   igualdad rama/upstream/remoto, main local igual al publicado y contención
   del HEAD del candidato. Sin red, ref ausente, main atrasado o comparación
   fallida: bloqueo. La historia se consulta sin reemplazos de objetos; grafts
   heredados o variables que sustituyan su archivo se rechazan. No hay fallback
   a main local, fetch, merge ni push implícitos.
5. Exige `--confirm-idle <HEAD-completo>` y `--handoff <ruta-relativa-del-repo>`.
   El primero es la atestación del responsable de haber comprobado tareas,
   sesiones y procesos y mantener exclusividad; NO es una detección automática
   ni otorga autorización. El handoff debe ser archivo regular versionado,
   preservado con contenido idéntico en candidato y main local/publicado.
   Ante ownership desconocido, no se proporciona esa confirmación.
6. Sólo entonces ejecuta `git worktree remove -- <ruta>`, sin force ni fallback;
   verifica ausencia física y del registro. Un error detiene el comando sin
   borrar la rama ni intentar recuperar con comandos destructivos. Opcionalmente
   `--delete-branch` usa únicamente `git branch -d`. No hace prune global.
   Revalida estado local inmediatamente antes de retirar; no promete atomicidad
   entre procesos, hosts o repositorios. La exclusividad sigue siendo obligatoria.
7. `--dry-run` valida todos los gates y muestra el alcance, sin instalación,
   creación, eliminación ni cambios de refs. `list` conserva la consulta Git.
   Los llamadores viejos de finish sin confirmación fallan con instrucciones claras.

## Allowlist y ownership

- `scripts/harness-worktree.mjs`: implementación; agente principal.
- `scripts/__tests__/harness-worktree.test.mjs`: helpers/parser; principal.
- `scripts/__tests__/harness-worktree-safety.test.mjs`: CLI/Git real; agente de pruebas.
- `scripts/__tests__/fixtures/worktree-fixture.mjs`: fixtures Git locales; agente de pruebas.
- Esta spec y `docs/specs/README.md` generado; principal.
- `docs/runbooks/git-worktrees-multiventana.md`, `docs/runbooks/abrir-ventanas-worktree.md`
  y `.claude/commands/feature.md`:
  sincronizar únicamente el uso del helper; principal.
- `docs/audits/2026-09-02-codex-arranque-checklist.md` y
  `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`: evidencia; principal.

Sin cambios en AGENTS, app, dependencias, SQL, CI, datos, remotos ni producción.
Estilo existente: ESM Node, argumentos como arrays (sin interpolación en shell),
funciones pequeñas, errores explícitos en español neutro y comandos Git selectivos.

## Plan, tareas y pruebas

- [x] Reproducir pérdida de worktree no publicado y fallos de start con CLI real.
  Agente de pruebas independiente, antes de implementar. Verificar RED causal.
- [x] Corregir helper y parser contra el contrato anterior. Depende del RED;
  verificar negativos y positivos con Git bare local y pnpm sintético.
- [x] Ejecutar `pnpm test scripts/__tests__/harness-worktree.test.mjs scripts/__tests__/harness-worktree-safety.test.mjs`,
  `pnpm test --maxWorkers=4`, `pnpm exec eslint scripts/harness-worktree.mjs scripts/__tests__/harness-worktree.test.mjs scripts/__tests__/harness-worktree-safety.test.mjs scripts/__tests__/fixtures/worktree-fixture.mjs`,
  `node --check scripts/harness-worktree.mjs`, `pnpm docs:check`, `pnpm sdd:check`,
  `pnpm governance:check`, `pnpm components:check` y revisión independiente.
- [x] Sincronizar llamadores/evidencia y preparar cierre local selectivo.
- [ ] Publicación/CI alojado del SHA final y uso real del helper con sus propios gates.

Fixtures: sólo repositorios sintéticos bajo mkdtemp propio validado, origin bare
por protocolo file, Git config/hooks aislados, ninguna URL alojada ni secreto.
La prueba de pnpm registra argumentos y fuerza resultados sin instalar paquetes.
Se comprueba conservación de archivos/registro/ramas ante los rechazos, además
del exit code; camino positivo retira sólo el candidato publicado e integrado.

## Evidencia y límites

Evidencia local ejecutada el 2026-09-03 UTC:

- Parser/helpers: RED 20/27 y GREEN 27/27. CLI sobre Git real sintético: RED 5/5
  (instalación no congelada, copia de entorno, éxito falso de pnpm, retirada sin
  publicación y dry-run sin comprobaciones). El principal repitió y confirmó
  personalmente esa reproducción antes de modificar start/finish.
- Matriz ampliada: GREEN 78/78 (27 puros + 51 integración), 117,80 s. Canario posterior
  GIT_GRAFT_FILE: RED 1 por retirada indebida y GREEN 1/1 tras bloquear la redirección.
  El inventario final suma 79 casos: 27 puros y 52 integración. De estos últimos,
  51 invocan la CLI y 1 importa el comando con sólo el resultado de remove
  inyectado; no se presenta como un fallo real del sistema de archivos.
- La primera suite completa detectó el contrato de entorno: dos variables
  privadas del fixture no seguían la convención del arnés. Se renombraron a
  VERIFY_WORKTREE_FIXTURE_INSTALL_EXIT/LOG; contrato y tres start GREEN 4/4.
  No se modificaron `.env.example`, su escáner ni el comportamiento del producto.
  Suite completa previa: 6.546 aprobadas/1 fallo, 540 archivos, 250,44 s.
  Suite completa posterior al ajuste: **6.547/6.547, 540 archivos, 244,76 s**, exit 0,
  con `pnpm test --maxWorkers=4`, sin tests omitidos. Incluye los 79 casos finales.
- Node --check, ESLint, docs, numeración (362 specs/421 migraciones), gobernanza 28
  y componentes 5 aprobados. Las excepciones históricas de numeración no se alteran.
- Revisión independiente aprobada sin Required de código. Se incorporó su
  recomendación de rechazar grafts y se distingue la prueba con remove inyectado.

No sustituye al responsable que valida inactividad, ownership, GO y preservación.
No se repitió build Next, Deno, SQL ni navegador: el cambio sólo afecta al helper
Node y documentación; sus rutas se probaron con Git real local. No se presenta
la suite Vitest como validación de Auth, Cloud o producción.
No se usó el helper mutante contra los dos worktrees reales. Los fixtures propios
se retiraron con rutas y ownership comprobados; no hubo red alojada en las pruebas,
instalación real de pnpm, push del proyecto, integración, migraciones ni deploy.
Publicación/CI del SHA final y cualquier limpieza real siguen pendientes. Esta
spec permanece in-progress; el correctivo local no certifica el cierre del repo.

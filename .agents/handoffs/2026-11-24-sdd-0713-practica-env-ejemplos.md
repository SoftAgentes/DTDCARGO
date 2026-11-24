# SDD-0713 · Ejemplos inactivos de práctica personal

## OBJETIVO ORIGINAL

Documentar las ocho variables de runtime en las dos plantillas versionadas, sin habilitar práctica ni usar credenciales reales.

- Owner: `practica-env-ejemplos-0713`.
- Sesión: `orca_session_id:1e3098cc-2d90-496b-9b61-1cc086031a39`.
- Task: `task_9045599652b5`; dispatch: `ctx_3607cba6efe2`.
- Ruta: `C:/Users/AKX generator/Desktop/Developer/Orca/DTDCARGO/sdd-0713-practica-ejemplos-20261124`.
- Rama: `SoftAgentes/sdd-0713-practica-ejemplos-20261124`.
- Base inicial y origin/main comprobados: `519c6ae72eb62d7ca419444678eb5df8d283da31`.
- Árbol inicial limpio, guard OK y claim propio comprobado antes de editar.
- Director DTD coordina; aceptación y nomenclatura: `docs/specs/0713-modo-prueba-personal/fase-1.md`, contrastadas con `lib/studio/practica/config.ts`.
- Permiso: ambas plantillas y este handoff; commit local selectivo, sin push ni PR.

## COMPLETADO

Ambas plantillas incorporan las ocho asignaciones vacías, responsabilidades compartidas y exclusivas, condiciones de rechazo, aislamiento en staging y modo apagado por defecto. Distinguen las opciones operativas de Traefik y navegador con sus rutas. Solo se agregaron comentarios y asignaciones vacías; el contenido previo, incluido APP_ENV, permanece intacto. No se leyeron archivos de entorno reales.

## VALIDACIÓN

- PASÓ: comprobación estática con Python extrajo de config.ts ocho nombres únicos usados como `env.PRACTICA_*`; cada plantilla contiene exactamente una asignación vacía por nombre.
- PASÓ: comparación contra `git show HEAD:<plantilla>` confirmó contenido anterior intacto, normalizando únicamente CRLF/LF para comparar.
- PASÓ: `git diff --check` tras retirar una línea vacía final agregada.
- PASÓ: `node scripts/build-docs-index.mjs --check` (695 specs).
- PASÓ: `node scripts/check-numbering.mjs`; conserva avisos de colisiones históricas aplicadas, sin colisiones nuevas.
- PASÓ: `node scripts/build-governance-capsule.mjs --check` (29 políticas).
- PASÓ: `node scripts/check-pending-migration-symbols.mjs` (0 rojos, 0 amarillos).
- NO DISPONIBLE: pruebas Vitest de contrato de plantillas; este worktree no tiene node_modules. No se instalaron dependencias pesadas; la validación estática específica cubre nombres, unicidad, valores vacíos y preservación del contenido.
- NO APLICA: pnpm verify, build, pruebas de producto y migraciones: no hay cambios de producto, esquema ni comportamiento. Tampoco se modifica el cuerpo de una spec.

## COMMITS

Un commit local selectivo con las dos plantillas y este handoff; el SHA final se entrega por worker_done (evita referencia circular dentro del commit).

## PR / BRANCH

Rama indicada arriba. Sin push, PR, merge ni publicación; no forman parte del encargo.

## PENDIENTES DE ESTA TAREA

Ninguno de implementación documental. La limitación de Vitest queda explícita para el Director; habilitación nominal y revisión de #800 quedan bajo su registro privado.

## FUERA DE ALCANCE DETECTADO

Sin cambios ajenos incorporados. La plantilla operativa completa no debe copiarse al receptor aislado: la documentación remite a la lista explícita de fase 1.

## HANDOFF AL DIRECTOR

Impacto documental: las dos plantillas canónicas actualizadas; fase 1 y runtime usados solo como referencia. No hay conocimiento nuevo que requiera nota en dtd-cerebro dentro de este alcance. Claim se libera al terminar la escritura; conservar rama y worktree para integración por el Director.

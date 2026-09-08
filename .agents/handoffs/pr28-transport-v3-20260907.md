# Handoff pr28-transport-v3-20260907 — transporte loopback v3 para el runner local de PR #28

- Fecha: 2026-09-07.
- Owner / sesión: Worker A `claude-worker-a-transport-v3-20260907` (Claude Code), asignado por el Director `claude-director-desktop-20260907`.
- Worktree: `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\pr28-transport-v3-20260907`.
- Rama: `codex/pr28-transport-v3-20260907`, base `origin/main` = `74bb52ab9677f96908cc032a15f2364ab9d94716`. Guard y claim verificados al inicio y antes del commit.
- Objetivo: paquete v3 nuevo que permita a Supabase CLI 2.116.0 en Windows alcanzar por `127.0.0.1` los servicios que permanecen en la red Docker interna, sin egress general para los contenedores Supabase; código, pruebas, manifest, hashes y handoff. Sin runtime C ni Auth18.
- SDD: no asignada por el Director; trabajo de harness externo al producto (salida en `DTD-backups`), sin cambios de producto en el repo.
- Estado de tarea: lista-para-revision.
- Alcance de escritura: `…\local-supabase-auth-feasibility-20260906\clean-instance-runner-v3-transport-20260907\` (nuevo) y este handoff. No se tocó producto, `package.json`, lockfiles, migraciones, PR #28/#29, `main`, v2 ni recibos anteriores.
- Permisos: commits locales del handoff; sin push, PR, merge ni producción. Sin `supabase link`, tokens ni proyecto remoto.

## OBJETIVO ORIGINAL

Diseñar, implementar y validar el transporte v3 (relays loopback) para el runner local de PR #28, con pruebas obligatorias 1-9, contrato, manifest, hashes y handoff al Director, y propuesta de comando para runtime C (`dtd-pr28-auth-clean-20260907-c`, raíz `runtime-clean-start-20260907-c`, contrato cliente `local-pr28-02b5674f` con API `127.0.0.1:55431` y Next `127.0.0.1:3743`).

## COMPLETADO

- Salida: `C:\Users\AKX generator\Desktop\Developer\DTD-backups\pr28-e2e-harness-validation-20260906\local-supabase-auth-feasibility-20260906\clean-instance-runner-v3-transport-20260907\` (no existía; sin sufijo adicional). Manifest `runner-manifest-v3.json`: canónico `ad6226887a8ee73a0c2ecac232170f9b05652fa60ea99e4aa212b817cd9e09d1` (mismo esquema que v2), archivo `d0856b5df3d0d96636f30992380aa95959c22ca1f029bfa8885ee96152de3f12`, 51 archivos, 797.198 bytes.
- Entradas verificadas: manifest v2 `c6f49e8b…` y canónico `e9faa77f…` (coinciden), probe `72daff49…` (coincide), closure B `6f66957c…` (coincide), `supabase-start-failure.json` de B `5f79a6b5…` (sin esperado; registrado). Binario CLI `5ccda938…` = 2.116.0.
- Diseño: contenedores Supabase solo en la red interna; tres relays (db/api/mail) con segunda interfaz en una bridge propia `dtd-loopback_<proyecto>` (host_binding 127.0.0.1, sin NAT de salida, sin ICC) que publican únicamente `127.0.0.1:P`; relay = `node -e` en imagen local fijada por digest, rootfs solo lectura, cap-drop ALL, uid 1000, `ip_forward=0`, un socket, un destino fijo por rol, filtro CIDR de origen; labels de ownership `dtd.transport.*`; preflight fail-closed; teardown idempotente por ID+labels; error original preservado más error de cleanup; SIGINT/SIGTERM.
- Orden real del CLI 2.116.0 descubierto en su código público (`apps/cli/src/legacy/commands/start/start.handler.ts` y shared, tag v2.116.0, commit `997a1e69…`): el host necesita `127.0.0.1:<db.port>` en `db-fresh-setup-host-dial` (retry 1 s × 10, timeout 2 s) y `127.0.0.1:<api.port>` en `health-wait` (HEAD `/rest-admin/v1/ready` vía Kong, 30 s). Modelo con citas en `supabase-cli-sequence-v3.cjs`; hashes de los archivos leídos en `cli-source-evidence-v3.json`.
- Entregables: `README.md`, `runner-contract-v3.json`, `runner-manifest-v3.json`, implementación y tests, `result.json`, `docker-before.json`, `docker-after.json`, `handoff.md` (con comando propuesto para runtime C), `patch-proposal/` (script reproducible + diff + verificación) para derivar el ejecutor de runtime C desde v2.

## VALIDACIÓN

- Unitarias (`node --test-reporter=tap`, alcance: módulos v3 en la salida): identidad 3/3, secuencia 3/3, relay 5/5 (+1 skip solo Windows: doble bind no exclusivo), transporte 13/13, adaptador 7/7 → PASÓ.
- Docker focal (`node focal-docker-tests-v3.cjs`, identidad `dtd-pr28-transport-focal-20260907-1`, puertos 55461/55462/55464): 14/14 PASÓ (pruebas 2, 3, 4, 5, 6, 7 y 8 del encargo). Recibo `focal-results/focal-result.json`.
- Prueba 9 (adaptador con dobles deterministas): 7/7 PASÓ. Prueba 9b (`supabase start` 2.116.0 real, identidad `dtd-pr28-transport-probe-20260907-1`, puertos 55451/55452/55454, sin SQL/replay/seed/Auth18): 11/11 PASÓ; exit 0 en 48,8 s; 7 contenedores healthy solo en red interna sin puertos publicados; relays apuntando a IDs nuevos; `/auth/v1/health` 200 por el relay; cleanup completo. Recibo `probe-results/probe-result.json`.
- `node run-all-tests-v3.cjs` → `result.json` veredicto PASÓ (10 checks). Inventario global igual antes/después (31 contenedores, 7 en ejecución, 4 redes, 37 volúmenes, 9 imágenes) y plataforma `dtd-pr28-auth-02b5674f-20260906` idéntica; no se detuvo, consultó ni adoptó.
- Patch runtime C aplicado en scratch sobre copia intacta de v2: 40 archivos con sintaxis válida, `--check` de identidad con `runtimeBRejected`, 10 suites v2 derivadas PASÓ, 5 suites v3 PASÓ (`patch-proposal/verification.json`).
- `node build-manifest-v3.cjs --verify`: canónico coincide, 0 desajustes, 0 archivos fuera del manifest.
- `pnpm verify`: NO EJECUTADO (no aplica: sin cambios de producto; solo handoff en el repo). `git diff --check` sobre el handoff: ejecutado antes del commit.
- Runtime C y Auth18: NO EJECUTADO por diseño del encargo.

## COMMITS

- Commit que contiene este documento (`chore(harness): handoff pr28-transport-v3-20260907 …`), único commit de la rama sobre `74bb52ab`.

## PR / BRANCH

- Sin PR (no autorizada). Rama local `codex/pr28-transport-v3-20260907`, worktree arriba, sin respaldo remoto.

## PENDIENTES DE ESTA TAREA

Ninguno dentro del alcance autorizado.

## FUERA DE ALCANCE DETECTADO

- v2 conserva la limitación EEXIST descrita por la revisión del Director; el patch no la modifica.
- `supabase.exe` 2.116.0 hace una consulta HTTP saliente desde el host (aviso de versión nueva) durante `start`.
- Dos intentos corregidos durante el trabajo, conservados como evidencia: `focal-results-attempt1-lookup-bug/` (relay con `ERR_INVALID_IP_ADDRESS` al resolver por nombre en Node 24; corregido con `family: 4` y test por nombre) y `probe-results-attempt1-aux-expectation/` (expectativa auxiliar errónea sobre `/rest/v1/` sin apikey).
- El conteo de volúmenes del host (37) difiere del inventario del Director a las 22:47 UTC (35); la diferencia es previa a este trabajo y no fue creada por él.

## HANDOFF AL DIRECTOR

- Siguiente acción: revisión independiente del paquete v3 (`README.md`, `handoff.md`, `result.json`, recibos) y del `patch-proposal/`; luego decidir runtime C con el comando propuesto en `handoff.md` del paquete.
- Dependencias: ninguna en el repo. Cambios compartidos: ninguno (solo este handoff).
- Integración/publicación: no solicitadas; sin push.
- Sesiones consumidoras: ninguna conocida.
- Ownership: claim liberado al terminar (`node scripts/harness-worktree.mjs release --owner claude-worker-a-transport-v3-20260907`). No se eliminó worktree ni rama.
- Inventario Docker con IDs propios eliminados: focal y probe cerraron con inventario por label vacío; residuo final cero en labels `dtd.transport.run`, `dtd.transport.fixture`, decoy y humo, y en `com.supabase.cli.project=dtd-pr28-transport-probe-20260907-1` (contenedores, volúmenes, redes).
- Veredicto del Worker: LISTO_PARA_REVISION_DIRECTOR.

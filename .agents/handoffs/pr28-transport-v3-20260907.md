# Handoff pr28-transport-v3-20260907 — transporte loopback v3 para el runner de PR #28

- Fecha: 2026-09-08 (ronda 3). Ronda 2: 2026-09-08 y ronda 1: 2026-09-07 (históricos al final de este documento).
- Owner / sesión: ronda 3 Worker A3 `claude-worker-a3-transport-v3-20260907` (Claude Code), asignado por el Director `claude-director-desktop-20260907`. Ronda 2: Worker A2 `claude-worker-a2-transport-v3-20260907`. Ronda 1: Worker A `claude-worker-a-transport-v3-20260907`.
- Worktree: `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\pr28-transport-v3-20260907`. Rama: `codex/pr28-transport-v3-20260907`, base `origin/main` = `74bb52ab9677f96908cc032a15f2364ab9d94716`; HEAD al inicio `17900a48`, árbol limpio. Guard y claim verificados al inicio y antes del commit.
- Objetivo (ronda 3): tras la primera corrida real completa del ejecutor (runtime C: transporte v3 y `supabase start` PASÓ; replay FALLÓ con `CONTRACT_REJECTED` sin recibo), verificar empíricamente la causa raíz sobre una copia del volumen db de C, corregirla en el patch (sonda ACL normalizada con expectativa correcta, recibo `replay-failure.json`, volúmenes en el cierre, `--suffix`), cubrirla con tests derivados fieles a psql, y entregar docs, contrato, `result.json` y manifest v3 nuevo (`round: 3`).
- SDD: no asignada por el Director; trabajo de harness externo al producto (salida en `DTD-backups`), sin cambios de producto en el repo.
- Estado de tarea: lista-para-revision (ronda 3).
- Alcance de escritura: `…\local-supabase-auth-feasibility-20260906\clean-instance-runner-v3-transport-20260907\` y este handoff. No se tocó producto, `package.json`, lockfiles, migraciones, PR #28/#29, `main`, v2, runtimes A/B/C (solo lectura), el paquete C derivado (solo lectura), la plataforma `dtd-pr28-auth-02b5674f-20260906` ni los volúmenes `-c` originales (solo montados `:ro` para copiar).
- Permisos: commits locales del handoff; sin push, PR, merge ni producción. Sin pulls de imágenes, sin `supabase link`, tokens ni proyecto remoto.

## OBJETIVO ORIGINAL

1. Verificación empírica sobre copia del volumen C: reproducir `aclProbe()` tal cual, aplicar compat + 0268 en una transacción, registrar el ACL real posterior y decidir la expectativa; buscar en los recibos históricos cómo registraron `before/after`; continuar 0269→0448 con las reglas del ejecutor. 2. Corrección en el patch (sonda normalizada `t`/`f`, expectativa por evidencia en contrato/runner/adaptador/tests con dobles reales, `replay-failure.json` create-only referenciado por `closure.json`, volúmenes por ID + label solo si nacieron tras el arranque). 3. `--suffix <letra>` (por defecto `c`) con rechazo de A, B y corridas anteriores; derivación `--suffix d` en scratch con 15 suites + `--check` ×2 y pins para el lanzador D. 4. README, `runner-contract-v3.json`, `handoff.md`, `result.json` honesto, manifest `round: 3`. 5. Límites: sin producto, PR, main, v2, runtimes, plataforma antigua ni volúmenes `-c`; sin pulls, producción, push/PR/merge; residuo cero.

## COMPLETADO

Salida: `…\clean-instance-runner-v3-transport-20260907\` (misma). Manifest v3 ronda 3 `runner-manifest-v3.json`: canónico `039b814ce221c29edada210eced352d5fe89b450ee4e19188804245732d792b4`, archivo `5bc88b4ef5fc06f5b9c9152cb0db7703f731276b00af56814404e8628c823083`, 122 archivos, 2.384.603 bytes. Ronda 2 preservada íntegra: `runner-manifest-v3-round2-20260907.json` (archivo `ede7a274…`, canónico `07e149c1…`), `run-all-round2-20260907/` (`result.json` `0bbaa057…`, `docker-before/after.json`) y `round2-20260907/` con `PRESERVED.json` (10 archivos modificados con hash verificado contra ese manifest y `round3Sha256`; `build-manifest-v3.cjs` retirado por no cambiar). Ronda 1 sigue preservada como antes.

1. **Verificación empírica (punto 1)** — `diagnostic-round3/volume-c-diagnostic-v3.cjs` (script), `diagnostic-round3/volume-c-replay-diagnostic.json` (sha256 `2c5c0b83e914980c44b1ba32208a41205e259cd013656953f06f4ef06f2bcca6`) y `.log`. Copia `dtd_a3_diag_db_c_copy` (label `dtd.worker.diag=a3`) desde `supabase_db_dtd-pr28-auth-clean-20260907-c` montado `:ro`; contenedor `dtd_a3_diag_pg_c` con `supabase/postgres:17.6.1.165` (`sha256:fc542c31…`, sin pull), `--network none`, sin puertos, etiquetado; psql como `postgres` con `ON_ERROR_STOP=1`; retirados por label al final. Resultados (07:19Z–07:20Z):
   - Estado inicial de la copia (coincide con el diagnóstico del Director): 219 tablas `public`, 249 funciones, `auth.users` = 1, `cron.launch_active_jobs = off`, ledger 0 filas, `newsletter_campaigns` presente, `client_profile_edits` ausente, FK `entity_audit_log_tenant_id_fkey` `confdeltype = c`.
   - **Salida real de la sonda** verbatim de v2 (`SELECT has_table_privilege(...) || ',' || …`): **`true,true,true`** (`volume-c-replay-diagnostic.json` → `aclProbe.verbatimOutput`), no `t,t,t`; normalizada (`CASE WHEN … THEN 't' ELSE 'f' END`): `t,t,t`. Confirma el diagnóstico del Director: el bucle abortó en `preflight ACL 0268` (índice 262/399, orden 263) por formato, no por hash ni por estado.
   - `tooling/tenant-acl-compatibility-v1.sql` (sha `f76cbc54…`) + `source/supabase/migrations/0268_tenant_lifecycle_guardrails.sql` (sha `c7102c97…`) en `BEGIN … COMMIT`: **PASÓ** (533 ms). **Estado ACL tras 0268**: verbatim `false,false,false`; normalizada **`f,f,f`**; detalle tipado `anonDelete=false, authenticatedDelete=false, serviceRoleDelete=false, serviceRoleSelect/Insert/Update=true`; FK en `r`. La expectativa heredada `after = 'f,f,t'` es incorrecta (0268 línea 89 `revoke delete on table public.tenants from service_role`, postcondición línea 106); la correcta es `f,f,f`.
   - Recibos históricos citados: `runtime/receipts/replay-attempts/replay-v27-20a/replay-263.json` (`tenantAclCompatibility.before` con los tres `Delete: true`; `after` con los tres `Delete: false` y `serviceRoleSelect/Insert/Update: true`, `json_build_object` tipado, ver `p20-replay-recovery-v27-20260907/run-local-auth-p20-replay-recovery-v27.cjs:767-807`); `replay-v25-20a/replay-result.json` (FALLÓ en 0268, exit 3, por el ACL del corte); `director-v25-replay-review.md`, `director-v27-replay-review.md` ("REAL PASÓ 381"). Ningún replay histórico registró `f,f,t`.
   - **0269→0448** con las reglas del ejecutor (hash vs plan `4f417475…`, 18 ledger-only omitidas, `BEGIN/COMMIT` por archivo, `ON_ERROR_STOP=1`): **118/118 PASÓ, 0 FALLÓ**; estado final 256 tablas, 389 funciones, `client_profile_edits` presente, ledger 0. Readiness REST: NO EJECUTADO (sin Kong/PostgREST). Sin seed, Next ni Auth18. Las cadenas SQL finales del paquete derivado se validaron además contra el mismo contenedor tras 0268 (`f,f,f`, JSON tipado; la sonda v2 real → `false,false,false`, rechazada por `checkAclProbe`).
2. **Corrección en el patch (punto 2)** — `patch-proposal/apply-runtime-c-patch-v3.cjs` (sha256 `1b9b4e1222f977cc308e8830b842b6f4bbbdbe1df4a97ab13b6981d99c1dec9c`), sobre copia íntegra de v2 (v2 intacto):
   - Ejecutor: `ACL_PROBE_SQL` (CASE `t`/`f`), `ACL_DETAILS_SQL` (JSON tipado como v27), `ACL_EXPECTED = runner.REPLAY_ACL_EXPECTED`, `checkAclProbe(phase, observed)` (rechaza `true,true,true` como formato y `f,f,t` como valor, con `error.details { step, observed, expected }`); `executeReplay` reemplazado completo (`replayPipeline` + `progress { step, migration { index, order, path, sha256 }, applied, acl }`); recibo `receipts/replay-clean-start-20260907-<s>/replay-failure.json` create-only vía `failureReceiptFor` + `attemptFailureReceiptWrite` antes de propagar (`error.receipt.failureReceipt`), con `state.replayFailure` → `closure.json { replayFailureReceipt, pipelineFailure }`; `state.runStartedAtMs` justo antes de `supabase start`; cierre con volúmenes (`docker volume ls -q --filter label=com.supabase.cli.project=<id>`, retiro solo de `supabase_db_<id>`/`supabase_storage_<id>` con label exacto y `CreatedAt >= inicio` al segundo; resto `ownership-mismatch` → `cleanupComplete=false`; `volumesRemoved`, `finalInventory.volumes`); `tools.httpClient` inyectable; exports nuevos.
   - Runner: `REPLAY_ACL_EXPECTED = { before: 't,t,t', after: 'f,f,f' }`, `replayAclEvidenceValid` (detalle tipado antes/después), `validateReplayReceipt` la usa, `validateClosureReceipt` exige `volumesRemoved`.
   - Adaptador: `compatibility.acl0268` y `diagnosticReceipt: 'replay-failure.json'` en la spec `replay`; `volumes` en la spec `closure`. Contrato y manifest derivados: `round: 3`, `replay.aclProbe`, `replay.failureReceipt`, `diagnosticFailureReceipts.replay`, `closureVolumes`, `closureOrder` con `cli-volumes`, `httpClientInjection`.
   - Tests derivados: ejecutor (fuente + `checkAclProbe` con renderizaciones reales), runner (fixture `f,f,f` + adversarios `f,f,t`, `true,true,true`, `false,false,false`, detalle inconsistente, `volumesRemoved` ausente) y nuevo `patch-proposal/derived-tests/clean-runtime-executor-replay-v3.test.cjs` (sha `985030b8…`): pipeline clean-start → replay → closure con dobles de Docker/transporte/proceso/HTTP y doble psql que reproduce la salida real (`true,true,true`/`false,false,false`, `t,t,t`/`f,f,f`, JSON tipado) y revoca donde lo hace el SQL; escenarios: éxito (381, compat + 0268 en un `BEGIN/COMMIT`, ledger-only omitidas, `volumesRemoved` ×2 en orden contenedores → volúmenes → red), fallo psql exit 3 en 0300 (`replay-failure.json` con paso `apply`, índice/orden/ruta/sha256, `schema-or-migration-failed`, sin stderr crudo; volumen preexistente conservado → `CLEANUP_FAILED`), postcondición ACL sin efecto (`CONTRACT_REJECTED` en `postcondition-acl-0268`, `details { observed: 't,t,t', expected: 'f,f,f' }`, cierre completo que referencia el fallo).
3. **`--suffix` (punto 3)** — `runtimeIdentity(suffix)` (`[c-z]`, previas = letras anteriores): deriva proyecto, redes, raíz, fases, relays, `dtd.transport.run`, versiones; identidad v1 `RUNTIME_PREVIOUS_PROJECTS/ROOTS` (+ `--check` imprime `runtime<L>Rejected` por cada una y `suffix=<s>`), runner `RUNTIME_PREVIOUS_MARKERS`, copia de identidad v3 con `OLD_*` extendidos y `RUNTIME_SUFFIX`/`RUNTIME_IDENTITY`. Verificado en scratch (`patch-proposal/verification.json`, sha `ac5d6da876d10c7ba73445494915593bda5a69e96fd2b2abe857adc3edfe2afa`): `--suffix c` y `--suffix d`, cada uno con sintaxis 31 archivos, **11 suites derivadas + 5 suites v3 = 16 suites PASÓ** (una más que las 15 pedidas: el test de replay nuevo), `--check` identidad v1 (`…|runtimeARejected|runtimeBRejected|…|suffix=c`; `…|runtimeCRejected|…|suffix=d`), `--check` identidad v3 (3/4 identidades históricas rechazadas) y `--check` inerte del ejecutor. **Pins para el lanzador D:** manifest archivo `3a545851448d039abc5fd17e5bebebca704bb262289966e0028dad0dfcfd0a05`, canónico `d83c062c4063b87d40f95ae278f555bcd277a403109c0a4a76d5ad45ab5dfb91` (40 archivos). Paquete C rederivado con el patch nuevo: archivo `ee2d5bc9a335ad32981c536ec3685af1d5f8d55941ab5678ea65f55280b2bb7d`, canónico `fa174f9473b7a0f9bcd5d9143ef48fd6e9d8ea4ed7b53df69b5950f7a71d5d74`.
4. **Docs y manifest (punto 4)** — `README.md` (sección «Qué cambió en la ronda 3», componentes, resultados rondas 2 y 3, cómo ejecutar con `--suffix` y el diagnóstico, integración en runtime D), `runner-contract-v3.json` (`round: 3`, `round3 { trigger, rootCause, fix, verification, directorCapture, notExecuted }`, `closureOrder`, `runtimeCHooks`, `tests`), `handoff.md` (causa raíz, corrección, comandos, comando y pins para D, nota obligatoria: `director-cli-capture.cjs:22` debe conservar `failureReceiptPath` y `diagnostic`), `patch-proposal/README.md`, `run-all-tests-v3.cjs` (`round: 3`, checks 10 y 11), `result.json` (sha `ce2ed22067a72ff1a88452257f338b7eccf2568d7ce015795a2b1fc8b24a7071`, 13 checks PASÓ, focal/probe/egress leídos de la ronda 2 porque el transporte no cambió), `runtime-c.diff` (sha `453859c4…`), `runtime-c.diffstat.txt`, `files-added.txt` (12), manifest `round: 3` con hash canónico nuevo.
5. **Límites (punto 5)** — cumplidos: sin producto, PR #28/#29, main, v2, runtimes A/B/C (solo lectura), plataforma antigua ni volúmenes `-c` originales (solo `:ro`); sin pulls, producción, push/PR/merge; focal/probe Docker no repetidos (transporte igual); cada llamada Bash < 10 min (diagnóstico en segundo plano con log); inventario Docker igual antes/después; residuo cero.

## VALIDACIÓN

- Diagnóstico sobre copia del volumen C (`node diagnostic-round3/volume-c-diagnostic-v3.cjs --run` / `--cleanup`, 07:19:07Z–07:20:35Z, cleanup 07:48:49Z): sonda v2 `true,true,true` PASÓ (reproducción del fallo); compat + 0268 PASÓ; ACL posterior `f,f,f` PASÓ; 0269→0448 118/118 PASÓ, 18 omitidas, 0 FALLÓ; readiness REST NO EJECUTADO (sin Kong/PostgREST en el diagnóstico); seed/Next/Auth18 NO EJECUTADO por diseño; cleanup por label PASÓ (contenedor y volumen copia retirados; originales `-c` intactos).
- Patch en scratch (`verify-patch-r3.cjs`, copias íntegras de v2): `--suffix c` PASÓ y `--suffix d` PASÓ; por sufijo: `node --check` 31/31, suites derivadas 11/11 PASÓ, suites v3 5/5 PASÓ (41 casos, 40 pass, 1 skip solo Windows), `clean-start-identity-v1.cjs --check` PASÓ, `clean-start-identity-v3.cjs --check` PASÓ, `clean-runtime-executor-v1.cjs --check` PASÓ (inerte); manifest derivado canónico coincide con el declarado (c y d).
- Unitarias v3 en el paquete (`node --test-reporter=tap`, vía `run-all-tests-v3.cjs`): identidad 4/4, secuencia 3/3, relay 9/9 (+1 skip), transporte 17/17, adaptador 7/7 → 40 PASÓ, 0 FALLÓ.
- `node run-all-tests-v3.cjs` (ronda 3) → `result.json` veredicto PASÓ, 13 checks (1, 2, 3, 3b, 4, 5, 6, 7, 8, 9, 9b, 10, 11); focal, probe y egress: PASÓ leídos de los recibos de la ronda 2 (no repetidos: transporte sin cambios). Inventario global igual antes/después (31 contenedores, 7 en ejecución, 4 redes, 39 volúmenes, 9 imágenes); plataforma antigua idéntica (31/1/2).
- `node build-manifest-v3.cjs --build --extra … --force` y `--verify`: canónico coincide, 0 desajustes, 0 archivos fuera del manifest (122).
- `pnpm verify`: NO EJECUTADO (no aplica: sin cambios de producto; solo este handoff en el repo). `git diff --check` sobre el handoff: ejecutado antes del commit.
- Runtime D y Auth18: NO EJECUTADO por diseño del encargo.

## COMMITS

- `af4fe0b3` (ronda 1) y `17900a48` (ronda 2): handoffs anteriores.
- Commit que contiene este documento (`chore(harness): handoff pr28-transport-v3-20260907 ronda 3 …`), tercer commit de la rama sobre `74bb52ab`.

## PR / BRANCH

- Sin PR (no autorizada). Rama local `codex/pr28-transport-v3-20260907`, worktree arriba, sin respaldo remoto.

## PENDIENTES DE ESTA TAREA

Ninguno dentro del alcance autorizado.

## FUERA DE ALCANCE DETECTADO

- `runtime-clean-start-20260907-c/director-cli-capture.cjs:22` (del Director) conserva solo `version/status/stageOrder/sourceHead/projectId/errorCategory` del stderr del ejecutor y descarta `failureReceiptPath` y `diagnostic` (saneados por el ejecutor); en C fueron `null` porque `fail()` no adjuntaba recibo, pero con `replay-failure.json` dejan de serlo: la captura D debe ampliarse.
- Los volúmenes `supabase_db_/supabase_storage_dtd-pr28-auth-clean-20260907-c` sobrevivieron al cierre de C (v2 nunca los inventariaba); se conservan como evidencia; retirarlos es decisión del Director.
- `director-launch-c.cjs` pinea el paquete C `d4797572…`/`2931e99c…` y los insumos v3 de la ronda 2; para D hay que derivar `director-launch-d.cjs` con los pins de esta ronda.
- v2 conserva la limitación EEXIST descrita por la revisión del Director; el patch no la modifica.
- Memoria libre del host durante esta ronda ~2 GiB (el lanzador exige 4 GiB para D). `supabase.exe` consulta versión por HTTP desde el host.

## HANDOFF AL DIRECTOR

- Siguiente acción: revisión independiente del paquete v3 ronda 3 (`README.md`, `handoff.md`, `runner-contract-v3.json`, `result.json`, `diagnostic-round3/`, `patch-proposal/` con `verification.json`, `runtime-c.diff` y `derived-tests/`); derivar el paquete D con `node <v3>/patch-proposal/apply-runtime-c-patch-v3.cjs --target <copia íntegra de v2> --v3 <v3> --suffix d` y comprobar los pins esperados (manifest D archivo `3a545851448d039abc5fd17e5bebebca704bb262289966e0028dad0dfcfd0a05`, canónico `d83c062c4063b87d40f95ae278f555bcd277a403109c0a4a76d5ad45ab5dfb91`, 40 archivos; `clean-start-identity-v1.cjs --check` → `…|runtimeARejected|runtimeBRejected|runtimeCRejected|…|suffix=d`); derivar `director-launch-d.cjs` con esos pins, `--run clean-start-20260907-d`, raíz `runtime-clean-start-20260907-d`, insumos v3 repineados (`runner-manifest-v3.json` archivo `5bc88b4ef5fc06f5b9c9152cb0db7703f731276b00af56814404e8628c823083`, `result.json` `ce2ed22067a72ff1a88452257f338b7eccf2568d7ce015795a2b1fc8b24a7071`, `patch-proposal/verification.json` `ac5d6da876d10c7ba73445494915593bda5a69e96fd2b2abe857adc3edfe2afa`) y ampliar la allowlist de `director-cli-capture` a `failureReceiptPath`, `diagnostic` y `rawOutputPersisted`.
- Hashes del manifest v3 ronda 3: canónico `039b814ce221c29edada210eced352d5fe89b450ee4e19188804245732d792b4`, archivo `5bc88b4ef5fc06f5b9c9152cb0db7703f731276b00af56814404e8628c823083` (esquema canónico idéntico al de v2/rondas anteriores). Patch `1b9b4e1222f977cc308e8830b842b6f4bbbdbe1df4a97ab13b6981d99c1dec9c`; diff `453859c4ea974e1f36ba92360ea5aa1104dcf9274512e8b6f91169b0f5c2a53a`; test derivado `985030b8836badf7a6c678017046e4b3ee012e28760547d883f26d858cb0fe92`; diagnóstico `2c5c0b83e914980c44b1ba32208a41205e259cd013656953f06f4ef06f2bcca6`.
- Inventario Docker (metadata) antes/después: 31/7/4/39/9 iguales (los 39 volúmenes incluyen los dos `-c` conservados); plataforma antigua idéntica; recursos propios (`dtd_a3_diag_pg_c`, `dtd_a3_diag_db_c_copy`, label `dtd.worker.diag=a3`) retirados; al cierre 0 recursos `a3`, 0 contenedores `dtd.transport.version=v3`, 0 redes `dtd-loopback*`; no se creó ningún relay, red ni contenedor CLI; puertos 55431/55432/55434/3743 no usados.
- Dependencias: ninguna en el repo. Cambios compartidos: ninguno (solo este handoff).
- Integración/publicación: no solicitadas; sin push.
- Sesiones consumidoras: ninguna conocida.
- Ownership: claim liberado al terminar (`node scripts/harness-worktree.mjs release --owner claude-worker-a3-transport-v3-20260907`). No se eliminó worktree ni rama.
- Veredicto del Worker: LISTO_PARA_REVISION_DIRECTOR.

## Histórico — ronda 2 (2026-09-08, Worker A2, commit 17900a48)

- Owner / sesión: Worker A2 `claude-worker-a2-transport-v3-20260907` (Claude Code, intento 2; el intento 1 del mismo owner murió por un error de red de la API a las ~00:50Z tras dejar el experimento de egress y los cambios de `relay-process-v3.*`), asignado por el Director `claude-director-desktop-20260907`.
- Objetivo (ronda 2): aplicar las correcciones del Reviewer A (`CHANGES_REQUESTED`, `runtime-clean-start-20260907-c/director-review-round1.json`) sobre el paquete v3 de transporte, en la misma salida, con evidencia nueva y manifest v3 nuevo (`round: 2`), sin runtime C ni Auth18.
- Alcance de escritura: `…\clean-instance-runner-v3-transport-20260907\` y este handoff. No se tocó producto, `package.json`, lockfiles, migraciones, PR #28/#29, `main`, v2, runtimes A/B/C, `director-tcp-probe-20260907`, el paquete C `-attempt1-superseded` ni la plataforma `dtd-pr28-auth-02b5674f-20260906`.

### OBJETIVO ORIGINAL

Resolver los nueve hallazgos del Reviewer A sobre el paquete v3 (egress del relay no demostrado, preflight ausente en el ejecutor C derivado, test DNS intermitente, listener en `0.0.0.0`, `targetPublishedPorts` no exigido, evidencia CLI con SHA vacío, focal sin identidad/puertos parametrizables, pins del paquete C, consulta de versión del CLI), reejecutar toda la evidencia (unitarias, focal, probe real si cambia la topología, patch en scratch, `run-all`, manifest) y entregar `result.json` honesto con handoff para decidir runtime C.

### COMPLETADO

Salida: `…\clean-instance-runner-v3-transport-20260907\` (misma). Manifest v3 ronda 2 `runner-manifest-v3.json`: canónico `07e149c10b715da9a54b4e46cdd3532e9b7b78474ae7c0c90239adb0f453f544`, archivo `ede7a27456a9600db1009904e1611ae39d3daab69e363cc4c95fddac77c3c159`, 103 archivos, 1.813.329 bytes. Ronda 1 preservada íntegra (`runner-manifest-v3-round1-20260907.json` archivo `d0856b5d…`/canónico `ad622688…`, `focal-results-round1-20260907/`, `probe-results-round1-20260907/`, `run-all-round1-20260907/`, `round1-20260907/` con 20 fuentes/documentos y `PRESERVED.json` verificado contra ese manifest).

1. ALTA — egress del relay. Con el experimento del intento 1 (`egress-experiment/`, seis modos en Docker Desktop 29.7.2): `nat` y `routed` publican pero completan el handshake hacia `1.1.1.1:443` vía forwarder; `isolated` exige `--internal` (no publica); `inhibit_ipv4` no publica; único viable `nat-route-strip`. Adoptado en `loopback-relay-transport-v3.cjs`: sidecar one-shot por relay (misma imagen por digest, `--network container:<relay>`, `cap-drop ALL` + `NET_ADMIN`, uid 0, `ip route del default`, exit 0, retirado por ID + labels, rol `routestrip-<rol>`) y lectura/verificación del netns (`RELAY_EGRESS_STRIP_FAILED`, `RELAY_EGRESS_NOT_STRIPPED`); teardown retira sidecars sobrevivientes. T3b endurecida en `focal-docker-tests-v3.cjs`: `connected === false` con `ENETUNREACH|EHOSTUNREACH` desde los tres relays hacia cuatro destinos, netns sin ruta por defecto; nueva T2e con el recibo de cada sidecar. README, contrato (`topology.relayEgress`) y `result.json` (checks 2, 3 y nuevo 3b) reflejan el resultado real: egress del relay ausente y demostrado; riesgo residual documentado (NET_ADMIN transitorio ~170 ms sobre el netns del relay). Probe real repetido con identidad nueva `dtd-pr28-transport-probe-20260907-2` (55471/55472/55474, shadow 55470): `supabase start` exit 0 en 48,8 s.
2. MEDIA — preflight del ejecutor C. `patch-proposal/apply-runtime-c-patch-v3.cjs` inserta `await transportHooks.preflight({ receiptsDir })` antes de `docker network create` de la red interna con recibo create-only `receipts/<clean-start>/transport/transport-preflight.json` y `transport-preflight-failure.json` en fallo; `clean-start.json` incluye `transportPreflight`; `validateTransportProof` exige `egress` por relay; test derivado afirma `preflight → beforeSupabaseStart → afterSupabaseStart → closure` (cierre incluido, con `transportClosure`) y el recibo. Regenerados `runtime-c.diff` (sha `adb24357…`), `runtime-c.diffstat.txt`, `files-added.txt`, `verification.json` (sha `62e0b159…`) aplicando el patch (sha `326494d4…`) en scratch sobre copia íntegra de v2: 10 suites v2 derivadas + 5 v3 (41 casos, 1 skip) + `--check` identidad (`runtimeBRejected`) + `--check` ejecutor PASÓ; manifest C derivado archivo `d4797572…`, canónico `2931e99c…`, 39 archivos.
3. BAJA — test DNS. `relay-process-v3.test.cjs`: inalcanzable con `192.0.2.1` y timeout 1,5 s; `.invalid` con presupuesto 2 s < vida del cliente 3 s. Causa raíz hallada: el relay no emitía nada si el cliente cerraba antes de resolver; `relay-process-v3.js` emite ahora `client-gone` (test nuevo). Además, el arnés tenía sockets eco sin manejador de `error` (ECONNRESET tardío tumbaba el caso 7 de forma intermitente); corregido sin debilitar aserciones; 6/6 reejecuciones estables.
4. BAJA — listener. `relay-process-v3.js` se enlaza a la interfaz dentro de `RELAY_ACCEPT_CIDR` (nunca `0.0.0.0`); el transporte no pasa `RELAY_LISTEN_HOST` y verifica en el netns (`RELAY_LISTEN_ADDRESS_MISMATCH`); T4 decodifica `/proc/net/tcp` y compara con la IP loopback del relay; T3 muestra `ECONNREFUSED` desde la red interna; T2 sigue pasando.
5. BAJA — `verifyRelayTarget` exige `targetPublishedPortsEmpty` (fail-closed `TARGET_VERIFY_FAILED`); test unitario nuevo; el runner C también lo exige.
6. INFORMATIVA — `cli-source-evidence-v3.json`: tres rutas Go con `absentInTag: true` y `sha256: null`.
7. INFORMATIVA — `--identity-suffix`/`--port-base` en focal y probe (`buildFocalIdentity`/`buildProbeIdentity`; base 55430 rechazada); documentado en README; ronda 2 usó focal `-2` 55481/55482/55484 y probe `-2` 55470-55474. El probe además resuelve `--out`, `--supabase` y `--config-template` a rutas absolutas (dos intentos fallidos por rutas relativas preservados como evidencia: `probe-results-round2-attempt1-spawn-enoent-20260907/`, `probe-results-round2-attempt2-relative-workdir-20260907/`; transporte sano y cleanup completo en ambos).
8. INFORMATIVA — `handoff.md` del paquete fija que el lanzador de runtime C debe pinear el manifest del paquete C derivado (archivo `d4797572…`, canónico `2931e99c…`), válido solo mientras el patch no cambie, y repinear los insumos v3.
9. INFORMATIVA — README registra `cli-latest = v2.117.0` como tráfico HTTP de `supabase.exe` en el host.

### VALIDACIÓN

- Unitarias (`node --test-reporter=tap`, alcance: módulos v3 en la salida): identidad 4/4, secuencia 3/3, relay 9/9 (+1 skip solo Windows: doble bind), transporte 17/17, adaptador 7/7 → 40 PASÓ, 0 FALLÓ. Relay reejecutado 6 veces tras la corrección del arnés: 6/6.
- Docker focal ronda 2 (`focal-docker-tests-v3.cjs --identity-suffix 2 --port-base 55480`, 03:39:38Z-03:41:20Z): T5a, T0, T2a, T2e, T5b, T2b, T2c, T2d, T3, T3b, T4, T6, T6b, T7, T8 → 15 PASÓ (+META). Recibo `focal-results/focal-result.json`.
- Probe real ronda 2 (`supabase-start-probe-v3.cjs --identity-suffix 2 --port-base 55470`, 03:46:53Z-03:48:40Z): 11/11 PASÓ; exit 0 en 48,8 s; 7 contenedores healthy solo en red interna sin puertos publicados; relays con ruta por defecto retirada apuntando a IDs nuevos; auth/mailpit/rest 200 por los relays; cleanup completo. Recibo `probe-results/probe-result.json`.
- Experimento de egress (intento 1, 00:42Z-00:43Z): PASÓ; viable solo `nat-route-strip`; cleanup completo; plataforma antigua idéntica.
- Patch runtime C en scratch (copia íntegra de v2): PASÓ (`patch-proposal/verification.json`).
- `node run-all-tests-v3.cjs` (04:01Z) → `result.json` (sha `0bbaa057…`) veredicto PASÓ, 11 checks (1, 2, 3, 3b, 4, 5, 6, 7, 8, 9, 9b). Inventario global igual antes/después en todas las suites (31 contenedores, 7 en ejecución, 4 redes, 37 volúmenes, 9 imágenes); plataforma `dtd-pr28-auth-02b5674f-20260906` idéntica; residuo cero por labels y nombres (`*_routestrip` incluidos); puertos 55431/55432/55434/3743 libres al cierre.
- `node build-manifest-v3.cjs --build --extra … --force` y `--verify`: canónico coincide, 0 desajustes, 0 archivos fuera del manifest (103).
- `pnpm verify`: NO EJECUTADO (no aplica: sin cambios de producto; solo este handoff en el repo). `git diff --check` sobre el handoff: ejecutado antes del commit.
- Runtime C y Auth18: NO EJECUTADO por diseño del encargo.

### COMMITS

- `af4fe0b3` (ronda 1): handoff inicial.
- `17900a48` (`chore(harness): handoff pr28-transport-v3-20260907 ronda 2 …`), segundo commit de la rama sobre `74bb52ab`.

### PR / BRANCH

- Sin PR (no autorizada). Rama local `codex/pr28-transport-v3-20260907`, worktree arriba, sin respaldo remoto.

### PENDIENTES DE ESTA TAREA

Ninguno dentro del alcance autorizado.

### FUERA DE ALCANCE DETECTADO

- `runtime-clean-start-20260907-c/director-launch-c.cjs` (del Director) pineaba el paquete `-attempt1-superseded` (`e24a5154…`/`bfd68e64…`) y los insumos v3 de la ronda 1; fallaría por drift hasta repinear con la ronda 2 y el paquete C definitivo (el Director lo repineó antes de lanzar C).
- v2 conserva la limitación EEXIST descrita por la revisión del Director; el patch no la modifica.
- `supabase.exe` 2.116.0 consulta por HTTP desde el host si hay versión nueva (`cli-latest = v2.117.0`).
- El resolver DNS del host (VPN activa) tarda segundos en responder NXDOMAIN; afecta solo a tests de host.
- El README v2 del paquete C no se reescribe; decisión del Director.

### HANDOFF AL DIRECTOR

- Siguiente acción: revisión independiente (Reviewer A2) del paquete v3 ronda 2 (`README.md`, `handoff.md`, `runner-contract-v3.json`, `result.json`, `focal-results/`, `probe-results/`, `egress-experiment/`, `patch-proposal/`); decidir si acepta el privilegio transitorio `NET_ADMIN` del sidecar (única vía encontrada para egress nulo con publicación `127.0.0.1` en Docker Desktop); derivar el paquete C definitivo con el patch (esperado: manifest C archivo `d479757241c2631f6fc7168c2c1ef50f75e412b2db72cd27a238b5a02d8e4f03`, canónico `2931e99cd1a2f5e104f2f6fcffebef7b9a8eed50db31a04fefbdb8af5d9a1fd5`) y repinear `director-launch-c.cjs`: manifest C y insumos v3 (`runner-manifest-v3.json` archivo `ede7a27456a9600db1009904e1611ae39d3daab69e363cc4c95fddac77c3c159`, `result.json` `0bbaa057d25be3869cd388268a795659eccd3a86d1a0bc27ae71ce1c3c75d114`, `patch-proposal/verification.json` `62e0b15974bd67fdb4ebe3ef4cc43d5cc0efbe7d5d09f3a512259e5373fa9e5c`).
- Hashes del manifest v3 ronda 2: canónico `07e149c10b715da9a54b4e46cdd3532e9b7b78474ae7c0c90239adb0f453f544`, archivo `ede7a27456a9600db1009904e1611ae39d3daab69e363cc4c95fddac77c3c159` (esquema canónico idéntico al de v2/ronda 1).
- Inventario Docker (metadata) antes/después: 31/7/4/37/9 iguales en focal, probe (y sus dos intentos fallidos), experimento y run-all; plataforma antigua idéntica; al cierre 0 contenedores/redes con `dtd.transport.*`, 0 fixtures, 0 decoys, 0 recursos `com.supabase.cli.project` de las identidades `-2`, 0 nombres `*_routestrip`. Puertos usados: 55481/55482/55484 (focal), 55470-55474 (probe), 55491-55496 (experimento, intento 1); 55431/55432/55434/3743 libres.
- Dependencias: ninguna en el repo. Cambios compartidos: ninguno (solo este handoff).
- Integración/publicación: no solicitadas; sin push.
- Sesiones consumidoras: ninguna conocida.
- Ownership: claim liberado al terminar (`node scripts/harness-worktree.mjs release --owner claude-worker-a2-transport-v3-20260907`). No se eliminó worktree ni rama.
- Veredicto del Worker: LISTO_PARA_REVISION_DIRECTOR.

## Histórico — ronda 1 (2026-09-07, Worker A, commit af4fe0b3)

### Handoff pr28-transport-v3-20260907 — transporte loopback v3 para el runner local de PR #28

- Fecha: 2026-09-07.
- Owner / sesión: Worker A `claude-worker-a-transport-v3-20260907` (Claude Code), asignado por el Director `claude-director-desktop-20260907`.
- Worktree: `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\pr28-transport-v3-20260907`.
- Rama: `codex/pr28-transport-v3-20260907`, base `origin/main` = `74bb52ab9677f96908cc032a15f2364ab9d94716`. Guard y claim verificados al inicio y antes del commit.
- Objetivo: paquete v3 nuevo que permita a Supabase CLI 2.116.0 en Windows alcanzar por `127.0.0.1` los servicios que permanecen en la red Docker interna, sin egress general para los contenedores Supabase; código, pruebas, manifest, hashes y handoff. Sin runtime C ni Auth18.
- SDD: no asignada por el Director; trabajo de harness externo al producto (salida en `DTD-backups`), sin cambios de producto en el repo.
- Estado de tarea: lista-para-revision.
- Alcance de escritura: `…\local-supabase-auth-feasibility-20260906\clean-instance-runner-v3-transport-20260907\` (nuevo) y este handoff. No se tocó producto, `package.json`, lockfiles, migraciones, PR #28/#29, `main`, v2 ni recibos anteriores.
- Permisos: commits locales del handoff; sin push, PR, merge ni producción. Sin `supabase link`, tokens ni proyecto remoto.

### OBJETIVO ORIGINAL

Diseñar, implementar y validar el transporte v3 (relays loopback) para el runner local de PR #28, con pruebas obligatorias 1-9, contrato, manifest, hashes y handoff al Director, y propuesta de comando para runtime C (`dtd-pr28-auth-clean-20260907-c`, raíz `runtime-clean-start-20260907-c`, contrato cliente `local-pr28-02b5674f` con API `127.0.0.1:55431` y Next `127.0.0.1:3743`).

### COMPLETADO

- Salida: `C:\Users\AKX generator\Desktop\Developer\DTD-backups\pr28-e2e-harness-validation-20260906\local-supabase-auth-feasibility-20260906\clean-instance-runner-v3-transport-20260907\` (no existía; sin sufijo adicional). Manifest `runner-manifest-v3.json`: canónico `ad6226887a8ee73a0c2ecac232170f9b05652fa60ea99e4aa212b817cd9e09d1` (mismo esquema que v2), archivo `d0856b5df3d0d96636f30992380aa95959c22ca1f029bfa8885ee96152de3f12`, 51 archivos, 797.198 bytes.
- Entradas verificadas: manifest v2 `c6f49e8b…` y canónico `e9faa77f…` (coinciden), probe `72daff49…` (coincide), closure B `6f66957c…` (coincide), `supabase-start-failure.json` de B `5f79a6b5…` (sin esperado; registrado). Binario CLI `5ccda938…` = 2.116.0.
- Diseño: contenedores Supabase solo en la red interna; tres relays (db/api/mail) con segunda interfaz en una bridge propia `dtd-loopback_<proyecto>` (host_binding 127.0.0.1, sin NAT de salida, sin ICC) que publican únicamente `127.0.0.1:P`; relay = `node -e` en imagen local fijada por digest, rootfs solo lectura, cap-drop ALL, uid 1000, `ip_forward=0`, un socket, un destino fijo por rol, filtro CIDR de origen; labels de ownership `dtd.transport.*`; preflight fail-closed; teardown idempotente por ID+labels; error original preservado más error de cleanup; SIGINT/SIGTERM.
- Orden real del CLI 2.116.0 descubierto en su código público (`apps/cli/src/legacy/commands/start/start.handler.ts` y shared, tag v2.116.0, commit `997a1e69…`): el host necesita `127.0.0.1:<db.port>` en `db-fresh-setup-host-dial` (retry 1 s × 10, timeout 2 s) y `127.0.0.1:<api.port>` en `health-wait` (HEAD `/rest-admin/v1/ready` vía Kong, 30 s). Modelo con citas en `supabase-cli-sequence-v3.cjs`; hashes de los archivos leídos en `cli-source-evidence-v3.json`.
- Entregables: `README.md`, `runner-contract-v3.json`, `runner-manifest-v3.json`, implementación y tests, `result.json`, `docker-before.json`, `docker-after.json`, `handoff.md` (con comando propuesto para runtime C), `patch-proposal/` (script reproducible + diff + verificación) para derivar el ejecutor de runtime C desde v2.

### VALIDACIÓN

- Unitarias (`node --test-reporter=tap`, alcance: módulos v3 en la salida): identidad 3/3, secuencia 3/3, relay 5/5 (+1 skip solo Windows: doble bind no exclusivo), transporte 13/13, adaptador 7/7 → PASÓ.
- Docker focal (`node focal-docker-tests-v3.cjs`, identidad `dtd-pr28-transport-focal-20260907-1`, puertos 55461/55462/55464): 14/14 PASÓ (pruebas 2, 3, 4, 5, 6, 7 y 8 del encargo). Recibo `focal-results/focal-result.json`.
- Prueba 9 (adaptador con dobles deterministas): 7/7 PASÓ. Prueba 9b (`supabase start` 2.116.0 real, identidad `dtd-pr28-transport-probe-20260907-1`, puertos 55451/55452/55454, sin SQL/replay/seed/Auth18): 11/11 PASÓ; exit 0 en 48,8 s; 7 contenedores healthy solo en red interna sin puertos publicados; relays apuntando a IDs nuevos; `/auth/v1/health` 200 por el relay; cleanup completo. Recibo `probe-results/probe-result.json`.
- `node run-all-tests-v3.cjs` → `result.json` veredicto PASÓ (10 checks). Inventario global igual antes/después (31 contenedores, 7 en ejecución, 4 redes, 37 volúmenes, 9 imágenes) y plataforma `dtd-pr28-auth-02b5674f-20260906` idéntica; no se detuvo, consultó ni adoptó.
- Patch runtime C aplicado en scratch sobre copia intacta de v2: 40 archivos con sintaxis válida, `--check` de identidad con `runtimeBRejected`, 10 suites v2 derivadas PASÓ, 5 suites v3 PASÓ (`patch-proposal/verification.json`).
- `node build-manifest-v3.cjs --verify`: canónico coincide, 0 desajustes, 0 archivos fuera del manifest.
- `pnpm verify`: NO EJECUTADO (no aplica: sin cambios de producto; solo handoff en el repo). `git diff --check` sobre el handoff: ejecutado antes del commit.
- Runtime C y Auth18: NO EJECUTADO por diseño del encargo.

### COMMITS

- Commit que contiene este documento (`chore(harness): handoff pr28-transport-v3-20260907 …`), único commit de la rama sobre `74bb52ab`.

### PR / BRANCH

- Sin PR (no autorizada). Rama local `codex/pr28-transport-v3-20260907`, worktree arriba, sin respaldo remoto.

### PENDIENTES DE ESTA TAREA

Ninguno dentro del alcance autorizado.

### FUERA DE ALCANCE DETECTADO

- v2 conserva la limitación EEXIST descrita por la revisión del Director; el patch no la modifica.
- `supabase.exe` 2.116.0 hace una consulta HTTP saliente desde el host (aviso de versión nueva) durante `start`.
- Dos intentos corregidos durante el trabajo, conservados como evidencia: `focal-results-attempt1-lookup-bug/` (relay con `ERR_INVALID_IP_ADDRESS` al resolver por nombre en Node 24; corregido con `family: 4` y test por nombre) y `probe-results-attempt1-aux-expectation/` (expectativa auxiliar errónea sobre `/rest/v1/` sin apikey).
- El conteo de volúmenes del host (37) difiere del inventario del Director a las 22:47 UTC (35); la diferencia es previa a este trabajo y no fue creada por él.

### HANDOFF AL DIRECTOR

- Siguiente acción: revisión independiente del paquete v3 (`README.md`, `handoff.md`, `result.json`, recibos) y del `patch-proposal/`; luego decidir runtime C con el comando propuesto en `handoff.md` del paquete.
- Dependencias: ninguna en el repo. Cambios compartidos: ninguno (solo este handoff).
- Integración/publicación: no solicitadas; sin push.
- Sesiones consumidoras: ninguna conocida.
- Ownership: claim liberado al terminar (`node scripts/harness-worktree.mjs release --owner claude-worker-a-transport-v3-20260907`). No se eliminó worktree ni rama.
- Inventario Docker con IDs propios eliminados: focal y probe cerraron con inventario por label vacío; residuo final cero en labels `dtd.transport.run`, `dtd.transport.fixture`, decoy y humo, y en `com.supabase.cli.project=dtd-pr28-transport-probe-20260907-1` (contenedores, volúmenes, redes).
- Veredicto del Worker: LISTO_PARA_REVISION_DIRECTOR.

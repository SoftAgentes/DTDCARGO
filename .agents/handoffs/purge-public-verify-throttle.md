# purge-public-verify-throttle — Retención de `public_verify_throttle` (SDD-0455)

Fecha: 2026-09-11. Task ID: `purge-public-verify-throttle`.
Owner / sesión escritora: `purge-verify-throttle-claude-06f6e292`, sesión Claude Code `06f6e292-7184-4464-8357-5a65c7c1db87`.
Estado de tarea: **lista-para-revision** (local). Sin publicar: esta sesión no tiene autorización de Sam para hacer push ni abrir la PR.
Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO`.
Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/purge-public-verify-throttle`.
Rama: `codex/purge-public-verify-throttle`, sin upstream.
Base: `50100cc4` (origin/main al reservar, incluye PR #70) más el commit de reserva `6e26212b`. Al cierre, origin/main está en `6fdc00b4`, 17 commits por delante. `git merge-tree` es limpio; solo coincide `docs/specs/README.md`, que resuelve el driver semántico.
SDD: `docs/specs/0455-purge-public-verify-throttle/spec.md`, `status: in-progress`.
Origen: hallazgo de la revisión de datos de L17 (PR #80, `.agents/handoffs/c-l17-verificar-throttle.md` en `codex/c-l17-verificar-throttle`).
Dependencias: ninguna. PR #80 es independiente y el orden de merge es indiferente (spec, «Relación con PR #80»).
Permisos usados:
- edición focal, instalación congelada y pruebas locales y efímeras;
- commits selectivos;
- reserva SDD local;
- detener el árbol de procesos de mi propio `verify` colgado.

Sin push, PR, merge, lectura ni escritura de producción, ni despliegue.

## OBJETIVO ORIGINAL

- Incorporar `public_verify_throttle` a la purga del cron `purge-throttle`, con una retención mínima coherente con la ventana del throttle (la del código y la de la RPC 0426), justificada en una spec.
- Corregir el documento legal sin editar migraciones aplicadas.
- Evaluar si hace falta una migración nueva.
- Pruebas del cron y `pnpm verify`.
- Revisión focal con `revisar-datos-ve`.
- Commits selectivos y handoff. Publicar solo con autorización de Sam.

## COMPLETADO

- **SDD-0455 reservado localmente** con `node scripts/next-number.mjs --reserve purge-public-verify-throttle`:
  - ref `refs/heads/codex/sdd-reserve-0455-purge-public-verify-throttle` y lock `refs/dtd/reservations/0455`;
  - el primer inventario daba 0453, pero otras sesiones reservaron 0453 (`mailing-test-template-admin-guard`) y 0454 (`verify-e2e-watchdog`) antes;
  - la rama avanzó por fast-forward hasta el stub. La reserva no está publicada.
- **Cron** (`app/api/cron/purge-throttle/route.ts`):
  - `PUBLIC_VERIFY_RETENTION_MINUTES = 60`, justificada en 29-36;
  - un solo `now` para los dos cortes (53-59);
  - tercer DELETE sobre `public_verify_throttle`, **al final**, con `apiError` genérico y la etiqueta `purge-verify-throttle` (78-90);
  - la respuesta agrega `deletedByTable.public_verify_throttle` y `cutoffByTable`; `cutoff` conserva sus 48 h (92-106).
  - Sin cambios en las otras tablas, en la autenticación ni en `vercel.json`.
- **Test** (`__tests__/route.test.ts`, 7 casos):
  - el mock registra tabla, columna y corte de cada `delete().lt()`;
  - los tres casos 403 se conservan;
  - se comprueban el orden de las tres tablas y los cortes exactos (48 h y 60 min) con reloj fijo;
  - un guard exige un corte ≥ 2 × `VERIFY_WINDOW_MINUTES`, importado de `lib/public/verify-throttle.ts`;
  - si falla la tercera purga, la respuesta es 500 genérico y las dos anteriores ya quedaron hechas.
- **Decisión de 60 min**, justificada en la spec:
  - ventana de 30 min en main (`verify-throttle.ts:25,47-55`) y en 0426 (`:41` en PR #80);
  - margen para el desfase de reloj Vercel↔Postgres y para un cambio de ventana en SQL;
  - vida efectiva máxima de ~25 h por el cron diario de las 04:00 UTC (`vercel.json:22-23`), frente a indefinida antes;
  - 48 h descartadas por falta de finalidad.
- **Sin migración nueva**, con evidencia:
  - **Índice:** no hace falta. Plan `Seq Scan`: se purgaron 1.000.003 filas en 4,8 s y la corrida en régimen tardó 0,35 s.
  - **`grant delete`:** no. Los defaults de la imagen Supabase lo dan, pero en producción es NO VERIFICABLE y queda como precondición de release.
  - **Comentario de 0169:** no se toca. `0169:18` («puede limpiarla por antigüedad») se vuelve cierto, así que no se registra deuda.
- **Documentos de privacidad:**
  - `AUDITORIA-2026-07.md:61-71`: una fila falsa pasa a ser cuatro filas verificadas con `archivo:línea`, más una nota fechada de corrección;
  - `registro-tratamiento.md`: v1.4, §4.3 nueva y una fila en §5 para quien escanea un QR;
  - `mapa-de-borrado.md:189`: fila nueva en §E.
- **Verificación efímera de la ruta real** contra `supabase/postgres:17.6.1.165` y `postgrest/postgrest:v16.1`, en contenedores propios con la base en red `--internal`. Detalle en VALIDACIÓN.
- **Corrección tras la primera corrida de `verify`:** la spec citaba el archivo de 0426, ausente en esta rama, y el contrato spec→migración lo rechazó. Ahora lo cita como `0426:37,41` (`f35680b2`).
- **Revisión focal `revisar-datos-ve`** en la spec: 5 CORRECTO, 4 ENCONTRADO (preexistentes) y 5 NO VERIFICABLE. **No es asesoría legal.**

## VALIDACIÓN

Árbol de producto en `f35680b2`; este handoff se agrega después sin tocar esos archivos. Node 24.20.0, pnpm 12.3.4 vía Corepack y Docker 29.7.2. Sin credenciales ni `.env`. Guiones, recibo y logs quedan fuera de Git, en la carpeta scratchpad de la sesión (`pvt/run.mjs`, `pvt/route-runner.ts`, `pvt/receipt.json`, `verify-630b81ac.log`, `verify-run2.log`).

| Comprobación | Estado y evidencia |
|---|---|
| `harness-worktree guard` / `claim` / `guard --owner` antes de cada commit | PASÓ |
| `corepack pnpm install --frozen-lockfile` | PASÓ (36,9 s); lockfile intacto |
| Vitest focal antes de implementar (RED) | FALLÓ como se esperaba: 4 fallan y 3 pasan (los 403) |
| Vitest focal después (GREEN) | PASÓ: 7/7, y 12/12 junto con `spec-migration-refs` tras la corrección |
| ESLint focal (ruta y test) | PASÓ, sin avisos |
| `corepack pnpm typecheck` | PASÓ |
| `corepack pnpm docs:index` / `docs:check` | PASÓ, 418 specs |
| `corepack pnpm sdd:check` | PASÓ: sin números repetidos; choques históricos declarados |
| `git diff --check` y allowlist | PASÓ: 7 archivos de la allowlist de la spec |
| Verificación efímera (ruta real + PostgREST + Supabase Postgres) | PASÓ. Detalle debajo |
| `corepack pnpm verify`, corrida 1 (SHA `630b81ac`) | FALLÓ: `test` por un defecto propio (ya corregido) y e2e colgado. Detalle debajo |
| `corepack pnpm verify`, corrida 2 (SHA `f35680b2`, 09:05–09:32 −04:00) | FALLÓ, exit 1: 15 de 17 pasos PASÓ, `e2e` FALLÓ (ambiental) y `migrations-applied` NO DISPONIBLE. Veredicto literal: `verify: 1 fallo(s) → e2e CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied.` No se absuelve ni se presenta como verde |
| `/ui-check` | NO EJECUTADO: sin cambio visual |
| E2E autenticado y `migrations-applied` | NO DISPONIBLE: sin credenciales |
| Producción (catálogo, conteo, primera corrida) | NO EJECUTADO: fuera de la autorización; ver HANDOFF AL DIRECTOR |

Detalle de la verificación efímera (recibo del 2026-09-11 11:41–11:47 UTC):

- Aplicadas las migraciones reales 0094 y 0169 como `postgres`; `operario_pin_attempts` fue un stub con los grants de 0325.
- ACL resultante: `service_role` con SELECT, INSERT y DELETE vía default privileges; RLS activa y 0 policies.
- Fixture de 1.000.006 filas con IPs de documentación (RFC 5737/3849).
- Sin Bearer: 403.
- Primera corrida: 200 en 4.796 ms, con 1.000.003 filas borradas. Quedan exactamente las de 55 min, 29 min y la actual.
- Segunda corrida: 200 en 347 ms, 0 filas borradas.
- `anon`: DELETE → 204 `*/0`; SELECT → `[]`.
- `authenticator` tiene `statement_timeout=8s`. El desfase DB−host fue de +612 ms.
- Contenedores y red eliminados.

Detalle de `verify`, corrida 2 (SHA `f35680b2`):

- PASÓ:
  - harness y lint (0 errores; 8 avisos en archivos intactos, los mismos de L16 y L17);
  - rsc-boundary, typecheck y edge-functions (4);
  - `test`: 6687/6687 en 526 archivos, 253 s;
  - docs:check, numbering, feature-constants (5), components:check y governance:check;
  - pending-migration-symbols (0 ROJO / 0 AMARILLO), sql-tests y schema-rebuild;
  - `build`: 160 páginas estáticas; `tsconfig.json` restaurado.
- `migrations-applied`: NO DISPONIBLE (SKIP), sin `NEXT_PUBLIC_SUPABASE_URL` ni `SUPABASE_SERVICE_ROLE_KEY`.
- `e2e` FALLÓ (exit 1) en ambas pasadas:
  - pasada 1: 151 aprobados, 15 fallidos, 2 flaky y 18 omitidos (6,2 min);
  - pasada 2: 153 aprobados, 15 fallidos y 18 omitidos (6,5 min);
  - los 15 son `auth.spec.ts:21/91/98/105` y `global-search.spec.ts:22` en chromium, mobile-chrome y mobile-safari. El server registró 186 veces que `proxy.ts:67` crea el cliente de Supabase sin URL ni clave: el mismo patrón ambiental de L16 y L17;
  - flaky: `calculadora-semantic-colors.spec.ts:53` (chromium, light y dark);
  - ningún spec de `e2e/` ejerce `/verificar` ni `/api/cron`. Esta vez no hubo cuelgue.

Detalle de `verify`, corrida 1 (SHA `630b81ac`):

- Pasos anteriores al e2e: todos PASÓ salvo dos.
  - `test` FALLÓ 1 de 6687 en ambas pasadas (`scripts/__tests__/spec-migration-refs.test.ts:106`). La spec citaba el archivo de 0426, que solo existe en PR #80. El defecto es mío y está corregido en `f35680b2`; el test de la ruta pasó.
  - `migrations-applied`: NO DISPONIBLE (SKIP).
- `e2e`:
  - hasta el resultado #169 de 186 hubo 54 ok, 31 intentos fallidos (el mismo patrón ambiental) y 15 omitidos;
  - después hubo 20 min sin salida: último byte a las 08:38 y detección a las 08:59. Detuve solo mi árbol con `taskkill /PID 31300 /T /F`: 31 procesos de este worktree (verify, Playwright, 6 workers con Chrome y `next dev` en el puerto 3112).
- `build`: NO EJECUTADO en esa corrida. Lo cubre la corrida 2.

## COMMITS

- `6e26212b` chore(sdd): reserva SDD-0455 (generada por `next-number.mjs`).
- `1f232a8a` docs(DTD-0455): spec e índice regenerado.
- `ab86cd12` fix(DTD-0455): purga en el cron y test.
- `630b81ac` docs(legal): DTD-0455, auditoría, registro y mapa.
- `f35680b2` docs(DTD-0455): cita de 0426 por número y línea, para el contrato spec→migración.
- Commit que contiene este documento: handoff; su hash queda en la PR cuando se publique.

## PR / BRANCH

No publicada. Rama `codex/purge-public-verify-throttle`, base prevista `main`. Con autorización de Sam:

```text
git push -u origin codex/purge-public-verify-throttle:codex/purge-public-verify-throttle
gh pr create --base main --head codex/purge-public-verify-throttle --draft --title "fix(DTD-0455): retención de 60 min para public_verify_throttle en el cron de purga" --body-file <archivo>
```

La reserva 0455 se hace visible con esa PR. Si el Director prefiere publicar antes solo el lock, el comando create-only está en la salida de `next-number.mjs`.

## PENDIENTES DE ESTA TAREA

1. Autorización de Sam para publicar la rama y abrir la PR draft.
2. Aprobación de Sam, al autorizar el merge, de la retención de 60 min y del **borrado irreversible del historial** acumulado desde el 2026-07-16. Es el único criterio abierto de la spec; con él pasa a `done`.
3. Revisión del Director.
4. E2E autenticado y ledger real: NO DISPONIBLE sin credenciales. Los mide un entorno con `.env.local` o una CI con secretos.

## FUERA DE ALCANCE DETECTADO

1. `docs/legal/privacidad/registro-tratamiento.md:95` atribuye a `public_track_log` una retención de «48 h en cron» que no existe: no hay DELETE ni cron en `supabase/migrations/`, `app/` ni `lib/` (`0059:24-30`, `0326:90-91`). Merece un SDD que la purgue o una corrección de esa fila.
2. `no_olvidar_access_log` conserva `ip_address` y `user_agent` sin plazo (`0017_no_olvidar.sql:121-129,430-436`); es inmutable por diseño.
3. La IP de `/verificar` se guarda en claro, mientras otros throttles guardan una huella SHA-256. Hashearla cambia el contrato de 0426 (`:17-31` valida la sintaxis): SDD posterior a PR #80.
4. `portal_registro_throttle` no aparece en `mapa-de-borrado.md` §E.
5. Default privileges de producción. El runbook anota «`anon`/`authenticated` sin SELECT» en 0169 (`aplicar-migraciones-prod.md:179-181`), mientras la imagen Supabase concede ALL a los tres roles. Conviene auditar el catálogo de las tablas creadas sin grants explícitos (0094, 0169), porque su purga depende de DELETE.
6. `0375:75-77` (PR #80) describirá el estado previo a 0455 cuando ambas estén en main. Es historia de su propio corte y no se edita.
7. SDD-0414 figura `done` en main, pero su logger estructurado para este cron solo existe en la PR #21: `refs/dtd/pr/21:app/api/cron/purge-throttle/route.ts:18,36-101` importa `@/lib/observability/structured-logger`, que main no tiene. Quien importe esa adopción debe partir de la versión de tres tablas de esta rama; tomar el archivo de #21 borraría la purga de `public_verify_throttle`.
8. El cuelgue del e2e de la corrida 1 repite el patrón de L21, L08, L09 y L13 que atiende SDD-0454 (`codex/verify-e2e-watchdog`). Esta corrida suma un caso con 20 min sin salida tras el resultado #169 (mobile-safari).

## HANDOFF AL DIRECTOR

- **Siguiente acción:** revisar el diff (5 commits sobre `50100cc4`) y pedir a Sam autorización para publicar.
- **Antes del merge, con autorización de Sam** (spec, «Release y reversión»):
  1. decidir si el historial de IPs se puede borrar, o si hay un incidente o requerimiento que obligue a conservarlo;
  2. consulta de catálogo sin filas: `select has_table_privilege('service_role', 'public.public_verify_throttle', 'DELETE');`. Si da `false`, hace falta una migración `grant delete` con número del Director antes del merge;
  3. opcional: conteo de filas con más de 60 min, para dimensionar el primer barrido frente al `statement_timeout`.
- **No es migrate-first.** No hay migraciones. Sin el privilegio DELETE, el cron respondería 500 a diario después de purgar las otras dos tablas, sin daño de datos.
- **Después del despliegue:** la corrida de las 04:00 UTC debe responder 200, sin `[purge-verify-throttle]` en los logs. Una preview no ejecuta crons.
- **Reversión:** revertir la PR. Lo borrado no se recupera desde la app.
- **Main avanzó** a `6fdc00b4`. `git merge-tree` es limpio y los cambios de main no tocan esta tabla, el cron ni los documentos de privacidad. Si se integra más tarde, basta un merge de origin/main en la rama, que pido cuando haga falta.
- **Compartidos:**
  - con main, solo `docs/specs/README.md` (generado, driver `dtd-generated-records`);
  - con PR #80, ningún archivo. Esa PR cambia `lib/public/verify-throttle.ts`, pero conserva `VERIFY_WINDOW_MINUTES`, que el test importa;
  - PR #21 (`codex/saneamiento-integral`) toca los mismos `route.ts`, `route.test.ts`, `mapa-de-borrado.md` y `registro-tratamiento.md` (diff `origin/main...` de cada PR abierta, 2026-09-11). Si alguna de sus partes se importa, parte de esta rama (punto 7 de FUERA DE ALCANCE).
- **Sesiones consumidoras:** ninguna. Ownership: se libera al cierre con `node scripts/harness-worktree.mjs release --owner purge-verify-throttle-claude-06f6e292`. Worktree, rama y reserva se conservan.

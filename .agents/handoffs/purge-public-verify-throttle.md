# purge-public-verify-throttle — Retención de `public_verify_throttle` (SDD-0455)

Fecha: 2026-09-11. Task ID: `purge-public-verify-throttle`.
Owner / sesión escritora: `purge-verify-throttle-claude-06f6e292`, sesión Claude Code `06f6e292-7184-4464-8357-5a65c7c1db87`.
Estado de tarea: **lista-para-revision** en [PR #86](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/86), en borrador, con la revisión del Director aplicada.
- Sam autorizó el push y la PR el 2026-09-11 y activó el monitor de CI (auto-fix).
- No hay merge ni cambios en producción. La PR no pasa a ready: el CI está bloqueado por la facturación de GitHub Actions.

Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO`.
Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/purge-public-verify-throttle`.
Rama: `codex/purge-public-verify-throttle`, publicada en `origin` con upstream propio.
Base: `50100cc4` (origin/main al reservar) más el commit de reserva `6e26212b`.
- Se actualizó con tres merges de origin/main: `cc5ee896` (main en `bbc7493f`), `f20804c7` (main en `ef7b008e`, pedido por el monitor de CI) y `75e56ed5` (main en `4eedeb8a`, pedido por el Director).
- GitHub marcaba conflicto solo en el índice generado `docs/specs/README.md`; en local lo resolvió el driver `dtd-generated-records`.

SDD: `docs/specs/0455-purge-public-verify-throttle/spec.md`, `status: in-progress` hasta la decisión de Sam.
Origen: hallazgo de la revisión de datos de L17 (PR #80, `.agents/handoffs/c-l17-verificar-throttle.md` en `codex/c-l17-verificar-throttle`).
Dependencias: ninguna. PR #80 es independiente y el orden de merge es indiferente (spec, «Relación con PR #80»).
Permisos usados:
- edición focal, instalación congelada y pruebas locales y efímeras;
- commits selectivos y reserva SDD local;
- detener el árbol de procesos de mi propio `verify` colgado;
- push de la rama propia y PR draft (autorizados por Sam);
- merges de origin/main en la rama propia.

Sin merge a main, lectura ni escritura de producción, ni despliegue.

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
  - la rama avanzó por fast-forward hasta el stub. La PR hace visible el número.
- **Cron** (`app/api/cron/purge-throttle/route.ts`):
  - `PUBLIC_VERIFY_RETENTION_MINUTES = 60`, justificada en 29-36;
  - un solo `now` para los dos cortes (53-59);
  - tercer DELETE sobre `public_verify_throttle`, **al final**, con `apiError` genérico y la etiqueta `purge-verify-throttle` (78-90);
  - la respuesta agrega `deletedByTable.public_verify_throttle` y `cutoffByTable`; `cutoff` conserva sus 48 h (92-106).
  - Sin cambios en las otras tablas, en la autenticación ni en `vercel.json`.
- **Test** (`__tests__/route.test.ts`, 7 casos):
  - el mock registra tabla, opciones de `delete()`, columna y corte;
  - los tres casos 403 se conservan;
  - se comprueban el orden de las tres tablas, `count: "exact"` en cada DELETE y los cortes exactos (48 h y 60 min) con reloj fijo;
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
  - `AUDITORIA-2026-07.md` §2.1: cuatro filas verificadas con `archivo:línea` y una nota fechada de corrección;
  - `registro-tratamiento.md`: v1.4, fila de `public_track_log` en §4.2, §4.3 nueva y una fila en §5 para quien escanea un QR;
  - `mapa-de-borrado.md:189`: fila nueva en §E.
- **Verificación efímera de la ruta real** contra `supabase/postgres:17.6.1.165` y `postgrest/postgrest:v16.1`, en contenedores propios con la base en red `--internal`. Detalle en VALIDACIÓN.
- **Corrección tras la primera corrida de `verify`:** la spec citaba el archivo de 0426, ausente en esta rama, y el contrato spec→migración lo rechazó. Ahora lo cita como `0426:37,41` (`f35680b2`).
- **Revisión del Director** (comentario en la PR #86, head `e078f711`), aplicada en `2e34df9a`, `004b1300` y `781eb547`:
  - **Requerido 2:** la auditoría enumera los **12 escritores** de `portal_registro_throttle` en cuatro formas, cada uno verificado con `archivo:línea`:
    - IP en claro con prefijo: `contact:`, `newsletter:`, `calc:`, `est:`, `docheck:`, `packing:` y `upload:`;
    - IP en claro sin prefijo: `app/registro/actions.ts` y `app/m/emp/actions.ts`;
    - huella SHA-256 de la IP: `portal-login:` y `studio-recuperar:`;
    - huella SHA-256 sin sal del email: `portal-login-mail:`.

    También se corrigen la nota y el criterio `[x]` de la spec, que antes afirmaba más de lo hecho.
  - **Requerido 3:** `public_track_log` pasa a «huella desde 0326; las filas previas pueden conservar IP en claro, sin backfill ni purga; producción NO VERIFICABLE». No hay UPDATE ni DELETE sobre la tabla en ninguna migración.
  - **Recomendado:** `registro-tratamiento.md:95` deja de decir «48 h en cron» para `public_track_log`, y el mock afirma `count: "exact"`.
  - **Actualización:** merge de main (`75e56ed5`), `docs:index` y `verify` completo sobre `781eb547`. `git diff origin/main -- supabase/` quedó vacío y el diff contra main tiene 8 archivos.
- **Revisión focal `revisar-datos-ve`** en la spec: 5 CORRECTO, 5 ENCONTRADO (preexistentes) y 5 NO VERIFICABLE. **No es asesoría legal.**

## VALIDACIÓN

Árbol de producto validado completo en `781eb547`; este handoff se agrega después sin tocar esos archivos. Node 24.20.0, pnpm 12.3.4 vía Corepack y Docker 29.7.2. Sin credenciales ni `.env`. Guiones, recibo y logs quedan fuera de Git, en la carpeta scratchpad de la sesión (`pvt/run.mjs`, `pvt/route-runner.ts`, `pvt/receipt.json`, `verify-630b81ac.log`, `verify-run2.log`, `verify-run3.log`).

`corepack pnpm verify`, corrida 3 (SHA `781eb547`, 15:12–15:29 −04:00, vigilante de 15 min sin salida, sin cuelgue). Exit 1. Veredicto literal: `verify: 1 fallo(s) → e2e CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied.`

| Check | Estado y evidencia |
|---|---|
| harness | PASÓ |
| lint | PASÓ: 0 errores; 8 avisos en archivos intactos, los mismos de L16 y L17 |
| rsc-boundary | PASÓ |
| typecheck | PASÓ |
| edge-functions | PASÓ, 4 funciones |
| test | PASÓ, 6718/6718 en 529 archivos (156 s) |
| docs:check | PASÓ, 424 specs |
| numbering | PASÓ |
| feature-constants | PASÓ, 5 banderas |
| components:check | PASÓ |
| governance:check | PASÓ |
| migrations-applied | NO DISPONIBLE: SKIP sin `NEXT_PUBLIC_SUPABASE_URL` ni `SUPABASE_SERVICE_ROLE_KEY`; no midió el ledger real |
| pending-migration-symbols | PASÓ: 0 ROJO / 0 AMARILLO |
| sql-tests | PASÓ |
| schema-rebuild | PASÓ |
| e2e | NO DISPONIBLE por **excepción explícita** (criterio del Director), aunque el gate salió con exit 1. Detalle debajo |
| build | PASÓ: 160 páginas estáticas; `tsconfig.json` restaurado |

Detalle del e2e:

- Pasada 1: 153 aprobados, 15 fallidos y 18 omitidos (5,3 min). Pasada 2: igual (4,2 min). Sin flaky.
- Los 15 son siempre `auth.spec.ts:21/91/98/105` y `global-search.spec.ts:22` en chromium, mobile-chrome y mobile-safari. El server registró 186 veces que `proxy.ts:67` crea el cliente de Supabase sin URL ni clave.
- Es el mismo patrón ambiental de L16, L17 y las corridas 1 y 2.
- Ningún spec de `e2e/` ejerce `/verificar` ni `/api/cron` (búsqueda vacía).
- No se presenta como verde. Lo mide un entorno con credenciales.

Otras comprobaciones:

| Comprobación | Estado y evidencia |
|---|---|
| `harness-worktree guard` / `claim` / `guard --owner` antes de cada commit y push | PASÓ |
| `corepack pnpm install --frozen-lockfile` | PASÓ (36,9 s); lockfile intacto |
| Vitest focal: RED antes de implementar y GREEN después | RED: 4 fallan y 3 pasan (los 403). GREEN: 7/7, y 12/12 con `spec-migration-refs` en cada ajuste |
| ESLint focal (ruta y test) | PASÓ, sin avisos |
| `docs:index` / `docs:check` / `sdd:check` tras cada cambio y merge | PASÓ |
| `git diff --check`, allowlist y `git diff origin/main -- supabase/` | PASÓ: 8 archivos contra main (7 de la allowlist más este handoff) y ninguno bajo `supabase/` |
| Verificación efímera (ruta real + PostgREST + Supabase Postgres) | PASÓ. Detalle debajo |
| `verify`, corrida 1 (SHA `630b81ac`) | FALLÓ: `test` por un defecto propio, corregido en `f35680b2`, y e2e colgado 20 min. Detuve solo mi árbol con `taskkill /PID 31300 /T /F` (31 procesos) |
| `verify`, corrida 2 (SHA `f35680b2`) | 15 de 17 PASÓ; e2e con los mismos 15 fallos ambientales (más 2 flaky de `calculadora-semantic-colors.spec.ts:53`); `migrations-applied` NO DISPONIBLE |
| `/ui-check` | NO EJECUTADO: sin cambio visual |
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

## COMMITS

- `6e26212b` chore(sdd): reserva SDD-0455 (generada por `next-number.mjs`).
- `1f232a8a` docs(DTD-0455): spec e índice regenerado.
- `ab86cd12` fix(DTD-0455): purga en el cron y test.
- `630b81ac` docs(legal): DTD-0455, auditoría, registro y mapa.
- `f35680b2` docs(DTD-0455): cita de 0426 por número y línea, para el contrato spec→migración.
- `1a018901`, `6d3233b6` y `e078f711` chore(harness): versiones previas de este handoff.
- `cc5ee896`, `f20804c7` y `75e56ed5`: merges de origin/main, con el índice generado resuelto por el driver.
- `2e34df9a` docs(legal): 12 escritores de `portal_registro_throttle`, `public_track_log` matizado y fila de §4.2 corregida.
- `004b1300` test(DTD-0455): `count: "exact"` afirmado en cada DELETE.
- `781eb547` docs(DTD-0455): spec ajustada a la revisión del Director.
- Commit que contiene este documento: handoff con la revisión aplicada y la corrida 3; su hash queda en la PR.

## PR / BRANCH

[PR #86 en borrador](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/86), base `main`, rama `codex/purge-public-verify-throttle`.

- Publicada a sí misma, sin force.
- Título: «fix(DTD-0455): purgar public_verify_throttle a 60 min en el cron de purga».
- Cada push dispara el preview de Vercel, automático del proveedor; no hubo deploy manual.
- El comentario de `vercel[bot]` es solo el estado del preview.
- La reserva 0455 queda visible por la PR; el lock `codex/sdd-reserve-0455` no se publicó aparte.

## PENDIENTES DE ESTA TAREA

1. Decisión nominal de Sam: retención de 60 min y **borrado irreversible del historial** acumulado desde el 2026-07-16. Después, pasar la spec a `done` y marcar su último criterio.
2. CI alojado del último SHA: está bloqueado por la facturación de GitHub Actions y lo relanza el Director. También queda pendiente su revisión final.
3. E2E autenticado y ledger real: NO DISPONIBLE sin credenciales. Los mide un entorno con `.env.local` o una CI con secretos.

## FUERA DE ALCANCE DETECTADO

1. `public_track_log` no tiene purga, y las filas previas a 0326 pueden conservar la IP en claro. Esta PR ya corrigió la fila del registro §4.2 que decía «48 h en cron», pero la purga real (y la decisión sobre las filas previas) necesita un SDD propio (`0059:24-30`, `0326:32,90-91`).
2. **El registro §4.2 no declara la huella del email.** `portal-login:` figura como «no email», pero `portal-login-mail:` guarda en `portal_registro_throttle` una huella SHA-256 **sin sal** del email (`app/entrar/actions.ts:113,117`), que se revierte probando correos conocidos. Merece un SDD: sal o HMAC con secreto de servidor, y declararlo.
3. `no_olvidar_access_log` conserva `ip_address` y `user_agent` sin plazo (`0017_no_olvidar.sql:121-129,430-436`); es inmutable por diseño.
4. La IP de `/verificar` se guarda en claro, mientras otros throttles guardan una huella SHA-256. Hashearla cambia el contrato de 0426 (`:17-31` valida la sintaxis): SDD posterior a PR #80.
5. `portal_registro_throttle` no aparece en `mapa-de-borrado.md` §E. Además, 9 de sus 12 escritores guardan IP en claro (48 h).
6. Default privileges de producción. El runbook anota «`anon`/`authenticated` sin SELECT» en 0169 (`aplicar-migraciones-prod.md:179-181`), mientras la imagen Supabase concede ALL a los tres roles. Conviene auditar el catálogo de las tablas creadas sin grants explícitos (0094, 0169), porque su purga depende de DELETE.
7. `0375:75-77` (PR #80) describirá el estado previo a 0455 cuando ambas estén en main. Es historia de su propio corte y no se edita.
8. SDD-0414 figura `done` en main, pero su logger estructurado para este cron solo existe en la PR #21: `refs/dtd/pr/21:app/api/cron/purge-throttle/route.ts:18,36-101` importa `@/lib/observability/structured-logger`, que main no tiene. Quien importe esa adopción debe partir de la versión de tres tablas de esta rama; tomar el archivo de #21 borraría la purga de `public_verify_throttle`.
9. El cuelgue del e2e de la corrida 1 repite el patrón de L21, L08, L09 y L13 que atiende SDD-0454 (PR #89): 20 min sin salida tras el resultado #169 (mobile-safari).

## HANDOFF AL DIRECTOR

- **Siguiente acción:** revisar el head final de la PR #86 (diff de 8 archivos contra main) y relanzar el CI cuando se resuelva la facturación.
- **Antes del merge, con autorización de Sam** (spec, «Release y reversión»):
  1. decisión nominal sobre la retención y el borrado irreversible del historial;
  2. consulta de catálogo sin filas, que corre el Director: `select has_table_privilege('service_role', 'public.public_verify_throttle', 'DELETE');`. Si da `false`, hace falta una migración `grant delete` con número del Director antes del merge;
  3. opcional: conteo de filas con más de 60 min, para dimensionar el primer barrido frente al `statement_timeout`.
- **Producción:** el merge despliega en Vercel y activa la purga a las 04:00 UTC; la autorización tiene que cubrir ese efecto. No es migrate-first y no hay migraciones. Sin el privilegio DELETE, el cron respondería 500 a diario después de purgar las otras dos tablas, sin daño de datos.
- **Después del despliegue:** la corrida de las 04:00 UTC debe responder 200, sin `[purge-verify-throttle]` en los logs. Una preview no ejecuta crons.
- **Reversión:** revertir la PR. Lo borrado no se recupera desde la app.
- **Main:** la rama incluye main hasta `4eedeb8a`. Cada PR que regenera el índice puede volver a marcar conflicto en `docs/specs/README.md`; se resuelve con otro merge de origin/main y el driver.
- **Compartidos:**
  - con main, solo `docs/specs/README.md` (generado, driver `dtd-generated-records`);
  - con PR #80, ningún archivo. Esa PR cambia `lib/public/verify-throttle.ts`, pero conserva `VERIFY_WINDOW_MINUTES`, que el test importa;
  - PR #21 (`codex/saneamiento-integral`) toca los mismos `route.ts`, `route.test.ts`, `mapa-de-borrado.md` y `registro-tratamiento.md`. Si alguna de sus partes se importa, parte de esta rama (punto 8 de FUERA DE ALCANCE).
- **Sesiones consumidoras:** ninguna. Ownership: se libera al cierre con `node scripts/harness-worktree.mjs release --owner purge-verify-throttle-claude-06f6e292`. Worktree, rama y reserva se conservan.

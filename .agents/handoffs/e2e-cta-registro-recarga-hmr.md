# Handoff — los CTA de registro y la recarga de `next dev`

- Fecha: 2026-11-02, con el `verify` del 2026-11-03. Task ID: `e2e-cta-registro-recarga-hmr`.
- Owner: `local_competent-heisenberg-d6c479` (Worker Claude Code). Encargo del Director General.
- Worktree: `.claude/worktrees/competent-heisenberg-d6c479`.
- Rama: `claude/e2e-cta-registro-cronometro`, con base en `05c51067b` y merge de `origin/main` `9d3bf7443` en `089e298ba`.
- SDD: no aplica. Cambia solo el harness de e2e; no toca producto, Studio ni base de datos.
- Estado de tarea: lista-para-revision, PR en borrador. **`pnpm verify` no salió verde**: lo decide el Director General.
- Permisos: rama propia y PR en borrador contra `main`, sin merge. Turnos de máquina del Director General: 6 corridas con tope de 35 min, y un `verify`.

## OBJETIVO ORIGINAL

Averiguar por qué `e2e/sin-scroll-horizontal.spec.ts:119` falla en chromium con los workers de `verify`, midiéndolo, y decir si ya estaba en `origin/main`. Si es del spec, arreglarlo sin debilitarlo, con control rojo. Si es del producto, reportarlo antes de tocar nada. Listo es: causa medida, spec en verde con los workers de `verify` en dos corridas, control rojo y PR.

## CAUSA MEDIDA

No es del producto. El CTA navega bien; lo que falla es el entorno de prueba, por dos causas que se suman.

**1. `next dev` recarga la página a mitad de la navegación.** Es la causa directa del rojo.

- El cliente de HMR recarga la página si recibe un `sync` con hash distinto al del `sync` anterior (`next/dist/client/dev/hot-reloader/app/web-socket.js:86-92`, Next 16.2.11). Los `built` no actualizan ese valor.
- El servidor manda `sync` a todas las páginas abiertas cada vez que se conecta una (`next/dist/server/dev/hot-middleware.js`).
- La secuencia: la página recibe `sync` con el hash A, otro worker compila una ruta nueva (`built` con B) y otro worker abre una página (`sync` con B). La página se recarga, el pedido RSC a `/registro` muere con `ERR_ABORTED`, la URL sigue en `/` y nadie vuelve a pulsar.

Evidencia, con la prueba instrumentada sobre `05c51067b`, 8 workers, en frío:

| Intento | Pulso | `sync` con hash nuevo | `GET /` documento | RSC | Resultado |
|---|---|---|---|---|---|
| 1.º | 9,69 s | 28,44 s | 28,45 s | `ERR_ABORTED` a 29,51 s | `waitForURL` vence a 20,03 s del pulso |
| Reintento | 24,79 s | 43,24 s | 43,24 s | `ERR_ABORTED` a 44,35 s | `waitForURL` vence a 20,04 s del pulso |

Reproducción determinista, con 1 worker y una prueba temporal sin commit:

| Caso | Secuencia | Recargas |
|---|---|---|
| Sin filtro | `built` a 12,71 s, `sync` a 17,86 s, `GET /` a 17,87 s | 1 |
| Con filtro | `built` a 7,55 s, `sync` a 16,36 s y 24,46 s | 0 |

Por eso pasa con 1 worker, donde nadie más compila ni se conecta mientras la prueba espera. Lo de chromium se explica por el orden: es el primer proyecto y pasa primero por cada ruta. Eso último es inferencia; no se midió aparte.

**2. El Supabase sintético hace esperar 7 s a cada lectura.** Alarga la ventana de exposición y consume el presupuesto.

- `postgrest-js` reintenta los GET con 503 tres veces, esperando 1 + 2 + 4 s si no hay `Retry-After`. `listRegisterCities` lee en cada render de `/registro`.
- Medido contra `supabase-deny-server.mjs`: 7,03-7,07 s por lectura y 4 pedidos. Con el mismo 503 más `Retry-After: 0`: 28-47 ms y 4 pedidos.
- En el trace de `next dev` de la PR #344, el render de `/registro` marca 7,10-7,14 s sin compilar nada.
- La prueba hacía 8 navegaciones en un solo presupuesto de 60 s, y el backoff se comía 28 s. El reintento de la #344 venció así, en la tercera de 4 navegaciones.

**Sin medir, inferencia:** el primer intento de la #344 no tiene trace. Su firma es la misma (tres `navigated to "/"`, foco fuera del CTA y render cortado a los 3,45 s), pero la medición directa es de la corrida 1 de esta tarea.

## COMPLETADO

- `e2e/_helpers/sin-recarga-hmr.ts` (nuevo): `evitarRecargaDeHmr` descarta el `sync` en el WebSocket de HMR de esa página. El resto de los mensajes pasa igual. Producción no tiene HMR, así que la página queda como la ve un cliente real.
- `e2e/sin-scroll-horizontal.spec.ts`: una prueba por CTA y método, 4 en total, en vez de una sola con las cuatro. Un solo `goto` a `/` midió 24 s bajo carga. La espera de `waitForURL` pasa de 20 a 35 s, porque la primera compilación de `/registro` midió 17,8 s con la CPU al 100 %.
- `scripts/e2e/supabase-deny-server.mjs`: el 503 lleva `Retry-After: 0`. Sigue negando todo, con el mismo status y cuerpo.
- `scripts/tests/e2e-supabase-sintetico.node.mjs`: prueba con el cliente real, que exige 4 pedidos y menos de 5 s.
- `e2e/README.md`: la nota del deny-only.

La prueba no pulsa dos veces ni reintenta: cada una exige que ese CTA, con ese método, llegue a `/registro`.

## VALIDACIÓN

Corridas de Playwright, en chromium con `E2E_WORKERS` sin definir (8 workers, como `verify`), salvo donde se indica. Antes de cada una: al menos 12,5 GB libres y 0 corridas pesadas ajenas, medido con `Get-WmiObject`. Mínimo durante las corridas: 7,2 GB.

| # | SHA | Alcance | Resultado |
|---|---|---|---|
| 1 | `05c51067b` + instrumentación | chromium completo, en frío | **FALLÓ**, 1 rojo (los CTA, en los dos intentos), 73 pasan, 6 omitidas. Así se comporta `main` |
| 2 | `05c51067b` + filtro y `Retry-After` aún sin commit, y prueba temporal | mecanismo, 1 worker | **PASÓ**, 2 de 2: 1 recarga sin filtro, 0 con filtro |
| 3 | `baa3a257c` | chromium completo, en frío | **PASÓ**, exit 0: 74 pasan, 3 flaky ajenos, 6 omitidas. Los 4 CTA al primer intento, navegación de 11,8-12,4 s |
| 4 | `baa3a257c` | chromium completo, en caliente | **PASÓ**, exit 0: 77 pasan, 0 flaky, 6 omitidas. Los 4 CTA al primer intento, navegación de 17,0-17,8 s |
| 5 | `10afc8651` + mutantes | control rojo, solo los CTA | **FALLÓ como debía**, 4 de 4 en los dos intentos |
| 6 | `10afc8651` | los CTA en los 3 proyectos | **PASÓ**, 12 de 12 al primer intento. Chromium y mobile-chrome 13,3-14,1 s; mobile-safari 0,7-1,3 s |

Las corridas 3 y 4 son con el límite de 20 s, así que el cambio a 35 s no es lo que las pone en verde.

Control rojo de la corrida 5, restaurado después y con el árbol limpio:

- CTA del hero con `href="/tarifas"`: `locator.waitFor` vence buscando `.hero-ctas > a[href='/registro']`, 2 de 2 pruebas.
- `/registro` redirigida a `/tarifas` en `proxy.ts`: `page.waitForURL` vence con `navigated to "/tarifas"`, 2 de 2 pruebas.

Otras comprobaciones:

| Comprobación | Resultado |
|---|---|
| `node --test scripts/tests/e2e-supabase-sintetico.node.mjs` | **PASÓ**, 14 de 14 |
| Mutante sin `Retry-After` | **FALLÓ como debía**: `tardó 7088 ms` |
| `tsc --noEmit -p tsconfig.json` | **PASÓ** |
| ESLint sobre el spec y el helper | **NO APLICA**: los dos archivos están ignorados por la configuración |
| `corepack pnpm docs:check` y `sdd:check` | **PASÓ** |
| `corepack pnpm knowledge:status` | **PASÓ**, exit 0. Lista enlaces rotos de specs ajenas a esta tarea |
| Impacto documental | `e2e/README.md` actualizado. Sin cambios en otros documentos canónicos |
| `pnpm verify` | **FALLÓ** por el paso `test`: detalle en la sección siguiente |
| Otros specs en mobile-chrome y mobile-safari con el `Retry-After` | **PASÓ**, dentro de `verify` |
| Graphify | **NO EJECUTADO**: lo publica el Director desde `main` |

## VERIFY COMPLETO

`pnpm verify` **FALLÓ**, exit 1, por el paso `test`. Se corrió una vez y no se repitió.

- SHA medido: `089e298baf448d40f93732e2c1db465e002f2578`, con el árbol limpio.
- Corrió de 13:37:25Z a 14:33:54Z, 56,5 min.
- Antes de lanzarlo: 0 corridas pesadas ajenas, 9,7 GB libres, CPU al 65 %, Docker en `running`. Durante la corrida no se midieron procesos ajenos, solo CPU y memoria. Al terminar: 0 procesos residuales.

| Paso | Resultado | Detalle |
|---|---|---|
| `harness` | **PASÓ** | |
| `lint` | **PASÓ** | 0 errores, 15 avisos |
| `rsc-boundary` | **PASÓ** | |
| `typecheck` | **PASÓ** | |
| `edge-functions` | **PASÓ** | 4 funciones compilan |
| `test` | **FALLÓ** | Rojo en los dos intentos, por razones distintas |
| `docs:check` | **PASÓ** | 566 specs |
| `numbering` | **PASÓ** | |
| `feature-constants` | **PASÓ** | 6 banderas |
| `components:check` | **PASÓ** | |
| `governance:check` | **PASÓ** | |
| `migrations-applied` | **NO DISPONIBLE** | SKIP: el worktree no tiene `NEXT_PUBLIC_SUPABASE_URL` ni `SUPABASE_SERVICE_ROLE_KEY`. `verify` lo marca como crítico sin medir |
| `pending-migration-symbols` | **PASÓ** | 0 rojos, 1 amarillo declarado, 3 homónimos descartados |
| `sql-tests` | **PASÓ** | 249 contratos |
| `schema-rebuild` | **PASÓ** | 473 migraciones aplicadas y 18 solo de ledger, de 491 |
| `e2e` | **PASÓ** | 228 pasan, 1 pasa al reintentar, 20 omitidas, 6,3 min |
| `build` | **PASÓ** | |

**El paso `test`**, con la hora de Caracas que imprime vitest:

| Intento | Inicio | Duración | Archivos | Pruebas | Por qué salió con error |
|---|---|---|---|---|---|
| 1.º | 09:46:05 | 1338,40 s | 1 falla, 881 pasan, 1 omitido (883) | 1 falla, 13331 pasan, 1 omitida (13333) | `infra/ops/tests/migraciones.test.mjs`, `prueba-migraciones-produccion.sh sale con 0 FALLÓ`: `Test timed out in 600000ms` |
| Reintento | 10:08:27 | 874,83 s | 881 pasan, 1 omitido (882) | 13323 pasan, 1 omitida (13324) | 0 pruebas fallidas y 1 error: `Failed to start forks worker` para `app/p/[token]/PackingListProductsStep.test.tsx`, `Timeout waiting for worker to respond` |

- **La PR no toca nada de eso.** Sus 6 archivos son del e2e, su harness y este handoff. `prueba-migraciones-produccion.sh` no cambia desde el 2026-10-17.
- **Por conteo, cada prueba pasó en algún intento.** La que venció en el 1.º no falló en el reintento. Las 9 pruebas de diferencia entre los dos coinciden con los 9 `it` de `PackingListProductsStep`, que no falló en el 1.º. Eso no convierte el paso en verde.
- **Carga medida.** CPU a 95 % o más en 63 de 87 muestras del 1.º y en 47 de 61 del reintento. Memoria libre mínima: 2,9 GB a las 09:49:13 y 2,3 GB a las 10:09:31. El handoff de SDD-0550 midió ese script en 282 s bajo carga; aquí pasó de 600 s.
- **Sin medir.** Si el script estaba lento o colgado en el 1.º, cuánto tardó en el reintento y en qué instante falló el worker. Atribuirlo a la carga o a la memoria es inferencia.

**Las pruebas que pidió revisar el Director General**, medidas en el paso `e2e`:

| Prueba | chromium | mobile-chrome | mobile-safari |
|---|---|---|---|
| Los 4 CTA, `sin-scroll-horizontal.spec.ts:126` (antes `:119`) | 4 de 4 al primer intento, 17,4-17,5 s | 4 de 4 al primer intento, 11,3-11,4 s | 4 de 4 al primer intento |
| `auth.spec.ts:49` | Pasa al primer intento, 13,9 s | Pasa al primer intento, 12,4 s | Pasa al primer intento, 2,2 s |
| `auth.spec.ts:81` | **Falla al primer intento**, 20,6 s; pasa al reintentar, 16,4 s | Pasa al primer intento, 17,1 s | Pasa al primer intento |

- **`auth.spec.ts:81` en chromium.** El error es `page.goto: net::ERR_ABORTED` en la línea 84. Al fallar, la página ya mostraba el `h1` «Este enlace no existe». Playwright lo cuenta como flaky; aquí no se le da ese nombre porque la causa no está medida.
- **Inferencia.** La firma es compatible con la recarga de HMR, y `auth.spec.ts` no usa `evitarRecargaDeHmr`, pero `on-first-retry` no graba el primer intento.
- **Reintento.** No se colgó: es el único de toda la corrida, y el watchdog no actuó.

## COMMITS

- `92e62cd4d` fix(e2e): el Supabase sintético no hace esperar 7 s a cada lectura.
- `baa3a257c` fix(e2e): los CTA de registro no pierden la navegación por la recarga de next dev.
- `10afc8651` fix(e2e): la espera de los CTA cubre la primera compilación de /registro.
- `d6369a677` chore(harness): handoff de los CTA de registro y la recarga de next dev.
- `089e298ba` merge de `origin/main` `9d3bf7443`, el SHA que midió `verify`.
- Commit que registra este resultado: solo cambia este documento.

## PR / BRANCH

Rama `claude/e2e-cta-registro-cronometro`, [PR #365](https://github.com/SoftAgentes/DTDCARGO/pull/365) en borrador contra `main`.

## PENDIENTES DE ESTA TAREA

- `pnpm verify` no salió verde y no se repitió. El Director General decide el siguiente paso.

## FUERA DE ALCANCE DETECTADO

- **`company-photo-carousel.spec.ts`, 3 flaky.** Fallaron al primer intento en la corrida 3 y en la PR #344, y pasaron al reintentar. En la #344 no estaba este cambio, y el primero muestra el mismo error: `8 de 8` no aparece. La causa no está medida: el spec pulsa sin `esperarHidratado`, así que puede ser hidratación o esta misma recarga. En el `verify` del 2026-11-03 pasaron al primer intento.
- **Otros specs siguen expuestos a la recarga.** `evitarRecargaDeHmr` solo cubre estos 4 CTA. Cualquier prueba que espere algo largo durante la primera pasada por las rutas puede perderlo igual. `auth.spec.ts:81` podría ser un caso, sin medir.
- **El paso `test` de `verify`.** Rojo por el tope de 600 s de `prueba-migraciones-produccion.sh` y por un worker de vitest que no arrancó. Ninguno de los dos viene de esta PR.
- **Aviso de hidratación en `/`.** `next dev` registra `A tree hydrated but some attributes…` con estilos del CTA en la diferencia, 1 vez en la corrida 4 y varias en la #344. No coincide con el rojo y no lo investigué, así que no puedo decir si es del producto o de una prueba que altera el DOM.
- **`/registro` ante un 503 real.** Con Supabase respondiendo 503, `listRegisterCities` retrasa el render 7 s antes de caer a texto libre. Solo se midió contra el sintético. No es un defecto de hoy, pero `/registro` está en uso real.

## HANDOFF AL DIRECTOR

- **Siguiente acción:** decidir qué hacer con el `verify` en rojo por el paso `test`, y si se integra. La PR no toca `app/`, `components/` ni `proxy.ts`, pero sí la prueba de los CTA a `/registro`.
- **Rama detrás de `main`:** `main` ya va por `6795c4a06`, con la #367. Esa PR no toca los archivos de esta, y `merge-tree` no da conflictos. No lo traje: el merge cambiaría el SHA medido.
- **Títulos nuevos:** la prueba `los dos CTA navegan…` ya no existe; ahora son 4 con `el CTA de … navega a registro con …`.
- **Ownership:** liberado al cerrar.

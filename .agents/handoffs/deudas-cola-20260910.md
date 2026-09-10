# deudas-cola-20260910

- Fecha: 2026-09-10.
- Owner / sesión: `codex-worker-deudas-cola-20260910` / Worker Codex.
- Estado: lista-para-revision; cuatro deudas atendidas, validación global incompleta por E2E y ledger.
- Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO`.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/deudas-cola-20260910`.
- Rama: `codex/deudas-cola-20260910`; base `origin/main`, SHA `710a8e0695f416700d75e7bc42e8e5cb889751e8` (fetch verificado).
- SDD: no requiere número nuevo por asignación del Director; correcciones documentales y de arnés sobre trabajo ya especificado.
- Dependencias: ninguna; cuatro deudas independientes.
- Permisos: commits locales selectivos, push de la rama propia y PR en borrador contra main. Sin merge, deploy, aplicación de migraciones, cambios SQL, ruleset, borrado de ramas/worktrees ni nuevos IDs SDD.
- Aceptación: cuatro veredictos explícitos; un commit por deuda; comentario 0449 aditivo y fechado; causa del test medida antes/después sin debilitar cobertura; cero cambios de comportamiento de producto.
- Allowlist: comentario de `supabase/migrations/0449_prealerta_exact_box_reception.sql`; `app/studio/(app)/clientes/_components/ClientsClient.contador.test.tsx`; `scripts/tests/verify-critical-coverage.node.mjs`; `scripts/verify.mjs` solo para exportar STEPS sin alterar ejecución; spec renumerada verificada en Git; `docs/specs/README.md` solo generado; este handoff.
- Exclusiones: sentencias SQL 0449; `scripts/verify-step-policy.mjs`; guarda real de verify; cutoff y pendingBelowCutoff; workflows; ruleset; producto; debilitamiento de tests.

## OBJETIVO ORIGINAL

Cerrar las cuatro deudas chicas de la cola de fusiones del 2026-09-10 en una rama, con evidencia, commits separados y PR en borrador.

## COMPLETADO

- Aislamiento y estado limpio comprobados; guard pasó; claim exclusivo adquirido.
- Deuda 1 — CORREGIDA: se añadió debajo de la primera línea de 0449 una nota `APLICADA a producción el 2026-09-10`, conservando el comentario original como estado histórico al preparar SQL. Se sigue la convención de nota fechada existente, por ejemplo en `0397_bug_advance_state_tuteo_sobre_sdd0313.sql:3`. La fecha/prod proviene de la comprobación del Director proporcionada en el encargo; este Worker no consultó producción.
- Deuda 3 — SE DEJA ASÍ, POR COSTO DESPROPORCIONADO: `STEPS` no se puede importar con solo exportarlo. `verify.mjs` ejecuta inmediatamente su runner y termina con `process.exit`; importar desde un test del propio paso harness lanzaría el gate recursivamente. Hacerlo importable exige encapsular las 90 líneas del ejecutor (413–502) y añadir frontera CLI/import (aproximadamente 9 adiciones efectivas y 180 líneas de diff por indentación). Extraer nombres con regex sustituiría el fixture por un parser frágil; un AST añadiría dependencia al harness Node. Para higiene de prioridad baja no se justifica ese costo. El fixture duplicado permanece como limitación conocida del test, no agujero del gate: `assertCompleteStepPolicy(STEPS.map((step) => step.name))` en `verify.mjs:416` clasifica los pasos reales antes de correr y sale 1 si falta política. Guarda, política y ambos archivos permanecen intactos.
- Deuda 4 — SE DEJA ASÍ, YA DOCUMENTADA: la spec es `docs/specs/0439-portal-cliente-edicion-de-perfil/spec.md`. En «Persistencia y seguridad», líneas 104–105, ya declara que «este SDD fue renumerado desde 0435 a 0439 para resolver la colisión con otra rama». No se duplica la nota ni se altera `supersedes: null`.
  - Creación como 0435: `09f83a9e` (2026-09-04).
  - Renumeración 0435 → 0439: `8ccf8d8b307e8ecfa3e48a097ddb10c983230df0`, rename 99% (2026-09-04).
  - Nota existente de origen y motivo: `bab07a73` (2026-09-04), comprobado con `git blame`.
  - PR #27: merge `db9e63ad8bb46cab79e0ae4bf6eb50931330338c`; diff contra primer padre muestra el rename 61% del encargo. Merge `2026-09-10T01:37:41Z` (2026-09-09 en Caracas).
  - Cadena distinta, PR #38: `b031a527`, merge `7ae96093ce19dccf111d774fa47a4d9865f5e3ac`, renombra `0435-structured-user-actions` a `0449-structured-user-actions` (99%) por choque con #23.
  - PR #41: `800430c8aa159e05eb1145b882c23fedc0111786`, merge `2cc7f75caf73a1476179ecd8d26c860dbe453873`, corrige referencias y añade nota SQL en 0439 líneas 107–112; no originó la nota de renumeración.
  - Git y `gh pr view 27`, `38`, `41` contrastados. Spec e índice sin cambios.
- Deuda 2 — CORREGIDA: fixtures reducidos de 2.012 a 209 clientes, sin mocks adicionales ni cambios de timeout, componente, SQL o configuración. El caso de remanente conserva 201 filas (mínimo superior al bloque real de 200), total 252, límite 400 y botón «Ver 51 más». Los demás usan una o dos filas, manteniendo las seis comprobaciones: contador verdadero, conjunto completo, remanente real, navegación 200 → 400 con una llamada y filtros q/tier, aviso de techo con límite 1000, y total filtrado.
  - Revisión independiente detectó que reducir todos los casos a ≤2 perdería sensibilidad a un contador recortado a `CLIENTS_PAGE`; esa propuesta se descartó antes de commit. Con 201 filas, ese error anunciaría 52 restantes y falla contra los 51 exigidos. Este análisis de mutante fue por lectura, no una mutación ejecutada de producto.
  - `limite` y `topeAlcanzado` son props del servidor; no hace falta renderizar 1000 filas para comprobar aviso/ausencia de botón. Mantener distintos `clients.length`, `total` y `limite` también detecta confundir cantidad recibida con cantidad solicitada.

### Deuda 2: causa medida y comparación antes/después

Entorno: mismo worktree y máquina Windows, Node v24.20.0, pnpm v12.3.4, Vitest 4.1.7, React 19.2.4 y jsdom 29.1.1; configuración original y timeout de 20.000 ms intactos. Base `710a8e0695f416700d75e7bc42e8e5cb889751e8`. Blob Git del test final medido: `0b43b066f60a3e9ed38e824b37c8a2c708247ffd`.

Comando focal: `corepack pnpm exec vitest run ClientsClient.contador.test.tsx --reporter=verbose` (corridas sin instrumentar también con `--reporter=json --outputFile.json=<archivo temporal>`). Se usa el nombre único como filtro porque el wrapper CMD de Corepack no preserva el argumento con `(app)` en esta shell.

La instrumentación temporal usó `performance.now()` alrededor de fabricación, render, query y `user.click`, y contó nodos del contenedor después del render. Se aplicó igual antes/después y fue retirada del archivo final. Logs/JSON completos conservados fuera de Git en `%TEMP%/deudas-cola-20260910-evidence/`: `contador-before.*`, `contador-profile-before.log`, `contador-profile-final.log`, `contador-final.*`.

| Caso | Filas antes → final | Render antes → final (ms) | Nodos antes → final |
|---|---:|---:|---:|
| Contador visible | 200 → 2 | 283,00 → 82,71 | 2638 → 64 |
| Entran todos | 12 → 2 | 31,41 → 14,98 | 193 → 63 |
| Remanente de 51 | 400 → 201 | 426,74 → 251,58 | 5238 → 2651 |
| Ver más + filtros | 200 → 1 | 175,52 → 6,80 | 2639 → 52 |
| Techo | 1000 → 1 | 798,42 → 6,63 | 13038 → 51 |
| Total filtrado | 200 → 2 | 250,62 → 6,67 | 2638 → 64 |
| Total | 2012 → 209 | 1965,71 → 369,37 | 26384 → 2945 |

Fabricación total: 0,66 → 0,21 ms; query del botón: 18,71 → 9,13 ms; `user.click`: 229,31 → 53,63 ms. La fabricación de objetos no es el cuello de botella medido. El costo evitable medido está en el render/DOM sobredimensionado y en la duración completa de `user.click`; por lectura del componente, el clic provoca transiciones y rerender, pero no se aisló ese tramo con un profiler React. La reducción conserva las condiciones que ejercen las aserciones; el render total baja aproximadamente 81,2%.

Extractos pegados de las mediciones:

```text
ANTES, original sin instrumentar: 6 passed (6)
Duration 42.56s (transform 898ms, setup 3.94s, import 12.06s, tests 3.04s, environment 22.57s)

ANTES, perfil con cache caliente: 6 passed (6)
Duration 4.90s (transform 692ms, setup 100ms, import 1.15s, tests 2.72s, environment 728ms)
PROFILE_CLICK {"queryMs":18.708599999999933,"clickMs":229.31020000000035}

DESPUES FINAL, mismo perfil: 6 passed (6)
Duration 2.87s (transform 674ms, setup 105ms, import 1.13s, tests 610ms, environment 807ms)
PROFILE_CLICK {"queryMs":9.131399999999758,"clickMs":53.634700000000066}

DESPUES FINAL, sin instrumentar: 6 passed (6)
Duration 2.63s (transform 597ms, setup 99ms, import 1.02s, tests 542ms, environment 756ms)
Casos: 129ms / 41ms / 274ms / 69ms / 18ms / 9ms
```

Límites de la evidencia: la primera corrida muestra un costo de arranque/importación frío importante; no se atribuye toda la diferencia 42,56 → 2,63 s al cambio. La comparación instrumentada caliente separa ese efecto y mide tests 2,72 → 0,61 s. No se reprodujo aquí el timeout histórico de 20 s de #57; no se subió el timeout.

Validación final bajo carga: `verify` pasó 6526/6526 tests en 521 archivos, sin reintento, en 141,05 s. La caché de esa corrida (`node_modules/.vite/vitest/da39a3ee5e6b4b0d3255bfef95601890afd80709/results.json`, 521 entradas) registra el archivo de contador con `duration: 3027.7679` ms y `failed: false`. Extracto preservado como `contador-gate-cache.json` junto a los logs externos. Es la duración del archivo completo, no de cada caso individual.

## VALIDACIÓN

- PASÓ: guard, rama/base y estado inicial limpio.
- PASÓ: `corepack pnpm install --frozen-lockfile`, exit 0, 37.1 s; Node v24.20.0 / pnpm v12.3.4. Aviso de pnpm sobre `pnpm.onlyBuiltDependencies` ignorado; lockfile sin cambios.
- PASÓ: comparación de 0449 contra HEAD con Node/assert; al quitar exclusivamente la segunda línea añadida, el archivo completo coincide con el original (normalizando CRLF/LF). Ninguna sentencia SQL cambió y la primera línea permanece intacta.
- PASÓ: `node --test scripts/tests/verify-critical-coverage.node.mjs`, 6/6, cero omisiones, 84.5983 ms; diff vacío para test y `verify.mjs`.
- PASÓ: `node scripts/build-docs-index.mjs --check`, índice sincronizado, 407 specs; `git diff --check` y diff vacío para spec 0439 e índice. NO EJECUTADO: regeneración de índice, no aplica porque la nota ya existe y el índice está sincronizado.
- PASÓ: mediciones focales antes/después, 6/6 en todas las corridas; detalle y extractos arriba.
- PASÓ: `corepack pnpm harness:test`, 18/18, cero fallos/omisiones, 9724.034 ms, exit 0.
- NO EJECUTADO (completo): primer intento de `corepack pnpm verify` interrumpido voluntariamente en lint a los 63,11 s para conservar la frontera de 201 filas detectada en revisión; solo harness había pasado. No se usa como validación final. Log `verify-interrumpido.log` fuera de Git.
- PASÓ dentro de `corepack pnpm verify`: harness 18/18, lint (0 errores / 8 warnings), frontera RSC (1597 módulos), TypeScript, Edge Functions (4), unitarios (6526/6526, 521 archivos, 141,05 s, sin reintento), docs:check, numbering, feature-constants (5), components:check, governance:check, pending-migration-symbols (0 rojo / 0 amarillo), sql-tests (156 contratos en Postgres desechable, rollback total) y schema-rebuild (396 migraciones aplicadas desde cero de un inventario de 414, en Postgres desechable).
- FALLÓ: E2E. Primer intento completo: 153 passed / 15 failed / 18 skipped, 5,0 min. Cinco escenarios fallidos en cada uno de chromium, mobile-chrome y mobile-safari: formulario Studio (`auth.spec.ts:21`), formulario Back (`:91`), magic link Portal (`:98`), puertas de `/entrar` (`:105`) y redirección protegida de `/studio` (`global-search.spec.ts:22`). Los cuatro primeros no encuentran formulario/input/heading; el quinto espera `/studio/login` y permanece en `/studio/dashboard`. No se interpreta esto como acceso exitoso al buscador protegido.
- NO EJECUTADO (completo): segundo intento E2E automático. Volvió a mostrar los fallos de configuración y quedó sin avance tras los casos Mobile Safari y sus skips. Última escritura del log 18:19:28 (reloj local de la máquina); después de más de seis minutos sin salida ni JSON final se interrumpió exclusivamente el proceso E2E propio PID 19876, hijo de verify PID 40348, y sus descendientes identificados por snapshot y fecha de creación. Recibo externo: `e2e-retry-interruption.json`; cero supervivientes de la captura. Verify continuó y marcó `e2e (exit 4294967295)` como FALLÓ. No se presenta ese reintento como completo ni se absuelve el primer intento. No se cambió la política de reintentos/timeout. No hubo mensaje de cierre de worker que permita declarar la causa exacta de la espera.
- NO EJECUTADO: 18 casos E2E omitidos en el primer intento; no representan cobertura autenticada con Supabase.
- NO DISPONIBLE: `migrations-applied`, `[SKIP] sin NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY`, omitido por el runner; no se midió el ledger real ni se consultó producción.
- PASÓ: build de producción del mismo `corepack pnpm verify`, incluido postbuild Norte; el script restauró `tsconfig.json` y retiró su salida aislada. Diff final solo en las tres rutas autorizadas.
- FALLÓ: `corepack pnpm verify`, exit 1, 1368,1679 s (22 min 48 s), sobre el blob final del test y los otros cambios de esta rama. Resumen: 16 de 17 pasos ejecutados, 15 PASÓ / 1 FALLÓ (E2E) / 1 NO DISPONIBLE (migrations-applied). El reintento E2E fue interrumpido como se documenta arriba; no es una terminación natural completa de ese intento. Veredicto literal: `verify: 1 fallo(s) → e2e CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied.` Log `verify-final.log` y recibo `verify-final-result.txt` fuera de Git.
- PASÓ: revisión independiente de alcance y evidencia, `git diff --check`, allowlist exacta de tres rutas y comparación del SQL contra base. Guarda y políticas de verify intactas. NO EJECUTADO: comprobación de skills, no aplica porque no se modificó ninguna skill; no hay cambio de comportamiento que requiera nueva SDD, UI-check o aplicación de migraciones productivas.

## COMMITS

- Deuda 1: `ff08ef99` — comentario aditivo de 0449 y contrato inicial.
- Deuda 3: `67e7d2a8` — veredicto razonado de conservar el fixture.
- Deuda 4: `bfb709aa` — trazabilidad existente de PR #27 contrastada con #38 y #41.
- Deuda 2: commit que contiene esta actualización — fixture mínimo con frontera real, medición y cierre de validación.

## PR / BRANCH

Publicación y PR en borrador autorizadas, paso inmediato tras este commit. Rama `codex/deudas-cola-20260910`, base `main`, worktree indicado arriba. URL y SHA publicados se registrarán en el cierre documental de esta misma rama.

## PENDIENTES DE ESTA TAREA

- Ningún cambio de implementación pendiente para las cuatro deudas; las deudas 3 y 4 cierran con los veredictos razonados aceptados por el encargo.
- Publicar rama y abrir PR draft; registrar su URL y liberar claim al concluir la escritura.
- Cierre de validación global pendiente: revalidar E2E en un entorno con configuración Supabase aprobada y resolver/explicar la espera de su reintento; el ledger sigue NO DISPONIBLE. No se pide ni se ejecuta producción para aprobar esta corrección documental/de tests. Estas limitaciones impiden declarar el gate completo o la rama lista para merge.

## FUERA DE ALCANCE DETECTADO

- Lint existente: 8 warnings y 0 errores, fuera de los archivos modificados: variables no usadas en `NewPurchaseWizard.test.tsx` (4) y `PurchaseStepDetalle.test.tsx` (2); render impuro en `KommoBoardView.tsx:124` (1); setState en efecto en `KommoClient.tsx:553` (1). No se modificaron.
- Avisos de herramientas: pnpm v12 ignora la clave heredada `pnpm.onlyBuiltDependencies`; npx/Deno advierte sobre `auto-install-peers` y `strict-dep-builds`. Instalación congelada y compilación de Edge Functions pasaron; no se cambió configuración fuera de alcance.
- Configuración E2E incompleta: el log muestra `Your project's URL and Key are required to create a Supabase client!` en `proxy.ts:67:38`. Los error-context del reintento muestran ese Runtime Error en los cinco escenarios Chromium. Por lectura del proxy, `createServerClient` ocurre antes de `auth.getUser` y de la redirección, lo cual explica que la inicialización impida alcanzar las aserciones de formulario/redirección. No prueba que esos flujos funcionen con configuración válida ni establece una regresión causada por estas deudas. No se añadieron credenciales ni se modificó el proxy.
- Espera sin cierre del reintento E2E: evidencia y terminación acotada arriba. El Playwright 1.60.0 instalado contiene un límite por defecto de 5 minutos en `ProcessHost.stop`, pero no se recibió el mensaje que confirme esa ruta; no se declara reproducción ni causa exacta de un incidente histórico de WebKit.

## HANDOFF AL DIRECTOR

Revisar los cuatro veredictos y commits separados, especialmente la frontera de 201 filas y las mediciones caliente/frío. El alcance de producto es vacío; la única modificación de migración es el comentario aditivo. Publicación draft autorizada; integración y producción requieren sus autorizaciones separadas. La configuración/espera E2E y el ledger deben coordinarse fuera de esta allowlist. Subagentes realizaron revisiones de lectura y finalizaron; la escritura es de este Worker. Claim retenido hasta registrar la publicación y cerrar la sesión; worktree y rama se conservan.

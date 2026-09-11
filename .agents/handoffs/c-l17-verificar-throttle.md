# L17 — Reserva atómica del throttle de /verificar

Fecha: 2026-09-11. Task ID: `c-l17-verificar-throttle`.
Owner / sesión escritora: `c-l17-worker-20260911-claude`. Estado: lista-para-revision en PR borrador; **no fusionar antes de aplicar 0426** (migrate-first).
Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO`.
Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/c-l17-verificar-throttle`.
Rama: `codex/c-l17-verificar-throttle`. Base: `3c6107012f754953323202a7386b3e7811593814` (origin/main sin avance al validar).
Origen de solo lectura: `ea9952a47f4adf14c48c91e6d0147597beb94aa7`, PR #21 (no modificado).

## OBJETIVO ORIGINAL

Preparar L17 del bloque C: importar la migración 0426, su contrato SQL y la spec 0375; adoptar de forma focal la reserva atómica en la versión vigente de `lib/public/verify-throttle.ts` y su test; declarar `0426_public_verify_atomic_reservation` pendiente. PR draft contra main que se integra solo después de aplicar 0426 en producción.

## COMPLETADO

- Importados desde `ea9952a4`, idénticos por blob (`git hash-object` con y sin filtros, y en HEAD):

  | Archivo | Blob | Bytes |
  |---|---|---|
  | `supabase/migrations/0426_public_verify_atomic_reservation.sql` | `718f2e6aed17ccf644c3c1016ca2e05c2028f95d` | 5622 |
  | `supabase/tests/0426_public_verify_atomic_reservation.test.sql` | `ffbcb47f512f91634cedd10043b7a24c0dbf4468` | 14770 |
  | `scripts/check-public-verify-concurrency.mjs` | `e5bc55f2dc9bf40c73bdf89ebc30eb37241e7833` | 12660 |
  | `lib/public/verify-throttle.ts` (consumidor adoptado) | `da2cb6e0041e2ae2e16320bf2ba8208043e3f4ba` | 2710 |

- Spec `docs/specs/0375-public-verify-atomic-reservation/spec.md`: fuente `bebaa84616966b1a46d70192277a1212ecbc0041` (7263 B) más una nota de importación fechada en las líneas 16–25, con la forma de 0363/0377 y mención explícita de migrate-first. Al retirar solo la nota y su línea en blanco, el contenido es byte a byte el del origen. Frontmatter y `status: in-progress` conservados; no se marca `done`.
- **Adopción focal del consumidor.** `lib/public/verify-throttle.ts` y su test en main (`6a6ab305` / `a10ca7a5`) son idénticos a los del ancestro común `2a2e81bf` con #21: main no los tocó. Por eso el diff del origen es exactamente el diff focal sobre main, y el blob final coincide con `da2cb6e0`. Justificación por hunk (líneas del archivo nuevo):
  - 10–13 sustituyen el párrafo fail-open de main (10–13): ese texto dejaría de ser verdad.
  - 22–23 sustituyen «Ajustá las constantes si el patrón real lo pide»: las constantes ya no gobiernan el cupo, que es fijo en SQL (`0426:41-44`). El texto nuevo resume los límites de la spec §5 (líneas 52–55) y de «Release y límites» (66–70).
  - 27 `RESERVE_RPC` reemplaza `TABLE`: es el único símbolo de base que se usa.
  - 31–33 `ThrottleDb = { rpc(...) }` reemplaza el subconjunto `from/select/insert` y `CountQuery`. Sigue siendo estructural, sin importar `@supabase/*` ni `@/lib/db` (frontera ESLint de `lib/public`, `eslint.config.mjs:103-121`).
  - 35–39 documentan el contrato nuevo; 40–57 lo implementan: `false` solo con objeto, `error === null` y `data` booleano (47–52); todo lo demás o una excepción pasa por `unavailable()` (41–44, 53–56).
  - API conservada: `isVerifyThrottled(db, ip): Promise<boolean>`, `ThrottleDb`, `VERIFY_IP_LIMIT` (25) y `VERIFY_WINDOW_MINUTES` (26). Único importador: `app/verificar/page.tsx:5,209-215`. Su cast `createAdminClient() as unknown as ThrottleDb` (212) no requiere cambios y el cliente real expone `.rpc`.
- `app/verificar/page.tsx` revisado y **no modificado**: no está en la allowlist de 0375. En el origen solo difiere por comentarios de SDD-0328, y además borraría la sección `boxCode` de SDD-0443 que main tiene en 335–339.
- `lib/public/verify-throttle.test.ts`: los 22 casos del origen se conservan íntegros; el único cambio sobre el origen es la línea de import. Se añaden 11 casos:
  - los tres escenarios de la suite previa de main trasladados a la RPC; el de error invierte el fail-open por spec §6 (56–59);
  - un guard que ata `VERIFY_IP_LIMIT`/`VERIFY_WINDOW_MINUTES` al SQL de 0426;
  - seis códigos concretos de RPC ausente o con error (PGRST202, 42883, 42501, 55P03, 25000, P0001);
  - un caso de llamadas simultáneas.
- Runner de concurrencia importado porque la allowlist de 0375 lo incluye (línea 85) y es la única evidencia multiconexión que citan el contrato (`test.sql:3`) y el test del origen (líneas 1–3). **No** se cablea en `scripts/verify.mjs` ni se importa `__tests__/public-verify-concurrency-gate.test.ts`: `verify.mjs:416` exige `assertCompleteStepPolicy` sobre `scripts/verify-step-policy.mjs`, fuera de la allowlist, y L16 excluyó el gate equivalente.
- `supabase/migrations-baseline.json`: solo se agrega la espera `0426_public_verify_atomic_reservation`, en orden numérico, con «bloque C L17 / SDD-0375», MIGRATE-FIRST, OK nominal de Sam, runbook y name exacto. Al retirar esa línea, el archivo es idéntico a la base (`3c5a67d4`); cutoff 238, `$doc` y esperas 0409/0418/0419/0430 intactos.
- `supabase/pending-migration-symbol-declarations.json` **sin cambios**: el gate da 0 ROJO y 0 AMARILLO porque no detecta la RPC (ver FUERA DE ALCANCE). Una declaración haría fallar `validateDeclarations` («no identifica un único símbolo pendiente ausente», exit 2). No se silenció nada.
- Índice regenerado con `corepack pnpm docs:index`: 416 specs; 0375 sale de los huecos.

## Comportamiento ante fallo y concurrencia

**Main hoy (`6a6ab305`), fail-open.**
- `verify-throttle.ts:51-55` cuenta filas de la IP en la ventana. `:57` bloquea solo si no hubo error y el conteo llega a 40.
- Ante error de lectura, tabla ausente o ACL rota continúa. `:59-61` inserta best-effort sin mirar el resultado y devuelve `false`. Es el comportamiento que documenta el runbook (`aplicar-migraciones-prod.md:22-29`): mientras faltó 0169, `/verificar` quedó sin anti-enumeración con `student_name` expuesto.
- Bajo concurrencia, conteo e insert están separados. Reproducido con PostgreSQL 17.11 real (`--legacy`): dos conexiones leen 39, ambas insertan y quedan 41.

**Adoptado (`da2cb6e0`), fail-closed.**
- `:46` hace una sola llamada RPC. Solo `{ error: null, data: true }` permite el lookup (`:52`). `data:false` (cupo agotado o IP inválida) bloquea sin log.
- `error` no nulo, forma desconocida o excepción bloquean con un aviso genérico (`:42`) sin IP, folio ni mensaje del proveedor. No hay fallback count+insert.
- **Si falta la RPC** (0426 sin aplicar): PostgREST responde PGRST202, se bloquea, `page.tsx:216-217` omite diploma y Shipping Mark, y `:260-273` muestra «Demasiadas verificaciones» en **toda** consulta con `?c=`. La entrada manual sin código no consume cupo (`:209-215`).
- **Impacto en usuarios legítimos:**
  - con la RPC ausente o con una caída de base, nadie verifica cajas ni diplomas, y el copy atribuye falsamente el bloqueo a «muchas consultas desde tu conexión»;
  - se conserva el CTA de WhatsApp como verificación humana (`page.tsx:463-504` para cargas y `:507-540` para diplomas);
  - `lock_timeout` de 2 s (`0426:105`): una ráfaga de la misma IP que espere más de 2 s el lock recibe 55P03 y ve el estado neutro, pero el reintento funciona;
  - la RPC rechaza claves que no sean IP limpia o `unknown` (`0426:17-31`). Si el proxy entregara puerto, corchetes o zona, toda verificación quedaría bloqueada. Bajo Vercel el primer XFF es IP limpia (`request-ip.ts:5-13`), pero eso no se midió en producción.
  - Por todo esto es MIGRATE-FIRST y hace falta un smoke posdespliegue.
- **Anti-enumeración frente a main: no empeora.** Cada camino que en main permitía el lookup sin fila contada (error de lectura, insert fallido, carrera) ahora bloquea. El cupo por clave es exacto bajo concurrencia.

**READ COMMITTED (spec §4, líneas 50–51; `0426:12-16,34-45`).**
- La RPC toma `pg_advisory_xact_lock` por la clave textual `public_verify_throttle:<ip>` y después cuenta e inserta en la misma transacción.
- En READ COMMITTED cada sentencia toma un snapshot nuevo, así que el conteo posterior al lock ve la fila que el dueño anterior confirmó. Con un snapshot fijo (REPEATABLE READ o SERIALIZABLE), la transacción que esperó seguiría contando con la foto vieja y podría pasar de 40. Por eso `0426:13-16` rechaza cualquier otro nivel con 25000.
- `clock_timestamp()` se toma después del lock (`:37`): ventana y `created_at` usan la hora real de adquisición.
- El lock es transaccional: COMMIT o ROLLBACK lo liberan, y un ROLLBACK devuelve el cupo. Otra clave no espera.
- PostgREST ejecuta cada RPC en su propia transacción con el aislamiento por defecto.
- Límites (spec 66–70):
  - la atomicidad es por texto exacto, sin normalizar alias IPv6 (`0426:33`);
  - `service_role` conserva INSERT directo sobre la tabla, y una versión antigua desplegada en paralelo no respeta el lock cooperativo.

## VALIDACIÓN

Árbol de producto en `a5734d11` (base `3c610701`); el handoff se incorpora después sin tocar esos archivos. Node 24.20.0, Corepack 0.35.0, pnpm 12.3.4, Docker 29.7.2 con `postgres:17` local. Sin credenciales ni `.env`. Recibos fuera de Git en la carpeta de evidencia de la sesión (`%TEMP%/claude/.../scratchpad/c-l17-verificar-throttle/`).

| Comprobación | Estado y evidencia |
|---|---|
| `harness-worktree guard` / `claim` / `guard --owner` antes de cada commit | PASÓ |
| `corepack pnpm install --frozen-lockfile` | PASÓ; lockfile, package.json y .npmrc intactos. Aviso heredado de pnpm 12 sobre `pnpm.onlyBuiltDependencies`. |
| Blobs de los cuatro archivos importados y del consumidor | PASÓ (tabla de COMPLETADO) |
| Spec sin la nota frente al origen | PASÓ, `bebaa846` byte a byte |
| Baseline sin la línea nueva frente a la base | PASÓ, `3c5a67d4`; cutoff 238 |
| `node scripts/install-merge-drivers.mjs --check` | PASÓ (`dtd-generated-records` para baseline e índice) |
| `corepack pnpm sdd:check` | PASÓ: sin números repetidos; colisiones históricas declaradas conservadas |
| `corepack pnpm docs:index` / `docs:check` | PASÓ: 416 specs sincronizadas |
| `node scripts/check-schema-rebuild.mjs` | PASÓ: inventario de 421; 403 desde cero (incluida 0426) y 18 solo-ledger sin cambio de esquema; aislamiento multi-tenant sobre 219 tablas |
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ con límite explícito: 0 ROJO y 0 AMARILLO, antes y después del consumidor, porque el gate no detecta la RPC (punto ciego) |
| Contrato SQL 0426 (dentro del runner) | PASÓ: 63 aserciones, controles con savepoint y rollback total |
| `SQL_TEST_PG_IMAGE=postgres:17 node scripts/check-public-verify-concurrency.mjs` | PASÓ (exit 0) con PostgreSQL 17.11, `network=none`: último cupo serializado con COMMIT y con ROLLBACK, otra clave independiente, reloj posterior al lock, 55P03 propagado sin fila y con reintento, solo READ COMMITTED (3 niveles rechazados con 25000). Contenedor propio retirado. La imagen por defecto `postgres:17-alpine` no está local y el runner no descarga. |
| `... --legacy` (RED del patrón de main) | FALLÓ como se esperaba (exit 1): «Filas confirmadas=41; máximo esperado=40». Reproduce el defecto que corrige L17. |
| Vitest focal antes de adoptar (RED) | 32 fallan y 1 pasa (el guard de constantes, invariante por diseño). Un primer intento FALLÓ al arrancar el pool («Timeout waiting for worker to respond») con la CPU al 76% por verify, E2E y build de otros Workers (L02/L04/L06). No toqué sus procesos; el reintento corrió. |
| Vitest focal tras adoptar (GREEN) | PASÓ, 33/33 |
| ESLint focal (`lib/public`, `app/verificar`, runner) | PASÓ, sin errores ni advertencias |
| `corepack pnpm typecheck` | PASÓ |
| `git diff --check` y allowlist | PASÓ: 8 archivos de producto más este handoff; `app/verificar`, `verify.mjs`, `verify-step-policy.mjs`, `purge-throttle`, `request-ip`, `0169`, declaraciones y lockfile intactos |
| `corepack pnpm verify` (SHA `a5734d11`, 05:21–05:45) | FALLÓ, exit 1: corrieron 16 de 17 pasos; 15 PASÓ, E2E FALLÓ y `migrations-applied` quedó omitido. Veredicto literal: `verify: 1 fallo(s) → e2e CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied.` No se absuelve ni se presenta como verde. No hubo reintentos manuales; el vigilante marcó FIN, sin cuelgue ni procesos detenidos. |
| `/ui-check` | NO EJECUTADO: sin cambio visual; lo corre el Director si lo considera |
| E2E autenticado, `migrations-applied`, aplicación real y producción | NO DISPONIBLE / NO EJECUTADO: sin credenciales y fuera de la autorización |

Detalle del gate canónico:

| Paso | Estado y evidencia |
|---|---|
| harness | PASÓ |
| lint | PASÓ: 0 errores; 8 advertencias en archivos intactos (`NewPurchaseWizard.test.tsx`, `PurchaseStepDetalle.test.tsx`, `KommoBoardView.tsx`, `KommoClient.tsx`), las mismas que registró L16 |
| rsc-boundary | PASÓ, 1597 módulos escaneados |
| typecheck | PASÓ |
| edge-functions | PASÓ, 4 funciones compilan |
| test | PASÓ, 6713/6713 en 526 archivos, 241,45 s |
| docs:check | PASÓ |
| numbering | PASÓ, sin números repetidos |
| feature-constants | PASÓ, 5 banderas |
| components:check | PASÓ |
| governance:check | PASÓ |
| migrations-applied | NO DISPONIBLE: sin `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (SKIP); no midió el ledger real |
| pending-migration-symbols | PASÓ con límite: 0 ROJO / 0 AMARILLO por el punto ciego descrito |
| sql-tests | PASÓ: 163 contratos, incluido `0426_public_verify_atomic_reservation.test.sql`; rollback total |
| schema-rebuild | PASÓ también dentro de verify |
| e2e | FALLÓ (exit 1) y NO DISPONIBLE como validación de acceso/Supabase. Detalle debajo de la tabla. |
| build | PASÓ: compilación de producción completa (`/verificar` como ruta dinámica); `tsconfig.json` restaurado |

Detalle de e2e:

- Dev server propio en el puerto 3579.
- Primera pasada: 151 aprobados, 15 fallidos, 2 flaky y 18 omitidos (6,1 min). Reintento automático del propio verify: 152 aprobados, los mismos 15 fallidos, 1 flaky y 18 omitidos (6,2 min).
- Los 15 son `auth.spec.ts:21/91/98/105` y `global-search.spec.ts:22` en chromium, mobile-chrome y mobile-safari. El log muestra `proxy.ts:67` creando Supabase sin URL/clave: es el mismo patrón ambiental de L16.
- Flaky recuperados: `auth.spec.ts:74`, `calculadora-semantic-colors.spec.ts:53` y `smoke.spec.ts:97` (chromium).
- Ningún spec de `e2e/` menciona `/verificar` (búsqueda vacía): el E2E no ejerce la ruta de L17.
- No se persiguió la configuración ni se interrumpió el gate.

## Revisión técnica de datos (`revisar-datos-ve`, focal)

Alcance: verificación pública, `student_name` y throttle por IP. Resumen: 4 CORRECTO, 3 ENCONTRADO (preexistentes, no introducidos por L17) y 4 NO VERIFICABLE.

Inventario:

| Dato | Qué es | Finalidad | Base de licitud | Retención | Quién lo ve |
|---|---|---|---|---|---|
| `public_verify_throttle.ip` (`0169:25`) | IP textual del visitante: primer XFF, `x-real-ip` o `unknown` (`request-ip.ts:41-56`) | anti-enumeración de `/verificar` (`0169:2-10`) | NO VERIFICABLE | indefinida: sin purga | solo `service_role` (RLS sin policies `0169:38`; EXECUTE solo `service_role`, `0426:108-117`) |
| `public_verify_throttle.created_at` (`0169:26`) | hora del intento, reloj del servidor tras el lock (`0426:37,45`) | ventana de 30 min | NO VERIFICABLE | indefinida | `service_role` |
| `academy_diplomas.student_name` y datos del diploma (`page.tsx:105`) | nombre del alumno | verificación pública del diploma (`page.tsx:304`) | NO VERIFICABLE | sin cambio | cualquiera con el folio, dentro del cupo |
| Shipping Mark o folio en `?c=` y en el texto de WhatsApp (`page.tsx:219-225`) | código consultado | contacto y verificación humana | NO VERIFICABLE | no lo persiste este flujo | WhatsApp, solo si la persona pulsa |

Hallazgos:

- CORRECTO: el lookup solo ocurre tras una reserva confirmada (`verify-throttle.ts:46-52`; `page.tsx:209-217`).
- CORRECTO: el delta no captura datos nuevos. La RPC inserta solo `(ip, created_at)` (`0426:45`), la migración no tiene DML y el contrato compara filas, columnas, ACL, RLS e índices antes y después (`test.sql:61-70`).
- CORRECTO: el diagnóstico es genérico, sin IP, folio ni mensaje del proveedor (`verify-throttle.ts:42,54`). Los tests lo aseguran con `expectGenericWarning`.
- CORRECTO: la RPC es INVOKER y solo `service_role` tiene EXECUTE (`0426:104,108-117`). El contrato niega a `anon` y `authenticated` con 42501 (`test.sql:82-103`).
- ENCONTRADO: `public_verify_throttle` no tiene retención efectiva.
  - `app/api/cron/purge-throttle/route.ts:45-56` purga solo `portal_registro_throttle` y `operario_pin_attempts`.
  - `0169:18` afirma que el cron «puede limpiarla».
  - `docs/legal/privacidad/AUDITORIA-2026-07.md:61` dice «throttle purga» y le atribuye `ip_address`/`user_agent`, que no existen en `0169:23-27`.
  - Principio de temporalidad (SC 332/2001; checklist, puntos 2 y 5).
  - Arreglo en SDD propio: agregar la tabla al cron con una retención mayor que la ventana de 30 min y corregir el documento. La spec 0375 prohíbe inventar el plazo aquí (líneas 75–77).
- ENCONTRADO: la IP como clave de control depende del proxy. Fuera del edge de Vercel, quien controle el primer XFF puede evadir el cupo (`request-ip.ts:18-25`). Además, `unknown` es un bucket compartido (`:55,67`).
- ENCONTRADO: un cupo por IP no impide la enumeración distribuida de folios secuenciales que exponen `student_name` (`0169:5-10`; `page.tsx:304`). L17 no lo cambia.
- NO VERIFICABLE:
  - base de licitud y aviso de privacidad sobre la IP en `/verificar`;
  - formato real del XFF y comportamiento alojado de la RPC y el consumidor (0426 no aplicada);
  - retención en respaldos y logs de Vercel o Supabase;
  - filas reales, que no se leyeron.

Punto 12 (titulares que no son usuarios): quien escanea una caja, sea almacén o destinatario, deja su IP; el alumno ve su nombre expuesto a quien tenga el folio. Ambas cosas son preexistentes. Fuera de alcance, para un abogado: base de licitud, texto de la política y plazo de conservación. **Esto no es asesoría legal.**

## COMMITS

- `abe129bfa75bc181f54c26c973dba49e772bfbd7`: migración 0426, contrato, runner de concurrencia, spec 0375 con nota (blob `5ac88ba9`), baseline e índice (expansión sin consumidor).
- `a5734d11ba09130da879c4fe3b881a9553ce46f1`: consumidor `verify-throttle.ts` (`da2cb6e0`) y su test (`065aa435`, 7952 B: los 22 casos del origen `1e21676c` más 11 nuevos) (adopción).
- Commit que contiene este documento: cierre durable del handoff; hash final en la PR.

## PR / BRANCH

[PR #80 en borrador](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/80), base `main`, rama `codex/c-l17-verificar-throttle`. Título: «[NO FUSIONAR ANTES DE APLICAR 0426] feat(DTD-0375): L17 reserva atómica del throttle de /verificar (migrate-first)». Rama publicada explícitamente a sí misma; sin merge ni aplicación de migraciones. El SHA final es el commit que contiene este documento; su CI se reporta en la PR.

## PENDIENTES DE ESTA TAREA

- Revisión del Director y CI alojado del último SHA; la PR queda en borrador.
- La fusión exige, en este orden:
  1. OK nominal de Sam;
  2. aplicar `0426_public_verify_atomic_reservation` según el runbook (fuera de esta tarea);
  3. verificar en producción la función, `SECURITY INVOKER`, `proconfig`, ACL solo `service_role` y la recarga de PostgREST;
  4. retirar la espera 0426 del baseline en esta rama, como hizo `b49f1c0b` en L16;
  5. después, merge, despliegue y smoke.
- E2E autenticado y ledger real sin validar por falta de credenciales.

## FUERA DE ALCANCE DETECTADO

1. **Punto ciego de `pending-migration-symbols`:** `maskSqlNonCode` (`scripts/check-pending-migration-symbols.mjs:153-160`) enmascara bloques con dollar-quote. Una función creada con DDL dinámico dentro de `DO $migration$ … execute` (`0426:102-107`) no se detecta. Resultado: 0 ROJO aunque `lib/public/verify-throttle.ts:27` sea alcanzable y dependa de una RPC pendiente. Merece un SDD propio del gate.
2. Retención de `public_verify_throttle`, comentario de `0169:18` y fila inexacta de `docs/legal/privacidad/AUDITORIA-2026-07.md:61` (ver la revisión de datos).
3. El copy de throttle (`page.tsx:262-271`) se muestra también ante una falla de infraestructura (fail-closed). Cambiarlo es una decisión de UI y ERR-01 separada; 0375 excluye cambios visuales (SGE-00.10).
4. `docs/specs/0374-public-verify-fail-closed/spec.md` está en main `in-progress`, sin su código (import documental `b6da9457`); L17 cubre su contrato fail-closed mediante 0375. Actualizar su estado corresponde al Director.
5. Cablear el runner en `scripts/verify.mjs` + `verify-step-policy.mjs` + su test de gate es una decisión pendiente. El runner usa por defecto `postgres:17-alpine` y `run-sql-tests.mjs:37` usa `postgres:17`: defaults inconsistentes.
6. Quien integre #21 completo no debe tomar su `app/verificar/page.tsx`: borraría la sección `boxCode` de SDD-0443.
7. Carga de la máquina: tres verify de otros Workers en paralelo provocaron un timeout de arranque del pool de Vitest (ya documentado). Aviso heredado de pnpm sobre `pnpm.onlyBuiltDependencies`.

## HANDOFF AL DIRECTOR

- Orden de release: OK nominal → aplicar 0426 sola, con name exacto → verificar catálogo y ACL → retirar la espera del baseline en esta rama → merge → despliegue → smoke con un `/verificar?c=` legítimo que no muestre «Demasiadas verificaciones», revisando que no aparezca `[public-verify] Control de intentos no disponible` en logs.
- Rollback: revertir la PR del consumidor reabre la carrera y el fail-open de main. No borrar la tabla ni sus filas; la función aditiva puede quedarse (spec «Reversión», línea 139 en adelante).
- Compartidos con #69–#76, L02, L04 y L06: baseline e índice (driver `dtd-generated-records`). Unir por entradas; no hay otros solapamientos.
- El push disparó CI («Calidad continua») y un preview de Vercel, ambos automáticos del proveedor; no hubo deploy manual. Si ese preview apunta a una Supabase sin 0426, `/verificar` bloquea ahí todas las consultas sin escribir filas, y producción no se ve afectada. La configuración de entorno del preview no es verificable desde aquí.
- Autorizado y usado: edición focal, instalación congelada, validación local y efímera, commits selectivos, push de la rama propia y PR draft. No hubo merge, aplicación de 0426, lectura de producción ni deploy.
- Ownership: se libera al cierre con `node scripts/harness-worktree.mjs release --owner c-l17-worker-20260911-claude`. Worktree y rama se conservan.

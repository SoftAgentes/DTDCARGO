# L17 — Reserva atómica del throttle de /verificar

Fecha: 2026-09-11. Task ID: `c-l17-verificar-throttle`.
Owner / sesión escritora ronda 1: `c-l17-worker-20260911-claude`; ronda 2: `claude-worker-l17-r2`. Estado: **0426 aplicada en producción** (2026-09-12, ledger `20260912022928`); la rama ya no es migrate-first y queda lista para revisión del Director. El merge lo serializa él.
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

**Actualización de la ronda 2 (2026-09-12):** ese título y ese cuerpo quedaron obsoletos al aplicarse 0426. El título pasa a «feat(DTD-0375): L17 reserva atómica del throttle de /verificar (0426 ya aplicada)», sin prefijo de bloqueo, y la PR sale de borrador en el mismo acto del push. El cuerpo se reescribió; el anterior está respaldado fuera de Git (ver «Cuerpo de la PR reescrito»). Lo de arriba se conserva como evidencia fechada de la ronda 1.

## RONDA 2 — 0426 APLICADA EN PRODUCCIÓN (retiro de la espera)

Fecha: 2026-09-12. Owner / sesión escritora de esta ronda: `claude-worker-l17-r2`
(claim propio; la ronda 1 fue `c-l17-worker-20260911-claude`). Ruta y rama sin
cambios. Base al empezar: `07e54dfc` (head publicado y revisado por el Director).
`origin/main` al fusionar: `0413d4a1`.

Encargo del Director: 0426 ya está aplicada en producción con OK nominal de Sam
—ledger `20260912022928`, md5 `8e4f06a4ce6f02dfb0aa2af683a92e37`, 5622 B,
idénticos al archivo de esta rama— y verificada por él contra el objeto real.
Esta PR deja de ser migrate-first. **No** se autorizó merge, deploy, escritura
en producción ni lectura de filas de negocio; nada de eso se hizo.

Verificación del Director sobre el objeto real, para contraste:
`reserve_public_verify_attempt(text)` en plpgsql, SECURITY **INVOKER** (no
definer, como exige su contrato), volátil, `proconfig` con `search_path=""` y
`lock_timeout=2s`, ACL `{postgres=X, service_role=X}` — `authenticated`, `anon`
y PUBLIC sin EXECUTE — y el comentario de SDD-0375. `public_verify_throttle`
intacta: RLS activa, misma ACL, 0 policies.

### Merge de main con el override del driver

Por qué hacía falta el override: `git config merge.dtd-generated-records.driver`
vale `node scripts/merge-generated-records.mjs %O %A %B %P`, una ruta **relativa
al árbol de la rama**. Sin override, git habría ejecutado el driver viejo que
vive en esta rama, no el de main. Comando usado:

```sh
git fetch origin
drv="$(cygpath -m "$TEMP")/dtd-merge-driver-main.mjs"
git show origin/main:scripts/merge-generated-records.mjs > "$drv"
git -c merge.dtd-generated-records.driver="node \"$drv\" %O %A %B %P" merge origin/main
```

Merge limpio, sin conflictos, en su propio commit `2e6c6a4d`, separado de la
retirada de la espera.

**Medición con los tres blobs de verdad.** Base `3c610701` (merge-base), ours
`07e54dfc`, theirs `0413d4a1`, sobre `supabase/migrations-baseline.json`, con
los dos drivers ejecutados de verdad (no leídos):

| Entrada | `pendingBelowCutoff` |
|---|---|
| %O base | 4: 0409, 0418, 0419, 0430 |
| %A ours | 5: esas 4 más 0426 |
| %B theirs (main) | 0 — main ya las retiró todas |

| Driver | md5 | Resultado |
|---|---|---|
| viejo (`HEAD:scripts/merge-generated-records.mjs`) | `5cbfb238b56153097991000f5a44c361` | **5 esperas**: 0409, 0418, 0419, 0430, 0426 |
| main (`origin/main:scripts/merge-generated-records.mjs`) | `b4563696716d6893d48e619ec0e9eca4` | **1 espera**: sólo 0426 |

**El driver viejo habría resucitado 4 esperas** que main ya retiró:
`0409_bank_reconciliation_rbac`, `0418_portal_academia_tenant_boundary`,
`0419_portal_reclamos_tenant_boundary` y
`0430_portal_profile_change_requests_principal_tenant`. Causa exacta, en el
driver viejo:

```js
if (currentValue === MISSING || otherValue === MISSING) {
  const present = currentValue === MISSING ? otherValue : currentValue;
  ...
  result[key] = present;
```

trata cada clave como unión de entradas, así que un retiro unilateral pierde
contra la conservación. El de main invierte ese caso: con `baseValue !== MISSING`
y un solo lado ausente, gana el retiro, porque quitar una espera es el acto que
registra la aplicación de su migración. La única espera que sobrevivió al merge
fue la propia 0426 (alta unilateral de esta rama frente a base ausente), y se
retiró a mano en el commit siguiente por estar aplicada.

### Retiro de la espera (punto 2) y declaraciones (punto 3)

- `supabase/migrations-baseline.json`: se tomó el blob de main
  (`git checkout origin/main -- <archivo>`) para garantizar identidad byte a
  byte, ya que tras el merge la única diferencia era la entrada 0426.
  `git diff origin/main -- supabase/migrations-baseline.json` **VACÍO**; md5 del
  archivo y del blob de main coinciden (`59b976cfd391f9431e23f11e41a04046`);
  `cutoff` 238 y `pendingBelowCutoff` en `{}`. Commit `2e7b862c`.
- `supabase/pending-migration-symbol-declarations.json`: `git diff origin/main`
  **VACÍO** sin tocar el archivo. `degradations` está en `[]` en las tres
  revisiones (base, ours y main): esta rama nunca declaró una degradación para
  0426, así que no había nada que retirar. Ya no aparece en el diff.

### Auditoría del camino degradado (punto 3)

`lib/public/verify-throttle.ts` **no tiene** un guardia específico de «RPC
inexistente». No inspecciona `PGRST202` ni `42883` ni ningún código: hay un solo
camino de degradación, `unavailable()` (líneas 41–44), al que llegan por igual
la forma inesperada, `error !== null` y cualquier excepción (47–51, 53–56).
Consecuencia:

- **No queda código muerto** tras aplicar 0426, y no se borró nada.
- El manejo genérico de errores de PostgREST **sigue vivo y necesario**:
  `lock_timeout` de 2 s bajo contención de una misma IP (55P03), cortes de red,
  caché de esquema recargando tras un deploy, un cambio de ACL, un 25000 si
  alguien cambia el aislamiento.
- Lo que habría sido código muerto es justamente un guardia dedicado a la
  ausencia de la RPC — y no existe. Los códigos `PGRST202`/`42883` aparecen sólo
  como **entradas de test** en `verify-throttle.test.ts:159-166`, alimentando ese
  camino genérico; siguen siendo escenarios válidos.

### Nota de importación de la spec (punto 4)

`docs/specs/0375-public-verify-atomic-reservation/spec.md` pasa de «declarada
pendiente / no se ha aplicado» a aplicada, con el formato ya integrado en main
de `0339-referidos-portal-por-principal`, `0342-documentos-portal-por-principal`
y `0337-visibilidad-portal-por-principal`: fecha de actualización, ledger
`20260912022928`, md5 y bytes, remisión a este handoff y la constancia de que
0426 ya no figura como espera ni tiene declaración. Se conserva
`status: in-progress` y se dice por qué: la aceptación de release/smoke
posdespliegue sigue abierta y no la decide esta rama. Commit `3fcba092`.

### Índice de specs: 433, medido (punto 5)

`node scripts/build-docs-index.mjs` (docs:index) fue **no-op**: el merge ya
había dejado el índice correcto, y `git status` no marcó el archivo. Medido con
`docs:check`, no asumido: **433 specs · 24 huecos**, contra **432** en main. El
delta es exactamente +1, la propia 0375, y 0375 sale de la lista de huecos
(de 25 a 24). Cuadra, así que no hubo que forzar nada.

### Barrido de texto rancio (punto 6)

Commit propio `1dc9fe94`, sólo prosa: ni una aserción cambia y el archivo de la
migración no se toca. Los dos nombres de test se corrigieron después, en
`6fb9d2e9`, tras la revisión del Director (ver abajo).

- `lib/public/verify-throttle.ts:13`: «Aplicar/verificar 0426 antes de desplegar
  este consumidor» describía un estado superado → registra la aplicación. La
  línea anterior («Sin RPC o ante incertidumbre bloquea, sin fallback») es
  comportamiento permanente y queda igual.
- spec §«Release y límites»: el mandato en futuro pasa a hecho fechado, y el
  orden migrate-first se enuncia como regla a conservar en una reaplicación.
- spec §aceptación: la casilla mezclaba «Aplicación 0426» con «release/smoke» y
  decía «no autorizados», que ya es falso. Se separan: aplicación hecha y
  autorizada nominalmente `[x]`; smoke posdespliegue `[ ]`, fuera de esta rama.

**Dos nombres de test corregidos tras la revisión del Director** (commit propio
`6fb9d2e9`). Los dejé intactos en la primera pasada y se los consulté; él afinó
la regla: no es «nunca toques un nombre de test», es **no toques un nombre que
describe fielmente el escenario que el test simula**. Estos dos no hacían eso,
así que sí cambian:

- `verify-throttle.test.ts:158` — el `describe` decía «isVerifyThrottled · RPC
  ausente o con error de base **(migrate-first)**». La parte que describe el
  escenario —RPC ausente o con error de base— es correcta y se queda;
  «(migrate-first)» no describe un escenario sino el orden de trabajo del
  proyecto, que ya pasó. Sale sólo ese paréntesis.
- `verify-throttle.test.ts:160` — la etiqueta de `PGRST202` decía «función fuera
  de la caché de esquema: **0426 sin aplicar**». Eso no describe el mock:
  afirma un estado del despliegue, y ya es falso. Queda la causa genérica y se
  reemplaza la afirmación por las causas que siguen vivas: «caché desactualizada
  o DROP FUNCTION». La ACL revocada ya tiene su propia fila (`42501`).

El contraste que marcó el Director: un nombre que dice «sin la RPC 0405» describe
la condición que el test arma con un mock —la RPC respondiendo como ausente— y
por eso se conserva; el nuestro afirmaba un hecho sobre producción. Uno nombra el
escenario, el otro afirma un hecho.

Alcance real del cambio: **2 líneas**, sin tocar aserciones, sin tocar los
códigos de error y sin cambiar la estructura del `it.each`. Suite focal 33/33 en
verde después.

Falsos positivos descartados al barrer:
`scripts/check-public-verify-concurrency.mjs:149` y spec 83–85
(«inde**pendiente**s»), spec 98 («es**pera**» = espera de lock), y las filas de
otras specs en `docs/specs/README.md`.

### La migración no se tocó (punto 7)

`supabase/migrations/0426_public_verify_atomic_reservation.sql`: md5
`8e4f06a4ce6f02dfb0aa2af683a92e37`, 5622 B, blob `718f2e6a` — idéntico al de
`07e54dfc`, comprobado con `git rev-parse` en los dos árboles. Su encabezado
«Aplicar/verificar nominalmente antes del consumidor» **no está rancio**:
enuncia una regla permanente de orden, no un estado, igual que ya se resolvió
para 0403.

### Validación de la ronda 2

Invariantes del encargo, medidas una por una:

| Comprobación | Resultado |
|---|---|
| Guard (`harness-worktree.mjs guard`) y claim propio `claude-worker-l17-r2` | PASÓ |
| Raíz, rama y HEAD de partida (`07e54dfc`) antes de editar; árbol limpio | PASÓ |
| Merge de main con el override del driver, sin conflictos, en commit propio | PASÓ |
| Medición de los dos drivers con los tres blobs reales | PASÓ — el viejo resucitaba 4 esperas; el de main, ninguna |
| **Punto 2** · `git diff origin/main -- supabase/migrations-baseline.json` | PASÓ — **VACÍO**; md5 `59b976cf…` igual al blob de main; cutoff 238, `pendingBelowCutoff` `{}` |
| **Punto 3** · `git diff origin/main -- supabase/pending-migration-symbol-declarations.json` | PASÓ — **VACÍO**; `degradations` `[]`, archivo no tocado |
| **Punto 7** · md5 y bytes de `0426_public_verify_atomic_reservation.sql` | PASÓ — `8e4f06a4ce6f02dfb0aa2af683a92e37`, 5622 B, blob `718f2e6a`, idéntico a `07e54dfc` |
| **Punto 5** · conteo del índice medido con `docs:check`, no asumido | PASÓ — 433 aquí contra 432 en main; delta +1 = 0375 |
| `git diff --check` | PASÓ |
| Vitest focal `lib/public/verify-throttle.test.ts` | PASÓ — 33/33 antes y después de corregir los dos nombres; sin tocar aserciones, códigos de error ni la estructura del `it.each` |

`corepack pnpm verify` completo sobre el árbol ya fusionado: **FALLÓ, exit 1**.
Corrieron 16 de 17 pasos; 14 PASÓ, 1 NO DISPONIBLE y 1 FALLÓ.

| Paso | Resultado |
|---|---|
| harness | PASÓ — 35 pruebas, incluidas las del watchdog de SDD-0454 |
| lint | PASÓ |
| rsc-boundary | PASÓ — 1598 módulos, sin cruces server→client ni client→node |
| typecheck | PASÓ |
| edge-functions | PASÓ — 4 funciones compilan |
| test (Vitest completo) | PASÓ — 539 archivos, 6792 pruebas |
| docs:check | PASÓ — índice sincronizado con 433 specs |
| numbering | PASÓ — sin números repetidos |
| feature-constants | PASÓ — 5 banderas |
| components:check | PASÓ |
| governance:check | PASÓ |
| migrations-applied | **NO DISPONIBLE por configuración ausente** — SKIP por falta de `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`; no hay `.env.local` en este worktree ni en el checkout principal (sólo `.env.example`) |
| pending-migration-symbols | PASÓ — 0 ROJO · 0 AMARILLO declarado |
| sql-tests | PASÓ — 177 contratos con rollback total, incluido `0426_public_verify_atomic_reservation.test.sql` |
| schema-rebuild | PASÓ — 434 migraciones en inventario, 416 aplicadas desde cero, 18 sólo-ledger, aislamiento sobre 219 tablas + 2 tenants reales |
| e2e | **FALLÓ / NO DISPONIBLE por configuración ausente** — ver abajo |
| build | PASÓ — build de producción OK |

Cierre del propio verify: «16 de 17 pasos corrieron de verdad … CIERRE ADEMÁS
INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied». **Exit 0 no habría
significado cobertura completa y exit 1 aquí no invalida el producto**: lo que
falta es entorno, no código.

#### El paso e2e: NO DISPONIBLE por configuración ausente, y un punto de cuelgue NUEVO

Se registra como **NO DISPONIBLE por configuración ausente**, siguiendo la
medición previa del Director: sin `.env.local` en ninguna máquina, el dev server
levanta sin credenciales de Supabase y `proxy.ts:67` revienta en cada ruta
autenticada. No se reintentó a mano, no se tocó configuración y no se absolvió.
El CI alojado es el que decide.

El watchdog de SDD-0454 funcionó como se diseñó: cortó por inactividad a los
10 min (`VERIFY_E2E_IDLE_MIN`), terminó **sólo** el árbol de procesos del paso
—raíz PID 6492, 25 procesos: `chrome-headless-shell.exe`×15, `node.exe`×9,
`cmd.exe`×1— con **0 sobrevivientes**, y lo declaró FALLÓ con motivo en vez de
omitido.

**Tercer punto de cuelgue, y qué lectura tiene.** El corte ocurrió en un punto
distinto a los dos ya medidos. No fue tras `[mobile-safari] auth.spec.ts:74` ni
en un reintento: fue en la **primera pasada**, que nunca terminó ni llegó a
lanzar reintento (un solo `Running 186 tests using 8 workers`). Quedó muda en el
**caso 168 de 186**, después de:

- último OK: `165 [mobile-safari] cbm-ayuda.spec.ts:111`;
- y tres omitidos seguidos: `166 [mobile-safari] comments-lifecycle.spec.ts:108`,
  `167 [mobile-safari] gastos-expense-void.spec.ts:76`,
  `168 [mobile-safari] gastos-expense-void.spec.ts:99`.

Los tres puntos medidos hasta ahora son, entonces:

1. primera pasada, tras `[mobile-safari] auth.spec.ts:74`;
2. reintento, mudo a los 123 casos;
3. esta ronda: primera pasada, caso 168/186, tras `[mobile-safari] cbm-ayuda.spec.ts:111`.

**Lectura del Director, y es la que vale: tres puntos distintos confirman la
hipótesis, no la contradicen.** Que el cuelgue caiga cada vez en un sitio
diferente es más consistente con «el runner bajo carga, con el servidor caído»
que con «hay un test que se cuelga»: si fuera un test, se colgaría siempre en el
mismo. Nada de esta ronda toca el e2e, el dev server ni la configuración.

Conteo de la pasada interrumpida: 123 OK, 15 fallos ambientales finales, 8
omitidos. Los 15 fallos son exactamente el conjunto conocido de `proxy.ts:67`:
`auth.spec.ts` 21/74/91/98/105 en chromium (5), 21/91/98/105 en mobile-chrome y
en mobile-safari (4+4), más `global-search.spec.ts:22` en chromium y
mobile-chrome (2).

**Sobre el «tercer flake»: no es un flake, y no se levanta tarea de flakes.**
Esta ronda flakeó `smoke.spec.ts:97` («las rutas viejas de calc/estimación
redirigen (301)»), que falló en chromium y se recuperó en el reintento #1;
los dos conocidos —`calculadora-hidratacion.spec.ts:42` y `smoke.spec.ts:150`—
pasaron limpios. El Director retiró expresamente su propia regla de «un tercero
distinto ya es tarea», y con razón: los tres se midieron en corridas donde **el
WebServer está roto** por falta de credenciales de Supabase. En un servidor
degradado, cualquier test que cargue una página puede fallar de forma
intermitente. **No son tres observaciones independientes de inestabilidad del
producto: son tres observaciones de que no podemos medir inestabilidad del e2e
en estas máquinas.** Que nadie salga a cazar tests inestables con datos que no
lo sostienen.

La tarea real, que estos datos refuerzan, es la que el Director ya tenía
anotada: **conseguir que el e2e autenticado se pueda correr en algún lado.**
Mientras tanto, el CI alojado es el que decide.

### Cuerpo de la PR reescrito (declaración explícita)

El cuerpo de la PR #80 era el registro más rancio del conjunto: abría con «No
fusionar antes de aplicar 0426 (migrate-first)» y listaba como pendientes pasos
ya hechos. **Reescribirlo va más allá del punto 6 del encargo, así que queda
declarado aquí.** El cuerpo y el título anteriores se guardaron **fuera de Git**
en `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/_pr-bodies-backup/pr80-body-antes-ronda2.md`
(6876 B), comprobado como externo al repositorio con `git check-ignore`. Lo
técnico que seguía siendo cierto se conserva; lo que cambia es el encabezado, el
bloque de release, el conteo del índice (416 → 433), el estado de la baseline y
de las declaraciones, y se añade la auditoría del camino degradado.

### Commits de la ronda 2

- `2e6c6a4d` — merge de `origin/main` (`0413d4a1`) con el override del driver, solo.
- `2e7b862c` — `chore(db): retirar la espera 0426 aplicada`.
- `3fcba092` — `docs(specs): registrar 0426 aplicada a producción en la spec 0375`.
- `1dc9fe94` — `docs(DTD-0375): el consumidor y la spec ya no anuncian 0426 como pendiente`.
- `d4a35546` — `docs(handoff)`: cierre inicial de la ronda 2.
- `6fb9d2e9` — `docs(DTD-0375): dos nombres de test dejan de afirmar el estado del despliegue`, tras la revisión del Director.
- El commit que contiene esta versión del documento cierra la ronda con sus tres correcciones aplicadas.

Diff contra `origin/main` tras la ronda: **8 archivos** (antes 9).
`supabase/migrations-baseline.json` salió del diff al quedar idéntico a main, y
`supabase/pending-migration-symbol-declarations.json` nunca estuvo.

## PENDIENTES DE ESTA TAREA

Estado tras la ronda 2 (2026-09-12):

- Los pasos 1–4 del orden de release **están hechos**: OK nominal de Sam, 0426
  aplicada con name exacto (ledger `20260912022928`), verificación del objeto
  real (función, `SECURITY INVOKER`, `proconfig`, ACL sólo `service_role`) y
  retiro de la espera del baseline en esta rama.
- Queda, y **no lo decide esta rama**: revisión del Director, CI alojado del SHA
  publicado, merge (lo serializa él), despliegue y smoke posdespliegue.
- `migrations-applied` y el E2E autenticado siguen **NO DISPONIBLES por
  configuración ausente** en local: no hay `.env.local` en este worktree ni en
  el checkout principal. El CI alojado es el que decide.
- La spec 0375 se mantiene en `status: in-progress` a propósito: su única
  casilla abierta es el release/smoke posdespliegue.
- Secuencia acordada con el Director para esta ronda: van #83 y #75 antes; todo
  queda commiteado **sin push** hasta que él mande el SHA. Después del push la
  rama se congela hasta que él fusione — no se empujan commits de handoff sobre
  un CI en marcha.

## FUERA DE ALCANCE DETECTADO

1. **Punto ciego de `pending-migration-symbols`:** `maskSqlNonCode` (`scripts/check-pending-migration-symbols.mjs:153-160`) enmascara bloques con dollar-quote. Una función creada con DDL dinámico dentro de `DO $migration$ … execute` (`0426:102-107`) no se detecta. Resultado: 0 ROJO aunque `lib/public/verify-throttle.ts:27` sea alcanzable y dependa de una RPC pendiente. Merece un SDD propio del gate. *(Ronda 2: ya no afecta a esta PR —0426 está aplicada y no hay espera— pero el punto ciego sigue vivo para la próxima migración que se cree así.)*
2. Comentario de `0169:18` y fila inexacta de `docs/legal/privacidad/AUDITORIA-2026-07.md:61` (ver la revisión de datos). La retención de `public_verify_throttle` ya la atendió DTD-0455 en main (`ab86cd12`, purga a 60 min).
3. El copy de throttle (`page.tsx:262-271`) se muestra también ante una falla de infraestructura (fail-closed). Cambiarlo es una decisión de UI y ERR-01 separada; 0375 excluye cambios visuales (SGE-00.10).
4. `docs/specs/0374-public-verify-fail-closed/spec.md` está en main `in-progress`, sin su código (import documental `b6da9457`); L17 cubre su contrato fail-closed mediante 0375. Actualizar su estado corresponde al Director.
5. Cablear el runner en `scripts/verify.mjs` + `verify-step-policy.mjs` + su test de gate es una decisión pendiente. El runner usa por defecto `postgres:17-alpine` y `run-sql-tests.mjs:37` usa `postgres:17`: defaults inconsistentes.
6. Quien integre #21 completo no debe tomar su `app/verificar/page.tsx`: borraría la sección `boxCode` de SDD-0443.
7. Carga de la máquina: tres verify de otros Workers en paralelo provocaron un timeout de arranque del pool de Vitest (ya documentado, ronda 1). Aviso heredado de pnpm sobre `pnpm.onlyBuiltDependencies`.
8. **El e2e autenticado no se puede correr en estas máquinas.** Es la tarea real que estos datos refuerzan, y la única que corresponde levantar del e2e. Sin `.env.local` en ningún árbol, el WebServer arranca roto (`proxy.ts:67`) y ni `migrations-applied` ni el e2e cierran. Mientras tanto decide el CI alojado.
9. **El cuelgue del e2e local: tres puntos distintos, misma lectura.** (1) primera pasada tras `[mobile-safari] auth.spec.ts:74`; (2) reintento, mudo a los 123 casos; (3) esta ronda, primera pasada, caso 168/186 tras `[mobile-safari] cbm-ayuda.spec.ts:111`. Que caiga cada vez en un sitio distinto es más consistente con «el runner bajo carga con el servidor caído» que con «hay un test que se cuelga»: si fuera un test, sería siempre el mismo. Ajeno a esta PR. El watchdog de SDD-0454 hizo lo suyo las tres veces.
10. **No se levanta tarea de flakes, a propósito.** `smoke.spec.ts:97` (esta ronda), `calculadora-hidratacion.spec.ts:42` y `smoke.spec.ts:150` se midieron todos con el WebServer roto por falta de credenciales. En un servidor degradado cualquier test que cargue una página puede fallar intermitentemente: no son tres observaciones independientes de inestabilidad del producto, son tres observaciones de que no podemos medir inestabilidad del e2e en estas máquinas. Que nadie salga a cazar tests inestables con datos que no lo sostienen. El Director retiró expresamente su regla previa de «un tercero distinto ya es tarea».

## HANDOFF AL DIRECTOR

- **0426 está aplicada**: ledger `20260912022928`, md5 `8e4f06a4ce6f02dfb0aa2af683a92e37`, 5622 B, idéntico al archivo de esta rama. El archivo de la migración **no se tocó en esta ronda** (blob `718f2e6a`, igual que en `07e54dfc`): ese md5 contra el payload del ledger es la única prueba de que lo que corrió en producción es lo que está en el repo.
- Resto del orden de release: merge (lo serializás vos) → despliegue → smoke con un `/verificar?c=` legítimo que no muestre «Demasiadas verificaciones», revisando que no aparezca `[public-verify] Control de intentos no disponible` en logs.
- Rollback: revertir la PR del consumidor reabre la carrera y el fail-open de main. No borrar la tabla ni sus filas; la función aditiva puede quedarse (spec «Reversión»). Con 0426 ya aplicada, revertir el código **no** desaplica la migración.
- Compartidos con el resto del lote: índice de specs (driver `dtd-generated-records`). La baseline y las declaraciones ya no están en el diff, así que dejaron de ser superficie de conflicto para esta PR.
- Merge de main hecho **con el override del driver**; sin él se resucitaban 4 esperas ya retiradas. La medición está arriba.
- Autorizado y usado en esta ronda: edición focal, merge de `origin/main` en la rama propia, validación local, commits selectivos y reescritura del cuerpo de la PR (declarada). **No** hubo push, merge a main, aplicación de migraciones, lectura de filas de producción ni deploy.
- Ownership de la ronda 2: `node scripts/harness-worktree.mjs release --owner claude-worker-l17-r2` al terminar la escritura. Worktree y rama se conservan.

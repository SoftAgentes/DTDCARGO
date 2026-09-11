# Validación SDD-0452

Dueño: Worker `worker-sanitizer-0452-20260910-root`. Fecha: 2026-09-10.
Estado: SDD `done`; aceptación 5 resuelta por decisión del Director comunicada
por Sam. Cierre local con límites de entorno explícitos; PR sigue en borrador.
Base inicial: `b7ad23977b1905a25ba3154e52238f0e7baaaaa4`.
La validación usa entradas sintéticas. Consultar archivos archivados está
excluido; el incidente de alcance se registra abajo. No se incorporan claves reales.

Las secciones históricas conservan los recibos del bloqueo previo en
`d54f232c`; no describen la aceptación vigente. La decisión y sus condiciones
de revisión viven en los trade-offs de [la spec](spec.md).

## Reanudación de cierre, 2026-09-10

- PASÓ: árbol inicialmente limpio en `d54f232c`, guard y claim del mismo owner.
- PASÓ: `git fetch origin` y merge de `origin/main` en la rama propia, sin
  reescritura ni conflictos: `e736c089b393ae89786e497726bbfecf76bb4088` incorpora
  `e325cb4deb7d11375aa2dbca348496177d1e4350`. No integra esta PR a main.
- PASÓ: los 92 casos previos permanecen idénticos normalizando CRLF; los tres
  adversariales conservan sus entradas y exigen `[REDACTED]`. Revisión
  independiente del diff confirma ausencia de skip/todo o cambios positivos.
- PASÓ: focal real `node node_modules/vitest/vitest.mjs run
  scripts/tests/bug-sanitizer.test.ts`, 95/95, exit 0.
- PASÓ: `corepack pnpm harness:test`, 26/26, seis archivos descubiertos;
  E1 5/5 y contratos de descubrimiento 3/3.
- Sanitizador idéntico a `d54f232c`: SHA-256
  `DFF87AB66D6CB8482B4F292D624C524187022488613FF0920A05D9BC8AA2EAF9`.
- Suite de cierre: SHA-256
  `9D15ED5F55738415CAC79E3E9A7684AB52B7576C060986C3E9A09E763D0B557C`.

`corepack pnpm verify` corre sobre el merge `e736c089` más el diff de cierre,
sin banderas de skip. Solo existe `.env.example`; la comprobación del entorno
registra presencia/ausencia, nunca valores de credenciales.

| Comprobación | Estado | Evidencia / límite de esta reanudación |
|---|---|---|
| harness de verify | PASÓ | 18/18; E1/discovery medidos aparte por harness:test 26/26 |
| lint | PASÓ | 0 errores; 8 avisos preexistentes fuera de alcance |
| rsc-boundary | PASÓ | 1597 módulos, sin cruces prohibidos |
| typecheck | PASÓ | TypeScript sin errores |
| edge-functions | PASÓ | Cuatro entradas compilan |
| test | PASÓ | 6621/6621 en 522 archivos; ninguna de las tres rojas anteriores permanece |
| docs:check | PASÓ | Índice de 409 specs; regenerado y revalidado tras done |
| numbering | PASÓ | Sin colisiones nuevas; excepciones históricas intactas |
| feature-constants | PASÓ | Cinco banderas coinciden |
| components:check | PASÓ | Registro válido |
| governance:check | PASÓ | Cápsula de 28 políticas consistente |
| migrations-applied | NO DISPONIBLE | Sin URL/service-role; skip del runner, sin consulta a producción |
| pending-migration-symbols | PASÓ | Cero ROJO y cero AMARILLO |
| sql-tests | PASÓ | 156 contratos con rollback en Postgres desechable |
| schema-rebuild | PASÓ | 396 migraciones + 18 solo-ledger; 219 tablas y fixtures de dos tenants |
| e2e | NO DISPONIBLE | Retry completo: 152 passed / 15 failed / 1 flaky / 18 skipped; paso exit 1 por entorno |
| build | PASÓ | Build + postbuild; 160 páginas estáticas; tsconfig restaurado por el runner |

La primera pasada E2E emitió errores de URL/API key ausentes en `proxy.ts:67`.
El caso adicional de acceso `auth.spec.ts:74` dio `net::ERR_ABORTED` y pasó en
retry: navegación flaky recuperada, sin atribuir causa exacta ni confundirla
con falta de Supabase. La corrida se quedó sin salida nueva durante 464 segundos
en Mobile Safari. A las 20:19:02 -04:00 el Worker detuvo únicamente el árbol
E2E PID 24096, tras verificar su parentesco directo con verify PID 18892.
No se detuvo verify ni otra sesión. Esa pasada es parcial, no tiene resumen
final completo y no se cuenta como PASÓ. El primer intento del paso E2E terminó
con exit 1; verify inició su único reintento automático. No se atribuye causa
exacta al bloqueo de salida.

El reintento automático sí terminó (4.4 min): 152 passed, 15 failed, 1 flaky
y 18 skipped. Los quince fallos son exactamente `auth.spec.ts:21`, `:91`,
`:98`, `:105` y `global-search.spec.ts:22`, cada uno en chromium, mobile-chrome
y mobile-safari. El log muestra falta de URL/API key en `proxy.ts:67`, antes de
resolver sesión/redirección. Esta cobertura queda NO DISPONIBLE por configuración;
el paso E2E salió 1, no PASÓ. El caso de acceso `auth.spec.ts:74` en chromium
también pasó tras retry en esta segunda pasada y queda registrado como el único
flaky, separado del grupo de quince. Los 18 skips no se cuentan como ejecutados.

Recibos fuera de Git: `%TEMP%/dtd-sanitizer-0452-cierre-20260910/verify.log`
y `e2e-interruption.json`. Veredicto final literal, retirando solo códigos ANSI:

```text
   16 de 17 pasos corrieron de verdad
[AVISO] omitido: migrations-applied — no se midio (ver su [SKIP] arriba)
[FAIL] verify: 1 fallo(s) → e2e CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied.
```

Exit del proceso: **1**. Quince pasos PASARON, E2E devolvió fallo por entorno
y migrations-applied no se midió. No se presenta como verde completo ni como
certificación de producción. No se activaron skips, no se cambiaron workflows,
verify, ruleset ni patrones para conseguir el cierre. Después de cambiar solo
documentación se regeneró el índice y se validaron docs:check, sdd:check y
git diff --check; no se repitieron innecesariamente las pruebas de producto.

Incidente de revisión separado: una búsqueda del subagente devolvió rutas
fuera de las previstas y salida truncada. Se detuvo ese tipo de búsqueda;
no hubo escrituras ni copia de claves. No se puede certificar que ese comando
excluyera `docs/archive/**`, ni afirmar que lo leyó. Detalle en el handoff.

## Instalación y entorno

- PASÓ: `corepack pnpm install --frozen-lockfile`, exit 0, 813 paquetes.
- Node `v24.20.0`; Corepack `0.35.0`; pnpm resuelto por Corepack `12.3.4`.
- pnpm avisó que ignora `pnpm.onlyBuiltDependencies` en package.json; no se
  alteró configuración ni lockfile. CI declara pnpm `11.19.0` / Node 24.

## Hueco 3 primero: E1 antes del arreglo del sanitizador

`corepack pnpm harness:test`, exit 0, usando inicialmente el glob nativo:

```text
$ node --test "scripts/tests/*.node.mjs"
✔ fusiona dos ramas con claves baseline y specs distintas sin perder entradas
✔ falla cerrado si ambos lados cambian la misma clave del baseline
✔ una eliminación unilateral no puede borrar una entrada del baseline
✔ sin instalar el driver el merge bloquea y no inventa una unión textual
✔ rechaza JSON con claves duplicadas antes de sobrescribir %A
ℹ tests 23
ℹ pass 23
ℹ fail 0
ℹ skipped 0
```

Extracto literal de nombres y contadores; se omiten duraciones y los otros
18 nombres. E1 se ejecutó y PASÓ 5/5; no fue necesario ni autorizado repararla.

El contrato nuevo detectó que el glob nativo sin coincidencias sale 0. El runner
final sustituye esa variante por descubrimiento explícito con rechazo vacío.
Su focal pasó 3/3: archivo nuevo descubierto; fallo propagado; vacío rechazado.

## ROJO antes del cambio de producción

Comando:

```text
node node_modules/vitest/vitest.mjs run scripts/tests/bug-sanitizer.test.ts --reporter=verbose
```

Con `lib/studio/bug-sanitizer.ts` todavía idéntico a la base:

```text
 Test Files  1 failed (1)
      Tests  48 failed | 44 passed (92)
   Duration  779ms
exit 1
```

## VERDE después, sin cambiar los vectores

Mismo comando, suite y entradas sintéticas:

```text
 Test Files  1 passed (1)
      Tests  92 passed (92)
   Duration  596ms
exit 0
```

Los 48 fallos previos son cuatro contratos para cada una de doce formas:
Supabase secret y publishable; GitHub PAT fino e instalación JWT; Stripe
organización y firma webhook; Slack app, workflow, refresh, bot rotado y usuario
rotado; AWS STS. Los cuatro contratos comprueban texto/puntuación, repetición e
idempotencia, consola/stack/inmutabilidad, y paths/headers/contexto de red.

Los 44 controles verdes en ambas corridas incluyen los catorce casos de la
inline, cabeceras apikey y sus tres representaciones, diez negativos de
legibilidad y dieciocho controles de familias previamente cubiertas.

Las salidas completas se conservan localmente fuera de Git bajo
`%TEMP%/dtd-sanitizer-0452-20260910/`, archivos `sanitizer-red-final.log` y
`sanitizer-green.log`; solo contienen datos sintéticos de estas pruebas.
El fallo adicional de URL visto durante exploración inicial está separado en la
spec como problema previo, no contado entre los 48 fallos de formato.

## Histórico: gates anteriores a la decisión

- PASÓ: `corepack pnpm harness:test`, runner final, 26/26, exit 0,
  seis archivos descubiertos. Incluye E1 5/5 y descubrimiento 3/3.
- PASÓ: `node scripts/test-sanitizer-inline.mjs`, suite real 92/92, exit 0.
- PASÓ: índice regenerado, `docs:check`, `sdd:check`, `git diff --check`.
- PASÓ: build local y CI; ver alcance de la revisión anterior abajo.
- FALLÓ: primera corrida `corepack pnpm verify`, exit 1, por E2E sin entorno.
  El runner informó 16/17 pasos ejecutados, un fallo y migrations-applied omitido.
- NO DISPONIBLE: ledger, sin URL/service-role; no se contactó Supabase.
- NO DISPONIBLE para validación E2E completa: configuración Supabase ausente.
  Primera pasada: 151 passed, 15 failed, 2 flaky, 18 skipped (5.3 min).
  Reintento automático: 153 passed, 15 failed, 18 skipped (4.2 min).
  Los fallos son cinco pruebas de auth/global-search en tres proyectos; los
  logs muestran falta de URL/API key en createServerClient. No se absuelven como
  PASÓ, no se corrigen en esta tarea ni se incorporan credenciales.
- CI [34541563627](https://github.com/hailuwaycom-sketch/DTDCARGO/actions/runs/34541563627)
  PASÓ en `946e9a4d82b02c25d5271830cbf48cc85f7f3408`, **antes de añadir los tres
  negativos adversariales**: 522 archivos unitarios, harness 26/26 con E1 5/5,
  build y árbol reproducible. No es verde de la revisión final con 95 casos.
- La actualización de base incorporó main `ad495822` solo a la rama Worker,
  commit `946e9a4d`; resolvió el índice por driver semántico. El sanitizador y
  los 92 vectores permanecieron idénticos. No se integró la PR a main.

Se repitió verify con los 95 casos. Solo la repetición de E2E se omitió con
`VERIFY_SKIP_E2E=1`, tras las dos corridas reales de entorno incompleto arriba.
Esa omisión se registra NO EJECUTADO en la segunda corrida, no como PASÓ.

## Histórico: revisión adversarial de legibilidad

**FALLÓ el criterio 5 fuera del corpus inicial.** Dos identificadores inventados
de configuración (`sb_secret_configuration_validation_failed` y
`sk_org_configurationvalidationfailed`) se preservaban en la base y el nuevo
patrón los convierte en `[REDACTED]`. También se identificó la misma ambigüedad
en nombres largos con prefijos de Slack. La suite 92/92 no prueba ausencia de
estas colisiones. Los mínimos evitan menciones cortas, pero no distinguen una
clave de todo texto compatible con su formato. No se debilita el sanitizador
con una excepción basada en palabras o composición no garantizada. Cierre
funcional pendiente de decisión sobre este criterio, con PR en borrador.

Se incorporaron los tres casos reproducidos como tests de aceptación normales,
sin skip ni inversión de expectativa. La corrida focal final dio:

```text
 Test Files  1 failed (1)
      Tests  3 failed | 92 passed (95)
   Duration  719ms
exit 1
```

El recibo `sanitizer-acceptance-pending.log` queda junto a los anteriores fuera
de Git. Los 92 casos del arreglo siguen verdes; las tres regresiones de lectura
quedan visibles y bloquean el paso unitario hasta resolver la aceptación.

## Histórico: gate con las expectativas originales

Comando en PowerShell (variable solo en el proceso de esta corrida):

```powershell
$env:VERIFY_SKIP_E2E = '1'
corepack pnpm verify
```

| Comprobación | Estado | Evidencia / límite |
|---|---|---|
| harness de verify | PASÓ | 18/18 en la lista previa; E1 y discovery medidos aparte 26/26 por harness:test y CI |
| lint | PASÓ | 0 errores; 8 avisos preexistentes fuera de estos cambios |
| rsc-boundary | PASÓ | 1597 módulos, sin cruces prohibidos |
| typecheck | PASÓ | TypeScript sin errores |
| edge-functions | PASÓ | Compilan cuatro entradas |
| test | FALLÓ | En ambas pasadas: 3 failed / 6618 passed, 6621 total; los tres son aceptación 5 |
| docs:check | PASÓ | Índice de 409 specs sincronizado |
| numbering | PASÓ | Sin colisión nueva; excepciones históricas intactas |
| feature-constants | PASÓ | Cinco banderas coinciden |
| components:check | PASÓ | Registro válido |
| governance:check | PASÓ | Cápsula consistente |
| migrations-applied | NO DISPONIBLE | Sin URL / service-role; omitido, no se contacta producción |
| pending-migration-symbols | PASÓ | Cero ROJO y cero AMARILLO |
| sql-tests | PASÓ | 156 contratos, rollback en Postgres desechable |
| schema-rebuild | PASÓ | 396 migraciones aplicadas y 18 solo-ledger; fixtures de dos tenants en entorno desechable |
| e2e repetido | NO EJECUTADO | Skip explícito; primera corrida ya documenta cobertura completa NO DISPONIBLE por falta de configuración |
| build | PASÓ | Build + postbuild; tsconfig restaurado; sin cambios generados tracked |

Recibo final (sin códigos ANSI):

```text
15 de 17 pasos corrieron de verdad
omitido: migrations-applied — no se midio (ver su [SKIP] arriba)
omitido: e2e — VERIFY_SKIP_E2E=1 (omitido a pedido)
verify: 1 fallo(s) → test CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied, e2e.
exit 1
```

La omisión de E2E fue decisión documentada del Worker para no repetir por tercera
vez un entorno ausente; el texto genérico del runner dice “a pedido”. No se
atribuye a Sam una petición que no hizo. No hubo nueva bandera de skip en el repo.

`verify-final.log` conserva la salida completa fuera de Git. Huellas SHA-256:

- Sanitizador: `DFF87AB66D6CB8482B4F292D624C524187022488613FF0920A05D9BC8AA2EAF9`.
- Suite final de 95 casos: `E73E16908752236791399023FFFD89FF62E4A52BBB00CA74E04F0821FD34561E`.

La revisión final de alcance comprobó once archivos permitidos y que el resto
de package.json es idéntico a main. Documentación y diff --check se validan al
guardar este cierre. CI de la última publicación debe leerse por SHA: el verde
de 946e9a4d no cubre los tres negativos incorporados posteriormente.

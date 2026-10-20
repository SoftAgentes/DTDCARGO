---
sdd: "0570"
title: "Pruebas PGlite sin initdb por caso: plantilla del cluster recién inicializado"
status: in-progress
author: "Sam (founder) + Claude Code"
created: 2026-10-20
updated: 2026-10-20
supersedes: null
superseded_by: null
related: ["0349", "0486", "0493", "0550"]
confidencialidad: interno
---

# SDD-0570 · Pruebas PGlite sin initdb por caso

> Cada caso de un contrato PGlite pagaba un initdb de ~1,3 s. Una plantilla del cluster recién
> inicializado, una vez por archivo, lo baja a ~0,3 s sin cambiar qué se prueba.

## Pedido

El 2026-10-20 el check «Calidad local sin secretos» se cortó a los 45 min en la PR #298. La
PR #302 sube el tope y paraleliza Vitest; en ella quedó como pendiente atacar la curva de fondo.
Sam, literal: «Haz esta tarea aquí: “Pruebas PGlite: snapshot del esquema base por worker”».

## Estado medido antes del cambio (`main` `d50aa3e7`)

**En el CI** (run 39417924823, un solo worker):
- 34 archivos `*.migration.test.*` suman 25,4 de los 29,1 min de pruebas.
- Los más lentos: `borrado-embarques-recepciones` (198 s, 87 casos), `pin-operarios-endurecer`
  (179 s), `credito-referido-candado` (104 s) y `cierre-contable-superclave` (104 s).

**En la máquina de Sam** (22 hilos, sin otra corrida pesada), cinco arranques de cada tipo:

| Arranque | Mediana |
|---|---|
| `new PGlite({ extensions: { pgcrypto } })` | 1.321 ms |
| `new PGlite()` | 1.186 ms |
| `new PGlite({ loadDataDir })` desde un dump post-initdb | 322 ms |
| `dumpDataDir("none")` | 60 ms (38,5 MiB) |

`new PGlite()` corre initdb en una instancia aparte, la vuelca con `dumpDataDir` y la carga. Por eso
el arranque en frío cuesta tanto, y por eso el dump propio es tan barato.

**Diagnóstico.** Los contratos crean una instancia por caso: `contract()`, `run()` u
`openFixture()` se llaman dentro de cada `it`. El initdb se paga una vez por caso, aunque el
cluster de partida sea siempre el mismo.

## Decisión

`vitest/pglite-limpio.ts` exporta `pgliteLimpio(extensions?)`:

- Por juego de extensiones y por archivo de prueba, crea una instancia, espera `waitReady`, guarda
  `dumpDataDir("none")` y la cierra.
- Cada llamada devuelve una instancia nueva cargada de ese dump con las mismas extensiones.
- Si la plantilla falla, sale del caché y el caso siguiente reintenta.

**Por qué el cluster recién inicializado y no un esquema con migraciones.** Cada contrato aplica su
propio juego de migraciones reales (`\ir`) y su fixture dentro de la misma transacción del
contrato; los mutantes reemplazan el texto de una migración. Hornear migraciones en la plantilla
obligaría a partir cada contrato y cambiaría lo que corre en cada caso. La plantilla post-initdb no
cambia una sola línea de SQL de los contratos.

**Por qué por archivo y no por worker.** Vitest aísla los módulos de cada archivo (`isolate`), así
que el caché vive lo que dura el archivo. Un caché entre archivos (dump en disco desde un
`globalSetup`) ahorraría además un initdb por archivo, ~1,3 s × 33. No hace falta para el objetivo y
queda fuera.

## Alcance

**Archivos nuevos:**
- `vitest/pglite-limpio.ts`
- `vitest/pglite-limpio.test.ts`

**36 sitios en 27 archivos** pasan de `new PGlite(...)` a `await pgliteLimpio(...)`, con las mismas
extensiones. Son los que crean una instancia por caso. En el diff solo cambian esa línea y los
imports.

Los 27 archivos son 26 de prueba y `lib/studio/__tests__/r3-correlation-contract.ts`, el contrato
compartido que usan 7 archivos de las R3. En total quedan afectados 33 archivos de prueba, más el
del helper.

**Quedan igual, con motivo:**
- Una sola instancia por archivo en `beforeAll`, donde la plantilla costaría más que el initdb:
  - `lib/public/public-cbm-rate.migration.test.ts`
  - `lib/studio/__tests__/operario-pin.migration.test.ts`
  - `lib/studio/document-import/migration.test.ts`
  - `lib/studio/tarifa-programada.migration.test.ts`
  - `scripts/__tests__/radiografia-integridad.test.ts`
  - `scripts/__tests__/subdiario-radiografia-paridad.test.ts`
- `lib/studio/__tests__/pin-operarios-endurecer.migration.test.ts:1159`: el único `new PGlite()`
  sin extensiones del archivo.
- `scripts/qa/*`, `scripts/check-schema-rebuild.mjs` y el código de producto: no son pruebas de
  Vitest.

## Criterios de aceptación

1. **Indistinguible.** Con y sin pgcrypto, una instancia de `pgliteLimpio` da la misma huella que
   un `new PGlite()`: versión, sesión, bases, roles, extensiones, catálogo, esquemas, ajustes no
   default, txid y OID siguiente.
2. **Aislada.** Lo que un caso crea (tabla, fila o rol) no aparece en la instancia siguiente, y un
   archivo no ve el estado que dejó otro: cada archivo arma su propia plantilla.
3. **Un initdb por juego de extensiones y archivo**, no uno por caso. Una plantilla que falló no
   queda en el caché.
4. **Sin debilitar.** Ningún caso, control rojo, mutante ni aserción se borra o se relaja. Los 33
   archivos de prueba afectados pasan con el mismo número de casos que antes.
5. **Medido.** Antes y después, por archivo, en local (A/B) y en el CI.
6. **Mismos resultados con y sin plantilla.** Por archivo, los mismos casos en verde en el CI de
   `main` sin plantilla y en el CI de la PR con ella.
7. **El control rojo sigue rojo.** Al menos un contrato PGlite corre su control rojo sobre la
   plantilla, y el contrato falla donde debe.
8. **Nunca un dump viejo.** La plantilla no se guarda entre corridas. Si cambia la versión de
   PGlite, se regenera; si no puede regenerarse, el caso falla (ver «Si cambia la versión de
   PGlite»).

## Validación

| Criterio | Evidencia |
|---|---|
| 1, 2, 3 y 8 | `vitest/pglite-limpio.test.ts`, 8 casos. |
| 4, 6 y 7 | Ver «Medición después del cambio». |
| 5 | **PASÓ, revisado y aceptado por el Director el 2026-10-20.** A/B local completo por los 34 archivos, mismas firmas y 854 casos aprobados por lado; comparación CI conservada con sus propias condiciones. El primer intento parcial permanece como histórico. |

Mutantes del helper, con reporter TAP (control sin mutar: 8 ok):

| Mutante | Resultado |
|---|---|
| Sin caché | muere |
| Clave del caché sin extensiones | muere |
| Plantilla con un objeto de más | muere |
| Plantilla con el txid adelantado (`txid_current(); checkpoint;`) | muere |
| La falla se queda en el caché | muere |
| Cargar sin las extensiones | muere |
| `txid_current()` sin checkpoint antes del dump | **equivalente** |

El equivalente no llega al dump: el cargado da el mismo txid que uno fresco (752 y 752). Con
checkpoint sí llega (753) y muere.

A/B local de un archivo (dos corridas de cada lado):

| Archivo | Antes | Después |
|---|---|---|
| `cobro-factura-atomico` (7 casos) | 11,2 y 11,7 s | 7,3 y 8,0 s |
| `portal-bandeja-avisos` (48 casos) | 66,2 s | 27,1 s |

### Medición después del cambio

CI de GitHub, misma clase de runner (TypeScript en 1,2 min) y un worker en los dos lados:

- **sin plantilla:** `main` `d50aa3e7`, run 39429472606;
- **con plantilla:** `8a13412c`, run 39436611054, que es `main` + la #300 + esta SDD.

| Medida | Sin plantilla | Con plantilla | Cambio |
|---|---|---|---|
| 33 archivos afectados (suma) | 21,7 min | 9,5 min | −56 % |
| Unitarios | 33,9 min | 21,6 min | −36 % |
| Job | 41,6 min | 29,3 min | −30 % |
| `borrado-embarques-recepciones` | 169 s | 74 s | |
| `pin-operarios-endurecer` | 153 s | 72 s | |
| `portal-bandeja-avisos` | 72 s | 24 s | |

El detalle por archivo está en [assets/comparacion-ci.txt](assets/comparacion-ci.txt).

**Criterio 6 · mismos resultados.**
- Los 33 archivos afectados tienen el mismo número de casos y todos en verde en los dos lados.
- En toda la suite, solo dos archivos cambian de conteo, y los dos son de la #300 (SDD-0568), no de
  esta SDD: `client-account.test.ts` (33 → 35) y `ClientAccountHeader.test.tsx` (11 → 13).
- Del resto, 12.133 casos sin plantilla y 12.145 con ella: la diferencia son los 4 casos de la #300
  y los 8 de `vitest/pglite-limpio.test.ts`.
- El único archivo omitido (`corpus.test.ts`) se omite igual en los dos lados.

**Criterio 7 · el control rojo sigue rojo.** Con plantilla corrieron en verde los 40 casos
llamados «control rojo» de los archivos afectados. Cada uno afirma que el contrato cae sin su
migración; por ejemplo, «sin 0476 el equipo borra físicamente un embarque por la API» y «sin 0493
falla en la primera aserción». Corrieron en verde también los 375 mutantes impresos, cada uno
muerto donde debe.

### A/B local completo de 34 archivos · 2026-10-20 · aceptado

El Director autorizó el segundo intento después de la devolución del turno de 0571. Se ejecutó
un único par A → B sobre `1077ff216956d2062f3ce281971f68d084fe0a92`, con **33 archivos afectados
(846 casos) más el helper intacto (8 casos): 34 archivos / 854 casos por lado**. El control A
revirtió temporalmente solo los imports y los 36 constructores del commit `4b05a262` en 27
archivos. Los cuerpos normalizados fueron iguales; no cambiaron aserciones, casos, SQL ni
extensiones. B usó los bytes originales después de restaurarlos.

Condiciones idénticas: Node `v24.20.0`, Vitest `4.1.7`, PGlite `0.5.8`, Windows x64, dos
workers/forks, aislamiento por archivo, caché desactivado, semilla `570`, `CI=true`, `TZ=UTC`
y `NO_COLOR=1`. El entorno de runtime se congeló para ambos lados, sin variables de aplicación
ni credenciales y sin lectura de `.env`. El watchdog de **45 minutos por fase** quedó definido
antes de iniciar; no se activó y no hubo reintentos.

| Medida local | A, instancia nueva | B, plantilla | Resultado |
|---|---|---|---|
| Archivos y casos | 34/34; 854/854 | 34/34; 854/854 | Todos aprobados, cero fallidos u omitidos |
| Firmas por archivo: ancestros, título, nombre y estado | 34 archivos | 34 archivos | **34/34 iguales** |
| Tiempo de pared | 641,565 s | 361,750 s | −43,61 % en este par |
| Suma de los 33 afectados | 1.212,711 s | 630,722 s | −47,99 % en este par |
| Suma de los 34 con helper | 1.229,385 s | 651,630 s | Distinta del tiempo de pared con dos workers |
| Helper intacto, 8 casos | 16,675 s | 20,909 s | Fue más lento; excluido del agregado de 33 afectados |

Se respaldaron los bytes de **36/36 archivos protegidos**. La restauración después de A y la
final comprobaron los 36 SHA-256 originales sin discrepancias. La comprobación independiente
confirmó también seis archivos de configuración/lockfile y tres entradas de runtime iguales,
HEAD intacto, árbol limpio y cero procesos propios o consumidores visibles del worktree. El
claim se liberó y el turno se devolvió explícitamente a las `19:54:13.609Z`.

El [resumen por archivo](assets/comparacion-local.txt) y el
[JSON sanitizado](assets/comparacion-local.json) conservan las 34 filas, conteos, tiempos,
firmas SHA-256, argumentos exactos, condiciones y hashes de la evidencia cruda. Los logs, JSON
crudos, respaldos y arnés temporal permanecen fuera de Git, identificados por la corrida
`20261020T193515078Z`. Los mismos assets conservan el primer intento como histórico, con sus
hashes originales; sus resultados no se mezclan con este par.

**Límites.** Es una sola A seguida de una B, sin repeticiones AB/BA ni intervalo de confianza.
La carga incidental, las cachés del sistema, la temperatura y el antivirus no se eliminan; la
variación del helper intacto es una señal visible de ese límite. La misma semilla con dos workers
no garantiza el mismo orden temporal. Los porcentajes locales no se generalizan a CI ni a otras
máquinas. La comparación CI histórica, en Linux con un worker, conserva su propia evidencia.

**Criterio 5 completo.** El Director revisó y aceptó los reportes, firmas, condiciones, restauración
y límites el 2026-10-20. El check `Calidad local sin secretos` sobre la cabeza medida `1077ff21`
también **PASÓ**, run [39476193413](https://github.com/hailuwaycom-sketch/DTDCARGO/actions/runs/39476193413/job/118812654825),
de `18:36:19Z` a `19:01:29Z`. Ese check no se atribuye al commit documental posterior. Se
mantiene la separación entre aceptación de la medición, revisión final de la PR e integración;
este bloque no autoriza merge, despliegue ni base real.

### Histórico: primer intento A/B local · 2026-10-20 · PARCIAL

Codex retomó el worktree `pglite-snapshot-esquema` por delegación del Director, con la sesión
Claude pausada por Sam, sobre `59e8491b4842e92678509ca7d1b4788718f7243d`. El turno pesado fue
cedido por 0569. El conjunto exacto fue el de los **33 contratos afectados (846 casos)** de la
comparación CI más **las 8 pruebas del helper intacto: 34 archivos / 854 casos** por lado.

El control A revirtió temporalmente solo los imports y las 36 construcciones de PGlite del
commit `4b05a262`, en 27 archivos. Se guardaron los bytes originales y se comprobó igualdad de
los cuerpos normalizados, sin cambiar casos, aserciones, SQL ni extensiones. B debía usar esos
bytes restaurados con `pgliteLimpio`. El helper y sus 8 pruebas quedaban intactos en ambos lados:
su tiempo no se debía atribuir a una mejora de los 33 contratos.

Condiciones previstas iguales: Node `v24.20.0`, Vitest `4.1.7`, PGlite `0.5.8`, Windows x64,
dos workers/forks, aislamiento por archivo, caché desactivado, semilla de archivos `570`,
`CI=true`, `TZ=UTC` y `NO_COLOR=1`. Se usó una lista de variables de ejecución de Windows,
sin variables heredadas de aplicación, Supabase ni credenciales y sin cargar `.env`.

| Medida | Resultado |
|---|---|
| A, instancias nuevas | **PARCIAL**: 26/34 archivos completos, 649 casos reportados en verde |
| Contratos afectados completos en A | 25/33 archivos, 641 casos; los 8 restantes del total son del helper |
| Duración de A | 1.200,846 s, de `18:11:47.770Z` a `18:31:48.616Z`; exit 1 por corte del arnés |
| B, plantilla | **NO EJECUTADO** |
| Igualdad de casos entre A y B / mejora local | **NO DISPONIBLE**: falta el par completo |
| Restauración | **PASÓ**: 36/36 SHA-256 originales coinciden, cero diferencias |
| Procesos y turno al terminar | Cero procesos Node visibles del worktree; turno pesado devuelto a 0569 |

El watchdog temporal tenía un límite de **20 minutos por fase**, fijado antes de que el Director
ampliara el turno total a 35 minutos. Ese límite permaneció cargado; el Director indicó conservar
la corrida y, si cortaba, documentar el parcial sin reiniciar. No se observó fallo de aserción en
los archivos terminados. Los ocho archivos sin resultado completo no se cuentan como aprobados
ni fallidos. El corte impidió emitir el JSON final de Vitest.

El detalle histórico de las 34 rutas, casos previstos y tiempos A disponibles se conserva en
[assets/comparacion-local.txt](assets/comparacion-local.txt); el manifiesto, hashes de integridad
y límites están en [assets/comparacion-local.json](assets/comparacion-local.json).
Logs, respaldo y orquestador quedan fuera de Git en
`C:/tmp/director-traspaso-20261020/0570-ab-local`. Hubo un preflight rechazado por el normalizador
de un import relativo `.mjs`, antes de ejecutar pruebas; restauró 36/36 hashes y se corrigió solo
el comprobador. El segundo preflight pasó.

**Estado al cerrar este primer intento: criterio 5 local PENDIENTE.** Ese resultado parcial no
prueba mejora de rendimiento. El segundo intento descrito arriba cerró el criterio con un nuevo
turno y límite definido antes de iniciar. No se dejó una corrida en segundo plano ni se repitió
la suite completa o un ciclo separado de mutantes.

**CI observado al cerrar el primer intento:** `Calidad local sin secretos` **PASÓ** sobre `59e8491b`,
run [39460332474](https://github.com/hailuwaycom-sketch/DTDCARGO/actions/runs/39460332474/job/118776457014),
de `17:23:59Z` a `17:48:05Z`. El bloqueo de facturación del run histórico `39453136909` ya no
describe esta punta. El A/B histórico del CI conserva sus propias condiciones y evidencia.
La PR #304 sigue en borrador; esta medición no autoriza merge, deploy ni base real.

## Riesgos y reversión

- **Memoria.** Cada archivo guarda hasta dos dumps de 38,5 MiB mientras corre. Cada instancia carga
  su copia y la libera al cerrar, igual que antes.
- **Versión de PGlite.** Ver la sección siguiente.
- **Reversión.** Revertir los commits de esta SDD; los contratos vuelven a `new PGlite()` sin otro
  cambio.

## Si cambia la versión de PGlite

**La plantilla no se guarda entre corridas.** Vive en la memoria del archivo de prueba y la arma el
PGlite instalado en ese momento. No hay disco, `globalSetup` ni `globalThis`. Por eso no existe un
dump de otra versión que se pueda cargar: al actualizar PGlite, la primera llamada de cada archivo
hace el initdb con la versión nueva.

**Falla cerrado.** Si la versión nueva rompe el initdb, `dumpDataDir` o `loadDataDir`, la llamada
lanza el error y el caso falla. La plantilla rota no se queda en el caché, y no hay un camino que
caiga en silencio a otra base.

**La huella lo vigila.** Compara la plantilla con un `new PGlite()` de la misma versión. Si una
versión nueva hace que el dump no reproduzca el cluster (versión, catálogo, txid u OID siguiente),
cae la prueba del helper antes que cualquier contrato.

**El candado.** `vitest/pglite-limpio.test.ts` falla si el helper importa `fs` u `os`, lee o
escribe archivos, usa `globalSetup` o `globalThis`, o abre un PGlite con directorio de datos
persistente. Un caché entre corridas tendría que llevar la versión de PGlite en la clave y negarse a
cargar un dump de otra. Esa decisión va en una SDD nueva, no en un cambio de paso.

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
2. **Aislada.** Lo que un caso crea (tabla, fila o rol) no aparece en la instancia siguiente.
3. **Un initdb por juego de extensiones y archivo**, no uno por caso. Una plantilla que falló no
   queda en el caché.
4. **Sin debilitar.** Ningún caso, control rojo, mutante ni aserción se borra o se relaja. Los 33
   archivos de prueba afectados pasan con el mismo número de casos que antes.
5. **Medido.** Antes y después, por archivo, en local (A/B) y en el CI.

## Validación

| Criterio | Evidencia |
|---|---|
| 1, 2 y 3 | `vitest/pglite-limpio.test.ts`, 6 casos. |
| 4 y 5 | Ver «Medición después del cambio». |

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

Pendiente: corrida de los 34 archivos (con turno del Director) y CI de la PR.

## Riesgos y reversión

- **Memoria.** Cada archivo guarda hasta dos dumps de 38,5 MiB mientras corre. Cada instancia carga
  su copia y la libera al cerrar, igual que antes.
- **Versión de PGlite.** `loadDataDir` y `dumpDataDir` son API pública de PGlite 0.5.8. Si una
  versión nueva cambia el initdb, la prueba de huella (criterio 1) cae antes que los contratos.
- **Reversión.** Revertir los commits de esta SDD; los contratos vuelven a `new PGlite()` sin otro
  cambio.

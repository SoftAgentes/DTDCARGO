---
sdd: "0550"
title: "Pruebas que vencen bajo carga, pruebas bash en el CI y sha256sum en modo binario"
status: in-progress
author: "Sam (founder) + Claude Code"
created: 2026-10-17
updated: 2026-10-17
supersedes: null
superseded_by: null
related: ["0349", "0444", "0454", "0486", "0540", "0541", "0543", "0546", "0547"]
confidencialidad: interno
---

# SDD-0550 · Pruebas que vencen bajo carga, pruebas bash en el CI y `sha256sum` en modo binario

## Pedido

Encargo del Director, 2026-10-17. Sam dijo literal: «Haz una tarea continua sin detenerte… trata
de hacer todos los trabajos pendientes». Tres Workers vieron `pnpm verify` en rojo sólo en el paso
`test` (PR #264, SDD-0547; PR #266, SDD-0546; verify de la PR #260, SDD-0543) por pruebas que
pasan aisladas. Además, las pruebas bash de la 0541 y la 0543 no corrían ni en Vitest ni en el CI,
y no estaba claro que todos los lectores de `sha256sum` aceptaran el `*` del modo binario de Git
para Windows.

## Estado medido antes del cambio (`main` `cdb7ff76`)

### Pruebas que vencieron (handoffs 0543, 0546 y 0547)

| Prueba | Aislada (máquina quieta) | Dentro de `verify` | Tope |
|---|---|---|---|
| `__tests__/fuentes-locales.test.ts` › ningún archivo importa `next/font/google` | 1,26 s | 30,6 s | 20 s global |
| `lib/db/__tests__/session-cookie.test.ts` › no hay otro archivo que cree clientes | 1,45 s | venció | 20 s global |
| `components/AvisoEntornoPrueba.test.tsx` › z-index del repo | 1,28 s | venció | 20 s global |
| `pin-operarios-endurecer.migration.test.ts` (texto) › el validador es 0037… | 1,25 s | 20,98 s y 40,7 s | 20 s global |
| `operarios-editar-por-region.migration.test.ts` (texto) › el preflight… | 0,80 s | 20,8 s | 20 s global |
| `scripts/tests/verify-watchdog.node.mjs:248` › un árbol que calla… | 3,5-3,7 s | «nivel 0 (PID 6412) sigue vivo» a los 5,0 s | 120 s propio |

Bajo la carga de la propia `verify` las que leen el disco se multiplicaron por 17 a 33 (30,6 /
1,26; 20,98 y 40,7 / 1,25; 20,8 / 0,80). Con ese factor, toda prueba de ≥ 0,6 s sin tope propio
queda a merced del reloj. El barrido estático
(pruebas que recorren el árbol o todas las migraciones) y la medición aislada de 26 archivos
suman las que todavía no habían caído:

- el parseo de `app/globals.css` en `AvisoEntornoPrueba` (1,05 s);
- la prueba PGlite del motivo en `pin-operarios-endurecer` (1,03 s, sin `SLOW`);
- el `bash -n` en serie de `entorno-prueba-scripts` (1,17 s; 17,0 s con carga sintética);
- en `migraciones.test.mjs`, la paridad con `migracion.sh`, su `bash -n` y los `$preflight$` de
  las migraciones reales (0,1-0,4 s; 2,3-7,2 s con carga, ×20).

### El watchdog no falló por el reloj

`killProcessTree` ya había visto muerto al nivel 0 (0 sobrevivientes) y después el PID respondía:
Windows lo había reciclado. Medido aquí: un PID liberado se reusó en 2 s entre ~800 procesos
nuevos (1 de 8 intentos). Control con el sistema real: el PID 34864, cortado, lo reusó un
`cmd.exe` con otra hora de creación; `isProcessAlive` dio «vivo».

### Pruebas bash fuera de la suite

De las 19 `infra/ops/tests/prueba-*.sh`, Vitest corre 4. `prueba-publicar-web.sh` (SDD-0541) pide
`flock` (Linux) y `prueba-aplicar-lote.sh` (SDD-0543) se corría a mano. Tampoco corrían
`prueba-ips-prueba.sh` ni `prueba-prompt-trim.sh`, que sólo usan dobles. Las otras 11 piden
Docker real, el VPS o el bucket. El job de «Calidad continua» tarda 31-34 min con un tope de 45.

### `sha256sum`

Git para Windows escribe `hash *archivo`. `infra/ops/migrate/aplicar-migracion.sh` cerraba la
evidencia con `sha256sum -- * | grep -v ' SHA256SUMS$' > SHA256SUMS`: si el glob alcanzaba a ver
el `SHA256SUMS` que la redirección acababa de crear, en Windows la línea no se filtraba y la
evidencia no verificaba. Los demás lectores ya lo aceptaban.

## Decisión

1. **Tope propio de 120 s** para cada prueba en riesgo (el global de 20 s no cambia), como
   `env-example-contract.test.ts`. Por prueba cuando el archivo mezcla pruebas de unidad; por
   `describe` en los bloques (texto), que Vitest hereda a sus pruebas. Ninguna aserción cambia.
2. **Más rápidas donde se puede sin cambiar lo que miden:** `mig()` lee cada migración una sola vez
   en `pin-operarios-endurecer` (~2.400 lecturas → 485) y `operarios-editar-por-region` (~1.450 →
   485).
3. **El watchdog compara identidad:** vivo es «mismo PID y misma hora de creación del
   inventario». Sin hora (POSIX) cuenta el PID. Los márgenes de reloj (latido de 100 ms contra
   1,5 s de inactividad) no cambian: no fueron la causa.
4. **Paso nuevo en el CI**, «Pruebas bash de operaciones»: `bash infra/ops/tests/pruebas-linux.sh`,
   después del harness. Corre `prueba-publicar-web.sh`, `prueba-aplicar-lote.sh`,
   `prueba-ips-prueba.sh` y `prueba-prompt-trim.sh`. Una prueba es PASÓ sólo con exit 0, al menos
   un `PASÓ` y ningún `FALLÓ`; una que falla no corta a las demás.
5. **El contrato del workflow** exige ese paso sin condición ni tolerancia, sin reemplazo de la
   lista, y que toda `prueba-*.sh` tenga un solo destino: Vitest, el paso Linux o la lista de
   excluidas con su motivo. Una prueba nueva sin clasificar rompe el contrato.
6. **`cerrar()` de `aplicar-migracion.sh`** excluye `SHA256SUMS` por nombre con `find`, igual que
   `migraciones/aplicar.sh`.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| AGENTS.md §Requisitos y calidad («No debilites tests») | cumplimiento | Sólo cambian topes y lecturas repetidas; las aserciones son las mismas. El watchdog compara la identidad que ya usa el propio corte. |
| AGENTS.md §Ejecución (PR como frontera) | cumplimiento | Rama propia, PR en borrador, sin merge. |
| SDD-0349 / SDD-0444 (CI sin secretos, harness obligatorio) | cumplimiento | El paso nuevo no usa secretos, Docker ni red; el contrato anterior sigue entero. |
| Producción y servidor | no aplica | `aplicar-migracion.sh` sólo cambia cómo cierra su evidencia; el servidor sigue con su copia hasta que se instale. |
| Políticas de producto | no aplica | Cambio de pruebas, harness y CI. |

## Allowlist

- Pruebas: `__tests__/fuentes-locales.test.ts`, `lib/db/__tests__/session-cookie.test.ts`,
  `components/AvisoEntornoPrueba.test.tsx`, `lib/studio/__tests__/pin-operarios-endurecer.migration.test.ts`,
  `lib/studio/__tests__/operarios-editar-por-region.migration.test.ts`,
  `scripts/__tests__/entorno-prueba-scripts.test.mjs`, `infra/ops/tests/migraciones.test.mjs`,
  `scripts/tests/verify-watchdog.node.mjs`,
  `scripts/__tests__/ci-workflow-contract.test.mjs`, `infra/ops/tests/pruebas-linux.test.mjs`,
  `infra/ops/tests/prueba-aplicar-migracion.sh`.
- Scripts: `infra/ops/tests/pruebas-linux.sh`, `infra/ops/migrate/aplicar-migracion.sh`.
- CI: `.github/workflows/quality.yml`.
- Documentos: esta spec, `docs/specs/README.md`, `docs/runbooks/publicacion-automatica-web.md`,
  `docs/runbooks/cargar-consolidados.md`, `.agents/handoffs/0550-pruebas-bajo-carga-y-bash-en-ci.md`.

## Aceptación

1. Cada prueba nombrada en los handoffs 0543/0546/0547 tiene medición antes y después, y su margen
   no depende del tope global.
2. El tope del `describe` se hereda de verdad (mutante con 1 ms: «Test timed out in 1ms»).
3. El watchdog distingue PID reusado de sobreviviente, con dobles y con el sistema real.
4. El runner da FALLÓ con exit ≠ 0, con un `FALLÓ` y exit 0, sin ningún `PASÓ`, con
   `NO DISPONIBLE` y con una ruta inexistente; y no corta a las demás.
5. Las cuatro pruebas bash pasan en Linux (`node:24`) y en el CI, y el paso cabe en el tope de 45 min.
6. El contrato rechaza el paso eliminado, impreso, con `|| true`, condicionado, tolerado o con la
   lista reemplazada, y una prueba bash sin clasificar.
7. La evidencia de `aplicar-migracion.sh` verifica con `sha256sum` binario; control rojo con el
   `cerrar()` viejo.

## Verificación (2026-10-17)

El detalle por prueba está en el handoff de la tarea.

- **Sin carga, después.** Las pruebas (texto) con caché pasan de 1.245 a 233 ms y de 804 a
  245 ms.
- **Con carga sintética.** Son 22 procesos que queman CPU y releen el árbol, a prioridad baja.
  - El bloque del validador pasa de 11,4 s a 5,1 s.
  - Las demás llegan a 3-17 s, con un tope que ahora es de 120 s.
- **CI «Calidad continua»,** run 39073436101 sobre `7883ea56`: PASÓ.
  - Job de 34 min 20 s; antes tardaba 31-34 min.
  - «Pruebas bash de operaciones» tardó 44 s: `prueba-publicar-web.sh` 144 PASÓ en 40 s,
    `prueba-aplicar-lote.sh` 23 en 4 s, `prueba-ips-prueba.sh` 24 y `prueba-prompt-trim.sh` 13.
  - Cabe en el tope de 45 min.
- **`pnpm verify`** sobre `3ec1cceb` (22,7 min): exit 0, 16 de 17 pasos.
  - `test` pasó al primer intento: 792 archivos y 11.186 pruebas.
  - `harness` dio 215/215.
  - `migrations-applied` quedó sin medir porque el worktree no tiene `.env.local`.
- **Controles rojos.**
  - Mutante del tope del `describe` a 1 ms: «Test timed out in 1ms».
  - PID reusado real: la aserción vieja da «sigue vivo» y la nueva pasa.
  - `cerrar()` viejo: 35 · 1.
  - Runner: 9 mutantes muertos, 0 vivos.

## Estado

Implementada en la PR #269, en borrador y sin fusionar. Se cumplen los siete criterios de
aceptación, con la evidencia de arriba. El merge lo hace el Director: desde el 2026-10-16 cada
merge se publica solo.

# Handoff · SDD-0550 · Pruebas que vencen bajo carga y pruebas bash en el CI

| Campo | Valor |
|---|---|
| Fecha | 2026-10-17, de ~20:50 a ~23:10 UTC (Caracas: 16:50 a ~19:10) |
| Task ID / owner | `0550-pruebas-bajo-carga-y-bash-en-ci` / subagente Worker lanzado por la sesión Director, claim `worker-agent-a2a74ff04f8ae776e` (liberado al cerrar) |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\agent-a2a74ff04f8ae776e` |
| Rama | `worktree-agent-a2a74ff04f8ae776e`, publicada |
| Base | `origin/main` `cdb7ff76` (merge de la #266). Después se mergearon en la rama `811659b2` (#267, documentos), `79cfc60a` (#268, SDD-0548) y `9440cfc2` (#270, SDD-0549); los dos últimos a pedido del Director porque la PR había quedado en conflicto con el índice |
| SDD | [0550](../../docs/specs/0550-pruebas-bajo-carga-y-bash-en-ci/spec.md), `in-progress`. Reserva publicada `codex/sdd-reserve-0550` (`f3a127a9`); el stub no se incorporó: la spec entra en su propio commit |
| PR | [#269](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/269), en borrador, base `main` |
| Estado de la tarea | lista para revisión (PR en borrador) |
| Permisos | commits selectivos en la rama propia; push de la rama propia y de la reserva; PR en borrador contra `main`. Sin merge, sin servidor ni producción, sin imprimir secretos. `pnpm verify` una sola vez y sólo sin otra corrida pesada en la máquina |

## OBJETIVO ORIGINAL

Encargo del Director del 2026-10-17. Sam dijo literal: «Haz una tarea continua sin detenerte… trata de hacer todos los trabajos pendientes».

1. **Pruebas lentas.** Son las que vencen el tope de 20 s bajo la carga de la propia `verify` (PR #264, #266 y #260). Hay que:
   - medirlas con y sin carga;
   - darles un timeout local o hacerlas más rápidas, sin bajar lo que comprueban;
   - volver robusta la del watchdog.
2. **Pruebas bash en el CI.** Correr en «Calidad continua» las de la 0541 (`prueba-publicar-web.sh`) y la 0543 (`prueba-aplicar-lote.sh`):
   - sin pasar de `timeout-minutes: 45`;
   - actualizando el contrato del workflow sin debilitarlo;
   - si no cabe, dejarlo como propuesta.
3. **`sha256sum`.** Revisar los scripts que parsean su salida y arreglar los que no aceptan el `*` del modo binario de Git para Windows.
4. **Cierre.** `harness:test` y una `pnpm verify`, con PASÓ/FALLÓ/NO EJECUTADO/NO DISPONIBLE por comprobación.

## COMPLETADO

### 1 · Pruebas que vencían bajo carga

**Cómo se eligieron.**

- Las cinco que vencieron según los handoffs 0543, 0546 y 0547.
- Un barrido estático de 33 archivos que recorren el árbol o todas las migraciones.
  - 21 sin `vi.setConfig`.
  - Varios de esos ya tenían tope por prueba; por ejemplo, `invoice-read-boundary` tiene 60 s.
- Medición aislada de 26 archivos.
- Regla: con el factor observado dentro de `verify` (×17 a ×33), está en riesgo toda prueba de ≥ 0,6 s aislada que dependa del tope global de 20 s.

**Arreglo.** Tope propio de 120 s, el mismo patrón que `env-example-contract.test.ts`:

- el tope global no cambia;
- ninguna aserción cambia;
- donde el archivo mezcla pruebas de unidad, el tope va por prueba;
- en los bloques (texto) va por `describe`, que Vitest 4 hereda («inherit repeats, retry, timeout from suite», comprobado en `@vitest/runner` 4.1.7 y con un mutante).

| Prueba | Por qué | Cambio |
|---|---|---|
| `fuentes-locales` › ningún archivo importa `next/font/google` | venció (30,6 s) | tope por prueba |
| `session-cookie` › no hay otro archivo que cree clientes | venció | tope por prueba |
| `AvisoEntornoPrueba` › z-index del repo | venció | tope por prueba |
| `AvisoEntornoPrueba` › `app/globals.css` se parsea | 1,05 s aislada (carga postcss) | tope por prueba |
| `pin-operarios-endurecer` (texto) | venció (20,98 y 40,7 s) | tope del bloque y `mig()` con caché: ~2.400 lecturas → 485 |
| `pin-operarios-endurecer` › el motivo se valida igual (PGlite) | 1,03 s aislada, sin `SLOW` | `SLOW` (240 s), como las demás de PGlite |
| `operarios-editar-por-region` (texto) | venció (20,8 s) | tope del bloque y `mig()` con caché: ~1.450 lecturas → 485 |
| `entorno-prueba-scripts` › todos pasan `bash -n` | 1,2 s aislada y 17,0 s con carga, contra 20 s | tope por prueba |
| `migraciones.test.mjs` › paridad con `migracion.sh`, `bash -n` y `$preflight$` en las migraciones reales | 0,1-0,4 s aisladas y 2,3-7,2 s con carga (×20), lanzan bash o leen 485 archivos | tope del bloque o por prueba |

### 2 · Watchdog

- **La evidencia.** El log de la verify de la #260 (03:03Z) dice «nivel 0 (PID 6412) sigue vivo», a los 5,0 s.
  - No fue el reloj.
  - El corte había informado 0 sobrevivientes, así que `killProcessTree` ya lo había visto muerto.
  - Después, el PID respondía: Windows lo había reciclado.
- **Medido aquí:** un PID liberado se reusó en 2 s entre unos 800 procesos nuevos (1 de 8 intentos).
- **Arreglo:** «vivo» es el mismo PID con la misma hora de creación del inventario (`siguenVivosLosMismos`, en la prueba). Sin hora (POSIX) cuenta el PID.
- **Prueba nueva con dobles,** que cubre muerto, reusado, vivo, sin hora y que no consulta la tabla si nadie responde.
- **Los márgenes de reloj no cambian:** latido de 100 ms contra 1,5 s de inactividad.

### 3 · Pruebas bash en el CI

**Paso nuevo** «Pruebas bash de operaciones»: `bash infra/ops/tests/pruebas-linux.sh`, después del harness. Corre cuatro pruebas:

- `prueba-publicar-web.sh` (0541);
- `prueba-aplicar-lote.sh` (0543);
- `prueba-ips-prueba.sh` y `prueba-prompt-trim.sh`, que sólo usan dobles y no corrían en ningún lado.

**Reglas del runner:**

- PASÓ sólo con exit 0, al menos un `PASÓ` y ningún `FALLÓ`;
- tope de 600 s por prueba (exit 124 con su nombre);
- una que falla no corta a las demás.

**Contrato (`ci-workflow-contract.test.mjs`):**

- el paso, único, sin `if`, sin `continue-on-error` y sin `PRUEBAS_LINUX_*` en el job ni en el paso;
- clasificación de las 19 `prueba-*.sh`:
  - 4 en Vitest, con su archivo y la llamada que las ejecuta;
  - 4 en el paso Linux;
  - 11 fuera del CI, cada una con su motivo (Docker real, VPS, bucket);
- una prueba nueva sin clasificar, una en dos destinos o una entrada que ya no existe rompen el contrato. Hay un control para cada caso.

### 4 · `sha256sum`

- **Arreglado:** `infra/ops/migrate/aplicar-migracion.sh` `cerrar()`.
  - Filtraba con `grep -v ' SHA256SUMS$'`.
  - Con `hash *SHA256SUMS`, el formato de Git para Windows, la línea pasaba cuando el glob alcanzaba a ver el archivo que la redirección ya había creado, y la evidencia no verificaba.
  - Ahora se excluye por nombre con `find`, igual que `migraciones/aplicar.sh:160`.
- **Prueba nueva** en `prueba-aplicar-migracion.sh`: un doble de `sha256sum` en modo binario y un `SHA256SUMS` presente al cerrar.
- **Revisados sin cambio:**

| Lector | Clasificación |
|---|---|
| `migraciones/aplicar.sh:97` (`[ *]`), `web/huellas-fuera-de-imagen.sh:47` (`[ *]`), `migraciones/aplicar-remoto.sh:123` (quita `*`), `staging/verificar-aislamiento.sh:139` (quita `*`), `backup/restore.sh:254` (`\*?`) | ya aceptaban el `*` |
| `cut -d' ' -f1`, `cut -c1-64/16/32`, comparación del mismo comando antes y después (`prueba-env-set.sh`, `prueba-ips-prueba.sh`) | sólo toman el hash: no aplica |
| `sha256sum -c` / `--check --strict` (aplicar-lote, aplicar.sh, resetear-base-prueba, pruebas) | GNU acepta los dos formatos: no aplica |
| `backup/config-backup.sh:171` (huella de huellas) | se compara contra la del mismo host: no aplica |
| `infra/ops/tests/migraciones.test.mjs:365` (`split("  ")`) | lee el `SHA256SUMS` que escribe `preparar.mjs` con dos espacios fijos: no aplica |
| `consolidados/aplicar-lote.sh:120` | sin filtro y con el glob antes de la redirección; en una carpeta nueva por paso no se lista a sí mismo: no aplica |

### Documentos

- Spec 0550 y el índice (`docs/specs/README.md`, regenerado).
- `docs/runbooks/publicacion-automatica-web.md` §Pruebas y `docs/runbooks/cargar-consolidados.md` §4 anotan que el CI corre esas pruebas.

## VALIDACIÓN

### Mediciones (Windows, 22 lógicos, 31 GB)

«Sin carga»:

- máquina quieta, de a un archivo por vez;
- la corrida «antes» se solapó ~2 min con un `grep` mío sobre el temporal, que corté.

«Con carga»:

- 22 procesos que queman CPU y releen el árbol;
- con vitest en paralelo, todo a prioridad BELOW_NORMAL para no quitarle CPU a otras sesiones.

En la corrida grande «antes» con carga no arrancaron los workers de seis archivos jsdom: el JSON los omite y vitest salió 1. Se midieron aparte con la misma carga (columna jsdom). En la corrida «después» corrieron las 465 y pasaron.

| Prueba | Sin carga antes | Sin carga después | Con carga antes | Con carga después | Tope antes → después |
|---|---|---|---|---|---|
| `fuentes-locales` › `next/font/google` | 1.263 ms | 768 | 4.801 (jsdom) | 9.598 / 4.740 (jsdom) | 20 s → 120 s |
| `session-cookie` › otro archivo con clientes | 1.454 | 895 | 5.444 (jsdom) | 8.167 / 5.292 | 20 → 120 |
| `AvisoEntornoPrueba` › z-index | 1.282 | 536 | 2.818 (jsdom) | 4.900 / 3.798 | 20 → 120 |
| `pin-operarios` (texto) › validador | 1.245 | **233** | 11.399 | **5.078** | 20 → 120 |
| `operarios-editar` (texto) › preflight | 804 | **245** | 4.853 | 5.923 | 20 → 120 |
| `entorno-prueba-scripts` › `bash -n` | 1.172 | 687 | 11.953 | 17.011 | 20 → 120 |
| `migraciones.test.mjs` › paridad (8 casos) | 108-356 | 108-251 | 2.533-6.248 | 2.352-7.168 | 20 → 120 |
| `migraciones.test.mjs` › `$preflight$` reales | 354 | 360 | 3.389 | 6.954 | 20 → 120 |
| watchdog › un árbol que calla | 3.514-3.659 | 4.515 (suite) | 4.675-6.087 (reciclaje de PID, 10/10) | — | 120 s propio, sin cambio |

- Lo que la caché acelera: el bloque (texto) del validador, ×5 sin carga y ×2,2 con carga.
- El resto gana margen, no velocidad. Con carga sintética llegan a 3-17 s; con la carga de `verify` llegaron a 20-41 s; el tope nuevo es de 120 s.
- Las dos suites bash largas, que ya tenían 600 s propios, llegaron a 283 s y 346 s con carga (`prueba-migraciones-produccion`, y el trío de `entorno-prueba-scripts`). Ver FUERA DE ALCANCE.

### Controles rojos y mutantes

| Control | Resultado |
|---|---|
| Tope del `describe` heredado: `TEXTO = 1` en `operarios-editar-por-region` | «Test timed out in 1ms» ×4. Restaurado |
| Watchdog con el sistema real (`a2a7-control-reuso.mjs`, fuera del repo) | PID 34864 cortado (0 sobrevivientes), reusado por un `cmd.exe`. Aserción vieja: FALLA («sigue vivo»). Nueva: PASA (hora de creación distinta) |
| `cerrar()` viejo en una copia de `infra/ops` | `prueba-aplicar-migracion.sh` 35 PASÓ · 1 FALLÓ. Con el arreglo, 36 · 0 |
| Mutantes del runner (9) | 9 muertos · 0 vivos. Primero sobrevivió «no muestra los FALLÓ»: el `FALLÓ` de la prueba de mentira caía también en el `tail`. Se reforzó la prueba (`58f1c0cd`), no se quitó código |
| Controles del contrato | paso eliminado, impreso, con `|| true`, condicionado, tolerado, lista o tope reemplazados: rechazados. Clasificación: nueva sin destino, doble destino y entrada inexistente: detectadas |

### Comprobaciones

| Comprobación | Alcance / SHA | Resultado |
|---|---|---|
| CI «Calidad continua», run 39073436101 | `7883ea56`, 22:02:40Z → 22:37:00Z | **PASÓ**. Job de 34 min 20 s. «Pruebas bash de operaciones» 44 s: `prueba-publicar-web.sh` 144 PASÓ en 40 s, `prueba-aplicar-lote.sh` 23 en 4 s, `prueba-ips-prueba.sh` 24 y `prueba-prompt-trim.sh` 13 en 0 s. Unitarios 27 min 19 s, harness 31 s |
| CI run 39075879710 | `3ec1cceb` | **NO EJECUTADO** hasta el final: la reemplaza la corrida de la cabeza siguiente (`cancel-in-progress`), que sí incluye todo |
| CI de la cabeza final | el commit que contiene este documento | **EN CURSO** al cerrar: se dispara con el push de cierre. Consultar `gh pr checks 269` |
| `pnpm harness:test` | `3ec1cceb`, 22:36:24Z-22:37:34Z, máquina libre | **PASÓ** 215/215 en 69 s |
| `pnpm verify` | `3ec1cceb`, 22:38:45Z → 23:01:27Z (22,7 min), sin otra corrida pesada en la máquina | **exit 0**, con cierre incompleto declarado: 16 de 17 pasos medidos, `migrations-applied` sin medir. Por paso:

- PASÓ: `harness` (215/215), `lint`, `rsc-boundary`, `typecheck`, `edge-functions` (4) y `test` (792 archivos y 11.186 pruebas, al primer intento, 376 s);
- PASÓ: `docs:check`, `numbering`, `feature-constants` (6), `components:check`, `governance:check`, `pending-migration-symbols` (0 rojo, 0 amarillo), `sql-tests`, `schema-rebuild` y `build`;
- PASÓ con aviso: `e2e` (177 pasaron, 1 inestable, 20 omitidas; el worker de WebKit que no cierra en Windows, ya conocido);
- **NO DISPONIBLE**: `migrations-applied` (SKIP: el worktree no tiene `.env.local`, por diseño). |
| Vitest de los archivos tocados (aislado, en serie) | árbol final | **PASÓ** 188/188 en 297 s (más 45/45 jsdom con carga) |
| `ci-workflow-contract` + `pruebas-linux` + `check-migrations-applied` después del merge de la #268 | `43bd640c` | **PASÓ** 83/83 |
| `prueba-aplicar-migracion.sh` | árbol final | **PASÓ** 36 · 0 |
| `node --test scripts/tests/verify-watchdog.node.mjs` | árbol final | **PASÓ** 15/15 |
| `pnpm docs:check` · `pnpm sdd:check` | después del merge de la #268 | **PASÓ** (535 specs; numbering sin repetidos) |
| `git diff --check` | cada commit | **PASÓ** |
| Runner en Linux local (Docker `node:24`) | — | **NO EJECUTADO**: Docker pide turno y la máquina estuvo ocupada por dos `verify` ajenas. Lo sustituye el CI de ubuntu, que es la medición pedida |
| `pnpm knowledge:status` | `4d289974` | **NO DISPONIBLE** como vigente. El worktree no tiene `graphify-out`: estructura `INVALID` con 3.553 faltantes, semántica `INVALID`, Obsidian `PENDING`. No es efecto de esta rama |
| `knowledge:visual:check` (Archify) | `4d289974` | **NO DISPONIBLE**: `ARCHIFY_RUNTIME_MISSING`. No se descargó el runtime |
| Vitest del portal y del contrato después del merge de la #270 | `4d289974` | **PASÓ** 109/109 (13 archivos); `docs:check` 536 specs y `sdd:check` sin repetidos |

## COMMITS

- `7e507886` test(harness): tope propio para las pruebas que leen el repo bajo carga.
- `650dd41f` test(harness): el árbol cortado se comprueba por identidad, no por PID.
- `46da663a` fix(ops): la evidencia de `aplicar-migracion.sh` no se lista a sí misma con `sha256sum` binario.
- `a76e7bd1` test(harness): el motivo del tope de la prueba PGlite va encima del `it`.
- `e82dd735` ci: las pruebas bash de operaciones corren en «Calidad continua».
- `58f1c0cd` test(ci): la prueba del runner exige el `FALLÓ` aunque el `tail` no lo alcance.
- `1b2e3f72` docs(sdd): spec.
- `7883ea56` merge de `origin/main` (#267).
- `43bd640c` merge de `origin/main` (#268), con el índice regenerado.
- `3ec1cceb` test(harness): tope propio para `migraciones.test.mjs`.
- `4d289974` merge de `origin/main` (#270), con el índice regenerado.
- El commit que contiene este documento (cierre: spec con mediciones y handoff).

## PR / BRANCH

- PR: https://github.com/hailuwaycom-sketch/DTDCARGO/pull/269, en borrador.
- Base: `main`. Rama: `worktree-agent-a2a74ff04f8ae776e`. Worktree: el de la tabla.
- Cabeza al cerrar: el commit que contiene este documento, hijo de `4d289974`.

## PENDIENTES DE ESTA TAREA

- El resultado del CI sobre la cabeza final, que estaba en curso al cerrar. Lo revisa el Director antes del merge.
- Nada más para la aceptación. La spec queda `in-progress` hasta el merge, como es norma.

## FUERA DE ALCANCE DETECTADO

- **Las suites bash largas de Vitest se acercan a su tope con carga.**
  - El trío de `entorno-prueba-scripts` llegó a 346 s y `prueba-migraciones-produccion.sh` a 282 s, contra 600 s.
  - Aisladas tardan 69-72 s y 56-60 s.
  - Con la carga real de `verify` (más fuerte que la sintética) podrían vencer.
  - Propuesta: correrlas en el paso Linux del CI y no en Vitest, o partir el trío. No se cambió: son de la 0540 y la 0546 y no vencieron en la evidencia.
- **`entorno-prueba-scripts` › «crear rc=143»** (handoff 0547):
  - no es un tope de Vitest, sino un `Terminated` que recibió el doble;
  - ningún script de `staging/` usa `timeout`;
  - origen NO VERIFICADO.
- **`consolidados/validar-lote-local.sh`** (0543) pide paquetes reales (con nombres) y Docker: no puede ir al CI tal como está. Una variante con un lote sintético sería otra tarea.
- **Las 11 `prueba-*.sh` fuera del CI** (Docker real, VPS o bucket) siguen a mano. `prueba-compose-prueba.sh` sólo pide `docker compose config` y podría correr en ubuntu, pero el contrato SDD-0349 deja Docker fuera del CI a propósito.
- **`consolidados/aplicar-lote.sh:120`:** si dos corridas del mismo paso caen en el mismo segundo, la carpeta se reutiliza y el `SHA256SUMS` viejo entra en el nuevo. La prueba lo evita con `sleep 1`.
- **Propuesta de conocimiento para el Director** (no aplicada, porque el archivo es fuente del piloto semántico y su recibo no se emite desde un worktree):
  - destino: `docs/runbooks/codex-engineering.md` §Validación, después del párrafo de SDD-0444;
  - texto: «SDD-0550 suma el paso “Pruebas bash de operaciones” (`bash infra/ops/tests/pruebas-linux.sh`) y exige que toda `infra/ops/tests/prueba-*.sh` corra en Vitest, en ese paso o figure entre las excluidas con su motivo»;
  - razón: es la regla vigente del CI y hoy sólo está en el contrato y en la spec.

## HANDOFF AL DIRECTOR

- **Siguiente acción.** Revisar la #269: diff, spec y contrato.
  - El paso nuevo suma 44 s a un job de 31-34 min, con tope de 45.
  - Las otras 11 pruebas bash siguen fuera, con su motivo.
- **Compartido con otras tareas:**
  - `infra/ops/tests/migraciones.test.mjs` (0546) y `entorno-prueba-scripts.test.mjs` (0540) sólo cambian de tope;
  - `infra/ops/migrate/aplicar-migracion.sh` (0540) cambia `cerrar()`, y la copia del servidor sigue con la vieja, que en Linux funciona;
  - las huellas de publicación (`huellas-fuera-de-imagen.sh`) no cubren `infra/ops`, así que no frenan la publicación.
- **Integración.** El merge publica solo (SDD-0541). Esta PR no trae migraciones ni código de producto.
- **Conocimiento.** Ver la fila `knowledge:status` y la propuesta de arriba.
- **Ownership.** Claim liberado al cerrar. No se eliminó el worktree ni la rama; la reserva `codex/sdd-reserve-0550` queda para que la borres cuando la spec esté en `main`.

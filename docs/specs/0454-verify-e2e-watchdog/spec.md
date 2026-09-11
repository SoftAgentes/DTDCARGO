---
sdd: "0454"
title: "Watchdog del e2e de verify: un cuelgue es FALLÓ con motivo, no una espera infinita"
status: done
author: "Claude Code (Worker) para Sam"
created: 2026-09-11
updated: 2026-09-11
supersedes: null
superseded_by: null
related: ["0280", "0329", "0440", "0444"]
confidencialidad: interno
---

# SDD-0454 — Watchdog del paso e2e de `verify`

> El e2e de `pnpm verify` podía pasar media hora o más sin escribir y bloquear
> el gate hasta que alguien cortara el árbol de procesos a mano. Ahora hay un
> límite: el paso falla con motivo COLGADO/TIMEOUT y el gate sigue.

## Contexto

El 2026-09-11 varios Workers corrieron `corepack pnpm verify` a la vez en
worktrees distintos. En dos casos el paso e2e (`scripts/verify.mjs` →
Playwright → `next dev` → Chrome) dejó de escribir salida durante más de 30 y
48 minutos:

- L21 (`.agents/handoffs/c-l21-portal-realtime-mensajes.md`, rama
  `codex/c-l21-portal-realtime-mensajes`): la pasada 1 cerró con
  `worker-49 process did not exit within 300000ms after stop, force-killed it`.
  El reintento dejó de escribir a las 03:16:12 y se detuvo a las 03:55:34 con
  `taskkill /PID 33860 /T /F`, que terminó 29 procesos.
- L08 (`.agents/handoffs/c-l08-mailing-rbac.md`, rama `codex/c-l08-mailing-rbac`):
  tras el resultado #142 (mobile-safari) no hubo salida durante 53 minutos.
  `taskkill /PID 45568 /T /F` terminó 29 procesos.
- En main ya estaba el patrón. L09 (`c-l09-bank-reconciliation-rbac.md`) tiene
  un E2E sin resultados después de mobile-safari, interrumpido a mano (26
  procesos). L13 (`c-l13-portal-reclamos.md`) tiene un worker cerrado por la
  fuerza a los 300000 ms.

En todos los casos hubo que reconstruir el árbol por PPID y hora de creación y
cortarlo sin tocar los `verify`/`next dev` de otras sesiones. Mientras tanto,
`build`, que va después del e2e, quedaba NO EJECUTADO.

`verify.mjs` corría cada paso con `spawnSync` heredando la terminal, sin
límite. El `timeout` de `spawnSync` no sirve porque mata sólo al hijo directo y
deja huérfanos al `next dev` (con su puerto), a los workers y a los navegadores.
En POSIX, además, Playwright lanza el webServer y los navegadores `detached`
(`launchProcess` de playwright-core), cada uno en su propio grupo de procesos,
así que matar el grupo tampoco alcanza.

No se conoce la causa exacta del cuelgue y esta spec no la persigue. El
objetivo es que el gate no pueda esperar para siempre y que lo diga.

## Decisión

1. El paso `e2e` corre bajo un watchdog (`scripts/verify-watchdog.mjs`) con dos
   límites en minutos, configurables por entorno:
   - `VERIFY_E2E_IDLE_MIN`, 10 por defecto: minutos sin un solo byte de salida
     de Playwright (stdout o stderr). El silencio legítimo más largo de una
     corrida sana es el cierre de un worker que no sale. Playwright 1.60 lo
     espera 300 s (`PWTEST_CHILD_PROCESS_TIMEOUT`), lo mata y escribe el error.
     El `webServer` tiene 120 s y cada test 60 s. Diez minutos es el doble del
     peor silencio sano.
   - `VERIFY_E2E_TIMEOUT_MIN`, 60 por defecto: duración total del paso,
     reintento incluido. Una pasada entera midió 11–14 min (L13, L21), más ~5 de
     cierre; dos pasadas quedan cerca de 40. Cubre una salida que gotea sin
     terminar nunca, que la inactividad no ve.

   Ambos admiten decimales. Un valor inválido (`0`, negativo, texto, > 1440)
   rompe el gate antes de correr nada, como una política de pasos incompleta.
   El watchdog no se puede apagar.
2. La salida del paso se canaliza y se reenvía tal cual, y así se mide la
   inactividad. Si quien corre el gate está en una terminal, se pasa
   `PLAYWRIGHT_FORCE_TTY=<columnas>x<filas>` para que Playwright conserve
   colores y reescritura de líneas. Un valor manual gana, y sin terminal (un
   Worker que guarda el log) no se agrega nada.
3. Al vencer un límite se termina el árbol que cuelga del hijo del paso, y sólo
   ese árbol:
   - se toma el inventario de procesos (Windows: `Get-CimInstance
     Win32_Process` con PID, PPID y hora de creación; POSIX: `ps -A -o
     pid=,ppid=,comm=`), se recorre por PPID desde el hijo y se corta por PID
     (TerminateProcess o SIGKILL);
   - un hijo anterior a su padre es un PID reusado y se descarta. Nunca se elige
     por nombre, puerto ni ruta: otros worktrees corren los mismos binarios, y
     el `next dev` que el gate reusa de este worktree no es suyo;
   - dos rondas más recogen lo que haya nacido de un proceso del árbol durante
     el corte. Antes de re-matar o acusar a un sobreviviente se confirma que su
     PID sigue siendo el mismo proceso;
   - no se usa `taskkill /T`, que arma el árbol sin mirar la hora de creación.
     Queda sólo como respaldo si no hay inventario;
   - el gate imprime qué terminó (raíz y cantidad por ejecutable) y los
     sobrevivientes, que deberían ser cero;
   - un proceso ya terminado que el sistema todavía lista, porque está
     cerrando su E/S pendiente, se informa como «aún en cierre del sistema, ya
     no corren», no como sobreviviente. En la validación real, Chrome tardó
     hasta unos 3 minutos en desaparecer después del corte, igual que con el
     `taskkill` manual de L08.
4. El paso queda **FALLÓ** con un motivo explícito que empieza por
   `COLGADO/TIMEOUT:`, en su línea `[FAIL]` y en el veredicto final
   (`verify: 1 fallo(s) → e2e [COLGADO/TIMEOUT: …]`), con exit 1. No es SKIP ni
   verde, y cuenta como paso que corrió.
5. Un cuelgue no se reintenta ni se absuelve. No es un test flaky:
   reintentarlo duplicaría la espera, y un segundo intento verde lo
   disfrazaría. Un fallo común conserva su `retry: 1`. Si después de un fallo
   común el reintento ya no cabe en el límite total, no se lanza y el motivo lo
   dice.
6. El gate sigue con el paso siguiente. `build` deja de quedar NO EJECUTADO por
   un e2e colgado.
7. `STEP_POLICY` no cambia: `e2e` sigue siendo crítico. `buildVerifyVerdict`
   acepta un fallo como nombre o como `{ name, reason }` y lleva el motivo a la
   línea final. Un fallo común sale idéntico que antes
   (`verify: 1 fallo(s) → lint`).
8. La ejecución de un paso (preflight, intentos, absolvedor, watchdog y
   clasificación) pasa de `verify.mjs` a `scripts/verify-runner.mjs` sin cambiar
   su comportamiento, para poder probarla con pasos falsos.

### Alternativas descartadas

- `globalTimeout` en `playwright.config.ts`: cambiaría toda corrida de e2e, no
  sólo el gate. Depende de que el runner de Playwright no sea justamente el
  colgado y, al vencer, espera el mismo cierre de workers de 300 s.
- `timeout` de `spawnSync`: deja huérfanos (ver Contexto).
- Matar por nombre (`chrome-headless-shell`, `node`) o por puerto: alcanza
  procesos de otros worktrees.
- Reintentar después de un cuelgue: ver punto 5.

## Alcance

- `scripts/verify.mjs`, `scripts/verify-runner.mjs` (nuevo),
  `scripts/verify-watchdog.mjs` (nuevo), `scripts/verify-step-policy.mjs` y
  `scripts/verify-e2e.mjs`.
- Pruebas: `scripts/tests/verify-watchdog.node.mjs` (nuevo) y
  `scripts/tests/verify-critical-coverage.node.mjs`. Corren en `harness:test` y
  en el paso `harness` de verify.
- Documentación: esta spec, el índice regenerado y una nota en
  `docs/runbooks/codex-engineering.md`.
- Fuera de alcance: `playwright.config.ts` (retries, workers y timeouts), los
  specs e2e, el producto, la CI y los demás pasos de verify.
- Integrar el cambio a main **sí dispara el deploy de producción en Vercel**.
  El `ignoreCommand` de `vercel.json` excluye sólo `docs/**` y el Markdown de
  la raíz, no `scripts/**` ni `.agents/**`. El artefacto de la aplicación no
  cambia, pero la autorización de merge tiene que cubrir ese deploy.

## Criterios de aceptación

- [x] Un proceso que calla durante el límite de inactividad se termina con todo
      su árbol (tres niveles, con la salida heredada por los nietos), y un
      proceso ajeno que corre el mismo script sigue vivo.
- [x] Una salida que gotea sin terminar se corta por el límite total.
- [x] Una corrida que termina sola conserva su exit (0, 1, 3), stdout y stderr,
      sin corte. Un proceso lento pero activo no se corta.
- [x] En el runner, un paso colgado queda FALLÓ con motivo COLGADO/TIMEOUT, sin
      reintento ni absolvedor, y el paso siguiente corre. El veredicto sale 1 y
      nombra el motivo.
- [x] Reintento, salto (exit 3), absolución y preflight siguen iguales, con y
      sin watchdog.
- [x] Los valores inválidos de los límites rompen el gate antes de correr pasos.
- [x] `corepack pnpm harness:test` PASÓ: 48/48 en local y 48/48 en la CI de
      ubuntu sobre `3028e2dc` (run 34631252080).
- [x] `corepack pnpm verify` completo se corrió y su resultado quedó registrado
      paso por paso. El watchdog no afecta una corrida normal. El `verify` no
      salió verde:
      - sobre `9c9aaebb` salió **FALLÓ (exit 1)**;
      - el e2e se colgó de verdad y el watchdog lo reportó COLGADO/TIMEOUT;
      - `migrations-applied` quedó sin medir por falta de credenciales de
        Supabase; sin Supabase ese paso tampoco puede quedar verde en este
        entorno.

      Lo que exige el criterio se cumplió:
      - el primer intento del e2e, que terminó solo, no fue tocado por el
        watchdog;
      - los otros 14 pasos que corrieron PASARON.

## Validación (2026-09-11)

- El `corepack pnpm verify` completo sobre `9c9aaebb` reprodujo el cuelgue de
  L21 y salió **FALLÓ (exit 1)**:
  - el primer intento del e2e terminó solo (150 passed, 15 failed por falta de
    Supabase, 3 flaky, 18 skipped en 13.5 min, con un worker forzado a los
    300 s) y el watchdog no intervino;
  - el reintento calló después de 51 resultados. A los 10 min sin salida, el
    watchdog cortó su árbol (raíz PID 43060, 25 procesos, 0 sobrevivientes, 6
    aún en cierre) y el paso quedó `[FAIL] e2e — COLGADO/TIMEOUT: …`;
  - `build` corrió y pasó, y el veredicto salió con exit 1 y el motivo,
    además de `migrations-applied` sin medir.
- Tres corridas del e2e real con límite total de 4 min cortaron entre 44 y 57
  procesos. La tercera cruzó la lista exacta del corte, por PID y hora de
  creación, contra 35 procesos de otros worktrees: no quedó ningún ajeno dentro
  del corte ni ningún descendiente fuera.
- La CI «Calidad local sin secretos» sobre `3028e2dc` PASÓ (run 34631252080):
  todos sus pasos, con `harness:test` 48/48 en ubuntu-24.04. Es la primera
  ejecución en Linux de las pruebas con procesos reales.
- El detalle está en `.agents/handoffs/verify-e2e-watchdog.md`.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| SGE-00.07 · estado visible y verdadero (aplicado al gate) | cumplimiento | Un cuelgue sale FALLÓ con exit 1 y motivo en la línea final. No puede presentarse como SKIP, verde ni cierre completo. |
| SGE-00.11 · qué ocurrió y qué sigue | cumplimiento | El motivo nombra el límite vencido y su variable. El corte informa raíz, procesos terminados, sobrevivientes y procesos aún en cierre. |
| SGE-00.06 · prevenir antes de informar | cumplimiento | Un límite inválido rompe el gate antes de correr pasos. |
| AUD-01 | no aplica | Tooling local. No cambia eventos de producto ni auditoría de negocio. |
| MP-01 / datos personales | no aplica | No captura, mueve ni borra datos. El inventario de procesos sólo lee PID, PPID, hora de creación y nombre de ejecutable, y no se persiste. |
| UI / marca | no aplica | Sin UI. |

## Riesgos y límites

- Windows no re-parenta. Si un proceso intermedio del árbol murió antes del
  corte, sus hijos quedan fuera del recorrido. En los cuelgues observados el
  árbol entero estaba vivo; si algo sobrevive, el gate lo nombra.
- La confirmación de identidad (mismo PID y misma hora de creación) sólo existe
  en Windows. En POSIX, `ps` no da la hora de creación, así que `created` es
  `null` y el corte confía en el PID. Ahí no hace falta tanto: el huérfano se
  re-parenta y el PPID siempre es de un proceso vivo.
- Queda una ventana residual de reciclaje de PID entre el inventario y el
  corte. Son milisegundos, y el corte vuelve a confirmar la identidad antes de
  re-matar o acusar a un sobreviviente. Las pruebas no matan por PID lo que ya
  se cortó: sus procesos tienen un tope de vida propio.
- Un paso cortado deja el `.next` del worktree como lo dejaría un `taskkill`
  manual. El build usa `.next-verify` y no depende de él.
- El watchdog cubre sólo el e2e, que es el único paso que se colgó. Los demás
  siguen sin límite.
- En Windows, el inventario depende de PowerShell/CIM (~1 s por consulta). Sin
  él, el corte se limita a la raíz más `taskkill /T` y el reporte lo declara.

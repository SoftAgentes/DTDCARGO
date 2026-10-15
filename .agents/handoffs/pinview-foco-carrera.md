# Handoff — «Ver PIN» espera el foco final y deja de dar rojos al azar (prueba de SDD-0515)

Fecha: 2026-10-14 en Caracas (UTC 2026-10-15, 02:30–03:20). Task ID: `pinview-foco-carrera`.
Owner / sesión escritora: `claude-932ffd30`, Worker Claude Code (Desktop), sesión `932ffd30-cfa7-4d98-b92c-d260d9065cdd`. El encargo vino directo de Sam, sin Director en la sesión. No hubo subagentes.

Estado: lista-para-revision, con la PR en borrador porque el `pnpm verify` completo no se corrió (pide turno; ver VALIDACIÓN). Nada está integrado.

Datos de la rama:

- **Worktree:** `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/pinview-foco-carrera`.
  - Lo creé con `git fetch origin` y `node scripts/harness-worktree.mjs start pinview-foco-carrera`.
  - `guard` y `claim --owner claude-932ffd30` pasaron sobre el árbol limpio.
  - Instalé dependencias con `corepack pnpm install --frozen-lockfile`. No copié ningún `.env`.
- **Rama:** `codex/pinview-foco-carrera`, sin upstream, desde `origin/main` `530a3158`.
- **Dónde empezó el trabajo:** la sesión arrancó en `.claude/worktrees/modest-chaplygin-c2cdee`, rama `claude/laughing-feistel-90a448` en `c60cd4fe`, creada por la app. Ahí hice la reproducción, la carga y los mutantes. Al pedir el claim, ese árbol tenía uno ajeno (`festive-ellis-03485b`, 2026-09-21). Un claim ajeno no se roba, así que creé este worktree, apliqué el mismo parche (28 líneas de diff) y dejé el árbol reciclado limpio, sin commits. Entre `c60cd4fe` y `530a3158` no cambió ni `PinViewDialog.tsx` ni su prueba; en `operarios/` solo cambiaron `OperariosClient.tsx` y su prueba (SDD-0520). Repetí en este worktree la reproducción, la prueba y los chequeos.
- **SDD:** no aplica. El cambio es solo de la prueba `PinViewDialog.test.tsx`, que es evidencia de SDD-0515. El comportamiento del Studio no cambia: `PinViewDialog.tsx` queda igual. No se reservó número.
- **Permisos (encargo de Sam):** commits locales, push de la rama propia y PR contra `main` sin fusionar. Sin merge, sin migraciones y sin tocar producción.

## OBJETIVO ORIGINAL

La prueba `app/studio/(app)/operarios/_components/PinViewDialog.test.tsx` (SDD-0515, «Ver PIN») falló en la suite completa de `pnpm verify` (2026-10-15, sobre `71c3cceb` de `codex/operarios-columnas-ajustables`), en el caso del error P0022. El foco quedó en el botón y no en el campo de contraseña, en 662 ms y 858 ms. Aislada pasaba 12/12.

Sam pidió reproducir la carrera, decidir si el defecto está en la prueba o en el componente y corregirlo sin debilitar la aserción del foco. Pidió también un control rojo y uno verde, la prueba repetida bajo carga, typecheck, lint, el handoff y la PR contra `main` sin fusionar.

## COMPLETADO

### Diagnóstico: el defecto está en la prueba

Después del `await viewOperarioPinAction(...)`, el componente produce tres cosas que llegan en tandas distintas del Scheduler de React 19:

1. **El error.** `setFailure(result)` corre fuera de la transición (después de un `await`) y React lo confirma en su propio commit. El mensaje y `aria-invalid` ya están en el DOM, pero `pending` sigue en `true`: el campo está `disabled` y el botón dice «Confirmando…».
2. **El fin de la transición.** Cuando termina la acción async, otro commit pone `pending` en `false`: el campo se habilita y el botón vuelve a «Ver PIN».
3. **El foco.** El `useEffect` de `[pending, failure]` mueve el foco al campo. Es un efecto pasivo de un commit de transición, así que React lo programa en otra tarea del Scheduler y no lo corre en el mismo commit.

La prueba esperaba el mensaje con `findByText` y afirmaba el foco en seguida. RTL cierra cada `findBy*`/`waitFor` con un `setTimeout(0)`, y el Scheduler avanza con `setImmediate`. En Node, cuál corre primero depende de la carga. Es el mismo mecanismo de `ClientDrawer.confirm-delete`, documentado en SDD-0486.

El componente no tiene defecto. Su estado final es determinista: el foco termina siempre en el campo de contraseña, porque el efecto solo actúa con `pending` en `false` y el error puesto. Además, un campo `disabled` no recibe foco, ni en jsdom ni en el navegador. El comentario del componente ya lo explica: «Va en un efecto porque durante la llamada los campos están deshabilitados y no reciben foco». Lo que fallaba era la prueba, que afirmaba en un estado intermedio con la transición sin cerrar.

Las dos fallas observadas muestran los dos huecos:

- **Con el retraso del Scheduler:** el volcado tiene el mensaje, `aria-invalid="true"`, el campo `disabled=""` y el foco en el botón `aria-busy="true"` «Confirmando…». Es el hueco 1→2.
- **Con carga real, sin retraso** (corrida 7): el campo ya está habilitado y el botón ya dice «Ver PIN», pero el foco sigue en el botón. Es el hueco 2→3.

Por el hueco 2→3 no basta con esperar el cierre de la transición. Lo medí con una variante («A») que espera `findByRole("button", { name: "Ver PIN" })`, comprueba `toBeEnabled()` y afirma el foco en seguida. Esa variante falló 2/2 casos con retrasos de 15 ms y de 40 ms.

### Arreglo (solo la prueba)

- **Casos de contraseña rechazada** (`it.each`: «la contraseña no es la suya» y «la base pide confirmarla (P0022)»). `expect(passwordInput()).toHaveFocus()` pasa a `await waitFor(() => expect(passwordInput()).toHaveFocus())`. La aserción sigue exigiendo el foco en el campo de contraseña: solo deja de afirmarlo a medio camino. Las aserciones de valor vacío y `aria-invalid` quedan síncronas, porque llegan en el mismo commit que el mensaje.
- **«Escape también cierra y borra el PIN»:** la misma carrera, encontrada al reproducir. `useDialogA11y` instala el listener de Escape del modal del PIN en un efecto pasivo. Ese efecto corre en la misma tanda que el que pone el foco inicial en «Cerrar» (`initialFocusRef: closeRef`). La prueba pulsaba Escape justo después de `findByText("6083")`, y bajo carga el Escape llegaba antes que el listener. Ahora espera `await waitFor(() => expect(Cerrar).toHaveFocus())` antes de pulsar Escape. Eso agrega una aserción (el foco inicial en «Cerrar») y no quita ninguna.
- `PinViewDialog.tsx` no cambia.

### Alternativa descartada: tocar el componente

Se podría envolver `setFailure` en un `startTransition` anidado, para que el error llegue junto con el fin de la transición, y mover el foco con `useLayoutEffect`. No lo probé: es una inferencia. La descarté por tres razones:

- no hay defecto visible para el usuario, y el estado final ya es correcto;
- cambiaría el comportamiento del Studio y pediría SDD;
- la prueba igual debe esperar el estado final y no depender de cómo React agrupa los commits.

## VALIDACIÓN

### Reproducción determinista (control rojo y verde)

Una copia temporal de la prueba (`*.tmp.test.tsx`, borrada después) retrasa el `setImmediate` del Scheduler antes de que cargue React, como en SDD-0486:

```ts
vi.hoisted(() => {
  const ms = Number(process.env.REPRO_DELAY_MS ?? "0");
  if (ms > 0) {
    (globalThis as any).setImmediate = (fn: any, ...a: any[]) => setTimeout(fn, ms, ...a);
  }
});
```

Pruebas que pasaron, en 2 corridas por retraso, sobre `c60cd4fe` en el árbol reciclado, con la máquina al 19–28 %:

| Retraso | 0 ms | 1 ms | 5 ms | 15 ms | 40 ms | 100 ms |
|---|---|---|---|---|---|---|
| Original | 12/12 · 12/12 | 12/12 · 12/12 | 10/12 · 10/12 | 9/12 · 9/12 | 9/12 · 9/12 | 9/12 · 9/12 |
| Corregida | 12/12 · 12/12 | 12/12 · 12/12 | 12/12 · 12/12 | 12/12 · 12/12 | 12/12 · 12/12 | 12/12 · 12/12 |

- Con 5 ms caen los dos casos de contraseña rechazada (P0022 incluido).
- Desde 15 ms cae además «Escape también cierra y borra el PIN», que espera 1.000 ms y vence.
- Repetida en este worktree, sobre `530a3158`: original 12/12 · 9/12 · 9/12 y corregida 12/12 · 12/12 · 12/12, con 0, 15 y 100 ms.

### Carga real sin retraso artificial

Un quemador ocupó 22 hilos (todos los núcleos lógicos) durante 300 s, con la CPU medida al 100 %. Corrieron 8 rondas alternadas, de 02:46:47Z a 02:51:55Z, sobre `c60cd4fe`:

| | Rondas en verde |
|---|---|
| Original | 7/8 (la ronda 7 falló en «la base pide confirmarla (P0022)», 755,8 ms, con el foco en «Ver PIN») |
| Corregida | 8/8 (12/12 en cada una) |

Es la misma falla del verify, sin ningún retraso artificial.

### Mutantes de `PinViewDialog.tsx` contra la prueba corregida

Los mutantes se aplicaron sobre el árbol de trabajo, con un reemplazo de cadena exacta que exige una sola coincidencia. Después de cada uno se restauró la copia de respaldo y `git diff` quedó vacío.

| Mutante | Resultado |
|---|---|
| M1: el efecto no pone el foco en la contraseña | FALLAN solo los 2 casos de contraseña rechazada (10/12) ✔ |
| M2: el foco va al motivo en vez de la contraseña | FALLAN solo los 2 casos de contraseña rechazada (10/12) ✔ |
| M3: el modal del PIN sin foco inicial en «Cerrar» | FALLA solo «Escape también cierra» (11/12) ✔ |
| M4: Escape no cierra el modal del PIN (`pending: true`) | FALLA solo «Escape también cierra» (11/12) ✔ |

### Comprobaciones

| Comprobación | Alcance / SHA | Resultado |
|---|---|---|
| Reproducción con retraso del Scheduler | `c60cd4fe` y `530a3158` más el arreglo | PASÓ: la original falla y la corregida pasa |
| Variante A (esperar el fin de la transición y afirmar el foco en seguida) | `c60cd4fe` | FALLÓ con 15 y 40 ms, como se esperaba: prueba el hueco 2→3 |
| Carga real (CPU al 100 %), 8 rondas | `c60cd4fe` | PASÓ: original 7/8 y corregida 8/8 |
| Mutantes M1–M4 | árbol de trabajo | PASÓ: los 4 quedan atrapados por las pruebas que les corresponden |
| `PinViewDialog.test.tsx`, 5 corridas | `530a3158` más el arreglo | PASÓ: 12/12 en las 5 |
| Suite de `app/studio/(app)/operarios/` | `530a3158` más el arreglo | PASÓ: 5 archivos, 150 pruebas |
| `corepack pnpm typecheck` | `530a3158` más el arreglo | PASÓ (exit 0) |
| `eslint` de `PinViewDialog.test.tsx` | `530a3158` más el arreglo | PASÓ (exit 0) |
| `git diff --check` | `530a3158` más el arreglo | PASÓ |
| `corepack pnpm docs:check` y `sdd:check` | `530a3158` más el arreglo y este handoff | PASÓ: índice sincronizado con 506 specs; numbering sin números repetidos |
| `corepack pnpm verify` completo | — | NO EJECUTADO. Pide turno (una corrida pesada a la vez) y dura más de 50 min. El diff es una sola prueba más este handoff; el CI «Calidad local sin secretos» de la PR corre la suite completa en Linux. |
| `corepack pnpm knowledge:status` | `530a3158` | EJECUTADO: el worktree nuevo no tiene derivados (estructural INVALID con 4.568 fuentes pendientes, semántico INVALID, Archify y Obsidian PENDING). Ver CONOCIMIENTO. |

## CONOCIMIENTO

- **Impacto documental:** este handoff nuevo. Ningún documento canónico cambia. La spec SDD-0515 (en `done`) no se toca: su criterio FRM-01/ERR-01 («errores en su campo [...] con foco en el campo») sigue respaldado por la misma aserción, que ahora es estable.
- **Graphify / Archify:** NO EJECUTADO. El worktree nuevo no tiene derivados, y construirlos es una corrida pesada. Las fuentes que cambian son una prueba y un handoff. El Director publica desde `main` integrado.
- **Para guardar como conocimiento (propuesta):** la memoria de carreras de React ya cubre la técnica. Lo nuevo es esto: esperar el fin de la transición no basta cuando lo afirmado sale de un `useEffect`, porque los efectos pasivos de un commit de transición corren en otra tarea. Hay que esperar el efecto mismo (el foco o el listener) con `waitFor`.

## COMMITS

- El arreglo de la prueba: `test(studio): SDD-0515 — Ver PIN espera el foco final en vez de afirmarlo a medio camino`.
- El commit que contiene este documento: el handoff.

Los hashes finales van en la PR.

## PR / BRANCH

- Rama `codex/pinview-foco-carrera` contra `main`, en el worktree `DTD-worktrees/pinview-foco-carrera`.
- La URL de la PR va en la PR misma y en el cierre de la sesión. No se fusiona.

## PENDIENTES DE ESTA TAREA

- `corepack pnpm verify` completo, cuando haya turno. Si sale verde, la PR pasa de borrador a lista.
- Revisar el CI alojado de la PR.

## FUERA DE ALCANCE DETECTADO

- **Claim viejo en un worktree reciclado por la app.** `.claude/worktrees/modest-chaplygin-c2cdee` conserva `harness-session-claim.json` de `festive-ellis-03485b` (2026-09-21). La app de escritorio reutilizó ese directorio para otras sesiones (`dreamy-kare-8ccfdb`, `objective-torvalds-43ae6c` y esta, `laughing-feistel-90a448`). `guard` pasa, pero `claim` falla con EEXIST, así que cada sesión nueva que cae ahí no puede reclamarlo. No lo toqué. Es decisión del Director liberarlo o limpiarlo.
- **La misma familia de carrera puede estar en otras pruebas** que afirman en seguida, después de un `findBy*`, algo que sale de un `useEffect` (foco o listeners). No lo inventarié.

## HANDOFF AL DIRECTOR

- **Siguiente acción:** revisar la PR. El diff es una prueba (9 líneas más y 1 menos, entre los dos arreglos) y este handoff.
- **Integración:** sin dependencias ni contratos compartidos y sin migraciones. Fusionar a `main` despliega a producción, pero el diff no cambia código de producto.
- **Verify:** pendiente de turno. La PR queda en borrador hasta entonces.
- **Ownership:** libero el claim de este worktree al terminar de escribir. No elimino ni el worktree ni la rama.

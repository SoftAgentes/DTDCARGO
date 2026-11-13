# Handoff · SDD-0603, claridad de controles, tramo 1

- **Owner:** Claude, sesión hija de Director General (`local_25e2dded-103b-4eaa-b10e-6527564b9cad`).
- **Rama:** `codex/0603-claridad-controles`, desde `origin/main` `f6cf37de4`.
- **Worktree:** `DTD-worktrees/0603-claridad-controles`.
- **SDD:** 0603, asignado por el Director General el 2026-11-04.
- **Rama de prueba, aparte:** `codex/rediseno-studio-prueba`, solo para imágenes de prueba. No se fusiona nunca.

## Autorización, literal

2026-11-04, en el chat de esta sesión:

- Botón: «Prepara la adopción».
- Texto: «Me gusta. Prepara todo y adopción, y simplemente déjame ver si puedo hacer un poco más compacto o algún botón para ver un ejemplo.»
- Selector: «Sí, en prueba.dtdcargo.com (Recommended)», «Sigue sin ellos» y «Sí, recórrelo tapado (Recommended)».
- Selector, viendo el BRAND-CHECK y el texto de BD-037: «Apruebo, en azul (Recommended)». Siguiente tramo: «Pestañas (Recommended)».
- Chat, tras comparar Normal y Compacto: «que damos con compacto y prederteminado ocuro».

Cubre preparar. No cubre fusionar ni publicar. El Director General pide un OK aparte de Sam, con el tramo a la vista, y da el turno de PR.

## Qué hace el tramo 1

Ver `docs/specs/0603-claridad-controles/spec.md`. Piezas compartidas del Studio, sin pantallas de CRM. Sin migraciones, rutas, acciones, permisos ni dependencias.

## Validación

- Tipos (`tsc --noEmit`, todo el repositorio): PASÓ.
- ESLint de los archivos tocados: PASÓ.
- Vitest focal (contrato nuevo, `DensityToggle`, `Badge`, `SegmentedControl`, `ActionMenu`, `ConfirmDialog`, contraste oscuro): PASÓ, 8 archivos y 66 pruebas.
- Mutantes del contrato: 2 de 2 muertos (contorno pálido del secundario; botón compacto bajo 32 px).
- `docs:check`, `sdd:check`, `governance:check`, `components:check`: PASÓ.
- `pnpm verify` sobre `88514c0d3`, antes de compacto y oscuro: exit 1 y no vale para el SHA actual; hace falta otro turno. Pasos en OK, build incluido; `test` FALLÓ por tiempo agotado en las dos pasadas; `migrations-applied` NO DISPONIBLE, sin `.env.local`. Aislados, los 5 archivos rojos y los 57 cuyo worker no arrancó PASARON.
- Vista en prueba de este tramo: NO EJECUTADA. Lo visto en prueba es la rama de prueba, que además trae los atajos que este tramo no adopta.

## Lo que tapaba la rama de prueba

`studio.css` traía una segunda regla `.studio-btn-ghost:hover` que, con el texto invertido, dejaba el secundario ilegible al pasar el cursor. En la rama de prueba no se veía porque `claridad.css` cargaba después. Quedó quitada, y el contrato exige una sola regla. Por casos así, lo visto en esa rama no sirve como evidencia de este tramo.

## Retomado el 2026-11-11

- **Owner:** Claude, sesión hija del Director General, worktree `.claude/worktrees/rediseno-0603-retomar-c82740`. Los worktrees de `DTD-worktrees/` del 2026-11-04 no se tocaron; sus ramas locales quedan atrás del remoto.
- `origin/main` `b63de1527` traído con un solo `git merge`, sin conflictos. Main no tocó ninguna pieza del tramo 1 desde la base (`studio.css`, `tokens.css`, `layout.tsx`, `ui/`, `(app)/_components/`).
- `git merge-tree` contra las PR abiertas que tocan Studio: #509, #318 y #319 sin conflicto; #310 a #314 y #317 chocan, pero con los mismos archivos con que ya chocan contra `main` (contabilidad, reportes, índice SDD). El tramo no agrega choques.
- Repaso de lo pendiente: impresión en claro por CSS y paneles de Chatwoot sin tema ni densidad ya están en `b717aa986`. Parpadeo: el script de `layout.tsx` aplica tema y densidad antes del primer paint, y `StudioTopbar`/`DensityToggle` leen con `useSyncExternalStore` y el mismo predeterminado en servidor; quien eligió claro solo ve cambiar el icono sol/luna al hidratar. Lo que queda es medirlo en la imagen de prueba (Aceptación, último punto medido en Chromium).
- Sin dependencias instaladas en este worktree: `docs:check`, `sdd:check`, `governance:check`, `components:check` y `git diff --check` PASARON con `node`. Tipos, ESLint, Vitest y build: NO EJECUTADO aquí; los corre el CI de la PR. `pnpm verify`: NO EJECUTADO.

## Pendientes de esta tarea

- CI verde de la PR y revisión independiente.
- Verlo en prueba antes de fusionar, sobre todo `Badge` en tablas angostas, oscuro en todas las pantallas y un PDF.
- OK de Sam para fusionar (BD-037), de a un tramo.
- Tramos 2 a 5: ver la spec. Sigue el de pestañas.

## Impacto documental

`app/studio/CLAUDE.md` §Estándar de botones, `BRAND.md` §Controles, BD-037, registro CMP de `SegmentedControl`, índice de specs. El Brand Book físico no se regenera: pide NORTE-SYNC. Graphify, Archify y Obsidian: NO EJECUTADO; los publica el Director desde main integrado.

## FUERA DE ALCANCE DETECTADO

- `app/studio/(app)/embarques/_components/EmbarquesClient.tsx:104`: «En aduana» sale como advertencia; BRAND.md dice que por sí sola no prueba riesgo.
- `components/BrandMark.tsx:32`: «DTD» en vino sobre navy casi no se lee en la variante reverse (BD-017 mide 1,56:1). Está así por regla de marca; es decisión de Sam.
- Studio en teléfono: a 375 px el menú lateral (248 px) ocupa casi toda la pantalla y el CRM desborda 145 px. Medido igual en `fe35eb2d1`: no viene del rediseño.
- React #418 en `/studio/tms` y `/studio/clientes`: 3 de 3 cargas en `fe35eb2d1` con la zona del navegador y 0 de 1 con UTC. No viene del rediseño. Inferido, no medido: que producción lo tenga igual, y que la causa sea formatear fechas con la zona del navegador (`ClientsClient.tsx:597`). Avisado al Director.
- `app/studio/(app)/marketing/noticias-web/page.tsx:68`, `ManualPromptModal.tsx:91` y `PublishModal.tsx:226` (en main desde SDD-0611) fuerzan `data-theme="light"` en un envoltorio, pero `tokens.css` solo define `[data-theme="dark"]`: las variables siguen oscuras dentro y el generador depende de colores fijos de Tailwind. Con oscuro por defecto, más gente abre esa pantalla en oscuro. Revisarla en la imagen de prueba; arreglarla es de su SDD.

## Enmienda de elevación, 2026-11-13

- **Owner:** Claude, sesión Worker encargada por el Director General (`local_25e2dded-103b-4eaa-b10e-6527564b9cad`), claim `local-0603-enmienda`.
- **Worktree:** `.claude/worktrees/0603-enmienda-elevacion-b4a07e`.
- **Rama:** `claude/0603-enmienda-elevacion-b4a07e`, desde `origin/main` `dcccddee611b674828309aedcec9101863357e7a`.
- **Autorización:** Sam aprobó la enmienda el 2026-11-12. El encargo autorizaba publicar la rama y abrir la PR, pero el DG cambió el cierre el 2026-11-13, porque Sam pidió no gastar más minutos de GitHub Actions: commits locales y pruebas en la PC con turno. No se hace push ni se abre la PR hasta que el DG avise. No incluye merge, despliegue ni producción.

### OBJETIVO ORIGINAL

Aplicar sobre `main` la Enmienda de elevación de SDD-0603: sombra por nivel, borde propio en oscuro y verbos en peso 700. Sin rehacer el tramo 1 (#510) ni el 2 (#511), y sin colores nuevos.

### COMPLETADO

- Spec: sección «Enmienda de elevación (2026-11-12, aprobada por Sam)», con la tabla de niveles, los tokens, el peso, la allowlist, la aceptación y el gate VIS-01. `updated: 2026-11-13`.
- `tokens.css`: `--ctl-border` (`var(--ink)`) y `--ctl-edge-hi`. En claro no pinta nada; en oscuro trae luz arriba con `--border-strong` y un aro de `--ink-soft`, y vuelve a claro al imprimir.
- `studio.css`: la sombra de `.studio-btn` sale de `--btn-edge` y `--btn-lift`. El primario va en `--shadow-md`, con `--shadow-lg` al pasar el cursor y `--shadow-xs` al oprimir. El secundario lleva contorno de 1,5 px en `--ctl-border` y `--shadow-xs`. Los rellenos (primario, oscuro, advertencia y peligro) llevan `--ctl-edge-hi`. Los controles de icono, cierre y densidad van en `--shadow-xs`, y `.studio-file::file-selector-button` pasa a peso 700.
- Contrato `claridad-controles-contract.test.ts`: 9 pruebas nuevas, con piso en las que cuentan. La aserción del tramo 1 sobre el contorno se reescribe a `--ctl-border` y conserva la medida de 3:1.
- BD-037, `BRAND.md` §Controles y `app/studio/CLAUDE.md` anotan la enmienda.
- Espejo del Norte: no aplica en el código, porque el Norte cambia solo por NORTE-SYNC. La enmienda queda pendiente para el Brand Book.

### Contraste medido (WCAG, sobre los tokens)

| Par | Claro | Oscuro |
|---|---|---|
| Contorno del secundario (`--ctl-border` sobre `--bg-surface`) | 16,49 | 13,08 |
| Vino del primario sobre `--bg-surface` (motivo del aro) | 10,58 | 2,26 |
| Aro `--ink-soft` sobre `--bg-surface` / `--bg-elevated` / `--bg-base` | no aplica | 6,86 / 6,00 / 8,26 |
| Texto de los rellenos | sin cambio desde el tramo 1, ≥ 4,5 y vigilado por contrato | igual |

### VALIDACIÓN

- `docs:check`, `sdd:check`, `governance:check`, `components:check` y `git diff --check`: PASÓ, corridos con `node`.
- Contrato con un mini-runner en node que imita lo que usa de vitest: PASÓ, 23 de 23. La prueba de impresión, recalculada con la misma lógica, da claves iguales y valores claros: PASÓ.
- Mutantes: 14 de 14 muertos. Cada uno rompe una regla: primario sin `md`, hover sin `lg`, secundario de 1 px, secundario sin `xs`, peligro sin borde, sombra base fija, aro pálido, aro con color literal, borde que pinta en claro, `--ctl-border` pálido, selector de archivo en 600, botón en 600, deshabilitado con sombra e icono sin nivel.
- `/ui-check`: OK con ajustes menores, que se miran en la imagen de prueba.
- Vitest real, tipos, ESLint y build: NO EJECUTADO todavía. El worktree no tiene dependencias; está pedido el turno de máquina al DG.
- `pnpm verify`: NO EJECUTADO, espera turno.
- Imagen de prueba: NO EJECUTADO; la arma el Director.

### COMMITS

- `33c89c886` docs(studio): SDD-0603 — enmienda de elevación en la spec y la marca
- `cbfb82981` feat(studio): SDD-0603 — elevación de controles y su contrato
- Este handoff, en un commit aparte.

### PR / BRANCH

Rama local `claude/0603-enmienda-elevacion-b4a07e`, sin publicar. Base `dcccddee611b674828309aedcec9101863357e7a`. PR: ninguna; espera el aviso del DG.

### PENDIENTES DE ESTA TAREA

- Turno de máquina: `pnpm install --frozen-lockfile`, vitest focal y `pnpm verify`. Registrar el resultado aquí.
- Push único y PR cuando el DG avise. Luego, el aviso al DG con el número de PR y la cabeza de 40 caracteres.
- En la imagen de prueba: el contorno de 1,5 px en pantallas 1x, el aro recortado por contenedores con `overflow: hidden` y un recorrido en oscuro.
- Graphify, Archify y Obsidian: NO EJECUTADO; los publica el Director desde main integrado.

### FUERA DE ALCANCE DETECTADO

- `SegmentedControl.tsx:137` pinta el peso de las opciones en línea (600 inactiva, 800 activa). Es selección, no verbo, así que la enmienda no lo toca. Si Sam quiere 700 en toda opción, va en otro tramo.
- `.studio-chip` (`studio.css`, filtros) queda en peso 600 y sin sombra, por la misma razón.
- Siguen abiertos los hallazgos ya anotados arriba: «En aduana», BrandMark reverse, Studio a 375 px, React #418 y `data-theme="light"` en noticias-web.

### HANDOFF AL DIRECTOR

Enmienda lista en local: cabeza en el commit de este handoff, sobre `dcccddee6`. Falta el turno de máquina para vitest real y `verify`. Sin push, por instrucción del DG del 2026-11-13.

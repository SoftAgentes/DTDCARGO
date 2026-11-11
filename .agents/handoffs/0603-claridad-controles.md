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

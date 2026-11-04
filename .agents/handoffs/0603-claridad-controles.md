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

Cubre preparar. No cubre fusionar ni publicar. El Director General pide un OK aparte de Sam, con el tramo a la vista, y da el turno de PR.

## Qué hace el tramo 1

Ver `docs/specs/0603-claridad-controles/spec.md`. Piezas compartidas del Studio, sin pantallas de CRM. Sin migraciones, rutas, acciones, permisos ni dependencias.

## Validación

- Tipos (`tsc --noEmit`, todo el repositorio): PASÓ.
- ESLint de los archivos tocados: PASÓ.
- Vitest focal (contrato nuevo, `DensityToggle`, `Badge`, `SegmentedControl`, `ActionMenu`, `ConfirmDialog`, contraste oscuro): PASÓ, 8 archivos y 66 pruebas.
- Mutantes del contrato: 2 de 2 muertos (contorno pálido del secundario; botón compacto bajo 32 px).
- `docs:check`, `sdd:check`, `governance:check`, `components:check`: PASÓ.
- `pnpm verify`: NO EJECUTADO; se pide turno al Director.
- `next build`: NO EJECUTADO en este tramo. La rama de prueba sí compiló en su imagen, con otro contenido.
- Vista en prueba de este tramo: NO EJECUTADA. Lo visto en prueba es la rama de prueba, que además trae los atajos que este tramo no adopta.

## Pendientes de esta tarea

- Aprobación de Sam del texto BD-037. Hasta entonces, no se fusiona. Al aprobarse, se escribe en `BRAND-DECISIONS.md` y `BRAND.md`.
- Turno del Director para `pnpm verify` y PR.
- Verlo en prueba antes de fusionar, sobre todo `Badge` en tablas angostas.
- Tramos 2 a 5: ver la spec.

## Impacto documental

`app/studio/CLAUDE.md` §Estándar de botones, registro CMP de `SegmentedControl`, índice de specs. Graphify, Archify y Obsidian: NO EJECUTADO; los publica el Director desde main integrado.

## FUERA DE ALCANCE DETECTADO

- `app/studio/(app)/embarques/_components/EmbarquesClient.tsx:104`: «En aduana» sale como advertencia; BRAND.md dice que por sí sola no prueba riesgo.
- `components/BrandMark.tsx:32`: «DTD» en vino sobre navy casi no se lee en la variante reverse (BD-017 mide 1,56:1). Está así por regla de marca; es decisión de Sam.
- Studio en teléfono: a 375 px el menú lateral ocupa casi toda la pantalla y el CRM desborda 145 px. Medido sobre la rama de prueba; falta medirlo en `fe35eb2d1`.
- React #418 en `/studio/tms` y `/studio/clientes`, medido sobre la rama de prueba. Falta medirlo en `fe35eb2d1`. Es inferencia que no venga del rediseño.

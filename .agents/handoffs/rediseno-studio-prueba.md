# Handoff · Rediseño prueba del Studio y del portal

- **Owner:** Claude, sesión hija de Director General (`local_25e2dded-103b-4eaa-b10e-6527564b9cad`).
- **Rama:** `codex/rediseno-studio-prueba`, desde `origin/main` `fe35eb2d1`. Sin PR a `main`.
- **Worktree:** `DTD-worktrees/rediseno-studio-prueba`.
- **SDD:** ninguno todavía. Esta rama es una exploración para mirar en `prueba.dtdcargo.com`. Adoptarla pide SDD con allowlist, según `docs/governance/AGENT-BRIEF.md`.

## Pedido, con palabras de Sam (2026-11-04)

- «estoy viendo los botones muy pálidos»; no distingue «qué oprimir y qué es mensaje».
- «Es una issue del CRM, adentro de eso, y se ve muy pálido. [...] La idea es que lo hagamos en todo el ERP completo, más que en la página web, en el ERP y en el portal del cliente.»
- Selector en este chat: «Sí, en prueba.dtdcargo.com (Recommended)» y «Sigue sin ellos» (sin comparar con repositorios externos).

## Qué cambia

- `app/studio/claridad.css` y `app/portal/claridad.css`: reglas nuevas, cargadas solo en esas dos superficies. La web pública no cambia.
- Piezas compartidas: `Badge`, `ErrorAlert`, `KpiCard`, `SegmentedControl`, `DrawerShell`, `StudioSidebar`, `PortalHubTabs`, `FieldLabel`.
- Pantallas: `CrmTableroKanban` y `EmbarquesClient`.
- Sin migraciones, sin acciones de servidor y sin cambios de permisos.

## Deuda antes de producción

- `claridad.css` usa `!important` y selectores sobre el estilo en línea (`[style*="var(--warning-bg)"]`) para verlo en todo el ERP sin barrer archivos. No es la forma final: se migra por SDD.
- `app/studio/CLAUDE.md`, §Estándar de botones, y el Norte describen los botones de antes. El Norte es la fuente de apariencia: adoptar esto pide decisión de marca registrada.

## Validación

- Tipos: PASÓ (`tsc --noEmit`, sobre todo el repositorio).
- ESLint de los archivos tocados: PASÓ.
- Vitest focal (`app/studio/_components/ui`, CRM kanban y embudos, embarques, `PortalShell`): PASÓ, 19 archivos y 249 pruebas.
- `pnpm verify`: NO EJECUTADO. No hay PR, y la imagen de prueba corre su propio `next build`.
- Vista real en prueba: pendiente de turno.

## FUERA DE ALCANCE DETECTADO

- `app/studio/(app)/embarques/_components/EmbarquesClient.tsx:104`: «En aduana» sale como advertencia; BRAND.md dice que por sí sola no prueba riesgo.
- `components/BrandMark.tsx:32`: «DTD» en vino sobre navy casi no se lee en la variante reverse (BD-017 mide 1,56:1). Está así por regla de marca.

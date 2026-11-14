# Handoff · SDD-0603 tramo 4b · Plataforma (avisos en `Aviso`)

- **Owner:** Worker T4b (sesión `local_b1580d13`), reporta al Subdirector Rebrand (`local_9104159b`).
- **Ruta:** `.claude/worktrees/0603-t4b-plataforma-0af1d7`
- **Rama:** `claude/0603-t4b-plataforma-0af1d7`, base `claude/tren-ae` `4441f65ac` (tren #540, ola 1).
- **SDD:** 0603 (BD-037), adopción del componente de 0628. Documento del tramo: [`tramo-4b.md`](../../docs/specs/0603-claridad-controles/tramo-4b.md).
- **Objetivo:** que los avisos hechos a mano de los 62 archivos de Plataforma usen `<Aviso>` con el tono de BRAND §Estados, sin cambiar textos.
- **Permisos:** push de la rama propia y PR lista para revisión contra main, con Auto-fix. **Prohibido:** fusionar, imagen de prueba y producción. La revisión independiente la lanza el DG.

## Estado

- Hecho: 43 archivos adoptados, con 77 avisos; 19 «no aplica» documentados. Dos pruebas ajustadas y endurecidas (NorteTab y RadarTab).
- Validación: ver la sección de abajo, que se completa con cada corrida.

## Validación

| Comprobación | Resultado |
|---|---|
| Vitest focal: debug; admin (componentes, actualizaciones, alertas, rutas, agentes); comentarios, academia, club, bugs, calendario, legal, usuarios y denegación; `_components` (ui, wiring, guía, adjuntos, contratos) | PASÓ: 61 archivos, 636 pruebas. La primera corrida dio 1 rojo en `dark-theme-contrast-contract`, por el chip de PortalBackfill (ver tramo-4b.md, Pruebas). Corregido y repetido en verde. |
| `tsc --noEmit` | PASÓ (exit 0) |
| ESLint de los archivos tocados, `--max-warnings=0` | PASÓ (exit 0) |
| Mutante: quitar `franja.tabIndex = -1` de `enfocarAviso` (CityDrawer y TariffDrawer) | MUERTO: caen 4 pruebas; archivos restaurados |
| `/ui-check` sobre el diff | PASÓ, con ajustes menores no bloqueantes: los márgenes de los envoltorios conservan sus px anteriores (8, 10, 14, 20) en vez de `var(--s-*)`; hay dos regiones `status` en la tarjeta de la guía cuando falta el ancla; los botones primarios quedan dentro de dos avisos (token de API y catálogo vacío). Sin hex nuevos, sin anidar `div` en `p` y sin AI slop. |
| `pnpm verify` | NO EJECUTADO: el portón es el CI de GitHub |
| Revisión visual en pantalla | NO DISPONIBLE: sin imagen de prueba en este encargo |

## Impacto documental

- Nuevo: `docs/specs/0603-claridad-controles/tramo-4b.md`.
- `spec.md` de 0603 y 0628, `docs/specs/README.md` y registro de componentes: sin cambios (fuera de la allowlist). Si el DG quiere la tabla de tramos actualizada, va en la integración.
- Graphify y Archify: no se regeneraron en este worktree; el cambio es de componentes de UI sin documentos de `semanticPilot`.

## Pendientes de esta tarea

- Traer `origin/main` una vez cuando la #540 entre a main.
- La revisión visual en claro, oscuro, compacto y 375 px va con el tren.

## FUERA DE ALCANCE DETECTADO

- Voseo en textos visibles que no se tocaron: «corré de nuevo» (PortalBackfillSection), «Regeneralo» (NorteTab), «regenerá» (RadarTab), «Habilitalas» (ProfileModal).
- `BugsAdminClient.tsx`: botón ámbar con estilo en línea por eventos del ratón y respaldos hex (tramo de controles).
- Pantalla de acceso (`LoginForm`, `RecoveryForm`) con paleta propia fuera de tokens: adoptar `Aviso` ahí pide antes llevarla a los tokens.
- `Aviso` no acepta `ref`, `tabIndex` ni `data-*`. Propuesta: aceptar `ref` y `tabIndex` y borrar las tres copias locales de `enfocarAviso`.
- `RunsTable.tsx` está guardado en el índice con CRLF, a pesar de `eol=lf`. Se commiteó conservando CRLF para no reescribir el archivo entero; normalizarlo es un cambio aparte.

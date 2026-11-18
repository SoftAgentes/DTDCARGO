# Handoff · ajustes-pantalla-studio

- Owner/sesión: Worker `local_e2f8e9d8-3d93-48c5-83bc-f3466a42b67b`
- Rama: `claude/ajustes-pantalla-studio-ca88b6` (base `main`)
- Origen: pedido de Sam del 2026-11-18, vía Director General.
- SDD: ninguno. Son ajustes visuales sin cambio de datos, permisos ni flujo. Si el DG decide que exige SDD, que asigne el número.

## Objetivo

Tres arreglos chicos de UI del Studio.

1. El contador rojo de Conversaciones y de la campana ya no tapa el icono.
2. El menú lateral cerrado muestra el nombre del módulo al instante.
3. El pie de la tarjeta de Bitácora no encima textos en tarjetas angostas.

## Cambios

- `app/studio/studio.css`:
  - `.studio-icono-btn__contador`: esquina superior derecha, montado sobre el borde del botón; `data-tono` vino/peligro.
  - `.studio-sb-tip`, `.studio-sb-icono` y `.studio-sb-link--cerrado`: tooltip de 90 ms y corrimiento de 3 px del icono, sin movimiento con `prefers-reduced-motion`.
- `ConversationsIndicator.tsx` y `NotificationBell.tsx`: el span del contador pasa de estilos en línea a la clase. El botón no tiene `overflow` que recorte.
- `StudioSidebar.tsx`: con el menú cerrado se quita el `title` nativo y se pone `aria-label`. Un tooltip `position: fixed` (el aside recorta con `overflow: hidden`) sale con mouse y con `:focus-visible`.
- `BoardKanban.tsx`: el pie y su grupo de datos usan `flex-wrap`. El selector (`minHeight` 44) baja a su línea y se alinea a la derecha (`marginLeft: auto`).

## Pruebas

- Nuevas: `StudioSidebar-tooltip.test.tsx` (6), `contador-icono.test.tsx` (2) y un caso en `BoardKanban.test.tsx`. No se tocó ni debilitó ninguna prueba existente.
- Los 3 archivos corrieron en verde (27 pruebas con las de `StudioSidebar-crm`). `tsc --noEmit` y `eslint` sobre los directorios tocados: sin errores.
- `pnpm verify`: ver el resultado en la PR (cierre canónico).
- `/ui-check`: OK para commit. Dos observaciones menores y no bloqueantes: `-7px` como compensación fija, y el tooltip no se reposiciona si se hace scroll del `nav` con el mouse quieto.
- No verificado a ojo en navegador: el CSS y la lógica se probaron por jsdom y por contrato de `studio.css`.

## Impacto documental

No aplica (ajuste visual; no cambia reglas estables).

## Pendientes de esta tarea

- Revisión visual de Sam o del DG con el menú cerrado y una tarjeta de ~190 px.

## FUERA DE ALCANCE DETECTADO

- Los botones `title=` del propio aside (colapsar o expandir, slider de ancho) conservan el aviso nativo lento. No se tocaron por quedar fuera del pedido.
- Aviso técnico: `pnpm install` falló una vez con error 32 (archivo bloqueado en Windows) y pasó al reintentar.

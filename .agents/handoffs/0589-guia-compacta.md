# SDD-0589 · §9: la guía se distingue del sistema y es más compacta (handoff)

Rama `claude/guia-compacta-20428c`, worktree `.claude/worktrees/guia-compacta-20428c`, desde `main` en `2e35e607f`. Encargo del Director General (2026-11-16), a partir de lo que pidió Sam después de probar el Studio en el entorno de prueba. Solo visual; nada en producción, sin migraciones ni datos.

## OBJETIVO ORIGINAL

Sam: la guía del inicio «parece una ventana más»; tiene que distinguirse del sistema, sin gritar, y leerse como «mira, hay esto y lo puedes cerrar». Además, más compacta: ocupa mucho espacio en la pantalla.

## COMPLETADO

El diseño, la tabla antes/ahora, el contraste calculado, la allowlist y la aceptación (C1–C5) están en `docs/specs/0589-guia-motor-studio/spec.md`, sección «2026-11-16 · §9».

- `GuiaTarjeta.tsx`: superficie con `--wine-tint` sobre `--bg-surface`, barra superior de 3 px en `--wine-text`, etiqueta «GUÍA» con punto en `--wine-text`, botón «✕ Cerrar» con la palabra visible (nombre accesible «Cerrar la guía», que la contiene), ancho 300 px (antes 360), alto máximo 340 px, relleno y separación `--s-3`/`--s-2`, texto un punto más chico, botones de 32 px y acciones secundarias de 28 px.
- `GuiaMotor.tsx`: `TARJETA_ESTIMADA` pasa a 300×200 (solo la referencia antes de medir la tarjeta real).
- `GuiaMotor.test.tsx`: prueba nueva «se distingue del sistema, es compacta y el Cerrar se lee (§9, 2026-11-16)». Ninguna prueba existente cambió.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| Pruebas de `app/studio/_components/guia` y `lib/studio/guia`, con 1 worker y turno del DG | PASÓ: 159 de 159 en 9 archivos |
| Mutante: ancho de vuelta a 360 px y sin tinte | FALLÓ la prueba nueva, como se esperaba; archivo restaurado |
| ESLint de los 3 archivos, con `--max-warnings=0` | PASÓ |
| `tsc --noEmit` | NO EJECUTADO: el turno cubría install, vitest y capturas; lo mide el CI |
| `/ui-check` del diff | PASÓ con ajustes menores, aplicados (ver abajo) |
| Capturas antes/después, claro y oscuro, 1440 px y 390 px | HECHAS, fuera del repo (ver abajo) |
| `pnpm verify` y la página real en prueba | NO EJECUTADO. El portón es el CI y la revisión independiente que lanza el DG |

### Capturas

Ocho PNG con Chrome headless, en el scratchpad de la sesión (fuera del repo): `antes|despues` × `light|dark` × `1440|telefono`. **Límite:** son de una maqueta estática que copia el marcado y los estilos de la tarjeta antes y después del cambio, con `app/studio/studio.css` y `tokens.css` reales, sobre un fondo de Dashboard simulado con datos ficticios. No son del Studio corriendo: la fuente es la del sistema y no Nunito/Sora, y la colocación imita a `colocarTarjeta` (debajo del ancla). El Studio real queda para la revisión en prueba.

Medido en la maqueta a 1440 px: la tarjeta pasa de 360×~290 px a 300×~270 px (−22 % de área); en teléfono, de 350 px de ancho a 300 px.

### /ui-check (2026-11-16)

1. ⭐ [media] `GuiaTarjeta.tsx` — había `marginBottom: 2` y `paddingTop: 2` fuera de la escala de 4 px. **Aplicado:** vuelve a `var(--s-1)` y se quita el `paddingTop`.
2. [baja] `GuiaTarjeta.tsx` — `linear-gradient(var(--wine-tint), var(--wine-tint))` es una capa plana (mismo color en los dos extremos), no un gradiente visible: es la forma de pintar el tinte sobre `--bg-surface` sin un token nuevo. No es AI slop, pero si el DG prefiere un token `--guia-bg` en `tokens.css`, es un cambio de una línea.
3. [baja] La barra de acento es superior y en vino de marca, no un `border-left` de color al azar.

Lo que está bien: solo tokens, sin hex; foco, teclado, `aria-*`, `z-index` y `prefers-reduced-motion` sin tocar; contraste AA en los dos temas (el más justo es `--ink-soft` en claro, 4,59:1); objetivos de toque ≥ 28 px (WCAG 2.5.8 pide 24).

## PENDIENTES DE ESTA TAREA

- Revisión independiente (la lanza el DG) y CI verde antes de fusionar.
- Ver la tarjeta en prueba con Sam después de la fusión.

## FUERA DE ALCANCE DETECTADO

- Ninguno.

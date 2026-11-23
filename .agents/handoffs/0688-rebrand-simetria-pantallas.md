# Handoff · SDD-0688 fase 1 (reglas)

Worker · 2026-11-22 · rama `claude/sdd-0688-fase1-reglas-ae198b` · solo documentos, sin código.

Pedido de Sam: «Rebrand: arranca la fase 1 de la simetría de pantallas (reglas)».

## Hecho
- `docs/governance/policies/btn-01.md` → v1.3: reglas 1 a 6 (Studio y Portal). La 4 entró pendiente y quedó vigente el 2026-11-22 (BD-077).
- AVS-01 → enmienda v1.1 (reglas 7 a 9) en `docs/specs/0165-.../spec.md` §17. Es su documento canónico: no existe `policies/avs-01.md`.
- Medidas (reglas 10 y 11) en `app/studio/CLAUDE.md` (Drawers) junto a un resumen de las reglas de botones y mensajes.
- `docs/governance/README.md` (filas BTN-01 y AVS-01) y cápsula regenerada (`pnpm governance:index`).
- Spec 0688: allowlist y fila AVS-01 con la ruta localizada.

## Comprobaciones
docs:check PASÓ · sdd:check PASÓ (solo choques históricos conocidos) · governance:check PASÓ. vitest NO EJECUTADO (pedido). `pnpm verify` NO EJECUTADO (solo documentos).

## Decisiones de Sam (A/B dibujadas)
1. **Regla 4 (BRAND-CHECK, `BRAND.md:324`) — CERRADA: Sam, «regla a» (opción A), 2026-11-22; BD-077.** A: confirma la excepción con sus palabras → se registra en `BRAND-DECISIONS.md` y la regla pasa a vigente. B: se retira o se reduce a variantes que ya existen (relleno `danger` + contorno `ghost` rojo si ya existe).
2. **Dónde vive AVS-01.** A (hecho): enmienda en SDD-0165 §17, sin tocar la cápsula. B: extraer el texto a `policies/avs-01.md` v1.1; entraría a la cápsula como política nueva (más ceremonia, L3).

## Pendientes de esta tarea
- Aprobación del carril: es PR con revisión previa (gobernanza), no carril rápido.

## FUERA DE ALCANCE DETECTADO
- `governance:check` y `README` mantienen `sourceCommit` de la cápsula; se actualizó solo por regeneración.
- Impacto documental: al abrir las fases 3, 4 y 10, actualizar «aún sin código» de `app/studio/CLAUDE.md`.
- `policy-registry.json:30` del plugin `erp-studio-governance` todavía dice BTN-01 1.1 (ahora 1.3).
- BTN-01 §3: se prohíbe «Aceptar» de forma explícita (enmienda dentro de v1.3), porque la regla 1 ya lo citaba.
- `BRAND.md:11` sigue siendo la línea de BRAND-CHECK (la cita no pasa a :10).


---

# Handoff · SDD-0688 fase 2 (estilos de texto, `EncabezadoPagina`, tres vistas)

Worker · 2026-11-23 · rama `claude/cool-hamilton-cc627e` · allowlist aprobada por el Director (ver spec, «Fase 2 · allowlist»).

## Hecho
- `tokens.css`: once variables `--t-*` (+ `--t-piso`, `--fila-h`, `--objetivo-min`) con valores por vista. Normal en `:root`, Compacta y Súper compacta (`ultra`) en `[data-density]`. Se retiró el bloque `spacious`.
- `studio.css`: clases `.t-display … .t-feedback` que leen esas variables; `.studio-encabezado*`; selector `.studio-vista` (reemplaza `.studio-densidad`).
- `appearance-prefs.ts` y script del layout: `compact | normal | ultra`; `spacious` guardado se lee como Normal. Por navegador, sin migración.
- Selector «Vista» (Normal, Compacta, Súper) en la barra superior y en Administración › Apariencia.
- `EncabezadoPagina` (`proposed`, ficha CMP-01) adoptado en calendario, tracking, dashboard (tono navy) y el título del login con `.t-pantalla`.
- Contrato `estilos-texto-contract.test.ts` (estructura, piso de 12 px, objetivos de 32 px, las tres vistas).

## Decisiones A–D: cerradas por Sam el 2026-11-23
Cita textual (relayada por el Director): «0688: la vista Compacta queda por defecto y apruebo los tamaños propuestos». Cubre A (tamaños), B (eyebrow y caption a 12 px, piso 12), C («Normal» nueva de 14 px y filas de 44 px) y D (Súper compacta comprime espacios y títulos); Compacta por defecto. Los tamaños siguen en `tokens.css`, sin cambio de valores; se quitó la palabra «provisional».

## Cambios visuales leves para la captura de Sam
- Subtítulo del dashboard: 14 px → `--t-cuerpo-compacto` (13 en Normal, 12 en Compacta y Súper).
- Margen bajo el encabezado de tracking: 16 px → `--s-6` (18 en Compacta, 24 en Normal).
- Título de pantalla en calendario, tracking, dashboard y login: 30 px → `--t-pantalla` (26 en Compacta).
- Eyebrow del encabezado: 11 → 12 px.

## Comprobaciones
Con TURNO DE PC (2026-11-23): vitest de `app/studio/_components` y `(app)/_components` PASÓ salvo 2 mutantes de `color-accion-fase2-g8-contract` (Tracking en vivo) que fallan por CRLF del checkout de Windows (`autocrlf`: blob LF, copia de trabajo CRLF, el test busca `
`); la fase no toca esas reglas, en CI Linux no aplica. tsc PASÓ. eslint de lo tocado PASÓ. `pnpm components:index` PASÓ (registro regenerado y confirmado con `components:check`). `governance:check` PASÓ. `pnpm build` y `pnpm verify` NO EJECUTADO. Selector medido a 375 px: con nombres completos 172-208 px de ancho (apretaba la barra); ahora en móvil muestra N · C · S, 98×34 px (botones de 32 px).

## Pendientes de esta tarea
- Correr `pnpm components:index` (regenera `docs/governance/generated/component-registry.json` con la ficha nueva) y las pruebas con turno de PC.
- Revisión visual en pantalla de las tres vistas, en claro y oscuro (aún no se abrió ninguna).

## FUERA DE ALCANCE DETECTADO
- Menú lateral y barra superior mantienen sus tamaños en px: migrarlos cambia la vista por defecto; espera la decisión A/B de Sam.
- `body` no lee `--t-cuerpo`: por eso Súper compacta hoy actúa sobre espacios, filas de lo ya tokenizado, títulos y las clases nombradas, no sobre todo el texto de módulos con `fontSize` suelto (fase 9).
- `app/studio/CLAUDE.md` todavía menciona `compact|spacious` y el botón «Compacto» (no estaba en la allowlist).
- VIS-02 no se tocó (evita desfasar la cápsula sin poder regenerarla); la correspondencia rol→clase está en `studio.css` y la spec.

## Cierre de la fase 2 (2026-11-23) · corrección de la revisión independiente
- **Qué cambió (commit `18f71bd0b`, PR #789):** `.studio-vista` sin `overflow: hidden` (recortaba el anillo de foco, WCAG 2.4.7); los botones de los extremos redondean las esquinas. Contrato con la prueba de foco y su mutante. Spec: archivos fuera de la allowlist anotados. `app/studio/CLAUDE.md`: vista en lugar de `compact|spacious`. Cambios visuales leves anotados arriba para la captura de Sam.
- **PASÓ:** vitest de estilos-texto + claridad-controles + DensityToggle (39/39), `tsc`, eslint del contrato, `components:check`, `governance:check`.
- **NO EJECUTADO:** `pnpm build`, `pnpm verify`. El anillo de foco se verificó por CSS, no en pantalla.
- **Falta:** la re-revisión independiente de la corrección y el CI sobre `18f71bd0b`. La PR no se mergea sin ellas. Desde este cierre la sigue Codex como Director.

## Reapertura (2026-11-23): conflicto con main y CI rojo
- **Conflicto:** al entrar #790, `git merge origin/main` chocó solo en `docs/governance/generated/component-registry.json` (generado). Se tomó la versión de main y se regeneró con `pnpm components:index` (8 componentes). `app/studio/CLAUDE.md` se fusionó sin conflicto.
- **CI rojo sobre `bb355d8ba`:** el único fallo fue `lib/studio/chatwoot/__tests__/guia-panel.test.ts` («vuelve a contestar solo cuando algo cambió», esperaba 2 cajas y recibió 1): 1 de 21.966 pruebas. Prueba de tiempos (espera del observador del DOM) en código que esta PR no toca (`lib/studio/chatwoot` sin cambios); local pasa 3 de 3. Se trata como intermitente: no se tocó ni se debilitó.
- **PASÓ local tras el merge:** vitest de `app/studio/_components`, `(app)/_components`, `component-registry.test.ts` y `policy-registry.test.mjs` (972/972), `tsc`, eslint de lo tocado, `components:check`, `governance:check`. NO EJECUTADO: `build`, `verify`.
- **Falta:** CI sobre la nueva cabeza y la re-revisión independiente del foco.

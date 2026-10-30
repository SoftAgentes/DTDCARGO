# Handoff — SDD-0589 · paso 9.2 del programa SDD-0582 (motor de guía)

- **Owner:** Claude Worker «E9 motor», sesión lanzada por la sesión del programa (`local_535053f4…`). Claim `local_e9-motor-00035d32`.
- **Ruta:** `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\adoring-spence-69ff0b`
- **Rama:** `codex/0582-e9-motor`. Nació apilada sobre `codex/0582-e9-guion` (`37c64d114`, PR #330); la #330 ya está en main y esta rama trajo `origin/main` por merge el 2026-10-30. El Director reapunta la #338 a `main`.
- **SDD:** [0589](../../docs/specs/0589-guia-motor-studio/spec.md), reservada con `next-number.mjs --reserve guia-motor-studio --push`. Deja dos refs: `refs/heads/codex/sdd-reserve-0589-guia-motor-studio` (local) y `origin/codex/sdd-reserve-0589`. Se borran cuando la spec llegue a main.
- **Objetivo:** motor de guía propio y liviano en Studio, con un recorrido de demostración.
- **Aceptación:** criterios A1–A10 de la SDD. La puerta de la fila es «PR → OK Sam».
- **Permisos:** PR en borrador apilada sobre `codex/0582-e9-guion`, autorizada en el encargo. Sin merge. Nada en producción, el VPS, Meta ni Chatwoot. Cero PII. Sin corridas pesadas.

## Estado al 2026-10-30

| Paso | Estado | Qué hay | Qué falta |
|---|---|---|---|
| 9.2 | entregado | Motor, tarjeta, recorridos tipados, almacén con lugar para 9.3, i18n es-VE y zh-CN, montaje en el layout (5 líneas) y demostración en el Dashboard (`/studio/dashboard?guia=dashboard`) | OK de Sam |

## Validación

| Comprobación | Resultado |
|---|---|
| `vitest run lib/studio/guia app/studio/_components/guia --pool=threads --maxWorkers=1` | PASÓ: 35/35 (19 unitarias y 16 de componente) |
| `vitest run "app/studio/(app)/dashboard"` | PASÓ: 9/9 |
| Mutantes a mano sobre `GuiaMotor.tsx` (toda ancla existe / sin restaurar foco / no cierra al cambiar de ruta) | Los tres muertos (3, 1 y 1 rojos). Se restauró el archivo |
| `tsc --noEmit -p tsconfig.json` | PASÓ |
| ESLint de los archivos tocados | PASÓ: 0 errores y 0 avisos |
| `docs:check` y `sdd:check` | PASÓ |
| `/ui-check` | OK con ajustes menores. Se aplicó el foco visible. El píxel en vivo queda para 9.6 |
| `pnpm verify` (2026-10-30 18:15Z–19:37Z, punta `4efb7f89f`) | FALLÓ por rojos heredados, ninguno del diff. PASÓ: harness, lint, rsc-boundary, typecheck, edge-functions, docs:check, numbering, feature-constants, components:check, governance:check, pending-migration-symbols, schema-rebuild y build. FALLÓ: `test` (avance-checklist «arranca en 0 %», que ya da 6,02 en la base `37c64d114`), `sql-tests` (0467/0497, SDD-0573) y `e2e` (`sin-scroll-horizontal:119` y `company-photo-carousel:93`, sitio público). NO DISPONIBLE: migrations-applied. Detalle en la SDD §5 |

Nota de entorno: con 2,5 GB libres de 31, el pool `forks` de vitest no arrancó («Failed to start forks worker»). Con `--pool=threads --maxWorkers=1` corrió bien.

## Decisiones (detalle en la SDD §3)

- Arranque por `?guia=` e `iniciarGuia()`. El botón y la primera vez automática son de 9.3.
- zh-CN quedó traducido de forma provisional; S-3 sigue abierta para Sam.
- Se agregaron cinco claves de control que no estaban en el guion: `done`, `close_aria`, `card_aria`, `announce` y `closed`.
- La demostración no lleva «Antes en Kommo», porque no hay evidencia de un equivalente del Dashboard en Kommo y no se inventó ninguno. Una prueba de componente cubre la sección con texto de ejemplo.
- `GuiaTarjeta` no se registró todavía en CMP: se propone como `proposed` en 9.6.

## Para 9.3 (estado por usuario)

- Implementar `GuiaAlmacen` (`lib/studio/guia/almacen.ts`) sobre la tabla nueva y pasarlo como `almacen` a `<GuiaMotor>` en el layout. El motor ya guarda `{ pasoId, terminado }` en cada paso y al cerrar.
- El botón «Guía» llama a `iniciarGuia("<id>")`. La clave del texto ya existe: `guide.chrome.toggle`.

## Impacto documental

- SDD-0589 nueva; la fila 9.2 del checklist del programa pasa a `entregado`; índice `docs/specs/README.md` regenerado.
- Graphify, Archify y Obsidian: no se ejecutaron en el worktree. Las fuentes nuevas son código y una spec; la publicación la hace el Director desde main integrado.

## FUERA DE ALCANCE DETECTADO

- ~~La base `codex/0582-e9-guion` tenía la línea base v1 del checklist.~~ Resuelto el 2026-10-30: la #330 ya está en main y esta rama trae `origin/main` por merge (sin rebase). Línea base v3 (115,5 d); la prueba del avance pasa 12/12.
- Los textos del Dashboard están solo en español (por ejemplo, «Configurar»). Por eso la guía en zh-CN cita «Configurar» tal cual.

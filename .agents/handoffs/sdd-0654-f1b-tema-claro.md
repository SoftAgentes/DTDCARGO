# Handoff — SDD-0654 fase 1b: el Portal abre en tema claro

- **Owner / sesión:** Worker del DG (claim `local_0654`). Asignó: Director General.
- **Ruta:** `.claude/worktrees/0654-f1b-tema-claro` · **Rama:** `claude/0654-f1b-tema-claro` (desde `origin/main` 96bb2b4de)
- **Spec:** `docs/specs/0654-version-light-portal/spec.md` §9 (fila 1b), §10 AC-7 y §11 D-14.

## OBJETIVO ORIGINAL

Orden del DG (2026-11-17), tras el OK de Sam a la D-14. Pregunta: «¿el portal del cliente abre en tema claro para
todos?». Respuesta literal de Sam en el chat del DG: «Sí, tema claro».

- El Portal abre en claro y el Studio sigue en oscuro.
- Quien ya eligió oscuro lo conserva, cubierto con una prueba.
- Pasa `/ui-check`.
- Marcar «fusionada» el handoff de la fase 1.
- Sin migración. PR sin fusionar.

## COMPLETADO

- `app/portal/(app)/layout.tsx`: la línea del tema y su comentario. Antes, sin cookie o con un valor raro, el tema
  era oscuro. Ahora es claro, y solo `portal-theme=dark` da oscuro.
- `app/portal/(app)/__tests__/layout-tema.test.tsx` (nueva): llama al layout como función y mira el
  `data-portal-theme` del contenedor y el tema del armazón. Cubre cuatro casos:
  - sin cookie, claro;
  - con `dark`, oscuro (lo conserva quien ya lo eligió);
  - con `light`, claro;
  - con valores raros, claro.
- `BRAND.md`: la línea «Vista predeterminada» de BD-037 dice ahora que el Studio abre en oscuro y el Portal en claro,
  y que en el Portal quien ya eligió oscuro lo conserva.
- `docs/design/studio/_norte/BRAND-DECISIONS.md`: enmienda del tema del Portal dentro de BD-037, con el literal de
  Sam. Ningún token ni color nuevo: el tema claro del Portal ya existía. Son los tokens base más el bloque
  `[data-portal-theme]` (`app/globals.css:123`); no hay un bloque `[data-portal-theme="light"]` propio.
- `.agents/handoffs/sdd-0654-f1-vista-simple.md`: PR #637 fusionada (squash `c20cc7460`).
- **Ampliación de la allowlist por el DG en la revisión independiente (2026-11-17), solo comentarios y sin tocar
  código:**
  - `app/portal/layout.tsx`: el comentario de `appleWebApp` decía que el shell nace en oscuro;
  - `app/portal/_components/PortalThemeToggle.tsx`: el comentario de cabecera decía que el portal nace en oscuro y
    que el layout pasa «cookie o dark».

  Anotado también en la spec §9.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| Vitest de `layout-tema.test.tsx`, `avisos-portal-contract` y `claridad-portal-contract` (turno del DG) | PASÓ: 3 archivos, 110 pruebas |
| Mutante: la línea del tema vuelta a oscuro por defecto | Cae: 2 rojas de 4 (sin cookie y valor raro) |
| `tsc --noEmit` (turno del DG) | PASÓ |
| `/ui-check` | OK para commit; falta revisar el claro con una cuenta de prueba después de publicar |
| `pnpm verify` | NO EJECUTADO: el portón es el CI de GitHub |

Los contratos de contraste del tema claro ya existían (`app/portal/__tests__/avisos-portal-contract.test.ts`, caso
`claro-explicito`) y no cambian.

## PR / BRANCH

`claude/0654-f1b-tema-claro` → `main`. PR no draft. No fusionar. **Cambia el portal para todos los clientes** que
nunca tocaron el botón de tema, también en la Vista Pro y con el interruptor de la vista apagado.

## PENDIENTES DE ESTA TAREA

- CI verde de la PR.
- Después de publicar, mirar el portal en claro con una cuenta de prueba en el servidor de prueba que Sam nombre. El
  Preview de Vercel no sirve, porque comparte base con producción.
- En esa misma comprobación, en un iPhone con el portal instalado como PWA: `statusBarStyle: "black-translucent"`
  (`app/portal/layout.tsx`, `appleWebApp`) con el tema claro. Hay que ver que la hora y la batería se lean sobre el
  contenido claro; si no, se decide con el DG si cambia a `default`.

## FUERA DE ALCANCE DETECTADO

- La «Decisión» histórica de BD-037 en `BRAND-DECISIONS.md` sigue diciendo «tema oscuro»; manda la enmienda que va
  debajo. El Brand Book se actualiza en el próximo NORTE-SYNC.
- La fase 2 (inicio simple, guía, comparación y encendido del interruptor) espera a que el DG la asigne.

## HANDOFF AL DIRECTOR

Fase 1b lista para revisión. Es un cambio de una línea en el layout, más la enmienda de marca y su prueba.

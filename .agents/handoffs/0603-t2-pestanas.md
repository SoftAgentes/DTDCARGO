# Handoff · SDD-0603, tramo 2, pestañas

- **Owner:** Claude, sesión hija de Director General (`local_25e2dded-103b-4eaa-b10e-6527564b9cad`).
- **Rama:** `codex/0603-t2-pestanas`, partiendo de `codex/0603-claridad-controles`.
- **Worktree:** `DTD-worktrees/0603-t2-pestanas`.
- **PR:** ver «Retomado el 2026-11-11».

## Autorización, literal

2026-11-04, por selector en el chat de esta sesión. Pregunta: «Después de este primer tramo, ¿cuál preparo?». Respuesta: «Pestañas (Recommended)».

Cubre preparar. Fusionar pide turno del Director y OK de Sam, con el tramo a la vista.

## Cómo se hizo

La migración mecánica la hizo un subagente, solo editando, en 39 archivos. La revisé y corregí un error suyo: había declarado `tablist` 12 grupos que no cumplen A11Y-01 §11. Quedaron como `role="group"` con `aria-pressed`.

## Validación

- Turno liviano del Director sobre `c79f4529d`: tipos PASÓ; ESLint de lo tocado PASÓ; Vitest focal de 33 carpetas PASÓ (190 archivos, 2.105 pruebas); `docs:check` y `components:check` PASARON.
- **Verde falso corregido después de ese turno:** la expresión de `pestanas-contract.test.ts` no encontraba ninguna pestaña, así que su segunda prueba no vigilaba nada. Reescrita con un piso de 25 etiquetas, y un mutante con estilo en línea muere.
- `git diff --check`: PASÓ.
- `pnpm verify`: NO EJECUTADO.
- Vista en prueba: NO EJECUTADA. Nada de este tramo se ha visto en pantalla, en claro ni en oscuro.

## Retomado el 2026-11-11

- **Owner:** Claude, sesión hija del Director General, worktree `.claude/worktrees/rediseno-0603-retomar-c82740`.
- Traído el tramo 1 ya actualizado con `origin/main` `b63de1527`, con merge y sin conflictos. Main cambió `ReportesClient.tsx` y `ProfileModal.tsx`, de la allowlist; el merge los combinó solo.
- El contrato de pestañas, replicado con `node` sobre el árbol final: 28 pestañas formales (piso 25), ninguna suelta, ningún `tablist` sin `.studio-tabs`.
- `/ui-check`: el hover de `.studio-tab` pintaba `--bg-elevated`, el mismo fondo del grupo, y no se veía. Corregido en `studio.css`: dentro de `.studio-tabs` sube a `--bg-surface`, y no cambia la activa ni la deshabilitada. Quedan de baja: el chip de cantidad sin fondo visible dentro del grupo (el número se lee) y márgenes en línea con px que ya estaban.
- `git merge-tree` contra las PR abiertas de Studio: no agrega choques (ver handoff del tramo 1).
- `docs:check`, `sdd:check`, `governance:check`, `components:check` y `git diff --check`: PASARON con `node`. Tipos, ESLint, Vitest y build: los corre el CI de la PR. `pnpm verify`: NO EJECUTADO.
- **PR:** apunta a `main`, porque el CI de calidad solo corre contra `main`. Incluye los commits del tramo 1; lo propio del tramo se revisa con `git diff <cabeza del tramo 1>...<cabeza del tramo 2>`.

## Pendientes de esta tarea

- Verlo en una imagen de prueba, en especial selectores compactos, Nómina y el hover dentro del grupo.
- Fusionar después del tramo 1, con OK de Sam (BD-037).
- CRM, cuando termine Chatwoot: quitar `app/studio/(app)/crm/` de `PENDIENTES` en `pestanas-contract.test.ts`.

## FUERA DE ALCANCE DETECTADO

Ocho grupos que parecen pestañas y son otro patrón: lista en la spec.

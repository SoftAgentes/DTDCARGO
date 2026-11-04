# Handoff · SDD-0603, tramo 2, pestañas

- **Owner:** Claude, sesión hija de Director General (`local_25e2dded-103b-4eaa-b10e-6527564b9cad`).
- **Rama:** `codex/0603-t2-pestanas`, partiendo de `codex/0603-claridad-controles`.
- **Worktree:** `DTD-worktrees/0603-t2-pestanas`.
- **PR:** ninguna. No puede abrirse antes de que el tramo 1 esté en `main`, porque el CI de calidad solo corre contra `main`.

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

## Pendientes de esta tarea

- Verlo en una imagen de prueba, en especial selectores compactos y Nómina.
- CRM, cuando termine Chatwoot: quitar `app/studio/(app)/crm/` de `PENDIENTES` en `pestanas-contract.test.ts`.

## FUERA DE ALCANCE DETECTADO

Ocho grupos que parecen pestañas y son otro patrón: lista en la spec.

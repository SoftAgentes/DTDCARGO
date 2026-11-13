# Handoff · SDD-0603, tramo 5a: «Abrir» en Embarques y controles del Dashboard

- **Owner:** Claude (Worker), sesión abierta por el Subdirector Rebrand (`local_9104159b-a41d-4fd2-bde2-63c17443a370`). Claim: `local_t5a-filas`.
- **Worktree:** `.claude/worktrees/0603-t5a-filas-625f67`. **Rama:** `claude/0603-t5a-filas-625f67`, desde `origin/main` `11f90a32e`.
- **SDD:** 0603 (BD-037). Detalle, allowlist, aceptación y gate VIS-01 en `docs/specs/0603-claridad-controles/tramo-5a.md`. `spec.md` no se edita.
- **Encargo:** implementar, probar, `/ui-check`, `pnpm verify` con turno del Subdirector Rebrand. En verde: publicar la rama y abrir la PR lista, sin fusionar.

## Hecho

- Embarques: «Abrir» real por fila (secundario `-sm`), con nombre «Abrir embarque <código>». La fila sigue abriendo con el ratón y sale del Tab, así que cada fila sigue teniendo una sola parada.
- Dashboard: acciones rápidas y enlaces de cabecera pasan a secundarios; filas que abren embarque con `studio-tracking-row`; estados con `Badge`; números de nómina sin cajón.
- Dos pruebas focales nuevas. No se tocó `EmbarquesClient.borrado.test.tsx`, que está en la PR abierta #314, y sigue pasando.

## Validación

- Vitest focal (`embarques`, `dashboard`, `app/studio/_components/__tests__`): PASÓ, 24 archivos y 238 pruebas.
- Mutantes: 2 de 2 muertos (fila sin `tabIndex={-1}`; Dashboard sin `studio-tracking-row`).
- Medida de «Abrir» con Archivo 700 real en Chrome: 31,9 px a 13,5 px y 30,7 px a 13 px. La columna mide 92 px.
- `/ui-check`: sin hallazgos de prioridad alta. Hallazgo bajo: el estado del Dashboard usa el `Badge` neutro (ver Límites del tramo).
- `pnpm verify`: ver la sección de cierre.
- Vista en pantalla con datos, en claro y en oscuro: NO EJECUTADA.

## Impacto documental

Nuevo `tramo-5a.md`. Sin cambios en documentos canónicos (`BRAND.md`, `spec.md`, CLAUDE). Graphify y Archify: no se regeneraron en este worktree; quedan pendientes para el cierre del Director.

## Pendientes de esta tarea

- Verlo en la imagen de prueba antes de fusionar: Embarques y Dashboard en claro, oscuro y compacto.

## FUERA DE ALCANCE DETECTADO

- `statusBadgeTone` es privada de `EmbarquesClient.tsx`. Si el Dashboard debe mostrar el tono por estado, conviene moverla a `lib/studio/` en otra tarea.
- «Atención requerida» del Dashboard es un aviso con fondo de estado y borde izquierdo: va con SDD-0628.
- Cobranzas («Abrir» en sus filas) espera a que se resuelva la PR #519.

# SDD-0596 · tramo 2: un error no borra lo escrito en Nómina

- **Fecha:** 2026-11-02. **Owner:** `claude-sweet-curie-8102cb`.
- **Ruta:** `DTD-worktrees/error-no-borra`. **Rama:** `codex/error-no-borra`, **local, sin publicar**. **Base:** `7be2ed9e5`.
- **SDD:** 0596. La spec es idéntica a la de la rama del portal, que es el tramo 1.
- **Límite:** la integración la decide el Director cuando esté su CI. Este tramo no toca portal ni registro.

## OBJETIVO ORIGINAL

Sam, literal: «Haz esta tarea aquí: "Que un error no borre lo escrito en los paneles"». Sam fijó después el orden: «Sí, portal primero». Este es el segundo tramo.

## COMPLETADO

- Los 15 paneles de Nómina usan `onSubmit={submitKeepingDraft(...)}` en lugar de `<form action>`. Se montan en el cliente, tras un clic, así que no necesitan conservar `action`.
- `lib/shared/submit-keeping-draft.ts`, idéntico al del tramo 1.
- `conservar-lo-escrito.test.tsx`: un caso por panel, envío, doble envío y una regla que impide volver a `<form action>`.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| La prueba, sin el arreglo | FALLÓ, como se esperaba |
| La prueba con el arreglo, `--maxWorkers=1` | PASÓ, 19 de 19 |
| Chrome 152, `PrestamoDrawer`, con clics y teclas reales | PASÓ: antes se vaciaban empleado, monto, cuota, concepto y notas; ahora se conservan, también al reintentar. Un `required` vacío bloquea el envío. Acción simulada |
| Chrome 152, junto con el foco de la #353 | PASÓ: el foco va al primer error con clic y con Enter, y lo escrito se conserva |
| Mutantes, ESLint, tipos, suite y `pnpm verify` | **NO EJECUTADO:** el Director retuvo el turno |

## COMMITS

- `fix(studio): SDD-0596 — un error no borra lo escrito en los paneles de Nómina`.
- `refactor(studio): SDD-0596 — el ayudante pasa a lib/shared`.
- El commit de este handoff y la spec no se autorreferencia.

## PR / BRANCH

Sin publicar. Se publica cuando el Director lo indique.

## PENDIENTES DE ESTA TAREA

1. Decisión del Director sobre publicar.
2. Con turno: mutantes por panel y del ayudante, ESLint y tipos.

## FUERA DE ALCANCE DETECTADO

`GenerarInvitacionDrawer` y otros paneles quedan con la pantalla de éxito en lugar del formulario, así que no necesitan limpiarse. El resto del ERP sigue en la spec como tramo 3.

## HANDOFF AL DIRECTOR

Revisar el diff contra `7be2ed9e5`. No toca portal ni registro: se puede integrar antes de publicar, si lo decides.

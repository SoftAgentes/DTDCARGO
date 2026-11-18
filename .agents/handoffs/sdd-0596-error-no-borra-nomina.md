# SDD-0596 · tramo 2: un error no borra lo escrito en Nómina

- **Fecha:** 2026-11-02. **Owner:** `claude-sweet-curie-8102cb`.
- **Ruta:** `DTD-worktrees/error-no-borra`. **Rama:** `codex/error-no-borra`, **local, sin publicar**. **Base:** `7be2ed9e5`, con `main` traído en `5a70ffc4f`.
- **SDD:** 0596. La spec es la de `main`: al traerlo chocaba porque nació copiada, y esta rama no le aportaba nada propio.
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
| Tras traer `main` en `5a70ffc4f`, sobre `c8625b260`, `--maxWorkers=1`: la prueba | PASÓ, 20 de 20 |
| Mutantes por panel y del ayudante | Primera corrida, sobre `a20a37e16`: 19 de 20 muertos. Sobrevivía quitar `preventDefault`: estos paneles no tienen `action`, y jsdom no hace nada con el envío nativo. Con una prueba para eso, sobre `c8625b260`: **20 de 20 muertos** |
| ESLint de los 16 archivos de código y prueba, sobre `a20a37e16`; de la prueba, sobre `c8625b260` | PASÓ |
| `tsc` limitado a esos archivos, sobre `a20a37e16` | PASÓ, sin errores |
| Combinación con #353: `cb6a99f5c` sobre `a20a37e16`, con un merge sin commit | PASÓ: sin conflictos, 54 de 54 en 4 archivos |
| CI, suite y `pnpm verify` | NO EJECUTADO: la rama no se publicó. La suite completa la correría el CI |

## COMMITS

- `fix(studio): SDD-0596 — un error no borra lo escrito en los paneles de Nómina`.
- `refactor(studio): SDD-0596 — el ayudante pasa a lib/shared`.
- `a20a37e16`: merge de `main`.
- `c8625b260`: Nómina evita el envío nativo del navegador.
- El commit de este handoff y la spec no se autorreferencia.

## PR / BRANCH

Sin publicar. Se publica cuando el Director lo indique.

## PENDIENTES DE ESTA TAREA

1. Decisión del Director General sobre publicar.
2. «Calidad local sin secretos» en verde sobre la cabeza, ya publicada.
3. Smoke en el Studio con sesión real: provocar un error en Nómina y comprobar que lo escrito sigue ahí. **Hecho el 2026-11-04 sobre `55a65a602`, 19 PASÓ en tres paneles:** ver `smoke-foco-portal-20261104.md`.

## FUERA DE ALCANCE DETECTADO

1. `GenerarInvitacionDrawer` y otros paneles quedan con la pantalla de éxito en lugar del formulario, así que no necesitan limpiarse. El resto del ERP sigue en la spec como tramo 3.
2. **Nómina no tiene lo de SDD-0598.** Por lectura, sin medir: estos paneles usan `useActionState` sin envolver, así que si la acción lanza, como en un corte de red, el error llega a la barrera y el panel se desmonta con lo escrito. Esa spec sólo cubrió portal, registro, `entrar` e `invitar`.

## HANDOFF AL DIRECTOR

Revisar el diff contra `main`. Toca sólo Nómina y su prueba: el ayudante ya entró con el tramo 1. Combina con #353 sin conflictos. La decisión de publicarla es tuya.

# SDD-0598: un corte de red no borra el formulario

- **Fecha:** 2026-11-02. **Owner:** `claude-sweet-curie-8102cb`.
- **Ruta:** `DTD-worktrees/accion-que-lanza`. **Rama:** `codex/accion-que-lanza`. **Base:** `main` desde el 2026-11-03. Nació apilada sobre `codex/error-no-borra-portal` (PR #358), que ya entró.
- **SDD:** 0598, reservada con `sdd:next --reserve`, sin publicar: `codex/sdd-reserve-0598-accion-que-lanza-no-borra`, `refs/dtd/reservations/0598`. Avisada al Subdirector.
- **Límite:** la retención terminó: #358 y #361 ya están en `main`. La integra el Director General, de a una y con CI verde.
- **Permisos:** PR en borrador. Sin merge, sin deploy, sin producción desde esta sesión. Corridas pesadas con turno del Director General.
- **Ojo:** `node_modules` es una junction al de `error-no-borra-portal`. **No correr `pnpm` en este worktree:** reinstala y rompe el original. Usar `node node_modules/vitest/vitest.mjs` y `node scripts/...`.

## OBJETIVO ORIGINAL

Sam, literal: «Haz esta tarea aquí: "Que un corte de red no borre el formulario del portal"». Es el hallazgo que SDD-0596 dejó sin arreglar.

## Resultado

Si la acción lanza, 18 formularios en 16 archivos de portal, registro, `entrar` e `invitar` siguen en pantalla con lo escrito y un aviso honesto. Causa, inventario por acción y decisión en `docs/specs/0598-accion-que-lanza-no-borra/spec.md`.

## COMPLETADO

- `lib/shared/use-action-keeping-draft.ts`: `useActionKeepingDraft` y `actionKeepingDraft`.
- Los 18 formularios lo usan, con un aviso según lo que haría un reintento.
- `redirect()` y `notFound()` siguen su camino. Una página de una versión anterior avisa que hay que recargar.
- El foco va al aviso cuando la acción lanzó. Las respuestas con error no cambian.
- `CotizacionRequestForm` tiene `role="alert"`. `EntrarForm` conserva el correo si falla el reenvío.
- Pruebas: `app/portal/la-accion-lanza.test.tsx` y `lib/shared/__tests__/use-action-keeping-draft.test.tsx`.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `la-accion-lanza.test.tsx`, sin el arreglo, `--maxWorkers=1` | FALLÓ, como se esperaba: 19 de 20 en rojo |
| Las dos pruebas nuevas con el arreglo | PASÓ, 31 de 31 |
| `conservar-lo-escrito.test.tsx` | PASÓ, 29 de 29 |
| `entrar-dos-filas.test.tsx`, `NewPurchaseWizard.test.tsx` | PASÓ, 8 de 8 y 13 de 13 |
| Chrome 152, corte real con `TypeError: Failed to fetch` | PASÓ: sin arreglo se pierde el formulario; con él siguen campos y archivos, y el aviso tiene el foco y está a la vista. Reintento y 500 medidos. No pasa por el router de Next |
| ESLint de los 19 archivos | PASÓ |
| `tsc` limitado a los archivos tocados | Sin errores en ellos; 1 ajeno de la configuración limitada |
| `docs:check`, `sdd:check` | Ver el cuerpo de la PR |
| `/ui-check` del diff | Sin cambios visuales; copy en tuteo |
| `next dev` con Server Action real, sobre `2204318f5`, la punta de #362 | PASÓ: 33 casos en verde y 13 medidos, en dos pasadas. La primera dio además 2 rojos de `notFound` por mi comprobación: leía los primeros 200 caracteres de `body`, y ahí está Agentation. La segunda leyó `main` y midió la 404 en verde, sólo sin identificador. El detalle está en la spec. **El diseño de los dos `useActionState` no cambia** |
| 29 mutantes, sobre `76f775f67` | 28 muertos y 1 vivo, el esperado: que el segundo hook ignore el resultado del POST lo cubre la medición de `next dev` |
| Pruebas vecinas, `tsc` completo, `pnpm verify` | Sobre `d3dd68c73`, la punta de #362: **exit 1 por `test`**, con 4 archivos ajenos al diff que pasan aislados, 59 de 59. El detalle está en el handoff de SDD-0599 |
| Carrera en una prueba propia, `use-action-keeping-draft.test.tsx` | Comprobaba el foco sin esperar al efecto. Rojo 2 de 23 corridas. Corregida en la rama de #362: esta PR ya estaba cerrada |
| Tras traer `main` en `8feae0e8b`, `--maxWorkers=1`: `app/entrar/__tests__`, `conservar-lo-escrito`, `la-accion-lanza`, `use-action-keeping-draft` | PASÓ, 138 de 138 en 6 archivos |
| Tras traer `main`: ESLint de `EntrarForm.tsx` y `la-accion-lanza.test.tsx`, `docs:check`, `numbering` | PASÓ |
| Check obligatorio de la PR | Apunta a `main` desde el 2026-11-03. Lo lee el Director General |
| `quality.yml` por `workflow_dispatch` sobre la rama | Lanzado en GitHub, sin usar esta máquina. Es evidencia y no cuenta para la regla de `main`. El resultado queda en el cuerpo de la PR |
| Graphify, Archify, Obsidian | NO EJECUTADO: los publica la dirección desde main |

**Sin medir:** `next start`, lector de pantalla, portal con sesión real, envío colgado, y los avisos con los estilos reales del portal.

## COMMITS

- `fix(portal): SDD-0598 — un corte de red no borra el formulario`.
- El commit que contiene este handoff y la spec no se autorreferencia.

## PR / BRANCH

Rama `codex/accion-que-lanza`, PR #360, fusionada por el Director General: `main` en `764f1fc00`. Este registro entra por la rama de #362.

## PENDIENTES DE ESTA TAREA

1. Smoke en el portal con sesión real: cortar la red al enviar una cotización y una compra con adjuntos.

## FUERA DE ALCANCE DETECTADO

1. **Identificador de intento en las cinco acciones que duplican:** `createPrealertaAction`, `requestCotizacionAction`, `createPortalClaimAction`, `sendPortalMessageAction`, `addAddressAction`. Es lo que corrige ERR-01 («Reintentar no duplica la mutación»). Sam aprobó «Sí, con candado»: va en SDD-0599, PR #362.
2. **Un envío que se cuelga sin responder:** no hay tiempo límite, y Next atiende las acciones en cola.
3. **Archivo por encima de `bodySizeLimit`:** medido con 13 MB: 500, aviso, y todo se conserva. Reintentar con el mismo archivo da 500 otra vez; sin él, entra. El aviso no dice que la causa es el tamaño.
4. **`app/portal/(app)/error.tsx`:** dice «no se perdió nada» sin saberlo y tiene un voseo, «Volvé».
5. **Botones de una sola acción:** si lanzan, la pantalla de error reemplaza la página con lo que otro formulario tuviera escrito.
6. **Solape con SDD-0597, resuelto al traer `main`:** #361 reescribió las mismas líneas de `app/entrar/EntrarForm.tsx`. Se conservó de SDD-0597 `MagicRequested`, `requested`, `requests`, sus textos y el foco al título. Se conservó de SDD-0598:
   - `useActionKeepingDraft(requestMagicLink, initialMagic, aviso)` en lugar de `useActionState`.
   - `{...magicFormProps}` **en los dos formularios**, el principal y el de pedir otro enlace. Un `action` sin su `onSubmit` no atrapa nada, y su resultado no llega a `state`.
   - `lastEmail`: con la acción que lanza, el estado es sólo `{ error }`, así que `magicState.email` no alcanza.
   - `la-accion-lanza.test.tsx` se ajustó a los textos de SDD-0597.
7. **`RegisterForm` tras un corte:** el foco queda en `body`, porque usa `actionKeepingDraft` sin el hook. El aviso tiene `role="alert"`, pero quien navega con teclado vuelve a empezar desde arriba.
8. **Sin JavaScript, si la acción lanza:** 500, y lo escrito se pierde. `onSubmit` sólo existe después de hidratar.

## HANDOFF AL DIRECTOR

- **Orden, decidido por el Director General el 2026-11-03:** #358 → #361 → resolver aquí y en #362 el conflicto de `EntrarForm` → `next dev` → traer `main` cuando entre #363 → `verify` sobre la punta de #362 → mutantes. Hecho.
- **Hueco declarado:** esta PR no tuvo un `verify` propio. Aceptada con su CI y con la punta de #362.

### Impacto documental

Spec 0598 nueva e índice regenerado. No cambian políticas.

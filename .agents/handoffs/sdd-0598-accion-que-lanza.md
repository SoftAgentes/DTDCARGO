# SDD-0598: un corte de red no borra el formulario

- **Fecha:** 2026-11-02. **Owner:** `claude-sweet-curie-8102cb`.
- **Ruta:** `DTD-worktrees/accion-que-lanza`. **Rama:** `codex/accion-que-lanza`. **Base:** `codex/error-no-borra-portal` en `cf81cbf30` (PR #358).
- **SDD:** 0598, reservada con `sdd:next --reserve`, sin publicar: `codex/sdd-reserve-0598-accion-que-lanza-no-borra`, `refs/dtd/reservations/0598`. Avisada al Subdirector.
- **Límite:** **PR retenida. No entra a `main` antes de publicar**, igual que #358, de la que depende.
- **Permisos:** PR en borrador. Sin merge, sin deploy, sin producción. Corridas pesadas con turno del Subdirector.
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
| `next dev` con Server Action real | **NO EJECUTADO:** sin turno. **Es lo más importante que falta:** corte, `redirect()`, POST antes de hidratar y su resultado al hidratar |
| Mutantes, demás pruebas vecinas, `tsc` completo, `pnpm verify` | **NO EJECUTADO:** sin turno |
| Check obligatorio de la PR | **NO DISPONIBLE** mientras apunte a la rama de #358: sólo corre contra `main`, y además necesita un push después de reapuntarla |
| `quality.yml` por `workflow_dispatch` sobre la rama | Lanzado en GitHub, sin usar esta máquina. Es evidencia y no cuenta para la regla de `main`. El resultado queda en el cuerpo de la PR |
| Graphify, Archify, Obsidian | NO EJECUTADO: los publica la dirección desde main |

**Sin medir:** lector de pantalla, portal con sesión real, archivo por encima del límite, envío colgado, y los avisos con los estilos reales del portal.

## COMMITS

- `fix(portal): SDD-0598 — un corte de red no borra el formulario`.
- El commit que contiene este handoff y la spec no se autorreferencia.

## PR / BRANCH

Rama `codex/accion-que-lanza`, en PR en borrador contra `codex/error-no-borra-portal`, **retenida**. El número queda en la propia PR.

## PENDIENTES DE ESTA TAREA

1. Con turno: `next dev` con Server Action real, mutantes, pruebas vecinas, `tsc` completo.
2. Cuando #358 entre a `main`: reapuntar esta PR a `main` y esperar «Calidad local sin secretos» en verde.
3. Smoke en el portal con sesión real: cortar la red al enviar una cotización y una compra con adjuntos.
4. Integrar después de publicar, y después de #358.

## FUERA DE ALCANCE DETECTADO

1. **Identificador de intento en las cinco acciones que duplican:** `createPrealertaAction`, `requestCotizacionAction`, `createPortalClaimAction`, `sendPortalMessageAction`, `addAddressAction`. Es lo que corrige ERR-01 («Reintentar no duplica la mutación»). Exige migraciones, con aprobación de Sam.
2. **Un envío que se cuelga sin responder:** no hay tiempo límite, y Next atiende las acciones en cola.
3. **Archivo por encima de `bodySizeLimit`:** por lectura, el aviso sale, pero reintentar falla igual.
4. **`app/portal/(app)/error.tsx`:** dice «no se perdió nada» sin saberlo y tiene un voseo, «Volvé».
5. **Botones de una sola acción:** si lanzan, la pantalla de error reemplaza la página con lo que otro formulario tuviera escrito.
6. **Solape real con SDD-0597, sin integrar:** la sesión «Que /entrar no diga 'Revisa tu correo' si no salió», en `.claude/worktrees/sad-jones-d0695e`, reescribe las mismas líneas de `app/entrar/EntrarForm.tsx`, con cambios sin commit a la fecha: renombra `MagicSent` a `MagicRequested` y `sent` a `requested`, y cambia el `defaultValue` del correo. La segunda rama en entrar tendrá conflicto. Al resolverlo no se puede perder:
   - `useActionKeepingDraft(requestMagicLink, initialMagic, aviso)` en lugar de `useActionState`.
   - `{...magicFormProps}` **en los dos formularios**, el principal y el de reenviar. Un `action` sin su `onSubmit` no atrapa nada, y su resultado no llega a `state`.
   - `lastEmail`: con la acción que lanza, el estado es sólo `{ error }`, así que `magicState.email` no alcanza.
   - `la-accion-lanza.test.tsx` busca «Revisa tu correo» y «Reenviar enlace»: hay que ajustarla al texto de SDD-0597.

## HANDOFF AL DIRECTOR

- **Orden, decidido por el Director General el 2026-11-03:** #358 → #361 → resolver aquí y en #362 el conflicto de `EntrarForm`, con la lista de arriba → medir.
- **Una sola corrida de `verify`, sobre la punta de la #362, aceptada por el Director General.** Antes de lanzarla: traer `main`, darle a `reintento-no-duplica` su propio `node_modules` y mantener Docker despierto.
- **Hueco declarado de esa decisión:** esta PR sola no tiene e2e propio. Si entra sin la #362, porque la 0512 espera a Sam, ese estado queda cubierto por su CI y por la punta, no por un `verify` suyo.
- Después de esa corrida, de a uno y cada uno con su turno: `next dev` con Server Action real y los 29 mutantes. Primero `next dev`, porque puede cambiar el diseño de los dos `useActionState`.
- **Decisión para Sam:** si las cinco acciones que duplican llevan identificador de intento. El aviso reduce el riesgo; no lo elimina.

### Impacto documental

Spec 0598 nueva e índice regenerado. No cambian políticas.

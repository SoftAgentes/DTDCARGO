# Handoff · pruebas inestables (2026-11-20)

- **Owner:** Worker `worker-pruebas-inestables`, encargo de Dir_DTD (pedido de Sam del 2026-11-20: «abre la tarea para arreglar las pruebas inestables»).
- **Ruta:** `.claude/worktrees/agent-abd74fcf89577ca45` · **rama:** `claude/pruebas-inestables`, desde `origin/main` `87ff55598`.
- **SDD:** no aplica (plomería de pruebas, sin número por encargo). El cambio en el componente se justifica abajo.
- **Objetivo:** que dejen de caer al azar en `quality.yml` («Calidad local sin secretos», paso Unitarios) dos pruebas, sin debilitarlas.

## 1 · `PortalVistaSelector.test.tsx` · «el aviso de error se cierra con Escape»

**Evidencia.** Cayó en `main` en dos corridas, 44519201245 (job 135543131118) y 44778634006 (job 136435091847), y en la PR #723 (job 136435498517). El log dice que el `waitFor` de la línea 82 venció con el aviso todavía en el DOM: el Escape no llegó a nadie. En la 44172292427 (job 134354509278) cayó el caso hermano «el aviso de error se cierra solo», que ya se había arreglado en la prueba con un `await act(async () => {})`, porque su comentario reconoce la misma carrera.

**Causa.** El aviso (`setError`) llega tras el `await` de la acción del servidor, fuera de `act` y fuera de un carril síncrono. React pinta el aviso en una tarea y agenda los efectos pasivos (`useEffect`) para otra. El listener de Escape vivía en ese `useEffect`. `findByRole` ve el aviso por su MutationObserver, y su envoltorio de RTL espera un `setTimeout(0)` antes de devolver. En Node, ese `setTimeout` y el `setImmediate` del Scheduler de React no tienen un orden fijo. Si el timer va primero, el `fireEvent.keyDown` sale antes de que el listener exista y el Escape se pierde. En un navegador el hueco existe igual, aunque sea más corto: un Escape que cae entre la pintura y el efecto se pierde.

**Arreglo, en el componente** (`app/portal/_components/PortalVistaSelector.tsx`). El listener de Escape pasa a un `useLayoutEffect`, que corre en el mismo commit que pinta el aviso. Desde que el aviso existe, Escape lo cierra. La cuenta de `AVISO_ERROR_MS` sigue en un `useEffect`, para que empiece con el aviso ya a la vista. Así el caso «se cierra solo» y su vaciado con `act` quedan igual. Es un cambio de producto mínimo, que no cambia ni el texto, ni el aspecto, ni los tiempos. React 19 no avisa por `useLayoutEffect` en el servidor, y el repo ya lo usa (`GuiaMotor.tsx` y `PermisoCeldaPanel.tsx`).

**Prueba nueva, más estricta** (`PortalVistaSelector.test.tsx`): «Escape ya se escucha en el instante en que el aviso aparece en el DOM». Un MutationObserver mira, en el mismo microtask en que el aviso entra al DOM, si ya se registró un `keydown` en `document`. Con el `useEffect` viejo, la respuesta esperada es que no (inferencia: el efecto pasivo corre en otra tarea; no lo medí). Con el `useLayoutEffect` siempre es que sí. No se tocó ninguna aserción, ningún timeout ni ningún `waitFor` de los casos que ya había.

## 2 · `chatwoot-portal-puerta4.migration.test.ts` · «MUTANTE «no compara el corte» cae»

**Evidencia.** Cayó en la PR #721, corrida 44785636707 (job 136459631075), que no toca nada de Chatwoot (su diff es de Almacén China y Embarques). Se esperaba «otra cabecera se rechaza» (línea 433 del contrato) y llegó «nunca sale el teléfono ni el Shipping Mark» (línea 329). Esa aserción va antes en el contrato y la mutación no la toca, porque cambia `vincular_carga` y no `carga_lineas`. Es decir, cayó la búsqueda del teléfono, no el mutante. En los 40 jobs fallidos más recientes de `quality.yml` (revisados por log) esta caída sale una sola vez.

**Causa.** La aserción busca `'5550101'` (el teléfono sintético de A) y `'DTD-S'` en el texto de todas las líneas. Todo lo que ese texto lleva es fijo (ids `md5`, nombres y textos), salvo dos cosas. Una son las fechas `to_char(…'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`, que tienen 6 dígitos seguidos como mucho y no pueden contener una cadena de 7. La otra son los dos **identificadores reservados**, que vienen de `gen_random_uuid()`. Un uuid es hexadecimal, y `5550101` es una cadena hexadecimal válida: un uuid al azar puede contenerla. **Inferencia** (no reproducida): es lo único del texto que varía de una corrida a otra y puede contener la cadena. La probabilidad por corrida es muy baja (unas 16 posiciones × 16⁻⁷), pero el contrato se corre unas 90 veces por CI entre la 0523 y la 0524.

**Arreglo, en los contratos** `supabase/tests/0524_chatwoot_portal_puerta4.test.sql` y `supabase/tests/0523_chatwoot_portal_carga.test.sql` (misma línea, misma causa). Antes de buscar, se tapan los dos valores exactos `pg_temp.identificador('A')` y `('B')`. Se tapan solo esos valores, no la clave: si en `identificador` saliera otra cosa (el teléfono, el Shipping Mark), la búsqueda la seguiría viendo. Si una reserva faltara, `replace` con NULL deja NULL y la aserción cae, así que no hay verde silencioso. Ni la búsqueda ni la etiqueta cambian. El preámbulo, que copian `portal-historial-lecturas.test.ts` y `infra/ops/portal-historial/pruebas/studio-fixture.sql` (líneas 17 a 158), queda igual.

## Validación

| Comprobación | Resultado |
|---|---|
| `PortalVistaSelector.test.tsx`, 20 repeticiones (`--pool=threads --maxWorkers=1`) | NO EJECUTADO: el worktree no tiene `node_modules` y el encargo prohíbe instalar |
| `chatwoot-portal-puerta4.migration.test.ts`, 20 repeticiones | NO EJECUTADO, por la misma razón |
| `chatwoot-portal-carga.migration.test.ts` (contrato de la 0523 tocado) | NO EJECUTADO, por la misma razón |
| `git diff --check` | PASÓ |
| `node scripts/harness-worktree.mjs guard` | PASÓ |
| CI de la PR (`quality.yml`) | Es la comprobación que cuenta; queda pendiente al abrir la PR |

## Pendientes de esta tarea

- Que la CI de la PR pase con los tres archivos. Si Dir_DTD da turno en la PC, correr los dos archivos 20 veces con `--pool=threads --maxWorkers=1` desde un worktree con dependencias.

## FUERA DE ALCANCE DETECTADO

- `lib/studio/nomina/__tests__/ficha-empleado-0555.migration.test.ts`, «MUTANTE «el cursor no desempata por id» cae», cayó en `main` (corrida 44229367280) y en la 44537267947. Parece otro caso inestable con mutante. No lo revisé.

## Impacto documental

No aplica: no cambia ninguna regla, ningún runbook ni ninguna spec. La causa y la evidencia quedan en este handoff y en los comentarios del código.

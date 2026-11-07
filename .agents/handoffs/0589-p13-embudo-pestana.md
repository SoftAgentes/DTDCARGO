# SDD-0589 · paso P-13: el recorrido Embudo abre sin `?tab=` (handoff)

Rama `claude/0589-p13-embudo-pestana`, worktree `.claude/worktrees/laughing-mclaren-33178a`, desde `main` en `ecadbac91`. Owner del claim: `worker-0589-p13`. Encargo del Subdirector de Chatwoot, 2026-11-07, con la decisión P-13 del Director General: un paso aparte de la SDD-0589, con PR propia en borrador contra `main`, después de la #408 y antes de que la 6.6 ponga Resumen por defecto (S3 de la SDD-0614). Nada en producción ni en Chatwoot.

## OBJETIVO ORIGINAL

- El recorrido **Embudo** abre en `/studio/crm` **sin `?tab=`**, con la pestaña por defecto de hoy (Dirección) y con Resumen (S3).
- Una prueba que **falle hoy** con Dirección por defecto y pase con el arreglo, con el rojo anotado antes de arreglar, y un **mutante** que la prueba mate.
- Lo mismo con Resumen por defecto, como caso que simula S3.
- La URL de R6 actualizada en la spec y en el handoff de 9.4 y 9.5, y la allowlist exacta del paso en la spec.

## COMPLETADO

El detalle está en `docs/specs/0589-guia-motor-studio/spec.md`, sección «2026-11-07 · Paso P-13»: D15, comportamiento, gobernanza, allowlist, aceptación y evidencia.

- **D15:** `GuiaRecorrido.consulta` (opcional). `RECORRIDO_EMBUDO` lleva `consulta: { tab: "embudos" }`. El motor la pone con `router.replace`, sin scroll y con los demás parámetros, al abrir por `?guia=`, por el botón o por código. Después espera al tablero hasta 10 s.
- **Sin efectos de más:** el arranque automático no cambia la pestaña de nadie; un reintento tampoco, y si la persona se va de Embudos mientras la guía espera, la espera se cancela. Con la guía abierta, cambiar de pestaña la cierra, como cambiar de ruta.
- **R6:** `/studio/crm?guia=embudo` abre con Dirección, Embudos (S0) o Resumen (S3) por defecto. Actualizado en la spec (R6, D11 y el párrafo de Embudo en 9.5) y en `.agents/handoffs/0589-e9-recorridos.md`.
- **La 6.6 no toca la guía y la guía no toca la 6.6:** ningún archivo de `app/studio/(app)/crm/` entra en el diff.

## VALIDACIÓN

El detalle está en la tabla «Evidencia del P-13» de la spec. Las corridas pesadas usaron el turno del Subdirector (17:58Z a ~18:17Z).

| Comprobación | Resultado |
|---|---|
| Rojo previo sobre `main` `ecadbac91`, primera versión de la prueba | FALLÓ, como se esperaba: 9 de 12. Con Dirección, Resumen y `resolveKommoTab`, «la guía no abrió» |
| Prueba nueva con el arreglo | PASÓ: 15 de 15 |
| 6 mutantes, de a uno, con base verde (47 de 47) | PASÓ: 6 de 6 muertos. M0, sin el arreglo, tumba 14, entre ellos Dirección y Resumen. Todo restaurado, con `git diff --stat` idéntico |
| Suite de la guía (10 archivos, 1 worker) | PASÓ: 164 de 164 |
| `tsc --noEmit` | PASÓ en el segundo intento; el primero dio TS2493 en la prueba nueva, corregido |
| ESLint de los 9 archivos tocados, `--max-warnings=0` | PASÓ |
| `check-numbering`, `build-docs-index --check` y `git diff --check` | PASÓ |
| `/ui-check` | OK para commit, con un hallazgo bajo para la 9.6 |
| `pnpm verify` | NO EJECUTADO: lo corre el Director General |
| `pnpm knowledge:status`, Graphify y Archify | NO EJECUTADO: fuera del cierre pedido; los publica el Director desde `main`. Impacto documental: spec 0589 y dos handoffs |
| Abrir la página real con `next dev` | NO EJECUTADO |

## COMMITS

Ver la PR. Commits selectivos con `git commit -F`.

## PR / BRANCH

`claude/0589-p13-embudo-pestana` → `main`, en borrador. El número y la cabeza van en el reporte al Subdirector.

## PENDIENTES DE ESTA TAREA

- **`pnpm verify`:** lo corre el Director General en su turno.
- **Abrir `/studio/crm?guia=embudo` en la página real** con `next dev` y un usuario admin o commercial: NO EJECUTADO. La prueba simula la página: el tablero se monta solo con `tab === "embudos"`, como en `crm/page.tsx`.
- **Al fusionar:** limpiar este worktree y su rama, con evidencia (regla de Sam).

## FUERA DE ALCANCE DETECTADO

- **S0 de la SDD-0614** pone Embudos por defecto. Con el P-13 en `main`, `/studio/crm?guia=embudo` hace un `replace` de más para escribir `?tab=embudos` en la URL. No cambia lo que se ve.
- **9.6:** si se enciende el arranque automático de Embudo, abre solo con `?tab=embudos` en la URL. Con Embudos por defecto (S0) y sin `?tab=`, no abriría solo; habría que decidirlo en la 9.6.

## HANDOFF AL DIRECTOR

- La PR solo cambia archivos de la guía y su documentación.
- Fusionar no enciende nada: los recorridos siguen sin arranque automático (D11) y el script del panel sigue sin pegar.
- Con el P-13 en `main`, S3 de la 6.6 ya puede fusionarse en cuanto a esta condición (SDD-0614 §5 y §9). La prueba del paso vive en `main` y corre en su `pnpm verify`.

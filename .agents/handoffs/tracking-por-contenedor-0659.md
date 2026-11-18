# Handoff — SDD-0659 · Tracking en vivo por contenedor (Fase 1)

- **Owner / sesión:** Worker `tracking-en-vivo-rediseno-24dd22`
- **Worktree:** `.claude/worktrees/tracking-en-vivo-rediseno-24dd22`
- **Rama:** `claude/tracking-en-vivo-rediseno-24dd22` (base `main` en `9b64478b1`)
- **SDD:** `docs/specs/0659-tracking-por-contenedor/spec.md` (número asignado por el Director General el 2026-11-18)
- **Permisos del encargo:** implementar la Fase 1, publicar la rama y abrir PR sin fusionar. Sin migraciones, sin producción ni staging. `pnpm install`, `pnpm verify`, Docker y e2e solo con turno del Director.

## OBJETIVO ORIGINAL

Rediseñar `/studio/tracking`. Sam eligió la opción A («Mesa de control») entre tres maquetas y fijó cuatro reglas: tracking por contenedor primero y por cliente después; el consolidado parcial usa el mismo concepto; el mapa va centrado en el Pacífico con China a la izquierda; el buscador dice en qué contenedor viene un cliente.

## COMPLETADO (Fase 1, sin migraciones)

- Lista izquierda de contenedores con filtros «En mar», «En origen», «En destino» y «Sin contenedor», cada uno con su conteo.
- Panel del contenedor: encabezado, aviso de alertas, mapa, indicadores, hitos y «Quién viene adentro» (cerrado por defecto).
- Mapa centrado en el Pacífico con contorno real (Natural Earth 110m, dominio público), ya proyectado; sin librería de mapas en el navegador. Muestra todos los contenedores y cada punto es un enlace.
- Posición: usa la caché de rastreo de la naviera (`tracking_snapshots`, SDD-0101) si tiene coordenadas; si no, estima con las fechas del itinerario; si tampoco hay, por estado. La fuente se rotula siempre.
- Se quitó la velocidad: era un valor fijo en el código (`17.4 kn`), no un dato.
- Buscador por GET (`?q=`), resuelto en el servidor: cliente, Shipping Mark, referencia o número de contenedor; incluye lo ya entregado.
- Envíos activos sin contenedor: siguen visibles en «Sin contenedor», con la lista y el detalle por envío que ya existían.
- `?id=<envío>` sigue funcionando: abre su contenedor con el envío resaltado, o el envío suelto.
- SDD-0531: los nombres se ocultan en el servidor en los clientes del contenedor y en el buscador; para el equipo de China la consulta por nombre no se hace.

## Decisiones tomadas al implementar

- El nombre del contenedor es su referencia (`DTD-CONSOL-NNNN`), igual que en Naviera. No se inventó «Contenedor N».
- Un contenedor arribado queda «En destino» mientras alguno de sus envíos siga en curso. Si ningún ítem está enlazado a un envío, queda en destino 30 días desde su último cambio.
- Los contenedores ya entregados no se cargan en la lista; se llega a ellos por el buscador (`?c=`). Responde de forma provisional la pregunta abierta 3 de la spec.
- De los hitos pendientes solo llevan fecha de plan el zarpe (ETD) y la llegada a puerto (ETA). El resto no tiene fecha: no se inventa.
- `TrackingMap.tsx` se conserva como componente del envío suelto, ahora con el mapa nuevo. `ActiveShipmentList`, `TrackingTimeline` y `TrackingDetailActions` no cambiaron.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `docs:check` (node directo) | PASÓ |
| `sdd:check` (node directo) | PASÓ |
| `components:check` (node directo) | PASÓ |
| `governance:check` (node directo) | PASÓ |
| `git diff --check` | PASÓ |
| Proyección del mapa (corrida suelta con node sobre `proyeccion.ts`) | PASÓ: coincide con d3-geo en Ningbo y La Guaira |
| `tsc` / typecheck | NO EJECUTADO: el worktree no tiene `node_modules`; falta turno para `pnpm install` |
| `eslint` | NO EJECUTADO (misma razón) |
| `vitest` de los archivos nuevos y de tracking | NO EJECUTADO (misma razón) |
| `pnpm verify` | NO EJECUTADO: requiere turno |
| `/ui-check` | NO EJECUTADO: requiere la app corriendo |
| Vista en navegador | NO EJECUTADO |

## COMMITS

- `70302fd14` docs(specs): SDD-0659 — spec y reserva (publicado)
- `72fb73a56` feat(studio): SDD-0659 — lógica, consultas y mapa del Pacífico
- `21ef904ec` feat(studio): SDD-0659 — pantalla por contenedor, buscador y «Quién viene adentro»

## PR / BRANCH

Rama publicada con el commit de la spec. Los dos commits de código están locales hasta correr typecheck y pruebas. PR todavía no abierta.

## PENDIENTES DE ESTA TAREA

1. Turno para `pnpm install --frozen-lockfile`, typecheck, lint y vitest; corregir lo que salga.
2. `pnpm verify` con turno, `/ui-check` y revisión en navegador (oscuro y claro, compacto, ancho angosto).
3. Abrir la PR sin fusionar y reportar la cabeza exacta al Director.
4. Preguntas abiertas para Sam (están en la spec): dónde va «Avisar a los clientes»; qué referencia da el proveedor tercero en un consolidado parcial; si los entregados se ven en un filtro.
5. Fase 2 (consolidado parcial) y Fase 3 (avisos de ETA movida) necesitan migración y OK aparte.

## FUERA DE ALCANCE DETECTADO

- `lib/studio/privacidad-cn.ts` exporta `LOTE_SIN_NOMBRE = "Lote sin Shipping Mark"`: usa «lote», palabra que Sam pidió no usar. No se tocó.
- `daysRemaining` de `tracking-progress.ts` calcula días con un factor fijo por estado. La pantalla por contenedor ya no lo usa (usa la ETA), pero el envío suelto y posiblemente el portal sí.

## Impacto documental

- Spec nueva `0659` e índice regenerado. El generador del contorno queda en `docs/specs/0659-tracking-por-contenedor/assets/generar-contorno.mjs`.
- `app/studio/CLAUDE.md` no cambia: no se agregó ningún patrón transversal.

## HANDOFF AL DIRECTOR

Pendiente de turno para instalar y probar. No hay migraciones ni cambios fuera de la allowlist de la spec, salvo este handoff.

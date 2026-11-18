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
- Buscador por GET (`?q=`), resuelto en el servidor: cliente, Shipping Mark, referencia o número de contenedor y BL; incluye lo ya entregado.
- Envíos activos sin contenedor: siguen visibles en «Sin contenedor», con la lista y el detalle por envío que ya existían.
- `?id=<envío>` sigue funcionando: abre su contenedor con el envío resaltado, o el envío suelto.
- SDD-0531: los nombres se ocultan en el servidor en los clientes del contenedor y en el buscador; para el equipo de China la consulta por nombre no se hace.

## Medición de roles (la pide la spec) — 2026-11-18

**Qué se midió.** Quién puede leer, por base de datos y por aplicación, lo que esta pantalla muestra.

- **Base de datos.** Las policies de `consolidations`, `consolidation_items`, `sailings` y `bookings` (`supabase/migrations/0096_naviera_consolidacion.sql`, policies «… by tenant») y la de `tracking_snapshots` (`0158_tracking_snapshots.sql`, «tracking_snapshots by tenant») solo comparan `tenant_id`. No distinguen rol ni módulo.
- **Aplicación.** `ROLE_MODULE_ACCESS` en `lib/studio/rbac.ts`: `tracking` lo ven `commercial`, `operations`, `accounting`, `warehouse` y `support`; `naviera` solo `operations` y `accounting`.

**Consecuencia.** Antes de esta PR, el contenido de un contenedor solo se veía en Naviera. Con esta PR, `commercial`, `warehouse` y `support` ven por primera vez, desde Tracking:

1. qué lleva cada contenedor: por ítem, Shipping Mark, nombre del cliente, m³, kg y bultos, incluidos los ítems que no están enlazados a un envío;
2. un buscador sobre todo el histórico de `consolidation_items` (por Shipping Mark y, salvo el equipo de China, por nombre), más referencia, número de contenedor y BL.

Es consecuencia directa de la decisión 4 de Sam del 2026-11-18 (tracking por contenedor, con buscador que diga en qué contenedor viene cada cliente). No se cambió ninguna policy, ni `ROLE_MODULE_ACCESS`, ni el acceso al módulo Naviera: esos tres roles siguen sin entrar a Naviera ni a sus acciones.

**Lo que sigue igual.** El equipo de China (SDD-0531) no recibe nombres: se ocultan en el servidor y la consulta por nombre no se hace. Lo que esos roles ya veían en Tracking (los envíos activos con su cliente) no cambia.

**Decisión de Sam (2026-11-18).** Se le preguntó en esta sesión si comercial, bodega y soporte pueden ver qué lleva cada contenedor, con dos opciones: dejarlo visible o restringirlo a quienes tienen acceso a Naviera. Respondió: «Sí, que lo vean». La PR queda como está; no se restringe nada.

## Cambios tras la revisión independiente (sobre `324ce69f1`)

- Búsqueda por BL: `buscarEnTracking` consulta `bookings.bl_number` y trae los contenedores de esa reserva. Con prueba, también para el equipo de China.
- Los ids de la URL (`?c=`, `?id=`, `?e=`) se validan como UUID antes de consultar; uno inválido se ignora. Antes tumbaba la página con 22P02.
- Las tres lecturas iniciales de contenedores van en paralelo.
- Allowlist de la spec ajustada con los dos archivos de prueba y este handoff; la medición de roles quedó también en la spec.
- Los Shipping Marks de las pruebas nuevas pasaron al rango `DTD-9xxx`, claramente ficticio. No consulté producción para compararlos.

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
| `pnpm install --frozen-lockfile --prefer-offline` (turno del Director) | PASÓ, sin cambios en el repo |
| `tsc --noEmit` | PASÓ |
| `eslint` sobre tracking y los módulos nuevos | PASÓ, sin errores ni advertencias |
| `vitest` de tracking, de los módulos nuevos y de los contratos de `app/studio/_components/__tests__` | PASÓ en dos corridas (406 pruebas en 32 archivos, más la repetición de los que no arrancaron). Incluye `ocultar-nombres-cn` sin cambios. |
| `claridad-t5d-contract` y `claridad-t5e-contract` | NO EJECUTADO: el proceso de prueba no arrancó en tres intentos por carga de la PC. No leen archivos de tracking ni `studio.css`; quedan para el CI. |
| `pnpm verify` | NO EJECUTADO: el Director indicó que el CI es el portón |
| `/ui-check` | NO EJECUTADO: requiere la app corriendo |
| Vista en navegador | NO EJECUTADO |

## COMMITS

- `70302fd14` docs(specs): SDD-0659 — spec y reserva (publicado)
- `72fb73a56` feat(studio): SDD-0659 — lógica, consultas y mapa del Pacífico
- `21ef904ec` feat(studio): SDD-0659 — pantalla por contenedor, buscador y «Quién viene adentro»

## PR / BRANCH

Rama publicada. PR abierta contra `main`, sin fusionar.

## PENDIENTES DE ESTA TAREA

1. Leer el CI de la PR y corregir lo que marque.
2. `/ui-check` y revisión en navegador (oscuro y claro, compacto, ancho angosto): nadie ha visto la pantalla corriendo.
3. Preguntas abiertas para Sam (están en la spec): dónde va «Avisar a los clientes»; qué referencia da el proveedor tercero en un consolidado parcial; si los entregados se ven en un filtro.
4. Fase 2 (consolidado parcial) y Fase 3 (avisos de ETA movida) necesitan migración y OK aparte.

## FUERA DE ALCANCE DETECTADO

- `lib/studio/privacidad-cn.ts` exporta `LOTE_SIN_NOMBRE = "Lote sin Shipping Mark"`: usa «lote», palabra que Sam pidió no usar. No se tocó.
- `daysRemaining` de `tracking-progress.ts` calcula días con un factor fijo por estado. La pantalla por contenedor ya no lo usa (usa la ETA), pero el envío suelto y posiblemente el portal sí.

## Impacto documental

- Spec nueva `0659` e índice regenerado. El generador del contorno queda en `docs/specs/0659-tracking-por-contenedor/assets/generar-contorno.mjs`.
- `app/studio/CLAUDE.md` no cambia: no se agregó ningún patrón transversal.

## HANDOFF AL DIRECTOR

Turno de PC liberado. No hay migraciones ni cambios fuera de la allowlist de la spec, salvo este handoff.

## Corrección posterior: el contador de clientes (2026-11-18)

Rama `claude/tracking-conteo-clientes`, desde `origin/main` `82caee939` (la #667 ya fusionada).

- **Error.** La tarjeta y el panel decían «N clientes» con el número de ítems del contenedor (`clientes.length` en `armarContenedor`). Un cliente con varias cargas contaba varias veces; Embarques daba otro número para el mismo contenedor.
- **Arreglo.** `contarClientes` cuenta clientes distintos con la misma llave que Embarques: Shipping Mark o, si falta, el nombre. La tabla «Quién viene adentro» sigue listando una fila por carga.
- **Validación.** vitest de `lib/studio/__tests__/tracking-contenedores.test.ts` y `app/studio/(app)/tracking/__tests__`: PASÓ (70 pruebas, 4 archivos). Sin el arreglo la prueba nueva falla («expected 6 to be 3»): PASÓ. tsc, eslint y `pnpm verify`: NO EJECUTADO en local (quedan para el CI). No se leyó producción.
- **Cargas en el subtítulo.** Sam, 2026-11-18, ante la pregunta de si el subtítulo de «Quién viene adentro» debía decir también cuántas cargas: «Sí, que diga también cuántas cargas». Ahora dice «N clientes · M cargas · m³». La prueba de la página que lo comprueba: NO EJECUTADA en local (sin turno); queda para el CI.

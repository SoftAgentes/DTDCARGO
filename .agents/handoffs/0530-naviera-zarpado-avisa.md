# Handoff 0530 · Naviera: al zarpar el contenedor, los envíos avanzan y se les avisa

- **Fecha:** 2026-10-15, de 06:51Z a 08:10Z aprox. (jueves 15, madrugada en Caracas).
- **Estado de la tarea:** lista para revisión.
- **Estado de la SDD:** `in-progress`.
- **Owner y sesión:** `worker-naviera-zarpado-avisa` (Claude Opus 5.5), Worker asignado por el
  Director.
- **Worktree:** `C:/Users/AKX generator/Desktop/Developer/DTDCARGO/.claude/worktrees/agent-aae5acd17688dafb8`.
  - Lo creó la app de Claude Code en la rama `worktree-agent-aae5acd17688dafb8`.
  - Ahí creé `codex/naviera-zarpado-avisa` desde `origin/main` y le quité el upstream hacia main.
  - Claim: `worker-naviera-zarpado-avisa`.
  - La rama `worktree-agent-aae5acd17688dafb8` quedó suelta, sin commits propios. No la toqué.
- **Rama:** `codex/naviera-zarpado-avisa`, desde `origin/main` = `a8d99acf`, sin upstream hacia
  main.
- **SDD:** [0530](../../docs/specs/0530-naviera-zarpado-avisa/spec.md).
  - Reserva local: rama `codex/sdd-reserve-0530-naviera-zarpado-avisa`, commit `8b7421d2`, sin
    push. Está incorporada a la rama por fast-forward.
  - **Migración 0477**, la que el Director dejó para esta tarea.
- **Permisos del encargo:** commits locales, push de la rama propia y PR contra `main`. Sin merge
  (congelado hasta después del corte de esta noche), sin force push, sin aplicar nada a ninguna base
  real. Sin `pnpm verify` completo: el turno pesado es de otro Worker.

## OBJETIVO ORIGINAL

Sam eligió «"Zarpado" en Naviera avisa». El Director se lo describió así:

> «Que al marcar un contenedor como zarpado en Naviera se actualicen los envíos de los clientes y se
> les avise. Hoy hay que avanzar cada envío a mano en Tracking.»

Lo que pidió el Director:

1. Al zarpar el contenedor, cada envío vivo avanza al estado del zarpe si su servicio lo permite,
   con su evento y su aviso por el camino de Tracking. Los que no pueden avanzar se informan.
2. El arribo, si es coherente, sin duplicar `received_ve`.
3. Atomicidad y auditoría según las políticas del repo, y un resumen en la pantalla.
4. Permisos de Naviera y de Tracking, sin escalar.
5. Sin tocar `tracking/[id]/actions.ts`, `lib/studio/notifications/*`, `embarques/`, `cn/`,
   `rbac.ts` ni `app/portal/**`.

## COMPLETADO

Detalle, citas archivo:línea y decisiones en la spec.

1. **Zarpe.** «Marcar zarpado» (contenedor `cerrado → zarpado`):
   - pasa a `shipped` cada envío vivo que la regla deja;
   - le escribe su `shipment_events` («Zarpó con el contenedor DTD-CONSOL-NNNN.») y su AUD-01;
   - programa `status:shipped` con la misma llamada que `transitionShipment`.
2. **Arribo.** «Marcar arribado» (`zarpado → arribado`):
   - pasa a `in_customs` los que la regla deja;
   - programa `status:in_customs`, que sólo sale si el tenant tiene la regla;
   - programa `received_ve` como antes, una vez por envío.
   - **No** pasa a `arrived_destination`: eso es «En bodega VE», y sería falso (SDD-0311 §4).
3. **La regla.** Entregado, cancelado, en excepción, eliminado, servicio sin el estado (el
   terrestre), ya en el destino y más adelante no se tocan. Salen con su motivo.
4. **Atómico y auditado.** Una RPC nueva en la 0477, `advance_consolidation_governed`, cambia todo en
   una transacción:
   - el contenedor;
   - los envíos, bloqueados `FOR UPDATE`;
   - los eventos;
   - el AUD-01 por envío y por contenedor, con `correlation_id` común.

   Si la auditoría falla, no cambia nada. El trigger `guard_consolidation_advance_trg` cierra el
   UPDATE directo.
5. **Dos veces.** El segundo zarpe devuelve `already`: no toca nada y la acción no programa avisos.
6. **Permisos.** La acción exige editar Naviera **y** Tracking, y la base lo vuelve a exigir con la
   matriz de `rbac.ts` y los desvíos de 0357. Cerrar el contenedor sigue pidiendo sólo Naviera.
7. **Pantalla.**
   - Los dos botones abren un `ConfirmDialog` con el contenedor, la cantidad de envíos y la
     consecuencia.
   - Al terminar queda un resumen en el detalle: cuántos avanzaron, avisos en la agenda, cuáles no
     cambiaron y por qué, y las piezas sin envío. Sobrevive al cambio de estado.
   - También sale un toast con una línea.

### Archivos frente a la allowlist

Coinciden con la tabla de la spec, sin extras. No toqué:

- `app/studio/(app)/tracking/[id]/actions.ts`;
- `lib/studio/notifications/*`;
- `lib/studio/rbac.ts`, `embarques/`, `cn/` ni `app/portal/**`.

La prueba de la acción **importa** `transitionShipment`, sin editarlo, para comparar su llamada al
motor de avisos con la de Naviera.

## VALIDACIÓN

Sobre el árbol de trabajo de esta rama, base `a8d99acf`.

| Comprobación | Resultado |
|---|---|
| Contrato 0477 en PGlite (`lib/studio/__tests__/naviera-zarpe-avanza-envios.migration.test.ts`) | PASÓ: 25/25, `TEST 0477 GREEN: 60 aserciones`, control rojo, 16 mutantes, 7 propiedades |
| Contrato 0477 en Docker (`node scripts/run-sql-tests.mjs`) | NO EJECUTADO: corrida pesada (turno de otro Worker). PGlite corre el mismo archivo |
| Rojo de la acción contra el `actions.ts` de `main` | 12 rojos y 2 verdes de 14 (los 2 verdes son controles de no regresión) |
| Batería de Naviera: `vitest run app/studio/(app)/naviera lib/studio/naviera` + PGlite + `disparador-vivo` | PASÓ: 19 archivos, 199 pruebas |
| `vitest related` sobre los 6 archivos de producto | PASÓ: 7 archivos, 81 pruebas |
| Contratos que recorren el árbol (`app/studio/_components/__tests__`, `rbac*.test.ts`, `copy-sin-casco-central`, `vis-02-font-tokens`, `fuentes-locales`, `invoice-read-boundary`) | PASÓ: 21 archivos, 685 pruebas |
| Mutantes manuales de app y lib | 31/31 mueren; control 78/78 verde al inicio y al final |
| `pnpm typecheck` | PASÓ |
| `eslint` sobre `app/studio/(app)/naviera`, `lib/studio/naviera` y la prueba PGlite | PASÓ |
| `pnpm lint` completo | NO EJECUTADO: lo corre el CI |
| `node scripts/check-rsc-boundary.mjs` | PASÓ |
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ: 0 ROJO · 1 AMARILLO declarado (`advance_consolidation_governed`) |
| `pnpm docs:check` | PASÓ: 508 specs |
| `pnpm sdd:check` | PASÓ: sin números repetidos (los choques históricos de siempre) |
| `pnpm governance:check` | PASÓ: 28 políticas, cápsula vigente |
| `pnpm components:check` | PASÓ: 5 fuentes |
| `node scripts/check-feature-constants.mjs` | PASÓ: 6 banderas |
| `git diff --check` y archivos nuevos sin espacios finales | PASÓ |
| `pnpm verify` completo | NO EJECUTADO: el turno pesado es de otro Worker; el CI de la PR es la evidencia |
| CI de la PR, run `38701796920` sobre `f2dcd876` | FALLÓ en «Unitarios», 1 de 9760. Ver la nota de abajo |
| CI sobre la corrección | pendiente al cerrar este documento: va en el mensaje al Director |
| `/ui-check` (rúbrica aplicada a mano, sin agente) | OK para commit; abajo |
| Smoke en pantalla | NO EJECUTADO: este worktree no tiene `.env` ni base, y la 0477 no está aplicada |

**El rojo del CI, y por qué no lo vi en local.**

- `lib/shared/__tests__/shipment-public.test.ts` prohíbe en todo el repo los nombres de servicio de
  antes de 0256 entre comillas.
- Mi prueba de «un servicio que no existe» usaba justo uno de esos nombres.
- Ese contrato recorre el repo con `git grep` y no estaba en mis baterías: `vitest related` no lo
  encuentra, porque no importa nada de lo tocado.
- La corrección usa un nombre inventado (`maritimo_inexistente`) y conserva lo que se afirma. El
  contrato y la prueba quedaron verdes en local: 2 archivos y 29 pruebas.

### Mutantes de app y lib (31)

Reemplazo exacto, uno por decisión del diff. La batería tiene 7 archivos:

- la acción;
- el diálogo;
- `NavieraClient`;
- el módulo puro;
- las queries;
- `disparador-vivo`;
- la prueba PGlite, sólo en los de la regla, que van marcados con (P).

Todos mueren («N failed»).

| Id | Qué rompe | Muere en |
|---|---|---|
| A1 | sin el permiso de Tracking | «sin edición de Tracking no llama la RPC» |
| A2 | zarpado por el UPDATE de antes | 12 pruebas de la acción |
| A3 | avisa también con `already` | «marcar zarpado dos veces…» |
| A4 | sin `received_ve` al arribar | prueba del arribo |
| A5 | avisos con otro tenant | zarpe y comparación con Tracking |
| A6 | sin revalidar Tracking | zarpe |
| A7 | sin revalidar Almacén VE | arribo |
| A8 | sin `avisosLlegada` en el resumen | arribo |
| Q1 | evento fijo `status:shipped` | arribo |
| Q2 | cuenta avisos que no quedaron | «cuenta sólo los avisos…» y queries |
| Q3 | acepta el resultado de otro avance | queries |
| Q4 | la RPC lanza | queries |
| Q5 | muestra el texto de PostgREST | 4 pruebas de fallos |
| Q6 | aviso sin nombre | zarpe y comparación con Tracking |
| P1 (P) | sin la regla de la excepción | propiedad y ancla |
| P2 (P) | «más adelante» corrido un lugar | propiedad y anclas |
| P3 (P) | bodegaje sin posición | propiedad y ancla |
| P4 | acepta un motivo desconocido | módulo puro |
| P5 | toast sin «sin cambio» | módulo puro |
| P6 | acepta un destino que no corresponde | módulo puro |
| P7 | nombres en el resumen | módulo puro |
| P8 (P) | sin la regla del entregado | propiedad y anclas |
| U1 | sin `onResumen` | diálogo y NavieraClient |
| U2 | el diálogo no se cierra | diálogo |
| U3 | el diálogo no dice el aviso | diálogo |
| U4 | sin mensaje si la llamada se cae | diálogo |
| U5 | sin el motivo en el resumen | resumen y NavieraClient |
| U6 | sin los avisos de llegada | resumen |
| U7 | «Marcar arribado» llama zarpado | NavieraClient y `disparador-vivo` |
| U8 | sin el resumen en el detalle | NavieraClient |
| U9 | cuenta piezas en vez de envíos | diálogo de NavieraClient |

Un mutante sobrevivió en un primer intento y lo resolví quitando código, no agregando prueba: el
`if (pending) return;` de `AvanceContenedorAccion` sobraba. El doble envío lo frena `ConfirmDialog`
(`pending` y su candado de un solo envío). Agregué la prueba de que reintentar después del mismo
error vuelve a llamar.

### Mutantes de la 0477 (16, en la prueba PGlite)

Cada uno muere en la aserción de su regla:

- trigger ausente;
- trigger que deja pasar;
- envío eliminado;
- excepción;
- servicio;
- bodegaje;
- saltados;
- evento;
- auditoría;
- nombre en la auditoría;
- `already`;
- estado de origen;
- permiso de Tracking;
- support con desvío;
- desvíos ignorados;
- membresía.

Dos son defensas dobles y su muerte va anotada en la prueba:

- **sin la rama `eliminado`**, el UPDATE con `deleted_at is null` aborta toda la RPC: un envío
  eliminado impediría zarpar el contenedor;
- **sin el chequeo de origen**, el `status = v_from` del UPDATE frena igual, así que muere en el
  mensaje.

### /ui-check (aplicado a mano)

🎨 UI-CHECK · Naviera, diálogo y resumen del avance.

Hallazgos (2):

1. ⭐ [media] `AvanceContenedorAccion.tsx`: el disparador es un `<button>` crudo con
   `studio-btn studio-btn-dark studio-btn-sm`. Sólo abre el diálogo y no muta (BTN-01 §6/§9); la
   mutación es el botón del `ConfirmDialog`, con pending. Va justificado en la PR.
2. [baja] El resumen no tiene botón para cerrarlo: queda hasta cambiar de contenedor o recargar. Es
   a propósito, porque es el rastro de la acción.

✅ Lo que está bien:

- sólo tokens (`--s-*`, `--ink`, `--ink-soft`, `--border`, `--success` en el icono), sin hex;
- códigos en `--f-mono`;
- el éxito es icono verde con texto neutro (BRAND, Estados y mensajes);
- región con encabezado y lista;
- tuteo, sentence case, singular y plural.

Veredicto: OK para commit.

## COMMITS

- `8b7421d2` chore(sdd): reserva SDD-0530 — naviera-zarpado-avisa (stub de la reserva).
- `b50e6f77` feat(db): SDD-0530 — 0477: zarpar y arribar el contenedor avanzan sus envíos en una
  transacción.
- `0ace745e` feat(studio): SDD-0530 — al zarpar o arribar el contenedor, sus envíos avanzan y se
  les avisa.
- `a43d4e8a` feat(studio): SDD-0530 — «Marcar zarpado» y «Marcar arribado» confirman y dejan el
  resumen de los envíos.
- `f2dcd876` docs: SDD-0530 — spec, índice y handoff del zarpe que avanza los envíos.
- El commit que contiene esta versión del documento: la prueba sin el nombre de servicio viejo
  (el rojo del CI) y este handoff al día.

## PR / BRANCH

- **Rama:** `codex/naviera-zarpado-avisa`.
- **Base:** `main` (`a8d99acf`; main no avanzó al revisar a las 07:5xZ).
- **Worktree:** el de arriba.
- **PR:** en borrador. La URL va en el mensaje final al Director.

## PENDIENTES DE ESTA TAREA

1. **Aplicar la 0477**, con OK nominal de Sam y `docs/runbooks/aplicar-migraciones-prod.md`.
   - MIGRATE-FIRST y desplegar enseguida.
   - **No en la ventana del corte al servidor propio** (jueves 2026-10-15 en la noche).
   - Antes, el Director lee READ ONLY en producción lo que exige el preflight: las tablas y columnas,
     las entidades `shipment` y `consolidation` activas en `audit_entity_types`, los 13 valores de
     `shipment_status` y los 5 de `shipment_service`, y que no existan las cuatro funciones.
   - Después, sacar la espera de `migrations-baseline.json` y la degradación de
     `pending-migration-symbol-declarations.json`.
2. **`pnpm verify`** y el contrato en Docker, cuando haya turno.
3. **El smoke de Sam**, abajo, con la 0477 aplicada y la app desplegada.
4. **Merge**, cuando se descongele, con el CI verde.

### Smoke para Sam (Studio › Naviera, rol operations o admin)

Usa un contenedor de prueba con envíos de prueba, o uno real que esté por zarpar.

1. **Preparar.** Un contenedor `cerrado` con varios envíos: uno en bodega, uno ya entregado y uno en
   excepción. En Tracking, anota el estado de cada uno.
2. **Diálogo.** Pulsa «Marcar zarpado».
   - Tiene que salir un diálogo que nombra el contenedor, dice «Los N envíos de DTD-CONSOL-… pasan a
     «Embarcado»» y avisa que a sus clientes les sale el aviso.
   - **Cancelar** no cambia nada.
3. **Zarpe.** Confirma.
   - El contenedor queda «Zarpado».
   - Sale el resumen: el de bodega «pasó a Embarcado»; el entregado y el de excepción salen en «no
     cambiaron», cada uno con su motivo.
   - Cuenta los avisos «en la agenda».
   - **Falla** si el entregado o el de excepción cambiaron de estado, o si el resumen no aparece.
4. **Tracking.** En el envío que avanzó tiene que verse «Embarcado» y, en su historial, «Zarpó con el
   contenedor DTD-CONSOL-…». Los otros dos siguen como estaban.
5. **Correo.** El cliente del envío que avanzó recibe el aviso de embarque (regla `status:shipped`,
   por correo). Los otros dos clientes **no** reciben nada por este zarpe.
6. **Dos pestañas.** Abre el mismo contenedor en otra pestaña antes de zarpar, zarpa en una e
   intenta en la otra. La segunda dice «El contenedor cambió de estado…» o «ya estaba zarpado», y
   **no sale un segundo correo**.
7. **Arribo.** Pulsa «Marcar arribado» y confirma.
   - El envío embarcado pasa a «En aduana» y aparece en Almacén VE.
   - Su cliente recibe «Tu carga llegó a Venezuela», **una vez**.
   - Si la regla `status:in_customs` está activa, también ese aviso.
Los permisos no van en el smoke. Para ver una denegación habría que cambiar los permisos de
producción, y ya están probados en automático: la acción, la base y la matriz contra
`canEditModule`.

## FUERA DE ALCANCE DETECTADO

1. **Posible fallo en producción de «Autorizar» la solicitud de consolidación (SDD-0232).**
   **INFERENCIA por lectura de código, NO VERIFICADO contra producción.**
   - En `main`, `NavieraClient.tsx:706-707` arma `request_ref` como
     `naviera-consolidation-authorization:<uuid>:<uuid>`, que son 109 caracteres.
   - La 0322 arma `correlation_id` como `consolidation-authorization:<uuid>:<request_ref>`
     (`0322:232-234`), que son 174 caracteres. Lo medí con node sobre esos mismos formatos: la regex
     del writer da `false`.
   - El writer real rechaza un `correlation_id` de más de 128 (`0267:542-545`, con el CHECK de la
     tabla en `:318-322`). Con eso, la autorización revertiría entera con 22023 y la pantalla diría
     «No se pudo autorizar. Referencia: …».
   - El contrato de la 0322 usa un writer simulado que no valida el largo, así que no lo ve.
   - Conviene comprobarlo en producción, contando autorizaciones exitosas desde el 2026-08-01, antes
     de cualquier arreglo.
2. **`received_ve` y `consolidated` también avisan a envíos cancelados o entregados del
   contenedor.** `scheduleConsolidationEvent` filtra eliminados (SDD-0511), pero no estados
   terminales. Es de antes, y vive en `lib/studio/notifications/*`, que esta tarea no toca.
3. **`createConsolidation` acepta cualquier `status` del cliente.** El drawer sólo manda
   `consolidando`, pero una llamada directa podría crear un contenedor ya `zarpado` sin sus envíos.
   El trigger de 0477 sólo cubre UPDATE.
4. **Unificar el aviso por estado.** `transitionShipment` y `programarAvisosDelAvance` hacen la misma
   llamada. Cuando entre la SDD-0522, que Tracking use la función compartida. La nota está en
   `lib/studio/naviera/avance-por-contenedor-queries.ts`.
5. **`transitionShipment` no escribe AUD-01 ni es atómico.** El UPDATE y el evento van por separado.
   Lo nuevo de Naviera sí lo es; Tracking queda igual (SDD-0522).
6. **`in_transit` después del zarpe.** Nadie lo pone: los envíos pasan de `shipped` a `in_customs` al
   arribar.
7. **`changeSailingStatus` no tiene llamadores** (`naviera/actions.ts:191-207`).
8. **La nota del historial es visible en el Portal.** Si un tenant oculta un hito con
   `visible_in_portal`, el feed de actividad del Portal (`listMyRecentActivity`) igual muestra el
   evento con su estado. Es de antes; la nota del arribo no dice «aduana».

## Conocimiento y documentación

- **Impacto documental:** la spec 0530 y el índice. No cambian documentos canónicos de reglas.
- **`pnpm knowledge:status`:** `ok: false` en este worktree.
  - No existe `graphify-out/graph.json`: es derivado e ignorado, y un worktree nuevo no lo trae.
  - Estructural `INVALID`; Archify `PENDING` (`ARCHIFY_RUNTIME_MISSING`); Obsidian `PENDING`
    (`e99806d1`).
  - No actualicé Graphify ni Archify aquí. El Director publica desde main integrado.
- **Datos personales:** revisé `.claude/skills/revisar-datos-ve/SKILL.md`. Minimización CORRECTO;
  el detalle está en la spec.

## HANDOFF AL DIRECTOR

1. **Revisar la PR en borrador.** Cambios compartidos:
   - la migración 0477;
   - `migrations-baseline.json` (una espera nueva);
   - `pending-migration-symbol-declarations.json` (una degradación nueva);
   - `naviera/actions.ts`.

   Con la #227 comparte sólo `docs/specs/README.md`, que es el índice generado: se resuelve con el
   driver y `pnpm docs:index`. La #227 cambia `lectores-admin-double.ts` y esta PR sólo lo importa.
   Si la #227 entra antes, hay que volver a correr la prueba de la acción.
2. **Orden.** La 0477 primero (MIGRATE-FIRST), con OK nominal de Sam y fuera de la ventana del
   corte. Después, merge y despliegue enseguida, y el smoke de arriba.
3. **Verify y Docker.** Cuando haya turno, `pnpm verify` y `node scripts/run-sql-tests.mjs`.
4. **Ownership.** Al publicar libero el claim (`worker-naviera-zarpado-avisa`). No quedan sesiones
   consumidoras de este worktree.

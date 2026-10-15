# Handoff 0524 · Avisos de bodega confiables para el cliente

- **Fecha:** 2026-10-15, de 05:33Z a 06:40Z aprox. (jueves 15, madrugada en Caracas).
- **Estado de la tarea:** lista para revisión.
- **Estado de la SDD:** `in-progress`.
- **Owner y sesión:** `worker-sdd-0524-avisos-bodega` (Claude Opus 5.5), Worker asignado por el
  Director.
- **Worktree:** `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/avisos-bodega-confiables`.
  - El primero, `.claude/worktrees/agent-a9538e6c39d72d3c7`, lo había creado la app y se borró solo
    mientras esperaba que el Director confirmara el número.
  - La rama sobrevivió sin commits y la monté aquí con `git worktree add`.
  - Claim: `worker-sdd-0524-avisos-bodega`.
  - Quedó suelta la rama `worktree-agent-a9538e6c39d72d3c7`, sin commits propios. No la toqué.
- **Rama:** `codex/avisos-bodega-confiables`, desde `origin/main` = `a8d99acf`, sin upstream hacia
  main.
- **SDD:** [0524](../../docs/specs/0524-avisos-bodega-confiables/spec.md).
  - Reserva local: rama `codex/sdd-reserve-0524-avisos-bodega-confiables`, commit `73531214`, sin
    push. Está incorporada a la rama por fast-forward.
  - La 0523 la tomó otra sesión 53 s antes (`unsubscribe-secreto-vacio`). El Director confirmó la
    0524.
  - **Sin migración.** La 0477 queda libre.
- **Permisos del encargo:** commits locales, push de la rama propia y PR contra `main`. Sin merge,
  sin force push, sin aplicar nada a ninguna base real. Sin `pnpm verify` completo: el turno pesado
  es del Worker de la 0522.

## OBJETIVO ORIGINAL

Pedido de Sam, literal:

> «Ya quiero empezar a que cuando generemos ahorita en China, el usuario de China o cualquiera de mi
> oficina, porque vamos a empezar nosotros generando los embarques de allá, al cliente le salga el
> aviso en su tracking de que ya llegó la mercancía al warehouse o cualquier estatus.»

Canal decidido por Sam: «Correo y push (Recomendado)».

Lo que pidió el Director:

1. `/m/cn/nueva` avisa y vincula como el escritorio.
2. El aviso cuelga de la compra cuando se conoce, y un descarte por duplicado nunca es silencioso.
3. El push llega a todos los usuarios activos del Portal con suscripción.
4. Los textos que vuelven con el interruptor apagado son verdad. `TRACKING_EN_CONSTRUCCION` sigue en
   `true`.

## COMPLETADO

Detalle y citas archivo:línea en la spec.

1. **`/m/cn/nueva` vincula y avisa.** El código está en `lib/studio/notifications/aviso-recepcion-cn.ts`
   y lo llama `app/m/cn/nueva/actions.ts` con `await`.
   - Con exactamente una compra en `anunciada`/`en_camino`, vincula `prealerta_id`, y la OV con la
     regla estricta.
   - El aviso cuelga de la compra sólo si el UPDATE escribió la fila.
   - Si el cliente queda sin aviso, deja la nota en la bitácora.
   - **Sin migración**: el RPC ya devuelve `receipt_id`, y el vínculo se escribe después, con las
     mismas garantías que el escritorio.
2. **La compra primero.**
   - `scheduleReceiptInWarehouse` prueba la compra antes que el envío abierto.
   - El motor devuelve `motivo`.
   - El duplicado, la regla sin fecha, el error, la lectura caída y la excepción por cliente quedan
     en `sinDestino` y en `detalle`.
   - `notaSinAvisoBodega` escribe la frase de cada motivo, y la usan los tres caminos.
   - La regla apagada no se anota, porque es decisión del tenant.
3. **Push.**
   - `dispatchPush` encola a todos los vínculos activos del tenant y del cliente que tienen
     suscripción (tabla o jsonb viejo), siempre por `outbox_push_events`.
   - Sin suscripción: `no_destination`, ya no un falso `sent`.
   - **El caso de dos usuarios no ocurre hoy**: `client_users` es `unique (tenant_id, client_id)`
     (`0080:29`). Se corrigió para no depender de esa garantía.
   - Probando apareció un defecto que sí ocurre hoy: se marcaba enviado el push de un usuario sin
     ningún dispositivo.
4. **Textos.**
   - El registro, apagado, dice correo y push y no WhatsApp.
   - Los otros tres textos revisados (tarjeta de push del Portal, detalle de compra y ficha de
     pre-alerta) son ciertos con este cambio y no se tocaron.
   - `TRACKING_EN_CONSTRUCCION = true` no cambió. Se actualizaron su comentario y su `significa` en
     `scripts/feature-constants.json`.

### Archivos frente a la allowlist

Coinciden con la tabla de la spec, sin extras. Se tocó `app/studio/(app)/cn/actions.ts` en **dos
trozos**: el import (`:21-24`) y la nota de `createReceiptAction` (`:322`). Es imprescindible porque,
sin ese cambio, el escritorio anotaría «no tiene un envío abierto» también para un duplicado, y eso
sería falso.

**Aviso para la 0522:** esa SDD edita `softDeleteReceiptAction` y las acciones por lote del mismo
archivo. Son trozos distintos y no espero conflicto, pero conviene integrar mirando el diff.

## VALIDACIÓN

Todo sobre el árbol de trabajo de esta rama (base `a8d99acf`). Los SHAs de los commits van en
COMMITS.

| Comprobación | Resultado |
|---|---|
| Rojo antes del arreglo (fan-out 14, push 10, `/m/cn/nueva` 7) | PASÓ: 8, 8 y 5 rojos, cada uno por el motivo que describe |
| `vitest run` del foco ampliado sobre el árbol final: notificaciones, `app/m/cn`, `app/studio/(app)/cn`, 0511, registro, Portal (`page.test.tsx` y `compras`), `components/servicios` y `lib/studio/notify` | PASÓ: 55 archivos, 517 pruebas |
| `vitest run scripts/check-feature-constants.test.mjs` | PASÓ: 9 pruebas |
| `vitest related` sobre los archivos de producto tocados (antes de los últimos casos) | PASÓ: 34 archivos, 238 pruebas |
| Mutantes manuales | PASÓ: 53 de 55 mueren, 2 equivalentes; control verde antes y después |
| `pnpm typecheck` | PASÓ |
| `eslint` sobre los archivos tocados | PASÓ |
| `docs:check` (`build-docs-index.mjs --check`) | PASÓ: 508 specs |
| `sdd:check` (`check-numbering.mjs`) | PASÓ: sin números repetidos; avisos de choques históricos ya conocidos |
| `check-feature-constants` | PASÓ: 6 banderas coinciden |
| `check-pending-migration-symbols` | NO APLICA: no hay migración |
| `git diff --check` | PASÓ |
| `knowledge:status` | `ok: false`, esperado en un worktree nuevo: estructural INVALID porque no hay `graphify-out` aquí (3369 faltantes), Archify sin runtime y Obsidian pendiente. No lo reparé en el worktree; lo publica el Director desde main |
| `pnpm verify` completo | **NO EJECUTADO**: el turno de corrida pesada es del Worker de la 0522. El CI de la PR es la evidencia de la suite |
| Smoke en pantalla | NO EJECUTADO: es de Sam y necesita datos reales (ver guion) |

### Mutantes

**Cómo se corrieron:**

- Con el corredor propio `mutantes.cjs`, que quedó en el scratchpad de la sesión y no está en Git.
- Batería de 10 archivos: el fan-out nuevo, `schedule-fanout`, el motor, el push, el drain, la 0511,
  `/m/cn/nueva`, `/m/cn/recibir`, `create-receipt-code` y el registro.
- Vitest se lanza con `spawnSync` sin shell, porque las rutas tienen `(app)`.
- Un mutante sólo cuenta como muerto con la línea «N failed».
- El control estuvo verde al inicio y al final: 113 de 113, y 114 de 114 en la repetición del 48.

**Resultado: 53 de 55 mueren.**

| # | Mutante | Resultado |
|---|---|---|
| 1 | Sin la compra primero | muere (10) |
| 2 | Duplicado silencioso | muere (3) |
| 3 | Regla apagada anotada como olvido | muere (1) |
| 4 | Regla sin fecha silenciosa | muere (1) |
| 5 | Sin caída al envío si falta la 0389 | muere (1) |
| 6 | «Programado» no suma | muere (10) |
| 7 | Error silencioso | muere (1) |
| 8 | `motivoDe` sin «programado» | muere (6) |
| 9 | La compra sin aviso cae también al envío | muere (3) |
| 10 | Se pierde el ancla de la compra en el detalle | muere (2) |
| 11 | Lectura caída tratada como «sin envío» | muere (1) |
| 12 | «Sin envío» silencioso | muere (6) |
| 13 | Se pierde el ancla del envío | muere (2) |
| 14 | Duplicado del envío silencioso | muere (2) |
| 15 | Fallo inesperado silencioso | muere (1) |
| 16 | `sinDestino` vacío | muere (8) |
| 17 | Nota vacía en vez de `null` | muere (2) |
| 18-21 | Las cuatro frases de la nota | mueren (2, 4, 1 y 1) |
| 22-29 | Motivos del motor: duplicado, error, sin regla, apagada, sin fecha, falta 0389, programado, sin markbox | mueren |
| 30 | Push también a revocados | muere |
| 31 | Push sin filtro de tenant | muere |
| 32 | Push sin `.not("auth_user_id", "is", null)` | **sobrevive, equivalente**: el filtro en JS descarta igual los nulos |
| 33 | Error de vínculos tratado como «sin destino» | muere |
| 34 | Push que ignora la suscripción | muere |
| 35 | Nadie con suscripción tratado como transitorio | muere |
| 36 | Nada encolado tratado como enviado | muere |
| 37 | Lectura caída tratada como «nadie suscrito» | muere |
| 38-40 | jsonb con el push apagado, sin `user_push_subscriptions`, sin jsonb | mueren |
| 41-46 | Vínculo: elige con dos compras, sin filtro de estado, de Shipping Mark, de eliminadas o de tenant, ata OV facturada | mueren |
| 47 | El vínculo cuenta aunque el UPDATE no escribió | muere |
| 48 | UPDATE del vínculo sin `eq tenant_id` | sobrevivió, **se agregó el caso** «nunca escribe una recepción de otro tenant» y ahora muere |
| 49 | El aviso no usa la compra vinculada | muere |
| 50 | Sin nota en la bitácora | muere |
| 51 | La acción no llama al helper | muere (6) |
| 52 | La acción sin `!input.is_orphan` | **sobrevive, equivalente**: `validateCreateReceiptInput` anula el Shipping Mark de la huérfana (`lib/studio/operario-types.ts:177-179`) |
| 53 | El escaneo vuelve a la nota vieja, con su import | muere |
| 54 | El escritorio vuelve a la nota vieja, con su import | muere |
| 55 | El registro vuelve a prometer WhatsApp | muere (2) |

## Instrucciones para el equipo de China

Para mañana:

1. **⭐ Primero, el escaneo: `/m/cn/recibir`.** Úsalo cuando la caja trae la etiqueta **DTD-B** del
   proveedor. Es el camino seguro:
   - la recepción queda atada a la compra exacta;
   - el cliente recibe el aviso de **esa** compra;
   - en su Portal ve la llegada con las cajas.
2. **Si la caja no trae etiqueta DTD-B: `/m/cn/nueva`**, con el Shipping Mark del cliente
   (`DTD-NNNN`). Desde esta SDD también avisa.
   - Si el cliente tiene **una sola** compra anunciada o en camino, la recepción queda atada a ella
     y el aviso lleva a esa compra.
   - Si tiene **dos o más**, la recepción no se ata a ninguna. El aviso usa su envío abierto, si lo
     hay, o queda una nota en la bitácora de la recepción.
3. **El Studio de escritorio (`/studio/cn`)** funciona igual que `/m/cn/nueva`, y es el camino para
   la oficina y para cargar en lote.
4. **Evita marcar «huérfana» si conoces el Shipping Mark.** La huérfana no avisa a nadie, a
   propósito: todavía no se sabe de quién es.
5. **Revisa la bitácora de la recepción.** Si dice «Aviso al cliente NO enviado (DTD-…)», el cliente
   no recibió el aviso, y la nota dice por qué: sin compra ni envío, ya avisado, regla mal anclada o
   fallo. Escríbele.

**Antes de empezar, Sam cambia la regla** «Recibido en bodega China» a «Correo y push» en
`/studio/admin/notificaciones`. Mientras siga en correo, sólo sale el correo.

## Smoke para Sam

Con la cuenta de prueba **DTD-1004**. Pide la ventana al Director: escribe en producción (una compra,
una recepción y un aviso reales para la cuenta de prueba).

1. **Regla.** En `/studio/admin/notificaciones`, «Recibido en bodega China» en «Correo y push» y
   activa.
2. **Portal.** Entra con el usuario de DTD-1004 y activa las notificaciones en la portada. La
   tarjeta pasa a «Notificaciones activadas».
3. **Compra.** Desde ese Portal, anuncia **una** compra nueva. Anota su código (`DTD-1004-…`) y
   comprueba que DTD-1004 no tiene otra compra anunciada o en camino. Si la tiene, el paso 4b no
   vincula, y eso es lo esperado.
4. **Recepción**, una de las dos:
   - a. **Escaneo:** en `/m/cn/recibir`, escanea una etiqueta DTD-B de esa compra y confirma.
   - b. **Manual:** en `/m/cn/nueva`, crea una recepción no huérfana con Shipping Mark DTD-1004.
5. **Correo.** Llega «Tu carga llegó a nuestra bodega en China · DTD-1004-…», y su enlace
   «Ver el seguimiento en tu portal» abre **`/portal/compras/DTD-1004-…`**, no un envío.
6. **Push.** Llega la notificación al teléfono o al navegador donde activaste el paso 2, y al
   tocarla abre el mismo detalle de compra.
7. **Detalle de la compra en el Portal.** Con el interruptor prendido se ve el aviso «Seguimiento en
   construcción», y **debajo aparece la recepción** con su fecha y sus cajas.
8. **Bitácora.** En `/studio/cn`, abre la recepción. **No** debe haber una nota «Aviso al cliente NO
   enviado».
9. **Duplicado, opcional.** Repite el paso 4b con la misma compra. Sale una nota «ya existía un aviso
   de llegada a bodega para DTD-1004-…» y no llega un segundo correo.

**Falla si:**

- el correo lleva a `/portal/envios/…`;
- no llega el push con la regla en «Correo y push»;
- la recepción no aparece en el detalle de la compra;
- aparece la nota «NO enviado» en el paso 8;
- llega un segundo correo en el paso 9.

Este guion se puede sumar a `.agents/handoffs/smokes-app-l14-0454-0472-guion.md` cuando el Director
lo integre.

## COMMITS

Sobre `a8d99acf`, en este orden:

| Commit | Contenido |
|---|---|
| `73531214` | `chore(sdd)`: reserva SDD-0524, el stub del script |
| `a4ca6418` | `feat(studio)`: el aviso de bodega cuelga de la compra y nunca se descarta en silencio. Motor, fan-out, doble, notas del escaneo y del escritorio |
| `49dc6abd` | `feat(studio)`: `/m/cn/nueva` vincula la recepción a su compra y avisa al cliente |
| `ef265a48` | `feat(studio)`: push del aviso a todos los usuarios del Portal con suscripción |
| `5219fbb8` | `feat(DTD-0524)`: el registro, con el seguimiento activo, no promete avisos por WhatsApp |
| El que contiene este documento | `docs(sdd)`: spec, índice y handoff |

## PR / BRANCH

- Rama `codex/avisos-bodega-confiables`, publicada con
  `git push -u origin codex/avisos-bodega-confiables:codex/avisos-bodega-confiables`.
- PR **en borrador** contra `main`. El número va en el informe al Director: este documento se
  escribe antes del push para no mover la cabeza después.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/avisos-bodega-confiables`.
- Al publicar, `main` seguía en `a8d99acf`, así que no hizo falta merge.
- No publiqué la rama de reserva `codex/sdd-reserve-0524-avisos-bodega-confiables`: su único commit
  ya está en esta rama.

## PENDIENTES DE ESTA TAREA

- `pnpm verify` completo: NO EJECUTADO por el turno de la 0522. Lo cubre el CI de la PR.
- El smoke de Sam (arriba), después del merge y del deploy autorizados.
- Pasar la SDD a `done` cuando haya smoke y merge.

## FUERA DE ALCANCE DETECTADO

- **WhatsApp:** no hay avisos automáticos por WhatsApp. Los textos ya no lo prometen.
- **Pantalla para vincular a mano** una recepción huérfana, o una sin compra cuando el cliente tiene
  dos o más compras abiertas. Hoy queda la nota, pero no hay botón.
- **«Zarpado» en Naviera** no avanza los envíos.
- **`prealertas.shipment_id`.**
- **El historial de avisos de compra** en el Portal.
- **La campana del Portal.**
- **Ocultar nombres de clientes** a usuarios cn en Tracking y Naviera.
- **El borrado de embarques y recepciones (SDD-0522).** No toqué `app/studio/(app)/embarques/`,
  `lib/studio/rbac.ts`, `lib/studio/warehouse-cn-queries.ts` ni la migración 0476.
- **La regla del vínculo está escrita dos veces.** El escritorio vincula en línea
  (`app/studio/(app)/cn/actions.ts:248-287`) y `/m/cn/nueva` usa `aviso-recepcion-cn.ts`. El
  contenido es el mismo. Además, el escritorio todavía conjetura la compra del aviso entre
  `anunciada`/`en_camino`/`recibida` (`compraParaElAviso`). Conviene unirlos después de la 0522.
- **`create_receipt_as_operario` (0045):**
  - todavía calcula el código WR con `max()+1`, en vez del trigger de la 0469 que usa el
    escritorio;
  - no valida que `p_warehouse_id` sea del tenant del operario.

  No se midió en producción.
- **La conexión de push de zarpe y reparto.** La tarjeta del Portal promete push en zarpe y entrega.
  Depende de que esas reglas tengan push en producción: NO VERIFICADO.
- **`docs/architecture/module-sdd-map.md`** no lista las specs recientes de avisos (0283, 0511).
  No sumé la 0524 para no editar la misma fila que la 0522.

## Impacto documental

- **Canónicos actualizados:** esta spec, el índice `docs/specs/README.md` (regenerado con
  `build-docs-index.mjs`), el comentario de `lib/portal/tracking-en-construccion.ts` y el
  `significa` de `scripts/feature-constants.json`.
- **Graphify y Archify:** no los corrí en el worktree. Por la regla de una corrida pesada a la vez,
  Graphify lo publica el Director desde main. Fuentes cambiadas para la próxima pasada estructural:
  los archivos de la allowlist.
- **`knowledge:status`:** `ok: false`, esperado en un worktree nuevo sin `graphify-out`:
  - estructural INVALID, con 4578 pendientes y 3369 faltantes;
  - semántico INVALID;
  - Archify PENDING, porque falta el runtime 2.16.0;
  - Obsidian PENDING.

  No lo reparé en el worktree. La pasada estructural y la publicación son del Director desde main.

## HANDOFF AL DIRECTOR

- **Siguiente acción:** revisar la PR en borrador.
- **Integración:**
  - Sin migración: no hay orden migrate-first ni aplicación.
  - El merge despliega a producción.
  - Antes del merge, conviene que entre la 0522 o revisar juntos el archivo del escritorio.
- **Cambios compartidos:**
  - `lectores-admin-double.ts`: sólo agrega cosas; la batería de la 0511 sigue verde.
  - La forma de `scheduleReceiptInWarehouse`: suma `detalle`.
  - `ScheduleResult.motivo`: opcional en el tipo.
- **Para Sam antes de apagar el interruptor:**
  - cambiar la regla de bodega a «Correo y push»;
  - correr el smoke.
- **Ownership:** el claim `worker-sdd-0524-avisos-bodega` se libera después de este commit, con
  `harness-worktree release`.
- **Sesiones consumidoras:** ninguna, fuera de esta. No eliminé el worktree ni la rama.

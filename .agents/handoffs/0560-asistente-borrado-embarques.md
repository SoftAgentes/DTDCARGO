# Handoff · SDD-0560 · Asistente de borrado de embarques

| Campo | Valor |
|---|---|
| Fecha | 2026-10-18 / 2026-10-19 (UTC) |
| Owner | Worker (subagente del Director) · claim `worker-asistente-borrado-20261018` |
| Ruta | `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\agent-a0dfdfa547efd84ef` |
| Rama | `worktree-agent-a0dfdfa547efd84ef` |
| Base | `origin/main` `77035907` |
| SDD | `docs/specs/0560-asistente-borrado-embarques/spec.md` (`in-progress`). Reserva `codex/sdd-reserve-0560` (commit `50cb7f57`, publicada) |
| Migración | **Ninguna.** La 0493 que reservó el Director no se usa: queda libre |
| Estado de la tarea | lista-para-revision (PR en borrador) |
| Permisos | Commits en la rama, push de la rama y de la reserva, PR en borrador. Sin merge, sin producción y sin base de prueba |

## OBJETIVO ORIGINAL

Pedido de Sam (2026-10-18): cuando un embarque no se puede eliminar, que el Studio lo guíe paso a paso
(«Primero debes eliminar esto. ¿Deseas eliminarlo?»), con confirmación por paso, hasta poder eliminar
el embarque. Aprobó la propuesta del Director: «sí, son todos demos, arranca la tarea así».

## COMPLETADO

- **Plan puro**: `lib/studio/borrado/asistente.ts`.
  - `calcularPlan` toma los conteos de la 0476 y el detalle de cada dependencia.
  - `RESOLUCION_DE_GUARDA` es la tabla de guardas → asistente, su módulo o bloquea.
  - Falla cerrado: lista que no cuadra, guarda desconocida, algo sin comprobar y factura con asiento
    vivo (B1).
  - Si algo no se resuelve, no ofrece ningún paso.
  - Orden: su módulo → borrador (P2) → gasto, CxP y factura (P3) → embarque.
- **Lector**: `lib/studio/borrado/asistente-servidor.ts`. Usa la RPC `shipment_delete_blockers` de la
  0476 y, para cada guarda con conteo, lista sus filas con el mismo predicado (incluidos los asientos de
  las facturas).
- **Acciones** en `app/studio/(app)/embarques/actions.ts`:
  - `leerPlanDeBorradoAction` y `ejecutarPasoDeBorradoAction`, con `capabilityDenial(…, "delete_shipments")`
    al tope;
  - el plan se recalcula antes de cada paso y solo se ejecuta el siguiente;
  - cada paso va a la acción de su módulo: `voidInvoice`, `softDeleteInvoice`, `voidExpenseAction`,
    `voidBill` o la RPC de la 0476.
- **UI**: `AsistenteBorrado.tsx` (`DrawerShell` + `ConfirmDialog`).
  - En Embarques, «Ver los pasos» junto al motivo de la fila bloqueada.
  - En Tracking, «Ver los pasos para eliminarlo» en el modal, cuando `deleteShipment` devuelve
    `bloqueado: true`.
- **SDD-0560** con la tabla de guardas, el orden, el contrato por paso, la frontera B1, la
  concurrencia, la UI, la gobernanza, los datos personales, la allowlist y la evidencia.
- Criterios 1 a 9 de la SDD cumplidos; el 10 (`verify`) y el 11 (smoke de Sam) abajo.

### Guardas → pasos

| Guarda | Resolución |
|---|---|
| Factura emitida o vencida, sin cobros ni asiento vivo | Asistente: anular (`voidInvoice`, R3 con motivo) |
| Factura en borrador | Asistente: eliminar (`softDeleteInvoice`, R2) |
| Factura con cobros | Su módulo: Cobranzas |
| Factura con asiento vivo o sin poder comprobarlo | Bloquea (B1) |
| Gasto | Asistente: anular (`voidExpenseAction`; el asiento se anula en la misma transacción) |
| CxP pendiente sin pagos / con pagos | Asistente: anular (`voidBill`) / Tesorería |
| Ruta TMS sin completar / completada | TMS / bloquea |
| Consolidación, recepciones CN y compra | Naviera, Almacén CN y Órdenes de compra |
| Entregado, reclamo, Aduana, costeo, Financiero China y desconocido | Bloquea siempre |

## VALIDACIÓN

| Comprobación | Alcance / SHA | Resultado |
|---|---|---|
| `corepack pnpm typecheck` | árbol en `1edf50dc` | PASÓ (exit 0) |
| `eslint` de los archivos del cambio | `1edf50dc` | PASÓ (exit 0; el aviso `set-state-in-effect` se corrigió antes) |
| Vitest focalizado: borrado, Embarques, Tracking, pantallas con denegación, `rbac-actions-guard`, `rbac` | `1edf50dc` | PASÓ: 19 archivos, 734 pruebas |
| Control verde de las 7 suites objetivo de los mutantes | `e4df7c28` | PASÓ: 145/145 |
| Mutantes (39) | `e4df7c28` / `deaebf63`; UI repetida en `2ebb277b` | 39 de 39 muertos (ver abajo) |
| `docs:index` / `docs:check` | `1edf50dc` | PASÓ (541 specs) |
| `sdd:check` | `1edf50dc` | PASÓ (sin números repetidos) |
| `governance:check` | `1edf50dc` | PASÓ (28 políticas, cápsula vigente) |
| `components:check` | `1edf50dc` | PASÓ (CMP-01 válido) |
| `/ui-check` (advisory) | `e4df7c28` → ajustes en `2ebb277b` | Hecho; hallazgos corregidos (abajo) |
| `pnpm verify` | `b19e41f7` | FALLÓ (exit 1): 1 rojo de 11391 en `test`, el inventario SDD-0357, corregido después (ver «Corrida de verify»). 15 pasos PASARON y 1 quedó SKIP (`migrations-applied`, sin migración) |
| `invoice-read-boundary.test.mjs` después de corregirlo | árbol en la cabeza final | PASÓ (4/4) |
| `knowledge:status` | `1edf50dc` | NO DISPONIBLE como medida útil: el worktree no tiene el grafo derivado (estructural INVALID con 3563 faltantes; semántico INVALID). Regenerarlo es una corrida pesada y Graphify lo publica el Director desde main |
| `knowledge:visual:check` | `1edf50dc` | NO DISPONIBLE: `ARCHIFY_RUNTIME_MISSING` (falta el paquete Archify 2.16.0 en el worktree; descargarlo no estaba en el encargo) |
| Prueba en navegador real | — | NO EJECUTADA: queda para el smoke de Sam |
| Contrato SQL en PGlite | — | NO EJECUTADO, no aplica: no hay migración |

### Mutantes

Cada mutante cambia un fragmento que aparece una sola vez, corre solo su suite con Vitest (un hilo),
restaura el archivo y verifica el sha256. Cuenta como muerto solo con exit ≠ 0 y la línea `Tests … failed`.

- **Orden:** facturas antes que gastos · borrador antes que módulo · `siguiente` = último · sin
  ordenar por código. Todos muertos.
- **Regla 2:** ofrecer pasos con bloqueos · bloqueo fijo desde 2 · guarda nueva abierta. Muertos.
- **B1:** ignorar el asiento vivo · el asiento desconocido como libre · la lectura fallida como «sin
  asientos» · el asiento anulado o borrado contado como vivo. Muertos.
- **Regla 1:** lista con sobrantes · repetidos · facturas sin el filtro `anulada` · RPC caída como no
  encontrado. Muertos.
  - El de sobrantes sobrevivió al primer pase. No era equivalente: faltaba una prueba, que se agregó
    en `deaebf63`.
- **Cobros:** factura con pagado anulable · pagado ilegible como cero · monto nulo como cero · CxP de
  estado desconocido · TMS completada sin bloquear · motivo opcional al anular factura. Muertos.
- **Solo admin:** sin candado al ejecutar · sin candado al leer · capability de Contabilidad. Muertos.
- **Servidor:** ejecuta un paso viejo · ejecuta con el plan bloqueado · sin validar motivo · devuelve
  el plan viejo · referencia del gasto inestable. Muertos.
- **UI:** todos los pasos habilitados · motivo no obligatorio · el diálogo queda con el plan cambiado ·
  sin rastro de lo hecho · no pinta el plan nuevo · pestaña sin `noopener`. Muertos.
- **Lista y Tracking:** la lista ofrece el asistente siempre · Tracking marca `bloqueado` también si
  ya estaba eliminado · ofrece el asistente sin la marca. Muertos.

### /ui-check (advisory)

1. ⭐ [alta] `AsistenteBorrado.tsx`, el bloqueo: el borde izquierdo de acento es AI slop según la
   rúbrica. **Corregido**: borde y fondo de peligro completos.
2. [media] Espaciados fuera de la escala de 4 px. **Corregido** con `var(--s-*)`. El cuerpo y el pie
   conservan las medidas del `DrawerShell` (`18px 22px`, `14px 22px`, `gap: 10`) para alinear con él.
3. [media] El botón «Ver los pasos» en `xs` quedaba bajo los 32 px. **Corregido** a `sm`.

Bien desde el inicio: solo tokens y cero hex; `DrawerShell`, `ConfirmDialog` y `Badge` del sistema;
estados de carga, error, vacío y éxito; foco en Cancelar; tuteo; sin emojis. Veredicto: OK para commit.

### Corrida de verify

Una sola corrida, en el turno que dio el Director (tercero, con la máquina libre y Docker encendido).
Fue sobre `b19e41f7`, de 01:53Z a 02:22Z (29 min), y salió con **exit 1**.

| Paso | Resultado |
|---|---|
| harness · lint · rsc-boundary · typecheck · edge-functions | PASÓ |
| test | **FALLÓ**: 1 de 11391 (11389 pasaron, 1 skip), igual en el reintento. Fue `scripts/__tests__/invoice-read-boundary.test.mjs` (SDD-0357): el lector del asistente es un caller nuevo de `invoices` y el inventario está congelado |
| docs:check · numbering · feature-constants · components:check · governance:check | PASÓ |
| migrations-applied | SKIP: el worktree no tiene `.env.local`. Esta PR no trae migración, así que no hay nada que medir en el ledger |
| pending-migration-symbols | PASÓ (0 rojo, 0 amarillo) |
| sql-tests | PASÓ (242 contratos, rollback total) |
| schema-rebuild | PASÓ (485 migraciones sobre `postgres:17`, aislamiento multi-tenant verificado) |
| e2e | PASÓ con aviso: 177 pasaron, 1 flaky (`auth.spec.ts:81`), 20 skip; exit ≠ 0 por el worker de WebKit en Windows |
| build | PASÓ |

**Corrección después de la corrida.** `invoice-read-boundary` agrega el caller con la revisión que
pide el contrato: candado `delete_shipments` al tope de las dos acciones, cliente de sesión bajo
`invoices_accounting_select` y lectura que no decide la autoridad. Pasa de 18 a 19 archivos y de 42
a 43 lecturas. La prueba sola PASÓ (4/4) y el rojo de la corrida es su control. **No se repitió
`verify` completo** (una corrida por turno): la próxima, sobre la cabeza final, pide turno al
Director.

## COMMITS

- `e4df7c28` feat(studio): SDD-0560 — asistente de borrado de embarques (código y pruebas).
- `deaebf63` test(studio): SDD-0560 — una lista con repetida y sobrante no cuadra (mutante vivo).
- `2ebb277b` fix(studio): SDD-0560 — ajustes del /ui-check del asistente de borrado.
- `1edf50dc` docs(sdd): SDD-0560 — asistente de borrado de embarques (spec e índice).
- `b19e41f7` docs(sdd): la evidencia de mutantes vive en el handoff (SHA de la corrida de verify).
- El commit del inventario SDD-0357 y el que contiene este documento: hashes finales en la PR.

## PR / BRANCH

- Rama `worktree-agent-a0dfdfa547efd84ef` → base `main`, PR en borrador (URL en el informe final).
- Worktree:
  `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\agent-a0dfdfa547efd84ef`.

## PENDIENTES DE ESTA TAREA

- **Una corrida completa de `pnpm verify` sobre la cabeza final**, con turno del Director. La única
  corrida dio un solo rojo, ya corregido y probado aparte. El CI de la PR también corre la suite
  completa.
- Revisión e integración del Director (no hay migración: el merge publica solo).
- **Smoke de Sam** después de publicar (abajo).
- Pasar la SDD a `done` después del smoke.

### Smoke para Sam (después de publicar)

Como admin, con un embarque de prueba que tenga una factura emitida:

1. En `/studio/embarques`, la fila del embarque dice por qué no se puede eliminar y ofrece «Ver los
   pasos».
2. Al abrirlo: «Eliminar S-… paso a paso», «Faltan 2 pasos». El paso 1 es «Anular la factura F-…»,
   con su botón; el paso 2, «Eliminar el embarque S-…», dice «Se habilita cuando termines el paso
   anterior».
3. «Anular factura…» abre «¿Anular la factura F-…?» y pide motivo. Escribe «Embarque de prueba» y
   pulsa «Anular factura». Debe aparecer «Listo: Factura F-… anulada.», «Ya hiciste» y el plan con 1
   paso.
4. «Eliminar embarque…» pide motivo y pulsa «Eliminar embarque». Sale un aviso, se cierra el panel y
   el embarque ya no está en la lista.
5. En Facturación, F-… aparece «Anulada». En Tracking, el embarque ya no aparece.
6. En Tracking, con otro embarque bloqueado: «Eliminar envío», código y motivo, «Confirmar
   eliminación». Sale el motivo del bloqueo y el botón «Ver los pasos para eliminarlo», que abre el
   mismo panel.
7. Con un usuario que no es admin: no hay casillas ni «Ver los pasos».

Si una factura tiene su asiento de venta vivo, el panel dice que no se puede eliminar por B1. Es lo
esperado, no un fallo.

## FUERA DE ALCANCE DETECTADO

- **Recepciones del Almacén CN en el asistente**: ninguna de sus guardas tiene una acción del
  asistente y la UI es bilingüe. Se puede hacer en otra SDD con el mismo `calcularPlan`.
- **Acciones de módulo sin gobierno:**
  - `cancelRouteAction` (`tms/actions.ts:341`) no audita ni comprueba el estado: puede cancelar una
    ruta `completado`;
  - `removeConsolidationItem` (`naviera/actions.ts:927`) hace un DELETE físico sin motivo ni evento;
  - `changeReceiptStatusAction` (`cn/actions.ts:426`) no escribe en `entity_audit_log`;
  - `softDeleteClaimAction` (`reclamos/actions.ts:321`) elimina un reclamo (evidencia) sin motivo ni
    evento.

  Gobernarlas permitiría sumarlas al asistente.
- **Sin correlación entre los pasos de un asistente**: las RPC de los módulos no aceptan un
  `correlationId` de fuera.
- **`voidInvoice` anula una factura `parcial` con recibos**, y `voidInvoice`/`voidBill` devuelven el
  mensaje crudo de la base al operador. Es del dominio de «Contabilidad» (ítem 2.5) y de Facturación.
- **B1 y B3** siguen en manos de «Contabilidad». Cuando se integre el reverso al anular (2.5), la SDD
  de esa reparación debe revisar el bloqueo `asiento_vivo` de `calcularPlan`.

## Impacto documental y conocimiento

- Documento canónico nuevo: la SDD-0560. No cambian reglas estables (AGENTS, project-rules,
  políticas).
- Graphify estructural y semántico: NO EJECUTADO en el worktree (no hay grafo derivado). Pendiente
  para el Director al publicar desde main: el nodo de la spec 0560 y los archivos nuevos de
  `lib/studio/borrado/`.
- Archify y la vista previa de Obsidian: NO DISPONIBLE (falta el paquete Archify en el worktree).
  Nada se publicó en la bóveda.

## HANDOFF AL DIRECTOR

- **Siguiente acción:** revisar la PR en borrador, en especial la tabla de guardas, la frontera B1 y la
  decisión de que TMS, Naviera y Almacén CN vayan «a su módulo». Después, integrar.
- **Sin migración**: nada que aplicar. El merge publica solo (unos 5 minutos).
- **Cambios compartidos:**
  - `deleteShipment` devuelve además `bloqueado?: true`;
  - el total de `rbac-actions-guard` pasa de 433 a 435;
  - el inventario de `invoice-read-boundary` (SDD-0357) pasa de 18 a 19 archivos y de 42 a 43
    lecturas; choca si otra PR toca ese mapa, como la de «Contabilidad»;
  - `embarques/actions.ts` ahora importa las acciones de Facturación, Gastos y Tesorería.
- **Dependencia con «Contabilidad»**: el asistente no anula una factura con asiento vivo. Si la PR #277
  u otra cambia `voidInvoice` o el reverso, revisar la regla `asiento_vivo`.
- **Decisiones para Sam:**
  1. Si gobernar la cancelación de rutas TMS, la salida de una consolidación y la vuelta a pendiente
     de una recepción CN, para que el asistente las haga sin salir de la pantalla. Lleva migración.
  2. Si quiere el asistente también en el Almacén CN.
  3. Qué hacer con un demo que tenga reclamo, aduana, costeo o Financiero China: hoy no se puede
     eliminar por ninguna vía.
- **Sesiones consumidoras:** ninguna. El claim se libera al terminar.

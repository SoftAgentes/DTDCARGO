---
sdd: "0560"
title: "Asistente de borrado de embarques: pasos en orden para poder eliminar"
status: in-progress
author: "Claude"
created: 2026-10-18
updated: 2026-10-19
supersedes: null
superseded_by: null
related: ["0522", "0465", "0243", "0294", "0496"]
confidencialidad: interno
---

# SDD-0560 · Asistente de borrado de embarques

> Cuando un embarque no se puede eliminar (SDD-0522), Embarques y Tracking ofrecen «Ver los pasos».
> El panel muestra el plan en orden: primero lo que depende del embarque y al final el embarque. Se
> hace un paso a la vez, cada uno con su confirmación, y cada paso usa la acción gobernada de su
> módulo. Lo que no tiene una acción segura se explica y no se ofrece. **Sin migración.**

## El pedido

Sam, literal (2026-10-18):

> «Me gustaría que cuando se intente borrar algo, el sistema te guíe con lo que se tiene que eliminar
> para no causar problemas en la base de datos: por ejemplo, la factura y todo lo que esté atado a ese
> registro. Lo ideal sería que me diga paso a paso: "Primero debes eliminar esto. ¿Deseas
> eliminarlo?" y que yo pueda confirmar que sí. Luego que me pida confirmar lo segundo… La idea es que
> sea un flujo muy intuitivo, que ate bien las transacciones y que explique con claridad qué se
> requiere para proceder.»

Aprobó la propuesta del Director: «sí, son todos demos, arranca la tarea así».

## Contexto (main `77035907`)

- La 0522 (migración `0476`) ya elimina embarques con motivo, P2/R3 y solo admin, y bloquea si hay
  algo vivo atado. El motivo sale de `lib/studio/borrado/reglas.ts` (`shipmentDeleteBlockReason`) y
  termina con «Primero anula, elimina o desvincula eso en su módulo.». **Sam queda trabado**: tiene
  que ir módulo por módulo sin saber en qué orden ni con qué acción.
- `shipment_delete_blockers(uuid[])` (0476) devuelve solo **conteos** por guarda, no ids ni códigos.
  La misma función interna la usa el borrado.
- Las acciones de cada módulo (todas en main):

  | Módulo | Acción | Gobernada (estado + auditoría con motivo en la misma transacción) |
  |---|---|---|
  | Facturación | `voidInvoice` (`facturacion/actions.ts:661`) → `void_invoice_with_audit_reason` (0294) | Sí: `invoice_voided` con el motivo. Rechaza `pagada` (`:685`). **No revierte el asiento** (B1) |
  | Facturación | `softDeleteInvoice` (`:769`), solo `borrador` (SDD-0465) | Sí: `invoice_deleted` (0290 `:193`), con el motivo por defecto del flujo; el módulo no pide motivo (R2) |
  | Gastos | `voidExpenseAction` (`gastos/actions.ts:327`) → `void_expense_governed` (0340 `:100`) | Sí: `expense_voided`; anula el asiento **en la misma transacción** |
  | Tesorería | `voidBill` (`tesoreria/actions.ts:196`) → `voidBillFor` (`treasury-actions.ts:206`) → `void_supplier_bill_with_audit_reason` | Sí: `bill_voided` (0290 `:291`) con el motivo; sólo sin pagos. El asiento de causación se anula después, con mejor esfuerzo |
  | TMS | `cancelRouteAction` (`tms/actions.ts:341`) | **No**: UPDATE por RLS sin evento de auditoría ni condición de estado; libera camión y chofer aparte |
  | Naviera | `removeConsolidationItem` (`naviera/actions.ts:927`) | **No**: DELETE físico de la pieza, sin motivo ni evento |
  | Almacén CN | `changeReceiptStatusAction` (`cn/actions.ts:426`), volver a pendiente | **No**: evento de timeline, sin `entity_audit_log`; efectos de alerta aparte |
  | Reclamos | `softDeleteClaimAction` (`reclamos/actions.ts:321`) | No, y además el reclamo es evidencia |
  | Costing, Aduana, Financiero China | ninguna acción para retirar lo que cuenta la guarda | — |

## Decisión

### Sin migración

El plan se arma con lo que ya existe: los conteos de la 0476 deciden **qué** bloquea, y el servidor
lee el detalle (código, estado, cobros, asiento) de cada dependencia contada. No hace falta una RPC
nueva y nada espera aplicación. El número de migración que reservó el Director (0493) **no se usa**.

**Las reglas no se duplican.** La lista de cada dependencia usa el mismo predicado que su guarda, y
`calcularPlan` exige que cuadre **exacto** con el conteo de la base (mismo número, ids sin repetir).
Si un predicado se desvía de la 0476, la lista no cuadra y el plan se bloquea: un desvío cierra,
nunca abre.

### Tabla de guardas → paso o bloqueo

`RESOLUCION_DE_GUARDA` (`lib/studio/borrado/asistente.ts`) es esta tabla; la prueba exige que
clasifique todas las guardas de `BLOQUEOS_EMBARQUE`. Una guarda sin manejador bloquea por
construcción (`GUARDAS_CON_PASO`), aunque falte en la tabla.

| Guarda (0476) | Clasificación | Paso o explicación |
|---|---|---|
| `invoices` emitida o vencida, sin cobros y sin asiento vivo | **asistente** | «Anular la factura F-…»: `voidInvoice`, P3/R3, motivo |
| `invoices` en borrador, sin asiento vivo | **asistente** | «Eliminar la factura en borrador F-…»: `softDeleteInvoice`, P2/R2, sin motivo (como en Facturación) |
| `invoices` con cobros (`paid_amount` ≠ 0, `parcial` o `pagada`) | **su módulo** | «Anular los cobros de la factura F-…» en Cobranzas; después el asistente ofrece anularla |
| `invoices` con asiento vivo | **bloquea** (hasta B1) | Ver «Frontera contable» |
| `invoices` en un estado desconocido | **bloquea** | Revisarla en Facturación |
| `expenses` | **asistente** | «Anular el gasto EXP-…»: `voidExpenseAction`, P3/R3, motivo; el asiento se anula en la misma transacción |
| `supplier_bills` pendiente y sin pagos | **asistente** | «Anular la cuenta por pagar CXP-…»: `voidBill`, P3/R3, motivo |
| `supplier_bills` con pagos | **su módulo** | «Anular los pagos…» en Tesorería |
| `tms_routes` sin completar | **su módulo** | «Cancelar la ruta R-…» en TMS. No va en el asistente porque la acción no audita ni comprueba el estado |
| `tms_routes` completada | **bloquea** | La última milla ocurrió y no se deshace |
| `naviera_consolidations` | **su módulo** | «Sacar el embarque de la consolidación DTD-CONSOL-…» en Naviera (la acción borra la pieza sin auditoría) |
| `cn_receipts` | **su módulo** | «Sacar las recepciones WR-… del contenedor» en Almacén CN (devolver a pendiente) |
| `purchases` | **su módulo** | «Cancelar o desvincular la compra DTD-…» en Órdenes de compra |
| `delivered` | **bloquea siempre** | La entrega es un hecho cumplido |
| `client_claims` | **bloquea siempre** | Un reclamo es evidencia: el asistente no lo anula ni lo elimina |
| `customs_filings` | **bloquea siempre** | Aduana no tiene acción para retirar un expediente |
| `shipment_costs` | **bloquea siempre** | Costing no tiene acción para retirar un costeo |
| `china_finance` | **bloquea siempre** | Hechos financieros sin acción para retirarlos |
| `otro` (clave desconocida) | **bloquea siempre** | El asistente no ofrece nada mientras no sepa qué es |
| `already_deleted` | sin plan | «Este embarque ya estaba eliminado» |

**Regla de no ofrecer nada.** Si hay **cualquier** bloqueo, el plan queda `bloqueado` y no ofrece
ningún paso, tampoco los que se podrían hacer. Anular una factura de un embarque que igual no se va a
poder eliminar solo dejaría documentos anulados sin beneficio.

### El orden de los pasos

1. Lo que se resuelve en su módulo, en orden fijo: recepciones CN, consolidaciones, compras, rutas
   TMS, cobros de facturas y pagos de CxP.
2. Lo reversible (P2): eliminar borradores de factura.
3. Lo que no se deshace (P3): anular gastos, CxP y facturas, en ese orden. La factura es lo último
   porque es el documento fiscal.
4. Eliminar el embarque.

Dentro de cada grupo, por código. El plan no depende del orden en que llegaron las lecturas. Así el
asistente nunca anula algo mientras quede otra cosa pendiente que podría no resolverse.

### Frontera contable (B1, sesión «Contabilidad»)

Anular una factura **no revierte su asiento de venta**: es el hallazgo B1 de
`docs/audits/2026-10-18-contabilidad-diagnostico-y-plan.md`, y su reparación es el ítem 2.5 de ese
plan, a cargo de la sesión «Contabilidad». Para no pisar ese trabajo:

- **Asiento vivo** = una fila de `journal_entries` con `invoice_id` = la factura, `status <> 'anulado'`
  y `deleted_at is null` (incluye `borrador`).
- Si una factura tiene asiento vivo, el plan se **bloquea** y explica: «Anularla hoy no revierte ese
  asiento en Contabilidad (hallazgo B1). El asistente no la anula: ese paso se hace en Facturación
  cuando esté integrada la reparación del reverso contable».
- Si la lectura de asientos falla, no se sabe: también bloquea (`asiento_sin_comprobar`).
- Una factura con cobros no la anula el asistente (va a Cobranzas). Eso tampoco se pisa con el ítem
  2.5 («no se anula una factura con recibos vivos»).
- Según la radiografía del Director (2026-10-18), ninguna factura de producción tiene asiento vivo,
  así que hoy los demos se pueden limpiar. Es una medición del Director, **NO VERIFICADA** por esta
  tarea, que no lee producción.
- Cuando 2.5 se integre (reverso en la misma transacción), esta regla se revisa en su SDD: basta con
  quitar el bloqueo de `asiento_vivo`, que tiene sus pruebas y su mutante.

La CxP sí revierte su asiento (con mejor esfuerzo, después del commit: B3). El asistente la anula con
la acción de Tesorería sin agregar reglas contables; el riesgo B3 es de esa acción y de su
reparación.

### Contrato de cada paso (MP-01 · AUD-01)

| Paso | P / R | Motivo | Acción | Evento (en la base, misma transacción) |
|---|---|---|---|---|
| Eliminar borrador de factura | P2 / R2 | No (el módulo no lo pide) | `softDeleteInvoice` | `invoice_deleted` (D2, motivo del flujo) |
| Anular factura | P3 / R3 | Sí, 4 a 1000 | `voidInvoice` | `invoice_voided` con el motivo |
| Anular gasto | P3 / R3 | Sí | `voidExpenseAction`, referencia `asistente-borrado:<id>` | `expense_voided` + asiento anulado |
| Anular CxP | P3 / R3 | Sí | `voidBill` | `bill_voided` con el motivo |
| Eliminar embarque | P2 (excepción de la 0522) / R3 | Sí | `soft_delete_shipments_with_audit_reason` (0476) | `shipment_deleted` |

Cada acción repite su propio candado y su propia condición de estado. El asistente no agrega
escrituras propias ni un borrado genérico.

**Límite conocido de la auditoría.** Cada paso deja su evento, pero no hay una correlación que una
los pasos de un mismo asistente: las RPC de los módulos no aceptan un `correlationId` de fuera. Unir
los pasos pediría una migración por módulo. Queda en FUERA DE ALCANCE.

### Permiso

Solo admin: `capabilityDenial(…, "delete_shipments")` al tope de las dos acciones nuevas, antes de
leer nada. Además, la RPC de la 0476 exige admin y cada acción de módulo su candado: `invoices` y
`treasury` (admin pasa), `void_expense` y, en la base, `accounting`/`admin` (0340).

### Dos personas a la vez

`ejecutarPasoDeBorradoAction(shipmentId, clave, motivo)`:

1. Recalcula el plan en el servidor (`leerPlanDeBorrado`).
2. Ejecuta **solo** si el plan está `en_curso`, su `siguiente.clave` es la pedida y el paso es del
   asistente. Si no, no ejecuta nada y devuelve el plan nuevo con «El plan cambió mientras lo
   revisabas…».
3. Valida el motivo si el paso lo pide.
4. Ejecuta la acción del módulo, que vuelve a validar el estado en su UPDATE o RPC.
5. Devuelve el plan recalculado (o `eliminado: true` si fue el embarque).

Queda una ventana entre el paso 1 y la escritura del módulo. La cierran las condiciones de cada
acción (`status <> 'pagada'`, `paid_amount = 0`, `FOR UPDATE` de la 0476 y de la 0340). Ver Riesgos.

### La UI

- **Componente:** `app/studio/(app)/embarques/_components/AsistenteBorrado.tsx`, sobre `DrawerShell`.
  Cada paso se confirma con `ConfirmDialog` (canónico). No se crean primitivas.
- **Entradas:**
  - En `/studio/embarques`, junto al motivo de la fila bloqueada, va «Ver los pasos» (nombre
    accesible «Ver los pasos para eliminar S-…»). No aparece si no se pudo leer la fila ni si el
    embarque ya estaba eliminado.
  - En Tracking, si «Confirmar eliminación» vuelve bloqueado por dependencias (`bloqueado: true` de
    `deleteShipment`), el modal ofrece «Ver los pasos para eliminarlo».
- **Textos y estados:**

  | Estado | Lo que se ve |
  |---|---|
  | Cargando | `role="status"`: «Revisando qué depende del embarque…»; botones deshabilitados (`aria-busy`) |
  | En curso | «Faltan N pasos» y «Se hacen en orden…». Lista numerada; el paso actual tiene `aria-current="step"` y su botón; los demás dicen «Se habilita cuando termines el paso anterior.» |
  | Paso del asistente | Botón `danger` («Anular factura…»). El diálogo pregunta «¿Anular la factura F-…?», explica qué es y «Qué pasa:», pide «Motivo (obligatorio, sin datos personales)» si es R3, y el foco inicial va en Cancelar |
  | Paso de otro módulo | Enlace «Abrir TMS», que abre otra pestaña (lo anuncia y lleva `rel="noopener noreferrer"`, LNK-01), y «Ya lo hice: revisar de nuevo» |
  | Último paso | «Ya no queda nada que lo bloquee · Solo falta eliminar el embarque.» y «Eliminar embarque…» |
  | Éxito de un paso | `role="status"`: «Listo: Factura F-… anulada.», la lista «Ya hiciste» y el plan nuevo |
  | Éxito final | Un solo aviso (`shipments:deleted`, AVS-01) y se cierra. Desde Tracking vuelve al listado |
  | Bloqueado | «No se puede eliminar por ahora», cada bloqueo con su porqué y su enlace de consulta, y «no tendría sentido anular una factura si el embarque igual no se va a poder eliminar». Ningún botón de anular ni eliminar |
  | Plan cambiado | El diálogo se cierra, `role="alert"` con el mensaje y el plan nuevo |
  | Error del módulo | El diálogo queda abierto con el error y se puede reintentar |
  | Sin respuesta | En el diálogo: «No se pudo confirmar el paso. Vuelve a revisar el plan para ver cómo quedó.» Nada se da por hecho |
  | Sin plan (lectura caída, no encontrado, ya eliminado) | El mensaje y «Volver a revisar» |

### Contrato de acción (BTN-01 §8)

| Campo | Paso del asistente | «Ver los pasos» |
|---|---|---|
| `actionKey` | `shipments.delete_wizard.<accion>` | `shipments.delete_wizard.open` |
| `verb` / `outcome` | El de la acción del módulo: Anular o Eliminar, con el objeto | Abre el panel; no muta |
| `role` / `risk` | destructive / critical (R3) o important (R2, borrador) | secondary / routine |
| `permanence` / `friction` | Ver «Contrato de cada paso» | not-applicable (no muta) |
| `permission` | `delete_shipments` + el candado del módulo | `delete_shipments` (la casilla y el botón solo existen con ella) |
| `preconditions` | Ser el siguiente del plan recalculado; motivo de 4 a 1000 si es R3 | Fila bloqueada, leída y no eliminada |
| `buttonType` | `button` (abre) y `submit` (confirma en el diálogo) | `button` |
| `idleLabel` / `loadingLabel` / `successLabel` | «Anular factura…» / el de `ConfirmDialog` / «Listo: …» | «Ver los pasos» / — / — |
| `errorRecovery` | Error en el diálogo y reintento; si el plan cambió, plan nuevo con alerta | — |
| `audit` | `{ required: true }`: el evento del módulo (tabla de arriba) | `{ required: false }`: no muta |
| `afterSuccess` | `refresh-context` (plan nuevo); el último paso `close` + aviso | — |
| `undo` | `{ available: false }` | — |

## Evidencia

Todo con dobles. Cero lecturas o escrituras en producción y en la base de prueba.

| Suite | Casos |
|---|---|
| `lib/studio/borrado/__tests__/asistente.test.ts` | 45 |
| `lib/studio/borrado/__tests__/asistente-servidor.test.ts` | 20 |
| `app/studio/(app)/embarques/__tests__/asistente-borrado-action.test.ts` | 26 |
| `app/studio/(app)/embarques/_components/__tests__/AsistenteBorrado.test.tsx` | 13 |
| `EmbarquesClient.borrado.test.tsx` (+4) · `FooterActions.borrado.test.tsx` (+2) · `delete-shipment-gate.test.ts` (+1, 2 ajustadas) | 17 · 4 · 21 |

- **El lector** se prueba con `listados-double.ts`, que **aplica** `eq/neq/is/in`, devuelve copias y
  lanza si un filtro va antes de `select()`. La fixture es infeliz: junto a cada dependencia viva está
  la que la guarda no cuenta (factura anulada o eliminada, asiento anulado o borrado, gasto anulado,
  CxP anulada, ruta cancelada, consolidación y recepción eliminadas, compra cancelada).
  - **Control del doble:** con todo «vivo» (`todoVivo`) las listas no cuadran y el plan se bloquea.
- **Control verde** de las 7 suites objetivo: 145 de 145.
- **Control rojo y mutantes** (lista y método en el handoff): 39 mutantes y **39 muertos**, cada uno con su
  suite. El primer pase dejó 1 vivo (`length !== n` → `length < n`). No era equivalente: faltaba la
  prueba «repetida que además sobra», que se agregó (`deaebf63`). Los 7 mutantes de la UI y la lista
  se repitieron después de los ajustes del `/ui-check` (`2ebb277b`): siguen muertos. Cubren:
  - **orden:** facturas antes que gastos, P2 antes que módulo, `siguiente` = último, sin ordenar por
    código;
  - **regla 2:** ofrecer pasos con bloqueos, bloqueo fijo desde 2, guarda nueva abierta;
  - **B1:** ignorar el asiento vivo, el asiento desconocido como libre, la lectura fallida como «sin
    asientos», el asiento anulado o borrado como vivo;
  - **regla 1:** sobrantes, repetidos, facturas sin el filtro `anulada`, RPC caída como no encontrado;
  - **cobros:** factura con pagado, pagado ilegible como cero, monto nulo como cero, CxP de estado
    desconocido;
  - TMS completada y motivo opcional;
  - **solo admin:** sin candado al ejecutar o al leer, capability de Contabilidad;
  - **servidor:** paso viejo, plan bloqueado, sin validar motivo, plan viejo devuelto, referencia
    inestable del gasto;
  - **UI:** todos los pasos habilitados, motivo opcional, el diálogo se queda con el plan cambiado,
    sin rastro, sin plan nuevo, pestaña sin `noopener`; la lista que ofrece siempre; Tracking con
    «ya eliminado» o sin la marca.
- **Inventario RBAC:** `rbac-actions-guard` sube de 433 a 435 acciones. Las dos nuevas pasan el
  veredicto por acción, sin entrar en ninguna lista.
- **Frontera de lectura de facturas (SDD-0357):** el lector es un caller nuevo de `invoices`. Lo
  detectó `pnpm verify` y entró al inventario con la revisión de su candado (`delete_shipments`) y de
  su tenant (cliente de sesión bajo `invoices_accounting_select`).
- **`pnpm verify`** (una corrida, `b19e41f7`, 29 min): 16 de 17 pasos medidos.
  - PASARON 15: harness, lint, rsc-boundary, typecheck, edge-functions, docs:check, numbering,
    feature-constants, components, governance, pending-migration-symbols, sql-tests (242 contratos),
    schema-rebuild (485 migraciones), e2e con aviso (177 pasaron, 1 flaky, el worker de WebKit) y build.
  - FALLÓ `test`: 1 de 11391, ese inventario. Se corrigió después y la prueba pasa sola.
  - SKIP `migrations-applied`: sin `.env.local` en el worktree; esta PR no trae migración.

## Datos personales (`revisar-datos-ve`)

No es asesoría legal.

- **CORRECTO.** No agrega columnas, tablas, buckets ni tratamientos. Las lecturas traen solo ids,
  códigos, estados, montos cobrados y presencia de asiento; ningún nombre, Shipping Mark ni dirección.
  El panel muestra solo códigos.
- **CORRECTO.** Cada motivo va a la acción del módulo, con la misma etiqueta «sin datos personales»
  de la 0522. No se copia a otro lado.
- **ENCONTRADO, igual que en la 0522.** El motivo es texto libre y la base no comprueba que no lleve
  datos personales.
- **NO VERIFICABLE:** el contenido real de los demos de Sam.

## Gobernanza

Políticas abiertas desde `docs/governance/AGENT-BRIEF.md` («acción, borrado, permanencia,
auditoría» y «componente»): SGE-00, MP-01, BTN-01, AUD-01, CMP-01 y LNK-01.

| Principio / política | Clasificación | Evidencia |
|---|---|---|
| SGE-00.01 predecible · BTN-01 §3 | cumplimiento | Cada paso conserva el verbo de su módulo: «Anular» para P3 y «Eliminar» para P2 (borrador y embarque) |
| SGE-00.02 pérdida de trabajo | cumplimiento | Con error el diálogo queda abierto con el motivo; cerrar el panel no muta nada |
| SGE-00.03 riesgo y fricción | cumplimiento | R3 con motivo para P3 y el embarque; R2 para el borrador, como Facturación (SDD-0465) |
| SGE-00.04 auditoría · AUD-01 | cumplimiento, con límite | Cada paso deja su evento en la base y en la misma transacción. Límite: no hay una correlación entre pasos |
| SGE-00.05 permisos y tenant | cumplimiento | Capability al tope (26 pruebas de la acción, mutantes `admin-*`); RPC admin de la 0476; candados de cada módulo; RLS de sesión |
| SGE-00.06 prevenir errores | cumplimiento | El plan solo ofrece lo que se puede hacer ahora y en orden; lo imposible se explica antes de intentar |
| SGE-00.07 estado verdadero | cumplimiento | Solo un resultado durable cuenta como hecho; una respuesta perdida no se da por hecha; el plan siempre viene del servidor |
| SGE-00.08 pasos | cumplimiento | Antes: Sam iba módulo por módulo sin guía. Ahora: un panel con el orden y un clic más una confirmación por paso |
| SGE-00.09 patrón · CMP-01 | cumplimiento | `DrawerShell` + `ConfirmDialog` (canónico) + `Badge`; reusa las acciones de los módulos y la regla de la 0476; sin primitivas nuevas |
| SGE-00.10 accesibilidad | cumplimiento del componente; verificación visual NO EJECUTADA | `aria-current="step"`, encabezados h2-h4, `role="status"`/`alert`, foco en Cancelar, nombre accesible con el código, pestaña nueva anunciada, botones de 32 px. Falta probar en un navegador real (smoke de Sam) |
| SGE-00.11 lenguaje | cumplimiento | Dice qué es, qué pasa y qué falta; tuteo sin voseo (pruebas de texto) |
| SGE-00.12 IA | no aplica | Sin IA |
| MP-01 | cumplimiento | Contrato por paso (tabla); P3 para lo emitido o asentado; P2 solo para borradores y el embarque (la excepción de la 0522) |
| BTN-01 | cumplimiento | Contrato de acción arriba; destructiva en `danger`; una acción por paso; lo bloqueado se explica, no se esconde |
| LNK-01 | no aplica formalmente (adopción en el sitio público); se sigue su contrato | Los enlaces de consulta a otro módulo abren otra pestaña, anunciada y con `noopener` |
| AUD-02 | no aplica | No cambia quién consulta, conserva ni exporta eventos |

## Allowlist exacta

- `lib/studio/borrado/asistente.ts` y `lib/studio/borrado/asistente-servidor.ts` (nuevos) y sus
  pruebas `lib/studio/borrado/__tests__/asistente.test.ts` y `asistente-servidor.test.ts`
- `app/studio/(app)/embarques/actions.ts` (dos acciones nuevas y su cabecera) y
  `app/studio/(app)/embarques/__tests__/asistente-borrado-action.test.ts` (nueva)
- `app/studio/(app)/embarques/_components/AsistenteBorrado.tsx` (nuevo) y
  `_components/__tests__/AsistenteBorrado.test.tsx` (nueva)
- `app/studio/(app)/embarques/_components/EmbarquesClient.tsx` («Ver los pasos» y el montaje) y
  `_components/__tests__/EmbarquesClient.borrado.test.tsx` (mock y bloque nuevo)
- `app/studio/(app)/tracking/[id]/actions.ts` (solo `deleteShipment`: la marca `bloqueado`)
- `app/studio/(app)/tracking/[id]/_components/FooterActions.tsx` y
  `_components/__tests__/FooterActions.borrado.test.tsx`
- `app/studio/(app)/tracking/__tests__/delete-shipment-gate.test.ts` (dos aserciones exactas con la
  marca y un caso nuevo)
- `lib/studio/rbac-actions-guard.test.ts` (total 433 → 435, con su comentario)
- `scripts/__tests__/invoice-read-boundary.test.mjs` (SDD-0357: el caller nuevo
  `lib/studio/borrado/asistente-servidor.ts`, con la revisión de su candado y su tenant; 18 → 19
  archivos, 42 → 43 lecturas)
- esta spec, `docs/specs/README.md` (generado) y `.agents/handoffs/0560-asistente-borrado-embarques.md`

## Aceptación

- [x] 1. Un embarque bloqueado ofrece «Ver los pasos» en Embarques y en Tracking, solo a admin.
- [x] 2. El plan sale del servidor con las guardas de la 0476, sin duplicar reglas: la lista que no
      cuadra con el conteo bloquea.
- [x] 3. Orden: su módulo → borrador → gasto, CxP y factura → embarque; un paso a la vez, también en el
      servidor.
- [x] 4. Cada paso del asistente usa la acción de su módulo, con confirmación y motivo si es R3, y deja
      el evento de auditoría de ese módulo.
- [x] 5. Lo que no tiene acción segura (entregado, reclamo, aduana, costeo, Financiero China,
      desconocido) se explica y no se ofrece nada.
- [x] 6. Una factura con asiento vivo no se anula (B1): el plan se bloquea con la explicación.
- [x] 7. Si el plan cambió, no se ejecuta el paso viejo y se muestra el plan nuevo.
- [x] 8. Pruebas de la regla, del lector con doble que filtra, de las acciones y de la UI; control
      verde, control rojo y 39 de 39 mutantes muertos.
- [x] 9. `/ui-check` advisory hecho y sus ajustes aplicados (`2ebb277b`).
- [ ] 10. `pnpm verify` completo en verde. La corrida única (`b19e41f7`) dio un solo rojo, el
      inventario de la SDD-0357, ya corregido y probado aparte. Falta una corrida completa sobre la
      cabeza final; el turno lo da el Director.
- [ ] 11. Smoke de Sam en producción después de integrar (guion en el handoff).

## Riesgos

- **Ventana entre el recálculo y la escritura.** Si alguien registra un cobro justo en ese momento,
  `voidInvoice` permite anular una factura `parcial` (es el comportamiento del módulo; lo cierra el
  ítem 2.5 del plan contable). La ventana es corta, con datos de prueba y con un solo admin.
- **Estado cambiado sin volver a revisar.** Un paso de módulo resuelto en otra pestaña no se ve hasta
  «Ya lo hice: revisar de nuevo». El servidor igual recalcula antes de cada paso.
- **Mensajes del módulo.** Si una acción de módulo falla, su error llega tal cual al diálogo; algunos
  módulos devuelven el mensaje crudo de la base (`voidInvoice`, `voidBill`). Así ya pasaba en su
  pantalla.
- **CxP con asiento.** Su reverso es con mejor esfuerzo (B3, dominio de «Contabilidad»). Hoy hay 0
  CxP en producción, según la radiografía del Director (NO VERIFICADO aquí).

## Fuera de alcance

- **Recepciones del Almacén CN.** Sus guardas se resuelven todas en otros módulos o bloquean: Naviera
  (estibas), Despacho (OD), Órdenes de compra y de venta, y la recepción ya recibida en Venezuela
  bloquea siempre. Ninguna tiene una acción del asistente. Además, el Almacén CN es bilingüe (es-VE y
  zh-CN), lo que duplica los textos. La barra del Almacén CN ya lista los motivos. Se puede hacer en
  otra SDD con el mismo `calcularPlan`.
- **Gobernar** la cancelación de rutas TMS, la salida de una consolidación y la vuelta a pendiente de
  una recepción CN (motivo, evento y condición de estado), para que entren al asistente. Pide una
  migración por acción.
- Una **correlación** común entre los pasos de un asistente.
- El reverso contable al anular una factura (B1, ítem 2.5 de «Contabilidad»).

## Producción

- **Sin migración**: nada que aplicar.
- El merge a main publica solo (unos 5 minutos). La PR es borrador y la integra el Director.
- Smoke para Sam después de publicar: guion en el handoff.

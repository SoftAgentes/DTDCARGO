---
sdd: "0490"
title: "El crédito de referido no pisa el pagado ni el estado de la factura"
status: in-progress
author: "Sam + Claude Opus 5 (Worker)"
created: 2026-09-19
updated: 2026-09-19
supersedes: null
superseded_by: null
related: ["0137", "0290", "0294", "0407", "0467", "0488"]
confidencialidad: interno
---

# SDD-0490 — El crédito de referido no pisa el pagado ni el estado de la factura

## Contexto

Es el punto 4 del «Fuera de alcance» de la SDD-0488. Lo asignó el Director (la
sesión «Director notificación a workers») el 2026-09-19, porque Sam pidió trabajo
continuo. El número se reservó en local con `sdd:next --reserve`.

El crédito de referido (SDD-0137) toca el pagado de la factura desde TypeScript,
en peticiones separadas por PostgREST:

- **La aplicación** (`applyReferralCredit`, `app/studio/(app)/fidelizacion/actions.ts`)
  sube `paid_amount` en el monto del crédito como abono no-monetario. Escribe con
  guard optimista sobre el pagado leído y, ante un conflicto, compensa todo.
- **La reversión** (`revertReferralCreditsForInvoice`,
  `lib/studio/accounting/referral-credit-posting.ts`) lo baja cuando se anula la
  factura. Leía `paid_amount` y escribía el valor absoluto, sin guard y sin
  recalcular el estado.

Las funciones de la 0467 (SDD-0488) cobran, identifican y anulan recibos con la
factura tomada FOR UPDATE, pero la reversión no pasa por ellas.

### Premisas medidas (2026-09-19)

1. **«Si un cobro de la 0467 entra en medio, se pierde»: no con un cobro, sí con
   la anulación de un recibo.** La reversión tiene un solo llamador,
   `voidInvoice`, y corre después de anular la factura con
   `void_invoice_with_audit_reason` (0294). Con la factura `anulada`:
   - cobrar, identificar y confirmar un reporte la rechazan bajo lock
     (`PAYMENT_STATE`: 0467:209, 0467:296 y 0464:245);
   - un cobro en vuelo hace esperar al UPDATE de la anulación.

   Sí escribe el pagado de una factura anulada `void_collection_receipt`
   (0467:332-393), porque «una factura anulada conserva su estado: sólo baja el
   pagado» (0467:48-51). Ejemplo: pagado 380 = recibo de 300 + crédito de 80. Si
   el recibo se anula entre la lectura y la escritura de la reversión, queda 300
   en vez de 0.
2. **«Deja pagada con saldo pendiente»: no por la reversión, sí por la
   aplicación.** La 0294 no anula una factura `pagada` y la deja `anulada`, que la
   reversión conserva. El camino real es otro: una aplicación en vuelo a través de
   la anulación. Su UPDATE final guarda el pagado pero no el estado, y anular no
   toca el pagado, así que revive la factura anulada como `parcial` o `pagada`. Si
   la reversión baja después el pagado sin recalcular el estado, queda «pagada»
   con saldo.

Nada de la base lo impide: el trigger D2 de la 0290 registra `anulada` →
`parcial` como `invoice_payment_registered`, y la policy de UPDATE de la 0407 no
mira el estado.

## Decisiones

### Del Director (2026-09-19)

- El diseño: primero se reclama la reversión, después el UPDATE con guard de
  pagado y de estado, con el estado según la regla de la 0467. Los asientos van al
  final, y ante un fallo se compensa.
- El guard de estado de la aplicación entra en esta SDD. Es la misma familia (los
  escritores del crédito de referido sobre `paid_amount` y `status`) y es de una
  línea.
- **Política ante un conflicto: releer y reintentar hasta 3 veces
  (`REVERT_PAID_MAX_ATTEMPTS`).** Decidido por el Director el 2026-09-19,
  revisable por Sam: B es poner la constante en 1. El argumento:
  - la baja es relativa (pagado actual − crédito) y no valida nada contra lo
    leído, a diferencia de la aplicación, que valida el saldo contra el crédito;
    releer y reintentar es seguro;
  - después de anular no hay camino en la UI para reintentar a mano:
    `voidInvoice` no se puede repetir sobre una factura anulada. Sin reintento, un
    conflicto deja el crédito pegado a la factura anulada.
- Sin migración: es TypeScript, así que se integra y se despliega sin aplicar
  nada a producción.

## Alcance

### Qué cambia

**La reversión** (`revertReferralCreditsForInvoice`), por cada crédito
`aplicado` de la factura, en este orden (el molde de la aplicación):

1. **Reclama la reversión:** `aplicado` → `acreditado`, con el rastro limpio y un
   guard por estado. Si otra reversión ya lo devolvió, el UPDATE matchea 0 filas y
   no se baja nada dos veces.
2. **Baja el abono de la factura con guard optimista**, sobre el pagado y el
   estado leídos. Ante 0 filas relee y reintenta, hasta 3 veces. El estado sigue la
   regla de `void_collection_receipt` (0467):
   - una factura anulada o en borrador conserva su estado;
   - otra queda `emitida` sin pagos, o `parcial` con pagos.

   Así nunca queda «pagada» con saldo. El estado se escribe sólo si cambia.
3. **Anula los asientos del crédito** (Fix B, sin cambios).

Si el paso 2 no se puede hacer, compensa el 1 (el crédito vuelve a `aplicado` con
su rastro) y no toca los asientos. La factura, el mayor y el crédito quedan como
estaban, y la función devuelve `ok: false` con el motivo. `voidInvoice` lo
registra como hasta ahora.

**La aplicación** (`applyReferralCredit`): su UPDATE final exige además el estado
leído (`.eq("status", inv.status)`). Si la factura se anuló en medio, matchea 0
filas y la aplicación compensa todo, como ante un pago. El mensaje de ese
conflicto nombra también el estado y pasa a tuteo: «…cambió de saldo o de
estado… vuelve a intentarlo».

### Qué no cambia

- `voidInvoice`: sigue revirtiendo después de anular, en modo best-effort.
- Las funciones SQL: ni la 0467 ni la 0294 se tocan, y no hay migración.
- La UI: no cambia ninguna pantalla.
- El asiento del crédito y su anulación.

### Riesgo residual (no se cierra en TypeScript)

La aplicación y la reversión siguen siendo varias peticiones sin transacción
común. Quedan dos ventanas en las que la reversión baja un abono que nunca llegó a
la factura:

- una anulación que cae entre el claim de la aplicación y su UPDATE final;
- un proceso de aplicación que murió en ese mismo tramo (el caso que ya contempla
  el Fix B).

En las dos, el crédito está `aplicado` y la factura todavía no tiene el abono. Si
tiene otros pagos, se le restan 80 de más. El cierre es llevar la aplicación y la
reversión a funciones SQL con la factura FOR UPDATE, como hizo la 0467 con los
cobros. Eso exige una migración y la decisión de Sam: queda propuesto en «Fuera de
alcance».

### Allowlist exacta

- `lib/studio/accounting/referral-credit-posting.ts` (sólo la reversión, su
  constante y la regla de estado)
- `lib/studio/accounting/__tests__/referral-credit-revert.test.ts`
- `app/studio/(app)/fidelizacion/actions.ts` (sólo el UPDATE final de
  `applyReferralCredit` y su mensaje de conflicto)
- `app/studio/(app)/fidelizacion/__tests__/apply-referral-credit.test.ts`
- `supabase/tests/0467_reversion_credito_carrera.test.sql` (nuevo)
- `docs/specs/0490-reversion-credito-referido/spec.md` y `docs/specs/README.md`
  (regenerado)
- `.agents/handoffs/0490-reversion-credito-referido.md`

## Aceptación

1. Pruebas unitarias de la reversión:
   - una anulación de recibo entre la lectura y el UPDATE deja 0, no 300, tras
     releer una vez;
   - una factura anulada conserva su estado;
   - una pagada a la que se le baja el pagado no queda pagada con saldo;
   - una anulación en medio no la revive;
   - un conflicto persistente compensa (el crédito vuelve a `aplicado` con su
     rastro y el asiento sigue asentado);
   - una reversión ya hecha por otro no baja dos veces.
2. Prueba unitaria de la aplicación: su UPDATE lleva los guards del pagado y del
   estado leídos, y el conflicto nombra el estado.
3. Mutantes fuera del repo: cada guard, el reintento, la regla de estado, la
   compensación y el orden, quitados de a uno, hacen fallar su prueba.
4. La carrera en la suite SQL, contra las funciones reales de la 0467 y la 0294:
   - las sentencias viejas reproducen las dos pérdidas: 300 en vez de 0, y la
     factura anulada que revive;
   - con los guards, las dos se detectan;
   - un cobro no entra en una factura anulada, y la anulación espera a un cobro en
     curso.
5. `pnpm typecheck`, eslint de lo tocado, `docs:check`, `sdd:check` y
   `governance:check` en verde.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| SGE-00.05 (permisos y tenant en el servidor) | **cumplimiento** | Sin cambio: la aplicación corre con el cliente del usuario y su RLS; la reversión, con el admin client, sólo desde `voidInvoice`, que exige el módulo de facturas. |
| SGE-00.06 (prevenir antes de informar) | **cumplimiento** | Los guards impiden escribir sobre una lectura vieja. La aplicación informa el conflicto con qué pasó y qué hacer. |
| AUD-01 (auditoría de mutaciones) | **cumplimiento** | Sin cambio: los UPDATE de la factura siguen pasando por el trigger D2 de la 0290. El guard de estado evita el `invoice_payment_registered` falso de una factura anulada que revivía. |
| MP-01 (permanencia) | **cumplimiento** | Una factura anulada (P3) ya no revive por una aplicación en vuelo y conserva su estado al revertir. |
| ERR-01 (lenguaje del error) | **cumplimiento** | El mensaje del conflicto dice qué pasó y qué hacer, en tuteo. |
| SGE-00.07 / BTN-01 (UI) | **no aplica** | No cambian pantallas ni botones. |
| Aplicación y reversión sin transacción común | **no conformidad preexistente** | El riesgo residual de arriba, propuesto como migración para Sam. |

## Evidencia

En el turno de máquina del Director, 2026-09-19.

- **Pruebas unitarias (vitest, los dos archivos):** 18 de 18 ✓.
- **Control rojo:** las pruebas nuevas contra el código anterior (`6c2413d1`)
  dan 7 ✗. Son los cinco casos nuevos de la reversión que cambian su
  comportamiento y los dos de la aplicación: el guard de estado y el mensaje.
- **Mutantes**, en el lugar y con los fuentes restituidos y comprobados por md5.
  Los 8 caen, cada uno en su prueba:

  | Mutante | Lo que se quita | Prueba que cae |
  |---|---|---|
  | M1 | el guard del pagado leído (reversión) | 380 → 0 y el conflicto persistente |
  | M2 | el reintento (constante en 1, la opción B) | 380 → 0 y la anulación en medio |
  | M3 | la regla de estado de la 0467 | «pagada» con saldo |
  | M4 | el guard del estado leído (reversión) | la anulación en medio |
  | M5 | el guard por estado del claim | la doble baja |
  | M6 | la compensación | el conflicto persistente |
  | M7 | el orden (asientos antes del pagado) | el conflicto persistente |
  | M8 | el guard de estado de la aplicación | su prueba |

  Con M2, que es la opción B, cae el caso de la spec (380 → 0). Sin reintento, el
  conflicto compensa y el crédito queda aplicado a la factura anulada.
- **La carrera en la suite SQL** (`supabase/tests/0467_reversion_credito_carrera.test.sql`,
  14 aserciones, 579 ms, sin residuo). En todas las fases la segunda sesión
  esperó en `transactionid`:

  | # | Escenario | ANTES (sentencias viejas) | DESPUÉS |
  |---|---|---|---|
  | 1 | Se anula el recibo mientras la reversión baja el crédito | pagado 300 con 0 recibos vigentes: se perdió la baja del recibo | 0 filas, relee una vez y deja 0 |
  | 2 | Un cobro llega mientras se anula la factura | — | espera y sale `PAYMENT_STATE`; pagado 300 |
  | 3 | Se anula la factura durante un cobro | — | la anulación espera; la reversión deja 500 = cobrado |
  | 4 | Una aplicación en vuelo cuando se anula la factura | la factura anulada revive como `parcial`, con 380 pagado y 300 cobrado | 0 filas; sigue anulada con 300 |

- **`pnpm typecheck`:** PASÓ (59 s). **eslint de los 4 archivos:** PASÓ, sin
  avisos.
- **`docs:check` (476), `sdd:check`, `governance:check` y `git diff --check`:**
  PASÓ.
- **`pnpm verify` completo** sobre el merge con `main` `8235b70b`, en el turno
  del Director: 16 de 17 pasos corrieron y ninguno falló.
  - vitest: 8105 ✓;
  - sql-tests: 218 contratos, con la carrera nueva;
  - schema-rebuild y build: PASÓ;
  - e2e: 167 ✓ y 1 flaky ajeno (el selector de la calculadora pública, que pasó
    al reintento);
  - migrations-applied: NO DISPONIBLE, porque el worktree no tiene credenciales.
    Esta SDD no trae migración.

  El detalle por paso está en el handoff.

## Fuera de alcance detectado

1. **Llevar la aplicación y la reversión del crédito a funciones SQL** con la
   factura FOR UPDATE, como la 0467 con los cobros. Cierra el riesgo residual y
   exige una migración: decisión de Sam.
2. **`voidInvoice` sólo registra en el log un fallo de la reversión.** Una
   reversión que no pudo hacerse deja el crédito aplicado a una factura anulada, y
   nadie en el Studio se entera. Con el reintento es muy improbable, pero no
   imposible.

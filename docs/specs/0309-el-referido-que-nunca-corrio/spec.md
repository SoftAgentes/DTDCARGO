---
sdd: "0309"
title: "B4 ya estaba hecho — y el trigger que reparte dinero no tenía ningún contrato"
status: done
author: "founder"
created: 2026-08-26
updated: 2026-09-02
supersedes: null
superseded_by: null
related: ["0051", "0250"]
confidencialidad: interno
---

# DTD-0309 — El referido que nunca corrió

> **Cierre técnico · 2026-09-02:** contrato integrado en `origin/main`,
> reejecutado con siete criterios y tres mutaciones causales en PostgreSQL
> desechable. El cierre corresponde a cobertura, no a una acreditación real.
> Las observaciones de producción (cero filas, trigger habilitado y nunca
> ejecutado) y los 120 contratos de abajo son históricas del 2026-08-26:
> **no se consultaron filas alojadas para actualizarlas**.

> **B4 —«acreditación automática de referidos»— ya estaba construido.** Mi
> checklist estaba mal. Lo que faltaba era otra cosa, y más importante.

## Lo que encontré al medir

`SDD-0051` lo dice en su propio texto: *«Slice C — Acreditación automática
(Fase 2, **LIVE**) ✅»*. Y en producción:

```
trigger  invoices_accredit_referral  →  accredit_referral_on_first_invoice
tgenabled = 'O'   (habilitado)
```

La función resuelve el cliente por markbox, lee el premio de
`referral_settings` y avanza los referidos `registrado|primer-embarque` a
`acreditado`. Está completa.

### ⚠️ Lo que casi me hace reconstruirlo

El docblock de `fidelizacion/actions.ts` sigue diciendo:

> «`accreditReferral(id)` → **ADVISORY · NO postea**… El operador aplica el
> crédito a mano en la próxima factura.»

Eso describe el estado **anterior a la Fase 2**. Un comentario desactualizado
sobre el tema exacto que uno viene a construir es una trampa cara: casi
reescribo una función viva.

## 🔴 Lo que sí faltaba: nadie lo protegía

| | |
|---|---|
| Migración en el repo | ✅ `0197`, `0238`, `0250` |
| Trigger vivo en prod | ✅ habilitado |
| **Contrato SQL** | 🔴 **ninguno** |
| Filas en `referrals` | **0** |

El trigger **nunca ha corrido**. Su primera ejecución real va a ser con un
referido de verdad, y lo que escribe es **dinero** (`reward_usd`). Cero
cobertura hasta hoy.

## El contrato

`supabase/tests/0250_referral_settings.test.sql`, siete criterios en seis bloques:

1. La 1ª factura billable acredita.
2. 🔴 **No acredita dos veces** — el premio se pagaría doble.
3. Un **borrador** no acredita: una factura sin emitir no es una compra.
4. Una factura **borrada** no acredita.
5. 🔴 **Aislamiento por tenant.**
6. El premio sale de `referral_settings`, no de un número fijo.
7. *(1b)* El borrador que **se emite** sí acredita — es el camino normal del
   Studio, y sólo funciona porque el trigger escucha `UPDATE OF status`.

### ⚠️ Se cargan TRES migraciones, no una

La función vive repartida: `0197` la creó con el premio **hardcodeado en 80**,
`0238` agregó `accredited_at`, y `0250` la reescribió para leer
`referral_settings`. Producción corre la de **0250**.

Un contrato que cargara sólo la 0197 probaría un comportamiento **que ya no
existe** — y saldría verde. Por eso el archivo se llama por la migración que hoy
es dueña del cuerpo de la función.

*(Al descubrir esto creí haber encontrado drift entre repo y producción. No lo
era: la 0250 estaba en el repo. Verificar antes de reportar.)*

## 🔴 El contrato de aislamiento nació decorado

La primera versión ponía el mismo markbox en dos tenants y verificaba que el
referido ajeno quedara intacto. **Al mutarlo —quitando los dos filtros de
tenant— siguió verde.**

La razón: `referred_client_id` es único, así que el referido ajeno nunca podía
matchear. El escenario no podía fallar, y un test que no puede fallar no prueba
nada.

**La versión que sí detecta:** el markbox `DTD-9999` existe **sólo en el
tenant 2**, y se emite una factura del **tenant 1** con ese markbox. Si el
lookup del cliente perdiera su filtro de tenant, encontraría al cliente ajeno y
**le pagaría el premio a un referidor de otra empresa**.

Con esa versión, la mutación produce el error esperado.

## Verificación

1. **120 contratos SQL** en verde, incluido el nuevo.
2. **Mutación, tres veces** — cada protección apagada pone en rojo su contrato:
   - sin idempotencia por estado → «se re-acreditó… el premio se pagaría doble»
   - sin la guarda de `deleted_at` → «una factura borrada acreditó»
   - sin los filtros de tenant → «una factura del tenant 1 acreditó el referido
     del tenant 2»
3. Gate completo `node scripts/verify.mjs`.

## Lo que esta spec NO puede afirmar

- **Que funcione con datos reales.** `referrals` está vacía; el trigger nunca
  corrió en producción. El contrato prueba su lógica sobre un Postgres
  desechable, no sobre la primera acreditación de verdad.
- **Que el filtro de tenant del `UPDATE` sea necesario.** Es redundante con el
  del lookup: ningún escenario alcanzable lo distingue. Se deja como defensa en
  profundidad, no porque el contrato lo exija.

## Lo que queda abierto

La **aplicación** del crédito a una factura sigue siendo manual y la diseña
SDD-0137 — acreditar sólo *registra* el premio. Eso no cambió acá.

## Cierre de cobertura · 2026-09-02

- `de94ba47` es ancestro de `origin/main@2a2e81bf`. El contrato y las
  migraciones 0197/0238/0250 no difieren entre main y el checkout auditado.
- Contrato real: **GREEN**, los siete criterios pasan. Se expandieron sus
  includes sin cambiar los archivos de SQL; el cuerpo final es el de0250.
- Mutaciones independientes en memoria: retirar idempotencia por estado
  produce `CONTRATO 2 ROTO`; quitar la guarda de factura borrada, `CONTRATO 4
  ROTO`; retirar conjuntamente tenant del lookup y del UPDATE, `CONTRATO 5
  ROTO`. Cada variante falla por su aserción esperada, no por sintaxis.
- Los cuatro recorridos dejan rollback verificado desde una conexión nueva.
  Contenedor local sin red, sin puertos publicados ni volúmenes; retirado y
  ausencia comprobada. No hubo migración o escritura alojada.
- Revisión independiente: aprobada para este alcance. No certifica RLS ni
  roles, porque el fixture sustituye `get_user_tenant_id`; tampoco prueba
  cada filtro de tenant por separado, concurrencia, acreditación real,
  aplicación financiera del crédito o el alcance completo de SDD-0137.

Evidencia, matriz y límites: [acta de cierre técnico](../../audits/2026-09-02-codex-cierre-referidos.md).

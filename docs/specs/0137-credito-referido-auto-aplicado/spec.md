---
sdd: "0137"
title: "Crédito de referido auto-aplicado — aplicar el bono del referidor a su próxima factura (cierra el lazo de plata de SDD-0051)"
status: draft
author: "Claude Code (ventana docs/diseño · Modo Forja · feat/referidos-gobernanza)"
created: 2026-07-01
updated: 2026-07-01
supersedes: null
superseded_by: null
related: ["0051", "0053", "0077", "0079"]
confidencialidad: interno
---

# SDD-0137 — Crédito de referido auto-aplicado

> **Diseño (draft). NO implementar.** Esta spec resuelve el último eslabón del programa de referidos:
> **aplicar** el crédito del referidor ($80) a su próxima factura. Hoy (SDD-0051 Slice C, LIVE) el
> crédito se **acredita automático** (`referrals.status='acreditado'`, `reward_usd=80`) pero es
> **advisory**: nadie lo aplica salvo a mano. Esto **mueve plata** (toca Facturación/CxC/Contabilidad y
> el terreno fiscal VE), así que va con opciones, recomendación y gate. El correlativo definitivo lo
> confirma el Director al construir.

## 1. Resumen en una línea

Convertir el crédito **acreditado** de un referidor en un **crédito aplicable** que reduce lo que paga
en su próxima factura, con **asiento contable de gasto de marketing** (no de descuento comercial),
**gate de accounting** (propone → aplica, fail-closed) e **idempotencia en la DB**.

## 2. Por qué (grounding)

- **Lazo abierto.** SDD-0051 Slice C ya cierra la **acreditación** (trigger `invoices_accredit_referral`,
  migr 0197): en la 1ª factura *billable* del referido, el referidor pasa a `acreditado` con
  `reward_usd=80`. Pero es **advisory** — el crédito se ve en el Portal (`getMyReferralProgram →
  creditsEarnedUsd`) y en el Studio, y **ahí muere**: no hay forma de *cobrarlo* salvo que un asesor lo
  descuente a ojo. El programa promete plata que el sistema no entrega.
- **Mueve dinero de verdad.** Aplicar el crédito toca tres capas que el repo trata con cuidado:
  Facturación/CxC (SDD-0021), Contabilidad (asiento — SDD-0077/0079/0110) y Fiscal VE/SENIAT
  (SDD-0073 IVA · SDD-0104 libros). Por eso NO se puede "restar $80 y ya": hay que decidir **cómo se
  refleja fiscalmente** y **qué asiento genera**.
- **RBAC dinero = accounting.** Toda operación con plata pasa por rol `accounting`/`admin` (SDD-0085).
  El default de este diseño es **el sistema propone, accounting aplica** (fail-closed), coherente con
  ese patrón y con el gate advisory que ya usan verificación de identidad (0046) y reclamos (0102).
- **Patrones de posting ya existen.** `lib/studio/accounting/*-posting.ts` (invoice/expense/bill/…) dan
  el molde exacto: resolver cuentas por `code`, `next_entry_code`, insertar `journal_entries` +
  `journal_lines` balanceadas, idempotencia por FK, best-effort. Este diseño calca ese molde.

## 3. Decisiones a resolver (con recomendación)

> Las marcadas **⭐** son la recomendación; las **abiertas (⚠️ founder)** necesitan el OK de Sam antes de
> construir porque cambian el modelo fiscal o de datos.

### 3.1 Modelo del crédito — ⚠️ founder

**Opción A — Derivar de `referrals`.** Agregar `status='aplicado'` (+ `applied_invoice_id`,
`applied_entry_id`, `applied_at`) a la tabla `referrals`. Un referido acreditado = un crédito de $80;
aplicarlo = transición `acreditado → aplicado` (mismo patrón idempotente-por-estado que Slice C).
- ➕ Mínimo: sin tabla nueva, reusa el enum y la fila que ya existe.
- ➖ Un crédito = una fila `referrals` = **no permite** aplicación parcial, arrastre de remanente, ni
  créditos que no vengan de un referido (Club DTD, cortesías). Mezcla "seguimiento del referido" con
  "saldo de plata" en la misma fila.

**Opción B — Ledger `referral_credits` ⭐.** Tabla nueva, una fila por crédito acreditado
(`origin_referral_id` FK), con `amount_usd`, `status` (`disponible|aplicado|anulado`),
`applied_invoice_id`, `applied_entry_id`, `applied_at`. La creación de la fila la dispara la
acreditación (trigger sobre `referrals` cuando entra a `acreditado`, **sin tocar** el trigger de Slice C).
- ➕ Ancla de plata **auditable y aislada** (quién aplicó, a qué factura, con qué asiento), con
  idempotencia por índice único parcial — el patrón que el repo ya usa para dinero (SDD-0102 gate de
  pago en DB, SDD-0110 UNIQUE parciales TOCTOU).
- ➕ **Generaliza**: mañana un crédito de Club DTD (SDD-0116) o una cortesía entra al mismo ledger sin
  reshaping; V2 agrega `applied_amount`/`remaining` para parcial sin migración destructiva.
- ➖ Algo más de build (tabla + trigger de creación + RPC de aplicación).

**⭐ Recomendación: Opción B (ledger).** Es dinero: se merece su propia tabla auditable, y el repo
consistentemente modela plata así. La fila `referrals` sigue siendo el *seguimiento del referido*; el
`referral_credits` es el *saldo*. **Decisión abierta**: si el founder prefiere el mínimo absoluto para
V1 y descarta créditos no-referido, la Opción A es válida y más barata.

**Estados (ledger):** `disponible` (acreditado, sin usar) → `aplicado` (idempotente, un crédito no se
aplica dos veces) · `anulado` (revertido, p. ej. si la factura donde se aplicó se anula → vuelve a
`disponible`, ver §3.6).

### 3.2 Punto de aplicación — ⚠️ founder (el más importante, fiscal)

Cómo se refleja el $80 cuando el referidor factura de nuevo. Dos enfoques con **consecuencias fiscales
opuestas** en Venezuela (SDD-0073 IVA · SDD-0104 libros):

**Opción 1 — Descuento en línea de la factura.** Se agrega una línea "−$80" a la próxima factura,
bajando el total (y la base imponible).
- ➖ **Baja la base gravable** → recalcula el **IVA débito fiscal** → en VE eso exige un **documento
  fiscal** (la factura muestra menos base). Lo trata como **descuento sobre ventas** (cuenta contra
  `4.9`), es decir **menos ingreso** — justo lo que el founder dijo que **NO** es (el crédito es un
  gasto de incentivo, no una rebaja de precio del servicio).
- ➖ Acopla el crédito a la **composición** de la factura (y a SENIAT). Frágil con el toggle de IVA
  (SDD-0073) ON/OFF.

**Opción 2 — Crédito contra la CxC, factura fiscal intacta ⭐.** La factura se **emite completa** (base
+ IVA al valor real del servicio; el documento fiscal no se toca). El crédito se aplica **en la capa de
cobro/saldo**, como un abono: el saldo por cobrar baja $80, y ese $80 lo **absorbe DTD como gasto de
marketing**. Al cliente se le muestra en la sección de **pagos/saldo** de la factura ("Crédito de
referido aplicado: −$80"), **no** como una línea que altere la base.
- ➕ **No toca la base ni el IVA** → **sin nota de crédito fiscal, sin recálculo de IVA** → funciona
  igual con IVA ON u OFF (SDD-0073). El ingreso del servicio se reconoce completo (fiel a la realidad:
  el servicio valió $X; DTD regaló $80 de su bolsillo).
- ➕ Refleja la **naturaleza real**: gasto de marketing/incentivo, no rebaja de precio.
- ➖ El cliente ve la factura fiscal por el total y el crédito aparte (en el saldo). Es correcto, pero
  hay que dejarlo claro en la UI para que no parezca inconsistente.

**Opción 3 — Nota de crédito formal (fiscal).** Emitir una nota de crédito SENIAT correlativa por $80.
- ➖ Pesado (correlativo fiscal + libro de ventas + recálculo IVA) y **conceptualmente errado**: la nota
  de crédito es para anular/rebajar una venta, no para pagar un incentivo. Reservar para cuando la
  operación exija tratar el crédito como devolución (no es el caso).

**⭐ Recomendación: Opción 2 (crédito contra la CxC, factura intacta).** Es la única que (a) respeta que
es **gasto de marketing** y no descuento comercial, (b) **no dispara la maquinaria fiscal** (nota de
crédito / IVA), y (c) es agnóstica al toggle de IVA. **Regla dura de diseño:** el crédito se aplica al
**saldo/cobro**, nunca como línea que modifique la base imponible.

### 3.3 Asiento contable — se deriva de §3.2 Opción 2

Con el enfoque recomendado, aplicar el crédito genera **un asiento propio** (`source='referral_credit'`),
independiente del asiento de venta de la factura (que queda intacto, DR 1.1.2 / CR 4.x + IVA):

```
DR  6.11  Publicidad y marketing            = 80.00   (el incentivo, gasto operativo)
CR  1.1.2 Cuentas por cobrar clientes       = 80.00   (baja el saldo del referidor)
```

- **Por qué esas cuentas:** `6.11 Publicidad y marketing` (gasto operativo, ya sembrado en el CoA seed,
  migr 0078) captura el costo del incentivo — coherente con "gasto de marketing, no descuento".
  `1.1.2 Cuentas por cobrar clientes` (la misma CxC del asiento de venta) baja $80 el saldo del cliente,
  que así paga $80 menos sin tocar el ingreso (`4.x`) ni el IVA (`2.1.5`). **No se usa `4.9` Descuentos
  sobre ventas** (esa sería la Opción 1, rechazada).
- **Sin cuenta nueva.** El enfoque de **un solo paso** (reconocer el gasto al **aplicar**) reusa cuentas
  ya sembradas → la migración **no** agrega cuentas al plan.
- **Momento del reconocimiento (⚠️ founder, menor):** este diseño reconoce el gasto **al aplicar** (no al
  acreditar). La alternativa contable-purista sería devengar al **acreditar** (DR 6.11 / CR *pasivo*
  "Créditos de referidos por aplicar" `2.1.7` nuevo) y al aplicar mover DR pasivo / CR CxC. Se
  **descarta para V1** por simplicidad y porque evita estimar un pasivo por créditos que quizá nunca se
  usen; queda como V2 si el contador lo pide (§8.4 de SDD-0073 ya prevé revisión del contador).
- **Molde:** calca `lib/studio/accounting/expense-posting.ts` (resolver cuentas por `code`,
  `next_entry_code`, líneas balanceadas, best-effort, skip si falta la cuenta). Idempotente por el
  crédito (§3.5).

### 3.4 Gate: ¿automático o confirmado? — ⭐ propone, accounting aplica

- **Default ⭐:** el sistema **detecta y propone** — cuando accounting/admin abre o emite la próxima
  factura del referidor, ve "Este cliente tiene **$80 de crédito de referido disponible**. ¿Aplicar?".
  La **aplicación la confirma un rol `accounting`/`admin`** (SDD-0085). **Fail-closed:** si nadie
  confirma, no pasa nada (el crédito sigue `disponible`).
- **Por qué no automático en V1:** mueve plata y genera asiento; que una factura se descuente sola sin
  que un humano de finanzas lo valide es riesgo. El auto-aplicar (toggle por tenant) es **V2**.
- **Tope por factura:** el crédito se aplica **hasta el total de la factura**. En V1 (crédito entero, sin
  parcial) la regla es: **solo se propone/aplica si el total de la factura ≥ el crédito**; si la próxima
  factura es menor, el crédito **espera** a una suficientemente grande (no se parte). Aplicación parcial
  + arrastre de remanente = **V2** (y es la razón principal para el ledger de §3.1).

### 3.5 Idempotencia + concurrencia — patrón DB del repo

- **Un crédito, una aplicación.** Índice **único parcial** sobre el ledger (`where status='aplicado'`,
  uno por crédito) → blinda el doble-submit / la carrera (patrón SDD-0110 UNIQUE parciales TOCTOU,
  SDD-0102 gate en DB). Un segundo intento de aplicar el mismo crédito choca con el índice y no duplica
  ni el descuento ni el asiento.
- **RPC transaccional.** La aplicación va en un **RPC** `apply_referral_credit(p_credit, p_invoice)`
  (`security definer`, `set search_path = public`, `revoke execute from public, anon`; grant al rol
  autenticado, gate de rol en la server action **antes** de llamar): en **una** transacción hace la
  transición de estado + genera el asiento + linkea `applied_invoice_id/entry_id`. Scopeado **explícito**
  por `tenant_id` (nunca cross-tenant). Si el asiento falla, revierte el estado (o al revés) — todo o
  nada.
- **Validación de coherencia:** el RPC verifica que el crédito esté `disponible`, que la factura sea del
  **mismo referidor** (`referrer` = cliente de la factura) y del mismo tenant, y que `factura.total ≥
  crédito` (§3.4). Rechaza (no aplica) si algo no cuadra.

### 3.6 Factura anulada / crédito revertido

- Si la factura donde se aplicó el crédito se **anula**, hay que **revertir**: el crédito vuelve a
  `disponible` (o `anulado` si el referido se descubrió fraudulento) y el **asiento de marketing se
  anula/reversa** (asiento espejo DR/CR invertido, o soft-delete del asiento — mismo criterio que
  `expense-posting` "borrar → anula"). Así el crédito no se "quema" por una factura que no existió.
- **Disparo:** una acción/trigger al anular la factura busca créditos con `applied_invoice_id = <factura>`
  y los revierte. Idempotente (revertir dos veces = no-op).
- **Referido/crédito anulado manualmente** (abuso): un admin puede pasar el crédito a `anulado` (no
  aplicable). Fuera del camino feliz; V1 lo permite vía update con gate de rol.

## 4. Migración necesaria (describir — NO escribir el `.sql`)

> El número real (`NNNN_…`) lo asigna el Director al construir; carpeta de spec = 0137.

1. **Tabla `referral_credits`** (si se elige Opción B, §3.1): `id`, `tenant_id → tenants` (cascade),
   `origin_referral_id → referrals(id)` (set null), `referrer_client_id → clients(id)` (set null),
   `referrer_markbox text` (denormalizado), `amount_usd numeric(12,2)`, `currency text default 'USD'`,
   `status text` (`disponible|aplicado|anulado`, default `disponible`), `applied_invoice_id → invoices`
   (set null), `applied_entry_id → journal_entries` (set null), `applied_at timestamptz`, `notes text`,
   `created_at/updated_at/deleted_at`.
   - **RLS fail-closed por tenant + rol** (dinero → `accounting`/`admin`, patrón SDD-0085): policy de
     lectura por tenant, escritura/aplicación restringida a rol; + `service_role all`.
   - **Índice único parcial** `where status='aplicado' and deleted_at is null` (uno por crédito).
   - Índices FK parciales: `(tenant_id, status)`, `(referrer_markbox)`, `(applied_invoice_id)`.
   - `touch_updated_at` (trigger 0002). Grants explícitos.
2. **Trigger de creación del crédito**: sobre `referrals` **AFTER UPDATE OF status** cuando entra a
   `acreditado` → inserta la fila `referral_credits` (`disponible`, `amount_usd = reward_usd`). **No
   toca** el trigger de Slice C (migr 0197); es aditivo. Idempotente (un crédito por referral: índice
   único sobre `origin_referral_id where deleted_at is null`).
3. **Backfill (data)**: crear filas `referral_credits` (`disponible`) para los `referrals` que **ya
   están** `acreditado` (los que Slice C acreditó antes de esta migración) → que los créditos vivos sean
   aplicables. Describir como `insert … select` idempotente (no duplica si ya existe).
4. **RPC `apply_referral_credit(p_credit uuid, p_invoice uuid)`** (§3.5): transición + asiento (DR 6.11 /
   CR 1.1.2) + link, en una transacción; `security definer`; `revoke execute from public, anon`.
5. **RPC/handler de reversión** al anular factura (§3.6).
6. **Sin cuentas nuevas en el CoA** (reusa `6.11` + `1.1.2`) salvo que el founder elija el devengo en dos
   pasos (§3.3) → entonces sí una cuenta pasivo `2.1.7 Créditos de referidos por aplicar`.

## 5. Alcance de código (orientativo — lo detalla el implementer)

- `lib/studio/fidelizacion/referral-credit-queries.ts` — listar créditos por cliente/estado, resolver
  "crédito disponible del referidor de esta factura".
- `lib/studio/accounting/referral-credit-posting.ts` — asiento DR 6.11 / CR 1.1.2 (molde
  `expense-posting.ts`), best-effort, idempotente por crédito.
- Server action `applyReferralCredit` (gate de rol `accounting`/`admin`, fail-closed) → llama el RPC.
- UI: en el drawer/detalle de factura del referidor, banner "Crédito disponible $80 · Aplicar" (solo
  rol dinero); en Portal, el crédito pasa de "ganado/disponible" a "aplicado" con la factura donde se usó.
- **Frontera intacta:** todo Studio (`@/lib/db/server` + Server Actions). El Portal solo lee.

## 6. Aceptación (V1)

- [ ] Migración aplica limpio: `referral_credits` + RLS por tenant/rol + índice único parcial + trigger
      de creación + backfill de acreditados existentes + RPC de aplicación/reversión. (No se aplica a
      prod en la corrida del harness; la aplica el Director/founder.)
- [ ] Al acreditarse un referido (Slice C), aparece un crédito `disponible` en el ledger.
- [ ] En la próxima factura del referidor (total ≥ crédito), accounting/admin ve la propuesta y puede
      **aplicar**; un rol sin permiso de dinero **no** puede (fail-closed).
- [ ] Aplicar genera el asiento **DR 6.11 / CR 1.1.2** por $80, baja la CxC del referidor $80, **no toca
      la base ni el IVA** de la factura, y marca el crédito `aplicado` (idempotente: reintentar no
      duplica).
- [ ] Anular la factura revierte el crédito a `disponible` y anula el asiento.
- [ ] Portal y Studio reflejan el crédito como `aplicado` con su factura.
- [ ] `node scripts/verify.mjs` 🟢 (lint + typecheck + tests + docs:check) y `pnpm build` verde.

## 7. Fuera de alcance (V1 → queda para V2)

- **Aplicación parcial + arrastre de remanente** (crédito > factura): V1 aplica entero solo a facturas
  suficientemente grandes. (Razón principal para el ledger; V2 agrega `applied_amount`/`remaining`.)
- **Auto-aplicar** sin confirmación humana (toggle por tenant): V1 propone y un rol dinero aplica.
- **Devengo al acreditar** (asiento en dos pasos con pasivo `2.1.7`): V1 reconoce el gasto al aplicar.
- **Vencimiento del crédito** (expiry) y **créditos no-referido** (Club DTD SDD-0116, cortesías): el
  ledger los soporta a futuro, pero no se cablean en V1.
- **Nota de crédito fiscal** (Opción 3, §3.2): solo si la operación cambia el tratamiento a devolución.
- **Crédito del referido ($60, `referredReward`)**: es un **descuento comercial** en la 1ª factura del
  *referido* (capa de cotización/composición), concepto distinto del crédito del *referidor* que diseña
  esta spec. Fuera de alcance aquí.

## 8. Preguntas abiertas para el founder

1. **Modelo (§3.1):** ¿ledger `referral_credits` ⭐ o derivar de `referrals` (mínimo)?
2. **Aplicación (§3.2):** confirmar **crédito contra CxC con factura fiscal intacta** ⭐ (evita nota de
   crédito + IVA) vs descuento en línea.
3. **Gate (§3.4):** confirmar **propone → accounting aplica** ⭐ (auto-aplicar = V2).
4. **Devengo (§3.3):** reconocer el gasto **al aplicar** ⭐ (un paso) vs **al acreditar** (dos pasos con
   pasivo nuevo) — decisión del contador (SDD-0073 §8.4).

## 9. Notas de implementación

_(Las completa el implementer al construir; hoy es diseño.)_

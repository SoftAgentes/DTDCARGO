---
sdd: "0068"
title: "Recibos de cobranza con mandato (SDD-C del handoff legal) — leyenda obligatoria + pagador tercero + pagos sin referencia + separación de fondos"
status: approved
author: "handoff Claude Chat (capa legal) + Claude Code"
created: 2026-06-11
updated: 2026-06-11
supersedes: null
superseded_by: null
related: ["0041", "0044", "0040", "0021", "0067", "0054"]
confidencialidad: interno
---

# DTD-0068 — Recibos de cobranza (SDD-C)

> Segunda spec de la capa legal (`docs/legal/HANDOFF_CAPA_LEGAL.md` §SDD-C, orden
> B → C → A → E → D). Base existente: Cobranzas (SDD-0041, `payment_receipts`
> R-YYYY-NNNN + asiento automático DR Caja / CR 1.1.2) · Contabilidad (SDD-0040,
> `journal_entries`/`journal_lines` + plan de cuentas) · Facturación (SDD-0021).
> Branch: `feat/capa-legal`.

## 1. Resumen en una línea

Todo cobro de flete queda **legalmente vestido**: recibo imprimible con la leyenda
de mandato literal (`COPY_LEGAL_UI.md §2`), registro del **pagador** (cliente o
tercero con relación + declaración de licitud, decisión #7), **pagos sin
referencia** en estado `recibido_sin_ref` con cuenta puente e **identificación
retroactiva** (cláusula 7.3 + decisión #6), y **clasificación de fondos**
`third_party` vs `local_revenue` con reporte de separación (insumo de SDD-D).

## 2. Por qué

- Handoff SDD-C: "Todo recibo de pago de flete internacional lleva OBLIGATORIO la
  leyenda 'Gestión de cobranza por cuenta de DTD Cargo (operadora internacional) —
  Servicio puerta a puerta — Ref. …'; NO es factura fiscal; pagos sin referencia →
  'no aplicado' hasta identificación; separación third_party_funds vs local_revenue
  — nunca mezclar en un mismo asiento."
- Estado real (verificado en el código): `payment_receipts` existe pero NO hay
  recibo imprimible (el botón PDF de factura es placeholder), NO hay registro de
  pagador tercero ni declaración de licitud, NO se puede registrar un pago sin
  factura (invoice_id NOT NULL), y NO existe clasificación de fondos en datos.
- Arquitectura legal de 3 patas (handoff §1): Inversiones DTD Services, C.A. es
  **agente de cobranza** de la Operadora — el dinero de flete internacional que
  recauda NO es ingreso propio. Sin la leyenda y la separación, cada cobro parece
  ingreso de DTD Services (riesgo fiscal/legal directo).

## 3. Decisiones ancladas

1. **Estados de aplicación del pago (COPY §7)** en `payment_receipts.application_status`:
   `recibido_sin_ref | identificado | aplicado | rendido`. En V1 el flujo real usa
   `recibido_sin_ref` → (identificar) → `aplicado` (el paso `identificado` existe como
   estado intermedio válido pero la UI lo colapsa: identificar = aplicar, dejando
   `identified_at` como timestamp). `rendido` queda DEFINIDO (label + badge) pero su
   transición es de SDD-D (rendición quincenal). `hold_despacho` / `override_activo`
   del COPY §7 son estados del DESPACHO, no del pago → SDD aparte (COPY §6), fuera
   de alcance. Labels internos + microcopy "Cliente ve" del COPY §7 viven en
   `payment-types.ts` listos para el Portal (wiring Portal diferido).
2. **Pago sin referencia = receipt sin factura.** `payment_receipts.invoice_id` pasa
   a NULLABLE (relajación segura, sin pérdida de datos). CHECK de integridad:
   `(application_status = 'recibido_sin_ref') = (invoice_id is null)` — un sin-ref
   no apunta a factura; identificado/aplicado/rendido siempre apuntan. Asiento del
   sin-ref: DR caja / CR **cuenta puente** nueva del seed "Fondos por identificar"
   (pasivo, código libre siguiente en 2.1.x — el implementer lo verifica contra el
   seed real de 0078; el explore indica 2.1.7 libre). Snapshot `client_markbox`/
   `client_name` quedan NULL hasta identificar.
3. **Identificación retroactiva (decisión #6).** Acción "Identificar" sobre un
   sin-ref: elige factura (con saldo ≥ monto), setea `invoice_id` + snapshots +
   `application_status='aplicado'` + `identified_at=now()`, **conserva `received_at`
   ORIGINAL** (la imputación es a la fecha de recepción de fondos — eso ES la
   retroactividad en V1) y genera asiento de RECLASIFICACIÓN (DR puente / CR 1.1.2
   Clientes) con fecha = `received_at`. El "reverso de cargos del limbo" (bodegaje
   causado mientras el pago estaba sin identificar) queda FUERA de V1: el bodegaje
   automático no existe aún como cargo en sistema; se documenta el gancho.
4. **Pagador (decisión #7 + COPY §3).** `payer_kind` (`cliente` default | `tercero`),
   y si tercero: `payer_name` (obligatorio), `payer_relation`
   (`familiar|socio|empleado|otro`, obligatorio) y `licit_declared` (checkbox
   obligatorio en el form: "El pagador declaró que los fondos corresponden a la
   operación y son de origen lícito"). Validación en `validatePaymentInput`:
   tercero sin nombre/relación/declaración ⇒ fieldErrors (no se registra). El
   recibo imprime "Pagador: {nombre} (tercero — relación: {relación})" tal como
   COPY §2. Pago de cliente: `licit_declared` no aplica (false, sin checkbox).
5. **Clasificación de fondos.** `fund_class` (`third_party | local_revenue`) en
   `invoices` Y en `payment_receipts` (NOT NULL con default `third_party` +
   backfill en la migración). Derivación server-side (helper puro
   `deriveFundClass(shipmentService)`): `transporte_terrestre` o factura SIN
   shipment ⇒ `local_revenue`; `consolidacion | puerta_a_puerta_DDP | reserva_FCL`
   ⇒ `third_party`. Se setea al emitir factura y al registrar el cobro (hereda de
   la factura; sin-ref ⇒ `third_party` hasta identificar, luego hereda). "Nunca
   mezclar en un mismo asiento": los asientos automáticos de cobro son por-recibo
   (una clase por construcción) — la invariante se documenta en el builder del
   asiento + test que lo fija; NO se reforma el reconocimiento de ingreso de la
   emisión (DR 1.1.2 / CR 4.x queda igual — el neteo real Operadora↔DTD Services
   es SDD-D y se anota como deuda conocida).
6. **Recibo imprimible (COPY §2 LITERAL).** Builder puro
   `lib/studio/receipts/receipt-template.ts` (`buildReceiptDoc(receipt, invoice?,
   shipment?, acceptance?)` → estructura tipada con TODAS las líneas del template) +
   página print-friendly `app/studio/(app)/cobranzas/recibo/[code]/page.tsx`
   (server; gating = usuario del tenant — Cobranzas no es admin-only; patrón visual
   del expediente 0067). Contenido obligatorio del §2: encabezado "RECIBO DE PAGO —
   DTD CARGO" · leyenda "Gestión de cobranza por cuenta de DTD Cargo (operadora
   internacional)" + "Servicio puerta a puerta China–Venezuela" · Ref. envío =
   `{shipping_mark}-{n_operacion}` (= `client_markbox` + sufijo de la orden; si el
   shipment_code existe se usa su forma canónica) · Cliente · Pagador (con
   relación si tercero) · Monto + moneda + canal · Fecha de recepción de fondos
   (= `received_at`) · "Recibido por: Inversiones DTD Services, C.A., agente de
   cobranza de la Operadora." · "Este recibo acredita la recepción del pago
   indicado y NO constituye factura fiscal." · "Documento sujeto al Acuerdo de
   Servicios v{version} aceptado por el Cliente." — versión desde la aceptación
   vigente del cliente para esa orden (reusar queries de `lib/studio/legal/`) con
   fallback a la versión vigente de `legal_docs`; si no hay ninguna, "v—".
   **BRAND-CHECK documentado:** la razón social "Inversiones DTD Services, C.A."
   SÍ es visible aquí porque el copy legal literal la exige en un documento
   probatorio (excepción acotada al recibo; la regla "solo en schema" sigue para
   el sitio/marketing). **Cero menciones de DoorTuDoor Trading / J-50220185-8.**
   Recibo sin factura (`recibido_sin_ref`) también es imprimible: Ref. = "Pendiente
   de identificación" + estado visible (sirve como constancia del §3 del COPY).
   Botones: "Imprimir" en la página + links "Ver recibo" desde el historial del
   `CobranzaDrawer` y desde el detalle de factura.
7. **UI Cobranzas.** (a) Form de cobro (`CobranzaDrawer` tab Cobro): bloque
   "¿Quién realizó el pago?" (Yo mismo = cliente / Un tercero → nombre + relación +
   checkbox de licitud) según COPY §3. (b) Botón "+ Pago sin identificar" en
   `CobranzasClient` → drawer mínimo (monto, moneda, canal, cuenta caja, fecha,
   referencia opcional, notas). (c) Sección/lista "Sin identificar" (los
   `recibido_sin_ref`) con acción "Identificar" (drawer: cliente → factura con
   saldo → confirma; muestra el aviso del COPY §3: estado visible al cliente
   "Pago recibido — pendiente de identificación…"). (d) Card de separación de
   fondos: totales del período por `fund_class` (recaudado tercero vs ingreso
   local) — insumo directo de la rendición SDD-D. (e) Chip/badge de `fund_class`
   y de `application_status` donde se listan recibos.
8. **Migración `0122_recibos_cobranza.sql` — aditiva** (0121 = evidencia v2 de este
   mismo branch; números verificados contra TODAS las ramas/worktrees 2026-06-11):
   columnas nuevas en `payment_receipts` (`payer_kind`, `payer_name`,
   `payer_relation`, `licit_declared`, `application_status`, `identified_at`,
   `fund_class`) con CHECKs; `invoice_id` DROP NOT NULL + CHECK del punto #2;
   `invoices.fund_class` + backfill (UPDATE por shipment_service vía join;
   receipts heredan de su invoice; sin invoice ⇒ 'third_party'); cuenta puente en
   seed idempotente (`on conflict do nothing`, mismo patrón del seed 0078). NO se
   aplica a prod (founder).
9. **No tocar:** máquina de estados de `invoices` · asientos de emisión existentes ·
   `legal_acceptances`/evidencia (0067) · gate AUT-04 · módulo Tesorería (CxP) salvo
   cero-cambios colaterales.

## 4. Approach (resumen de archivos)

- `supabase/migrations/0122_recibos_cobranza.sql` — decisión #8.
- `lib/studio/payment-types.ts` — `ApplicationStatus`, `PayerKind`, `PayerRelation`,
  `FundClass` + labels/badge tones + microcopy COPY §7 ("Cliente ve") +
  `deriveFundClass()` + `validatePaymentInput` extendido (decisión #4) +
  `validateUnidentifiedPaymentInput` nuevo.
- `lib/studio/collections-actions.ts` — `registerCollectionFor` setea pagador +
  fund_class; nuevas `registerUnidentifiedPaymentFor` y `identifyPaymentFor`
  (reclasificación retroactiva, decisión #3). Asientos vía el helper existente de
  Cobranzas (mismo patrón DR/CR; cuenta puente para sin-ref).
- `lib/studio/payment-queries.ts` (o el hogar actual de queries de cobranzas) —
  `listUnidentifiedReceipts`, `fundsSeparationSummary(periodo)`.
- `lib/studio/receipts/receipt-template.ts` — builder puro + tipos (decisión #6).
- `app/studio/(app)/cobranzas/` — actions wrappers + `CobranzaDrawer` (pagador) +
  `CobranzasClient` (botón sin-ref + lista + card separación) + drawers nuevos +
  `recibo/[code]/page.tsx` imprimible + links "Ver recibo".
- Tests Vitest: validators del pagador (tercero exige los 3 campos) ·
  `deriveFundClass` (4 servicios + sin shipment) · identificación conserva
  `received_at` y reclasifica (stub Supabase) · CHECK sin-ref⇔invoice null
  (lógica del validator) · builder del recibo string-EXACTO contra COPY §2
  (leyenda, "NO constituye factura fiscal", "Recibido por: Inversiones DTD
  Services, C.A.", pagador tercero con relación) · labels COPY §7 · summary de
  separación suma por clase.

## 5. Acceptance

- [ ] Migración `0122` aditiva limpia (estados, pagador, fund_class, invoice_id
      nullable + CHECK, cuenta puente seed). NO aplicada a prod por el harness.
- [ ] Registrar cobro normal pide pagador; tercero sin nombre/relación/licitud ⇒
      fieldErrors y NO inserta.
- [ ] Pago sin referencia: se registra sin factura (`recibido_sin_ref`, asiento a
      cuenta puente), aparece en "Sin identificar", y al identificar conserva
      `received_at` original + reclasifica + queda `aplicado` con `identified_at`.
- [ ] Recibo imprimible con el template literal COPY §2 (incluye leyenda de
      mandato, NO-factura-fiscal, "Recibido por: Inversiones DTD Services, C.A.",
      versión del Acuerdo, pagador tercero con relación) para receipts con y sin
      factura. Cero "DoorTuDoor Trading"/"J-50220185". Links desde drawer y
      detalle de factura.
- [ ] `fund_class` persistida en invoices + receipts (backfill correcto) + card de
      separación con totales por clase + badges en listados.
- [ ] Labels/microcopy COPY §7 definidos (incl. "Cliente ve") con `rendido` y
      Portal-wiring explícitamente diferidos.
- [ ] `node scripts/verify.mjs` 🟢 (gate completo).
- [ ] Sin cambios en: asientos de emisión, máquina de estados de invoices, módulo
      Tesorería, evidencia 0067, gate AUT-04.

## 6. Fuera de alcance (respetar)

- Email del recibo al cliente · estados de pago en el Portal (labels quedan
  listos; wiring = spec aparte) · PDF server-side (V1 = imprimible del navegador).
- Reforma del reconocimiento de ingreso en la emisión (neteo real
  Operadora↔DTD Services) y transición a `rendido` → **SDD-D rendición**.
- Reverso automático de cargos del limbo (bodegaje no existe como cargo aún).
- `hold_despacho` / `override_activo` (flujo COPY §6, rol Sam) → spec aparte.
- Aplicar migración a prod (founder).

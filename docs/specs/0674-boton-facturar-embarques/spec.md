---
sdd: "0674"
title: "Embarques: botón «Facturar» para los contenedores montados sin pasar por origen (regla transitoria)"
status: draft
author: "Claude (Worker) + Sam"
created: 2026-11-18
updated: 2026-11-18
supersedes: null
superseded_by: null
related: ["0054", "0407", "0414", "0514", "0543", "0549", "0552", "0553", "0556", "0571", "0574", "0661"]
confidencialidad: interno
---

# SDD-0674 — Botón «Facturar» en Embarques (regla transitoria)

> Sam lo pidió en la reunión con la oficina del 2026-11-18, por el DG. Embarques tendría un botón
> «Facturar» que el rol de Embarques pueda oprimir. Al facturar, el cliente ve en su portal los datos del
> embarque y el tracking. Es **transitorio**: solo aplica a los cuatro contenedores que se montaron sin
> pasar por origen. Antes de facturar, la oficina confirma que lo cargado en el sistema cuadra con el Excel
> y pasa el valor a facturar.
>
> **Borrador, sin código.** Primero hacen falta las cinco respuestas de Sam (§4).

## 1. Por qué es transitorio

El flujo definitivo es otro: al recibir la mercancía en China se registra, y desde ahí el cliente ve el
tracking y el monto sin facturar (decisión 9; SDD-0574 y 0571). Los cuatro contenedores de esta regla se
montaron sin recepción real en origen: entraron con la carga de consolidados (SDD-0543) desde el Excel. Por
eso no tienen el camino normal, y la oficina necesita una forma de decir «esto ya está listo para el
cliente».

## 2. Lo que hay hoy (medido en código y migraciones, sin leer producción; base `origin/main` `9434cc4f6`)

### 2.1 El portal ya muestra los embarques sin factura

- **Lista de envíos.** `listMyShipments` (`lib/portal/portal-queries.ts`) lee `shipments` por tenant y
  Shipping Mark del principal. No mira `invoices`.
- **La RLS tampoco.** La policy `shipments portal self read` (migración 0416) solo exige que el envío esté
  vivo y que su `client_markbox` sea del cliente activo del mismo tenant.
- **Detalle de envío** (`app/portal/(app)/envios/[code]`). Muestra el estado y el avance sin depender de
  una factura. Lo único que habla de facturar es la tarjeta «Este envío espera tu aceptación para que
  podamos facturarlo» del gate legal AUT-04.
- **Aviso «Seguimiento en construcción».** `TRACKING_EN_CONSTRUCCION = true`
  (`lib/portal/tracking-en-construccion.ts:69`, SDD-0514). La portada, Envíos y el detalle lo pintan
  mientras el almacén no registre en el sistema.
- **Facturas en el portal.** El cliente ve sus facturas vivas **menos los borradores**: la policy
  `invoices portal self read` (0452) tiene `status <> 'borrador'`, y las queries lo repiten. Tampoco ve las
  anuladas que nunca se emitieron (0556).

**Consecuencia.** Hoy un embarque del contenedor ya se ve en el portal **antes** de facturar, con el
aviso de seguimiento en construcción encima. Que solo se vea al facturar **no** se logra con un botón.
Habría que cambiar la regla del portal: un filtro nuevo en la policy 0416 y en las lecturas del portal de
las SDD-0549, 0552 y 0553, con su migración. Ese cambio cruza la 0668, que no encontré en `main` ni en
las ramas remotas al medir (§5).

### 2.2 Cómo se crea hoy una factura

- **Studio, `createInvoice`** (`app/studio/(app)/facturacion/actions.ts`):
  - Pasa la puerta `moduleEditDenial(supabase, "invoices")`.
  - Pide el código a la RPC `next_invoice_code(p_tenant_id)`, que da un correlativo atómico por tenant.
  - Inserta la factura en `borrador`.
- **Emisión, `emitInvoice`.** La pasa de `borrador` a `emitida`, pone `issued_at` y `due_date` (+30 días
  si no tenía) y pasa el gate legal AUT-04.
  - El gate está en bloqueo duro: `LEGAL_GATE_HARD_BLOCK = true` (`lib/studio/legal/gate-config.ts`).
  - Una factura DDP **no se emite** si el cliente no tiene una aceptación vigente.
- **Quién puede.**
  - El módulo `invoices` es solo de `accounting` (y `admin`) en `lib/studio/rbac.ts`.
  - La RLS lo repite. La 0407 (`invoices_accounting_insert` / `_update`) exige
    `current_studio_role() in ('accounting','admin')` para INSERT y UPDATE.
  - La 0414 hace lo mismo para SELECT.
  - Embarques (`shipments`) lo ven `commercial`, `operations`, `accounting`, `warehouse` y `support`.
  - **Hoy el rol de Embarques no puede crear, emitir ni leer facturas con su sesión.**
- **La carga de consolidados ya sabe facturar** (`scripts/consolidados/modelo.ts` y `lote-sql.ts`).
  - Hace una factura `borrador` en USD por cliente y contenedor, con `shipment_id` = el primer embarque.
  - Lleva una línea por embarque («Flete DDP · remitente · m³ × $precio», con el «PRECIO VENTA CBM» del
    Excel) más «Exceso de peso» con «PRECIO X KG EXTRA».
  - Con `--sin-facturas` no crea ninguna. Así se cargó el DDP 64 en producción (0 facturas, según la nota
    del DG del 2026-11-17).
- **Tarifa congelada (SDD-0571).** La carga de consolidados no escribe `shipment_rate_snapshots`. Los
  contenedores montados sin pasar por origen **no tienen tarifa congelada**, salvo que alguien la haya
  creado aparte.

### 2.3 Qué ve el dinero en Embarques

Por la SDD-0661, «Por cobrar» y «Cobrado» de la franja y del detalle por cliente se leen en el servidor
**solo** si el rol es `accounting` o `admin` y la puerta del módulo `invoices` deja pasar. Si no, el dato
no viaja al navegador.

## 3. Lo que implicaría el botón, según cómo responda Sam

- **Escribir `invoices` con el rol de Embarques.** La RLS 0407 no lo deja. Hay dos caminos:
  - una RPC `security definer` acotada, por ejemplo «facturar cliente del contenedor», con candado de
    tenant, rol, contenedor permitido y estado;
  - ampliar la policy.

  Los dos llevan **migración**, y el número se le pide al DG. No se usa el cliente admin desde una action
  para saltarse la RLS: rompe la frontera SDD-0357.
- **Que el cliente vea solo al facturar.** Es un cambio de la regla del portal (§2.1) y lleva migración.
  Si basta con que la factura **aparezca** en el portal (los envíos ya se ven), no hace falta tocar la
  regla.
- **Emitir una factura DDP.** Choca con el gate legal AUT-04 si el cliente no aceptó los términos. Sam
  decide si el botón se para ahí o deja el borrador.

## 4. Preguntas para Sam (cada una con la recomendación del Worker)

1. **¿Se factura por cliente dentro del contenedor o por embarque?**
   *Recomiendo por cliente dentro del contenedor.* Es la unidad que ya usa la carga de consolidados (una
   factura por cliente y contenedor, con una línea por embarque) y la del «Detalle por cliente» de la
   SDD-0661. Un cliente con 5 embarques recibe una factura, no cinco.

2. **¿De dónde sale el monto: lo escribe quien oprime, sale de la columna «valor a facturar» del Excel o
   de la tarifa congelada?**
   *Recomiendo el Excel.* La oficina pasa el valor y el sistema lo calcula con la regla de la carga de
   consolidados (precio por CBM más exceso de peso). Quien oprime ve el monto y lo **confirma**, pero no
   lo escribe a mano. La tarifa congelada no sirve aquí, porque estos contenedores no la tienen (§2.2).
   Escribirlo a mano en el botón abre errores de tipeo sin rastro de dónde salió. Si el Excel trae una
   columna «valor a facturar» distinta del cálculo, hace falta saber cuál manda.

3. **¿Qué crea: una factura del ERP en dólares o una pre-factura?**
   *Recomiendo una factura del ERP en USD, que nace en `borrador` y la emite Contabilidad.* Respeta la
   decisión 9 (la fiscal sale al llegar a Venezuela) y el gate legal. Hay que tener en cuenta que el
   borrador **no se ve en el portal** (0452). Si Sam quiere que el cliente vea el monto al oprimir, la
   factura tiene que quedar **emitida**, y entonces el botón emite y choca con el gate legal. Si no, hace
   falta un estado o una vista nueva de «pre-factura» en el portal, con su migración.

4. **Hoy solo Contabilidad y Admin ven montos (0661). ¿El rol de Embarques ve el monto?**
   *Recomiendo que no.* Embarques oprime «Facturar» sobre un monto que la oficina ya cargó y Contabilidad
   revisa. El botón dice «Facturar a N clientes» sin mostrar dinero. Si Sam quiere que Embarques confirme
   el monto (pregunta 2), hay que abrir la regla de la 0661 solo para esa pantalla y solo para esos
   contenedores.

5. **¿Cuáles son los otros tres contenedores?**
   *Recomiendo una lista cerrada de cuatro, escrita en configuración y no en el código* (por ejemplo, los
   ids de `consolidations` por tenant). Fuera de esa lista el botón no aparece, y al cerrarse la regla
   transitoria se vacía la lista. Por las notas del DG, el DDP 64 es uno de ellos. No adivino los otros
   tres.

## 5. Cruces y dependencias

- **0668.** El DG la menciona como cruce del portal. Al medir no estaba en `main` ni en las ramas
  remotas. Hay que confirmar su alcance antes de tocar la regla del portal.
- **0549, 0552, 0553 y 0556.** Lecturas del portal por principal y tenant, y facturas anuladas fuera. Si
  cambia qué ve el cliente, se tocan sus lecturas y sus pruebas de frontera.
- **0357.** La frontera de lecturas de `invoices`. Una lectura nueva se registra en el inventario.
- **0054 / AUT-04.** Gate legal al emitir una factura DDP.
- **0574 / 0571.** Flujo definitivo, embarques sin facturar y tarifa congelada. Este botón no los
  reemplaza.

## 6. Fuera de alcance (por ahora)

- Código, migraciones, producción y staging. Solo esta spec.
- Apagar `TRACKING_EN_CONSTRUCCION`. Es una decisión aparte de Sam (SDD-0514).
- El flujo definitivo de recepción en China.

## 7. Aceptación (se completa cuando Sam conteste)

Pendiente de las respuestas del §4.

## 8. Evidencia

Se registra en `.agents/handoffs/sdd-0674-boton-facturar-embarques.md`.

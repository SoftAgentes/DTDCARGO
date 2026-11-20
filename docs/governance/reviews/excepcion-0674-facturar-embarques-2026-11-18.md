# Excepciones de comportamiento · SDD-0674 — «Facturar» en Embarques (regla transitoria EXC-0674)

Estado: **aprobadas por Sam el 2026-11-18**, por el Director General (reunión con la oficina y chat del
DG: «Sí, las tres»). Dueño: Sam. Revisión: **2027-01-31**, o antes si se vacía la lista transitoria
(`exc0674_contenedores`), lo que pase primero.

Las pide [SGE-00 §7](../policies/sge-00.md) y el [índice maestro §5](../README.md): una excepción de
comportamiento lleva la política afectada, el motivo, el alcance, la mitigación, el responsable y la fecha
de revisión. Se registra como L3 (§7 del índice). Las filas de SGE-00, MP-01 y BTN-01 del registro maestro
enlazan a este documento. La spec es `docs/specs/0674-boton-facturar-embarques/spec.md` (§4, §7.2 y §8).

## Alcance común a las cinco vigentes

- **Una sola acción:** «Facturar» (un cliente del contenedor) y «Facturar contenedor» (todos los clientes
  pendientes) en `/studio/embarques`.
- **Una sola vía:** la RPC `exc0674_facturar` (migración 0564), llamada desde
  `app/studio/(app)/embarques/facturar-actions.ts`.
- **Solo los contenedores de la lista transitoria.** Hoy solo el 64. La lista solo cambia por migración o
  por una operación auditada con el OK nominal de Sam.
- **Solo los roles** `accounting` y `admin`, con una membresía activa en el tenant. Son los que ya ven
  montos. Sam, 2026-11-18: «El rol operaciones no factura y tampoco ve los valores.»
- Fuera de ese alcance rigen las políticas sin excepción.

## 1. SGE-00.01 · Toda acción debe ser predecible

- **Qué se aparta:** la etiqueta del botón es «Facturar» y no el verbo reservado «Emitir factura» (BTN-01
  §3).
- **Motivo:** es la palabra de la oficina y de Sam. El botón vive en Embarques, donde nadie más emite.
- **Mitigación:** el resultado (se emite una factura real en USD que va al portal y a la contabilidad)
  queda escrito en la pantalla de confirmación antes de ejecutar.

## 2. SGE-00.09 · La misma necesidad reutiliza el mismo patrón

- **Qué se aparta:** la confirmación no usa `ConfirmDialog`, que solo admite un mensaje de texto. Es un
  diálogo propio en `FacturarContenedor.tsx`.
- **Motivo:** la confirmación tiene que mostrar la lista de clientes con el monto grande, las cajas y el
  CBM de cada uno, y el total del contenedor (decisión de Sam).
- **Mitigación:** usa `useDialogA11y`, la misma base de foco, Esc y clic afuera que `ConfirmDialog`.
  Tiene `role=dialog`, `aria-modal`, foco inicial en «Volver», y repite los estilos del diálogo canónico.
  Si aparece una segunda necesidad igual, se propone una variante de `ConfirmDialog` por CMP-01.

## 3. BTN-01 §3 · Vocabulario oficial

- **Qué se aparta:** «Facturar» y «Confirmado», en lugar de «Emitir factura» y «Confirmar factura».
- **Motivo:** decisión de Sam (§4, preguntas 1 y 6): quien oprime «tiene que saber que eso va a ir para el
  cliente en su portal y en la contabilidad», y la palabra de la segunda confirmación es «Confirmado».
- **Mitigación:** se conserva el resto de BTN-01:
  - «Volver» a la izquierda y la primaria a la derecha;
  - `type="button"`;
  - «Emitiendo…» con `aria-busy`;
  - idempotencia en el servidor (índice único y locks);
  - el botón se oculta, y no se deshabilita, para los roles sin permiso.

## 4. MP-01 §3 · Fricción R3 sin motivo tecleado

- **Qué se aparta:** emitir una factura es R3, que pide un motivo obligatorio. Aquí no se teclea motivo.
- **Motivo:** decisión de Sam: la doble confirmación con los datos a la vista es la fricción que quiere
  para esta regla.
- **Mitigación:**
  - el evento de auditoría (`invoice_emitted_exc0674`) lleva un **motivo fijo** que nombra la excepción;
  - la pantalla muestra el monto grande, las cajas y el CBM;
  - por cliente y por contenedor completo, dos confirmaciones seguidas con los datos a la vista;
  - la factura se corrige por el camino normal: se anula en Facturación (P3).

## 5. Retirada · EXC-0674 de montos a `operations`

- **Estado:** retirada el 2026-11-18, antes de fusionar, por corrección de Sam (por el DG): «El rol operaciones no factura y tampoco ve los valores.»
- **Qué queda:** facturan y ven el monto solo `accounting` y `admin`, igual que la regla de montos de la
  SDD-0661, la RLS 0414 y la frontera SDD-0357. No hay excepción a esa regla.
- **Qué se quitó:** la RLS de `operations` en `exc0674_contenedores`, `exc0674_facturas` y
  `exc0674_factura_envios`, su rol en la RPC y la prop en Embarques. Las pruebas por rol rechazan a
  `operations`.
- Si otro rol debe facturar, será una decisión nueva de Sam, con su propio registro.

## 6. AUT-04 (SDD-0054) · Gate legal de emisión DDP en bloqueo duro

- **Qué se aparta:** las facturas de la lista se emiten **sin** la aceptación vigente de T&C que exige el
  gate (`LEGAL_GATE_HARD_BLOCK = true`).
- **Motivo:** los envíos del contenedor 64 entraron por la carga de consolidados y sus clientes no tienen
  una aceptación ligada a una cotización. Sin la excepción, el botón quedaría bloqueado para todos (spec
  §3.1 a, opción 2, decisión de Sam).
- **Alcance:** solo la RPC `exc0674_facturar` y solo la lista. `LEGAL_GATE_HARD_BLOCK` no cambia para nada
  más.
- **Mitigación:**
  - cada factura queda marcada con `legal_ack = 'exc_0674'` en `exc0674_facturas` y en `entity_audit_log`,
    con el actor real y en la misma transacción;
  - si el evento no se puede escribir, no se factura.

## 6 bis. Ampliación SDD-0690 · Emitir la pre-orden y «Facturar todo»

- **Estado:** aprobada por Sam el **2026-11-20**, por el Director General (decisiones de la SDD-0690,
  §3.4 y §7, punto 3; «Apruebo la 0690»).
- **Qué se amplía:** las excepciones 1 a 4 y la 6 (AUT-04) cubren también dos acciones nuevas en
  `/studio/embarques`:
  - «Facturar» de un cliente con pre-orden: emite la factura `borrador` que dejó la carga, con los
    precios del Excel, sin teclear monto;
  - «Facturar todo»: emite en una sola llamada todas las pre-órdenes pendientes del contenedor.
- **Vía:** la RPC `exc0674_emitir_borradores` (migración 0569), llamada desde
  `app/studio/(app)/embarques/facturar-actions.ts`. La 0569 también hace que `exc0674_facturar` rechace
  el monto tecleado de un cliente con una pre-orden viva en el contenedor (`exc0674:tiene_preorden`).
- **Mismo alcance:** solo los contenedores de la lista transitoria (hoy el 64), solo `accounting` y
  `admin`, la misma doble confirmación con «Confirmado» y la misma marca `legal_ack = 'exc_0674'` en
  `exc0674_facturas` y en la auditoría, con `origen_monto = 'borrador'`.
- **Misma fecha de revisión:** 2027-01-31, con los mismos disparadores del §7.
- **Lo reemplaza:** la SDD-0693 (aprobada por Sam el 2026-11-20) exige la aceptación de T&C en el portal
  del cliente. Cuando la 0693 cambie formalmente la AUT-04, esta ampliación y la excepción 6 se retiran.
- **Estado de la evidencia:** la 0569 **no está aplicada en ningún entorno**. Aplicarla lleva su propio OK
  nominal de Sam.

## 7. Responsable, revisión y retiro

- **Aprobador y responsable:** Sam.
- **Revisión:** **2027-01-31**, o antes si:
  - se vacía la lista transitoria;
  - se agrega a la lista un contenedor que no sea el 64;
  - aparece una factura de esta regla que haya que anular por un monto mal tecleado.
- **Retiro:** se vacía la lista (operación auditada con el OK de Sam). El botón deja de aparecer y la RPC
  rechaza todo. Para borrar los objetos está `supabase/desarmes/0564_desarme.sql`, que se niega si ya hay
  facturas de esta regla.

## 8. Estado de la evidencia

El diseño está en la PR de la SDD-0674 (#684). La migración 0564 **no está aplicada en ningún entorno**:
hasta que se aplique y se agregue el 64 a la lista, la pantalla no muestra el botón.

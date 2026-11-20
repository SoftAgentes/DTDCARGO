# Handoff — SDD-0698 «Factura: Facturar a y Entregar en» (spec)

- **Estado:** Sam contestó P-1 a P-6 el 2026-11-20. La revisión independiente pidió cambios, ya corregidos.
- **Owner:** Worker (Claude), sesión `local-sdd-0698-worker`, encargada por Dir_DTD.
- **Ruta:** `.claude/worktrees/sdd-0698-factura-direcciones-dff669`
- **Rama:** `claude/sdd-0698-factura-direcciones-dff669`, desde `origin/main` `af0f635ad` + la reserva
  `codex/sdd-reserve-0698` (`fecc7c48a`), traída con fast-forward.
- **Objetivo:** escribir solo la spec de la SDD-0698 para que Sam la apruebe. No hay código ni migraciones.
- **Permisos del encargo:** commits selectivos, push de la rama propia y PR en borrador. No fusionar. No
  leer producción. No correr `pnpm install`, vitest ni verify.

## OBJETIVO ORIGINAL

Diseñar el modelo QuickBooks que eligió Sam el 2026-11-20: una dirección fiscal por identidad, el sello
doble («Facturar a» y «Entregar en») al emitir, las dos editables en borrador, «Entregar en» por embarque y
la etiqueta «Dirección actual del cliente» para las facturas viejas.

## COMPLETADO

- `docs/specs/0698-factura-facturar-a-y-entregar-en/spec.md`, en estado `proposed`. Tiene:
  - la medición de `main` con archivo:línea (§2);
  - las decisiones de Sam (§3);
  - el modelo de datos (§4);
  - las reglas (§5) y las pantallas (§6);
  - las fases F-0 a F-4 (§7) y 18 criterios de aceptación (§8);
  - la relación con la 0694 y la 0695 (§9) y `revisar-datos-ve` (§10);
  - seis preguntas para Sam (§11), el fuera de alcance (§12), la allowlist (§13) y la gobernanza (§14).
- `docs/specs/README.md`, regenerado con `node scripts/build-docs-index.mjs`.

## Hallazgos de la medición (resumen)

- `0466:316-320`: con la factura a la principal, `client_fiscal_address` queda null. La principal no tiene
  dónde guardar su dirección fiscal (`0466:25`, «No se agrega ninguna columna a `clients`»).
- **La opción «elegir a dónde llega cada embarque» no existe.** El cliente sí puede tener varias
  direcciones y una predeterminada (`0198:22-46`, `PortalAddresses.tsx:148-220`). Pero ninguna tabla tiene
  `delivery_address_id`, y `shipments.delivery_address` (0009) es texto libre que escribe el equipo, en
  `ve/actions.ts:103-112` y `tms/actions.ts:236-239`.
- Los paquetes del despacho son recepciones de almacén (`dispatch-types.ts:36-38`), no embarques. El camino
  de una recepción a su embarque queda por medir en la F-3.
- La 0466 está aplicada en producción desde el 2026-09-19, según el ledger (lo confirmó Dir_DTD el
  2026-11-20). La cabecera «NO APLICADA» es texto viejo y la migración no se toca, porque está sellada.
  Este Worker no leyó producción.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `node scripts/build-docs-index.mjs --check` | PASÓ (670 specs) |
| `node scripts/check-numbering.mjs` | PASÓ (sin números repetidos; los choques históricos son los conocidos) |
| `git diff --check` | PASÓ |
| `pnpm verify`, vitest, `pnpm install` | NO EJECUTADO, por el encargo: es un cambio solo de docs |
| Revisión independiente | NO EJECUTADO: la lanza Dir_DTD |

## PENDIENTES DE ESTA TAREA

- Que Sam apruebe la spec completa. Después, pasar la spec a `approved`.
- La revisión independiente de la §10 antes de la F-2, como recomienda la skill.

## FUERA DE ALCANCE DETECTADO

- **Factura a nombre del aliado** (0674 con aliado raíz): no está claro si «Entregar en» debe llevar las
  direcciones de los clientes finales. Se le pasa a la SDD-0696 y lo coordina Dir_DTD (spec §12).
- `lib/studio/invoice-client-doc.ts:29` (ya en `main`) cita un conteo de clientes de producción en un
  comentario de un repo público. Dir_DTD pidió quitarlo en una PR aparte desde `main`, sin mezclarla con
  esta.

## Respuestas de Sam (2026-11-20, directo a este Worker, a pedido de Dir_DTD)

Van literales en la spec, §3, decisiones 6 a 11:

- **P-1:** la factura muestra solo la predeterminada. En el ERP va una marca «Otra dirección» en el
  embarque y el aviso «Varias direcciones… revisar» en Facturación. Por eso se quitó
  `ship_to_by_shipment` del diseño. El análisis de zonas y precio para refacturar queda para más adelante;
- **P-2:** la casilla sigue a la predeterminada;
- **P-3:** viene marcada, salvo las empresas con domicilio fiscal;
- **P-4:** el cliente puede cambiar la dirección de un embarque hasta que llega a Venezuela. Se propone
  medirlo con `arrived_destination_at`, y la F-3 lo confirma;
- **P-5:** la oficina corrige la dirección fiscal solo en el borrador;
- **P-6:** sin dirección de entrega, la factura se emite sin el bloque.

## Revisión independiente (CHANGES_REQUESTED sobre `e8fdae2e5`) y corrección

La pidió Dir_DTD. Esto se corrigió en la spec:

- **Altos.**
  - 1: la RPC `invoice_addresses` (§4.3) es la única lectura para el portal y el Studio.
  - 2: la F-1 deja una sola fuente: copia, redefine `portal_upsert_my_billing_identity` y el trigger v2
    (§4.1). El DROP de la columna vieja sale de esta SDD (§12).
  - 3: RLS, grants y auditoría de `client_fiscal_addresses` (§4.1).
- **Medios.**
  - 4: ciudad y estado pueden ir en null en la tabla.
  - 5: la llave es `billing_identity_id`.
  - 6: el trigger v3 siempre sobrescribe el id y la hora del sello; también se definen el caso sin cliente
    vivo y la clave `invoice-address:<id>`.
  - 7: la guarda del aliado (§4.2 y §5.6).
  - 8: trigger diferido, `reassign_shipment_client`, el congelado de la 0321 y la RPC filtrada por tenant
    (§4.4).
  - 9: la tabla de versiones (§4.5); las filas del registro son de la 0694 F-2, según Dir_DTD.
- **Bajos.**
  - 10: allowlist exacta.
  - 11: la 0466 y la 0569 están aplicadas; cita `0569:300-303`.
  - 12: camino de la recepción a su embarque medido (§2.6).

## Segunda vuelta de la revisión (CHANGES_REQUESTED sobre `216c4bde5`) y corrección

- **A:** `reassign_shipment_client` conserva el `delivery_address_id` de un embarque entregado y lo limpia
  solo si no está entregado. El trigger diferido no revisa los entregados (criterio 22).
- **B:** `invoice_addresses` copia el predicado completo de la 0414 y tiene un contrato de equivalencia con
  la política. El criterio 17 suma los casos de otro tenant con el mismo Shipping Mark, la factura borrada,
  el vínculo inactivo y el cliente borrado.
- **C:** la guarda del aliado mira todos los embarques de la factura, `shipment_id` más los
  `shipmentCode` de las líneas, con `invoice_ships_to_others` (criterio 16).
- **D:** la rama de las facturas viejas aplica la misma guarda.
- **E:** la reasignación también pone `ship_to_address` en null en las pre-órdenes que mueve.
- **F:** el trigger diferido es `security definer`. `fuentes-unicas.md` va en la allowlist de la 0694 F-2,
  según Dir_DTD.

## Tercera vuelta de la revisión (CHANGES_REQUESTED sobre `2f73f707c`) y corrección

- **1:** hay una regla única, `shipment_chosen_delivery_address` en SQL y `direccionElegidaDelEmbarque`
  en TypeScript. Solo devuelve la dirección si es del cliente vivo actual del embarque, y la usan todos los
  lectores. El criterio 22 cubre el embarque entregado que se reasigna.
- **2:** bordes de `invoice_ships_to_others`: otro tenant, `lines` que no es un arreglo, código sin embarque
  vivo y el respaldo de `exc0674_facturas` en las facturas viejas (criterio 16).
- **3:** límite de la FK contra la 0321, solo en el borrado permanente (§4.4).
- **4:** este handoff, con la dueña de las filas del registro corregida.

## Cuarta vuelta de la revisión (CHANGES_REQUESTED sobre `41386e7bb`) y corrección

- **1:** las dos RPC del portal copian la política «shipments portal self read» (`0416:40-53`), sin
  `get_portal_client_id()`, y tienen un contrato de equivalencia. La de leer devuelve solo lo de la
  tarjeta, sin `reference`. El criterio 20 aplica los mismos casos a las dos.
- **2:** sin espejo en TypeScript. La regla del embarque y el formato viven solo en SQL; el Studio lee por
  `studio_get_shipment_delivery` y por `invoice_addresses`. La regla de la predeterminada, que comparte con
  la 0694, usa un solo fixture JSON.
- **3:** el `select` de tabla de `shipments` pasa a columnas, sin `delivery_address_id` (42501), con un
  contrato de columnas. Lector medido que se rompería: `app/api/studio/shipments/[id]/route.ts:140-145`
  (`.update().select()`). Las funciones con `select s.*` son `security definer` y no se rompen.
- **4:** allowlist de la F-3 con `shipment-queries.ts`, `invoice-queries.ts` y la ruta de la API.

## Quinta vuelta de la revisión (CHANGES_REQUESTED sobre `f993238fd`) y corrección

- **1 (bloqueante):** se agregó el POST `app/api/studio/shipments/route.ts:105-123`
  (`.insert().select().single()`) a la medición y a la allowlist. Hay una guarda nueva,
  `lib/studio/__tests__/shipments-select-explicito.test.ts`. La medición recorrió `app/`, `lib/`,
  `components/` y `hooks/`, y solo salieron el POST, el PATCH y una prueba con un doble.
- **2:** `studio_get_shipment_delivery` usa el predicado vigente después de la 0230, sin `deleted_at`.
- **3:** el fixture lo crea la 0694 F-1; la 0698 solo lo lee.
- **4:** se sumaron 0305, 0318, 0320 y 0496 a la lista de funciones `security definer`.

## Impacto documental

- La spec y el índice. No cambia ningún documento canónico.
- Cuando se apruebe, la 0695 tiene que sumar a su §2.1 (copias intencionales) las columnas selladas de
  esta spec. La fila para la tabla §5 de la 0695 se la pasé a Dir_DTD. **Las filas del registro de fuentes
  únicas las escribe la 0694 F-2** (decisión de Dir_DTD, 2026-11-20), y la 0698 solo las cita (spec §9).

## HANDOFF AL DIRECTOR

- La PR va en borrador. Sin código: no requiere `gh pr ready` hasta que Sam conteste.
- Orden de fases propuesto: 0694 F-1, luego 0698 F-1, después 0694 F-2, luego 0698 F-2, y al final 0698 F-3.
  La 0698 F-3 va después de la 0694 F-1 porque las dos tocan `dispatch-mobile-queries.ts`.

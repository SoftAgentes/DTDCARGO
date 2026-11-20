# Handoff — SDD-0698 «Factura: Facturar a y Entregar en» (spec)

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

## Impacto documental

- La spec y el índice. No cambia ningún documento canónico.
- Cuando se apruebe, la 0695 (§4.1, el registro de fuentes únicas, y §2.1, las copias intencionales) tiene
  que sumar las filas que propone la §9 de esta spec. Lo hace la fase F-1 de la 0695 o la 0698 F-1, según
  cuál llegue primero a `main`.

## HANDOFF AL DIRECTOR

- La PR va en borrador. Sin código: no requiere `gh pr ready` hasta que Sam conteste.
- Orden de fases propuesto: 0694 F-1, luego 0698 F-1, después 0694 F-2, luego 0698 F-2, y al final 0698 F-3.
  La 0698 F-3 va después de la 0694 F-1 porque las dos tocan `dispatch-mobile-queries.ts`.

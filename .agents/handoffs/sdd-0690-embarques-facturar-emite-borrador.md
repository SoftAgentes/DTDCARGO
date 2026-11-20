# Handoff · SDD-0690 — Embarques: «Facturar» emite la pre-orden, «Facturar todo» y «Facturado»

Fecha: 2026-11-20.

- Owner: Worker 0689/0690.
- Rama: `claude/sdd-0690-facturar-emite-borrador`.
- Worktree: `DTD-worktrees/sdd-0690-facturar-borrador`.
- Base: `origin/main` `765f3954a`, con merge de main después de la 0689.
- La rama de reserva `codex/sdd-reserve-0690` no se toca: es el candado del número.

## Estado

- **Spec `in-progress`**, aprobada por Sam el 2026-11-20 («Apruebo la 0690»), sin abonos sobre pre-órdenes.
- **Implementación** en la rama, según la allowlist del §6.
- **La 0569 NO está aplicada en ningún entorno.** Aplicarla y cargar las pre-órdenes del 64 llevan cada
  una su OK nominal de Sam, y las corre el DG.

## Decisiones de Sam (2026-11-20, por el DG)

1. El precio: en el 64 manda el Excel y en Embarques no se edita. El monto en color enlaza a la factura o a
   la pre-orden. En la pantalla se dice «pre-orden».
2. Un cliente sin precio en el Excel: monto tecleado, como hoy.
3. La aceptación de T&C se exige en el portal (SDD-0693). La RPC emite bajo la EXC-0674 ampliada a
   pre-orden y «Facturar todo», con el mismo alcance y la misma fecha.
4. El resumen de dinero es la versión B: Total del embarque / Pagado / Saldo, con «Sin facturar» como
   desglose.

## Hecho (spec §6)

- **0569** (`5724af9e2`), con su desarme, su contrato y su prueba de carrera:
  - RPC `exc0674_emitir_borradores`, todo o nada;
  - no cambia ni el código ni el total;
  - asiento atómico;
  - rastro con `origen_monto = 'borrador'` y auditoría `invoice_emitted_exc0674_borrador`;
  - espera declarada en el baseline y en las declaraciones de símbolos.
- **Cargador** (`cc4ad4015`): `--solo-facturas` para un contenedor ya cargado.
  - Es idempotente por cliente y su preflight exige que el contenedor esté en `exc0674_contenedores`.
  - Toma el mismo candado que `exc0674_facturar`.
  - El ensayo es `simulacro.sql`, que termina en `rollback`.
- **Embarques** (`fb0afae8b`):
  - la acción `emitirPreordenesExc0674Action`;
  - en `FacturarContenedor`, la pre-orden con enlace y «Facturar», «Facturar todo» y «Facturado»;
  - el resumen B en la franja y en el detalle, con el total enlazado a la factura o a la pre-orden;
  - el peso y el dinero de la franja y del pie sobre el contenedor entero.
- **`leerMontosDeContenedores`** trae `id, invoice_code`, con OK del DG (`43a576b10`). La prueba del
  servidor comprueba que no viajan sin `montos`.

## Desviaciones registradas

- La columna se llama `origen_monto`, no `origen`, porque `origen` daba ROJO en el gate de símbolos (la
  palabra ya la usan otras tablas). OK del DG del 2026-11-20. La spec está alineada.
- El botón «Facturar contenedor (N clientes)» de la 0674 se queda solo cuando no hay pre-órdenes. Con
  pre-órdenes aparece «Facturar todo», y los clientes sin precio se facturan uno por uno.

## Evidencia

| Comprobación | Resultado |
|---|---|
| `pnpm install --frozen-lockfile` (turno del DG) | PASÓ |
| vitest (`--pool=threads --maxWorkers=1`) de Embarques, del dinero en `lib` y del cargador | PASÓ: 18 archivos, 252 pruebas |
| `tsc --noEmit` | PASÓ |
| eslint de los 14 archivos tocados | PASÓ: 0 errores; 3 avisos en `generar-lote.ts:319` que ya estaban en main |
| `migrations-lock verificar --sin-base` | PASÓ: 1 espera sin sellar, la 0569 |
| `check-pending-migration-symbols` | PASÓ: 0 ROJO, 1 AMARILLO declarado |
| docs:check / sdd:check | PASÓ |
| Contratos SQL (`run-sql-tests.mjs`, Postgres efímero en Docker; turno del DG) | PASÓ: 317 contratos con rollback, incluidos la 0564, la 0569 y sus dos carreras |

## revisar-datos-ve (acotado al diff, 2026-11-20)

No es asesoría legal: es un inventario técnico.

- **Inventario.** No hay campos personales nuevos. Se tratan los mismos datos que la 0564:
  - `invoices`: titular `billed_markbox` y nombre que sella el trigger 0466;
  - `client_markbox` del envío;
  - `exc0674_facturas`: `tecleado_por` (uid de quien emite).
  - La columna nueva `origen_monto` no es un dato personal.
- **CORRECTO:**
  - La auditoría de la 0569 guarda Shipping Marks, código y montos, pero no nombres
    (`0569_exc0674_emitir_borradores.sql:320-326`).
  - La acción usa el nombre solo para el correo `invoice_emitted` en el servidor, y al navegador le
    devuelve Shipping Mark, código y total (`facturar-actions.ts:160-171`, `:181-188`).
  - Los avisos del cargador `--solo-facturas` llevan solo conteos (`lote-sql.ts:1382`, `:1480`, `:1517`,
    `:1552`).
  - El `id` y el código de factura solo viajan con `montos` (prueba en `page-monto-por-rol.test.ts:127`).
- **NO VERIFICABLE:** la carga real del 64 y sus datos, porque es producción y no se leyó. La revisión
  legal del aviso al cliente al emitir y de la retención del rastro `exc0674_*` es para un abogado.

## Pendientes de esta tarea

1. `revisar-datos-ve`, la PR de implementación y la revisión que lanza el DG.
2. Antes de la carga del 64, que no es parte de esta PR (spec §3.1):
   - el ensayo de `--solo-facturas` con `rollback` en una base local;
   - el OK nominal de Sam;
   - aplicar la 0569, con su propio OK.

## FUERA DE ALCANCE DETECTADO

- `lib/studio/exc0674.ts` (`mensajeErrorExc0674`) no tiene texto propio para los errores nuevos de la
  0569 (`no_borrador`, `factura_inexistente`, `envio_fuera_del_contenedor`, `borrador_alterado`) y muestra
  el genérico «No se pudo facturar. No se emitió ninguna factura.». Está fuera de la allowlist.
- Registrar abonos sobre una pre-orden: hoy el cobro y el reporte de pago rechazan los borradores (spec §8).
- La cabecera de la 0564 dice «NO APLICADA», aunque se aplicó el 2026-11-18. La sella el DG aparte.
- La spec y el handoff de la 0674 deben anotar que el 64 entró a `exc0674_contenedores`, sin ids.
- `next_invoice_code` calcula max + 1 sin candado (0077).

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

## Revisión de la PR #719 (CHANGES_REQUESTED sobre `dc1fd86b7`, 2026-11-20)

Arreglado en el commit que sigue a `dc1fd86b7`:

1. **(Alta) «Facturar» sobre lo filtrado.** `GrupoContenedor.completo` trae ahora `clientes` (el
   contenedor entero, sin pestaña ni búsqueda). `FacturarContenedor` y `preordenesDeGrupo` usan
   `grupo.completo.clientes`: los clientes, las pre-órdenes, «Facturar todo» y «Facturado» ya no dependen
   del filtro.
   - Un cliente con una pre-orden viva en $0 o en otra moneda no va al camino tecleado: la fila dice
     «Pre-orden sin monto válido: corrígela en Facturación», con el enlace y sin botón.
   - Defensa en la base: la 0569 redefine `exc0674_facturar` para que rechace el monto tecleado de un
     cliente con una pre-orden viva en el contenedor (`exc0674:tiene_preorden`). El desarme restaura la
     definición de la 0564. Tiene su prueba SQL.
   - Pruebas de pantalla: con la búsqueda dejando fuera el envío de la pre-orden no se ofrece teclear y
     «Facturar todo» la emite por id. Con un filtro, «Facturado» sigue cubriendo el contenedor entero.
     También hay pruebas para la pre-orden en $0 y en otra moneda.
2. **(Media) Registro EXC-0674:** el §6 bis anota la ampliación, con el OK de Sam del 2026-11-20, el mismo
   alcance, la fecha 2027-01-31 y que la SDD-0693 la reemplazará.
3. **(Media) «Facturado» del encabezado según la §3.5.** `contenedorFacturado` exige que todos los
   clientes del contenedor entero tengan una factura emitida viva y ninguna pre-orden pendiente. La
   insignia va en la cabecera (`encabezado-facturado`). `textoSinMonto` dice «Facturado» solo en ese caso.
   Si no hay pre-órdenes pero algún cliente no tiene precio, dice «Clientes sin precio». Hay prueba de
   «uno facturado y otro sin precio».
4. **(Baja) Pruebas:**
   - la §5.7, el peso de la franja y del pie con un filtro;
   - `page-monto-por-rol.test.ts`, con un doble que trae `id`/`invoice_code` y comprueba `documentos` en
     el caso positivo.
5. **(Baja) Otros:**
   - `mensajeErrorExc0674` tiene los textos de los errores nuevos, autorizado fuera de la allowlist y
     anotado en el §6;
   - la fila «Facturada {código}» enlaza a la factura;
   - las líneas de mapeo de `embarques-contenedores-queries.ts` quedan cubiertas por el OK del DG.

## Desviaciones registradas

- La columna se llama `origen_monto`, no `origen`, porque `origen` daba ROJO en el gate de símbolos (la
  palabra ya la usan otras tablas). OK del DG del 2026-11-20. La spec está alineada.
- El botón «Facturar contenedor (N clientes)» de la 0674 se queda solo cuando no hay pre-órdenes. Con
  pre-órdenes aparece «Facturar todo», y los clientes sin precio se facturan uno por uno.

## Evidencia

Corridas sobre los arreglos de la revisión (turno de PC del DG, 2026-11-20):

| Comprobación | Resultado |
|---|---|
| `tsc --noEmit` | PASÓ (tras corregir un `readonly` en `clientesDe`) |
| eslint de Embarques y de los archivos de `lib` tocados | PASÓ: 0 errores |
| vitest (`--pool=threads --maxWorkers=1`) de Embarques, de `lib`, `spec-migration-refs`, `consolidados-sql`, `rbac-actions-guard` e `invoice-read-boundary` | PASÓ: 20 archivos, 795 pruebas |
| Contratos SQL (`run-sql-tests.mjs`, Postgres efímero) | PASÓ: 317, incluidos la 0569 y su carrera reescrita |
| `migrations-lock --sin-base` / gate de símbolos | PASÓ: 1 espera (0569) · 0 ROJO, 1 AMARILLO |

En la primera corrida falló la carrera «REAL 1b». Daba por hecho que una transacción abortada guarda sus
locks consultivos hasta el `rollback`, pero Postgres los suelta en el momento del error. La propiedad sí
se cumplía: el tecleado falló con `tiene_preorden` y se emitió solo la pre-orden. Quité de esa aserción la
exigencia de espera.

La tabla de abajo es la evidencia anterior, sobre `dc1fd86b7`.

- `pnpm verify`: **NO EJECUTADO**. Es pesado (incluye el build). El portón es la CI de GitHub más la
  revisión independiente.
- `/ui-check` del diff de Embarques (2026-11-20), solo lectura: **OK con ajustes menores**, no
  bloqueante.
  - Solo tokens `var(--*)`, sin hex nuevos y sin AI slop.
  - Los componentes son los del sistema (`Badge`, `Link`, `studio-btn`).
  - Los tamaños de fuente en px siguen el patrón que ya tiene el archivo.
  - Las copias van en tuteo.
  - (Baja) El aviso «Pre-orden sin monto válido» es texto plano. Si Sam lo quiere más visible, puede ir
    con un `Badge` en tono de atención.

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

1. La nueva revisión del DG sobre el commit de los arreglos.
2. Antes de la carga del 64, que no es parte de esta PR (spec §3.1):
   - el ensayo de `--solo-facturas` con `rollback` en una base local;
   - el OK nominal de Sam;
   - aplicar la 0569, con su propio OK.

## Seguimiento después de fusionar (2026-11-20)

- **#719 fusionada** (`78aa5edd9`). El DG aplicó la 0569 en producción a las 20:11:34Z, con el OK de Sam (lectura previa y verificación PASÓ, md5 `9cd8b758…`). El sello va en la #731.
- **Id propio para `--solo-facturas`** (rama `claude/sdd-0690-solo-facturas-id-propio`, con revisión previa del DG). La carga v2 del 64 y sus pre-órdenes salían del mismo Excel con el mismo id, `carga-consolidado:64:6303f821`. Por eso `aplicar-lote.sh:231-238` se negaba a aplicar las pre-órdenes («ya se aplicó»), y el OK viejo de la carga pasaba su guarda.
  - Ahora el paquete es `…:facturas`.
  - El contenedor y sus envíos se siguen buscando por el id de la carga.
  - La regex de «copia de resumen.md» de `aplicar-lote.sh` acepta el sufijo. Su prueba nueva falla sin el arreglo: la probé con el mutante.
  - Evidencia: `prueba-aplicar-lote.sh` 75 PASÓ · 0 FALLÓ (1 OMITIDA, la del `ulimit`). El vitest de `consolidados-sql` va en el turno de PC.
- **Ensayo:** el DG acepta como ensayo el simulacro de producción (termina en ROLLBACK, solo conteos). No hace falta el ensayo local de la §3.1.
- **Exceso de peso:** lo decide Sam, y el DG le pregunta. El generador acepta las dos opciones (`--sin-exceso-peso`).

## FUERA DE ALCANCE DETECTADO

- Registrar abonos sobre una pre-orden: hoy el cobro y el reporte de pago rechazan los borradores (spec §8).
- Un cliente con DOS pre-órdenes vivas en el mismo contenedor: Embarques emite una sola (la primera
  válida). El cargador deja una por cliente, así que hoy no pasa.
- La cabecera de la 0564 dice «NO APLICADA», aunque se aplicó el 2026-11-18. La sella el DG aparte.
- La spec y el handoff de la 0674 deben anotar que el 64 entró a `exc0674_contenedores`, sin ids.
- `next_invoice_code` calcula max + 1 sin candado (0077).

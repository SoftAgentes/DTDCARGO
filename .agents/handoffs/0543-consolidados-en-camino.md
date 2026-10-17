# Handoff 0543 · Consolidados en camino: carga de contenedores desde el packing list

- Fecha: 2026-10-16 (Caracas = UTC − 4)
- Owner/sesión: `6f7f92-consolidados-en-camino` (Claude Code, Worker, sesión «Cargar los consolidados en camino como llegadas a China»). Claim del harness tomado al empezar.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO/.claude/worktrees/suspicious-hofstadter-ccafd8`
- Rama: `claude/suspicious-hofstadter-ccafd8`, base `main` `2ad5653c` (fast-forward desde `dc84d94f` por indicación del Director).
- SDD: [0543](../../docs/specs/0543-consolidados-en-camino/spec.md), `in-progress`. Número asignado por el Director; reserva `refs/heads/codex/sdd-reserve-0543-consolidados-en-camino` (`2946e8cf`), publicada por él. La reserva previa 0546 (`57e2401f`) se borró por su indicación.
- Migración: ninguna (la siguiente libre era 0492).
- Permisos: commits locales y PR en borrador contra `main` cuando el Director autorice publicar la rama. Producción no se toca. Prueba: autorización literal de Sam «autorizo cargar datos reales de los consolidados en prueba»; antes de escribir en prueba se avisó al Director y se coordinó con la sesión «Contabo VPS y dockerización de proyectos». Nunca se imprimen ni copian claves de prueba.

## OBJETIVO ORIGINAL

Cargar en el Studio los contenedores que ya zarparon (59 primero) desde los Excel de Yiwu: recepciones en China fechadas un día antes de la carga, consolidación con contenedor/naviera/ETA, envíos por cliente visibles en el Portal y una factura por cliente en borrador; probar en prueba antes de decidir producción con Sam.

## COMPLETADO

- Spec 0543 con las decisiones de Sam (2026-10-16): factura por cliente y contenedor en borrador; código de envío = Remitente; lote SQL por psql; recepciones 2026-08-10, zarpe 2026-08-11, ETA 2026-10-19; sin avisos en esta fase.
- Generador `scripts/consolidados/` (`pnpm consolidados:lote`): lectores de los dos Excel, modelo puro, cinco scripts (previa, simulacro, aplicar, verificar, deshacer) + manifiesto + resumen + SHA256SUMS. 39 pruebas unitarias sobre fixtures inventados.
- `infra/ops/consolidados/aplicar-lote.sh` (sólo `*-staging`) con su prueba bash (19 casos).
- Portal: tarjeta «por aceptar» en Mis facturas, nota en el estado de cuenta y puerta del detalle en vez de 404 (`PendingInvoiceGate`), con pruebas.
- Evento `carga_en_camino` en el catálogo de avisos (sólo catálogo y copy).
- Runbook `docs/runbooks/cargar-consolidados.md`.
- Corrida en seco del 59 (fuera del repo, `DTD-consolidados/59/2026-10-16`): lote `carga-consolidado:59:8dd77b3c` · 50 envíos · 50 recepciones · 98 items · 1.288 cajas · 33 clientes · 33 facturas · 68,811 m³ · 20.373,45 kg · base $48.652,84 (flete $47.241,75 + excesos de peso $1.411,05). 19 avisos en `resumen.md` (remitentes sin secuencia, uno con barra corregido, 7 embarques sin peso, 2 a $0, la fila de totales del Excel difiere en 3 cajas/0,043 m³/10 kg).
- `purgar.sql` (pedido del Director): borrado definitivo para prueba, físico y en orden de dependencias, incluidos los clientes y aliados que el lote creó; se niega fuera de la base de prueba (busca el cliente sintético de la semilla) y termina con conteo cero por lote. Paso `purgar --confirm-purga <id>` en `aplicar-lote.sh`. El log de auditoría (append-only, sin nombres) queda como registro.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `vitest run scripts/__tests__/consolidados-*.test.ts` | PASÓ (39) |
| `bash infra/ops/tests/prueba-aplicar-lote.sh` | PASÓ (21, con purgar) |
| `vitest run lib/portal/__tests__/pending-acceptance.test.ts`, `PendingInvoiceGate.test.tsx`, `client-notification-types.test.ts`, `app/portal/(app)/page.test.tsx`, `portal-legal-queries.test.ts` | PASÓ (41) |
| `tsc --noEmit` (proyecto completo) | PASÓ (0 errores) |
| `eslint` sobre los archivos tocados | PASÓ |
| `pnpm lint` completo | ver sección de cierre |
| `pnpm docs:check`, `pnpm sdd:check` | PASÓ |
| `/ui-check` sobre el Portal | OK para commit (un ajuste aplicado: sin monto repetido con una sola factura) |
| `pnpm verify` completo | NO EJECUTADO (corrida pesada: turno del Director) |
| Corrida local completa del lote (postgres:17 + stubs + 467 migraciones, contenedor `dtd-0543-lote59`, turno del Director, 2026-10-16 23:26Z, 32 s) | PASÓ: previa → simulacro (ROLLBACK, 0 filas) → aplicar (33 fact · 50 rec · 50 env · 1 cons · 36 cli · 3 ali) → verificar PASÓ (50/50/1288/98/33 · 68,811 m³ · 20.373,45 kg · $48.652,84) → previa repetida con conflictos 1/1/50/50/33 → aplicar repetido abortado en preflight → deshacer (vivos 0) → aplicar abortado por «códigos BORRADOS ocupados» → purgar (conteo cero) → aplicar + verificar + purgar otra vez (cero). Contenedor y volúmenes borrados (`docker ps -a`/`volume ls` filtrados: 0). Evidencia local sin nombres en `DTD-consolidados/59/2026-10-16-v5/local-20261016T232558Z/`. |
| Carga en prueba (previa → simulacro → aplicar → verificar), Contabo, `dtd-cargo-staging` | **PASÓ** el 2026-10-16 23:28:39Z–23:28:43Z con la v5 (e2cbeec0): los cuatro pasos con código 0; previa conflictos 0 y 33 marcas sin resolver; simulacro ROLLBACK; aplicar COMMIT (50 envíos · 50 recepciones · 98 items · 33 facturas · 33 clientes creados + 3 raíces de aliado); verificar PASÓ · 50 · 50 · 1288 cajas · 98 · 33 · 68.811 m³ · 20373.45 kg · $48652.84. Evidencia sin nombres en `/srv/ops/evidencias/lote-carga_consolidado_59_8dd77b3c-dtd-cargo-staging-20261016T2328{39Z-previa,39Z-simulacro,41Z-aplicar,42Z-verificar}`. Intentos previos parados en el simulacro sin dejar nada: v1 `next_markbox` (sesión), v2 guard de marcas de aliado, v3 alias `e`/`r`; v4 sólo previa. Paquete v5 en `/srv/ops/paquetes/lote-59/` (700 root) hasta el cierre; deshacer/purgar sin correr. |
| Purga de la v5 y carga de la v6 (sin exceso de peso) en prueba, Contabo, con OK del Director | **PASÓ** el 2026-10-17 00:15:55Z–00:16:23Z: purgar v5 con conteo cero (33 facturas · 50 recepciones · 50 envíos · 1 contenedor · 1 zarpe · 1 naviera · 36 clientes · 3 aliados; sin FK que abortara), `ls` del paquete vacío antes de copiar la v6, previa (0 conflictos, 33 sin resolver), simulacro ROLLBACK, aplicar COMMIT, verificar PASÓ · 50 · 50 · 1288 · 98 · 33 · 68.811 m³ · 20373.45 kg · $47241.79. Evidencia en `/srv/ops/evidencias/lote-carga_consolidado_59_8dd77b3c-dtd-cargo-staging-20261017T00{1555Z-purgar,1618Z-previa,1619Z-simulacro,1621Z-aplicar,1623Z-verificar}`. Es la carga que queda en prueba para el smoke de Sam. Paquete v6 (700 root) hasta el cierre. |

## COMMITS

- `1b2bbf78` docs: spec, handoff y runbook
- `9e067b5a` feat(studio): generador Excel → lote SQL
- `91939b1d` chore(ops): aplicar-lote.sh + prueba bash
- `abb2805e` feat(portal): facturas por aceptar y puerta del detalle
- `d7e08db1` feat(studio): evento carga_en_camino

## PR / BRANCH

Rama `claude/suspicious-hofstadter-ccafd8` publicada (push autorizado por el Director el 2026-10-16 ~23:05Z). PR en borrador contra `main`: [hailuwaycom-sketch/DTDCARGO#260](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/260). Sin merge: fusionar lo decide Sam (un merge a main publica solo).

## Cifras corregidas (pedido del Director)

La primera lectura a ojo decía 39 remitentes, 99 filas, 1.285 cajas y ≈ $47.210: contaba sólo las filas con marca `DTD-` y copiaba la celda de total del Excel. El generador mide fila por fila: 98 filas con Remitente (la 99.ª es la de totales), 50 remitentes (los aliados DC/MMVE/TEJ suman 11), 1.288 cajas (la SUM del Excel no cubre todas las filas: 3 cajas, 0,043 m³ y 10 kg de diferencia), flete $47.241,75 por «TOTAL FACTURADO» y $1.411,05 más de excesos de peso. Spec y handoff llevan estas cifras.

## PENDIENTES DE ESTA TAREA

- Correr el lote en prueba (Contabo) y registrar evidencia y smoke de Sam (CN, Naviera, Tracking, Facturación, Portal). Primer intento 2026-10-16 22:56Z: previa PASÓ, simulacro falló en `next_markbox` (candado de sesión); corregido en 62a1960e. Segundo intento 23:07Z (v2): previa PASÓ, simulacro falló en el guard `clients_guard_markbox_aliado_t` (un cliente de aliado exige `<cadena>-NNNN`, la marca del Excel era `DC-01-ALESS`); corregido en 2fcbaf80 (marca calculada como `next_markbox_aliado`, sin la función); paquete v3 (aplicar.sql `f6d5e86a…`) entregado a Contabo y reemplazado por el v4 (aplicar.sql `51dc5074…`, previa `68f89c12…`) tras encontrar Contabo en `previa.out` la clave `DC-01-ALESS` (texto del Excel con parte de un nombre). Lección registrada: lo que psql escribe en la evidencia del servidor son columnas proyectadas, NOTICEs y errores de la base, y los tres pueden citar literales; desde 5ced2d3b previa imprime etiquetas `PREFIJO-#n` para marcas sin número, el preflight imprime conteos y verificar no lista códigos de embarque. Contabo tapó las filas con texto en las evidencias v2 y v3 (NOTA.txt + SHA256SUMS).
- Borrado final de prueba (pedido de Sam y del Director): `purgar` (o reinicio) + borrar el paquete completo de `/srv/ops/paquetes/lote-59/` (v1 y v2: todos sus archivos llevan nombres) + la evidencia vieja con nombres (`…-20261016T225630Z/`, previa.out de la v1). Contabo confirma con nombre de carpeta y `ls` vacío.
- Decisión de Sam (2026-10-16, ~23:40Z): **sin exceso de peso** («No cobres el exceso de peso: regenera el lote del 59 con --sin-exceso-peso»). v6 generada desde 3df1cb2e con esa bandera: mismos conteos, base $47.241,79 (Excel $47.241,75; $0,04 de redondeo por cliente); validada en local a las 00:13Z (secuencia completa con purga y recarga). Huellas: aplicar.sql `dac10662…`, verificar `cd9b89dd…`, previa/deshacer/purgar iguales a la v5. Pedido al Director el OK para purgar la v5 en prueba y cargar la v6; Contabo tiene la secuencia (purgar → reemplazar paquete → previa → simulacro → aplicar → verificar) y espera ese OK.
- Decisión de Sam (2026-10-17): las dos filas a $0 de DTD-J000 entran como líneas en $0, como están (la v6 ya las trae así; sin regenerar).
- Pendientes de Sam que el lote deja a la vista: remitentes sin secuencia (`DTD-A068`, `DTD-9011`, `MMVE-41/041`) y 1.288 vs 1.285 cajas de la fila de totales (informativos; no cambian el lote).
- `pnpm verify` completo con turno del Director.
- Contenedores 60–64 y la bodega pendiente (mismo generador; el 60 con el modelo FCL + DDP de la spec §D).
- Producción, flip de `TRACKING_EN_CONSTRUCCION`, emisión automática al aceptar y el aviso `carga_en_camino`: se deciden con Sam después del 59.

## FUERA DE ALCANCE DETECTADO

- `changeReceiptStatusAction` consolida contra un envío `C-YYYY-NNNN` sin cliente que el Portal no ve (`lib/studio/expense-alerts-queries.ts:88-135`).
- No hay acción para darle dueño a una recepción huérfana (migr 0469:114-122).
- `docs/runbooks/aplicar-migraciones-prod.md` sigue describiendo Supabase Cloud y no hay procedimiento para cargas de datos en el VPS.
- `MARKBOX_REGEX` (`lib/studio/markbox-utils.ts:18`) deja fuera marcas legadas y de aliados.
- Comisiones por agente del Excel (`Agente`, `GANANCIA POR ENVIO`) no tienen entidad en el ERP.
- `scripts/next-number.mjs --reserve` deja también `refs/dtd/reservations/NNNN`; al borrar una reserva abandonada hay que borrar las dos refs.

## HANDOFF AL DIRECTOR

1. Autorizar publicar la rama y abrir la PR en borrador.
2. Turno para `pnpm verify` completo.
3. Resultado de la carga en prueba (Contabo) y smoke de Sam; después, con Sam: excesos de peso, $0, producción.

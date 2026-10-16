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
| Carga en prueba (previa → simulacro → aplicar → verificar) | PENDIENTE: pedida a la sesión Contabo el 2026-10-16 22:55Z |

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

- Correr el lote en prueba (Contabo) y registrar evidencia y smoke de Sam (CN, Naviera, Tracking, Facturación, Portal).
- Decisiones de Sam que el lote deja a la vista: excesos de peso ($1.411,05, `--sin-exceso-peso` los apaga), filas a $0 (cliente DTD-J000), remitentes sin secuencia (`DTD-A068`, `DTD-9011`, `MMVE-41/041`), 1.288 vs 1.285 cajas de la fila de totales.
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

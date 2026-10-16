# Handoff 0543 · Consolidados en camino: carga de contenedores desde el packing list

- Fecha: 2026-10-16 (Caracas = UTC − 4)
- Owner/sesión: `6f7f92-consolidados-en-camino` (Claude Code, Worker, sesión «Cargar los consolidados en camino como llegadas a China»). Claim del harness tomado al empezar.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO/.claude/worktrees/suspicious-hofstadter-ccafd8`
- Rama: `claude/suspicious-hofstadter-ccafd8`, base `main` `2ad5653c` (fast-forward desde `dc84d94f` por indicación del Director).
- SDD: [0543](../../docs/specs/0543-consolidados-en-camino/spec.md), `in-progress`. Número asignado por el Director; reserva local `refs/heads/codex/sdd-reserve-0543-consolidados-en-camino` (`2946e8cf`, sin publicar). La reserva previa 0546 (`57e2401f`) se borró por indicación del Director.
- Migración: ninguna en este corte (la siguiente libre era 0492).
- Permisos: commits locales y PR en borrador contra `main`. Producción no se toca. Prueba: autorización literal de Sam «autorizo cargar datos reales de los consolidados en prueba»; antes de escribir en prueba se coordina con la sesión «Contabo VPS y dockerización de proyectos» y se avisa al Director con el lote (sha256, conteos) y la hora. Nunca se imprimen ni copian claves de prueba.

## Objetivo

Cargar en el Studio los contenedores que ya zarparon (59 primero) desde los Excel de Yiwu: recepciones en China fechadas un día antes de la carga, consolidación con contenedor/naviera/ETA, envíos por cliente visibles en el Portal y una factura por cliente en borrador. Detalle y decisiones en la spec.

## Estado

- Plan aprobado por Sam el 2026-10-16 (decisiones en la spec §Decisiones).
- Archivos fuente leídos desde `Downloads` (sin copiarlos al repo): rastreo (hoja «DTD», #59 = BMOU5488081, CMA CGM, carga 2026-08-11, La Guaira) y packing list del 59 (99 filas, 24 marcas `DTD-L999`, aliados `MMVE`/`DC`/`TEJ`, 39 remitentes, 1.285 cajas, 68,77 CBM, ≈ $47.210).
- Pendiente: generador, pruebas, corrida en seco, carga en prueba, Portal.

## FUERA DE ALCANCE DETECTADO

- `changeReceiptStatusAction` consolida contra un envío `C-YYYY-NNNN` sin cliente que el Portal no ve (`lib/studio/expense-alerts-queries.ts:88-135`).
- No hay acción para darle dueño a una recepción huérfana (migr 0469:114-122).
- `docs/runbooks/aplicar-migraciones-prod.md` sigue describiendo Supabase Cloud y no hay procedimiento para cargas de datos en el VPS.
- `MARKBOX_REGEX` (`lib/studio/markbox-utils.ts:18`) deja fuera marcas legadas y de aliados.
- Comisiones por agente del Excel (`Agente`, `GANANCIA POR ENVIO`) no tienen entidad en el ERP.

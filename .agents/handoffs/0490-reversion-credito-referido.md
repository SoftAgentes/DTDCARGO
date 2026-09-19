# Handoff 0490 · el crédito de referido no pisa el pagado ni el estado de la factura

- Fecha: 2026-09-19. Estado de la tarea: **lista para revisión**.
  Falta que el Director revise e integre la PR; al integrarse se despliega.
- Owner/sesión: `worker-reversion-credito-0490-20260919` (Claude Opus 5, Worker, sesión
  «Automatizar la prueba de carrera del for update de 0459»). Director: la sesión «Director
  notificación a workers», que asignó la tarea porque Sam pidió trabajo continuo.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/reversion-credito-referido-0490`,
  creado con `harness-worktree start` desde `main` `6c2413d1`.
- Rama: `codex/reversion-credito-referido-0490`. Con el turno del Director se trajo `main` `8235b70b`
  (#168) con el driver, antes del `verify` y del push único.
- SDD: [0490](../../docs/specs/0490-reversion-credito-referido/spec.md). Reservada en local con
  `corepack pnpm sdd:next --reserve reversion-credito-referido`: lock `refs/dtd/reservations/0490` y
  rama `codex/sdd-reserve-0490-reversion-credito-referido` (`7f4124ef`), incorporada con cherry-pick.
  La reserva no se publicó: la PR lleva la spec, como en las reservas anteriores.
- Aislamiento comprobado antes de editar: toplevel y rama correctos, `guard` → `Guard OK`, claim
  adquirido con el owner de arriba. Antes de cada commit se revalida con `guard --owner`.
- Permisos del encargo: commits en esta rama; el push único y la PR, con el aviso del Director.
  **No merge. No producción. Sin migración.**

## OBJETIVO ORIGINAL

El punto 4 del «Fuera de alcance» de la SDD-0488: `revertReferralCreditsForInvoice`
(`lib/studio/accounting/referral-credit-posting.ts:352-364`) leía `paid_amount` y escribía el valor
absoluto, sin guard, y no recalculaba el estado. Seguir el precedente de la aplicación del crédito
(guard optimista `.eq("paid_amount", leído)` y compensación ante un conflicto), verificar la premisa
del estado, y probarlo con vitest (control rojo y mutantes) y con una carrera en `supabase/tests`
contra las funciones reales de la 0467.

## COMPLETADO

- **Premisas medidas** (detalle en la spec):
  1. Después de anular, ningún cobro entra en la factura: cobrar, identificar y confirmar un
     reporte la rechazan con `PAYMENT_STATE`. El escritor que sí baja el pagado de una factura
     anulada es `void_collection_receipt` (0467): 380 = recibo de 300 + crédito de 80 quedaba en 300
     en vez de 0.
  2. «Pagada con saldo pendiente» no sale de la reversión, porque la factura ya está anulada. Sale de
     una aplicación en vuelo a través de la anulación: su UPDATE final no guardaba el estado y
     revivía la factura anulada como `parcial` o `pagada`.
- **Decisiones del Director (2026-09-19):**
  - diseño aprobado;
  - el guard de estado de la aplicación entra en esta SDD;
  - política de reintento A: releer hasta 3 veces (`REVERT_PAID_MAX_ATTEMPTS`), revisable por Sam.
    B es la constante en 1.
- **La reversión** (`referral-credit-posting.ts`): por cada crédito aplicado, primero reclama la
  reversión (`aplicado` → `acreditado`, con guard por estado). Después baja el abono con guard de
  pagado y de estado, releyendo ante 0 filas, y anula los asientos al final. El estado sigue la
  regla de `void_collection_receipt`: una anulada o en borrador conserva el suyo, y otra queda
  `emitida` o `parcial`. Si no puede bajar el pagado, el crédito vuelve a `aplicado` con su rastro,
  los asientos no se tocan y devuelve `ok: false`.
- **La aplicación** (`fidelizacion/actions.ts`): su UPDATE final exige el estado leído, y el mensaje
  del conflicto nombra el estado, en tuteo.
- **Pruebas unitarias:**
  - la reversión: seis casos nuevos sobre el store en memoria, que ahora soporta
    `update().select()` y un escritor concurrente entre la lectura y el UPDATE;
  - la aplicación: el doble registra los `.eq` y la prueba afirma los guards de pagado y de estado.
- **`supabase/tests/0467_reversion_credito_carrera.test.sql`**, con el patrón de las otras
  carreras. El fixture es el del contrato 0467, con la 0467 aplicada. Cuatro escenarios contra las
  funciones reales:
  1. se anula un recibo mientras la reversión baja el crédito;
  2. un cobro llega durante la anulación;
  3. la anulación ocurre durante un cobro;
  4. una aplicación está en vuelo cuando se anula la factura.

  En 1 y 4 las sentencias viejas son el control y tienen que reproducir la pérdida.
- **Spec 0490** con premisas, decisiones, alcance, riesgo residual, allowlist exacta, aceptación y
  gobernanza. El índice `docs/specs/README.md` está regenerado.

## VALIDACIÓN

| Comprobación | Resultado |
| --- | --- |
| `docs:check` / `sdd:check` / `governance:check` / `git diff --check` | **PASÓ**: 476 specs, sin números repetidos, cápsula vigente |
| Los dos archivos de vitest | **PASÓ**: 18 de 18 ✓. La primera corrida dio 17 de 18 por el doble, cuyo select devolvía los objetos vivos del store; PostgREST devuelve copias, y así quedó |
| Control rojo: las pruebas nuevas contra el código de `6c2413d1` | **FALLÓ, como tenía que fallar**: 7 ✗, cinco de la reversión y dos de la aplicación |
| Mutantes de vitest (M1–M8), en el lugar y con restitución comprobada por md5 | **Los 8 caen**, cada uno en su prueba (tabla de la spec). Fuentes restituidos md5 a md5 |
| La carrera SQL sola, con los flags de Docker del runner | **PASÓ**: 14 aserciones, 579 ms, sin residuo. Fase por fase (copia con un `raise notice`), las 6 salen por la razón correcta y esperan en `transactionid` |
| `pnpm typecheck` y eslint de los 4 archivos | **PASÓ**: typecheck en 59 s; eslint sin avisos |
| Merge de `main` `8235b70b` (#168), con el driver | **PASÓ**: sin conflictos; `docs:check` en verde después |
| `verify` completo sobre `1d434836` (el merge), en el turno del Director | **PASÓ en lo medido: 16 de 17 pasos**, 19 min (20:03–20:22Z), sin contenedores antes ni después. PASÓ: harness, lint, rsc-boundary, typecheck, edge-functions (4), test (vitest: 8105 ✓ y 1 omitido, en 620 archivos), docs:check, numbering, feature-constants, components:check, governance:check, pending-migration-symbols (0 rojo, 0 amarillo), sql-tests (218 contratos, con la carrera nueva), schema-rebuild y build. **e2e: PASÓ con aviso**: 167 ✓, 18 omitidos y 1 flaky, que pasó al reintento: `e2e/calculadora-semantic-colors.spec.ts:53`, el selector combinado de la calculadora pública, ajeno a este cambio. El proceso salió ≠0 por el worker de WebKit que no cierra en Windows. **migrations-applied: NO DISPONIBLE** (sin credenciales en el worktree; esta SDD no trae migración) |
| CI alojado | **Por mensaje al Director**: la rama se publica después de este commit |

## COMMITS

| Commit | Propósito |
| --- | --- |
| `9e46cf3f` | `chore(sdd)`: la reserva de SDD-0490 (cherry-pick del stub) |
| `159525ab` | `fix(fidelizacion)`: la reversión y la aplicación del crédito, con sus pruebas unitarias |
| `fe72b5fd` | `test(db)`: la carrera contra las funciones de la 0467 |
| `16b96eae` | `docs(SDD-0490)`: la spec con la evidencia, el índice y este handoff |
| `1d434836` | merge de `main` `8235b70b` con el driver, sin conflictos |
| el commit que contiene esta versión | `docs(handoff)`: el `verify` completo y el merge final en este handoff |

## PR / BRANCH

- Rama `codex/reversion-credito-referido-0490`, base `main`, worktree de arriba. Se publica con un
  solo push después de este commit. El número de la PR y el SHA van por mensaje al Director.

## PENDIENTES DE ESTA TAREA

1. Push y PR contra `main`, con el número y el SHA por mensaje.
2. Revisión e integración del Director. Al integrarse se despliega, porque no hay migración.

## FUERA DE ALCANCE DETECTADO

1. **Aplicación y reversión del crédito como funciones SQL con la factura FOR UPDATE.** Quedan dos
   ventanas que el TypeScript no puede cerrar: una anulación entre el claim de la aplicación y su
   UPDATE final, y un proceso que murió en ese tramo. En las dos, la reversión baja un abono que
   nunca llegó. Cerrarlas exige una migración: decisión de Sam.
2. **`voidInvoice` sólo registra en el log un fallo de la reversión.** Si la reversión no puede
   hacerse, el crédito queda aplicado a una factura anulada y nadie en el Studio se entera.

## IMPACTO DOCUMENTAL

- **Canónico:** la spec 0490 y el índice regenerado.
- **Documentación en código:** los comentarios de la reversión y del UPDATE de la aplicación, y la
  cabecera del `.test.sql`.
- **No aplica:**
  - `BRAND.md` y `docs/design/**`: no hay UI;
  - `docs/marketing/**` y `docs/governance/**`: no hay política nueva;
  - `revisar-datos-ve`: no cambia qué datos se capturan, mueven o borran.
- **Graphify, Archify y vista previa de Obsidian: NO EJECUTADOS.** Quedan para la publicación del
  Director desde `main`.

## HANDOFF AL DIRECTOR

- **Siguiente acción:** revisar la PR e integrarla con CI verde.
- **Cambios compartidos:** dos archivos de producto (la reversión y la aplicación del crédito), sus
  pruebas, un `.test.sql` nuevo y la spec. Sin migración.
- **Sesiones consumidoras:** ninguna. El claim se libera al abrir la PR; el worktree y la rama se
  conservan.

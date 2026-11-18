# Handoff · SDD-0674 — Botón «Facturar» en Embarques (regla transitoria EXC-0674)

Fecha: 2026-11-18. Datos de la tarea:

- Owner: Worker `worker-0674-facturar`.
- Rama: `codex/sdd-0674-boton-facturar-embarques`.
- Worktree: `DTD-worktrees/sdd-0674-boton-facturar-embarques`.
- Base: `origin/main` `9434cc4f6`, con merge de `origin/main` `65a3ad8db` (#681).
- SDD y migración 0564 asignadas por el DG.
- PR: #684.

## Estado

- **Spec `approved`.** Sam contestó las seis preguntas del §4 y aprobó las tres decisiones del §3.1 (a) y
  de la pregunta 3 («Sí, las tres»).
- **Revisión independiente (Opus):**
  - sobre `a166d07fe`: CHANGES_REQUESTED, 7 bloqueantes. Los corrigió la spec en `aaf25d169`, según las
    decisiones del DG;
  - re-revisión sobre `aaf25d169`: CHANGES_REQUESTED. Los 7 quedaron resueltos en el diseño (el 7,
    parcial), y salieron los nuevos B1, B2 y N1 a N8. Los atiende la cabeza siguiente (spec §9).
- **Código:**
  - el primer commit de implementación (`09356665d`) es anterior a la spec corregida;
  - `6339c2902` y la cabeza siguiente lo alinean con la spec.
- **Pruebas:** vitest, typecheck y eslint siguen NO EJECUTADOS; espero el turno de PC del DG. Los
  contratos SQL los corre el CI (`sql-tests.yml`), sin Docker local.
- **La 0574 se resuelve en esta PR** (decisión del DG), con el vínculo factura ↔ envío y la vista
  `exc0674_envios_cubiertos`.

## Medición (spec §2, en código y migraciones; no se leyó producción)

- **El portal ya muestra los embarques sin factura.** Ni `listMyShipments` ni la RLS 0416 miran
  `invoices`.
- **Los borradores no se ven en el portal** (0452).
- **El rol de Embarques no puede facturar con su sesión**, por la RLS 0407 y la 0414.
- **`next_invoice_code`** (0077:63-83) calcula max+1 sin lock. Solo lo protege el unique de la 0077:48.
- **`post_invoice_journal_entry_atomic`** (0497) no lanza error: devuelve un `outcome`.
- **La 0574** reconoce lo facturado por el `shipment_id|client_markbox` de la factura.

## Hecho (spec §7.1, allowlist)

- **Spec, índice y gobernanza:**
  - `docs/specs/0674-boton-facturar-embarques/spec.md`, con el índice regenerado;
  - `docs/governance/reviews/excepcion-0674-facturar-embarques-2026-11-18.md`, el registro formal de las
    excepciones;
  - `docs/governance/README.md`: las filas de SGE-00, MP-01 y BTN-01 enlazan a ese documento.
- **Migración 0564** (`supabase/migrations/0564_exc0674_facturar_contenedor.sql`):
  - `exc0674_contenedores`: la lista transitoria. Nace vacía, no se puede editar, y un trigger audita cada
    alta y baja y exige `dtd.audit_reason`;
  - `exc0674_facturas`: la marca y el rastro. Tiene un índice único parcial `where anulada_at is null`, y
    el trigger `exc0674_marcar_anulada`, en `invoices`, la marca cuando la factura se anula;
  - `exc0674_factura_envios`: el vínculo factura ↔ envío ↔ cliente real;
  - la vista `exc0674_envios_cubiertos`: `security_invoker`, inner join y sin montos;
  - la RPC `exc0674_facturar`. En una transacción:
    - toma el lock de numeración por tenant y los locks por cliente, en orden de Shipping Mark;
    - emite la factura en USD, al aliado raíz si lo hay;
    - deriva la base y el IVA del total y reparte las líneas por CBM;
    - hace el asiento, que tiene que quedar `posted` o `already_posted`;
    - escribe el vínculo, el rastro y el evento `invoice_emitted_exc0674` con `legal_ack`.
  - RLS: `accounting` y `admin` ven todo; `operations` solo mientras el contenedor esté en la lista. Nadie
    escribe desde el Studio.
  - Va en espera en `migrations-baseline.json` y declarada en
    `pending-migration-symbol-declarations.json` (3 amarillos).
  - Desarme: `supabase/desarmes/0564_desarme.sql`.
- **App:**
  - `lib/studio/exc0674.ts` y `exc0674-queries.ts`;
  - `app/studio/(app)/embarques/facturar-actions.ts`. El correo sale después del commit, y el cliente
    admin se usa solo para el correo;
  - `_components/FacturarContenedor.tsx`, `page.tsx` y `EmbarquesClient.tsx`;
  - `lib/studio/rate-snapshots/sin-facturar.ts`, que suma los envíos cubiertos.
- **Frontera SDD-0357:** una nota EXC-0674 en `scripts/__tests__/invoice-read-boundary.test.mjs`, con +0
  llamadas.
- **Pruebas:**
  - contratos SQL:
    - `supabase/tests/0564_exc0674_facturar_contenedor.test.sql`;
    - `0564_…_carrera.test.sql`, con dblink: control sin lock, real, mismo cliente y tenants distintos;
  - vitest:
    - `lib/studio/__tests__/exc0674.test.ts` y `exc0674.migration.test.ts`;
    - `lib/studio/rate-snapshots/__tests__/sin-facturar-exc0674.test.ts`;
    - `embarques/__tests__/page-exc0674-por-rol.test.ts` y `facturar-exc0674-action.test.ts`;
    - `_components/__tests__/EmbarquesClient.facturar.test.tsx`.

## Evidencia

| Comprobación | Resultado |
|---|---|
| docs:check / sdd:check / governance:check / git diff --check | PASÓ |
| check-pending-migration-symbols | PASÓ: 0 ROJO, 3 AMARILLO declarados |
| Contratos SQL (CI) sobre `aaf25d169` | FALLÓ: uuid inválido `…cdel` en el fixture. Lo corrige la cabeza siguiente; falta que corra el CI |
| vitest de lo tocado | NO EJECUTADO: espera el turno de PC del DG |
| `pnpm typecheck` / eslint de lo tocado | NO EJECUTADO: espera el turno |
| `/ui-check` de `FacturarContenedor.tsx` | NO EJECUTADO |
| `pnpm verify` | NO EJECUTADO: el portón es el CI |

## Pendientes de esta tarea

1. Que el CI corra los contratos SQL sobre la cabeza nueva, y corregir lo que salga.
2. Con el turno del DG:
   - `pnpm install`;
   - vitest de los archivos de la allowlist y de las pruebas existentes de Embarques, de la 0574 y de la
     frontera 0357;
   - `pnpm typecheck` y eslint de lo tocado.
3. `/ui-check` de `FacturarContenedor.tsx`.
4. N6 a N8 de la re-revisión: le pedí el texto al DG.
5. N5: el OK explícito de Sam para que `operations` facture lo pide el DG.
6. La re-revisión de la cabeza nueva, que lanza el DG.
7. Después de fusionar, y solo con el OK nominal de Sam:
   - aplicar la 0564 por el runbook;
   - agregar el 64 a la lista con `service_role` y `dtd.audit_reason`.

## FUERA DE ALCANCE DETECTADO

- La 0574 tampoco reconoce envío por envío las facturas en borrador de la carga de consolidados
  (`lote-sql.ts`). Es aparte de esta regla, que ya se resuelve con el vínculo.
- La 0668 está en la PR #680. Según el DG, no cruza con esta spec salvo que cambie la regla del portal.

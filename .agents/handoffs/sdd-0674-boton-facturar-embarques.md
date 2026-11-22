# Handoff · SDD-0674 — Botón «Facturar» en Embarques (regla transitoria EXC-0674)

Fecha: 2026-11-18. Datos de la tarea:

- Owner: Worker `worker-0674-facturar`.
- Rama: `codex/sdd-0674-boton-facturar-embarques`.
- Worktree: `DTD-worktrees/sdd-0674-boton-facturar-embarques`.
- Base: `origin/main` `9434cc4f6`, con merge de `origin/main` `65a3ad8db` (#681).
- SDD y migración 0564 asignadas por el DG.
- PR: #684 (fusionada 2026-11-18 23:08:00Z, `8dec3ee29`). Cierre de la 0564: rama `codex/sdd-0674-cierre-0564`.

## Estado

- **Spec `approved`.** Sam contestó las seis preguntas del §4 y aprobó las tres decisiones del §3.1 (a) y
  de la pregunta 3 («Sí, las tres»).
- **Revisión independiente (Opus):**
  - sobre `a166d07fe`: CHANGES_REQUESTED, 7 bloqueantes. Los corrigió la spec en `aaf25d169`, según las
    decisiones del DG;
  - re-revisión sobre `aaf25d169`: CHANGES_REQUESTED. Los 7 quedaron resueltos en el diseño (el 7,
    parcial), y salieron los nuevos B1, B2 y N1 a N8. B1, B2 y N1 a N3 los atendió `91dd1e4a8`; N6 a N8,
    la cabeza siguiente (spec §9).
- **Corrección de Sam (2026-11-18, por el DG):** «El rol operaciones no factura y tampoco ve los valores.»
  - Facturan y ven el monto **solo `accounting` y `admin`**. Se retiró la EXC-0674 de montos para
    `operations` (spec §4 pregunta 4, §7.2, §7.3 punto 5 y el documento de excepciones).
  - N4 y N5 dejan de aplicar: se quitó la RLS de `operations` en las tres tablas, su rol en la RPC, la
    prop en Embarques y la nota de la frontera 0357. Las pruebas por rol rechazan a `operations`.
  - Si otro rol debe facturar, será una decisión nueva de Sam.
- **Revisión Opus de `df8e20648`: CHANGES_REQUESTED.** Lo atiende la cabeza siguiente:
  - B1: `moduleEditDenial(supabase, "invoices")` al tope de la action, más `rolFacturaExc0674`; inventario
    de `rbac-actions-guard` 488 → 489. La página lee `facturacion` solo si
    `moduleViewDenial(supabase, "invoices") === null`. Hay pruebas del override, en la action y en la página;
  - B2: `exc0674-queries.ts` filtra `anulada_at is null` y ordena. Hay prueba con una fila anulada;
  - decisión del DG sobre el punto 1: también por cliente van dos pantallas («¿Estás seguro de los datos?»
    y «Confirmado»). Están alineados la spec (§7 punto 3 y §7.3), `FacturarContenedor.tsx` y su prueba;
  - 2: el desarme se ensaya en el contrato (CONTRATO 18);
  - 4: «cinco vigentes»;
  - 5: un Shipping Mark con dos fichas vivas da `exc0674:cliente_ambiguo` (CONTRATO 16);
  - 7: guarda contra ciclos en la cadena de aliados, con `exc0674:aliado_ciclo` (CONTRATO 17). No puse
    `set local statement_timeout` dentro de la RPC: en Postgres, cambiarlo a mitad de la llamada no
    rearma el timer de la sentencia que ya corre. El tope lo pone el `statement_timeout` del rol
    `authenticated` (PostgREST), y la guarda corta el único bucle sin fin.
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
  - RLS: solo `accounting` y `admin` de su tenant ven filas. Nadie escribe desde el Studio. Las altas y
    bajas de la lista quedan auditadas como `system`, sin `actor_id`, con el motivo obligatorio (N7).
  - Estuvo en espera en `migrations-baseline.json`, con 3 amarillos declarados; se retiró en el cierre
    (ver «Aplicación»).
  - Desarme: `supabase/desarmes/0564_desarme.sql`.
- **App:**
  - `lib/studio/exc0674.ts` y `exc0674-queries.ts`;
  - `app/studio/(app)/embarques/facturar-actions.ts`. El correo sale después del commit, con las variables
    del retorno de la RPC (sin releer `invoices`), al titular facturado: con aliado raíz, al aliado (N8). El
    cliente admin se usa solo para el correo;
  - `_components/FacturarContenedor.tsx`, `page.tsx` y `EmbarquesClient.tsx`;
  - `lib/studio/rate-snapshots/sin-facturar.ts`, que suma los envíos cubiertos.
- **Frontera SDD-0357:** una nota EXC-0674 en `scripts/__tests__/invoice-read-boundary.test.mjs`, con +0
  llamadas y sin excepción de rol.
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
| check-pending-migration-symbols | PASÓ: 0 ROJO, 3 AMARILLO declarados (líneas de evidencia corregidas tras el merge) |
| `pnpm install --frozen-lockfile` (turno del DG, autorización de Sam) | PASÓ |
| vitest (`--pool=threads --maxWorkers=1`): Embarques, exc0674, rate-snapshots (0574), frontera 0357, rbac-actions-guard, rbac-view-guard, rbac | PASÓ: 24 archivos, 881 pruebas (el conteo de la superficie RBAC, 85 → 86, se corrigió y se volvió a correr: 494/494) |
| `pnpm typecheck` | PASÓ |
| eslint de los archivos tocados | PASÓ |
| Contratos SQL en Docker (`run-sql-tests.mjs`, postgres:17 efímero con `--rm`) | PASÓ: 310 de 310, incluidos la 0564 y su carrera |
| `/ui-check` de `FacturarContenedor.tsx` | PASÓ, con ajustes menores no bloqueantes (ver «UI-check») |
| `pnpm verify` | NO EJECUTADO: el portón es el CI |

## UI-check (`FacturarContenedor.tsx`, advisory)

- [media] `FacturarContenedor.tsx:315` y `:340`: el respaldo del scrim y la sombra llevan `rgba` literales.
  Son los mismos valores de `ConfirmDialog.tsx:253/282`, el diálogo canónico, así que se dejan iguales.
  Si se tokeniza, se hace en los dos.
- [baja] `:322`, `:341` y `:344`: padding 16/22 y gap 14 fuera de la escala de 4 px. Copian
  `ConfirmDialog`, igual que el punto anterior.
- [baja] `:223`: input de 140 px. El peor caso real («1.234.567,89», en la fuente del `studio-input`) cabe
  holgado; el monto grande del diálogo usa `whiteSpace: nowrap`.
- Bien: solo tokens de color y tipografía del Studio (Sora/Nunito/mono), labels `studio-sr-only`
  clicables, foco inicial en «Volver», `aria-busy`, botón oculto (no deshabilitado) para roles sin
  permiso, tuteo sin voseo y CTAs con verbo. No hay AI slop.
- Veredicto: OK con ajustes menores (no bloqueante).

## Límites conocidos (revisión de `df8e20648`, texto del DG)

- **3.** El lock por cliente (0564:385-386) siempre queda cubierto por el lock de numeración del tenant
  (:359-360). Ningún mutante lo prueba por separado. No hace daño, pero en la escena «REAL 2» de la
  carrera gana el lock del tenant, no este.
- **6.** Cambio de año: `issued_at` usa la fecha de Caracas (:303) y `next_invoice_code` usa
  `current_date` de la base (UTC). El 31 de diciembre después de las 20:00 VET saldría un F-2027 con
  fecha 2026-12-31. Ya pasa con la numeración de hoy.
- `statement_timeout`: no se pone dentro de la RPC. Cambiarlo a mitad de la llamada no rearma el timer
  de la sentencia que ya corre. El tope lo pone el rol `authenticated`, y la guarda contra ciclos corta el
  único bucle sin fin. El DG lo aceptó.

## Aplicación de la 0564 (rama `codex/sdd-0674-cierre-0564`)

- **Aplicada en producción** (runbook `docs/runbooks/aplicar-migraciones-prod.md`):
  - OK nominal de Sam, literal: «OK, aplica 0563 y 0564».
  - COMMIT: 2026-11-18 23:38:29Z. `version` del ledger: `20261118233829`; `created_by`: `servidor-propio:psql:SDD-0674`. El ledger queda con 559 filas.
  - Una fila en el ledger, md5 `98c061b05735b1b12bd63e2a3c1d3b2a`, 36660 bytes. Verificación PASÓ: cuerpos
    vivos iguales al archivo.
  - Evidencia: `/srv/ops/evidencias/apply-0564-dtd-cargo-20261118T233828Z`. Paquete del SHA `8dec3ee29`,
    el merge de la PR #684 (2026-11-18 23:08:00Z).
  - Cierre (§6): `retirar-espera.mjs` salió con 0. Quitó la espera de `migrations-baseline.json` y las 3
    declaraciones, y selló la 0564 en `migrations.lock.json` (sha256 `51c99c4f…`). `migrations-lock.mjs`
    salió con 0.
  - La lista `exc0674_contenedores` sigue **vacía**. Agregar el 64 lleva otro OK nominal de Sam.

## Pendientes de esta tarea

1. Que el CI pase sobre la PR de cierre y que el DG la fusione.
2. Solo con un OK nominal nuevo de Sam: agregar el 64 a `exc0674_contenedores` con `service_role` y
   `dtd.audit_reason` (motivo con el OK literal). El evento queda como `system`.

## FUERA DE ALCANCE DETECTADO

- La 0574 tampoco reconoce envío por envío las facturas en borrador de la carga de consolidados
  (`lote-sql.ts`). Es aparte de esta regla, que ya se resuelve con el vínculo.
- La 0668 («código viejo visible en el portal») está en la PR #680 y solo toca documentación. Según el DG,
  no cruza con esta spec salvo que cambie la regla del portal (N6).

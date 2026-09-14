# Portal — reportes de pago y aceptación por principal y tenant (SDD-0390 y SDD-0397)

Fecha: 2026-09-14. Task ID: `portal-reportes-principal-0390-0397`.
Owner / sesión escritora: `worker-w3-portal-reportes-20260914` (Worker asignado por el Director el 2026-09-14; sin subagentes ni otras sesiones escritoras).
Estado de tarea: en-progreso.
Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO` (checkout principal en `main`, sin tocar).
Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/portal-reportes-principal-0390-0397`.
Rama: `codex/portal-reportes-principal-0390-0397`. Base: `origin/main` `b07ad98bda4da35086d8207640321a7995fc8f24`.
Origen de solo lectura: `refs/dtd/pr/21` = `origin/codex/saneamiento-integral` = `ea9952a47f4adf14c48c91e6d0147597beb94aa7`. Commits de referencia: `08ec803d1a1b0dc344d445f0509fd3b41c4473c2` (SDD-0390) y `2d0628d0d104845011f2f1fe66462ea07871a96d` (SDD-0397). Extracción con `git show <sha>:<ruta>`; la rama fuente no se modifica ni se publica.
SDD: `docs/specs/0390-portal-payment-shipment-reads-principal-tenant/spec.md` y `docs/specs/0397-portal-invoice-actions-principal-tenant/spec.md`, ambas `status: done` en `main` sin su código (hallazgo de L14). Sin reserva de número. Sin migración.
Permisos: commits locales selectivos (nunca `git add -A`), una unidad lógica por commit; push de la rama a sí misma y PR en borrador contra `main`, autorizados por el encargo. Prohibidos: merge, deploy, aplicar migraciones, leer filas de negocio, tocar el ruleset, borrar ramas o worktrees, copiar credenciales.

## Contrato del encargo

- **Objetivo:** que el código que SDD-0390 y SDD-0397 declaran hecho exista en `main`: lecturas de reportes de pago y eventos de envío del Portal resueltas por principal y tenant, y `app/portal/(app)/facturas/[code]/aceptar/actions.ts` sin releer `clients.tenant_id` con admin.
- **Aceptación:**
  1. `listMyInvoiceReports` y las lecturas de eventos de envío filtran por principal y tenant; `lib/portal/__tests__/portal-read-principal-scope.test.ts` importado o reescrito contra `main` actual.
  2. `aceptar/actions.ts` resuelve el principal como ya lo hace `reportar/actions.ts` (hunk de SDD-0397 ya en `main` por L14) y no relee `clients.tenant_id` con admin.
  3. Toda escritura sobre `payment_reports` sigue pasando por los comandos de 0421 (`run_report_command` y sus wrappers); ninguna vuelta a DML directo ni a `confirm_payment_report`. Verificado con grep en `lib/portal` y `app/portal`.
  4. `lib/portal/__tests__/payment-reports.test.ts` recupera la aserción y el mock de SDD-0390 que L14 excluyó; ningún test existente se debilita.
- **Alcance:** los archivos de las allowlists de 0390 y 0397 que faltan en `main`, sus tests, las dos specs y este handoff. Excluidos: los 111 archivos ajenos de la PR #21; migraciones, `supabase/` y las esperas de `migrations-baseline.json`; Studio; los audits/handoffs del saneamiento (`docs/audits/2026-09-02-*`, `2026-09-03-portal-*-local.md`, `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`), que no están en `main`.
- **Dependencias / orden:** desarrollo independiente. La integración la decide el Director después del smoke de L14 (PR #104 fusionada en `main` `36204665`) y de aplicar 0422 y 0423; la PR queda en borrador.
- **Solapamientos previstos** (sección «Integración» del handoff de L14): `lib/portal/payment-report-queries.ts`, `lib/portal/__tests__/payment-reports.test.ts` y `lib/portal/__tests__/portal-invoice-actions-principal-scope.test.ts`. Se resuelven en esta rama; la versión elegida y el porqué quedan abajo.
- **Validación:** `E2E_PORT=3103 corepack pnpm verify` con veredicto por paso; `corepack pnpm exec vitest run lib/portal` y los tests focales; lint focal sobre los archivos tocados; `git diff --check` antes de cada commit.

## Punto de partida verificado (antes del primer cambio)

- `git rev-parse --show-toplevel` = el worktree de arriba; rama `codex/portal-reportes-principal-0390-0397`; `HEAD = b07ad98b`; árbol limpio. `guard` OK y `claim` adquirido con el owner de arriba.
- Identidad por blob de cada ruta del alcance (`git rev-parse <ref>:<ruta>`):

| Ruta | `main` (`b07ad98b`) | Padre del commit fuente | Commit fuente = head de #21 |
|---|---|---|---|
| `lib/portal/payment-report-queries.ts` | `63dbe421` | `08ec803d^` = `63dbe421` | `f0464875` |
| `lib/portal/shipment-events-queries.ts` | `0580a877` | `08ec803d^` = `0580a877` | `443f205e` |
| `lib/portal/__tests__/payment-reports.test.ts` | `ce5de1c7` | `08ec803d^` = `ce5de1c7` | `e1c75f6f` |
| `lib/portal/__tests__/shipment-events.test.ts` | `a62a098f` | `08ec803d^` = `a62a098f` | `bac6d4dc` |
| `lib/portal/__tests__/portal-read-principal-scope.test.ts` | ausente | — | `2528616c` (alta en `08ec803d`) |
| `app/portal/(app)/facturas/[code]/aceptar/actions.ts` | `d549b67e` | `2d0628d0^` = `d549b67e` | `a6c5e992` |
| `app/portal/(app)/facturas/[code]/aceptar/__tests__/actions.test.ts` | `d599b5d3` | `2d0628d0^` = `d599b5d3` | `94ffc956` |
| `lib/portal/__tests__/portal-invoice-actions-principal-scope.test.ts` | `636d292a` (recorte de L14) | ausente | `814ef869` (alta en `2d0628d0`) |
| `app/portal/(app)/facturas/[code]/reportar/actions.ts` | = head de #21 (`66eb9ca0`) | — | ya en `main` por L14; sin cambio |
| `lib/portal/__tests__/payment-report-consumers.test.ts` | = head de #21 (`86a499c5`) | — | ya en `main` por L14; sin cambio |

  En las siete rutas que `main` conserva iguales al padre del commit fuente, el hunk de 0390/0397 es exactamente la diferencia entre `main` y el head de #21 (`git log --full-history 2a2e81bf..ea9952a4 -- <ruta>` no muestra otros commits después de 0390/0397). Por eso se toma el blob exacto del commit fuente. El recorte de L14 es un subconjunto estricto del test completo de 0397 (mismos mocks y casos del reporte; el test completo agrega los mocks legales y el caso de aceptación); se toma la versión completa.
- `getPortalClientPrincipal` (`lib/portal/portal-queries.ts`, L18/SDD-0462) tiene en `main` el mismo cuerpo que en `08ec803d`; `portal-queries.ts` sólo importa `./portal-types`, así que el import nuevo desde `payment-report-queries.ts` y `shipment-events-queries.ts` no crea un ciclo.
- Escrituras sobre `payment_reports` en `app/` y `lib/` (sin tests): sólo lecturas (`select`) en `lib/portal/payment-report-queries.ts:83,108,133,161` y `app/portal/(app)/facturas/[code]/reportar/actions.ts:65`; ningún `insert/update/delete/upsert`; `confirm_payment_report` sólo aparece en `lib/portal/__tests__/payment-report-consumers.test.ts:93` como detector de legado. Los comandos van por `lib/portal/payment-report-commands.ts:123-124` (`create_portal_payment_report`, `cancel_portal_payment_report`, `resolve_payment_report`).

(Las secciones de cierre se completan al terminar.)

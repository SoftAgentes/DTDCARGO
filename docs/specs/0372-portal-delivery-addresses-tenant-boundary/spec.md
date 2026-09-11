---
sdd: "0372"
title: Direcciones Portal por principal y tenant
status: in-progress
author: Codex
created: 2026-09-03
updated: 2026-09-03
supersedes: null
superseded_by: null
related: ["0138", "0359", "0371"]
confidencialidad: interno
---

# SDD-0372 — Direcciones Portal por principal y tenant

> **Nota de importación — 2026-09-10, actualizada el 2026-09-11.** Esta spec se importa
> desde la PR #21 con su contenido original. Su migración `0425_portal_delivery_addresses_tenant_boundary`
> **fue APLICADA a producción el 2026-09-11 con OK de Sam nombrándola**, antes de fusionar
> esta PR y para no dejar el Portal llamando una RPC inexistente.
> Ledger: `20260911040935 / 0425_portal_delivery_addresses_tenant_boundary`.
> Por eso **no figura** en `pendingBelowCutoff`.

## Fuente

Siguiente slice de la cola local autorizada. La hipótesis de AUDIT-2026-09-03.md
se reprodujo en PostgreSQL 17.10 desechable usando migraciones reales:
dos tenants con igual Shipping Mark; PortalA lee1 direcciónB, inserta para
clientB pese a enviar tenantA (trigger sella B) y modifica1 direcciónB.
Se verificó ROLLBACK y ausencia de tablas/auth al terminar; sin datos reales.

Numeración al preparar el slice: pnpm sdd:next con fetch y 15 refs devuelve
0371/0425. El 0371 ya pertenecía al slice Analytics de esta misma sesión
(entonces aún no versionado, fuera del escaneo de refs), por lo que 0372
era el siguiente no ocupado al unir
las refs y el trabajo propio. No reserva/push; revalidar antes de integrar.

## Contrato

La migración 0425 reemplaza únicamente las expresiones de las tres policies
Portal en client_delivery_addresses: SELECT, INSERT y UPDATE. Exige principal
activo, cliente vivo, tenant coherente vínculo/cliente/dirección, client_id y
Shipping Mark correspondientes a ese cliente. Identidad auth.uid, nunca input.
INSERT/UPDATE siguen sujetos al trigger existente que sella tenant y markbox.

Preserva policies del equipo y service_role, ACL, triggers, constraints,
índice de predeterminada, helpers globales y datos históricos. No incorpora
RPC, tablas ni columnas. No cambia las server actions ni el contrato de UI.
Prueba propio/ajeno, vínculo incoherente, revoked/invited, cliente borrado,
renombre y staff. Un problema preexistente de soft-delete debe diferenciarse
de una regresión; no abrir SELECT de históricos para disimularlo.

Preflight falla ante ausencia de tablas/RLS/principal o inventario distinto de
policies. La comprobación local no sustituye preflight/ACL/advisors en Cloud.
Aplicación0425, datos reales, main, publicación y despliegue no autorizados.
Las 24 migraciones pendientes anteriores conservan sus gates; ésta es adicional.

## Allowlist y ownership

- supabase/migrations/0425_portal_delivery_addresses_tenant_boundary.sql: principal.
- supabase/tests/0425_portal_delivery_addresses_tenant_boundary.test.sql:
  agente de pruebas; durante RED usa sufijo .red.sql fuera del runner.
- Esta spec y docs/specs/README.md generado: principal.
- docs/audits/2026-09-03-portal-delivery-addresses-local.md: principal.
- docs/audits/2026-09-02-codex-arranque-checklist.md: principal.

## Plan

- [x] Reproducir cruce con migraciones reales y fixture independiente.
- [x] Implementar migración local y verificar negativos/positivos/preservación.
- [x] Rebuild y gate SQL local; actualizar evidencia sin inflar contador histórico.
- [x] Preflight y aplicación Cloud nominal: requiere autorización independiente.
      Aplicada el 2026-09-11 con OK nominal de Sam; ledger
      `20260911040935 / 0425_portal_delivery_addresses_tenant_boundary`;
      [registro de aplicación](../../../.agents/handoffs/0425-0427-aplicacion-prod-20260911.md).

## Reversión

Restaurar las tres expresiones anteriores reabre el cruce entre tenants.
No ejecutar reversión automáticamente, no modificar0198 ya aplicada y no
renumerar migraciones históricas. No hay DML ni limpieza de direcciones.

## Resultado focal

54 aserciones GREEN en PostgreSQL 17.10, incluida reejecución y siete variantes
de drift. Rollback confirmado; contenedor propio eliminado. El soft delete
Portal reproduce42501 tanto antes como después, con fila conservada; se
registra como correctivo separado, sin abrir lectura de históricos.
Rebuild general de 422 migraciones pasó incluyendo 0425. El pase SQL final
ejecutó 167 contratos, todos correctos, incluido el nuevo0425.

---
sdd: "0402"
title: Catálogo de servicios Portal por principal y tenant
status: done
author: Codex
created: 2026-09-04
updated: 2026-09-04
supersedes: null
superseded_by: null
related: ["0098", "0361", "0381", "0399"]
confidencialidad: interno
---

# SDD0402 · Catálogo de servicios Portal por principal y tenant

> **Nota de importación — 2026-09-11.** Esta spec se importa desde la PR #21 con su
> contenido original, `status: done` incluido, que refleja su estado **en la rama de origen**.
> Su migración `0434_portal_prealerta_addons_principal_tenant` queda **declarada pendiente** en
> `supabase/migrations-baseline.json` y **no se ha aplicado a producción en esta tarea**: el
> `done` de la cabecera no significa que este contrato esté vigente en la base real. Aplicarla
> exige OK nominal de Sam y el runbook `docs/runbooks/aplicar-migraciones-prod.md`.
> La evidencia y las casillas de aplicación también describen la rama de origen. En `main`,
> las tres páginas usan `getPortalClient` y `listActivePrealertaAddons` no acepta tenant: esa
> opción pertenece al código de SDD-0389, ausente en `main`. Esta importación **no** incorpora
> los tres consumidores ni el test de scope; su adopción espera una decisión de alcance del
> Director (ver `.agents/handoffs/c-l22-portal-addons.md`).

## Evidencia y autoridad

`prealerta_addons` es un catálogo configurable por tenant que el Portal consume
en Proveedores, Nueva compra y Etiquetas. Las tres páginas ya derivan el
principal canónico, pero no pasan `tenantId` a `listActivePrealertaAddons`.

La policy `prealerta_addons read` todavía autoriza la rama Portal con
`get_portal_client_tenant()`. Ese helper histórico sólo lee el tenant de
`client_users`: un vínculo activo tenant A → cliente B puede leer el catálogo de
A aunque el principal sea incoherente.

## Contrato acotado

- Propagar el tenant ya derivado por las tres páginas al query del catálogo.
- Sustituir sólo la rama Portal de la policy SELECT por una relación coherente
  `auth.uid()` → `client_users` → `clients` del mismo tenant y cliente vivo.
- Conservar la rama staff, la policy de escritura, `service_role`, ACL y RLS.
- Validar con fixtures sintéticos; no consultar datos reales ni aplicar Cloud.

## Allowlist exacta

- `app/portal/(app)/proveedores/page.tsx`.
- `app/portal/(app)/compras/nueva/page.tsx`.
- `app/portal/(app)/compras/[code]/etiquetas/page.tsx`.
- `lib/portal/__tests__/portal-addon-consumers-tenant-scope.test.ts`.
- `supabase/migrations/0434_portal_prealerta_addons_principal_tenant.sql`.
- `supabase/tests/0434_portal_prealerta_addons_principal_tenant.test.sql`.
- Esta spec, índice, auditoría, checklist y handoff del saneamiento.

## Aceptación

- [x] RED de aplicación demuestra los tres callers sin `tenantId`.
- [x] RED SQL demuestra lectura con vínculo tenant/cliente incoherente.
- [x] GREEN de aplicación propaga `tenantId` en los tres callers.
- [x] GREEN SQL conserva sólo catálogo del tenant para principal coherente.
- [x] Vínculo incoherente/revocado o cliente borrado obtiene cero filas.
- [x] Staff, escritura histórica y `service_role` permanecen sin cambios.
- [x] Suite focal, SQL completa, rebuild y gates proporcionales quedan verdes.
- [x] 0434 permanece sin aplicar y el checklist original avanza a 57/106.

## Gobernanza

- `SGE-00.05`: cumplimiento; autorización cruza principal, tenant y cliente.
- `SGE-00.07`: cumplimiento; la UI consume el mismo tenant durable autorizado.
- `AUD-01` y `MP-01`: no aplica; no hay mutación ni cambio de permanencia.

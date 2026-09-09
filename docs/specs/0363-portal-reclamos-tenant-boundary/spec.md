---
sdd: "0363"
title: Aislar reclamos y evidencias del Portal por principal y tenant
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related: ["0102", "0344", "0362"]
confidencialidad: interno
---

# SDD-0363 — Reclamos Portal: lectura y evidencias propias

## Evidencia y objetivo

Las policies SELECT de 0153/0155 comparan Shipping Mark sin tenant. El mismo
Shipping Mark puede existir en dos tenants. `listMyClaims` confía en RLS;
`listClaimEvidence` consulta con sesión antes de firmar los paths mediante
admin. La selección autorizada es, por tanto, la frontera previa a esa firma.
SDD-0344 ya deriva los ids desde la sesión; no se modifica esa fachada.

Se corrige la lectura de SDD-0102, no se redefine la gestión de siniestros.
Las cabeceras históricas de 0152/0153/0155 dicen 0101; la spec canónica del
dominio es 0102. No se renumeran ni editan migraciones históricas.
Numeración consultada con `pnpm sdd:next`: 15 refs, spec 0363 / migración 0419.
La reproducción se ejecutó con PostgreSQL y datos sintéticos, nunca filas reales.

## Decisión y límites

1. Modificar exclusivamente las dos policies Portal SELECT de `client_claims`
   y `client_claim_evidence`, sin DML, ACL, funciones, triggers o Storage.
2. Exigir `auth.uid()`, vínculo activo y cliente vivo, con tenant coherente
   entre vínculo, cliente y fila y Shipping Mark del cliente.
3. Si un reclamo tiene `client_id`, debe coincidir con el cliente autenticado.
   Si es NULL, conservar la lectura del snapshot propio por tenant + Shipping
   Mark: la FK es opcional por diseño. No exigir embarque vivo ni modificar la
   retención del reclamo cuando se archive o elimine su embarque.
4. Evidencia legible sólo si su fila y su reclamo padre están vivos y son
   coherentes en id, tenant y Shipping Mark; el padre debe ser del cliente.
   Un archivo no obtiene autorización independiente por repetir el snapshot.
5. Conservar policies internas y su semántica, incluidos principales duales
   Portal/equipo. No ampliar CRUD de un cliente puro. No cambiar indemnizaciones,
   finanzas, escrituras por service_role, TTL de firma, bucket ni sus policies.
6. Preflight fail-closed ante tabla sin RLS o inventario inesperado: cuatro
   policies exactas, dos internas ALL y dos Portal SELECT, sólo authenticated.
   Postflight y contrato demuestran las dos sustituciones y preservación lateral.
7. Migración local aditiva sobre el historial. Cloud requiere GO nominal
   individual y transacción; no requiere RPC nueva ni despliegue previo.

La autorización de saneamiento continuo permite preparar y verificar esta
corrección local. No autoriza Cloud, lectura de clientes reales, merge a main
ni despliegue. El push de Academia fue rechazado por auto-review y está pendiente
de aprobación explícita; este lote tampoco se publicará por otro mecanismo.

## Allowlist exacta y ownership

- `supabase/migrations/0419_portal_reclamos_tenant_boundary.sql` — principal.
- `supabase/tests/0419_portal_reclamos_tenant_boundary.test.sql` — reproducción independiente.
- `docs/specs/0363-portal-reclamos-tenant-boundary/spec.md` — principal.
- `docs/specs/README.md` — generado, no editar a mano.
- `docs/audits/2026-09-02-codex-arranque-checklist.md` — principal.
- `.agents/handoffs/2026-09-02-portal-reclamos-tenant-close.md` — principal.
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md` — principal.

## Plan y aceptación

- [x] RED sin 0419: reproducir ambas lecturas entre tenants con Shipping Mark
  repetido. Fallar por autorización, no por archivo de migración ausente.
- [x] GREEN: principal A/B; mismo tenant con cliente distinto; vínculo ausente,
  inactivo o incoherente; cliente borrado; sin sesión; equipo y principal dual.
- [x] Conservar snapshot `client_id` NULL y reclamo propio con embarque archivado.
  Bloquear FK de otro cliente y evidencia con padre borrado/ajeno/incoherente.
- [x] Mantener ACL, policies internas, funciones, triggers, bucket y Storage.
  Probar preflight desviado y ausencia de ampliación del CRUD Portal.
- [x] Contratos SQL completos, rebuild y consumidores.
- [x] Gates documentales y revisión final de diff.
- [ ] Push explícitamente autorizado y CI del SHA publicado.
- [ ] Integración/Cloud con gates independientes; no retirar el worktree antes.

`done` significa cierre técnico local, no publicación ni release. RED sin
archivo 0419: exit 1 por visibilidad incorrecta después de confirmar ambas
lecturas cruzadas. GREEN: exit 0, ocho preflights de drift y rollback true.
Pasan 160 contratos SQL y rebuild de 416 migraciones (398 desde cero + 18
sólo-ledger), con barrido estructural de 219 tablas y dos tenants sintéticos.
Los 47 unitarios en cuatro archivos de consumidores también pasan.
El contrato incluye la modificación histórica 0230 de soft-delete interno y
las restrictivas Storage de 0363; ambas permanecen intactas. No cambia TS/TSX
ni se repite build/E2E local por rutina. El CI de `eabb230b` es evidencia de la
base publicada, no de este commit. No se atribuye una prueba de firma real
al contrato de metadatos/policies sobre PostgreSQL desechable.

## Verificación y estilo

- RED: `psql -U postgres -v ON_ERROR_STOP=1 -v apply_fix=false -f /sb/tests/0419_portal_reclamos_tenant_boundary.test.sql`.
- SQL completo: `node scripts/run-sql-tests.mjs`.
- Rebuild: `node scripts/check-schema-rebuild.mjs`.
- Consumidores: `pnpm exec vitest run lib/studio/reclamos/__tests__ lib/portal/__tests__/support-private-context.test.ts`.
- Gates: `pnpm docs:index`, `pnpm docs:check`, `pnpm sdd:check`,
  `pnpm governance:check`, `pnpm components:check`, `git diff --check`.

Se sigue el patrón 0417/0418 de `alter policy ... using (exists (...))`,
`(select auth.uid())` y catálogos fail-closed. Fixture BEGIN/ROLLBACK local;
no nuevos helpers elevados ni índices especulativos. Las PK y el índice
existente de `client_users.auth_user_id` cubren las búsquedas del principal/padre.
No se declara una medición de rendimiento productivo.

## Gate constitucional

| Principio | Clasificación |
|---|---|
| SGE-00.01 | cumplimiento: mismas operaciones y verbos |
| SGE-00.02 | cumplimiento: sin purga; conservar historial legítimo |
| SGE-00.03 | cumplimiento: autorización R3, negativos y Cloud nominal |
| SGE-00.04 | no aplica: no nuevo escritor; release exige recibo propio |
| SGE-00.05 | cumplimiento: principal, tenant y padre explícitos |
| SGE-00.06 | cumplimiento: preflight rechaza drift antes de ALTER |
| SGE-00.07 | cumplimiento: local no equivale a Producción |
| SGE-00.08 | no aplica: sin pantallas ni pasos nuevos |
| SGE-00.09 | cumplimiento: reutilizar patrón, sin helper elevado nuevo |
| SGE-00.10 | no aplica: sin cambio visual/interactivo |
| SGE-00.11 | cumplimiento: precondiciones identificables en errores |
| SGE-00.12 | cumplimiento: publicación, integración y Cloud separados |

MP-01: no retención ni borrados nuevos. BTN-01: sin controles nuevos.
AUD-01/AUD-02: sin mutación, exportación ni logging nuevo. El legado no se
declara conforme globalmente. No se captura, mueve ni borra PII real.

Fuente: [RLS oficial de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).
Changelog consultado: sin actualización de Postgres/API/paquetes ni tablas nuevas.

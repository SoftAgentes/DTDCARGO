---
sdd: "0364"
title: Aislar reportes de pago del Portal por principal y tenant
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related: ["0134", "0350", "0357", "0363"]
confidencialidad: interno
---

# SDD-0364 — Reportes de pago: frontera del principal

> **Nota de importación — 2026-09-12; actualizada el 2026-09-13.** Esta spec se importa desde la PR
> #21 (`ea9952a4`; commit `e9d49980`) con su contenido original, `status: done` incluido: ese estado
> describe el aislamiento técnico local de la rama de origen. Su migración
> `0420_portal_payment_reports_tenant_boundary` **fue APLICADA a producción el 2026-09-13** por el
> Director con OK nominal de Sam, de a una y antes de 0421 (ledger
> `20260913223809 / 0420_portal_payment_reports_tenant_boundary`, 1 sentencia, md5
> `b1d7b9429b84df5eaefbe384fb109c60`, 4849 bytes; el ledger quedó en 452 filas tras las dos de L14),
> con el archivo de esta rama idéntico al aplicado:
> `git show HEAD:supabase/migrations/0420_portal_payment_reports_tenant_boundary.sql` da el mismo md5 y
> los mismos 4849 bytes. Se aplicó con `apply_migration` y name exacto por el conector
> `claude.ai Supabase` (proyecto `xpfuzqombmjmxvprjgmi`), sin leer ninguna fila de negocio. Preflight,
> leído antes del catálogo y sin filas: las 5 policies de `payment_reports` con sus cmd/roles/permissive
> exactos, RLS activa y relacl `authenticated=arwdxtm`. Postflight, leído después: las 3 policies Portal
> con vínculo `client_users` + `auth.uid()` + tenant + Shipping Mark (INSERT sólo with_check con
> `reportado`), 0 policies con `get_portal_client_markbox`, relacl sin cambios y 5 policies en total.
> Advisors de seguridad de producción antes y después de 0420+0421, comparados hallazgo por hallazgo:
> antes `rls_enabled_no_policy` INFO 21, `extension_in_public` WARN 1,
> `anon_security_definer_function_executable` WARN 22 y
> `authenticated_security_definer_function_executable` WARN 175; después, idéntico salvo
> `rls_enabled_no_policy` INFO 22, que entra por `payment_private.report_commands` de 0421 (intencional:
> recibos sin CRUD por API, escritos sólo por el comando definer); ningún WARN cambió y 0420 no añade
> ningún hallazgo. El registro de esta ronda está en `.agents/handoffs/c-l14-portal-comandos-recibos.md`
> («RONDA 2»). Por eso 0420 ya **no** figura como espera en `supabase/migrations-baseline.json`. Las
> dos casillas abiertas del plan describen la rama de origen: el push (PR #104) y la aplicación de 0420
> ocurrieron en esta importación; el smoke de los comandos sigue pendiente. Lote L14 del bloque C:
> **0420 y 0421 (aplicadas) → despliegue de esta PR y smoke de los comandos de SDD-0365 → 0422 →
> 0423**; 0422 compara las huellas exactas de estas tres policies y sigue pendiente. No se importan el
> checklist `docs/audits/2026-09-02-codex-arranque-checklist.md` ni los handoffs `2026-09-02-*` de la
> allowlist original.

## Evidencia y objetivo

Las tres policies Portal de 0195 comparan Shipping Mark sin tenant. El trigger
de factura valida la coherencia de la fila, pero no la identidad del actor.
En PostgreSQL desechable, con dos tenants de igual Shipping Mark y código de
factura, Portal A pudo leer, insertar y editar reportes de B y reasignar un
reporte A a una factura B. RED terminó por el assert de autorización, antes
de existir 0420; todos los diagnósticos previos revirtieron sus cambios.

`listMyInvoiceReports` confía en RLS. El alta de la aplicación es controlada
por admin; la cancelación usa UPDATE de sesión. La confirmación aprobada de
SDD-0134 sigue en la RPC 0359, sólo para accounting/admin. Esta spec corrige
exclusivamente la frontera del principal en las policies existentes.
`pnpm sdd:next` consultó 15 refs: spec 0364 / migración 0420 disponibles.

## Decisión, compatibilidad y límites

1. Alterar sólo las tres policies Portal SELECT/INSERT/UPDATE, sin DML, ACL,
   funciones, triggers, Storage ni nuevos escritores.
2. Exigir auth.uid(), vínculo activo y cliente vivo, con tenant coherente
   entre vínculo, cliente y reporte y Shipping Mark del cliente autenticado.
   La comprobación cubre la fila previa y la nueva en UPDATE.
3. Conservar deleted_at NULL para SELECT y estado reportado para INSERT y
   ambos lados de UPDATE. No ampliar visibilidad para forzar una cancelación.
4. No unir SELECT con la factura: el reporte histórico propio sigue legible
   tras archivar su factura. El trigger 0195 conserva su validación de factura
   en INSERT/UPDATE y el sellado de invoice_code; no se reescribe el historial.
5. Conservar las dos policies no Portal y su semántica, incluidos principales
   duales. No afirmar que su RBAC financiero sea correcto: tiene otro hallazgo.
6. Preflight fail-closed: auth.uid(), RLS de clients/client_users/payment_reports
   y cinco policies exactas por nombre, comando, rol y modo permisivo.
   Postflight verifica las tres sustituciones. Sin índices especulativos.
7. Cloud requiere autorización nominal individual, transacción y smoke propio.
   Este aislamiento no exige RPC nueva ni despliegue previo. No reemplaza los
   gates de publicación, integración, aplicación y producción del paquete.

## Hallazgos reproducidos que NO cierra este slice

Son trabajo obligatorio siguiente, no excepciones aprobadas ni comportamiento
que deban perpetuar los tests. El diagnóstico queda antes de aplicar 0420:

- Cancelar el reporte propio con el UPDATE exacto de la acción, sin RETURNING,
  falla con SQLSTATE 42501, cero filas y deleted_at permanece NULL. La acción
  tampoco comprueba filas afectadas, por lo que un id sin coincidencia puede
  producir éxito aparente. Hace falta contrato de comando, resultado y auditoría.
- INSERT/UPDATE directos permiten confirmed_by/confirmed_at falsificados,
  moneda distinta de la factura y proof_path con prefijo de otro tenant.
  El test usa un objeto sintético libre para no confundir UNIQUE con permiso.
  La firma real del archivo no se ejecutó; no afirmar exfiltración demostrada.
- Un miembro no financiero puede UPDATE directo a confirmado sin actualizar
  paid_amount. Su llamada RPC es rechazada; accounting por RPC sí acumula
  correctamente. La policy interna ALL requiere un slice de comandos/RBAC.
- El contador de pendientes convierte errores en cero (evidencia de código,
  no prueba SQL); debe pasar a resultado fail-closed con regresión de aplicación.

El siguiente slice debe preservar alta/cancelación legítimas, impedir cambios
reservados y referencias de comprobantes ajenos, asegurar auditoría atómica
AUD-01 y evitar un despliegue que retire permisos antes de sus nuevos comandos.
No cambiar la decisión financiera de SDD-0134 ni crear asientos automáticamente.
No consultar datos reales ni aplicar correcciones retroactivas sin autorización.

## Allowlist exacta y ownership

- `supabase/migrations/0420_portal_payment_reports_tenant_boundary.sql` — principal.
- `supabase/tests/0420_portal_payment_reports_tenant_boundary.test.sql` — reproducción independiente.
- `docs/specs/0364-portal-payment-reports-tenant-boundary/spec.md` — principal.
- `docs/specs/README.md` — generado, no editar a mano.
- `docs/audits/2026-09-02-codex-arranque-checklist.md` — principal.
- `.agents/handoffs/2026-09-02-portal-payment-reports-tenant-close.md` — principal.
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md` — principal.

## Plan y aceptación

- [x] RED real sin 0420: SELECT/INSERT/UPDATE cruzados y reasignación A hacia B.
- [x] Diagnosticar cancelación, campos reservados, moneda, paths y confirmación.
- [x] GREEN: negar cruces en ambos sentidos y conservar lectura/escritura propias.
- [x] Rechazar identidad ausente, inactiva o incoherente y cliente borrado.
- [x] Conservar historial propio, trigger de factura, equipo, dual y servicio.
- [x] Probar drift y preservación de ACL, policies, funciones, triggers y Storage.
- [x] Contratos SQL completos, rebuild y unitarios de consumidores.
- [x] Gates documentales y revisión; commit selectivo que contiene esta acta.
- [ ] Push con aprobación explícita del commit/destino y CI del SHA publicado.
- [ ] Gate Cloud individual y smoke; no retirar este worktree antes de integrar.

## Verificación

`done` se limita al aislamiento técnico local, no al módulo de pagos ni al
release. GREEN sale 0, rechaza diez drifts y ocho principales inválidos y
termina con rollback true. Pasan los 161 contratos SQL, rebuild de 417
migraciones (399 desde cero + 18 sólo-ledger), barrido de 219 tablas/dos
tenants sintéticos y los 19 unitarios del consumidor. Docs, numeración,
gobernanza, componentes y formato pasan; no hay colisiones nuevas.

- RED/GREEN: `psql -v ON_ERROR_STOP=1 -v apply_fix=false -f /sb/tests/0420_portal_payment_reports_tenant_boundary.test.sql`; omitir apply_fix para GREEN.
- `node scripts/run-sql-tests.mjs` y `node scripts/check-schema-rebuild.mjs`.
- `pnpm exec vitest run lib/portal/__tests__/payment-reports.test.ts`.
- `pnpm docs:index`, `pnpm docs:check`, `pnpm sdd:check`,
  `pnpm governance:check`, `pnpm components:check`, `git diff --check`.

Sin cambios TS/TSX ni nueva API; no repetir build/E2E por rutina ni atribuir
el CI de eabb230b a este commit todavía local. No se accede a filas de negocio.

## Gate constitucional

| Principio | Clasificación |
|---|---|
| SGE-00.01 | cumplimiento: mismos verbos y operaciones |
| SGE-00.02 | cumplimiento: historia conservada, sin purga |
| SGE-00.03 | cumplimiento: negativos de autorización y gate Cloud |
| SGE-00.04 | no aplica: sólo restricción de policies, sin nuevo escritor |
| SGE-00.05 | cumplimiento: principal y tenant explícitos |
| SGE-00.06 | cumplimiento: preflight rechaza drift antes de ALTER |
| SGE-00.07 | cumplimiento: aislamiento local no equivale a cierre del módulo |
| SGE-00.08 | no aplica: sin pantallas ni pasos nuevos |
| SGE-00.09 | cumplimiento: patrón 0417/0418, sin helper elevado nuevo |
| SGE-00.10 | no aplica: sin cambio visual |
| SGE-00.11 | cumplimiento: precondiciones identificables |
| SGE-00.12 | cumplimiento: publicación, Cloud e integración separados |

MP-01 y BTN-01: no nuevo borrado ni control. AUD-01/AUD-02: no nuevo evento,
exportación ni captura; el legado de cancelación/confirmación NO se declara
conforme y su modificación deberá implementar auditoría atómica. Los fallos
medidos son no conformidades pendientes, no una exención del siguiente slice.

Fuente: [RLS oficial de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).
Changelog consultado: sin cambios de Postgres/API/paquetes ni tablas nuevas.

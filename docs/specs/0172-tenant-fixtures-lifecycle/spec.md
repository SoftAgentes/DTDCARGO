---
sdd: "0172"
title: "Lifecycle de tenant y fixtures E2E efímeras"
status: in-progress
author: "Sam (founder) + Codex"
created: 2026-07-28
updated: 2026-07-29
supersedes: null
superseded_by: null
related: ["0166", "0168"]
confidencialidad: interno
---

# SDD-0172 — Lifecycle de tenant y fixtures E2E efímeras

## 1. Decisión

Se implementa el
[diseño tenant/fixtures v1.0](../0166-auditoria-gobernada-aud-01-aud-02/diseno-ciclo-vida-tenant-fixtures.md)
como SDD propio y sin abrir los Cortes C–E de SDD-0166.

El contrato separa:

- tenants de negocio: no se borran mediante rutas ordinarias;
- fixtures persistidas: solo en Supabase efímero;
- pruebas SQL: transacción y `ROLLBACK`;
- teardown remoto: destruye el proyecto completo;
- auditoría: sobrevive a intentos de borrado del tenant.

## 2. Problema comprobado

Después de aplicar `0267`:

- `entity_audit_log` es append-only frente a roles de aplicación;
- la FK `entity_audit_log_tenant_id_fkey` continúa `ON DELETE CASCADE`;
- `service_role` todavía puede ejecutar DELETE sobre `tenants`;
- borrar un tenant puede eliminar transitivamente auditoría;
- `scripts/cleanup-e2e.ts` es el único caller del repositorio que borra tenants;
- `scripts/seed-e2e.ts` conserva un escape hatch de Producción y un DELETE
  directo de auditoría que B1 ya no permite.

Cloud mostró 192 FK directas hacia `tenants`, todas CASCADE, y residuo cero del
fixture SDD-0168.

## 3. Alcance

### Incluye

- hard deny de Producción para fixtures E2E;
- confirmación doble del project ref efímero;
- seed fail-closed, sin upsert o DELETE reparador;
- retiro del cleanup DML;
- verificación previa al teardown;
- runbook de entorno efímero;
- FK audit objetivo `ON DELETE RESTRICT`;
- retiro de DELETE a `service_role` sobre `tenants`;
- pruebas TypeScript y PostgreSQL 15/17;
- trazabilidad con SDD-0166 y gobernanza.

### No incluye

- ejecutar teardown de un proyecto real en este cambio;
- reaplicar `0268` o aplicar otra migración en Cloud;
- crear estados persistidos activo/suspendido/archivado;
- cambiar las otras 191 FK;
- crear purga de auditoría;
- definir retención, hold o plazos legales;
- abrir los Cortes C, D o E;
- modificar Vercel.

## 4. Contrato de entorno

`loadE2EEnvironment()` exige:

| Variable | Regla |
|---|---|
| `E2E_SUPABASE_PROJECT_REF` | nunca puede ser Producción |
| `E2E_SUPABASE_URL` | HTTPS y hostname correspondiente al project ref |
| `E2E_ENVIRONMENT_KIND` | valor exacto `ephemeral` |
| `E2E_EPHEMERAL_PROJECT_REF` | coincidencia exacta con el project ref |
| `E2E_SUPABASE_SERVICE_ROLE_KEY` | solo variable de proceso/secret manager |
| `STUDIO_E2E_PASSWORD` | mínimo 12 caracteres y solo sintético |

`E2E_PRODUCTION_CONFIRM_PROJECT_REF` deja de ser un escape válido. Definirlo no
puede levantar la prohibición.

## 5. Seed y teardown

### Seed

El seed:

1. valida el entorno antes de crear clientes;
2. aborta si ya existe el tenant, slug, correo o marcador Auth del fixture;
3. usa INSERT y `createUser`, no upsert;
4. nunca borra auditoría, comentarios, usuarios o tenants previos;
5. considera cualquier falla parcial motivo para destruir el entorno.

El tenant bootstrap creado por la migración inicial puede existir en el
proyecto efímero. La condición fail-closed se aplica al namespace fixture
SDD-0168 y a sus identidades, no inventa datos de negocio.

### Teardown

`scripts/cleanup-e2e.ts` se retira. El nuevo
`scripts/verify-e2e-teardown.ts` solo devuelve contadores y declara:

```json
{
  "databaseCleanupPerformed": false,
  "teardownRequired": true,
  "teardownScope": "supabase-project"
}
```

La destrucción se realiza fuera de Postgres mediante el control plane del
proveedor. El cierre exige comprobar el estado terminal del proyecto.

## 6. Contrato DB local

La migración candidata es:

```text
0268_tenant_lifecycle_guardrails
```

Realiza únicamente:

1. preflight fail-closed del estado posterior a `0267`;
2. cambio de la FK audit de CASCADE a RESTRICT;
3. validación de la FK;
4. `REVOKE DELETE ON public.tenants FROM service_role`;
5. postcondiciones de FK, ACL y policies.

No crea funciones ni modifica otra FK.

## 7. Seguridad

- Producción está bloqueada por constante de project ref;
- una variable histórica no puede autorizarla;
- no se guardan PAT, service role keys o passwords en el repositorio;
- no existe una bandera mutable `is_fixture` capaz de autorizar purga;
- `service_role` conserva SELECT/INSERT/UPDATE sobre tenants, no DELETE;
- el owner sigue siendo el único escape administrativo PostgreSQL;
- la FK RESTRICT protege eventos incluso ante un DELETE del owner;
- purga extraordinaria sigue dependiendo de retención/hold aprobados.

## 8. Archivos

| Superficie | Archivo |
|---|---|
| Contrato env | `scripts/e2e/sdd-0168-fixture.ts` |
| Seed | `scripts/seed-e2e.ts` |
| Verificación | `scripts/verify-e2e-teardown.ts` |
| Script retirado | `scripts/cleanup-e2e.ts` |
| Package | `package.json` |
| Unit test | `scripts/__tests__/sdd-0168-fixture.test.ts` |
| DB | `supabase/migrations/0268_tenant_lifecycle_guardrails.sql` |
| DB test | `supabase/tests/0268_tenant_lifecycle_guardrails.test.sql` |
| Reparación ACL generador | `scripts/build-sdd-0172-tenant-acl-history.mjs` |
| Reparación ACL unit | `scripts/__tests__/build-sdd-0172-tenant-acl-history.test.ts` |
| Reparación ACL DB | `supabase/migrations/0279_restore_tenant_lifecycle_acl_history.sql` |
| Reparación ACL DB test | `supabase/tests/0279_restore_tenant_lifecycle_acl_history.test.sql` |
| Reparación split generador | `scripts/build-sdd-0118-split-history.mjs` |
| Reparación split DB | `supabase/migrations/0280_repair_sdd0118_split_history.sql` |
| Reparación split DB test | `supabase/tests/0280_repair_sdd0118_split_history.test.sql` |
| Reparación invite split generador | `scripts/build-sdd-0118-invite-skip-split-history.mjs` |
| Reparación invite split DB | `supabase/migrations/0281_repair_invite_skip_split_history.sql` |
| Reparación invite split DB test | `supabase/tests/0281_repair_invite_skip_split_history.test.sql` |
| Operación | `docs/runbooks/e2e-supabase-efimero.md` |

## 9. Aceptación

- Producción falla aunque se defina el escape hatch histórico;
- un entorno no efímero falla;
- project ref, confirmación y URL deben coincidir;
- el seed falla ante fixture previo;
- no existe DELETE en seed o verificación de teardown;
- no existe comando `cleanup:e2e`;
- PostgreSQL 15 y 17 validan FK, ACL y rollback;
- `service_role` no borra un tenant vacío;
- el owner no borra un tenant con auditoría;
- intento fallido conserva tenant y evento;
- otra FK CASCADE de fixture permanece sin cambios;
- TypeScript, test unitario, docs y diff pasan;
- Cloud, Vercel y C–E permanecen sin cambios.

## 10. Evidencia local

| Gate | Resultado |
|---|---|
| Unit | 1 archivo · 5 pruebas |
| TypeScript | verde |
| PostgreSQL 15 | verde · rollback total |
| PostgreSQL 17 | verde · rollback total |
| Docker residual | cero contenedores de prueba |
| Cloud | aplicado y verificado · [REV-AUD-018](../../governance/reviews/aud-tenant-lifecycle-aplicacion.md) |
| Supabase efímero | intento fail-closed · replay detenido en `20260526213130 seed_team_invitation_template` |
| Teardown remoto | terminal · branch eliminado y ausente del inventario posterior · [REV-AUD-019](../../governance/reviews/aud-tenant-fixtures-ephemeral-validation.md) |
| Supabase efímero R2 | intento fail-closed · 63 migraciones · `0031_fix_studio_invite_gen_random_bytes` ambiguo |
| Teardown remoto R2 | terminal · branch y project ref ausentes del inventario posterior |
| Supabase efímero R3 | intento fail-closed · 83 migraciones · `platform_admins` viola FK hacia Auth |
| Teardown remoto R3 | terminal · branch y project ref ausentes del inventario posterior |
| Supabase efímero R4 | intento fail-closed · 120 migraciones · falta `calculator_settings` |
| Teardown remoto R4 | terminal · branch y project ref ausentes del inventario posterior |
| Supabase efímero R5 | intento fail-closed · 266 migraciones · `0262` detecta dos funciones comments sin `search_path=public` |
| Teardown remoto R5 | terminal · branch y project ref ausentes; sólo `main` saludable |
| Supabase efímero R6 | intento fail-closed · 268 migraciones · `0264` detecta EXECUTE de `anon` por payload 0209 ausente |
| Teardown remoto R6 | terminal · branch y project ref ausentes; sólo `main` saludable |
| Supabase efímero R7 | intento fail-closed · 215 migraciones · `0209` referencia `rls_auto_enable()` ausente |
| Teardown remoto R7 | terminal · branch y project ref ausentes; sólo `main` saludable |
| Supabase efímero R8 | intento fail-closed · `0209` vuelve a fallar porque 0277 llega después en el ledger |
| Teardown remoto R8 | terminal · branch y project ref ausentes; sólo `main` saludable |
| Reparación RLS local | 0277 recuperada; 0278 determinista y verde en PostgreSQL 15/17 · [REV-AUD-032](../../governance/reviews/aud-sdd-0118-rls-auto-enable-history.md) |
| Reparación RLS Cloud | 0278 aplicada; cardinalidad/digests, invariantes y advisors verdes |
| Supabase efímero R9 | intento fail-closed · supera 0209; 0268 detecta DELETE efectivo en rol cliente |
| Teardown remoto R9 | terminal · branch y project ref ausentes; sólo `main` saludable |
| Reparación ACL tenant local | 0279 determinista; PostgreSQL 15/17 reproducen R9, ejecutan 0268 y terminan en rollback · [REV-AUD-033](../../governance/reviews/aud-sdd-0172-tenant-acl-history.md) |
| Reparación ACL tenant Cloud | 0279 aplicada individualmente; recibo `20260729224850`; ACL, FK y advisors sin drift |
| Supabase efímero R10 | intento fail-closed · `0271` no reconoce el ledger fragmentado por el replay |
| Teardown remoto R10 | terminal · branch y project ref ausentes; sólo `main` saludable |
| Supabase efímero R11 | diagnóstico metadata-only · 11 fingerprints fragmentados confirmados |
| Teardown remoto R11 | terminal · branch y project ref ausentes; sólo `main` saludable |
| Reparación split local | 0280 determinista; Vitest 4/4; PostgreSQL 15/17 UPDATE 1/0 + rollback · [REV-AUD-034](../../governance/reviews/aud-sdd-0118-split-replay-history.md) |
| Reparación split Cloud | 0280 aplicada individualmente; recibo `20260730002206`; digest objetivo y advisors verificados |
| Supabase efímero R12 | supera 0271; falla cerrado en 0272 por estados fragmentados de 0031/0032 |
| Teardown remoto R12 | terminal · branch y project ref ausentes; sólo `main` saludable |
| Reparación invite split local | 0281 determinista; Vitest 4/4; contratos SQL 20/20 + rollback · [REV-AUD-035](../../governance/reviews/aud-sdd-0118-invite-skip-split-history.md) |

## 11. Rollback

- código/scripts: revertir el commit antes de usar fixtures;
- DB local: la prueba siempre termina en rollback;
- Cloud futuro: forward-fix; no reotorgar DELETE ni volver a CASCADE como
  rollback ordinario;
- entorno efímero fallido: destruir el proyecto, no reparar filas.

## 12. Gates pendientes

1. aplicar individualmente `0281_repair_invite_skip_split_history` después de
   autorización nominal y verificar postcondiciones/advisors;
2. crear un Supabase efímero completamente nuevo que alcance
   `MIGRATIONS_PASSED`;
3. ejecutar seed, recorrido E2E y verificación sin DML de cleanup;
4. destruir ese entorno y volver a comprobar estado terminal.

El gate Cloud de 0268 quedó cerrado en
[REV-AUD-018](../../governance/reviews/aud-tenant-lifecycle-aplicacion.md).
El gate Cloud de 0273 quedó cerrado en
[REV-AUD-025](../../governance/reviews/aud-sdd-0118-platform-admin-bootstrap-application.md).
El gate Cloud de 0274 quedó cerrado en
[REV-AUD-027](../../governance/reviews/aud-sdd-0118-calculator-settings-history-application.md).
El gate Cloud de 0275 quedó cerrado en
[REV-AUD-029](../../governance/reviews/aud-sdd-0118-pin-search-path-history-application.md).
Los nueve intentos reales y sus teardowns terminales quedaron registrados en
[REV-AUD-019](../../governance/reviews/aud-tenant-fixtures-ephemeral-validation.md).
El diseño local de `0276` quedó aprobado en
[REV-AUD-030](../../governance/reviews/aud-sdd-0118-revoke-anon-history.md).
El gate Cloud de `0276` quedó cerrado en
[REV-AUD-031](../../governance/reviews/aud-sdd-0118-revoke-anon-history-application.md).
El gate Cloud de 0278 y el gate local de 0279 quedaron aprobados en
[REV-AUD-033](../../governance/reviews/aud-sdd-0172-tenant-acl-history.md).
El gate Cloud de 0279 y el gate local de 0280 quedaron aprobados en
[REV-AUD-034](../../governance/reviews/aud-sdd-0118-split-replay-history.md).
El gate Cloud de 0280 y el gate local de 0281 quedaron aprobados en
[REV-AUD-035](../../governance/reviews/aud-sdd-0118-invite-skip-split-history.md).
El gate local de 0277/0278 quedó documentado en
[REV-AUD-032](../../governance/reviews/aud-sdd-0118-rls-auto-enable-history.md).
SDD-0172 permanece `in-progress`: el teardown fue válido, pero el fixture no
se ejecutó porque el replay histórico falló antes de construir el schema.

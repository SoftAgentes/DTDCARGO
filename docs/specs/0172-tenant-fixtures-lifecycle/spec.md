---
sdd: "0172"
title: "Lifecycle de tenant y fixtures E2E efímeras"
status: in-progress
author: "Sam (founder) + Codex"
created: 2026-07-28
updated: 2026-07-28
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

## 11. Rollback

- código/scripts: revertir el commit antes de usar fixtures;
- DB local: la prueba siempre termina en rollback;
- Cloud futuro: forward-fix; no reotorgar DELETE ni volver a CASCADE como
  rollback ordinario;
- entorno efímero fallido: destruir el proyecto, no reparar filas.

## 12. Gates pendientes

1. resolver mediante gate propio la deuda histórica de replay descrita en
   [SDD-0118](../0118-seed-migrations-idempotentes/spec.md);
2. crear un Supabase efímero nuevo que alcance `MIGRATIONS_PASSED`;
3. ejecutar seed, recorrido E2E y verificación sin DML de cleanup;
4. destruir ese entorno y volver a comprobar estado terminal.

El gate Cloud de 0268 quedó cerrado en
[REV-AUD-018](../../governance/reviews/aud-tenant-lifecycle-aplicacion.md).
Los dos intentos reales y sus teardowns quedaron registrados en
[REV-AUD-019](../../governance/reviews/aud-tenant-fixtures-ephemeral-validation.md).
SDD-0172 permanece `in-progress`: el teardown fue válido, pero el fixture no
se ejecutó porque el replay histórico falló antes de construir el schema.

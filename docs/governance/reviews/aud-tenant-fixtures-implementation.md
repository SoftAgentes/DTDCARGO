# Revisión técnica local de SDD-0172

| Control | Valor |
|---|---|
| Revisión | REV-AUD-011 |
| SDD | [SDD-0172](../../specs/0172-tenant-fixtures-lifecycle/spec.md) |
| Diseño previo | [REV-AUD-010](aud-tenant-fixtures.md) |
| Migración | [`0268_tenant_lifecycle_guardrails.sql`](../../../supabase/migrations/0268_tenant_lifecycle_guardrails.sql) |
| Fecha | 2026-07-28 |
| Resultado técnico | aprobado localmente |
| Cloud | no aplicado |

## 1. Veredicto

La implementación local cumple el diseño tenant/fixtures v1.0:

- Producción queda bloqueada sin escape por variable;
- el seed deja de borrar o reparar fixtures previas;
- el cleanup DML se retira;
- el teardown se eleva al proyecto efímero completo;
- `0268` cambia solo la FK audit y el privilegio DELETE de tenants.

Se aprueba técnicamente para commit e integración. La aplicación Cloud conserva
un gate separado por basename exacto.

## 2. Evidencia

| Gate | Resultado |
|---|---|
| Test de entorno | 5/5 |
| TypeScript | verde |
| PostgreSQL 15 | verde |
| PostgreSQL 17 | verde |
| Rollback DB | total |
| DELETE en seed/verify | 0 |
| Escape hatch efectivo | 0 |
| Función de purga | 0 |

## 3. Contrato DB

La revisión comprobó:

- preflight exige el estado real posterior a `0267`;
- FK audit final `ON DELETE RESTRICT`, validada;
- `service_role` pierde solo DELETE sobre `tenants`;
- SELECT/INSERT/UPDATE se preservan;
- roles cliente no ganan privilegios;
- no aparece policy DELETE;
- una FK fuera de alcance conserva CASCADE;
- el tenant y el evento sobreviven al intento destructivo.

## 4. Contrato de fixtures

- el project ref de Producción falla antes de crear el cliente;
- `E2E_ENVIRONMENT_KIND` debe ser `ephemeral`;
- una segunda confirmación debe coincidir con el project ref;
- URL y project ref deben coincidir;
- el marcador histórico de Producción no cambia el resultado;
- seed previo produce aborto, no DELETE;
- `verify:e2e-teardown` informa y no limpia.

## 5. Riesgos pendientes

- Cloud conserva CASCADE y DELETE hasta aplicar `0268`;
- falta ejecutar un recorrido real sobre Supabase efímero y destruirlo;
- suspensión/archivo de tenants de negocio requiere otro alcance de producto;
- retención, hold y purga permanecen en Corte E.

## 6. Límite

REV-AUD-011 no:

- aplica `0268` en Cloud;
- crea o destruye un proyecto Supabase;
- abre C, D o E;
- modifica Vercel;
- marca SDD-0172 o SDD-0166 como `done`.

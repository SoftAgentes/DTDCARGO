# Revisión técnica del Corte A2

| Control | Valor |
|---|---|
| Revisión | REV-AUD-005 |
| SDD | [SDD-0166](../../specs/0166-auditoria-gobernada-aud-01-aud-02/spec.md) |
| Diseño | [Corte A v1.0](../../specs/0166-auditoria-gobernada-aud-01-aud-02/diseno-correctivo-corte-a.md) |
| Archivo | [`0261_audit_entity_catalog_validate.sql`](../../../supabase/migrations/0261_audit_entity_catalog_validate.sql) |
| Prueba | [`0261_audit_entity_catalog_validate.test.sql`](../../../supabase/tests/0261_audit_entity_catalog_validate.test.sql) |
| Fecha | 2026-07-22 |
| Resultado técnico | aprobado para aplicación individual |
| Estado operativo | no autorizado para ejecutar; no aplicado |
| Decisión | Gate local solicitado por Sam (founder) + revisión técnica Codex |

## 1. Veredicto

`0261_audit_entity_catalog_validate` es técnicamente apta para una futura
aplicación individual de A2. Su alcance coincide con el diseño aprobado:
valida la FK creada por A1 y solo después retira el CHECK regresivo de
`entity_type`.

Esta revisión no aplica la migración ni autoriza Cloud. Tampoco habilita
SDD-0168, agrega `comment`, cambia permisos o ejecuta los Cortes B–E.

## 2. Alcance comprobado

La migración únicamente:

1. exige que `entity_audit_log` y `audit_entity_types` existan;
2. verifica la FK A1 exacta como `NOT VALID`, con `ON UPDATE/DELETE RESTRICT`;
3. exige el CHECK legacy sobre `entity_type` y `rendition` activo;
4. aborta si existe cualquier fila histórica sin catálogo;
5. valida `entity_audit_log_entity_type_fkey`;
6. comprueba la validación antes de retirar el CHECK;
7. verifica como postcondición FK validada, CHECK ausente y cero huérfanos.

No contiene `GRANT`, `REVOKE`, policies, cambios de RLS, Realtime, funciones,
viewer, writers ni DML sobre filas históricas. No incorpora nuevos tipos al
catálogo.

## 3. Numeración y concurrencia

El basename usa `0261` porque el worktree concurrente
`codex/actualidad-noticias` ya reservó `0259_newsletter_subscribers.sql` y
`0260_newsletter_campaigns.sql`. A2 se redactó en
`codex/aud-corte-a2`, separado de esos archivos y del checkout principal.

Antes de cualquier commit o aplicación deberá repetirse el inventario de
migraciones para confirmar que `0261` continúa libre fuera de esta rama.

## 4. Ensayo PostgreSQL 17.6

Se ejecutó el contrato A1 + A2 en un contenedor aislado basado en
`public.ecr.aws/supabase/postgres:17.6.1.143`, sin iniciar ni resetear el stack
Supabase del proyecto.

La prueba creó una fixture mínima dentro de una transacción y comprobó:

- catálogo A1 con 16 tipos y `rendition` activo;
- FK A1 inicialmente `NOT VALID`;
- FK A2 validada antes de retirar el CHECK;
- `rendition` aceptado después de retirar la whitelist;
- tipo desconocido rechazado por `foreign_key_violation`;
- ACL de `entity_audit_log` idéntica antes y después de A2;
- CHECK legacy ausente y cero objetos persistentes al finalizar.

El ensayo terminó en `ROLLBACK` y devolvió
`a2_fixture_rolled_back = true`. El contenedor temporal fue detenido y
eliminado. No se consultó ni modificó Cloud.

## 5. Revisión fail-closed

La aplicación aborta antes de retirar el CHECK cuando:

- falta A1, el catálogo o la columna `entity_type`;
- la FK tiene otro nombre, relación, columna, acción o ya figura validada;
- el CHECK legacy esperado no existe;
- `rendition` falta o no está activo;
- existe al menos un tipo histórico fuera del catálogo;
- PostgreSQL no confirma que la FK quedó validada.

Como el archivo se ejecuta transaccionalmente, cualquier fallo posterior
revierte la validación y conserva el CHECK. Después de una aplicación exitosa
no se debe recrear una whitelist como rollback: un error de catálogo se corrige
de forma aditiva o mediante deprecación, conforme al diseño de Corte A.

## 6. Condiciones del gate de aplicación

Antes de escribir en Cloud se debe:

1. recibir autorización explícita para **aplicar
   `0261_audit_entity_catalog_validate` en Cloud**;
2. seguir el runbook de migraciones de producción y confirmar recuperación;
3. repetir inmediatamente el preflight metadata-only de proyecto, ledger,
   constraints, catálogo, huérfanos, locks y ACL;
4. abortar ante drift, huérfanos, locks en espera o colisión de basename;
5. aplicar exclusivamente ese basename;
6. comprobar FK validada, CHECK ausente, 16 tipos mínimos, `rendition` activo,
   cero huérfanos y ACL/RLS/policies/Realtime sin cambios;
7. probar aceptación de `rendition` y rechazo de un tipo desconocido dentro de
   una transacción con rollback;
8. ejecutar advisors de seguridad y rendimiento;
9. registrar un recibo separado de aplicación.

## 7. Decisión registrada

REV-AUD-005 cierra la revisión técnica local de A2 con resultado **aprobado
para aplicación individual**. La migración permanece no aplicada. El gate de
Cloud, SDD-0168, `comment`, RBAC, Corte D, commit y push continúan separados.

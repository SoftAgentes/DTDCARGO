# Recibo de aplicación del Corte A2

| Control | Valor |
|---|---|
| Revisión | REV-AUD-006 |
| SDD | [SDD-0166](../../specs/0166-auditoria-gobernada-aud-01-aud-02/spec.md) |
| Revisión previa | [REV-AUD-005](aud-corte-a2.md) |
| Migración | [`0261_audit_entity_catalog_validate.sql`](../../../supabase/migrations/0261_audit_entity_catalog_validate.sql) |
| Proyecto | DTD Cargo · `xpfuzqombmjmxvprjgmi` |
| Fecha | 2026-07-22 |
| Resultado | aplicada y verificada |
| Ledger | `20260722203042` · `0261_audit_entity_catalog_validate` |
| Cortes B–E | excluidos; no autorizados ni aplicados |

## 1. Autorización

Sam (founder) autorizó explícitamente aplicar individualmente en Supabase
Cloud `0261_audit_entity_catalog_validate`, siguiendo el runbook y abortando
ante cualquier drift. La autorización no incluyó otra migración, RBAC,
Storage, purgas ni los Cortes B–E.

## 2. Preflight inmediato

Antes de escribir se comprobó:

- proyecto `DTD Cargo` (`xpfuzqombmjmxvprjgmi`) en estado
  `ACTIVE_HEALTHY`, PostgreSQL 17.6;
- archivo canónico presente en `origin/main` y checkout limpio en
  `cfce2fadea2cb8d64ef14d78197293e0e94acad4`;
- SHA-256 del SQL
  `3BC94842F2F1CD6FB0DAD437E64089624C2B46819E3A3FAAEE5A2699E38752DC`;
- ledger remoto hasta `0260`, sin colisión ni aplicación previa de `0261`;
- FK A1 exacta como `NOT VALID`, con `ON UPDATE/DELETE RESTRICT`;
- CHECK legacy exacto todavía presente;
- catálogo con 16 tipos activos y `rendition` activo;
- cero tipos huérfanos y cero locks en espera;
- ACL, RLS, policies y membresía Realtime capturadas para comparación;
- baseline de advisors capturado antes de la aplicación.

La migración usa timeouts acotados, valida sus precondiciones de forma
fail-closed y se ejecuta transaccionalmente. Cualquier fallo antes o después de
validar la FK conserva el CHECK al revertir la operación.

## 3. Aplicación

Supabase aceptó una única operación `apply_migration` con el SQL canónico de
`origin/main`:

```text
name: 0261_audit_entity_catalog_validate
result: success
```

No hubo bundle, reintentos ni aplicación de otra migración.

## 4. Verificación contra objetos

| Comprobación | Resultado |
|---|---|
| Ledger exacto | una fila: `20260722203042 / 0261_audit_entity_catalog_validate` |
| FK | presente, exacta y validada |
| Acciones FK | `ON UPDATE RESTRICT / ON DELETE RESTRICT` |
| CHECK legacy | ausente |
| Catálogo | 16 tipos, los 16 activos |
| `rendition` | activa |
| Huérfanos | 0 |
| Locks en espera | 0 |
| ACL | idéntica al preflight |
| RLS | idéntica al preflight |
| Policies | idénticas al preflight |
| Realtime | idéntico al preflight |

La comprobación funcional se ejecutó dentro de una transacción y demostró que
`rendition` es aceptado y `unknown_a2_contract_test` es rechazado por la FK. La
transacción terminó en `ROLLBACK` y la verificación posterior confirmó cero
filas de prueba persistidas.

## 5. Advisors

El resultado posterior fue idéntico al baseline anterior a la migración:

- seguridad: 126 hallazgos globales, cero nuevos y cero retirados;
- rendimiento: 578 hallazgos globales, cero nuevos y cero retirados;
- rendimiento atribuible a las dos tablas del corte: cero hallazgos;
- seguridad atribuible al catálogo: permanece el `INFO` preexistente
  `rls_enabled_no_policy` sobre `audit_entity_types`.

Ese `INFO` corresponde al diseño deny-by-default aprobado en A1: RLS está
habilitada y los roles de aplicación no tienen grants ni policies sobre el
catálogo. Referencia:
[RLS habilitada sin policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## 6. Cierre de A2

A2 queda **aplicada y verificada** y completa el Corte A de catálogo de
SDD-0166. Este cierre no implementa ni autoriza:

- Corte B, contrato aditivo o append-only;
- Corte C, consulta gobernada o RBAC;
- Corte D, atomicidad por dominio;
- Corte E, exportación, hold, retención o purga;
- implementación de SDD-0168 ni incorporación de `comment` al catálogo;
- cambios de código, Storage, viewer, writers, grants, RLS, policies o
  Realtime.

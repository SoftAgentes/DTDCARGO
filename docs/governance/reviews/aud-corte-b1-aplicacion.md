# Recibo de aplicación del Corte B1

| Control | Valor |
|---|---|
| Revisión | REV-AUD-009 |
| SDD | [SDD-0166](../../specs/0166-auditoria-gobernada-aud-01-aud-02/spec.md) |
| Revisión previa | [REV-AUD-008](aud-corte-b1.md) |
| Migración | [`0267_audit_contract_append_only.sql`](../../../supabase/migrations/0267_audit_contract_append_only.sql) |
| Proyecto | DTD Cargo · `xpfuzqombmjmxvprjgmi` |
| Fecha | 2026-07-28 |
| Resultado | aplicada y verificada |
| Ledger | `20260729034632` · `0267_audit_contract_append_only` |
| Cortes C–E | excluidos; no abiertos ni aplicados |

## 1. Autorización

Sam (founder) autorizó aplicar individualmente en Supabase Cloud
`0267_audit_contract_append_only`. La operación siguió el runbook, usó el
basename exacto y no incluyó otra migración, datos de negocio, Vercel ni los
Cortes C–E.

## 2. Preflight inmediato

Antes de escribir se comprobó:

- PostgreSQL 17.6 y proyecto `xpfuzqombmjmxvprjgmi`;
- commit canónico `dcbc259354d83c895fff96615e9f14eedf5a9f59` en
  `origin/main`, checkout limpio y diferencia `0/0`;
- SHA-256
  `10A9DB4453A7E13537100593C7D36A9B766121A26BF57D79FF579DC6936B33C9`;
- ledger sin una aplicación previa de `0267`;
- tabla con 9 columnas, sin writer, helper ni índice de correlación;
- 3 eventos históricos, cero actores o payloads inválidos y cero claves
  prohibidas;
- 17 tipos auditables activos y las 7 funciones SQL legacy presentes;
- RLS, policy tenant, policy amplia de `service_role`, Realtime, ACL y las dos
  FK exactamente como exigía B0;
- cero locks en espera;
- advisors de seguridad y rendimiento capturados antes de la aplicación.

El preflight fue metadata-only y agregado: no leyó ni imprimió payloads, PII o
filas de negocio.

## 3. Aplicación

Supabase aceptó una única operación `apply_migration` con el SQL canónico:

```text
name: 0267_audit_contract_append_only
result: success
```

No hubo bundle, reintento ni aplicación de otro archivo.

## 4. Verificación contra objetos

| Comprobación | Resultado |
|---|---|
| Ledger exacto | una fila: `20260729034632 / 0267_audit_contract_append_only` |
| Tabla | 17 columnas; las 8 columnas B presentes |
| Constraints | 12 CHECK B presentes y validados |
| Writer | existe; owner `postgres`; `SECURITY DEFINER`; `search_path=""` |
| ACL writer | EXECUTE solo para `service_role` y owner |
| Helper | existe; sin EXECUTE para `public`, `anon` o `authenticated` |
| ACL tabla | `authenticated`: SELECT; `service_role`: INSERT; sin UPDATE/DELETE |
| Policies | policy tenant preservada; policy amplia `service_role_all` retirada |
| Índice | `entity_audit_log_tenant_correlation_idx` presente |
| FK catálogo | validada; `ON UPDATE/DELETE RESTRICT` |
| FK tenant | preservada con `ON DELETE CASCADE` |
| Writers SQL legacy | 7 funciones presentes |
| Realtime | membresía preservada |
| Historia | 3 eventos; los 3 con defaults legacy honestos |
| Datos inválidos | 0 actores, payloads o claves prohibidas |
| Locks en espera | 0 |

El smoke funcional invocó `append_audit_event` dentro de una transacción,
comprobó el contrato persistido y terminó en `ROLLBACK`. La verificación final
confirmó 3 eventos históricos y cero residuo con la correlación de prueba.

## 5. Advisors

El advisor posterior de seguridad conservó 125 avisos globales
preexistentes —5 `INFO` y 120 `WARN`— y ninguno referencia los objetos del
Corte B1.

El advisor de rendimiento reportó 546 avisos globales —430 `INFO` y 116
`WARN`—. El único aviso atribuible al corte es `unused_index` sobre
`entity_audit_log_tenant_correlation_idx`. Es esperable inmediatamente después
de crear el índice y antes de que exista la consulta gobernada del Corte C; no
autoriza retirarlo ni abrir C. Referencia:
[índice sin uso observado](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

## 6. Cierre de B1

B1 queda **aplicado y verificado** en Cloud. El Corte B conserva una brecha
declarada: `entity_audit_log_tenant_id_fkey` todavía usa `ON DELETE CASCADE`.
Antes del cierre global de SDD-0166 debe aprobarse un diseño de ciclo de vida
del tenant/fixtures; este recibo no cambia esa FK ni crea una ruta de purga.

Este cierre no implementa ni autoriza:

- Corte C, consulta gobernada o RBAC;
- Corte D, migración de writers o atomicidad por dominio;
- Corte E, exportación, hold, retención o purga;
- otra migración Cloud;
- cambios de Vercel, código de aplicación o datos de negocio.

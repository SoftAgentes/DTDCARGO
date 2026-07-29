# Recibo de aplicación del Corte A1

| Control | Valor |
|---|---|
| Revisión | REV-AUD-004 |
| SDD | [SDD-0166](../../specs/0166-auditoria-gobernada-aud-01-aud-02/spec.md) |
| Revisión previa | [REV-AUD-003](aud-corte-a1.md) |
| Migración | [`0258_audit_entity_catalog.sql`](../../../supabase/migrations/0258_audit_entity_catalog.sql) |
| Proyecto | DTD Cargo · `xpfuzqombmjmxvprjgmi` |
| Fecha | 2026-07-22 |
| Resultado | aplicada y verificada |
| Ledger | `20260722122332` · `0258_audit_entity_catalog` |
| A2 | excluido; no redactado ni aplicado |

## 1. Autorización

Sam (founder) autorizó explícitamente aplicar
`0258_audit_entity_catalog` en Cloud. La ejecución utilizó el basename exacto y
no incluyó 0257, A2 ni ninguna otra migración.

## 2. Preflight inmediato

Antes de escribir se comprobó:

- proyecto `ACTIVE_HEALTHY`, PostgreSQL 17.6;
- catálogo y FK objetivo ausentes;
- CHECK exacto vigente;
- 3 eventos históricos, solo tipo `consolidation`, cero claves inválidas;
- cero locks en espera;
- ACL efectiva de `entity_audit_log` capturada para comparación;
- 0258 ausente del ledger;
- archivado WAL activo, 3.729 segmentos archivados y cero fallos registrados.

La migración ya había pasado un ensayo local transaccional con `ROLLBACK` en
REV-AUD-003.

## 3. Aplicación

Supabase aceptó una única operación `apply_migration`:

```text
name: 0258_audit_entity_catalog
result: success
```

No hubo reintentos, SQL fuera del archivo ni aplicación agrupada.

## 4. Verificación contra objetos

| Comprobación | Resultado |
|---|---|
| Catálogo | existe, owner `postgres` |
| Semilla | 16 tipos |
| `rendition` | activa |
| RLS | habilitada |
| Policies | 0, por deny-by-default |
| ACL catálogo | cero privilegios para `anon`, `authenticated` y `service_role` |
| FK | existe como `NOT VALID` |
| Huérfanos | 0 |
| CHECK anterior | preservado |
| ACL `entity_audit_log` | idéntica al preflight |
| Ledger exacto | presente como `20260722122332 / 0258_audit_entity_catalog` |

## 5. Advisors

- seguridad: un hallazgo `INFO` atribuible a A1,
  `rls_enabled_no_policy` sobre `audit_entity_types`;
- rendimiento: cero hallazgos atribuibles a `audit_entity_types` o
  `entity_audit_log`.

El `INFO` de seguridad es el diseño aprobado: el catálogo no tiene policies
porque tampoco tiene grants para roles de aplicación. Agregar una policy o
exponerlo al Data API contradiría el alcance A1. Los demás hallazgos globales
del proyecto preexisten y quedan fuera de esta migración.

Referencia del advisor:
[RLS habilitada sin policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## 6. Cierre de A1

A1 queda **aplicada y verificada**. Esto no cierra el Corte A completo:

- la FK continúa deliberadamente sin validar;
- el CHECK continúa deliberadamente vigente;
- A2 conserva revisión, archivo, autorización y aplicación independientes;
- no se ejecutó la matriz ACL de los cortes B/C.

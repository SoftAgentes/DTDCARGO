# Diseño técnico D2 — núcleo financiero

## Decisión

D2 usa triggers de dominio explícitos, no un trigger transversal. Cada trigger
se instala únicamente en una de las siete tablas del ledger y llama
`append_audit_event` dentro de la transacción que altera la fila.

```text
INSERT / UPDATE / DELETE financiero
  → trigger D2 allowlisted
  → evento mínimo
  → commit conjunto o rollback conjunto
```

Esta frontera evita una segunda petición con `service_role`. En acciones con
varias escrituras, cada mutación persistida queda acompañada por su evento; una
falla del writer revierte la escritura que la originó y las compensaciones
posteriores también producen su propia evidencia.

## Allowlist exacta

1. `supabase/migrations/0290_audit_d2_financial_domain.sql`
2. `supabase/tests/0290_audit_d2_financial_domain.test.sql`
3. `lib/studio/audit/financial-domain-contract.ts`
4. `lib/studio/audit/__tests__/financial-domain-contract.test.ts`
5. `app/studio/(app)/contabilidad/actions.ts`
6. `app/studio/(app)/facturacion/actions.ts`
7. `app/studio/(app)/tesoreria/actions.ts`
8. `lib/studio/collections-actions.ts`
9. `lib/studio/treasury/treasury-actions.ts`
10. este inventario y diseño;
11. `docs/specs/0174-audit-atomicidad-dominios/spec.md`;
12. `docs/governance/reviews/aud-d2-financial-domain.md`;
13. `docs/governance/README.md`;
14. `docs/governance/BASELINE-2026-07-30-07.md`.

## Verificación

- schema completo reconstruible desde cero;
- siete triggers presentes y habilitados;
- éxito produce eventos con `source=rpc` desde la frontera PostgreSQL;
- anulación conserva una razón controlada; el motivo humano pendiente se
  mantiene como no conformidad legacy;
- before/after excluye PII, referencias y montos;
- fallo forzado del writer revierte la mutación;
- PostgreSQL desechable termina en rollback;
- TypeScript, lint proporcional y prueba Vitest.

La captura progresiva del motivo humano requiere un slice R2/R3 separado.
Cloud y D3–D5 no se incluyen en este gate.

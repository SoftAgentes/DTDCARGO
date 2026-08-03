# REV-SGE-053 — Cierre productivo nominal de Nómina 0316

| Control | Valor |
|---|---|
| Fecha | 2026-08-01 |
| Proyecto | Supabase Producción `xpfuzqombmjmxvprjgmi` |
| Migración | `0316_nomina_settlement_void_governance` |
| Ledger | `20260801174332` |
| Rama publicada | `codex/governance-9-checklist-audit@495e0970` |
| Integración a `main` | no ejecutada |
| Resultado | aplicada y verificada |

## Preflight

- El founder autorizó el basename exacto y una sola migración.
- La rama aislada se publicó antes de abrir el gate.
- El objeto distintivo
  `void_payroll_settlement_governed(uuid,text,text)` no existía.
- El ledger no contenía
  `0316_nomina_settlement_void_governance`.
- El archivo aplicado conservaba SHA-256
  `314EF3AD2325F1EAAA5D7725D168354B6CC7344AB42824A0F36DED66CB80015E`.

## Aplicación y postflight

`apply_migration` devolvió `success=true` usando el basename exacto. La
verificación metadata-only confirmó:

- RPC gobernado, guard del finiquito y guard de renglones presentes;
- triggers `guard_payroll_settlement_void_trg` y
  `guard_payroll_settlement_lines_trg` activos;
- `authenticated` con `EXECUTE` sobre el RPC y `anon` sin `EXECUTE`;
- las tres funciones con `search_path` vacío;
- `payroll_settlement` activo en `audit_entity_types`, dominio `finance`;
- fila exacta presente en el ledger productivo.

El gate `migrations-applied` pasó de cinco residuos nuevos a cuatro: conserva
pendientes exclusivamente `0326`–`0329`.

## Advisors

El advisor de seguridad reporta el RPC `SECURITY DEFINER` ejecutable por
`authenticated`. Es intencional y no constituye apertura transversal: el RPC
exige `auth.uid()`, membresía admin activa, tenant coincidente, motivo y
referencia; `anon` permanece revocado. No apareció un hallazgo nuevo sobre los
guards.

Los avisos de rendimiento relacionados con `nomina_settlements` son índices de
FK históricos y un índice sin uso; 0316 no crea ni modifica esos índices. Se
conservan como backlog separado, sin ampliar este gate productivo.

## Límites

No se ejecutó una anulación sobre datos reales, no se leyó PII, no se desplegó
Vercel, no se integró código a `main` y no se aplicó ninguna otra migración.
Nómina conserva pendiente su E2E Tier-3 autenticado y la evidencia runtime del
primer uso gobernado.

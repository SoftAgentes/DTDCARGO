# REV-SGE-047 · Cierre productivo de 0317 en Financiero China

| Control | Valor |
|---|---|
| Fecha | 2026-08-01 |
| Base Git | `origin/main@c13dfa8cd30dd5095abdcad32f28245569c47c56` |
| Spec | SDD-0227 |
| Migración | `0317_partner_claim_payment_governance` |
| SHA-256 del archivo | `E5C8B4F3A9B7903BB07E7D3D24DB200CD28557AD2A7D27CC6F480A58771ADFAB` |
| Proyecto | `xpfuzqombmjmxvprjgmi` |
| Ledger productivo | `20260801123849` |
| Resultado | Aplicada y verificada |

## Autorización y alcance

El founder autorizó por basename exacto únicamente
`0317_partner_claim_payment_governance`. Se aplicó ese archivo de forma aislada
mediante `apply_migration`; no se ejecutaron 0316, 0318–0324, E5, E2E Tier-3,
Vercel ni otros cambios Cloud.

## Preflight

- `origin/main` contenía el archivo exacto en `c13dfa8c`.
- El ledger no contenía 0317.
- Existían `supplier_claim_offsets`, `user_tenants`, `entity_audit_log`,
  `audit_entity_types` y el writer AUD-01 requerido.
- RPC, guard, índice y trigger de 0317 no existían; no había colisión parcial.

## Postflight metadata-only

- El ledger contiene exactamente `0317_partner_claim_payment_governance`.
- `mark_claim_offset_paid_in_china_governed(uuid,date,text,text)` existe como
  `SECURITY DEFINER` con `search_path` vacío.
- Grants: `anon=false`, `authenticated=true`, `service_role=false`.
- `guard_claim_offset_paid_in_china()` existe con `search_path` vacío y su
  trigger está activo sobre `supplier_claim_offsets`.
- El índice idempotente es único y válido.
- `supplier_claim_offset` está activo en el catálogo AUD-01 con dominio
  `finance` e `introduced_by_ref=migration:0317`.
- No se leyeron ni modificaron filas de negocio durante la verificación.

## Advisors

El advisor de seguridad reporta que el nuevo RPC `SECURITY DEFINER` es ejecutable
por `authenticated`. Es intencional: el contrato público del RPC exige dentro
de PostgreSQL autenticación, membresía admin activa, tenant, estado bajo lock,
motivo, fecha e idempotencia; `anon` y `service_role` no tienen EXECUTE. La
recomendación genérica del advisor se conserva como evidencia:
[authenticated security-definer executable](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

Los avisos de rendimiento que mencionan `supplier_claim_offsets` —foreign keys
sin índice y dos índices históricos sin uso— ya existían y no fueron creados ni
ampliados por 0317. Su revisión permanece fuera de este gate nominal.

## Estado siguiente

0317 queda cerrada en Producción. La siguiente migración sólo puede aplicarse
con una autorización nueva que nombre exactamente
`0318_customs_clearance_governance`.

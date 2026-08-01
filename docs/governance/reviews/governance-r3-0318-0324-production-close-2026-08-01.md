# REV-SGE-048 · Cierre productivo de 0318–0324 (residuos R3)

| Control | Valor |
|---|---|
| Fecha | 2026-08-01 |
| Base Git | `origin/main@87217301` |
| Specs | SDD-0228, 0229, 0230, 0231, 0232, 0233, 0234 |
| Proyecto | `xpfuzqombmjmxvprjgmi` |
| Resultado | Siete migraciones aplicadas y verificadas |

## Autorización y alcance

El founder autorizó las siete por basename exacto, con la instrucción de
aplicarlas **de a una y verificando entre cada una**. Se aplicaron en orden
ascendente mediante `apply_migration`, con postflight metadata-only después de
cada una. No se aplicaron 0016, 0257, 0315 ni 0316; no se tocó Vercel, Cloud ni
otros cambios de configuración. No se leyeron ni modificaron filas de negocio.

## Por qué existía la brecha

Las 0317–0324 llegaron a `main` el 2026-08-01 08:09 junto con el código que llama
sus RPCs. El código quedó desplegado; las migraciones no. Ocho Server Actions del
Studio quedaron respondiendo `PGRST202` (función inexistente):

| Módulo | Server Action | RPC |
|---|---|---|
| Financiero China | `partner-finance` | `mark_claim_offset_paid_in_china_governed` |
| Aduana SENIAT | `customs` | `clear_customs_filing_governed` |
| Reclamos | `reclamos` | `pay_claim_indemnity_governed` |
| TMS | `tms/actions.ts` | `complete_tms_route_governed` |
| Almacén VE | `ve/actions.ts` | `complete_ve_delivery_governed` |
| Naviera | `naviera/actions.ts` | `authorize_consolidation_governed` |
| Inspecciones | `inspecciones/actions.ts` | `retire_inspection_report_governed` |
| Despacho | `despacho/actions.ts` | `cancel_dispatch_order_governed` |

El gate `migrations-applied` **no fue silenciado**: ninguna entró a
`pendingBelowCutoff` y REV-SGE-046 dejó constancia de que no existían en el
ledger. La brecha sobrevivió porque el check mide `supabase/migrations/` **del
checkout**, y el árbol donde se corría estaba 22 commits detrás de `origin/main`
— sin los archivos en disco, el paso sale verde por omisión. Corregido en el
runbook, en `AGENTS.md` y en la cabecera del propio check.

## Preflight (previo a la tanda)

- Las once tablas y dependencias objetivo existían en Producción:
  `customs_filings`, `customs_documents`, `client_claims`,
  `client_claim_financials`, `accounts`, `journal_entries`, `journal_lines`,
  `accounting_settings`, `tms_routes`, `tms_trucks`, `tms_drivers`, `shipments`,
  `shipment_events`, `consolidations`, `inspection_reports`,
  `inspection_report_photos`, `dispatch_orders`, `entity_audit_log`,
  `audit_entity_types`, `user_tenants`.
- Writers y correlativos presentes: `append_audit_event/15`, `next_entry_code`,
  `next_consolidation_ref`.
- Ninguna función `guard_*` ni RPC gobernado de 0318–0324 existía: sin colisión
  parcial. Cada archivo trae además su propio bloque `$preflight$` fail-closed.

## Migraciones aplicadas

| Migración | SHA-256 del archivo | Ledger |
|---|---|---|
| `0318_customs_clearance_governance` | `12079B7C440A4F2C17714A1FF3B3F408015C09367A23635300BEE6C9AE354FE3` | `20260801125818` |
| `0319_claim_indemnity_payment_governance` | `A06D84A4F32214C167FD440638CCA7829A2220767E7709C00EE8209DCC9EA854` | `20260801130015` |
| `0320_tms_route_completion_governance` | `B9FD04BD1438E524BD54D9905E9539BBC50384F2E195F8519413C00AEC10C43F` | `20260801130136` |
| `0321_warehouse_ve_delivery_governance` | `C039BB72D0F35C5F4FCCF3AEE15FDAF9CA231BF9C491A5980671F52E0551CA7B` | `20260801130255` |
| `0322_naviera_consolidation_authorization_governance` | `5F8C67EF603D8E5C552A02E00E6FF82F1FAED5704507F8265ECCC9B8D1525B52` | `20260801130411` |
| `0323_inspection_report_retirement_governance` | `52DB8E54DF1542B925A931AEF636B1D5AFD1CEB4021B590AAA9AB5C30D216749` | `20260801130518` |
| `0324_dispatch_order_cancellation_governance` | `2C960F75637A1F12D89CED9562638EA98DAB430CC9B312793A4019E99CB78CE7` | `20260801130632` |

## Postflight metadata-only

Verificado sobre las ocho del cluster R3 (0317 incluida, como control):

- Cada `name` del ledger es el **basename exacto** del archivo.
- Los ocho RPC son `SECURITY DEFINER` con `search_path` sellado en vacío.
- Grants uniformes: `anon=false`, `authenticated=true`, `service_role=false`.
- Guards con `search_path` vacío, sin EXECUTE para ningún rol, y sus triggers
  activos (`tgenabled='O'`).
- Los índices únicos parciales de idempotencia por `request_ref` son únicos y
  válidos.
- Catálogo AUD-01: `customs_filing` (`customs`), `client_claim` (`claims`),
  `tms_route` y `consolidation` (`logistics`), `inspection_report`
  (`inspections`), `dispatch_order` (`dispatch`) quedaron `active`. `shipment`
  conserva `introduced_by_ref=migration:0066` porque el `on conflict` de 0321 no
  reescribe esa columna a propósito.
- 0323 además retiró `DELETE` de `authenticated` sobre `inspection_reports` e
  `inspection_report_photos`: ambos verificados en `false`.
- `node scripts/check-migrations-applied.mjs` sobre el checkout ya sincronizado:
  **319 archivos · 328 en el ledger · OK**, con 0017 y 0257 declaradas como
  esperas a propósito.

## Advisors

Igual que en 0317, el advisor de seguridad marca los RPC `SECURITY DEFINER` como
ejecutables por `authenticated`. Es intencional y es el contrato del cluster R3:
la autorización se resuelve **dentro** de PostgreSQL (rol vigente en
`user_tenants`, tenant de la fila, estado bajo lock, motivo, idempotencia por
`request_ref`), y ni `anon` ni `service_role` tienen EXECUTE.

## Estado siguiente

El cluster R3 queda cerrado en Producción. Siguen retenidas y requieren
autorización nueva que las nombre exactamente:

- `0016`/`0017_no_olvidar` — SDD-0025, gated por review criptográfico externo;
- `0257_rates_expiry_alert` — SDD-0164, pendiente del founder;
- `0316_nomina_settlement_void_governance` — SDD-0226, vive sólo en
  `codex/governance-final-100`, no es ancestro de `main`.

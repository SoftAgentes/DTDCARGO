# REV-SGE-046 · Cierre global y reconciliación R3 sin Nómina 0316

| Control | Valor |
|---|---|
| Fecha | 2026-08-01 |
| Base verificada | `origin/main@31b4283a3ee83995db6dd50397b41388982bb602` |
| Rama candidata | `codex/governance-final-without-payroll` |
| Rama completa retenida | `codex/governance-final-100` |
| Producción | Sin cambios |
| Vercel / Cloud | Sin cambios |

## Resultado

Los residuos R3 de Financiero China, Aduana SENIAT, Reclamos, TMS, Almacén VE,
Naviera, Inspecciones y Despacho quedaron implementados por slices, con SDD,
allowlist, pruebas focales y gate nominal propio. El cierre global detectó y
corrigió una excepción RBAC obsoleta en Almacén VE: `support` permanece
read-only en Server Actions y en el RPC 0321.

La reconciliación se reconstruyó desde el `origin/main` vigente. Se omitieron el
commit de Nómina, tres merges de mantenimiento y toda evidencia generada por
SDD-0226/0316. Los otros cambios se aplicaron de forma selectiva y el registry
PLG-01 se regeneró desde el candidato resultante.

## Evidencia del candidato sin Nómina

- Vitest completo: 371 archivos y 4.460 pruebas verdes.
- ESLint completo y TypeScript `tsc --noEmit` verdes.
- SQL: 58/58 contratos sobre PostgreSQL 17 efímero, con rollback total.
- Schema rebuild: 319 archivos evaluados; 302 migraciones aplicadas desde cero;
  17 sólo-ledger; aislamiento sobre 219 tablas y dos tenants reales.
- Gobernanza: 27 políticas aprobadas y cápsula vigente.
- Componentes: cuatro fuentes CMP-01, agregado reproducible y cero rutas rotas.
- Docs: índice reproducible con 225 specs y nueve huecos históricos.
- PLG-01: read-only, 27 políticas, cuatro componentes y forward-tests 7/7.
- `git diff --check` verde; worktree limpio; rama remota sincronizada.

`pnpm verify` no se ejecutó como comando agregado porque incluye el gate
`migrations-applied` contra Producción y E2E alojados. En este cierre se
ejecutaron por separado todos sus gates locales autorizados; no se simuló ni se
saltó el hecho de que 0317–0324 todavía no existen en el ledger productivo.

## Exclusión comprobada de Nómina

El candidato no contiene:

- `docs/specs/0226-nomina-anulacion-finiquito-gobernada/spec.md`;
- `REV-SGE-031` ni su fila en el índice maestro;
- la capability `void_payroll_settlement`;
- UI, actions, pruebas unitarias o E2E de anulación de finiquito;
- `0316_nomina_settlement_void_governance.sql` ni su contrato SQL.

REV-SGE-030 permanece como auditoría histórica publicada. La implementación de
Nómina vive sólo en `codex/governance-final-100` y no es ancestro del candidato.

## Commits reconciliados

| Grupo | Commits candidatos | Estado para `main` |
|---|---|---|
| NFT, E5 y continuidad | `d13b606e`, `be3c2b81`, `b38f7e44`, `b115de09` | elegibles |
| Auditorías R3 | `15a05d81`, `813672c3`, `3212f6f4` | elegibles |
| 0317 Financiero China | `fabcefcd` | elegible; Producción separada |
| 0318 Aduana SENIAT | `04802339` | elegible; Producción separada |
| 0319 Reclamos | `1be2224e` | elegible; Producción separada |
| 0320 TMS | `0ce1ef8a` | elegible; Producción separada |
| 0321 Almacén VE | `10f854ba` + `a03fc2c7` | elegibles juntos; Producción separada |
| 0322 Naviera | `2cd16906` | elegible; Producción separada |
| 0323 Inspecciones | `1c64a5d1` | elegible; Producción separada |
| 0324 Despacho | `ed2490d5` | elegible; Producción separada |
| Registry candidato | `b192368f` | elegible con el conjunto |

“Elegible” significa verificado para integración Git desde esta rama. No
autoriza push a `main`, aplicación de migraciones, Vercel o Cloud.

## Gates nominales de Producción

Cada migración permanece fail-closed y requiere una autorización futura que
nombre exactamente una de estas referencias:

- `0317_partner_claim_payment_governance`;
- `0318_customs_clearance_governance`;
- `0319_claim_indemnity_payment_governance`;
- `0320_tms_route_completion_governance`;
- `0321_warehouse_ve_delivery_governance`;
- `0322_naviera_consolidation_authorization_governance`;
- `0323_inspection_report_retirement_governance`;
- `0324_dispatch_order_cancellation_governance`.

El gate `0316_nomina_settlement_void_governance` sigue retenido y no se puede
inferir de ninguno de los ocho anteriores.

## Operaciones independientes

- E5 conserva sólo su preflight con elegibilidad cero; no se creó un lote
  productivo.
- Los worktrees históricos se conservaron; este cierre no ejecutó limpieza.
- No se aplicaron migraciones, no se leyó PII y no se tocó Vercel, Cloud ni
  Supabase Producción.

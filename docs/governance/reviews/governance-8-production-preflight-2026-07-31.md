# REV-SGE-027 — Preflight productivo de Gobernanza 8

**Fecha:** 2026-07-31

**Proyecto:** Supabase `xpfuzqombmjmxvprjgmi`

**Resultado:** listo; aplicación bloqueada únicamente por autorización nominal

## 1. Estado remoto y dependencias

La inspección fue metadata-only: no leyó filas de negocio ni PII. Producción
confirma `entity_audit_log`, `append_audit_event(...)`, `shipments` y
`storage.objects`. Los objetos nuevos de E2–E5 y la columna
`shipments.planned_departure_at` no existen todavía.

El orden es obligatorio:

1. `0301` crea holds, `audit_admin_tenant()` y `audit_event_is_held(...)`;
2. `0302` aborta si falta `0301` y crea exportación gobernada + bucket privado;
3. `0303` aborta si falta el hold y agrega expiración de artefactos;
4. `0304` reutiliza hold/admin y agrega dry-run, aprobación y ejecución;
5. `0305` agrega el plan temporal de embarques, independiente del Corte E.

Cada migración se aplica de a una con su basename exacto y se verifica contra
el objeto creado antes de avanzar a la siguiente.

## 2. Identidad de los artefactos aprobables

| Basename | Bytes | SHA-256 |
|---|---:|---|
| `0301_audit_legal_holds` | 12458 | `76E6A4E5BB7ACC2C41794C8B5E616637FCB501CDE644201DE38EE29DF60E84B6` |
| `0302_audit_export_governed` | 14395 | `3D4FDEE5A89E86DAD585EE2FBC8518372E9BA039ED261A4D11C078EAEF85CC6B` |
| `0303_audit_export_expiry` | 5040 | `1C9768AF43E9D7AFE61FC9156551ADB3136628ABAECAB7693258E6C359254EAA` |
| `0304_audit_retention_batches` | 10123 | `50B51B75D7AF4CD6E5B2BC29F0CF297CB0BF3E10E7135990C1B796C56D01A4DE` |
| `0305_shipment_planning_dates` | 6496 | `1A1656F736CDD4E624CDBED58A6BC73B04C5F7502530FDBDDB15FBBEE23EFB0A` |

## 3. Baseline de advisors antes del DDL

| Advisor | Total | INFO | WARN |
|---|---:|---:|---:|
| Seguridad | 136 | 9 | 127 |
| Performance | 556 | 441 | 115 |

Los avisos son deuda previa y no constituyen un baseline verde. Después del
DDL se comparan claves y objetos para aislar el delta. Las RPC `SECURITY
DEFINER` autenticadas pueden producir avisos genéricos; se aceptan únicamente
si conservan `search_path = ''`, revokes explícitos y autorización interna por
tenant/rol. Cualquier aviso nuevo no explicado detiene la secuencia.

## 4. Evidencia local previa

- lint completo y frontera RSC: verdes;
- TypeScript: verde;
- Vitest: 349 archivos y 4.362 pruebas;
- Playwright: 21 aplicables verdes, tres Tier 3 omitidas por seed deliberado;
- SQL: 41 contratos en PostgreSQL 17 desechable;
- schema rebuild: 302 archivos, 285 aplicados y 17 solo-ledger; barrido de 219
  tablas y dos tenants;
- build Next.js 16.2.6: 154 páginas, verde;
- gobernanza/CMP-01: 27 políticas y cuatro componentes;
- rama limpia, seis commits delante y cero detrás de `origin/main` al iniciar
  este preflight.

## 5. Gate nominal pendiente

El founder debe nombrar `0301_audit_legal_holds`,
`0302_audit_export_governed`, `0303_audit_export_expiry`,
`0304_audit_retention_batches` y `0305_shipment_planning_dates`. La autorización
de aplicar estas definiciones no autoriza ejecutar un lote E5: el lote real
mantiene dry-run, hash, segundo aprobador y decisión humana separada.

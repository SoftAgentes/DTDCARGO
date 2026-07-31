# Revisión de aplicación productiva D2–D4 y cierre SDD-0174

| Control | Valor |
|---|---|
| Revisión | REV-AUD-046 |
| SDD | SDD-0174 · SDD-0187 · SDD-0188 · SDD-0189 |
| Fecha | 2026-07-31 |
| Proyecto | DTD Cargo · `xpfuzqombmjmxvprjgmi` |
| PostgreSQL | 17.6 |
| Resultado | cumplimiento en Producción |

## Autorización

El founder autorizó las tres aplicaciones individuales identificadas en el
checklist de SDD-0174. Se resolvieron como estos basenames exactos:

1. `0294_audit_d2_human_reasons`
2. `0295_audit_d3_human_reasons`
3. `0296_audit_d4_empty_search_path`

La autorización no se extendió a otras migraciones, Vercel ni cambios de
producto.

## Preflight

- proyecto `DTD Cargo` activo y saludable;
- ninguna migración objetivo aparecía en el ledger;
- `append_audit_event` y `audit_d3_commercial_change` existían;
- `append_audit_event_v1` y las RPC nuevas no existían;
- las cinco RPC D4 tenían owner `postgres`, `SECURITY DEFINER`,
  `search_path=pg_catalog, public` y ejecución exclusiva de `service_role`;
- 39 contratos SQL pasaron en PostgreSQL 17 efímero con rollback total.

## Aplicación individual y postcondiciones

| Orden | Migración | Resultado |
|---|---|---|
| 1 | `0294_audit_d2_human_reasons` | ledger presente; cinco RPC D2 security-invoker; `authenticated` autorizado y `anon` revocado; writer interno inaccesible |
| 2 | `0295_audit_d3_human_reasons` | ledger presente; dos RPC D3 security-invoker; `authenticated` autorizado y `anon` revocado |
| 3 | `0296_audit_d4_empty_search_path` | ledger presente; cinco RPC D4 con owner y ACL intactos, `search_path=''` y casts de enum cualificados |

Cada llamada de aplicación devolvió `success: true`. Después de la tercera,
una consulta agregada confirmó D2 5/5, D3 2/2 y D4 5/5.

## Advisors

El advisor de seguridad posterior devolvió 136 hallazgos fuera de esta allowlist
(9 `INFO`, 127 `WARN`) y cero hallazgos asociados con las funciones modificadas
o creadas por `0294`–`0296`. Este recibo no reclasifica ni corrige deuda fuera
de la allowlist.

## Verificación de cierre

`pnpm verify` terminó verde con:

- lint sin errores y 172 advertencias fuera de este slice;
- límites RSC y typecheck;
- 329 archivos y 4.246 pruebas Vitest;
- `docs:check`, `components:check` y `governance:check`;
- 39 contratos SQL en PostgreSQL 17 efímero con rollback total;
- reconstrucción desde cero de 297 migraciones.

`pnpm build` también terminó verde y se ejecutó por separado del gate
`pnpm verify`.

El E2E se omitió mediante `VERIFY_SKIP_E2E=1` porque el worktree separado no
contiene `NEXT_PUBLIC_SUPABASE_URL` ni `NEXT_PUBLIC_SUPABASE_ANON_KEY`. El paso
automático `migrations-applied` se omitió por la misma ausencia de variables.
La verificación nominal directa del ledger y las postcondiciones en Producción
consta en la sección anterior; no se copiaron credenciales al worktree.

## Clasificación

| Política | Evidencia | Clasificación |
|---|---|---|
| AUD-01 v1.0 | ledger, atomicidad, motivo humano, ACL y fallo cerrado | cumplimiento en Producción |
| SGE-00 v1.0 | aplicación individual, preflight y postcondiciones verdaderas | cumplimiento |
| AUD-02 v1.0 | no cambia consulta, retención, exportación ni Corte E | no aplica |

## Veredicto

Los tres gates técnicos de SDD-0174 quedaron cerrados. SDD-0174 puede pasar a
`done`. Corte E y las 172 advertencias de lint permanecen en carriles separados.

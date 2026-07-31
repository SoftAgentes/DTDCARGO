# REV-SGE-028 — Gobernanza 8: cierre en Producción

**Fecha:** 2026-07-31

**Proyecto:** Supabase `xpfuzqombmjmxvprjgmi`

**Resultado:** E2–E5 y planificación temporal aplicados y verificados

## 1. Autorización y orden

El founder autorizó por basename exacto `0301_audit_legal_holds`,
`0302_audit_export_governed`, `0303_audit_export_expiry`,
`0304_audit_retention_batches` y `0305_shipment_planning_dates`. Se aplicaron
una por una, en ese orden, verificando el objeto distintivo antes de continuar.

| Basename | Versión ledger | Postcondición |
|---|---|---|
| `0301_audit_legal_holds` | `20260731192238` | tablas hold, gate admin, hold check y ACL verdes |
| `0302_audit_export_governed` | `20260731192253` | tablas de exportación y bucket privado verdes |
| `0303_audit_export_expiry` | `20260731192311` | recibos y RPCs service-only verdes |
| `0304_audit_retention_batches` | `20260731192327` | dry-run/aprobación/ejecución instalados; cero lotes |
| `0305_shipment_planning_dates` | `20260731192339` | siete columnas, trigger, check y RPC verdes |

La aplicación de definiciones E5 no autorizó destrucción. La tabla de lotes
quedó vacía. Un lote futuro requiere dry-run, hash, segundo actor y autorización
humana separada antes de invocar la ejecución service-role.

## 2. Seguridad productiva

- las ocho tablas E2–E5 tienen RLS;
- `anon` y `authenticated` no tienen CRUD crudo sobre ellas;
- el bucket `audit-exports` es privado, 50 MiB máximo y MIME allowlist;
- RPC de workers y ejecución E5 quedan fuera de `authenticated`;
- planificación permite la RPC autenticada, pero valida tenant, rol, versión,
  zona, cronología y motivo dentro de la función;
- `anon` no ejecuta planificación;
- el trigger impide escribir columnas planificadas fuera del RPC.

## 3. Advisors y ledger

Baseline previo: 136 avisos de seguridad y 556 de performance. Posterior: 154 y
581. El delta relevante se explica por diseño:

- ocho INFO `rls_enabled_no_policy`: tablas sin policies porque no exponen CRUD;
- dos WARN `authenticated_security_definer_function_executable`: dry-run y
  planificación, ambas con `search_path=''`, revokes y autorización interna;
- INFO de FK/índices recién creados o todavía sin uso; cero WARN nuevo de
  performance y cero exposición anónima nueva.

El gate `migrations-applied` reportó 302 archivos, 311 entradas de Producción y
cero migraciones nuevas sin aplicar. `0017_no_olvidar` y
`0257_rates_expiry_alert` conservan sus gates históricos ajenos a Gobernanza 8.

## 4. Evidencia de aplicación

La evidencia local previa permanece en [REV-SGE-027](governance-8-production-preflight-2026-07-31.md):
4.362 pruebas, 41 contratos SQL, 21 E2E aplicables, schema rebuild de 302
migraciones y build de 154 páginas. Después del DDL se verificaron el ledger,
objetos, ACL, RLS, bucket, funciones y ausencia de lotes.

El push y deployment web se registran después de publicar el commit documental
final; no se inventa su SHA o URL en esta evidencia previa a Git.

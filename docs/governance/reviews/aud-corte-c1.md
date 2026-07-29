# Revisión técnica local del Corte C1

| Control | Valor |
|---|---|
| Revisión | REV-AUD-013 |
| SDD | [SDD-0166](../../specs/0166-auditoria-gobernada-aud-01-aud-02/spec.md) |
| Diseño | [Corte C v1.1](../../specs/0166-auditoria-gobernada-aud-01-aud-02/diseno-correctivo-corte-c.md) |
| Migración | [`0270_audit_governed_query_rbac.sql`](../../../supabase/migrations/0270_audit_governed_query_rbac.sql) |
| Prueba SQL | [`0270_audit_governed_query_rbac.test.sql`](../../../supabase/tests/0270_audit_governed_query_rbac.test.sql) |
| Fecha | 2026-07-28 |
| Resultado técnico | aprobado para aplicación individual futura |
| Estado operativo | implementado y verificado localmente; no aplicado en Cloud |
| Decisión | Gate C1 local autorizado por Sam (founder) + revisión técnica Codex |

## 1. Veredicto

C1 cumple el diseño C0 aprobado. La consulta deja de depender de `SELECT`
directo y de JSON crudo: una RPC deriva tenant y rol de la sesión, limita la
salida, pagina server-side y conserva autoría desconocida como no resuelta.

La aprobación es local. No autoriza ni registra una aplicación Cloud y no
presenta la revisión visual autenticada como ejecutada.

## 2. Contrato DB

`0270_audit_governed_query_rbac`:

1. falla cerrado si el contrato B1, ACL, policy, Realtime o FK no coinciden;
2. crea `audit_list_events` y `audit_get_event_detail` como
   `SECURITY DEFINER` con `search_path=''`;
3. deriva una única membresía admin activa y nunca recibe `tenant_id`;
4. filtra por entidad, actor, evento, source, result, sensibilidad, fechas y
   correlación exacta;
5. pagina por cursor base64url de `(occurred_at,id)`;
6. no devuelve payload, before/after ni motivo;
7. deja el reveal en allowlist v1 vacía, exige AAL2 y motivo, y registra
   exactamente un `audit_sensitive_accessed`;
8. retira la tabla de Realtime, elimina su policy de lectura y revoca
   `SELECT authenticated`;
9. conserva únicamente `INSERT service_role` para compatibilidad de writers.

## 3. Contrato de aplicación

La aplicación incorpora `audit_view` y `audit_view_sensitive` como
capabilities admin-only, usa exclusivamente `audit_list_events` y no tiene
fallback a lectura de tabla.

El viewer:

- serializa filtros en URL y consulta en el servidor;
- muestra UTC explícito;
- diferencia actor real de `No resuelto`;
- presenta fuente, resultado, sensibilidad y correlación;
- distingue acceso denegado, filtro inválido, fallo, vacío, sin resultados y
  fin de paginación;
- no recibe ni renderiza JSON crudo;
- mantiene una presentación compatible sobre la misma salida redacted cuando
  `AUDIT_GOVERNED_VIEWER=false`.

No se habilitó reveal en UI: AAL2 y una allowlist no vacía deben aprobarse y
verificarse antes de ofrecer esa interacción.

## 4. Evidencia

| Evidencia | Resultado |
|---|---|
| PostgreSQL 15 | verde; rollback total |
| PostgreSQL 17 | verde; rollback total |
| Contrato SQL | tenant, ACL, cursor, filtros, AAL2 y acceso auditado |
| Pruebas de aplicación | 31/31 |
| Suite Vitest completa | 293 archivos; 3984 pruebas |
| TypeScript | `tsc --noEmit` verde |
| ESLint focalizado | verde |
| ESLint completo | 0 errores; 172 warnings preexistentes |
| Build Next.js | verde; 152 páginas estáticas generadas |
| Datos persistidos | cero |
| Cloud | no modificado |

El warning de `wal_level` en los contenedores estándar no afecta la prueba de
membresía de publicación. Ambos ensayos terminaron en
`audit_c1_fixture_rolled_back = true`.

El build reportó el warning preexistente de trazado NFT en `next.config.ts` y
ausencia de variables Supabase públicas durante prerender, pero terminó con
código `0`. Ninguno corresponde a los archivos de C1.

## 5. Riesgos y límites

- `0270` debe ejecutarse después de `0267`; sus precondiciones abortan ante
  drift.
- El viewer autenticado no puede validarse contra un entorno que todavía no
  tenga las RPCs.
- Los writers y su atomicidad pertenecen al Corte D.
- Exportación, hold y retención pertenecen al Corte E.
- `0268` y `0270` continúan sin aplicar en Cloud.

## 6. Gate siguiente

El siguiente gate de C1 es aplicar individualmente
`0270_audit_governed_query_rbac` mediante el runbook, con autorización que
nombre exactamente el basename, preflight fresco, postcondiciones, advisors y
recorrido visual autenticado. Esa condición no impide abrir el inventario
read-only del Corte D como gate separado.

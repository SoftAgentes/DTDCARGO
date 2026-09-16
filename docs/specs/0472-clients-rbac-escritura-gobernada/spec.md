---
sdd: "0472"
title: "Clientes: escritura gobernada por RBAC efectivo"
status: in-progress
author: "Codex"
created: 2026-09-16
updated: 2026-09-16
supersedes: null
superseded_by: null
related: ["0408", "0467", "0469"]
confidencialidad: interno
---

# SDD-0472 — Clientes: escritura gobernada por RBAC efectivo

## Problema y alcance

El permiso TypeScript `moduleEditDenial('clients')` protege las Server Actions,
pero no una petición directa a la Data API. `0006_clients.sql` concede
SELECT/INSERT/UPDATE/DELETE a authenticated y crea `clients by tenant FOR ALL`.
La migración 0230 retiró el filtro `deleted_at IS NULL` de esa policy; su forma
vigente a esta base es tenant-only. Un miembro activo sin edición del módulo
podía insertar, modificar o borrar físicamente clientes por esa vía.

Se revalidó el contrato en los archivos locales de la base reservada
`cc131d4bfcd30508da29c0cea197710fa130e41f` (padre main
`3f81ca83232e54218f486eac1943beab422c89a8`). La observación productiva del
2026-09-15 pertenece al cierre 0455; no se consultó producción en esta tarea.

Objetivo: impedir DELETE físico por authenticated y exigir para INSERT/UPDATE
el permiso efectivo de edición de clients, sin cambios visuales. No cambia
columnas, datos, Server Actions, retención, UI, publicación ni otros módulos.

## Decisión técnica

`0456_clients_write_rbac.sql` sustituye la policy FOR ALL por:

| Operación | Policy | Predicado |
|---|---|---|
| SELECT Studio | `clients by tenant` | El mismo tenant-only vigente de 0230 |
| INSERT | `clients insert authorized` | WITH CHECK: tenant único activo y helper de edición |
| UPDATE | `clients update authorized` | USING y WITH CHECK: tenant único activo y helper de edición |
| DELETE | Ninguna | Se revoca además el privilegio efectivo de authenticated |

El predicado de escritura combina `tenant_id = (select get_user_tenant_id())` con
`document_entity_authorized('client', tenant_id, 'edit')`. Desde 0453, el
primer helper devuelve NULL con cero o múltiples memberships activos. El
segundo comprueba membership activo del tenant y aplica defaults/overrides.
No se usa service_role para compensar una denegación.
Se conserva el SELECT escalar/InitPlan introducido por 0012; el fixture SQL
extrae esa policy real antes de aplicar 0230.

Se reutiliza sin redefinir el helper que incorporó client→clients en 0440
(SDD-0408), cuya forma vigente es 0444. Su mapa interno centralizado en
`document_entity_module_contract` evita otra lista de roles en las policies.
El nombre documental queda como acoplamiento explícito: evolucionarlo exige
revalidar también el contrato de escritura de clientes. No se introduce una
abstracción nueva ni se modifica el wrapper de compatibilidad.

| Rol | Default de edición | Override |
|---|---|---|
| admin | Sí, con membership activo único | Siempre admin |
| commercial / operations / accounting | Sí | false/false o true/false revoca |
| warehouse / marketing | No | true/true habilita |
| support | No | Nunca habilita edición |
| NULL / desconocido / sin membership / desactivado | No | Falla cerrado |

0357 garantiza `can_edit ⇒ can_view`, columnas NOT NULL, PK por tenant/rol/módulo
y un CHECK de roles conocidos. El preflight exige esos invariantes porque el
helper consulta can_edit. Los errores SQL abortan la escritura; no se usa el
fallback a defaults del lector TypeScript ante error de consulta.

## Compatibilidad y límites

- SELECT Studio conserva exactamente su predicado; las queries de aplicación
  siguen filtrando vivos. `clients portal self read` y sus restricciones se
  preservan íntegramente. No se agrega permiso de vista del módulo a SELECT.
- No se exige `deleted_at IS NULL` en UPDATE: el soft-delete INVOKER necesita
  escribir la fecha y la lectura vigente debe permitirlo (regresión 0230).
- `soft_delete_client_with_audit_reason` sigue siendo el camino ordinario del
  Studio, SECURITY INVOKER y ACL originales. Una denegación UPDATE puede
  devolver cero filas; la RPC devuelve false y no inventa éxito.
- 0454 conserva revocación Portal, guards de cliente vivo y atomicidad; 0455
  conserva client_deleted/client_merged, motivo humano/default y auditoría
  atómica. Sin backfill ni alteración de eventos históricos.
- `merge_clients` conserva SECURITY DEFINER, sus guards y su UPDATE atómico.
  Su guard previo admite support: esta tarea cierra escritura directa e INVOKER,
  no redefine esa autorización específica. Se registra fuera de alcance.
- La corrección DB no prueba smokes de navegador, despliegue ni estado actual
  de producción. La integración y release se deciden después por Director.

## Seguridad de la migración

Un único DO contiene preflight, DDL y postflight: un fallo revierte todo incluso
si el cliente SQL usa autocommit. `lock_timeout=5s` limita espera del lock de
clients y se restaura al finalizar. No se consultan filas de negocio.

El preflight exige RLS/roles/columnas, privilegios requeridos, cuerpos canónicos
normalizados sólo CRLF→LF de las ocho funciones dependientes, sus
SECURITY/search_path, volatilidad i/s/v canónica y ausencia de STRICT/LEAKPROOF,
constraints de overrides y los cuatro triggers de 0454/0455 con condición y ACL.
Rechaza authenticated como dueño/heredero del dueño de clients y permisos de
escritura directa API sobre la tabla de overrides.
Rechaza policies de escritura desconocidas o estados parciales. Sólo admite el
estado previo conocido o el estado final exacto para reaplicación.

Una huella de catálogo antes/después conserva definiciones, dueños y ACL de
funciones públicas, triggers dependientes, policies externas al delta, RLS y
privilegios ajenos al DELETE revocado. El postflight comprueba las tres policies
finales y `has_table_privilege` efectivo, incluyendo PUBLIC/herencia. Si persiste
DELETE por otro grant, aborta sin retirar permisos ajenos automáticamente.
Los comentarios de policies y el NOTICE con huella dejan evidencia comprobable.

Riesgos: el lock bloquea escrituras brevemente; un drift requiere revisión
explícita, no reparación silenciosa. Una evolución legítima del helper requiere
revisar las huellas de dependencia. No se amplían otros módulos ni se cambian
las funciones privilegiadas existentes.

## Allowlist exacta

- `docs/specs/0472-clients-rbac-escritura-gobernada/spec.md`
- `docs/specs/README.md` (generado)
- `supabase/migrations/0456_clients_write_rbac.sql`
- `supabase/tests/0456_clients_write_rbac.test.sql`
- `.agents/handoffs/0472-clients-rbac-escritura-gobernada.md`

Derivados ignorados `graphify-out/` para estructura, Archify y preview local.
No se modifican tests existentes, helper compartido ni migraciones aplicadas.
0456 se inventarió libre con fetch, 96 refs/worktrees y PRs abiertas #114/#126
el 2026-09-16; la asignación coordinada pertenece a esta tarea.

## Aceptación y evidencia requerida

1. DELETE denegado bajo authenticated para los siete roles; sin policy DELETE/ALL.
2. Matriz INSERT/UPDATE de defaults y overrides habilitados, revocados y sólo vista.
3. Negativos por tenant ajeno, cambio de tenant, rol desconocido/NULL, membership
   ausente/desactivado/múltiple y errores de consulta; sin escritura efectiva.
4. SELECT preservado y caminos de create/update/asignar asesor sin cambios de API.
5. Soft-delete INVOKER, motivos, auditoría, revocación Portal, merge y rollback
   atómico preservados; ACL service_role no ampliada.
6. Test SQL PostgreSQL 17 con controles rojos previos al arreglo, reaplicación y
   drift de catálogo deliberado que falla sin cambio parcial.
7. Regresiones 0440/0454/0455, tests focales clientes/RBAC, docs:check, sdd:check,
   pending-migration-symbols, sql-tests, schema-rebuild y pnpm verify registrados
   con PASÓ/FALLÓ/NO EJECUTADO/NO DISPONIBLE, incluidos todos los SKIPs.
8. Revisión advisory y gobernanza, sin declaración de cumplimiento legal.
9. Estructura/semántica/Archify/preview registradas por separado; no publicar bóveda
   compartida desde esta rama.

Implementación entregada en [PR draft #127](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/127).
PostgreSQL 17.11: control rojo reproducido, 162 aserciones verdes finales y
rollback total. Regresiones 0440/0454/0455, 197 contratos SQL y reconstrucción
435 migraciones + 18 sólo-ledger PASARON. Focal clientes/RBAC: 143 tests.
Verify ejecutó 16/17 pasos: 7.301 tests, build y controles medidos PASARON;
ledger productivo SKIP y E2E con 149 passed, 4 flaky y 33 skipped. El gate declara
CIERRE INCOMPLETO; no se convierte exit 0 en verde completo. Tras revisión se
añadió validación de atributos funcionales y se repitieron sus gates SQL afectados.
La SDD permanece in-progress hasta revisión de los pendientes críticos.
Recibos exactos, advisory, estados de conocimiento y pendientes:
`.agents/handoffs/0472-clients-rbac-escritura-gobernada.md`.

## Gobernanza y privacidad

| Política | Clasificación del delta |
|---|---|
| SGE-00.05 | Cumplimiento acotado: matriz SQL positiva/negativa PASÓ en PostgreSQL local |
| MP-01 | Impedir P0 ordinario; no conformidad previa P2 sin restauración permanece |
| AUD-01 | Cumplimiento acotado: conservación 0454/0455 con regresiones PASÓ |
| AUD-02 | No aplica: sin cambio de consulta, exportación ni retención de auditoría |
| BTN-01 | No aplica al delta visual; diálogo existente preservado |

Revisión `.claude/skills/revisar-datos-ve/SKILL.md`: inventario local, sin filas
reales. Clients trata identidad, contacto, ubicación, vínculos CRM, opt-ins,
fotos y contactos sin cuenta propia. No se añade dato ni destinatario.
Revocar acceso y soft-delete no son supresión integral: fila, auditoría y
adjuntos permanecen. La retención y notas/motivos libres con potencial PII son
deuda anterior fuera de alcance. Checklist e inventario se adjuntan al handoff;
no acreditan cumplimiento legal ni revisión jurídica.

## Entrega e integración

Commits selectivos y push de rama propia/PR draft autorizados. Sin merge,
deploy ni aplicación productiva. Director revisa SHA/base, evidencia, pendientes
y orden de integración después de los smokes de Sam. Estado SDD independiente
de PR, integración y release.

Referencias técnicas consultadas el 2026-09-16: [RLS PostgreSQL 17](https://www.postgresql.org/docs/17/ddl-rowsecurity.html),
[RLS Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security)
y [changelog Supabase](https://supabase.com/changelog). La comprobación del
contrato específico se hace con migraciones versionadas y PostgreSQL local.

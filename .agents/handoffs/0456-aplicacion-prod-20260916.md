# 0456 aplicada a producción — 2026-09-16

Tarea: aplicar únicamente `0456_clients_write_rbac.sql` (SDD-0472) a Supabase
producción y verificar ledger, policies y privilegios sin leer filas de negocio.
La ejecutó el Director con autorización nominal de Sam. Texto literal:

> autorizo aplicar en Supabase producción únicamente
> 0456_clients_write_rbac.sql, una sola migración, y después verificar ledger,
> policies y privilegios sin leer filas de negocio

Runbook: `docs/runbooks/aplicar-migraciones-prod.md`.

- Proyecto: DTD Cargo, `xpfuzqombmjmxvprjgmi`, `ACTIVE_HEALTHY`, PostgreSQL 17.
- Fuente aplicada: merge de `main`
  `2993b1ca46559e55f8284d576be43e0bceb6da2a`.
- Blob exacto: `33d791ac2858d9e48e0f176be86c5a00cbd863c5`,
  16.131 bytes, ruta `supabase/migrations/0456_clients_write_rbac.sql`.
- Nombre exacto enviado al ledger: `0456_clients_write_rbac`.
- Alcance: una migración y comprobaciones de catálogo/ledger. No se autorizaron
  otras migraciones, lectura de filas de negocio, fixtures, limpieza ni smoke con
  escritura en producción.

## COMPLETADO

**APLICADA Y VERIFICADA.** `apply_migration` devolvió `{"success":true}`. El
ledger pasó de 460 a 461 entradas y dejó `0456_clients_write_rbac` como última
migración:

| Campo | Valor |
|---|---|
| `version` | `20260916160254` |
| `name` | `0456_clients_write_rbac` |
| respuesta de aplicación | `{"success":true}` |
| verificación independiente | `all_checks_passed = true` |

La migración convirtió la policy `clients by tenant` de `FOR ALL` a `FOR SELECT`,
creó policies separadas para `INSERT` y `UPDATE` con tenant activo y permiso
efectivo `clients/edit`, y revocó `DELETE` a `authenticated`. Conservó la lectura
del Portal, soft-delete, auditoría, triggers y helpers existentes.

## PREFLIGHT DE PRODUCCIÓN

Todas las lecturas fueron sobre el proyecto, ledger o `pg_catalog`. **No se leyó
ninguna fila de `public.clients` ni de otra tabla de negocio.**

- Proyecto confirmado en vivo como DTD Cargo, ref
  `xpfuzqombmjmxvprjgmi`, estado `ACTIVE_HEALTHY`, PostgreSQL 17.6.
- Ledger: 460 entradas, última `0455_borrado_cliente_auditado`; 0456 ausente.
- `public.clients`: tabla presente, RLS activa, sin FORCE, dueño `postgres`;
  `authenticated` no pertenece al rol dueño.
- Privilegios previos de `authenticated`: SELECT/INSERT/UPDATE/DELETE presentes y
  TRUNCATE ausente. `anon` sin INSERT/UPDATE/DELETE/TRUNCATE.
- Policies previas: `clients by tenant` permisiva `FOR ALL` y
  `clients portal self read` `FOR SELECT`.
- Las ocho funciones protegidas resolvieron con los hashes, SECURITY
  DEFINER/INVOKER, volatilidad, STRICT/LEAKPROOF y `search_path` esperados.
- Los cuatro triggers protegidos estaban habilitados y los tres constraints de
  `studio_role_module_overrides` estaban validados.

La primera consulta de catálogo falló antes de devolver resultados con `42883`
por intentar calificar la construcción especial `COALESCE` como función de
`pg_catalog`. Fue una consulta de solo lectura; no produjo cambios. Se corrigió y
se ejecutó una vez con el resultado anterior.

## APLICACIÓN

Se leyó el SQL directamente del blob de `main` en el merge `2993b1ca` y se envió
íntegro a `apply_migration` con el nombre `0456_clients_write_rbac`. No se armó un
bundle ni se aplicó otro archivo. El único `DO` de 0456 ejecutó preflight, DDL y
postflight en la misma transacción, con `lock_timeout = 5s`; no hizo backfill ni
DML sobre filas de negocio.

## POSTFLIGHT DE PRODUCCIÓN

La comprobación independiente posterior usó únicamente `list_migrations` y
`pg_catalog`. Los 16 checks dieron `true`:

- `clients by tenant`: `FOR SELECT`, permisiva, sólo `authenticated`, tenant
  exacto por `get_user_tenant_id()`.
- `clients insert authorized`: `FOR INSERT`, `WITH CHECK` exacto con tenant y
  `document_entity_authorized('client', tenant_id, 'edit')`.
- `clients update authorized`: `FOR UPDATE`, `USING` y `WITH CHECK` exactos con
  el mismo permiso.
- `clients portal self read` se conservó como `FOR SELECT`.
- No quedó policy `FOR ALL`, `FOR DELETE` ni otra policy de escritura.
- `authenticated` conserva SELECT/INSERT/UPDATE, perdió DELETE y no tiene
  TRUNCATE. `anon` sigue sin escrituras.
- RLS de `clients` sigue activa.
- Las ocho funciones protegidas conservaron exactamente cuerpos y atributos.
- Los cuatro triggers protegidos siguen habilitados.
- Los tres constraints de overrides siguen presentes y validados.
- Ledger: 461 entradas; 0456 es la última con versión `20260916160254`.

No se consultaron conteos de clientes, identificadores, nombres, documentos,
contactos ni ningún otro dato personal o de negocio.

## VALIDACIÓN RELACIONADA

- PASÓ: aplicación transaccional y postflight incorporado en 0456.
- PASÓ: verificación independiente de ledger, cuatro policies, privilegios, RLS,
  ocho funciones, cuatro triggers y tres constraints.
- PASÓ antes de la integración: 197 contratos SQL, reconstrucción de 435
  migraciones + 18 sólo-ledger, 219 tablas y dos tenants sintéticos.
- PASÓ: workflow `Calidad continua` del merge `2993b1ca`, incluido build y árbol
  reproducible.
- PASÓ: Vercel Production para `2993b1ca`.
- PASÓ: publicación de conocimiento; estructura, piloto semántico 16/16,
  Archify y Obsidian `CURRENT` para `2993b1ca`.
- NO EJECUTADO: smoke remoto en rama Supabase. La rama efímera anterior terminó
  `MIGRATIONS_FAILED` durante el replay histórico antes de fixtures o 0456 y fue
  eliminada. El control plane no entregó el error SQL exacto.
- NO EJECUTADO: prueba de comportamiento con usuarios/filas en producción; quedó
  fuera de la autorización y de la frontera de datos personales.

## PENDIENTES DE ESTA TAREA

- Integrar este recibo documental mediante una PR separada si Sam autoriza su
  publicación. La aplicación de base ya está completa y no depende de esa PR.
- Un smoke de comportamiento con identidad y datos sintéticos requiere un
  entorno controlado que pueda reproducir el historial completo, o una
  autorización distinta y explícita si se propusiera producción.

## FUERA DE ALCANCE DETECTADO

- Aplicar cualquier migración distinta de 0456.
- Leer o escribir filas de clientes para probar el comportamiento.
- Corregir el replay histórico de ramas Supabase.
- Eliminar la rama Git o el worktree de SDD-0472.
- Declarar cobertura semántica global: sigue parcial, 16/1.075.

## HANDOFF AL DIRECTOR

Producción queda en 0456 con metadata final exacta y ledger confirmado. La PR
#127, su CI y su despliegue ya estaban integrados antes de aplicar. La rama Git y
el worktree permanecen limpios salvo por este recibo hasta su commit local; no se
eliminan. El smoke remoto sigue clasificado honestamente como NO EJECUTADO.

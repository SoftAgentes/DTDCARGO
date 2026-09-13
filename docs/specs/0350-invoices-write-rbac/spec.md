---
sdd: 0350
title: Aplicar RBAC de escritura a facturas en la base
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0021
  - SDD-0085
  - SDD-0139
  - SDD-0174
confidencialidad: interno
---

# SDD-0350 — RBAC de escritura para facturas

> **Nota de importación — 2026-09-12.** Esta spec se importa desde la PR #21 (`ea9952a4`; commit
> `ff3b4fa1`) con su contenido original, `status: done` incluido: ese estado describe el cierre técnico
> local de la rama de origen, no la aplicación en producción. Su migración `0407_invoices_write_rbac`
> está **PENDIENTE DE APLICAR** y declarada en `supabase/migrations-baseline.json`; fusionar no autoriza
> aplicarla. Lote L07 del bloque C, con orden obligatorio **0407 → 0411, 0412 y 0413 → despliegue y
> smoke por roles de sus consumidores → 0414** (SDD-0354 a SDD-0357): el preflight de 0411 exige la
> policy `invoices_team_select` que crea 0407. Medido en local encima de `main`: hoy los cinco roles no
> financieros insertan, actualizan, borran y anulan facturas por PostgREST; tras 0407 sólo accounting y
> admin escriben, el INSERT no autorizado falla con 42501, el UPDATE, el soft-delete y la anulación no
> autorizados afectan 0 filas sin error, y ninguna sesión conserva DELETE. Todos los escritores por
> sesión de la app ya exigen un módulo de dinero y ningún código de producción borra facturas, así que
> 0407 puede aplicarse antes del despliegue; la lectura por rol queda idéntica. La policy histórica
> efectiva de `main` es `tenant_id = get_user_tenant_id()` sin `deleted_at is null`, que retiró
> `0230_fix_rls_soft_delete_blocked.sql:36`; el fixture del contrato la reproduce. No se importan el
> checklist `docs/audits/2026-09-02-codex-arranque-checklist.md` ni los handoffs `2026-09-02-*` de la
> allowlist; entran fuera de ella el registro de migraciones pendientes, que exige el gate
> `migrations-applied`, y el handoff de esta importación, `.agents/handoffs/c-l07-fidelizacion-conversations.md`,
> donde queda la evidencia local. La vuelta atrás de 0407, probada en PostgreSQL 17 local (el catálogo de
> `invoices` queda idéntico a `main` después de aplicarla y revertirla), está en la sección «VUELTA ATRÁS
> DE 0407 Y 0414» de ese handoff; si 0414 estaba aplicada, primero se revierte 0414.
>
> **Desviación respecto del origen**, pre-autorizada por el Director el 2026-09-12 antes de cualquier
> aplicación: `0407` fija `set local lock_timeout = '5s'` y `statement_timeout = '60s'` antes de su
> primer lock, al nivel superior del archivo. Toma ACCESS EXCLUSIVE sobre `invoices`: con un lector que
> la retenía 15 s, el archivo de origen esperó 13,99 s y dejó 11,99 s en cola a un lector nuevo; el
> archivo actual corta a los 5,0 s y se revierte entero. El tope rige sólo dentro de la transacción de
> aplicación, como la de `apply_migration`; en autocommit no tiene efecto, a diferencia de 0450 y 0451,
> que lo fijan dentro de su bloque `do`. El contrato `0407` agrega la aserción estática y la comprobación
> en transacción de los timeouts, así que la migración y su contrato ya no son idénticos al origen.

## Estado real

La aplicación reserva Facturación a `accounting` y `admin`, pero la policy
histórica `invoices by tenant` era `FOR ALL`. Cualquier sesión `authenticated`
activa del tenant podía omitir la Server Action y escribir directamente por
PostgREST. Además, `authenticated` conservaba `DELETE` físico sobre una entidad
financiera que debe anularse o retirarse de forma lógica.

## Decisión

1. Sustituir la policy `FOR ALL` por policies separadas de `SELECT`, `INSERT` y
   `UPDATE`.
2. Exigir tenant activo y `current_studio_role()` en `accounting|admin` para
   insertar o actualizar.
3. Revocar `DELETE` a `authenticated`; `service_role` conserva el camino
   privilegiado para jobs/RPCs controladas.
4. Mantener temporalmente el `SELECT` tenant-wide y la policy del Portal.
   Cerrar lectura cruda requiere primero reemplazar consumidores comerciales
   por RPCs agregadas/minimizadas; no se mezcla con este slice de integridad.

## Gate SGE-00

- `cumplimiento` SGE-00.03/04: facturas emitidas no admiten purga desde la
  sesión del equipo y sus mutaciones conservan los triggers AUD-D2 existentes.
- `cumplimiento` SGE-00.05: rol y tenant se prueban en RLS, no sólo en UI.
- `cumplimiento` SGE-00.06/11: INSERT no autorizado falla en la base; UPDATE no
  autorizado no alcanza filas y la aplicación conserva su mensaje previo.
- `no aplica`: visuales, accesibilidad, IA, notificaciones o cambio de flujo.
- `no conformidad acotada`: SELECT continúa tenant-wide hasta crear facades
  minimizadas para los consumidores no financieros; queda en el backlog P1.

## MP-01 y AUD-01

- Factura emitida: P3/R3; se anula, no se borra físicamente.
- Borrador: retiro P2; este slice permite UPDATE/soft-delete sólo a
  `accounting|admin`.
- Los triggers financieros D2 existentes siguen auditando INSERT/UPDATE; este
  cambio no introduce una vía de mutación nueva.

## Allowlist exacta

- `supabase/migrations/0407_invoices_write_rbac.sql`
- `supabase/tests/0407_invoices_write_rbac.test.sql`
- `docs/specs/0350-invoices-write-rbac/spec.md`
- `docs/specs/README.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `.agents/handoffs/2026-09-02-invoices-write-rbac-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

## Aceptación

- `commercial`, `operations`, `warehouse`, `support` y `marketing` no insertan
  ni actualizan facturas por PostgREST directo.
- Membresía desactivada y accounting de otro tenant no escriben.
- `accounting` y `admin` del tenant conservan INSERT/UPDATE.
- Ninguna sesión `authenticated`, incluido admin, conserva DELETE físico.
- `service_role` conserva el acceso controlado y la policy del Portal no cambia.
- Contrato SQL, rebuild, docs, numeración, gobernanza y diff pasan.

## Fuera de alcance

- Cerrar el SELECT crudo de facturas o cambiar sus consumidores agregados.
- Rediseñar estados, Server Actions, UI o triggers AUD-D2.
- Aplicar la migración a Cloud/Producción.

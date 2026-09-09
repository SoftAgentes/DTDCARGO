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

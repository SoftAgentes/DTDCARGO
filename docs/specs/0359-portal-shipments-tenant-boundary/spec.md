---
sdd: 0359
title: Aislar envíos, documentos e hitos Portal por principal y tenant
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0042
  - SDD-0132
  - SDD-0345
  - SDD-0357
confidencialidad: interno
---

# SDD-0359 — Frontera del dominio Envíos en Portal

## Evidencia y alcance

Las policies Portal de `shipments` (0080), `shipment_documents` (0086) y
`shipment_events` (0196) siguen comparando sólo Shipping Mark. El código es único
por tenant, no global. `getMyShipment` y `listMyShipments` también filtran sólo
por markbox; el contexto privado de SDD-0345 confía en esa lectura RLS antes de
firmar adjuntos y consultar datos internos del envío.

El alcance es la frontera de lectura de estas tres tablas del mismo dominio,
no la autorización global de Documentos ni las otras entidades Portal.

## Decisión

1. Reemplazar sólo sus tres policies `portal self read`; conservar policies,
   grants y escritura del equipo, así como `service_role`.
2. Exigir vínculo activo de `auth.uid()`, cliente vivo y tenant coherente entre
   vínculo, cliente y envío. Mantener exclusión de envíos soft-deleted.
3. Documentos e hitos deben pertenecer a un envío vivo autorizado y compartir
   su tenant. Documentos exige además que su markbox denormalizado coincida con
   el propietario actual del envío; una etiqueta atrasada no autoriza.
4. No crear otra función SECURITY DEFINER ni conceder privilegios. Las
   subconsultas conservan la RLS de `client_users`, `clients` y `shipments`.
5. Preflight rechaza tablas sin RLS o policies de lectura inesperadas; postflight
   confirma policies SELECT-only. No modifica las migraciones históricas.
6. Reproducir primero lectura cruzada con las migraciones históricas reales y
   dos tenants sintéticos; después comprobar cierre, principales inválidos,
   coherencia de relaciones, principal dual y CRUD del equipo conservado.

## Allowlist exacta

- `supabase/migrations/0416_portal_shipments_tenant_boundary.sql`
- `supabase/tests/0416_portal_shipments_tenant_boundary.test.sql`
- `docs/specs/0359-portal-shipments-tenant-boundary/spec.md`
- `docs/specs/README.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `.agents/handoffs/2026-09-02-portal-shipments-tenant-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

## Gate constitucional

| Principio | Resultado y evidencia |
|---|---|
| SGE-00.01 | cumplimiento: misma lectura propia, sin nuevos verbos o estados |
| SGE-00.02 | cumplimiento: no modifica ni purga filas; escritura interna conservada |
| SGE-00.03 | cumplimiento: frontera R3 con prueba negativa y gate Cloud individual |
| SGE-00.04 | no aplica: no crea acciones críticas o cambios de auditoría |
| SGE-00.05 | cumplimiento: tenant, vínculo, propietario y soft-delete probados |
| SGE-00.06 | cumplimiento: preflight falla ante drift antes de reemplazar policies |
| SGE-00.07 | cumplimiento: no presenta SQL local como estado de Producción |
| SGE-00.08 | no aplica: no agrega pasos al Portal |
| SGE-00.09 | cumplimiento: reutiliza principal de SDD-0357, sin helper elevado nuevo |
| SGE-00.10 | no aplica: sin cambios visuales o interactivos |
| SGE-00.11 | cumplimiento: mensajes de preflight identifican tabla y drift |
| SGE-00.12 | cumplimiento: no aplica Cloud ni despliega sin OK específico |

MP-01: conserva registros, retención y evidencia. No captura, mueve ni borra PII;
las pruebas usan datos sintéticos con rollback total.

## Aceptación

- Portal A/B no ve envíos ni hijos del otro tenant con el mismo Shipping Mark.
- Cliente retirado, vínculo revocado/invitado/incoherente e identidad ausente no
  obtienen lectura por la policy Portal.
- Hijos con tenant o propietario incoherente, padres retirados e hijos
  soft-deleted no se vuelven legibles por una etiqueta coincidente.
- Un principal dual conserva el acceso legítimo de equipo más su propio Portal;
  la policy Portal no amplía su acceso a terceros de otros tenants.
- CRUD del equipo sigue limitado al tenant; Portal puro no escribe;
  `service_role` mantiene su operación controlada.
- SQL/rebuild, unitarios focales Portal, docs, numeración, gobernanza y
  componentes pasan. Sin cambios TS/TSX: el baseline canónico es SDD-0357.

## Release y límites

0416 requiere 0080, 0086 y 0196, no una RPC o versión de aplicación nueva.
Su gate alojado es individual y debe incluir smoke de envíos, documentos e
hitos. No habilita operaciones sobre filas reales, Storage, secretos o deploy.
La matriz global de roles Studio y el resto del Portal quedan fuera de alcance.

La revisión usa la [guía oficial de RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
El [cambio de grants por defecto](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)
no altera las tablas existentes: este slice conserva sus ACL explícitas y sólo
reemplaza policies. Se usa el correlativo propio `pnpm sdd:next`, no el formato
genérico timestamp de la CLI, conforme a `AGENTS.md`.

## Evidencia local

- SQL: 157 contratos aprobados. 0416 reproduce los tres cruces con 0080, 0086 y
  0196 reales antes del cierre; después valida principales, relaciones y CRUD.
- Portal: 6 archivos / 37 pruebas focales aprobadas (detalle, listado, home,
  hitos y documentos de envío).
- Rebuild: 413 migraciones; 395 desde cero y 18 sólo-ledger; comprobación
  estructural de 219 tablas con dos tenants sintéticos.
- No se modificó código de aplicación; su baseline canónico posterior a
  SDD-0357 sigue separado de esta validación SQL. No hay evidencia Cloud nueva.

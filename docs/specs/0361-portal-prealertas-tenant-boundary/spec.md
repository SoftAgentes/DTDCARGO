---
sdd: 0361
title: Aislar proveedores, prealertas y sus documentos por principal y tenant
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0057
  - SDD-0340
  - SDD-0342
  - SDD-0359
confidencialidad: interno
---

# SDD-0361 — Frontera Portal de compras y proveedores

## Evidencia y alcance

Las policies Portal de `suppliers_cn` y `prealertas` (0105) seleccionan sólo
por Shipping Mark. UPDATE comprueba tenant únicamente en la fila resultante,
no en la original. `prealerta_documents` (0118) lee por markbox sin comprobar
tenant o propietario actual del padre. El identificador es único por tenant,
no global. Ninguna migración posterior reemplaza estas policies; 0229 agrega
escritura legítima de proveedores para el equipo.

`listSuppliers`, `listPrealertas` y `getPrealertaByCode` filtran por markbox y
confían en RLS. `listSignedPrealertaDocuments` firma sólo paths devueltos por esa
lectura. Este slice corrige esa frontera; no modifica UI ni captura datos.
La reproducción local no demuestra explotación ni acceso a datos de Producción.

## Decisión

1. Modificar sólo siete policies Portal: SELECT/INSERT/UPDATE de proveedores
   y prealertas, SELECT de documentos. No reescribir migraciones históricas.
2. Exigir vínculo activo de `auth.uid()`, cliente vivo, tenant coherente entre
   vínculo/cliente/fila y markbox propio; UPDATE valida origen y resultado.
3. Documentos exige además padre vivo con tenant/markbox coherentes. Una
   etiqueta denormalizada atrasada no autoriza lectura ni firma.
4. Conservar policies de equipo, ACL, secuencias, triggers, datos y Storage.
   No agregar SECURITY DEFINER ni privilegios.
5. Preflight falla ante tablas sin RLS o inventario inesperado de policies;
   postflight valida la frontera final. Probar RED antes de implementar.

## Allowlist exacta

- `supabase/migrations/0417_portal_prealertas_tenant_boundary.sql`
- `supabase/tests/0417_portal_prealertas_tenant_boundary.test.sql`
- `docs/specs/0361-portal-prealertas-tenant-boundary/spec.md`
- `docs/specs/README.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `.agents/handoffs/2026-09-02-portal-prealertas-tenant-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

## Gate constitucional

| Principio | Resultado y evidencia requerida |
|---|---|
| SGE-00.01 | cumplimiento: mismas operaciones propias, sin nuevos verbos |
| SGE-00.02 | cumplimiento: no purga ni mueve datos; conserva acceso legítimo |
| SGE-00.03 | cumplimiento: autorización R3, negativos y gate Cloud individual |
| SGE-00.04 | no aplica a acciones nuevas: sin nuevos escritores; DDL exige recibo de release |
| SGE-00.05 | cumplimiento: contrato SQL de tenant, propietario, vínculo y relaciones |
| SGE-00.06 | cumplimiento: preflight rechaza drift antes de modificar policies |
| SGE-00.07 | cumplimiento: evidencia local separada de aplicación alojada |
| SGE-00.08 | no aplica: no cambia pasos del Portal |
| SGE-00.09 | cumplimiento: patrón de principal de SDD-0359 sin helper elevado nuevo |
| SGE-00.10 | no aplica: sin cambios visuales o interactivos |
| SGE-00.11 | cumplimiento: errores identifican precondición o tabla |
| SGE-00.12 | cumplimiento: no aplica Cloud ni despliega sin autorización específica |

MP-01 conserva evidencia y retención; BTN-01 no aplica a botones nuevos.
AUD-01/AUD-02 no cambian: no se introduce log, exportación o purga.
La prueba usa identidades y documentos sintéticos con rollback; no lee PII.

## Aceptación

- RED por fallo real, no por archivo de migración ausente.
- Portal A/B no lee ni toma filas ajenas con el mismo Shipping Mark.
- Principales revocados/invitados/retirados/incoherentes o ausentes no acceden.
- INSERT/UPDATE propios conservados; cambios a tenant/markbox ajeno rechazados.
- Documento ajeno, padre retirado o relación incoherente no es visible.
- Portal puro sin DELETE físico ni escritura documental.
- Equipo y principal dual conservan su unión legítima sin ampliar a terceros.
- Policies de equipo, ACL y servicio idénticos; SQL, rebuild, consumidores,
  docs, numeración y gobernanza aprobados.

## Release y límites

0417 requiere 0080/0105/0118/0229, no RPC ni versión nueva de aplicación.
Cloud exige autorización por nombre y smoke de compras/proveedores/documentos.
No autoriza filas reales, Storage, secretos, despliegue o integración a main.
Quedan fuera RBAC del equipo, relación proveedor/cliente en triggers, secuencias,
transiciones operativas y otras entidades Portal: requieren su reproducción.

Fuente: [RLS oficial de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security),
especialmente USING/WITH CHECK de UPDATE. `pnpm sdd:next`: 15 refs, 0361/0417.

## Evidencia local

- RED ejecutado antes de crear 0417: tres lecturas ajenas y dos cambios de tenant
  reproducidos con las migraciones históricas reales; la aserción de aislamiento
  falla mostrando A/B. Ningún dato real fue consultado o modificado.
- GREEN: 158 contratos SQL con rollback total. Incluye INSERT con RETURNING,
  UPDATE propio, rechazo de cambios de propietario/tenant, principales inválidos,
  documentos incoherentes, principal dual y operación interna conservada.
- Tres escenarios de drift rechazados ejecutando el archivo real: policy
  adicional, policy esperada ausente y tabla con RLS deshabilitada.
- Rebuild: 414 migraciones, 396 desde cero y 18 sólo-ledger; comprobación
  estructural de 219 tablas con dos tenants sintéticos.
- Consumidores: 13 archivos / 156 unitarios aprobados. Documentación, numeración,
  gobernanza y componentes aprobados; ninguna dependencia o interfaz modificada.
- Baseline de aplicación sin cambios: CI completo en `a4f1ba5f`, run
  `33664422658`, aprobado antes de este slice. El nuevo commit requiere su CI.
- Cierre técnico local; aplicación Cloud, integración y release pendientes.

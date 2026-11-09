# Handoff — SDD-0622 · Rol base + accesos adicionales por persona

- **Owner / sesión:** `sdd-permisos-persona` (Worker, lanzado desde la sesión del Director)
- **Worktree:** `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\sdd-permisos-por-persona`
- **Rama:** `codex/sdd-permisos-por-persona` (base `origin/main` ad50537f1)
- **Reserva:** `codex/sdd-reserve-0622-permisos-por-persona` (commit 9f2f9aa52, incorporada por cherry-pick; reserva local, sin publicar)
- **Fecha:** 2026-11-09

## Objetivo original
Reservar número SDD y redactar **solo la spec** de «rol base + accesos adicionales por persona» en ERP Studio
(caso Alejandro: contabilidad + CRM). Sin código de producto ni migraciones.

## Completado
- SDD **0622** reservado (siguiente libre según `sdd:next`: spec 0622, migración 0525).
- `docs/specs/0622-permisos-por-persona/spec.md` en `status: draft`: contexto, reemplazo explícito del punto D
  de SDD-0139, comparación con QuickBooks/Odoo/Zoho (de memoria, marcada como no verificada), diseño
  (`studio_user_module_grants`, RPC solo admin, candado LOCKED, solo suma, auditoría, `user_has_module`),
  pantalla, fases, 12 pruebas de aceptación, riesgos y decisiones pendientes.
- Fase 1 adelantada como lectura de `supabase/migrations`, anexada en §5.3 con archivo:línea.
- Índice `docs/specs/README.md` regenerado.

## Validación
- `docs:check`: PASÓ (603 specs).
- `sdd:check` (check-numbering): PASÓ — «sin números repetidos»; los avisos son choques históricos ya aplicados.
- `git diff --check`: PASÓ.
- `pnpm verify`, build y pruebas de producto: NO APLICAN (cambio solo de documentación).
- Verificación en línea de cómo lo hacen QuickBooks/Odoo/Zoho: NO EJECUTADA (§4 de la spec lo declara).

## Hallazgos clave de la auditoría (resumen)
- `crm_puede_usar()` exige `admin`/`commercial` (`0506_crm_modelo.sql:186-194`): sin cambio en la base, el CRM
  seguiría cerrado para Alejandro aunque la UI lo mostrara.
- `document_entity_authorized` (`0444_unlinked_document_entity_rbac.sql:73-150`) ya consulta
  `studio_role_module_overrides`: punto central para sumar los accesos por persona.
- `quotes`, `sales_orders`, `suppliers`: RLS solo por tenant; alcanza con la capa de aplicación.
- Nómina exige admin/accounting en SQL (`0160_nomina_employees.sql:71-85`): queda bloqueada.

## Pendientes de esta tarea
- Sam debe confirmar §9: 9.1 módulos bloqueados nunca por extras, 9.2 granularidad por módulo,
  9.3 vencimiento opcional (todas **pendiente de confirmar por Sam**), más las dos preguntas sin valor asumido.
- La Fase 1 de la spec es una cota gruesa (conteos por grep). Falta el inventario exacto «cubierta / requiere
  cambio / fuera» por módulo antes de la migración.
- Cuando Sam apruebe, pasar la spec a `approved` y fijar la allowlist exacta de archivos (gobernanza Studio).
- La reserva 0622 sigue sin publicar como rama de reserva; la PR lleva la spec.

## FUERA DE ALCANCE DETECTADO
- `rbac.ts` (cabecera) todavía dice que los overrides por usuario están descartados; se actualizará con la
  implementación, no en esta tarea.
- `lib/studio/rbac.ts`: la cabecera aún describe la matriz como no editable en DB, aunque 0252/0357 ya
  agregaron desvíos por rol. Es un comentario desactualizado, no un fallo.
- `sdd:next` tarda varios minutos en esta máquina (786 refs + ~30 worktrees); aviso de rendimiento, sin tocar.

## Impacto documental y conocimiento
- Spec nueva e índice de specs actualizado. Graphify, Archify y vista Obsidian: NO EJECUTADOS en esta tarea;
  el Director los revisa al cierre. `pnpm knowledge:status`: NO EJECUTADO.
- Sin secretos, PII ni datos de negocio; la auditoría de la base fue solo lectura de archivos de migración.

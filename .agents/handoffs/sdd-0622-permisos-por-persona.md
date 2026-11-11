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
- Nómina exige admin/accounting en SQL (`0160_nomina_employees.sql:71-85`): la base la sigue exigiendo por rol; si se concede por extra hay que cubrirla (por confirmar con Sam).

## Decisiones de Sam (recogidas en la spec §9)
- 2026-11-09: extras por módulo; vencimiento opcional; «elegir módulos» para Alejandro; opción «Personalizado» (§5.5).
- **2026-11-11 (cambia lo anterior):** los extras SÍ pueden abrir módulos sensibles (dinero y solo-administrador), concedidos por admin o superadmin, con **doble aviso** («Esta persona puede hacer estas modificaciones, ¿estás seguro?»). La RPC exige `p_confirm_sensitive` y registra la confirmación en `entity_audit_log`. No se toca el CHECK de la 0357. Las capabilities (`CAPABILITIES`) quedan fuera.

## Pendientes de esta tarea (de Sam)
- R1 escalada con `users`/`admin` (mitigación propuesta en §8).
- R2 módulos del superadministrador: quién los otorga y si el receptor pasa `is_platform_admin()`.
- R3 dinero por persona como fase propia (fase 8), con migración y OK de Sam; inventario con archivo:línea en §12.2.
- Nómina; si `documents` es transversal para `custom`; si `clients` con edición incluye la fusión de fichas; diseño de §5.5.
- La Fase 1 sigue siendo lectura de texto: repetir contra el catálogo de una base efímera.
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

## Enmienda 2026-11-11 (encargo del Director, tras la revisión de la PR #509)
- Spec enmendada para coincidir con lo implementado: allowlist exacta (57 archivos, calculada de
  `git diff --name-only origin/main...origin/claude/impl-permisos-por-persona-10d044`, cabeza a44b77066), migraciones
  definitivas 0529 (grants + user_has_module), 0530 (CRM + document_entity_authorized) y 0531 (RLS por módulo),
  nombres definitivos de las RPC (`studio_grant_user_module`) y §13 con el estado de la implementación.
- R1, R2 y R3 quedan registradas como decididas por el Director el 2026-11-11 con la autorización de Sam
  («hazlo como creas tú»), según lo informó la sesión coordinadora; no las confirmé con Sam directamente.
- Siguen a decisión de Sam (§13.3): revocar sin superadmin; extras al reactivar a la persona; RPC que concede módulos
  aún no cubiertos. Y de antes: nómina, `documents` para `custom`, fusión de fichas, diseño de §5.5.
- Validación: docs:check PASÓ, sdd:check PASÓ, git diff --check PASÓ. No se verificó el contenido de la PR #509 más
  allá de su handoff y de la lista de archivos del diff.

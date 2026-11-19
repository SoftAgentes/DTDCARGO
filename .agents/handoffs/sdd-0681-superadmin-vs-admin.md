# Handoff · SDD-0681 — Superadministrador frente a admin del tenant

- **Owner:** Worker (Claude). Es una sesión hija del DG (`local_25e2dded-…`), con claim `sdd-0681-worker`.
- **Ruta:** `DTD-worktrees/sdd-0681-superadmin-vs-admin`, rama `codex/sdd-0681-superadmin-vs-admin`, con base en `origin/main` `c04f18fca`.
- **SDD:** [0681](../../docs/specs/0681-superadmin-vs-admin-tenant/spec.md), con estado `proposed`. El número lo asignó el DG.
- **Permisos:** una PR de docs contra main. No fusiono. No hay migraciones, ni código, ni lectura de producción.

## Objetivo

Levantar qué puede hacer hoy el superadmin (`platform_admins`, `is_platform_admin`) y qué puede el admin del tenant, y proponer la frontera para vender el sistema a otros tenants.

## Hecho

- Spec con la tabla de capacidades (archivo:línea), 9 hallazgos, la propuesta de frontera, 7 preguntas para Sam y un plan de 6 fases.
- Hay un hallazgo de seguridad (H-S). Queda **fuera de Git**, en la nota H-S en la carpeta del DG.

## Validación

- Corrí `pnpm docs:check` y `pnpm sdd:check`; el resultado está en la PR.
- Producto: no aplica, porque el diff es solo de docs.

## Impacto documental

- Spec nueva y este handoff. No cambia ningún documento canónico.
- Las cabeceras de 0538, 0542, 0543 y 0545 siguen diciendo «NO APLICADA», pero están selladas en el lock. Es texto viejo y no lo toco.

## Pendientes de esta tarea

- Sam tiene que contestar las preguntas P1 a P7 (§4).
- El DG decide si abre la fase 1 (H-S).

## FUERA DE ALCANCE DETECTADO

- Las cabeceras «NO APLICADA» de las migraciones ya selladas (0538, 0542, 0543, 0545).
- `audit_d1_admin_tenant()` (`0289:151-152`) y `get_user_tenant_id()` (`0453:242-246`) eligen el tenant con reglas distintas.

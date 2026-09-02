# Cierre técnico · SDD-0337 visibilidad del Portal por principal autenticado

Fecha: 2026-09-02

Rol: worker

Estado: CERRADO LOCALMENTE · MIGRACIÓN NO APLICADA

## Identidad

- Repositorio: `https://github.com/hailuwaycom-sketch/DTDCARGO.git`
- Worktree: `C:\Users\Trabajo\Desktop\Developer\software\DTD-worktrees\codex-saneamiento-integral`
- Rama: `codex/saneamiento-integral`
- Base del slice: `cf92b76e815d571db7912f481524b81bb45211d6`
- Spec: `docs/specs/0337-visibilidad-portal-por-principal/spec.md`
- Migración preparada: `0402_portal_hidden_statuses_por_principal.sql`

## Resultado

- Se creó `get_portal_hidden_shipment_statuses()` sin parámetros.
- Cliente y tenant se derivan de `auth.uid()` y de una vinculación activa; un
  cliente eliminado o vínculo revocado no obtiene filas.
- La precedencia override-cliente sobre default-tenant vive en SQL y la RPC sólo
  devuelve nombres de status ocultos.
- Dashboard, lista y detalle de envíos consumen la misma RPC con la sesión del
  Portal. Se eliminó la implementación TypeScript duplicada.
- El inventario bajó de 10 rutas / 21 construcciones a 10 rutas / 19.

## Evidencia ejecutada

- Vitest focal: 2 archivos / 5 pruebas, verde.
- Vitest completo: 512 archivos / 5.900 pruebas, verde.
- Contratos SQL: 143, verde y con rollback total.
- Reconstrucción: 399 migraciones; 381 aplicadas desde cero + 18 sólo-ledger;
  aislamiento de 219 tablas y 2 tenants, verde.
- TypeScript, ESLint focal, `docs:check`, `governance:check`,
  `components:check` y `git diff --check`: verdes.

## Gates externos preservados

- No se aplicó la migración 0402 a Cloud o Producción.
- No se hizo push, integración a `main` ni deploy.
- El detalle de envíos mantiene otras elevaciones para firmado, historial,
  naviera y aceptación; cada dominio necesita su propio slice.

## Cierre seguro

La migración debe aplicarse individualmente y sólo tras una autorización que
nombre `0402_portal_hidden_statuses_por_principal.sql`, siguiendo
`docs/runbooks/aplicar-migraciones-prod.md`. El worktree no se retira hasta que
el commit esté publicado e integrado/contenido en `origin/main`.

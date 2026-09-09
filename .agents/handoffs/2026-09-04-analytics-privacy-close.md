# Handoff · SDD-0371 · frontera de privacidad de Analytics

**Estado:** `CERRADO EN RAMA`

**Fecha:** 2026-09-04

**Rol:** worker aislado

**Rama:** `codex/analytics-privacy`

**Worktree:** `C:\Users\Trabajo\Desktop\Developer\software\DTD-worktrees\codex-analytics-privacy`

## Alcance entregado

- Analytics queda excluido de rutas de acceso, autenticación y superficies privadas.
- Las URLs con credenciales, códigos o asignaciones sensibles apagan GA4 y Google Ads antes de cargar o navegar.
- El detector cubre asignaciones anidadas, doble codificación, camel case, mayúsculas y notación con corchetes.
- Las campañas UTM legítimas, identificadores de clic, anclas ordinarias y porcentajes válidos siguen permitidos.
- Hay pruebas sintéticas de carga inicial y navegación cliente.

## Rutas propias

- `components/Analytics.tsx`
- `components/Analytics.test.tsx`
- `__tests__/analytics.test.ts`
- `docs/specs/0371-analytics-access-boundary/spec.md`
- `docs/specs/README.md`
- `docs/marketing/README.md`
- `docs/legal/privacidad/inventario-terceros.md`
- `.agents/handoffs/2026-09-04-analytics-privacy-close.md`

## Commits y publicación

- `5ab24f167c8587a54f1ca7ac3fc6375c9d13c631` — implementación SDD-0371.
- `01abd35934f2bdc5546302fa92faaf2e7435b218` — cierre de bypasses adversariales.
- Rama publicada en `origin/codex/analytics-privacy` sin force-push.
- PR abierto contra `main`: https://github.com/hailuwaycom-sketch/DTDCARGO/pull/24

## Verificación

- Focalizada: 110/110 pruebas de Analytics.
- Vitest: 5.936/5.936.
- Playwright: 150 aprobadas; 18 Tier 3 omitidas por requerir datos efímeros sembrados.
- SQL: 139 contratos aprobados.
- Reconstrucción: 395 migraciones verificadas.
- Build: 158 páginas prerenderizadas.
- `node scripts/verify.mjs`: exit 0; 14 pasos localmente medibles sin fallos.
- `migrations-applied`: no medido por requerir credenciales Cloud, fuera del alcance autorizado.
- Auditoría de cierre: índice y worktree limpios; upstream 0/0 antes de este handoff.

## Migraciones, Cloud y deploy

- No se crearon ni aplicaron migraciones.
- No hubo cambios Cloud ni deploy manual.
- La integración automática del PR ejecutó un preview de Vercel; GitHub lo reportó exitoso.

## Estado de integración y siguiente responsable

- El PR está abierto, es mergeable y todavía no está contenido en `origin/main`.
- `Vercel Agent Review` seguía en progreso al preparar este handoff.
- Siguiente responsable: tarea integradora `01a06e5e-5b71-7ed2-8f9d-13cc4006d0ec` — “Revisar ramas del pull request”.
- Este worker no fusiona `main` ni elimina su propio worktree. La limpieza física queda para el integrador después de la integración publicada y verificada.

## Tiempo y tokens

- n/a

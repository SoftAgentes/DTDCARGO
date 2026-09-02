# Cierre técnico · saneamiento integral para transición Cloud → Codex

Fecha: 2026-09-02

Rol: worker
Estado: LISTO PARA PUBLICAR · BLOQUEADO ÚNICAMENTE EN EL GATE EXPLÍCITO DE PUSH

## Identidad Git

- Repositorio: `https://github.com/hailuwaycom-sketch/DTDCARGO.git`
- Worktree: `C:\Users\Trabajo\Desktop\Developer\software\DTD-worktrees\codex-saneamiento-integral`
- Rama: `codex/saneamiento-integral`
- Base auditada: `origin/main@2a2e81bf554dbe7bd4f05170847e8f02e988d320`
- Divergencia antes del último commit: 0 detrás / 14 delante.
- Este lote no integra `main`; el worker publica únicamente su rama cuando el
  founder autorice el push exacto.

## Trabajo rescatado y cerrado

1. `5dde643f` — `fix(db): revocar TRUNCATE a roles públicos`.
2. `152055a2` — `docs: actualizar recepción para Codex`.
3. `89cc962f` — `feat(studio): SDD-0315 — neutralizar fórmulas CSV`.
4. `a8fff64c` — `fix(studio): SDD-0316 — minimizar logs inbound`.
5. `7cc03fef` — `fix(admin): SDD-0317 — retirar secreto CBM de URL`.
6. `c8e07855` — `perf(portal): SDD-0318 — consultar documentos en lote`.
7. `35270881` — `fix(crm): SDD-0319 — compartir reloj fuera del render`.
8. `1c07d1f2` — `docs: actualizar arranque de Codex`.
9. `2511f280` — `fix(deps): actualizar Vite y cerrar advisories nuevos`.
10. `8725a341` — `test(e2e): SDD-0320 — ejecutar Tier 1 sin secretos`.
11. `b14f1d25` — `test(e2e): SDD-0321 — acotar concurrencia y teardown`.
12. `d5c72bfd` — `chore(test): cargar Vitest como ESM explícito`.
13. `1faff60b` — `perf(studio): SDD-0322 — consultar relaciones de órdenes en lote`.
14. `09273cc8` — `fix(a11y): SDD-0323 — cerrar barreras Web Quality`.
15. `fix(a11y): SDD-0324 — unificar tabs del Studio` — el hash es el commit
    que contiene este handoff.

El allowlist exacto del último lote está en
`docs/specs/0324-tabs-studio-con-teclado/spec.md`. Implementa una primitiva
canónica con roving tab stop, flechas, Home/End y tabs deshabilitadas; migra 29
tablists interactivos y devuelve semántica de navegación a dos selectores SSR.

## Verificación vigente

`node scripts/verify.mjs` terminó con código 0:

- 14 de 15 gates medidos, ninguno falló.
- ESLint, frontera RSC, TypeScript y cuatro Edge Functions: OK.
- Vitest: 508 archivos / 5.923 pruebas pasaron.
- Documentación, numeración, componentes y gobernanza: OK.
- SQL: 140 contratos pasaron con rollback total.
- Rebuild: 396 migraciones; 378 aplicadas desde cero y 18 sólo-ledger;
  aislamiento multi-tenant verificado en 219 tablas y 2 tenants.
- E2E: 150 pasaron, 18 se omitieron por requerir entorno alojado y cero
  fallaron. WebKit tardó 300 s en cerrar un worker en Windows; el verificador lo
  clasificó como aviso conocido y no como regresión.
- Build de producción: OK, 158 páginas estáticas generadas.
- `migrations-applied`: NO MEDIDO porque este worktree no tiene credenciales.

Además, SDD-0324 pasó sus contratos focales (13 pruebas), el lint completo de
`app/studio`, TypeScript, `docs:check` y `git diff --check`.

## Gates alojados no cruzados

- La migración `0399_revoke_truncate_anon_authenticated.sql` existe en Git y
  pasó contratos/rebuild locales; NO fue aplicada a Cloud o Producción.
- No se hizo deploy ni se modificaron datos, secretos o configuración alojada.
- No se hizo push. La autorización literal pendiente es:
  `Autorizo git push -u origin codex/saneamiento-integral al remoto https://github.com/hailuwaycom-sketch/DTDCARGO.git`

## Worktrees, ramas y tareas preservadas

- Quedan dos worktrees de DTDCargo: el checkout principal y este worktree.
- El checkout principal estaba limpio, pero atrasado respecto a `origin/main`;
  no se movió ni se sobrescribió.
- Las ramas `codex/archive-cloud-handoff-20260828` y
  `codex/archive-primary-pnpm-20260902` preservan historia única y no deben
  borrarse hasta que su contenido sea contenido y verificado.
- Este worktree NO se puede retirar todavía: su rama aún no está publicada ni
  integrada/contenida en `origin/main`.
- No se detectaron otras tareas Codex activas de DTDCargo que deban archivarse.

## Próximo cierre seguro

1. Recibir la autorización literal de push indicada arriba.
2. Refrescar `origin/main`, confirmar divergencia y publicar únicamente
   `codex/saneamiento-integral`.
3. Validar la rama remota y decidir/integrar el lote en `main` con un gate
   separado.
4. Aplicar la migración 0399 sólo con autorización Cloud específica y su
   runbook.
5. Retirar este worktree únicamente después de probar que sus commits están
   contenidos; mantener las ramas archive hasta auditar su contención.

# Handoff: SDD-0656, oleada A1 (actualización de seguridad)

- **Owner:** Claude Worker (`sdd-0656-a1`), encargado por el DG con autorización de Sam («ahora», 2026-11-17, en el chat del DG).
- **Rama:** `claude/0656-a1-next-sharp`, con base en `origin/main` `fe2a09364`.
- **Worktree:** `.claude/worktrees/0656-a1-next-sharp`.
- **Alcance exacto:**
  - `next` y `eslint-config-next` pasan a 16.4.6.
  - El override de `sharp` en `pnpm-workspace.yaml` pasa a 0.35.5 (D10: se sube, no se quita).
  - Node pasa a 24.22.3 en `Dockerfile`, `quality.yml`, `sql-tests.yml` y `chatwoot-portal-poc.yml`.
  - `vitest` y `@vitest/ui` pasan a 4.1.12.
  - Se regenera el lockfile.
- **Digest de Node:** `node:24.22.3-bookworm-slim@sha256:dc26ae92…` es el índice multiarquitectura. Lo confirmaron `docker buildx imagetools inspect` y la API de Docker Hub (`last_updated` 2026-11-11).
- **Arreglo dentro del alcance:** `scripts/__tests__/ci-workflow-contract.test.mjs:37` fija el runtime de `quality.yml`, así que pasa de `24\.22\.1` a `24\.22\.3`. Es el mismo pin de Node; la prueba no se debilitó.
- **Lockfile:** además de los paquetes objetivo, solo cambian sus transitivas: `@next/*`, `@img/*` (libvips de 1.3.2 a 1.3.4), `@vitest/*`, `@swc/helpers`, `caniuse-lite`, `baseline-browser-mapping` y `tinyglobby`.

## Validación (Windows, Node 24.22.1 local, pnpm 11.19.0)

| Comprobación | Resultado |
|---|---|
| `pnpm install --frozen-lockfile` | PASÓ |
| `pnpm typecheck` | PASÓ |
| `pnpm lint` | PASÓ: 0 errores, 32 advertencias. No se comparó contra main |
| `pnpm test` | 1 falla: la prueba de contrato del pin de Node. Se corrigió y su archivo volvió a correr: 85/85 PASÓ. El resto, 19.166 pruebas, PASÓ. No se repitió la suite completa |
| `pnpm build` | PASÓ |
| e2e | NO EJECUTADO, por orden del DG |
| Imagen Docker y prueba de `sharp` | NO EJECUTADO en local; lo cubre `build-image.yml` |

## Pendientes

- CI de GitHub.
- Revisión, merge y publicación a mano con prueba rápida, a cargo del DG (D11).
- Prueba manual después de publicar, según la spec 0656 §4 A1.

## Fuera de alcance detectado

- Siguen con Node 24.22.1:
  - `infra/chatwoot/compose.yml:265`
  - `infra/chatwoot/pruebas/portal/compose.portal-poc.yml:23`
  - `infra/chatwoot/pruebas/ensayo-local.sh:297`
  - `infra/ops/cable-oficina/puente-prueba.sh:31`
  - `infra/templates/proyecto/Dockerfile.next:19`
- Las imágenes Alpine son de otros servicios y van en otra PR.

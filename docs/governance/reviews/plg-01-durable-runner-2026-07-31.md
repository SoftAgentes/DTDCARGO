# REV-SGE-025 — PLG-01 runner y reinstalación durable

**Fecha:** 2026-07-31

**SDD:** [SDD-0218](../../specs/0218-governance-plugin-reproducible/spec.md)

**Resultado:** cache 0.1.2 reproducible y siete forward-tests directos

## Antes

- la fuente repo/team era correcta y el validador instalado resolvía el
  worktree activo;
- los siete tests dependían de Vitest del worktree;
- no existía una orden versionada que regenerara, reinstalara y validara la
  cache;
- después de cambiar políticas/componentes, el validador instalado reportó
  `policy-registry.json está desactualizado`.

## Contrato cerrado

`pnpm governance:plugin:sync`:

1. resuelve el root mediante `git rev-parse --show-toplevel`;
2. lee versión/nombre del manifest canónico;
3. regenera `policy-registry.json` desde cápsula y componentes del repo;
4. copia únicamente el paquete fuente al cache exacto dtdcargo/plugin/versión;
5. compara SHA-256 de cada archivo fuente, ignorando `node_modules` derivado;
6. ejecuta el validador desde el cache con cwd del worktree;
7. ejecuta siete forward-tests con Node incorporado.

`pnpm governance:plugin:check` repite comparación, validador y tests sin
escribir. `pnpm governance:plugin:test` ejecuta el runner directo desde fuente.

## Siete casos

| # | Caso | Resultado |
|---:|---|---|
| 1 | worktree activo aunque el script viva en cache | pasa |
| 2 | read-only + 27 políticas aprobadas | pasa |
| 3 | cuatro componentes + NumericInput canonical | pasa |
| 4 | deprecated→replacement y cero integración externa | pasa |
| 5 | rechazo de escritura | pasa |
| 6 | rechazo de política no aprobada | pasa |
| 7 | rechazo de integración externa | pasa |

La cache sigue siendo derivada. DTDCargo conserva la única fuente normativa en
`docs/governance/`; no se añadieron MCP, app, hooks, credenciales, marketplace
remoto ni capacidad de escritura.

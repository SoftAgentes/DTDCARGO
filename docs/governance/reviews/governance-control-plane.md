# Control plane ejecutable de gobernanza

| Control | Valor |
|---|---|
| Revisión | REV-SGE-018 |
| Fecha | 2026-07-29 |
| SDD | [SDD-0183](../../specs/0183-governance-control-plane/spec.md) |
| Resultado | aprobado técnicamente |
| Aprobación | 2026-07-29 · Sam (founder) |

## Diagnóstico cerrado

El repositorio ya tenía 27 políticas aprobadas. La brecha no era redactar más
reglas, sino conectarlas con los puntos donde trabajan los agentes y con el
gate que decide si un cambio puede cerrar.

Se implementa un control plane repo-first:

```text
políticas → registro maestro → cápsula generada
→ AGENTS / Studio / Norte → SDD + allowlist → pnpm verify
```

## Evidencia

- `AGENTS.md`, Studio y Norte apuntan a `AGENT-BRIEF.md`;
- la cápsula indexa una vez las 27 políticas aprobadas;
- políticas no aprobadas no pueden entrar al enforcement;
- CMP-01 v1.1 y el agregado de componentes tienen gate propio;
- `pnpm verify` ejecuta `components:check` y `governance:check`;
- Cloud Design conserva autoridad visual y las políticas conservan autoridad
  de comportamiento;
- un cambio se clasifica como cumplimiento, no aplica, excepción o no
  conformidad.

## Gate local ejecutado

- lint: 0 errores; 174 advertencias preexistentes;
- typecheck: verde;
- Vitest: 309 archivos y 4.115 pruebas verdes;
- SQL: 19 contratos verdes con rollback total;
- schema rebuild: 276 migraciones, 219 tablas y aislamiento de 2 tenants;
- E2E: 19 verdes y 3 omitidos por requerir seed autenticado;
- build: 152 rutas generadas;
- docs, CMP-01, cápsula y `diff --check`: verdes.

`migrations-applied` quedó sin evidencia en este worktree por ausencia de
credenciales. El gate no copió `.env`, no leyó filas y no sustituyó esa
verificación por una afirmación.

## Allowlist ejecutada

- entrypoints: `AGENTS.md`, `app/studio/CLAUDE.md` y Norte;
- `docs/governance/AGENT-BRIEF.md`;
- cápsula, generador, pruebas y gate canónico;
- CMP-01 v1.1, tres fuentes de componente y su evidencia;
- SDD-0183, esta revisión, línea base e índices generados;
- scaffold PLG-P3 documentado por REV-SGE-019.

## Límite

Este gate no declara conformidad global del producto. D1–D5 y la adopción
legacy continúan como roadmap por slices; no bloquean que la gobernanza ya
opere como control plane.

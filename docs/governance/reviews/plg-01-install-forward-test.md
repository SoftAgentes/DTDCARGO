# PLG-01 · instalación y forward-test

| Control | Valor |
|---|---|
| Revisión | REV-SGE-021 |
| Fecha | 2026-07-30 |
| SDD | [SDD-0178](../../specs/0178-plugin-gobernanza-erp-studio/spec.md) |
| Resultado | P6–P8 cerrados |

## P6 · marketplace e instalación

- destino: repo/team;
- marketplace: `.agents/plugins/marketplace.json`;
- fuente local: `./.agents/plugins/plugins/erp-studio-governance`;
- plugin final: `erp-studio-governance@dtdcargo` 0.1.2;
- estado CLI: instalado y habilitado;
- validadores oficiales de plugin y skills: verdes;
- registro: 27 políticas y 4 componentes, read-only.

La versión 0.1.1 corrigió la resolución del repo instalada: usa
`git rev-parse --show-toplevel` desde el worktree y no calcula rutas relativas
al cache. La 0.1.2 refresca el registro después del cierre documental.

## P7 · uso real

Tres ejecuciones Codex efímeras invocaron `$governance-check`:

1. detectó correctamente el estado antiguo de VIS-02;
2. detectó correctamente que sus gates futuros repetían trabajo cerrado;
3. después de REV-VIS-007/008, clasificó §7–§8 como cumplimiento.

El validador instalado pasó desde el worktree. El sandbox read-only de Windows
no pudo iniciar su helper y Codex usó su canal local read-only alterno; no hubo
escrituras ni efectos externos.

## P8 · decisión

| Capacidad | Decisión | Motivo |
|---|---|---|
| `governance-author` | no promover | rompe el alcance inicial read-only |
| MCP/app | no aplica | no existe capacidad remota necesaria |
| hooks/CI | no promover | falta evidencia de bloqueo seguro |
| marketplace remoto | no promover | el plugin es específico del repo/team |
| marketplace local | conservar | habilita instalación reproducible |

El plugin es un adaptador de la gobernanza del repo, no otra gobernanza.

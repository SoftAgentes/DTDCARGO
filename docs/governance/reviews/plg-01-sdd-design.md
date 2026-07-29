# Revisión técnica de SDD-0178 — PLG-01

| Control | Valor |
|---|---|
| Revisión | REV-SGE-011 |
| Política | [PLG-01 v1.0](../policies/plg-01.md) |
| Dependencia | [REV-SGE-010 · registro CMP](cmp-01-registry-design.md) |
| SDD | [SDD-0178](../../specs/0178-plugin-gobernanza-erp-studio/spec.md) |
| Fecha | 2026-07-29 |
| Resultado | diseño aprobado técnicamente |

## Veredicto

SDD-0178 mantiene el repositorio como fuente normativa, separa política de
evidencia de implementación y limita la primera versión a dos skills
read-only. El manifest futuro declara únicamente skills reales.

Se aprueban:

- manifest mínimo sin campos ficticios;
- `governance-check` y `governance-audit` con progressive disclosure;
- registro de políticas generado y trazado a commit/versiones;
- severidad derivada solo de gates aprobados;
- allowlist de nueve archivos;
- gates separados para CMP estable, destino, scaffold, validación,
  forward-test e instalación.

## Límites

No se creó directorio de plugin, manifest, skill, script o registry. No se
instaló nada y no se creó MCP, app, hook, marketplace, CI o credencial.
`governance-author` permanece fuera de la primera versión.

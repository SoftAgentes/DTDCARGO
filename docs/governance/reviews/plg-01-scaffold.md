# Scaffold read-only de PLG-01

| Control | Valor |
|---|---|
| Revisión | REV-SGE-019 |
| Fecha | 2026-07-29 |
| SDD | [SDD-0178](../../specs/0178-plugin-gobernanza-erp-studio/spec.md) |
| Resultado | P3–P5 verdes; P6 cerrado |
| Aprobación | 2026-07-29 · Sam (founder) |

## Prerrequisitos

- P1: CMP-01 v1.1, canonical y deprecated demostrados por REV-SGE-017.
- P2: destino repo/team aprobado por REV-SGE-013.
- P3: autorización del lote completo confirmada por el founder.

## Scaffold exacto

```text
.agents/plugins/plugins/erp-studio-governance/
├── .codex-plugin/plugin.json
├── skills/governance-check/SKILL.md
├── skills/governance-check/agents/openai.yaml
├── skills/governance-audit/SKILL.md
├── skills/governance-audit/agents/openai.yaml
├── references/policy-registry.json
├── scripts/build-policy-registry.mjs
├── scripts/validate-governance.mjs
└── scripts/__tests__/policy-registry.test.mjs
```

Las dos skills son read-only. El registro deriva de las cápsulas versionadas y
el script sólo escribe su propio agregado cuando se ejecuta el build explícito.

## Verificación

- plugin validator oficial: verde;
- quick validator oficial: 2/2 skills;
- registry validator del scaffold inicial: 27 políticas y tres componentes;
  REV-SGE-020/021 amplió después el agregado vigente a cuatro, incluido
  `NumericInput`;
- Vitest: 3 casos positivos y 3 negativos;
- negativos: escritura, política no aprobada e integración externa;
- cero `[TODO]`, secreto, PII, MCP, app, hook o capacidad de escritura.

## Estado de gates

| Gate | Estado |
|---|---|
| P0–P2 | aprobados |
| P3 | scaffold creado |
| P4 | manifest, skills y registro validados |
| P5 | 3 positivos + 3 negativos verdes |
| P6 | cerrado: no instalado |
| P7–P8 | cerrados |

No existe `.agents/plugins/marketplace.json`, instalación, marketplace remoto,
MCP, app ni publicación del plugin.

# PLG-01 v1.0 — Plugin ejecutable de gobernanza

| Control | Valor |
|---|---|
| Estado | aprobada — destino repo/team decidido; no creado ni instalado |
| Aprobación | 2026-07-29 · Sam (founder) · REV-SGE-007 |
| Nombre técnico propuesto | `erp-studio-governance` |
| Fuente normativa | `docs/governance/` dentro del repositorio |
| Depende de | SGE-00, CMP-01 y políticas aprobadas |

## 1. Principio arquitectónico

El plugin interpreta, verifica y ayuda a corregir. No se convierte en una
fuente paralela ni puede elevar un borrador a obligación. El repositorio
conserva versiones, aprobaciones, excepciones y evidencia.

## 2. Estructura futura

```text
erp-studio-governance/
├── .codex-plugin/plugin.json
├── skills/
│   ├── governance-check/
│   │   ├── SKILL.md
│   │   └── agents/openai.yaml
│   ├── governance-author/
│   │   ├── SKILL.md
│   │   └── agents/openai.yaml
│   └── governance-audit/
│       ├── SKILL.md
│       └── agents/openai.yaml
├── references/
│   └── policy-registry.json
├── scripts/
│   ├── build-policy-registry.*
│   └── validate-governance.*
├── assets/
│   └── templates/
└── README.md
```

No necesita MCP ni app en la primera versión. Esos campos no entran al manifest
sin archivos/capacidad reales.

## 3. Capacidades

- **check:** detecta superficie/módulo, carga políticas aprobadas y produce
  cumple/no aplica/excepción/no cumple con enlaces.
- **author:** crea política/SDD desde templates y actualiza el índice.
- **audit:** contrasta código y componentes con contratos, sin modificar por default.
- **recipes:** propone corrección reutilizando componentes canónicos.
- **registry:** exporta estados/dependencias en JSON generado desde documentos.

Cada `SKILL.md` mantiene únicamente el procedimiento esencial y sus
activadores en la descripción; el registro detallado se carga como referencia
solo cuando aplica. Los checks deterministas y frágiles usan scripts de baja
libertad, mientras la redacción conserva libertad guiada por templates. No se
duplica el contenido completo de las políticas dentro de la skill.

## 4. Severidad

- Borrador/investigada: recomendación, nunca bloqueo.
- Aprobada: warning o error según el gate definido.
- Implementada/verificada: puede incluir validación automática y regresión.
- Excepción vigente: se reporta, no se marca como fallo; al vencer vuelve a fallo.

## 5. Fases

1. Estabilizar SGE-00, MP-01, BTN-01, AUD, VIS y CMP.
2. Crear scaffold válido con `.codex-plugin/plugin.json` y skills read-only.
3. Generar registry machine-readable y validar enlaces/estados.
4. Añadir recetas y checks locales no bloqueantes.
5. Promover reglas verificadas a CI de forma gradual.
6. Evaluar marketplace personal/equipo e instalación solo con autorización.
7. Validar frontmatter, nombres, metadata de agente y scripts con las
   herramientas oficiales; luego probar con solicitudes reales aisladas.

## 6. Gates antes de crear

- políticas base aprobadas y sin códigos/aliases conflictivos;
- schema de registro y excepciones estable;
- decisión sobre plugin personal versus repo/team;
- nombre técnico y owner confirmados;
- ninguna credencial o PII incluida;
- plan de versión/cachebuster/reinstalación;
- ejemplos concretos de activación y de casos que no deben activar cada skill;
- validación con las herramientas oficiales de `plugin-creator`.

La redacción siguió la estructura exigida por la guía local `plugin-creator`:
manifest obligatorio, carpetas opcionales solo cuando existen y marketplace
como decisión separada. También incorpora `skill-creator`: descripciones como
gatillo, progressive disclosure, scripts para validaciones repetibles y
validación/forward-test antes de confiar en el resultado. Esta política no
ejecutó scaffold ni escribió fuera del repo.

## 7. Destino aprobado

[REV-SGE-013](../reviews/plg-01-destination.md) decide **repo/team**:

```text
marketplace: .agents/plugins/marketplace.json
plugin:      .agents/plugins/plugins/erp-studio-governance/
```

El destino personal queda descartado para este plugin porque sus reglas,
versiones y evidencia son específicas de DTDCargo y deben viajar con el commit
que las gobierna. Esta decisión no crea esas rutas ni autoriza scaffold,
marketplace o instalación.

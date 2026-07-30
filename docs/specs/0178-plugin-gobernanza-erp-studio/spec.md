---
sdd: "0178"
title: "Plugin read-only de gobernanza ERP Studio"
status: in-progress
author: "Sam (founder) + Codex"
created: 2026-07-29
updated: 2026-07-29
supersedes: null
superseded_by: null
related: ["0165", "0174", "0175"]
confidencialidad: interno
---

# SDD-0178 — Plugin read-only de gobernanza ERP Studio

## 1. Decisión

Se aprueba el diseño técnico del futuro plugin
`erp-studio-governance`. El primer alcance interpreta políticas aprobadas y
audita en modo read-only. No crea una fuente normativa paralela y no puede
promover una regla, componente o hallazgo.

Este SDD **no autoriza crear, instalar ni publicar el plugin**. El destino
repo/team quedó decidido por REV-SGE-013, pero el scaffold, la creación del
marketplace, cada instalación y cualquier publicación conservan gates
separados.

## 2. Fuentes y precedencia

El plugin recibe una raíz de repositorio y usa:

1. `docs/governance/README.md` como índice;
2. `docs/governance/policies/` para normas y estado;
3. `docs/governance/reviews/` para aprobaciones/excepciones;
4. specs y evidencia enlazadas;
5. el futuro registro CMP-01 generado y validado.

El contenido generado del plugin incluye `sourceCommit`, versiones y rutas,
pero nunca sustituye esos archivos. Si el registro está desactualizado,
incompleto o no valida, el plugin falla cerrado y enlaza la fuente.

## 3. Alcance inicial

### Incluye

- manifest mínimo con nombre, versión, descripción, autor e interface;
- dos skills read-only: `governance-check` y `governance-audit`;
- metadata `agents/openai.yaml` sin dependencias externas;
- registro de políticas generado desde el repo;
- scripts deterministas para construir y validar el registro;
- clasificación `cumplimiento`, `no aplica`, `excepción` y
  `no conformidad`;
- salida con política, versión, evidencia, severidad y próximo gate.

### Excluye

- `governance-author` y cualquier escritura documental;
- recetas que editen código;
- hooks, CI, autocorrección o bloqueo automático;
- MCP, app, `.mcp.json`, `.app.json` o credenciales;
- marketplace personal/equipo y políticas de instalación;
- instalación local, cachebuster o reinstalación;
- Cloud, Supabase, Vercel o acceso a datos;
- assets, iconos o screenshots inexistentes.

## 4. Manifest mínimo futuro

El manifest vivirá en `.codex-plugin/plugin.json` y declarará únicamente
capacidades reales:

```json
{
  "name": "erp-studio-governance",
  "version": "0.1.0",
  "description": "Checks read-only de gobernanza para ERP Studio.",
  "author": {
    "name": "DTD Cargo"
  },
  "skills": "./skills/",
  "interface": {
    "displayName": "ERP Studio Governance",
    "shortDescription": "Auditoría read-only de políticas aprobadas",
    "longDescription": "Contrasta cambios y flujos contra la gobernanza versionada del repositorio sin modificar archivos.",
    "developerName": "DTD Cargo",
    "category": "Developer Tools",
    "capabilities": ["Read-only"],
    "defaultPrompt": [
      "Revisa este cambio contra las políticas aprobadas.",
      "Clasifica los hallazgos con evidencia y severidad."
    ]
  }
}
```

No incluye `apps`, `mcpServers`, `hooks`, logos, URLs, licencia o campos cuya
evidencia/decisión no exista. El folder y `name` coinciden en kebab-case.

## 5. Skills iniciales

### `governance-check`

Descripción/gatillo futuro: revisar una allowlist, diff, spec o flujo contra
políticas aprobadas del repo y devolver una matriz read-only con evidencia.

Procedimiento:

1. validar raíz, commit y registro;
2. detectar superficie, módulo y archivos del alcance;
3. cargar únicamente políticas aprobadas aplicables;
4. clasificar cada control;
5. enlazar evidencia y separar deuda legacy de cambio nuevo;
6. devolver hallazgos sin editar ni ejecutar efectos externos.

### `governance-audit`

Descripción/gatillo futuro: inventariar adopción o conformidad de un alcance
acotado, priorizar R2/R3 y proponer slices sin modificar el producto.

Procedimiento:

1. exigir alcance/allowlist;
2. medir indicadores sin convertir conteos en fallas;
3. muestrear evidencia por flujo y superficie;
4. clasificar cumplimiento/no aplica/excepción/no conformidad;
5. proponer SDD pequeños y ordenados;
6. terminar con límites y pendientes.

Ambas skills usan instrucciones concisas, referencias con progressive
disclosure y scripts solo para validaciones deterministas. Sus
`agents/openai.yaml` no declaran `dependencies.tools`.

## 6. Severidad y estados normativos

| Estado de fuente | Salida permitida |
|---|---|
| draft/investigada/redactada | recomendación informativa |
| aprobada | warning/error según gate escrito |
| implementada/verificada | check determinista y regresión permitidos |
| excepción vigente | reportar excepción, mitigación y vencimiento |
| excepción vencida | volver a no conformidad |
| fuente ambigua/desactualizada | `blocked-by-source`, nunca inventar regla |

Solo los bloqueadores declarados por la política pueden producir error. El
plugin no infiere severidad por palabras como “crítico”.

## 7. Registro generado

`references/policy-registry.json` contiene:

- `schemaVersion`, `generatedAt`, `sourceCommit`;
- código, versión, estado, owner y ruta de cada política;
- dependencias y revisiones de aprobación;
- gates bloqueantes explícitos;
- excepciones vigentes con responsable y vencimiento;
- puntero al registro CMP-01 cuando esté estable.

El generador:

- lee documentos del repo;
- rechaza códigos duplicados, enlaces rotos y estados desconocidos;
- separa normativa de evidencia de implementación;
- produce salida ordenada y reproducible;
- nunca escribe en `policies/`, `reviews/` o specs.

## 8. Validaciones

### Plugin

- folder y manifest usan `erp-studio-governance`;
- semver válido y manifest sin placeholders;
- paths relativos comienzan con `./`;
- solo existen campos respaldados por archivos/capacidades;
- `apps`, `mcpServers`, hooks y marketplace están ausentes;
- `validate_plugin.py` pasa cuando el scaffold sea autorizado.

### Skills

- nombre kebab-case y frontmatter con solo `name`/`description`;
- descripción contiene gatillos positivos y límites read-only;
- body bajo 500 líneas y sin duplicar políticas;
- `agents/openai.yaml` cita `$governance-check` o `$governance-audit` en
  `default_prompt`;
- no hay tool dependencies;
- `quick_validate.py` pasa;
- ejemplos de no activación impiden interceptar una revisión general sin
  alcance de gobernanza.

### Registro

- build reproducible desde el mismo commit;
- cero política no aprobada en severidad obligatoria;
- excepciones exigen alcance, mitigación, responsable y vencimiento;
- rutas y versiones existen;
- el registry CMP cumple REV-SGE-010 antes de ser consumido;
- cero secreto, PII o payload de negocio.

## 9. Casos de aceptación

### Debe activar

- “Revisa este diff contra BTN-01 y AVS-01.”
- “Audita adopción VIS-01 en estas tres rutas.”
- “Clasifica este flujo R3 con la matriz SGE.”

### No debe activar

- “Corrige este bug de facturación.”
- “Aplica una migración a Supabase.”
- “Diseña una landing pública.”
- “Instala el plugin.”

### Resultado esperado

- matriz con fuente/versiones;
- evidencia o ausencia explícita;
- deuda legacy separada del cambio;
- cero archivos modificados;
- cero tool calls externas no autorizadas;
- recomendaciones no presentadas como políticas.

## 10. Allowlist exacta del scaffold

El destino aprobado es repo/team. El gate P3 creó únicamente:

```text
<repo-root>/.agents/plugins/plugins/erp-studio-governance/
```

La ruta `.agents/plugins/marketplace.json` quedó deliberadamente fuera: P6–P8
continúan cerrados y el scaffold no está instalado ni publicado.

1. `.codex-plugin/plugin.json`
2. `skills/governance-check/SKILL.md`
3. `skills/governance-check/agents/openai.yaml`
4. `skills/governance-audit/SKILL.md`
5. `skills/governance-audit/agents/openai.yaml`
6. `references/policy-registry.json`
7. `scripts/build-policy-registry.mjs`
8. `scripts/validate-governance.mjs`
9. `scripts/__tests__/policy-registry.test.mjs`

No forman parte de la allowlist: README, assets, hooks, `governance-author`,
`.mcp.json`, `.app.json`, marketplace, credenciales o archivos del producto.

La allowlist documental de ese gate será SDD-0178, su revisión de scaffold,
`docs/governance/README.md`, el mapa módulo↔SDD y una nueva línea base.

## 11. Gates de promoción

| Gate | Requisito | Efecto permitido |
|---|---|---|
| P0 | SDD y REV-SGE-011 | diseño aprobado |
| P1 | CMP registry estable según REV-SGE-010 §8 | habilitar solicitud de scaffold |
| P2 | destino repo/team aprobado por REV-SGE-013 | fijar `<plugin-root>` |
| P3 | autorización explícita de scaffold | crear allowlist local, sin instalar |
| P4 | manifest/skills/registry validados | forward-test read-only |
| P5 | tres casos positivos y tres negativos verdes | solicitar instalación |
| P6 | autorización explícita de instalación | instalar en destino aprobado |
| P7 | uso real sin falsos bloqueos | evaluar `governance-author` separado |
| P8 | capacidad real y necesidad probada | evaluar MCP/app/marketplace separados |

Ningún gate agrupa scaffold, instalación, marketplace o CI.

## 12. Rollback

Antes de instalar, rollback es borrar/revertir solo el scaffold autorizado.
Después de instalar, se usa el flujo de cachebuster/reinstalación validado; no
se edita marketplace a mano. Un defecto deshabilita el uso del plugin, no
modifica las fuentes normativas.

## 13. Cierre

P0–P2 quedan aprobados. REV-SGE-017 demuestra P1 con schema v1.1,
`proposed → canonical` y un caso `deprecated` con reemplazo. REV-SGE-019 cierra
P3–P5: scaffold repo/team, validadores oficiales y tres casos positivos/tres
negativos.

P6–P8 permanecen cerrados. El plugin no está instalado y no existe
marketplace, MCP, app, hook o capacidad de escritura.

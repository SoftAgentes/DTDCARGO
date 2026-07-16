# Contrato de ticket Forge Kanban v2

## Campos obligatorios

| Campo | Valores |
|---|---|
| `schema_version` | `2` |
| `id` | identificador único |
| `title` | resultado verificable |
| `status` | `backlog`, `planning`, `dev`, `qa`, `review`, `done` |
| `priority` | `red`, `yellow`, `green`, `nice_to_have` |
| `priority_reason` | criterio concreto de impacto y urgencia |
| `complexity` | `low`, `medium`, `high`, `critical` |
| `model` | `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna` o fallback justificado |
| `model_reason` | razón concreta para seleccionar el modelo |
| `effort` | puntos numéricos |
| `build_method` | `yunque` o `forja` |
| `gate` | comando o evidencia que acepta la tarea |
| `commit_strategy` | `atomic_selective` |

Campos opcionales: `depends_on`, `pts`, `kind`, `epic`, `sprint`, `blocked`,
`created`, `updated`, `spec_ref`, `domain`, `artifact_type`, `risk_tags`,
`builder_skills`, `review_skills`, `required_context`, `owned_paths`,
`shared_paths`, `forbidden_paths`, `llm_mode`, `methodology` y `evidence`.

## Contrato de enrutamiento

Antes de mover un ticket de `planning` a `dev`, completar:

| Campo | Propósito |
|---|---|
| `spec_ref` | Spec/SDD/Blueprint que define el alcance. |
| `domain` | Dominio dominante usado por el router. |
| `artifact_type` | Resultado concreto que se construye. |
| `risk_tags` | Riesgos separados por coma. |
| `builder_skills` | Skills constructores separados por coma. |
| `review_skills` | Skills revisores separados por coma. |
| `required_context` | Fuentes que deben leerse antes de editar. |
| `owned_paths` | Rutas autorizadas para el worker. |
| `shared_paths` | Rutas reservadas a Yunque/integrador. |
| `forbidden_paths` | Rutas fuera de alcance. |
| `evidence` | Evidencia exigida por el gate. |

El shard conserva decisiones de ejecución y apunta a la spec; no duplica su
alcance. En el formato flat actual, los campos multivalor son listas separadas
por coma.

El cuerpo incluye criterios de aceptación, dependencias, riesgos, pruebas y
evidencia de cierre. `Atómico` describe la intención del commit y `selectivo`
describe el staging; no son alternativas.

## Prioridad

- Rojo: bloquea seguridad, datos, producción, dependencia crítica o entrega.
- Amarillo: obligatorio para el alcance, no bloquea el carril crítico actual.
- Verde: mejora útil, de bajo riesgo y no bloqueante.
- Nice to have: opcional y fuera de aceptación mínima.

## Compatibilidad legacy

Tickets sin `schema_version: 2` se leen sin inventar datos:

- `critica`/`alta` → rojo.
- `media` → amarillo.
- `baja` → verde.
- `model_criterion` se muestra como criterio de modelo.
- `atomico`/`selectivo` se etiquetan como legacy y se migran al editar el ticket.

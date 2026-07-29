# Revisión del registro ejecutable CMP-01

| Control | Valor |
|---|---|
| Revisión | REV-SGE-010 |
| Política | [CMP-01 v1.0](../policies/cmp-01.md) |
| Diseño | [Registro ejecutable](../research/cmp-01-executable-registry.md) |
| Schema | [JSON Schema v1](../templates/component-registry.schema.json) |
| Fecha | 2026-07-29 |
| Resultado | aprobado técnicamente |

## Veredicto

El diseño convierte el registro mínimo CMP-01 en un contrato validable sin
crear una fuente normativa paralela. Se aprueban:

- un registro fuente por componente y agregado generado;
- JSON Schema cerrado y versionado;
- referencias a políticas aprobadas sin copiar su contenido;
- validaciones de rutas, exports, tokens, tests, consumidores y evidencia;
- promociones exclusivamente mediante revisión humana;
- criterios explícitos para proposed, canonical, deprecated y retired;
- primer gate limitado a un componente existente.

El diseño no puebla el registro, no modifica componentes y no autoriza crear o
instalar PLG-01.

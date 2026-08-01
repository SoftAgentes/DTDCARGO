# Registro CMP-01 de ConfirmDialog

| Control | Valor |
|---|---|
| Revisión | REV-SGE-012 |
| Política | [CMP-01 v1.0](../policies/cmp-01.md) |
| Componente | `ConfirmDialog` |
| Fecha | 2026-07-29 |
| Resultado | transición `proposed → canonical` aprobada |

## Gate 1 — proposed

`ConfirmDialog` es un componente real, exportado desde
`app/studio/_components/ui/ConfirmDialog.tsx`, con consumidores en Studio,
contrato en SDD-0165 y pruebas de accesibilidad ejecutables.

El registro fuente comienza en `proposed`. Antes de promoverlo deben pasar:

- JSON Schema v1;
- rutas, export, políticas, tokens, tests y consumidores;
- prueba positiva y fixture negativo del validador;
- agregado reproducible;
- revisión de evidencia accesible y visual.

El gate pasó con:

```text
components:index = 1 componente
components:check = schema + rutas + agregado verde
unit = 3/3
```

El fixture negativo cambia la implementación a una ruta inexistente y el
validador la rechaza.

## Gate 2 — canonical

La promoción se aprueba porque:

- SDD-0165 está `done` y define el contrato público;
- la suite de `ConfirmDialog` verifica foco seguro, Tab, Escape, restauración,
  motivo requerido, `pending` e IDs accesibles;
- la evidencia visual autenticada cubre diálogo anidado y breakpoints;
- los tokens declarados existen y son consumidos por la implementación;
- tres consumidores reales importan el export canónico;
- REV-SGE-008/009 clasifican la primitiva como cumplimiento y separan la deuda
  de consumidores legacy.

El validador no modifica el componente ni promueve estados como efecto
lateral. La promoción fue una decisión humana explícita después del primer
pase `proposed`.

## Limitaciones del schema v1

Se registran dos defectos sin alterar el schema aprobado:

1. la rama `retired` usa `maxItems` sin repetir `type: array`; Ajv se ejecuta
   con `strict:false` y conserva validación Draft 2020-12;
2. `policyRefs.code` admite solo letras antes del guion y no representa
   `A11Y-01`. La conformidad accesible permanece trazada por SDD-0165, tests y
   evidencia visual, pero A11Y-01 no se falsea dentro de `policyRefs`.

Ambos puntos requieren una versión futura del schema; no invalidan el registro
actual ni autorizan agregar campos manuales.

## Límite y estabilidad PLG-01

Este gate registra un solo componente. No modifica `ConfirmDialog`, no cataloga
otros componentes y no autoriza crear PLG-01.

CMP-01 ya demuestra schema positivo/negativo, agregado reproducible y un
recorrido real `proposed → canonical`. El criterio de estabilidad de
REV-SGE-010 sigue incompleto porque falta un caso `deprecated` con reemplazo y
consumidores. PLG-P1 permanece cerrado.

# NUM-01 v0.1 — Campos numéricos y financieros

| Control | Valor |
|---|---|
| Estado | redactada — pendiente de aprobación |
| Base actual | `NumericInput` |

## Contrato

- El label declara magnitud y la UI muestra unidad/moneda sin introducirla como texto ambiguo.
- Vacío, cero y no aplicable son estados distintos.
- La edición acepta formato humano; el servidor recibe un valor canónico y lo valida de nuevo.
- Dinero usa precisión decimal del dominio; no se calcula con float binario sin estrategia explícita.
- Separadores de miles/decimal se muestran según locale sin cambiar el valor almacenado.
- Redondeo declara método, momento y precisión; totales no se obtienen sumando valores ya redondeados sin regla.
- Negativos, porcentajes, máximos, mínimos y cantidades fraccionarias se habilitan por campo, no globalmente.
- Expresiones de `NumericInput` muestran preview antes de confirmar y fallan sin alterar el valor anterior.
- Montos calculados indican qué es editable y qué es derivado.
- Error de campo conserva el texto introducido y explica el formato esperado.

## Gate

Probar vacío/cero, negativo, máximo, precisión, pegado con distintos separadores,
locale, teclado móvil, redondeo, error server-side y monto fuera de rango.

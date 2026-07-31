# NUM-01 v1.1 — Campos numéricos y financieros

| Control | Valor |
|---|---|
| Estado | aprobada — componente canónico; adopción gradual |
| Aprobación | 2026-07-30 · Sam (founder) · REV-SGE-020 |
| Base actual | `NumericInput` canonical |

## Contrato

- El label declara magnitud y la UI muestra unidad/moneda sin introducirla como texto ambiguo.
- Vacío, cero y no aplicable son estados distintos.
- La edición acepta formato humano; el servidor recibe un valor canónico y lo valida de nuevo.
- Dinero usa precisión decimal del dominio; no se calcula con float binario sin estrategia explícita.
- Separadores de miles/decimal se muestran según locale sin cambiar el valor almacenado.
- Los separadores se interpretan por literal, nunca normalizando la expresión completa.
- Redondeo declara método, momento y precisión; totales no se obtienen sumando valores ya redondeados sin regla.
- Negativos, porcentajes, máximos, mínimos y cantidades fraccionarias se habilitan por campo, no globalmente.
- Un campo acepta un total directo o una expresión con `+`, `-`, `*`, `/` y paréntesis.
- La evaluación intermedia usa decimal reproducible; la división declara precisión y redondeo.
- Una expresión incompleta conserva el último valor canónico válido y no emite `null`.
- La primera edición incompleta se valida en blur, Enter, Tab o submit; después del primer error se revalida en vivo.
- Una expresión válida se confirma como total canónico sin locale ni exponente.
- Montos calculados indican qué es editable y qué es derivado.
- Error de campo conserva el texto introducido y explica el formato esperado.

## Gate

Probar vacío/cero, negativo, máximo, precisión, pegado con distintos separadores,
locale por operando, operador final, conservación del valor anterior, teclado,
redondeo, error server-side y monto fuera de rango.

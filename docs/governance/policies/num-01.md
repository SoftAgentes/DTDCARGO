# NUM-01 v1.2 — Campos numéricos y financieros

| Control | Valor |
|---|---|
| Estado | aprobada — componente canónico; adopción gradual |
| Aprobación | 2026-11-22 · Sam (founder) · SDD-0687 fases 1 y 2 (v1.2; confirmar en la PR) · v1.1: 2026-07-30 · REV-SGE-020 |
| Base actual | `NumericInput` canonical · `parseNumero` en `lib/shared/cifras.ts` |

## Contrato

- El label declara magnitud y la UI muestra unidad/moneda sin introducirla como texto ambiguo.
- Vacío, cero y no aplicable son estados distintos.
- La edición acepta formato humano; el servidor recibe un valor canónico y lo valida de nuevo.
- Dinero usa precisión decimal del dominio; no se calcula con float binario sin estrategia explícita.
- Separadores de miles/decimal se muestran con punto de miles y coma decimal (`1.234,50`, SDD-0687) sin cambiar el valor almacenado.
- Los separadores se interpretan por literal, nunca normalizando la expresión completa. Cada campo declara su modo (dinero, tasa, porcentaje o medida) y su precisión; no hay modo por defecto.
- En dinero, un separador único (punto o coma) seguido de exactamente tres cifras no se interpreta: se rechaza y se pide aclarar (`1.234`, `1,234`, `10,000`). En tasa, solo el punto (`36.500`); la coma es el decimal. En medida y porcentaje, punto o coma son decimales.
- El formato de EE. UU. (`1,234.50`) se rechaza en todos los modos con el formato esperado.
- Un valor con más decimales que los del campo se rechaza; no se redondea en silencio.
- Un texto rechazado no deja vivo el valor que se tecleó antes (`1.23` → `1.234`): el campo queda sin valor hasta que se aclare.
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
redondeo, error server-side y monto fuera de rango. La tabla de SDD-0687 §2 se
prueba en los cuatro modos (dinero, tasa, porcentaje y medida), con mutantes
para los casos ambiguos (`1.234`, `1,234`, `10,000`, `36.500`, `1,234.50`).

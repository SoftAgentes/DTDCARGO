# NUM-01 v1.2 — Campos numéricos y financieros

| Control | Valor |
|---|---|
| Estado | aprobada v1.2 — opción A; componente canónico, adopción gradual |
| Aprobación | 2026-11-24 · Sam (founder) · SDD-0687 opción A, regla y vista previa; confirmación del Director `msg_c31b38185eb6` |
| Base actual | `NumericInput` canonical · `parseNumero` en `lib/shared/cifras.ts` |

## Contrato

- El label declara magnitud y la UI muestra unidad/moneda sin introducirla como texto ambiguo.
- Vacío, cero y no aplicable son estados distintos.
- La edición acepta formato humano; el servidor recibe un valor canónico y lo valida de nuevo.
- Dinero usa precisión decimal del dominio; no se calcula con float binario sin estrategia explícita.
- Separadores de miles/decimal se muestran con punto de miles y coma decimal (`1.234,50`, SDD-0687) sin cambiar el valor almacenado.
- Los separadores se interpretan por literal, nunca normalizando la expresión completa. Cada campo declara su modo (dinero, tasa, porcentaje o medida) y su precisión; no hay modo por defecto.
- En todos los modos, un punto o una coma únicos son decimales, también con tres cifras después; se conserva la precisión y el rango de cada campo.
- Las agrupaciones mixtas (`1.234,50`, `1,234.50`) o repetidas (`1.234.567`, `1,234,567`) se rechazan con «Escribe el número sin puntos de miles» en el analizador compartido y NumericInput.
- La vista inmediata usa formato venezolano y conserva los decimales válidos del resultado. El texto editable al confirmar queda sin miles; la salida conserva `1.234,50`. Una salida agrupada no se reinterpreta como entrada humana.
- `parseMaquina`, almacenamiento, valores antiguos, signos, unidades y cálculos de negocio conservan su contrato. La enmienda no retira ft³.
- Un valor con más decimales que los del campo se rechaza; no se redondea en silencio.
- Un texto rechazado no deja vivo el valor que se tecleó antes: el oculto queda sin valor hasta corregirlo. El texto permanece para corregirlo.
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
para agrupaciones rechazadas, separador único decimal, precisión y vista VE.
Los contratos canónicos de servidor conservan sus pruebas separadas.


## Trazabilidad de la enmienda

- v1.1 fue aprobada el 2026-07-30 por Sam, REV-SGE-020; conserva su evidencia en
  [la revisión original](../reviews/num-01-v1-1-numeric-input.md).
- La propuesta previa v1.2 de la PR #790 pedía aclaración en separadores de tres
  cifras y aceptaba agrupación venezolana. Esa propuesta no tenía confirmación
  normativa y queda sustituida por la opción A de SDD-0687 §2.
- El 2026-11-24 el Director confirmó la aprobación expresa de Sam de la regla y
  vista previa de opción A (`msg_c31b38185eb6`). La selección inicial para
  implementar y esta aprobación posterior se distinguen en el
  [handoff de la enmienda](../../../.agents/handoffs/sdd-0687-decimales-opcion-a-20261124.md).
- Se conserva v1.2 porque la regla previa de esa versión era propuesta pendiente;
  no hubo una v1.2 aprobada intermedia ni se promueven componentes ajenos.
- La aprobación de regla/vista no aprueba por sí sola el código, CI, integración,
  publicación ni fases futuras. Las traducciones de error propias de consumidores
  se conservan donde no se autorizó editar su código.

---
sdd: "0502"
title: "Mínimo facturable con batería según el multiplicador configurable"
status: in-progress
author: "Director + Codex Worker + founder"
created: 2026-09-23
updated: 2026-09-23
supersedes: null
superseded_by: null
related: ["0055", "0257", "0473", "0480"]
confidencialidad: interno
---

# SDD-0502 — Mínimo facturable con batería configurable

> Cuando una carga cae por debajo del mínimo, primero alcanza el piso comercial
> y después recibe el recargo de batería configurado en Administración. El
> mínimo normal de USD 50 con el multiplicador vigente ×1,5 cuesta USD 75; si
> Administración cambia el multiplicador a ×2, el mismo caso cuesta USD 100 sin
> cambiar código.

## Problema observado

El motor vigente calcula el multiplicador de batería antes del piso:

```text
subtotal = base + peso + ciudad + embalaje
conBateria = subtotal × multiplicador
total = max(conBateria + descuento, piso)
```

Para 0,02 m³ a USD 850/m³, sin otros recargos, el subtotal es USD 17. Con
`×1,5` llega a USD 25,50 y luego el piso lo lleva a USD 50. La batería aparece
en el desglose, pero su valor queda absorbido por un ajuste a mínimo menor; el
total continúa en USD 50. No es una resta de peso: es una precedencia incorrecta
entre dos reglas válidas.

La presentación agrava la confusión porque redondea cada renglón a dólares
enteros. En importes con centavos, los renglones visibles pueden no sumar el
total visible aunque el motor reconcilie a dos decimales.

## Decisión autorizada

El piso se completa antes de aplicar baterías:

```text
subtotal = base + peso + ciudad + embalaje
ajusteMinimoBase = max(0, piso - subtotal)
fleteFacturable = subtotal + ajusteMinimoBase
recargoBateria = bateria ? fleteFacturable × (multiplicador - 1) : 0
totalAntesDescuento = fleteFacturable + recargoBateria
total = max(totalAntesDescuento + descuento, piso)
```

El último `max` conserva la protección histórica del piso **normal**. No crea un
segundo piso multiplicado después del descuento: con piso USD 50, batería ×1,5
y descuento USD 10, el resultado es USD 65 (USD 75 − USD 10), salvo que un
descuento mayor lo lleve por debajo de USD 50. El ajuste mínimo devuelto incluye
cualquier restauración hasta ese piso normal. En los caminos afectados por esta
decisión —mínimo y batería— el contrato verificado del desglose es:

```text
precioBase + recargoExcedente + recargoCiudad + recargoEmbalaje
+ recargoBateria + descuentoSede + ajusteMinimo = total
```

La fuente del multiplicador sigue siendo
`public_calculator_config.recargo_bateria_mult`, mapeada a
`params.recargoBateriaMult`. No se introduce USD 100 como literal ni una regla
paralela. SDD-0480 permanece cerrada: fijó que el respaldo del código espejara
el ×1,5 del ERP, pero no definió esta precedencia.

## Ejemplos de aceptación

Con tarifa USD 850/m³, piso USD 50 y 0,01 m³ (USD 8,50), sin peso excedente,
ciudad ni embalaje:

| Batería | Multiplicador | Volumen | Ajuste a mínimo | Recargo batería | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| No | — | 8,50 | 41,50 | 0,00 | 50,00 |
| Sí | ×1,5 | 8,50 | 41,50 | 25,00 | 75,00 |
| Sí | ×2 | 8,50 | 41,50 | 50,00 | 100,00 |

Por encima del piso se conserva el contrato actual: USD 850 con ×1,5 produce
USD 1.275 y un recargo de USD 425.

## Alcance

- `lib/calculadora.ts`: orden de piso/batería y desglose reconciliable.
- `__tests__/calculadora.test.ts`: sin batería, bajo piso ×1,5 y ×2, sobre piso,
  descuento y suma exacta a centavos.
- `lib/studio/document-import/estimate.test.ts`: regresión del consumidor
  documental que ya reutiliza el motor; no duplica la fórmula.
- `components/CalculadoraForm.tsx`: formato mínimo de moneda para mostrar
  centavos cuando existan, sin rediseño ni cambio de jerarquía visual.
- Prueba de UI del desglose mínimo con batería.
- `docs/marketing/README.md` y
  `docs/marketing/calculadora-explicada.html`: distinguir mínimo normal de
  mínimo con batería dinámico.
- Handoff, Graphify estructural/semántico aplicable y preview de conocimiento.

## Fuera de alcance

- Cambiar el valor vigente de `recargoBateriaMult`, tarifas, descuentos,
  embalaje, ciudades o reglas de Consolidado.
- Cambiar la pantalla de Administración, la RPC, el esquema o datos de
  producción.
- Leer filas de negocio o PII, aplicar migraciones, mergear o desplegar.
- Duplicar la fórmula en `estimate.ts` o cruzar la frontera público ↔ ERP.

## Compatibilidad y riesgos

- SDD-0055 mantiene la configuración inyectada desde la RPC y sus respaldos;
  esta SDD consume ese mismo `CalcParams`.
- SDD-0257 usa el total como precio “Desde” cuando falta el peso. La regla nueva
  también debe aplicar en ese estado y conservar su techo de peso.
- SDD-0473 reutiliza `calcularEnvioLCL` para documentos. Una prueba de regresión
  demuestra que recibe la corrección sin implementación paralela.
- Los descuentos mantienen su orden existente —después de batería— y sólo se
  restaura el piso normal si fuese necesario. Esta SDD no introduce un piso
  postdescuento multiplicado. Cualquier cambio comercial más amplio queda
  bloqueado hasta una nueva decisión del founder.

## Aceptación

1. Sin batería, el piso actual no cambia.
2. Bajo el piso, batería `×1,5` produce `piso × 1,5`; batería `×2` produce
   `piso × 2` usando el mismo campo de configuración.
3. Sobre el piso, el resultado vigente no cambia.
4. No existen literales USD 75/USD 100 en la implementación del motor.
5. En los casos de mínimo y batería cubiertos por esta SDD, los campos del
   desglose suman el total a precisión de centavos y la UI no pierde los
   centavos necesarios para que el cliente pueda comprobarlo. Una regresión
   adicional confirma la base fraccionaria sobre el piso sin batería, sin
   inventar un “Ajuste a mínimo” donde el piso no aplica.
6. El consumidor de SDD-0473 recibe la misma regla mediante el motor compartido.
7. Pruebas focalizadas, lint/typecheck/docs aplicables y `pnpm verify` se
   registran con PASÓ/FALLÓ/NO EJECUTADO/NO DISPONIBLE.
8. La rama se publica y se abre PR contra `main`; el Worker no mergea ni
   despliega.

La regresión de redondeo usa una carga sobre el piso con base cruda
USD 104,56599 y batería ×1,5: el total histórico es USD 156,85. La
implementación conserva ese total y distribuye USD 104,57 + USD 52,28 en el
desglose. Redondear la base antes de multiplicar daría USD 156,86 y queda
explícitamente prohibido por la prueba.

## Validación visual

La presentación cambia únicamente el formato de importes fraccionarios. Se
verifica `/tarifas` en desktop y móvil, con batería apagada/encendida, para
confirmar que los renglones visibles suman el total, que no hay desborde y que
la jerarquía de marca permanece intacta.

## Incidente de numeración

La primera asignación fue `0501` y produjo la reserva remota create-only
`codex/sdd-reserve-0501`, commit
`393aa37dff231ba1e888e03816fb5fb5b6bc563f`. Antes del primer cambio de
producto, el Director detectó una colisión documental: el handoff canónico de
cierre ya llama “SDD-0501” a otro trabajo, aunque éste no tenga carpeta de spec.
El Director reasignó esta tarea a `0502`.

La reserva 0501 queda abandonada y preservada; no se borra, no se fuerza, no se
recicla y no abre PR. La reserva válida es `codex/sdd-reserve-0502`, commit
`11ed19287734ff7966506ce82a6f552633b5ff19`, incorporado a la rama Worker como
`86abfc5d`. Cualquier limpieza futura pertenece al Director y requiere
autorización separada.

---
sdd: "0658"
title: "Nómina: el finiquito lee y conserva los ajustes de liquidación de la 0179"
status: in-progress
author: "Claude (Director General) + Sam"
created: 2026-11-18
updated: 2026-11-18
supersedes: null
superseded_by: null
related: ["0103", "0109", "0653"]
confidencialidad: interno
---

# SDD-0658 — El finiquito lee y conserva sus tres ajustes de liquidación

> El cálculo del finiquito ignoraba tres ajustes guardados en las reglas de nómina (método de prestaciones,
> interés sobre prestaciones y si la causa ajena suma el Art. 92), y guardar una versión nueva de las reglas
> los devolvía a sus valores de fábrica. Esta spec los lee, los conserva y los muestra en la pantalla de Reglas.

**Pedido:** Sam, 2026-11-18, al revisar el hallazgo de la fase A2b de la SDD-0653: «Haz esta tarea aquí».

## Contexto

La migración 0179 (SDD-0109, junio de 2026) agregó a `nomina_payroll_rules` tres columnas con default:

| Columna | Default | Qué decide |
|---|---|---|
| `prestaciones_method` | `mejor` | Garantía, retroactivo o el mayor de los dos (LOTTT Art. 142) |
| `prestaciones_interest_pct` | `0` | Interés sobre prestaciones, aplicado una vez sobre el total |
| `ajena_78_incluye_92` | `false` | Si el despido por causa ajena (Art. 78) suma la indemnización del Art. 92 |

Lo que se verificó en `main` (9a0186228):

1. **Lectura.** `getVigentePayrollRules` (`lib/studio/nomina/payroll-rules-queries.ts`) no pedía esas columnas.
   `settlementRulesFrom` (`lib/studio/nomina/settlement-types.ts`) caía siempre en «mejor», 0 y `false`, y el
   `rules_snapshot` del finiquito no las congelaba.
2. **Guardado.** Ni la función `nomina_guardar_reglas` (0556) ni el camino de dos pasos copiaban las tres columnas
   a la versión nueva: volvían a su default.
3. **Pantalla.** Ninguna pantalla ni acción las mostraba o editaba.

**Impacto real:** como nadie podía editarlas desde la app, la base guarda sus defaults salvo que alguien las haya
cambiado por SQL. El cálculo de hoy coincide con lo que hay en la base. Lo que sí importa para el contador es el
valor de fábrica del interés (0 %): la LOTTT manda pagar intereses sobre las prestaciones.

## Alcance

- **Lectura:** `COLUMNAS_BASE` pide las tres columnas (la 0179 está aplicada en todos los entornos desde junio).
  `rowToPayrollRules` las convierte; un método desconocido se lee como `mejor`. El finiquito las usa y las congela
  en su `rules_snapshot` sin otro cambio.
- **Guardado:** `resolverAjustesLiquidacion` decide lo que guarda la versión nueva: lo del formulario; si no llegó,
  lo de la versión vigente; si la vigente no lo trae, el default de la 0179.
  - Sin la 0556 (dos pasos): el insert las lleva.
  - Con la 0556: la función no las conoce. Se fijan con un `update` sobre la versión que acaba de crear (misma RLS
    de quien guarda). Si ese segundo paso falla, la acción lo dice («Las reglas se guardaron, pero no los ajustes de
    la liquidación… Vuelve a guardar») y no lo da por bueno.
- **Pantalla:** grupo «Liquidación (finiquito)» en Reglas, con los tres campos prellenados con lo de la versión
  vigente y un aviso para confirmarlos con el contador.
- **Validador:** método entre los tres, interés de 0 a 100, sí/no. Vacío = conservar lo vigente.

**Fuera de alcance:**

- **Cambiar los defaults.** El valor del interés lo decide el contador.
- **Migración.** No hay migración. Hacer el guardado atómico exige reemplazar `nomina_guardar_reglas` para que copie
  las tres columnas. Eso queda como mejora posible, con su OK nominal.
- **Recalcular finiquitos ya emitidos.** Esos conservan su snapshot.

## Decisiones

- **D1 (DG, por la regla de Sam «escoge la recomendada»):** sin migración. Los dos pasos con la 0556 se aceptan
  porque la falla del segundo es visible y se corrige volviendo a guardar. Además, una migración pediría el OK
  nominal de Sam y no saldría a producción esta noche.
- **D2:** el sí/no del Art. 92 es un `select`, no una casilla: una casilla sin marcar no viaja en el formulario y
  nunca se podría pasar de «sí» a «no».

## Pruebas

- `lib/studio/nomina/payroll-rules-queries.test.ts` › «SDD-0658»: lectura con y sin la 0556, método desconocido,
  conservación de lo vigente, el formulario manda, falla del segundo paso, insert sin la 0556 y sin versión
  vigente. Sin el arreglo, la lectura no pide las columnas y el `update` no existe: las pruebas caen.
- `lib/studio/nomina/payroll-rules-types.test.ts` › «SDD-0658»: validador y `resolverAjustesLiquidacion`.

# ADR-0003 · Columnas pendientes asociadas a su relación en el gate de símbolos

| Campo | Valor |
|---|---|
| Estado | aceptado |
| Fecha | 2026-09-13 |
| Dueño | ingeniería DTD Cargo |
| SDD | SDD-0464 (harness; enmienda de semántica de SDD-0450) |
| Enmiendas | ninguna |
| Confidencialidad | interno |

## Contexto y medición

`scripts/check-pending-migration-symbols.mjs` (SDD-0450) busca cada símbolo
pendiente por su nombre. Para una columna, el nombre buscado era solo el de la
columna (`referenceName = symbol.name`), sin la relación. La 0421 de L14 (PR
#104) agrega a `payment_reports` las columnas `cancelled_at`, `cancelled_by` y
`resolution_reason`, que ya existen en `dispatch_orders` (0024),
`qr_print_orders` (0027) y `expense_alerts` (0075).

Medido sobre el head `93f1cbed` de esa rama con el checker anterior:

- la declaración `l14-payment-report-columns-pending` enumera 25 sitios; 10
  están en `lib/portal/payment-report-queries.ts` y dependen de 0421; los otros
  15 están en siete módulos de despacho, cola QR y alertas de gasto que nunca
  tocan `payment_reports`;
- de sus 13 evidencias, 7 empiezan por «Sin degradado» y solo existen para
  explicar esos sitios ajenos;
- cualquier cambio de línea en esos siete módulos invalida la declaración
  (exit 2), aunque el cambio no toque pagos.

El handoff `c-l14-portal-comandos-recibos.md` lo registró como FUERA DE
ALCANCE y pidió asociar la columna a su relación.

## Alternativas

| Opción | Qué resuelve | Riesgo abierto |
|---|---|---|
| A. Seguir asociando solo por nombre | Nada; es el estado anterior. | Declaraciones frágiles y con sitios ajenos; cada homónimo cuesta una ronda. |
| B. Contar un sitio solo si su módulo nombra la relación pendiente | El caso L14 completo. | Falla abierto: un mapper, un tipo o un consumidor que no escribe el nombre de la tabla dejaría de exigirse aunque dependa de la columna. |
| C. Descontar solo con evidencia positiva de otra dueña, en el módulo o en un vecino directo (elegida) | El caso L14 completo, incluidos los módulos de tipos. | Un consumidor compartido entre dos relaciones dueñas del mismo nombre, sin nombrar la pendiente y sin vecino que la nombre, se descuenta. Documentado abajo. |
| D. Resolver tipos con el compilador o con tipos generados de Supabase | La asociación semántica real. | El repo no usa tipos generados y sumaría una dependencia pesada al harness Node. Fuera de alcance. |

## Decisión

Elegir C. Reglas del gate desde SDD-0464:

1. **Modelo de columnas por relación.** De todas las migraciones, en orden de
   nombre y sobre las mismas vistas de código ejecutado que el extractor de
   símbolos (texto sin comentarios ni literales, cuerpos `DO` y plantillas de
   `EXECUTE`), se leen los cuerpos de `create table (…)`, `add column`,
   `drop column`, `rename column` y `drop table`; las vistas se registran sin
   columnas. Es evidencia positiva: una columna que no se pudo leer no consta.
2. **Funciones que devuelven la relación.** `create function … returns [setof]
   esquema.relación` asocia la función a la relación. Nombrar esa función (por
   ejemplo `.rpc("confirm_payment_report")`) equivale a nombrar
   `payment_reports`. `returns table(…)` no nombra ninguna relación.
3. **Ámbito de un módulo.** Sus tokens identificador (sin comentarios, en
   minúsculas) más los de sus vecinos directos alcanzables en el grafo de
   imports: lo que importa y quien lo importa. Así un módulo de tipos o un
   mapper hereda la relación del módulo de consultas que lo importa.
4. **Decisión por referencia.** Una mención alcanzable del nombre de una columna
   pendiente `R.c`:
   - cuenta si el ámbito nombra `R` o una función que devuelve `R`;
   - se descarta como homónima solo si, sin nombrar `R`, el ámbito nombra otra
     relación `R'` que tiene la columna `c` según el modelo;
   - cuenta en cualquier otro caso. Sin evidencia de otra dueña, falla cerrado.
5. **Funciones, tablas y vistas** siguen asociándose por nombre: una RPC se
   invoca por su nombre exacto y no tiene una «dueña» alternativa que permita
   descontarla.
6. **Contrato de declaraciones sin cambios.** `schemaVersion` sigue en 1 y no
   cambia `$doc`, que el driver de merge exige idéntico entre ramas. Cambia lo
   que el gate exige: `callSites` debe enumerar solo los sitios contados. Una
   declaración que todavía lista sitios homónimos falla con exit 2 y el mensaje
   trae la lista real.
7. **Salida.** Los homónimos descartados se imprimen en gris con su relación
   dueña (`[HOMÓNIMOS] … → dispatch_orders.cancelled_at`) y la línea final suma
   `N homónimo(s) descartado(s)`, para que la revisión pueda auditar cada
   descuento.

## Evidencia

- Sobre el head `93f1cbed` de L14, el checker anterior da `0 ROJO · 2
  AMARILLO`; el nuevo exige exactamente los 10 sitios de
  `lib/portal/payment-report-queries.ts` y rechaza los 15 homónimos (exit 2,
  lista real en el mensaje). Con la declaración recortada a esos 10 sitios y
  sin las 7 evidencias «Sin degradado», el nuevo da `0 ROJO · 2 AMARILLO · 15
  homónimo(s) descartado(s)`, exit 0, atribuyendo cada uno a `dispatch_orders`,
  `qr_print_orders` o `expense_alerts`. Simulado en una extracción con
  `git archive`, sin tocar el worktree de la PR.
- Sobre `main` `76797beb` no hay columnas pendientes: el veredicto sigue en
  `0 ROJO · 0 AMARILLO` y el modelo lee 258 relaciones con 3546 columnas.
- `scripts/check-pending-migration-symbols.test.mjs` fija el caso L14 en su
  forma real, seis casos en los que la columna de la propia relación sigue
  exigiéndose (mapper importado, módulo sin relación, ambas relaciones, RPC que
  devuelve la relación, dos saltos y columna borrada por otra aplicada) y que
  una RPC pendiente se exige aunque el módulo solo nombre otra relación. El
  caso L14 falla con el checker anterior.

## Límites

- El ámbito es textual y de un salto. Un consumidor a dos o más saltos de todo
  módulo que nombre la relación se exige (seguro) aunque sea de otra relación.
  Un consumidor compartido a un salto de una dueña homónima y a más de uno de
  la pendiente se descuenta: es el único caso en que C puede callar donde A
  hablaba. El módulo que consulta la relación pendiente la nombra y sigue
  exigiéndose por sí mismo.
- Solo se leen las formas DDL enumeradas. `create table … as select`,
  particiones, `like`, tablas temporales y columnas de vistas no aportan
  columnas: sin evidencia, el gate exige.
- `create temporary table` no se registra. `rename to` de tablas no se sigue.
- El modelo no certifica el catálogo real: clasifica por el DDL versionado,
  como el resto del gate.

## Rollback

Revertir el commit de SDD-0464 que toca `scripts/check-pending-migration-symbols.mjs`
y su prueba. Las declaraciones vigentes volverían a necesitar los sitios
homónimos; el gate diría cuáles con exit 2. No hay cambio de formato que
deshacer.

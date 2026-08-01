---
sdd: "0236"
title: "Transportistas terrestres y su tarifario por CBM"
status: in-progress
author: "Sam (founder) + Claude Code"
created: 2026-07-31
updated: 2026-07-31
supersedes: null
superseded_by: null
related: ["0047", "0055", "0104"]
confidencialidad: interno
---

# SDD-0236 · Transportistas terrestres y su tarifario por CBM

## Decisión

Existe un registro de **transportistas terrestres** con **uno marcado como
predeterminado por tenant**, y un **tarifario por transportista y ciudad** cuyo
número operativo es **siempre USD/CBM**. La calculadora pública cotiza con el
predeterminado y **nunca sabe quién es, ni cuánto nos cuesta, ni qué ofrecieron
los demás**.

El precio se edita desde el ERP **sin deploy**.

## Por qué

Tres problemas encadenados, todos medidos en el repo:

1. **No existe ninguna entidad de transportista en el sistema.** Ni tabla, ni
   tarifario, ni en DB ni en código. Lo único parecido es `carriers`, que son
   **navieras marítimas** (SDD-0047). Los proveedores viven en markdown.

2. **La calculadora pública cobra una fórmula inventada.**
   `max(0, km − 200) × $1` en `lib/calculadora.ts`, que no corresponde a ningún
   modelo real: sobrecobra **+706%** en Puerto Ordaz a 0,5 m³ ($570 contra ~$62)
   y subcobra en Barquisimeto. No existe fórmula por kilómetro que reproduzca
   una tabla real — el $/km/CBM implícito varía **37×**.

3. **La misma fórmula está duplicada** en `lib/studio/client-address-types.ts`
   (`lastMileEstimate`), que alimentan el ERP y el portal del cliente.

## La regla que gobierna el diseño

**Founder, 31-jul-2026: con cualquier transportista, DTD paga por metro cúbico.**
Muere el % ad valorem, muere el USD/kg, muere el valor declarado, muere el
recargo por kilómetro. Los transportistas cotizan en **pies cúbicos** porque
vienen del mundo courier de EE.UU.; se convierte al registrar la tarifa
(`1 m³ = 35,3147 ft³`) y el número operativo del sistema es siempre **USD/CBM**.

### Por qué hay dos precios y no uno

`cost_usd_cbm` es lo que le pagamos al transportista. `price_usd_cbm` es lo que
le cobramos al cliente. **No se derivan uno del otro por un porcentaje.**

La venta salió de la **primera** oferta de Benito, cotizada en pie cúbico
($3,00 · $3,50 · $5,00) y convertida a CBM. El costo que confirmaron después fue
más bajo. El mercado cotiza ~$3/ft³ ≈ $105/CBM, así que el $70 puede ser un
error de ellos: vendiendo a la tabla vieja, si mañana el costo sube a lo que
cotiza el mercado, **DTD no pierde**. Es un seguro, no un margen.

⚠️ **Esto reemplaza la regla del 30%** que se había fijado antes. Cualquier
intento futuro de calcular la venta como `costo × (1 + margen)` rompe la
decisión.

| Tramo | Costo | Venta | Margen |
|---|---:|---:|---:|
| Centro | $70,00 | $105,94 | $35,94 |
| Foráneo | $80,00 | $123,60 | $43,60 |
| Remota | $80,00 | $176,57 | $96,57 |

## Modelo de datos · migración 0330

```
freight_carriers
  id · tenant_id · name · legal_name · tax_id · contact · notes
  is_default boolean   -- índice único parcial: UNO por tenant entre los vivos
  active · deleted_at · created_at · updated_at

carrier_tariffs
  id · tenant_id · carrier_id
  city_slug                 -- espeja calculator_cities.slug, SIN FK dura
  cost_usd_cbm   not null   -- lo que pagamos
  price_usd_cbm  not null   -- lo que cobramos
  price_usd_ft3             -- la unidad en que ELLOS cotizaron (referencia)
  min_charge_usd
  dispatch_frequency_days   -- 15 = quincenal → la web avisa "+1 semana"
  departure_frequency · transit_days · conditions
  valid_from · valid_to · deleted_at · created_at · updated_at
```

**Decisiones de esquema que no son obvias:**

- **`city_slug` sin FK dura.** Las ciudades se editan y se borran en blando
  desde el Admin; una tarifa huérfana es mejor que un borrado bloqueado. La UI
  valida contra el catálogo.
- **FK compuesto `(carrier_id, tenant_id)`** contra `freight_carriers (id,
  tenant_id)`, habilitado por un `unique (id, tenant_id)`. Sin eso, una tarifa
  podría colgar de un transportista de **otro tenant**. Lo garantiza el motor,
  no un trigger que alguien puede olvidar.
- **`dispatch_frequency_days` numérico además del texto literal.** El texto
  (`"2 veces por semana · lunes y miércoles"`) es lo que dijeron; el número es
  lo que la web necesita para decidir si avisa del retraso, sin parsear prosa.
- **GRANT antes que policy** — deuda conocida del repo: una policy sin GRANT
  deja la tabla muda para `service_role`.

### La zona sin costo NO vive acá

Las ocho ciudades que el cliente no paga (Valencia · Naguanagua · San Diego ·
Guacara · Maracay · Caracas · Barquisimeto · Acarigua) se marcan con
**`calculator_cities.casco = true`**, que ya existe. No hace falta columna nueva:
esa bandera ya significa exactamente "entrega sin recargo". DTD le paga ese
tramo al fletero aparte; es adquisición de clientes, no un descuento.

## Aislamiento: lo que la web pública puede ver

La RPC `public_carrier_tariffs(p_tenant uuid default null)` devuelve **sólo**
`city_slug · price_usd_cbm · min_charge_usd · dispatch_frequency_days ·
transit_days`, y **sólo del transportista predeterminado, activo y vigente**.

**Nunca** expone `cost_usd_cbm`, el nombre del transportista, su RIF, ni las
ofertas de los demás proveedores. `anon` no tiene `SELECT` sobre ninguna de las
dos tablas: sólo `EXECUTE` sobre la RPC.

Sin filas → el sitio **deriva al asesor**; no inventa precio.

## Verificación

`supabase/tests/0330_freight_carriers_tariffs.test.sql` congela seis
propiedades: C1 la RPC no filtra el costo ni la identidad · C2 devuelve sólo el
predeterminado y sólo lo vigente · C3 un solo predeterminado vivo por tenant ·
C4 una tarifa no puede colgar de un transportista ajeno · C5 aislamiento
multi-tenant real en lectura y escritura · C6 `anon` no lee las tablas directo.

**Validada por mutación (3/3 cazadas):** agregar `cost_usd_cbm` a la RPC, quitar
el filtro `is_default`, y degradar el índice único de predeterminado — las tres
ponen la prueba en rojo. El encabezado del archivo lista las seis mutaciones
para que el próximo pueda repetirlas.

Gate: `run-sql-tests` 51 contratos verdes · `check-schema-rebuild` reconstruye
las 312 migraciones desde cero y el barrido de aislamiento multi-tenant (219
tablas + 2 tenants reales) pasa con las tablas nuevas dentro.

## Estado y qué falta

- ✅ Migración 0330 escrita · prueba contractual validada por mutación.
- ⏳ **NO aplicada a producción.** Exige el OK del founder **nombrando el
  archivo**, de a UNA, por `docs/runbooks/aplicar-migraciones-prod.md`.
- ⏳ Queries/types en `lib/studio/freight-carriers/`.
- ⏳ UI en `/studio/admin` › Calculadora pública.
- ⏳ Que `lib/calculadora.ts` consuma la RPC (fase aparte, SDD propio).

## Deuda que se documenta, no se resuelve acá

Tres factores de densidad contradictorios vivos en el repo: 200 kg/m³ en el
motor terrestre, 1.000 kg/m³ + $2/kg en `docs/marketing/`, y 500-600 kg/m³ en el
Norte. Con el costo del transportista ya en CBM, esto sólo afecta lo que DTD le
cobra al cliente por carga densa. Merece su propia spec.

---
sdd: "0184"
title: "Plan de carga por volumen · el sistema le dice al operario dónde va el próximo lote"
status: in-progress
author: "Claude Code (ventana container-loading) + founder"
created: 2026-07-30
updated: 2026-07-30
supersedes: null
superseded_by: null
related: ["0152", "0153", "0154", "0155", "0160", "0163", "0047", "0081"]
confidencialidad: interno
---

# DTD-0184 — Plan de carga por volumen

## 1. Resumen en una línea

Antes de estibar, el sistema **reparte los lotes en las zonas del contenedor** usando lo
único que el proveedor sí da —**cantidad de cajas y CBM**— y en `/m/cn/estibar` le dice al
operario **"Lote 3 de 7 · DTD-0042 · 50 cajas · 3,0 CBM → Fondo · Izquierda · Piso"**.
El operario escanea, confirma con un toque, o corrige y el desvío queda registrado.

## 2. Por qué

SDD-0152 → 0155 dejó construida la captura de la realidad: quién, qué caja, en qué zona.
**Pero SDD-0163 diagnosticó el problema de adopción: al operario el escaneo no le devuelve
nada.** Es más trabajo que tipear, y por eso al 17-jul-2026 había 2 prealertas y 0 packing
lists en toda la base.

El plan de carga es la contrapartida que faltaba: **el escaneo pasa a ser útil para quien
escanea**. Y de paso el módulo Naviera deja de saber solo *cuánto* va en el contenedor
(SDD-0047, `containerStats`) para saber también *dónde* va a ir.

## 3. Por qué NO hay bin-packing 3D

Se relevó el mercado entrando a las herramientas reales (SeaRates con la cuenta del founder;
EasyCargo por su centro de ayuda, porque la licencia venció). Ver
[`assets/investigacion-mercado-estiba.md`](assets/investigacion-mercado-estiba.md) —
306 hallazgos sobre 151 fuentes.

**Todas piden lo que nosotros no tenemos.** EasyCargo y SeaRates exigen largo×ancho×alto por
bulto, tipo de carga (caja / big bag / saco / barril / rollo / tubo / granel) y restricciones
de apilado por ítem. **El proveedor chino no suministra nada de eso.** Lo único real que
existe, y que ya viaja en el packing list y en `warehouse_boxes`, es **cantidad de cajas y
CBM**.

Decisión del founder (2026-07-30):

1. **Todo es caja.** Sin catálogo de tipos de carga.
2. **Sin largo×ancho×alto.** No se le pide una medida nueva a nadie.
3. **El plan es una guía aproximada, no una promesa milimétrica.** El usuario es el operario
   en el galpón, no un planificador de escritorio.
4. **Solo 20' y 40' High-Cube activos.** El resto del catálogo queda apagado pero configurable.

Eso elimina rotaciones, tilt, soporte de base y todo el aparato de geometría. Y el modelo
que queda **encaja con lo que ya está construido**: `container_types.zone_layout`
(migración 0241) ya divide el contenedor en zonas.

Confirmación independiente: el propio founder ya trabaja así a mano. Su script
`build_consolidado.py` calcula `% llenado (de 68)` sobre `cajas × CBM/caja`, y anota que
*"el límite del 40' HQ es el VOLUMEN, no el peso"*.

## 4. El modelo

Aritmética, no geometría.

Un **lote** = una compra de un cliente = N cajas + CBM total. Es la unidad que el operario
mueve (escanea una caja y monta el lote entero, SDD-0155).

```
cbmPorZona = capacidadUtil / (nx · ny · nz)
40'HC → 68 / 18 = 3,78 CBM por zona

zonasNecesarias(lote) = max(1, ceil(lote.cbm / cbmPorZona))
```

Reparto, determinista y sin aleatoriedad:

1. Ordenar los lotes por `ordenDescarga` **descendente** — el que se descarga último se
   carga primero y queda al fondo. Desempate por Shipping Mark y luego por id, para que dos
   corridas con la misma entrada den el mismo plan (requisito para versionar y comparar).
2. Asignar zonas **en el orden real de carga**: tramo por tramo desde el fondo hacia la
   puerta y, dentro de cada tramo, el piso completo a lo ancho antes de subir. No es el
   orden de `allZones()` de `zones.ts`: al cargar de verdad no se puede volver al fondo
   después de haber llenado el frente.
3. Lo que no entra desborda al siguiente contenedor.
4. Un lote que entra a medias se **parte** (espeja `p_count < lote` de SDD-0155). **Una caja
   sola no se parte.**
5. Avisar —sin bloquear, mismo criterio que `evaluateCapacity`— al pasar el techo real.

### 4.1 Las tres capacidades del 40' HC

Confundirlas infla la ocupación, y el mercado las confunde:

| Cifra | Qué es | Uso |
|---|---|---|
| **76,2 m³** | Volumen **geométrico** interno (12.024 × 2.350 × 2.697 mm, leído en la ficha de SeaRates) | **Ninguno.** Es el denominador que usa SeaRates, y por eso su "% de volumen" sale optimista |
| **68 m³** | Capacidad **útil** de planificación | `cbm_capacity` — la que usa el motor |
| **66,4 m³** | Techo **real** medido en un contenedor propio del founder | `cbm_alert_ceiling` — dispara aviso |

Nuestro código arrastraba la misma confusión: `CONTAINER_TYPES` decía 76 (geométrico, mal
etiquetado como capacidad) y `lib/studio/inventory/types.ts` decía 68 (el correcto). Se
unifica en la Fase 2.

## 5. Datos

- **Migración 0289** — `container_types` gana `active boolean default false` (se activan
  solo `20GP` y `40HC`) y `cbm_alert_ceiling numeric`; se corrige `cbm_capacity` del `40HC`
  de 76 a **68**.
- **Migración 0290** — `consolidation_plans`: `consolidation_id`, `version_no`, `is_current`,
  `input jsonb` (los lotes), `result jsonb` (los pasos y zonas), `created_by`, `deleted_at`.
  Versionado inmutable, mismo patrón que `packing_list_submissions`: recalcular crea versión
  nueva, nunca pisa.
- **Migración 0291** — `consolidation_box_positions` gana `plan_id` y `siguio_plan boolean`,
  para el diferencial plan ↔ realidad.

## 6. Qué se toma del mercado, y qué no

De la investigación, lo que aplica a este alcance:

| Qué | De dónde | Por qué |
|---|---|---|
| **Paso a paso con desaturación selectiva** | EasyCargo tutorial 15 | N pasos = N SVG estáticos: lo colocado en gris tenue, el paso actual saturado. Ellos lo renderizan con Unity; a nosotros nos sale gratis |
| **Chip de color + LETRA en la caja**, persistidos como dato del reporte | EasyCargo | Un plan se ejecuta sin leer texto corrido, y sobrevive a la impresión en blanco y negro |
| **Campo `limits`: qué te frenó — volumen, peso o altura** | SeaRates | Una línea de texto, valor enorme para el jefe de galpón |
| **Dos barras de utilización, no una** | SeaRates (`volumeRatio` / `weightRatio`) | Una sola barra oculta cuál es el factor limitante |
| **Micro-ilustraciones isométricas** que explican cada opción con un dibujo | SeaRates | Se entiende de un vistazo; 100% replicable en SVG a mano |
| **Catálogo con los inactivos en gris** + interruptor para ocultarlos | SeaRates | Es exactamente el patrón "solo 20' y 40'HC activos" |
| **Grupos de prioridad con semántica LIFO** | EasyCargo tutoriales 10-11 | Mapea 1:1 al consolidado: un grupo = un cliente |
| **Desborde a otro contenedor** | EasyCargo tutorial 4 | En consolidados pasa seguido |
| **Descargo permanente en pantallas de peso** | EasyCargo (lo perdió por accidente y lo repuso por parche urgente) | "Es solo una simulación matemática" |

**Lo que NO se copia:** órbita 3D libre y arrastrar cajas — el visor WebGL de SeaRates
**congeló la pestaña** con 190 bultos, y EasyCargo es una compilación de **Unity 3D exportada
a WebGL** que exige 2 GB de RAM y corre el solver en el navegador del cliente. También quedan
fuera los tipos de carga, las cargas por eje de camión y el enlace público anónimo (nuestro
portal ya autentica al cliente).

**El corolario que importa:** como el solver de EasyCargo vive en el navegador, **su API no
puede calcular** — hay que iniciar sesión en la aplicación para que el plan se procese. Un
motor en servidor no es "mejor código": es algo que ellos estructuralmente no pueden hacer.

## 7. Alcance por fases

| Fase | Qué | Estado |
|---|---|---|
| 1 | Repartidor puro en `lib/shared/estiba-plan.ts` + tests | **hecho** |
| 2 | Catálogo de contenedores (migr. 0289) — solo 20' y 40'HC | pendiente |
| 3 | Plan y visor en el Studio (migr. 0290) | pendiente |
| 4 | Lazo plan ↔ realidad en `/m/cn/estibar` (migr. 0291) + reporte imprimible | pendiente |
| 5 | Calculadora pública de llenado | pendiente |

El motor vive en `lib/shared/` —no en `lib/studio/`— porque la calculadora pública lo va a
importar y ESLint bloquea como **error** cualquier import de `@/lib/studio` desde el sitio
público. Por eso `ZoneLayout`, `ZoneCoord` y las etiquetas de zona están duplicadas a
propósito con `lib/studio/naviera/zones.ts`: son estructuralmente idénticas y en la Fase 3
`zones.ts` pasa a importarlas de acá (studio → shared es dirección permitida; al revés
rompería la frontera).

## 8. Fuera de alcance

- Bin-packing 3D, rotaciones, restricciones de apilado por ítem.
- Tipos de carga distintos de "caja".
- Pedirle largo/ancho/alto al proveedor o al cliente.
- Ajuste manual arrastrando cajas (necesitaría un motor gráfico).
- Cargas por eje: somos marítimo, no camión.
- Centro de gravedad y VGM/SOLAS: quedan anotados en la investigación como diferencial
  posible, pero sin dimensiones ni pesos confiables por bulto no hay base para calcularlos.

## 9. Verificación

```bash
node scripts/verify.mjs
```

- **Fase 1** — `pnpm test lib/shared/__tests__/estiba-plan.test.ts`. **Validado con mutación:**
  se rompieron a propósito 11 invariantes (las zonas se pisan, orden de descarga invertido,
  sin el piso de 1 zona, sin redondeo previo al `ceil`, porcentaje sobre el volumen
  geométrico, una caja sola sí se parte, no marca el lote como parcial, la cadena no
  reinyecta lo que quedó sin ubicar, llena de arriba hacia el piso, carga desde la puerta
  hacia el fondo, no avisa al pasar el techo) y **las 11 pusieron la suite en rojo**.
- **Fase 2** — comparar la utilización que reporta el Studio antes y después del cambio de
  76 a 68.
- **Fase 3** — `pnpm build` (Turbopack) + `/ui-pro` para el contraste del visor.
- **Fase 4** — e2e Playwright del ciclo completo, **con datos de prueba, nunca en
  producción**: un correlativo `DTD-CONSOL-NNNN` quemado no se recicla.
- **Fase 5** — `pnpm lint` valida por sí solo la frontera público↔ERP.

Migraciones a producción: **de a una**, con OK nombrado, siguiendo
[`aplicar-migraciones-prod.md`](../../runbooks/aplicar-migraciones-prod.md).

## 10. Riesgo asumido

**El reparto por volumen no es el llenado real.** Un lote de 3 CBM en 50 cajas chicas no
ocupa el mismo espacio que 3 CBM en 5 cajas grandes. El plan es una **guía**, y así hay que
presentarlo al operario — nunca como una promesa. Es el precio consciente de no pedir
dimensiones, y es lo que hace que el flujo sea adoptable.

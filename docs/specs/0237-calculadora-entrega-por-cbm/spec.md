---
sdd: "0237"
title: "La calculadora pública cobra la entrega nacional por CBM"
status: in-progress
author: "Sam (founder) + Claude Code"
created: 2026-08-01
updated: 2026-08-01
supersedes: null
superseded_by: null
related: ["0055", "0104", "0236"]
confidencialidad: interno
---

# SDD-0237 · La calculadora pública cobra la entrega nacional por CBM

## Decisión

La entrega dentro de Venezuela se cobra **`CBM × precio del tramo`**. Muere
`max(0, km − 200) × $1`. La calculadora pasa de **19 destinos a 178**, y cada
destino cae en uno de tres estados con una respuesta distinta para el cliente.

SDD-0236 construyó las tablas; esta spec las llena y las conecta.

## Por qué

1. **La fórmula por km no correspondía a nada.** Sobrecobraba **+706%** en
   Puerto Ordaz a 0,5 m³ ($570 contra $61,80) y subcobraba en Barquisimeto. No
   existe fórmula por kilómetro que reproduzca una tabla real: el $/km/CBM
   implícito varía **37×**.
2. **La calculadora ofrecía 19 ciudades; el transportista cubre 166.** Un
   cliente de Guanare, Turmero, El Tigre o Cabudare **no tenía opción** y se iba
   sin cotizar, aunque el camión llegue ahí sin problema. Es el cambio de mayor
   impacto comercial del lote.
3. **La misma fórmula estaba duplicada** en `lastMileEstimate`, así que el ERP y
   el portal habrían seguido mostrando el número viejo.

## Los tres precios y de dónde salen

| Tramo | Costo (Benito) | Venta (DTD) |
|---|---:|---:|
| Centro | $70,00 | **$105,94** |
| Foráneo | $80,00 | **$123,60** |
| Remota | $80,00 | **$176,57** |

⚠️ **La venta NO se deriva del costo por un porcentaje.** Salió de la primera
oferta de Benito en pie cúbico ($3,00 · $3,50 · $5,00 × 35,3147) y se sostiene
aunque el costo suba. Es un seguro, no un margen — detalle en SDD-0236.

## Los tres estados de un destino

| Estado | Cuántos | Qué ve el cliente |
|---|---:|---|
| **Cubierto** | 169 | Precio al instante: `CBM × tramo` |
| **Sin cobertura** | 9 | *"No llegamos hasta ahí"* + la ciudad cubierta más cercana **con su precio marcado como estimado** + CTA al asesor |
| **Sin tarifa** | 0 hoy | Deriva al asesor. Nunca cobra $0 por omisión |

El copy de "sin cobertura" es deliberado: decir *hasta dónde sí* llegamos y
cuánto cuesta ese tramo es lo que convierte un "no" en una venta. Y decir que el
último trecho **no está incluido** es lo que evita que esa venta termine en
reclamo.

## La zona sin costo

Ocho ciudades donde el cliente paga **$0** de entrega: Valencia · Naguanagua ·
San Diego · Guacara · Maracay · Caracas · Barquisimeto · Acarigua.

**No es un descuento.** DTD le paga ese tramo al fletero y lo asume como
adquisición de clientes. Por eso la tarifa real de esas ciudades **sigue viva**
en `carrier_tariffs` (el ERP no puede perder de vista lo que cuesta) y lo que
pone el cobro en cero es `calculator_cities.casco`, que ya existía. Sin columna
nueva.

La opción agrupada *"Casco central (Valencia · Maracay · Caracas)"* **muere**: el
cliente escoge su ciudad y el sistema decide.

## Quién manda en qué

`combinarDestinos()` (`lib/public/rates-queries.ts`) cruza tres fuentes:

- **La DB manda en el precio.** Si `carrier_tariffs` tiene fila, ese es el
  precio. Es lo que permite subir una tarifa desde el ERP sin deploy.
- **El código manda en la cobertura.** `calculator_cities` no tiene columna para
  *"el transportista confirmó que no llega"*, y esa distinción le dice al
  cliente algo muy distinto que *"todavía no hay tarifa"*. Vive en
  `lib/data/destinos-nacionales.ts`.
- **La DB manda en la lista.** El respaldo del código entra sólo si la RPC no
  devuelve nada.

⚠️ **El respaldo no lleva el costo.** `lib/data/destinos-nacionales.ts` entra al
bundle del navegador: `cost_usd_cbm` vive sólo en la DB y no sale por la RPC.

## Decisiones del founder horneadas (1-ago-2026)

- Vigencia de la tarifa: **31-jul-2026 → 31-jul-2027**.
- Gana el **formulario firmado** sobre el PDF: los 15 quincenales quedan.
- Caracas ← la fila *"Catia"*; Barquisimeto ← la zona Lara; Naguanagua y San
  Diego ← Carabobo/Centro. Las cuatro están en la zona sin costo, así que el
  precio ni se usa.
- *"Panamericana"* no es estado: 5 destinos a **Zulia**, Sabana de Mendoza a
  **Trujillo**.
- *"La Villa"* aparece dos veces con precios distintos →
  `la-villa-aragua` / `la-villa-zulia`.
- Las 9 ciudades cercanas, aprobadas: 5 → Puerto Ordaz, 4 → Cumaná.

## Qué queda LEGACY

`calculator_settings.threshold_casco_km` y `tarifa_km_fuera_casco` **ya no mueven
un centavo**. Siguen en la tabla (quitarlas exigiría una migración destructiva) y
se retiran de la UI del Admin para que nadie edite un número que no hace nada.
Un test lo congela: si alguien los vuelve a conectar al precio, se pone rojo.

## Verificación

`supabase/tests/0332_seed_tarifario_benito.test.sql` congela siete propiedades
del **dato sembrado** — no del esquema, que ya cubre el test de 0330: S1 la RPC
no filtra el costo con datos reales · S2 las 8 de la zona sin costo quedan en
casco · S3 la opción agrupada muere · S4 las sin cobertura no tienen precio ·
S5 idempotencia · S6 los tres precios del acuerdo y nunca vender bajo costo ·
S7 ningún slug de producción desaparece.

**Validada por mutación (6/6 cazadas)**, corridas el 1-ago-2026. Las seis están
escritas en el encabezado del test, con la advertencia de por qué la mutación de
S7 no puede usar `maracaibo`.

Regresión medida: **Puerto Ordaz 0,5 m³ pasa de $570 a $61,80**. Barquisimeto 5
m³ pasa de $20 a **$0** — no a $529,70 como decía el plan viejo, porque la
decisión posterior del founder lo metió en la zona sin costo.

## Estado y qué falta

- ✅ Migración `0332_seed_tarifario_benito.sql` escrita, con prueba contractual
  validada por mutación. **NO aplicada a producción** — exige el OK del founder
  nombrando el archivo, por `docs/runbooks/aplicar-migraciones-prod.md`.
- ✅ `lib/data/destinos-nacionales.ts` — respaldo de 178 destinos, sin costo.
- ✅ `lib/calculadora.ts` — cobra por CBM, tres estados de cobertura, aviso
  quincenal.
- ✅ `getPublicCarrierTariffs()` + `combinarDestinos()` en
  `lib/public/rates-queries.ts`, consumidos por `/tarifas`.
- ✅ `lastMileEstimate` deduplicada: devuelve tarifa por m³, no monto.
- ⏳ **El selector sigue siendo un `<select>` nativo con 178 opciones.** Hace
  falta el combobox con búsqueda (patrón SDD-0108) y pintar los tres estados de
  cobertura en la UI.
- ⏳ La línea *"Entrega — Incluida"* del desglose todavía se oculta cuando es $0.
- ⏳ El copy que habla de kilómetros sigue vivo en `lib/geo-zonas.ts`,
  `/servicios/puerta-a-puerta` y `/importar-de-china`. Son landings indexadas →
  anotar en `docs/marketing/seo.md`.
- ⏳ `AddressCity` acepta `ventaCbm` pero la página que arma `cities` para el ERP
  y el portal todavía no lo alimenta: esas tarjetas muestran *"la cotiza tu
  asesor"* en vez del precio.
- ⏳ Ficha del proveedor `benito-transporte-express.md` y retiro de
  `benitez-rm.md`.
- ⏳ Retirar los dos parámetros legacy de la UI del Admin.

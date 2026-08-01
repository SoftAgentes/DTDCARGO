# Transporte nacional Venezuela — negociación de proveedores

> ✅ **CERRADO 1-ago-2026.** El proveedor n.º 1 quedó elegido, su tarifario
> sembrado y la calculadora pública cobrando por CBM.
> → Ficha vigente: **[benito-transporte-express.md](benito-transporte-express.md)**
> → Specs: **SDD-0236** (modelo de datos) y **SDD-0237** (la calculadora).

Índice del último kilómetro: entrega desde Valencia / Puerto Cabello hacia el resto
del país.

## El proveedor predeterminado

**BENITO TRANSPORTE EXPRESS, C.A** · RIF J-50266334-7 · confirmado por escrito
por Mariotsy Mendoza (Gerente General) el 31-jul-2026.

**Cobra por metro cúbico y nada más.** Costo $70 Centro / $80 Foráneo / $80
Remota; venta $105,94 / $123,60 / $176,57. 166 destinos cubiertos, 9 sin
cobertura. Sin mínimo por despacho y sin cargos aparte.

⚠️ La venta **no** se deriva del costo por un porcentaje — es un seguro, no un
margen. El detalle y el porqué están en la ficha y en SDD-0236.

**Dónde se edita el precio sin deploy:** `/studio/admin` › Calculadora pública ›
Transportistas.

> El material de negociación de abajo queda como **historial**: sirve para
> entender por qué se descartaron los otros modelos de cobro, no como fuente de
> precios. La fuente de precios es la DB.

## Cómo pedir (siempre lo mismo a todos)

→ **[plantilla-solicitud-tarifario.md](plantilla-solicitud-tarifario.md)**

Ese archivo es el cuestionario único. Si cada proveedor manda lo que le da la gana,
las ofertas no se pueden comparar. Mismas preguntas a todos, misma canasta de
escenarios, mismo formato de respuesta.

## Los tres modelos de cobro que ya aparecieron

El mercado venezolano no cobra de una sola forma. Hasta ahora:

| Modelo | Quién | Cómo funciona | Nos conviene cuando |
|---|---|---|---|
| **USD/kg por zona** | Fletes GAG | peso facturable × tarifa(zona, tramo de peso) | carga pesada y de bajo valor |
| **% ad valorem** | Benítez / R&M | % del valor declarado de la mercancía | carga barata y voluminosa |
| **USD/kg volumétrico** | Benítez / R&M (2ª opción) | m³ × factor → kg → tarifa | falta conocer el factor |

**El factor volumétrico es el número que hace comparable todo.** GAG usa
**200 kg/m³**. Si otro usa 167 (1:6) o 333 (1:3), el mismo bulto cambia de precio
sin que la tarifa por kg se mueva un centavo. Preguntarlo SIEMPRE.

## Estado de las negociaciones

| Proveedor | Estado | Modelo ofrecido | Próximo paso |
|---|---|---|---|
| [**Benito Transporte Express**](benito-transporte-express.md) | 🟢 **cerrado · predeterminado** | **USD/CBM plano** | ninguno — sembrado 1-ago |
| Fletes GAG | 🟡 en negociación | USD/kg por zona | sin tarifario desde Valencia |
| _(por definir 3-4 más)_ | ⚪ sin contactar | — | mensaje de contacto inicial |

> La ficha vieja `benitez-rm.md` **se eliminó** el 1-ago-2026: mezclaba tres
> razones sociales y su modelo de % ad valorem quedó descartado. Con quien se
> factura es **BENITO TRANSPORTE EXPRESS, C.A**. La historia vive en git.

**Candidatos sin contactar** (de la investigación de mayo): MRW · Tealca · Domesa ·
Zoom · Liberty Express · Aeroexpresos. Ninguno publica tarifario — hay que pedirlo.

## Contexto que ya existe en el repo

- **Estudio de mercado terrestre** (mayo 2026): `/admin/cbm-estudio` →
  [app/admin/cbm-estudio/content.html](../../../app/admin/cbm-estudio/content.html)
- **PDFs y transcripciones fuente**:
  `wiki-personal/wiki/entidades/cbm-china-vzla-PROYECTO-COMPLETO/tarifas-terrestres/`
- **Tabla vigente** (GAG, vence agosto 2026):
  [lib/data/tarifas-terrestres-vzla.ts](../../../lib/data/tarifas-terrestres-vzla.ts)
- **Motor de cálculo** (ya escrito, 20 tests):
  [lib/calc/fleteTerrestre.ts](../../../lib/calc/fleteTerrestre.ts)
- **Spec original**: `docs/specs/0002-calculadora-flete-terrestre/spec.md`

## Deuda conocida que esta negociación debería resolver

1. La calculadora pública cobra **$1 × km fuera del casco**, plano. No corresponde
   a ningún modelo real del mercado: sobrecobra hasta **+700%** en el oriente
   (Puerto Ordaz 0,5 CBM: $570 cuando debería ser ~$71) y subcobra **−80%** en
   Barquisimeto con carga grande.
2. La tabla de GAG **vence en agosto 2026** — hay que renovarla igual.
3. **Cumaná** y **San Fernando de Apure** no tienen zona asignada en
   `VALENCIA_ZONAS`, aunque sí tienen landing SEO y fila en la calculadora.
   → **Resuelto provisional (founder 2026-07-29):** ambas **derivan al asesor** en
   vez de dar un precio automático. El gate es la lista
   `CIUDADES_DERIVAN_A_ASESOR` en [lib/calculadora.ts](../../../lib/calculadora.ts);
   la calculadora devuelve la alerta `ciudad_sin_tarifa` y la UI reemplaza el
   estimado por el CTA a WhatsApp. **Al confirmar la tarifa con un proveedor, sacar
   el slug de esa lista** (y agregar la zona en `VALENCIA_ZONAS` si se adopta el
   modelo por zonas). Pesa en la decisión que Benítez cobra Cumaná al **8%** contra
   el 5% del centro: el recargo por km la subestima.
4. Nuestro mapa cotiza ~80 destinos; la web solo ofrece 17.

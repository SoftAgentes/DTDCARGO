# Transporte nacional Venezuela — negociación de proveedores

Índice del último kilómetro: entrega desde Valencia / Puerto Cabello hacia el resto
del país. Objetivo declarado por el founder (2026-07-29): **poder despachar a todo
el país**, con 4-6 proveedores negociados en la semana del 29-jul.

> ⚠️ **Nada de esto está decidido.** No se toca la calculadora, ni
> `lib/data/tarifas-terrestres-vzla.ts`, ni `calculator_cities`, hasta que el
> founder elija el modelo y el proveedor. Este tree es material de negociación,
> no fuente de verdad de precios.

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
| [Benítez / R&M](benitez-rm.md) | 🟡 en negociación | % ad valorem **+** kg volumétrico | reunión 30-jul (mañana) |
| Fletes GAG | 🟡 en negociación | USD/kg por zona | llamada 30-jul tarde |
| _(por definir 3-4 más)_ | ⚪ sin contactar | — | mensaje de contacto inicial |

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
4. Nuestro mapa cotiza ~80 destinos; la web solo ofrece 17.

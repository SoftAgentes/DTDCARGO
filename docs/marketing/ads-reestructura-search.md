# Google Ads — Reestructura de la campaña de Búsqueda

> Copy-paste-ready para cargar en Google Ads. Parte de [Marketing](README.md) · plan en [`plan-accion-digital.md`](plan-accion-digital.md).
> **Regla de oro:** trabajá **sobre la campaña existente `DoorTuDoor Trafico`** (NO crees una nueva) → conserva el historial de 4.231 conversiones que alimenta el Smart Bidding. Pausá el grupo viejo, agregá los nuevos.

## 0. Por qué así (arregla los hallazgos de la auditoría)
- ❌ Solo concordancia amplia sin negativas → ✅ **frase + exacta** + lista de negativas compartida.
- ❌ Prender/apagar reinicia el aprendizaje → ✅ una vez activa, **NO tocar ≥2 semanas**.
- ❌ 8 campañas muertas/duplicadas → ✅ todo en **una** campaña limpia, temática por grupo.

## 1. Configuración de la campaña
- **Campaña:** `DoorTuDoor Trafico` (la existente) · tipo Búsqueda · objetivo **Clientes potenciales**.
- **Ubicación:** Venezuela (si querés, +bid en Valencia/Carabobo, Caracas, Maracaibo). **Idioma:** Español.
- **Redes:** Búsqueda **sí**; "Socios de búsqueda" y "Display" → **NO** (al inicio, evita desperdicio).
- **Puja:** arrancá en **Maximizar clics** con un CPC máx. tope (ej. $0.15) los primeros ~7 días para juntar datos; cuando haya ~15-20 conversiones, cambiá a **Maximizar conversiones**. *(La conversión "Click WhatsApp" ya está midiendo.)*
- **URL final de la campaña / anuncios:** `https://dtdcargo.com/estimacion`.
- **Pasos previos:** pausá el grupo viejo `Grupo de anuncios 1` (las keywords amplias) en vez de borrarlo.

## 2. Lista de palabras clave negativas (compartida — Biblioteca compartida → Listas de negativas)
Crear lista **"Negativas DTD core"** y asociarla a la campaña:

```
# Empleo / no comercial
trabajo, empleo, empleos, vacante, vacantes, pasantia, cv, curso, cursos, gratis, tutorial, pdf, "como ser agente"
# Otros orígenes/destinos (no es China→Venezuela)
"estados unidos", usa, miami, panama, colombia, españa, mexico, turquia, dubai, ecuador, peru, brasil
# Compra al detalle / price-shoppers (bajo valor para servicio B2B)
aliexpress, shein, temu, amazon, "mercado libre", mercadolibre, ebay, alibaba opiniones
# Cliente existente / tracking (no es captación)
rastrear, rastreo, trackear, seguimiento, "donde esta mi pedido", reclamo, estafa, "es confiable"
# Dropshipping how-to
"como hacer dropshipping", "que es dropshipping"
```
> Revisá los **Términos de búsqueda** cada 3-4 días la primera semana y agregá negativas de lo que no convierte.

## 3. Grupos de anuncios

> Cada grupo: keywords en **frase** (`"..."`) + **exacta** (`[...]`). 1 RSA por grupo (abajo). La URL final de cada anuncio → `/estimacion` salvo que se indique.

### G1 · Importar de China (core)
```
"importar de china a venezuela"
[importar de china a venezuela]
"como importar de china"
"importar productos de china"
"importar mercancia de china"
"importaciones desde china"
```

### G2 · Puerta a puerta / DDP
```
"envio puerta a puerta china"
[envio puerta a puerta china venezuela]
"importacion puerta a puerta"
"puerta a puerta desde china"
"ddp china venezuela"
```

### G3 · Agente de carga / Yiwu
```
"agente de carga china"
[agente de carga china venezuela]
"agente de compras en china"
"importar desde yiwu"
"agente yiwu venezuela"
```

### G4 · Carga consolidada (LCL)
```
"carga consolidada china"
[carga consolidada china venezuela]
"consolidar carga desde china"
"envio lcl china venezuela"
"importar sin contenedor completo"
```

### G5 · Contenedor (FCL)
```
"importar contenedor de china"
[importar contenedor de china]
"contenedor completo china venezuela"
"reservar contenedor desde china"
"fcl china venezuela"
```

### G6 · Cotizar / calcular flete (alta intención → /estimacion)
```
"cuanto cuesta importar de china"
[cotizar envio desde china]
"calcular flete desde china"
"cotizar importacion china venezuela"
"precio envio china a venezuela"
```

## 4. Anuncios responsivos (RSA)

> Límites Google: **títulos ≤30 caracteres** (hasta 15), **descripciones ≤90** (hasta 4). Verificá el contador en la UI. Sugerencia: fijá ("pin") el título de marca en Posición 1 solo si querés que aparezca siempre; si no, dejalos sin fijar para que Google optimice.

### Pool de títulos (sirven para todos los grupos — mezclá + agregá el keyword del grupo)
```
Importar de China a Venezuela
Puerta a Puerta desde China
Pagás Cuando Llega (DDP)
18 Años de Experiencia
Ruta Directa desde Yiwu
Bodega Propia en Valencia
Financiamiento 100%
Cotizá Hoy por WhatsApp
Inspección en Fábrica
De China a Tu Puerta
Compra Segura en China
Asesoría Personalizada
Envíos DDP China-Venezuela
Sin Armar Contenedor Completo
China a Venezuela Sin Vueltas
```

### Descripciones (sirven para todos)
```
Traemos tu carga de China a tu puerta en Venezuela. DDP: pagás cuando llega. Cotizá ya.
18 años de experiencia, ruta directa desde Yiwu y bodega propia en Valencia. Escribinos.
Carga consolidada o contenedor completo. Inspección en fábrica y financiamiento 100%.
De Yiwu a tu puerta sin complicaciones. Asesoría por WhatsApp. Pagás cuando recibís.
```

### Títulos específicos por grupo (sumá 2-3 con el keyword del grupo)
- **G1:** `Importar de China Fácil` · `Tu Importación China-Vzla`
- **G2:** `Envío Puerta a Puerta DDP` · `China a Tu Puerta DDP`
- **G3:** `Tu Agente de Carga en China` · `Agente de Compras en Yiwu`
- **G4:** `Carga Consolidada China` · `Importá Sin Contenedor`
- **G5:** `Contenedor desde China` · `FCL China a Venezuela`
- **G6:** `Cotizá tu Envío de China` · `Calculá tu Flete Online`

> Por grupo: armá 1 RSA con ~10-12 títulos del pool + 2-3 títulos específicos + las 4 descripciones. URL final `/estimacion`. (Opcional: un 2º RSA por grupo variando el ángulo.)

## 5. Extensiones (recursos) — ya migradas a dtdcargo.com ✅
Sitelinks activos: **Nuestros Servicios** (`/servicios`) · **Inicio** (`/`) · **Calcula tu metro cúbico** (`/calculadora`). Sumá:
- **Texto destacado:** `Pagás cuando llega` · `18 años de experiencia` · `Ruta directa Yiwu` · `Bodega en Valencia`.
- **Llamada:** `+58 241 414 7886` (Lun-Vie 9-17).
- **Fragmento estructurado** (tipo "Servicios"): Consolidación, Puerta a puerta DDP, Contenedor FCL, Transporte terrestre.

## 6. Disciplina post-lanzamiento (lo que más te costó)
1. **NO pausar la campaña** una vez activa (reinicia el aprendizaje). Si necesitás frenar gasto, bajá el presupuesto, no la pauses.
2. Dejá correr **≥2 semanas** antes de juzgar. El Smart Bidding necesita datos.
3. Revisá **Términos de búsqueda** cada 3-4 días → sumá negativas, no toques pujas a mano.
4. Cuando junte conversiones, pasá a **Maximizar conversiones** (la conversión WhatsApp ya mide).

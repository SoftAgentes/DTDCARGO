# Investigación — Geografía de Venezuela para trazabilidad y cálculo de km
**DTD Cargo · junio 2026 · fuentes 2024–2026**
Síntesis de 4 investigaciones (cifras oficiales DPT, datasets, distancias por carretera, códigos postales).

## 1. Cifras oficiales (lo que el catálogo debe contener)
| Nivel | Cantidad | Detalle |
|---|---|---|
| Entidades federales | 25 con código INE | 01=Distrito Capital · 02–23 estados · 24=La Guaira (ex-Vargas, 2019) · 25=Dependencias Federales |
| Municipios | 335 | Confirmados: municipales 27-jul-2025 eligieron 335 alcaldes |
| Parroquias | ~1.136 | INE; HDX 1.134; IPOSTEL 1.132 — reconciliar al cargar |
| Sector/barrio | Sin fuente oficial | Texto libre + coordenadas |

**Código INE:** 6 dígitos jerárquicos EE+MM+PP (ej. 240101 = La Guaira → Vargas → Caraballeda).
**Guayana Esequiba:** existe solo en derecho venezolano (Gaceta 6.798 Ext., abr-2024; gobernador desde
may-2025) pero SIN municipios/parroquias/código INE; la CIJ reconoce administración de Guyana → NO entra al
catálogo operativo. AVISO LEGAL: la Ley Orgánica 2024 prohíbe publicar mapas de Venezuela SIN el Esequibo —
revisar cualquier mapa de la app/sitio.

## 2. Dataset ganador: OCHA/HDX COD-AB Venezuela (`cod-ab-ven`)
Único con las 3 cosas: jerarquía completa hasta parroquia (25/335/1.134), **P-codes oficiales derivados del
INE** (VE01→VE0101→VE010101), y **polígonos** para centroides; licencia CC-BY-IGO; revisado feb-2024.
URL: https://data.humdata.org/dataset/cod-ab-ven (trae shapefiles + gazetteer XLSX tabular).
Descartados: geoBoundaries y GADM (sin parroquias; GADM prohíbe uso comercial); JSON/SQL de GitHub (viejos
2013–2021, sin códigos, sin licencia, dicen "Vargas"); INE solo publica PDF (ago-2024); OSM parroquias incompletas.

## 3. Cálculo de km (motor del precio fuera de casco)
**Precomputar UNA VEZ** Valencia → ~1.134 centroides de parroquia y guardar en DB (el calculador lee una columna).
Tres formas: (1) Google Routes — 10.000 llamadas Essentials gratis/mes (PERO sus ToS restringen PERSISTIR
resultados → no apto si se guardan en DB); (2) OpenRouteService free — 500 matrices/día, 3.500 elementos/llamada;
(3) **OSRM self-hosted** (recomendado para persistir): extracto Venezuela ~108 MB (Geofabrik), VPS 2 GB, BSD,
`/table` con --max-table-size 1200 = todo en 1 llamada, resultados almacenables (ODbL + atribución OSM).
**Fallback** (sectores nuevos / sin ruta): haversine × factor de circuito ~1.36 (Ballou, Venezuela; calibrar
contra la muestra ruteada y contra las 13 ciudades actuales — si difiere <10%, confiar en OSRM).
Cobrar por **buckets de km** (0–50/51–150/151–300/300+), no km continuo. Amazonas/Delta sin vialidad →
`zona_tarifa` especial (transbordo), no cobrar por km. Centroides: `ST_PointOnSurface` (no `ST_Centroid`).

## 4. Geocodificación del sector (texto libre) — estrategia 2 niveles + pin
1º geocoder OSM (LocationIQ free 5.000 req/día, uso comercial OK con atribución; o Nominatim self-hosted —
el público limita 1 req/s y PROHÍBE autocomplete) restringido por parroquia/municipio →
2º fallback Google Geocoding (10k gratis/mes, $5/1k; única opción probada en last-mile VE: Yummy la usa) →
3º si nada resuelve: centroide de parroquia + pedir al cliente pin GPS o Plus Code (Google Maps es-VE).
SIEMPRE validar point-in-polygon contra la parroquia. Descartados: Pelias/OpenAddresses (cero fuentes VE),
Mapbox (sin rooftop VE), OpenCage (free solo trial).

## 5. Códigos postales IPOSTEL — NO son la clave
~503 códigos de 4 dígitos, granularidad de oficina de entrega, mapeo many-to-many con parroquias; ~75% de la
gente no conoce su CP. → CP queda como campo informativo opcional. Dataset libre derivado del PDF oficial:
github.com/storagebot/zonas-postales-venezuela (CSV 35.086 zonas → 1.132 parroquias, GPL-3.0).
Valida el diseño: parroquia (catálogo oficial) + sector texto libre + punto de referencia + coordenadas.

## 6. Modelo de datos propuesto (Postgres/PostGIS)
```sql
ve_estado(codigo_ine char(2) pk, nombre, iso_3166_2, pcode)            -- '24'='La Guaira' (no 'Vargas')
ve_municipio(codigo_ine char(4) pk, estado_codigo fk, nombre, capital, pcode)
ve_parroquia(codigo_ine char(6) pk, municipio_codigo fk, nombre, pcode,
  codigo_postal nullable, lat, lng, geom geometry(MultiPolygon,4326),
  km_carretera, km_haversine, distancia_metodo check(osrm|haversine_estimada|manual),
  zona_tarifa, fuente default 'COD-AB 2024', activo default true)
ve_sector(id pk, parroquia_codigo fk, nombre, lat, lng,
  geocode_fuente, verificado default false, unique(parroquia_codigo,nombre))
-- ve_locality_catalog queda como vista de compatibilidad
-- índices: GIST sobre geom; pg_trgm sobre nombres para autocompletar con typos
```
Seed: COD-AB HDX (gazetteer XLSX para jerarquía+pcodes; shapefile adm3 para centroides vía PostGIS), validado
contra el PDF INE 2024, CP del parser IPOSTEL, km_carretera precalculado con OSRM.

## 7. Huecos y avisos
1. Conteo parroquias 1.136 (INE) vs 1.134 (HDX) vs 1.132 (IPOSTEL) → reconciliar y documentar.
2. Geometrías COD-AB base INE 2018 (rev. feb-2024) — suficiente para centroides/distancias.
3. Esequibo: sin datos → no incluir como destino; reservar patrón de código; cuidado con mapas (ley 2024).
4. Sectores sin fuente oficial → crowdsourced interno (pin + verificación del operador).
5. OSRM/ORS + OSM (ODbL) es la vía limpia para ALMACENAR km; Google/Mapbox restringen persistir.

## Fuentes
- INE DPT 2024: https://ine.gob.ve/wp-content/uploads/2024/08/DIVISION-POLITICO-TERRITORIAL.pdf
- HDX COD-AB VEN: https://data.humdata.org/dataset/cod-ab-ven
- WFP GeoNode adm3: https://geonode.wfp.org/layers/geonode:ven_admbnda_adm3_20180502
- geoBoundaries: https://www.geoboundaries.org/countryDownloads.html
- Geofabrik VE (OSRM): https://download.geofabrik.de/south-america/venezuela.html
- OSRM: https://github.com/Project-OSRM/osrm-backend
- OpenRouteService: https://openrouteservice.org/restrictions/
- Google Maps precios (mar-2025): https://developers.google.com/maps/billing-and-pricing/march-2025
- LocationIQ: https://locationiq.com/pricing
- Factor de circuito (Ballou): https://www.sciencedirect.com/science/article/abs/pii/S0965856401000441
- IPOSTEL códigos: https://www.ipostel.gob.ve/wp-content/uploads/2023/07/Codigos.pdf
- Parser CP: https://github.com/storagebot/zonas-postales-venezuela
- Ley Guayana Esequiba (G.O. 6.798): https://venezuela.mapbiomas.org/wp-content/uploads/sites/5/2024/09/Gaceta-Oficial-Guayana-Esequiba_2024_go-6798.pdf
- Vargas→La Guaira: https://es.wikipedia.org/wiki/Estado_La_Guaira

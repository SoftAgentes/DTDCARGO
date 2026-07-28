# Redes / Canales sociales — DTD Cargo (bitácora)

Estado y plan de los canales sociales. Parte del tree [Marketing](README.md).
Marca pública = **DTD Cargo**; handle Instagram **@doortudoor_**; canal YouTube **@doortudoor** (ver [`identidad.md`](identidad.md)).

## Estado actual (2026-06-08)

| Canal | Métricas | Estado | Rol |
|---|---|---|---|
| **Instagram `@doortudoor_`** | 5.003 seg · 128 posts · destacados Q&A/Servicios/Visa + reels educativos | 🟢 **El canal fuerte** | **Fuente** de contenido (todo se recicla desde acá) |
| **YouTube `@doortudoor`** | 223 subs · 11 videos (podcast sobre China) | 🔴 Abandonado | **Destino** a reactivar reciclando IG |
| **Google Business (Valencia)** | — | ⏳ por verificar (founder) | Tracción local + reseñas |

> Prioridad 5 del [`plan-accion-digital.md`](plan-accion-digital.md): *"Reactivar YouTube reciclando contenido de Instagram"*. Este documento es el sistema para ejecutarla.

---

## Plan de reciclaje IG → YouTube

### Por qué reciclar (no crear de cero)
- IG ya tiene **inventario probado** (128 posts, reels educativos, audiencia que valida qué tema engancha). YouTube parte de 0 esfuerzo nuevo de producción.
- YouTube es **buscador** (2º del mundo, propiedad de Google): un Short bien titulado se indexa y aparece en búsquedas de "importar de China", suma a la **autoridad de entidad** (mismo `#organization` que el sitio) y vive **años** (IG caduca en horas).
- Cada video puede mandar tráfico a **dtdcargo.com** (descripción + cards) y al **WhatsApp** (conversión ya medida).

### Las 3 corrientes de contenido

| Corriente | Fuente IG | Formato YouTube | Esfuerzo |
|---|---|---|---|
| **A. Shorts educativos** | Reels educativos + Q&A de destacados | **Shorts** (≤60s, vertical, tal cual) | 🟢 Mínimo — re-subir con título/desc SEO |
| **B. Clips del podcast China** | Los 11 videos largos existentes | **Shorts** (cortar momentos de 30-60s) + dejar los largos como están | 🟡 Medio — cortar |
| **C. Carruseles → video** | Carruseles "cómo calcular CBM", incoterms, pasos DDP | **Short** con texto en pantalla o voz en off | 🟡 Medio — re-empaquetar |

**Arrancar por A** (ROI inmediato, casi cero edición). B y C cuando A ya tenga ritmo.

### Pipeline de producción (por pieza)

1. **Seleccionar** — elegir el reel/Q&A de IG con mejor desempeño (guardados/compartidos > likes; los compartidos predicen valor de búsqueda).
2. **Limpiar** — exportar sin la marca de agua de IG (re-subir desde el archivo original; YouTube penaliza watermark de otra plataforma en el feed de Shorts). Sin logos de IG visibles.
3. **Re-titular para búsqueda** — el título IG (casual) ≠ título YouTube (keyword-first). Ver "SEO de YouTube".
4. **Cerrar con CTA** — última frase o texto: *"Calcula tu envío en dtdcargo.com"* o *"Escríbenos por WhatsApp"*. Nunca dejar el video sin salida.
5. **Publicar + enlazar** — descripción con link a la página relevante del sitio + a WhatsApp. Asignar a playlist.

### SEO de YouTube (lo que cambia vs IG)

- **Título (keyword-first, ≤60 car.):** la búsqueda va al frente.
  - ✅ `Cómo calcular el CBM de tu mercancía | Importar de China` 
  - ❌ `Tip del día 🚢 no te pierdas esto`
- **Descripción (primeras 2 líneas = las que cuentan):** keyword natural + link.
  - Línea 1-2: qué resuelve el video + `https://dtdcargo.com/calculadora`
  - Bloque fijo (footer reutilizable): quiénes somos (DTD Cargo, puerta a puerta DDP China→Venezuela, +15 años, ruta Yiwu) + WhatsApp +58 412 166 8021 + sitio.
- **Hashtags** (3-5, en la descripción): `#ImportarDeChina #DDP #Logística #Venezuela #Yiwu`.
- **Playlists** = silos temáticos (espejan el sitio): *Calcular tu envío* · *Incoterms explicados* · *Puerta a puerta DDP* · *China / Yiwu*. Las playlists rankean solas.
- **Handle/branding** uniforme: nombre del canal "DTD Cargo", `@doortudoor`, mismo isologo y banner que la marca (no mezclar logos viejos).

### Mapa título → destino en el sitio (cross-promo)
Cada tema de Short apunta a una página real (refuerza SEO de entidad + manda tráfico):

| Tema del Short | Link en descripción |
|---|---|
| Calcular CBM / volumen | `dtdcargo.com/calculadora` |
| Estimar un envío | `dtdcargo.com/estimacion` |
| Incoterms (CIF, EXW, FOB…) | `dtdcargo.com/glosario` |
| Puerta a puerta DDP | `dtdcargo.com/servicios` |
| Importar a {ciudad} | `dtdcargo.com/importar-de-china/{ciudad}` |
| Tracking de carga | `dtdcargo.com/track` |

### Cadencia sugerida (sostenible, no heroica)
- **Semanas 1-2:** subir **2 Shorts/semana** del backlog A (lo más fácil). Objetivo: re-poblar el canal y reactivar el algoritmo.
- **Semanas 3+:** **2-3 Shorts/semana** mezclando A + B + C. Lote de edición 1 vez/semana (batch).
- **Mensual:** 1 video largo si el podcast de China retoma; si no, los 11 existentes se quedan como catálogo (optimizar sus títulos/descripciones igual).
- **Regla de oro:** constancia > volumen. Mejor 2/semana sostenidos 3 meses que 10 de golpe y abandono.

### Naming / archivo (para no perder el rastro)
- Archivos fuente: `redes/youtube/AAAA-MM-DD-tema-corto.mp4` (kebab-case, sin acentos) — fuera de git si pesan (van a Drive, puntero acá).
- Llevar el backlog en una tabla simple (este doc o una hoja): `tema · fuente IG · estado {pendiente/editado/publicado} · link YT`.

### Métricas (qué mirar, sin obsesionar)
- **YouTube:** vistas + **retención** (los primeros 3s deciden) + clics a links de la descripción.
- **GA4:** tráfico referido `youtube` → conversiones WhatsApp (ya medido en `components/Analytics.tsx`).
- Objetivo de 90 días: **canal vivo** (cadencia estable) + primeras vistas orgánicas de búsqueda, no viralidad.

---

## Reglas que NO se rompen (redes)
1. **Una sola entidad:** nombre de canal = "DTD Cargo", branding del Brand Book vigente (el de mayor versión en `docs/design/studio/_norte/`); YouTube referencia la misma org que el sitio (`#organization`). No re-crear "DoorTuDoor" como marca pública suelta.
2. **Sin watermark de IG** en los Shorts (penaliza distribución).
3. **Todo video con salida:** CTA a dtdcargo.com o WhatsApp `+58 412 166 8021` (canal público primario).
4. **Solo canales públicos al aire:** WhatsApp CRM + Fijo Valencia. No exponer los 6 contactos internos.
5. Identidad/NAP siempre desde [`identidad.md`](identidad.md); razón social/RIF nunca en texto visible.

## Pendiente / próximos pasos
- [ ] **Founder:** confirmar acceso/credenciales del canal YouTube + decidir quién edita (tú / asistente / yo guío).
- [ ] **Claude (cuando haya material):** producir los **copys concretos** de los primeros 6 Shorts del backlog A (títulos + descripciones SEO + CTA) — necesito la lista de reels/Q&A fuente o sus temas.
- [ ] **Founder:** optimizar títulos/descripciones de los **11 videos largos** existentes (quick win SEO sin producir nada nuevo).
- [ ] Verificar Google Business (prioridad 2) para cerrar el triángulo IG + YouTube + GBP local.

> **Dónde están las imágenes:** las carpetas `assets/` y `exports/` de `redes/` no viven
> en git (71 MB de láminas, más fotos del equipo con permisos abiertos). El texto y los
> `.html` fuente sí. Ver [`redes/ASSETS-EN-DRIVE.md`](redes/ASSETS-EN-DRIVE.md).

## Sistema Editorial Técnico · piloto de carrusel (2026-07-22)

Se creó una plantilla maestra de seis láminas para validar el lenguaje de
**infografía editorial técnica minimalista** antes de extenderlo al resto de
las redes. El piloto explica la capacidad operativa de 20GP y 40HQ con esta
secuencia reutilizable: gancho → concepto → comparación → ficha A → ficha B →
decisión y CTA.

- Fuente editable y exportaciones: [`redes/carrusel-maestro-capacidad-operativa/`](redes/carrusel-maestro-capacidad-operativa/README.md).
- Estado: validado técnica y visualmente; aprobado como plantilla maestra.
- Publicación: no realizada.

## Feed de transición · nueve publicaciones (2026-07-22)

Se diseñó una vista previa 3 × 3 para evaluar cómo conviven las nuevas piezas
antes de publicar la primera. La secuencia combina cuatro infografías sobre
papel marfil, tres portadas de reels operativos y dos anclas navy de marca/CTA.

- Fuente editable, orden y exportaciones: [`redes/feed-transicion-9-publicaciones/`](redes/feed-transicion-9-publicaciones/README.md).
- Vista de aprobación: `exports/00-vista-feed-3x3.png` — está fuera de git, ver [`ASSETS-EN-DRIVE.md`](redes/ASSETS-EN-DRIVE.md).
- Estado: V0.1 conservada como biblioteca estructural; no es la dirección maestra.
- Fotografías: conceptuales, no representan al equipo real.
- Publicación: no realizada.

### Variante fotográfica V0.2

Se añadió una segunda cuadrícula utilizando fotografías reales del archivo de
DTD Cargo y las infografías cálidas aprobadas como referencia. El fondo marfil
se formalizó en [`redes/tokens-social.css`](redes/tokens-social.css) como token
exclusivo de redes; todavía no forma parte de la paleta global ni del Brand
Book.

- Vista: [`feed-transicion-9-publicaciones/fotografico-v2/`](redes/feed-transicion-9-publicaciones/fotografico-v2/README.md).
- Estado: **V0.2 aprobada como dirección maestra**; piezas aún no publicadas.
- Gate de producción: la selección V1 sustituye las fotografías históricas
  bloqueadas por seis escenas editoriales generadas; permisos históricos quedan
  fuera del gate del primer lote.
- Publicación: no realizada.
- Decisión: [`DECISION-DIRECCION-MAESTRA.md`](redes/feed-transicion-9-publicaciones/DECISION-DIRECCION-MAESTRA.md).
- Lote de producción: [`LOTE-PRODUCCION-V1.md`](redes/feed-transicion-9-publicaciones/fotografico-v2/LOTE-PRODUCCION-V1.md).
- Permisos e identidad histórica: [`AUDITORIA-PERMISOS-FOTOGRAFIAS.md`](redes/feed-transicion-9-publicaciones/fotografico-v2/AUDITORIA-PERMISOS-FOTOGRAFIAS.md).
- Expediente y solicitudes de autorización: [`permisos/`](redes/feed-transicion-9-publicaciones/fotografico-v2/permisos/README.md).
- Gate prioritario del lote: [`GATE-LOTE-FINAL-01-02-06-07-08.md`](redes/feed-transicion-9-publicaciones/fotografico-v2/permisos/GATE-LOTE-FINAL-01-02-06-07-08.md).
- Copias corregidas de control interno: [`assets/corregidas-v1/`](redes/feed-transicion-9-publicaciones/fotografico-v2/assets/corregidas-v1/README.md).
- Validación de miniaturas: [`VALIDACION-INSTAGRAM.md`](redes/feed-transicion-9-publicaciones/fotografico-v2/VALIDACION-INSTAGRAM.md).

## Ver también
- [`plan-accion-digital.md`](plan-accion-digital.md) — prioridad 5 (origen de este plan) + las otras 4.
- [`identidad.md`](identidad.md) — nombres, handles, NAP, contactos públicos.
- [`seo.md`](seo.md) — el sitio al que apunta el tráfico de YouTube.

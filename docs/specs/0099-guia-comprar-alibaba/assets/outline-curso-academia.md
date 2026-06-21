# Outline del curso → hand-off a la Academia (`feat/academia`, SDD-0093)

> **Esto es DATA, no código.** La ventana `feat/academia` (o coordinación) inserta estas filas en
> `academy_courses` / `academy_modules` / `academy_lessons` (vía el editor del Studio o un seed). **Yo NO
> toco esas tablas ni el portal.** El contenido de cada lección sale del [guion maestro](./guia-comprar-alibaba.md)
> y los [mini-videos](./guion-mini-videos.md).

## Curso (`academy_courses`)
| Campo | Valor |
|---|---|
| `slug` | `comprar-en-alibaba` |
| `title` | Cómo comprar en Alibaba y traerlo a Venezuela |
| `tier` | `gratis` |
| `service_key` | `NULL` (sin precio → siempre accesible; es el lead magnet) |
| `status` | `publicado` (cuando los videos estén grabados) |
| `summary` | Aprende a comprar en Alibaba paso a paso y a enviarlo a la bodega DTD en Yiwu con tu MARKBOX. Gratis. |
| `level` | Principiante |
| `cover_path` | *(subir portada branded)* |

## Lecciones (`academy_lessons`) — 1 por mini-video
> `course_id` y `module_id` los asigna quien cargue. **Todas `free_preview=true`** (curso gratis → acceso
> sin fricción). `video_url` = el embed de YouTube **cuando Sam grabe** cada mini-video. `kind` mayormente
> `video`; la lección ⭐ usa el widget; la del PDF es `descarga`.

| # | Módulo | Lección (`title`) | `kind` | `widget` | `video_url` | `asset_path` |
|---|---|---|---|---|---|---|
| 0 | 1 · Empieza sin miedo | Respira: comprar en China es seguro | `video` | — | mini-video 0 | — |
| 1 | 1 · Empieza sin miedo | Crea tu cuenta (y saca tu MARKBOX) | `video` | — | mini-video 1 | — |
| 2 | 2 · Encuentra y verifica | Busca tu producto como pro | `video` | — | mini-video 2 | — |
| 3 | 2 · Encuentra y verifica | Proveedor confiable vs estafa | `video` | — | mini-video 3 | — |
| 4 | 2 · Encuentra y verifica | ¿Fabricante o intermediario? | `video` | — | mini-video 4 | — |
| 5 | 3 · Negocia, prueba y paga | El correo paso a paso (plantilla) | `video` | — | mini-video 5 | — |
| 6 | 3 · Negocia, prueba y paga | Pide muestra antes de pedir mucho | `video` | — | mini-video 6 | — |
| 7 | 3 · Negocia, prueba y paga | Paga seguro (y nunca por fuera) | `video` | — | mini-video 7 | — |
| 8 | 4 · De China a tu puerta | ⭐ Tu dirección = nuestra bodega Yiwu | `video` + **herramienta** | **`alibaba_address`** | mini-video 8 | — |
| 9 | 4 · De China a tu puerta | De China a tu puerta + cierre | `video` | — | mini-video 9 | — |
| 10 | 4 · De China a tu puerta | 📄 Descarga: guía completa en PDF | `descarga` | — | — | **`guia-comprar-alibaba.pdf`** (subir a Storage) |

## Qué tiene que hacer `feat/academia` / coordinación
1. Insertar el curso + 4 módulos + 11 lecciones (tabla de arriba) — editor del Studio o seed.
2. **Lección 8:** setear `widget='alibaba_address'` → reusa el componente `AlibabaAddressGuide` ya embebido.
3. **Lección 10:** subir `guia-comprar-alibaba.pdf` a Supabase Storage y poner su path en `asset_path`.
   *(Nota: el portal hoy renderiza `video_url` (iframe); si el botón de descarga del `asset_path` aún no
   está en el reproductor, lo agrega la ventana de academia.)*
4. Poner `video_url` (YouTube) en cada lección **cuando Sam grabe** los mini-videos.
5. Publicar (`status='publicado'`) — `tier='gratis'`, todas `free_preview=true`.

## Funnel
- Cada lección/cierre jala a **registro (MARKBOX)** + **teaser a cursos avanzados (pagos)** de la Academia.
- Curso gratis = imán de leads; el avanzado (FCL, 1688, negociación pro) es el upsell.

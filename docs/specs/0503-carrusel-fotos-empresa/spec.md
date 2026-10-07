---
sdd: "0503"
title: "Carrusel de fotos de la empresa en la web pública"
status: in-progress
author: "Codex Director"
created: 2026-10-07
updated: 2026-10-07
supersedes: null
superseded_by: null
related: ["0001"]
confidencialidad: interno
---

# SDD-0503 — Carrusel de fotos de la empresa

## Objetivo y decisión de Sam

Actualizar las fotos de la web dtdcargo.com mediante un carrusel en la sección de fotos de la empresa. Sam suministró ocho archivos y el 2026-10-07 eligió «En la sección de fotos de la empresa (recomendado)» al comparar galería, portada y ambos lugares. La portada se conserva fija.

Este documento define el encargo; no afirma implementación, PR, integración ni despliegue. El orden de las fotos, el copy y la interacción manual son decisiones propuestas por Director dentro del alcance, ajustables durante revisión visual.

## Evidencia verificada el 2026-10-07

- La home pública incluye `OperationGallery` (`app/page.tsx:391`).
- `components/OperationGallery.tsx:70` contiene la sección `#operacion`, el video principal, dos fotos estáticas (`PHOTOS`) y dos clips (`CLIPS`). Las fotos actuales aparecen en el grid de `components/OperationGallery.tsx:105`.
- El título y el párrafo actuales atribuyen toda la sección a Yiwu. Las imágenes suministradas combinan oficina, puerto, contenedor, bodega y camión; sus lugares exactos no se deducen de la imagen.
- La lectura pública de https://dtdcargo.com confirmó la sección «Operación real · Yiwu». La lectura de código y la web coinciden en esa estructura; esto no prueba el SHA desplegado.
- Base local tras fetch sin prune: `origin/main` = `675aac534b62862a979e97b07351ef79961c5af5`.
- Consulta de PR abiertas por rutas del alcance: sin coincidencias devueltas. Revalidar antes de iniciar y de integrar; no se infiere ausencia de trabajo sin publicar.
- Graphify identificó `OperationGallery()` y `HomePage()` con sus fuentes. La consulta amplia estaba truncada y solo se usa como orientación, contrastada con código leído.

## Alcance

Reemplazar únicamente el grid de dos fotos de `#operacion` por un carrusel con las ocho imágenes aportadas. Conservar el video principal, sus datos estructurados `VideoObject` y los dos clips. Conservar la portada, la otra foto de `app/page.tsx`, las demás páginas, tarifas, calculadoras, formularios y analítica.

Copy propuesto para el encabezado de la sección:

- Eyebrow: «Nuestro equipo y operación».
- Título: «Conoce el trabajo detrás de tu envío.»
- Párrafo: «Personas, atención y manejo de mercancía en las distintas etapas de nuestro servicio.»

Las leyendas del video y de los clips conservan el contexto propio de Yiwu. Los captions del carrusel describen lo visible; no asignan ciudades, fechas, identidades, propiedad de instalaciones ni promesas comerciales sin fuente.

## Fotos, orden propuesto y procedencia

Origen de lectura: `C:/Users/AKX generator/Documents/USB/DTD_Cargo_FotosWeb/`.
Los originales permanecen allí y no se modifican. Crear solamente derivados web revisados; no agregar a Git los PNG originales grandes ni metadatos personales.

| Orden | Original aportado | Dimensiones | Peso original | Derivado permitido en public/fotos/ | Caption propuesto |
|---|---|---|---|---|---|
| 1 | DTD_Cargo_Mapa.png | 2720 × 1536 | 7.19 MB | dtd-cargo-atencion-mapa.webp | Atención y planificación |
| 2 | DTD_Cargo_Oficina1.png | 1024 × 1024 | 1.19 MB | dtd-cargo-equipo-oficina.webp | Nuestro equipo de atención |
| 3 | DTDCargo_Recibiendo_contendor (3).png | 830 × 632 | 0.61 MB | dtd-cargo-equipo-contenedor.webp | Preparación del contenedor |
| 4 | DTD_Cargo_Contenedor conta llenado.png | 756 × 767 | 1.07 MB | dtd-cargo-carga-consolidada.webp | Mercancía preparada para embarque |
| 5 | DTDCargo_Puerto.jpg | 832 × 1248 | 0.17 MB | dtd-cargo-operacion-puerto.webp | Manejo de carga en el puerto |
| 6 | DTD_Cargo_Recibiendo_Contenedor.jpg | 896 × 1184 | 0.22 MB | dtd-cargo-recepcion-contenedor.webp | Recepción de un contenedor |
| 7 | Descargando_Door_to_door_DTD_Cargo.png | 2688 × 1520 | 5.88 MB | dtd-cargo-descarga-bodega.webp | Descarga de mercancía en bodega |
| 8 | Logos oficiales en camión DTDC (1).png | 1024 × 1024 | 1.65 MB | dtd-cargo-camion-entrega.webp | Carga en un camión DTD Cargo |

Nombres heredados y logos fotografiados forman parte del original; no recrear ni retocar identidades. Los ocho archivos fueron localizados y sus dimensiones medidas. La autoría, lugar y fecha de cada toma no se verificaron independientemente.

## Interacción y presentación

1. Una foto grande a la vez con leyenda fuera de la imagen, contador «1 de 8», botones anterior/siguiente y miniaturas seleccionables.
2. Navegación manual por defecto. Sin reproducción automática ni temporizadores; Sam no pidió avance automático.
3. Permitir deslizar en móvil conservando el scroll vertical. Interacción equivalente con teclado; botones accesibles con nombre y foco visible.
4. Mantener foco en el control utilizado, anunciar cambios manuales de forma moderada y no crear una trampa de teclado.
5. Controles de al menos 44 × 44 px; las miniaturas tienen nombre accesible y comunican la selección por algo más que color.
6. Marco de altura estable, adaptable a la pantalla. Preservar proporciones: las fotos verticales/cuadradas se muestran completas sobre un fondo del sistema; no cortar rostros, manos, logos ni el centro de la escena para llenar un marco horizontal.
7. Ningún texto encima de la foto. Mantener navy, vino, fuentes, radios y espaciados existentes del sitio según BRAND.md y Norte vigente.
8. Respetar prefers-reduced-motion. La navegación sigue funcionando sin animación.
9. La foto y leyenda iniciales deben ser visibles mediante render del servidor; sin JavaScript queda contenido útil de la galería.

## Rendimiento y tratamiento de imágenes

- Usar next/image, dimensiones o marco reservado y sizes acordes al ancho real; sin saltos de altura al cargar o cambiar.
- WebP sin ampliar por encima de la resolución original. Usar compresión apropiada y registrar el peso resultante; objetivo orientativo de hasta 300 KB por foto sin deterioro visible. Si una imagen exige más, documentar el peso y la razón.
- Cargar de forma diferida lo que queda fuera de pantalla y usar miniaturas pequeñas; no precargar ocho originales ni ocho imágenes grandes.
- Esta tarea no necesita Supabase, storage remoto, API, migraciones, plugins ni una nueva dependencia de carrusel.
- Antes de copiar derivados, aplicar la lectura de `.claude/skills/revisar-datos-ve/SKILL.md` al alcance fotográfico. Revisar rostros, documentos, pantallas, etiquetas, placas y EXIF. Nunca agregar contenido identificatorio legible de terceros ni datos contractuales/financieros a Git. Si una foto expone ese contenido, sustituirla o preparar una versión sanitizada por un flujo autorizado y conservar trazabilidad. No identificar personas ni extraer esos datos.

## Allowlist exacta del Worker

- `components/OperationGallery.tsx`
- `components/CompanyPhotoCarousel.tsx` (nuevo, componente client aislado)
- `components/CompanyPhotoCarousel.test.tsx` (solo si se necesita validar comportamiento)
- `e2e/company-photo-carousel.spec.ts` (pruebas de interacción de la home)
- Los ocho derivados WebP indicados en la tabla bajo `public/fotos/`.
- `docs/specs/0503-carrusel-fotos-empresa/spec.md`
- `docs/specs/0503-carrusel-fotos-empresa/qa.md`
- `docs/specs/README.md` (generado con docs:index)
- `docs/marketing/README.md` (enlace/estado del material web, sin reescribir otros frentes)
- `.agents/handoffs/2026-10-07-carrusel-fotos-empresa.md`

Resolver los estilos dentro del componente con utilidades/tokens existentes. No modificar app/page.tsx ni globals.css por conveniencia; si aparece una necesidad real fuera de allowlist, documentarla para Director antes de ampliar.

## Aceptación y validación

- PASÓ/FALLÓ por verificación: ocho fotos correctas, orden/captions, anterior/siguiente, miniaturas, swipe, teclado, foco, contador, ausencia de autoplay, ausencia de saltos de altura y foto inicial sin JS.
- Capturas de home en 390 px y 1440 px: fotos verticales completas, controles usables, sin scroll horizontal y con texto legible.
- Comprobar que el video/los clips y sus datos estructurados se conservan; portada y resto de la home sin cambios inesperados.
- Revisión de privacidad de los derivados y prueba de EXIF ausente, sin imprimir metadatos sensibles.
- Revisión /ui-check antes del commit de UI sustancial, usando la instrucción real del repositorio.
- Pruebas de comportamiento proporcionales: seleccionar otra foto por controles y teclado, límites/recorrido, contador/caption y navegación móvil. No tests que solo comparen el texto del código fuente.
- pnpm verify como cierre canónico del producto, incluida build; registrar cada omisión como NO EJECUTADO o NO DISPONIBLE. No leer datos de producción ni aplicar migraciones para pasar checks.
- pnpm docs:check, pnpm sdd:check y git diff --check; la evidencia identifica rama y SHA.
- Impacto documental en marketing y handoff. Graphify estructura y cobertura semántica, Archify y preview Obsidian se reportan por separado; publicar a la bóveda habitual corresponde al Director tras integración autorizada.

## Estado y autorizaciones

Preparación Director: especificación y asignación en rama aislada. Implementación, validación funcional, PR, integración y producción pendientes.

Worker autorizado a implementar, probar y crear commits locales en esta tarea. Este intercambio todavía no autoriza push/PR, merge ni despliegue; preparar una entrega revisable y conservar esas fronteras. No hay cambios de DB dentro del encargo.

## Implementación Worker · 2026-10-07

Carrusel manual implementado en CompanyPhotoCarousel e integrado exclusivamente en OperationGallery. Marco cuadrado móvil y 16:9 desde sm; object-contain preserva todas las proporciones. Teclado: flechas, Home y End; gestos horizontales con umbral 48 px y predominio sobre desplazamiento vertical. Sin animación ni temporizadores: reduced-motion no requiere rama adicional. Foto inicial SSR; sólo una imagen grande montada y miniaturas next/image diferidas. Pantallas, documentos, ID de contenedor y placas visibles se redactaron en los derivados; originales intactos. Validaciones y límites se registran en [QA](qa.md).

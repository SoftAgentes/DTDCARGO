# Feed de transición · 9 publicaciones

Vista previa interna para validar la transición del Instagram de DTD Cargo al
Sistema Editorial Técnico antes de publicar la primera pieza.

## Estado

- **Versión:** 0.1.
- **Fecha:** 2026-07-22.
- **Estado editorial:** V0.2 aprobada como dirección maestra; piezas no publicadas.
- **Formato maestro:** 1080 × 1350 px (4:5).
- **Vista del perfil:** recorte 3:4, en el orden visual real de Instagram.

## Concepto visual

La serie alterna tres familias para evitar que el feed se vuelva monótono sin
perder unidad:

| Familia | Cantidad | Función |
|---|---:|---|
| Editorial sobre papel marfil | 4 | Explicar conceptos, comparaciones y datos. |
| Operación fotográfica | 3 | Mostrar personas, procesos y evidencia operativa. |
| Ancla navy | 2 | Abrir la nueva etapa y cerrar con conversión. |

Paleta: navy, vino, blanco, papel marfil y gris cálido. Tipografías: Archivo
Black, Archivo y JetBrains Mono. No se usa turquesa, patrón oriental decorativo,
glassmorphism ni gradientes de color.

## Orden de publicación

Instagram coloca la publicación más reciente arriba a la izquierda. Por eso las
piezas se publican de `01` a `09`, mientras la vista final se lee `09` a `01`:

1. **Importar de China sin improvisar** — ancla de marca.
2. **Antes de pagar a tu proveedor** — portada de reel operativa.
3. **¿Qué significa 1 CBM?** — concepto editorial.
4. **20GP vs 40HQ** — comparación de capacidad interior.
5. **Inspeccionamos antes de embarcar** — portada de reel operativa.
6. **3 datos para calcular tu carga** — checklist editorial.
7. **LCL o FCL: ¿qué cambia?** — comparación editorial.
8. **Shipping Mark: así identificamos tu carga** — portada de reel operativa.
9. **Calcula tu envío** — ancla de conversión.

## Archivos

- [`feed.html`](feed.html): fuente editable de las nueve publicaciones.
- [`overview.html`](overview.html): tablero 3 × 3 con el orden real del perfil.
- [`exports/00-vista-feed-3x3.png`](exports/00-vista-feed-3x3.png): vista de aprobación.
- [`exports/`](exports/): nueve PNG individuales listos para revisión.
- [`PROMPTS.md`](PROMPTS.md): prompts de las fotografías conceptuales.
- [`assets/`](assets/): imágenes de apoyo usadas en la maqueta.

## Variante fotográfica V0.2

Después de revisar el archivo fotográfico real de DTD Cargo se preparó una
segunda propuesta con un fondo marfil más cálido (`#FBF2E9`) y mayor presencia
humana y operativa:

- [Documentación de la propuesta V0.2](fotografico-v2/README.md).
- [Vista 3 × 3 fotográfica](fotografico-v2/exports/00-vista-feed-fotografico.png).

La V0.1 permanece intacta como biblioteca estructural para piezas de datos
puros. La decisión y sus límites están registrados en
[`DECISION-DIRECCION-MAESTRA.md`](DECISION-DIRECCION-MAESTRA.md).

## Condiciones antes de publicar

1. Aprobar primero la cuadrícula completa; no aprobar piezas aisladas.
2. Validar cada texto, dato operativo y CTA con el responsable del contenido.
3. Sustituir las tres fotografías conceptuales por material real del equipo si
   existe una toma equivalente. Nunca presentar personas generadas como parte
   del equipo de DTD Cargo.
4. Preparar el contenido interior de los reels 02, 05 y 08. Esta entrega valida
   sus portadas, no produce todavía los videos.
5. Mantener el orden `01 → 09` para conservar el ritmo de la cuadrícula.

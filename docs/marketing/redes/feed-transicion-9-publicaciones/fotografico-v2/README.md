# Feed editorial fotográfico · lote V1

Segunda vista previa interna del feed de DTD Cargo. Combina fotografías reales
del archivo del equipo con las infografías técnicas cálidas seleccionadas por el
founder.

## Estado

- **Versión:** V1.
- **Fecha:** 2026-07-22.
- **Estado:** dirección maestra aprobada; piezas no publicadas.
- **Gate vigente:** lote renderizado y validado localmente; falta aprobación
  expresa de la cuadrícula antes de publicar.
- **Formato maestro:** 1080 × 1350 px (4:5).
- **Vista del perfil:** recorte 3:4.
- **Método:** composición determinística en HTML/CSS; el lote V1 combina tres
  infografías aprobadas con seis fotografías editoriales generadas.

## Dirección visual

Nombre del sistema:

> **Sistema editorial técnico-documental con infografía fotográfica.**

El fondo cálido fue muestreado de `DTD_Cargo_CBM10.png` y quedó formalizado en
[`../../tokens-social.css`](../../tokens-social.css) como excepción exclusiva de
redes:

- Marfil principal: `#FBF2E9`.
- Borde cálido: `#F7ECE3`.
- Navy y vino: colores oficiales de DTD Cargo.
- Textura: grano monocromático muy suave, sin patrones decorativos.

La cuadrícula se divide en:

- 3 infografías técnicas: publicaciones 03, 05 y 09.
- 4 escenas operativas: publicaciones 04, 06, 07 y 08.
- 2 piezas humanas/editoriales: publicaciones 01 y 02.

## Orden y fuentes

| Orden | Título | Archivo utilizado |
|---:|---|---|
| 01 | Cada caja empieza con una decisión | `assets/generadas-v1/01-decision-medicion-generada.jpg` |
| 02 | Coordinamos desde China | `assets/generadas-v1/02-coordinacion-china-generada.jpg` |
| 03 | 10 CBM | `DTD_Cargo_CBM10.png` |
| 04 | Cada caja necesita identidad | `assets/generadas-v1/04-cajas-shipping-mark-generada.jpg` |
| 05 | Capacidad operativa 20GP · 40HQ | `DTD_Cargo_CBM_2Contener.png` |
| 06 | Así recibimos tu contenedor | `assets/generadas-v1/06-contenedor-recibido-generada.jpg` |
| 07 | Coordinación que sí responde | `assets/generadas-v1/07-coordinacion-humana-generada.jpg` |
| 08 | Del puerto a tu puerta | `assets/generadas-v1/08-puerto-puerta-generada.jpg` |
| 09 | 40HQ en escala real | `DTD_CARGO_CBM68_Contener.png` |

Los originales permanecen intactos en `C:\Users\Trabajo\Desktop\DTD_Cargo_FotosWeb`.
Las copias de maqueta se optimizaron sólo para renderizar la vista previa.

## Archivos

- [`feed.html`](feed.html): fuente editable de las nueve publicaciones.
- [`overview.html`](overview.html): tablero con el orden final del perfil.
- [`../../tokens-social.css`](../../tokens-social.css): tokens marfil limitados a
  la superficie editorial social.
- [`exports/00-vista-feed-fotografico.png`](exports/00-vista-feed-fotografico.png): vista principal de aprobación.
- [`exports/`](exports/): publicaciones individuales.
- [`AUDITORIA-PERMISOS-FOTOGRAFIAS.md`](AUDITORIA-PERMISOS-FOTOGRAFIAS.md):
  gate de personas, licencias, logos, URLs y uniformes.
- [`permisos/`](permisos/README.md): expediente operativo, hashes, registro de
  soportes y borrador de autorización para revisión legal.
- [`VALIDACION-INSTAGRAM.md`](VALIDACION-INSTAGRAM.md): revisión individual de
  las nueve miniaturas en recorte de perfil.
- [`FIGMA-HANDOFF.md`](FIGMA-HANDOFF.md): comparación montada en Figma con
  variables sociales, decisión y gates de publicación.
- [`assets/corregidas-v1/`](assets/corregidas-v1/README.md): copias de retoque
  no destructivas con identidad actual y datos sensibles neutralizados.
- [`assets/generadas-v1/`](assets/generadas-v1/README.md): seis fotografías
  editoriales controladas para el primer lote.
- [`LOTE-PRODUCCION-V1.md`](LOTE-PRODUCCION-V1.md): selección final y gates de
  producción del lote.

## Antes de publicar

1. Aprobar la cuadrícula V1 y las nueve piezas.
2. Autorizar expresamente la publicación de la pieza 01.
3. Mantener el orden `01 → 09` para reproducir exactamente la cuadrícula.
4. Validar el recorte y la compresión reales después de publicar la primera pieza.

Las fotografías históricas auditadas quedan reservadas para una campaña
documental futura. Su expediente de permisos continúa abierto, pero ya no
bloquea el lote V1.

## Decisión

La V0.2 fue aprobada como dirección maestra el 2026-07-22. La aprobación cubre
el sistema visual; no equivale a autorizar la publicación de las nueve piezas.
Ver [`../DECISION-DIRECCION-MAESTRA.md`](../DECISION-DIRECCION-MAESTRA.md).

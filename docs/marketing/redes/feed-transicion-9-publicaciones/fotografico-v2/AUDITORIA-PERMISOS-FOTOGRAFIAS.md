# Auditoría de permisos e identidad visual · V0.2

**Fecha:** 2026-07-22  
**Alcance:** las nueve fuentes usadas por la vista previa fotográfica.  
**Resultado:** ningún archivo está autorizado para publicación únicamente por
haber sido entregado o estar en la carpeta de trabajo.

## Evidencia revisada

- Se inspeccionó `C:\Users\Trabajo\Desktop\DTD_Cargo_FotosWeb` buscando
  archivos cuyo nombre incluyera permiso, cesión, consentimiento, autorización,
  derechos, licencia, contrato, modelo o release.
- El 2026-07-23 se amplió la búsqueda a las carpetas documentales DTD Cargo,
  Documentos y Descargas. No se encontró ningún documento de cesión o
  autorización fotográfica. Una carta de autorización de WeChat localizada
  tiene un objeto distinto y no cubre estas imágenes.
- Se calcularon hashes SHA-256 y se revisaron metadatos EXIF/XMP. La publicación
  01 conserva origen de cámara/Lightroom; 02 y 07 declaran `Made with Google
  AI`; 04 declara contenido con IA y procedencia Canva. Las demás fuentes no
  conservan procedencia verificable en sus metadatos.
- Se compararon logos, URLs, uniformes, credenciales y datos visibles con la
  identidad vigente de DTD Cargo.
- Esta revisión es un control editorial interno; no reemplaza una revisión
  legal ni prueba que una autorización no exista en otro sistema.

## Semáforo

- **Bloqueada:** no publicar hasta resolver permiso o identidad histórica.
- **Condicional:** puede avanzar cuando se documente procedencia/licencia y se
  limpie cualquier dato de terceros.
- **Apta:** no se detectó bloqueo dentro del alcance revisado.

## Revisión por publicación

| Nº | Fuente | Personas / derechos | Logos, URLs o datos visibles | Estado y requisito |
|---:|---|---|---|---|
| 01 | `_MG_2881.png` | Una persona identificable. No hay cesión localizada. | Gorra y uniforme con identidad anterior. | **Bloqueada.** Obtener autorización de imagen y sustituir o recortar la marca histórica. |
| 02 | `davinci___img1_ok__esta_imagen_quiero_que_la_analices_y_ve.png` | Cinco personas identificables; varias credenciales de feria. | Uniformes DoorTuDoor anteriores; credenciales y elementos del evento. | **Bloqueada.** Autorizaciones individuales, ocultar datos de credenciales y actualizar branding. |
| 03 | `DTD_Cargo_CBM10.png` | Figura humana cuyo origen real o sintético no está documentado. | Isologo/wordmark de la maqueta. | **Condicional.** Registrar procedencia, licencia o generación y confirmar uso del modelo visual. |
| 04 | `DTD_Cargo_Recibiendo_Tu_Caja.png` | No aparecen personas. | Cintas DTD Cargo, caracteres y marcas/etiquetas de terceros potencialmente legibles. | **Condicional.** Confirmar autoría de la foto y ocultar SKU, guías o marcas de terceros si identifican una operación. |
| 05 | `DTD_Cargo_CBM_2Contener.png` | Figura humana cuyo origen real o sintético no está documentado. | Logos aplicados a contenedores de maqueta. | **Condicional.** Registrar procedencia/licencia y conservarla marcada internamente como imagen compuesta si aplica. |
| 06 | `DTD_Cargo_Recibiendo_Contenedor.jpg` | Dos trabajadores reconocibles por contexto, de espalda. No hay autorización localizada. | Camisetas con logo anterior, código QR y URL `doortudoor.com` visibles. | **Bloqueada.** Permiso laboral/editorial y retoque obligatorio de QR, URL y uniforme. |
| 07 | `DTD_Cargo_Oficina1.png` | Cuatro personas identificables. No hay cesiones localizadas. | Uniformes anteriores; pantallas y documentos de oficina potencialmente sensibles. | **Bloqueada.** Autorizaciones, limpieza de pantallas/documentos y actualización de uniformes. |
| 08 | `DTDCargo_Puerto.jpg` | Personal operativo visible; algunos rostros/contextos pueden ser identificables. | Chalecos con identidad anterior y elementos operativos de puerto. | **Bloqueada.** Confirmar permiso del fotógrafo, del personal y del recinto; actualizar los chalecos. |
| 09 | `DTD_CARGO_CBM68_Contener.png` | Figura humana cuyo origen real o sintético no está documentado. | Logo aplicado a contenedor y cajas de maqueta. | **Condicional.** Registrar procedencia/licencia y confirmar que el arte de marca es el vigente. |

## Decisión editorial

No hay piezas **aptas** todavía. Las publicaciones 01, 02, 06, 07 y 08 quedan
detenidas por personas reales y/o branding anterior. Las 03, 04, 05 y 09 pueden
pasar a producción gráfica, pero no a publicación, hasta cerrar procedencia y
limpieza de datos.

## Correcciones preparadas · 2026-07-23

Se generaron copias no destructivas para 02, 06, 07 y 08 con el isólogo oficial,
credenciales/pantallas neutralizadas y QR/URL retirados donde correspondía. Son
candidatas de retoque, no permisos de publicación. La 04 quedó como borrador
porque parte del wordmark de la cinta no se reprodujo con exactitud. La 01
requiere edición manual no generativa.

Inventario y hashes:
[`assets/corregidas-v1/`](assets/corregidas-v1/README.md).

## Registro mínimo que falta

Para cada fuente se debe conservar: propietario, fotógrafo o herramienta de
generación, fecha, alcance territorial, plataformas autorizadas, vigencia,
personas cubiertas, restricciones de edición y enlace al documento de soporte.

El expediente operativo, los hashes y el borrador de autorización viven en
[`permisos/`](permisos/README.md). Los soportes firmados deben permanecer fuera
de Git, en el archivo legal privado.

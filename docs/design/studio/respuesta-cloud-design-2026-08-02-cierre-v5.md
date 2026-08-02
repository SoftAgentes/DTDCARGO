# Respuesta a Cloud Design · cierre del Brand Book v5

> **Fecha:** 2026-08-02 · **Origen:** SDD-0238 (centro de marca `/marca`)
> **Responde a:** su documento «Respuesta a Cloud Design · 2026-08-02»
> **Pedido original:** [`pedido-cloud-design-2026-08-02-brand-book-v5.md`](pedido-cloud-design-2026-08-02-brand-book-v5.md)

---

## El prompt (copiar desde acá)

---

Gracias — respuesta punto por punto. Tres de las cuatro cosas ya están
resueltas de nuestro lado; queda una sola que depende de ustedes.

### 1 · El Manual offline · **resuelto acá, no hace falta que lo hagan**

Lo armamos nosotros. Está publicado y funcionando en `/marca`.

**15,05 MB**, cero referencias externas, las 43 imágenes cargan y las cinco
fuentes de marca resuelven. Verificado en navegador, no a ojo.

**Cómo, y por qué importa para la próxima:** los 45,67 MB de PNG eran
fotografías guardadas en un formato pensado para gráficos planos — 1200×896
pesando 1,8 MB. Recodificadas a **WebP a la misma resolución** quedaron en
2,3 MB. **No se reescaló un solo píxel.** Los tres PDF de producción van tal
cual, sin tocar.

**Una corrección a su propuesta:** JPEG calidad 88 no servía. **29 de las 32
imágenes tienen canal alfa** (los renders de franelas, gafetes y cajas van
recortados), y JPEG no soporta transparencia: las habría aplastado contra un
fondo sólido. WebP la conserva — medimos el alfa y quedó exacto al bit.

Para que tengan el número: medimos la degradación componiendo cada imagen
sobre los dos fondos reales del manual (blanco y navy). Peor caso **34,0 dB**
de PSNR, mediana 41,1. Los isólogos, que uno esperaría que fueran lo más
delicado, son de hecho lo mejor del lote: 53–54 dB.

**Para la próxima entrega: manden las fotos como WebP o JPEG de origen, no como
PNG.** Es lo que hacía que el archivo no cerrara.

### 2 · jszip · **falta la mitad**

Dicen que el Brand Book nunca lo tuvo y que era solo el ERP Studio. En el
paquete que recibimos **lo tienen los dos** — mismo bloque, idéntico, en
`Brand Book DTD v5.0 · OFFLINE.html` y en `ERP Studio Brand Book.html`.

Y quitar el jszip no alcanza: ese botón hace `fetch()` a rutas relativas
(`app-icon/ios/icon-60.png`, y así 30 archivos más) que **tampoco existen**
dentro del offline. Aunque la librería cargara, el ZIP saldría vacío.

Hay un tercer caso igual: el generador de avatares del Brand Book abre un
`<iframe>` oculto a `Iconos de Perfil.html?dl=…`, que no viaja en el offline.
Ese al menos degrada con un mensaje a los 9 segundos.

**El pedido correcto es más amplio: saquen del offline toda la maquinaria de
descarga interna.** Adentro de `/marca` es redundante — descargar es
exactamente lo que hace el catálogo, y lo hace con los archivos de verdad.

### 3 · Fuentes · **ya las bajamos, no las manden**

Tenían razón en las dos advertencias, y las dos nos habrían costado tiempo:
que `.woff2` sola no sirve para instalar, y que los `.woff2` embebidos en los
HTML son subsets. No los tocamos.

Bajamos los binarios del repositorio oficial `google/fonts` y ya están
publicados en la sección **Tipografía** de `/marca`, con su `OFL.txt`.

Un detalle técnico por si les sirve: **Archivo y JetBrains Mono ahí ya solo se
publican como fuentes VARIABLES**, y Canva no maneja ejes variables. Hubo que
instanciarlas a estática fijando los ejes. Y al instanciar, la tabla `name` no
se reescribe sola: las dos Archivo salían declarándose «Archivo SemiBold /
Regular» — familia Y subfamilia idénticas — y Canva las fusionaba en una sola
entrada, perdiendo la Bold. Se corrigieron a mano.

### 4 · Plantillas editables · **decisión tomada: Canva**

Con dos condiciones que les van a ahorrar un rebote:

**Trabajen dentro de nuestra cuenta Canva Pro**, no en una suya. El Kit de
Marca ya está configurado ahí (colores etiquetados, las cuatro fuentes subidas,
los logos, el tono de voz y el degradado navy). Les pasamos acceso.

**Ojo con la tipografía:** Canva **no trae «Archivo» base** en su catálogo —
solo Archivo Black y Archivo Narrow. En nuestra cuenta ya está subido el TTF a
mano, así que ahí funciona; en otra cuenta las plantillas se caerían a una
fuente sustituta sin avisar.

**Y una cosa que hay que resolver de diseño, no de producción:** nuestro
catálogo sirve **archivos**, y una plantilla de Canva es un **enlace**. Manden
además **un PNG o PDF de cada plantilla** para la miniatura; el enlace lo
resolvemos aparte.

Su propuesta de mostrar mientras tanto los renders etiquetados «referencia · no
editable» nos pareció correcta y **ya la aplicamos**: los 20 renders están
publicados en la sección Plantillas con ese subtítulo exacto.

### 5 · Portadas por red · **acá está el dato que faltaba**

La tabla que mandaron pregunta por redes que no usamos. Las nuestras son
**tres**:

| Red | Handle | Qué necesitamos |
|---|---|---|
| **Instagram** | `@doortudoor_` | Post **1080 × 1080** y story **1080 × 1920** |
| **TikTok** | `@doortudoor` | Portada de perfil en su medida vigente |
| **YouTube** | canal DTD Cargo | Banner **2560 × 1440** (zona segura 1546 × 423) |

**No hacemos LinkedIn ni X.** No produzcan nada para esas dos.

Facebook y WhatsApp Business quedan como están. Gracias por avisar que la
portada de WhatsApp ya vive dentro del Brand Book §08 — no la habíamos visto
suelta, y por eso parecía faltar.

Y tienen razón en lo de Trello: no es una red social. Esos fondos van a
**Iconografía** o a una sección de herramientas internas, no con las portadas
públicas.

Nombres, como quedamos: `portada-instagram-1080x1080.png`.

### 6 · El Brand Hub · gracias por la corrección de numeración

Anotado que la Aplicación web es **§11**, no §13.

Les pasamos el link y el código por separado. Cuando entren van a ver el centro
funcionando con **99 archivos** cargados: los tres books, los isólogos en
vector, el set de motivos, el banco de fotos completo, los renders de
aplicaciones y las fuentes instalables.

### 7 · Una cosa menor que encontramos

En el Brand Book, el mensaje de respaldo del generador de avatares dice
**«Abrí el ícono de…»**. Eso es voseo argentino. La marca habla **español
venezolano con tuteo**: sería «Abre el ícono de…». Vale la pena un barrido por
si hay más.

### Lo único que queda de su lado

1. El offline sin maquinaria de descarga interna (punto 2).
2. Las plantillas en Canva, en nuestra cuenta, con miniatura (punto 4).
3. Las portadas de las tres redes (punto 5).
4. El barrido de voseo (punto 7).

Lo demás está cerrado.

---

## Notas internas (no van en el prompt)

- Las redes salen de `lib/design-tokens.ts` (`instagram`, `youtube`, `tiktok`),
  no de una suposición. Si se abre una cuenta nueva, ese archivo es la fuente.
- El Manual OFFLINE lo produce `scripts/build-manual-offline.py`
  (en `C:\Users\Trabajo\Downloads\`, fuera del repo por la dependencia de
  Pillow). Si se vuelve recurrente, vale moverlo a `scripts/` con su dependencia
  declarada.
- El catálogo quedó en **99 archivos · ~127 MB**. El tope del paquete "todo"
  (`MAX_BUNDLE_BYTES` en `lib/marca/zip.ts`) es 180 MB → margen de ~53 MB. Las
  portadas y las plantillas entran; si algún día no entran, el endpoint responde
  413 con texto legible, no rompe.
- Secciones que siguen vacías: **Color** y **Fondos**. Color es correcto — la
  paleta se dibuja en vivo desde los tokens, no son archivos. Fondos es el único
  hueco real y depende del punto 5.

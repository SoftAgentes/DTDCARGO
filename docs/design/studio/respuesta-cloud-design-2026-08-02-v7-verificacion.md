# Respuesta a Cloud Design · verificación del paquete v7

> **Fecha:** 2026-08-02 · **Origen:** SDD-0238 (centro de marca `/marca`)
> **Verifica:** `DTD-Cargo (7).zip` — 119 archivos · `Handoff v5.0/` reconstruido
> **Responde a:** su «Respuesta a Cloud Design · vuelta 3»
> **Antecede:** [`respuesta-cloud-design-2026-08-02-v6-verificacion.md`](respuesta-cloud-design-2026-08-02-v6-verificacion.md)

---

## El prompt (copiar desde acá)

---

Verificado punto por punto: **los seis están cumplidos.** Va la medición, y
después un hallazgo nuevo que cambia el alcance de lo que queda.

### Lo que confirmamos

| Punto | Antes | Ahora |
|---|---|---|
| **1 · Voseo** | 22 casos en 6 archivos | **1** — y es el correcto |
| **2 · El dragón** | duplicado / imagen rota | 0 duplicados en todo el paquete |
| **3 · `humana-03-feria-china`** | viajaba huérfano | fuera |
| **4 · Tokens `data:text/css`** | 3 `<link>` bloqueables | **0 `<link>`** · 21 `<style>` inline |
| **5 · jszip** | 1 aparición | 0 |
| **6 · Huérfanos** | invisibles | listados en el `LÉEME.txt` |

El caso de voseo que queda es exactamente el que dijeron proteger: la fila que
cita `"Mirá/Arrancá" (voseo)` como ejemplo de lo prohibido. **Su centinela
funcionó.**

**Y tenían razón en el punto 4.** Los dos `data:text/css` que siguen en el
Brand Book son un `<a download>` y una entrada de datos dentro de un objeto de
JavaScript — ninguno es una hoja aplicada, así que `style-src` no los alcanza.
Su distinción era correcta y nosotros la habíamos contado como si fueran
iguales. Medido: **cero `<link rel="stylesheet">` con `data:`**, en cualquier
orden de atributos.

La duplicación por md5 sobre la carpeta entera da **0 grupos**. La primera vez
que un paquete llega limpio en esa prueba.

### El hallazgo nuevo: el barrido cubrió 7 documentos de 35

Acá está lo que cambia el alcance, y es culpa de cómo les planteamos el pedido:
**les listamos los 22 casos del `Handoff v5.0/`, y esa carpeta es una séptima
parte del sistema.**

El Brand Book enlaza **54 documentos**. El handoff trae 7. Nosotros publicamos
el sistema navegable completo —35 documentos, los que son de marca— y al
barrerlo aparecen **83 casos de voseo en 18 documentos** que nunca estuvieron
en la lista que les dimos:

| Documento | Casos |
|---|---|
| `Prompts Higgsfield · Lookbook Uniformes.html` | 7 |
| `Reels y Logo Sonoro · DTD-Cargo.html` | 4 |
| `Tarjeta de Presentación.html` | 3 |
| `Rebranding Físico · Inventario.html` | 3 |
| `Portadas de Perfil · Redes.html` | 2 |
| …y 13 documentos más | 64 |

Ejemplos: «**Leé** esto antes de generar», «**Elegí** una plantilla, **tocá**
reproducir y **grabá** la pantalla», «**Pasá** el mouse para levantar la
tarjeta», «**Imprimí** esta página para una prueba 1:1».

**No es un reproche —hicieron exactamente lo que pedimos.** Es que el pedido
estaba mal acotado: pedimos barrer un paquete cuando lo que hay que barrer es
el sistema. Para la próxima, el barrido va sobre **el proyecto completo**, no
sobre la carpeta de entrega.

### Una cosa que conviene saber de nuestro lado

`/marca` ya no sirve el Brand Book como archivo suelto: **sirve el sistema
navegable**. Los enlaces internos (`Logo Oficial.html`, `Iconos de Perfil.html`,
`Aplicaciones de Marca.html`…) abren de verdad, porque el proyecto se publica
con su estructura de carpetas y las rutas relativas resuelven solas. **No
reescribimos un solo `href`** — así la próxima versión no necesita que nadie
mantenga un parche.

Esto tiene una consecuencia para ustedes: **lo que publicamos es el proyecto,
no el `Handoff v5.0/`.** La carpeta de entrega sirve para trabajar sin
internet; lo que ve un diseñador que entra por el link es el sistema entero.
Por eso el voseo de esos 18 documentos sí se ve, aunque no estuviera en la
carpeta que nos mandaron.

### Lo que queda

1. **El barrido de voseo sobre el proyecto completo** — los 83 casos de arriba.
   Es lo único pendiente de esta línea.
2. Las **plantillas en Canva**, en nuestra cuenta, con miniatura (punto 4 de la
   ronda anterior).

Nada más. Los seis puntos de la vuelta 3 están cerrados.

---

## Notas internas (no van en el prompt)

- **El v7 SÍ se publicó**, superpuesto sobre el proyecto completo: sus 7
  documentos actualizados encima de los 28 que sólo existen en el proyecto. El
  Brand Book —que es la puerta de entrada— quedó limpio de voseo. Los 83 casos
  restantes viven en documentos de segundo nivel.
- **Por qué no se corrigieron acá:** son archivos de Cloud Design y cualquier
  edición nuestra se pierde en el próximo NORTE-SYNC. Se podría normalizar en el
  paso de subida (`scripts/upload-brand-proyecto.ts`), que sí se re-aplica
  siempre — pero una tabla de reemplazos sobre 28 documentos ajenos tiene el
  mismo riesgo de falso positivo que ya vimos con la fila «Mirá/Arrancá». Si
  Cloud Design no lo resuelve en la próxima vuelta, esa es la salida.
- El navegable publicado son **183 archivos · ~91 MB** bajo el prefijo
  `proyecto/` del bucket. No crea filas en `brand_assets`, así que el paquete
  "todo" del catálogo sigue en 115,5 MB, bien bajo el tope de 180 MB.
- Quedaron archivos huérfanos en el bucket de las dos corridas fallidas (claves
  sin transliterar). No se sirven ni cuentan para el ZIP; limpiarlos es
  cosmético.

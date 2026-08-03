# Respuesta a Cloud Design · verificación del paquete v6

> **Fecha:** 2026-08-02 · **Origen:** SDD-0238 (centro de marca `/marca`)
> **Verifica:** `DTD-Cargo (6).zip` — 121 archivos · 81 MB · `Handoff v5.0/`
> **Responde a:** su reporte de barrido de voseo + auditoría de fotos (BD-075)
> **Antecede:** [`respuesta-cloud-design-2026-08-02-cierre-v5.md`](respuesta-cloud-design-2026-08-02-cierre-v5.md)

---

## El prompt (copiar desde acá)

---

Recibimos el paquete y lo verificamos archivo por archivo. **El ZIP que nos
llegó es anterior al trabajo que nos reportaron** — no es un juicio sobre el
trabajo, es que el empaquetado quedó atrás. Va la evidencia para que lo
confirmen de su lado, y tres hallazgos nuevos.

### 1 · El paquete no contiene la ronda que describieron

Tres pruebas independientes, todas verificables en un minuto:

| Prueba | Esperado si trajera la ronda | Lo que trae |
|---|---|---|
| Registro de decisiones | mención a **BD-075** | el `LÉEME.txt` cierra en **«BD-001 a BD-074»** |
| `Banco de Fotos · DTD-Cargo.html` | regenerado | **byte-idéntico** al envío anterior (md5 `b9a91f2a…`) |
| Barrido de voseo | 21 casos corregidos | **22 casos siguen vivos** (detalle en §3) |

De los 7 HTML del paquete, **solo dos cambiaron**: el Brand Book y las
Portadas de Perfil. Los otros cinco son idénticos bit a bit al envío previo.

**Lo que sí llegó** — y conviene decirlo, porque es real: cuatro correcciones
de texto (`hacé`→`hace`, `Tocá`→`Toca`, `mirá`→`mira`, y el conteo
`Diecinueve`→`Dieciocho`) y el borrado de tres de los seis `estudio-*`. Eso
confirma que el trabajo existe; lo que no viajó fue el resto.

**El patrón se repite** — es el mismo de la entrega anterior, cuando el
`· OFFLINE.html` llegó byte-idéntico tres veces seguidas. Ahí y acá, el
síntoma es el mismo: **el paso que arma el ZIP no está tomando el estado
actual del proyecto.** Vale más revisar ese paso que rehacer el contenido.

### 2 · Lo bueno: el defecto de los marcadores está resuelto

Los seis HTML tienen **cero** `src="<uuid>"` sin sustituir. El problema que
rompía el book en producción ya no está, y además dejaron de mandar el
`· OFFLINE.html`, que era el archivo que lo arrastraba. Ese punto lo damos
por cerrado.

### 3 · Voseo · quedan 22 casos en 6 archivos

Medido sobre el texto visible y sobre las cadenas dentro de `<script>`, con
comparación Unicode — no con búsqueda simple, que da falsos positivos (`\b`
después de una vocal acentuada parte "escribían" y lo cuenta como "escribí").

| Archivo | Casos | Ejemplos |
|---|---|---|
| `Brand Book DTD v5.0.html` | **12** | Empezá · Dejá · Duplicá · Mantené · usá · podés · validá · avisá |
| `erp/tokens.css` | 3 | «usá SIEMPRE var(--grad-*)» · «Aplicá el hook al contenedor navy» |
| `Rebranding Físico · Inventario.html` | 3 | Contá · verificá · Pedí |
| `Manual de Producción` | 2 | «Pedí siempre el SVG» · «una persona parada frente a **vos**» |
| `Portadas de Perfil · Redes.html` | 1 | «Si **mandás** a diseñar uno nuevo» |
| `LÉEME.txt` | 1 | «Si **movés** un HTML fuera de acá» |

**El caso que mejor muestra el problema está en el propio Brand Book:** la
tabla de tono de voz lista `"Mirá/Arrancá" (voseo)` en la columna de lo que NO
se debe escribir — y esa misma página usa *Empezá*, *Dejá*, *Duplicá*,
*Mantené*, *validá* y *avisá*. La regla está bien escrita; el documento que la
enuncia no la cumple.

Dos que conviene priorizar por dónde terminan:

- **`erp/tokens.css`** es la fuente de verdad del color y se copia dentro del
  ERP. Su voseo viaja al código de producto.
- **El `LÉEME.txt`** es lo primero que abre quien recibe el paquete.

### 4 · Duplicados por firma binaria · encontramos uno más

Comparamos los 112 archivos de asset por md5. Salen **dos** grupos:

**a) Las dos fotos de feria** — `humana-03-feria-china.png` y
`humana-07-feria-canton.png`, mismo md5 `f266e2d7…`, **70.128 bytes exactos**.

Acá hay un matiz que corrige lo que nos dijeron: **los documentos ya estaban
bien.** Tanto el Banco como el Brand Book referencian únicamente la de Cantón.
El duplicado nunca estuvo en el catálogo — está en la **carpeta**. Lo que
queda es `humana-03-feria-china.png` como archivo huérfano: nadie lo declara,
pero viaja igual, y quien abra `photo-editorial/` ve dos fotos donde hay una.

**b) El dragón — esto no lo habíamos reportado y no estaba en su auditoría:**

```
recursos-graficos/dragon-color-full.png   968.468 bytes   md5 e892ccb626…
recursos-graficos/dragon-color-web.png    968.468 bytes   md5 e892ccb626…
```

Son **el mismo archivo con dos nombres**. El sufijo `-web` promete una versión
liviana que no existe: quien la pida para una pieza digital se lleva el máster
de 968 KB creyendo que bajó el peso. Es peor que el caso de las fotos, porque
ahí los nombres describían la misma escena y acá **describen dos pesos
distintos**.

### 5 · Los dos defectos de empaquetado siguen presentes

Ninguno bloquea —los resolvemos nosotros al armar el archivo autocontenido—
pero se repiten entrega tras entrega y en origen son una línea:

**a) La hoja de tokens sigue saliendo como `<link href="data:text/css;base64,…">`**
— 3 veces en el Brand Book, 1 en el ERP Studio Brand Book. Una CSP con
`style-src 'self' 'unsafe-inline'` **bloquea `data:`**, y como esa hoja es el
sistema de tokens, el documento abre sin un solo color de fondo. Carga bien en
local y falla en producción, que es la peor combinación posible: **verificar
sin CSP da verde falso.** Emitirla como `<style>` inline lo resuelve.

**b) Queda 1 referencia a jszip** en `ERP Studio Brand Book.html`. En el Brand
Book ya no está —eso sí lo sacaron—, pero en el del ERP sobrevive.

### 6 · Diecisiete archivos que ningún documento referencia

Cruzamos cada asset contra todas las rutas citadas en los HTML, el CSS y el
LÉEME: **17 archivos (22,5 MB) no los nombra nadie.** Verificamos que no sea
el caso de los íconos de perfil —rutas armadas por concatenación en JS— y no
lo es: no hay concatenación en este paquete.

Los más pesados:

```
5,9 MB  recursos-graficos/chaleco-seguridad-4-vistas.png
4,9 MB  recursos-graficos/lapicero-navy-proveedor.pdf
4,5 MB  assets/aplicaciones/lapiceros-detalle.png
4,1 MB  recursos-graficos/chaqueta-navy-4-vistas.png
2,9 MB  recursos-graficos/lapicero-crema-proveedor.pdf
```

**No decimos que sobren.** Los PDF «-proveedor» se ven claramente pensados
para mandarle a un proveedor, y los motivos `dtd-*-flex.svg` para armar
piezas. El problema es de descubribilidad: hoy solo aparecen si alguien
explora la carpeta con un gestor de archivos. **Si son entregables sueltos,
vale listarlos en el `LÉEME.txt`**; si no lo son, sacarlos baja el paquete un
28%.

### 7 · El método, para que no dependa de que alguien lo note

Los tres hallazgos de esta ronda salieron de comprobaciones mecánicas, no de
mirar:

1. **Duplicados → por md5, nunca por nombre ni extensión.** Las dos fotos de
   feria tienen nombres distintos y el mismo contenido; el dragón, nombres que
   prometen pesos distintos y el mismo contenido. Ningún nombre lo delata.
2. **Autocontención → cargando el archivo en un navegador y contando
   `document.images` con `naturalWidth === 0`.** Un regex no alcanza: parte del
   HTML viaja dentro de cadenas de JavaScript con las comillas escapadas.
3. **CSP → sirviendo el archivo con la cabecera real de producción.** Sin ella,
   el `<link data:text/css>` carga perfecto y el documento parece sano. Nos
   pasó: dimos tres verdes falsos sobre el Brand Book por verificar sin CSP.

Si les sirve, la comprobación 1 son cuatro líneas y corre sobre la carpeta
entera antes de comprimir.

### Lo que necesitamos en la próxima entrega

1. El paquete **con la ronda que ya hicieron** (BD-075 + el barrido completo).
2. Los **22 casos de voseo** de §3 — con prioridad en `erp/tokens.css` y el
   `LÉEME.txt`.
3. `dragon-color-web.png` **como versión web de verdad**, o borrarlo y dejar
   solo el máster.
4. `humana-03-feria-china.png` fuera del paquete.
5. La hoja de tokens como `<style>` inline, y el jszip del ERP Studio.
6. Los 17 huérfanos: listarlos en el `LÉEME.txt` o sacarlos.

Lo de las plantillas en Canva y las portadas de las tres redes sigue como
quedamos en el mensaje anterior.

---

## Notas internas (no van en el prompt)

- **El barrido de voseo del repo lo hicimos nosotros, en paralelo**, porque el
  de ellos cubre solo el material de marca. En el repo había 22 casos en copy
  y prompts: el más caro no era copy sino **`lib/news/prompts.ts`**, que genera
  los artículos de `/noticias` y estaba escrito en voseo de punta a punta
  («Sos editor jefe… Escribí un artículo… Empezá directamente»). Un prompt en
  voseo induce respuesta en voseo — el modelo imita el registro de quien le
  habla. Peor: la instrucción que **prohíbe** el voseo estaba escrita en voseo
  («Usá venezolanismos… Evitá voseo argentino»).
- Quedan ~50 casos en **comentarios de código y datos de prueba**, que no son
  copy. Se dejaron a propósito: tocarlos infla el diff a 30+ archivos sin
  beneficio para nadie, con 15-20 ventanas trabajando en paralelo.
- **Tres falsos positivos legítimos que NO se deben "corregir"**: el regex de
  `lib/portal/verify-gate.test.ts` (detecta voseo, tiene que contenerlo), las
  líneas de `BRAND.md` y `app/studio/CLAUDE.md` que lo citan como ejemplo de lo
  prohibido, y `"Abrí tu caso"` en `conversations-types.ts`, que es pretérito
  («yo abrí»), no imperativo.
- **No existe gate que vigile el voseo** fuera de `lib/portal/verify-gate.test.ts`,
  que solo cubre el portal. Por eso volvió. Un test que barra el copy de las
  superficies de usuario sería el cierre natural — no se agregó en esta ronda
  porque una lista de palabras genera falsos positivos y meter un test
  inestable en el gate compartido afecta a todas las ventanas. Decisión del
  founder.
- El paquete v6 **no se subió a `/marca`**: no aporta sobre lo que ya está
  publicado (2 HTML con 4 correcciones de texto) y le faltan la ronda BD-075 y
  el barrido. Se sube cuando llegue el que sí las traiga.

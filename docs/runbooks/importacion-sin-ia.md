# Cómo un Excel o un PDF se vuelve información, sin IA

Qué hay construido hoy, qué falta, y qué cuesta cada camino. Escrito el 2026-09-17
leyendo `lib/studio/document-import/extract.ts`, no de memoria.

---

## 1. El reparto: qué archivo toma qué camino

Todo entra por `extractDocument()`. Ahí se decide, en este orden:

| Entra | Qué pasa | ¿Usa IA? |
|---|---|---|
| `.xls` | Se rechaza pidiendo convertir a XLSX o PDF | — |
| `.pdf` | **Siempre** va a lectura asistida | **Sí, siempre** |
| `.xlsx` / `.csv` | Se leen las hojas y se intenta entenderlas | **No, si se reconocen** |

Para XLSX y CSV hay dos lectores deterministas. Si alguno entiende el archivo, la
IA no se llama nunca. Si ninguno lo entiende, el archivo cae a lectura asistida.

**Las tres condiciones que hacen caer un Excel a la IA** (`extract.ts`, final de
`extractDocument`): que el libro tenga **más de una hoja con datos**, que **no se
reconozca** la tabla, o que queden **secciones después de los totales**. Basta una.

---

## 2. Lector A · La plantilla DTD — mapeo por posición

`parseDtdExport()`. Es el camino perfecto y el que conviene empujar.

No adivina nada. Reconoce el archivo por una firma en A1 (`DTD Cargo · 装箱单`) y
a partir de ahí sabe dónde está cada dato **por coordenada fija**:

| Dato | Celda |
|---|---|
| Empresa / contacto | fila 4, columnas B y D |
| Correo / WeChat / teléfono | fila 5, columnas B, D y F |
| Dirección / ciudad | fila 6, columnas B y D |
| Fecha / moneda | fila 7, columnas B y D |
| Productos | desde la fila 10 |
| Totales | fila que empieza con `总计 / Totales` |

Es **ida y vuelta**: el Excel que DTD genera con `exportDocument()` lo vuelve a
leer `parseDtdExport()` sin pérdida. Hay una prueba de round-trip que lo fija
(`extract.test.ts`).

**Cero ambigüedad, cero IA, cero costo por documento.**

---

## 3. Lector B · Excel ajeno — reconocimiento por encabezados

`parseSheet()`. Para cuando el proveedor manda su propio formato.

Recorre las **primeras 50 filas** buscando una que tenga encabezados conocidos.
Acepta la fila como cabecera cuando encuentra **(nombre o código) + (cantidad,
unidades por caja o precio)**. Desde ahí lee cada fila como un producto.

El diccionario vive en `aliases` (`extract.ts`) y cubre 20 campos en tres idiomas.
Ejemplos reales:

| Campo | Alias que reconoce |
|---|---|
| nombre | `product`, `description`, `descriptions`, `item`, `producto`, `descripcion`, `descripciones`, `品名`, `货物名称` |
| cantidad | `qty`, `quantity`, `totalqty`, `cantidad`, `数量`, `总数量` |
| cajas | `cartons`, `ctns`, `cajas`, `bultos`, `箱数`, `件数` |
| peso bruto | `grossweightkg`, `gwkg`, `pesobrutokg`, `毛重kg` |
| CBM | `cbm`, `totalcbm`, `volumem3`, `体积m3`, `总体积` |

La comparación es **exacta tras normalizar**: se quitan espacios, puntos, guiones,
paréntesis y acentos, y se pasa a minúsculas. Así `G.W. (KG)` y `gwkg` son lo
mismo, pero `PESO` a secas no entra si no está en la lista.

### Ampliar el reconocimiento es barato

Agregar un alias es **una línea**. El 2026-09-17 se agregaron `item`,
`description(s)` y `descripciones` porque las proformas reales de Yiwu los usaban,
y con eso dos documentos que caían a la IA pasaron a leerse gratis.

**Este es el mecanismo principal para reducir el uso de IA**: cada formato nuevo
que aparezca, se mira qué encabezados trae y se suman al diccionario.

---

## 4. Lo que el lector determinista NO hace, a propósito

No son limitaciones: son decisiones para no mentir.

- **No evalúa fórmulas.** Lee el resultado guardado. Si el Excel no lo tiene,
  emite `formula_unavailable` y deja el campo vacío.
- **No reparte totales.** Si el documento dice «15 kg» sin decir de qué cajas, el
  peso queda pendiente. Repartirlo sería inventar.
- **No convierte monedas.** Se conservan las originales y se pide revisión.
- **No infiere unidades.** Una columna `Qty` sin unidad declarada queda sin unidad,
  no en «piezas».
- **No suma parcialmente.** Si falta un sumando, el total es nulo, nunca un cero.
- **Distingue peso neto de bruto.** `N.W.` no cuenta como peso bruto.

---

## 5. El PDF: hoy no hay camino sin IA

`extractDocument` tiene una sola línea para PDF, y va directo a lectura asistida.
**No existe alternativa determinista.** Es la brecha real de este módulo.

Para cerrarla hay tres caminos, y conviene entender que resuelven cosas distintas:

### Camino 1 · La plantilla, y el problema desaparece

Si el documento lo prepara DTD y el proveedor solo lo llena, se lee por posición
igual que el Excel. **Es el camino más barato y el único con cero ambigüedad.**

Ya está casi todo: `exportDocument()` genera el archivo y `parseDtdExport()` lo
lee de vuelta. Lo que falta es operativo, no técnico: que el proveedor reciba la
plantilla en vez de mandar la suya.

Lo que habría que construir: la misma plantilla **en PDF rellenable** (AcroForm),
para el proveedor que no tiene Excel. Leer campos de un formulario PDF es
determinista: cada campo tiene nombre, se lee por nombre.

### Camino 2 · Extraer el texto del PDF y aplicarle el Lector B

Un PDF **digital** (generado desde Excel o Word) lleva el texto adentro con sus
coordenadas. Se puede sacar con una librería de lectura de PDF, reconstruir las
filas agrupando por posición vertical, y pasarle el resultado al mismo motor de
encabezados que ya funciona para Excel.

- Sirve para: PDF exportados de Excel/Word, que es la mayoría de las proformas.
- **No sirve para escaneos.** Ahí no hay texto, hay una imagen.
- Costo: una dependencia nueva y un módulo de reconstrucción de tablas. Es la
  parte delicada — una tabla en PDF no viene marcada como tabla, hay que deducir
  las columnas por coordenada X.

### Camino 3 · El escaneo: no se puede sin un motor de reconocimiento

Un PDF escaneado es una foto. Sin OCR no hay texto que leer, y eso no es una
limitación del código: es física. Las opciones honestas son **OCR local**
(un motor que corre en el servidor, sin mandar nada afuera) o **no aceptar ese
formato** y pedir el archivo original.

---

## 6. Qué recomiendo, en orden

1. **Empujar la plantilla DTD.** Resuelve el caso completo, hoy, sin escribir
   código nuevo salvo la versión PDF rellenable. Cada proveedor que la adopte deja
   de depender de cualquier lectura automática.
2. **Ampliar el diccionario de alias** con cada formato real que aparezca. Es una
   línea por alias y ya demostró que convierte documentos «imposibles» en
   documentos que se leen gratis.
3. **Extraer texto de PDF digitales** y reutilizar el Lector B. Es el trabajo más
   grande de los tres, pero cubre las proformas que hoy obligan a usar IA.
4. **Dejar la lectura asistida como último recurso**, solo para lo que ninguno de
   los anteriores pudo leer — y con la preview humana que ya es obligatoria.

---

## 7. Cómo comprobar en qué camino cae un documento

La suite del corpus real corre contra archivos que no están en Git:

```bash
DOCUMENT_IMPORT_CORPUS=<carpeta con los documentos> \
  ./node_modules/.bin/vitest run lib/studio/document-import/corpus.test.ts
```

Una de sus pruebas afirma que las proformas **no llaman a la IA**. Si un documento
nuevo cae a lectura asistida, esa prueba lo delata.

Para saber *por qué* cayó, lo más rápido es volcar las celdas con sus coordenadas
y mirar qué dice la fila de encabezados: casi siempre es un alias que falta.

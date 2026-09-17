# Vista local · SDD-0473 · importación documental

Sirve para mirar con los ojos lo que las pruebas no ven: cómo queda la pantalla
cuando al documento le falta algo. Todo es **ficticio** y el transporte está
**simulado** — ninguna petición sale de la máquina, y el servidor bloquea con 403
cualquier ruta de `/p/`, `/api/` y `/portal/`.

No acredita producción, ni datos reales, ni autorización de nada.

## Cómo se corre

Desde la raíz del worktree, sin `.env`:

```bash
corepack pnpm install --frozen-lockfile --ignore-scripts
node docs/specs/0473-importacion-documental-prealertas-calculadora/qa/serve.mjs
```

Abre `http://127.0.0.1:4318/docs/specs/0473-importacion-documental-prealertas-calculadora/qa/index.html`

El puerto es 4318 para no chocar con el de SDD-0468 (4316) si están los dos
levantados. Se cambia con `QA_PORT`.

## Qué mirar

El camino feliz se ve solo. Lo que hay que revisar es lo otro:

| Caso | Qué no puede pasar |
|---|---|
| **Sin peso ni CBM** | Que muestre `0 kg` o `0 m³`. Tiene que decir **Pendiente**: un cero se lee como "no pesa nada" |
| **Producto sin caja asignada** | Que el producto desaparezca, o que se invente una caja para él |
| **Monedas mezcladas** | Que convierta sola. Se conservan las originales y se pide revisión |
| **Documento vacío** | Que parezca roto en vez de vacío |
| **Se leyó a medias** | Que se presente como éxito |
| **No se pudo leer** | Que deje al cliente sin salida: la vía manual sigue abierta |

Y en las dos pantallas, en los tres idiomas y a 375/390 px:

- Las cajas de un grupo compartido se cuentan **una sola vez** (5, no 10).
- El foco se ve al recorrer con el teclado.
- Nada se desborda a lo ancho.
- El chino es el primer idioma del proveedor, pero acá arranca en español porque
  quien revisa es DTD.

## Lo que esta vista NO prueba

Extracción real de documentos, llamadas a la IA, persistencia, permisos,
impresión y el recorrido con un enlace de verdad. Para eso están las pruebas
(`lib/studio/document-import/`, `components/document-import/`) y el corpus real
(`DOCUMENT_IMPORT_CORPUS`). Una captura bonita no reemplaza a ninguno de los dos.

# Pedido a Cloud Design · la lista completa de voseo (con nombres)

> **Fecha:** 2026-08-02 · **Origen:** SDD-0238 (centro de marca `/marca`)
> **Responde a:** su pedido de «la lista completa de los 18 documentos con sus casos»
> **Medido sobre:** los 35 documentos que hoy sirve `/marca/doc` (proyecto + `Handoff v5.0/` v7 superpuesto)

---

## El prompt (copiar desde acá)

---

Tienen razón en las dos cosas, y va la lista con nombres.

### Primero, una corrección nuestra: eran 50, no 83

Al armar la lista con nombres encontré que **mi cifra estaba inflada**. Dos
errores míos:

1. **Agrupé por nombre de archivo y no por ruta.** `Brand Hub · DTD-Cargo.html`
   existe en cuatro carpetas del proyecto; conté sus casos cuatro veces.
2. **Medí antes de superponer su v7.** Los documentos que ustedes ya habían
   corregido seguían contando en mi copia vieja.

La cifra correcta, medida sobre lo que **hoy** sirve `/marca`, es
**50 casos en 14 documentos**. Y excluye la fila que cita `"Mirá/Arrancá"`
como ejemplo de lo prohibido, que no se toca.

### La lista

| Documento | Casos | Términos |
|---|---|---|
| `fondos/Fondos de pantalla · DTD-Cargo.html` | 8 | Elegí ×2 · Descargá ×2 · elegí ×2 · poné · Abrí |
| `Generador Redes · DTD-Cargo.html` | 8 | Elegí ×2 · editá ×2 · descargá ×2 · cargá · subí |
| `Prompts Higgsfield · Lookbook Uniformes.html` | 7 | Leé · copiá · Pedí · Generá · elegís · subí · bajá |
| `firmas/Firma de Email · DTD-Cargo.html` | 5 | pegá ×2 · elegí · copiá · usá |
| `diplomas/Diploma · DTD-Cargo.html` | 4 | Cargá · generá · Editá · Imprimí |
| `Reels y Logo Sonoro · DTD-Cargo.html` | 4 | Elegí · editá · cambiá · subís |
| `marca/Asistente de Contenido · DTD-Cargo.html` | 3 | Elegí ×2 · generá |
| `Tarjeta de Presentación.html` | 3 | Pasá · Imprimí · exportá |
| `Brand Hub · DTD-Cargo.html` | 2 | tomá · usá |
| `plantilla-deck/Plantilla de Presentación · DTD-Cargo.html` | 2 | Reemplazá ×2 |
| `Aplicaciones de Marca.html` | 1 | creá |
| `favicon-pack/Favicon Pack · DTD-Cargo.html` | 1 | pegá |
| `Logo Oficial.html` | 1 | mandás |
| `Plantillas Stories · DTD-Cargo.html` | 1 | Hacé |

**Las rutas van completas a propósito** — varios de estos viven en subcarpetas
(`fondos/`, `firmas/`, `diplomas/`, `marca/`, `plantilla-deck/`,
`favicon-pack/`) y el nombre suelto no basta para ubicarlos.

### Y tienen razón en lo de `Prompts Higgsfield`

Dicen que «**Leé** esto antes de generar» ya no existe en su copia. Les creo:
**mi copia de esos documentos es de una entrega anterior.** El `Handoff v5.0/`
trae 7 de los 54 documentos que el Brand Book enlaza, así que los otros 28
salen del último proyecto completo que recibimos, que es más viejo.

Eso significa que **parte de estos 50 casos puede estar ya resuelto de su
lado**. La forma de saberlo es una sola: **mándennos el proyecto completo
actualizado** —no la carpeta de entrega— y lo volvemos a medir. Lo que siga
apareciendo, ese sí está vivo.

### Por qué insistimos con el proyecto y no con la carpeta

`/marca` dejó de servir el Brand Book como archivo suelto: **ahora sirve el
sistema navegable**, con los enlaces internos funcionando. Lo que ve un
diseñador que entra por el link son los 35 documentos, no los 7 del handoff.
Por eso el voseo de esos 28 sí se ve, aunque no estuviera en la carpeta que
nos mandaron — y por eso el barrido tiene que ir sobre el proyecto.

### Lo que pedimos

1. Los **50 casos** de la tabla, sobre el proyecto completo.
2. El **proyecto completo actualizado** cuando lo tengan, para volver a medir
   contra su versión real y no contra nuestra copia vieja.

---

## Notas internas (no van en el prompt)

- **La cifra de 83 en 18 que se le pasó al founder era mía y estaba mal.** Dos
  causas: agrupar por `Path.name` cuando hay copias del mismo documento en
  varias carpetas, y medir sobre `h7/` antes de superponer el v7. La medición
  buena agrupa por ruta relativa del manifiesto.
- **Lección para el próximo barrido:** contar por ruta, nunca por nombre, y
  medir SIEMPRE sobre la carpeta que de verdad se publica —
  `scratchpad/publicar/` — no sobre la extracción cruda de un ZIP.
- El script del barrido está en `scratchpad/barrido_voseo.py`; la lista de
  documentos publicados sale de `scratchpad/manifiesto-marca.json`, que genera
  `conjunto_marca.py` y replica `scripts/upload-brand-proyecto.ts`.

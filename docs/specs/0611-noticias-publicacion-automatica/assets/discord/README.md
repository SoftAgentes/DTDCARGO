# Ícono del aviso «DTD Cargo · Noticias»

Foto del webhook de `#noticias` en Discord (SDD-0611 §4.5). Sam la sube a mano en Discord:
canal `#noticias` → Editar canal → Integraciones → Webhooks → el webhook → foto.

| Variante | Archivo | Nota |
|---|---|---|
| **«N» (recomendada)** | `noticias-icono-1024.png` | N en tinta con barra vino de titular. Hace pareja con la «A» de ALFRED y se lee a 16 px |
| «Periódico» | `noticias-icono-periodico-1024.png` | Hoja de diario con titular vino. Dice «noticias» más literal, pero a 16 px se vuelve una mancha |
| «Sello» | `noticias-icono-sello-1024.png` | Sello vino con leyenda, como el alterno de ALFRED |

`noticias-vista-previa.png` simula las tres en modo oscuro, a 40, 32, 24 y 16 px.

Se descartó una N con la diagonal en vino: recuerda demasiado a una marca ajena.

Marca: colores de `BRAND.md` (wine `#7F0F1A`, ink `#0F1E3D`, papel `#FBFAF7`), Archivo Black
de `lib/font-files` e isólogo oficial de `public/brand`, el mismo sistema que el ícono de ALFRED.

Regenerar: `bash docs/specs/0611-noticias-publicacion-automatica/assets/discord/render.sh`
(`generar.mjs` escribe los SVG; Chrome headless los exporta a PNG).

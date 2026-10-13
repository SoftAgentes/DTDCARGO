# Fuentes de la marca (servidas desde el repositorio)

Decisión de Sam del 2026-10-13 (tipografía, SDD-0505): el sitio usa solo **Archivo**
(con su corte Black) y **JetBrains Mono**. Se cargan con `next/font/local` desde
`lib/fonts.ts`; el build ya no descarga nada de Google.

| Archivo | Familia | Pesos | Bytes | sha256 (16) |
|---|---|---|---|---|
| `archivo-latin-wght.woff2` | Archivo (variable, eje wght) | 100-900 | 34.928 | `25f33e61cf995abd` |
| `archivo-black-latin-400.woff2` | Archivo Black | 400 (se ve como 900) | 18.604 | `8f704806dbedeaae` |
| `jetbrains-mono-latin-wght.woff2` | JetBrains Mono (variable, eje wght) | 100-800 | 40.404 | `18be452724bfdc23` |

- **Origen:** Google Fonts (`fonts.gstatic.com`), descargados el 2026-10-13 con
  la API CSS2 (`family=Archivo:wght@100..900`, `family=Archivo+Black`,
  `family=JetBrains+Mono:wght@100..800`), bloque `/* latin */`.
- **Cobertura:** subconjunto «latin» (`U+0000-00FF`, `U+0131`, `U+0152-0153`,
  `U+2000-206F`, `U+20AC`, `U+2122` y otros signos): todo el español, comillas,
  rayas, euro. El chino NO va aquí: usa la fuente del sistema (PingFang,
  Microsoft YaHei, Noto Sans CJK), definida en `app/globals.css`.
- **Licencia:** SIL Open Font License 1.1 (Archivo © Omnibus-Type; JetBrains
  Mono © JetBrains). El aviso de copyright y la licencia viajan en los metadatos
  de cada woff2, como permite la OFL.
- **Para cambiar o agregar un peso:** las variables ya traen todos; si hiciera
  falta otro subconjunto (p. ej. `latin-ext`), bajar el woff2 del mismo bloque de
  la API CSS2, agregarlo al `src` de `lib/fonts.ts` y actualizar esta tabla.

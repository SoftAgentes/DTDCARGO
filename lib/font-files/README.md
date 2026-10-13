# Fuentes de la marca (servidas desde el repositorio)

Tipografía SDD-0505 (2026-10-13): las familias del Brand Book v5.0 se cargan con
`next/font/local` desde `lib/fonts.ts`; el build ya no descarga nada de Google.

- **Marca** (web pública y piezas): Archivo y Archivo Black.
- **Operación interna** (Studio, Portal, calculadora): Sora (títulos) y Nunito
  Sans (cuerpo), BD-035.
- **Códigos** (Shipping Mark, tracking): JetBrains Mono, en todas las capas.

| Archivo | Familia | Pesos | Bytes | sha256 (16) |
|---|---|---|---|---|
| `archivo-latin-wght.woff2` | Archivo (variable, eje wght) | 100-900 | 34.928 | `8f704806dbedeaae` |
| `archivo-black-latin-400.woff2` | Archivo Black | 400 (se ve como 900) | 18.604 | `25f33e61cf995abd` |
| `sora-latin-wght.woff2` | Sora (variable, eje wght) | 100-800 | 33.652 | `fa26406eeda9a3c6` |
| `nunito-sans-latin-wght.woff2` | Nunito Sans (variable, eje wght) | 200-1000 | 31.076 | `29e3890496844a9e` |
| `jetbrains-mono-latin-wght.woff2` | JetBrains Mono (variable, eje wght) | 100-800 | 40.404 | `18be452724bfdc23` |

- **Origen:** Google Fonts (`fonts.gstatic.com`), descargados el 2026-10-13 con
  la API CSS2 (`family=Archivo:wght@100..900`, `family=Archivo+Black`,
  `family=Sora:wght@100..800`, `family=Nunito+Sans:wght@200..1000`,
  `family=JetBrains+Mono:wght@100..800`), bloque `/* latin */`.
- **Cobertura:** subconjunto «latin» (`U+0000-00FF`, `U+0131`, `U+0152-0153`,
  `U+2000-206F`, `U+20AC`, `U+2122` y otros signos): todo el español, comillas,
  rayas, euro. El chino NO va aquí: usa la fuente del sistema (PingFang,
  Microsoft YaHei, Noto Sans CJK), definida en `app/globals.css`.
- **Licencia:** SIL Open Font License 1.1 (Archivo © Omnibus-Type; Sora © The
  Sora Project Authors; Nunito Sans © The Nunito Sans Project Authors;
  JetBrains Mono © JetBrains). El aviso de copyright y la licencia viajan en los
  metadatos de cada woff2, como permite la OFL.
- **Para cambiar o agregar un peso:** las variables ya traen todos; si hiciera
  falta otro subconjunto (p. ej. `latin-ext`), bajar el woff2 del mismo bloque de
  la API CSS2, agregarlo al `src` de `lib/fonts.ts` y actualizar esta tabla.

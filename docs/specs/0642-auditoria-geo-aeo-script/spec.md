---
sdd: "0642"
title: "Auditoría GEO/AEO por página: script de solo lectura (Fase A de la SDD-0641)"
status: in-progress
author: "Claude Worker «script auditoría GEO/AEO» (Sam)"
created: 2026-11-16
updated: 2026-11-16
supersedes: null
superseded_by: null
related: ["0641", "0604", "0613"]
confidencialidad: interno
---

# SDD-0642 — Auditoría GEO/AEO por página (script)

> Un script de **solo lectura** que toma el sitemap y marca, por página, PASA / FALLA / MANUAL sobre
> lo que una máquina puede medir en el HTML crudo. Implementa la Fase A de la
> [SDD-0641](../0641-geo-aeo-radar-respuestas-ia/spec.md) §5. No cambia el sitio, no toca
> producción ni bases de datos, no usa cuentas ni llaves.

## Pedido

Sam, 2026-11-16: «arranca con la línea base y el script». Encargo del Director General.

## Qué hace

`scripts/auditoria-geo-aeo.mjs` (Node, sin dependencias nuevas). Lee `https://dtdcargo.com/sitemap.xml`
(o otra base / un archivo local), baja cada URL con `fetch` anónimo (4 en paralelo, 20 s de tope) y
analiza el HTML tal como lo entrega el servidor. **No renderiza JavaScript ni mide velocidad.**

### Comprobaciones (columnas de la tabla)

| Id | Qué mide | FALLA cuando |
|---|---|---|
| `http` | Respuesta de la URL | no es 200 |
| `titulo` | `<title>` ≤ 60 caracteres (ya con sufijo) | falta o pasa de 60 |
| `description` | `meta description` | falta o está vacía |
| `canonical` | `link rel=canonical` apunta a la misma ruta | falta o apunta a otra ruta |
| `h1` | Un solo `<h1>` | hay 0 o más de 1 |
| `jsonld` | JSON-LD presente y que parsea | no hay o algún bloque es JSON inválido |
| `jsonld-tipos` | Tipos esperados por ruta (`TIPOS_ESPERADOS`) | falta el tipo esperado |
| `fecha-modificacion` | `dateModified` en artículos (`BlogPosting`, `NewsArticle`, `Article`) | el artículo no lo trae o no es fecha |
| `respuesta-rapida` | Bloque `id="respuesta-rapida"` en las rutas de `REQUIERE_RESPUESTA_RAPIDA` | falta en una ruta que lo requiere |
| `palabras` | Palabras de texto en el HTML crudo (umbral propuesto: 100) | menos que el umbral |
| `noindex` | La URL del sitemap es indexable (meta robots y `X-Robots-Tag`) | lleva `noindex`/`none` |
| `entrantes` | Páginas del sitemap que la enlazan; sin ninguna = huérfana | cero entrantes (sin contar autoenlaces) |
| `titulo-repetido` | Mismo `<title>` en dos o más páginas (canibalización) | otra página tiene el mismo |
| `h1-repetido` | Mismo H1 en dos o más páginas | otra página tiene el mismo |

**MANUAL** (criterio humano, el script no opina): `respuesta-calidad` (¿las dos primeras frases
responden la pregunta del título?) y `fuentes` (¿hay fuentes, autor o prueba verificable donde hace
falta?).

**N/A**: la comprobación no aplica a esa ruta, o la ruta está en `EXCEPCIONES`
(`/enlaces`, `/privacidad`, `/cookies`, con su motivo). Una excepción siempre aparece en el informe
como N/A; nunca desaparece en silencio.

### Lo que NO hace

- **No hay puntaje.** Solo cuenta comprobaciones reales (pasan / fallan / manuales / no aplican).
  Lo dice la SDD-0641 §6, «Qué NO conviene copiar del video», punto 1.
- No cambia títulos ni contenido del sitio: **los reporta**.
- No guarda nada salvo el JSON opcional que se le pida.
- Los umbrales y listas (`MIN_PALABRAS`, `REQUIERE_RESPUESTA_RAPIDA`, `TIPOS_ESPERADOS`) son
  **propuestas editables en el script**, no verdades de Google. Cambiarlas es cambiar la regla de
  la casa y va por PR.

## Uso

```bash
node scripts/auditoria-geo-aeo.mjs                       # sitemap de https://dtdcargo.com
node scripts/auditoria-geo-aeo.mjs --base https://staging.example.com
node scripts/auditoria-geo-aeo.mjs --sitemap ./sitemap.xml --base https://dtdcargo.com
node scripts/auditoria-geo-aeo.mjs --json                # además escribe auditoria-geo-aeo-AAAA-MM-DD.json
node scripts/auditoria-geo-aeo.mjs --json salida.json --estricto
```

- `--base URL`: origen a auditar. Con `--sitemap` local, reescribe el origen de cada `<loc>` (para auditar
  un staging con el sitemap de producción).
- `--sitemap X`: URL o archivo local.
- `--json [archivo]`: informe con fecha, resumen y el detalle de cada comprobación. El nombre por defecto
  está ignorado por Git (`.gitignore`); un informe con datos reales es evidencia fechada, no código.
- `--estricto`: sale con código 1 si hay alguna FALLA. Por defecto siempre sale 0, para que no se vuelva
  una meta que se persiga por sí misma. No está cableado a `pnpm verify` ni al CI.

Salida de consola: una fila por página con `OK` / `XX` / `??` / `--` por comprobación, después la lista de
fallas con su detalle y una línea de conteo.

## Prueba

`scripts/__tests__/auditoria-geo-aeo.test.mjs`: Vitest sobre el parseo y las reglas con HTML de ejemplo, sin red.
Incluye los dos hallazgos ya conocidos (`/fcl` con título de 76 caracteres y `/servicios/puerta-a-puerta` con 63).
Se verificó con mutantes (título 60→70, `noindex` que ignora la meta, H1 que acepta varios, huérfana que siempre
pasa): los cuatro hacen fallar la prueba.

```bash
npx vitest run scripts/__tests__/auditoria-geo-aeo.test.mjs
```

## Línea base 2026-11-16 (corrida real, una sola pasada de lectura)

48 URL del sitemap en vivo. **555 pasan, 37 fallan, 83 manuales, 93 no aplican.** Solo cuentas, sin puntaje.
Las fallas son de cinco tipos:

| Hallazgo | Páginas |
|---|---|
| Título largo | `/fcl` (76), `/servicios/puerta-a-puerta` (63): **reproduce lo ya conocido** |
| Sin `#respuesta-rapida` donde se espera | `/servicios/inspeccion`, `/servicios/puerta-a-puerta`, `/servicios/fcl`, `/servicios/lcl`, `/glosario`, `/faq`, `/importar-de-china`, las 18 geo-páginas y las 5 noticias |
| Huérfanas en el sitemap (ninguna otra página de la lista las enlaza) | `/puerta-a-puerta`, `/llenado`, `/brochure`, `/calculadora-terrestre`: **por verificar** (pueden enlazarse solo desde un menú que no está en el HTML inicial) |
| Sin H1 | `/enlaces` |
| Títulos o H1 repetidos | ninguno |

`/puerta-a-puerta` (0,9 de prioridad) sin entrantes del sitemap es el hallazgo más llamativo frente a la
canibalización con `/servicios/puerta-a-puerta` descrita en SDD-0641 §2, grupo 1. Es un dato para decidir,
no una conclusión: este script mira el HTML crudo.

## Fuera de alcance

Todo lo de las fases B a E de la SDD-0641; Core Web Vitals; renderizado con JavaScript; Search Console;
corregir los hallazgos (títulos, bloque de respuesta, enlaces): son decisiones de redacción y de producto.

# Assets de redes — dónde viven los binarios

> **Los `.png` y `.jpg` de estas carpetas NO están en git.** El texto (`.md`, `.html`,
> `.css`) sí. Este archivo dice dónde está lo demás y cómo regenerarlo.

## Por qué

Regla de [`AGENTS.md`](../../../AGENTS.md) § *Organización · ISO 9001 §7.5*: un adjunto
de documentación va a git **solo si pesa menos de 1 MB**. Las piezas de estas carpetas
pesan entre 1,6 MB y 2,2 MB cada una — el paquete completo son **71,4 MB en 67
archivos**. Meterlos a git engorda el repo para siempre (git no olvida un binario aunque
después lo borres).

Se separaron el **2026-07-28**: el texto se commiteó, los binarios salieron del árbol.

## Qué se movió

| Carpeta | Contenido movido |
|---|---|
| `redes/carrusel-maestro-capacidad-operativa/{assets,exports}/` | 5 renders de contenedor + 7 láminas exportadas |
| `redes/feed-transicion-9-publicaciones/{assets,exports}/` | 3 conceptuales + 10 publicaciones |
| `redes/feed-transicion-9-publicaciones/fotografico-v2/{assets,exports}/` | 9 fotos base, 5 corregidas, 6 generadas, 12 exportaciones |
| `servicios-infografias/assets/` | 10 infografías de CBM y contenedores |

Los `README.md` que viven **dentro** de `assets/corregidas-v1/` y `assets/generadas-v1/`
sí quedaron en git: son texto y documentan el criterio de cada lote.

## Dónde están ahora

Salieron a una carpeta de tránsito fuera del repo, conservando la misma estructura de
subcarpetas:

```
C:\Users\Trabajo\Desktop\DTD-Drive-marketing-2026-07-28\
```

**Pendiente del founder:** subirla a Drive y reemplazar esta ruta local por el enlace
compartido. Mientras tanto ese es el único lugar donde existen.

## ⚠️ Fotografías de personas reales

`fotografico-v2/assets/` contiene fotos del equipo real (`02-equipo-china`,
`06-recibiendo-contenedor`, `07-equipo-oficina`, `08-operacion-puerto`). Su expediente de
permisos está en [`fotografico-v2/permisos/`](feed-transicion-9-publicaciones/fotografico-v2/permisos/README.md)
y hay autorizaciones **sin cerrar**. Estas imágenes no vuelven a git en ningún caso —
ni aunque bajen de 1 MB.

## Cómo regenerar las exportaciones

Los `exports/*.png` son capturas de los `.html` de cada carpeta, que sí están versionados.
Con las fuentes de `assets/` en su sitio, se rehacen abriendo el `.html` correspondiente y
capturándolo con Playwright a la medida de la pieza. El `.html` es la fuente editable; el
`.png` es derivado y desechable.

## Documentos con enlaces a binarios fuera de git

Estos apuntan a archivos que ya no están en el árbol. El enlace queda roto hasta que se
sustituya por la URL de Drive:

- [`redes.md`](../redes.md) — vista de aprobación del feed 3 × 3
- [`feed-transicion-9-publicaciones/README.md`](feed-transicion-9-publicaciones/README.md) — 2 enlaces
- [`fotografico-v2/README.md`](feed-transicion-9-publicaciones/fotografico-v2/README.md)
- [`fotografico-v2/FIGMA-HANDOFF.md`](feed-transicion-9-publicaciones/fotografico-v2/FIGMA-HANDOFF.md)
- [`fotografico-v2/VALIDACION-INSTAGRAM.md`](feed-transicion-9-publicaciones/fotografico-v2/VALIDACION-INSTAGRAM.md)

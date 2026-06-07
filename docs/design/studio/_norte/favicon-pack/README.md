# DTD-Cargo · Favicon pack

Generado desde `app-icon/icon-master-1024.png` (navy #0F1E3D + isólogo cream) y `assets/dtdcargo-isologo-primary.png` (para la versión maskable con padding).

## Contenido
| Archivo | Tamaño | Uso |
|---|---|---|
| `favicon.ico` | 16·32·48 | Pestaña del navegador (clásico, multi-tamaño) |
| `favicon-16.png` / `-32.png` / `-48.png` | 16/32/48 | Favicon PNG moderno |
| `apple-touch-icon.png` | 180×180 | iOS · pantalla de inicio Safari |
| `android-chrome-192.png` | 192×192 | Android · home screen |
| `android-chrome-512.png` | 512×512 | Android · splash / PWA |
| `maskable-512.png` | 512×512 | Android adaptable (safe-zone 80%, `purpose: maskable`) |
| `site.webmanifest` | — | Manifest PWA |

## Cómo instalarlo
Copiá los archivos a la raíz del sitio y pegá en el `<head>`:

```html
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#0F1E3D">
```

## Reglas de marca aplicadas
- Fondo navy oficial `#0F1E3D`, isólogo cream nativo (sin filtros CSS).
- La versión `maskable` deja 18% de padding por lado para el recorte adaptable de Android.
- `theme_color` y `background_color` = navy de marca.

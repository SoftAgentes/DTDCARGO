# -*- coding: utf-8 -*-
"""
Arma la versión AUTOCONTENIDA de un book de marca a partir del entregable de
Cloud Design (SDD-0238).

POR QUÉ EXISTE. El handoff llega como una CARPETA: los HTML referencian archivos
vecinos. Dentro del visor de `/marca` se sirve un archivo suelto, así que esas
referencias dan 404 y el documento abre sin imágenes — y las piezas cuyo texto
claro va sobre una foto de fondo quedan ilegibles (fue el "problema de colores"
reportado el 2026-08-02).

Cloud Design entrega además un `· OFFLINE.html`, pero NO SE PUEDE CONFIAR EN ÉL:
el del v5 traía 70 marcadores `src="<uuid>"` que su exportador nunca sustituyó, y
llegó byte-idéntico en tres entregas seguidas.

⚠️ SE CONSTRUYE DESDE EL PROYECTO COMPLETO, no desde la carpeta `Handoff v5.0/`:
esa carpeta no incluye `app-icon/`, `wechat/`, `app-spinner/` ni
`erp-mockups-v5/`, que los books sí referencian.

⚠️ ESTO NO ALCANZA SOLO. Los íconos de perfil se arman por concatenación en JS
(`'brandbook-icons/' + id + '.png'`) y ningún reemplazo de rutas los ve: hay que
correr después `build-book-iconos-perfil.py`.

⚠️ LA VERIFICACIÓN NO ES ESTÁTICA. "¿Quedó autocontenido?" se responde
CARGÁNDOLO EN UN NAVEGADOR y contando `document.images` con `naturalWidth === 0`.
Un regex no alcanza: parte del HTML viaja dentro de cadenas de JavaScript con las
comillas escapadas.

Uso:
    python scripts/build-book-offline.py <carpeta-proyecto> <archivo.html> <salida.html>
    python scripts/build-book-iconos-perfil.py <salida.html> <carpeta-proyecto>/brandbook-icons

Criterio de encoding, por tipo:
  · PNG fotográfico (los renders de aplicaciones) → WebP a la MISMA resolución.
    Son fotos guardadas en un formato sin pérdida pensado para gráficos planos:
    1200x896 pesando 1,8 MB. No se reescala nada, sólo se re-codifica.
  · PNG con poco color (logos, planos) → se deja PNG optimizado si el WebP no gana.
  · SVG → inline como data: URI utf-8 (son vectores de ~2 KB, base64 los engorda).
  · PDF → base64 tal cual. Son archivos de producción para la imprenta: NO se tocan.
  · CSS → <style> inline. El @import de Google Fonts queda primero y la CSP de
    /marca/asset/* ya permite fonts.googleapis.com / fonts.gstatic.com.

El original queda intacto: esto escribe un archivo nuevo.
"""

import base64
import io
import mimetypes
import os
import re
import sys
import urllib.parse

from PIL import Image

SRC_DIR = sys.argv[1]
SRC_HTML = sys.argv[2]
OUT_HTML = sys.argv[3]

# Los enlaces a OTROS documentos del proyecto no se embeben: cada uno pesa de
# 100 KB a 8 MB y hay ~30, así que inlinearlos multiplicaría el archivo por diez
# para reproducir un sitio entero adentro de una página. Se apuntan al centro de
# marca, que es donde de verdad viven — y offline degrada a "andá a buscarlo ahí"
# en vez de a un 404 mudo.
CENTRO_DE_MARCA = "https://dtdcargo.com/marca"


def es_documento(ref: str) -> bool:
    limpio = ref.split("?")[0].split("#")[0].lower()
    return limpio.endswith((".html", ".md"))

os.chdir(SRC_DIR)
html = open(SRC_HTML, encoding="utf-8").read()

report = []


def encode_image(path: str) -> tuple[str, int, str]:
    """Devuelve (data-uri, bytes_finales, nota). Nunca reescala."""
    raw = open(path, "rb").read()
    if not path.lower().endswith(".png"):
        mime = mimetypes.guess_type(path)[0] or "application/octet-stream"
        return _b64(mime, raw), len(raw), "sin cambios"

    im = Image.open(io.BytesIO(raw))
    has_alpha = im.mode in ("RGBA", "LA") or (
        im.mode == "P" and "transparency" in im.info
    )
    im = im.convert("RGBA" if has_alpha else "RGB")

    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=82, method=6)
    webp = buf.getvalue()

    if len(webp) < len(raw) * 0.9:
        note = "PNG→WebP %.2f→%.2f MB (%dx%d, sin reescalar%s)" % (
            len(raw) / 1048576,
            len(webp) / 1048576,
            im.width,
            im.height,
            ", con alfa" if has_alpha else "",
        )
        return _b64("image/webp", webp), len(webp), note
    return _b64("image/png", raw), len(raw), "PNG conservado (WebP no mejora)"


def _b64(mime: str, blob: bytes) -> str:
    return "data:%s;base64,%s" % (mime, base64.b64encode(blob).decode("ascii"))


def inline_ref(ref: str) -> str | None:
    """data: URI para una referencia relativa, o None si hay que dejarla igual."""
    if es_documento(ref):
        report.append(("doc", ref, "→ centro de marca"))
        return CENTRO_DE_MARCA
    if not os.path.exists(ref):
        report.append(("FALTA", ref, "no existe en el paquete"))
        return None

    if ref.lower().endswith(".svg"):
        svg = open(ref, encoding="utf-8").read()
        # utf-8 en vez de base64: un SVG de 2 KB en base64 crece 33% y encima
        # queda ilegible para quien abra el archivo con un editor.
        uri = "data:image/svg+xml;charset=utf-8," + urllib.parse.quote(svg, safe="")
        report.append(("svg", ref, "inline utf-8 (%d B)" % len(svg)))
        return uri

    uri, size, note = encode_image(ref)
    report.append(("img" if not ref.lower().endswith(".pdf") else "pdf", ref, note))
    return uri


# --- 1. <link rel=stylesheet href="erp/tokens.css"> → <style> --------------
def replace_stylesheet(m: re.Match) -> str:
    href = m.group("href")
    if href.startswith(("data:", "http", "//")):
        return m.group(0)
    if not os.path.exists(href):
        report.append(("FALTA", href, "stylesheet ausente"))
        return m.group(0)
    css = open(href, encoding="utf-8").read()
    report.append(("css", href, "inline como <style> (%d B)" % len(css)))
    return "<style>\n/* inline: %s */\n%s\n</style>" % (href, css)


html = re.sub(
    r'<link\b[^>]*\brel\s*=\s*["\']stylesheet["\'][^>]*\bhref\s*=\s*["\'](?P<href>[^"\']+)["\'][^>]*>',
    replace_stylesheet,
    html,
    flags=re.I,
)

# --- 2. src= / href= relativos → data: URI ---------------------------------
cache: dict[str, str] = {}


def replace_attr(m: re.Match) -> str:
    attr, quote, ref = m.group("attr"), m.group("q"), m.group("ref")
    if ref.startswith(("data:", "http", "//", "#", "mailto:", "tel:", "javascript:")):
        return m.group(0)
    if ref not in cache:
        got = inline_ref(ref)
        if got is None:
            return m.group(0)
        cache[ref] = got
    return "%s=%s%s%s" % (attr, quote, cache[ref], quote)


html = re.sub(
    r'(?P<attr>\bsrc|\bhref)\s*=\s*(?P<q>["\'])(?P<ref>[^"\']+)(?P=q)',
    replace_attr,
    html,
    flags=re.I,
)

# --- 3. url(...) dentro de CSS inline --------------------------------------
def replace_css_url(m: re.Match) -> str:
    ref = m.group("ref").strip("'\"")
    if ref.startswith(("data:", "http", "//", "#")):
        return m.group(0)
    if ref not in cache:
        got = inline_ref(ref)
        if got is None:
            return m.group(0)
        cache[ref] = got
    return "url('%s')" % cache[ref]


html = re.sub(r"url\((?P<ref>[^)]+)\)", replace_css_url, html)

with open(OUT_HTML, "w", encoding="utf-8", newline="\n") as fh:
    fh.write(html)

# --- Reporte ---------------------------------------------------------------
print("=" * 72)
for kind, ref, note in report:
    print("%-6s %-56s %s" % (kind, ref[:56], note))
print("=" * 72)
print("salida: %s" % OUT_HTML)
print("peso  : %.2f MB" % (os.path.getsize(OUT_HTML) / 1048576))
faltan = [r for r in report if r[0] == "FALTA"]
print("faltantes: %s" % (faltan or "ninguno"))

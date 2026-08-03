# -*- coding: utf-8 -*-
"""
Embebe los íconos de perfil del Brand Book, que el constructor estático no puede
alcanzar.

POR QUÉ HACE FALTA UN PASO APARTE. El resto de las imágenes viven en atributos
`src="..."` y se resuelven leyendo el HTML. Éstas no: el book las arma en
JavaScript concatenando

    '<img src="brandbook-icons/' + o.id + '.png" ...>'

Un reemplazo de rutas no sirve — la ruta no existe como cadena completa en
ningún lado, se compone en tiempo de ejecución. Por eso quedaban 15 imágenes
rotas incluso después de embeber las otras 113.

La solución es inyectar un mapa `id → data:` y hacer que la concatenación lea de
ahí. Si algún id faltara, cae a cadena vacía y el `<img>` queda sin imagen —
nunca pidiendo una ruta que va a dar 404.
"""

import base64
import io
import json
import os
import re
import sys

from PIL import Image

ARCHIVO = sys.argv[1]
CARPETA_ICONOS = sys.argv[2]

html = open(ARCHIVO, encoding="utf-8").read()

mapa = {}
for nombre in sorted(os.listdir(CARPETA_ICONOS)):
    if not nombre.lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".svg")):
        continue
    ruta = os.path.join(CARPETA_ICONOS, nombre)
    raw = open(ruta, "rb").read()
    clave = os.path.splitext(nombre)[0]
    if nombre.lower().endswith(".svg"):
        mapa[clave] = "data:image/svg+xml;base64," + base64.b64encode(raw).decode()
        continue
    im = Image.open(io.BytesIO(raw))
    alfa = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)
    im = im.convert("RGBA" if alfa else "RGB")
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=86, method=6)
    elegido = buf.getvalue() if len(buf.getvalue()) < len(raw) else raw
    mime = "image/webp" if elegido is buf.getvalue() else "image/png"
    mapa[clave] = "data:%s;base64,%s" % (mime, base64.b64encode(elegido).decode())

print("íconos leídos: %d (%.2f MB embebidos)" % (
    len(mapa), sum(len(v) for v in mapa.values()) / 1048576))

# 1) El mapa, antes de cualquier script que lo use.
inyeccion = (
    "<script>window.__DTD_ICONOS=%s;</script>\n" % json.dumps(mapa, ensure_ascii=False)
)
if "<head>" in html:
    html = html.replace("<head>", "<head>\n" + inyeccion, 1)
else:
    html = inyeccion + html

# 2) La concatenación pasa a leer del mapa. Se cubren las dos formas en que
#    aparece la ruta (con y sin comillas escapadas dentro de cadenas de JS).
patron = re.compile(
    r"""(?P<pre>\\?["'])brandbook-icons/(?P<sep1>\\?['"])\s*\+\s*"""
    r"""(?P<var>[A-Za-z_$][\w.$]*)\s*\+\s*(?P<sep2>\\?['"])\.png(?P<post>\\?["'])"""
)


def reemplazar(m: re.Match) -> str:
    q, v = m.group("pre"), m.group("var")
    s = m.group("sep1")
    return "%s%s+(window.__DTD_ICONOS[%s]||'')+%s%s" % (q, s, v, s, q)


html, n = patron.subn(reemplazar, html)
print("concatenaciones reescritas:", n)

with open(ARCHIVO, "w", encoding="utf-8", newline="\n") as fh:
    fh.write(html)

restantes = len(re.findall(r"brandbook-icons/", html))
print("referencias 'brandbook-icons/' restantes:", restantes)
print("peso final: %.2f MB" % (os.path.getsize(ARCHIVO) / 1048576))
sys.exit(0 if n > 0 else 1)

#!/usr/bin/env python3
"""infra/ops/lib/storage-lista.py — la lista por archivo del respaldo del Storage (SDD-0620).

La usan storage-backup.sh y storage-restore.sh, y los dos la escriben con esta
misma función, así que la comparación del restore significa algo.

Una línea por archivo regular, ordenada por bytes de la ruta:

    <sha256 del contenido> <bytes> <huella de los xattr user.*> <ruta>

· La ruta es relativa, como la guarda `tar -C <origen> -cf - .` («./tenant/bucket/…»).
· La huella de xattrs es el sha256 de las parejas `nombre=valor-en-hex`
  ordenadas, o «-» si el archivo no tiene ninguno. storage-api guarda ahí el
  Content-Type y el Cache-Control de cada objeto (`user.supabase.*`): si se
  pierden, la web sirve los archivos sin su tipo. Los valores no se imprimen.
· Las rutas pueden llevar nombres de personas y el Shipping Mark: la lista se
  cifra igual que el tar y nunca se escribe en claro. Ante un error, el script
  dice solo el tipo de error, nunca la ruta.

Uso:
    storage-lista.py flujo            < tar      (lee un tar POSIX/pax por la entrada)
    storage-lista.py carpeta <dir>               (lee una carpeta restaurada)
"""
import hashlib
import os
import sys
import tarfile

PREFIJO_PAX = "SCHILY.xattr."


def huella_xattrs(pares):
    usuario = sorted((k, v) for k, v in pares if k.startswith("user."))
    if not usuario:
        return "-"
    h = hashlib.sha256()
    for nombre, valor in usuario:
        h.update(nombre.encode("utf-8", "surrogateescape") + b"=" + valor.hex().encode() + b"\n")
    return h.hexdigest()


def ruta_normal(nombre):
    while nombre.startswith("./"):
        nombre = nombre[2:]
    return "./" + nombre.rstrip("/")


def linea(sha, tam, xs, ruta):
    return f"{sha} {tam} {xs} ".encode() + ruta.encode("utf-8", "surrogateescape") + b"\n"


def desde_flujo():
    lineas = []
    with tarfile.open(fileobj=sys.stdin.buffer, mode="r|") as t:
        for m in t:
            if not m.isreg():
                continue
            h = hashlib.sha256()
            f = t.extractfile(m)
            for bloque in iter(lambda: f.read(1 << 20), b""):
                h.update(bloque)
            pares = [
                (k[len(PREFIJO_PAX):], v.encode("utf-8", "surrogateescape"))
                for k, v in m.pax_headers.items()
                if k.startswith(PREFIJO_PAX)
            ]
            lineas.append(linea(h.hexdigest(), m.size, huella_xattrs(pares), ruta_normal(m.name)))
    return lineas


def desde_carpeta(raiz):
    lineas = []
    for base, _dirs, archivos in os.walk(raiz):
        for nombre in archivos:
            p = os.path.join(base, nombre)
            if not os.path.isfile(p) or os.path.islink(p):
                continue
            h = hashlib.sha256()
            with open(p, "rb") as f:
                for bloque in iter(lambda: f.read(1 << 20), b""):
                    h.update(bloque)
            pares = [(x, os.getxattr(p, x, follow_symlinks=False)) for x in os.listxattr(p, follow_symlinks=False)]
            rel = os.path.relpath(p, raiz)
            lineas.append(linea(h.hexdigest(), os.path.getsize(p), huella_xattrs(pares), ruta_normal(rel)))
    return lineas


def main():
    try:
        if sys.argv[1:] == ["flujo"]:
            lineas = desde_flujo()
        elif len(sys.argv) == 3 and sys.argv[1] == "carpeta":
            lineas = desde_carpeta(sys.argv[2])
        else:
            print("uso: storage-lista.py flujo | carpeta <dir>", file=sys.stderr)
            return 2
    except Exception as e:  # noqa: BLE001 — el mensaje podría traer una ruta
        print(f"storage-lista: falló la lista ({type(e).__name__})", file=sys.stderr)
        return 1
    sys.stdout.buffer.writelines(sorted(lineas))
    return 0


if __name__ == "__main__":
    sys.exit(main())

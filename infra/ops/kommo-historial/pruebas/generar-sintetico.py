"""Datos INVENTADOS para la prueba del cargador del Archivo Kommo (SDD-0590 5.5). Nunca datos reales.

Escribe en la carpeta de staging lo mismo que dejaría la extracción (contactos, talks, mensajes, adjuntos) y una
foto mínima del ERP (clientes.ndjson). La prueba corre después `vincular` y `preparar-carga` del extractor real,
así que el archivo de carga que recibe el cargador sale del mismo código que en el servidor.

Lo esperado (lo comprueba prueba-cargador.sh):
  personas 4 · conversaciones 5 (1 sin contacto) · mensajes 8 (5 entrantes, 3 salientes, 1 sin texto)
  3 adjuntos con copia en claro para el cargador (5.5b): una imagen PNG (m5, sin texto), un PDF (m6) y un audio OGG
  (m8), como los dejaría `extraer --adjuntos-para-carga`.
  En Chatwoot ya existen X1 (+584120000001) y X2 (sint.existente@example.test): se reusan, no se duplican.
"""
import hashlib
import json
import os
import struct
import sys
import time
import zlib

DIA = 86_400


def png_inventado() -> bytes:
    """Una imagen PNG válida de 2×2 píxeles, sin nada de nadie."""
    def bloque(tipo, datos):
        return struct.pack(">I", len(datos)) + tipo + datos + struct.pack(">I", zlib.crc32(tipo + datos) & 0xFFFFFFFF)
    filas = b"".join(b"\x00" + b"\xff\x00\x00" * 2 for _ in range(2))
    return (b"\x89PNG\r\n\x1a\n" + bloque(b"IHDR", struct.pack(">IIBBBBB", 2, 2, 8, 2, 0, 0, 0))
            + bloque(b"IDAT", zlib.compress(filas)) + bloque(b"IEND", b""))


ADJUNTOS = {
    "m5": ("picture", "png", "image/png", png_inventado()),
    "m6": ("file", "pdf", "application/pdf", b"%PDF-1.4\n% SINT-ADJUNTO-PDF\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n"),
    "m8": ("voice", "ogg", "audio/ogg", b"OggS" + bytes(24) + b"SINT-ADJUNTO-AUDIO" * 8),
}


def main(carpeta: str) -> None:
    os.makedirs(carpeta, exist_ok=True)
    ahora = int(time.time())

    def escribir(nombre, filas):
        with open(os.path.join(carpeta, nombre), "w", encoding="utf-8") as f:
            for fila in filas:
                f.write(json.dumps(fila, ensure_ascii=False) + "\n")

    def contacto(cid, nombre, telefonos=(), correos=()):
        cf = []
        if telefonos:
            cf.append({"field_code": "PHONE", "values": [{"value": t} for t in telefonos]})
        if correos:
            cf.append({"field_code": "EMAIL", "values": [{"value": c} for c in correos]})
        return {"id": cid, "name": nombre, "avatar_url": "https://kommo.example/SINT-AVATAR.png",
                "custom_fields_values": cf or None}

    def talk(tid, contacto_id, origen, hace_dias):
        creada = ahora - hace_dias * DIA
        return {"_http": 200, "_talk_id": tid,
                "talk": {"contact_id": contacto_id, "origin": origen, "created_at": creada, "updated_at": creada + 3600}}

    def mensaje(mid, tid, ts, tipo="incoming", texto=None, autor=None, adjunto=None):
        m = {"id": mid, "_talk_id": tid, "chat_id": f"chat-{tid}", "type": tipo, "text": texto, "created_at": ts,
             "origin": "waba", "author": autor or {"id": "a", "type": "external", "name": "SINT-NOMBRE-CLIENTE"}}
        if adjunto:
            m["attachment"] = adjunto
        return m

    escribir("contactos.ndjson", [
        contacto(1001, "SINT-NOMBRE-A Uno", telefonos=["04120000001"]),           # X1 por teléfono
        contacto(1002, "SINT-NOMBRE-B Dos", telefonos=["0412-000-0002"]),         # 1002 y 1003: misma persona
        contacto(1003, "SINT-NOMBRE-B Bis", telefonos=["+58 412 0000002"]),
        contacto(1004, "SINT-NOMBRE-C", correos=["SINT.Existente@Example.test"]),  # X2 por correo
        contacto(1005, "SINT-NOMBRE-D"),                                          # sin teléfono ni correo
    ])
    escribir("clientes.ndjson", [
        {"client_id": "SINT-C1", "phone_last10": ["4120000002"], "correos": []},
        {"client_id": "SINT-C2", "phone_last10": [], "correos": ["otra@example.test"]},
    ])
    escribir("talks.ndjson", [
        talk(2001, 1001, "waba", 500),
        talk(2002, 1003, "waba", 200),
        talk(2003, 1004, "instagram_business", 100),
        talk(2004, 1005, "waba", 50),
        talk(2005, 9999, "waba", 2),                     # contacto que no está en contactos: «sin contacto»
        {"_http": 403, "_talk_id": 2006, "talk": None},  # no se pudo leer: no entra
    ])
    asesora = {"id": "s", "type": "internal", "name": "SINT-Asesora Pérez"}
    bot = {"id": "b", "type": "bot", "name": "SINT-Salesbot"}
    m1 = mensaje("m1", 2001, ahora - 500 * DIA, texto="SINT-TEXTO-1 SINTVIEJO")
    escribir("mensajes.ndjson", [
        m1,
        mensaje("m2", 2001, ahora - 500 * DIA + 60, "outgoing", "SINT-TEXTO-2", asesora),
        mensaje("m3", 2001, ahora - 499 * DIA, "outgoing", "SINT-TEXTO-3", bot),
        mensaje("m4", 2002, ahora - 200 * DIA, texto="SINT-TEXTO-4"),
        mensaje("m5", 2002, ahora - 200 * DIA + 30, adjunto={"type": "picture", "file_name": "SINT.jpg",
                                                             "link": "https://drive.kommo.example/SINT?sig=SINT"}),
        mensaje("m6", 2003, ahora - 100 * DIA, texto="SINT-TEXTO-6",
                adjunto={"type": "file", "file_name": "SINT.pdf", "link": "https://drive.kommo.example/SINT6?sig=SINT"}),
        mensaje("m7", 2004, ahora - 50 * DIA, "outgoing", "SINT-TEXTO-7", asesora),
        mensaje("m8", 2005, ahora - DIA, texto="SINT-TEXTO-8 SINTBUSCAR",
                adjunto={"type": "voice", "file_name": "SINT.ogg", "link": "https://drive.kommo.example/SINT8?sig=SINT"}),
        mensaje("m9", 2006, ahora - DIA, texto="SINT-TEXTO-9"),  # de la conversación 403: no entra
        dict(m1),                                              # repetido: entra una vez
    ])
    # Como los deja `extraer --adjuntos-para-carga`: el .age del respaldo (aquí no hace falta el archivo) y la copia
    # en claro en adjuntos-carga/, con tipo, extensión, bytes y sha256.
    os.makedirs(os.path.join(carpeta, "adjuntos-carga"), exist_ok=True)
    filas = []
    for mid, (tipo, ext, content_type, datos) in ADJUNTOS.items():
        with open(os.path.join(carpeta, "adjuntos-carga", f"{mid}.{ext}"), "wb") as f:
            f.write(datos)
        filas.append({"message_id": mid, "archivo": f"adjuntos/{mid}.{ext}.age", "http": 200,
                      "archivo_carga": f"adjuntos-carga/{mid}.{ext}", "tipo": tipo, "ext": ext,
                      "content_type": content_type, "bytes": len(datos), "sha256": hashlib.sha256(datos).hexdigest()})
    escribir("adjuntos.ndjson", filas)


if __name__ == "__main__":
    main(sys.argv[1])

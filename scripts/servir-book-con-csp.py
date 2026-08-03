# -*- coding: utf-8 -*-
"""
Sirve los books con EXACTAMENTE la CSP de producción (`brandBookCspHeader` de
next.config.ts), para reproducir la condición real del visor `/marca/brand-book`.

Verificar sin la CSP es verificar otra cosa: un `data:` en `img-src`, una fuente
de Google o un `blob:` pueden pasar en local y morir en producción.
"""

import http.server
import os
import sys

CSP = "; ".join(
    [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' data: blob: https://fonts.gstatic.com",
        "img-src 'self' data: blob:",
        "connect-src 'self' data: blob:",
        "frame-ancestors 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
    ]
)


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Content-Security-Policy", CSP)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "private, no-store")
        super().end_headers()

    def log_message(self, *a):
        pass


os.chdir(sys.argv[1])
http.server.HTTPServer(("127.0.0.1", int(sys.argv[2])), Handler).serve_forever()

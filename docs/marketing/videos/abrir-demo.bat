@echo off
REM Abre el demo de registro + portal embebido (registro-demo.html).
REM Doble click ACA en vez del .html directo.
REM
REM Por que: el boton "Ir al portal" mete el Portal del Cliente adentro de un
REM <iframe> para no salir de la pestana. Los navegadores (Chrome/Edge) bloquean
REM ese iframe si abris el .html con doble click normal (protocolo file://,
REM bloquea cargar OTRO archivo local adentro de un iframe por seguridad).
REM Este .bat levanta un servidor local chiquito (solo en tu PC, nadie mas lo ve)
REM y abre el demo por http://localhost — ahi el iframe si carga bien.
REM
REM Para cerrar el servidor: cerra la ventana negra que se abre a un lado.

cd /d "%~dp0..\.."
start "DTD Demo Server (no cerrar mientras grabas)" cmd /k "python -m http.server 8790"
timeout /t 1 /nobreak >nul
start "" "http://localhost:8790/marketing/videos/registro-demo.html"

"""Mutantes de los envoltorios (SDD-0615): cada uno rompe una línea y alguna prueba debe fallar.

Uso: python -I -B infra/oficina/envoltorios/tests/mutantes.py
Los marcados «solo Linux» dependen de pruebas que en Windows se saltan.
"""

import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
POSIX = os.name != "nt"
NL = chr(10)

MUTANTES = [
    ("dtd-motor", "  claude:ceo) usuario=agentes-alfred ;;", "  claude:*) usuario=agentes-alfred ;;", "Claude con cualquier perfil", False),
    ("dtd-motor", "codex:auxiliar) usuario=agentes-auxiliar ;;", "codex:auxiliar) usuario=agentes-run ;;", "Codex como agentes-run", False),
    ("dtd-motor", "claude:ceo) usuario=agentes-alfred ;;", "claude:ceo) usuario=agentes-auxiliar ;;", "Claude con el usuario del Auxiliar", False),
    ("dtd-motor", '[ -d "$base" ] || { echo "dtd-motor: falta $base" >&2; exit 65; }', 'mkdir -p -- "$base"', "crea el staging sin la instalación", False),
    ("dtd-motor", '"$PROTEGIDO"*) [ -e "$1" ] ;;', '"$PROTEGIDO"*) false ;;', "no copia nada", False),
    ("dtd-motor", "    --mcp-config)" + NL, "    --mcp-configX)" + NL, "pasa --mcp-config", False),
    ("dtd-motor", "--mcp-config=*) continue ;;", "--mcp-configX=*) continue ;;", "pasa --mcp-config=", False),
    ("dtd-motor", '-mmin +"$MINUTOS_VIDA"', "-mmin +100000", "no limpia corridas viejas", False),
    ("dtd-motor", " -name 'run.*'", "", "borra carpetas ajenas", False),
    ("dtd-motor", "n=$((n + 1))", "n=1", "copias con el mismo nombre", False),
    ("dtd-motor", 'a="$clave=$RESULTADO"', 'a="$a"', "no reescribe --opcion=ruta", False),
    ("dtd-motor", '  "${ACL[@]}" -R -m "u:$usuario:rX" -- "$destino"' + NL, NL, "la copia queda sin lectura del motor", False),
    ("dtd-motor", '"${ACL[@]}" -m "u:$usuario:rX" -- "$corrida"', "true", "la corrida queda sin lectura del motor", False),
    ("dtd-motor", "cp -RL --", "cp -R --", "copia enlaces en vez de archivos (solo Linux)", True),
    ("dtd-motor", 'chmod 2750 -- "$corrida"', 'chmod 755 -- "$corrida"', "corrida legible por todos (solo Linux)", True),
    ("dtd-agente-run", "claude:ceo:agentes-alfred | codex", "claude:ceo:* | codex", "Claude con cualquier usuario", False),
    ("dtd-agente-run", "codex:auxiliar:agentes-auxiliar)", "codex:auxiliar:*)", "Codex con cualquier usuario", False),
    ("dtd-agente-run", "hermes:*:agentes-run |", "hermes:*:* |", "Hermes con cualquier usuario", False),
    ("dtd-agente-run", "opencode:*:agentes-run)", "opencode:*:*)", "OpenCode con cualquier usuario", False),
    ("dtd-agente-run", "unset ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN OPENAI_API_KEY" + NL, NL, "llaves de API pasan", False),
    ("dtd-agente-run", '[ "$herramienta" = claude ] || unset CLAUDE_CODE_OAUTH_TOKEN', "true", "el token de Claude llega a todos", False),
    ("dtd-agente-run", "    cd /srv/oficina/trabajo/ceo" + NL, NL, "Claude sin carpeta forzada", False),
    ("dtd-agente-run", "    cd /srv/oficina/trabajo/auxiliar" + NL, NL, "Codex sin carpeta forzada", False),
    ("dtd-agente-run", 'export CLAUDE_CONFIG_DIR="$casa/.claude"', "export CLAUDE_CONFIG_DIR=/home/agentes-run/.claude", "Claude con la carpeta de agentes-run", False),
    ("dtd-agente-run", 'export CODEX_HOME="$casa/.codex"', "export CODEX_HOME=/home/agentes-run/.codex", "Codex con la carpeta de agentes-run", False),
    ("dtd-agente-run", "|seo|", "|seo|auxiliar|", "Hermes acepta un perfil ajeno", False),
    ("91-agentes-run", "Defaults!/usr/local/libexec/dtd-agente-run !log_allowed" + NL, "", "sudo registra el prompt", False),
    ("91-agentes-run", "CLAUDE_CODE_OAUTH_TOKEN TERM", "CLAUDE_CODE_OAUTH_TOKEN ANTHROPIC_API_KEY TERM", "sudo deja pasar la llave de API", False),
    ("91-agentes-run", "(agentes-run, agentes-alfred, agentes-auxiliar)", "(ALL)", "sudo a cualquier usuario", False),
    ("dtd-claude", "dtd-motor claude", "dtd-motor codex", "dtd-claude llama a Codex", False),
    ("dtd-codex", 'exec /usr/local/libexec/dtd-motor codex "$@"', 'exec /usr/local/libexec/dtd-agente-run codex "$@"', "dtd-codex se salta el motor", False),
]


def correr_suite(raiz):
    env = dict(os.environ, ENVOLTORIOS_RAIZ=str(raiz))
    r = subprocess.run(
        [sys.executable, "-I", "-B", "-m", "unittest", "discover", "-s", str(AQUI)],
        env=env, capture_output=True, text=True, timeout=600,
    )
    return r.returncode


def main():
    if correr_suite(RAIZ) != 0:
        print("La base no está en verde: los mutantes no dicen nada.")
        return 2
    vivos = []
    corridos = 0
    for archivo, viejo, nuevo, nombre, solo_linux in MUTANTES:
        if solo_linux and not POSIX:
            print(f"SALTADO (solo Linux): {nombre}")
            continue
        tmp = Path(tempfile.mkdtemp(prefix="mutante-"))
        try:
            copia = tmp / "envoltorios"
            shutil.copytree(RAIZ, copia, ignore=shutil.ignore_patterns("tests", "__pycache__"))
            ruta = copia / archivo
            texto = ruta.read_bytes().decode()
            if viejo not in texto:
                print(f"NO APLICA (texto no encontrado): {nombre}")
                vivos.append(nombre)
                continue
            ruta.write_bytes(texto.replace(viejo, nuevo, 1).encode())
            corridos += 1
            if correr_suite(copia) == 0:
                print(f"SOBREVIVE: {nombre}")
                vivos.append(nombre)
            else:
                print(f"muere: {nombre}")
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    print(f"{corridos - len([v for v in vivos])} de {corridos} mueren")
    return 1 if vivos else 0


if __name__ == "__main__":
    sys.exit(main())

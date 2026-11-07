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
    ("dtd-motor", '"$PROTEGIDO"*|"${PROTEGIDO%/}") [ -e "$1" ] ;;', '"$PROTEGIDO"*|"${PROTEGIDO%/}") false ;;', "no copia nada", False),
    ("dtd-motor", "    --mcp-config)" + NL, "    --mcp-configX)" + NL, "pasa --mcp-config", False),
    ("dtd-motor", "      ;;" + NL + "    --mcp-config=*) continue ;;", "      ;;" + NL + "    --mcp-configX=*) continue ;;", "pasa --mcp-config=", False),
    ("dtd-motor", '-mmin +"$MINUTOS_VIDA"', "-mmin +100000", "no limpia corridas viejas", False),
    ("dtd-motor", " -name 'run.*'", "", "borra carpetas ajenas", False),
    ("dtd-motor", "n=$((n + 1))", "n=1", "copias con el mismo nombre", False),
    ("dtd-motor", 'a="$clave=$RESULTADO"', 'a="$a"', "no reescribe --opcion=ruta", False),
    ("dtd-motor", '  "${ACL[@]}" -R -m "u:$usuario:rX" -- "$destino"' + NL, NL, "la copia queda sin lectura del motor", False),
    ("dtd-motor", '"${ACL[@]}" -m "u:$usuario:rX" -- "$corrida"', "true", "la corrida queda sin lectura del motor", False),
    ("dtd-motor", 'cp -RL -- "$(realpath -e -- "$origen")"', 'cp -R -- "$origen"', "copia enlaces en vez de archivos (solo Linux)", True),
    ("dtd-motor", 'chmod 750 -- "$corrida"', 'chmod 755 -- "$corrida"', "corrida legible por todos (solo Linux)", True),
    ("dtd-motor", "  permitida \"$real\" || return 1" + NL, NL, "copia cualquier ruta protegida", False),
    ("dtd-motor", '  [[ "$resto" =~ ^\\.paperclip/instances/default/companies/', '  return 0' + NL + '  [[ "$resto" =~ ^\\.paperclip/instances/default/companies/', "lista abierta a toda la casa", False),
    ("dtd-motor", '      permitida "$destino_real" || return 1' + NL, NL, "sigue enlaces fuera de la lista (solo Linux)", True),
    ("dtd-motor", '    "$PROTEGIDO"*|"${PROTEGIDO%/}") [ -e "$1" ] ;;', '    "$PROTEGIDO"?*) [ -e "$1" ] ;;', "la casa sola no se revisa", False),
    ("dtd-motor", '    exit 66' + NL + '  fi', '    true' + NL + '  fi', "copia aunque la ruta esté fuera", False),
    ("dtd-motor", '  if de_los_glm "$candidato"; then', '  if false; then', "deja pasar rutas de los GLM", False),
    ("dtd-motor", '    "$trabajo_real"|"$trabajo_real"/*) return 0 ;;', '    "$trabajo_real") return 0 ;;', "solo revisa la carpeta de los GLM, no lo de adentro", False),
    ("dtd-motor", '  real="$(realpath -m -- "$ruta")"' + NL + '  case "$real" in', '  real="$ruta"' + NL + '  case "$real" in', "no resuelve .. ni enlaces hacia los GLM", False),
    ("dtd-motor", '    *) ruta="$MOTORES/$perfil/$ruta" ;;', '    *) ;;', "resuelve las relativas desde otra carpeta", False),
    ("dtd-motor", '  local ruta="$1" real' + NL, '  local ruta="$1" real' + NL + '  [ -e "$ruta" ] || [ -L "$ruta" ] || return 1' + NL, "deja pasar rutas de los GLM que aún no existen", False),
    # Riesgos BAJOS de la aprobación de la #407 (2026-11-07).
    ("dtd-motor", '    "~"*) echo "dtd-motor: ruta que empieza por ~', '    "~NO"*) echo "dtd-motor: ruta que empieza por ~', "deja pasar rutas que empiezan por ~", False),
    ("dtd-motor", '  case "$candidato" in' + NL + '    "~"*)', '  case "$a" in' + NL + '    "~"*)', "deja pasar --opcion=~/...", False),
    ("dtd-motor", '  if [ "$herramienta" = codex ]; then', '  if false; then', "Codex acepta -C", False),
    ("dtd-motor", '  if [ "$herramienta" = codex ]; then', '  if [ "$herramienta" = claude ]; then', "revisa -C en Claude y no en Codex", False),
    ("dtd-motor", "      -C*|--cd|--cd=*)", "      -C|--cd|--cd=*)", "Codex acepta -C pegado a la carpeta", False),
    ("dtd-motor", "      -C*|--cd|--cd=*)", "      -C*|--cd=*)", "Codex acepta --cd", False),
    ("dtd-motor", "      -C*|--cd|--cd=*)", "      -C*|--cd)", "Codex acepta --cd=", False),
    ("dtd-agente-run", '    sin_rutas_de_los_glm "$@"' + NL + '    exec /opt/agentes-cli/bin/codex', '    exec /opt/agentes-cli/bin/codex', "Codex sin revisar sus rutas como su usuario", False),
    ("dtd-agente-run", '    sin_rutas_de_los_glm "$@"' + NL + '    exec /opt/agentes-cli/bin/claude', '    exec /opt/agentes-cli/bin/claude', "Claude sin revisar sus rutas como su usuario", False),
    ("dtd-agente-run", '      --*=*) ruta="${a#*=}" ;;', '      --*=*) ruta="$a" ;;', "no revisa el valor de --opcion=ruta", False),
    ("dtd-agente-run", '      "$trabajo_real"|"$trabajo_real"/*)' + NL + '        echo "dtd-agente-run: ruta en', '      "$trabajo_real")' + NL + '        echo "dtd-agente-run: ruta en', "solo revisa la carpeta de los GLM, no lo de adentro", False),
    ("dtd-agente-run", '    real="$(realpath -m -- "$ruta" 2>/dev/null)" || continue', '    real="$ruta"', "no sigue los enlaces dentro de la carpeta del motor (solo Linux)", True),
    ("dtd-agente-run", '2>/dev/null)" || continue', '2>/dev/null)" || exit 66', "un argumento vacío deja al motor sin arrancar", False),
    ("dtd-agente-run", '    exec /opt/hermes/bin/hermes "$@" ;;', '    sin_rutas_de_los_glm "$@"' + NL + '    exec /opt/hermes/bin/hermes "$@" ;;', "Hermes no puede trabajar en la carpeta de los GLM", False),
    ("dtd-agente-run", "TRABAJO=/srv/oficina/trabajo" + NL, "TRABAJO=/srv/oficina/otra" + NL, "revisa otra carpeta y no la de los GLM", False),
    ("dtd-agente-run", "claude:ceo:agentes-alfred | codex", "claude:ceo:* | codex", "Claude con cualquier usuario", False),
    ("dtd-agente-run", "codex:auxiliar:agentes-auxiliar)", "codex:auxiliar:*)", "Codex con cualquier usuario", False),
    ("dtd-agente-run", "hermes:*:agentes-run |", "hermes:*:* |", "Hermes con cualquier usuario", False),
    ("dtd-agente-run", "opencode:*:agentes-run)", "opencode:*:*)", "OpenCode con cualquier usuario", False),
    ("dtd-agente-run", "unset ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN OPENAI_API_KEY" + NL, NL, "llaves de API pasan", False),
    ("dtd-agente-run", '[ "$herramienta" = claude ] || unset CLAUDE_CODE_OAUTH_TOKEN', "true", "el token de Claude llega a todos", False),
    ("dtd-agente-run", '[ "$herramienta" = hermes ] || unset HERMES_EPHEMERAL_SYSTEM_PROMPT', "true", "las instrucciones de Hermes llegan a Claude y Codex", False),
    ("dtd-agente-run", '    motor_en "$MOTORES/ceo"' + NL, NL, "Claude sin carpeta forzada", False),
    ("dtd-agente-run", '    motor_en "$MOTORES/auxiliar"' + NL, NL, "Codex sin carpeta forzada", False),
    ("dtd-agente-run", 'MOTORES=/srv/oficina/motores', 'MOTORES=/srv/oficina/trabajo', "motores en la carpeta de los GLM", False),
    ("dtd-agente-run", '  carpeta_segura "$1" || {', '  true || {', "no revisa la carpeta (solo Linux)", True),
    ("dtd-agente-run", '  [ -z "$(ajeno "$d" "$yo_uid")" ] || return 1' + NL, NL, "carpeta escribible por otros (solo Linux)", True),
    ("dtd-agente-run", "for rel in .claude .mcp.json CLAUDE.md", "for rel in CLAUDE.md", "no revisa .claude ni .mcp.json (solo Linux)", True),
    ("dtd-agente-run", " .codex AGENTS.md AGENTS.override.md; do", " AGENTS.override.md; do", "no revisa .codex ni AGENTS.md (solo Linux)", True),
    ("dtd-agente-run", '-print -quit)" ] || return 1', '-print -quit)" ] || true', "no revisa la configuración del proyecto (solo Linux)", True),
    ("dtd-agente-run", '    [ -z "$(ajeno "$p" "$DUENO_SEGURO")" ] || return 1' + NL, NL, "no revisa los padres (solo Linux)", True),
    ("dtd-agente-run", '  [ -d "$d" ] || return 1', '  true', "acepta una carpeta inexistente", False),
    ("dtd-agente-run", 'export CLAUDE_CONFIG_DIR="$casa/.claude"', "export CLAUDE_CONFIG_DIR=/home/agentes-run/.claude", "Claude con la carpeta de agentes-run", False),
    ("dtd-agente-run", 'export CODEX_HOME="$casa/.codex"', "export CODEX_HOME=/home/agentes-run/.codex", "Codex con la carpeta de agentes-run", False),
    ("dtd-agente-run", "|seo|", "|seo|auxiliar|", "Hermes acepta un perfil ajeno", False),
    ("91-agentes-run", "Defaults!/usr/local/libexec/dtd-agente-run !log_allowed" + NL, "", "sudo registra el prompt", False),
    ("91-agentes-run", "CLAUDE_CODE_OAUTH_TOKEN TERM", "CLAUDE_CODE_OAUTH_TOKEN ANTHROPIC_API_KEY TERM", "sudo deja pasar la llave de API", False),
    ("91-agentes-run", "HERMES_EPHEMERAL_SYSTEM_PROMPT ", "", "sudo borra las instrucciones de Hermes", False),
    ("91-agentes-run", 'env_keep = "PAPERCLIP_API_URL ', 'env_keep = "PAPERCLIP_* PAPERCLIP_API_URL ', "sudo vuelve al comodín", False),
    ("91-agentes-run", "HERMES_EPHEMERAL_SYSTEM_PROMPT DTD_PERFIL", "HERMES_EPHEMERAL_SYSTEM_PROMPT PAPERCLIP_AGENT_JWT_SECRET DTD_PERFIL", "sudo deja pasar el JWT de Paperclip", False),
    ("91-agentes-run", "agentes ALL=(agentes-run", "agentes ALL=(root) NOPASSWD: /bin/sh" + NL + "agentes ALL=(agentes-run", "sudoers con una línea extra", False),
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

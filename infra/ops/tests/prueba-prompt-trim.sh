#!/usr/bin/env bash
# infra/ops/tests/prueba-prompt-trim.sh — prueba de trim() de lib/prompt.sh (SDD-0505).
# Sin servidor ni secretos: valores inventados. Corre en cualquier bash:
#   bash infra/ops/tests/prueba-prompt-trim.sh
set -uo pipefail
S="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=../lib/prompt.sh
. "${S}/lib/prompt.sh"

paso=0; fallo=0
check() { # $1 = nombre, $2 = entrada, $3 = esperado
  local got; got="$(trim "$2")"
  if [[ "${got}" == "$3" ]]; then paso=$((paso + 1)); printf 'PASÓ  · %s\n' "$1"
  else fallo=$((fallo + 1)); printf 'FALLÓ · %s · esperado %q · llegó %q\n' "$1" "$3" "${got}"; fi
}

E=$'\e'
check "sin nada que quitar"                       "CORTE dtd-cargo"                       "CORTE dtd-cargo"
check "espacios y tabuladores en los extremos"    $'  \tCORTE dtd-cargo \t '              "CORTE dtd-cargo"
check "retorno de carro del pegado"               $'CORTE dtd-cargo\r'                    "CORTE dtd-cargo"
check "marcas de pegado ESC[200~ … ESC[201~"      "${E}[200~CORTE dtd-cargo${E}[201~"     "CORTE dtd-cargo"
check "flecha abajo ESC[B delante (token)"        "${E}[B1234567890:AAx"                  "1234567890:AAx"
check "respuesta DA1 ESC[?61;6;7;21;22;23;24c"    "${E}[?61;6;7;21;22;23;24;28;32;42cCORTE dtd-cargo" "CORTE dtd-cargo"
check "respuesta DA2 ESC[>0;10;1c (la del 13-10)" "${E}[>0;10;1cCORTE dtd-cargo"          "CORTE dtd-cargo"
check "las dos respuestas seguidas"               "${E}[?61;6;7c${E}[>0;10;1cCORTE dtd-cargo" "CORTE dtd-cargo"
check "CSI con byte intermedio ESC[ q"            "${E}[ qCORTE dtd-cargo"                "CORTE dtd-cargo"
check "ESC suelto"                                "${E}CORTE dtd-cargo"                   "CORTE dtd-cargo"
check "no toca el interior del valor"             "a>b?c;d=e"                             "a>b?c;d=e"
check "clave age con guion bajo y mayúsculas"     "AGE-SECRET-KEY-1ABC_DEF"               "AGE-SECRET-KEY-1ABC_DEF"

# Control rojo: la versión anterior de la clase ([0-9;?]) no quita la DA2.
trim_vieja() { local s="$1"; shopt -s extglob; s="${s//$'\e'\[*([0-9;?])[@-~]/}"; s="${s//$'\e'/}"; printf '%s' "${s}"; }
if [[ "$(trim_vieja "${E}[>0;10;1cCORTE dtd-cargo")" != "CORTE dtd-cargo" ]]; then paso=$((paso + 1)); echo "PASÓ  · control rojo: la clase vieja deja «[>0;10;1c» delante"
else fallo=$((fallo + 1)); echo "FALLÓ · control rojo: la clase vieja ya limpiaba la DA2 (la prueba no prueba nada)"; fi

echo "RESULTADO: ${paso} PASÓ · ${fallo} FALLÓ"
(( fallo == 0 ))

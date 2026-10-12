#!/usr/bin/env bash
# infra/ops/tests/prueba-new-age-key.sh — prueba de backup/new-age-key.sh (SDD-0505).
# Destinatarios en un directorio temporal: no toca /srv/ops/backup. Corre en el VPS
# (las secciones 4 y 5 usan un servidor tmux propio, -L zz-nk).
set -uo pipefail
S="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NK="${S}/backup/new-age-key.sh"
TM=(tmux -L zz-nk)
T="$(mktemp -d)"; trap '"${TM[@]}" kill-server 2>/dev/null; rm -rf "${T}"' EXIT
pass=0; fail=0
ok() { echo "PASÓ  · $*"; pass=$((pass+1)); }
ko() { echo "FALLÓ · $*"; fail=$((fail+1)); }
D="${T}/age-recipients.txt"
antes_shm="$(ls /dev/shm | grep -c '^age-key-' || true)"

# Corre new-age-key.sh como lo haría Sam: lee la privada de la pantalla y contesta.
# $1 = log, $2 = nombre, $3… = respuestas a pegar después de ver la llave; la
# palabra LLAVE se reemplaza por la privada leída. Deja la privada en PRIV.
correr() {
  local log="$1" nombre="$2"; shift 2
  mkfifo "${T}/in" "${T}/out"
  bash "${NK}" --destinatarios "${D}" --nombre "${nombre}" < "${T}/in" > "${T}/out" 2>&1 &
  local pid=$!
  exec 7>"${T}/in" 8<"${T}/out"
  PRIV=""
  local linea
  while IFS= read -r -t 30 linea <&8; do
    echo "${linea}" >> "${log}"
    [[ "${linea}" == AGE-SECRET-KEY-* ]] && PRIV="${linea}"
    [[ -n "${PRIV}" && "${linea}" == *"No la mandes por chat"* ]] && break
  done
  local r
  printf '\n' >&7
  for r in "$@"; do [[ "${r}" == LLAVE ]] && r="${PRIV}"; printf '%s\n' "${r}" >&7; done
  # La escritura queda abierta hasta que el script termine: el script reabre
  # /dev/stdin en cada pregunta, y abrir un FIFO sin escritor se queda esperando.
  cat <&8 >> "${log}"
  exec 7>&- 8<&-
  wait "${pid}"; local rc=$?
  rm -f "${T}/in" "${T}/out"
  return "${rc}"
}

# 1. Tres pegados que no coinciden: no agrega nada.
correr "${T}/m.log" prueba mala otra AGE-SECRET-KEY-1NOESESTA; rc=$?
[ $rc -eq 2 ] && [ ! -f "${D}" ] && grep -q 'no coincide' "${T}/m.log" && ok "llave mal pegada 3 veces: rechaza (2) y no agrega nada" || { ko "mal pegada rc=$rc"; tail -3 "${T}/m.log"; }

# 2. Un pegado malo y después el bueno.
correr "${T}/b.log" prueba mala LLAVE; rc=$?
priv="${PRIV}"
[ -n "${priv}" ] && ok "la privada se mostró una vez" || ko "no se vio la privada"
[ $rc -eq 0 ] && grep -q 'coincide: perfecto' "${T}/b.log" && grep -q 'intento 1' "${T}/b.log" && ok "un pegado malo y después el bueno: guarda" || { ko "camino bueno rc=$rc"; tail -4 "${T}/b.log"; }
[ -n "$(grep '^age1' "${D}" 2>/dev/null)" ] && [ "$(stat -c %a "${D}")" = 600 ] && ok "la pública quedó en el archivo de destinatarios (600)" || ko "no quedó la pública"
grep -q 'AGE-SECRET-KEY' "${D}" && ko "la privada quedó en el archivo de destinatarios" || ok "la privada NO quedó en el archivo de destinatarios"
[ "$(ls /dev/shm | grep -c '^age-key-' || true)" = "${antes_shm}" ] && ok "no quedó nada en /dev/shm" || ko "quedó age-key-* en /dev/shm"
printf '%s\n' "${priv}" > "${T}/priv.txt"
echo "respaldo de prueba" | age -R "${D}" | age -d -i "${T}/priv.txt" 2>/dev/null | grep -q 'respaldo de prueba' && ok "lo cifrado con la pública se abre con la privada guardada" || ko "la pareja no funciona"

# 3. Segunda llave: se agrega sin pisar la primera.
correr "${T}/s.log" segunda LLAVE
[ "$(grep -c '^age1' "${D}")" = 2 ] && ok "una segunda llave se agrega sin pisar la primera" || ko "destinatarios: $(grep -c '^age1' "${D}")"

# 4. Por una terminal de verdad (tmux), como la usa Sam: Ctrl+C en las dos preguntas.
pantalla() { "${TM[@]}" capture-pane -p -J -t "$1" 2>/dev/null; }
historial() { "${TM[@]}" capture-pane -p -J -S - -t "$1" 2>/dev/null; }
esperar() { local i; for i in $(seq 1 75); do pantalla "$1" | grep -qF "$2" && return 0; sleep 0.2; done; return 1; }
ver() { pantalla "$1" | sed -E "s/AGE-SECRET-KEY-[A-Z0-9]*/[LLAVE OCULTA]/g" | tail -4; }
vivo() { local p; p="$("${TM[@]}" display -p -t "$1" '#{pane_pid}' 2>/dev/null)" && [ -n "${p}" ] && kill -0 "${p}" 2>/dev/null; }
D2="${T}/tmux-recipients.txt"
"${TM[@]}" new -d -s k -x 200 -y 50 bash "${NK}" --destinatarios "${D2}" --nombre tmux
if esperar k "No la mandes por chat"; then
  "${TM[@]}" send-keys -t k C-c
  esperar k "Ctrl+C aquí no copia" && vivo k && ok "Ctrl+C con la llave en pantalla: avisa cómo copiar y no cierra" || { ko "Ctrl+C cerró la ventana o no avisó"; ver k; }
  priv2="$(pantalla k | grep -o 'AGE-SECRET-KEY-[A-Z0-9]*' | head -1)"
  "${TM[@]}" send-keys -t k Enter
  esperar k "Pega aquí" && ! historial k | grep -q 'AGE-SECRET-KEY' && ok "al pulsar Enter la privada sale de la pantalla y del historial de tmux" || ko "la privada sigue en pantalla o en el historial"
  "${TM[@]}" send-keys -t k -l "a medias"; "${TM[@]}" send-keys -t k C-c
  esperar k "Lo que habías pegado se borró" && vivo k && ok "Ctrl+C al pegar: avisa y sigue esperando" || ko "Ctrl+C al pegar cerró o no avisó"
  "${TM[@]}" send-keys -t k -l "${priv2}"; "${TM[@]}" send-keys -t k Enter
  if esperar k "coincide: perfecto" && ! pantalla k | grep -q 'intento 1' && grep -q '^age1' "${D2}" && ! grep -q 'AGE-SECRET-KEY' "${D2}"; then
    ok "lo pegado antes del Ctrl+C no cuenta como intento; con la llave entera guarda solo la pública"
  else ko "después del Ctrl+C no guardó bien"; ver k; fi
  "${TM[@]}" send-keys -t k Enter
else ko "no apareció la llave en tmux"; ver k; fi

# 5. Cortar con la llave en pantalla (Ctrl+D): limpia y dice que no se guardó.
D3="${T}/cancel-recipients.txt"
"${TM[@]}" new -d -s c -x 200 -y 50 bash "${NK}" --destinatarios "${D3}" --nombre cancelada
if esperar c "No la mandes por chat"; then
  "${TM[@]}" send-keys -t c C-d
  if esperar c "La llave NO se guardó" && ! historial c | grep -q 'AGE-SECRET-KEY' && [ ! -f "${D3}" ]; then
    ok "cortada con la llave en pantalla: limpia la pantalla, avisa que no se guardó y no agrega nada"
  else ko "corte con la llave en pantalla"; ver c; fi
  "${TM[@]}" send-keys -t c Enter
else ko "no apareció la llave en tmux (corte)"; fi
sleep 1
[ "$(ls /dev/shm | grep -c '^age-key-' || true)" = "${antes_shm}" ] && ok "tras las corridas en tmux no quedó nada en /dev/shm" || ko "quedó age-key-* en /dev/shm tras tmux"
echo "RESULTADO: ${pass} PASÓ · ${fail} FALLÓ"
[ "${fail}" = 0 ]

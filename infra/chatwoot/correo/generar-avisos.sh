#!/usr/bin/env bash
# SDD-0583 · genera las plantillas liquid de avisos (agentes, canales y correo de prueba) con
# el mismo bloque visual que devise/mailer/_dtd_aviso.html.erb. Liquid no tiene parciales en
# Chatwoot, por eso se generan: se edita AQUÍ y se vuelve a correr; no a mano en views/.
# Uso (desde la raíz del repo): bash infra/chatwoot/correo/generar-avisos.sh
set -euo pipefail
V="$(cd "$(dirname "$0")" && pwd)/views"

# aviso <archivo> <cabecera> <etiqueta> <titulo> <boton> <detalles> <parrafo>...
#   detalles: líneas «Nombre|valor liquid»; vacío = sin recuadro. boton vacío = sin botón.
aviso() {
  local f="$V/$1" cab="$2" et="$3" ti="$4" bo="$5" de="$6"; shift 6
  local n=$# i=0
  mkdir -p "$(dirname "$f")"
  {
    printf '{%% comment %%}%s Generado por correo/generar-avisos.sh.{%% endcomment %%}\n' "$cab"
    cat <<EOF
<tr>
  <td style="padding: 0 0 16px;">
    <span style="display: inline-block; padding: 6px 12px; border-radius: 999px; background-color: #F2F0EC; color: #7F0F1A; font-size: 12px; line-height: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">$et</span>
  </td>
</tr>
<tr>
  <td style="padding: 0 0 14px;">
    <h1 class="dtd-titulo" style="margin: 0; font-size: 32px; line-height: 38px; font-weight: 800; color: #0F1E3D;">$ti</h1>
  </td>
</tr>
EOF
    for p in "$@"; do
      i=$((i + 1))
      local pad=10px color='#333333'
      [ "$i" -eq "$n" ] && pad=20px
      [ "$i" -eq 1 ] && color='#0F1E3D'
      cat <<EOF
<tr>
  <td style="padding: 0 0 $pad;">
    <p style="margin: 0; font-size: 15px; line-height: 23px; color: $color;">$p</p>
  </td>
</tr>
EOF
    done
    if [ -n "$de" ]; then
      cat <<EOF
<tr>
  <td style="padding: 0 0 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width: 100%; border: 1px solid #E8E6E2; border-radius: 16px; background-color: #FBFAF7;" bgcolor="#FBFAF7">
EOF
      local primero=1 nombre valor borde
      while IFS='|' read -r nombre valor; do
        borde=''
        [ "$primero" -eq 1 ] || borde=' border-top: 1px solid #E8E6E2;'
        primero=0
        cat <<EOF
      <tr>
        <td style="padding: 16px 18px;$borde">
          <p style="margin: 0 0 4px; font-size: 12px; line-height: 16px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #6B6B6B;">$nombre</p>
          <p style="margin: 0; font-size: 15px; line-height: 21px; font-weight: 600; color: #0F1E3D;">$valor</p>
        </td>
      </tr>
EOF
      done <<< "$de"
      cat <<EOF
    </table>
  </td>
</tr>
EOF
    fi
    if [ -n "$bo" ]; then
      cat <<EOF
{% if action_url != nil and action_url != '' %}
<tr>
  <td style="padding: 0 0 20px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width: 100%; margin: 0;">
      <tr>
        <td bgcolor="#7F0F1A" style="border-radius: 14px; background-color: #7F0F1A;">
          <a href="{{ action_url }}" style="display: block; width: 100%; box-sizing: border-box; padding: 14px 24px; font-size: 15px; line-height: 20px; font-weight: 700; color: #FFFFFF; text-align: center; text-decoration: none; border-radius: 14px;">$bo</a>
        </td>
      </tr>
    </table>
  </td>
</tr>
<tr>
  <td style="padding: 0 0 20px;">
    <p style="margin: 0; font-size: 14px; line-height: 21px; color: #6B6B6B;">Si el botón no funciona, abre <a href="{{ action_url }}" style="color: #7F0F1A; font-weight: 600; text-decoration: none;">este enlace seguro</a>.</p>
  </td>
</tr>
{% endif %}
EOF
    fi
  } > "$f"
}

AG=agent_notifications/conversation_notifications_mailer
MIN='SDD-0583 · aviso a agentes. Por minimización (revisar-datos-ve) no lleva el nombre del contacto ni el texto de los mensajes: se leen en el chat.'
HOLA='Hola, {{ user.available_name | escape }}:'
CONV='Conversación|#{{ conversation.display_id }}
Bandeja|{{ inbox.name | escape }}'

aviso "$AG/conversation_creation.liquid" "$MIN" 'Conversación nueva' \
  'Llegó una conversación nueva' 'Abrir conversación' "$CONV" \
  "$HOLA" 'Un cliente escribió por primera vez. Ábrela en el chat para leer el mensaje y responder.'

aviso "$AG/conversation_assignment.liquid" "$MIN" 'Conversación asignada' \
  'Te asignaron una conversación' 'Abrir conversación' "$CONV" \
  "$HOLA" 'Tienes una conversación nueva a tu cargo. Ábrela en el chat para leerla y responder al cliente.'

aviso "$AG/conversation_mention.liquid" "$MIN" 'Mención' \
  'Te mencionaron en una conversación' 'Ver mención' \
  "Te mencionó|{{ message.sender_display_name | escape }}
$CONV" \
  "$HOLA" 'Un compañero te mencionó en una nota interna. Ábrela en el chat para leerla.'

aviso "$AG/assigned_conversation_new_message.liquid" "$MIN" 'Mensaje nuevo' \
  'Tu cliente te escribió de nuevo' 'Abrir conversación' "$CONV" \
  "$HOLA" 'Llegó un mensaje nuevo en una conversación asignada a ti. Ábrela en el chat para responder.'

aviso "$AG/participating_conversation_new_message.liquid" "$MIN" 'Mensaje nuevo' \
  'Mensaje nuevo en una conversación' 'Abrir conversación' "$CONV" \
  "$HOLA" 'Llegó un mensaje nuevo en una conversación en la que participas. Ábrela en el chat para verlo.'

CH=administrator_notifications/channel_notifications_mailer
CAN='SDD-0583 · aviso a administradores: un canal dejó de recibir mensajes.'
canal() {
  aviso "$CH/$1_disconnect.liquid" "$CAN" 'Canal desconectado' "$2" "$3" '' \
    'Hola:' "$4 Mientras no se arregle, <strong>no llegan mensajes nuevos</strong> por ese canal." "$5"
}
canal whatsapp 'Se venció la conexión de WhatsApp' 'Volver a conectar WhatsApp' \
  'La conexión de WhatsApp de una bandeja del chat de DTD Cargo venció.' 'Entra a la configuración de la bandeja y conéctala de nuevo.'
canal instagram 'Se venció la conexión de Instagram' 'Volver a conectar Instagram' \
  'La conexión de Instagram de una bandeja del chat de DTD Cargo venció.' 'Entra a la configuración de la bandeja y conéctala de nuevo.'
canal facebook 'Se venció la conexión de Facebook' 'Volver a conectar Facebook' \
  'La conexión de la página de Facebook de una bandeja del chat de DTD Cargo venció.' 'Entra a la configuración de la bandeja y conéctala de nuevo.'
canal email 'Se desconectó una bandeja de correo' 'Revisar la bandeja' \
  'Una bandeja de correo del chat de DTD Cargo se desconectó por un error en su configuración (SMTP o IMAP).' 'Entra a la configuración de la bandeja y actualiza los datos de conexión.'

aviso email_delivery_test_mailer/delivery_test.liquid 'SDD-0583 · correo de prueba que se manda desde /super_admin.' 'Prueba' \
  'Correo de prueba de DTD Cargo' '' '' \
  'Hola, {{ recipient_name | escape }}:' 'Te mandamos este correo para comprobar que los avisos del chat de DTD Cargo llegan a tu bandeja. Si lo estás leyendo, todo está bien: no tienes que hacer nada.'

echo "listo: $V"

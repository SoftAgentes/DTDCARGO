# frozen_string_literal: true

# Marca de DTD Cargo en Chatwoot (SDD-0583, paso 1.3; «Autorizo la marca» de Sam, 2026-10-29).
#   docker compose cp aplicar-marca.rb rails:/tmp/marca.rb
#   docker compose exec -T rails bundle exec rails runner /tmp/marca.rb
#
# Escribe en InstallationConfig (la base manda sobre el entorno) y limpia la caché de
# GlobalConfig. ConfigLoader corre en cada `prepare` con reconcile_only_new: true
# (lib/config_loader.rb), así que no vuelve a poner los valores de Chatwoot.
# Los PNG son copias sin tocar de public/brand/ del repo, montados en /app/public/dtd-marca
# (compose.yml). Reglas de BRAND.md: primary sobre claro, reverse sobre oscuro; no hay
# variantes nuevas. Con DISPLAY_MANIFEST=false, vueapp.html.erb no pone los favicons de
# Chatwoot y el ícono de la pestaña sale de LOGO_THUMBNAIL.
# LOGO_THUMBNAIL (2026-11-23, pedido de Sam): el chat tiene su propio ícono, el de
# «Conversaciones» que ya usa en Discord (`marca/chat-conversaciones.png`, 512×512, sha256
# 0de7890d…). Sale en la pestaña y en el logo chico del panel; LOGO y LOGO_DARK siguen con el
# isólogo de DTD. `apple-touch-icon.png` queda en marca/ para volver atrás.
# Lo que la edición CE no permite cambiar: el «Powered by Chatwoot» del widget y de los
# correos (disable_branding es premium).

MARCA = {
  'INSTALLATION_NAME' => 'DTD Cargo',
  'BRAND_NAME' => 'DTD Cargo',
  'BRAND_URL' => 'https://dtdcargo.com',
  'WIDGET_BRAND_URL' => 'https://dtdcargo.com',
  'TERMS_URL' => 'https://dtdcargo.com/terminos',
  'PRIVACY_URL' => 'https://dtdcargo.com/privacidad',
  'DISPLAY_MANIFEST' => false,
  'LOGO_THUMBNAIL' => '/dtd-marca/chat-conversaciones.png',
  'LOGO' => '/dtd-marca/dtdcargo-isologo-primary.png',
  'LOGO_DARK' => '/dtd-marca/dtdcargo-isologo-reverse.png'
}.freeze

# Candado (revisión de la #796): antes de escribir nada, el ícono que va a LOGO_THUMBNAIL tiene
# que existir en el montaje (/srv/chatwoot/marca → /app/public/dtd-marca) y ser el del repo.
# Si falta o su sha256 no empieza por 0de7890d, sale con 1 sin cambiar ninguna clave.
require 'digest'
ICONO_CHAT = '/app/public/dtd-marca/chat-conversaciones.png'
ICONO_CHAT_SHA256 = '0de7890d'
unless File.file?(ICONO_CHAT)
  puts "OUT ABORTA: falta #{ICONO_CHAT}; no se cambió nada"
  exit 1
end
huella = Digest::SHA256.file(ICONO_CHAT).hexdigest
unless huella.start_with?(ICONO_CHAT_SHA256)
  puts "OUT ABORTA: #{ICONO_CHAT} tiene sha256 #{huella[0, 8]}…, se esperaba #{ICONO_CHAT_SHA256}…; no se cambió nada"
  exit 1
end
puts "OUT icono del chat verificado (sha256 #{huella[0, 8]}…)"

MARCA.each do |nombre, valor|
  config = InstallationConfig.find_or_initialize_by(name: nombre)
  antes = config.value
  config.value = valor
  config.save!
  puts "OUT #{nombre}: #{antes.inspect} -> #{config.reload.value.inspect}"
end
GlobalConfig.clear_cache
puts "OUT cache limpia; BRAND_NAME efectivo=#{GlobalConfig.get('BRAND_NAME')['BRAND_NAME'].inspect}"

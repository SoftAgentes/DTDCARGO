# frozen_string_literal: true

# Marca de DTD Cargo en Chatwoot (SDD-0583, paso 1.3; «Autorizo la marca» de Sam, 2026-10-29).
#   docker compose cp marca/aplicar-marca.rb rails:/tmp/marca.rb
#   docker compose exec -T rails bundle exec rails runner /tmp/marca.rb
#
# Escribe en InstallationConfig (la base manda sobre el entorno) y limpia la caché de
# GlobalConfig. ConfigLoader corre en cada `prepare` con reconcile_only_new: true
# (lib/config_loader.rb), así que no vuelve a poner los valores de Chatwoot.
# Los PNG son copias sin tocar de public/brand/ del repo, montados en /app/public/dtd-marca
# (compose.yml). Reglas de BRAND.md: primary sobre claro, reverse sobre oscuro; no hay
# variantes nuevas. Con DISPLAY_MANIFEST=false, vueapp.html.erb no pone los favicons de
# Chatwoot y el ícono de la pestaña sale de LOGO_THUMBNAIL.
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
  'LOGO_THUMBNAIL' => '/dtd-marca/apple-touch-icon.png',
  'LOGO' => '/dtd-marca/dtdcargo-isologo-primary.png',
  'LOGO_DARK' => '/dtd-marca/dtdcargo-isologo-reverse.png'
}.freeze

MARCA.each do |nombre, valor|
  config = InstallationConfig.find_or_initialize_by(name: nombre)
  antes = config.value
  config.value = valor
  config.save!
  puts "OUT #{nombre}: #{antes.inspect} -> #{config.reload.value.inspect}"
end
GlobalConfig.clear_cache
puts "OUT cache limpia; BRAND_NAME efectivo=#{GlobalConfig.get('BRAND_NAME')['BRAND_NAME'].inspect}"

# frozen_string_literal: true

# Verificación del stack restaurado (SDD-0583, paso 1.5). Corre con `rails runner`.
# Imprime las mismas huellas que sembrar.rb; ensayo-local.sh las compara.
#
# Ojo: Chatwoot 4.19.1 configura `support_unencrypted_data = true`
# (config/application.rb:80). Con claves equivocadas NO lanza error: devuelve el texto
# cifrado como si fuera el valor. Por eso se compara la huella y además se dice si lo
# leído es el sobre cifrado (`{"p":…`).

require 'digest'

blob = ActiveStorage::Blob.find_by(filename: 'adjunto-sintetico.txt')
puts "huella_adjunto=#{blob ? Digest::SHA256.hexdigest(blob.download) : 'sin-blob'}"

begin
  secreto = Webhook.find_by!(url: 'https://webhook-sintetico.example.test/hook').secret.to_s
  puts "huella_secreto=#{Digest::SHA256.hexdigest(secreto)}"
  puts "secreto_es_sobre_cifrado=#{secreto.start_with?('{"p":') ? 'si' : 'no'}"
rescue ActiveRecord::Encryption::Errors::Decryption => e
  puts "huella_secreto=ilegible (#{e.class})"
end

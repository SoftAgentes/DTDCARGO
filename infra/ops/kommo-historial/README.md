# infra/ops/kommo-historial — respaldo cifrado y medición del historial de Kommo (SDD-0590, E5 de la 0582)

`respaldar-historial.py` lee la API v4 de Kommo con el token de la integración privada
«DTD 0582 historial (solo lectura)» (alcances `crm` y `list_external_messages`, X-10–X-12 del
[registro E0](../../../docs/specs/0582-chatwoot-piloto/investigacion-2026-10-29-e0.md)), guarda
todo cifrado con `age` fuera de Git y produce un informe con **solo conteos**. Kommo no tiene
exportación nativa de chats (K-20), así que este script es el respaldo.

Corre en el VPS (`/srv/ops/kommo-historial/`), con Python 3.12 de serie y `age`, `zstd` y `tar`
del host. No tiene dependencias de Python.

## Reglas que cumple

| Regla | Cómo |
|---|---|
| El token no se imprime ni viaja por el chat | Se lee de un archivo 0600 en `/dev/shm` (`--token-file`); nunca va en argv; `probar-token` muestra solo largo, alcances, días de vigencia y si entra a la cuenta |
| Nada en claro en disco | El staging vive en tmpfs (`/dev/shm/kommo-e5`); los adjuntos se descargan a memoria y se cifran uno por uno; al empaquetar, el staging se borra |
| En disco solo `.age`, `.sha256`, `manifiesto.json` e informes de conteos | `/srv/backups/kommo/kommo-<stamp>/` |
| Log y pantalla sin datos personales | Ids, conteos, códigos HTTP, nombres de campo y hosts; nunca texto, nombres, teléfonos ni enlaces firmados. La prueba `test_extraccion_informe_y_sin_datos_personales` lo comprueba con marcas |
| Solo lectura en Kommo | Solo `GET` |
| Reanudable | Cada entidad, ventana de eventos y conversación quedan marcadas en el staging; repetir el mismo comando sigue donde iba. El fin de las ventanas de eventos se fija en la primera corrida (`eventos-hasta.txt`): al reanudar horas después no se vuelven a bajar, solo se añade una ventana de cola desde esa hora, y los eventos repetidos se descartan por `id` al leer |
| Un 403 en una conversación no tumba la corrida | Kommo responde 403 «Not enough rights» en conversaciones sueltas que el usuario de la integración no ve (la 4718 en la corrida de 2026-10-31). Se anotan en `talks-sin-acceso` / `mensajes-sin-acceso`, salen en el informe y se sigue; un 401, o un 403 en una lista o en `/account`, sigue siendo fatal |
| Descifra solo Sam | `age -R /srv/ops/backup/age-recipients.txt` (claves públicas de los respaldos: Sam y emergencia). La privada nunca está en el VPS ni en Git |

## Qué respalda

| Archivo dentro del paquete | Origen | Para qué |
|---|---|---|
| `cuenta.json`, `usuarios.ndjson`, `embudos.json`, `campos-*.ndjson` | `/account`, `/users`, `/leads/pipelines`, `/*/custom_fields` | Contexto: autores, etapas y campos |
| `contactos.ndjson`, `leads.ndjson`, `empresas.ndjson`, `no-clasificados.ndjson` | `/contacts`, `/leads`, `/companies`, `/leads/unsorted` (páginas de 250 hasta el 204) | Contactos de las conversaciones y leads para 6.5 |
| `notas-*.ndjson`, `tareas.ndjson` | `/*/notes`, `/tasks` | Notas y tareas |
| `eventos.ndjson` | `/events` con `incoming_chat_message` y `outgoing_chat_message`, en ventanas de 30 días desde la creación de la cuenta | Enumeración de conversaciones (método de 0.6, X-4) |
| `talks.ndjson`, `mensajes.ndjson` | `/talks/{id}` y `/talks/{id}/messages` (`limit=250`, `page` hasta el 204, X-15) | El historial |
| `adjuntos.ndjson` + `adjuntos/<message_id>.<ext>.age` | `attachment.link` de cada mensaje | Adjuntos; en el NDJSON van tamaño, sha256, HTTP y host |
| `huecos-sondeo.json`, `talks-indice.json` | ids sin eventos sondeados con `/talks/{id}` | Completitud de la enumeración |
| `informe.json`, `informe.md` | `informe` | Conteos de 5.2 (también quedan en claro junto al paquete) |

## Procedimiento (5.1)

1. **Copiar al VPS** (desde el worktree):
   `C:\Windows\System32\OpenSSH\scp.exe -r infra/ops/kommo-historial root@217.216.54.70:/srv/ops/`
2. **Pruebas en el VPS:** `python3 -I /srv/ops/kommo-historial/pruebas/test_respaldar.py` (36 pruebas desde la 1.2.0; con `age` y `zstd` corre también el round-trip de cifrado).
3. **Token:** Sam entra a Kommo → Ajustes → Integraciones → «DTD 0582 historial (solo lectura)» → Claves y alcances → **Token de larga duración** → Generar → Copiar, y lo pega con `pegar-token-kommo-e5-0582.ps1` (está en las notas compartidas de la sesión, no en Git). El token queda en `/dev/shm/k0582-e5` (0600) y el script lo comprueba al vuelo:
   `python3 -I respaldar-historial.py probar-token --token-file /dev/shm/k0582-e5`
4. **Ensayo corto** (20 conversaciones, 2 ventanas de eventos, round-trip con llave efímera, todo en tmpfs):
   ```sh
   python3 -I /srv/ops/kommo-historial/respaldar-historial.py todo --token-file /dev/shm/k0582-e5 \
     --staging /dev/shm/kommo-e5-ensayo --destino /dev/shm/kommo-e5-ensayo-destino \
     --max-talks 20 --max-eventos-ventanas 2 --sondear-huecos 20 --verificar-efimera \
     --log /dev/shm/kommo-e5-ensayo.log
   rm -rf /dev/shm/kommo-e5-ensayo /dev/shm/kommo-e5-ensayo-destino /dev/shm/kommo-e5-ensayo.log
   ```
5. **Corrida completa**, en segundo plano para que sobreviva a la sesión SSH:
   ```sh
   systemd-run --unit kommo-e5-respaldo --collect --same-dir -p Nice=10 \
     python3 -I /srv/ops/kommo-historial/respaldar-historial.py todo --token-file /dev/shm/k0582-e5 \
     --staging /dev/shm/kommo-e5 --destino /srv/backups/kommo --sondear-huecos -1 \
     --log /srv/backups/kommo/respaldo.log
   journalctl -u kommo-e5-respaldo -f        # o: tail -f /srv/backups/kommo/respaldo.log
   ```
   Si se corta, repetir el mismo comando: reanuda sin volver a bajar las ventanas de eventos ni las conversaciones ya hechas. Dura del orden de horas (una petición cada 0,25 s; Kommo admite 7/s pero el ERP también usa la cuenta).
6. **Al terminar:** comprobar `manifiesto.json` y los `.sha256`, borrar el token (`rm -f /dev/shm/k0582-e5`), comprobar que `/dev/shm/kommo-e5` no existe y copiar `informe.md` a `docs/specs/0590-kommo-historial-e5/`.
7. **Al cerrar E5:** revocar la integración en Kommo (0.6).

## Incremental hasta un instante de corte (5.3)

Baja solo lo que cambió desde un respaldo anterior, hasta un **instante de corte fijo y ya pasado**. Sirve
para ponerse al día antes de cargar (5.5) y, en el corte de E8, para el último tramo. **Cada corrida contra
Kommo necesita el token, que pega Sam, y su OK.**

```sh
python3 -I /srv/ops/kommo-historial/respaldar-historial.py todo --token-file /dev/shm/k0582-e5 \
  --base /srv/backups/kommo/kommo-20261030T233814Z --corte 2026-11-20T03:00:00Z \
  --staging /dev/shm/kommo-e5-inc --destino /srv/backups/kommo --log /srv/backups/kommo/respaldo.log
```

| Qué | Cómo |
|---|---|
| Desde dónde | El corte de la base (o su stamp, si fue completa) menos `--solape-horas` (24 por defecto). Solo lee `manifiesto.json` de la base: no descifra nada |
| Hasta dónde | `--corte`, en UTC. Tiene que estar en el pasado; los mensajes posteriores no entran y quedan contados en `mensajes-despues-del-corte` |
| Eventos | Ventanas desde el inicio hasta el corte, sin ventana de cola |
| Contactos, leads, empresas, notas y tareas | Con `filter[updated_at][from]` y `[to]`. Cuenta, usuarios, embudos, campos y no clasificados van enteros: son chicos |
| Conversaciones | Las que tuvieron eventos en la ventana, con todos sus mensajes hasta el corte. La carga quita repetidos por id |
| Adjuntos | Solo de mensajes desde el inicio: los anteriores ya están en la base |
| Sondeo de huecos | No: lo hizo el respaldo completo |
| Idempotencia | El staging guarda base, inicio y corte en `incremental.json`. Repetir el comando no vuelve a pedir lo hecho; otro corte u otra base sobre el mismo staging es un error |
| Encadenar | El manifiesto del paquete lleva `incremental` con base, inicio y corte. Ese paquete sirve de `--base` del siguiente, que empieza en su corte |

## Hasta el corte, vínculo con el ERP y archivo de carga (5.4 y 5.5)

El servidor no puede leer los paquetes `.age`: las llaves privadas no están ahí. Por eso la carga al
«Archivo Kommo» sale de un staging en claro en tmpfs, armado en la misma ventana. **Cada paso con datos
reales espera el OK de Sam, uno por uno.**

```sh
# 1. Completa hasta el corte, conservando el staging (sin --base)
python3 -I respaldar-historial.py extraer --token-file /dev/shm/k0582-e5 --corte 2026-11-20T03:00:00Z \
  --staging /dev/shm/kommo-e5-carga --destino /srv/backups/kommo --sondear-huecos -1
# 2. Vínculo con el ERP: la foto mínima (client_id, phone_last10, correos) en /dev/shm; se borra al leerla
python3 -I respaldar-historial.py vincular --staging /dev/shm/kommo-e5-carga --clientes /dev/shm/clientes-erp.ndjson
# 3. Archivo de carga reducido
python3 -I respaldar-historial.py preparar-carga --staging /dev/shm/kommo-e5-carga
# 4. Cargador de Rails: el script se copia al contenedor; los datos entran por la entrada estándar
docker cp cargar-archivo-kommo.rb chatwoot-rails-1:/tmp/cargar-archivo-kommo.rb
docker exec -e MODO=crear-bandeja -e CUENTA=1 -e 'NOMBRE=Archivo Kommo' chatwoot-rails-1 \
  bundle exec rails runner /tmp/cargar-archivo-kommo.rb                       # deja HECHO bandeja=<id>
docker exec -i -e MODO=seco -e CUENTA=1 -e BANDEJA=<id> -e CARGA=- chatwoot-rails-1 \
  bundle exec rails runner /tmp/cargar-archivo-kommo.rb < /dev/shm/kommo-e5-carga/carga.ndjson
#    y después lo mismo con MODO=cargar
# 5. Cifrar y borrar el staging
python3 -I respaldar-historial.py empaquetar --staging /dev/shm/kommo-e5-carga --destino /srv/backups/kommo
```

`cargar-archivo-kommo.rb` escribe con `insert_all`, sin callbacks: ni webhooks, ni notificaciones, ni envíos.
Rechaza una bandeja con `webhook_url` o de otra cuenta, reusa contactos por teléfono o correo y no duplica en
la segunda corrida. `MODO=seco` solo cuenta, sin consumir números de conversación. La salida son solo conteos
(`HECHO clave=valor`).

Prueba local en Docker, con datos inventados y la imagen real (una corrida pesada: pide turno):
`bash infra/ops/kommo-historial/pruebas/prueba-cargador.sh`. Mide E-3 y E-6 a E-11 (SDD-0590 §10.4) y para
sola si el commit libre de Windows baja de 3 GB.

| Paso | Qué deja | Con datos de personas |
|---|---|---|
| `extraer --corte` | Staging completo hasta el corte, `corte.json`; el manifiesto lleva `corte` y sirve de base a un incremental | Sí: queda en tmpfs |
| `vincular` | `vinculos.ndjson`: E.164, llave `phone_last10`, correos, cliente del ERP, motivo y grupo. `vinculo-informe.json`: solo conteos, con las mediciones E-1 y E-2 del ensayo | `vinculos.ndjson` sí; el informe no |
| `preparar-carga` | `carga.ndjson`: persona por grupo, conversación y mensaje con texto, sentido, fecha y autor (cliente, nombre de pila o «Bot Kommo»). Sin `avatar_url` ni campos propios de Kommo. `carga-informe.json`: solo conteos | `carga.ndjson` sí; el informe no |

## Restaurar (Sam, en su PC, con su llave privada)

```sh
age -d -i llave-de-respaldos.txt kommo-<stamp>-metadatos.tar.zst.age | tar --zstd -x   # NDJSON en claro: tratar como datos personales
age -d -i llave-de-respaldos.txt adjuntos/<message_id>.<ext>.age > <message_id>.<ext>
sha256sum -c kommo-<stamp>-metadatos.tar.zst.age.sha256
```

Cada línea de `mensajes.ndjson` es el mensaje tal como lo da Kommo más `_talk_id`; cada línea de
`talks.ndjson` es `{"_http", "_talk_id", "talk"}`. Los adjuntos se cruzan por `message_id` en
`adjuntos.ndjson`.

## Opciones útiles

| Opción | Para qué |
|---|---|
| `--desde YYYY-MM-DD` | Enumerar eventos desde esa fecha en vez de la creación de la cuenta |
| `--corte-ventanas-vacias N` | Parar la enumeración tras N ventanas de 30 días sin eventos (por defecto no para) |
| `--sondear-huecos N` | Probar N ids de conversación que no aparecen en los eventos; `-1` prueba todos. Los que existen entran al respaldo |
| `--sin-adjuntos` | Solo metadatos |
| `--tope-adjunto-mb` | Tope por adjunto (200 MB por defecto); los que pasan quedan anotados como `demasiado-grande` |
| `--pausa` | Segundos entre peticiones (0,25 por defecto) |
| `--conservar-staging` | No borrar el tmpfs al empaquetar (para repetir `informe`) |
| `--verificar-efimera` | Solo ensayos: cifra también para una llave efímera y descifra para comprobar el paquete |
| `--base` y `--corte` | Modo incremental (5.3): ver arriba |
| `--solape-horas` | Horas antes del corte anterior desde donde el incremental vuelve a mirar (24 por defecto) |

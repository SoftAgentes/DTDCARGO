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
| Nada en claro en disco | El staging vive en tmpfs (`/dev/shm/kommo-e5`); los adjuntos se descargan a memoria y se cifran uno por uno (con `--adjuntos-para-carga`, además una copia en claro en ese mismo tmpfs para el cargador); al empaquetar, el staging se borra |
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
2. **Pruebas en el VPS:** `python3 -I /srv/ops/kommo-historial/pruebas/test_respaldar.py` (61 pruebas desde la 1.3.2, entre ellas la de solo lectura: ningún método distinto de GET; con `age` y `zstd` corre también el round-trip de cifrado).
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
  --staging /dev/shm/kommo-e5-carga --destino /srv/backups/kommo --sondear-huecos -1 \
  --adjuntos-para-carga        # 5.5b: además del .age, copia en claro de cada adjunto en el staging (0600)
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
# 4b. Adjuntos (5.5b), después de cargar los mensajes: base64 por la entrada estándar, nunca copiados al contenedor
python3 -I respaldar-historial.py flujo-adjuntos --staging /dev/shm/kommo-e5-carga 2>flujo.err \
  | docker exec -i -e MODO=adjuntos -e CUENTA=1 -e BANDEJA=<id> -e CARGA=- chatwoot-rails-1 \
      bundle exec rails runner /tmp/cargar-archivo-kommo.rb                   # MODO=adjuntos-seco solo cuenta
# 4c. Miembros del Archivo (Sam: «todo el equipo»): todos los usuarios de la cuenta, con Inbox#add_members
docker exec -e MODO=miembros-seco -e CUENTA=1 -e BANDEJA=<id> chatwoot-rails-1 \
  bundle exec rails runner /tmp/cargar-archivo-kommo.rb                       # y después MODO=miembros
# 5. Primero el informe de conteos y después cifrar y borrar el staging (las copias en claro no entran al
#    paquete y se borran con él). empaquetar se niega si falta informe.json: sin él, el manifiesto no diría
#    cuántas conversaciones quedaron fuera por 403 (pasó en la carga del 2026-11-07, SDD-0590 §10.16)
python3 -I respaldar-historial.py informe --staging /dev/shm/kommo-e5-carga --destino /srv/backups/kommo
python3 -I respaldar-historial.py empaquetar --staging /dev/shm/kommo-e5-carga --destino /srv/backups/kommo
```

`informe` deja `informe.json` e `informe.md` en el staging y una copia en la carpeta de la corrida, solo con
conteos. El manifiesto lleva el bloque `informe`: huella, fecha, `conversaciones_sin_acceso_403` y
`mensajes_sin_acceso_403`. Los ids de esas conversaciones van solo dentro del paquete cifrado.

`cargar-archivo-kommo.rb` escribe con `insert_all`, sin callbacks: ni webhooks, ni notificaciones, ni envíos.
Rechaza una bandeja con `webhook_url` o de otra cuenta, reusa contactos por teléfono o correo y no duplica en
la segunda corrida. `MODO=seco` solo cuenta, sin consumir números de conversación. La salida son solo conteos
(`HECHO clave=valor`).

`MODO=adjuntos` sube cada adjunto con `ActiveStorage::Blob.create_and_upload!` (sin identificar ni analizar) y
escribe `attachments` y `active_storage_attachments` con `insert_all`: no encola análisis ni variantes. Solo
toca mensajes del Archivo que todavía no tienen adjunto, así que repetirlo no duplica. Comprueba bytes y sha256
de cada uno antes de subirlo y, si falla la escritura, purga el blob.

`MODO=miembros` agrega como miembros del Archivo a todos los usuarios de la cuenta que todavía no lo son, con
`Inbox#add_members`, igual que el panel: no asigna, no notifica y encola solo la invalidación de caché. Se niega
si la bandeja tiene asignación automática, y no quita a nadie. `MODO=miembros-seco` solo cuenta.

Prueba con datos inventados y la imagen real: corre en GitHub Actions en cada PR que toque esta carpeta
(`.github/workflows/kommo-historial-cargador.yml`). Mide E-4 a E-11 (SDD-0590 §10.4), los adjuntos AD1 a
AD5 (§10.12) y corre el control M0 y 29 mutantes. En una PC con Docker: `bash infra/ops/kommo-historial/pruebas/prueba-cargador.sh
[--sin-mutantes]`. Es una corrida pesada, así que pide turno, y para sola si la memoria libre baja de 3 GB.

### La completa programada: `completa.sh` y `vigia-carga.sh`

En el VPS van en `/srv/ops/kommo-historial-0590b`, y los lanzan los timers `kommo-e5-completa` y `kommo-e5-vigia`
(handoff `0590-e5-estado.md` §5.3). `completa.sh` corre `extraer --corte … --adjuntos-para-carga` y no le pide
nada a Kommo si falla alguna de sus guardas:

- **código 11:** falta el token, no tiene 600 o tiene 200 bytes o menos, o su borrado programado
  (`kommo-e5-token-caduca.timer`) no está `active/waiting`, o sea, no está o ya disparó. La vida del token la fija
  ese timer;
- **código 12:** la carga pasa de 8;
- **código 13:** el extractor desplegado no entiende `--adjuntos-para-carga`.

Al terminar `extraer`, bien o mal, borra el token y para el timer. Si lo para el vigía, que corta con carga
mayor a 8, sale con 143 y el token queda para reanudar con el mismo `CORTE`. La prueba usa systemd de verdad,
con un token, unos timers y un extractor falsos: `sudo bash pruebas/prueba-completa.sh`, en el mismo workflow.
No es para correrla en el VPS, y se niega si encuentra el token real.

### Ensayo (5.6): copia efímera de la base de Chatwoot

`ensayo-archivo.sh` corre en el VPS, como root. Copia la base de Chatwoot de producción, con `pg_dump` en solo
lectura, a un stack efímero y aislado (proyecto `chatwoot-ensayo`, todo en `/dev/shm/cw-ensayo`, red interna
sin puertos). Ahí corre el cargador real y mide E-1, E-2 y E-4 a E-11 con los datos reales. Después lo borra
todo. La evidencia trae solo líneas `HECHO`.

```sh
CARGA=/dev/shm/kommo-e5-carga/carga.ndjson \
INFORME_CARGA=/dev/shm/kommo-e5-carga/carga-informe.json \
INFORME_VINCULO=/dev/shm/kommo-e5-carga/vinculo-informe.json \
STAGING=/dev/shm/kommo-e5-carga \
  bash ensayo-archivo.sh           # el ensayo; con STAGING también carga los adjuntos (5.5b)
#   además: MODO=miembros en la copia, E-10e con un usuario real, y la búsqueda con 90 días y con BUSQUEDA_DIAS
bash ensayo-archivo.sh --limpiar   # solo borra un ensayo que haya quedado
```

Guardas, diseño y revisión de datos personales: SDD-0590 §10.10 y §10.11. Se prueba en el mismo workflow,
contra una «producción» simulada: `pruebas/prueba-ensayo.sh`.

**Como unidad de systemd, con `lanzar-unidad.sh`** (§10.18). Lanza `kommo-e5-ensayo` o `kommo-e5-carga` con
`TimeoutStopSec` de 600 s, `Nice` 10 y la carpeta de trabajo, más su vigía (`<unidad>-vigia`, con el
`vigia-carga.sh` de la carpeta). Se niega si ya corre una de las dos (código 6). Con los 90 s por defecto de
systemd, un `systemctl stop` mataría la limpieza con KILL a mitad: por eso el ensayo se niega a arrancar en una
unidad con menos de 300 s (código 5).

```sh
cd /srv/ops/kommo-historial-ensayo
bash lanzar-unidad.sh --unidad kommo-e5-ensayo --dir "$PWD" \
  --env CARGA=/dev/shm/kommo-e5-carga/carga.ndjson \
  --env INFORME_CARGA=/dev/shm/kommo-e5-carga/carga-informe.json \
  --env INFORME_VINCULO=/dev/shm/kommo-e5-carga/vinculo-informe.json \
  --env STAGING=/dev/shm/kommo-e5-carga --env CUENTA=1 --tope-vigia 8 \
  -- /bin/bash "$PWD/ensayo-archivo.sh"
# La carga (5.7), con el guion de esa corrida: el mismo lanzador, y al final informe → empaquetar (paso 5)
bash lanzar-unidad.sh --unidad kommo-e5-carga --dir "$PWD" --tope-vigia 8 -- /bin/bash <guion de la carga>
```

La prueba del lanzador, con systemd de verdad, va en el mismo workflow: `sudo bash pruebas/prueba-lanzador.sh`.

**Cómo termina** (SDD-0590 §10.17). El veredicto está en el código de salida y en la última línea de la
evidencia, `HECHO ensayo_codigo=<código>`:

| Código | Qué pasó |
|---|---|
| 0 | Pasó todo y la limpieza dejó 0 contenedores, volúmenes y redes |
| 1 | Alguna comprobación falló |
| 3 | Lo paró la guarda de carga o de memoria, también en los pasos de adjuntos (§10.18) |
| 4 | Todo pasó, pero la limpieza no terminó (`FALLÓ L0`, `limpieza_completa=no`) |
| 5 | La unidad de systemd tiene `TimeoutStopSec` de menos de 300 s (`FALLÓ G1`): no arrancó ni creó nada |
| 143, 130, 129 | Lo pararon con TERM, INT o HUP (`FALLÓ PARADA`, `HECHO senal=…`) |

Como unidad de systemd, cualquier código distinto de 0 la deja en `failed`, con `Result=exit-code` y el código
en `ExecMainStatus`. El guion que corrió el 2026-11-07 (huella `c0fb3d336a135ca1`) terminaba una parada con TERM
en `Result=success`.

**Cómo pararlo.** `systemctl stop kommo-e5-ensayo` manda TERM a toda la unidad: el paso en curso recibe la
misma señal y termina enseguida, y después corre la limpieza. Es lo que hace `vigia-carga.sh`. **Un TERM solo al
proceso principal** (`systemctl kill --kill-whom=main -s TERM`, como el vigía del 2026-11-07) **espera a que termine
el paso en curso**: la carga o los adjuntos siguen hasta su final, y recién ahí para y limpia. Para cortar
enseguida, `systemctl stop`. La limpieza anota cuánto tardó (`HECHO limpieza_segundos`) y nunca toca nada fuera del proyecto
`chatwoot-ensayo`: si algo ajeno sostiene su red o su volumen, lo dice y no sale con 0; después de revisarlo,
`--limpiar`.

| Paso | Qué deja | Con datos de personas |
|---|---|---|
| `extraer --corte` | Staging completo hasta el corte, `corte.json`; el manifiesto lleva `corte` y sirve de base a un incremental | Sí: queda en tmpfs |
| `extraer --adjuntos-para-carga` | Además, `adjuntos-carga/<message_id>.<ext>` en claro (0600). Solo con `--corte`, sin `--sin-adjuntos` y con el staging en `/dev/shm` | Sí: fotos, audios y documentos, en tmpfs hasta `empaquetar` |
| `flujo-adjuntos` | Nada: manda cada adjunto en base64 por la salida estándar, después de comprobar bytes y sha256; el informe va por la salida de error | El flujo sí; el informe no |
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
| `--adjuntos-para-carga` | 5.5b: deja también una copia en claro de cada adjunto para el cargador del Archivo Kommo |
| `--tope-adjunto-mb` | Tope por adjunto (200 MB por defecto); los que pasan quedan anotados como `demasiado-grande` |
| `--pausa` | Segundos entre peticiones (0,25 por defecto) |
| `--conservar-staging` | No borrar el tmpfs al empaquetar (para repetir `informe`) |
| `--sin-informe` | `empaquetar` aunque falte `informe.json`. El manifiesto lo anota con `informe: null`. Sin la opción, se niega |
| `--verificar-efimera` | Solo ensayos: cifra también para una llave efímera y descifra para comprobar el paquete |
| `--base` y `--corte` | Modo incremental (5.3): ver arriba |
| `--solape-horas` | Horas antes del corte anterior desde donde el incremental vuelve a mirar (24 por defecto) |

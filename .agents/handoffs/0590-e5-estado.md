# SDD-0590 · E5, historial de Kommo al «Archivo Kommo»: estado y guion hasta producción (handoff)

Escrito por el Subdirector de Chatwoot el 2026-11-06 a las ~09:00Z, a pedido del Director General. Las fuentes de estado son Git, las PR y la spec `docs/specs/0590-kommo-historial-e5/spec.md`. Este handoff junta lo necesario para seguir sin la conversación.

**Estado al 2026-11-07, 11:33Z: el Archivo Kommo está cargado en producción.** El detalle, con horas, conteos y huellas, está en la spec §10.16.
- La completa terminó a las 09:26:52Z (`codigo=0`) y el token quedó borrado.
- La 5.4 corrió a las 09:33Z: E-1 = 0 y E-2 = 0.
- El ensayo (5.6) se completó en el cuarto intento, a las 10:34Z. Dio 32 PASÓ y 4 FALLÓ de la sonda de búsqueda, que el Director General aceptó como limitaciones de la sonda.
- **La carga (5.7) corrió de 10:59Z a 11:29Z, con el sí del Director General.** La bandeja 8, «Archivo Kommo», tiene 4780 conversaciones, 54.737 mensajes, 4258 contactos, 3639 adjuntos y 2 miembros, con 0 trabajos y 0 correos.
- El Director General hizo el respaldo `chatwoot-20261107T103842Z` y midió E-3 antes y después: 8 / 0 / 22 / 7, sin cambios.
- `empaquetar` cifró 3640 archivos y borró el staging.
- **Las filas 5.6 y 5.7 quedan en `entregado`: la aceptación es de Sam.** El código de las PR #386 y #391 a #396 sigue en borrador, sin fusionar. La fusión se la pide el Director General a Sam.

**Estado anterior, al 2026-11-06, ~14:30Z.**
- Sam pegó el token a las 13:40Z.
- La sonda incremental corrió y su paquete es `/srv/backups/kommo/kommo-20261106T134402Z`. Su evidencia, solo conteos, se le mandó al Director General.
- La completa está programada para el 2026-11-07 a las 05:00:00 UTC, la 1:00 a. m. en Caracas, sin tope de hora (`kommo-e5-completa.timer`, con `kommo-e5-vigia.timer` a la misma hora y el tope de carga 8). El token se borra solo el 2026-11-08 a las 05:00:00 UTC (`kommo-e5-token-caduca.timer`). Reprogramado a las 14:28Z, a pedido de Sam (§2).
- Sam pidió los adjuntos («Con adjuntos»), y la 5.5b está en la PR #394.
- **Puerta de las 03:30Z:** si la #394 no está en verde y revisada por el Director General, se cancelan los dos timers de la completa y no se corre solo con texto (§2).
- Nada se cargó en producción.

## 1. Las PR (borrador, apiladas). No se suben commits sin avisar al Director General

| PR | Rama | Cabeza | Base | Qué trae | CI |
|---|---|---|---|---|---|
| [#386](https://github.com/SoftAgentes/DTDCARGO/pull/386) | `codex/0590-e5-extractor` | `28de21a9d` | `main` | 5.3: extractor incremental hasta un corte | Pendiente de «Calidad continua» al marcarla lista |
| [#391](https://github.com/SoftAgentes/DTDCARGO/pull/391) | `codex/0590-e5-vinculo` | `b7d1a383e` | #386 | 5.4 y 5.5: completa hasta el corte, vínculo con el ERP, archivo de carga, cargador y su prueba (41 comprobaciones, 24 mutantes) | Verde: run 42184797759 |
| [#392](https://github.com/SoftAgentes/DTDCARGO/pull/392) | `codex/0590-e5-ensayo` | `b3c9b62be` | #391 | 5.6: guion del ensayo en una copia efímera, con guardas y su prueba contra una «producción» simulada | Verde: run 42189025604 sobre `2b5edea21`, aprobada por el Director General como guion de ensayo. Después, solo commits de docs |
| [#393](https://github.com/SoftAgentes/DTDCARGO/pull/393) | `codex/0590-e5-solo-lectura` | `31b2140a2` | #392 | Prueba de que el extractor solo hace GET (§10.13) y `probar-token` sin `iss` | — |
| [#394](https://github.com/SoftAgentes/DTDCARGO/pull/394) | `codex/0590-e5-adjuntos` | ver la PR | #393 | 5.5b: adjuntos al Archivo (§10.12): extractor 1.3.0, `MODO=adjuntos`, ensayo con `STAGING`, AD1 a AD5 y mutantes M25 a M29 | Ver la PR |

- **Integración:** la hace el Director General, en orden: #386 a `main`, después la #391 con base `main`, después la #392. Cuando la #391 quede con base `main`, corre «Calidad continua».
- **Worktrees:** `DTD-worktrees/0590-e5-extractor` (ramas `codex/0590-e5-extractor` y `codex/0590-e5-vinculo`) y `DTD-worktrees/0590-e5-ensayo` (rama `codex/0590-e5-ensayo`). Los dos están reclamados por la sesión `eeeb0433-bf95-4b6b-8cdc-d201699e5f95`.

## 2. Autorizaciones vigentes (texto literal, no inferir más)

- **Sam, relayado por el Director General el 2026-11-06 hacia las 06:20Z,** a la opción «todo, incluida producción»: «Todo, incluida producción». Antes: «La transferencia debe pasar ya los datos de los clientes». Cubre: extraer de Kommo con token hasta un corte, cruzar con los clientes del ERP en el servidor, crear la bandeja «Archivo Kommo», el ensayo y la carga en producción. **Condiciones, que son parte del OK** (spec §10.5):
  1. ensayo limpio antes de producción;
  2. Kommo solo se lee, sin forzar su límite;
  3. ningún mensaje a clientes;
  4. los datos no salen del servidor: solo conteos y huellas en la evidencia;
  5. el token lo pega Sam en el VPS con `pegar-token.sh`;
  6. en producción, respaldo antes, lectura previa, de a una y conteos después, con la evidencia del ensayo enviada antes al Director General, y la carga la hace él o se corre con él.

  **No cubre** el borrado físico ni la anonimización a 24 meses.
- **El Director General, el 2026-11-06:**
  - el plan A del ensayo, en una copia efímera, con sus guardas (§10.10);
  - aceptó el salto de los números de conversación, que se anota antes y después;
  - la completa con `--sin-adjuntos`; reemplazado a las ~14:00Z, cuando Sam pidió los adjuntos (abajo);
  - la cuenta 2 (la de prueba) se acepta en el dump y se borra de la copia antes de cargar;
  - E-3 en producción lo cuenta él;
  - el token se queda en `/dev/shm` desde la sonda hasta que termina la completa, si esta arranca en menos de 24 horas. Se borra al terminar la completa, o a las 24 horas, con un borrado programado (§5.1).
- **Sam, relayado por el Director General hacia las 14:00Z:** «Con adjuntos». El Director General pidió:
  - programar la 5.5b ya (spec §10.12): el extractor con `--adjuntos-para-carga` y el cargador que sube los adjuntos sin callbacks;
  - la prueba en CI, con adjuntos inventados, mutantes, sin huérfanos y sin duplicar, y el ensayo que cuente adjuntos y bytes;
  - **plazo, las 00:30Z:** en verde en CI y revisada por él. Si llega, se redespliega el extractor con huellas y `completa.sh` pasa a `--adjuntos-para-carga` sin `--sin-adjuntos`, con el mismo token y a las 02:00Z como está programado;
  - **si no llega:** se cancelan `kommo-e5-completa.timer` y `kommo-e5-vigia.timer`. **No se corre solo con texto.** El token se borra con su timer, y se reprograma otra noche, con Sam pegándolo otra vez.
- **Sam cambió la hora** (relayado por el Director General a las ~14:25Z): «Cambia el tiempo para la 1:00 a. m. de hoy sábado por la madrugada (o 2:00 a. m.), hasta lo que dure». El Director General pidió:
  - la completa y su vigía, a las 05:00:00 UTC del 2026-11-07, sin tope de hora; el tope de carga 8 sigue;
  - el borrado del token, a las 05:00:00 UTC del 2026-11-08, como red de seguridad. `completa.sh` lo sigue borrando apenas termina `extraer`, y si la para el vigía, queda para reanudar;
  - **el plazo de la 5.5b pasa a las 03:30Z**, con las mismas condiciones.

  **Reanudar:** la `completa.sh` desplegada hoy se niega a arrancar si el token tiene 24 h o más. Por eso, una reanudación después de las 13:40Z del 2026-11-07 saldría con 11. El Director General pidió atar la guarda al timer: el token vale mientras exista, tenga 600 y más de 200 bytes, y `kommo-e5-token-caduca.timer` siga activo. Va en la #394 con su prueba y se despliega con la 5.5b (§5.3).

## 3. Lo que espera a Sam

1. **El token de Kommo**: pegado a las 13:40Z. Hecho.
2. **Adjuntos en Chatwoot (5.5b)**: «Con adjuntos». Hecho; la 5.5b está en la #394.
3. **Miembros del Archivo:** «todo el equipo» (Sam, ~15:00Z). Hecho en código: `MODO=miembros` (spec §10.14). Hoy son 2 usuarios, los 2 administradores.
4. **Búsqueda:** «Ampliar la búsqueda» (Sam, ~15:00Z). El plan de `SEARCH_TIME_RANGE_LIMIT_DAYS` está en la spec §10.14: **3.650 días**, decididos por el Director General, con la puerta de 1.000 ms del ensayo (BQ2). Se aplica con él, en la ventana de la carga.

## 4. Los 10 pasos hasta producción

| # | Paso | Quién | Estado |
|---|---|---|---|
| 1 | Sam pega el token | Sam | Hecho, a las 13:40Z |
| 2 | Sonda incremental desde la base 5.1 hasta un corte (§5.2) | Subdirector, con aviso al Director General | Hecho; evidencia al Director General |
| 3 | Completa hasta el corte, desde las 05:00Z y sin tope de hora, con `--adjuntos-para-carga` si la #394 pasa la puerta de las 03:30Z (§5.3) | Subdirector | Hecho el 2026-11-07: parada por el vigía a las 06:06Z (143) y reanudada, terminó a las 09:26:52Z con `codigo=0` |
| 4 | Foto del ERP, `vincular` y `preparar-carga` (§5.4) | Subdirector | Hecho a las 09:33Z, con la 1.3.1: E-1 = 0, E-2 = 0 |
| 5 | Ensayo en la copia efímera (§5.5) | Subdirector | Hecho al cuarto intento, de 10:10Z a 10:34Z: 32 PASÓ y 4 FALLÓ de la sonda, aceptados por el Director General |
| 6 | Evidencia del ensayo al Director General | Subdirector | Hecho; el Director General dio el sí a las 10:40Z |
| 7 | `MODO=seco` en producción: no escribe ni consume números | Con el Director General | Hecho a las 10:59Z: los mismos números que el ensayo y la secuencia de 20 a 20 |
| 8 | Respaldo de la base de Chatwoot | Director General | Hecho: `chatwoot-20261107T103842Z`, verificado; E-3 «antes» 8 / 0 / 22 / 7 |
| 9 | Carga en producción, con E-3 y E-8 antes y después | El Director General, o con él | Hecho de 11:00Z a 11:11Z: 4780 / 54.737 / 3639 adjuntos, secuencia de 20 a 4800; E-3 «después» igual que antes |
| 10 | Miembros del Archivo (`MODO=miembros`, todo el equipo), la búsqueda ampliada (plan de §10.14) y después `empaquetar` el staging | Con el Director General | Miembros: hecho, los 2 administradores. `empaquetar`: hecho, con el staging borrado. **La búsqueda ampliada no se aplicó en producción:** `SEARCH_TIME_RANGE_LIMIT_DAYS` está en la #396, sin fusionar, y espera al Director General |

## 5. Guion para cuando llegue el token (NO correr sin el aviso del Director General)

Todo en el VPS (`217.216.54.70`, root). Antes de cada paso: `date -u` y `cut -d' ' -f1 /proc/loadavg`. Si la carga pasa de 8, no se arranca. La copia del extractor en el VPS es `/srv/ops/kommo-historial-0590b`. Medido el 2026-11-06: `respaldar-historial.py` tiene huella `7795fdc34c65260f` y `pegar-token.sh` `0fde59b0a4bda744`, iguales a las tres ramas. No hay que redesplegar para los pasos 2 a 4.

### 5.1 El token (Sam)

Sam abre PowerShell en su PC y corre:

```powershell
C:\Windows\System32\OpenSSH\ssh.exe -t root@217.216.54.70 tmux new -A -s token-kommo "bash /srv/ops/kommo-historial-0590b/pegar-token.sh"
```

El guion pide el token sin mostrarlo (`read -rs`), comprueba que parece un JWT de al menos 200 caracteres, lo guarda en `/dev/shm/k0582-e5` (0600) y corre `probar-token`.

**Cuánto vive el token** (Director General, 2026-11-06, para no pedirle a Sam que lo pegue dos veces). Se queda en `/dev/shm` desde la sonda hasta que termina la completa, siempre que la completa arranque **en menos de 24 horas** desde que Sam lo pegó. Se borra apenas termina la completa, y también si pasan las 24 horas sin arrancarla. Para no depender de acordarse, apenas Sam lo pega se programa el borrado automático:

```sh
systemd-run --unit kommo-e5-token-caduca --on-active=24h /bin/rm -f /dev/shm/k0582-e5
systemctl list-timers --no-pager kommo-e5-token-caduca.timer     # anotar cuándo vence
```

**Antes de cada corrida** (sonda y completa) se comprueba sin imprimirlo: `stat -c '%a %s %y' /dev/shm/k0582-e5` tiene que dar `600`, más de 200 bytes y una fecha de menos de 24 horas. Si falta o venció, Sam lo vuelve a pegar y se reprograma el borrado.

### 5.2 Paso 2: sonda incremental

```sh
stat -c '%a %s %y' /dev/shm/k0582-e5        # 600, más de 200 bytes, menos de 24 h (§5.1)
CORTE="$(date -u +%Y-%m-%dT%H:00:00Z)"      # la hora en punto anterior: ya pasó
echo "corte de la sonda: $CORTE"            # se anota en la evidencia
systemd-run --unit kommo-e5-inc1 --collect -p Nice=10 \
  python3 -I /srv/ops/kommo-historial-0590b/respaldar-historial.py todo \
    --token-file /dev/shm/k0582-e5 --base /srv/backups/kommo/kommo-20261030T233814Z --corte "$CORTE" \
    --staging /dev/shm/kommo-e5-inc1 --destino /srv/backups/kommo --pausa 0.5 \
    --log /srv/backups/kommo/respaldo.log
```

**Vigía de carga.** Es otra unidad, que se informa a sí misma cada 10 minutos y para la corrida si la carga pasa de 8:

```sh
systemd-run --unit kommo-e5-vigia --collect bash -c '
  u=kommo-e5-inc1; i=0; echo "$(date -u +%FT%TZ) vigía de $u: arranca"
  while systemctl is-active --quiet "$u"; do
    c=$(cut -d" " -f1 /proc/loadavg)
    if awk -v c="$c" "BEGIN { exit !(c > 8) }"; then echo "$(date -u +%FT%TZ) carga $c > 8: se para $u"; systemctl stop "$u"; fi
    i=$((i + 1)); [ $((i % 20)) = 0 ] && echo "$(date -u +%FT%TZ) vigía: $u sigue, carga $c"
    sleep 30
  done
  echo "$(date -u +%FT%TZ) vigía: $u terminó"'
journalctl -u kommo-e5-vigia -f      # para mirarla
```

**Si se para:** se reanuda con el mismo comando y el mismo `CORTE`. El staging guarda lo hecho.

**Evidencia, solo conteos.** Sin `jq`, que no está en el VPS:

```sh
systemctl status kommo-e5-inc1 --no-pager | head -5
D="$(ls -1dt /srv/backups/kommo/kommo-2026* | head -1)"; echo "$D"
python3 -I -c 'import json,sys; m=json.load(open(sys.argv[1])); print(json.dumps(m.get("incremental"), ensure_ascii=False))' "$D/manifiesto.json"
python3 -I -c 'import json,sys; r=json.load(open(sys.argv[1])); print(json.dumps({k: r.get(k) for k in ("conversaciones","mensajes","contactos","adjuntos")}, ensure_ascii=False)); print(json.dumps((r.get("incremental") or {}).get("filtro_updated_at"), ensure_ascii=False))' "$D/informe.json"
(cd "$D" && sha256sum -c ./*.sha256)
ls /dev/shm | grep -c kommo-e5-inc1      # 0: empaquetar borró el staging
stat -c '%a %s %y' /dev/shm/k0582-e5     # el token SIGUE: lo usa la completa (§5.1, menos de 24 h)
```

Lo que se mide aquí (spec §9.2): si Kommo respeta `filter[updated_at]` en notas y tareas, visto en `incremental.filtro_updated_at` (`fuera_de_la_ventana`). Se manda al Director General.

### 5.3 Paso 3: la completa hasta el corte (desde las 05:00Z, sin tope de hora)

Va con el mismo token de la sonda, si no pasaron 24 horas (§5.1). Dura unas 3,7 h sin adjuntos y unas 5 h con ellos (I). El tope de las 10:00Z se quitó a pedido de Sam (§2): nunca estuvo en el código, solo en este guion.

**Cómo quedó programada.** La corre `/srv/ops/kommo-historial-0590b/completa.sh`, por medio de `kommo-e5-completa.timer`, el 2026-11-07 a las 05:00:00 UTC. El vigía va en `kommo-e5-vigia.timer`, a la misma hora. El guion:
- se niega si el token no tiene 0600, si tiene 200 bytes o menos, o si tiene 24 h o más (código 11);
- se niega si la carga pasa de 8 (código 12);
- toma el corte en la hora en punto y espera 30 s;
- corre el `extraer` de abajo;
- al terminar, borra el token, para `kommo-e5-token-caduca.timer` y escribe `/srv/backups/kommo/completa-0590.estado`.

Si lo paran con TERM, devuelve 143 y no borra el token.

**Con la 5.5b** (si pasa la puerta de las 03:30Z, §2), se despliegan juntos, desde la cabeza de la #394 revisada, `completa.sh` y `respaldar-historial.py` 1.3.0, en `/srv/ops/kommo-historial-0590b`, y se anotan sus huellas. La `completa.sh` nueva:
- corre `--adjuntos-para-carga` sin `--sin-adjuntos`;
- ata la guarda del token a `kommo-e5-token-caduca.timer`, en lugar de las 24 h;
- sale con 13 si el extractor no entiende la opción, para que un despliegue a medias no borre el token.

Los timers no cambian: llaman a la misma ruta. El bloque de abajo es el de antes; con la 5.5b, la línea del medio queda `--token-file /dev/shm/k0582-e5 --corte "$CORTE" --sondear-huecos -1 --adjuntos-para-carga \`.

```sh
stat -c '%a %s %y' /dev/shm/k0582-e5     # 600, más de 200 bytes, menos de 24 h; si no, Sam lo pega otra vez
CORTE="$(date -u +%Y-%m-%dT%H:00:00Z)"; echo "corte de la completa: $CORTE"
systemd-run --unit kommo-e5-completa --collect -p Nice=10 \
  python3 -I /srv/ops/kommo-historial-0590b/respaldar-historial.py extraer \
    --token-file /dev/shm/k0582-e5 --corte "$CORTE" --sondear-huecos -1 --sin-adjuntos \
    --staging /dev/shm/kommo-e5-carga --destino /srv/backups/kommo --pausa 0.5 \
    --log /srv/backups/kommo/respaldo.log
```

- El vigía es el de §5.2, con `u=kommo-e5-completa`.
- `extraer` deja el staging en `/dev/shm/kommo-e5-carga`, sin cifrar ni borrar: lo necesitan los pasos 4, 5 y 9.
- **Cuando termine:** se borra el token y se quita el borrado programado, que ya no hace falta. Después se anotan `CORTE`, la hora de fin y los conteos de `informe`.

  ```sh
  rm -f /dev/shm/k0582-e5 && ls /dev/shm | grep -c k0582        # 0
  systemctl stop kommo-e5-token-caduca.timer 2>/dev/null; systemctl list-timers --all --no-pager | grep -c kommo-e5-token   # 0
  ```
- **El staging tiene datos de personas en claro, en tmpfs.** Con la 5.5b, también unos 2,1 GB de fotos, audios y documentos, en `adjuntos-carga/` (0600). Conviene que el ensayo y la carga a producción ocurran el mismo día. Si el VPS se reinicia, el staging se pierde y la completa se repite.

### 5.4 Paso 4: foto del ERP, `vincular` y `preparar-carga`

Primero se comprueba que en el ERP hay **un solo tenant** con clientes vivos. Si da otro número, se para y se le pregunta al Director General:

```sh
docker exec -e PGOPTIONS='-c default_transaction_read_only=on' dtd-cargo-db-1 \
  psql -U postgres -d postgres -At -c "select count(distinct tenant_id) from public.clients where deleted_at is null"
```

La foto mínima, sin nombres, en tmpfs y en solo lectura (`phone_last10` es la columna generada de la 0383):

```sh
umask 077
docker exec -e PGOPTIONS='-c default_transaction_read_only=on' dtd-cargo-db-1 psql -U postgres -d postgres -At -c "
  select json_build_object(
    'client_id', c.id,
    'phone_last10', case when c.phone_last10 is null then '[]'::json else json_build_array(c.phone_last10) end,
    'correos', case when nullif(btrim(c.email), '') is null then '[]'::json else json_build_array(lower(btrim(c.email))) end)
  from public.clients c where c.deleted_at is null" > /dev/shm/clientes-erp.ndjson
wc -l < /dev/shm/clientes-erp.ndjson        # solo el conteo
cd /srv/ops/kommo-historial-0590b
python3 -I respaldar-historial.py vincular --staging /dev/shm/kommo-e5-carga --clientes /dev/shm/clientes-erp.ndjson
ls /dev/shm/clientes-erp.ndjson 2>/dev/null | wc -l      # 0: vincular la borra al leerla
python3 -I respaldar-historial.py preparar-carga --staging /dev/shm/kommo-e5-carga
```

`vincular` imprime `vinculo-informe.json`: E-1 es `clientes_en_varios_grupos` y E-2 es `ambiguos_vinculados`, y los dos tienen que dar 0. `preparar-carga` imprime `carga-informe.json`. Los dos son solo conteos.

**Inferencia:** el usuario `postgres` y la base `postgres` de `dtd-cargo-db-1` salen de la memoria «Aplicar una migración en el servidor propio» y no se volvieron a medir. Antes de correr, se comprueba con `docker exec dtd-cargo-db-1 psql -U postgres -d postgres -At -c 'select 1'`.

### 5.5 Paso 5: el ensayo (la #392 en el VPS)

Desplegado el 2026-11-06 desde `2b5edea21` en `/srv/ops/kommo-historial-ensayo`. Con la 5.5b se redespliega desde la cabeza de la #394 revisada por el Director General, porque cambian `ensayo-archivo.sh`, `cargar-archivo-kommo.rb`, `pruebas/sonda-ensayo.rb` y `respaldar-historial.py`, y se comparan las huellas. El procedimiento es el mismo de entonces:

```sh
# En la PC, desde el worktree de la #392:
git -C "C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/0590-e5-ensayo" archive 2b5edea21 infra/ops/kommo-historial \
  | ssh root@217.216.54.70 'mkdir -m 700 /srv/ops/kommo-historial-ensayo && tar -x -C /srv/ops/kommo-historial-ensayo --strip-components=3'
# En el VPS: comparar las huellas con las de la rama antes de correr.
cd /srv/ops/kommo-historial-ensayo && sha256sum ensayo-archivo.sh ensayo-otras-cuentas.sql cargar-archivo-kommo.rb pruebas/sonda-ensayo.rb
```

```sh
CARGA=/dev/shm/kommo-e5-carga/carga.ndjson \
INFORME_CARGA=/dev/shm/kommo-e5-carga/carga-informe.json \
INFORME_VINCULO=/dev/shm/kommo-e5-carga/vinculo-informe.json \
STAGING=/dev/shm/kommo-e5-carga \
CUENTA=1 bash /srv/ops/kommo-historial-ensayo/ensayo-archivo.sh
```

- **Qué hace:** copia la base de Chatwoot, deja en la copia solo la cuenta 1, crea el Archivo, corre el seco y las dos cargas, mide, y lo borra todo. Con `STAGING` (5.5b), también carga dos veces los adjuntos y mide AD1 a AD3: cantidad y bytes frente a `carga-informe.json`, 0 en la segunda corrida, íntegros y sin huérfanos.
- **Evidencia:** `/srv/ops/kommo-historial-ensayo/evidencia-ensayo-<stamp>.txt`, solo líneas `HECHO`. Se le manda al Director General.
- Si queda algo a medias: `bash ensayo-archivo.sh --limpiar`.

### 5.6 Pasos 7 a 10, con el Director General

- **Puerta de memoria, antes de cada modo** (spec §10.15): `rss_pico_kb` de ese modo en el ensayo, más el uso actual de `chatwoot-rails-1` (`docker stats --no-stream`), más 300 MB, tiene que quedar por debajo de 1.536 MiB. Si no queda, no se corre en `chatwoot-rails-1` y se le propone otra vía al Director General.
- **Seco en producción.** Se copia el cargador al contenedor y la carga entra por la entrada estándar:

  ```sh
  docker cp /srv/ops/kommo-historial-ensayo/cargar-archivo-kommo.rb chatwoot-rails-1:/tmp/cargar-archivo-kommo.rb
  ```

  Primero se crea la bandeja con `MODO=crear-bandeja` (exige `asignacion_automatica=no`, `miembros=0` y `trabajos_nuevos` de `account.cache_invalidated`). Después `MODO=seco` con `CARGA=-`. Sus conteos tienen que coincidir con los del ensayo.
- **Respaldo de Chatwoot**, antes de cargar: lo hace el Director General.
- **Carga:** `MODO=cargar`. Se anota `HECHO secuencia=antes->después` (E-8, aceptado por el Director General). E-3 lo cuenta él antes y después: `crm_tarjetas`, `crm_tareas`, `chatwoot_webhook_events` y `chatwoot_conversations`.
- **Adjuntos (5.5b), después de los mensajes:** `flujo-adjuntos | MODO=adjuntos-seco` y después `MODO=adjuntos`, por la entrada estándar (README). Se anotan `blobs`, `blobs_kommo` y `trabajos_nuevos`, que tiene que dar `ninguno`. Además, `adjuntos_fallidos`, `adjuntos_no_coinciden`, `adjuntos_sin_mensaje` y `blobs_huerfanos_nuevos` tienen que dar 0, y la diferencia de `blobs_kommo` tiene que ser igual a `adjuntos_nuevos`.
- **Al final:**
  - `respaldar-historial.py empaquetar --staging /dev/shm/kommo-e5-carga --destino /srv/backups/kommo`, que cifra y borra el staging;
  - los miembros del Archivo: `MODO=miembros-seco` y después `MODO=miembros` (README), con la misma bandeja;
  - la búsqueda ampliada, si el Director General la aprueba: los pasos 1 a 7 de la spec §10.14, con su vuelta atrás.

## 6. FUERA DE ALCANCE DETECTADO

- **12 conversaciones de Kommo con 403** (118, 134, 138, 364, 3746, 3747, 3761, 3764, 3834, 3927, 3928 y 4718). Quedan fuera del Archivo: no tienen eventos, mensajes ni adjuntos bajados. Recuperarlas pide darle acceso en Kommo y otro token; lo decide Sam.
- **15 adjuntos con 404:** Kommo ya no los tiene.
- **Tres hallazgos para una PR aparte** (spec §10.16):
  1. el trap de `ensayo-archivo.sh` sale con 0 después de un TERM y puede dejar un volumen y una red;
  2. la sonda no mide la búsqueda por número ni BQ1 con datos reales;
  3. el guion de la carga no corre `informe` antes de `empaquetar`, así que no queda `informe.json` con `sin_acceso_403`.

- Un usuario que entre a Chatwoot después de la carga no queda como miembro del Archivo solo: hay que agregarlo desde el panel o repetir `MODO=miembros`.
- La ventana de búsqueda corre con el tiempo: con 3.650 días, el mensaje más viejo del Archivo sale de la búsqueda de texto el 2033-08-20. Por la persona o el número se sigue encontrando.
- La miniatura de una imagen del Archivo se genera la primera vez que alguien la abre en el panel, como con cualquier imagen de WhatsApp. Lo que eso encola es de ActiveStorage, y AD5 lo mide en CI. No cambia nada de la carga.

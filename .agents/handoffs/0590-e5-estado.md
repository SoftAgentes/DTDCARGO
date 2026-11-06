# SDD-0590 · E5, historial de Kommo al «Archivo Kommo»: estado y guion hasta producción (handoff)

Escrito por el Subdirector de Chatwoot el 2026-11-06 a las ~09:00Z, a pedido del Director General. Las fuentes de estado son Git, las PR y la spec `docs/specs/0590-kommo-historial-e5/spec.md`. Este handoff junta lo necesario para seguir sin la conversación. **Nada de esto se corrió todavía contra Kommo ni contra producción.**

## 1. Las tres PR (borrador, apiladas). No se suben commits sin avisar al Director General

| PR | Rama | Cabeza | Base | Qué trae | CI |
|---|---|---|---|---|---|
| [#386](https://github.com/SoftAgentes/DTDCARGO/pull/386) | `codex/0590-e5-extractor` | `28de21a9d` | `main` | 5.3: extractor incremental hasta un corte | Pendiente de «Calidad continua» al marcarla lista |
| [#391](https://github.com/SoftAgentes/DTDCARGO/pull/391) | `codex/0590-e5-vinculo` | `b7d1a383e` | #386 | 5.4 y 5.5: completa hasta el corte, vínculo con el ERP, archivo de carga, cargador y su prueba (41 comprobaciones, 24 mutantes) | Verde: run 42184797759 |
| [#392](https://github.com/SoftAgentes/DTDCARGO/pull/392) | `codex/0590-e5-ensayo` | `2b5edea21` | #391 | 5.6: guion del ensayo en una copia efímera, con guardas y su prueba contra una «producción» simulada | Verde: run 42189025604. Aprobada por el Director General como guion de ensayo |

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
  - la completa con `--sin-adjuntos`;
  - la cuenta 2 (la de prueba) se acepta en el dump y se borra de la copia antes de cargar;
  - E-3 en producción lo cuenta él;
  - el token se queda en `/dev/shm` desde la sonda hasta que termina la completa, si esta arranca en menos de 24 horas. Se borra al terminar la completa, o a las 24 horas, con un borrado programado (§5.1).

## 3. Lo que espera a Sam

1. **El token de Kommo**, pegado en el VPS (§5.1). Destraba todo lo demás.
2. **Adjuntos en Chatwoot (5.5b), sí o no.** Lo preguntó el Director General. Si dice que sí **antes** de la completa, se programa la 5.5b (diseño en §10.12) y la completa baja los adjuntos en ese modo, una sola vez. Si dice que no, o después, la completa va con `--sin-adjuntos`.
3. **Quién entra como miembro del Archivo** (§10.9). Sin miembros, solo lo ven los administradores.
4. **Cómo buscar lo viejo** (§10.9): por la persona, sin cambios, o subiendo `SEARCH_TIME_RANGE_LIMIT_DAYS`, que es un despliegue del Director General.

## 4. Los 10 pasos hasta producción

| # | Paso | Quién | Estado |
|---|---|---|---|
| 1 | Sam pega el token | Sam | Esperando |
| 2 | Sonda incremental desde la base 5.1 hasta un corte (§5.2) | Subdirector, con aviso al Director General | Guion listo, sin correr |
| 3 | Completa hasta el corte, entre las 02:00 y las 10:00Z, con `--sin-adjuntos` (§5.3) | Subdirector | Guion listo, sin correr |
| 4 | Foto del ERP, `vincular` y `preparar-carga` (§5.4) | Subdirector | Guion listo, sin correr |
| 5 | Ensayo en la copia efímera (§5.5) | Subdirector | Guion aprobado (#392), sin correr |
| 6 | Evidencia del ensayo al Director General | Subdirector | — |
| 7 | `MODO=seco` en producción: no escribe ni consume números | Con el Director General | — |
| 8 | Respaldo de la base de Chatwoot | Director General | — |
| 9 | Carga en producción, con E-3 y E-8 antes y después | El Director General, o con él | — |
| 10 | Miembros del Archivo, según decida Sam; después `empaquetar` el staging | Un administrador / Subdirector | — |

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

### 5.3 Paso 3: la completa hasta el corte (entre las 02:00 y las 10:00Z)

Va con el mismo token de la sonda, si no pasaron 24 horas (§5.1), y con `--sin-adjuntos` decidido (si Sam pide la 5.5b antes, esto cambia: ver §3). Dura unas 3,7 h, y tiene que terminar antes de las 10:00Z.

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
- **El staging tiene datos de personas en claro, en tmpfs.** Conviene que el ensayo y la carga a producción ocurran el mismo día. Si el VPS se reinicia, el staging se pierde y la completa se repite.

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

El guion del ensayo no está en el VPS. Se despliega de la cabeza aprobada, sin datos, igual que se hizo con `0590b`:

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
CUENTA=1 bash /srv/ops/kommo-historial-ensayo/ensayo-archivo.sh
```

- **Qué hace:** copia la base de Chatwoot, deja en la copia solo la cuenta 1, crea el Archivo, corre el seco y las dos cargas, mide, y lo borra todo.
- **Evidencia:** `/srv/ops/kommo-historial-ensayo/evidencia-ensayo-<stamp>.txt`, solo líneas `HECHO`. Se le manda al Director General.
- Si queda algo a medias: `bash ensayo-archivo.sh --limpiar`.

### 5.6 Pasos 7 a 10, con el Director General

- **Seco en producción.** Se copia el cargador al contenedor y la carga entra por la entrada estándar:

  ```sh
  docker cp /srv/ops/kommo-historial-ensayo/cargar-archivo-kommo.rb chatwoot-rails-1:/tmp/cargar-archivo-kommo.rb
  ```

  Primero se crea la bandeja con `MODO=crear-bandeja` (exige `asignacion_automatica=no`, `miembros=0` y `trabajos_nuevos` de `account.cache_invalidated`). Después `MODO=seco` con `CARGA=-`. Sus conteos tienen que coincidir con los del ensayo.
- **Respaldo de Chatwoot**, antes de cargar: lo hace el Director General.
- **Carga:** `MODO=cargar`. Se anota `HECHO secuencia=antes->después` (E-8, aceptado por el Director General). E-3 lo cuenta él antes y después: `crm_tarjetas`, `crm_tareas`, `chatwoot_webhook_events` y `chatwoot_conversations`.
- **Al final:**
  - `respaldar-historial.py empaquetar --staging /dev/shm/kommo-e5-carga --destino /srv/backups/kommo`, que cifra y borra el staging;
  - los miembros del Archivo, cuando Sam decida.

## 6. FUERA DE ALCANCE DETECTADO

- El Archivo sin miembros solo lo ven los administradores: es una decisión de Sam, no un defecto.
- El buscador de mensajes de Chatwoot solo mira 90 días (`SEARCH_TIME_RANGE_LIMIT_DAYS`). Si Sam elige subirlo, es un despliegue aparte.
- Los adjuntos de Kommo no llegan a Chatwoot con el código de hoy: es la 5.5b, que espera a Sam.

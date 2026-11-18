# SDD-0586 · P4 (10.7), PR 2 de E5: `cargar.sh`, la prueba punta a punta y el ensayo (handoff de Worker)

- **Owner:** Worker de Claude Code (E5), sesión `95191146-c154-4468-af0e-d46ad5a1e391`. Lo encargó el Subdirector de Chatwoot (`local_535053f4-40c2-4124-a280-63f4fc882820`) el 2026-11-08, después del tren 4 (`88a87b181`).
- **Ruta:** `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\0586-portal-cargar-ensayo`.
- **Rama:** `codex/0586-portal-cargar-ensayo`. Sale de `d3c58508f`, la cabeza de la #455 en ese momento, y trae:
  - `88a87b181`, el tren 4, en el merge `1b0de7f42`;
  - las cabezas nuevas de la #455 (`fa7071922`, `b4670907f` y `c19cb6ae4`) en sus merges;
  - el arreglo de E10, `638818d21` (#464), en el merge `d7968e92d`.
- **PR:** [#461](https://github.com/SoftAgentes/DTDCARGO/pull/461), con base `main` y «[depende de #455] [depende de #464]» en el título.
  - **No se fusiona antes de la #455 ni de la #464.** La #464 es el `grant select` de `vincular.sh` sobre sus tablas temporales antes del `set role`: sin él, la vinculación falla con «permission denied for table preparado».
  - Va al tren 6, después de esas dos.
- **SDD:** [0586](../../docs/specs/0586-chatwoot-enrutamiento-segmento-e10/spec.md) §10.5.10. La spec es de E10, así que esta rama no la toca.
- **Condición de la revisión del DG:** `cargar.sh` tiene que estar fusionado antes de la puerta 3.

## Lo que ya está en `main` y se usa tal cual (de E10, #456)

`extraer.sh` (con `reservar.sql` y `extraer.sql`), `vincular.sh`, `limpiar.sh` y `controles-studio.sql`, todos con la carpeta fija `/dev/shm/portal-historial`. `vincular.sh` lee `vinculos.ndjson` con ese nombre, rechaza las barras invertidas y, si sale bien, borra la carpeta. Estos archivos no se tocan.

## Diseño (propuesta para el Subdirector)

### 1. `infra/ops/portal-historial/cargar.sh`: el puente entre el contenedor y el VPS

```
DB_CW=<contenedor de Chatwoot, por defecto chatwoot-rails-1> CUENTA=<n> BANDEJA=<CHATWOOT_INBOX_PORTAL_ID> \
  AGENTE_SERVICIO=<user id> MODO=seco|cargar bash cargar.sh
```

- **Entradas:**
  - lee `/dev/shm/portal-historial/preparado.ndjson`, que deja `extraer.sh`; si no está, sale con 2;
  - exige que `CUENTA`, `BANDEJA` y `AGENTE_SERVICIO` sean números.
  - Si ya hay un `vinculos.ndjson` en el VPS, sale con 2: hay que borrarlo antes con `limpiar.sh`.
- **En el contenedor:**
  1. `docker cp cargar-portal.rb $DB_CW:/tmp/cargar-portal.rb`;
  2. `install -d -m 0700 /dev/shm/portal-historial`, en su tmpfs;
  3. `docker exec -i -e … $DB_CW bundle exec rails runner /tmp/cargar-portal.rb < preparado.ndjson`. El preparado entra por la entrada estándar y **no se copia al contenedor**.
- **La salida:** solo las líneas `HECHO` del cargador, con su `carga=ok|error`. Si `carga` no es `ok`, sale con 1 y no trae nada.
- **El traslado** (solo con `MODO=cargar` y `carga=ok`):
  1. `docker exec … cat` a `/dev/shm/portal-historial/vinculos.ndjson.parcial` del VPS. El diseño decía `docker cp`, pero `docker cp` no copia desde el tmpfs del contenedor (run 42506590809);
  2. comprobar que no tiene barras invertidas y que trae la cabecera;
  3. renombrarlo a `vinculos.ndjson` y dejarlo en `chmod 0600`.
- **El `trap` de EXIT, también si algo falla:**
  - borra en el contenedor `/dev/shm/portal-historial` y `/tmp/cargar-portal.rb`, y en el VPS el `.parcial`;
  - después **comprueba** que en el contenedor no queda ni la carpeta, ni `vinculos.ndjson.parcial`, ni `/tmp/cargar-portal.rb`. Lo anota con `HECHO contenedor_limpio=si|no`, y si da `no`, sale con 4.
- **Lo que no hace:** no lee la base de Studio ni la escribe. Esa parte es de `extraer.sh` y de `vincular.sh`.

### 2. La prueba punta a punta, en Actions (`pruebas/prueba-punta-a-punta.sh`, en el workflow del cargador)

Va con datos inventados y sobre dos stacks efímeros:
- el Chatwoot de la prueba del cargador, con el servicio `rails` vivo para `docker exec` y la API;
- un Postgres 17 de Studio, con el fixture de la prueba de la 0523 (`pruebas/studio-fixture.sql`, una copia mía, con roles, `auth` y las migraciones que necesita, aplicadas con `\ir`). Esta vez hace **commit**, para que `extraer.sh` y `vincular.sh` lo lean como una base de verdad.

Pasos y comprobaciones:
- **Camino feliz:**
  1. `controles-studio.sql` (antes);
  2. `extraer.sh`;
  3. `cargar.sh` con `MODO=seco`, sin vínculos;
  4. `cargar.sh` con `MODO=cargar`;
  5. `vincular.sh`;
  6. `controles-studio.sql` (después): C-6 y C-7 tienen que dar igual, C-8 con `hilos_vinculados` y `salida_cargado`;
  7. `/dev/shm/portal-historial` borrado y el contenedor limpio.
- **(a)** Un `vinculos.ndjson` con un mensaje menos: `vincular.sh` da 22023 y Studio no cambia (sin vínculos, sin `cargado`, sin corte).
- **(b)** Un contacto con `contacto_id` nulo: 22023. **Necesita la 0524**, así que entra cuando E10 avise.
- **(c)** Después de (a), repetir todo desde la extracción:
  - mismo `dtd-portal:<identificador>`;
  - ningún contacto ni conversación doble en Chatwoot;
  - un solo corte.
- **(d) Repetir con un preparado que trae más mensajes** (un mensaje nuevo en Studio después de vincular, con el flag apagado). Lo nuevo entra, lo viejo no se duplica, y lo que ya estaba `cargado` en Studio sigue así.
- **(e) El efecto de un mensaje nuevo sobre lo cargado:** un mensaje por la API de Chatwoot a una conversación cargada, con el Sidekiq de la prueba corriendo. Después, 0 en `RetrySet` y en `DeadSet` (el `pubsub_token`).
- **(f) `cargar.sh` con un fallo inyectado** (un `rails runner` que sale con 1 a mitad, o `docker cp` a una ruta sin permiso): el `trap` deja el contenedor limpio (`contenedor_limpio=si`) y en el VPS no queda ningún `vinculos.ndjson` ni `.parcial`.
- **Regla de la cola (punto 4, acotada por el DG):** si `carga_lineas` se niega con 55000, no se borra la fila para seguir: se anota y se avisa al Subdirector.
- **Mutantes de `cargar.sh`:**
  - sin el `trap`;
  - sin el borrado de `/tmp/cargar-portal.rb`;
  - sin `chmod 0600`;
  - trasladar aunque `carga=error`.

  Cada uno tiene que tumbar su comprobación.

### 3. El ensayo en el VPS (`ensayo-portal.sh`), como el 5.6 de E5

Es una copia efímera de Chatwoot con las guardas de `kommo-historial/ensayo-archivo.sh`, copiadas y adaptadas:
- red interna, tmpfs, `pg_dump` en solo lectura, la marca de la copia y el borrado de las otras cuentas solo en la copia;
- la guarda de carga y la de memoria, `TimeoutStopSec`, la limpieza a cero y el código de salida en la evidencia.

Lado de Studio: una copia efímera de la base de Studio con las mismas guardas, para correr ahí `extraer.sh`, `cargar.sh` (contra la copia de Chatwoot), `vincular.sh` y los controles. Mide C-1 a C-14 con conteos y md5, sin datos de personas. Necesita su propia prueba en Actions contra una «producción» simulada, como `prueba-ensayo.sh`.

## Reparto (decidido por el Subdirector el 2026-11-08)

- **PR 2a, esta rama:** `cargar.sh` y la prueba punta a punta (1 y 2). Va contra `main` con «[depende de #455]».
- **PR 2b:** el ensayo (3), en una rama que sale de la 2a, con «[depende de la 2a]».
- **Las dos tienen que estar fusionadas antes de la puerta 3.**

## Lo que trae la PR 2a

- `infra/ops/portal-historial/cargar.sh`, como en el diseño 1, salvo el traslado: `docker cp` no copia desde el tmpfs del contenedor (run 42506590809), así que los vínculos se leen con `docker exec … cat`.
- `pruebas/prueba-punta-a-punta.sh`, `pruebas/sonda-pap.rb` y `pruebas/studio-fixture.sql`, como en el diseño 2, con un paso nuevo en el workflow del cargador.
  - **(b), el `contacto_id` nulo, queda PENDIENTE:** espera la 0524. La prueba imprime «PENDIENTE B … NO CUBIERTO» en el log y no lo da por cubierto.
  - **Lo que cambió del diseño en (f):** los fallos inyectados son dos.
    - El cargador da `carga=error` porque recibe otra bandeja API de la cuenta.
    - La carpeta del VPS queda en 0500, así que `docker exec … cat` no puede escribir el `.parcial`.
    - En los dos casos se comprueba desde afuera que el contenedor quedó limpio y que en el VPS no quedó ningún vínculo.
  - **(d) va dentro de (c):** antes de repetir se agrega un mensaje nuevo al hilo hA. La repetición carga solo ese mensaje, y la vinculación entra con 7 mensajes.
  - **Los mutantes de `cargar.sh`:**
    - MC1, sin el `trap`;
    - MC2, sin borrar `/tmp/cargar-portal.rb`;
    - MC3 pone 0644.
      - Quitar el `chmod` sería un mutante equivalente: el `umask 077` del guion y el del traslado ya crean los vínculos en 0600 (run 42509666073), y el `chmod` queda como defensa en profundidad.
      - Con 0644, F3 cae.
  - **«Trasladar aunque `carga=error`» no tiene mutante:** con el cargador en error no hay archivo que traer, y el traslado falla igual. Ese caso lo cubre F1.

## Allowlist (PR 2a)

| Archivo | Origen | Para qué |
|---|---|---|
| `infra/ops/portal-historial/cargar.sh` | Nuevo | El puente entre el contenedor de Chatwoot y la carpeta 0700 de E10 |
| `infra/ops/portal-historial/pruebas/prueba-punta-a-punta.sh` | Nuevo. Arma el stack de Chatwoot igual que `pruebas/prueba-cargador.sh` (#455) | La prueba que une los dos lados, con datos inventados |
| `infra/ops/portal-historial/pruebas/sonda-pap.rb` | Nuevo | Del lado de Chatwoot: la cuenta, los conteos y el mensaje por la API |
| `infra/ops/portal-historial/pruebas/studio-fixture.sql` | **Copia** de `supabase/tests/0523_chatwoot_portal_carga.test.sql`, líneas 17 a 158 (E10, #456). Es el fixture sintético del contrato: ids md5, teléfonos 555 y textos «SINT». Cambia `\ir` por `\i /supabase/…`, el vínculo del agente lo pone la prueba, suma las tablas del CRM vacías y termina en `commit` | La base de Studio de la punta a punta. Sin datos reales |
| `.github/workflows/portal-historial-cargador.yml` | De la #455 | El paso «Punta a punta» y los `paths` de las migraciones que aplica el fixture |
| `.agents/handoffs/0586-p4-portal-cargar-ensayo.md` | Nuevo | Este handoff |

Los guiones de E10 (`extraer.sh`, `vincular.sh`, `limpiar.sh` y `controles-studio.sql`) se usan tal cual y no se tocan.

## Límites

- La PR no se fusiona antes de la #455 ni de la #464. La fusiona el DG.
- Nada en producción ni en el VPS.
- Solo datos inventados.
- No se corre nada en la PC sin turno.
- La revisión y la pasada de Codex las lanza el DG.

## Validación

| Comprobación | Resultado |
|---|---|
| `bash -n` de `cargar.sh` y de `prueba-punta-a-punta.sh` | PASÓ |
| `ruby -c` de `sonda-pap.rb` | NO DISPONIBLE en la PC, porque no hay Ruby. Lo compila la prueba en Actions |
| Cargador del chat del portal sobre `e98a2705e` (42506590809) | FALLÓ en la punta a punta: `docker cp` no copia desde el tmpfs del contenedor, así que los vínculos no llegaban al VPS. Lo arregló `7ade97b60` (`docker exec … cat`) |
| Cargador del chat del portal sobre `7ade97b60` (42509666073) | FALLÓ en la punta a punta: `vincular.sh` daba «permission denied for table preparado». Era del lado de E10, y lo arregló la #464. MC3 sobrevivía: era un mutante equivalente |
| Cargador del chat del portal sobre `d7968e92d` (42512852466) | FALLÓ en A1, C5 y K3, todos de la prueba. Lo arregló `0ddc2cebc`: A1 con la cabecera coherente y A2 nuevo, `contar` sin orden, y el espejo de hC como en `0519_chatwoot_portal.sql:428` |
| Cargador del chat del portal sobre `b446449bc` ([42518780937](https://github.com/SoftAgentes/DTDCARGO/actions/runs/42518780937)) | PASÓ. El cargador dio 0 fallas: G13 pasa en la corrida real, en M0 y en M28, y en M27 cae con 8 conversaciones, `esperando=2` y `tabla_esperada=conversations`. La punta a punta dio 0 fallas. (b) sigue PENDIENTE |
| Calidad continua sobre `b446449bc` ([42518780955](https://github.com/SoftAgentes/DTDCARGO/actions/runs/42518780955)) | PASÓ |
| `pnpm verify` | NO EJECUTADO: el cambio es de `infra/ops` y de un workflow, sin producto |

## FUERA DE ALCANCE DETECTADO

No bloquea, y va la próxima vez que se toque la prueba o en su propia PR.

**De la prueba del cargador** (`infra/ops/portal-historial/pruebas/`):
- **El diagnóstico de G13:** que diga «G13 en Mxx: sin concurrencia.txt» cuando falte ese archivo. En M13 la línea salía vacía.
- **M13:** el escenario se cae en `SondaPortal.guardas`, porque `hilo.call('h2').id` se llama sobre `nil` (`sonda-portal.rb:480`) y las guardas no tienen `rescue` (`escenario-portal.rb:67`, `:71` y `:74`). Así, la concurrencia no corre. Hacen falta dos cosas: un `rescue` por paso en las guardas y `raise 'falta la conversación de h2'` en vez del `.id` sobre `nil`.
- **V3:** imprime `$F` (`sonda-verificar.txt`) en lugar de `estados-1.txt`. Es cosmético.

**De la revisión independiente de la #461:**
- `cargar.sh:23` corre sin `-e`, y no se comprueba el resultado de `mv` ni de `cerrar` (`:73`, `:76` y `:77`).
- C-6 no se compara en el camino feliz, solo en (a).
- C-7 corre con las tablas del CRM vacías.
- F2 solo exige `salida != 0`.
- **Faltan mutantes de `cargar.sh`:**
  - el filtro `^HECHO`;
  - el `exit 1` sin `carga=ok`;
  - la comprobación de la cabecera y de la barra invertida;
  - el `rm` del `.parcial`.
- No se prueban dos `cargar.sh` a la vez.
- El comentario de redes del workflow (`.github/workflows/portal-historial-cargador.yml:7-8`).
- **El caso (b), cuando la #462 esté en `main`:**
  - traer la 0508 y la 0524 al fixture y a los `paths` del workflow;
  - inyectar los dos nulos juntos, `contacto_id` y `source_id`.
  - **Dato:** la 0524 ya está aplicada en prueba (20:25:41Z) y en producción (20:26:10Z). Solo le falta entrar a `main` con la #462.

## Estado

**APPROVED**, sin bloqueantes, sobre la cabeza revisada `b446449bc`. Se integra en el tren 6, después de la #455 y de la #464. Este commit solo actualiza el handoff.

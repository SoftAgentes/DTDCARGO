# Corte de la oficina de agentes a Discord

Dueño: Sam (Junta de la oficina) · Estado: **escrito y sin ejecutar** · Escrito: 2026-11-05 por la
[SDD-0607](../specs/0607-oficina-puente-discord/spec.md) · review-by: 2027-02-05

Cómo se pasa de Telegram a Discord la conversación de Sam con la oficina de agentes: la
**recepción** (el perfil de Hermes con el que Sam conversa) y el **puente** que le devuelve los
avisos de ALFRED. Es un corte directo, sin semana de doble envío (decisión de Sam, 2026-11-05:
«quitar Telegram de una vez»).

> ⚠️ **Nada de esto es automático.** Se hace en el VPS de la oficina, con Sam presente, y exige
> que Sam autorice el corte nombrando ese VPS. La autorización que Sam le dio a otra sesión no
> alcanza. Este runbook no cubre los avisos del Studio (SDD-0606) ni los del servidor de DTD
> Cargo.

> ⚠️ **Este runbook se escribió sin entrar al VPS.** Lo que se sabe del VPS lo midió otra sesión
> el 2026-11-05, en solo lectura (§1). Lo que nadie leyó va marcado **NO VERIFICADO** y se lee en
> el paso 0, antes de tocar nada. Si lo que encuentras no calza con este runbook, **para**.

## Qué cambia

```
Hoy       Sam ──Telegram──▶ recepción (Hermes) ──socket──▶ puente ──▶ Paperclip ──▶ ALFRED
          Sam ◀──Telegram── puente (avisos de ALFRED)

Después   Sam ──Discord #alfred──▶ recepción (Hermes) ──socket──▶ puente ──▶ Paperclip ──▶ ALFRED
          Sam ◀──webhook de Discord── puente (avisos de ALFRED)
```

Son dos piezas con dos credenciales distintas:

| Pieza | Servicio | Hoy | Después |
|---|---|---|---|
| Recepción | `dtd-hermes-telegram.service`, perfil de Hermes `telegram` | Bot de Telegram | **Bot** de Discord: conversa con Sam en `#alfred` |
| Puente | `dtd-alfred-bridge.service` | Credencial `telegram_token` | Credencial `discord_webhook`: un **aviso automático** de canal, que solo escribe |

Paperclip, ALFRED, la base del puente y los encargos ya registrados no cambian.

## 1. Lo que se sabe y lo que no

| Dato | Estado |
|---|---|
| Hermes v0.22.2, con la conexión de Discord incluida | Medido el 2026-11-05 por la sesión coordinadora |
| Sam conversa con el perfil `telegram`, que corre como `dtd-hermes-telegram.service` | Medido el 2026-11-05 |
| El puente corre como `dtd-alfred-bridge.service` y su código está en `/usr/local/lib/dtd-alfred/` | Medido el 2026-11-05 |
| El puente lee `/etc/dtd-alfred/config.json` y recibe sus credenciales de systemd | Leído en el código |
| El código del puente en el VPS es el del commit `5c8d0d546` | **NO VERIFICADO** contra el VPS. Se comprueba en el paso 0 |
| Cómo declara su credencial la unidad del puente | **NO VERIFICADO.** La unidad no está en el repositorio |
| Cómo se configura Discord en Hermes: nombres de las opciones, lista de usuarios y de canales | **NO VERIFICADO.** Se lee en la documentación de la versión instalada |
| Dónde guarda la recepción su llave de Telegram | **NO VERIFICADO** |
| Qué dicen de Telegram la identidad y las instrucciones de la recepción y de ALFRED | **NO VERIFICADO** |
| Versión de Python del VPS | **NO VERIFICADO.** El puente solo usa la biblioteca estándar |
| Si la recepción ignora los mensajes que escribe un webhook | **NO VERIFICADO.** Se comprueba en el paso 4 |

## 2. Datos de Discord

Servidor «DTD Cargo», ID `1534936818951262390`. Categoría privada **Oficina**, que hoy ve el rol
Dirección:

| Canal | ID | Para qué |
|---|---|---|
| `#alfred` | `1567954536251920494` | Sam conversa con la recepción |
| `#decisiones` | `1567954632838479993` | Lo que espera la aprobación de Sam |
| `#actividad-oficina` | `1567954709820473446` | Avisos de Paperclip. Todavía no se alimenta |
| `#parte-semanal` | `1567954800765829280` | El parte del viernes |

Estos identificadores no son llaves. **Las llaves son dos y no se escriben aquí, en un chat ni en
ningún archivo del repositorio:** la del bot y la dirección del webhook.

**A qué canal escribe el puente.** El puente tiene un solo webhook, o sea un solo canal.
**Propuesta: `#alfred`,** para que los avisos lleguen donde Sam conversa, como pasaba en
Telegram. Lo decide Sam al crear el webhook.

**Quién más ve esos canales.** Según el plan v2 de la sesión coordinadora (2026-11-05, tarde),
Sam ya es el dueño del servidor y solo él ve los canales privados. Igual vale la regla de la
oficina: Discord es un servicio externo y ahí no se escriben datos de clientes, montos ni llaves.
Por eso los avisos del puente llevan solo la tarea, su estado y el enlace a Paperclip, nunca el
título ni el texto de un comentario.

## 3. Antes de empezar

- [ ] La PR de la SDD-0607 está integrada en `main`. Se instala el código de `main`, no el de una
      rama.
- [ ] Sam autorizó el corte nombrando el VPS de la oficina, y está presente: las pruebas de ida
      y vuelta las hace él.
- [ ] Hay una entrada al VPS con permisos de administrador. La de solo lectura no sirve.
- [ ] Sam creó el **bot** en el portal de desarrolladores de Discord y lo invitó al servidor con
      el rol de recepción: sin permisos de administrador y con acceso solo a la categoría
      Oficina.
- [ ] Sam creó el **webhook** en el canal elegido, con un nombre que lo distinga del bot.
- [ ] Sam tiene a mano su ID de usuario de Discord, para la lista de usuarios permitidos.
- [ ] Las dos llaves las pega Sam en el VPS. No pasan por el chat de ninguna sesión.
- [ ] Se sabe quién corta y quién mira. Si algo no calza, se para y se vuelve atrás (§9).

## 4. Paso 0 · Leer antes de tocar

Solo lectura. Ningún comando de este paso imprime una llave.

```bash
sudo systemctl status dtd-alfred-bridge.service dtd-hermes-telegram.service --no-pager
```

```bash
sudo systemctl cat dtd-alfred-bridge.service dtd-hermes-telegram.service
```

De la unidad del puente anota **cómo declara `telegram_token`** (la línea de credencial y dónde
está el archivo) y con qué usuario corre. De ahí sale el cambio del paso 3.

```bash
sudo sha256sum /usr/local/lib/dtd-alfred/*.py
```

Tiene que dar, para `bridge.py`, `3266e86c8b0ac072…`; para `desktop_feed.py`, `a68f23edf5b7ca39…`;
y para `bridge_mcp.py`, `2b2623600fd1f72d…`. **Si no coincide, para:** alguien cambió el puente
después del 2026-11-05 y este código no parte de lo que hay.

```bash
python3 --version
```

Cuántos avisos y encargos hay esperando:

```bash
sudo python3 -c "import sqlite3; d=sqlite3.connect('file:/var/lib/dtd-alfred/bridge.sqlite?mode=ro', uri=True); print('avisos sin enviar', d.execute('select count(*) from outbox where sent is null').fetchone()[0]); print('encargos en cola', d.execute(\"select count(*) from requests where status='queued'\").fetchone()[0])"
```

**Qué hacer con la cola antes del corte:**

1. Lo ideal es cortar con los dos en cero. Si hay avisos sin enviar, espera unos minutos con el
   puente de Telegram corriendo: los entrega él.
2. Si no bajan (Telegram no está aceptando), anota cuántos son y sigue. El puente nuevo los manda
   por Discord: si alguno pasa de 2.000 caracteres, lo parte al enviarlo, en la misma fila y en
   orden, y lo que ya salió no se repite.
3. **No los borres** para cortar más rápido. Son avisos de ALFRED que Sam todavía no leyó.
4. Los encargos en cola no dependen del canal: el puente los entrega a Paperclip igual.

Los avisos que el puente de Telegram ya guardó llevan el texto completo de los comentarios,
porque así eran antes. Saldrán por Discord con ese texto. Si eso no se quiere, hay que esperar a
que Telegram los entregue antes de cortar.

Por último, lee en la documentación de la versión instalada de Hermes cómo se configura Discord:
dónde va la llave del bot, cómo se limita a un usuario y a un canal, y cómo se apaga Telegram.
**Este runbook no trae esos nombres porque nadie los verificó.**

## 5. Paso 1 · Respaldo

Con fecha en el nombre y legible solo por root:

- la carpeta `/usr/local/lib/dtd-alfred/`;
- `/etc/dtd-alfred/config.json`;
- las dos unidades de systemd y sus añadidos;
- la base `/var/lib/dtd-alfred/bridge.sqlite`, copiada con el servicio detenido o con el
  respaldo en línea de SQLite;
- la configuración del perfil de recepción de Hermes.

El respaldo contiene llaves. No sale del VPS.

## 6. Paso 2 · Preparar sin cortar

Nada de este paso cambia lo que está corriendo.

1. Copia el puente de `main` a una carpeta al lado, por ejemplo `/usr/local/lib/dtd-alfred.nuevo/`:
   `bridge.py`, `bridge_mcp.py`, `desktop_feed.py` y la carpeta `tests/`.
2. Corre las pruebas **en el VPS**, con su Python:

   ```bash
   python3 -B -m unittest discover -s /usr/local/lib/dtd-alfred.nuevo/tests
   ```

   Tienen que pasar todas. Si falla alguna, para: es la primera vez que este código corre en esa
   máquina.
3. Sam pega la dirección del webhook en un archivo de credencial nuevo, junto al de Telegram,
   con el mismo dueño y los mismos permisos que ese.
4. Comprueba la forma de la credencial sin imprimirla:

   ```bash
   sudo python3 -c "import sys; sys.path.insert(0,'/usr/local/lib/dtd-alfred.nuevo'); import bridge; bridge.discord_sender(open(sys.argv[1]).read().strip()); print('credencial con forma de webhook')" RUTA_DE_LA_CREDENCIAL
   ```

   Si falla, el mensaje no muestra la dirección. La causa más común es haber pegado algo de más:
   tiene que ser la dirección tal como la da Discord, sin nada después.

## 7. Paso 3 · Cortar el puente

La recepción sigue en Telegram. Así Sam puede probar el camino nuevo de los avisos sin quedarse
sin canal para pedir.

1. Detén el puente: `sudo systemctl stop dtd-alfred-bridge.service`.
2. Cambia la carpeta: la actual pasa a `dtd-alfred.telegram` y la nueva pasa a `dtd-alfred`.
3. En la unidad, cambia la credencial `telegram_token` por `discord_webhook`, apuntando al
   archivo del paso 2. Es el cambio que anotaste en el paso 0. **Sin esto el servicio no
   arranca:** el puente nuevo busca `discord_webhook` y ya no lee `telegram_token`.
4. `sudo systemctl daemon-reload` y `sudo systemctl start dtd-alfred-bridge.service`.
5. Comprueba que arrancó:

   ```bash
   sudo systemctl is-active dtd-alfred-bridge.service && sudo journalctl -u dtd-alfred-bridge.service -n 20 --no-pager
   ```

   Tiene que decir «Puente ALFRED iniciado» y no repetir «Ciclo pendiente».

**Prueba de ida y vuelta del puente, con Sam:**

- [ ] Sam le pide un encargo de prueba a la recepción, todavía por Telegram.
- [ ] El recibo con el número de tarea **llega a Discord**, al canal del webhook, y **no** a
      Telegram.
- [ ] El aviso no menciona a nadie ni trae vista previa de enlaces.
- [ ] Sam le pide a ALFRED que comente esa tarea. Llega un aviso con el número de la tarea, su
      estado y el enlace a Paperclip, **sin el texto del comentario**. Sam le pide el detalle a la
      recepción y se lo trae.
- [ ] `estado_conexion`, pedido a la recepción, muestra «avisos_sin_entregar» y
      «avisos_inciertos» en cero.
- [ ] En Paperclip, la descripción de la tarea dice «canal privado: Discord» y que las
      respuestas vuelven por Discord.

Si algo falla y no se arregla en el momento: vuelta atrás del puente (§9.1).

## 8. Paso 4 · Cortar la recepción y apagar Telegram

1. En el perfil de recepción, configura Discord como dice la documentación de Hermes que leíste
   en el paso 0: la llave del bot, **solo el usuario de Sam** en la lista de permitidos, también
   para mensajes privados, y solo el canal `#alfred`.
2. En el mismo cambio, apaga la conexión de Telegram de ese perfil.
3. Reinicia la recepción: `sudo systemctl restart dtd-hermes-telegram.service`. El servicio
   conserva su nombre; renombrarlo es un paso posterior (§11).

**Prueba de ida y vuelta de la recepción, con Sam:**

- [ ] Sam escribe en `#alfred` y la recepción le contesta.
- [ ] Sam pide un encargo por Discord. Llega el recibo y la tarea aparece en Paperclip.
- [ ] Sam comenta esa tarea por Discord y el comentario aparece en Paperclip.
- [ ] **La recepción no le contesta a los avisos del puente.** Si lo hace hay un bucle: para y
      vuelve atrás.
- [ ] La recepción **no** contesta a otro usuario ni en otro canal. Quién hace de «otro usuario»
      lo decide Sam.
- [ ] La recepción recuerda algo que Sam le había dicho por Telegram. Es la razón de cambiar la
      conexión del mismo perfil en vez de crear uno nuevo.
- [ ] Por Telegram ya no contesta nadie.

**Apagar Telegram del todo, en esta misma sesión, con las pruebas en verde:**

- [ ] La recepción ya no tiene configurada la conexión de Telegram.
- [ ] Se borran del VPS los archivos de las llaves de Telegram: la del puente y la de la
      recepción. Queda la copia del respaldo.
- [ ] `chat_id` se quita de `/etc/dtd-alfred/config.json`. El puente nuevo no lo lee.
- [ ] Se cambian los textos de la recepción y de ALFRED que todavía digan Telegram.
- [ ] **Sam revoca en Telegram las llaves de los bots.** Este es el punto sin vuelta: después,
      volver atrás exige crear bots nuevos.

## 9. Volver atrás

Se vuelve atrás si una prueba de ida y vuelta falla y no se arregla en el momento. **No se
restaura la base:** el puente de Telegram trabaja con la misma, y restaurarla perdería los
encargos hechos mientras tanto.

### 9.1 Solo el puente (falló el paso 3)

1. `sudo systemctl stop dtd-alfred-bridge.service`.
2. La carpeta `dtd-alfred.telegram` vuelve a ser `dtd-alfred`.
3. En la unidad, la credencial vuelve a `telegram_token`. `sudo systemctl daemon-reload`.
4. `sudo systemctl start dtd-alfred-bridge.service` y comprueba que arrancó.
5. Sam pide un encargo por Telegram y el recibo le llega por Telegram.

Los avisos que el puente nuevo dejó sin enviar salen por Telegram. Son trozos más cortos que los
de Telegram, así que entran. **Antes de volver, resuelve las entregas inciertas (§10):** el
puente de Telegram no las conoce y las reenviaría todas. Las columnas nuevas de la base no le
molestan.

### 9.2 La recepción (falló el paso 4)

1. Restaura la configuración del perfil desde el respaldo: Telegram encendido y Discord apagado.
2. `sudo systemctl restart dtd-hermes-telegram.service`.
3. Sam escribe por Telegram y la recepción le contesta.
4. Decide si el puente se queda en Discord o también vuelve (§9.1). Pueden quedar cruzados un
   rato: Sam pide por Telegram y recibe por Discord.

### 9.3 Después de revocar las llaves de Telegram

Ya no hay vuelta directa. Hay que crear bots nuevos en Telegram, pegar sus llaves y repetir
§9.1 y §9.2. Por eso revocar es lo último.

## 10. Entregas inciertas

Un aviso queda como **entrega incierta** cuando el puente lo mandó a Discord y no volvió
respuesta: se agotó el tiempo o se cortó la conexión. Pudo haber llegado o no. El puente no lo
reenvía solo, para no duplicarlo; lo aparta, sigue con los demás y espera un minuto antes de
volver a enviar. Una conexión que ni siquiera se abrió no es incierta: esa se reintenta sola.

Cómo se ve: `estado_conexion` cuenta «avisos_inciertos». Para listarlos, sin el texto:

```bash
sudo python3 -c "import sqlite3; d=sqlite3.connect('file:/var/lib/dtd-alfred/bridge.sqlite?mode=ro', uri=True); [print(r) for r in d.execute('select id, length(body), message_ids, error from outbox where sent is null and uncertain is not null')]"
```

Cómo se resuelve, uno por uno y con Sam:

1. Sam busca el aviso en el canal por la hora y el número de tarea que trae el `id` de la fila.
   `message_ids` tiene los mensajes de esa fila que Discord sí confirmó.
2. **Si llegó:** se marca como enviado, con el servicio detenido:

   ```bash
   sudo python3 -c "import sqlite3,sys,time; d=sqlite3.connect('/var/lib/dtd-alfred/bridge.sqlite'); d.execute('update outbox set sent=?, uncertain=null, error=null where id=? and uncertain is not null', (time.time(), sys.argv[1])); d.commit()" ID_DE_LA_FILA
   ```

3. **Si no llegó:** se vuelve a poner en la cola. Sale primero, porque conserva su lugar:

   ```bash
   sudo python3 -c "import sqlite3,sys; d=sqlite3.connect('/var/lib/dtd-alfred/bridge.sqlite'); d.execute('update outbox set uncertain=null, next_try=0, error=null where id=? and uncertain is not null', (sys.argv[1],)); d.commit()" ID_DE_LA_FILA
   ```

4. Si son muchos a la vez, es que la red del VPS falló un rato: conviene arreglar eso primero.

## 11. Al terminar

- [ ] La cola quedó vacía. Es la consulta del paso 0: «avisos sin enviar» en cero. Si no baja,
      el webhook no está aceptando: toda la cola espera.
- [ ] No quedan entregas inciertas sin resolver (§10).
- [ ] En el handoff quedan la fecha, quién cortó, qué pruebas pasaron y qué se dejó. **Sin
      llaves, sin direcciones de webhook y sin la IP.**
- [ ] El respaldo queda en el VPS hasta que Sam diga.

**Queda para después, con su propio encargo:**

- Renombrar el perfil `telegram` y el servicio `dtd-hermes-telegram.service`. Toca la lista
  cerrada de perfiles del VPS.
- Que los avisos lleguen al hilo de cada pedido y no al canal.
- `#actividad-oficina`, con la extensión de Paperclip.
- Guardar en el repositorio la unidad de systemd del puente, sin llaves.

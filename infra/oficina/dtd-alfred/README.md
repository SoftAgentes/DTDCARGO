# Puente de ALFRED (`dtd-alfred`)

Código del puente que le pasa a ALFRED, el CEO agente de la oficina, los encargos de Sam, y le
devuelve a Sam los avisos. Corre en el **VPS de la oficina de agentes**, no en el servidor de DTD
Cargo. Hasta la [SDD-0607](../../../docs/specs/0607-oficina-puente-discord/spec.md) vivía solo en
ese VPS.

> **Esta carpeta no se despliega sola.** Cambiar un archivo aquí no cambia nada en el VPS. Pasarlo
> allá es un paso manual, con autorización de Sam, que sigue el
> [runbook del corte a Discord](../../../docs/runbooks/oficina-corte-discord.md).

## Qué hace y qué no

Sam conversa con un perfil de recepción de Hermes. Cuando pide trabajo, la recepción llama a una
de las cinco herramientas del puente, y el puente habla con Paperclip en nombre de ALFRED.

| Herramienta | Qué hace |
|---|---|
| `encargar_alfred` | Crea una tarea en el proyecto autorizado y se la asigna a ALFRED |
| `consultar_tarea` | Lee el estado y los comentarios de una tarea creada por este canal |
| `comentar_tarea` | Agrega una aclaración de Sam a una tarea de este canal |
| `listar_tareas` | Lista los últimos encargos de este canal y los que están en cola |
| `estado_conexion` | Comprueba el enlace con ALFRED |

Además revisa cada 15 segundos las tareas de este canal y le avisa a Sam cuando ALFRED comenta, se
bloquea o termina.

**No aprueba, no publica, no contrata y no toca otro proyecto.** No tiene llave de Junta. Solo ve
las tareas que él mismo creó.

## Piezas

| Archivo | Qué es |
|---|---|
| `bridge.py` | El servicio. Guarda encargos y avisos en una base SQLite propia, para no perder nada si Paperclip o el canal de avisos se caen |
| `bridge_mcp.py` | Adaptador que la recepción carga como servidor MCP. No tiene credenciales: habla con el servicio por un socket local |
| `desktop_feed.py` | Lista de entregas y cierres para la aplicación de escritorio de Hermes. Solo lectura |
| `tests/test_puente.py` | Pruebas, sin red: Paperclip y Discord son dobles |
| `tests/mutantes.py` | Rompe el puente una línea por vez y exige que alguna prueba falle |

Solo usa la biblioteca estándar de Python.

## Dónde vive en el VPS

Según la lectura del 2026-11-05 que hizo la sesión coordinadora y lo que el propio código nombra.
**Esta carpeta no lo comprueba.**

| Qué | Dónde |
|---|---|
| Código | `/usr/local/lib/dtd-alfred/` |
| Servicio | `dtd-alfred-bridge.service` |
| Configuración | `/etc/dtd-alfred/config.json`: `company_id`, `project_id`, `alfred_id`, `allowed_uid` y, para la aplicación de escritorio, `desktop_uid` y `desktop_gid` |
| Credenciales | Las entrega systemd al servicio. `paperclip_token` y, desde esta versión, `discord_webhook` (antes `telegram_token`) |
| Base | `/var/lib/dtd-alfred/bridge.sqlite` |
| Sockets | `/run/dtd-alfred/bridge.sock` (recepción) y `/run/dtd-alfred-sam/bridge.sock` (escritorio) |

`chat_id` era de Telegram y esta versión ya no lo lee. La unidad de systemd no está en el
repositorio.

**Ninguna llave vive aquí.** `discord_webhook` es la dirección completa de un aviso automático de
Discord: quien la tenga puede escribir en ese canal. Va solo en el VPS.

## Historial

| Commit | Qué es |
|---|---|
| `5c8d0d546` | La versión de Telegram, tal como corría en el VPS. `bridge.py` sha256 `3266e86c8b0ac072…` |
| `bafb330de` | El parche a Discord de la sesión coordinadora, sin retoques |
| `6ddf7da0c` | La revisión de ese parche |

Para volver a la versión de Telegram: `git show 5c8d0d546:infra/oficina/dtd-alfred/bridge.py`.

## Qué cambió con Discord

- Los avisos salen por un webhook de Discord, sin menciones y sin vista previa de enlaces.
- Se parten en trozos de 1.900 unidades, medidas como UTF-16, bajo el tope de 2.000 de Discord.
- La cola es **estricta**: si un aviso no sale, los que vienen detrás esperan. Así un mensaje largo
  no llega desordenado.
- Ante un 429 se espera el plazo que pide Discord. Si Discord avisa que no quedan envíos en la
  ventana, la tanda se corta y sigue en el ciclo siguiente.
- Un contenido que Discord rechaza (400) se descarta y se avisa, en vez de frenar la cola.
- La dirección de un webhook y la llave de un bot de Discord se enmascaran como cualquier secreto.
- Las claves internas (`telegram:` y `dtd-telegram:`) **se conservan a propósito**: cambiarlas
  duplicaría encargos ya registrados.

## Pruebas

```bash
python -m unittest discover -s infra/oficina/dtd-alfred/tests -v
```

```bash
python infra/oficina/dtd-alfred/tests/mutantes.py infra/oficina/dtd-alfred
```

El harness las corre con `pnpm harness:test`, desde `scripts/tests/oficina-puente.node.mjs`. Ahí
hay un piso de pruebas: si corren menos de las esperadas, falla. En el CI no se saltan.

## Límites conocidos

- **Sin probar contra Discord real.** Los códigos y las cabeceras de límite de envíos salen de su
  documentación. La prueba de ida y vuelta es parte del runbook.
- Las pruebas no arrancan el servicio: los sockets y la comprobación del usuario que llama solo
  existen en Linux y no están cubiertos.
- Mientras el puente envía una tanda, las llamadas de la recepción esperan. Ya era así con
  Telegram.
- Si el webhook se borra o pierde permiso, toda la cola espera y reintenta. Ninguna herramienta
  le dice hoy a Sam cuántos avisos hay sin entregar.
- Los avisos llegan al canal, no al hilo de cada pedido.

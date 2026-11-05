---
sdd: "0607"
title: "Puente de ALFRED en el repositorio y corte de la oficina a Discord"
status: proposed
author: "Claude Worker «Oficina reestructura» (Sam)"
created: 2026-11-05
updated: 2026-11-05
supersedes: null
superseded_by: null
related: ["0564", "0605", "0606"]
confidencialidad: interno
---

# SDD-0607 — Puente de ALFRED en el repositorio y corte de la oficina a Discord

> Versiona el código del puente que le pasa a ALFRED los encargos de Sam, lo deja listo para
> avisar por Discord en lugar de Telegram, con sus pruebas corriendo en el harness, y escribe el
> runbook del corte.
>
> **No toca el VPS de la oficina, Discord ni producción.** Nada de esto está instalado: el VPS
> sigue con la versión de Telegram hasta que alguien ejecute el runbook con la autorización de
> Sam.

## Pedido

Encargo de la sesión que coordina el plan de la oficina, del 2026-11-05: versionar el puente,
proponer dónde vive, subirlo con sus pruebas en el harness, revisar con ojo crítico el parche a
Discord que esa sesión dejó preparado y escribir el runbook del corte. Límites del encargo: no
tocar el VPS, Discord ni producción; ninguna llave ni dirección de webhook en el repositorio.

Decisiones de Sam que esta SDD aplica, registradas en la SDD-0605:

- **Discord reemplaza a Telegram** como central única (2026-11-05).
- **Corte directo, sin semana de doble envío:** «quitar Telegram de una vez» (2026-11-05). En
  cada pieza, Telegram se apaga en el mismo paso en que Discord queda probado.

## Contexto

- Sam no habla directo con ALFRED. Habla con un perfil de recepción de Hermes, que le pasa los
  encargos a ALFRED por un puente propio. El puente crea la tarea en Paperclip y le devuelve a
  Sam los avisos por su propia llave de Telegram. Lo midió la sesión coordinadora el 2026-11-05,
  en solo lectura.
- **Ese código no estaba en el repositorio.** Vivía solo en el VPS de la oficina.
- La sesión coordinadora dejó una copia sin llaves del original, un parche que lo pasa a Discord
  y siete pruebas locales.

## Alcance

### Qué entra

1. El puente en `infra/oficina/dtd-alfred/`: primero la versión de Telegram tal como corre,
   después el parche a Discord y después su revisión, en commits separados.
2. Sus pruebas, corriendo en `pnpm harness:test`.
3. El runbook del corte: `docs/runbooks/oficina-corte-discord.md`.

### Qué no entra

- **Ejecutar el corte.** El runbook queda escrito y sin ejecutar.
- **La unidad de systemd del puente y la configuración de Hermes.** No están en la copia que
  llegó y esta sesión no entra al VPS. El runbook manda leerlas antes de tocar nada.
- **Los avisos del Studio a Discord** (SDD-0606) y los del servidor de producción.
- **`#actividad-oficina`:** lo alimenta una extensión de Paperclip que todavía no existe.
- **Renombrar el perfil y el servicio de recepción**, que hoy se llaman `telegram`. El plan lo
  deja para después del corte.
- **Los documentos de `docs/organizacion/`.** Los cambia la SDD-0605, en su propia PR.

## Dónde vive

`infra/oficina/dtd-alfred/`. Es infraestructura, no producto: ESLint ya ignora `infra/`, y el
nombre separa la oficina de agentes del servidor de DTD Cargo (`infra/dtd-cargo/`, `infra/ops/`).
La carpeta lleva el nombre que el servicio tiene en el VPS. Es una propuesta; si se prefiere otro
lugar, se mueve antes de integrar.

## Revisión del parche

El parche hace lo que dice: cambia el envío, la credencial, el largo de los trozos y la
etiqueta del canal, y conserva las claves internas para no duplicar encargos. Esto es lo que le
faltaba. Cada punto tiene una prueba que falló contra el parche tal como llegó.

| # | Qué faltaba | Qué pasaba | Arreglo |
|---|---|---|---|
| 1 | El texto del contrato que recibe ALFRED en cada tarea | Seguía diciendo que las respuestas vuelven «por Telegram» | Usa la etiqueta del canal |
| 2 | El enmascarado de secretos solo conocía la llave de Telegram | La dirección de un webhook de Discord, la llave de un bot y la línea de su variable salían tal cual hacia el canal | Se enmascaran los tres |
| 3 | Los avisos que ya estaban en cola al cortar | Se guardaron en trozos de 3.500, que Discord no acepta. Se habrían reintentado para siempre | Se parten al enviar; un reintento no repite lo ya enviado |
| 4 | La forma de medir el largo | Python cuenta un emoji como un carácter; quien cuenta en UTF-16 lo cuenta como dos. Un trozo con muchos emojis podía pasar el tope | Se mide en unidades UTF-16, la cuenta más exigente |
| 5 | El orden cuando un envío falla | Los siguientes seguían saliendo. Un mensaje largo, que en Discord son casi el doble de trozos, llegaba desordenado | La cola es estricta: si uno no sale, los de atrás esperan |
| 6 | El plazo de un 429 y el aviso de que no quedan envíos | Se reintentaba con un plazo propio y se seguía enviando contra el límite | Se respeta el plazo que pide Discord y se corta la tanda |
| 7 | Un contenido que Discord rechaza | Con la cola estricta la frenaría para siempre | Se descarta y se avisa a Sam por el mismo canal |
| 8 | La forma de la credencial | Si traía una consulta o un fragmento, agregarle `?wait=true` la dejaba malformada | Tiene que ser la dirección limpia del webhook |
| 9 | La prueba del 429 | Su doble devolvía una respuesta con estado 429. La biblioteca real no devuelve los 4xx: los lanza. La prueba cubría un camino que no ocurre | Se prueba el error real, y que no arrastra la dirección del webhook |

El punto 5 cambia una conducta que también tenía la versión de Telegram. Se deja escrito porque
es el cambio de mayor alcance de la revisión: un webhook borrado o sin permiso frena toda la
cola hasta que se arregle, en vez de dejar pasar a los demás avisos, que igual fallarían.

## Lo que no se pudo comprobar

- **Discord real.** Los códigos de respuesta y las cabeceras de límite de envíos salen de la
  documentación de Discord. No se envió nada.
- **Cómo cuenta Discord el tope de 2.000.** Por eso se mide de la forma más exigente.
- **La copia contra el VPS.** Los archivos son idénticos byte a byte a la copia que dejó la
  sesión coordinadora. Esta sesión no los comparó contra el VPS; el runbook lo hace antes de
  tocar nada.
- **El arranque del servicio.** Los sockets y la comprobación del usuario que llama solo
  existen en Linux; las pruebas no los cubren.
- **Linux y la versión de Python del VPS.** Las pruebas corrieron en Windows con Python 3.14. En
  Linux las corre el CI de la PR; en el VPS, el runbook.

## Allowlist exacta

| Archivo | Cambio |
|---|---|
| `infra/oficina/dtd-alfred/bridge.py` | Nuevo |
| `infra/oficina/dtd-alfred/bridge_mcp.py` | Nuevo, sin cambios respecto del VPS |
| `infra/oficina/dtd-alfred/desktop_feed.py` | Nuevo |
| `infra/oficina/dtd-alfred/README.md` | Nuevo |
| `infra/oficina/dtd-alfred/tests/test_puente.py` | Nuevo |
| `infra/oficina/dtd-alfred/tests/mutantes.py` | Nuevo |
| `scripts/tests/oficina-puente.node.mjs` | Nuevo: corre las pruebas en el harness |
| `docs/runbooks/oficina-corte-discord.md` | Nuevo |
| `docs/specs/0607-oficina-puente-discord/spec.md` | Nuevo (esta spec) |
| `docs/specs/README.md` | Índice regenerado con `pnpm docs:index` |
| `.agents/handoffs/sdd-0607-oficina-puente-discord.md` | Nuevo (handoff de la tarea) |

## Criterios de aceptación

1. El primer commit del puente es idéntico byte a byte a la copia recibida, y su mensaje trae
   los sha256.
2. El parche de la sesión coordinadora entra sin retoques en su propio commit, y la revisión en
   otro.
3. `pnpm harness:test` corre las pruebas del puente, exige un piso de pruebas y no las salta en
   el CI.
4. Cada punto de la revisión tiene una prueba que falla sin su arreglo.
5. Ningún archivo trae llaves, direcciones de webhook ni la IP del VPS.
6. El runbook cubre recepción, puente, prueba de ida y vuelta, apagado de Telegram en el mismo
   paso y vuelta atrás, y separa lo medido de lo que hay que leer en el VPS antes de actuar.
7. `pnpm docs:check` y `pnpm sdd:check` pasan y el diff no sale de la allowlist.

## Validación

| Comprobación | Aplica | Motivo |
|---|---|---|
| Pruebas del puente (`unittest`) y su enganche al harness | Sí | Es el código que cambia |
| Mutantes del puente | Sí | Para saber si las pruebas miran lo que dicen |
| `pnpm harness:test` completo | Sí, en el CI | Se agregó un archivo al harness. En local corre solo ese archivo: una corrida pesada en la PC compartida pide turno al Director General |
| `pnpm docs:index`, `pnpm docs:check`, `pnpm sdd:check` | Sí | Hay una spec nueva |
| `pnpm verify` | **No aplica al producto** | El diff no toca la aplicación, migraciones ni textos del sitio. De sus pasos, el único que lee estos archivos es `harness` |

## Riesgos

| Riesgo | Control |
|---|---|
| Que alguien instale esta versión sin leer la unidad de systemd y el servicio no arranque por la credencial | El runbook empieza por leer la unidad y cambia la credencial en el mismo paso que el código |
| Que el corte deje a Sam sin canal | El runbook prueba cada pieza con un mensaje real antes de apagar Telegram, y dice cómo volver atrás |
| Que la cola estricta se frene por un webhook roto y Sam no se entere | Límite conocido, escrito en el README. El runbook manda mirar la cola al terminar |
| Que la dirección del webhook termine en el repositorio o en un mensaje | No se escribe en ningún archivo, los errores no la llevan y el puente la enmascara si aparece en un texto |
| Que el puente responda a sus propios avisos y se arme un bucle | El puente no lee Discord. El runbook comprueba que la recepción ignora los mensajes del webhook |

## Qué no autoriza

No autoriza entrar al VPS, instalar el puente, crear el bot ni el webhook, cambiar la recepción
ni apagar Telegram. Cada uno necesita la autorización de Sam que el runbook indica.

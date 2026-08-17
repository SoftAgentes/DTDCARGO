# Handoff · Límites del agente de IA + ping de 23 h — cierre 2026-08-13

> Todo lo de abajo está **medido en Kommo en vivo**, no inferido: contra el panel
> de créditos, contra los 4 agentes uno por uno, y contra el Inbox después de
> que el bot disparara. Verifica antes de cambiar, pero no vuelvas a
> descubrirlo desde cero.

## Lo que quedó EN PRODUCCIÓN (no rehacer)

| Commit | Qué |
|---|---|
| `a7101806` | Los 4 agentes tenían el **Límite de mensajes** en 10 / 20 / 20 / apagado → **a 2** |
| `6b1305c8` | Salesbot **"Seguimiento antes de que cierre la ventana de 24 horas"** — dispara a las 23 h, **cero créditos de IA** |
| `f467515f` · `219b4d8b` | **Un bot por etapa**: los 4 armados y verificados recargando |

Publicados en `origin/main` vía `e07e8067` y `71578ec4`. Detalle completo con
números: [`docs/marketing/kommo-consumo-y-limites.md`](../../docs/marketing/kommo-consumo-y-limites.md).

⚠️ **Lo escrito más abajo en las secciones 2 y 5 quedó SUPERADO el mismo día.**
Se conserva porque explica cómo se llegó acá, pero el estado real es éste:

| Bot en Kommo | Etapa | Qué hace |
|---|---|---|
| `Ping 23 h — Leads Entrantes` | Leads Entrantes | mensaje |
| `Seguimiento antes de que cierre la ventana de 24 horas` | **Contacto inicial** | mensaje (el 93% del embudo) |
| `Ping 23 h — Recontacto` | Recontacto | mensaje |
| `Aviso interno — ventana de 24 h por cerrarse` | Estimado enviado **+** Negociación | ⭐ **tarea** al responsable, vence en 1 h · **cero mensajes al cliente** |

Los cuatro con `23 horas después del último mensaje entrante` y `Horas activas:
Siempre`. El mensaje de Contacto inicial **cambió tres veces**: el que está vivo
es el que abre con *"¡Hola! ¿Cómo vas? ¿Sigue en pie tu proyecto de
importación…"* y ofrece tres ayudas concretas. Si lo vas a citar, **cítalo del
CRM, no de acá.**

🔴 **En Estimado y Negociación el bot NO le escribe al cliente, y es a propósito:**
ahí hay un asesor trabajando el lead, y un bot encima es el mismo problema que
resolvió el límite de mensajes.

## 1. El techo real no es el saldo — es el consumo por lead

Medido: **107 leads en 7 días** (≈460/mes) contra **12.250 créditos** a ~15 por
respuesta. Eso da **menos de 2 respuestas por lead** antes de quedarse seco. El
número que manda es ése; más saldo no lo cambia, sólo corre la fecha.

⭐ **Por eso el arreglo fue el límite, no el plan.** `Ajustes → Límites de
conversación → Límite de mensajes` estaba en 10, 20, 20 y apagado. Con eso, un
solo lead conversador se comía 20 respuestas. Ahora **2**.

El mismo campo resuelve el segundo problema del founder — *"cuando yo quiero
atender, el bot sigue contestando encima"*. Kommo lo dice literal: al tocar el
límite **"la conversación se transferirá al usuario y se omitirán todas las
demás acciones del agente"**. No hacía falta una automatización aparte.

## 2. El ping de 23 h — Salesbot, no agente

La ventana de WhatsApp cierra a las 24 h. El disparador es
`23 horas después del último mensaje **entrante**` — *entrante* = del cliente,
que es lo que hay que medir.

🔴 **La trampa que casi se lleva 3.040 conversaciones:** la plantilla de Kommo
viene con el campo de condición **vacío**, y vacío significa *todas las etapas*.
Si se guardaba así, el ping les llegaba a los **2.796 perdidos** y a los **244
ganados**. Quedó restringido a las **5 etapas no terminales**.

Mensaje: *"Voy a cerrar tu solicitud por ahora. ¿La cierro o todavía quieres
traer tu mercancía?"* — pregunta orientada al "no", que es lo que despierta al
que dejó de contestar.

**Verificado en vivo:** disparó 5 veces y se confirmó en el Inbox a las 08:03
sobre los leads `#23331015`, `#23330181`, `#23330565`, `#23331029`, `#23309673`.

## 3. Las tres capas del agente, en orden

`ACCIONES > FUENTE > PAUTA`. Las Acciones son condiciones CUÁNDO→HACER que se
evalúan **antes** de redactar, así que ganan siempre.

🔴 **El campo `Más` de una Acción es descriptivo, no ejecutable.** Escribir ahí
una excepción **no impide que la Acción dispare** — lo probé dos veces con las
réplicas y las dos veces siguió transfiriendo. Lo único que funciona es
**cambiar la condición**.

## 4. Gotchas de la UI de Kommo (cuestan una hora cada uno)

- ⭐ **Kommo guarda un campo AL SALIR de él (blur).** Si le das a *Guardar* con
  el cursor todavía dentro de la última pauta, **esa pauta se guarda en blanco**.
  Cura: `Tab` antes de guardar. Así se colaron 10 pautas vacías que hubo que
  borrar una por una.
- Las pautas nuevas **no aceptan escritura por script** — hay que tipear de
  verdad (`computer type`), o la fila se graba vacía.
- Que desaparezca el botón *Guardar* **no prueba nada**. Recargar y mirar.
- Las Acciones tienen **dos niveles**: `Guardar acción` y luego `Guardar` arriba.
- El panel de vista previa **no ejecuta efectos**: disparé `Agregar tarea` una
  docena de veces y se crearon **0 tareas**. Sólo sirve para leer el diagnóstico
  (`Intención identificada` / `Acciones completadas` / `Fuentes utilizadas`).
- 🔴 **Kommo admite UNA sesión a la vez** y el panel embebido y Chrome se
  expulsan mutuamente. Esto costó **cuatro rondas** de ida y vuelta: cada vez que
  el founder abría el CRM para mirar algo, mataba la sesión del agente. Para
  trabajar: el agente en su navegador y el founder **sin abrir Kommo** mientras
  dure.

### Trampas nuevas, medidas al armar los 4 bots

- 🔴 **El campo de condición nace VACÍO en cada bot nuevo, y vacío = TODAS las
  etapas.** No es cosa de la plantilla: pasa igual empezando desde cero.
  Revisarlo antes de cada `Guardar`, sin excepción.
- 🔴 **En el selector de etapas hay que clicar la ETIQUETA, no la casilla.** Con
  la casilla la lista se cierra sin marcar nada, y el clic siguiente cae en el
  control de abajo — así se cambió `Horas activas` a "Lu-Sá 09:00-19:00" sin
  querer. Clicando el texto, la lista se queda abierta y admite varias.
- ⚠️ **`computer type` no mete acentos.** Escribir y después corregir con el
  setter nativo (`value` + `input`/`change`/`blur`), que en campos que ya existen
  sí registra. El `insertText` de `execCommand` sí funciona en los
  contenteditable del diseñador de Salesbot.
- ⚠️ **Kommo reusa el nombre `Salesbot #N`** entre bots nuevos. Para saber si
  abriste uno nuevo o el anterior: si la tarjeta *Disparadores* no trae chip, es
  nuevo.

## 5. Lo que queda vivo para la próxima ventana

⭐ **Mañana: el contador de lanzamientos del bot de Contacto inicial.**

El 13-ago cerró en **41** (iba en 7 a media tarde). Con ~73 leads en esa etapa
todavía cuadra con "uno por lead". **El umbral no es un número fijo: es cuántos
leads hay en la etapa.** Si los lanzamientos pasan de eso, está repitiendo → se
arregla con una etiqueta: se la pone al disparar y se excluye a los que ya la
tienen.

🔴 **Y mira el otro número: 41 enviados, 0 leídos.** Si con el mensaje nuevo
sigue en cero, el problema no es el texto — son números de WhatsApp que ya no
están activos, y eso es un problema de datos, no de copy.

Y de paso los créditos. Con el límite en 2 el plan debería alcanzar el mes; si
igual se agota, ya no es configuración — el plan no da para el volumen.

🔴 **Sin medir todavía:**

- **6 de 8 casos de prueba** siguen sin correr en cada uno de los tres agentes
  nuevos (quedaron bloqueados por falta de créditos).
- **La cadena tarea → Telegram no está verificada punta a punta.** Sólo la
  confirma un mensaje real de WhatsApp; el preview no la ejecuta. Ahora importa
  más: el bot de Estimado/Negociación **sólo** crea tareas, así que si esa cadena
  está cortada, ese bot es invisible.
- **El write-back** sigue trabado en que `clients.kommo_lead_id` está NULL en
  432/432, aunque el tablero ya diga "Escritura al CRM: Activo".

## 6. Cierre de esta ventana

Dos tandas el mismo día, cada una en su worktree y publicada por separado:

| Rama | Publicada en `main` | Worktree |
|---|---|---|
| `fix/limites-conversacion-ia` | `e07e8067` | eliminado, sin residuo |
| `docs/cierre-limites-ia-23h` | `053d1569` | eliminado, sin residuo |
| `docs/bots-por-etapa` | `71578ec4` | eliminado, sin residuo |
| `docs/cierre-bots-etapa` | este commit | eliminado al cerrar |

Las ramas locales se borraron con `git branch -d` después de comprobar
`merge-base --is-ancestor` contra `origin/main` — `worktree remove` **no** borra
ramas y ése es el residuo típico en Windows.

El checkout principal quedó **intacto y sin adelantar**: lo comparten ventanas
activas, así que moverle el `HEAD` habría sido meterse en su trabajo. Los
worktrees ajenos (*acentos*, *clientes-456*, *tope-mil*, *verificar*) no se
tocaron.

⚠️ **Un choque real al publicar:** el push de `71578ec4` salió *non-fast-forward*
porque otra ventana publicó el fix de `/verificar` mientras corría el gate. Se
resolvió con `git merge origin/main` y reintento, que es el protocolo del repo —
no con force-push.

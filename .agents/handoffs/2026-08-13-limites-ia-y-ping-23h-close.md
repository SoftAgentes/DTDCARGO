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

Ambos publicados en `origin/main` vía `e07e8067`. Detalle completo con números:
[`docs/marketing/kommo-consumo-y-limites.md`](../../docs/marketing/kommo-consumo-y-limites.md).

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
- Kommo admite **una sesión a la vez**: el panel embebido y Chrome se expulsan.

## 5. Lo que queda vivo para la próxima ventana

⭐ **Mañana: mirar el contador de lanzamientos del Salesbot de 23 h.**

- **10-15** → calibrado, dejarlo.
- **100+** → está repitiendo sobre los mismos leads. Se arregla con una
  etiqueta: se la pone al disparar y se excluye a los que ya la tienen.

Y de paso los créditos. Con el límite en 2 el plan debería alcanzar el mes; si
igual se agota, ya no es configuración — el plan no da para el volumen.

🔴 **Sin medir todavía:**

- **6 de 8 casos de prueba** siguen sin correr en cada uno de los tres agentes
  nuevos (quedaron bloqueados por falta de créditos).
- **La cadena tarea → Telegram no está verificada punta a punta.** Sólo la
  confirma un mensaje real de WhatsApp; el preview no la ejecuta.
- **El write-back** sigue trabado en que `clients.kommo_lead_id` está NULL en
  432/432, aunque el tablero ya diga "Escritura al CRM: Activo".

## 6. Cierre de esta ventana

- Rama `fix/limites-conversacion-ia` → publicada en `main` y **borrada**
  (contenida en `origin/main`, verificado con `merge-base --is-ancestor`).
- Worktree `Claude/DTDCargo/limites-ia` → eliminado, sin residuo físico.
- El checkout principal quedó **intacto**: dos ventanas activas lo comparten
  (*Calculadora sin peso* y *Aliados*), con cambios propios sin commitear que
  **no se tocaron**.

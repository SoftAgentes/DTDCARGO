---
sdd: "0705"
title: "Oficina_Virtual: aviso al cliente y guion explicar-servicio"
status: proposed
author: "Claude (Director Ofi_Hermes) + Hermes DIRECTOR + Sam"
created: 2026-11-21
updated: 2026-11-21
supersedes: null
superseded_by: null
related: ["0626", "0700"]
confidencialidad: interno
---

# SDD-0705 — Oficina_Virtual: aviso al cliente y guion explicar-servicio

> La primera respuesta de la Oficina_Virtual termina con un aviso de que atiende un asistente virtual y que una persona revisa cada
> respuesta. Además, el agente ya puede explicar cómo funciona el servicio sin escalar. Hijo de SDD-0626; va antes de
> la etapa 2 (clientes reales).

## Contexto

- **Guion:** en la etapa 1 (cerrada el 20/11/2026), la conversación 1b preguntó cómo funciona el servicio. Ningún
  guion lo cubría, así que el agente solo podía escalar. «¿Cómo funciona?» va a ser de las preguntas más comunes con
  clientes reales.
- **Aviso:** en la etapa 2 escriben clientes reales. Tienen que saber que los atiende un asistente y que una persona
  revisa cada respuesta. `privacidad.md` lo pide antes de la etapa 2.

Los dos textos los redactó Hermes DIRECTOR (buzón Kanban t_a5065638, 21/11/2026), a partir de los documentos de DTD.
Sam los aprobó el 21/11/2026 con sus palabras: «Sí, apruebo».

## Alcance

- **Sí:**
  - el guion `explicar-servicio` (guiones v0.3);
  - el aviso como prefijo de la primera respuesta de DTD en cada conversación;
  - la sección §14 del runbook `oficina-cable`, con el alcance del tapado de SDD-0700 y el aviso.
- **No:**
  - migraciones;
  - cambios al webhook, al envío, a la pantalla de revisión o a `revisarRespuesta`;
  - más guiones (precio y tiempo, estado con guía, queja: los redacta Hermes aparte);
  - tocar producción.

## Diseño

### 1. Guion `explicar-servicio` (`lib/studio/oficina/guiones-soporte.ts`, v0.2 → v0.3)

- **Cuándo:** el cliente pregunta cómo funciona el servicio, qué hace DTD Cargo o qué traen. Nunca da precios, fechas
  de entrega ni el estado de un envío.
- **Texto** (empieza con el acuse, como todos los guiones):

  > Entendí tu pregunta sobre cómo funciona el servicio de DTD Cargo. En DTD Cargo traemos mercancía desde China
  > hasta Venezuela. El servicio funciona así:
  > 1. Compras tus productos y los envías a nuestro almacén en China (Yiwu).
  > 2. Los recibimos y los registramos.
  > 3. Los consolidamos en un contenedor y zarpa hacia Venezuela.
  > 4. Llega a Venezuela, pasa por aduana y se reparte.
  > 5. Te avisamos para coordinar la entrega.
  > Para seguir un envío necesito el número de guía. Si tu consulta es sobre precios, tiempos o un envío en particular,
  > te paso con el equipo para darte la información exacta.

- **De dónde sale cada paso** (verificado en el repo el 21/11/2026):

| Paso | Fuente |
|---|---|
| Almacén de origen en China, en Yiwu | `docs/organizacion/organigrama-paperclip.md` (bodega en Yiwu); `docs/legal/acuerdo-servicios-v3.mdx` §1.1 y §4.1 (almacén de origen en China) |
| Recepción y registro | `acuerdo-servicios-v3.mdx` §4.1 (recepción en el almacén de origen) |
| Consolidación en contenedor | `acuerdo-servicios-v3.mdx` §1.3 y §3.1 (carga consolidada, cierre del contenedor) |
| Aduana / nacionalización | `acuerdo-servicios-v3.mdx` §1.3 y §9 |
| Entrega puerta a puerta | `acuerdo-servicios-v3.mdx` §1.1 y §1.2 |

- **Revisión automática:** los números «1.» a «5.» son la lista de pasos. Como están en el texto del guion,
  `revisarRespuesta` los permite (la única fuente de cifras permitida es el guion usado). Si el agente le agrega un
  precio, un plazo o un estado («300 USD», «quince días», «ya zarpó»), escala con `dato_inventado`.

### 2. El aviso al cliente (`lib/studio/oficina/aviso-cliente.ts`, nuevo)

> Hola, soy el asistente virtual de DTD Cargo. Una persona del equipo revisa cada respuesta antes de enviártela.

- **Dónde (v0.2):** el despachador lo pone **al final** del texto del borrador, separado por una línea en blanco,
  después de `revisarRespuesta` y justo antes de `entregar`. En la v0.1 iba delante; ver «Enmienda v0.2».
- **Cuándo:** solo si es la primera respuesta de DTD, es decir, si entre los mensajes leídos no hay ninguno con
  `rol: "agente"` (el agente o una persona del equipo). Nunca lo duplica.

#### Decisiones

- **En el borrador, no al enviar.** Así Sam ve el aviso en la tarjeta antes de aprobar, y el envío sigue mandando
  exactamente lo aprobado: la huella que compara el envío no cambia. Ponerlo al enviar habría obligado a tocar la
  huella y el envío, y Sam aprobaría un texto distinto del que sale.
- **Después de la revisión automática.** El aviso es un texto fijo y aprobado, sin cifras, datos ni enlaces; si
  pasara por `revisarRespuesta`, rompería la regla de que el texto empiece con el acuse.
- **«Primera respuesta» = ningún mensaje de DTD entre los leídos.** No hace falta guardar estado ni migración.
- **Límite conocido:** el despachador lee los últimos 20 mensajes. Si hay más de 20 mensajes seguidos del cliente
  después de una respuesta vieja de DTD, el aviso vuelve a salir. Es raro e inofensivo: Sam lo ve y puede rechazar.

### 3. Runbook `docs/runbooks/oficina-cable.md` §14

Qué tapa SDD-0700 y qué no (el nombre y la guía, a propósito), con la condición de Hermes: ampliar o reducir el
alcance requiere el OK de Sam. También describe el aviso y cuándo sale. La parte del tapado rige cuando se fusione la
PR de SDD-0700 (#755).

## Pruebas

- `lib/studio/oficina/__tests__/aviso-guion-servicio.test.ts`:
  - el texto exacto del aviso;
  - el aviso sale en la primera respuesta, no se repite si DTD ya respondió y nunca se duplica;
  - el aviso no trae cifras ni enlaces;
  - el guion existe, en v0.3 y en orden;
  - el guion tiene su acuse y los cinco pasos;
  - el guion pasa `revisarRespuesta` tal cual;
  - el guion no trae precios, montos ni enlaces;
  - un precio, un plazo o un estado agregado escala con `dato_inventado`.
- `lib/studio/__tests__/oficina-despachador.test.ts` (sobre PGlite):
  - la corrida buena guarda el borrador con el aviso delante, una sola vez;
  - con una respuesta anterior de DTD en la conversación, el borrador no lleva el aviso.
- Corridas en local: los 6 archivos de la Oficina_Virtual afectados, 155/155 en verde.

## Enmienda v0.2 (21/11/2026, tras la revisión independiente de la #760)

La revisión de la #760 salió aprobada y dejó cuatro puntos menores. Van en una PR posterior:

1. **Doble saludo → el aviso va al final.** Delante, el aviso («Hola, soy el asistente virtual…») chocaba con el
   «¡Hola! Gracias por escribirle…» del guion `acuse-general`, y el cliente leía dos saludos seguidos. Sam lo
   decidió el 21/11/2026 con sus palabras: «Doble saludo: opción B, el aviso va al final». El texto del aviso no
   cambia. `conAvisoAlCliente` lo agrega al final y no lo duplica si el texto ya lo trae en cualquier lugar.
2. **Tope de 4000 caracteres.** `office_borradores.texto` admite hasta 4000 (check de la 0548), y el aviso suma 112.
   Antes, un borrador que se pasaba lo rechazaba la base y la corrida escalaba como `fallo_interno`. Ahora
   `cabeEnBorrador` mide como la base (caracteres, sin espacios a los lados) y, si no cabe, la corrida escala con
   `borrador_largo`: lo ve una persona y no se guarda texto.
3. **Runbook §14:** dice explícitamente que el tapado rige desde que la #755 (SDD-0700) está en `main` y publicada.
4. **Políticas y allowlist exacta** (abajo).

### Políticas

| Política | Aplica |
|---|---|
| IA-01 v1.0 | **Sí, nivel I2** (prepara un borrador; la persona lo revisa antes de enviarlo). El aviso cumple «el usuario sabe qué hace la IA». El guion no inventa estado del ERP: no da precios, fechas ni estados, y la revisión automática escala si aparecen. La salida segura es escalar a una persona. Sin acción I3 ni I4. |
| AUD-01 | Sin datos personales nuevos. Los borradores siguen con su retención de 90 días (SDD-0626). |
| BTN-01, UPL-01, NUM-01 | No aplican: sin botones, archivos ni montos. |

### Allowlist exacta de implementación

- `lib/studio/oficina/aviso-cliente.ts`
- `lib/studio/oficina/despachador.ts`
- `lib/studio/oficina/guiones-soporte.ts`
- `lib/studio/oficina/__tests__/aviso-guion-servicio.test.ts`
- `lib/studio/__tests__/oficina-despachador.test.ts`
- `docs/runbooks/oficina-cable.md`
- `docs/specs/0705-oficina-aviso-y-guion-servicio/spec.md`
- `docs/specs/README.md`
- `.agents/handoffs/2026-11-21-sdd-0705-aviso-y-guion-servicio.md`
- `.agents/handoffs/2026-11-21-sdd-0705-v02-aviso-al-final.md`

## Vuelta atrás

Revertir el commit. No hay migración ni datos. Los borradores ya guardados con el aviso siguen igual: Sam los aprueba
o los rechaza como cualquier otro.

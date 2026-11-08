---
sdd: "0617"
title: "Reemplazo de los 15 Salesbots de Kommo y costo de los «Ping 23 h» (E6 del programa SDD-0582, paso 6.7)"
status: draft
author: "Claude Worker «E6 Salesbots 6.7» (Sam)"
created: 2026-11-08
updated: 2026-11-08
supersedes: null
superseded_by: null
related: ["0582", "0587", "0614", "0586", "0616"]
confidencialidad: interno
---

# SDD-0617 — Reemplazo de los Salesbots de Kommo (E6, paso 6.7)

> **Solo diseño.** No activa ni borra nada en Kommo, Meta ni el Chatwoot vivo, no programa producto y no lee
> filas de ninguna base. Dice qué hacía cada uno de los 15 Salesbots del inventario de 0.4, qué lo reemplaza y
> cuánto cuesta en Meta. **Nada se le asigna al bot de E7 sin coordinarlo antes con el Subdirector** (§4).

Programa: [SDD-0582](../0582-chatwoot-piloto/spec.md) · checklist: [fila 6.7](../0582-chatwoot-piloto/checklist.md) ·
contrato: [SDD-0587](../0587-chatwoot-contrato-sistema-maestro/spec.md) §6.1 y D8 · 6.6:
[SDD-0614](../0614-crm-reemplazos-kommo/spec.md) §2.4 (R6) y §2.8 (D-SA).

**Etiquetas de evidencia:** **C** código, **D** documento, **T** medido en la cuenta de DTD, **I** inferencia,
**NV** no verificado. Citas de `main` en `3c14715ad` (2026-11-08).

## 1. Punto de partida

- **Los 15 están apagados** y no hay bots nuevos (K-13, leído en Kommo el 2026-10-29, **T**). Los 11 antiguos no
  tienen disparador desde agosto (K-2) y se apagaron el 2026-08-06 con sus sesiones cerradas
  (`docs/runbooks/kommo-salesbots-inventario.md`, **D**). La API pública no los expone (K-3).
- **La discrepancia de la SDD-0587 §6.1 se cierra así:** de los 4 «Ping 23 h», **3 escriben al cliente**
  (Leads entrantes, Contacto inicial y Recontacto) y **1 crea una tarea interna** que vence en 1 h (Estimado
  enviado y Negociación). Lo dice la tabla «Los 4 bots, armados y verificados» de
  `docs/marketing/kommo-consumo-y-limites.md` (2026-08-13, **D**), que coincide con `e0-guias.md`. Por qué K-4
  cuenta 2 es **NV**; se toma la tabla, que nombra los cuatro bots uno por uno.
- **D8 (a)**, aprobada: alerta interna, sin mensaje al cliente. La SDD-0614 ya la diseñó como R6 (señal 3 de
  D-SA, «ventana por cerrar o cerrada») y como «Aviso al dueño», que **nace apagado** (`CRM_AVISO_VENTANA`) y
  pide un OK aparte de Sam para encenderlo (SDD-0614 §2.4).

## 2. Qué reemplaza a cada uno

Destinos posibles: **embudo** (tablero y movimientos de la 6.3, 6.4 y 6.6), **automatización del Studio** (R6 de
la 6.6), **base de conocimiento** (7.4, que lee el bot de E7), **/registro**, **E10** (enrutamiento) o **ninguno**.

| Bot (id) | Qué hacía | Reemplazo | Dónde está | Costo en Meta |
|---|---|---|---|---|
| 38249 Bienvenida horario oficina | Saludo y menú de letras A–H que repartía a los bots de servicio | **Base de conocimiento (7.4)**: el mapa de servicios del menú. **No se recrea el menú** ni un saludo automático: el primer mensaje que sale es la redirección de E10 o la respuesta de una persona | E7, por coordinar (§4) | 0. Un saludo automático costaría 1 mensaje por conversación (D-6.7-2) |
| 38711 Asignar asesor (Round Robin) | Repartía por palabra clave entre usuarios que ya no existen; el 71,4 % caía en Round Robin | **Ninguno**: dueño = el primero que atiende (SDD-0587 §5.4). Con más agentes, la asignación automática de la bandeja de Chatwoot, que no envía nada | Embudo (6.4, hecho) | 0 |
| 38713 Solicitud de datos | Pedía nombre, cédula, correo y dirección por chat | **/registro**, con su atribución (6.4). El patrón «¿su cédula es X?» queda como idea para E7, sin asignar | 6.4, hecho | 0 |
| 38251 Carga marítima | Condiciones del servicio | **Base (7.4)**, revisando los datos (§3) | E7, por coordinar | 0 |
| 38773 Cursos, 38775 Asesorías personalizadas | Información del servicio | **Base (7.4)** | E7, por coordinar | 0 |
| 38715 Validación de proveedores, 38771 Validación de mercancía | Presencial o digital; almacén o fábrica | **Base (7.4)** | E7, por coordinar | 0 |
| 38777 Atención al cliente | Imagen y cambio de etapa | **Ninguno**: el cliente va al número de clientes por E10, y el cambio de tablero es automático (SDD-0587 §4.5) | E10 y 6.3, hechos | 0 |
| 47639 NPS Bot | Encuesta del 1 al 10 al cerrar; nunca corrió | **Ninguno en el 100 %**. Una encuesta después de una entrega queda como idea fuera del programa | — | 0 |
| 54707 Chat del sitio | Vacío; nunca corrió | **Ninguno**: el chat del portal es la 10.5 | 10.5 | 0 |
| Ping 23 h — Leads entrantes | 23 h después del último entrante, en Leads entrantes: mensaje al cliente | **Automatización del Studio**: R6, señal 3, en «Sin atender», y el «Aviso al dueño» a 4 h del cierre | 6.6 (R6), sin código | 0 con D8 (a) |
| Seguimiento antes de que cierre la ventana de 24 horas | Igual, en Contacto inicial | Igual | 6.6 (R6) | 0 |
| Ping 23 h — Recontacto | Igual, en Recontacto | Igual | 6.6 (R6) | 0 |
| Aviso interno — ventana de 24 h por cerrarse | Tarea que vence en 1 h, en Estimado enviado y Negociación | Igual, **sin crear tarea**: la alerta ya es la lista y el aviso (D-6.7-1) | 6.6 (R6) | 0 |

**Ninguno pasa al bot de E7 como conducta.** Lo único que le toca a E7 es **contenido** para la base de 7.4, y
eso se coordina antes (§4).

## 3. Contenido que no se copia tal cual

El inventario de agosto ya marcó los problemas del texto de los bots (`kommo-salesbots-inventario.md`, «Por qué
actualizarlos no servía»): la marca vieja, años de experiencia fijos, un precio de US$60 con reembolso, «tarifas
especiales a partir de 5 CBM» y plazos de 65 a 90 días (el canónico es de 60 a 90). **Una corrección a ese mismo
documento:** dice que «500 KG por CBM es FALSO». Para lo que se le promete al cliente, la regla son 500 kg/m³;
los 1.000 de la calculadora son una excepción temporal. La base de 7.4 tiene que tomar la regla, no el
inventario.

## 4. Coordinación con E7

Antes de asignar algo al bot, el Subdirector lo confirma con el carril E7 (sesión «e7-bot-propio»). Lo que se
propone:

1. **7.3 / 7.4** reciben el mapa de servicios del menú A–H y los textos de los 6 bots de servicio como
   **material de partida**, con la lista de §3. No es un encargo nuevo: ya está en el alcance de 7.3 y 7.4.
2. **El bot no recrea el menú de letras ni saluda solo.** Responde en 1 mensaje por turno (0.8), y fuera de
   horario es decisión de 7.7 (horario por bandeja), no de esta SDD.
3. **Ningún «ping» al cliente desde el bot.** Con D8 (a), el seguimiento de la ventana es una alerta interna.

## 5. Costo de los «Ping 23 h» (lo que pide la fila 6.7)

| Escenario | Mensajes al mes (**I**) | Costo |
|---|---|---|
| **D8 (a), alerta interna** (R6) | 0 | **US$0** |
| (b) Mensaje automático al lead en las 3 etapas, como Kommo | Del orden de ~370 | Cada respuesta cuenta contra el cupo de 1.000 gratis por número desde el 2026-10-01; con el cupo ya pasado por las respuestas humanas (~1.960, spec 0582), ~US$4 al mes a US$0,0113 (tarifa de enero, **D**; la de octubre es **NV**) |
| (b) fuera de la ventana | — | Haría falta plantilla, con precio por categoría **NV** |

**Base del cálculo (I):** K-13 cuenta 17, 368, 145 y 589 lanzamientos en total (1.119), sin saber a qué bot
corresponde cada cifra. Si los 3 que escriben se armaron el 2026-08-13 y corrieron hasta que se apagaron, unos
dos o tres meses, son del orden de 370 al mes. El dinero es poco. **Lo que pesa es otra cosa:** el inventario de
agosto dice «enviados 41, leídos 0» en el primer día, y avisa que tres recordatorios seguidos hacen que reporten
el número. Por eso la recomendación sigue siendo D8 (a).

## 6. Decisiones

| # | Pregunta | Opciones | Recomendación |
|---|---|---|---|
| D-6.7-1 | ¿R6 crea además una tarea, como el «Aviso interno» de Kommo? | (a) No: la lista y el aviso bastan · (b) sí, una tarea por ventana | **(a)**: una tarea por ventana llenaría la lista de tareas vencidas y la señal 4 de D-SA contaría dos veces lo mismo |
| D-6.7-2 | ¿Saludo automático en la bandeja de leads de Chatwoot? | (a) No · (b) sí | **(a)**: cuesta 1 mensaje por conversación y la redirección de E10 ya es el primer mensaje |
| D-6.7-3 | ¿Borrar los Salesbots en Kommo? | (a) No se tocan: apagados, se van con la cuenta en E8 · (b) borrarlos antes | **(a)**: apagados no hacen nada y Kommo no tiene borrado desde la lista; escribir en Kommo pide OK |

## 7. Qué le queda a la 6.7 después de este diseño

- Aceptar el diseño (D-6.7-1 a D-6.7-3), con el Director General.
- Que la 6.6 cumpla R6 (ya diseñado allí) y que E7 confirme §4.
- **Reestimación propuesta (I):** de 1 a **0,5** días restantes. El código vive en la 6.6 y en E7; la 6.7 se cierra
  con la prueba de que ningún reemplazo escribe al cliente cuando R6 esté en main. Cambiar los días base pide su
  línea base con OK de Sam.

## 8. Allowlist exacta

| Archivo | Qué |
|---|---|
| `docs/specs/0617-crm-reemplazo-salesbots/spec.md` | Esta SDD |
| `.agents/handoffs/0617-crm-reemplazo-salesbots.md` | Handoff |

## 9. Seguimiento

- **2026-11-08:** el Director General reservó el número 0617, con el stub `2cfa005e2`. Diseño en borrador. No se activó ni se borró nada. El Subdirector tiene que confirmar §4 con el carril E7.

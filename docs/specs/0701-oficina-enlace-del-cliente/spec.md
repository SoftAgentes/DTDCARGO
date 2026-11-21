---
sdd: "0701"
title: "Oficina_Virtual: un enlace del cliente escala"
status: proposed
author: "Claude (Worker) + Sam"
created: 2026-11-21
updated: 2026-11-21
supersedes: null
superseded_by: null
related: ["0626"]
confidencialidad: interno
---

# SDD-0701 — Oficina_Virtual: un enlace del cliente escala

> Cuando el CLIENTE manda un enlace, la Oficina_Virtual no contesta: lo pasa a una persona, porque un enlace puede
> ser una estafa. Hijo de SDD-0626; va antes de la etapa 2 (clientes reales).

## Contexto

En la etapa 1 (cerrada el 20/11/2026) apareció este hallazgo en la conversación 6: el cliente mandó un enlace y salió
una respuesta normal. La regla `enlace` de `lib/studio/oficina/eval-automatico.ts` solo revisa los enlaces que
escribe el AGENTE (`enlacesAjenos(r.texto, guion.texto)`); lo que manda el cliente no lo mira nadie antes de Sam.
Los directores acordaron arreglarlo antes de la etapa 2, en su propio SDD y PR.

Un enlace del cliente puede ser un «comprobante» falso, una página para robar una clave o un archivo con virus. La
Oficina_Virtual no puede abrirlo ni juzgarlo, y una respuesta normal le da al enlace un aire de «ya lo vieron».

## Alcance

- **Sí:** el despachador escala la corrida cuando algún mensaje del CLIENTE trae un enlace, sin llamar al agente.
- **No:** abrir, resolver o clasificar el enlace; cambiar la regla `enlace` del agente (sigue igual); cambiar el
  webhook, el filtro de nivel 1, las migraciones o la pantalla de revisión; tocar producción.

## Diseño

Igual que el dinero (`lib/studio/oficina/tema-dinero.ts`, Paso 3b de SDD-0626):

1. **`lib/studio/oficina/tema-enlace.ts`** (nuevo): `tieneEnlace(texto)` y `clienteMandoEnlace(mensajes)`. Mira solo
   los mensajes con `rol: "cliente"`, en memoria; no guarda nada.
2. **`lib/studio/oficina/despachador.ts`:** justo después del chequeo de dinero,
   `if (clienteMandoEnlace(mensajes)) return await escalar("cliente:enlace", 2);`. El texto del cliente no sale
   hacia el proveedor del modelo, igual que con el dinero.

### Decisiones

- **Motivo-código: `cliente:enlace`.** Es un código, como `dinero` o `lectura:*`; no lleva el enlace ni el texto.
  El prefijo `cliente:` lo distingue de `agente:*` (lo pidió el agente) y del código `enlace` del eval automático
  (el agente escribió un enlace).
- **Prioridad 2.** La de un mensaje normal del cliente (orden del filtro: dinero 3 > cliente 2 > resto 1). Un enlace
  no es urgente por sí mismo; lo que importa es que no lo conteste la máquina. Si la conversación además habla de
  dinero, gana el dinero (prioridad 3, motivo `dinero`), porque ese chequeo va primero.
- **Los dominios propios (`dtdcargo.com`) también cuentan.** Imitarlos es fácil (`dtdcargo.com.otro.io`,
  `dtdcarg0.com`, `https://dtdcargo.com@otro.io`) y la Oficina_Virtual no tiene que decidir qué es nuestro. Un
  cliente que pega un enlace de DTD es raro y Sam lo resuelve en segundos. Si en la etapa 2 resulta frecuente, se
  puede abrir una lista de permitidos en un SDD aparte, con el dominio exacto y sin subdominios.

### Qué cuenta como enlace

- **Con esquema o `www.`:** `http://`, `https://`, `ftp://` (cualquier `esquema://`) y `www.…`. Incluye IPs
  (`http://192.168.0.10`).
- **Sin esquema:** `nombre.tld` (con o sin ruta) cuando el TLD está en una lista cerrada de los que se ven en enlaces
  y estafas (`com`, `net`, `org`, `io`, `co`, `me`, `ly`, `ve`, `xyz`, `shop`, `link`, …; la lista está en el
  archivo). Ejemplos: `bit.ly/abc`, `t.me/alguien`, `seguimiento.com.ve`.
- **No cuenta:** un punto entre dos palabras («ok.gracias», «Llegó.Mañana»), cifras («1.500 kg»), puntos
  suspensivos, siglas («S.A.», «C.A.»), «DTD Cargo» y los correos (`ana@gmail.com`: el dominio va pegado a la `@`).
- **TLD que se dejan fuera a propósito**, porque en español son palabras y saldrían de un punto mal puesto: `la`,
  `no`, `si`, `de`, `do`, `to`, `se`, `ya`, `al`, `es`, `am`, `pa` («Voy.pa la oficina», «Lo necesito.Es urgente»).
  El costo: un enlace sin esquema a un `.es` o un `.do` no escala. Con esquema o `www.` sí escala siempre.
- **Lo que no se ve:** una IP sin esquema (`192.168.0.10/login`) y los enlaces escritos para esquivar
  («bit punto ly», «hxxp://»). Ninguno abre con un toque; quedan anotados para revisar en la etapa 2.

## Pruebas

Todos los textos de las pruebas son sintéticos: no se copia nada de la conversación real de la etapa 1.

- `lib/studio/oficina/__tests__/enlace-cliente.test.ts` (nuevo): con enlace (con esquema, `www.`, sin esquema), un
  dominio propio, URLs sin esquema, textos con un punto que no son URL, que solo mira al cliente y que los guiones de
  la etapa 1 no cuentan como enlace.
- `lib/studio/__tests__/oficina-paso3b.test.ts` (sobre PGlite, sin red): la conversación con enlace del cliente sale
  `escalado`, motivo `cliente:enlace`, prioridad 2, `guion` nulo, el aviso «hay 1 pendiente» y **0 llamadas** al
  agente; con dinero y enlace a la vez gana el dinero (prioridad 3).

## Criterios de aceptación

- AC-1: un mensaje del cliente con enlace → escalado `cliente:enlace`, prioridad 2, sin llamar al agente.
- AC-2: sin enlace, la corrida sigue igual que hoy (las pruebas del despachador y del Paso 3b pasan sin cambios).
- AC-3: el motivo no lleva el enlace ni el texto del cliente.
- AC-4: sin migración y sin cambios en producción. Entra en producción con el despliegue normal del ERP.

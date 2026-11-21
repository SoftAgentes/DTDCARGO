---
sdd: "0700"
title: "Oficina_Virtual: tapar los datos personales antes del modelo"
status: proposed
author: "Claude (Worker) + Sam"
created: 2026-11-21
updated: 2026-11-21
supersedes: null
superseded_by: null
related: ["0611", "0626"]
confidencialidad: interno
---

# SDD-0700 — Oficina_Virtual: tapar los datos personales antes del modelo

> El despachador de la Oficina_Virtual le pasa al agente la conversación del cliente con los correos, teléfonos,
> cédulas, RIF y direcciones cambiados por un marcador. Es hija de SDD-0626 y cubre la primera parte del punto (a)
> de privacidad, que tiene que estar antes de la etapa 2 (clientes reales).
>
> **Estado: propuesta.** El PR no se fusiona sin el OK del Director DTD. No toca producción, ni el `.env`, ni la base:
> no hay migración. Los ejemplos son inventados.

## 1. Contexto

La Oficina_Virtual (SDD-0626, «el cable») lee la bandeja de Chatwoot y le pide un borrador al agente
`soporte-chatwoot` de Hermes, que llama a Z.AI (glm-5.3) y, si falla, a DeepSeek (deepseek-chat). Los dos proveedores
tienen sede en China y no se puede verificar desde aquí qué guardan (privacidad.md, hallazgo 13 y §4). La etapa 1
(datos inventados) se cerró y firmó el 20/11/2026. Antes de la etapa 2 los dos directores acordaron el punto (a):

1. tapar los datos personales antes de la llamada al modelo (**esta SDD**);
2. revisar a los proveedores;
3. avisar al cliente.

Hasta hoy el texto llegaba completo: `despachador.ts` armaba `{conversacion_id, mensajes, guiones}` con los mensajes
tal como los leyó de Chatwoot. La salida sí se revisaba: `revisarRespuesta` (eval-automatico.ts) escala un borrador
que trae datos personales, con `detectorDelCable`.

## 2. Alcance

**Entra:**

- `lib/studio/oficina/tapar-datos.ts` (nuevo): `taparDatosPersonales(texto)`, `taparMensajes(mensajes)` y
  `quedanDatos(mensajes)`.
- `despachador.ts`: tapa los mensajes después del chequeo de dinero y antes de armar la llamada. Si después de tapar el
  detector todavía ve un dato, escala con el código `datos_sin_tapar`, sin llamar al agente. Las instrucciones del
  agente suman una línea con los marcadores (`AVISO_DATOS_TAPADOS`). `armarEntrada` se exporta para la prueba.
- `lib/news/autopublicar/control.ts`: la lista de expresiones de datos personales pasa a exportarse con su tipo
  (`PATRONES_DATOS_PERSONALES`). Las expresiones son las mismas; `tieneDatosPersonales` no cambia.
- `cable-textos.ts`: se exporta `TELEFONO_INTERNACIONAL` (la misma expresión).
- `privacidad.md`, hallazgo 13: se corrige lo del respaldo DeepSeek y se anota el tapado.

**No entra:** la revisión de la salida (`revisarRespuesta` sigue igual), los nombres de personas, los números de guía,
la revisión de proveedores y el aviso al cliente (las otras dos partes del punto (a)).

## 3. Diseño

### 3.1 Una sola lista de expresiones

No hay expresiones nuevas de datos personales. `tapar-datos.ts` usa `PATRONES_DATOS_PERSONALES` (la regla de
noticias de SDD-0611 §4.3.1) más `TELEFONO_INTERNACIONAL` del cable: son exactamente las que forman
`detectorDelCable`, el detector que `revisarRespuesta` usa en la salida. Si una expresión cambia, cambian a la vez lo
que se detecta en la salida y lo que se tapa en la entrada.

### 3.2 Marcadores

| Tipo | Marcador |
|---|---|
| correo | `[correo]` |
| teléfono (de Venezuela, internacional, o internacional agrupado como los de China) | `[teléfono]` |
| cédula (V-12.345.678, E 1234567, C.I. 12345678, «cédula: 1…») | `[cédula]` |
| RIF (J-30123456-7) | `[RIF]` |
| dirección | `[dirección]` |

Son estables (el mismo marcador para el mismo tipo, sin numerar) y el detector no los ve como datos: tapar dos veces
da lo mismo que tapar una.

### 3.3 Cómo se tapa

1. El texto se normaliza como lo hace el detector (NFKC, sin invisibles, sin tildes, en minúsculas), carácter por
   carácter, con un mapa de cada posición al texto original. Las expresiones corren sobre el texto normalizado y cada
   hallazgo vuelve a su lugar en el original.
2. Los hallazgos que se pisan se juntan en uno, con el tipo del que empieza antes (o del más largo): «V-12345678-9» es
   RIF y no cédula más «-9».
3. Un hallazgo se estira sobre los dígitos que le siguen pegados.
4. La dirección: la expresión solo ve la palabra de calle y el primer número a menos de 30 caracteres. Se estira hacia
   adelante hasta el final de la frase (salto de línea, «?», «!», «;», o un punto que no sea de una abreviatura de
   cuatro letras o menos como «Av.» o «Edif.»), con tope de 120 caracteres, y hacia atrás hasta la primera palabra de
   calle de la misma frase (tope de 60). Las palabras de calle se leen del código de la misma expresión
   (`PALABRAS_DE_CALLE`); una prueba cae si la expresión cambia de forma. Se tapa de más a propósito.

Ejemplo (inventado): «Soy V-12.345.678, vivo en la Av. Bolívar, Edif. Torre Sur, piso 3, Caracas. ¿Llegó la guía
DTD-4521?» → «Soy [cédula], vivo en la [dirección]. ¿Llegó la guía DTD-4521?».

### 3.4 En el despachador

```
leer → ¿hay mensaje del cliente? → ¿dinero? (escala, sin llamar) → TAPAR → ¿quedan datos? (escala `datos_sin_tapar`)
     → armarEntrada {conversacion_id, mensajes tapados, guiones} → agente → revisarRespuesta (igual que antes)
```

Se tapan los mensajes de los dos roles: el texto de un agente humano en Chatwoot también puede repetir el teléfono del
cliente. El `conversacion_id` y los guiones van tal cual: los guiones son textos aprobados de DTD. El chequeo de dinero
mira el texto sin tapar, en memoria, como antes.

## 4. Criterios de aceptación

- **AC-1.** Con +58 414…, 0414-…, 58-424…, +86 138…, V-12.345.678, E 1234567, C.I. 12345678, J-30123456-7,
  correos y direcciones con abreviaturas, el texto que recibe el agente trae el marcador y no el dato
  (`lib/studio/oficina/__tests__/tapar-datos.test.ts`).
- **AC-2.** Un texto sin datos personales (una guía, cifras, montos) sale igual.
- **AC-3.** El `conversacion_id` y los guiones no se tocan, aunque un guion traiga un correo o un teléfono de DTD.
- **AC-4.** En la corrida con el modelo simulado, la llamada al agente trae `[teléfono]` y no el teléfono, y ninguna
  fila ni log guarda el texto del cliente (`lib/studio/__tests__/oficina-despachador.test.ts`).
- **AC-5.** Después de tapar, `detectorDelCable` no ve nada en ninguno de los casos de AC-1; si viera algo, la corrida
  escala `datos_sin_tapar` sin llamar al modelo.
- **AC-6.** `tieneDatosPersonales` y la revisión de la salida no cambian (pruebas de noticias y del cable en verde).

## 5. Riesgos y límites

- **No se tapa todo.** Nombres de personas, una dirección sin número, un teléfono en palabras o con un formato que las
  expresiones no ven siguen llegando al proveedor. El tapado reduce lo que sale; no lo vuelve anónimo.
- **Se puede tapar de más.** Una frase con «calle» y un número que no es dirección, o el resto de una frase después de
  una dirección, llegan tapados. El agente escala si le falta un dato, y Sam aprueba cada borrador.
- **El agente ve los marcadores.** Las instrucciones le dicen qué son y que no los repita ni los complete.

## 6. Pendiente del punto (a)

Revisar a los proveedores (Z.AI, DeepSeek) y avisar al cliente, antes de la etapa 2. Están fuera de esta SDD.

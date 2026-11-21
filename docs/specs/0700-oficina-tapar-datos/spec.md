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

- `lib/studio/oficina/datos-personales.ts` (nuevo): la lista de datos personales de la Oficina_Virtual, con su tipo
  y sus marcadores (§3.1).
- `lib/studio/oficina/tapar-datos.ts` (nuevo): `taparDatosPersonales(texto)`, `taparMensajes(mensajes)` y
  `quedanDatos(mensajes)`.
- `despachador.ts`: tapa los mensajes después del chequeo de dinero y antes de armar la llamada. Si después de tapar el
  detector todavía ve un dato, escala con el código `datos_sin_tapar`, sin llamar al agente. Las instrucciones del
  agente suman una línea con los marcadores (`AVISO_DATOS_TAPADOS`). `armarEntrada` se exporta para la prueba.
- `cable-textos.ts`: `detectorDelCable` pasa a usar la lista de la Oficina_Virtual. Con él cambian a la vez la
  revisión de la salida (`revisarRespuesta`), la regla de escritura del cable y el motivo de un rechazo en la pantalla.
- `eval-automatico.ts`: código nuevo `marcador`. Un borrador que trae «[teléfono]» u otro marcador escala.
- `lib/news/autopublicar/control.ts` **no cambia** (v0.2, por la revisión de la #755): el detector de noticias queda
  como estaba.
- `privacidad.md`, hallazgo 13: se corrige lo del respaldo DeepSeek y se anota el tapado.

**No entra:** los nombres de personas, la revisión de proveedores y el aviso al cliente (las otras dos partes del
punto (a)).

## 3. Diseño

### 3.1 Una sola lista, propia de la Oficina_Virtual

`datos-personales.ts` tiene la lista con la que se detecta (la salida del agente con `revisarRespuesta`, los textos que
escribe el cable y el motivo de un rechazo) y con la que se tapa la entrada. Si una expresión cambia, cambian a la vez
las dos cosas.

La v0.1 compartía la lista con la regla de noticias (SDD-0611 §4.3.1). La revisión de la #755 encontró formatos
venezolanos que esa lista no cubre y falsos positivos sobre guías. Arreglarlos allí habría cambiado también el detector
de noticias. Por eso la v0.2 copia la lista a la Oficina_Virtual (más el teléfono internacional agrupado que ya tenía el
cable) y la corrige ahí:

| Cambio | Ejemplos (inventados) |
|---|---|
| Cédula entera detrás de «cédula», «C.I.», «CI:», «cédula es», «N°», con puntos o espacios de miles | «cédula 12.345.678», «CI 12 345 678», «V 12 345 678» |
| RIF de 7 dígitos y con puntos | «J-1234567-8», «J-12.345.678-9» |
| Fijos de Venezuela (02xx), con o sin paréntesis | «(0212) 555 01 01», «0241-555-0101» |
| Borde al inicio de los números: nada pegado a una letra o a otro dígito | «YT2412345678901», «SF1412345678901» no se tocan |
| Móvil sin el 0 ni el 58, solo si va separado | «414-555-1234» sí; «guía 4141234567» no |
| Más palabras de calle: sector, barrio, quinta, manzana, parcela, «av» sin punto; «casa 12», «Casa N.º 14», «torre B» (una vocal sola solo antes de un signo, del final o de «piso», «apto»…) | «Sector El Paraíso, casa 12», «torre A, piso 4» |

Una prueba fija que la regla de noticias sigue igual y que lo que ella ve lo ve también el cable, salvo los números
pegados a otro texto, que el cable deja pasar a propósito (`tapar-datos.test.ts`, «la regla de noticias no cambió»).

### 3.2 Marcadores

| Tipo | Marcador |
|---|---|
| correo | `[correo]` |
| teléfono (de Venezuela, internacional, o internacional agrupado como los de China) | `[teléfono]` |
| cédula (V-12.345.678, E 1234567, C.I. 12.345.678, «cédula: 12.345.678») | `[cédula]` |
| RIF (J-30123456-7, J-1234567-8, J-12.345.678-9) | `[RIF]` |
| dirección | `[dirección]` |

Son estables (el mismo marcador para el mismo tipo, sin numerar) y el detector no los ve como datos: tapar dos veces
da lo mismo que tapar una.

### 3.3 Cómo se tapa

1. El texto se normaliza como lo hace el detector (NFKC, sin invisibles, sin tildes, en minúsculas), carácter por
   carácter, con un mapa de cada posición al texto original. Las expresiones corren sobre el texto normalizado y cada
   hallazgo vuelve a su lugar en el original.
2. Los hallazgos que se pisan se juntan en uno, con el tipo del que empieza antes (o del más largo): «V-12345678-9» es
   RIF y no cédula más «-9».
3. Un hallazgo se estira sobre los dígitos que le siguen pegados, también tras un «.» o un «-», para que no quede la
   cola de un número.
4. La dirección: la expresión solo ve la palabra de calle y el primer número a menos de 30 caracteres. Se estira hacia
   adelante hasta el final de la frase (salto de línea, «?», «!», «;», o un punto que no sea de una abreviatura de
   cuatro letras o menos como «Av.» o «Edif.»), con tope de 120 caracteres, y hacia atrás hasta la primera palabra de
   calle de la misma frase (tope de 60; `PALABRAS_DE_CALLE`, la misma lista de palabras de la expresión). Se tapa de
   más a propósito.
5. `quedanDatos` revisa el resultado: el detector no tiene que ver nada, y ningún marcador puede tener dígitos pegados
   detrás («[cédula].345.678» sería un número tapado a medias). Si algo queda, la corrida escala.

Ejemplo (inventado): «Soy V-12.345.678, vivo en la Av. Bolívar, Edif. Torre Sur, piso 3, Caracas. ¿Llegó la guía
DTD-4521?» → «Soy [cédula], vivo en la [dirección]. ¿Llegó la guía DTD-4521?».

### 3.4 En el despachador

```
leer → ¿hay mensaje del cliente? → ¿dinero? (escala, sin llamar) → TAPAR → ¿quedan datos? (escala `datos_sin_tapar`)
     → armarEntrada {conversacion_id, mensajes tapados, guiones} → agente → revisarRespuesta (+ código `marcador`)
```

Se tapan los mensajes de los dos roles: el texto de un agente humano en Chatwoot también puede repetir el teléfono del
cliente. El `conversacion_id` y los guiones van tal cual: los guiones son textos aprobados de DTD. El chequeo de dinero
mira el texto sin tapar, en memoria, como antes.

## 4. Criterios de aceptación

- **AC-1.** Con +58 414…, 0414-…, 58-424…, 414-555-…, +86 138…, fijos (0212, 0241, con paréntesis), V-12.345.678,
  E 1234567, «cédula 12.345.678», «C.I. 12.345.678», «CI: …», J-30123456-7, J-1234567-8, J-12.345.678-9, correos y
  direcciones (con abreviaturas, «sector», «casa 12», «Casa N.º 14», «torre B»), el texto que recibe el agente trae el
  marcador y no el dato (`lib/studio/oficina/__tests__/tapar-datos.test.ts`).
- **AC-2.** Un texto sin datos personales sale igual: guías de mensajería (YT…, SF…, JT…, LP…, MSKU…, 1Z…), dígitos
  sueltos, montos, fechas y códigos de DTD.
- **AC-3.** El `conversacion_id` y los guiones no se tocan, aunque un guion traiga un correo o un teléfono de DTD.
- **AC-4.** En la corrida con el modelo simulado, la llamada al agente trae `[teléfono]` y no el teléfono, y ninguna
  fila ni log guarda el texto del cliente (`lib/studio/__tests__/oficina-despachador.test.ts`).
- **AC-5.** Después de tapar, `detectorDelCable` no ve nada en ninguno de los casos de AC-1; si viera algo, la corrida
  escala `datos_sin_tapar` sin llamar al modelo.
- **AC-6.** `tieneDatosPersonales` (noticias) no cambia. Lo que ve también lo ve `detectorDelCable`, salvo los números
  pegados a otro texto.
- **AC-7.** Un borrador que trae un marcador escala con `eval:marcador`.

## 5. Riesgos y límites

- **No se tapa todo.** Nombres de personas, una dirección sin número, un teléfono en palabras o con un formato que las
  expresiones no ven siguen llegando al proveedor. El tapado reduce lo que sale; no lo vuelve anónimo.
- **Se puede tapar de más.** Una frase con «calle» y un número que no es dirección, o el resto de una frase después de
  una dirección, llegan tapados: «apto 4B de mi tía, pagué 120,50 USD» sale entero como «[dirección]», y «Edificio
  del almacén, 3 cajas de 25 kg» también. El dinero se mira antes, sobre el texto sin tapar. El agente escala si le
  falta un dato, y Sam aprueba cada borrador.
- **«torre» con una vocal seguida de otra palabra** («torre E de la zona industrial») no se tapa por sí sola: así no se
  tapa «la torre a la que va». Si la frase trae «piso», «apto» o un número cerca, se tapa por esa vía.
- **Un fijo pegado a texto o sin el 0** (por ejemplo «212-555-0101») no se tapa: con el borde al inicio, se prefirió
  no tocar las guías.
- **El detector del cable y el de noticias ya no son iguales.** El de la Oficina_Virtual ve más formatos de Venezuela y
  deja pasar los números pegados a letras. Un cambio en uno no llega al otro.
- **El agente ve los marcadores.** Las instrucciones le dicen qué son y que no los repita ni los complete.

## 6. Historial

- **v0.1 (21/11/2026, `e909ddb52`).** La lista compartida con noticias.
- **v0.2 (21/11/2026).** Por la revisión de la #755 (CHANGES_REQUESTED): lista propia de la Oficina_Virtual (B1, B2,
  M1 a M3, L3), `quedanDatos` mira la cola de un número tapado a medias, código `marcador` (L2) y las pruebas de todos
  los casos (M4). `control.ts` vuelve a quedar como en `main`. L1 queda declarado en §5.
- **v0.3 (21/11/2026).** Por la segunda revisión (sobre `2005f6c56`): M5, la cédula con espacios de miles («cédula 12 345
  678», «V 12 345 678», «CI 12 345 678») se tapa entera en las tres expresiones de cédula. El espacio no entra en la cola
  de `quedanDatos` («[teléfono] 3 cajas» no escala). L4: «la torre a la que va» ya no se tapa; «torre A» sí, antes de un
  signo, del final o de «piso», «apto»…

## 7. Pendiente del punto (a)

Revisar a los proveedores (Z.AI, DeepSeek) y avisar al cliente, antes de la etapa 2. Están fuera de esta SDD.

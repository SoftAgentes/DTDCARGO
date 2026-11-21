---
sdd: "0703"
title: "IA: OpenAI como respaldo no chino de Anthropic (Oficina_Virtual, A3, A4 y A5)"
status: proposed
author: "Claude (Worker) para Dir_DTD"
created: 2026-11-21
updated: 2026-11-21
supersedes: null
superseded_by: null
related: ["0626", "0638", "0639", "0700", "0701", "0702"]
confidencialidad: interno
---

# SDD-0703 — OpenAI como respaldo no chino de Anthropic

> Decisión de Sam (2026-11-21): «Oficina: opción A, Anthropic, sin respaldo por ahora» y «Oficina: Anthropic y
> además prepara la SDD de OpenAI como respaldo». Esta spec es ese respaldo.
>
> **Estado: propuesta, solo spec.** No toca código, ni la base, ni producción, ni el `.env`. La implementación va
> después, con otra aprobación de Sam. El repo es público: sin llaves, montos, IP ni datos de clientes; los ejemplos
> son inventados.

**Etiquetas de evidencia:** **C** código leído · **D** documento · **I** inferencia · **NV** no verificado.
Base: `main` `9ae885c88`. Las especificaciones 0700 y 0702 aún no están en `main`: se leyeron en sus ramas
(`origin/sdd/0626-tapar-datos-entrada` y `origin/sdd/0626-modelo-real`) y se citan como **D**; la 0701 sí está en `main`.

## 1. Qué pide Sam y qué no

**Sí:** sumar OpenAI como **respaldo** de Anthropic (principal) en:

- la Oficina_Virtual, agente `soporte-chatwoot`;
- las funciones de la SDD-0639 §4 marcadas «con datos de clientes» que quedan en alcance: **A3** actas de
  Bitácora, **A4** resúmenes de conversaciones (A4a interno y A4b del portal) y **A5** lectura de documentos.

**No:**

- **Los Agentes y Skills (A6)** quedan fuera (D-5 de la 0639). Incluirlos es una decisión de Sam (§10, P-2).
- Cambiar el principal de nadie: sigue siendo Anthropic.
- Funciones «sin datos de clientes» (A1, A2, A8): su cadena es la de la 0639 (GLM → DeepSeek) y no se toca.
- Abrir la cuenta de OpenAI o cargar la llave: lo hace Sam (§6).

## 2. Qué existe hoy (para no diseñar sobre aire)

| Hecho | Ev. |
|---|---|
| El motor común de la 0639 (`lib/studio/ia/motor/`, catálogo, tabla `ia_motores`, llaves en Vault) **no existe en el código**: `lib/studio/ia/` no está. La 0639 está aprobada como plan, sin implementar | C (directorio ausente) · D 0639 §5 |
| A3 llama a Anthropic con herramienta forzada (`tool_choice`) | C `lib/studio/bitacora/extract.ts:264-278` |
| A4a y A4b llaman a Anthropic con herramienta forzada, cada una con su herramienta | C `lib/studio/conversaciones/digest-extract.ts:88-99` y `:178-189` |
| A5 manda el PDF como documento en base64, cuenta tokens antes y pide `json_schema` con `output_config`; no tiene respaldo ni bucle de herramientas | C `lib/studio/document-import/anthropic.ts:41-50` |
| La Oficina_Virtual **no** llama a un proveedor desde el ERP: el cable llama al runtime de Hermes (`POST /v1/chat/completions`, `model: "soporte-chatwoot"`) y es Hermes quien elige modelo y respaldo | C `lib/studio/oficina/runtime-cliente.ts:55-66` |
| El cable lee `runtime.provider/model` de la respuesta; Hermes v0.23.1 no lo manda, y la 0702 propone leer el modelo real de la sesión antes de borrarla | D 0702 §1-§2 |
| La política de fallback de la Oficina (SDD-0626 §7) habla de «piso glm-5.3»: un piso chino que choca con la D-2 | D 0626 §7 · D 0639 §4 |
| El clasificador `proveedor_caido` (5xx, 529, tiempo agotado, error de conexión) está definido en la 0638 y ya reconoce `insufficient_quota` como falta de pago | D 0638 §5.1 |
| El despachador escala sin llamar al agente cuando hay dinero o un enlace del cliente | C `lib/studio/oficina/despachador.ts` · D 0701 |

**Consecuencia de diseño:** hay **dos caminos** distintos, y esta spec los trata por separado.

1. **Camino ERP (A3, A4, A5):** un adaptador de OpenAI dentro del motor de la 0639.
2. **Camino Oficina:** no hay adaptador en el ERP. OpenAI entra como **proveedor de respaldo del perfil
   `soporte-chatwoot` en Hermes**, que es configuración de la oficina (VPS), no código del ERP. El ERP solo debe
   (a) dejar de depender del piso chino y (b) registrar qué proveedor respondió (0702).

## 3. Adaptador de OpenAI en el motor de la 0639 (A3, A4, A5)

Interfaz del motor (0639 §3.1): **texto libre**, **respuesta con forma fija** y **documento**. El adaptador
`openai` implementa las tres sobre la API de OpenAI. Los nombres exactos de endpoint y parámetros se confirman en
la documentación de OpenAI al implementar (**NV**); aquí se fija el contrato, no la sintaxis.

| Capacidad del motor | Cómo la cubre OpenAI | Quién la usa | Ev. |
|---|---|---|---|
| **Texto libre** | Mensaje de sistema + usuario, sin herramientas | Cualquier función, y es la base de las otras dos | NV |
| **Forma fija** | Salida estructurada con **esquema JSON estricto** (la 0639 permite «herramienta forzada o un JSON validado»). El motor **siempre revalida** la respuesta con el mismo esquema (Zod) antes de entregarla, sea cual sea el proveedor | A3 (acta), A4a, A4b | NV |
| **Documento (PDF)** | PDF como archivo de entrada (base64 en la solicitud) más el mismo esquema JSON | A5 | NV |

### 3.1 Qué se traduce

- La herramienta forzada de Anthropic (`TOOL_NAME`, `input_schema`) se convierte en el esquema de la salida
  estructurada: el **mismo** esquema Zod/JSON que hoy es el `input_schema`. Una sola fuente de verdad del esquema;
  el motor lo entrega a cada adaptador en su forma.
- A5 conserva su `DOCUMENT_EXTRACTION_SCHEMA` y su regla de «cada campo no vacío lleva `locations.path`» (C
  `document-import/anthropic.ts:30-33`). Esas reglas viven en el prompt y en la validación posterior, no en el
  proveedor, así que se mantienen.

### 3.2 Qué **no** cubre y cómo se degrada

| Capacidad de Anthropic | Qué pasa con OpenAI | Degradación |
|---|---|---|
| `countTokens` previo (A5 lo usa para el tope de 180 000 tokens) | OpenAI no cuenta tokens de un PDF antes de enviarlo con el mismo método (**NV**) | Ese tope previo **no se puede aplicar igual**. El adaptador usa el tope de bytes y de páginas del propio A5 más el `max_tokens` de salida, y el presupuesto diario de tokens (`reserveLimit`) sigue siendo la barrera. Si no se puede acotar, A5 **no ofrece OpenAI** (queda sin respaldo) |
| Páginas, tablas y escaneos con la lectura de PDF de Anthropic | La lectura de PDF de OpenAI puede dar otra calidad con escaneos o tablas densas (**NV**) | La función **no ofrece OpenAI hasta pasar su evaluación** (§8). Antes de eso, A5 sigue sin respaldo. El llenado manual sigue como salida |
| Salida estructurada con ciertos esquemas (campos opcionales, uniones, profundidad) | La salida estricta de OpenAI exige un subconjunto de JSON Schema (**NV**) | Si el esquema no cabe, el adaptador lo declara **no soportado para esa función** y no se habilita. Se prefiere simplificar el esquema a aflojar la validación |
| `tool_choice` | No se usa en el respaldo | Reemplazado por la salida estructurada; no hace falta |
| Hojas de cálculo en A5 | Ya viajan como JSON de celdas, no como PDF | Sin diferencia: es texto |
| Bucle de herramientas (A6) | No se implementa | **Fuera de alcance** (A6) |

Si el respaldo devuelve algo que no valida contra el esquema, es un **fallo de la función** (no un fallo de proveedor):
no se reintenta con otro proveedor ni se guarda nada a medias.

## 4. Catálogo: dónde aparece OpenAI

| Función | Marca (0639 §4) | OpenAI como respaldo | Condición |
|---|---|---|---|
| **Oficina_Virtual** `soporte-chatwoot` | Con datos de clientes (tapados por la 0700) | **Sí** | Configuración en Hermes (§5). Principal Anthropic |
| **A3** actas de Bitácora (acta y escucha) | Con datos de clientes | **Sí** | Pasa la prueba de contrato y la evaluación |
| **A4a** resumen interno | Con datos de clientes | **Sí** | Ídem |
| **A4b** resumen para el portal | Con datos de clientes | **Sí** | Ídem. Es el texto que ve el cliente: la evaluación incluye tono y que no invente |
| **A5** lectura de documentos | Con datos de clientes | **Sí, condicionado** | Solo si pasa la evaluación de PDF y se puede acotar el costo (§3.2). Si no, queda sin respaldo |
| A1 noticias, A2 brief, A8 análisis Chatwoot | Sin datos de clientes | **No** (§1) | Siguen con la cadena de la 0639 |
| **A6** Agentes y Skills | Con datos de clientes | **No** | Decisión de Sam (P-2) |

El catálogo marca cada combinación función/proveedor como **habilitada** solo cuando pasó su prueba (0639 §6). Hasta
entonces la pantalla no la ofrece.

## 5. Regla D-2 y máscara de la 0700

**La D-2 no cambia.** Los datos de clientes nunca van a un proveedor chino (GLM/Z.AI, DeepSeek). OpenAI **no es**
chino, así que **puede** recibir datos de clientes: es justo el tipo de proveedor que la 0639 §4 deja para esas
funciones («solo proveedores no chinos»). Se agrega al catálogo con la marca **no chino**.

Se mantienen las dos capas:

1. **Máscara de la 0700 antes del modelo (solo Oficina).** El despachador tapa correos, teléfonos, cédulas, RIF y
   direcciones **antes** de llamar al agente (D 0700 §3). Eso vale igual con el respaldo: lo que llega a OpenAI es el
   texto ya tapado. Si Hermes cambia de proveedor a mitad de camino, el texto de entrada es el mismo.
2. **Revisión de la salida.** `revisarRespuesta` (eval automático) sigue escalando un borrador con datos personales o
   marcadores.

**Las funciones del ERP (A3, A4, A5) no pasan por la máscara de la 0700**, porque su trabajo es leer esos datos
(un acta nombra personas, un documento trae direcciones y montos). Para ellas la protección es: proveedor no chino,
retención mínima (§6) y envío solo de lo que la función necesita. La máscara de la 0700 **no se extiende** a A3-A5 en
esta spec; si Sam la quiere, es otra decisión (P-5).

### 5.1 La Oficina: lo que hay que cambiar para que la regla se cumpla

- **Quitar el piso chino.** La 0626 §7 dice «cadena por agente con piso glm-5.3». Con la decisión de Sam
  (Anthropic principal, OpenAI respaldo) esa línea debe corregirse en la 0626 (otra PR, no en esta): el perfil
  `soporte-chatwoot` **no** puede tener GLM ni DeepSeek en su cadena mientras maneje conversaciones de clientes.
  La 0702 ya nota que la elección del proveedor es de Sam.
- **La cadena del perfil es Anthropic → OpenAI.** Es configuración de Hermes en la oficina (VPS): no la ejecuta
  esta spec ni ninguna PR del ERP. Hermes soporta varios proveedores y respaldo (**NV** para OpenAI en la versión
  instalada: se verifica en la fase 1).
- **Registro del modelo real.** La 0702 deja en `task_events.modelo_usado` quién respondió. Para la auditoría de
  esta spec hace falta que ahí se vea `anthropic/…` u `openai/…` (D 0702 §2).

### 5.2 Sin respaldo, qué pasa hoy (decisión de Sam, vía Dir_DTD)

Hoy la Oficina apunta a `claude-sonnet-5-5` **sin respaldo**; el cambio de proveedor en el VPS lo corre Sam. Si Anthropic
se cae, Sam decidió que **basta con la tarjeta interna (`runtime:*`), sin pausa automática**: la conversación queda para
una persona. El respaldo de OpenAI es lo que evitaría esa caída. Esto significa que **la Oficina funciona sin esta
spec**: OpenAI baja la frecuencia de las tarjetas, no es un requisito para la etapa 2.

### 5.3 Documentos que hay que corregir al aplicar el cambio

- `docs/specs/0626-oficina-runtime/privacidad.md`:
  - **hallazgo 13, línea 158** (tabla de destinos): dice «Proveedor del modelo: Z.AI (glm-5.3)… respaldo DeepSeek». Debe
    decir Anthropic como principal y OpenAI como respaldo, con lo que cada uno retiene según su documentación;
  - **línea 282** (pendientes): «Los proveedores del modelo (Z.AI y DeepSeek)… PIPL». Pasa a Anthropic y OpenAI; la PIPL
    deja de ser el motivo principal y se reemplaza por la retención de §6.
- `docs/specs/0626-oficina-runtime/spec.md` §7: el «piso glm-5.3» (ver §5.1).
Se corrigen en la misma PR que aplique el cambio en Hermes, no antes: hoy describen lo que de verdad está configurado.

### 5.4 La prueba que impide el atajo

Una prueba de catálogo (§8) falla si una función «con datos de clientes» tiene GLM o DeepSeek como principal **o**
como respaldo. Para la Oficina, donde la cadena vive en Hermes, el equivalente es una **comprobación de la
configuración del perfil** antes de activar la etapa 2: el runbook de la oficina pide verificar que la cadena del
perfil solo tiene proveedores no chinos (es un paso humano con evidencia, no una prueba de CI, porque el ERP no
puede leer la configuración de Hermes — **I**).

## 6. Retención de datos de OpenAI y lo que hace Sam

La D-2 busca que los datos de clientes no queden en manos que no controlamos. En OpenAI hay que dejar la
**retención al mínimo**. Lo que sigue se basa en lo que OpenAI documenta públicamente y **se confirma en su panel y su
documentación el día de la configuración** (**NV**):

| Qué | Qué se pide |
|---|---|
| **No entrenar con nuestros datos** | Los datos enviados por la API no se usan para entrenar por defecto (**NV**). Sam lo confirma en la configuración de la organización |
| **Retención mínima** | OpenAI puede conservar las solicitudes de la API un tiempo (hoy se documentan ~30 días para monitoreo de abuso) (**NV**). Si la cuenta es elegible, pedir **retención cero** (ZDR) o el modo equivalente. Si no es elegible, **se acepta el plazo por defecto y se anota como riesgo aceptado** (P-4) |
| **No guardar la respuesta** | El adaptador pide que la solicitud **no se almacene** (la opción de la API para no conservar el objeto de la respuesta) (**NV**). Sin esta opción, la función no se habilita |
| **Un proyecto por uso** | En el panel de OpenAI, un **proyecto separado** para la Oficina y otro para el ERP (A3-A5), cada uno con su **llave propia**. Así el tope, la revocación y la auditoría son por uso |
| **Región de datos** | Si el panel ofrece fijar la región de procesamiento o almacenamiento, elegir la que Sam prefiera; no es requisito (P-4) |

**Lo hace Sam, no un Worker:**

1. Abre la cuenta de OpenAI y crea los dos proyectos (Oficina y ERP).
2. Configura en el panel la retención y la facturación (§7) de cada proyecto.
3. **Carga la llave desde la pantalla «Estado de la IA»**, que la guarda en **Supabase Vault**, solo escritura y con
   AAL2 (D-7 de la 0639 §3.7). La llave del proyecto de la Oficina va en la configuración de Hermes en el VPS, por
   el gestor de secretos que ya usa la oficina, **no** en el repo ni en el chat.
4. Nadie pega una llave en el chat, en un archivo del repo ni en un PR. Ningún Worker la ve.

Esta spec no registra ni exige ver ningún valor de llave; las pruebas usan llaves falsas.

## 7. Cambio automático

**La misma regla de la 0639 §3.4**, sin reglas nuevas:

- Si el principal (Anthropic) responde con `falta_de_pago`, `cuenta_suspendida`, `llave_invalida` o
  **`proveedor_caido`** (clasificador de la 0638 §5.1), esa llamada se reintenta **una sola vez** con OpenAI.
- **Un 400 de entrada inválida no cambia de proveedor** (y tampoco un fallo de validación del esquema, §3.2).
- **Una sola vez:** si OpenAI también falla, la función falla con la clase del error. No hay cadena larga ni un
  tercer proveedor. Nunca cae a GLM ni DeepSeek.
- **Vuelta al principal:** cuando Anthropic vuelve a responder (sondeo o generación real), las llamadas regresan.
- El cambio queda registrado en `ia_eventos` (sin texto) y avisa al equipo (0638 §5.5). Para la Oficina, queda en
  `task_events.modelo_usado` (0702).
- **`limite_de_uso` (429 sin señal de cobro)** no activa el cambio, igual que en la 0639: se reintenta solo donde la
  función ya reintenta. La Oficina tiene su propio reintento ×2 en Hermes (0626 §7); se deja como está.
- **Un matiz que sí es nuevo:** cuando el respaldo es OpenAI, el error de **OpenAI** también se clasifica (0638). El
  `insufficient_quota` de OpenAI llega como 429, y la 0638 §5.1 ya manda a `falta_de_pago` el código de saldo
  **aunque el status sea 429**; el adaptador tiene que pasar ese código al clasificador y no tirarlo.

## 8. Tope de gasto por llave

- **En el panel de OpenAI (lo configura Sam):** un tope mensual **duro** por proyecto, bajo. Para la Oficina, que no
  pase del tope ya aprobado de la 0626 (D5, 15 USD al mes en total) — el respaldo no puede romper ese tope.
  Si el panel no permite un tope duro, se usa un aviso de umbral y la regla siguiente.
- **En el ERP:** el respaldo **hereda los topes que la función ya tiene**:
  - Oficina: el tope mensual, el 80 % que auto-pausa y los topes por corrida (pasos, llamadas, tokens, tiempo) de la
    0626 (C `despachador-config.ts`). La tarifa para el costo pasa a ser por modelo (0639 §3.8); mientras el cable use
    una tarifa fija, queda anotado que es una estimación y se usa la **más alta** de las dos.
  - A5: sus trabajos por día y su presupuesto diario de tokens (`reserveLimit`).
  - A3/A4: solo vigilan por el aviso de la pantalla (hoy no tienen tope, D 0638 §2.1). **No se agrega un tope nuevo
    en esta spec**, pero el respaldo no puede ser más caro sin que se vea: el costo por llamada se registra en
    `ia_eventos`.
- **Una llave, un tope, un uso:** si un proyecto se pasa de gasto, se revoca solo esa llave y las demás funciones
  siguen.
- Las tarifas de OpenAI no se escriben en el repo (cambian y son datos de cuenta): van a la configuración por modelo
  de la 0639 §3.8, que se llena en la fase 2.

## 9. Pruebas previstas

- **Contrato del motor contra el adaptador de OpenAI.** La misma batería que ya corre contra Anthropic, GLM y
  DeepSeek (0639 §6), con un doble HTTP del adaptador: texto, forma fija (JSON válido según el esquema y rechazo
  de JSON inválido), documento PDF en A5 (con un PDF inventado) y tiempo agotado. **Sin llamadas reales en CI.**
- **Habilitación por función.** Una función no ofrece OpenAI si no pasó su prueba; A5 sin tope de tokens aplicable no
  lo ofrece (§3.2).
- **Regla de datos (la que impide el atajo).** Una prueba sobre el catálogo falla si una función «con datos de
  clientes» (Oficina, A3, A4a, A4b, A5, A6) tiene como principal o respaldo a un proveedor marcado **chino**
  (GLM, DeepSeek). También falla si OpenAI aparece como proveedor de una función «con datos» **sin** la opción de
  no almacenar la respuesta (§6).
- **Cambio automático.** Con un 5xx simulado en Anthropic, la llamada va a OpenAI **una sola vez**, queda registrada
  y avisa. Un 400 no cambia. Un 429 con `insufficient_quota` de OpenAI se clasifica `falta_de_pago`. Si ambos
  fallan, la función falla con la clase y **no** cae a GLM ni a DeepSeek.
- **Esquema.** Una respuesta de OpenAI que no valida contra el esquema no se guarda y no cambia de proveedor.
- **Llaves.** Las pruebas de la 0639 (una llave falsa no aparece en HTML, logs ni auditoría; `anon` y
  `authenticated` no leen Vault) se repiten para la llave de OpenAI.
- **Máscara (Oficina).** Con el despachador simulado y el respaldo activo, el texto que sale hacia el runtime ya viene
  tapado por la 0700 (se reutiliza la prueba de la 0700, con un runtime doble que simula el cambio).
- **Evaluación con datos inventados** (no en CI): antes de habilitar cada función, una tanda de casos inventados
  compara Anthropic y OpenAI (acta, resumen, documento). Sam o su delegado firma el resultado.
- **Sin literales de modelo** fuera de la configuración (como en Faro y la 0639).

## 10. Fases

| Fase | Qué entrega | Necesita |
|---|---|---|
| **0 · Esta spec** | Aprobar la spec y decidir P-1 a P-5 | Sam |
| **1 · Cuenta y Oficina** | Sam abre la cuenta y los proyectos, configura retención y topes (§6, §8); se verifica en Hermes que existe el proveedor y se pone la cadena Anthropic → OpenAI; se corrige la 0626 §7 (sin piso chino). Se confirma el modelo real con la 0702 | Sam (cuenta y llave). La 0702 y la 0700 fusionadas |
| **2 · Adaptador en el motor** | Adaptador `openai`, catálogo con la marca «no chino», prueba de contrato y regla de datos. **Depende de que exista el motor de la 0639** (hoy no existe: fase 2 de esa spec) | Motor de la 0639 y llave del proyecto ERP en Vault |
| **3 · A3 y A4** | Habilitar OpenAI como respaldo, tras su evaluación | Fase 2 |
| **4 · A5** | Habilitar, solo si la evaluación de PDF y el tope de costo lo permiten | Fase 2 |
| — | A6 Agentes | Fuera (P-2) |

**Orden respecto a la Oficina:** la fase 1 (Oficina) **no necesita el motor**, porque es configuración de Hermes. Por
eso puede ir **primero** y no esperar al motor de la 0639. Es la recomendación de P-3. Si el motor se
implementa antes, el orden es indiferente.

## 11. Decisiones abiertas para Sam

Cada una con la opción recomendada primero.

- **P-1 · ¿Qué modelo de OpenAI?** Los nombres y tarifas de OpenAI cambian seguido y no se verifican desde aquí
  (**NV**).
  - **Recomendada:** un modelo de **gama media** (de calidad y precio comparables a Sonnet), el mismo para la Oficina
    y para A3-A5, elegido en la fase 1 **tras la evaluación con datos inventados** y escrito en la configuración (no
    en el código). El que gane la evaluación.
  - Alternativa: un modelo pequeño y barato para A4 y la Oficina, y uno mayor para A3 y A5. Más ahorro, más
    pruebas y más configuración.
- **P-2 · ¿Entran los Agentes (A6)?**
  - **Recomendada: no.** Su bucle de herramientas y sus tarifas por modelo son un trabajo distinto (0639 §2) y siguen
    sin cubrirse. Una función que devuelve nombre y dirección del cliente no debe cambiar de proveedor sin su propia
    spec.
  - Alternativa: incluirlos en una fase posterior, con spec aparte. Habría que implementar el bucle de herramientas
    en el adaptador y recalcular las tarifas.
- **P-3 · ¿Orden respecto a la Oficina?**
  - **Recomendada: Oficina primero** (fase 1, configuración de Hermes, sin esperar al motor). Es lo que tiene la
    etapa 2 detenida y no depende de código nuevo del ERP.
  - Alternativa: todo junto después del motor. Más limpio, pero la Oficina espera más.
- **P-4 · Retención.**
  - **Recomendada:** pedir retención cero si la cuenta es elegible; si no, aceptar el plazo por defecto **solo con**
    «no guardar la respuesta» activado y anotarlo como riesgo aceptado por Sam. Un proyecto por uso.
  - Alternativa: no activar OpenAI para las funciones con documentos (A5) si no hay retención cero.
- **P-5 · ¿Máscara de la 0700 también en A3-A5?**
  - **Recomendada: no.** Esas funciones existen para leer esos datos; taparlos las dejaría sin sentido. La protección es
    proveedor no chino, retención mínima y la marca del catálogo.
  - Alternativa: una máscara parcial solo en A4b o A4a (por ejemplo, teléfonos y correos del resumen). Cambia
    el resultado y exige su evaluación.

## 12. Riesgos

- **Datos de clientes en un tercer proveedor.** Es el riesgo que se acepta al sumar OpenAI. Mitigaciones: retención
  mínima (§6), proveedor no chino, un proyecto por uso, tope duro y llaves en Vault o gestor de secretos.
- **Calidad distinta en el respaldo.** Una acta o un documento de otra calidad puede pasar sin que se note. Por eso
  la habilitación exige evaluación firmada y la Oficina conserva la revisión de Sam en la etapa 2.
- **El motor no existe.** Las fases 2 a 4 dependen de la 0639; si se atrasa, solo corre la fase 1 (Oficina).
- **La cadena de Hermes no se ve desde el ERP.** La regla D-2 de la Oficina depende de una verificación humana de la
  configuración (§5.4); queda como paso del runbook.
- **Datos de la cuenta de OpenAI.** Los datos de retención y las tarifas son NV hasta que Sam abra la cuenta.

## 13. Fuera de alcance

- Código, migraciones, el `.env` y producción.
- Los Agentes (A6) y las funciones sin datos de clientes (A1, A2, A8).
- Corregir la 0626 §7 (queda anotada para otra PR) y cambiar la 0639.
- Elegir el modelo por calidad: es la evaluación de la fase 1.
- Abrir la cuenta, pagar o cargar la llave: lo hace Sam.

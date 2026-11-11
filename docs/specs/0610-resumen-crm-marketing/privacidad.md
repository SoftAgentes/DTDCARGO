# SDD-0610 — Revisión de privacidad

> Revisión con la skill `revisar-datos-ve` (`.claude/skills/revisar-datos-ve/SKILL.md`) sobre
> `main` `5373e6c81` (2026-11-06). **No es asesoría legal:** es un inventario técnico y una
> lista de preguntas para la abogada.
>
> Esta SDD es **solo spec**: el resumen no existe todavía. Por eso cada punto separa lo que se
> pudo ver en el código de hoy (con `archivo:línea`) de lo que la spec exige a la
> implementación. Lo que solo vive en la spec queda `NO VERIFICABLE` hasta que exista el código.

## 1. Resumen

| Estado | Puntos |
|---|---|
| `ENCONTRADO` | 3: finalidad no declarada en la política (H1), registro de tratamiento sin las conversaciones (H2), texto libre en campos que el resumen lee (H3) |
| `CORRECTO` | 2: las tablas del Studio que alimentan el volumen no tienen texto ni datos del contacto; Chatwoot corre en el servidor propio |
| `NO VERIFICABLE` | El resto: depende de código que aún no existe o de documentos fuera del repositorio |

**Alcance territorial.** Venezuela: aplica (titulares que escriben desde Venezuela). China
(PIPL): **no aplica al resumen**. El resumen no contiene información personal; el texto se
procesa en el servidor de Contabo, en EE. UU. (`docs/legal/privacidad/inventario-terceros.md:44`),
no en China. Si el equipo de China atiende conversaciones en Chatwoot, eso ya pasa hoy y no
cambia con esta SDD. RGPD y Ley 21.719 de Chile: solo como referencia.

## 2. Inventario de lo que el resumen toca

| Dato | Qué es | Finalidad en esta SDD | Base | Retención | Quién más lo ve |
|---|---|---|---|---|---|
| Texto de los mensajes entrantes (Chatwoot) | Lo que escribe la persona; puede traer nombre, teléfono, correo, dirección, montos, y a veces datos sensibles (una persona puede contar algo de salud o de su situación económica) | Contar temas del catálogo. Se lee, se clasifica en memoria y se descarta | **No declarada hoy** (H1) | Ninguna en el Studio: no se guarda | Nadie fuera del proceso del Studio |
| `chatwoot_webhook_events` | `conversation_id`, tipo de evento y hora. Sin texto (`supabase/migrations/0504_chatwoot_eventos.sql:53-75`) | Saber qué conversaciones tuvieron actividad en la semana | Ya existe (atender mensajes) | 90 días (`lib/studio/chatwoot/purga.ts:13-15`) | — |
| Tipo de bandeja | Canal (WhatsApp, Instagram, Messenger, correo). No es dato de una persona | Volumen por canal | — | No se guarda aparte | — |
| `crm_historial_etapas` y etapas de `crm_tarjetas` | Movimientos de etapa de cada tarjeta | Volumen por etapa (conteos) | Ya existe (seguimiento de la consulta) | La de SDD-0587 | — |
| `crm_tarjetas.motivo_perdida` | Texto libre de 1 a 200 caracteres que escribe el equipo (`0506_crm_modelo.sql:316`) | Contar objeciones del catálogo | Ya existe | Se borra al anonimizar (SDD-0587) | — |
| `crm_etapas.nombre` y `clave` de etapas propias | Texto libre del admin (`0506_crm_modelo.sql:208-209`) | **No se usa**: las etapas propias se suman en `otras` | — | — | — |
| `crm_resumen_semanal.payload` (nuevo) | Conteos por tema, canal y etapa con k ≥ 5 | Entregar a marketing | Ver §4, punto 2 | 24 meses (propuesta) | Oficina de agentes y Discord, solo este agregado |

**Datos sensibles.** El texto libre de una conversación puede traer datos de salud, de familia o
económicos sin que nadie los pida. El diseño los trata igual que el resto del texto: no salen
del proceso. **Titulares que no son usuarios:** quien escribe sin ser cliente (lead) y las
personas que un cliente menciona en su mensaje (un proveedor, un familiar). Los dos quedan
cubiertos por la misma regla: nada del texto sale.

## 3. Hallazgos

### H1 · `ENCONTRADO` — La política no cubre esta finalidad (bloquea la primera corrida)

- **Qué:** la sección «Para qué usamos tus datos» lista los usos de los mensajes por WhatsApp y
  chat: saber si la persona es cliente, darle seguimiento y la respuesta automática
  (`app/privacidad/page.tsx:194-200`). Cierra con «No los usamos para fines distintos de los
  aquí descritos» (`app/privacidad/page.tsx:221-222`). Leer los mensajes para contar de qué
  hablan las personas no está en la lista.
- **Por qué importa:** CRBV art. 28 da el derecho a **conocer el uso y la finalidad** de los
  datos; SC 332/2001 fija el principio de **finalidad**: fines predeterminados y explícitos.
  Que el resultado sea agregado no cambia que el texto se trate para un fin nuevo. Además, la
  frase de cierre es una promesa publicada: incumplirla es peor que no haberla escrito.
- **Arreglo concreto:** antes de la primera corrida real, sumar a la lista de
  `app/privacidad/page.tsx` (cerca de `:194-200`) un punto con este sentido, construido desde lo
  que el sistema hace:

  > **Entender en conjunto qué nos preguntan:** cada semana contamos, sin nombres, teléfonos ni
  > frases tuyas, de qué temas nos escriben (por ejemplo, cuántas personas preguntaron por
  > plazos). Usamos solo esos conteos para decidir qué explicar mejor en el sitio y en las
  > redes. Tus mensajes no salen de nuestro sistema para esto.

  El texto final lo confirma la abogada (decisión D7). **Choque posible:** otra sesión tiene un
  ajuste de `/privacidad` sin publicar; quien implemente tiene que partir de la versión que
  esté en `main` en ese momento.

### H2 · `ENCONTRADO` — El registro de tratamiento no tiene las conversaciones

- **Qué:** `docs/legal/privacidad/registro-tratamiento.md` no tiene filas de Chatwoot, de
  `crm_tarjetas` ni del texto de los mensajes (búsqueda de «chatwoot», «conversaci», «mensaje»,
  «crm_tarjetas» y «bsuid» en ese archivo: cero resultados, 2026-11-06).
- **Por qué importa:** es el inventario que la persona tiene que poder pedir (CRBV art. 28,
  acceso y conocer el uso). Es preexistente, pero esta SDD agrega una finalidad sobre un dato
  que el registro ni siquiera lista.
- **Arreglo:** en la implementación, sumar al registro la fila del texto de los mensajes de
  Chatwoot con sus dos finalidades (atender y el resumen agregado), su base y «no se copia al
  Studio». Las filas de `crm_tarjetas` son de SDD-0587: se anotan como **FUERA DE ALCANCE
  DETECTADO**.

### H3 · `ENCONTRADO` — Texto libre en campos que el resumen podría leer

- **Qué:** `crm_tarjetas.motivo_perdida` es texto libre (`0506_crm_modelo.sql:316`) y las etapas
  propias tienen `clave` y `nombre` que escribe el admin (`0506_crm_modelo.sql:207-210`). Un
  asesor puede escribir «se fue con otro agente, no le gustó a la señora X»; un admin puede
  llamar a una etapa con un nombre propio.
- **Por qué importa:** si el resumen copiara esos campos, saldría texto escrito por personas,
  con nombres.
- **Arreglo (ya en la spec):** `motivo_perdida` pasa por el mismo clasificador que los mensajes
  y solo sale como `id` del catálogo; de las etapas solo salen las de sistema por su `clave`, y
  las propias se suman en `otras` (spec §3 y §4.3). La prueba P3 lo exige.

### Lo que está bien hoy

- `CORRECTO` — `chatwoot_conversations` y `chatwoot_webhook_events` no guardan texto ni datos
  del contacto (`0504_chatwoot_eventos.sql:53-75`, `:90-104`, y el comentario de la tabla
  en `:75`). El volumen por actividad sale de ahí sin tocar a nadie.
- `CORRECTO` — Chatwoot corre en el servidor propio de Contabo, no en un tercero
  (`inventario-terceros.md` §2 bis, línea 74). Leer los mensajes no los manda por internet.
- **Precedente que no se copia:** `lib/studio/conversaciones/digest-extract.ts:65-69` y `:80`
  mandan el nombre del cliente y la transcripción completa a Anthropic. Sirve para su fin (un
  resumen interno por cliente), pero esta SDD lo descarta a propósito (spec §4.4).

## 4. Los doce puntos

| # | Punto | Estado | Evidencia o motivo |
|---|---|---|---|
| 1 | Inventario | `CORRECTO` en la spec, sin código | §2 de este documento |
| 2 | Minimización | `NO VERIFICABLE` (sin código) | La spec exige: texto solo en memoria, catálogo cerrado, conteo por conversación, sin cruces, k = 5, sin ids ni fechas internas (spec §3, §4.4, §4.5). La prueba de §7 lo vuelve propiedad. Se verifica cuando exista `lib/studio/crm-resumen/` |
| 3 | Consentimiento con evidencia | `NO VERIFICABLE` | La base aplicable para un uso agregado del texto (¿interés del servicio, consentimiento?) es pregunta para la abogada. El repositorio no tiene evidencia de consentimiento para esta finalidad porque la finalidad no existe aún (H1) |
| 4 | Derechos como caminos reales | `NO VERIFICABLE` | El resumen no guarda nada por persona, así que no hay qué entregar, rectificar ni borrar del resumen. Si una persona pide la supresión, sus mensajes se borran en Chatwoot y dejan de entrar en semanas futuras; las semanas ya contadas no cambian (un conteo con k ≥ 5 no la identifica). Esa respuesta hay que poder darla por escrito: pregunta para la abogada |
| 5 | Borrado que borra | `NO VERIFICABLE` | La spec exige que el texto no aparezca en tablas, logs ni colas; la prueba P1 mira `console.*` y el criterio de aceptación exige buscar los canarios en la base local efímera (spec §9). No se corre contra producción |
| 6 | Trazabilidad de solicitudes | No aplica a esta SDD | El resumen no recibe solicitudes de titulares |
| 7 | Política pública | `ENCONTRADO` | H1 |
| 8 | Inventario de terceros | `NO VERIFICABLE` | Discord recibiría solo el agregado. Su fila en `inventario-terceros.md` la agrega SDD-0606 (PR #380, sin fusionar); esta SDD suma «recibe el resumen agregado de marketing». El proveedor del VPS de la oficina (13.140.227.228) y los modelos que usan los agentes reciben solo el agregado: si el agregado no es dato personal, no son terceros de datos personales. Que lo sea o no es una calificación jurídica: pregunta para la abogada |
| 9 | Transferencia internacional | `NO VERIFICABLE` | El texto se procesa en el servidor de Contabo en EE. UU., igual que hoy (`inventario-terceros.md:44`). Lo que sale (agregado) va a Discord (EE. UU.) y a la oficina. No hay transferencia nueva de datos personales si el agregado es anónimo |
| 10 | Decisiones automatizadas | `NO VERIFICABLE` | El clasificador no decide nada sobre una persona: no guarda etiquetas por conversación ni mueve tarjetas. La spec lo exige; se verifica en el código |
| 11 | Valor probatorio de la aceptación | No aplica | El resumen no captura aceptaciones |
| 12 | Titulares que no son usuarios | `NO VERIFICABLE` | Leads y terceros mencionados en un mensaje: la regla «nada del texto sale» los cubre igual (§2). Se verifica con la prueba P1–P3 |

## 5. Umbral mínimo y reidentificación

La propuesta es **k = 5 conversaciones distintas por fila**, sin cruces y con semanas fijas
(spec §4.5). Lo que esto protege y lo que no:

- **Protege** contra que alguien de la oficina, de Discord o un modelo de los agentes lea en el
  resumen algo que describa a una sola persona.
- **No protege** contra lo que quien lee ya sabe por otro lado (spec §6.3). Por eso no hay
  fechas dentro de la semana, ni canal × tema, ni conteos por asesor.
- **Por qué no menos de 5:** con 1 a 4, una fila puede describir a una persona concreta, sobre
  todo en Instagram y Messenger, donde el volumen es de un dígito.
- **Por qué no 10 desde el inicio:** con el volumen de hoy escondería casi todo y empujaría a
  pedir datos a mano.

## 6. La prueba automática

La spec §7 trae la prueba `sin-datos-personales.test.ts` con canarios (nombre, usuario,
teléfonos en tres formatos, correo, Shipping Mark, montos, dirección y una frase única) y diez
propiedades, cada una con su mutante. Tres detalles que esta revisión exige:

1. **Piso de coincidencias (P4):** el fixture tiene que producir filas visibles. Una prueba que
   busca canarios en un resumen vacío da verde sin mirar nada.
2. **Logs (P1):** se espía `console.*` durante la corrida. El texto no puede salir ni en un
   mensaje de error del clasificador.
3. **Lista cerrada, no lista negra (P3):** además de buscar formas de teléfono o correo, toda
   cadena del JSON tiene que estar en una lista permitida. Una lista negra deja pasar lo que
   nadie pensó; la lista permitida no.

## 7. No verificable: qué falta mirar y dónde

- Si el agregado con k ≥ 5 es «dato anónimo» para el derecho venezolano (abogada).
- La base del tratamiento del texto para la finalidad nueva (abogada).
- El texto final del punto nuevo de la política (abogada; D7).
- Que el token `CHATWOOT_RESUMEN_TOKEN` y el webhook vivan solo en el servidor del Studio
  (se comprueba al instalar, en el servidor, sin imprimir valores).
- Que el bot de ALFRED pueda leer `#datos-marketing` y nada fuera de la categoría Oficina
  (Discord, «Ver servidor como rol»).
- La calidad del clasificador con conversaciones reales (D4, con OK nominal de Sam).

## 8. Fuera de alcance

- Filas de `crm_tarjetas`, `crm_historial_etapas` y BSUID en el registro de tratamiento:
  son de SDD-0587 (**FUERA DE ALCANCE DETECTADO**).
- Contratos con Discord y con el proveedor del VPS de la oficina.
- Redacción final de la política.

---

Esto no es asesoría legal. Es un inventario técnico y una lista de preguntas; la revisión legal
la hace la abogada. Conviene que otro modelo audite esta misma spec antes de implementarla: un
modelo no ve sus propios puntos ciegos.

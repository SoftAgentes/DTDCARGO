# Encargo — construir los agentes 2, 3 y 4 de Kommo

> **Para quién:** la ventana/sesión que va a continuar el trabajo del agente de IA de Kommo.
> **Escrito el 2026-08-07**, después de construir y probar el agente 1 en producción.
> Todo lo que sigue está **medido**, no supuesto. Donde no lo esté, lo digo.

---

## 1 · Qué hay que hacer

Existe **un** agente de IA en Kommo (`DTD Cargo asistente de ventas`, id **326244**) que ya quedó
configurado como el **arquetipo de Entrada**. Faltan tres:

| # | Agente | Etapas de `Ventas DTD` (14036567) | Leads hoy |
|---|---|---|---|
| 1 | Entrada | Leads Entrantes + Contacto Inicial | ~600 | ✅ hecho |
| **2** | **Post-venta** | Logrado con éxito | **243** | ⛔ |
| **3** | **Reenganche** | Recontacto | 14 | ⛔ |
| **4** | **Cotizador** | Estimado enviado + Negociación | 1 | ⛔ |

⚠️ **Ese orden NO es el del plan original.** El plan decía Reenganche primero. **Cámbialo:** medido en
SQL contra producción el 2026-08-06, Post-venta tiene **243 leads ganados** sin atender y el Cotizador
tendría **1**. Construir el Cotizador ahora es amueblar un cuarto vacío, y va a seguir vacío hasta que
el embudo fluya *(`Estimado enviado` está en 0 porque el write-back ERP→Kommo nunca ha corrido —
ver `docs/runbooks/kommo-consolidacion-embudo-unico.md`)*.

**Para el agente 2 hay uno dormido que se reusa:** `Atención al cliente de comercio minorista` — 0
fuentes, sin canales, última actividad 30/06/2026. **No crees uno nuevo.**

---

## 2 · Lo primero que tienes que entender: son TRES capas y mandan las Acciones

```
ACCIONES  >  FUENTE  >  PAUTA
```

Esto costó una tarde entera de intentos fallidos. No lo aprendas otra vez:

- **Acciones** (pestaña `Acciones`): condiciones WHEN → DO que se evalúan **antes** de redactar. Si
  dispara una que transfiere, **transfiere**, aunque la fuente y las pautas digan lo contrario.
- **Fuente** (el DOCX): el contenido. **Le gana a la pauta** — verificado en vivo.
- **Pauta**: el guion. Aplica al instante (la fuente tarda en indexar), pero **no puede vencer a una
  Acción**.

🔴 **El campo `Más` de una Acción es orientativo, NO manda.** Escribir *"nunca transfieras si…"* ahí
**no frena** la Acción. Se probó y falló. Si necesitas que algo no dispare, **hay que tocar la
condición**, no el texto.

**Ejemplo real:** la Acción `Cliente listo para comprar` tenía dos condiciones unidas por *"se cumple
alguna"*: `confirma explícitamente que quiere ordenar` **o** `el cliente quiere comprar`. La segunda
es tan ancha que *"necesito 200 pares"* la activaba, y transfería antes de que cualquier otra cosa
pudiera actuar. **Se eliminó la segunda.** Ahí recién funcionó.

⭐ **Cómo diagnosticar:** el panel de prueba muestra `Intención identificada`, `Acciones completadas`
y `Fuentes utilizadas`, desplegables. **Ábrelos siempre.** Ahí se ve exactamente qué intención detectó
y qué acción ejecutó. Es la única forma de saber por qué contestó lo que contestó.

---

## 3 · Las trampas de Kommo — léelas antes de tocar la UI

### Al cargar una pauta nueva: cuatro pasos y ninguno es opcional

1. **`+ Añadir pauta` con clic real.** Ese clic es además lo que ensucia el formulario y hace aparecer
   `Guardar`. Rellenar por script un campo que ya existía **no ensucia nada** y el botón nunca sale.
2. **Teclear de verdad** (`computer type`). Un setter nativo sobre una fila recién creada no llega al
   estado interno de Kommo: **la fila se guarda vacía**. *(Así quedaron 10 pautas en blanco que hubo
   que borrar una por una con su papelera.)*
3. ⭐ **`Tab` antes de guardar.** La que más cuesta encontrar: **Kommo confirma el valor al perder el
   foco.** La ÚLTIMA fila tecleada se guarda vacía si pulsas `Guardar` con el cursor dentro. El patrón
   lo delata: cargando tres seguidas, las dos primeras sobreviven —pierden el foco al añadir la
   siguiente— y la tercera se pierde, siempre.
4. **Recargar para verificar.** Que `Guardar` desaparezca **no prueba nada.**

### Al crear una Acción

- El `Hacer` **nace en "Transferir al usuario"**. Si lo dejas así, la Acción hace lo contrario de lo
  que buscas. **Cámbialo siempre.**
- El tema del `Cuando` **NO es un selector cerrado**: escribe el tema que quieras y aparece
  **"Crear valor: …"**. Las Acciones vivas usan temas propios (`servicios de logística`,
  `réplicas o imitaciones de marca`).
- Hay **dos niveles de guardado**: `Guardar acción` (cierra el bloque) y luego **`Guardar`** arriba a
  la derecha (persiste el agente). **Falta cualquiera de los dos y se pierde.**
- Una Acción admite **varias acciones en `Hacer`** — el `+` debajo. Así se encadena
  `Transferir` + `Agregar tarea`.

### Límites duros (leídos del `maxlength` del DOM)

| Campo | Tope |
|---|---|
| `Rol y personalidad` | **1.500** — la CAPA 1 ocupa 1.457, **la CAPA 2 NO cabe ahí, va como pautas** |
| Cada pauta | **300** |
| Total de pautas | **50** *(el agente 1 va en 41)* |
| Acciones | **20** *(el agente 1 va en 7)* |
| Nombre del agente | 255 |

### El panel de prueba

- **`Enter` NO envía.** Hay que clicar la flecha. Si pulsas Enter, el texto se acumula en el campo.
- Tras un traspaso el chat **queda bloqueado**: hay que pulsar **`Reiniciar chat`** antes de mandar
  otro mensaje, o el siguiente no entra y parece que se colgó.
- Una respuesta puede tardar **más de un minuto** y a veces **sólo aparece al recargar la página**.
- Cada respuesta cuesta **9 a 22 créditos**. Quedan ~4.900 de 7.250. **Probar cuesta plata real.**

### El navegador

- 🔴 **Kommo parece admitir una sola sesión.** El panel interno de Claude y Chrome **se botan entre
  ellos**. Trabaja en **uno solo**; Chrome da capturas grandes y va mejor.
- El renderizador **se congela de a ratos** (`CDP timeout`). ⚠️ **El tecleo casi siempre SÍ entró
  aunque la herramienta reporte timeout** — verifica el estado antes de repetir, o duplicas texto.
- ⛔ **Nunca trabajes a ciegas sobre producción.** Si no puedes ver la pantalla, **cancela** el
  formulario. Ya hubo un incidente de un clic desubicado que creó una condición de parada donde no iba.

---

## 4 · Lo que ya está en vivo — no lo dupliques ni lo contradigas

**Agente 1 (`326244`)**, todo verificado recargando desde el servidor:

- **Persona:** la CAPA 1 de Manuel, 1.457 car. *(texto exacto en `agentes-ia-configuracion.md`)*
- **41 pautas**, ninguna vacía: 24 originales + 3 de réplicas + 11 del arquetipo de Entrada +
  3 contra la repetición.
- **7 Acciones**, entre ellas la de **réplicas** (`Responder siempre con esta información específica`)
  y tres que transfieren, cada una con **`Agregar tarea` a 15 minutos**.
- **Fuente:** `DTDCARGO-Kommo-KnowledgeSource-v7-2026-08-06.docx`, 35 subsecciones. Es una biblioteca
  de cuenta (`Ajustes → Fuentes de conocimiento`) con dos consumidores: el **Agente de IA** y
  **La Respuesta sugerida**. Subir desde la pestaña del agente crea la fuente Y la enlaza.

### La CAPA 1 va IDÉNTICA en los cuatro

Es lo que hace que el cliente perciba **una sola persona**. El founder fue explícito: el equipo lleva
años atendiendo como "Manuel", y cuando el cliente pide hablar con Manuel sale una persona real.
**Si editas la CAPA 1, la editas en los cuatro.** El archivo es la fuente; Kommo es el despliegue.

### Lo que hay que replicar en los tres agentes nuevos

1. **La CAPA 1 completa** (copiar de `agentes-ia-configuracion.md`).
2. **La Acción de réplicas**, tal cual. Una pregunta de réplicas puede llegar en cualquier etapa.
3. **Las 3 pautas de réplicas.**
4. **Las 3 pautas contra la repetición.**
5. **`Agregar tarea` a 15 minutos** en toda Acción que transfiera.
6. **La fuente v7**: engancharla desde `Ajustes → Fuentes de conocimiento` (ya existe, no la vuelvas
   a subir — se duplicaría).

---

## 5 · Los tres agentes

El detalle de arquetipo, preguntas y prohibiciones está en
[`agentes-ia-por-etapa.md`](agentes-ia-por-etapa.md) y el texto listo para pegar en
[`agentes-ia-configuracion.md`](agentes-ia-configuracion.md). Resumen de lo que define a cada uno:

### Agente 2 · Post-venta — `Logrado con éxito` — **empezar por aquí**

Reusar `Atención al cliente de comercio minorista`. **El cliente ya pagó: quiere certeza, no que le
vendan.** Se le identifica por su **Shipping Mark**. Nunca tratarlo como lead.

- Si preguntan por su carga y no hay dato vivo, **no supone ni tranquiliza con generalidades**: pasa
  con un asesor. Es preferible eso a una fecha inventada.
- **Nunca promete fecha de entrega garantizada** — los tiempos los define la naviera.
- **Nunca afirma que un pago entró** si no lo está viendo.
- Sólo cuando ya resolvió, y nunca antes, puede abrir hacia el próximo pedido.

⚠️ **Ojo con el portal:** si preguntan dónde está su mercancía, pedir el **Shipping Mark** o el número
de envío, y mencionar que pronto lo podrá ver en su portal. **No prometer que ya está disponible.**

### Agente 3 · Reenganche — `Recontacto`

Habla con alguien que **ya escribió antes o ya es cliente**. Nunca lo trata como desconocido.

- ⭐ **Su primera pregunta siempre desambigua:** *"¿Esto es por una compra nueva o por mercancía que ya
  tienes en proceso?"*. Confundir esas dos cosas es el error más caro de esta etapa.
- **El silencio no es un no: es su calendario.** El mayorista repone cada 30-45 días.
- Contra el silencio, **nunca** *"¿sigues interesado?"*. Sí *"¿ya descartaste traer esa mercancía?"*,
  que se puede contestar sin comprometerse.
- Si tiene un reclamo abierto, **no le vendas nada**.

### Agente 4 · Cotizador — `Estimado enviado` + `Negociación`

Ya hay un número sobre la mesa. **Su autoridad viene de la precisión, no de caer bien.**

- Primero confirma que **abrió el estimado** y que las cantidades coinciden. Recién después, precio.
- Ante una objeción, **responde con una pregunta**: *"¿Comparado con qué?"* · *"¿Cómo llegaste a esa
  cifra?"*.
- **No cierra y no negocia.** Negociar precio por escrito no funciona; su trabajo es entender el freno
  real y pasar el caso resumido.
- **Nunca ofrece ni insinúa un descuento.** Nunca habla mal de otro proveedor.

⏸️ **Construirlo al final, o incluso esperar:** hoy tendría 1 lead.

---

## 6 · Cómo probar (y cuánto cuesta)

Batería mínima por agente, **escrita como la escribiría un cliente real** —minúsculas, sin acentos,
con una cantidad—, no como una prueba de laboratorio:

1. Precio · 2. Restricción · 3. Pedir un humano · 4. Dirección de la bodega en China ·
5. "casillero" y "DDP" · 6. Pérdida o reclamo · 7. Algo que **no** esté en las fuentes ·
8. **Réplicas** — *"buenas, tienen zapatos replica de hoka? necesito 200 pares"*

Para cada una: abrir `Intención identificada` y `Acciones completadas`. **Si transfirió, mira qué
acción lo hizo antes de tocar nada.**

💸 ~8 casos × ~15 créditos × 3 agentes ≈ **350 créditos**. Presupuestarlo.

---

## 7 · Reglas de marca que no se rompen

- **Español venezolano, TUTEO, cero voseo.** "tú tienes / puedes / mira". Nunca "vos tenés / mirá /
  cotizá". El voseo es argentino y en Venezuela no se habla.
- **Nunca:** `DDP` (di **"Puerta a Puerta"**) · `prepago` · `financiamiento` · la palabra
  `responsabilidad` · nombres de navieras o proveedores de tarifas · la razón social ni el RIF.
- **Shipping Mark**, no "casillero". **DTD Cargo**, dos palabras.
- **Se paga al llegar, sin adelantos.** Esa frase exacta — es la del sitio público.
- Todo precio es un **ESTIMADO** y sale de la calculadora, nunca de la memoria del agente.
- **Una respuesta y UNA sola pregunta** por mensaje. Nunca cerrar con *"¿en qué te ayudo?"*.
- **No ofrecer registro de marca**: su alcance no está cerrado.

📌 **No cites estadísticas de velocidad de respuesta.** *"El 78% le compra al primero que responde"*,
*"el lead se enfría a los 5 minutos"* — **no tienen fuente primaria**. Si necesitas justificar un
tiempo, usa el caso concreto.

---

## 8 · Cómo trabajar

- **Worktree propio + rama propia.** Hay 15-20 ventanas en paralelo. Commits **selectivos**, nunca
  `git add -A`.
- **NO hacer push** sin OK explícito del founder.
- **Verificar recargando** después de cada guardado. Nunca reportar como hecho algo que no releíste
  del servidor.
- Si algo no se puede verificar, **no se guarda** — se cancela.
- Documentar en `docs/marketing/agentes-ia-configuracion.md`, que es donde vive el estado real.

---

## 9 · Lo que NO hay que hacer

- ⛔ **No prender el write-back** (`writeback_dry_run`). Está bloqueado por otra cosa: `kommo_lead_id`
  está NULL en 432 de 432 clientes, así que la cola nunca recibe nada. Ver el runbook.
- ⛔ **No re-subir la fuente v7** — ya está en la biblioteca. Engancharla, no duplicarla.
- ⛔ **No poner dos agentes en la misma etapa** — Kommo lo prohíbe.
- ⛔ **No tocar los 11 Salesbots.** Están apagados y verificados muertos (contadores congelados).
  Quedan 4 sesiones pegadas que `detener sesión` ya no cierra; es residuo conocido, no un bug nuevo.
- ⛔ **No cambiar la CAPA 1 en un solo agente.**

---

## 10 · Dato que conviene tener presente

**El agente NO se releva a mitad de conversación.** Los Ajustes de Kommo lo dicen: *"Una vez que el
agente inicia una conversación, continuará incluso si cambia la etapa, a menos que esté restringido en
Acciones"*. Por eso los arquetipos son **cuatro y no siete**: `Leads Entrantes` + `Contacto Inicial`
van juntos, y `Estimado enviado` + `Negociación` también. La etapa sólo decide **quién levanta el
teléfono**, no quién sigue hablando.

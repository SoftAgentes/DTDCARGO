---
sdd: "0654"
title: "Versión light del portal del cliente: vista sencilla, selector con la vista completa y Faro del cliente"
status: proposed
author: "Claude (Worker del DG) + Sam"
created: 2026-11-16
updated: 2026-11-16
supersedes: null
superseded_by: null
related: ["0042", "0147", "0335", "0549", "0627", "0637", "0646"]
confidencialidad: interno
---

# SDD-0654 — Versión light del portal del cliente

> Un cliente nuevo o poco técnico entra al portal y ve una sola página con lo que necesita saber: dónde está su
> carga, qué le toca hacer, cuánto debe, sus papeles y a quién preguntar. Si quiere el detalle, cambia a la vista
> completa, que es el portal de hoy sin cambios. Un Faro del cliente responde solo sobre su propia cuenta.

**Estado:** `proposed`. Fase 0 (esta PR): investigación, maqueta y spec. **No hay código de producto ni
migraciones.** Cada fase siguiente necesita el visto bueno de Sam y el turno del Director General.

**Maqueta:** `maqueta/portal-light.html` (autocontenida; se abre en el navegador). Publicada también como Artifact
privado para Sam; el enlace va en la PR. Todos los nombres, montos y códigos de la maqueta son inventados.

**Decisiones:** D-1 a D-14 (§11). Decidida por Sam: D-4. Las demás están abiertas, cada una con la opción
recomendada.

## 1. Pedido de Sam (2026-11-16)

Literal, del chat con el Director General:

- «cuando un cliente nuevo entre, que pueda ver su portal en una versión mínima o en una versión pro…que el
  cliente empiece con una versión mínima, pero si quiere verla en la versión que tenemos hoy, la pueda ver»
- «La idea de la versión mínima es para gente que necesita algo estilo el manual "para Dummies"…una pedagogía
  simple, minimalista y rápida de entender, con todo en un solo lugar»
- «no "rediseño", porque no vamos a rediseñar, sino a tener la versión light y la versión full»
- «diseño minimalista, con pedagogía simple "para Dummies", con ayudas directas. Ahí podemos activar el modo faro
  de ayuda para el cliente, con sus restricciones y solamente con la información del cliente. Solamente del
  portal, con todas las precauciones de que las preguntas no se salgan de ahí»
- «Antes de que ejecutemos este plan, muéstrame cómo se vería»

Ajustes de Sam al ver la primera maqueta (2026-11-16, en la sesión del Worker):

- Faro lleva **el mismo ícono del faro que en el ERP**, en la vista sencilla y en la completa.
- La vista sencilla trae un acceso rápido para **enviarle al proveedor la dirección del almacén y las
  instrucciones**, y una sección pequeña, «interactiva, visual y simple», que explica el Shipping Mark y cómo se
  arma el código.
- El tema **predeterminado es el claro (blanco)**. El cliente puede pasar a noche.
- «Esta es la parte importante porque es lo que le gusta al cliente y nos separa de la competencia»: pidió una
  maqueta más trabajada, con la vista completa tal como está hoy y la sencilla con la marca vigente y el faro.

Lo que eso fija:

- **No es un rediseño.** La vista completa queda igual. La sencilla es otra forma de presentar los mismos datos.
- **El cliente elige** y puede volver cuando quiera.
- **Faro del cliente** es un asistente aparte del Faro del Studio (SDD-0637), con fronteras propias (§7).
- Es una función nueva: no entra en lo acordado en la reunión del 2026-11-17. Se programa aparte.

## 2. Alcance

**Entra:**

- Preferencia de vista por persona del portal: `sencilla` o `completa` (§5).
- Selector visible en la barra superior del portal, en las dos vistas.
- Inicio de la vista sencilla: seis bloques en una página (§6).
- Ayudas fijas de tres tipos (Consejo, Recuerda, Atención) y un glosario en línea.
- Faro del cliente: panel de preguntas sobre la cuenta propia, con fronteras duras (§7).

**No entra:**

- Cambios a las pantallas de la vista completa. Si la vista sencilla necesita algo que la completa no tiene, se
  enlaza a la completa.
- Escrituras nuevas desde la vista sencilla. Sus botones llevan a los flujos que ya existen (subir documento,
  reportar pago, chat con el asesor).
- Que Faro del cliente haga cambios en la cuenta, cotice o dé precios.
- La app móvil.
- La web pública y el borde.

## 3. Investigación

Cuatro frentes en paralelo, el 2026-11-16, con búsqueda web. Se marca **VERIFICADO** lo leído en la fuente e
**INFERIDO** lo que es lectura nuestra.

**Material previo.** No se encontró investigación archivada sobre ManyChat ni sobre el estilo «para Dummies» en
`docs/`, `_norte/`, `.agents/`, en el repo de memoria compartida ni en las notas de sesiones. La única mención de
ManyChat en transcripciones es un enlace suelto en una sesión de la app de Meta. Por eso se investigó de nuevo.

### 3.1 Portales logísticos y casilleros

- VERIFICADO. La página de un envío en Flexport abre con una línea de tiempo de hitos, un estado en lenguaje
  llano y una fecha estimada; un buzón lateral fija las tareas abiertas con fecha límite; lo que no aplica (aduana,
  si no la despachan) se oculta. <https://www.flexport.com/videos/shipment-details/>
- VERIFICADO. ShipBob resuelve el onboarding con un especialista humano que configura y capacita; no se encontró
  un tour dentro del panel. <https://www.shipbob.com/?p=6212> (resumen del buscador).
- VERIFICADO. One Way Cargo (casillero en Miami) explica cada tipo de prealerta con un video corto y deja claro
  el plazo: «antes de que la carga llegue a Miami». <https://onewaycargo.net/infografias/prealerta.pdf>
- VERIFICADO. El propio Zoom admitió que su plataforma de casillero nueva «no es lo óptimo».
  <https://www.bloomberglinea.com/latinoamerica/venezuela/zoom-detecta-el-regreso-de-las-compras-de-venezolanos-en-amazon-y-se-prepara-para-la-temporada-alta/>
- INFERIDO. Ningún portal revisado tiene un modo «simple/avanzado» explícito. Flexport lo logra de hecho: lo
  esencial arriba, el resto en pestañas.

### 3.2 Productos «simples por defecto»

- VERIFICADO. ManyChat separa las Quick Automations (plantillas por caso de uso, sin abrir el editor) del Flow
  Builder. Cuando el modo simple no alcanza (por ejemplo, adjuntar un PDF), el usuario pasa al editor completo.
  <https://manychat.com/blog/manychat-best-practices/> ·
  <https://community.manychat.com/general-q-a-43/how-do-i-switch-say-hi-to-new-followers-from-quick-automation-to-flow-builder-10842>
- VERIFICADO. Mailchimp: las cuentas nuevas entran directo al editor nuevo; el cambio de editor solo aplica a lo
  nuevo, lo creado se sigue abriendo donde nació. <https://mailchimp.com/help/switch-your-default-email-builder/>
- VERIFICADO. Samsung «Modo fácil»: se activa y se revierte desde Ajustes; cambia tamaño, inicio y teclado, y
  desactiva algunas funciones avanzadas. <https://www.samsung.com/ae/support/mobile-devices/using-easy-mode-on-my-samsung-phone>
- VERIFICADO. Bancos con vista simple y completa conmutables: DBS/POSB, Hang Seng, Banca March, BBVA (versión para
  clientes mayores, en prueba en América Latina). Banca March deja arriba lo más usado y el botón de llamada.
  <https://posb.com.sg/personal/support/bank-switch-simple-full-mode.html> ·
  <https://cms.hangseng.com/cms/smartbanking/eng/simple_mode.html> ·
  <https://www.bancamarch.es/en/news/current-news/banca-march-launches-a-simplified-version-of-its-app-to-afford-greater-accessibility-for-customers.html> ·
  <https://www.bbva.com/es/innovacion/la-version-simplificada-de-la-app-de-bbva-para-clientes-senior-comienza-sus-pruebas-en-america-latina/>
- VERIFICADO. Wix ADI: el paso al editor completo era de un solo sentido. Es el contraejemplo.
  <https://support.wix.com/en/article/adi-sites-no-longer-supported>
- INFERIDO. Ninguna fuente dice si la preferencia se guarda por persona o por dispositivo. Es decisión nuestra
  (D-1).

### 3.3 Pedagogía «para Dummies» y divulgación progresiva

- VERIFICADO. Nielsen Norman Group: dos niveles de divulgación como máximo; lo frecuente en la primera vista y lo
  especializado detrás de un control con etiqueta clara. Ocultar lo necesario es un fallo tan grave como mostrar de
  más. <https://www.nngroup.com/articles/progressive-disclosure/>
- VERIFICADO. NN/g: reconocer antes que recordar; el vocabulario del usuario, no el interno.
  <https://www.nngroup.com/articles/ten-usability-heuristics/>
- VERIFICADO. NN/g: un estado vacío enseña qué hace la función y da una acción directa.
  <https://www.nngroup.com/articles/empty-state-interface-design/>
- VERIFICADO. NN/g: un tooltip no lleva información necesaria para la tarea y no sirve en pantallas táctiles.
  <https://www.nngroup.com/articles/tooltip-guidelines/>
- VERIFICADO. GOV.UK: una pregunta por página; el encabezado es la pregunta.
  <https://design-system.service.gov.uk/patterns/question-pages/>
- VERIFICADO. W3C COGA: lenguaje literal, caminos críticos cortos, ayuda humana accesible.
  <https://www.w3.org/TR/coga-usable/>
- VERIFICADO. Digital.gov: voz activa, frases cortas, hablarle directo al lector; medir la comprensión con
  pruebas de paráfrasis y de uso, al menos dos rondas. <https://digital.gov/guides/plain-language/writing> ·
  <https://digital.gov/guides/plain-language/test>
- VERIFICADO. Los libros «For Dummies» usan íconos fijos al margen: Tip, Remember, Warning y Technical Stuff.
  <https://www.oreilly.com/library/view/tumblr-for-dummies/9781118370827/a5.html>
- INFERIDO. Las cifras habituales (frases de menos de 20 palabras, 5 a 7 acciones por pantalla) no aparecieron en
  las fuentes leídas. Se usan como guía interna y se validan con clientes (D-12).

### 3.4 Asistentes con contexto restringido

- VERIFICADO. OWASP LLM06 (Excessive Agency): pocas herramientas, de solo lectura, con el contexto y los
  privilegios del usuario; la autorización la decide el sistema, no el modelo. Registro y límites de ritmo reducen
  el daño pero no lo previenen. <https://genai.owasp.org/llmrisk/llm062025-excessive-agency/>
- VERIFICADO. OWASP, guía de inyección de prompt: defensa en capas; filtrar la entrada no es frontera de
  seguridad; la salida se trata como no confiable; los logs no guardan contenido sensible.
  <https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html>
- VERIFICADO. Anthropic: prefiltro con un modelo ligero, negativas explícitas, contenido de terceros como datos y
  no como órdenes, mínimo privilegio, limitar a quien reincide; no poner en el prompt lo que el modelo no necesita.
  <https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks> ·
  <https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-prompt-leak>
- VERIFICADO. Microsoft: mensaje de sistema con rol, límites y frases de rechazo fijas; probar con un set mixto de
  preguntas benignas y adversarias. <https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/system-message>
- VERIFICADO. Bank of America Erica exige sesión autenticada y conecta con especialistas humanos.
  <https://info.bankofamerica.com/en/digital-banking/erica>
- INFERIDO (blogs de práctica, no documentación oficial). En asistentes multicliente, el filtro por cliente va en
  la base de datos antes de recuperar, y la identidad sale de la sesión, nunca de lo que mande el navegador.

### 3.5 Patrones que se adoptan

1. Una pregunta por bloque, en el orden en que el cliente la hace (Flexport, GOV.UK).
2. Estado en palabras del cliente, con la fecha estimada marcada como estimada.
3. «Lo que te toca hacer» arriba, con un botón por tarea (buzón de Flexport).
4. Un solo nivel extra: cada bloque enlaza a su pantalla de la vista completa (NN/g).
5. Selector visible y reversible en los dos sentidos; la elección no borra ni mueve datos (Samsung, bancos,
   contraejemplo de Wix).
6. Cuentas nuevas en sencilla; las existentes se quedan como están (Mailchimp).
7. Ayudas con tres íconos fijos y glosario en línea, nunca como tooltip (For Dummies, NN/g).
8. Contacto humano siempre visible, como soporte y no como venta (COGA, Banca March).

## 4. Lo que existe hoy

Medido sobre `main` en `27a8027eb`. Rutas relativas a la raíz del repo.

### 4.1 Portal

- Layout autenticado: `app/portal/(app)/layout.tsx`. Resuelve al cliente en `:44-46` y monta `PortalShell`
  (barra lateral y superior).
- Identidad: `getPortalClientPrincipal` en `lib/portal/portal-queries.ts:127`, que lee `client_users`
  (`:83`) por `auth_user_id` y `status='active'`. Devuelve tenant, cliente y Shipping Mark.
- Menú: `app/portal/_components/PortalSidebar.tsx`. Inicio (`:121`), Mis envíos (`:134`), Mis compras
  (`:142`), Finanzas (`:162`), Documentos (`:174`), y en «Más» Referidos, Academia, Soporte y Club. Acciones
  rápidas: nueva compra, cotizaciones, reportar pago y cotizar un servicio.
- Pantallas bajo `app/portal/(app)/`: inicio, envíos y su detalle, compras, proveedores, facturas y su detalle,
  finanzas (estado de cuenta), estimados, cotizaciones, documentos, soporte (chat con el asesor, SDD-0147),
  perfil, academia, club, referidos y reclamos.
- Datos (lecturas en `lib/portal/*.ts`): `shipments` y `shipment_events`; `invoices` y `payment_reports`;
  `shipment_documents` y la RPC de packing list; `warehouse_receipts_cn` y sus fotos; `conversations` y
  `conversation_messages`; `quotes`; RPC de avisos, asesor y perfil privado.
- Acceso: mixto. Las lecturas del cliente usan su sesión con RLS y además filtran por tenant y Shipping Mark
  (`lib/portal/portal-queries.ts:6-17`). Algunas lecturas usan service_role (por ejemplo zarpes,
  `app/portal/(app)/layout.tsx:125`), contenido por la SDD-0335.
- Preferencias: solo existe la cookie `portal-theme` (tema claro/oscuro),
  `app/portal/_components/PortalThemeToggle.tsx:26`. **Ojo con el nombre:** «light» ya significa tema claro.
  Por eso esta spec usa «sencilla» y «completa» en código y en pantalla (D-10). No hay tabla de preferencias del
  cliente.
- Cliente nuevo: llega por registro (`app/portal/(auth)/registro/`) o por invitación con link (SDD-0646,
  migración `0552_registro_portal_por_link.sql`). En los dos casos nace una fila de `client_users`.

### 4.2 Faro

- Faro es la **SDD-0637** (`docs/specs/0637-faro-asistente-ayuda/spec.md`), en `proposed`. «0550» es su migración
  de registro (`supabase/migrations/0550_faro_registro.sql`), no aplicada en ningún entorno.
- Hoy solo hay contenido de ayuda del Studio (`lib/studio/asistente/contenido/`) y la prueba de la migración. **No
  hay código que arme contexto ni llame a un modelo.** La fase 3 de la 0637 es la que conecta el motor.
- Diseño de la 0637: flujo fijo, sin herramientas ni memoria (`spec.md:73`); recorte por permisos del Studio antes
  de la IA (§6.1); el servidor decide el bloqueo (§6.2); topes por persona y por mes (D-8); registro en
  `asistente_conversaciones` y `asistente_mensajes`.
- Todo depende de la sesión del Studio (`requireStudioSession`, `getStudioAccess`, `user_tenants`). Un cliente del
  portal no tiene nada de eso. Faro del cliente necesita su propio recorte, su propio catálogo y su propio registro
  con `client_id` (§7).

### 4.3 Proveedor de IA y regla D-2

- Regla de Sam: **los datos de clientes nunca van a un proveedor chino.** Está en la 0637 §6.5
  (`docs/specs/0637-faro-asistente-ayuda/spec.md:243-247`), que remite a la SDD-0639 §4 (PR #606, sin fusionar al
  escribir esto).
- Proveedor propuesto para Faro: Anthropic directo, con el SDK ya instalado (`package.json:55`,
  `@anthropic-ai/sdk`). Anthropic tiene sede en EE. UU. y figura en `docs/legal/privacidad/inventario-terceros.md:38`,
  pero esa fila no menciona Faro.
- El runtime de la Oficina usa Z.AI y DeepSeek (`docs/specs/0626-oficina-runtime/privacidad.md`). **Faro del
  cliente nunca pasa por la Oficina** mientras use proveedores chinos.
- Verificado en el código: no hay hoy ninguna llamada de Faro a un modelo, así que ningún dato de cliente sale por
  Faro. El proveedor que use Faro del cliente se fija por configuración con lista permitida (§7, FC-10).

## 5. Preferencia de vista

**Modelo propuesto (D-1, D-2):**

- Columna nueva `client_users.portal_vista`, `text not null`, con `check (portal_vista in ('sencilla','completa'))`.
- **Por persona del portal**, no por empresa: dos personas de una misma empresa pueden preferir vistas distintas.
- **Valor inicial:**
  - En la migración, las filas que ya existen quedan en `completa`. Ningún cliente actual ve un portal distinto
    sin pedirlo.
  - El `default` de la columna es `sencilla`. Toda fila nueva (registro o invitación por link) empieza en
    sencilla.
- **Cambio:** el selector llama a una Server Action que actualiza solo la fila de la persona autenticada, con su
  sesión y una policy que limita la columna a `auth_user_id = auth.uid()`. El servidor ignora cualquier
  identificador que llegue del navegador.
- **Lectura:** el layout ya resuelve el principal; se suma `portal_vista` a esa misma lectura, sin consulta extra.
- **Respaldo sin base de datos:** si la columna no existe todavía (migración sin aplicar), el portal usa
  `completa`. Así la fase 1 puede fusionarse antes de aplicar la migración sin cambiar nada para nadie.
- **Interruptor general:** `PORTAL_VISTA_SENCILLA` (variable de entorno, apagada por defecto). Apagado, nadie ve el
  selector ni la vista sencilla, aunque su fila diga `sencilla`.
- **Migración:** `0557_portal_vista_preferida.sql` (número reservado por el DG para esta spec).

Alternativa descartada: guardarla solo en cookie, como el tema. Es más simple, pero no sigue al cliente entre su
teléfono y su computadora, y un cliente nuevo no tendría cómo empezar en sencilla en un segundo dispositivo.

## 6. La vista sencilla

Ver la maqueta. Resumen:

- **Barra superior:** marca y selector «Vista sencilla / Vista completa». El tema claro/oscuro sigue en el menú
  de la cuenta.
- **Botón de Faro:** el mismo del Studio (SDD-0637 §7.1, estilo 1): faro de torre blanca con rayas rojas, fondo
  azul noche y aro dorado, flotante abajo a la derecha, **en las dos vistas** (pedido de Sam). Se reutiliza el
  componente del Studio cuando exista; no se dibuja otro. La excepción de marca que Sam autorizó para Faro en la
  0637 §7 se extiende a este botón y a la cabecera de su panel; el resto del panel sigue la marca del portal.
  Solo aparece si Faro del cliente está encendido.
- **Bienvenida** la primera vez: «Te mostramos la vista sencilla… Puedes volver cuando quieras.» Se cierra con
  «Entendido» y no vuelve.
- **Saludo** con el nombre de pila y el Shipping Mark, con una línea que explica para qué sirve.
- **Seis bloques numerados**, cada uno una pregunta del cliente:
  1. **¿Dónde está tu carga?** El envío activo más avanzado: estado en palabras, avance de 5 etapas (el ciclo de la
     SDD-0170), fecha estimada (SDD-0627) marcada como estimada, y los demás envíos en una línea cada uno.
  2. **Lo que te toca hacer.** Tareas abiertas con su botón: documento faltante, saldo por pagar, prealerta. Si no
     hay, lo dice: «No tienes nada pendiente».
  3. **Cuánto debes.** Saldo en USD; bolívares solo como vista, según la regla vigente.
  4. **Tus documentos.** Los últimos papeles con su botón de descarga.
  5. **¿Te quedó una duda?** Faro y el chat con el asesor (SDD-0147).
  6. **¿Vas a comprar en China? Envíale esto a tu proveedor.** Dos partes:
     - El mensaje listo para copiar, con la dirección del almacén, quién recibe y el código que va en cada caja.
       Es el mismo texto que hoy arman `components/ChinaSupplierClip.tsx` y `components/AlibabaAddressGuide.tsx`
       en «Mis compras» (`app/portal/(app)/proveedores/SuppliersClient.tsx:120-131`); la vista sencilla lo
       reutiliza, no lo reescribe.
     - El código parte por parte: el cliente toca cada parte y lee qué significa. El formato es
       `DTD-{cliente}-{proveedor}-{compra}` (`lib/studio/prealertas/types.ts:116-118`). Al lado, una caja
       dibujada con el código puesto.
     - En pantalla se dice **«Shipping Mark»**, nunca «Markbox» (BRAND.md, BD-022).
     - Para registrar un proveedor o una compra nueva, enlaza a la vista completa.
- **Cada bloque enlaza** a su pantalla de la vista completa. No hay un tercer nivel.
- **Ayudas:** tres tipos fijos, con ícono y texto visible, nunca tooltip:
  - **Consejo**: un atajo o una recomendación.
  - **Recuerda**: algo que conviene no olvidar (por ejemplo, que la fecha es un estimado).
  - **Atención**: un riesgo real (pagos, plazos, aduana). Se usa poco para que conserve su peso.
- **Glosario en línea:** desplegables con las palabras que el cliente no tiene por qué saber (consolidado, m³,
  packing list, prealerta, aduana). Viven en un archivo de contenido revisado, el mismo que usará Faro del cliente.
- **Copy:** tuteo, voz activa, frases cortas, un verbo por botón. «Contenedor» o «consolidado», nunca «lote».
- **Sin datos nuevos:** todo sale de las lecturas que ya usa el portal (§4.1). Si una lectura usa service_role
  hoy, la vista sencilla no suma usos nuevos.

## 7. Faro del cliente

Un asistente aparte del Faro del Studio. Reutiliza el motor de la 0637 (cliente directo, topes, registro), pero
no su catálogo, su recorte ni su sesión.

### 7.1 Cómo responde

Flujo fijo, sin herramientas que el modelo pueda invocar:

1. El servidor resuelve al cliente con `getPortalClientPrincipal`. Sin principal, no hay Faro.
2. Revisa la cuota (FC-8). Si no hay cupo, responde la plantilla de límite sin llamar al modelo.
3. Clasifica la pregunta: ¿es del portal? Primero reglas en código (palabras de otros clientes, de márgenes,
   órdenes de ignorar instrucciones) y después, si hace falta, un modelo ligero con salida sí/no. Fuera de tema →
   plantilla fija, sin llamada principal.
4. Arma la **ficha del cliente** con las lecturas del portal, **con la sesión del cliente y RLS**, nunca con
   service_role: envíos activos (código, etapa, ETA), saldo, tareas abiertas y nombres de documentos. Solo los
   campos de esa lista cerrada.
5. Llama al modelo con: instrucciones fijas, glosario y guías del portal revisadas, y la ficha como datos JSON.
6. Revisa la salida en el servidor (FC-7). Si falla, la reemplaza por la plantilla de «no puedo responder».
7. Registra (FC-9) y responde.

### 7.2 Fronteras duras

| # | Frontera | Cómo se cumple | Prueba |
|---|---|---|---|
| FC-1 | Solo datos del cliente que pregunta | La ficha se arma con la sesión del cliente y RLS; la identidad sale de la sesión; el navegador solo manda el texto | Dos clientes sembrados en Postgres efímero: la ficha de A nunca trae un código de B |
| FC-2 | Nada del ERP interno | La ficha es una lista cerrada de campos; costos, márgenes, proveedores internos, personal, notas internas y tarifas internas no existen en ella | Prueba de forma: la ficha no tiene claves fuera de la lista |
| FC-3 | Nada de tarifas internas | Faro no calcula ni cotiza; para precios enlaza a la calculadora pública y a las cotizaciones del cliente | Batería: «¿cuánto me cobras por 2 m³?» → plantilla |
| FC-4 | Solo temas del portal | Clasificador previo (código + modelo ligero) y plantillas de rechazo fijas | Batería de fuera de tema |
| FC-5 | Sin acciones | No hay herramientas. Para cambiar algo, el botón lleva al flujo de la vista completa o al asesor | Prueba de que el motor no expone herramientas |
| FC-6 | El texto del ERP es dato, no orden | Notas y descripciones viajan como JSON dentro de la ficha; las instrucciones lo declaran | Batería con una descripción de carga que trae una orden inyectada |
| FC-7 | Salida revisada | Se bloquea la respuesta si menciona un código de envío, factura o Shipping Mark que no está en la ficha, o si repite las instrucciones | Prueba de la revisión con salidas simuladas |
| FC-8 | Ritmo limitado | Por persona: N por hora y M por día (D-5); tope de gasto mensual propio; reserva atómica como AC-18 de la 0637 | Simulacro de cupo agotado y de carrera |
| FC-9 | Cada pregunta queda registrada | Tablas propias con `client_id`: pregunta depurada, veredicto, resultado, tokens y costo; sin la ficha | Contrato de la migración |
| FC-10 | Proveedor no chino | Lista permitida en la configuración; Faro del cliente no arranca si apunta fuera; nunca por la Oficina | Prueba que falla con un proveedor fuera de la lista |
| FC-11 | Mínimo de datos al modelo | Nombre de pila, sin apellido, cédula, teléfono, correo ni dirección | Prueba de forma de la ficha |
| FC-12 | Salida a humano | Rechazo, duda o fallo → botón «Escribir a mi asesor» (chat SDD-0147) | Prueba de la plantilla |

### 7.3 Plantillas de rechazo

Fijas, escritas por nosotros, sin que el modelo las redacte:

- Otro cliente: «No puedo ver ni compartir datos de otros clientes. Solo veo tu cuenta.»
- Dato interno: «Esa información es interna y no está en tu portal. Si tienes una duda sobre tu precio, tu asesor
  te la explica.»
- Fuera de tema: «Solo te ayudo con tu portal: envíos, pagos, facturas y documentos. ¿Te ayudo con alguno?»
- Acción: «No puedo hacer cambios en tu cuenta. Puedes hacerlo en la vista completa o pedírselo a tu asesor.»
- Límite: «Llegaste al límite de preguntas de hoy. Mañana puedes seguir, o escríbele a tu asesor.»
- Fallo: «No puedo responder ahora. Escríbele a tu asesor y te ayuda.»

## 8. Datos personales

Revisión según `.claude/skills/revisar-datos-ve/SKILL.md`. En esta fase es un inventario de lo que habrá que
revisar; el reporte formal se hace como puerta antes de la fase 2 (preferencia) y antes del primer envío real a un
modelo.

| Dato | Dónde | Estado |
|---|---|---|
| `client_users.portal_vista` | Fase 1 | No es dato personal sensible: una preferencia. Se borra con la fila del vínculo (SDD-0467, 0477) |
| Preguntas a Faro del cliente | Fase 3 | Dato personal: el cliente puede escribir su cédula, teléfono o datos de terceros. Se depura antes de enviar y antes de guardar (como E-3 de la 0637) |
| Ficha enviada al modelo | Fase 3 | Datos del cliente a un tercero (Anthropic, EE. UU.). Mínimo necesario (FC-11); no se guarda |
| Registro de Faro del cliente | Fase 3 | Retención con plazo (D-6) y purga a pedido, con constancia |

Pendientes que la revisión debe resolver antes del primer envío real (`NO VERIFICABLE` hoy, desde el repo):

- La retención de Anthropic para la cuenta que use Faro, por escrito, o cero retención si está disponible.
- Sumar Faro del cliente a la fila de Anthropic en `docs/legal/privacidad/inventario-terceros.md:38`.
- El aviso al cliente en `/privacidad` y en el propio panel: qué ve Faro, que las preguntas se guardan, cuánto
  tiempo y quién las lee. Texto aprobado por el DG antes de publicarlo.
- Que el clasificador ligero, si es un modelo, también sea de un proveedor de la lista permitida.

La regla D-2 de Sam se cumple por diseño (FC-10) y se prueba en CI.

## 9. Fases y allowlist

Cada fase es una PR propia, con su turno del DG. La lista es exacta: un archivo fuera de ella se justifica en la
PR o se saca.

| Fase | Qué | Allowlist | Puerta |
|---|---|---|---|
| 0 | Investigación, maqueta y spec | `docs/specs/0654-version-light-portal/**`, `docs/specs/README.md`, `.agents/handoffs/sdd-0654-version-light-portal.md` | Esta PR. Sam ve la maqueta |
| 1 | Preferencia y selector, interruptor apagado | `supabase/migrations/0557_portal_vista_preferida.sql` y su `.test.sql`; `lib/portal/vista-preferida.ts` y su prueba; `app/portal/(app)/layout.tsx`; `app/portal/_components/PortalTopbar.tsx`; `app/portal/_components/PortalVistaSelector.tsx` (nuevo); `app/portal/_actions/vista-preferida.ts` (nuevo); `.env.example` | Revisión de datos (preferencia). Aplicar la 0557 con OK de Sam y runbook |
| 2 | Inicio sencillo, ayudas y glosario | `app/portal/(app)/page.tsx` (solo el desvío según la vista); `app/portal/(app)/_sencilla/**` (nuevo); `lib/portal/sencilla/**` (nuevo: armado de bloques y contenido de ayudas y glosario); `components/ChinaSupplierClip.tsx` y `components/AlibabaAddressGuide.tsx` solo si hace falta extraer el texto a una función compartida, sin cambiar lo que muestran; sus pruebas y un e2e del selector | `/ui-check`. Prueba con clientes (D-12). Encender el interruptor con OK de Sam |
| 3 | Faro del cliente con motor simulado | `lib/portal/faro/**` (nuevo); `app/api/portal/faro/route.ts` (nuevo); `app/portal/_components/PortalFaroPanel.tsx` (nuevo); el botón de Faro del Studio, movido a un lugar compartido si la 0637 ya lo creó; una migración de registro (número del DG) y su `.test.sql`; pruebas de FC-1 a FC-12 | Depende de la fase 3 de la 0637 (motor y topes). Revisión de datos |
| 4 | Primer envío real | Solo configuración y textos: `/privacidad`, inventario de terceros, aviso del panel | Revisión de datos aprobada. OK nominal de Sam |
| 5 | Batería adversaria y encendido | `lib/portal/faro/__tests__/bateria/**` | Batería verde; encendido con OK de Sam |

## 10. Criterios de aceptación

| AC | Criterio | Fase |
|---|---|---|
| AC-1 | Con el interruptor apagado, el portal es idéntico al de hoy para todos | 1 |
| AC-2 | Tras la 0557, toda fila existente de `client_users` está en `completa` y una fila nueva nace en `sencilla` | 1 |
| AC-3 | Un cliente solo puede cambiar su propia preferencia; un intento con otro identificador no cambia nada | 1 |
| AC-4 | Sin la columna (migración sin aplicar), el portal funciona y usa `completa` | 1 |
| AC-5 | El selector funciona en las dos vistas y la elección persiste entre dispositivos | 1 |
| AC-6 | El inicio sencillo muestra los seis bloques con datos del propio cliente y un estado vacío que enseña en cada uno | 2 |
| AC-7 | Cada bloque enlaza a su pantalla de la vista completa | 2 |
| AC-13 | El bloque del proveedor muestra la misma dirección y el mismo texto que «Mis compras», con el Shipping Mark del cliente; una prueba compara las dos salidas | 2 |
| AC-14 | El botón de Faro es el mismo componente en el Studio y en el portal | 3 |
| AC-8 | La vista sencilla no agrega lecturas con service_role | 2 |
| AC-9 | Cada frontera FC-1 a FC-12 tiene su prueba y pasa | 3 |
| AC-10 | Un fallo de aislamiento entre clientes pone roja la CI | 3 |
| AC-11 | La batería tiene preguntas permitidas y rechazadas, en español y en inglés, y mide también el rechazo de preguntas legítimas | 5 |
| AC-12 | Existe la revisión `revisar-datos-ve` aprobada antes del primer envío real | 4 |

## 11. Decisiones para Sam

| D | Pregunta | Recomendación |
|---|---|---|
| D-1 | ¿La preferencia es por persona o por empresa cliente? | **Por persona** (`client_users`): en una empresa con dos usuarios, cada uno elige |
| D-2 | ¿Con qué vista empieza cada uno? | **Cliente nuevo en sencilla; los actuales en completa**, para que nadie vea un cambio sin pedirlo |
| D-3 | ¿Dónde va el selector? | **En la barra superior**, visible en las dos vistas, con los nombres «Vista sencilla» y «Vista completa» |
| D-4 | ¿Faro del cliente aparece en las dos vistas o solo en la sencilla? | **Decidida por Sam (2026-11-16): en las dos, con el mismo ícono del faro del ERP** |
| D-5 | ¿Cuántas preguntas por persona? | **20 por día y 5 por hora**, con tope de gasto mensual propio, separado del Faro del Studio. Sam fija el monto |
| D-6 | ¿Cuánto tiempo se guardan las preguntas? | **90 días** y purga a pedido del cliente, con constancia |
| D-7 | ¿Qué pasa cuando Faro no puede responder? | **Botón al chat con el asesor** que ya existe (SDD-0147). Sin crear tickets automáticos |
| D-8 | ¿Qué proveedor de IA? | **Anthropic directo, sin respaldo**, igual que la D-1 de la 0637. Nunca un proveedor chino ni la Oficina |
| D-9 | ¿En qué orden? | **Vista sencilla primero (fases 1 y 2) y Faro del cliente después** de la fase 3 de la 0637, para no escribir dos motores |
| D-10 | ¿Cómo se llama en pantalla? | **«Vista sencilla» y «Vista completa»**, no «light» y «full»: «light» ya es el tema claro y el cliente habla español |
| D-11 | ¿Faro del cliente puede hablar de precios? | **No en la primera versión.** Para precios enlaza a la calculadora y a las cotizaciones del cliente |
| D-13 | ¿El bloque del proveedor muestra el código de la próxima compra o solo el Shipping Mark? | **El código completo de la próxima compra si el cliente ya tiene un proveedor registrado; si no, solo su Shipping Mark** y el enlace para registrar al proveedor |
| D-12 | ¿Probamos con clientes antes de que sea el inicio de los nuevos? | **Sí: 5 clientes en dos rondas.** Que expliquen con sus palabras el estado de su carga y encuentren un documento. Después se enciende |

## 12. Riesgos

| Riesgo | Mitigación |
|---|---|
| La vista sencilla oculta algo que el cliente necesita | Cada bloque enlaza a la completa; prueba con clientes (D-12) |
| Tono condescendiente | Ayudas opcionales, cortas, sin repetir lo obvio; bienvenida que se cierra |
| Dos vistas que mantener | La sencilla no tiene pantallas propias más allá del inicio; reutiliza lecturas y enlaza al resto |
| Faro filtra datos de otro cliente | Ficha con sesión y RLS (FC-1), revisión de salida (FC-7), prueba que pone roja la CI (AC-10) |
| Inyección desde textos del ERP | FC-6 y batería con orden inyectada |
| Costo | Cuota por persona, tope mensual, plantillas sin llamada al modelo |
| Confusión con el tema claro | Nombres «sencilla/completa» en código y pantalla (D-10) |

## 13. Fuentes

Las URL de §3. Medición del código en §4, sobre `27a8027eb`.

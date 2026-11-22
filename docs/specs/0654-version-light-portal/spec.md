---
sdd: "0654"
title: "Versión light del portal del cliente: Vista simple, Vista Pro, selector entre las dos y Faro del cliente"
status: approved
author: "Claude (Worker del DG) + Sam"
created: 2026-11-16
updated: 2026-11-17
supersedes: null
superseded_by: null
related: ["0042", "0147", "0335", "0549", "0627", "0637", "0646"]
confidencialidad: interno
---

# SDD-0654 — Versión light del portal del cliente

> Un cliente nuevo o poco técnico entra al portal y ve una sola página con lo que necesita saber: dónde está su
> carga, qué le toca hacer, cuánto debe, sus papeles y a quién preguntar. Si quiere el detalle, cambia a la Vista
> Pro, que es el portal de hoy sin cambios. Un Faro del cliente responde solo sobre su propia cuenta.

**Estado:** `approved` (2026-11-17). Fase 0 (esta PR): investigación, maqueta y spec. **No hay código de producto ni
migraciones.** Cada fase siguiente necesita el turno del Director General; la fase 1 va en una PR nueva, después
de que esta spec esté en `main`, con la migración 0557 reservada por el DG.

**Maqueta:** `maqueta/portal-vistas.html` (autocontenida; se abre en el navegador). Publicada también como
Artifact privado para Sam; el enlace va en la PR. Todos los nombres, montos y códigos son inventados.

- Abre en la vista simple y arranca la guía. Con `#pro` al final de la dirección abre la vista Pro;
  con `#simple`, la simple sin guía; con `#comparar`, la comparación; con `#codigo`, el tutorial del código.
- La vista Pro de la maqueta es una réplica del inicio de hoy, medida del código (§4.1). Lo único que se le
  suma es el selector de vista y el botón de Faro.

**Decisiones:** D-1 a D-20 (§11), **todas decididas por Sam**: D-4 y D-10 el 2026-11-16 y las demás el
2026-11-17, con la opción recomendada.

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
- Al ver la segunda maqueta: «Me gustó la propuesta». Pidió **más detalle en la explicación del código**: qué
  significa el número que va después del código de cliente (el proveedor) y el siguiente (las veces que le ha
  comprado), de forma interactiva o con un «aquí puedes oprimir para ver un tutorial». El motivo: «la gente está
  enviando mercancías sin poner detalles, y después andan preguntando por el Proveedor 5 o el Proveedor 6 y no lo
  tienen así».
- Precisión que pasó el Director General (2026-11-16), literal de Sam: «Va a tener como dos vistas, como cuando
  configuras en Android la versión parecida a iPhone (que es muy simple y no se mueve nada) y la versión Pro, algo
  así. El usuario puede escoger vista simple o vista Pro.» Y preguntó: «¿Cuáles serían las diferencias notables y
  las ventajas de una y la otra?». De ahí salen los nombres **«Vista simple»** y **«Vista Pro»** (D-10 decidida),
  la regla «nada se mueve» (§6) y la comparación de §6.1. Los pedidos anteriores de esta lista dicen «sencilla» y
  «completa» porque así se llamaban en la primera maqueta.
- Comentario sobre la maqueta que pasó el Director General (2026-11-17), literal de Sam: «Compáctalo un poquito.
  El tema que habla: vas a comprar en China, envía esto al proveedor. Compáctalo un poquito y te autorizo a usar un
  poquito más de colores en algunas partes. El rojo, recuerda que el rojo siempre llama como si fuera un error: lo
  cambiamos por un rosado, un color que ya está probado, que es un vino claro.» De ahí sale §6.3.
- Una **guía para las primeras veces** en la vista sencilla: «Recuerda, aquí puedes hacer esto», con tres a seis
  consejos y la opción de «¿quieres continuar?» para seguir explicando la herramienta.
- «Esta es la parte importante porque es lo que le gusta al cliente y nos separa de la competencia»: pidió una
  maqueta más trabajada, con la vista completa tal como está hoy y la sencilla con la marca vigente y el faro.

Lo que eso fija:

- **No es un rediseño.** La Vista Pro es el portal de hoy y queda igual. La Vista simple es otra forma de presentar
  los mismos datos.
- **El cliente elige** y puede volver cuando quiera.
- **Faro del cliente** es un asistente aparte del Faro del Studio (SDD-0637), con fronteras propias (§7).
- Es una función nueva: no entra en lo acordado en la reunión del 2026-11-17. Se programa aparte.

## 2. Alcance

**Entra:**

- Preferencia de vista por cliente (en la V1, una sola persona de portal por cliente): `simple` o `pro` (§5).
- Selector visible en la barra superior del portal, en las dos vistas.
- Inicio de la vista simple: seis bloques en una página (§6).
- Ayudas fijas de tres tipos (Consejo, Recuerda, Atención) y un glosario en línea.
- Guía paso a paso para las primeras veces (§6.2).
- Tema claro como predeterminado del portal (D-14).
- Faro del cliente: panel de preguntas sobre la cuenta propia, con fronteras duras (§7).

**No entra:**

- Cambios a las pantallas de la vista Pro. Si la vista simple necesita algo que la Pro no tiene, se
  enlaza a la Pro.
- Escrituras nuevas desde la vista simple. Sus botones llevan a los flujos que ya existen (subir documento,
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
4. Un solo nivel extra: cada bloque enlaza a su pantalla de la vista Pro (NN/g).
5. Selector visible y reversible en los dos sentidos; la elección no borra ni mueve datos (Samsung, bancos,
   contraejemplo de Wix).
6. Cuentas nuevas en simple; las existentes se quedan como están (Mailchimp).
7. Ayudas con tres íconos fijos y glosario en línea, nunca como tooltip (For Dummies, NN/g).
8. Contacto humano siempre visible, como soporte y no como venta (COGA, Banca March).

### 3.6 Segunda opinión: Codex (2026-11-17)

Sam pidió una segunda opinión de Codex, primero técnica y después visual. En la revisión visual, Codex abrió la
maqueta en Chrome y diseñó una propuesta propia de la Vista simple, publicada aparte como Artifact privado para
Sam: <https://claude.ai/artifact/7t9znp9qf8pktXqCqrcYNp>. Lo que dijo es opinión de diseño, no medición con
clientes.

**Lo que mantiene:** los seis bloques fijos, el selector reconocible, el vino claro con texto navy (midió 4,79:1 y
7,13:1), la Comparación como mensaje y, sobre todo, el bloque del código del proveedor («es lo mejor de la
propuesta»).

**Adoptado en la maqueta y en esta spec:**

- el saldo en navy, no en dorado: un saldo sin incidencia no es una advertencia (§6.3);
- cuerpo de las instrucciones a 15-16 px; antes había textos de 12 a 13,5 px justo donde se explica;
- blancos táctiles de 44 px como mínimo en botones y controles;
- guía de 4 consejos y 2 opcionales, en vez de 5 y 3 (§6.2);
- sin animación continua en la Vista simple: el barco no se balancea, el faro no late ni gira (MOT-01);
- junto a «Copiar mensaje»: «Copiar no registra tu compra», y el número de la compra marcado como el que tendrá
  «al registrarla»;
- Faro con campo libre de pregunta y el aviso de que cada pregunta se responde sola (FC-15); los ejemplos de
  rechazo quedan plegados, solo para la revisión, fuera de la experiencia del cliente;
- la Comparación apilada en teléfono, sin tabla ancha;
- el wordmark en Archivo Black, como manda `BRAND.md`.

**Adoptado solo en la spec:** mientras el seguimiento esté en construcción, el bloque 1 muestra el último dato
registrado y la llegada estimada al puerto, en lugar de la ruta, como en la propuesta de Codex (ya era AC-12). La
maqueta sigue mostrando la ruta, que es como se verá con el seguimiento activo.

**No adoptado, y por qué:**

- el número de la compra en dorado (su propuesta lo hace): contradice `--warning` = riesgo real (§6.3);
- colores propios para el ícono de Faro: Sam pidió el mismo faro del ERP (D-4);
- la lista de proveedores como desplegable: la lista visible enseña que cada proveedor tiene su número, que es el
  problema que Sam quiere resolver. Queda como alternativa si la lista crece.

**Pendiente para la fase 2:** foco contenido en los diálogos (su propuesta lo trae; la maqueta no) y comportamiento
de teclado de la lista de proveedores como grupo de opciones (A11Y-01).

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
- **La RLS sola no aísla al cliente** (`lib/portal/portal-queries.ts:5-17`): las policies «por tenant» son
  permisivas (OR), así que una persona que es a la vez del equipo y cliente recibiría todo el tenant; y el Shipping
  Mark es único por tenant, no global, y la policy de facturas compara solo el Shipping Mark. Por eso cada lector
  del portal filtra además, de forma explícita, por el `tenant_id` y el Shipping Mark del principal (SDD-0462,
  0549, 0552).
- **Lecturas que hoy usan service_role** (contenidas por la SDD-0335 y la frontera de la SDD-0383), todas acotadas
  al principal:
  - órdenes por aceptar: `app/portal/(app)/page.tsx:89`, con `lib/portal/pending-acceptance.ts:56`;
  - snapshot naviero del próximo arribo: `app/portal/(app)/page.tsx:97`;
  - próximo zarpe: `app/portal/(app)/layout.tsx:125`;
  - packing list y consolidados: `app/portal/(app)/envios/page.tsx:98` y `:135`;
  - aviso de respuesta nueva en Soporte: `app/portal/(app)/layout.tsx:64-67`.
- **Estados ocultos (SDD-0156):** el tenant puede ocultar un hito al cliente (por ejemplo «en aduana»). El inicio
  sustituye el estado por el último visible con `getHiddenPortalStatusesForPortal` y `effectiveVisibleStatus`
  (`app/portal/(app)/page.tsx:66-83`). **Ojo:** ante un error esa función devuelve el conjunto vacío y se muestra
  todo (`lib/studio/notifications/portal-visibility-queries.ts:15-16` y `:36-41`). No distingue «falló» de «no
  hay ocultos».
- **Cliente no activado:** si la cuenta no está aprobada por un asesor ni tiene un envío, el inicio muestra la
  pantalla de espera `PortalPending` y nada más (`app/portal/(app)/page.tsx:53-56`).
- **El portal nace hoy en tema oscuro, por decisión de marca:** BD-037 fija «Vista predeterminada: compacta y en
  tema oscuro» para Studio y Portal (`BRAND.md:310`). El código lo cumple: `app/portal/(app)/layout.tsx:54` usa
  claro solo si la cookie dice `light`. El tema se aplica solo cuando el cliente ve el portal Norte (`layout.tsx:86`), que hoy son todos
  (`NORTE_PORTAL_LIVE = true`, `lib/portal/demo.ts:45`). Sam pidió que el predeterminado sea el claro (D-14).
- **El seguimiento está «en construcción»** (`lib/portal/tracking-en-construccion.ts`, SDD-0514): el almacén de
  China todavía registra en Excel, así que lo que sigue a la prealerta sale vacío y el inicio muestra un aviso. El
  inicio de hoy no tiene una franja de etapas: muestra un arco con un porcentaje derivado del estado
  (`app/portal/(app)/_components/PortalDashboardNorte.tsx`). Esto condiciona el bloque 1 de la vista simple
  (§6, §12).
- Motor de guía: existe uno en el Studio (SDD-0589, `lib/studio/guia/`), con recorridos por pantalla, anclas y
  arranque automático la primera vez. El portal sí puede importar `@/lib/studio` (ya lo hace:
  `app/portal/(app)/page.tsx:20` y `:23`, y ESLint no lo prohíbe en `app/portal`). Lo que impide usarlo tal cual
  es que su catálogo y sus preferencias dependen de los roles y de las claves de texto del Studio
  (`lib/studio/guia/recorridos.ts`, `preferencias.ts`) (§6.2).
- **Una sola persona de portal por cliente:** `client_users` tiene `unique (tenant_id, client_id)` («1 acceso de
  portal por cliente (V1)», `supabase/migrations/0080_portal_cliente.sql:29`), reafirmado en
  `0552_registro_portal_por_link.sql:481`. Hoy «la persona» y «el cliente» son lo mismo.
- **`client_users` no se puede escribir desde la sesión del cliente:** solo tiene `grant select` y una policy de
  lectura; «solo las RPCs SECURITY DEFINER escriben» (`supabase/migrations/0080_portal_cliente.sql:59-60` y
  `:67-70`). Tiene un trigger que actualiza `updated_at` en cada cambio (`0080_portal_cliente.sql:210`).
- **Marca y gobernanza que tocan esta spec:**
  - `--wine-soft` claro (`#C2747F`) es «acento secundario · solo sobre fondo oscuro» (`BRAND.md:123`).
  - VIS-01 §3: el vino es «identidad, selección y acción primaria»; VIS-01 §7: una desviación visual usa
    BRAND-CHECK y registra objetivo, superficie, tokens, contraste, duración y fecha de revisión.
  - BD-037 (`BRAND.md:308`): la selección (pestaña, filtro) va con relleno de tinta; es una excepción ya
    registrada a VIS-01 §3 y el portal la aplica en `app/portal/claridad.css:75`.
  - `--warning` es «riesgo real» (`BRAND.md:137`).
  - Una excepción con vigencia es un cambio L3: registro, dueño, fecha de revisión y alcance escrito
    (`docs/governance/README.md:108` y `:132`). Las decisiones de marca se registran en
    `docs/design/studio/_norte/BRAND-DECISIONS.md` (hoy llega a BD-070; BD-071 a BD-075 ya se nombran en otros
    documentos, así que el número lo asigna el DG al registrar).
  - En noche, `--color-wine-soft` no se redefine: sigue en `#C2747F` (`app/globals.css:144-160`).
- Preferencias: solo existe la cookie `portal-theme` (tema claro/oscuro),
  `app/portal/_components/PortalThemeToggle.tsx:26`. **Ojo con el nombre:** «light» ya significa tema claro.
  Por eso esta spec usa «simple» y «pro» en código y en pantalla (D-10). No hay tabla de preferencias del
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
- **La D-1 de la 0637 sigue abierta** (`docs/specs/0637-faro-asistente-ayuda/spec.md:441`): el Director General
  la aceptó con condiciones y falta Sam. Esa D-1 permite un respaldo de un proveedor no chino. La D-8 de esta spec
  es **más estricta**: sin respaldo en la primera versión y sin agregadores. No depende de aquella.
- **Agregadores:** OpenRouter figura como ruta alternativa de modelo en
  `docs/legal/privacidad/inventario-terceros.md:39`. Un agregador puede enrutar a modelos de proveedores chinos,
  así que no sirve para Faro del cliente (FC-10).
- Verificado en el código: no hay hoy ninguna llamada de Faro a un modelo, así que ningún dato de cliente sale por
  Faro. El proveedor que use Faro del cliente se fija por configuración con lista permitida (§7, FC-10).

## 5. Preferencia de vista

**Modelo propuesto (D-1, D-2):**

- Dos columnas nuevas en `client_users`:
  - `portal_vista text not null`, con `check (portal_vista in ('simple','pro'))`;
  - `portal_guia_vista_at timestamptz null`. Vacío significa que la guía todavía no se le mostró (§6.2, D-15).
- **Por fila de `client_users`.** En la V1 hay una sola persona de portal por cliente (§4.1), así que la preferencia
  es, a la vez, de la persona y del cliente. Si algún día se permiten varias personas por empresa, la columna ya está
  en el lugar correcto, pero eso es una decisión aparte (D-1).
- **Valor inicial:**
  - En la migración, las filas que ya existen quedan en `pro`. Ningún cliente actual ve un portal distinto
    sin pedirlo.
  - El `default` de la columna queda en `simple`. Toda fila nueva (registro o invitación por link) empieza en
    simple.

**Escritura: por RPC, nunca por policy.**

- `client_users` no tiene `grant update` ni policies de escritura, a propósito (§4.1). No se agregan. Una policy
  de UPDATE no sirve: la RLS filtra filas, no columnas, y dejaría al cliente cambiar su `client_id`, su
  `tenant_id` o su `status`.
- Dos RPC `SECURITY DEFINER`, con `search_path` fijo, `execute` solo para `authenticated` y sin recibir ningún
  identificador:
  - `portal_set_vista(p_vista text)`: valida el valor, toma la fila activa de `auth.uid()` y escribe **solo**
    `portal_vista`;
  - `portal_marcar_guia_vista()`: escribe **solo** `portal_guia_vista_at`, y solo si estaba vacío.
- El trigger `client_users_touch` moverá `updated_at` en cada cambio. Se acepta; en la fase 1 se comprueba que
  nada use `client_users.updated_at` como señal de negocio.
- **Prueba de contrato** (`.test.sql`): tras llamar a cada RPC como el cliente A,
  - en la fila de A solo cambian la columna de la RPC y `updated_at`; `client_id`, `tenant_id`, `auth_user_id`
    y `status` quedan iguales;
  - la fila del cliente B no cambia;
  - `anon`, una persona sin fila activa y una fila revocada no cambian nada;
  - un valor fuera de `simple`/`pro` se rechaza;
  - el catálogo sigue sin `grant update` ni policies de escritura sobre `client_users`.

**Lectura: aparte de la del principal.**

- **No se toca** la lectura del principal (`lib/portal/portal-queries.ts:82-90`). Si se le sumara
  `portal_vista` y la columna todavía no existiera, PostgREST devolvería error, el principal saldría `null` y el
  layout mandaría a **todos** los clientes a `/entrar` (`app/portal/(app)/layout.tsx:44-45`).
- La preferencia se lee con una consulta propia (`lib/portal/vista-preferida.ts`), filtrada por `auth.uid()` y
  `status = 'active'`. **Cualquier fallo degrada a `pro`** y a «guía ya vista»: columna inexistente, error de red
  o fila ausente. Nunca redirige ni rompe el portal.
- Con el interruptor apagado no se hace la consulta.
- Así la fase 1 puede fusionarse antes de aplicar la 0557 sin cambiar nada para nadie. Una prueba simula el error
  de columna inexistente y comprueba que el portal responde igual que hoy.

**Interruptor general:** `PORTAL_VISTA_SIMPLE` (variable de entorno, apagada por defecto). Apagado, nadie ve el
selector ni la vista simple, aunque su fila diga `simple`.

**Migración:** `0557_portal_vista_preferida.sql`. El número de migración 0557 lo reservó el Director General para
esta spec (encargo del 2026-11-16). No existe todavía en `supabase/migrations/` (la última es la 0553). No tiene
relación con la SDD-0557, que es una spec de contabilidad sin migración.

Alternativa descartada: guardarla solo en cookie, como el tema. Es más simple, pero no sigue al cliente entre su
teléfono y su computadora, y un cliente nuevo no tendría cómo empezar en simple en un segundo dispositivo.

## 6. La vista simple

Ver la maqueta. Resumen:

- **Barra superior:** marca y selector «Vista simple / Vista Pro». El tema claro/oscuro sigue en el menú
  de la cuenta.
- **Ajuste a la maqueta en teléfono (fase 2, aprobado por el DG el 2026-11-17).** A 375 px la barra tiene unos 343 px
  útiles, y el selector, «Comparar» y «Guía» junto a lo que ya está (menú, calculadora, campana, tema y cuenta)
  sumaban unos 430 px. La medida es un cálculo con los anchos del código; falta confirmarla con una captura en un
  portal de prueba. Por debajo de 640 px el selector se reduce a un solo botón («Simple ▾» o «Pro ▾»). Abre un
  panel con las dos vistas, «Comparar las dos vistas» y, en la Vista simple, «Guía». La barra queda en unos 300 px.
  Al abrir, el foco entra a la vista elegida; Escape cierra el panel y devuelve el foco al botón. En pantalla ancha
  no cambia nada: el grupo, «Comparar» y «Guía» van en la barra.
- **Botón de Faro:** el mismo del Studio (SDD-0637 §7.1, estilo 1): faro de torre blanca con rayas rojas, fondo
  azul noche y aro dorado, flotante abajo a la derecha, **en las dos vistas** (pedido de Sam). Se reutiliza el
  componente del Studio cuando exista; no se dibuja otro. La excepción de marca que Sam autorizó para Faro en la
  0637 §7 se extiende a este botón y a la cabecera de su panel; el resto del panel sigue la marca del portal.
  Solo aparece si Faro del cliente está encendido.
- **Bienvenida** la primera vez: «Te mostramos la vista simple… Puedes volver cuando quieras.» Se cierra con
  «Entendido» y no vuelve.
- **Saludo** con el nombre de pila y el Shipping Mark, con una línea que explica para qué sirve.
- **Seis bloques numerados**, cada uno una pregunta del cliente:
  1. **¿Dónde está tu carga?** El envío activo más avanzado: estado en palabras, avance de 5 etapas (el ciclo de la
     SDD-0170), fecha estimada (SDD-0627) marcada como estimada, y los demás envíos en una línea cada uno.
  2. **Lo que te toca hacer.** Tareas abiertas con su botón: documento faltante, saldo por pagar, prealerta. Si no
     hay, lo dice: «No tienes nada pendiente».
  3. **Cuánto debes.** Saldo en USD; bolívares solo como vista, según la regla vigente.
  4. **Tus documentos.** Los últimos papeles con su botón de descarga.
  5. **¿Vas a comprar en China? Envíale esto a tu proveedor.** Resuelve un problema que Sam describió: llegan
     cajas sin el código completo y el cliente pregunta por un «proveedor 5» que nunca registró. Tres pasos:
     - **A · ¿A cuál proveedor le vas a comprar?** La lista de proveedores que el cliente ya registró, cada uno
       con su número y cuántas veces le ha comprado. Si es nuevo, el enlace lleva a registrarlo primero (flujo de
       «Mis compras» de la vista Pro).
     - **B · El código para esa compra**, parte por parte. Al elegir un proveedor, el código cambia a la vista. El
       cliente toca cada parte y lee qué significa, con sus propios datos: «2 · tu proveedor: es Repuestos
       Ejemplo», «2 · la compra: ya le compraste 1 vez; esta es la número 2». El formato es
       `DTD-{cliente}-{proveedor}-{compra}` (`lib/studio/prealertas/types.ts:116-118`) y el próximo código por
       proveedor ya lo calcula `summarizeSuppliers` (`lib/studio/prealertas/types.ts:204-230`).
     - **C · El mensaje listo para copiar**, con la dirección del almacén, quién recibe y ese código. Es el mismo
       texto que hoy arman `components/ChinaSupplierClip.tsx` y `components/AlibabaAddressGuide.tsx` en «Mis
       compras» (`app/portal/(app)/proveedores/SuppliersClient.tsx:120-131`); la vista simple lo reutiliza. Al
       lado, una caja dibujada con el código puesto.
     - **Tutorial del código:** un botón «Ver el tutorial del código (1 minuto)» abre seis pasos con el mismo motor
       de la guía (§6.2): elige al proveedor, «DTD», tu número, el número del proveedor, el número de la compra y
       «mándaselo a tu proveedor».
     - **Atención fija:** «No inventes el número del proveedor. Si escribes "5" y no tienes un proveedor 5 en tu
       lista, no sabremos de quién es la caja.»
     - En pantalla se dice **«Shipping Mark»**, nunca «Markbox» (BRAND.md, BD-022).
     - **Ojo con el código que se copia:** copiar el mensaje no crea la compra. La prealerta se sigue creando con
       «Nueva compra»; el bloque lo dice y enlaza a ese flujo (D-13).
  6. **¿Te quedó una duda?** Faro y el chat con el asesor (SDD-0147).
- **Cada bloque enlaza** a su pantalla de la vista Pro. No hay un tercer nivel.
- **Ayudas:** tres tipos fijos, con ícono y texto visible, nunca tooltip:
  - **Consejo**: un atajo o una recomendación.
  - **Recuerda**: algo que conviene no olvidar (por ejemplo, que la fecha es un estimado).
  - **Atención**: un riesgo real (pagos, plazos, aduana). Se usa poco para que conserve su peso.
- **Glosario en línea:** desplegables con las palabras que el cliente no tiene por qué saber (consolidado, m³,
  packing list, prealerta, aduana). Viven en un archivo de contenido revisado, el mismo que usará Faro del cliente.
- **Copy:** tuteo, voz activa, frases cortas, un verbo por botón. «Contenedor» o «consolidado», nunca «lote».
- **Mientras el seguimiento esté en construcción** (§4.1), el bloque 1 no inventa etapas: muestra lo que sí se
  sabe (prealerta recibida, zarpe y entrega, que salen de operaciones del Studio) y el mismo aviso de hoy, en
  palabras sencillas. La ruta con sus cinco puntos se enciende con el mismo interruptor que apaga ese aviso.
- **Estados ocultos:** el bloque 1 pasa cada estado por `effectiveVisibleStatus` con la lectura estricta de
  ocultos (FC-14). Si la lectura de ocultos falla, el bloque no dibuja la ruta de cinco puntos: muestra la fecha
  estimada y «Ver el detalle en la Vista Pro». Nunca marca ni nombra un hito que el tenant ocultó.
- **Cliente no activado:** ve la pantalla de espera de hoy, también en la Vista simple (D-17).
- **Sin datos nuevos:** todo sale de las lecturas que ya usa el portal (§4.1). La Vista simple no crea usos
  nuevos del cliente de administración: si un bloque necesita un dato que hoy se lee con service_role, llama al
  cargador acotado que ya existe (AC-10).

- **Nada se mueve** (analogía de Sam: el modo simple de un teléfono Android). En la Vista simple:
  - los bloques son siempre los mismos y van siempre en el mismo orden; un bloque sin datos no desaparece: dice
    que no hay nada («No tienes nada pendiente»);
  - no hay avisos que empujen el contenido, ni tarjetas que aparezcan y desaparezcan arriba; lo urgente entra en
    «Lo que te toca hacer»;
  - nada se arrastra ni se reordena: el botón de Faro queda fijo en su esquina (en el Studio se arrastra);
  - pocas acciones y grandes: un botón principal por bloque.

### 6.1 Vista simple y Vista Pro: diferencias y ventajas

Respuesta a la pregunta de Sam. La misma tabla está en la maqueta (botón «Comparar», visible en las dos vistas).

| | Vista simple | Vista Pro |
|---|---|---|
| **Para quién** | Quien empieza, entra de vez en cuando o solo quiere saber de su carga | Quien importa seguido, maneja varios proveedores y ya conoce el portal |
| **Qué se ve** | Una sola página con 6 bloques grandes, siempre los mismos y en el mismo orden | El portal de hoy: menú lateral con envíos, compras, calculadora, finanzas, documentos, referidos, academia y soporte |
| **Qué se hace** | Ver dónde va la carga, lo pendiente, el saldo y los papeles; enviarle el código al proveedor; preguntar | Todo lo de la simple y además crear compras y cotizaciones, registrar proveedores, estado de cuenta, reclamos y perfil |
| **Qué se esconde** | Cotizaciones, estimados, academia, referidos, club, indicadores y próxima salida. Siguen a un toque, en la Vista Pro | Nada |
| **Ventaja** | Se entiende en un minuto; pocos botones y grandes; trae guía, consejos y las palabras explicadas; nada se mueve | Más herramientas y más detalle por pantalla; más rápida para quien ya sabe dónde está cada cosa |
| **Ayuda** | Guía paso a paso, consejos por bloque, tutorial del código y Faro | Faro y el chat con el asesor |
| **Datos** | Los mismos | Los mismos. Cambiar de vista no borra ni mueve nada |

El selector y el botón «Comparar» están en la barra superior de las dos vistas.

### 6.2 Guía para las primeras veces

Pedido de Sam. En la maqueta, botón «Guía» o primera carga.

- **Arranca sola** la primera vez que la persona entra a la vista simple. Se puede saltar («Ahora no») en
  cualquier paso y repetir con el botón «Guía» de la barra superior.
- **Cuatro consejos**: dónde está tu carga, lo que te toca hacer (con el saldo al lado), qué le mandas a tu
  proveedor y Faro. Cada uno resalta su bloque y dice una sola cosa.
- Al terminar pregunta **«¿Quieres continuar?»**: «Sí, 2 consejos más» (cambiar de vista y día o noche) o «Listo
  por ahora».
- El tutorial del código (seis pasos) va aparte y se abre desde su bloque.
- **«Nuevo»:** una etiqueta pequeña marca un bloque que la persona todavía no ha abierto o una función recién
  agregada. Se quita sola al usarla.
- **Dónde se guarda que ya la vio:** en la fila de la persona (`client_users`), junto a la preferencia de vista,
  para que no se repita en otro dispositivo (D-15).
- **Motor:** el de la SDD-0589 trae su catálogo y sus preferencias atados a los roles y textos del Studio (§4.1).
  Se extrae a `lib/shared/` la parte genérica (pasos, anclas, posición de la tarjeta) para que el Studio y el
  portal la usen cada uno con su catálogo. Si extraerla resulta más costoso que escribir un motor pequeño para el
  portal, se escribe el pequeño; se decide al medir en la fase 2.
- Respeta `prefers-reduced-motion`, funciona con teclado (Escape cierra) y en teléfono.

### 6.3 Color y densidad

Pedido de Sam (§1). Vale para la Vista simple; la Vista Pro no cambia.

- **El rojo queda para los errores reales.** En la Vista simple, el vino claro reemplaza al vino en **tres usos**:
  - el relleno del botón principal de cada bloque;
  - el avatar;
  - la parte «proveedor» del código.
  Con texto navy fijo encima (`--on-warning`, `#0F1E3D`, que no se invierte con el tema): 4,79:1 en claro y 7,13:1
  en noche. Con texto blanco mediría 3,44:1 y no pasa
  AA, por eso el texto es navy.
- **La selección no usa vino claro.** El proveedor elegido, la parte del código que se está explicando y el avance de
  la guía van con relleno o contorno de tinta, como fija BD-037 (`BRAND.md:308`, `app/portal/claridad.css:75`).
- **Los enlaces de texto van en navy subrayado.** `--wine-soft` no sirve para texto pequeño (3,44:1 sobre blanco,
  `BRAND.md` §Contraste). El Shipping Mark conserva `--wine-text`, que es regla de marca (BD-026).
- **Más color, sin colores nuevos:**
  - los encabezados de los bloques, las ayudas «Recuerda» y el Shipping Mark llevan un tinte neutro de tinta; solo
    el encabezado del bloque del proveedor lleva tinte de vino claro (identidad);
  - los estados normales («Esperando que llegue a nuestro almacén») van con punto gris, no dorado;
  - el dorado (`--warning`) queda para riesgo real: los avisos «Atención». **El saldo va en navy**, aunque la Vista
    Pro de hoy lo pinte en dorado (`app/portal/(app)/_components/PortalDashboardNorte.tsx:154` y `:513`): un saldo
    sin incidencia no es una advertencia (§3.6). Si una factura vence, ese aviso sí va en dorado. El dorado no va en
    encabezados, ni en «Nuevo», ni en el código;
  - verde (`--success`) solo en confirmaciones reales: «Entregado»;
  - el código, por partes: «DTD» navy, el número de cliente navy claro, el número del proveedor vino claro (el mismo
    de su fila en la lista) y el número de la compra con contorno de tinta.
- **Tokens y mapeos nuevos que se declaran** (no son colores nuevos; son mezclas o reasignaciones de los existentes):
  - tintes de fondo `--tint-ink`, `--tint-wine`, `--tint-ok` y `--tint-warn`: `color-mix` del token de color sobre
    la superficie, con el mismo patrón que `.portal-aviso` (`app/portal/claridad.css:197`);
  - en noche, el relleno de vino claro usa `--color-wine-text` oscuro (`#D89AA4`, `app/globals.css:159`), porque
    `--color-wine-soft` no se redefine en oscuro; el texto encima es siempre `--on-warning`.
  Se definen en el bloque de la Vista simple de `app/globals.css` (fase 2).
- **Legible y táctil:** instrucciones a 15-16 px y controles de 44 px como mínimo (§3.6).
- **Tranquila:** en la Vista simple no hay animaciones continuas (barco, pulso y haz de Faro). El botón de Faro
  conserva el ícono del ERP, quieto.
- **Más compacto:** menos aire entre bloques y dentro de ellos. El bloque del proveedor pasa a filas de una línea
  por proveedor, textos de una frase y el mensaje en tres líneas, con el tutorial como botón en el encabezado.

#### Excepción de marca EXC-0654-01: vino claro en la Vista simple

Registro según VIS-01 §7 y `docs/governance/README.md:108` y `:132` (cambio L3). Formato BRAND-CHECK:

```
BRAND-CHECK
Lo que pidió Sam:        «El rojo siempre llama como si fuera un error: lo cambiamos por un rosado, un vino
                         claro ya probado» (2026-11-17).
Regla que rompe:         BRAND.md:123 (--wine-soft claro «solo sobre fondo oscuro») y VIS-01 §3 (el vino es la
                         acción primaria).
Por qué se acepta:       el vino oscuro se lee como error para el cliente poco técnico; el vino claro es un tono
                         ya probado de la marca y con texto navy pasa AA.
Alternativa que respeta: dejar el botón principal en vino (#7F0F1A) con texto blanco, como la Vista Pro.
```

| Campo | Valor |
|---|---|
| Objetivo | Que la acción principal no se confunda con un error en la vista para clientes nuevos |
| Superficie | Solo la Vista simple del portal. La Vista Pro, el Studio y la web pública no cambian |
| Tokens | `--color-wine-soft` (claro) y `--color-wine-text` (noche) como relleno; texto `--on-warning` (`#0F1E3D`, navy fijo de BD-027, `app/globals.css:105`) en los dos temas. **No** `--color-ink`: en noche vale `#f2f0ec` (`app/globals.css:156`) y crema sobre `#D89AA4` mide 2,03:1 |
| Usos | Botón principal, avatar y parte «proveedor» del código. **No** selección, **no** texto, **no** error |
| Contraste | 4,79:1 en claro y 7,13:1 en noche con texto navy (AC-17) |
| Duración | Hasta la prueba con clientes (D-12). Si funciona, Sam decide si pasa a regla o se extiende |
| Fecha de revisión | 90 días después de encender la Vista simple, o al cerrar la prueba con clientes, lo que ocurra primero |
| Dueño | Sam (aprueba); Director General (custodia del registro) |
| Registro | Una entrada BD nueva en `docs/design/studio/_norte/BRAND-DECISIONS.md` y la regla en `BRAND.md`, en la PR de la fase 2 |
| Estado | **Aprobada por Sam el 2026-11-17** (D-16). El registro en `BRAND-DECISIONS.md` y `BRAND.md` se hace en la PR de la fase 2 |

## 7. Faro del cliente

Un asistente aparte del Faro del Studio. Reutiliza el motor de la 0637 (cliente directo, topes, registro), pero
no su catálogo, su recorte ni su sesión. En IA-01 es nivel **I0**: explica y consulta datos autorizados, sin
proponer ni ejecutar acciones.

### 7.1 Cómo responde

Flujo fijo, sin herramientas que el modelo pueda invocar:

1. El servidor resuelve al cliente con `getPortalClientPrincipal`. Sin principal, no hay Faro.
2. Revisa la cuota (FC-8). Si no hay cupo, responde la plantilla de límite sin llamar al modelo.
3. Clasifica la pregunta: ¿es del portal? Primero reglas en código (palabras de otros clientes, de márgenes,
   órdenes de ignorar instrucciones) y después, si hace falta, un modelo ligero con salida sí/no. Fuera de tema →
   plantilla fija, sin llamada principal.
4. Arma la **ficha del cliente** (§7.2).
5. Llama al modelo con: instrucciones fijas, glosario y guías del portal revisadas, y la ficha como datos JSON.
   **Sin memoria:** cada pregunta se responde sola. El panel muestra la conversación, pero al modelo no se le
   reenvían las preguntas ni las respuestas anteriores (FC-15).
6. El modelo devuelve una ficha de salida forzada: un texto y, si aplica, un destino elegido de una lista cerrada
   («Tus papeles», «Cuánto debes», «Mis envíos»…). El servidor la revisa (FC-7). Si falla, la reemplaza por la
   plantilla de «no puedo responder».
7. Registra (FC-9) y responde. El panel pinta el texto como **texto plano** y arma él mismo el botón del destino.

### 7.2 La ficha del cliente

- **Cómo se lee.** Con los lectores del portal que ya existen, con la sesión del cliente, y **filtrando de forma
  explícita por el `tenant_id` y el Shipping Mark del principal**. La RLS se mantiene como segunda barrera, pero no
  es la frontera: sola no aísla (§4.1).
- **Qué trae** (lista cerrada):
  - envíos: código, servicio, estado **visible** (FC-14) y fecha estimada;
  - facturas emitidas: código, monto, estado; y el saldo;
  - documentos: nombre y tipo, sin el archivo;
  - proveedores: número, nombre y próximo código;
  - tareas abiertas que salen de lo anterior.
- **Qué no trae, y por qué.** Lo que hoy el portal lee con service_role (§4.1) queda **fuera de la ficha** en la
  primera versión, para que la frontera sea simple: Faro nunca usa service_role (FC-13). En concreto:
  - órdenes por aceptar;
  - buque y datos de la naviera;
  - próximo zarpe;
  - contenedor consolidado y packing list;
  - aviso de respuesta nueva en Soporte.
- **Diferencia que el cliente va a notar:** Faro no sabe en qué contenedor ni en qué buque va la carga, ni si hay
  una orden por aceptar. Si le preguntan, responde que ese dato está en el portal y ofrece el destino. La
  alternativa, reutilizar esos cargadores acotados con una excepción explícita por cada uno, queda como D-18.
- **Datos personales mínimos:** nombre de pila; sin apellido, cédula, teléfono, correo ni dirección (FC-11).

### 7.3 Fronteras duras

| # | Frontera | Cómo se cumple | Prueba |
|---|---|---|---|
| FC-1 | Solo datos del cliente que pregunta | La identidad sale de la sesión; el navegador solo manda el texto. Cada lectura de la ficha filtra explícito por `tenant_id` y Shipping Mark del principal, además de la RLS | En Postgres efímero: (a) dos clientes del mismo tenant: la ficha de A nunca trae un código de B; (b) persona mixta, con fila en `user_tenants` y en `client_users`: la ficha trae solo su cliente, no el tenant; (c) el mismo Shipping Mark en dos tenants: solo las filas del tenant del principal |
| FC-2 | Nada del ERP interno | La ficha es una lista cerrada de campos; costos, márgenes, proveedores internos, personal, notas internas y tarifas internas no existen en ella | Prueba de forma: la ficha no tiene claves fuera de la lista |
| FC-3 | Nada de tarifas internas | Faro no calcula ni cotiza; para precios ofrece el destino de la calculadora o de las cotizaciones del cliente | Batería: «¿cuánto me cobras por 2 m³?» → plantilla |
| FC-4 | Solo temas del portal | Clasificador previo (código + modelo ligero) y plantillas de rechazo fijas | Batería de fuera de tema |
| FC-5 | Sin acciones | No hay herramientas. Para cambiar algo, el destino lleva al flujo de la vista Pro o al asesor | Prueba de que el motor no expone herramientas |
| FC-6 | El texto del ERP es dato, no orden | Notas y descripciones viajan como JSON dentro de la ficha; las instrucciones lo declaran | Batería con una descripción de carga que trae una orden inyectada |
| FC-7 | Salida revisada y en texto plano | Se bloquea la respuesta si menciona un código de envío, factura o Shipping Mark que no está en la ficha, si repite las instrucciones, o si trae una URL, una imagen o marcado. El panel no interpreta Markdown ni HTML del modelo; los enlaces los pone el servidor desde la lista cerrada de destinos | Prueba de la revisión con salidas simuladas, incluida una con una imagen cuya URL lleva datos de la ficha |
| FC-8 | Ritmo limitado | Por cliente (en la V1, una persona por cliente: §4.1): N por hora y M por día (D-5); tope de gasto mensual propio; reserva atómica como el AC-18 de la 0637. Si algún día hay varias personas por empresa, el tope se cuenta por `client_id`, no por persona | Simulacro de cupo agotado y de carrera |
| FC-9 | Cada pregunta queda registrada | Tablas propias con `tenant_id` y `client_id`: pregunta depurada, veredicto, resultado, tokens y costo; sin la ficha (§8) | Contrato de la migración |
| FC-10 | Proveedor no chino | Lista permitida por **proveedor y modelo**, para el motor principal, el respaldo y el clasificador. Sin agregadores (OpenRouter y similares): pueden enrutar a un modelo chino. Nunca por la Oficina. Si la configuración apunta fuera de la lista, Faro del cliente no arranca | Prueba que falla con un proveedor, un modelo o un agregador fuera de la lista, en cualquiera de los tres papeles |
| FC-11 | Mínimo de datos al modelo | Nombre de pila, sin apellido, cédula, teléfono, correo ni dirección | Prueba de forma de la ficha |
| FC-12 | Salida a humano | Rechazo, duda o fallo → botón «Escribir a mi asesor» (chat SDD-0147) | Prueba de la plantilla |
| FC-13 | Sin service_role | El código de Faro del cliente no importa ni recibe el cliente de administración | Prueba estática sobre `lib/portal/faro/**` y su ruta, en la línea de la SDD-0383 |
| FC-14 | No revela hitos ocultos | Los estados de la ficha pasan por `effectiveVisibleStatus` con una **lectura estricta** de ocultos: una función nueva, `getHiddenPortalStatusesStrict`, en el mismo archivo que la de hoy, que devuelve `{ ok: true, ocultos }` o `{ ok: false }`. La de hoy (`getHiddenPortalStatusesForPortal`) no cambia: ante error devuelve vacío y muestra todo, que sirve al portal pero no a Faro. Si la lectura estricta falla, la ficha va **sin estados** | Con «en aduana» oculto: ni la ficha ni la respuesta lo nombran. Con la RPC fallando: la ficha no trae estados. Y la función de hoy sigue devolviendo vacío ante error |
| FC-15 | Sin memoria | Al modelo no se le reenvían turnos anteriores | Prueba de que la llamada lleva una sola pregunta |

### 7.4 Plantillas de rechazo

Fijas, escritas por nosotros, sin que el modelo las redacte:

- Otro cliente: «No puedo ver ni compartir datos de otros clientes. Solo veo tu cuenta.»
- Dato interno: «Esa información es interna y no está en tu portal. Si tienes una duda sobre tu precio, tu asesor
  te la explica.»
- Fuera de tema: «Solo te ayudo con tu portal: envíos, pagos, facturas y documentos. ¿Te ayudo con alguno?»
- Acción: «No puedo hacer cambios en tu cuenta. Puedes hacerlo en la vista Pro o pedírselo a tu asesor.»
- Dato que Faro no ve: «Ese dato no lo tengo. Lo ves en tu portal.» y el destino.
- Límite: «Llegaste al límite de preguntas de hoy. Mañana puedes seguir, o escríbele a tu asesor.»
- Fallo: «No puedo responder ahora. Escríbele a tu asesor y te ayuda.»

### 7.5 Gobernanza

Clasificación propuesta frente a las políticas aprobadas (`docs/governance/policies/`). La evidencia se adjunta en
la PR de cada fase; aquí solo se declara qué aplica.

| Política | A qué aplica | Clasificación propuesta |
|---|---|---|
| IA-01 v1.0 | Faro del cliente, nivel I0 | Cumplimiento, a demostrar con su gate: inyección y contexto no confiable (FC-6), permiso y tenant antes de recuperar contexto (FC-1), alucinación de identificadores (FC-7), privacidad (FC-11, §8) y camino manual (FC-12). No aplica: preview, cancelación, doble ejecución y fallo parcial, porque no hay acciones |
| A11Y-01 v1.1 | Selector, guía, comparación, bloque del código y panel de Faro | Cumplimiento, a demostrar en las fases 1 a 3: teclado, foco, nombres accesibles y contraste (§6.3) |
| MOT-01 v1.0 | Guía, barco de la ruta, haz y pulso del botón de Faro | Cumplimiento, a demostrar: respeta `prefers-reduced-motion` y toda animación se puede interrumpir |
| CMP-01 v1.1 | Componentes nuevos del portal | Cumplimiento, a demostrar en la PR de cada componente |
| BTN-01 v1.1 | Botones de la Vista simple | Cumplimiento en jerarquía (un principal por bloque). El color va como excepción (abajo) |
| VIS-01 §3 | Vino claro como acción primaria en la Vista simple | **Excepción** EXC-0654-01 (§6.3). La selección sigue la excepción ya registrada de BD-037 (tinta) |
| VIS-01 §7 | Registro de la excepción | Cumplimiento: BRAND-CHECK con objetivo, superficie, tokens, contraste, duración y fecha de revisión (§6.3) |
| Gobernanza L3 | Excepción con vigencia | Cumplimiento a completar en la fase 2: registro en `BRAND-DECISIONS.md`, dueño, fecha de revisión y alcance (§6.3) |
| `BRAND.md` | Botón y cabecera del panel de Faro, fuera de la marca | **Excepción**, autorizada por Sam en la 0637 §7 y extendida al portal por su pedido del 2026-11-16 |
| `BRAND.md:123` | `--wine-soft` claro como relleno en la Vista simple | **Excepción** EXC-0654-01, aprobada por Sam el 2026-11-17 (§6.3, D-16) |
| BD-037 (`BRAND.md:310`) | Tema claro por defecto en el portal | **Enmienda** de la regla «vista predeterminada en tema oscuro», solo para el Portal, aprobada por Sam el 2026-11-17 (D-14, fase 1b) |

## 8. Datos personales

Revisión según `.claude/skills/revisar-datos-ve/SKILL.md`. En esta fase es un inventario de lo que habrá que
revisar; el reporte formal se hace como puerta antes de la fase 1 (preferencia) y antes del primer envío real a un
modelo.

| Dato | Dónde | Estado |
|---|---|---|
| `client_users.portal_vista` y `portal_guia_vista_at` | Fase 1 | Preferencias, no datos sensibles. Viven en la fila del vínculo y siguen su suerte al revocar o borrar (migraciones 0454 y 0460, SDD-0467 y 0477) |
| Preguntas a Faro del cliente | Fase 3 | Dato personal: el cliente puede escribir su cédula, teléfono o datos de terceros. Se depura antes de enviar y antes de guardar (como E-3 de la 0637) |
| Ficha enviada al modelo | Fase 3 | Datos del cliente a un tercero fuera del país (Anthropic, EE. UU.). Mínimo necesario (FC-11); no se guarda |
| Registro de Faro del cliente | Fase 3 | Retención con plazo (D-6), lectura restringida y auditada (D-19), purga a pedido y al borrar o revocar al cliente |

**Registro de preguntas: quién lo lee y cómo se protege.**

- Tablas nuevas con RLS activa y **sin policies para el cliente**: el cliente no lee el registro por tabla. La
  escritura es solo por RPC `SECURITY DEFINER`.
- Lo lee solo el administrador del tenant, desde el Studio y por una RPC que deja constancia de cada lectura:
  quién, cuándo y de qué cliente (como E-7 de la 0637). Nadie más del equipo (D-19).
- **Borrar o revocar al cliente purga su registro.** Los caminos que ya existen (migración 0454, SDD-0467: borrar un
  cliente revoca su portal; migración 0460, SDD-0477: retención del vínculo revocado) se extienden para borrar
  también las preguntas de ese cliente. Lleva prueba: tras borrar al cliente no queda ninguna fila suya.
- La purga a pedido deja constancia de quién la pidió, sin el texto de las preguntas.

**Transferencia a EE. UU.** Las preguntas y la ficha salen del país hacia el proveedor de IA. Antes de la primera
pregunta, el panel lo dice en una frase y pide aceptación; la aceptación se guarda con la versión del aviso (como
E-4 de la 0637). Sin aceptación, Faro no envía nada (D-20). Si esa aceptación basta como base de licitud es una
pregunta para el abogado: desde el repo es `NO VERIFICABLE`.

Pendientes que la revisión debe resolver antes del primer envío real (`NO VERIFICABLE` hoy, desde el repo):

- La retención de Anthropic para la cuenta que use Faro, por escrito, o cero retención si está disponible.
- Sumar Faro del cliente a la fila de Anthropic en `docs/legal/privacidad/inventario-terceros.md:38`.
- El aviso al cliente en `/privacidad` y en el propio panel: qué ve Faro, que las preguntas se guardan, cuánto
  tiempo, quién las lee y que salen a EE. UU. Texto aprobado por el DG antes de publicarlo.
- Que el clasificador ligero, si es un modelo, también esté en la lista permitida (FC-10).

La regla D-2 de Sam se cumple por diseño (FC-10) y se prueba en CI.

## 9. Fases y allowlist

Cada fase es una PR propia, con su turno del DG. La lista es exacta: un archivo fuera de ella se justifica en la
PR o se saca.

| Fase | Qué | Allowlist | Puerta |
|---|---|---|---|
| 0 | Investigación, maqueta y spec | `docs/specs/0654-version-light-portal/**`, `docs/specs/README.md`, `.agents/handoffs/sdd-0654-version-light-portal.md` | Esta PR. Sam ve la maqueta |
| 1 | Preferencia y selector, con el interruptor apagado | `supabase/migrations/0557_portal_vista_preferida.sql`; `supabase/tests/0557_portal_vista_preferida.test.sql`; `supabase/migrations-baseline.json`, `supabase/migrations.lock.json` y `supabase/pending-migration-symbol-declarations.json`, en lo que exijan sus gates; `lib/portal/vista-preferida.ts` y su prueba (lectura que degrada y llamadas a las RPC); `lib/portal/portal-queries.ts` solo si hace falta exportar un tipo: el `select` del principal (`:82-90`) no se toca; `app/portal/(app)/layout.tsx`; `app/portal/_components/PortalShell.tsx` y `PortalShell.test.tsx` (el armazón recibe la vista, `layout.tsx:90`); `app/portal/_components/PortalTopbar.tsx`; `app/portal/_components/PortalVistaSelector.tsx` y su prueba (nuevos); `app/portal/actions.ts` (dos acciones nuevas junto a las de la barra que ya viven ahí, como `markPortalAvisosSeenAction`) y su prueba nueva `app/portal/__tests__/vista-preferida-actions.test.ts`; `.env.example` e `infra/dtd-cargo/.env.example` (la plantilla del servidor documenta toda variable de la raíz: lo exige `scripts/__tests__/infra-env-example.test.ts`, SDD-0505; agregado en la revisión del DG del 2026-11-17) | Revisión de datos (preferencia). Aplicar la 0557 con OK de Sam y runbook |
| 1b | Tema claro por defecto. Va aparte porque cambia el portal para todos, con o sin interruptor, y enmienda BD-037 | `app/portal/(app)/layout.tsx` (solo la línea del tema, `:54`) y su prueba; `BRAND.md` (la línea «Vista predeterminada» de BD-037, `:310`, aclarando que el Portal abre en claro y el Studio sigue en oscuro); `docs/design/studio/_norte/BRAND-DECISIONS.md` (entrada de la enmienda); **ampliación del DG en la revisión (2026-11-17), solo comentarios:** `app/portal/layout.tsx` (el comentario de `appleWebApp`, que decía que el shell nace en oscuro) y `app/portal/_components/PortalThemeToggle.tsx` (el comentario de cabecera, que decía «cookie o dark») | OK de Sam a la D-14 |
| 2 | Inicio simple, ayudas, glosario, guía y comparación | `app/portal/(app)/page.tsx` (solo el desvío según la vista); `app/portal/(app)/_simple/**` (nuevo); `lib/portal/simple/**` (nuevo: armado de bloques, contenido de ayudas y glosario, y recorridos de la guía); `lib/shared/guia/**` (nuevo, solo si se extrae el motor de la 0589; en ese caso también los archivos de `lib/studio/guia/` que pasen a importarlo, sin cambiar su comportamiento); `components/ChinaSupplierClip.tsx` y `components/AlibabaAddressGuide.tsx` solo si hace falta extraer el texto a una función compartida, sin cambiar lo que muestran; `app/globals.css` solo para los tintes y el mapeo de la Vista simple (§6.3); `BRAND.md` y `docs/design/studio/_norte/BRAND-DECISIONS.md` (registro de EXC-0654-01); `lib/studio/notifications/portal-visibility-queries.ts` (solo la función estricta nueva, si la fase 2 llega antes que la 3) y su prueba; la lista permitida de la SDD-0383 si un bloque reutiliza un cargador que usa service_role; sus pruebas y un e2e del selector. **Ampliación del DG (2026-11-17):** `app/portal/_components/PortalVistaSelector.tsx` y su prueba (aviso de error que se cierra solo o con Escape, «Comparar» junto al selector y, en teléfono, el panel con las dos vistas, «Comparar» y «Guía») y `app/portal/_components/PortalTopbar.tsx` y su prueba nueva (solo el botón «Guía», con la Vista simple y el interruptor encendido; apagado, la barra queda idéntica) | `/ui-check`. Prueba con clientes (D-12). Encender el interruptor con OK de Sam |
| 3 | Faro del cliente con motor simulado | `lib/portal/faro/config.ts`, `ficha.ts`, `clasificador.ts`, `salida.ts`, `plantillas.ts`, `cuota.ts`, `registro.ts`, `motor.ts` y sus pruebas (nuevos); `lib/portal/simple/contenido/**` (guías del portal que lee Faro); `app/api/portal/faro/route.ts` (nuevo); `app/portal/_components/PortalFaroPanel.tsx` y `PortalFaroBoton.tsx` (nuevos); el ícono de Faro del Studio, movido a `components/faro/` si la 0637 ya lo creó; `lib/studio/notifications/portal-visibility-queries.ts` (solo la función estricta nueva de FC-14, sin tocar la de hoy) y su prueba; una migración de registro, cuyo número asigna el DG, con su `.test.sql` y los tres archivos de control de migraciones; las extensiones de purga sobre los caminos de las migraciones 0454 y 0460, en esa misma migración | Depende de la fase 3 de la 0637 (motor y topes). Revisión de datos |
| 4 | Primer envío real | `app/privacidad/page.tsx`; `docs/legal/privacidad/inventario-terceros.md`; `lib/portal/faro/aviso.ts` (texto y versión del aviso del panel); `.env.example` (variables de Faro del cliente). Sin otro código | Revisión de datos aprobada. OK nominal de Sam |
| 5 | Batería adversaria y encendido | `lib/portal/faro/__tests__/bateria/**` | Batería verde; encendido con OK de Sam |

## 10. Criterios de aceptación

| AC | Criterio | Fase |
|---|---|---|
| AC-1 | Con el interruptor apagado, el portal responde igual que antes de la fase 1 para todos: mismo layout y mismo inicio. El tema no entra aquí (fase 1b) | 1 |
| AC-2 | Tras la 0557, toda fila existente de `client_users` está en `pro` y una fila nueva nace en `simple` | 1 |
| AC-3 | Cada RPC cambia solo su columna y `updated_at`, y solo en la fila activa de quien la llama. `client_id`, `tenant_id`, `auth_user_id` y `status` no cambian; otra fila no cambia; `anon`, una persona sin fila activa y una fila revocada no cambian nada | 1 |
| AC-4 | `client_users` sigue sin `grant update` y sin policies de escritura (prueba de catálogo) | 1 |
| AC-5 | Sin la columna (migración sin aplicar), o si la lectura de la preferencia falla, el portal funciona, nadie es enviado a `/entrar` y la vista es `pro` | 1 |
| AC-6 | El selector funciona en las dos vistas y la elección persiste entre dispositivos | 1 |
| AC-7 | Sin cookie de tema, el portal abre en claro; quien ya eligió noche lo conserva | 1b |
| AC-8 | El inicio simple muestra los seis bloques, los mismos y en el mismo orden con y sin datos, con un estado vacío que enseña en cada uno. Se prueba con una cuenta vacía y una con datos | 2 |
| AC-9 | Cada bloque enlaza a su pantalla de la vista Pro | 2 |
| AC-10 | La Vista simple no crea usos nuevos del cliente de administración. Si un bloque necesita un dato que hoy se lee con service_role, llama al cargador acotado que ya existe y la lista permitida de la SDD-0383 se cambia de forma explícita en la PR | 2 |
| AC-11 | Con un hito oculto por el tenant (SDD-0156), el bloque 1 no lo marca ni lo nombra; si la lectura estricta de ocultos falla, no dibuja la ruta | 2 |
| AC-12 | Con el seguimiento en construcción, el bloque 1 no muestra etapas que el sistema no conoce | 2 |
| AC-13 | El bloque del proveedor muestra la misma dirección y el mismo texto que «Mis compras», y el mismo próximo código por proveedor que calcula `summarizeSuppliers`; una prueba compara las salidas | 2 |
| AC-14 | El bloque solo ofrece números de proveedor que existen en la cuenta del cliente; no hay campo para escribir uno a mano; junto a «Copiar» dice que copiar no registra la compra | 2 |
| AC-15 | La guía (4 consejos y 2 opcionales) arranca sola solo la primera vez, se puede saltar y se repite con el botón «Guía»; sus diálogos contienen el foco y se cierran con Escape | 2 |
| AC-16 | El botón «Comparar» abre la comparación de §6.1 desde las dos vistas; en teléfono se apila sin desplazamiento lateral | 2 |
| AC-17 | En la Vista simple el vino claro solo aparece en sus tres usos (botón principal, avatar y parte «proveedor» del código); la selección va en tinta; el dorado solo en riesgo real; ningún relleno ni texto usa `--color-wine` ni `--danger` fuera de un error; cada par de color pasa AA | 2 |
| AC-18 | Un cliente no activado ve lo que fije la D-17, en las dos vistas, y la guía no arranca | 2 |
| AC-19 | Cada frontera FC-1 a FC-15 tiene su prueba y pasa | 3 |
| AC-20 | Un fallo de aislamiento pone roja la CI, en los tres casos de FC-1: dos clientes, persona mixta y mismo Shipping Mark en dos tenants | 3 |
| AC-21 | El botón de Faro usa el mismo ícono y el mismo componente en el Studio y en el portal | 3 |
| AC-22 | El registro de preguntas tiene RLS sin policies para el cliente, su lectura por el equipo queda auditada, y borrar o revocar al cliente lo purga | 3 |
| AC-23 | Existe la revisión `revisar-datos-ve` aprobada, y el aviso con aceptación de la D-20, antes del primer envío real | 4 |
| AC-24 | La batería tiene preguntas permitidas y rechazadas, en español y en inglés, y mide también el rechazo de preguntas legítimas | 5 |
| AC-25 | El gate de IA-01 para nivel I0 está cubierto y enlazado desde la PR (§7.5) | 5 |
| AC-26 | EXC-0654-01 queda registrada en `BRAND-DECISIONS.md` y `BRAND.md` con objetivo, superficie, tokens, contraste, duración, fecha de revisión y dueño, antes de fusionar la fase 2 | 2 |

## 11. Decisiones de Sam

**Todas decididas, con la opción recomendada.**

- D-4 y D-10: el 2026-11-16, en la sesión del Worker (§1).
- D-1 a D-3, D-5 a D-9 y D-11 a D-20: el 2026-11-17, en el chat del Director General. A la pregunta «¿Apruebas las
  decisiones recomendadas de nómina (#631) y de la Vista simple (#633)?», Sam respondió: «Sí, ambas».

Con eso quedan aprobadas también EXC-0654-01 (D-16, §6.3) y la enmienda de BD-037 solo para el Portal (D-14). La
columna «Recomendación» es lo que quedó decidido.

| D | Pregunta | Recomendación (decidida) |
|---|---|---|
| D-1 | ¿La preferencia es por persona o por empresa cliente? | **En la V1 son lo mismo:** hay una sola persona de portal por cliente (`0080_portal_cliente.sql:29`). La preferencia vive en esa fila. Permitir varias personas por empresa no entra en esta spec; si se quiere, es una decisión y una spec aparte |
| D-2 | ¿Con qué vista empieza cada uno? | **Cliente nuevo en simple; los actuales en Pro**, para que nadie vea un cambio sin pedirlo |
| D-3 | ¿Dónde va el selector? | **En la barra superior**, visible en las dos vistas, con los nombres «Vista simple» y «Vista Pro» |
| D-4 | ¿Faro del cliente aparece en las dos vistas o solo en la simple? | **Decidida por Sam (2026-11-16): en las dos, con el mismo ícono del faro del ERP** |
| D-5 | ¿Cuántas preguntas? | **20 por día y 5 por hora por cliente**, con tope de gasto mensual propio, separado del Faro del Studio. Sam fija los montos |
| D-6 | ¿Cuánto tiempo se guardan las preguntas? | **90 días** y purga a pedido del cliente, con constancia |
| D-7 | ¿Qué pasa cuando Faro no puede responder? | **Botón al chat con el asesor** que ya existe (SDD-0147). Sin crear tickets automáticos |
| D-8 | ¿Qué proveedor de IA? | **Anthropic directo y sin respaldo en la primera versión.** Nunca un proveedor chino, un agregador ni la Oficina. Es **más estricta** que la D-1 de la 0637 (que admite un respaldo no chino y sigue abierta). Si Sam decide allá un respaldo, esta se revisa |
| D-9 | ¿En qué orden? | **Vista simple primero (fases 1, 1b y 2) y Faro del cliente después** de la fase 3 de la 0637, para no escribir dos motores |
| D-10 | ¿Cómo se llama en pantalla? | **Decidida por Sam (2026-11-16): «Vista simple» y «Vista Pro».** En el código, `simple` y `pro`; «light» no se usa porque ya es el tema claro |
| D-11 | ¿Faro del cliente puede hablar de precios? | **No en la primera versión.** Para precios ofrece la calculadora y las cotizaciones del cliente |
| D-12 | ¿Probamos con clientes antes de que sea el inicio de los nuevos? | **Sí: 5 clientes en dos rondas.** Que expliquen con sus palabras el estado de su carga y encuentren un documento. Después se enciende |
| D-13 | ¿El bloque del proveedor muestra el código de la próxima compra o solo el Shipping Mark? | **El código completo de la próxima compra del proveedor que el cliente elija.** Sin proveedores registrados, solo su Shipping Mark y el enlace para registrar al primero. Copiar el mensaje no crea la compra: después de copiar, el bloque ofrece «Avisar esta compra» (el flujo de prealerta que ya existe) |
| D-14 | ¿El portal abre en claro para todos? | **Sí, como pidió Sam, y solo en el Portal.** Es una **enmienda de BD-037** («vista predeterminada: compacta y en tema oscuro», `BRAND.md:310`); el Studio sigue en oscuro. Quien ya eligió noche con el botón lo conserva. Va en su propia fase (1b) porque cambia el portal de todos los clientes, también en la vista Pro y con el interruptor apagado |
| D-15 | ¿Cuántas veces sale sola la guía? | **Una vez por persona**, guardado en su cuenta. Después, solo con el botón «Guía». La etiqueta «Nuevo» avisa de lo que se agregue más adelante |
| D-16 | ¿Aprobamos la excepción del vino claro? | **Sí, como EXC-0654-01 (§6.3):** solo en la Vista simple y solo en botón principal, avatar y parte «proveedor» del código; la selección sigue en tinta. Revisión a los 90 días o al cerrar la prueba con clientes. La Vista Pro sigue con el vino de hoy |
| D-17 | ¿Qué ve en la Vista simple un cliente nuevo que todavía no está activado? | **La misma pantalla de espera de hoy**, en las dos vistas, y la guía no arranca hasta que la cuenta esté activada. La alternativa es sumarle a esa pantalla el bloque «Envíale esto a tu proveedor», porque ya tiene Shipping Mark |
| D-18 | ¿Faro del cliente puede usar los datos que hoy el portal lee con permisos de servidor (contenedor, buque, próximo zarpe, órdenes por aceptar)? | **No en la primera versión.** Faro no sabrá en qué contenedor ni en qué buque va la carga y remitirá al portal. La alternativa es reutilizar esos cargadores acotados, con una excepción explícita y una prueba por cada uno |
| D-19 | ¿Quién del equipo puede leer las preguntas de los clientes? | **Solo el administrador**, desde el Studio, y cada lectura queda registrada |
| D-20 | ¿El cliente acepta un aviso antes de su primera pregunta? | **Sí.** Una frase: qué ve Faro, que la pregunta se guarda y que sale a un proveedor en EE. UU. Sin aceptar, Faro no envía nada. El texto lo revisa el abogado |

## 12. Riesgos

| Riesgo | Mitigación |
|---|---|
| La vista simple oculta algo que el cliente necesita | Cada bloque enlaza a la Pro; prueba con clientes (D-12) |
| El bloque «¿Dónde está tu carga?» promete más de lo que el sistema sabe | Mientras el seguimiento esté en construcción, el bloque muestra solo lo conocido (§6, AC-12). La vista simple luce completa cuando el almacén registre en el sistema |
| El botón de Faro y el de la calculadora flotan en la misma esquina | En la maqueta van apilados. Se resuelve junto con la D-2 de la 0637 (un solo elemento flotante) |
| Tono condescendiente | Ayudas opcionales, cortas, sin repetir lo obvio; bienvenida que se cierra |
| Dos vistas que mantener | La simple no tiene pantallas propias más allá del inicio; reutiliza lecturas y enlaza al resto |
| Faro filtra datos de otro cliente | Filtro explícito por tenant y Shipping Mark (FC-1), sin service_role (FC-13), revisión de salida (FC-7) y prueba que pone roja la CI (AC-20) |
| Faro o el bloque 1 revelan un hito que el tenant ocultó | Estado visible en los dos (FC-14, AC-11) |
| Fuga de datos por una URL o imagen en la respuesta | Salida en texto plano, sin enlaces ni imágenes del modelo (FC-7) |
| La fase 1 se fusiona antes de aplicar la 0557 y deja a los clientes fuera | La preferencia se lee aparte y degrada a `pro` (§5, AC-5) |
| Inyección desde textos del ERP | FC-6 y batería con orden inyectada |
| Costo | Cuota por cliente, tope mensual, plantillas sin llamada al modelo |
| Confusión con el tema claro | Nombres «simple/pro» en código y pantalla (D-10) |
| La excepción del vino claro se extiende sin control | Alcance escrito de tres usos, fecha de revisión y registro L3 (EXC-0654-01, AC-26) |

## 13. Fuentes

Las URL de §3. Medición del código en §4, sobre `27a8027eb`.

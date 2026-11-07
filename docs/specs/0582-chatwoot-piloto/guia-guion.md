# Guion de la guía «Antes en Kommo → Ahora aquí» — SDD-0582, paso 9.1

Guion de la guía interactiva de E9 (decisión K de la [spec](spec.md)). Fija qué dice cada tarjeta, dónde se ancla, quién la ve y con qué clave de i18n. Los pasos 9.2–9.5 construyen el motor y los recorridos a partir de este texto; el paso 8.1 lo usa para la capacitación.

**Estado:** borrador para el OK de Sam. Las pantallas de Chatwoot y de Studio **todavía no existen**: «Ahora aquí» describe lo que dice la spec, no algo medido.

## Cómo leer este guion

- **Etiquetas** (las del [registro E0](investigacion-2026-10-29-e0.md)):
  - **T**: leído en la cuenta de Kommo (filas K-13 a K-22);
  - **D(doc, fecha)**: lo dice un documento interno del repo, no está medido hoy;
  - **C**: el código actual lo tiene;
  - **I**: inferencia;
  - **NV**: no verificado.
- **«Antes en Kommo»** lleva la ruta de clics real cuando el inventario la tiene. El inventario de 0.4 midió la configuración, no el trabajo diario: las rutas de chats, contactos, notas y tareas **no están medidas** y van como NV. Se confirman con la persona que atiende (preguntas al final).
- **«Ahora aquí»** lleva entre paréntesis el paso del checklist del que depende. Todo lo que depende de E2, E6 o E7 va marcado **NV (E2)**, **NV (E6)** o **NV (E7)**. Lo de E3, E4 y E5 también va con NV y su etapa, porque tampoco existe.
- **Roles** (E0-D2): **Admin** es Sam; **Agente** es la persona que atiende, que ve y contesta todas las bandejas. **Todos** son los dos. Qué rol de Studio corresponde a «Agente» lo fija la matriz de 2.7 (NV).
- **Ningún texto usa datos de clientes.** Los ejemplos de las tarjetas son genéricos y las capturas de la capacitación se toman con datos sintéticos.

## Tono de las tarjetas

Sigue el apartado de tono de `BRAND.md`:
- español venezolano neutro, con tuteo y sin voseo;
- verbos directos («Contesta», «Busca», «Asigna»);
- sin emoji ni signos de exclamación;
- texto alineado a la izquierda.

Tarjeta pequeña (9.2): título de hasta 40 caracteres y cada campo de hasta unos 140. Si un texto no cabe, se corta el texto, no se agranda la tarjeta.

## Claves de i18n

El formato sigue `lib/i18n/es-VE/*.ts`: claves planas `<dominio>.<área>.<concepto>` en `snake_case`. Se propone un dominio nuevo, `guide`, en `lib/i18n/es-VE/guide.ts`, con su gemelo en `lib/i18n/zh-CN/guide.ts` (el tipo `I18nKey` exige las mismas claves en los dos idiomas) y su entrada en `lib/i18n/dict.ts`. Lo crea 9.2; este paso no toca código.

Cada tarjeta tiene una clave base. De ella salen cuatro claves:

| Sufijo | Contenido |
|---|---|
| `.title` | Título de la tarjeta |
| `.what` | «Qué es» |
| `.before` | «Antes en Kommo» |
| `.now` | «Ahora aquí» |

Ejemplo: la tarjeta `guide.inbox.reply` da `guide.inbox.reply.title`, `guide.inbox.reply.what`, `guide.inbox.reply.before` y `guide.inbox.reply.now`.

Las etiquetas de evidencia (T, D, NV…) **no van a la pantalla**: son para la revisión de este guion.

## Anclas `data-guia`

- Formato: `<pantalla>.<elemento>`, en minúsculas y con guiones dentro de cada parte (`bandeja.nota-privada`).
- **En Studio**, el ancla es un atributo `data-guia` en el elemento (9.2).
- **Dentro de Chatwoot** no se puede poner `data-guia` en su HTML. Ahí el mismo nombre es la clave del archivo de selectores de 9.4, que traduce `bandeja.composer` al selector real de Chatwoot. Esas tarjetas van marcadas «(Chatwoot)».
- Si el selector de Chatwoot no aparece (por ejemplo, tras una actualización), la tarjeta se ancla al marco de la bandeja, `data-guia="bandeja.marco"`, y el smoke de 9.4 lo reporta.
- Si 2.1 decide abrir Chatwoot en una pestaña aparte, las tarjetas «(Chatwoot)» se muestran allí por el script de `DASHBOARD_SCRIPTS`, no en Studio.

## Tareas que cubre

| Tarea diaria | Tarjetas |
|---|---|
| Contestar WhatsApp y correo | B1, B2 |
| Buscar un contacto y ver su historial | B3, F3 |
| Asignar | B4 |
| Plantillas | B5 |
| Notas | B6 |
| Mover un lead de etapa | E2 |
| Tareas | E3 |
| Encender o apagar la IA | I1 |
| Copiar la sugerencia | I2, I3 |

## Controles de la guía (todas las pantallas)

No son un recorrido: son los textos del motor (9.2 y 9.3).

| Ancla | Clave | Texto propuesto | Rol |
|---|---|---|---|
| `chrome.boton-guia` | `guide.chrome.toggle` | Guía | Todos |
| — | `guide.chrome.toggle_on_aria` | Mostrar la guía de esta pantalla | Todos |
| — | `guide.chrome.toggle_off_aria` | Ocultar la guía | Todos |
| — | `guide.chrome.welcome.title` | Así se hace ahora lo que hacías en Kommo | Todos |
| — | `guide.chrome.welcome.body` | Te mostramos cada tarea en pocos pasos. Puedes cerrarla cuando quieras y volver con el botón «Guía». | Todos |
| — | `guide.chrome.next` | Siguiente | Todos |
| — | `guide.chrome.prev` | Anterior | Todos |
| — | `guide.chrome.close` | Cerrar | Todos |
| — | `guide.chrome.step_of` | {n} de {total} | Todos |
| — | `guide.chrome.label_before` | Antes en Kommo | Todos |
| — | `guide.chrome.label_now` | Ahora aquí | Todos |
| — | `guide.chrome.dont_show` | No volver a mostrar | Todos |
| — | `guide.chrome.resume` | Seguir donde quedaste | Todos |
| — | `guide.chrome.restart` | Ver la guía desde el principio | Todos |
| — | `guide.chrome.missing_target` | Esta parte cambió de lugar. Sigue con el próximo paso. | Todos |

La primera vez que alguien entra a una pantalla con recorrido, la guía arranca sola en la tarjeta 1 (9.3). «No volver a mostrar» apaga el arranque automático de esa pantalla, pero no el botón.

## Recorrido 1 · Bandeja

Clave del recorrido: `guide.inbox`. Pantalla: Studio → Bandeja, con el panel de Chatwoot adentro (decisión A). Lo ven: **Todos**.

### B1 · Contestar un WhatsApp

- **Ancla:** `bandeja.composer` (Chatwoot)
- **Rol:** Todos
- **Clave:** `guide.inbox.reply`
- **Qué es:** «Aquí llegan juntos WhatsApp, Instagram, Messenger y correo. Abres la conversación y contestas abajo.»
- **Antes en Kommo:** «Abrías el chat del lead en Kommo y escribías ahí.» Ruta de clics: **NV** (no está en el inventario de 0.4). Que WhatsApp, Instagram y Messenger llegaban por Kommo: C (M-2).
- **Ahora aquí:** «Entra a Bandeja, elige la conversación, escribe abajo y pulsa Enviar. El cliente lo recibe en el mismo número de siempre.» **NV (E2: 2.1, 2.2; E4: 4.5).** El número se comparte, no se migra (decisión B).

### B2 · Contestar un correo

- **Ancla:** `bandeja.filtro-canal` (Chatwoot)
- **Rol:** Todos
- **Clave:** `guide.inbox.email`
- **Qué es:** «El correo de la empresa entra como una conversación más, con su hilo y sus adjuntos.»
- **Antes en Kommo:** «El correo no pasaba por Kommo: se contestaba aparte, en el correo de Hostinger.» I: Kommo no tiene integración de correo (K-18, T) y el buzón vive en Hostinger (C-2 y C-10, T). Quién lo contesta y desde dónde: **NV**.
- **Ahora aquí:** «Filtra por Correo o abre la conversación. Tu respuesta sale desde la dirección de la empresa y queda en el mismo hilo.» **NV (E4: 4.8).** Si responder como `info@` falla, la salida está escrita en el registro E0 (consecuencias de 0.5).

### B3 · Buscar un contacto y ver su historial

- **Ancla:** `bandeja.buscar` (Chatwoot)
- **Rol:** Todos
- **Clave:** `guide.inbox.search`
- **Qué es:** «Busca por nombre, teléfono o correo. Ves todas sus conversaciones, también las de Kommo.»
- **Antes en Kommo:** «Buscabas el contacto en Kommo y abrías su lead para ver el chat.» Ruta de clics: **NV**.
- **Ahora aquí:** «Escribe en el buscador y abre el contacto. Lo que hablaste en Kommo está en la bandeja "Archivo Kommo", con su fecha y su autor.» **NV (E2: 2.2; E5: 5.5).** La carga de E5 conserva autor, fecha y adjuntos (X-13, R); algunos adjuntos viejos pueden faltar (K-22, I).

### B4 · Asignar una conversación

- **Ancla:** `bandeja.asignar` (Chatwoot)
- **Rol:** Admin y Agente. S-2 contestada (Sam, 2026-11-07 07:00Z): «También quien atiende». En Studio son `admin`, `commercial` y `support`, los roles del módulo Bandeja; el permiso real de asignar lo da Chatwoot.
- **Clave:** `guide.inbox.assign`
- **Qué es:** «Cada conversación tiene un responsable. Así nadie contesta dos veces lo mismo.»
- **Antes en Kommo:** «En Kommo el responsable era el "usuario responsable" del lead.» D(`docs/marketing/agentes-ia-por-etapa.md:349`, 2026-08): «Cambiar el usuario responsable del lead» es una acción de automatización. Ruta manual: **NV**.
- **Ahora aquí:** «En la conversación, pulsa Asignar y elige a la persona. Te puedes asignar tú.» **NV (E2: 2.7).** Los permisos por bandeja o por equipo son de Chatwoot CE (decisión I).

### B5 · Enviar una plantilla

- **Ancla:** `bandeja.plantillas` (Chatwoot)
- **Rol:** Todos
- **Clave:** `guide.inbox.templates`
- **Qué es:** «Si el cliente lleva más de 24 horas sin escribir, WhatsApp solo deja mandar una plantilla aprobada.»
- **Antes en Kommo:** «Las plantillas estaban en Kommo, en Automatizaciones → Plantillas.» T (K-19): 7 plantillas, 5 de WhatsApp aprobadas en la WABA. Cómo se mandaban desde el chat: **NV**.
- **Ahora aquí:** «En el chat, abre Plantillas, elige una y completa lo que pide. Tienen el mismo texto que las de Kommo.» **NV (E4: 4.3, 4.5).** Las 5 de Kommo se recrean y se aprueban en la cuenta de mensajes propia de Chatwoot (decisión B, actualizada el 2026-10-29); el mismo texto se comprueba en 4.5.

### B6 · Dejar una nota

- **Ancla:** `bandeja.nota-privada` (Chatwoot)
- **Rol:** Todos
- **Clave:** `guide.inbox.note`
- **Qué es:** «Una nota privada es para el equipo. El cliente no la ve.»
- **Antes en Kommo:** «Escribías la nota en el lead de Kommo.» Ruta de clics: **NV**. Que el ERP recibía notas de leads por un webhook de terceros: D(K-9, 2026-08-24).
- **Ahora aquí:** «Cambia de Responder a Nota privada, escribe y guarda. Queda en la conversación, marcada como interna.» **NV (E2: 2.2).** La respuesta sugerida de la IA también llega como nota privada (I2).

## Recorrido 2 · Embudo

Clave del recorrido: `guide.pipeline`. Pantalla: Studio → Embudo (tablero propio de 6.3). Lo ven: **Todos**. Todo el recorrido es **NV (E6)**: el modelo y las etapas los fija 6.1.

### E1 · El tablero

- **Ancla:** `embudo.tablero`
- **Rol:** Todos
- **Clave:** `guide.pipeline.board`
- **Qué es:** «Cada tarjeta es un lead. Cada columna es una etapa de la venta.»
- **Antes en Kommo:** «Era el embudo "Ventas DTD" de Kommo.» D(`docs/marketing/kommo-estado-y-pendientes.md:6`, 2026-08-10). Etapas en ese momento: Leads entrantes, Contacto inicial, Recontacto, Estimado enviado, Negociación, Logrado con éxito y Ventas perdidos, D(`docs/runbooks/kommo-consolidacion-embudo-unico.md:20`, 2026-08). Ruta de clics: **NV**.
- **Ahora aquí:** «Entra a Embudo en el menú de Studio. Las etapas son las de DTD y los leads ya vienen de Kommo.» **NV (E6: 6.1, 6.3, 6.5).**

### E2 · Mover un lead de etapa

- **Ancla:** `embudo.tarjeta`
- **Rol:** Todos (pregunta P-5)
- **Clave:** `guide.pipeline.move`
- **Qué es:** «Cuando la venta avanza, el lead pasa a la etapa siguiente.»
- **Antes en Kommo:** «Arrastrabas la tarjeta a otra columna en Kommo, o cambiabas la etapa desde CRM en Studio.» Ruta de clics en Kommo: **NV**. Desde Studio: C, el tablero CRM tiene un control de etapa que escribe en Kommo (`app/studio/(app)/crm/_components/StageControl.tsx` y `lib/studio/kommo-writeback`). Hubo un bloqueo para mover leads cuando las licencias no cuadraban: D(`docs/marketing/kommo-estado-y-pendientes.md:15-27`, 2026-08-10).
- **Ahora aquí:** «Arrastra la tarjeta o cambia la etapa en la ficha del lead. Algunas etapas cambian solas, como cuando sale una cotización.» **NV (E6: 6.3, 6.6).**

### E3 · Tareas

- **Ancla:** `embudo.tareas`
- **Rol:** Todos
- **Clave:** `guide.pipeline.tasks`
- **Qué es:** «Una tarea te recuerda qué hacer con un lead y para cuándo.»
- **Antes en Kommo:** «Las tareas vivían en el lead. El bot "Ping 23 h" creaba una cuando un chat se iba a cerrar.» Ruta de clics: **NV**. El Ping 23 h: D(K-4, 2026-08-13); hoy los 15 Salesbots están apagados (K-13, T).
- **Ahora aquí:** «Crea la tarea en la ficha del lead. Studio te avisa de los leads sin atender y de los chats a punto de pasar las 24 horas.» **NV (E6: 6.3, 6.6, 6.7).**

### E4 · Leads nuevos

- **Ancla:** `embudo.columna-entrada`
- **Rol:** Todos
- **Clave:** `guide.pipeline.incoming`
- **Qué es:** «Los leads nuevos entran solos desde los chats y la web, con el canal de donde vinieron.»
- **Antes en Kommo:** «Caían en "Leads entrantes" de Kommo.» D(`docs/runbooks/kommo-consolidacion-embudo-unico.md:20`, 2026-08). Fuentes de leads: matriz de paridad de 0.4 (`e0-guias.md#04`).
- **Ahora aquí:** «Aparecen en la primera columna. Ábrelos, contesta y muévelos cuando avancen.» **NV (E6: 6.4).**

## Recorrido 3 · Ficha DTD

Clave del recorrido: `guide.dtdcard`. Pantallas: el panel «Ficha DTD» junto a la conversación (Dashboard App de 2.4) y la tarjeta de conversaciones en la ficha del cliente de Studio (2.3). Lo ven: **Todos**.

### F1 · Qué es la Ficha DTD

- **Ancla:** `ficha.panel` (Chatwoot, Dashboard App)
- **Rol:** Todos
- **Clave:** `guide.dtdcard.panel`
- **Qué es:** «Junto al chat ves quién es el cliente para DTD: sus datos, embarques y cotizaciones.»
- **Antes en Kommo:** «Para ver un embarque tenías que salir de Kommo y buscarlo en Studio.» I: la integración del ERP en Kommo («CRM a DTDCARGO.COM», K-18, T) sincroniza leads y contactos (K-8, C); que no muestre embarques dentro de Kommo es **NV**.
- **Ahora aquí:** «Abre la pestaña Ficha DTD a la derecha de la conversación. No tienes que salir del chat.» **NV (E2: 2.4).**

### F2 · Contacto sin cliente

- **Ancla:** `ficha.vincular` (Chatwoot, Dashboard App)
- **Rol:** pregunta S-8
- **Clave:** `guide.dtdcard.link`
- **Qué es:** «Si el contacto todavía no es cliente de DTD, la ficha te lo dice.»
- **Antes en Kommo:** «El ERP unía el cliente con Kommo por su ID de Kommo.» C: 2 columnas Kommo en `clients` (K-8). Lo que veía la persona: **NV**.
- **Ahora aquí:** «La ficha lo une por teléfono o correo. Si no lo encuentra, puedes buscar al cliente o dejarlo como lead.» **NV (E2: 2.4; E5: 5.4).** La spec no define el botón de vincular: pregunta S-8.

### F3 · Las conversaciones en la ficha del cliente

- **Ancla:** `cliente.conversaciones`
- **Rol:** Todos
- **Clave:** `guide.dtdcard.client_tab`
- **Qué es:** «En la ficha del cliente de Studio ves sus conversaciones y cuántas están sin leer.»
- **Antes en Kommo:** «En Studio, CRM mostraba una copia del tablero de Kommo.» C: `app/studio/(app)/crm/page.tsx:2` («Tablero CRM Kommo», SDD-0078); se quita en 8.10.
- **Ahora aquí:** «Abre Clientes, entra al cliente y mira la tarjeta Conversaciones. Un clic te lleva al chat.» **NV (E2: 2.3).**

### F4 · Avisos de mensajes nuevos

- **Ancla:** `chrome.contador-bandeja`
- **Rol:** Todos
- **Clave:** `guide.dtdcard.unread`
- **Qué es:** «El número junto a Bandeja son los chats sin leer. También te llega un aviso.»
- **Antes en Kommo:** «Los avisos llegaban por Kommo.» Ruta y forma: **NV** (pregunta P-7).
- **Ahora aquí:** «Mira el número en el menú de Studio. Si tienes los avisos activos, te llega uno con cada mensaje nuevo.» **NV (E2: 2.3).**

## Recorrido 4 · IA

Clave del recorrido: `guide.ai`. Pantallas: el interruptor de modos (7.7) y la respuesta sugerida (7.8). Lo ven: **Todos**, salvo I1 (pregunta S-1). Todo el recorrido es **NV (E7)**.

### I1 · Encender o apagar la IA

- **Ancla:** `ia.interruptor`
- **Rol:** Admin (propuesto; pregunta S-1). El Agente ve el estado, no lo cambia.
- **Clave:** `guide.ai.toggle`
- **Qué es:** «La IA tiene tres modos por bandeja: Apagado, Sugerir y Contesta solo.»
- **Antes en Kommo:** «Encendías o apagabas cada agente en Kommo, en Agente de IA.» T (K-14): 4 agentes, todos apagados desde el 15.10.2026.
- **Ahora aquí:** «Elige el modo de cada bandeja. Por ahora solo hay Apagado y Sugerir: Contesta solo se abre cuando se apruebe.» **NV (E7: 7.7; puerta 7.2).** Si el gasto llega al tope del mes, la IA se apaga sola y pasa a una persona (E0-D3).

### I2 · La respuesta sugerida

- **Ancla:** `ficha.sugerencia` (Chatwoot, Dashboard App)
- **Rol:** Todos
- **Clave:** `guide.ai.suggestion`
- **Qué es:** «En modo Sugerir, la IA escribe una propuesta de respuesta. No se la manda al cliente.»
- **Antes en Kommo:** «Kommo tenía "Respuesta sugerida de IA", en Ajustes → Configuraciones de IA.» T (K-15): está apagada.
- **Ahora aquí:** «La sugerencia aparece como nota privada en el chat y en la Ficha DTD, con un botón Copiar.» **NV (E7: 7.8).**

### I3 · Copiar o ignorar

- **Ancla:** `ficha.copiar` (Chatwoot, Dashboard App)
- **Rol:** Todos
- **Clave:** `guide.ai.copy`
- **Qué es:** «Tú decides: copias la sugerencia, la cambias o la ignoras.»
- **Antes en Kommo:** No aplica: la respuesta sugerida estaba apagada (K-15, T). Si alguna vez se usó: **NV** (pregunta P-6).
- **Ahora aquí:** «Pulsa Copiar, pégala abajo, ajústala y envía. Si escribes tú primero, la sugerencia se descarta.» **NV (E7: 7.6, 7.8).**

### I4 · Lo que la IA no hace

- **Ancla:** `ia.limites`
- **Rol:** Todos
- **Clave:** `guide.ai.limits`
- **Qué es:** «La IA no promete precios ni plazos por su cuenta. Eso lo contesta una persona.»
- **Antes en Kommo:** «Los agentes de Kommo usaban sus créditos y su base de conocimiento.» T (K-14, K-16): 7 fuentes de conocimiento; el paquete de créditos está vencido (E0-D5).
- **Ahora aquí:** «Si el cliente pide un compromiso, un cambio de datos o un monto fuera de la tarifa publicada, la IA te pasa la conversación.» **NV (E7: 7.4, 7.6).** Regla de `instrucciones-ia.md` (Bot).

## Recorrido 5 · Usuarios (solo admin)

Clave del recorrido: `guide.users`. Pantalla: Studio → Usuarios (el módulo existe, C: `app/studio/(app)/usuarios`), con el acceso a la Bandeja que agrega 2.5. Lo ve: **Admin**.

### U1 · Dar acceso a la Bandeja

- **Ancla:** `usuarios.acceso-bandeja`
- **Rol:** Admin
- **Clave:** `guide.users.grant`
- **Qué es:** «Desde Vínculos decides quién entra a la Bandeja. No hay que crear la cuenta dos veces.»
- **Antes en Kommo:** «Los usuarios se creaban en Kommo, en Ajustes → Gestión de usuarios, y cada uno gastaba una licencia.» T (K-17): 5 usuarios y 1 licencia paga.
- **Ahora aquí:** «Invita a la persona en Usuarios y vincúlala aquí. Studio le crea la cuenta en el chat.» **NV (E2: 2.5, 2.7).**
- **Aprobado:** Sam, 2026-11-07 07:02Z: «Apruebo los dos». Cambian «Qué es» y «Ahora aquí», con el texto de la propuesta de SDD-0589 (9.5): el acceso se da en Bandeja › Vínculos, no en Usuarios. Huellas (sha256 del texto entre « », 16 caracteres): `d5654c7bab073a82` y `ceae585ea7ba8997`. En Studio va en el recorrido `bandeja`, solo admin, con el ancla en Vínculos.

### U2 · Qué bandejas ve cada uno

- **Ancla:** `usuarios.bandejas`
- **Rol:** Admin
- **Clave:** `guide.users.inboxes`
- **Qué es:** «Cada persona ve las bandejas o el equipo que le asignes.»
- **Antes en Kommo:** «Los permisos se daban por usuario en Kommo.» Ruta de clics: **NV**.
- **Ahora aquí:** «Marca las bandejas o el equipo de la persona. Ten en cuenta que todos ven la lista de contactos.» **NV (E2: 2.7).** Ver contactos de toda la cuenta es como funciona Chatwoot CE (decisión I).

### U3 · Quitar el acceso

- **Ancla:** `usuarios.baja`
- **Rol:** Admin
- **Clave:** `guide.users.revoke`
- **Qué es:** «Cuando alguien deja de atender, le quitas el acceso en un paso.»
- **Antes en Kommo:** «Se desactivaba el usuario en Kommo.» D(`docs/marketing/kommo-estado-y-pendientes.md:15-29`, 2026-08-10): se desactivó un usuario para cuadrar las licencias.
- **Ahora aquí:** «Abre a la persona en Usuarios y pulsa Suspender acceso. Se cierra su sesión en la Bandeja y ya no puede entrar por fuera.» **NV (E2: 2.7).** La aceptación del SSO prueba cierre, baja, revocación y acceso directo (decisión A).
- **Aprobado:** Sam, 2026-11-07 07:02Z: «Apruebo los dos». Cambia solo «Ahora aquí», con el texto de la propuesta de SDD-0589 (9.5): nombra el botón real de la ficha de la persona. Huella (sha256 del texto entre « », 16 caracteres): `c8036fae1eaf9340`. El ancla está en ese botón. Arrancar la guía desde la ficha queda para la 9.6.

## Recorrido 6 · Actualizaciones (solo admin)

Clave del recorrido: `guide.updates`. Pantalla: Studio → Actualizaciones (3.3). Lo ve: **Admin**. Todo el recorrido es **NV (E3)**.

### A1 · Qué versión tienes

- **Ancla:** `actualizaciones.version`
- **Rol:** Admin
- **Clave:** `guide.updates.version`
- **Qué es:** «Aquí ves la versión del chat que usa DTD y si salió una nueva.»
- **Antes en Kommo:** No aplica: Kommo se actualizaba solo, sin que DTD decidiera. I.
- **Ahora aquí:** «Revisa la versión actual y las nuevas. Nada se instala solo.» **NV (E3: 3.2, 3.3).** La versión de partida es `v4.19.1-ce` (spec, Alcance).

### A2 · Analizar con IA

- **Ancla:** `actualizaciones.analizar`
- **Rol:** Admin
- **Clave:** `guide.updates.analyze`
- **Qué es:** «La IA lee los cambios de la versión nueva y te dice qué toca de DTD.»
- **Antes en Kommo:** No aplica. I.
- **Ahora aquí:** «Pulsa Analizar con IA. El análisis informa; no decide ni instala.» **NV (E3: 3.4).** Decisión H.

### A3 · Pedir la actualización

- **Ancla:** `actualizaciones.pedir`
- **Rol:** Admin
- **Clave:** `guide.updates.request`
- **Qué es:** «Si quieres la versión nueva, la pides aquí y se programa con respaldo y prueba.»
- **Antes en Kommo:** No aplica. I.
- **Ahora aquí:** «Pulsa Pedir actualización. Se hace en una ventana acordada, con respaldo antes y prueba después.» **NV (E3: 3.1, 3.3).** El despliegue lleva su propio OK (spec, Gobernanza).

## Lo que este guion no decide

- El diseño visual de la tarjeta, que es de 9.2 con `/ui-check` en 9.6.
- Los selectores reales de Chatwoot, que son de 9.4.
- El texto en chino de `zh-CN`, que se traduce cuando el guion esté aceptado (pregunta S-3).
- La atención desde el celular, que está fuera del 100 % (spec, Alcance).

## Preguntas

**Estado al 2026-10-29:** Sam aceptó el guion («Acepto todo») sin contestar estas preguntas. Quedan abiertas como pendientes de los pasos siguientes y no bloquean la aceptación de 9.1. Mientras no tengan respuesta, valen las propuestas del guion y las rutas de «Antes en Kommo» siguen NV.

| Preguntas | Se cierran en | Por qué ahí |
|---|---|---|
| S-3 | 9.2 | El motor carga las claves `guide.*` en los dos idiomas; hace falta saber si `zh-CN` se traduce o se oculta |
| S-6, S-7 | 9.3 | Primera vez por pantalla o toda junta, y nombre y lugar del botón «Guía» |
| S-1, S-2, S-4, S-5, S-8, S-9 | 9.5 | Cambian qué tarjetas ve cada rol y su texto |
| P-1–P-10 | 9.5, a más tardar 9.6 | Cierran las rutas NV de «Antes en Kommo»; si no se contestan antes, se recogen en la prueba con la persona que atiende |

### Para Sam

- **S-1.** ¿Quién mueve el interruptor de la IA: solo tú, o también la persona que atiende? El guion propone que solo tú.
- **S-2.** ¿La persona que atiende puede asignar conversaciones a otros, o solo a sí misma? **Contestada** el 2026-11-07 a las 07:00Z: «También quien atiende». B4 la ven admin, commercial y support.
- **S-3.** ¿La oficina de China va a usar la Bandeja? Si no, la guía se oculta en `zh-CN`; si sí, hay que traducirla. La clave tiene que existir igual en los dos idiomas.
- **S-4.** ¿El embudo nuevo arranca con las mismas etapas de «Ventas DTD» o con otras? Lo cierra 6.1.
- **S-5.** ¿Quién contesta hoy el correo de `info@`, y desde dónde (webmail de Hostinger, otro programa o el celular)?
- **S-6.** Primera vez: ¿la guía arranca en cada pantalla la primera vez que se entra a ella (propuesta), o una sola vez, toda junta?
- **S-7.** ¿Te sirve «Guía» como nombre del botón, en la barra superior de Studio?
- **S-8.** Cuando un contacto no es cliente, ¿quién lo une al cliente de DTD: tú, la persona que atiende o los dos?
- **S-9.** ¿Hace falta una tarjeta para Instagram y Messenger aparte de B1, o basta con decir que llegan a la misma Bandeja?

### Para la persona que atiende

- **P-1.** Para contestar un WhatsApp en Kommo, ¿entras por la lista de chats o por la tarjeta del lead?
- **P-2.** ¿Cómo buscas hoy a un cliente: por nombre, por teléfono o de otra forma?
- **P-3.** ¿Entras a Kommo con tu propio usuario? Kommo tiene una sola licencia en uso (K-17).
- **P-4.** ¿Usas las notas y las tareas del lead? ¿Dónde las miras cada día?
- **P-5.** ¿Mueves tú los leads de etapa, o lo hace Sam? ¿Lo haces en Kommo o desde CRM en Studio?
- **P-6.** ¿Llegaste a usar la respuesta sugerida de la IA de Kommo? ¿Qué te servía y qué no?
- **P-7.** ¿Cómo te enteras de un mensaje nuevo: aviso en la computadora, en el celular o mirando la pantalla?
- **P-8.** Cuando pasan 24 horas sin respuesta del cliente, ¿cómo mandas la plantilla?
- **P-9.** ¿Atiendes desde el celular con la app de Kommo? La atención móvil dentro de Studio no está en este programa.
- **P-10.** ¿Qué haces cada día en Kommo que no aparece en esta lista?

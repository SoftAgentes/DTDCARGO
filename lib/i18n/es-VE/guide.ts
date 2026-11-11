/**
 * lib/i18n/es-VE/guide.ts · Guía «Antes en Kommo → Ahora aquí» (SDD-0589,
 * paso 9.2 del programa SDD-0582).
 *
 * Textos del motor (`guide.chrome.*`), del recorrido de demostración
 * (`guide.dashboard.*`) y de los recorridos por pantalla de 9.5, copiados del
 * guion aceptado de 9.1 (`docs/specs/0582-chatwoot-piloto/guia-guion.md`). Las
 * tarjetas del guion sin pantalla en `main` (IA, U2, parte de la Ficha DTD)
 * quedan pendientes en SDD-0589 y no tienen claves todavía.
 *
 * Cada tarjeta tiene una clave base con cuatro sufijos: `.title`, `.what`,
 * `.before` (opcional: sin ella no se muestra «Antes en Kommo») y `.now`.
 */

export const guide = {
  // ── Controles del motor (guion 9.1, «Controles de la guía») ──
  "guide.chrome.toggle": "Guía",
  "guide.chrome.toggle_on_aria": "Mostrar la guía de esta pantalla",
  "guide.chrome.toggle_off_aria": "Ocultar la guía",
  "guide.chrome.welcome.title": "Así se hace ahora lo que hacías en Kommo",
  "guide.chrome.welcome.body":
    "Te mostramos cada tarea en pocos pasos. Puedes cerrarla cuando quieras y volver con el botón «Guía».",
  "guide.chrome.next": "Siguiente",
  "guide.chrome.prev": "Anterior",
  "guide.chrome.close": "Cerrar",
  "guide.chrome.step_of": "{n} de {total}",
  "guide.chrome.label_before": "Antes en Kommo",
  "guide.chrome.label_now": "Ahora aquí",
  "guide.chrome.dont_show": "No volver a mostrar",
  "guide.chrome.resume": "Seguir donde quedaste",
  "guide.chrome.restart": "Ver la guía desde el principio",
  "guide.chrome.missing_target":
    "Esta parte cambió de lugar. Sigue con el próximo paso.",
  // Agregadas en 9.2 (no estaban en el guion): cierre del último paso,
  // nombre de la tarjeta para el lector de pantalla y anuncio del paso.
  "guide.chrome.done": "Terminar",
  "guide.chrome.close_aria": "Cerrar la guía",
  "guide.chrome.card_aria": "Guía de la pantalla",
  "guide.chrome.announce": "Guía, paso {n} de {total}: {title}",
  "guide.chrome.closed": "Guía cerrada",

  // ── Recorrido de demostración · Dashboard (9.2) ──
  "guide.dashboard.welcome.title": "Tu inicio en Studio",
  "guide.dashboard.welcome.what":
    "Es la primera pantalla al entrar: el saludo, la fecha y la empresa con la que operas.",
  "guide.dashboard.welcome.now":
    "Desde aquí vas a cada módulo con el menú de la izquierda.",
  "guide.dashboard.kpis.title": "Los números del día",
  "guide.dashboard.kpis.what":
    "Cada tarjeta resume un indicador de la operación. Solo ves los que tu rol puede ver.",
  "guide.dashboard.kpis.now":
    "Revísalos al entrar. Si un indicador todavía no tiene datos, aparece con una raya.",
  "guide.dashboard.configure.title": "Elige qué ver",
  "guide.dashboard.configure.what":
    "Tú decides qué indicadores y paneles aparecen y en qué orden.",
  "guide.dashboard.configure.now":
    "Pulsa Configurar, activa lo que quieras ver y ordénalo. Se guarda solo.",
  "guide.dashboard.panels.title": "Tus paneles",
  "guide.dashboard.panels.what":
    "Debajo de los números van los paneles que activaste, como la actividad reciente.",
  "guide.dashboard.panels.now":
    "Entra a cada registro desde su panel. Si no ves ninguno, actívalo en Configurar.",

  // ── Recorridos por pantalla (9.5), copiados del guion aceptado de 9.1 ──
  // Varios «Ahora aquí» describen pasos que faltan (SDD-0589, «Textos que
  // prometen pasos pendientes»): por eso estos recorridos no arrancan solos.

  // Bandeja (guion, recorrido 1; F1 del recorrido 3). Las anclas están dentro de Chatwoot (9.4).
  "guide.inbox.reply.title": "Contestar un WhatsApp",
  "guide.inbox.reply.what":
    "Aquí llegan juntos WhatsApp, Instagram, Messenger y correo. Abres la conversación y contestas abajo.",
  "guide.inbox.reply.before": "Abrías el chat del lead en Kommo y escribías ahí.",
  "guide.inbox.reply.now":
    "Entra a Bandeja, elige la conversación, escribe abajo y pulsa Enviar. El cliente lo recibe en el mismo número de siempre.",
  "guide.inbox.email.title": "Contestar un correo",
  "guide.inbox.email.what":
    "El correo de la empresa entra como una conversación más, con su hilo y sus adjuntos.",
  "guide.inbox.email.before":
    "El correo no pasaba por Kommo: se contestaba aparte, en el correo de Hostinger.",
  "guide.inbox.email.now":
    "Filtra por Correo o abre la conversación. Tu respuesta sale desde la dirección de la empresa y queda en el mismo hilo.",
  "guide.inbox.search.title": "Buscar un contacto y ver su historial",
  "guide.inbox.search.what":
    "Busca por nombre, teléfono o correo. Ves todas sus conversaciones, también las de Kommo.",
  "guide.inbox.search.before": "Buscabas el contacto en Kommo y abrías su lead para ver el chat.",
  "guide.inbox.search.now":
    "Escribe en el buscador y abre el contacto. Lo que hablaste en Kommo está en la bandeja «Archivo Kommo», con su fecha y su autor.",
  "guide.inbox.assign.title": "Asignar una conversación",
  "guide.inbox.assign.what":
    "Cada conversación tiene un responsable. Así nadie contesta dos veces lo mismo.",
  "guide.inbox.assign.before": "En Kommo el responsable era el «usuario responsable» del lead.",
  "guide.inbox.assign.now":
    "En la conversación, pulsa Asignar y elige a la persona. Te puedes asignar tú.",
  "guide.inbox.templates.title": "Enviar una plantilla",
  "guide.inbox.templates.what":
    "Si el cliente lleva más de 24 horas sin escribir, WhatsApp solo deja mandar una plantilla aprobada.",
  "guide.inbox.templates.before":
    "Las plantillas estaban en Kommo, en Automatizaciones → Plantillas.",
  "guide.inbox.templates.now":
    "En el chat, abre Plantillas, elige una y completa lo que pide. Tienen el mismo texto que las de Kommo.",
  "guide.inbox.note.title": "Dejar una nota",
  "guide.inbox.note.what": "Una nota privada es para el equipo. El cliente no la ve.",
  "guide.inbox.note.before": "Escribías la nota en el lead de Kommo.",
  "guide.inbox.note.now":
    "Cambia de Responder a Nota privada, escribe y guarda. Queda en la conversación, marcada como interna.",
  "guide.dtdcard.panel.title": "Qué es la Ficha DTD",
  "guide.dtdcard.panel.what":
    "Junto al chat ves quién es el cliente para DTD: sus datos, embarques y cotizaciones.",
  "guide.dtdcard.panel.before":
    "Para ver un embarque tenías que salir de Kommo y buscarlo en Studio.",
  "guide.dtdcard.panel.now":
    "Abre la pestaña Ficha DTD a la derecha de la conversación. No tienes que salir del chat.",

  // Embudo (guion, recorrido 2): CRM › Embudos.
  "guide.pipeline.board.title": "El tablero",
  "guide.pipeline.board.what": "Cada tarjeta es un lead. Cada columna es una etapa de la venta.",
  "guide.pipeline.board.before": "Era el embudo «Ventas DTD» de Kommo.",
  "guide.pipeline.board.now":
    "Entra a Embudo en el menú de Studio. Las etapas son las de DTD y los leads ya vienen de Kommo.",
  "guide.pipeline.move.title": "Mover un lead de etapa",
  "guide.pipeline.move.what": "Cuando la venta avanza, el lead pasa a la etapa siguiente.",
  "guide.pipeline.move.before":
    "Arrastrabas la tarjeta a otra columna en Kommo, o cambiabas la etapa desde CRM en Studio.",
  "guide.pipeline.move.now":
    "Arrastra la tarjeta o cambia la etapa en la ficha del lead. Algunas etapas cambian solas, como cuando sale una cotización.",
  "guide.pipeline.tasks.title": "Tareas",
  "guide.pipeline.tasks.what": "Una tarea te recuerda qué hacer con un lead y para cuándo.",
  "guide.pipeline.tasks.before":
    "Las tareas vivían en el lead. El bot «Ping 23 h» creaba una cuando un chat se iba a cerrar.",
  "guide.pipeline.tasks.now":
    "Crea la tarea en la ficha del lead. Studio te avisa de los leads sin atender y de los chats a punto de pasar las 24 horas.",
  "guide.pipeline.incoming.title": "Leads nuevos",
  "guide.pipeline.incoming.what":
    "Los leads nuevos entran solos desde los chats y la web, con el canal de donde vinieron.",
  "guide.pipeline.incoming.before": "Caían en «Leads entrantes» de Kommo.",
  "guide.pipeline.incoming.now":
    "Aparecen en la primera columna. Ábrelos, contesta y muévelos cuando avancen.",

  // Ficha del cliente (guion, recorrido 3, F3). El título del guion pasaba de 40
  // caracteres: se cortó el texto, como dice el guion, sin agrandar la tarjeta.
  "guide.dtdcard.client_tab.title": "Conversaciones en la ficha del cliente",
  "guide.dtdcard.client_tab.what":
    "En la ficha del cliente de Studio ves sus conversaciones y cuántas están sin leer.",
  "guide.dtdcard.client_tab.before": "En Studio, CRM mostraba una copia del tablero de Kommo.",
  "guide.dtdcard.client_tab.now":
    "Abre Clientes, entra al cliente y mira la tarjeta Conversaciones. Un clic te lleva al chat.",

  // Actualizaciones (guion, recorrido 6; solo admin). Sin «Antes en Kommo»: el guion dice «No aplica».
  "guide.updates.version.title": "Qué versión tienes",
  "guide.updates.version.what": "Aquí ves la versión del chat que usa DTD y si salió una nueva.",
  "guide.updates.version.now": "Revisa la versión actual y las nuevas. Nada se instala solo.",
  "guide.updates.analyze.title": "Analizar con IA",
  "guide.updates.analyze.what":
    "La IA lee los cambios de la versión nueva y te dice qué toca de DTD.",
  "guide.updates.analyze.now": "Pulsa Analizar con IA. El análisis informa; no decide ni instala.",
  "guide.updates.request.title": "Pedir la actualización",
  "guide.updates.request.what":
    "Si quieres la versión nueva, la pides aquí y se programa con respaldo y prueba.",
  "guide.updates.request.now":
    "Pulsa Pedir actualización. Se hace en una ventana acordada, con respaldo antes y prueba después.",

  // Usuarios (guion, recorrido 5; solo admin). «Qué es» de U1 y «Ahora aquí» de
  // U1 y U3: textos de la propuesta de SDD-0589 (9.5), aprobados por Sam el
  // 2026-11-07 07:02Z («Apruebo los dos»). Lo demás es del guion aceptado.
  // U1 va en el recorrido `bandeja` (Vínculos). U3 tiene su ancla en la ficha de
  // la persona, pero todavía no tiene recorrido: es de la 9.6.
  "guide.users.grant.title": "Dar acceso a la Bandeja",
  "guide.users.grant.what":
    "Desde Vínculos decides quién entra a la Bandeja. No hay que crear la cuenta dos veces.",
  "guide.users.grant.before":
    "Los usuarios se creaban en Kommo, en Ajustes → Gestión de usuarios, y cada uno gastaba una licencia.",
  "guide.users.grant.now":
    "Invita a la persona en Usuarios y vincúlala aquí. Studio le crea la cuenta en el chat.",
  "guide.users.revoke.title": "Quitar el acceso",
  "guide.users.revoke.what": "Cuando alguien deja de atender, le quitas el acceso en un paso.",
  "guide.users.revoke.before": "Se desactivaba el usuario en Kommo.",
  "guide.users.revoke.now":
    "Abre a la persona en Usuarios y pulsa Suspender acceso. Se cierra su sesión en la Bandeja y ya no puede entrar por fuera.",
} as const satisfies Record<string, string>;

export type GuideDict = Record<keyof typeof guide, string>;

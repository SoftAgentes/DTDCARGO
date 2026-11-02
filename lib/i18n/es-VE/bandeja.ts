/**
 * lib/i18n/es-VE/bandeja.ts · Bandeja de Chatwoot dentro de Studio (SDD-0585).
 *
 * Cubre /studio/bandeja: estados de la página, el iframe y el formulario de
 * vínculos del admin.
 */

export const bandeja = {
  // ── Página ───────────────────────────────────────────────
  "bandeja.page.eyebrow": "Comercial · Bandeja",
  "bandeja.page.title": "Bandeja",
  "bandeja.frame.title": "Bandeja de mensajes",

  // ── Estados ──────────────────────────────────────────────
  "bandeja.state.loading": "Abriendo la bandeja…",
  "bandeja.state.unconfigured.title": "La bandeja todavía no está conectada",
  "bandeja.state.unconfigured.body":
    "Falta configurar la conexión con el servidor de mensajes. Avísale al administrador.",
  "bandeja.state.unlinked.title": "Tu usuario no tiene un agente de la bandeja",
  "bandeja.state.unlinked.body":
    "Un administrador tiene que vincular tu usuario con tu agente para que puedas atender desde aquí.",
  "bandeja.state.error.title": "No pudimos abrir la bandeja",
  "bandeja.state.error.body": "Vuelve a intentarlo. Si sigue fallando, ábrela en una pestaña aparte.",
  "bandeja.action.retry": "Reintentar",
  "bandeja.action.relogin": "Volver a entrar",
  "bandeja.action.open_tab": "Abrir en pestaña aparte",

  // ── Vínculos (solo admin) ────────────────────────────────
  "bandeja.links.title": "Agentes vinculados",
  "bandeja.links.help":
    "Vincula cada usuario de Studio con su agente de la bandeja. El correo del agente tiene que ser el mismo del usuario.",
  "bandeja.links.empty": "Todavía no hay usuarios vinculados.",
  "bandeja.links.user": "Usuario de Studio",
  "bandeja.links.user_placeholder": "Elige un usuario",
  "bandeja.links.agent_id": "Id del agente en la bandeja",
  "bandeja.links.submit": "Vincular",
  "bandeja.links.submitting": "Vinculando…",
  "bandeja.links.unlink": "Desvincular",
  "bandeja.links.unlinking": "Desvinculando…",
  "bandeja.links.created": "Usuario vinculado",
  "bandeja.links.deleted": "Vínculo eliminado",
  "bandeja.links.unlink_confirm_title": "¿Desvincular este usuario?",
  "bandeja.links.unlink_confirm_body":
    "{nombre} ya no podrá abrir la bandeja desde Studio hasta que lo vuelvas a vincular.",
  "bandeja.links.cancel": "Cancelar",

  // ── Tarjeta en la ficha del cliente (2.3) ────────────────
  "bandeja.card.title": "Conversaciones en la Bandeja",
  "bandeja.card.empty": "Sin conversaciones vinculadas a este cliente.",
  "bandeja.card.conversation": "Conversación #{n}",
  "bandeja.card.unread": "{n} sin leer",
  "bandeja.card.last_activity": "Última actividad: {fecha}",
  "bandeja.card.open": "Abrir",
  "bandeja.status.open": "Abierta",
  "bandeja.status.pending": "Pendiente",
  "bandeja.status.snoozed": "En pausa",
  "bandeja.status.resolved": "Resuelta",

  // ── Eventos descartados (2.3, v3; solo admin) ────────────
  "bandeja.discarded.title": "Eventos que no se pudieron procesar",
  "bandeja.discarded.help":
    "Studio los reintentó 5 veces sin éxito. Revisa esas conversaciones en la Bandeja: puede faltar un aviso.",
  "bandeja.discarded.message": "Mensaje nuevo · conversación #{n} · {intentos} intentos",
  "bandeja.discarded.status": "Cambio de estado · conversación #{n} · {intentos} intentos",

  // ── Errores de las acciones ──────────────────────────────
  "bandeja.error.denied": "No tienes permiso para hacer esto.",
  "bandeja.error.invalid": "Revisa el usuario y el id del agente.",
  "bandeja.error.not_member": "Ese usuario no es de tu empresa.",
  "bandeja.error.agent_not_found": "No encontramos ese agente en la bandeja.",
  "bandeja.error.agent_other_account": "Ese agente no pertenece a la cuenta de la empresa.",
  "bandeja.error.email_mismatch": "El correo del agente no coincide con el del usuario.",
  "bandeja.error.duplicate": "Ese usuario o ese agente ya están vinculados.",
  "bandeja.error.unconfigured": "La bandeja todavía no está conectada.",
  "bandeja.error.unlinked": "Tu usuario no tiene un agente vinculado.",
  "bandeja.error.service": "El servidor de mensajes no respondió. Vuelve a intentarlo.",

  // ── Ficha DTD (2.4): la Dashboard App de Chatwoot ──
  "bandeja.ficha.eyebrow": "Ficha DTD",
  "bandeja.ficha.loading": "Cargando la ficha…",
  "bandeja.ficha.waiting.title": "Abre una conversación",
  "bandeja.ficha.waiting.body": "Esta ficha se ve dentro de Chatwoot, al lado de cada conversación.",
  "bandeja.ficha.signed_out.title": "Inicia sesión en Studio",
  "bandeja.ficha.signed_out.body": "La ficha usa tu sesión de Studio. Inicia sesión en otra pestaña y vuelve a esta conversación.",
  "bandeja.ficha.signed_out.action": "Abrir Studio",
  "bandeja.ficha.none.title": "Sin ficha",
  "bandeja.ficha.none.body": "El teléfono de este contacto no coincide con un único cliente de Studio.",
  "bandeja.ficha.mark": "Shipping Mark",
  "bandeja.ficha.previous": "También: {codigos}",
  "bandeja.ficha.segment.cliente": "Cliente",
  "bandeja.ficha.segment.lead_registrado": "Lead registrado",
  "bandeja.ficha.shipments": "Envíos en curso",
  "bandeja.ficha.shipments.unknown": "No se pudieron contar",
  "bandeja.ficha.balance": "Saldo abierto",
  "bandeja.ficha.overdue": "Vencido",
  "bandeja.ficha.up_to_date": "Al día",
  "bandeja.ficha.as_of": "Al {fecha}",
  "bandeja.ficha.balance_error": "No se pudo calcular el saldo. Referencia: {ref}",
  "bandeja.ficha.deleted": "Este cliente se eliminó el {fecha}.",
  "bandeja.ficha.open": "Abrir en Studio",
  "bandeja.ficha.costo.title": "Costo de referencia de este chat",
  "bandeja.ficha.costo.linea": "{n} mensajes enviados × {tarifa} = {total}",
  "bandeja.ficha.costo.linea_piso": "Al menos {n} mensajes enviados × {tarifa} = {total}",
  "bandeja.ficha.costo.fuente": "Tarifa de servicio de Meta para «{mercado}», vigente desde el {fecha}.",
  "bandeja.ficha.costo.fuente_link": "Tarifario oficial",
  "bandeja.ficha.costo.nota": "Es una referencia: no descuenta los 1.000 mensajes gratis del mes ni distingue las plantillas, que Meta cobra con su propia tarifa.",
  "bandeja.ficha.retry": "Reintentar",
  "bandeja.ficha.error.denied": "Tu rol no tiene acceso a la Bandeja de Studio.",
  "bandeja.ficha.error.invalid": "Chatwoot no mandó los datos de la conversación.",
  "bandeja.ficha.error.unconfigured": "La Bandeja todavía no está conectada.",
  "bandeja.ficha.error.unlinked": "Tu usuario de Studio no tiene un agente vinculado.",
  "bandeja.ficha.error.otro_agente": "Esta sesión de Studio es de otra persona. Cierra sesión en Studio y entra con tu usuario.",
  "bandeja.ficha.error.sin_clientes": "Tu rol no ve fichas de clientes.",
  "bandeja.ficha.error.sin_acceso": "No tienes acceso a esta conversación.",
  "bandeja.ficha.error.service": "No pudimos cargar la ficha. Vuelve a intentarlo.",

  // ── Ciclo de vida de los agentes (2.5): alta y salud ──
  "bandeja.error.sin_bandeja": "Ese usuario no tiene acceso a la Bandeja por su rol.",
  "bandeja.alta.title": "Dar de alta en la bandeja",
  "bandeja.alta.help": "Crea su agente en el servidor de mensajes con el nombre y el correo de Studio, y lo vincula. Entra siempre por Studio, sin clave propia.",
  "bandeja.alta.user": "Usuario de Studio",
  "bandeja.alta.submit": "Dar de alta",
  "bandeja.alta.submitting": "Dando de alta…",
  "bandeja.alta.created": "Agente dado de alta y vinculado.",
  "bandeja.alta.empty": "Todos los usuarios que ven la Bandeja ya tienen agente.",
  "bandeja.salud.title": "Salud de la bandeja",
  "bandeja.salud.ok": "Todo en orden: hay {n} administrador(es) humano(s) y los vínculos están dentro de la cuenta.",
  "bandeja.salud.alerta.chatwoot_no_responde": "El servidor de mensajes no responde.",
  "bandeja.salud.alerta.sin_admin_humano": "La cuenta no tiene ningún administrador humano: solo el usuario de servicio. Agrega un administrador desde el servidor de mensajes.",
  "bandeja.salud.alerta.servicio_sin_configurar": "Falta configurar el usuario de servicio (CHATWOOT_SERVICE_USER_ID): no se puede contar a los administradores humanos.",
  "bandeja.salud.alerta.vinculo_fuera_de_cuenta": "Hay vínculos a agentes que ya no están en la cuenta: {ids}.",
  "bandeja.salud.alerta.baja_bloqueada": "Una baja quedó bloqueada para no dejar la cuenta sin administrador.",
  "bandeja.salud.alerta.cierre_pendiente": "Una baja salió de la cuenta, pero sus sesiones siguen abiertas: el próximo cron lo reintenta.",
  "bandeja.salud.alerta.degradacion_bloqueada": "Un cambio de rol quedó bloqueado para no dejar la cuenta sin administrador.",
  "bandeja.salud.alerta.matriz_incompleta": "No se pudieron aplicar todos los permisos de la matriz: el próximo cron lo reintenta.",
  "bandeja.salir.cerrando": "Cerrando tu sesión…",
  "bandeja.salir.marco": "Cierre de la sesión del chat",
  "bandeja.badge.aria": "{n} sin leer",
} as const satisfies Record<string, string>;

export type BandejaDict = Record<keyof typeof bandeja, string>;

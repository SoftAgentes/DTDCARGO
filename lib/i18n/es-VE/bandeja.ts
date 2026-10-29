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
} as const satisfies Record<string, string>;

export type BandejaDict = Record<keyof typeof bandeja, string>;

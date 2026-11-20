/**
 * SDD-0672 · qué pasó con el correo que alguien escribió en `/entrar`.
 *
 * Hasta la SDD-0597 la pantalla respondía lo mismo para todos los correos, para
 * que nadie pudiera averiguar quién es cliente. El costo lo pagaban los clientes:
 * el que escribió mal su correo, o el que nunca tuvo portal, esperaba un enlace
 * que no iba a llegar. Sam decidió el 2026-11-18 decirlo en pantalla.
 *
 * Puro (sin `node:crypto` ni DB): lo importan la acción y el formulario.
 */

export type EntrarResultado =
  /** Tiene acceso y el enlace de entrada salió. */
  | "enlace"
  /** Es cliente del ERP sin portal y le salió el enlace para crearlo (entrega 2). */
  | "crear_portal"
  /** Es cliente del ERP, pero sin acceso al portal: el equipo ya está avisado. */
  | "sin_portal"
  /** Cuenta que nació del link de registro y cuyo correo su dueño no comprobó. */
  | "sin_comprobar"
  /** No encontramos ese correo. */
  | "sin_cuenta";

/** Mensaje de WhatsApp que se arma para cada caso. */
export const ENTRAR_WHATSAPP: Record<EntrarResultado, string> = {
  enlace: "Hola DTD Cargo, soy cliente y no me llega el enlace para entrar a mi portal.",
  crear_portal: "Hola DTD Cargo, ya soy cliente y no me llega el enlace para crear mi portal.",
  sin_portal: "Hola DTD Cargo, ya soy cliente y quiero activar mi portal.",
  sin_comprobar:
    "Hola DTD Cargo, quiero entrar a mi portal y mi correo todavía no está comprobado.",
  sin_cuenta: "Hola DTD Cargo, ya soy cliente pero mi correo no aparece para entrar al portal.",
};

import { redirect } from "next/navigation";

/**
 * SDD-0147: "Mensajes" se fusionó con "Reclamos" en la pantalla única
 * `/portal/soporte` (Norte). Esta ruta redirige para no romper links viejos.
 * El chat sigue vivo — ahora vive en la columna derecha de Soporte
 * (`PortalMessageForm` + `getPortalThread` se reutilizan desde ahí).
 */
export default function MensajesRedirect() {
  redirect("/portal/soporte");
}

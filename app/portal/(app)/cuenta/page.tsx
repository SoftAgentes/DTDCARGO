import { permanentRedirect } from "next/navigation";

/**
 * /portal/cuenta se unificó en /portal/perfil — "Mi perfil" (SDD-0145, espejo
 * del PortalProfile del Norte). Redirect permanente para links guardados; los
 * componentes que vivían acá (AvatarEditor, PortalAddresses y sus actions) se
 * movieron a `../perfil/`.
 */
export default function PortalCuentaRedirect() {
  permanentRedirect("/portal/perfil");
}

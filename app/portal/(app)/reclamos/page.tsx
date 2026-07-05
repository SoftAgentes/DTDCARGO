import { redirect } from "next/navigation";

/**
 * SDD-0147: "Reclamos" se fusionó con "Mensajes" en la pantalla única
 * `/portal/soporte` (Norte) como la columna "Tus casos". Esta ruta redirige para
 * no romper links viejos. El backend de reclamos (SDD-0101/0102) y el componente
 * `PortalClaims` (modo embedded) se reutilizan desde Soporte.
 */
export default function ReclamosRedirect() {
  redirect("/portal/soporte");
}

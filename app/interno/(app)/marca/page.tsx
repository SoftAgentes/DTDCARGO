import { permanentRedirect } from "next/navigation";

/**
 * `/interno/marca` → `/marca` (SDD-0238).
 *
 * El hub de marca se mudó a `/marca`, que es la misma experiencia pero abierta
 * con un código de acceso: así el founder le manda UN link a un diseñador
 * externo en vez de tener que crearle una cuenta del ERP. El contenido, además,
 * ya no está hardcodeado — sale del catálogo (`brand_assets` + Storage), que se
 * administra desde Studio › Marketing › HUB de marca.
 *
 * No se borra la ruta: el equipo tiene este link guardado y compartido en chats.
 * `permanentRedirect` (308) conserva el método y le dice al navegador que la
 * mudanza es definitiva.
 *
 * Las herramientas siguen en su sitio: `/interno/marca/whatsapp` y
 * `/interno/marca/enlaces` NO se tocan — son operativas del equipo, no material
 * de marca compartible.
 */

export default function InternoMarcaRedirect() {
  permanentRedirect("/marca");
}

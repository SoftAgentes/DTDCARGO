/**
 * Index del Studio autenticado. Redirige al Resumen.
 */

import { redirect } from "next/navigation";

export default function StudioIndex() {
  redirect("/studio/resumen");
}

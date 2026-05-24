/**
 * Redirect /studio/resumen → /studio/dashboard.
 *
 * El módulo "Dashboard" se llamaba "Resumen" antes del handoff de diseño v1.
 * SDD-0007 lo renombró para matchear el handoff. Este redirect evita
 * romper bookmarks viejos y referencias internas.
 */

import { redirect } from "next/navigation";

export default function ResumenRedirect() {
  redirect("/studio/dashboard");
}

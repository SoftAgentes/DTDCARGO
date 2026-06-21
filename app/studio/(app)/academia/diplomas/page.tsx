/**
 * Academia DTD · Diplomas (SDD-0093, Feature B · generador imprimible).
 *
 * Server component: gate de rol (requireModuleView) + LEE los diplomas de la DB
 * (academy_diplomas, NO del localStorage del prototipo del Norte) + genera el QR
 * real de verificación server-side (SVG inline) por folio → DiplomasClient, que
 * lista y muestra el diploma imprimible (port del generador del Norte).
 */

import QRCode from "qrcode";
import { createClient } from "@/lib/db/server";
import { requireModuleView } from "@/lib/studio/rbac-guard";
import { listDiplomas } from "@/lib/studio/academia/queries";
import { DiplomasClient } from "./_components/DiplomasClient";

export const metadata = { title: "Academia · Diplomas" };

/** Base de la verificación pública: el QR de cada diploma apunta acá + ?c=folio. */
const VERIFY_URL = "https://dtdcargo.com/verificar";

/** SVG inline del QR de verificación de un folio. "" si falla (placeholder en UI). */
async function qrSvgFor(folio: string): Promise<string> {
  const url = `${VERIFY_URL}?c=${encodeURIComponent(folio)}`;
  try {
    return await QRCode.toString(url, {
      type: "svg",
      margin: 0,
      errorCorrectionLevel: "M",
      color: { dark: "#0F1E3D", light: "#FFFFFF" },
    });
  } catch {
    return "";
  }
}

export default async function DiplomasPage() {
  await requireModuleView("academia");
  const supabase = await createClient();
  const diplomas = await listDiplomas(supabase);

  // QR server-side por folio (mapa folio → svg). Secuencial: el volumen de
  // diplomas es bajo y evita saturar; toString es rápido.
  const qrByFolio: Record<string, string> = {};
  for (const d of diplomas) {
    qrByFolio[d.folio] = await qrSvgFor(d.folio);
  }

  return (
    <div style={{ padding: "var(--s-6)" }}>
      <DiplomasClient diplomas={diplomas} qrByFolio={qrByFolio} verifyUrl={VERIFY_URL} />
    </div>
  );
}

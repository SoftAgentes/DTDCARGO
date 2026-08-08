/**
 * Recuperar acceso al Studio (SDD-0252). Server wrapper — sin lógica, la
 * server action vive en ./actions.ts.
 */

import type { Metadata } from "next";
import { RecoveryForm } from "./RecoveryForm";

export const metadata: Metadata = {
  title: "Recuperar acceso · Studio",
  robots: { index: false, follow: false },
};

export default function RecuperarPage() {
  return <RecoveryForm />;
}

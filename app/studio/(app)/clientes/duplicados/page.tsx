/**
 * Clientes › Posibles duplicados (SDD-0246).
 *
 * Un cliente que YA existe se registra por la web como si fuera nuevo y sale con
 * un Shipping Mark nuevo. Acá se revisan esos pares y se fusionan a mano.
 */

import { createClient } from "@/lib/db/server";
import { requireModuleView } from "@/lib/studio/rbac-guard";
import { listDuplicateCandidates } from "@/lib/studio/client-merge-queries";
import { DuplicadosClient } from "../_components/DuplicadosClient";

export const metadata = { title: "Posibles duplicados" };

export default async function DuplicadosPage() {
  await requireModuleView("clients");

  const supabase = await createClient();
  const candidates = await listDuplicateCandidates(supabase);

  return <DuplicadosClient candidates={candidates} />;
}

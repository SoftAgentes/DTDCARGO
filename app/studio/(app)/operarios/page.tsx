/**
 * /studio/operarios — Admin de operarios PWA (SDD-0028).
 *
 * Server component que fetcha operarios del tenant + warehouses CN
 * (para el select del drawer Nuevo/Editar) y delega UI al cliente.
 */

import { createClient } from "@/lib/db/server";
import { listOperarios } from "@/lib/studio/operario-queries";
import { listWarehouses } from "@/lib/studio/warehouse-cn-queries";
import { OperariosClient } from "./_components/OperariosClient";

export const metadata = { title: "Operarios" };

export default async function OperariosPage() {
  const supabase = await createClient();
  const [operarios, warehouses] = await Promise.all([
    listOperarios(supabase),
    listWarehouses(supabase),
  ]);

  return (
    <div style={{ maxWidth: 1280 }}>
      <div style={{ marginBottom: 24 }}>
        <span className="studio-eyebrow">Sistema · Acceso</span>
        <h1
          className="studio-display"
          style={{ fontSize: 30, margin: "8px 0 8px", color: "var(--ink)" }}
        >
          Operarios.
        </h1>
        <p
          style={{
            font: "400 13px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
            maxWidth: "62ch",
          }}
        >
          Personas que entran a la PWA mobile (
          <code style={{ font: "600 12px/1 var(--f-mono)" }}>/m/cn</code>)
          con PIN de 4 dígitos. Cada operario pertenece a un warehouse
          y queda registrado como autor de las recepciones que toma.
        </p>
      </div>

      <OperariosClient operarios={operarios} warehouses={warehouses} />
    </div>
  );
}

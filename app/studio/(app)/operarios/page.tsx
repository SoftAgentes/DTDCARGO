/**
 * /studio/operarios — Admin de operarios PWA (SDD-0028).
 *
 * Server component que fetcha operarios del tenant + warehouses CN
 * (para el select del drawer Nuevo/Editar) y delega UI al cliente.
 * SDD-0529: también los roles de cada región, que da la base, para el
 * selector de «Editar».
 */

import { createClient } from "@/lib/db/server";
import { getOperarioRolesPorRegion, listOperarios } from "@/lib/studio/operario-queries";
import { listWarehouses } from "@/lib/studio/warehouse-cn-queries";
import { OperariosClient } from "./_components/OperariosClient";

export const metadata = { title: "Operarios" };

export default async function OperariosPage() {
  const supabase = await createClient();
  const [operarios, warehouses, rolesPorRegion] = await Promise.all([
    listOperarios(supabase),
    listWarehouses(supabase),
    getOperarioRolesPorRegion(supabase),
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
          Personas que entran con un PIN de 4 dígitos a la app del teléfono
          de su región: China por{" "}
          <code style={{ font: "600 12px/1 var(--f-mono)" }}>/m/cn</code>{" "}
          (almacén) y Venezuela por{" "}
          <code style={{ font: "600 12px/1 var(--f-mono)" }}>/m/ve</code>{" "}
          (despacho). El PIN sólo sirve en la app de su región. Cada operario
          queda registrado como autor de lo que hace en la app.
        </p>
      </div>

      <OperariosClient
        operarios={operarios}
        warehouses={warehouses}
        rolesPorRegion={rolesPorRegion}
      />
    </div>
  );
}

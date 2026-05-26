/**
 * /studio/despacho/reglas — Motor de scoring configurable (SDD-0029 Vista 2).
 */

import { createClient } from "@/lib/db/server";
import { getDispatchRules } from "@/lib/studio/dispatch-rules-queries";
import { RulesClient } from "./_components/RulesClient";

export const metadata = { title: "Reglas de Despacho · DTD Studio" };

export default async function DispatchRulesPage() {
  const supabase = await createClient();
  const rules = await getDispatchRules(supabase);

  return (
    <div style={{ maxWidth: 1100 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 24,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="studio-eyebrow">Operación · Despacho</span>
          <h1
            className="studio-display"
            style={{ fontSize: 30, margin: "8px 0 8px", color: "var(--ink)" }}
          >
            Reglas de despacho
          </h1>
          <p
            style={{
              font: "400 13px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
              maxWidth: "76ch",
            }}
          >
            Configurá la política de pago y los pesos del motor de scoring que
            ordena la cola de paquetes en bodega. Los cambios se aplican al
            instante a la cola de <strong>/studio/despacho</strong>.
          </p>
        </div>
      </div>

      <RulesClient initialRules={rules} />
    </div>
  );
}

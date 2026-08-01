/**
 * SDD-0184 · Fase 3 — tarjeta del plan de carga en el detalle del contenedor.
 *
 * Responde las dos preguntas que justifican el módulo (§2 de la spec):
 *   1. ¿Dónde está la mercancía de un cliente? → la planta 2D + la tabla.
 *   2. ¿Qué sale primero, y cuándo aparece lo pesado? → el orden de descarga.
 *
 * El plan es una GUÍA, no una promesa: se reparte por volumen, y 3 CBM en 50
 * cajas chicas no ocupan lo mismo que 3 CBM en 5 cajas grandes. Eso se dice en
 * pantalla, no se deja implícito.
 */

"use client";

import { useState, useTransition } from "react";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { SegmentedControl } from "@/app/studio/_components/ui/SegmentedControl";
import { Icon } from "@/app/studio/_components/icons";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { ContainerPlanView } from "./ContainerPlanView";
import { calcularPlanCargaAction } from "../plan-actions";
import { ordenDeDescarga, type PlanCarga } from "@/lib/shared/estiba-plan";
import type { ConsolidationPlan } from "@/lib/studio/naviera/plan-queries";

type Props = {
  consolidationId: string;
  plan: ConsolidationPlan | null;
  /** El plan solo se puede recalcular mientras el contenedor sigue abierto. */
  puedeCalcular: boolean;
};

export function PlanCargaCard({ consolidationId, plan, puedeCalcular }: Props) {
  const [vista, setVista] = useState<"planta" | "descarga">("planta");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const toast = useToast();

  const resultado: PlanCarga | null = plan?.result ?? null;

  return (
    <div
      style={{
        marginTop: 16,
        padding: "16px 18px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--s-3)",
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <span
          style={{
            font: "700 10px/1.4 var(--f-sans)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--ink-soft)",
            flex: 1,
            minWidth: 160,
          }}
        >
          Plan de carga · dónde debería ir cada cliente
        </span>

        {plan && (
          <Badge tone="neutral" size="xs">
            versión {plan.version_no}
          </Badge>
        )}

        {puedeCalcular && (
          <ActionButton
            variant={plan ? "ghost" : "primary"}
            size="sm"
            idleLabel={plan ? "Recalcular" : "Calcular plan"}
            loadingLabel="Calculando…"
            successLabel="Plan listo"
            idleIcon={Icon.refresh(14)}
            successIcon={Icon.check(14)}
            onAction={async () => {
              setError(null);
              const r = await calcularPlanCargaAction(consolidationId);
              if (r.error) return r;
              startTransition(() => {
                toast.success(
                  plan
                    ? `Plan recalculado · versión ${r.versionNo}`
                    : "Plan de carga calculado",
                );
              });
              return r;
            }}
            onError={setError}
          />
        )}
      </div>

      {error && (
        <p
          role="alert"
          style={{
            font: "500 12px/1.5 var(--f-sans)",
            color: "var(--danger)",
            margin: "0 0 12px",
          }}
        >
          {error}
        </p>
      )}

      {!resultado ? (
        <p
          style={{
            font: "500 12.5px/1.6 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
            maxWidth: "68ch",
          }}
        >
          Todavía no se ha calculado el plan de este contenedor. Al calcularlo vas a
          saber en qué parte va la carga de cada cliente —para no bajar el contenedor
          entero si aduana quiere revisar a uno— y en qué orden va a salir.
        </p>
      ) : (
        <>
          <div style={{ marginBottom: 12 }}>
            <SegmentedControl
              options={[
                { value: "planta", label: "Dónde va" },
                { value: "descarga", label: "Qué sale primero" },
              ]}
              value={vista}
              onChange={(v) => setVista(v as "planta" | "descarga")}
            />
          </div>

          {vista === "planta" ? (
            <ContainerPlanView plan={resultado} />
          ) : (
            <ListaDescarga plan={resultado} />
          )}

          {resultado.avisos.length > 0 && (
            <ul
              style={{
                listStyle: "none",
                margin: "14px 0 0",
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {resultado.avisos.map((a, i) => (
                <li
                  key={`${a.tipo}-${i}`}
                  style={{
                    padding: "8px 12px",
                    background: "var(--warning-bg)",
                    borderLeft: "3px solid var(--warning)",
                    borderRadius: "var(--r-sm)",
                    font: "500 12px/1.5 var(--f-sans)",
                    color: "var(--ink)",
                  }}
                >
                  {a.mensaje}
                </li>
              ))}
            </ul>
          )}

          <p
            style={{
              font: "500 11.5px/1.5 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: "14px 0 0",
              maxWidth: "72ch",
            }}
          >
            El plan reparte por volumen, así que es una guía aproximada: 3 CBM en 50
            cajas chicas no ocupan lo mismo que 3 CBM en 5 cajas grandes. Sirve para
            saber más o menos dónde está cada cliente, no para medir al centímetro.
          </p>
        </>
      )}
    </div>
  );
}

/** El orden en que la carga va a salir, que es lo que el galpón necesita. */
function ListaDescarga({ plan }: { plan: PlanCarga }) {
  const fila = ordenDeDescarga(plan);

  return (
    <ol
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {fila.map((d) => (
        <li
          key={d.loteId}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--s-3)",
            padding: "10px 12px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            flexWrap: "wrap",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 24,
              height: 24,
              flexShrink: 0,
              display: "grid",
              placeItems: "center",
              borderRadius: "var(--r-pill)",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-strong)",
              font: "700 11px/1 var(--f-mono)",
              color: "var(--ink-soft)",
            }}
          >
            {d.orden}
          </span>

          <span style={{ flex: 1, minWidth: 150 }}>
            <span style={{ display: "block", font: "700 12.5px/1.3 var(--f-sans)", color: "var(--ink)" }}>
              {d.markbox ?? "Sin dueño"}
              {d.clientName && (
                <span style={{ font: "500 11.5px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}>
                  {" "}· {d.clientName}
                </span>
              )}
            </span>
            <span style={{ display: "block", font: "500 11.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
              {d.cajas} caja{d.cajas === 1 ? "" : "s"} · {d.cbm} CBM
            </span>
          </span>

          <span
            style={{
              font: "600 12px/1.3 var(--f-sans)",
              color: "var(--ink)",
              flexShrink: 0,
            }}
          >
            {d.ubicacion}
          </span>

          {d.manejoEspecial && (
            <Badge tone="warning" size="xs">
              {d.manejoEspecial}
            </Badge>
          )}
        </li>
      ))}
    </ol>
  );
}

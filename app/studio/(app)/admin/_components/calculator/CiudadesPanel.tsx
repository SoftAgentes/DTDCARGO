"use client";

/**
 * CiudadesPanel — sub-pestaña "Ciudades" de la sección Calculadora pública
 * (Administración · grupo PRO). Movido desde el módulo Tarifas.
 *
 * CRUD de las ciudades de destino del calculador público LCL DDP. Admin-only:
 * la sección Administración ya exige rol admin para verse, y la RLS de la tabla
 * + las actions refuerzan el gate de escritura. Al guardar, revalidatePath
 * refresca el calculador del sitio.
 */

import { useEffect, useState } from "react";
import type { CalculatorCity } from "@/lib/studio/calculator-cities-types";
import { Icon } from "@/app/studio/_components/icons";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { useRowHighlight } from "@/app/studio/_components/ui/useRowHighlight";
import { CityDrawer } from "./CityDrawer";
import { ZonasEntregaPanel } from "./ZonasEntregaPanel";

type DrawerState =
  | null
  | { mode: "create" }
  | { mode: "edit"; city: CalculatorCity };

export function CiudadesPanel({
  cities,
  isAdmin,
}: {
  cities: CalculatorCity[];
  isAdmin: boolean;
}) {
  const [drawer, setDrawer] = useState<DrawerState>(null);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawer(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawer]);

  return (
    <div style={{ maxWidth: 900 }}>
      <ZonasEntregaPanel cities={cities} isAdmin={isAdmin} />
      {/* Aviso de contexto */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
          padding: "var(--s-3) var(--s-4)",
          marginBottom: 18,
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
        }}
      >
        <span style={{ color: "var(--ink-soft)", marginTop: 1, display: "inline-flex" }}>
          {Icon.info(15)}
        </span>
        <p
          style={{
            font: "400 12.5px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
          }}
        >
          Estas son las <strong style={{ color: "var(--ink)" }}>ciudades de
          destino</strong> del calculador público. El <strong style={{ color: "var(--ink)" }}>precio
          de la entrega</strong> sale del tarifario del transportista, por m³;
          acá se define <em>entrega incluida</em> = el cliente no paga ese tramo
          (lo absorbe DTD). <em>Km desde Valencia</em> ya no fija precio: queda
          como referencia y para ordenar.{" "}
          {isAdmin
            ? "Al guardar se actualiza la configuración que usa el calculador."
            : "Solo un administrador puede editarlas."}
        </p>
      </div>

      {/* Header acción */}
      {isAdmin && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: "var(--s-3)",
          }}
        >
          <button
            type="button"
            className="studio-btn studio-btn-primary studio-btn-sm"
            onClick={() => setDrawer({ mode: "create" })}
          >
            + Nueva ciudad
          </button>
        </div>
      )}

      {cities.length === 0 ? (
        <EmptyState
          eyebrow="Sin ciudades"
          title="No hay ciudades configuradas."
          description={
            isAdmin
              ? "Agrega las ciudades de destino para el calculador. Mientras tanto, el sitio usa la lista por defecto."
              : "El sitio usa la lista de ciudades por defecto. Pedile a un admin que las configure."
          }
          action={
            isAdmin ? (
              <button
                type="button"
                className="studio-btn studio-btn-primary"
                onClick={() => setDrawer({ mode: "create" })}
              >
                + Nueva ciudad
              </button>
            ) : null
          }
        />
      ) : (
        <CitiesTable
          cities={cities}
          isAdmin={isAdmin}
          onEdit={(city) => setDrawer({ mode: "edit", city })}
        />
      )}

      {drawer && (
        <CityDrawer
          mode={drawer.mode}
          city={drawer.mode === "edit" ? drawer.city : undefined}
          onClose={() => setDrawer(null)}
        />
      )}
    </div>
  );
}

function CitiesTable({
  cities,
  isAdmin,
  onEdit,
}: {
  cities: CalculatorCity[];
  isAdmin: boolean;
  onEdit: (city: CalculatorCity) => void;
}) {
  const cols = "1fr 180px 110px 110px 70px";
  const flashClassFor = useRowHighlight();
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: cols,
          gap: "var(--s-3)",
          padding: "var(--s-3) var(--s-5)",
          background: "var(--bg-elevated)",
          borderBottom: "1px solid var(--border)",
          font: "700 10px/1 var(--f-sans)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-soft)",
        }}
      >
        <span>Ciudad</span>
        <span>Slug</span>
        <span style={{ textAlign: "right" }}>Km</span>
        <span>Zona</span>
        <span></span>
      </div>

      {cities.map((c, i) => (
        <div
          key={c.id}
          data-row-id={c.id}
          className={flashClassFor(c.id)}
          style={{
            display: "grid",
            gridTemplateColumns: cols,
            gap: "var(--s-3)",
            padding: "14px 20px",
            borderTop: i > 0 ? "1px solid var(--border)" : 0,
            alignItems: "center",
          }}
        >
          <span style={{ font: "600 13px/1.3 var(--f-sans)", color: "var(--ink)" }}>
            {c.label}
          </span>
          <span
            style={{
              font: "500 12px/1 var(--f-mono)",
              color: "var(--ink-soft)",
            }}
          >
            {c.slug}
          </span>
          <span
            style={{
              font: "600 12.5px/1 var(--f-mono)",
              color: "var(--ink)",
              textAlign: "right",
            }}
          >
            {c.km}
          </span>
          <span>
            {c.casco ? (
              <Badge tone="success" size="sm">
                Incluida
              </Badge>
            ) : (
              <Badge tone="neutral" size="sm">
                No incluida
              </Badge>
            )}
          </span>
          <span style={{ display: "inline-flex", justifyContent: "flex-end" }}>
            {isAdmin && (
              <button
                type="button"
                onClick={() => onEdit(c)}
                title="Editar"
                aria-label="Editar ciudad"
                style={{
                  width: 28,
                  height: 28,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: "var(--r-sm)",
                  color: "var(--ink-soft)",
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                {Icon.edit(13)}
              </button>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

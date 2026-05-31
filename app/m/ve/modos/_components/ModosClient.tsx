"use client";

/**
 * ModosClient — UI cards del selector multi-rol (Sprint D · plan v3).
 *
 * Cards visuales por rol con icono + label + descripción breve. Al elegir,
 * server action `chooseModeAction` setea cookie `dtd_op_mode` y redirige.
 *
 * Correcciones vs handoff `bodeguero-despacho.jsx:1090-1145`:
 *  - Reemplaza "DTD" cuadrado wine 56×56 hardcoded por <BrandMark>.
 *  - Soporta 3+ roles con scroll vertical natural (no accordion · mobile
 *    rara vez tiene > 2 roles activos por operario).
 *  - Sin emojis decorativos (handoff usaba 🚛 / 📦 · brand v3 prohibido).
 *  - Tokens var(--*) en lugar de hex hardcoded.
 */

import { useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { Icon } from "@/app/studio/_components/icons";
import { chooseModeAction } from "../actions";
import type { OperarioRole } from "@/lib/studio/operario-types";

interface Props {
  operario: {
    firstName: string;
    displayName: string;
    roles: OperarioRole[];
  };
  errorMsg: string | null;
}

type ModeDef = {
  role: OperarioRole;
  label: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
};

const MODE_DEFS: Record<OperarioRole, ModeDef> = {
  bodeguero: {
    role: "bodeguero",
    label: "Bodeguero",
    subtitle: "Recibe + despacha",
    description: "Recibís contenedores, armás camiones y cerrás cargas.",
    icon: Icon.warehouse(28),
  },
  camionero: {
    role: "camionero",
    label: "Transportista",
    subtitle: "Entrega último kilómetro",
    description: "Iniciás ruta, navegás paradas y confirmás POD con foto + firma.",
    icon: Icon.truck(28),
  },
  supervisor: {
    role: "supervisor",
    label: "Supervisor",
    subtitle: "Coordina turno",
    description: "Aprobás incidencias y resolvés excepciones del turno.",
    icon: Icon.eye(28),
  },
  operario: {
    role: "operario",
    label: "Operario",
    subtitle: "Tareas generales",
    description: "Operaciones genéricas de almacén.",
    icon: Icon.users(28),
  },
};

export function ModosClient({ operario, errorMsg }: Props) {
  const [pickedRole, setPickedRole] = useState<OperarioRole | null>(null);

  return (
    <div
      style={{
        minHeight: "100dvh",
        background:
          "linear-gradient(160deg, var(--ink) 0%, #1F3055 100%)",
        color: "var(--ink-inv)",
        display: "flex",
        flexDirection: "column",
        padding:
          "calc(env(safe-area-inset-top) + 28px) 20px calc(env(safe-area-inset-bottom) + 20px)",
      }}
    >
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 28,
        }}
      >
        <BrandMark variant="reverse" size={56} />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              font: "700 10.5px/1 var(--f-sans)",
              color: "var(--wine-soft)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            DTD · Modos del día
          </div>
          <div
            style={{
              font: "900 16px/1.1 var(--f-display)",
              letterSpacing: "-0.02em",
              marginTop: 4,
            }}
          >
            Hola, {operario.firstName}
          </div>
        </div>
      </header>

      {/* Title */}
      <div style={{ marginBottom: 22 }}>
        <h1
          style={{
            font: "900 26px/1.1 var(--f-display)",
            letterSpacing: "-0.02em",
            margin: "0 0 6px",
          }}
        >
          ¿Qué modo vas a hacer hoy?
        </h1>
        <p
          style={{
            font: "500 13.5px/1.45 var(--f-sans)",
            color: "var(--ink-inv-soft)",
            margin: 0,
          }}
        >
          Tu cuenta tiene {operario.roles.length} modos habilitados. La
          elección dura 12 horas — al día siguiente vas a poder elegir
          otro.
        </p>
      </div>

      {/* Cards */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          flex: 1,
        }}
      >
        {operario.roles.map((role) => {
          const def = MODE_DEFS[role];
          if (!def) return null;
          const isPicked = pickedRole === role;
          return (
            <form
              key={role}
              action={chooseModeAction}
              onSubmit={() => setPickedRole(role)}
            >
              <input type="hidden" name="mode" value={role} />
              <button
                type="submit"
                disabled={pickedRole !== null}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: 18,
                  background: isPicked
                    ? "rgba(168, 50, 62, 0.22)"
                    : "rgba(255,255,255,0.06)",
                  border: `1.5px solid ${isPicked ? "var(--wine-soft)" : "rgba(255,255,255,0.14)"}`,
                  borderRadius: "var(--r-md)",
                  color: "var(--ink-inv)",
                  cursor: pickedRole === null ? "pointer" : "default",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  transition: "background var(--dur) var(--ease), border var(--dur) var(--ease)",
                }}
              >
                <div
                  aria-hidden="true"
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: "var(--r-sm)",
                    background: isPicked
                      ? "var(--wine-soft)"
                      : "rgba(255,255,255,0.08)",
                    color: isPicked ? "var(--ink)" : "var(--ink-inv)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {def.icon}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      font: "900 16px/1.1 var(--f-display)",
                      letterSpacing: "-0.01em",
                      marginBottom: 3,
                    }}
                  >
                    {def.label}
                  </div>
                  <div
                    style={{
                      font: "700 11px/1 var(--f-sans)",
                      color: "var(--wine-soft)",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      marginBottom: 6,
                    }}
                  >
                    {def.subtitle}
                  </div>
                  <div
                    style={{
                      font: "500 12.5px/1.4 var(--f-sans)",
                      color: "var(--ink-inv-soft)",
                    }}
                  >
                    {def.description}
                  </div>
                </div>
                <div
                  aria-hidden="true"
                  style={{
                    color: "var(--ink-inv-mute)",
                    flexShrink: 0,
                  }}
                >
                  {isPicked ? (
                    <span
                      className="studio-spin"
                      style={{ display: "inline-flex" }}
                    >
                      <svg viewBox="0 0 24 24" width={18} height={18} fill="none">
                        <path
                          d="M20 11.5A8 8 0 1 1 12 4"
                          stroke="currentColor"
                          strokeWidth={1.6}
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                  ) : (
                    <svg viewBox="0 0 24 24" width={18} height={18} fill="none">
                      <path
                        d="M9 18l6-6-6-6"
                        stroke="currentColor"
                        strokeWidth={1.6}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
              </button>
            </form>
          );
        })}
      </div>

      {/* Error banner */}
      {errorMsg && (
        <div
          role="alert"
          style={{
            marginTop: 18,
            padding: 12,
            background: "rgba(168, 50, 62, 0.18)",
            border: "1px solid rgba(168, 50, 62, 0.4)",
            borderRadius: "var(--r-sm)",
            color: "var(--ink-inv)",
            font: "600 12.5px/1.4 var(--f-sans)",
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          marginTop: 24,
          textAlign: "center",
          font: "500 11px/1.4 var(--f-sans)",
          color: "var(--ink-inv-mute)",
        }}
      >
        DTD Cargo 2026 · Despacho VE
      </div>
    </div>
  );
}

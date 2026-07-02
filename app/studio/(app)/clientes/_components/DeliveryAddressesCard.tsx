"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import type { ClientDeliveryAddress } from "@/lib/studio/client-address-types";
import {
  addClientAddressAction,
  setDefaultClientAddressAction,
  deleteClientAddressAction,
} from "../actions";

/**
 * Direcciones de entrega del cliente (SDD-0138 Slice B). El asesor las gestiona
 * acá; el cliente gestiona LAS SUYAS desde /portal/cuenta — mismo esquema
 * (`client_delivery_addresses`, migr 0198), dos superficies. La predeterminada es
 * la que usa la operación para el last-mile.
 */
export function DeliveryAddressesCard({
  clientId,
  markbox,
  addresses,
}: {
  clientId: string;
  markbox: string;
  addresses: ClientDeliveryAddress[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guard anti doble-click de las acciones por fila (predeterminar/eliminar):
  // mientras una está en vuelo, las demás quedan deshabilitadas.
  const [busy, setBusy] = useState<string | null>(null);

  // Campos del alta (form controlado, patrón de las cards del módulo).
  const [label, setLabel] = useState("");
  const [line, setLine] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [reference, setReference] = useState("");
  const [isDefault, setIsDefault] = useState(addresses.length === 0);

  function resetForm() {
    setLabel("");
    setLine("");
    setCity("");
    setState("");
    setReference("");
    setIsDefault(false);
    setAdding(false);
    setError(null);
  }

  function buildFormData(): FormData {
    const fd = new FormData();
    fd.set("label", label);
    fd.set("line", line);
    fd.set("city", city);
    fd.set("state", state);
    fd.set("reference", reference);
    if (isDefault) fd.set("isDefault", "on");
    return fd;
  }

  return (
    <section
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <span className="studio-eyebrow">Direcciones de entrega</span>
        <Badge tone={addresses.length > 0 ? "info" : "neutral"} size="md">
          {addresses.length === 0
            ? "Sin direcciones"
            : addresses.length === 1
              ? "1 dirección"
              : `${addresses.length} direcciones`}
        </Badge>
      </div>

      <p
        style={{
          font: "500 13px/1.5 var(--f-sans)",
          color: "var(--ink-soft)",
          margin: "0 0 12px",
        }}
      >
        El cliente también las gestiona desde su portal (Mi cuenta). La{" "}
        <b style={{ color: "var(--ink)" }}>predeterminada</b> es la que usa la
        operación para la entrega.
      </p>

      {addresses.length > 0 && (
        <ul
          style={{
            listStyle: "none",
            margin: "0 0 12px",
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {addresses.map((a) => (
            <li
              key={a.id}
              style={{
                border: "1px solid var(--border)",
                borderLeft: a.isDefault
                  ? "3px solid var(--wine)"
                  : "1px solid var(--border)",
                borderRadius: "var(--r-md)",
                padding: "10px 12px",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  {a.label && (
                    <span style={{ font: "700 12.5px/1.2 var(--f-sans)", color: "var(--ink)" }}>
                      {a.label}
                    </span>
                  )}
                  {a.isDefault && (
                    <Badge tone="wine" size="sm">
                      Predeterminada
                    </Badge>
                  )}
                </div>
                <div style={{ font: "500 13px/1.4 var(--f-sans)", color: "var(--ink)", marginTop: 3 }}>
                  {a.line}
                </div>
                {(a.city || a.state) && (
                  <div style={{ font: "500 11.5px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}>
                    {[a.city, a.state].filter(Boolean).join(", ")}
                  </div>
                )}
                {a.reference && (
                  <div style={{ font: "500 11px/1.4 var(--f-sans)", color: "var(--ink-mute)", marginTop: 2 }}>
                    Ref: {a.reference}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 10, flexShrink: 0, alignItems: "center" }}>
                {!a.isDefault && (
                  <button
                    type="button"
                    className="studio-link-quiet"
                    disabled={busy != null}
                    onClick={async () => {
                      setError(null);
                      setBusy(`default:${a.id}`);
                      try {
                        const res = await setDefaultClientAddressAction(clientId, markbox, a.id);
                        if (res.error) setError(res.error);
                        else {
                          toast.success(`Predeterminada actualizada en ${markbox}`);
                          router.refresh();
                        }
                      } finally {
                        setBusy(null);
                      }
                    }}
                    style={{
                      font: "600 12px/1 var(--f-sans)",
                      color: "var(--wine)",
                      background: "none",
                      border: 0,
                      cursor: busy != null ? "wait" : "pointer",
                      whiteSpace: "nowrap",
                      opacity: busy === `default:${a.id}` ? 0.6 : 1,
                    }}
                  >
                    {busy === `default:${a.id}` ? "Guardando…" : "Predeterminar"}
                  </button>
                )}
                <button
                  type="button"
                  className="studio-link-quiet"
                  disabled={busy != null}
                  onClick={async () => {
                    setError(null);
                    setBusy(`delete:${a.id}`);
                    try {
                      const res = await deleteClientAddressAction(markbox, a.id);
                      if (res.error) setError(res.error);
                      else {
                        toast.success(`Dirección eliminada de ${markbox}`);
                        router.refresh();
                      }
                    } finally {
                      setBusy(null);
                    }
                  }}
                  style={{
                    font: "600 12px/1 var(--f-sans)",
                    color: "var(--ink-mute)",
                    background: "none",
                    border: 0,
                    cursor: busy != null ? "wait" : "pointer",
                    opacity: busy === `delete:${a.id}` ? 0.6 : 1,
                  }}
                >
                  {busy === `delete:${a.id}` ? "Eliminando…" : "Eliminar"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p style={{ font: "500 12.5px/1.4 var(--f-sans)", color: "var(--danger)", margin: "0 0 10px" }}>
          {error}
        </p>
      )}

      {!adding ? (
        <button
          type="button"
          className="studio-link-quiet"
          onClick={() => setAdding(true)}
          style={{
            font: "600 12.5px/1 var(--f-sans)",
            color: "var(--wine)",
            background: "none",
            border: 0,
            cursor: "pointer",
            padding: 0,
          }}
        >
          + Agregar dirección
        </button>
      ) : (
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="studio-label">Etiqueta (opcional)</span>
              <input
                className="studio-input"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Casa, Oficina…"
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="studio-label">Ciudad</span>
              <input
                className="studio-input"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Valencia"
              />
            </label>
          </div>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="studio-label">Dirección *</span>
            <input
              className="studio-input"
              value={line}
              onChange={(e) => setLine(e.target.value)}
              placeholder="Calle, edificio, nº"
            />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="studio-label">Estado</span>
              <input
                className="studio-input"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="Carabobo"
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="studio-label">Referencia</span>
              <input
                className="studio-input"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Frente a la plaza…"
              />
            </label>
          </div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              font: "500 12.5px/1.3 var(--f-sans)",
              color: "var(--ink-soft)",
            }}
          >
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              style={{ accentColor: "var(--wine)" }}
            />
            Marcar como predeterminada
          </label>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <ActionButton
              variant="dark"
              size="sm"
              idleLabel="Guardar dirección"
              loadingLabel="Guardando…"
              successLabel="Dirección guardada"
              disabled={line.trim() === ""}
              onAction={async () => {
                setError(null);
                return addClientAddressAction(clientId, markbox, buildFormData());
              }}
              onSuccess={() => {
                toast.success(`Dirección agregada a ${markbox}`);
                resetForm();
                router.refresh();
              }}
              onError={setError}
            />
            <button
              type="button"
              className="studio-link-quiet"
              onClick={resetForm}
              style={{
                font: "600 12.5px/1 var(--f-sans)",
                color: "var(--ink-soft)",
                background: "none",
                border: 0,
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

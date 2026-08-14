"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import {
  lastMileEstimate,
  type ClientDeliveryAddress,
} from "@/lib/studio/client-address-types";

/** Ciudad del catálogo del calculador, con su precio de entrega (Slice C). */
export type AddressCity = {
  id: string;
  label: string;
  km: number;
  casco: boolean;
  /**
   * USD por m³ del tramo nacional (SDD-0237). Lo alimenta el llamador cruzando
   * `calculator_cities` con `public_carrier_tariffs()` vía `combinarDestinos`.
   * `null` = sin tarifa confirmada → la card dice que la cotiza un asesor, que
   * es lo honesto: no hay número que podamos sostener.
   */
  ventaCbm?: number | null;
};
import {
  addClientAddressAction,
  setDefaultClientAddressAction,
  deleteClientAddressAction,
} from "../actions";

/**
 * Direcciones de entrega del cliente (SDD-0138 Slice B). El asesor las gestiona
 * acá; el cliente gestiona LAS SUYAS desde /portal/perfil — mismo esquema
 * (`client_delivery_addresses`, migr 0198), dos superficies. La predeterminada es
 * la que usa la operación para el last-mile.
 */
export function DeliveryAddressesCard({
  clientId,
  markbox,
  addresses,
  cities = [],
}: {
  clientId: string;
  markbox: string;
  addresses: ClientDeliveryAddress[];
  cities?: AddressCity[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guard anti doble-click de las acciones por fila (predeterminar/eliminar):
  // mientras una está en vuelo, las demás quedan deshabilitadas.
  const [busy, setBusy] = useState<string | null>(null);

  // SDD-0262 · MP-01 R2. El borrado es soft-delete (P2) pero NO tiene camino de
  // restauración en el Studio, así que no califica como R1 "ejecutar y deshacer":
  // pide confirmación con el nombre del registro y su consecuencia. El error se
  // queda DENTRO del diálogo — si se pintara en la card, se perdería al cerrar.
  const [pendingDelete, setPendingDelete] = useState<ClientDeliveryAddress | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function confirmarBorrado() {
    const a = pendingDelete;
    if (!a) return;
    setDeleteError(null);
    setBusy(`delete:${a.id}`);
    try {
      const res = await deleteClientAddressAction(markbox, a.id);
      if (res.error) {
        setDeleteError(res.error);
        return;
      }
      setPendingDelete(null);
      toast.success(`Dirección eliminada de ${markbox}`);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  // Campos del alta (form controlado, patrón de las cards del módulo). La ciudad
  // sale del catálogo del calculador (Slice C: slug → estimado); "otra" = texto libre.
  const [label, setLabel] = useState("");
  const [line, setLine] = useState("");
  const [citySel, setCitySel] = useState<string>(cities.length > 0 ? "" : "otra");
  const [cityOther, setCityOther] = useState("");
  const [state, setState] = useState("");
  const [reference, setReference] = useState("");
  const [isDefault, setIsDefault] = useState(addresses.length === 0);

  const selectedCity = cities.find((c) => c.id === citySel) ?? null;

  function resetForm() {
    setLabel("");
    setLine("");
    setCitySel(cities.length > 0 ? "" : "otra");
    setCityOther("");
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
    if (selectedCity) {
      fd.set("city", selectedCity.label);
      fd.set("citySlug", selectedCity.id);
    } else {
      fd.set("city", cityOther);
    }
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
                  <div style={{ font: "500 11px/1.4 var(--f-sans)", color: "var(--ink-soft)", marginTop: 2 }}>
                    Ref: {a.reference}
                  </div>
                )}
                <AddressEstimate address={a} cities={cities} />
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
                      color: "var(--wine-text)",
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
                {/* BTN-01 §2 y §4: una destructiva se lee como destructiva y no
                    comparte borde con una positiva ("Predeterminar" va al lado).
                    La decisión final vive en el diálogo, con objeto y consecuencia. */}
                <button
                  type="button"
                  className="studio-link-quiet"
                  disabled={busy != null}
                  onClick={() => {
                    setError(null);
                    setDeleteError(null);
                    setPendingDelete(a);
                  }}
                  style={{
                    font: "600 12px/1 var(--f-sans)",
                    color: "var(--danger)",
                    background: "none",
                    border: 0,
                    cursor: busy != null ? "wait" : "pointer",
                    marginLeft: 6,
                  }}
                >
                  Eliminar
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
            color: "var(--wine-text)",
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
              {cities.length > 0 ? (
                <select
                  className="studio-input"
                  value={citySel}
                  onChange={(e) => setCitySel(e.target.value)}
                >
                  <option value="">Selecciona…</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                  <option value="otra">Otra ciudad…</option>
                </select>
              ) : (
                <input
                  className="studio-input"
                  value={cityOther}
                  onChange={(e) => setCityOther(e.target.value)}
                  placeholder="Valencia"
                />
              )}
            </label>
            {cities.length > 0 && citySel === "otra" && (
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span className="studio-label">¿Cuál ciudad?</span>
                <input
                  className="studio-input"
                  value={cityOther}
                  onChange={(e) => setCityOther(e.target.value)}
                  placeholder="Escribe la ciudad"
                />
              </label>
            )}
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

      {/* SDD-0262 · SGE-00.03 (fricción proporcional al riesgo) + SGE-00.11
          (la confirmación expresa la consecuencia) + MP-01 §3 R2 (nombre del
          registro y consecuencia). Nada promete recuperación: no existe camino
          de restauración en el Studio, y BTN-01 §3 prohíbe prometerla. */}
      <ConfirmDialog
        open={pendingDelete != null}
        danger
        title="Eliminar dirección"
        message={pendingDelete ? mensajeBorrado(pendingDelete, markbox) : ""}
        confirmLabel="Eliminar dirección"
        pending={pendingDelete != null && busy === `delete:${pendingDelete.id}`}
        error={deleteError ?? undefined}
        onCancel={() => {
          setPendingDelete(null);
          setDeleteError(null);
        }}
        onConfirm={() => {
          void confirmarBorrado();
        }}
      />
    </section>
  );
}

/** La dirección tal como la ve el asesor, para que confirme lo que cree. */
function describirDireccion(a: ClientDeliveryAddress): string {
  return [a.label, a.line, [a.city, a.state].filter(Boolean).join(", ")]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(" · ");
}

/**
 * Consecuencia real, medida contra el código: `softDeleteClientDeliveryAddress`
 * sólo sella `deleted_at` y NO reasigna la predeterminada, así que borrar la
 * predeterminada deja al cliente sin dirección para el last-mile.
 */
function mensajeBorrado(a: ClientDeliveryAddress, markbox: string): string {
  const base = `«${describirDireccion(a)}» deja de estar disponible para los envíos de ${markbox} y no se puede recuperar desde el Studio.`;
  return a.isDefault
    ? `${base} Además es la predeterminada: ${markbox} queda sin dirección de entrega hasta que marques otra.`
    : base;
}

/**
 * Cómo se cobra la entrega de una dirección. Solo si la ciudad es del catálogo;
 * si no, no muestra nada (degrada honesto).
 *
 * Desde SDD-0237 ya NO usa `lastMileParams` (el umbral de km y la tarifa por km
 * quedaron legacy): el precio viene con la ciudad, como USD por m³.
 */
function AddressEstimate({
  address,
  cities,
}: {
  address: ClientDeliveryAddress;
  cities: AddressCity[];
}) {
  const catalogCity = address.citySlug
    ? (cities.find((c) => c.id === address.citySlug) ?? null)
    : null;
  if (!catalogCity) return null;
  const est = lastMileEstimate(catalogCity);
  return (
    <div style={{ font: "500 11.5px/1.4 var(--f-sans)", marginTop: 3 }}>
      {est.included ? (
        <span style={{ color: "var(--success)" }}>Entrega incluida</span>
      ) : "sinTarifa" in est ? (
        <span style={{ color: "var(--ink-soft)" }}>
          Entrega sin tarifa confirmada — la cotiza un asesor
        </span>
      ) : (
        <span style={{ color: "var(--ink-soft)" }}>
          Entrega{" "}
          <b style={{ color: "var(--ink)", fontFamily: "var(--f-mono)" }}>
            ${est.usdPorCbm.toFixed(2)}
          </b>{" "}
          por m³ (tarifario de /studio/admin)
        </span>
      )}
    </div>
  );
}

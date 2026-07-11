"use client";

/**
 * ClientDrawer — crear/editar cliente (SDD-0010).
 *
 * Drawer lateral derecho 560px. Mode "create" o "edit" según props.
 * useActionState con createClientAction / updateClientAction.
 * Soft delete button en footer (solo mode edit) con confirmación inline.
 * En mode create: MARKBOX se autogenera al submit (no input).
 * En mode edit: MARKBOX visible read-only.
 */

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CLIENT_TIER_OPTIONS,
  DOC_KIND_OPTIONS,
  clientCompleteness,
  type Client,
  type ClientActionState,
  type ClientDocKind,
  type ClientTier,
} from "@/lib/studio/client-types";
import {
  createClientAction,
  geocodeClientAddressAction,
  softDeleteClientAction,
  updateClientAction,
} from "../actions";
import { Icon } from "@/app/studio/_components/icons";
import { SplitActionButton } from "@/app/studio/_components/ui/SplitActionButton";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";

interface Props {
  mode: "create" | "edit";
  client?: Client;
  onClose: () => void;
}

const initialState: ClientActionState = {};

export function ClientDrawer({ mode, client, onClose }: Props) {
  const action =
    mode === "edit" && client
      ? updateClientAction.bind(null, client.markbox)
      : createClientAction;
  const [state, formAction, isPending] = useActionState(action, initialState);

  const [tier, setTier] = useState<ClientTier>(client?.tier ?? "regular");
  // SDD-0131: tipo de documento del alta (persona/empresa). Cambia las etiquetas
  // del nombre y del documento, y muestra el contacto operativo si es empresa.
  const [docKind, setDocKind] = useState<ClientDocKind>(
    client?.doc_kind ?? "persona",
  );
  const isCompany = docKind === "empresa";

  const [lat, setLat] = useState<string>(
    client?.lat != null ? String(client.lat) : "",
  );
  const [lng, setLng] = useState<string>(
    client?.lng != null ? String(client.lng) : "",
  );
  const [geoStatus, setGeoStatus] = useState<
    "idle" | "loading" | "ok" | "denied" | "unavailable" | "error"
  >("idle");
  const [geoError, setGeoError] = useState<string | null>(null);

  const [geocodeMatched, setGeocodeMatched] = useState<string | null>(null);
  const [isGeocoding, startGeocoding] = useTransition();

  const captureGps = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoStatus("unavailable");
      setGeoError("Browser sin soporte de geolocation.");
      return;
    }
    setGeoStatus("loading");
    setGeoError(null);
    setGeocodeMatched(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setGeoStatus("ok");
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeoStatus("denied");
          setGeoError("Permiso de ubicación denegado por el navegador.");
        } else {
          setGeoStatus("error");
          setGeoError(err.message || "No se pudo obtener la ubicación.");
        }
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const geocodeFromAddress = () => {
    const addressInput = document.getElementById("cl-address") as HTMLInputElement | null;
    const addr = addressInput?.value.trim();
    if (!addr) {
      setGeoStatus("error");
      setGeoError("Carga una dirección primero.");
      return;
    }
    setGeoStatus("loading");
    setGeoError(null);
    setGeocodeMatched(null);
    startGeocoding(async () => {
      const result = await geocodeClientAddressAction(addr);
      if (result.ok) {
        setLat(result.result.lat.toFixed(6));
        setLng(result.result.lng.toFixed(6));
        setGeocodeMatched(result.result.displayName);
        setGeoStatus("ok");
      } else {
        setGeoStatus("error");
        setGeoError(result.error);
      }
    });
  };

  const clearGps = () => {
    setLat("");
    setLng("");
    setGeoStatus("idle");
    setGeoError(null);
    setGeocodeMatched(null);
  };

  const [confirmDelete, setConfirmDelete] = useState(false);
  const router = useRouter();
  const toast = useToast();
  // Error local del SplitActionButton (modo create) · el useActionState
  // legacy seguía manejando errores via state.error.
  const [createError, setCreateError] = useState<string | null>(null);

  /** Reset de campos para "Crear y empezar otra". */
  const resetFormFields = () => {
    const formEl = document.getElementById(
      "client-drawer-form",
    ) as HTMLFormElement | null;
    formEl?.reset();
    setTier("regular");
    setDocKind("persona");
    setLat("");
    setLng("");
    setGeoStatus("idle");
    setGeoError(null);
    setGeocodeMatched(null);
  };

  /**
   * Crea cliente llamando createClientAction directo + ejecuta el
   * comportamiento `postAction` según opción del SplitActionButton.
   */
  const createWithPostAction = async (
    postAction: "close" | "open" | "reset",
  ): Promise<void | { error?: string }> => {
    setCreateError(null);
    const formEl = document.getElementById(
      "client-drawer-form",
    ) as HTMLFormElement | null;
    if (!formEl) return { error: "No se encontró el formulario." };
    if (!formEl.checkValidity()) {
      formEl.reportValidity();
      return { error: "Hay campos requeridos sin completar." };
    }
    const formData = new FormData(formEl);
    const result = await createClientAction({} as ClientActionState, formData);
    if (result.error) {
      setCreateError(result.error);
      return { error: result.error };
    }
    if (result.fieldErrors) {
      const firstErr =
        Object.values(result.fieldErrors).find((v) => !!v) ??
        "Revisa los campos.";
      setCreateError(firstErr);
      return { error: firstErr };
    }
    if (!result.ok || !result.createdMarkbox) {
      const m = "No se pudo crear el cliente.";
      setCreateError(m);
      return { error: m };
    }
    const markbox = result.createdMarkbox;

    // SDD-0131: "qué falta para completar" al crear. Se calcula del propio form
    // (foto y verificación siempre faltan al alta → se completan luego en la
    // ficha). Aviso informativo, no bloquea. En "abrir perfil" no lo mostramos:
    // la card de la ficha ya lo dice.
    const missing = clientCompleteness({
      doc_kind: docKind,
      rif: (formData.get("rif") as string | null) || null,
      contact_name: (formData.get("contact_name") as string | null) || null,
      email: (formData.get("email") as string | null) || null,
      phone: (formData.get("phone") as string | null) || null,
      address: (formData.get("address") as string | null) || null,
      cedula_photo_path: null,
      doc_verify_status: null,
    }).missingLabels;
    if (postAction !== "open" && missing.length > 0) {
      toast.info(`Para completar ${markbox} falta: ${missing.join(", ")}.`, {
        link: {
          href: `/studio/clientes/${markbox}`,
          label: "Completar perfil",
        },
      });
    }

    if (postAction === "close") {
      toast.success(`Cliente ${markbox} creado`, {
        link: {
          href: `/studio/clientes/${markbox}`,
          label: "Abrir perfil",
        },
      });
      router.push(
        `/studio/clientes?highlight=${encodeURIComponent(markbox)}&hl-tone=warm`,
      );
      onClose();
    } else if (postAction === "open") {
      toast.success(`Cliente ${markbox} creado · abriendo perfil`);
      router.push(`/studio/clientes/${markbox}`);
      onClose();
    } else if (postAction === "reset") {
      toast.success(`Cliente ${markbox} creado · empieza el siguiente`, {
        link: {
          href: `/studio/clientes?highlight=${encodeURIComponent(markbox)}&hl-tone=warm`,
          label: "Ver en listado",
        },
      });
      resetFormFields();
    }
    return undefined;
  };
  const [isDeleting, startDelete] = useTransition();

  // Cerrar drawer en success — SDD-0032: si hay warning, NO cerrar
  // automáticamente para que el founder vea el aviso (email no encolado).
  useEffect(() => {
    if (state.ok && !state.warning) onClose();
  }, [state.ok, state.warning, onClose]);

  const title = mode === "create" ? "Nuevo cliente" : "Editar cliente";

  return (
    <div
      onClick={() => !isPending && !isDeleting && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-drawer-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 30, 61, 0.55)",
        zIndex: 100,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(560px, 96vw)",
          height: "100vh",
          background: "var(--bg-surface)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "var(--shadow-pop)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <header
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
            gap: 12,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            <h2
              id="client-drawer-title"
              className="studio-display"
              style={{ fontSize: 18, margin: 0, color: "var(--ink)" }}
            >
              {title}
            </h2>
            {mode === "edit" && client && (
              <div
                style={{
                  font: "700 11.5px/1 var(--f-mono)",
                  color: "var(--ink-soft)",
                  letterSpacing: "0.02em",
                }}
              >
                {client.markbox}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            disabled={isPending || isDeleting}
            style={{
              width: 32,
              height: 32,
              display: "grid",
              placeItems: "center",
              borderRadius: "var(--r-sm)",
              color: "var(--ink-soft)",
              background: "transparent",
              cursor: isPending || isDeleting ? "wait" : "pointer",
              flexShrink: 0,
            }}
          >
            {Icon.close(14)}
          </button>
        </header>

        <form
          id="client-drawer-form"
          action={mode === "edit" ? formAction : undefined}
          onSubmit={
            mode === "create" ? (e) => e.preventDefault() : undefined
          }
          style={{
            flex: 1,
            overflow: "auto",
            padding: "20px 22px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {mode === "create" && (
            <div
              style={{
                padding: "10px 12px",
                background: "var(--bg-elevated)",
                borderRadius: "var(--r-sm)",
                font: "500 11.5px/1.4 var(--f-sans)",
                color: "var(--ink-soft)",
              }}
            >
              El Shipping Mark se asigna automáticamente al crear el cliente.
            </div>
          )}

          {/* Tipo de documento · persona (cédula) / empresa (RIF) — SDD-0131 */}
          <div>
            <label className="studio-label">
              Tipo de cliente <span style={{ color: "var(--wine-text)" }}>*</span>
            </label>
            {/* Hidden input: el value entra al FormData tanto en create
                (new FormData(formEl)) como en edit (form action). */}
            <input type="hidden" name="doc_kind" value={docKind} />
            {/* Toggle de 2 opciones: `role="group"` + `aria-pressed` (no radiogroup
                ARIA, que exigiría roving tabindex + flechas). Contrato honesto:
                dos toggles reales, ambos en el tab order, selección con Enter/Espacio. */}
            <div
              role="group"
              aria-label="Tipo de cliente"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginTop: 4,
              }}
            >
              {DOC_KIND_OPTIONS.map((opt) => {
                const active = docKind === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setDocKind(opt.value)}
                    className="studio-btn"
                    style={{
                      justifyContent: "center",
                      border: `1px solid ${active ? "var(--wine)" : "var(--border)"}`,
                      background: active ? "var(--wine-tint)" : "var(--bg-surface)",
                      color: active ? "var(--wine)" : "var(--ink-soft)",
                      fontWeight: active ? 700 : 500,
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nombre / Razón social */}
          <div>
            <label className="studio-label" htmlFor="cl-name">
              {isCompany ? "Razón social" : "Nombre"}{" "}
              <span style={{ color: "var(--wine-text)" }}>*</span>
            </label>
            <input
              id="cl-name"
              name="name"
              type="text"
              className="studio-input"
              defaultValue={client?.name ?? ""}
              placeholder={isCompany ? "Inversiones Demo, C.A." : "Juan Pérez"}
              required
              autoFocus
            />
            {state.fieldErrors?.name && <FieldError msg={state.fieldErrors.name} />}
          </div>

          {/* Nombre de contacto · solo empresa (SDD-0131) */}
          {isCompany && (
            <div>
              <label className="studio-label" htmlFor="cl-contact-name">
                Nombre de contacto{" "}
                <span style={{ color: "var(--ink-soft)", fontWeight: 500 }}>
                  (opcional)
                </span>
              </label>
              <input
                id="cl-contact-name"
                name="contact_name"
                type="text"
                className="studio-input"
                defaultValue={client?.contact_name ?? ""}
                placeholder="Persona con quien se coordina"
                autoComplete="off"
              />
              {state.fieldErrors?.contact_name && (
                <FieldError msg={state.fieldErrors.contact_name} />
              )}
            </div>
          )}

          {/* Tier */}
          <div>
            <label className="studio-label" htmlFor="cl-tier">
              Tier <span style={{ color: "var(--wine-text)" }}>*</span>
            </label>
            <select
              id="cl-tier"
              name="tier"
              className="studio-input"
              value={tier}
              onChange={(e) => setTier(e.target.value as ClientTier)}
              required
            >
              {CLIENT_TIER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {state.fieldErrors?.tier && <FieldError msg={state.fieldErrors.tier} />}
          </div>

          {/* Email + Teléfono */}
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <div>
              <label className="studio-label" htmlFor="cl-email">
                Email
              </label>
              <input
                id="cl-email"
                name="email"
                type="email"
                className="studio-input"
                defaultValue={client?.email ?? ""}
                placeholder="compras@empresa.com"
                autoComplete="off"
              />
              {state.fieldErrors?.email && <FieldError msg={state.fieldErrors.email} />}
            </div>
            <div>
              <label className="studio-label" htmlFor="cl-phone">
                Teléfono
              </label>
              <input
                id="cl-phone"
                name="phone"
                type="text"
                className="studio-input"
                defaultValue={client?.phone ?? ""}
                placeholder="+58 414 1234567"
                autoComplete="off"
              />
            </div>
          </div>

          {/* Dirección */}
          <div>
            <label className="studio-label" htmlFor="cl-address">
              Dirección
            </label>
            <input
              id="cl-address"
              name="address"
              type="text"
              className="studio-input"
              defaultValue={client?.address ?? ""}
              placeholder="Av. Bolívar, Edif Centro, Piso 4, Valencia"
              autoComplete="off"
            />
          </div>

          {/* GPS · habilita "Cerca tuyo" del Mobile ERP */}
          <div
            style={{
              padding: "12px 14px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-sm)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  className="studio-eyebrow"
                  style={{ font: "700 10.5px/1 var(--f-sans)", color: "var(--ink-soft)", letterSpacing: "0.06em" }}
                >
                  Ubicación GPS
                </div>
                <div
                  style={{
                    font: "500 11.5px/1.4 var(--f-sans)",
                    color: "var(--ink-soft)",
                    marginTop: 4,
                  }}
                >
                  Capturá visitando al cliente · habilita &quot;Cerca tuyo&quot; del Mobile ERP.
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="studio-btn studio-btn-ghost studio-btn-sm"
                  onClick={geocodeFromAddress}
                  disabled={isGeocoding || geoStatus === "loading"}
                  style={{ whiteSpace: "nowrap" }}
                  title="Geocoding via OpenStreetMap a partir de la dirección"
                >
                  {isGeocoding ? "Buscando…" : "Buscar desde dirección"}
                </button>
                <button
                  type="button"
                  className="studio-btn studio-btn-ghost studio-btn-sm"
                  onClick={captureGps}
                  disabled={isGeocoding || geoStatus === "loading"}
                  style={{ whiteSpace: "nowrap" }}
                >
                  {geoStatus === "loading" && !isGeocoding ? "Capturando…" : "Capturar GPS aquí"}
                </button>
                {(lat || lng) && (
                  <button
                    type="button"
                    className="studio-btn studio-btn-ghost studio-btn-sm"
                    onClick={clearGps}
                    style={{ color: "var(--ink-soft)" }}
                    aria-label="Limpiar GPS"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            <div
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
            >
              <div>
                <label className="studio-label" htmlFor="cl-lat">
                  Latitud
                </label>
                <input
                  id="cl-lat"
                  name="lat"
                  type="text"
                  inputMode="decimal"
                  className="studio-input studio-input-mono"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="10.182650"
                  autoComplete="off"
                />
                {state.fieldErrors?.lat && <FieldError msg={state.fieldErrors.lat} />}
              </div>
              <div>
                <label className="studio-label" htmlFor="cl-lng">
                  Longitud
                </label>
                <input
                  id="cl-lng"
                  name="lng"
                  type="text"
                  inputMode="decimal"
                  className="studio-input studio-input-mono"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  placeholder="-68.005250"
                  autoComplete="off"
                />
                {state.fieldErrors?.lng && <FieldError msg={state.fieldErrors.lng} />}
              </div>
            </div>

            {geoStatus === "ok" && (
              <div
                style={{
                  font: "500 11px/1.4 var(--f-sans)",
                  color: "var(--success)",
                  margin: 0,
                }}
              >
                Coordenadas capturadas.
                {geocodeMatched && (
                  <div
                    style={{
                      font: "500 10.5px/1.4 var(--f-sans)",
                      color: "var(--ink-soft)",
                      marginTop: 3,
                    }}
                  >
                    Match: {geocodeMatched}
                  </div>
                )}
              </div>
            )}
            {geoError && (
              <p
                style={{
                  font: "500 11px/1.4 var(--f-sans)",
                  color: "var(--danger)",
                  margin: 0,
                }}
              >
                {geoError}
              </p>
            )}
          </div>

          {/* Documento · cédula (persona) o RIF (empresa) — SDD-0131 */}
          <div>
            <label className="studio-label" htmlFor="cl-rif">
              {isCompany ? "RIF" : "Cédula"}{" "}
              <span style={{ color: "var(--ink-soft)", fontWeight: 500 }}>
                (opcional)
              </span>
            </label>
            <input
              id="cl-rif"
              name="rif"
              type="text"
              className="studio-input studio-input-mono"
              defaultValue={client?.rif ?? ""}
              placeholder={isCompany ? "J-12345678-9" : "V-12345678"}
              autoComplete="off"
            />
            {state.fieldErrors?.rif && <FieldError msg={state.fieldErrors.rif} />}
            <p
              style={{
                font: "500 11px/1.4 var(--f-sans)",
                color: "var(--ink-soft)",
                margin: "var(--s-1) 0 0",
              }}
            >
              {isCompany
                ? "Formato: J-12345678-9 (RIF jurídico o gubernamental)."
                : "Formato: V-12345678 (cédula V o E) o P-A1234567 (pasaporte)."}
            </p>
          </div>

          {/* Notas */}
          <div>
            <label className="studio-label" htmlFor="cl-notes">
              Notas
            </label>
            <textarea
              id="cl-notes"
              name="notes"
              rows={3}
              className="studio-input"
              defaultValue={client?.notes ?? ""}
              placeholder="Volumen mensual, observaciones del contrato, agentes asignados…"
              style={{ resize: "vertical" }}
            />
          </div>

          {state.ok && state.warning && (
            <div
              role="status"
              style={{
                marginTop: 12,
                padding: 12,
                background: "var(--warning-bg)",
                color: "var(--ink)",
                border: "1px solid var(--warning)",
                borderRadius: "var(--r-sm)",
                font: "500 12.5px/1.4 var(--f-sans)",
              }}
            >
              <div style={{ font: "700 12.5px/1 var(--f-sans)", color: "var(--warning)", marginBottom: 6 }}>
                Cliente creado{state.createdMarkbox ? ` (${state.createdMarkbox})` : ""}
              </div>
              {state.warning}
              <div style={{ marginTop: 8, textAlign: "right" }}>
                <button
                  type="button"
                  className="studio-btn studio-btn-ghost studio-btn-xs"
                  onClick={onClose}
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}
          {state.error && (
            <p
              role="alert"
              style={{
                font: "500 12px/1.4 var(--f-sans)",
                color: "var(--danger)",
                margin: 0,
                padding: "10px 12px",
                background: "var(--danger-bg)",
                border: "1px solid var(--danger)",
                borderRadius: "var(--r-sm)",
              }}
            >
              {state.error}
            </p>
          )}

          <div style={{ flex: 1, minHeight: 12 }} />
        </form>

        {/* Footer */}
        <footer
          style={{
            padding: "14px 22px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            background: "var(--bg-surface)",
            flexShrink: 0,
          }}
        >
          <div>
            {mode === "edit" && client && (
              confirmDelete ? (
                <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                  <span
                    style={{
                      font: "500 12px/1 var(--f-sans)",
                      color: "var(--ink-soft)",
                    }}
                  >
                    ¿Seguro?
                  </span>
                  <button
                    type="button"
                    className="studio-btn studio-btn-danger studio-btn-sm"
                    disabled={isDeleting}
                    onClick={() => {
                      startDelete(async () => {
                        const result = await softDeleteClientAction(client.markbox);
                        if (result.ok) onClose();
                      });
                    }}
                  >
                    {isDeleting ? "Eliminando…" : "Sí, eliminar"}
                  </button>
                  <button
                    type="button"
                    className="studio-btn studio-btn-ghost studio-btn-sm"
                    onClick={() => setConfirmDelete(false)}
                    disabled={isDeleting}
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="studio-btn studio-btn-ghost studio-btn-sm"
                  style={{ color: "var(--danger)" }}
                  onClick={() => setConfirmDelete(true)}
                >
                  Eliminar
                </button>
              )
            )}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              className="studio-btn studio-btn-ghost"
              onClick={onClose}
              disabled={isPending}
            >
              Cancelar
            </button>
            {mode === "create" ? (
              <SplitActionButton
                memoryKey="client-drawer-create"
                variant="primary"
                size="default"
                disabled={isPending}
                onError={setCreateError}
                actions={[
                  {
                    key: "create-and-close",
                    idleLabel: "Crear y cerrar",
                    loadingLabel: "Creando…",
                    successLabel: "Cliente creado",
                    successIcon: Icon.check(14),
                    description:
                      "Crea el cliente y vuelve al listado con el nuevo resaltado.",
                    onAction: () => createWithPostAction("close"),
                  },
                  {
                    key: "create-and-open",
                    idleLabel: "Crear y abrir perfil",
                    loadingLabel: "Creando…",
                    successLabel: "Abriendo perfil",
                    successIcon: Icon.check(14),
                    description:
                      "Crea el cliente y abre su perfil para completar datos extra.",
                    onAction: () => createWithPostAction("open"),
                  },
                  {
                    key: "create-and-new",
                    idleLabel: "Crear y empezar otro",
                    loadingLabel: "Creando…",
                    successLabel: "Listo el siguiente",
                    successIcon: Icon.check(14),
                    description:
                      "Crea el cliente, limpia los campos y deja este drawer abierto para batch de onboarding.",
                    onAction: () => createWithPostAction("reset"),
                  },
                ]}
              />
            ) : (
              <button
                type="submit"
                form="client-drawer-form"
                className="studio-btn studio-btn-primary"
                disabled={isPending}
              >
                {isPending ? "Guardando…" : "Guardar cambios"}
              </button>
            )}
          </div>
        </footer>
      </aside>
    </div>
  );
}

function FieldError({ msg }: { msg: string }) {
  return (
    <p
      style={{
        font: "500 11px/1.3 var(--f-sans)",
        color: "var(--danger)",
        margin: "var(--s-1) 0 0",
      }}
    >
      {msg}
    </p>
  );
}
